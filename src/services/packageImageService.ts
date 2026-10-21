import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { PackageImageMetadata, TravelPackage } from '../types/dmc';

export const MAX_PACKAGE_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PACKAGE_GALLERY_IMAGES = 15;
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

export interface ImageValidationResult {
  valid: boolean;
  error?: string;
}

export interface UploadImageResult {
  id: string;
  url: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  isCover?: boolean;
}

/**
 * Validates file MIME type, extension, and file size (max 10MB).
 */
export function validateImageFile(file: File): ImageValidationResult {
  if (!file) {
    return { valid: false, error: 'No file provided for upload.' };
  }

  const nameParts = file.name.split('.');
  const extension = nameParts.length > 1 ? '.' + nameParts.pop()?.toLowerCase() : '';
  const mimeType = (file.type || '').toLowerCase();

  const isAllowedMime = ALLOWED_IMAGE_MIME_TYPES.includes(mimeType);
  const isAllowedExt = ALLOWED_IMAGE_EXTENSIONS.includes(extension);

  if (!isAllowedMime && !isAllowedExt) {
    return {
      valid: false,
      error: `Unsupported format for "${file.name}". Only JPG, JPEG, PNG, and WebP images are supported.`
    };
  }

  if (file.size > MAX_PACKAGE_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `"${file.name}" exceeds the 10 MB limit (${sizeMb} MB). Please choose an image smaller than 10 MB.`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: `"${file.name}" is an empty file (0 bytes).`
    };
  }

  return { valid: true };
}

/**
 * Validates that adding new files will not exceed the max gallery limit of 15 images.
 */
export function validateGalleryLimit(currentCount: number, additionalCount: number): ImageValidationResult {
  if (currentCount + additionalCount > MAX_PACKAGE_GALLERY_IMAGES) {
    return {
      valid: false,
      error: `Package gallery limit reached. You can upload a maximum of ${MAX_PACKAGE_GALLERY_IMAGES} photos per package (currently ${currentCount}).`
    };
  }
  return { valid: true };
}

/**
 * Generates a clean, safe filename.
 */
export function sanitizeFileName(originalName: string): string {
  const clean = originalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_');
  return clean || 'package_image.jpg';
}

/**
 * Uploads a package image with progress tracking.
 * Tries direct Firebase Storage first, then falls back to the server upload boundary.
 */
export async function uploadPackageImage(
  file: File,
  userId: string,
  packageId: string,
  onProgress?: (percent: number) => void,
  idToken?: string
): Promise<UploadImageResult> {
  // 1. Client-side fast validation
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid image file.');
  }

  if (!userId || userId.trim() === '') {
    throw new Error('Authentication required: partner ID is missing.');
  }

  const cleanName = sanitizeFileName(file.name);
  const timestamp = Date.now();
  const uniqueId = `img_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
  const storagePath = `dmc_packages/${userId}/${packageId}/${timestamp}_${cleanName}`;
  const mimeType = file.type || 'image/jpeg';

  // 2. Try Firebase Storage directly
  try {
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: mimeType,
      customMetadata: {
        userId,
        packageId,
        uploadedAt: new Date().toISOString()
      }
    });

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            onProgress?.(progress);
          }
        },
        (error) => {
          reject(error);
        },
        async () => {
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });

    onProgress?.(100);

    return {
      id: uniqueId,
      url: downloadUrl,
      storagePath,
      fileName: cleanName,
      fileSize: file.size,
      mimeType,
      uploadedAt: new Date().toISOString()
    };
  } catch (storageErr) {
    console.warn('[packageImageService] Direct Firebase Storage upload failed, falling back to server boundary:', storageErr);
  }

  // 3. Fallback: Upload via Server-Side Boundary /api/dmc/packages/upload-image
  try {
    onProgress?.(25);
    const base64Data = await fileToBase64(file);
    onProgress?.(50);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/dmc/packages/upload-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        packageId,
        fileName: cleanName,
        mimeType,
        fileSize: file.size,
        base64Data,
        partnerId: userId
      })
    });

    onProgress?.(80);

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server upload failed with status ${res.status}`);
    }

    const data = await res.json();
    onProgress?.(100);

    return {
      id: uniqueId,
      url: data.url,
      storagePath: data.storagePath || storagePath,
      fileName: cleanName,
      fileSize: file.size,
      mimeType,
      uploadedAt: new Date().toISOString()
    };
  } catch (serverErr: any) {
    console.error('[packageImageService] Both client and server uploads failed:', serverErr);
    throw new Error(serverErr.message || 'Image upload failed. Please verify your connection and try again.');
  }
}

/**
 * Deletes an uploaded image from storage.
 */
export async function deletePackageImage(
  storagePath: string,
  userId: string,
  idToken?: string
): Promise<boolean> {
  if (!storagePath) return false;

  // Security guard: Ensure path belongs to user
  if (!storagePath.startsWith(`dmc_packages/${userId}/`)) {
    console.warn('[packageImageService] Refusing to delete storage path not owned by user:', storagePath);
    return false;
  }

  // 1. Try Firebase Storage deletion
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.warn('[packageImageService] Direct Firebase Storage delete failed:', err);
  }

  // 2. Fallback to server endpoint
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const res = await fetch('/api/dmc/packages/delete-image', {
      method: 'POST',
      headers,
      body: JSON.stringify({ storagePath, partnerId: userId })
    });
    return res.ok;
  } catch (err) {
    console.error('[packageImageService] Server delete failed:', err);
    return false;
  }
}

/**
 * Helper to convert browser File to Base64 string for server transfer.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

// -------------------------------------------------------------
// Draft State Persistence across reloads & sessions
// -------------------------------------------------------------

export function getDraftStorageKey(userId: string, editId?: string): string {
  return editId 
    ? `mozbook_dmc_pkg_edit_${userId}_${editId}` 
    : `mozbook_dmc_pkg_draft_${userId}`;
}

export function savePackageDraftState(userId: string, data: any, editId?: string): void {
  try {
    if (!userId) return;
    const key = getDraftStorageKey(userId, editId);
    sessionStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('Could not save package draft to sessionStorage:', e);
  }
}

export function loadPackageDraftState(userId: string, editId?: string): any | null {
  try {
    if (!userId) return null;
    const key = getDraftStorageKey(userId, editId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.data || null;
  } catch (e) {
    console.warn('Could not load package draft from sessionStorage:', e);
    return null;
  }
}

export function clearPackageDraftState(userId: string, editId?: string): void {
  try {
    if (!userId) return;
    const key = getDraftStorageKey(userId, editId);
    sessionStorage.removeItem(key);
  } catch (e) {
    console.warn('Could not clear package draft:', e);
  }
}
