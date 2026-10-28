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

  // Require both valid MIME type and allowed extension for strict file safety
  if (!isAllowedMime || !isAllowedExt) {
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

export const UPLOAD_TIMEOUT_MS = 25000; // 25 seconds timeout

/**
 * Formats low-level Firebase Storage errors into actionable messages for DMC partners.
 */
export function formatStorageError(err: any): string {
  if (!err) return 'Image upload failed. Please try again.';

  const code = (err.code || err.status || '').toString().toLowerCase();
  const msg = (err.message || '').toString();

  if (code.includes('bucket-not-found') || code === '404' || msg.includes('404') || err.status_ === 404) {
    return 'Firebase Storage bucket is not found or not activated for this project. Please ensure Firebase Storage is enabled in the Firebase Console for project "hip-graph-485101-k7".';
  }
  if (code.includes('unauthorized') || code.includes('permission-denied') || code === '403' || msg.includes('403')) {
    return 'Permission denied by Firebase Storage security rules. Please ensure you are authenticated as the authorized DMC partner owning this package.';
  }
  if (code.includes('canceled') || msg.includes('timed out') || msg.includes('timeout')) {
    return 'Image upload timed out. The storage server did not respond in time. Please check your network connection and retry.';
  }
  if (code.includes('quota-exceeded')) {
    return 'Storage quota exceeded for this Firebase project.';
  }
  if (code.includes('unauthenticated')) {
    return 'Authentication required. Please sign in before uploading images.';
  }
  return msg || 'Image upload failed. Please verify your connection and try again.';
}

/**
 * Uploads a package image with real progress tracking and timeout enforcement.
 * Enforces partner ownership scoping: dmc_packages/{userId}/{packageId}/{fileName}
 */
export async function uploadPackageImage(
  file: File,
  userId: string,
  packageId: string,
  onProgress?: (percent: number) => void,
  _idToken?: string
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

  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: mimeType,
    customMetadata: {
      userId,
      packageId,
      uploadedAt: new Date().toISOString()
    }
  });

  let timeoutTimer: any;
  let lastProgress = 0;

  try {
    const downloadUrl = await new Promise<string>((resolve, reject) => {
      timeoutTimer = setTimeout(() => {
        try {
          uploadTask.cancel();
        } catch (_) {}
        reject(new Error('Image upload timed out after 25 seconds. The storage service did not respond.'));
      }, UPLOAD_TIMEOUT_MS);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (snapshot.totalBytes > 0) {
            const rawPercent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            const clamped = Math.max(lastProgress, Math.min(99, rawPercent));
            lastProgress = clamped;
            onProgress?.(clamped);
          }
        },
        (error) => {
          clearTimeout(timeoutTimer);
          reject(error);
        },
        async () => {
          clearTimeout(timeoutTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            onProgress?.(100);
            resolve(url);
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });

    return {
      id: uniqueId,
      url: downloadUrl,
      storagePath,
      fileName: cleanName,
      fileSize: file.size,
      mimeType,
      uploadedAt: new Date().toISOString()
    };
  } catch (err: any) {
    clearTimeout(timeoutTimer);
    const formattedError = formatStorageError(err);
    console.error('[packageImageService] Firebase Storage upload error:', formattedError, err);
    throw new Error(formattedError);
  }
}

/**
 * Deletes an uploaded image from storage.
 */
export async function deletePackageImage(
  storagePath: string,
  userId: string,
  _idToken?: string
): Promise<boolean> {
  if (!storagePath) return false;

  // Security guard: Ensure path belongs to user
  if (!storagePath.startsWith(`dmc_packages/${userId}/`)) {
    console.warn('[packageImageService] Refusing to delete storage path not owned by user:', storagePath);
    return false;
  }

  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (err) {
    console.warn('[packageImageService] Firebase Storage delete failed:', err);
    return false;
  }
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
