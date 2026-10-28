import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validateImageFile,
  validateGalleryLimit,
  MAX_PACKAGE_GALLERY_IMAGES,
  MAX_PACKAGE_IMAGE_SIZE_BYTES,
  savePackageDraftState,
  loadPackageDraftState,
  clearPackageDraftState
} from '../../src/services/packageImageService';
import { calculateCommission, MOZBOOK_COMMISSION_PERCENT, PARTNER_SHARE_PERCENT } from '../../src/config/platformCommission';

function createMockStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length;
    }
  };
}

const mockSessionStorage = createMockStorage();
// @ts-ignore
globalThis.sessionStorage = mockSessionStorage;

describe('MozBook DMC — Package Image Upload & Gallery Business Logic', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. File Type and Extension Validation', () => {
    it('accepts valid JPEG, PNG, and WebP images', () => {
      const validFiles = [
        new File(['dummy'], 'gorongosa-safari.jpg', { type: 'image/jpeg' }),
        new File(['dummy'], 'bazaruto-dhow.jpeg', { type: 'image/jpeg' }),
        new File(['dummy'], 'quirimbas-aerial.png', { type: 'image/png' }),
        new File(['dummy'], 'maputo-special-reserve.webp', { type: 'image/webp' })
      ];

      for (const file of validFiles) {
        const result = validateImageFile(file);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('rejects unsupported file formats such as PDF, GIF, SVG, and executable scripts', () => {
      const invalidFiles = [
        new File(['dummy'], 'brochure.pdf', { type: 'application/pdf' }),
        new File(['dummy'], 'animation.gif', { type: 'image/gif' }),
        new File(['dummy'], 'vector.svg', { type: 'image/svg+xml' }),
        new File(['dummy'], 'malicious.exe', { type: 'application/x-msdownload' }),
        new File(['dummy'], 'payload.html', { type: 'text/html' })
      ];

      for (const file of invalidFiles) {
        const result = validateImageFile(file);
        expect(result.valid).toBe(false);
        expect(result.error).toMatch(/JPG, JPEG, PNG, and WebP/i);
      }
    });

    it('rejects files with invalid extensions even if MIME type is spoofed', () => {
      const spoofedFile = new File(['dummy'], 'malicious.php', { type: 'image/jpeg' });
      const result = validateImageFile(spoofedFile);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/JPG, JPEG, PNG, and WebP/i);
    });
  });

  describe('2. File Size Validation (Max 10 MB)', () => {
    it('allows image sizes strictly within the 10 MB threshold', () => {
      const smallFile = new File([new ArrayBuffer(1024 * 500)], 'small.jpg', { type: 'image/jpeg' });
      expect(validateImageFile(smallFile).valid).toBe(true);

      const exactFile = new File([new ArrayBuffer(MAX_PACKAGE_IMAGE_SIZE_BYTES)], 'exact.jpg', { type: 'image/jpeg' });
      expect(validateImageFile(exactFile).valid).toBe(true);
    });

    it('rejects files exceeding 10 MB with an informative error message', () => {
      const largeSize = MAX_PACKAGE_IMAGE_SIZE_BYTES + 1024;
      const largeFile = new File([new ArrayBuffer(1)], 'large.jpg', { type: 'image/jpeg' });
      Object.defineProperty(largeFile, 'size', { value: largeSize });

      const result = validateImageFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/exceeds the 10 MB limit/i);
    });
  });

  describe('3. Gallery Capacity Validation (Max 15 Images)', () => {
    it('permits uploads when the total count remains within the limit of 15', () => {
      expect(validateGalleryLimit(0, 5).valid).toBe(true);
      expect(validateGalleryLimit(10, 5).valid).toBe(true);
      expect(validateGalleryLimit(14, 1).valid).toBe(true);
    });

    it('blocks uploads that would exceed the 15 photos limit', () => {
      const result = validateGalleryLimit(12, 5);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/maximum of 15 photos/i);

      const fullResult = validateGalleryLimit(MAX_PACKAGE_GALLERY_IMAGES, 1);
      expect(fullResult.valid).toBe(false);
    });
  });

  describe('4. Draft State Persistence & Recovery', () => {
    const testUserId = 'dmc_partner_test_88';
    const testPackageId = 'pkg_draft_abc123';

    it('saves and restores in-progress package draft state including cover and gallery items', () => {
      const sampleDraft = {
        title: '7-Day Quirimbas Archipelagic Dhow Expedition',
        subtitle: 'Island Hopping, Marine Turtle Nesting & Pemba Seafood Banquets',
        shortDescription: 'Sail through pristine islands on a handcrafted motorized Mozambican dhow.',
        pricePerPersonMzn: 85000,
        coverImage: 'https://storage.googleapis.com/test-bucket/dmc_packages/88/abc123/cover.jpg',
        coverStoragePath: 'dmc_packages/88/abc123/cover.jpg',
        galleryItems: [
          {
            id: 'item_1',
            url: 'https://storage.googleapis.com/test-bucket/dmc_packages/88/abc123/photo1.jpg',
            fileName: 'dhow.jpg',
            status: 'success' as const,
            progress: 100
          }
        ]
      };

      savePackageDraftState(testUserId, sampleDraft, testPackageId);

      const recovered = loadPackageDraftState(testUserId, testPackageId);
      expect(recovered).not.toBeNull();
      expect(recovered?.title).toBe('7-Day Quirimbas Archipelagic Dhow Expedition');
      expect(recovered?.pricePerPersonMzn).toBe(85000);
      expect(recovered?.coverImage).toBe('https://storage.googleapis.com/test-bucket/dmc_packages/88/abc123/cover.jpg');
      expect(recovered?.galleryItems?.length).toBe(1);
    });

    it('clears draft state completely on demand', () => {
      savePackageDraftState(testUserId, { title: 'Temporary Title' }, testPackageId);
      expect(loadPackageDraftState(testUserId, testPackageId)).not.toBeNull();

      clearPackageDraftState(testUserId, testPackageId);
      expect(loadPackageDraftState(testUserId, testPackageId)).toBeNull();
    });
  });

  describe('5. Gallery Reordering & Cover Designation Logic', () => {
    it('shifts items left and right within array bounds correctly', () => {
      const items = ['photo_A', 'photo_B', 'photo_C'];

      // Move photo_B left -> ['photo_B', 'photo_A', 'photo_C']
      const copy1 = [...items];
      const [movedLeft] = copy1.splice(1, 1);
      copy1.splice(0, 0, movedLeft);
      expect(copy1).toEqual(['photo_B', 'photo_A', 'photo_C']);

      // Attempt moving photo_B left again (boundary check: at index 0)
      const targetIndex = 0 - 1;
      expect(targetIndex < 0).toBe(true);

      // Move photo_A right -> ['photo_B', 'photo_C', 'photo_A']
      const copy2 = [...copy1];
      const [movedRight] = copy2.splice(1, 1);
      copy2.splice(2, 0, movedRight);
      expect(copy2).toEqual(['photo_B', 'photo_C', 'photo_A']);
    });

    it('updates active cover photo and sets correct fallback on removal', () => {
      const gallery = [
        { id: '1', url: 'https://img1.jpg', isCover: true },
        { id: '2', url: 'https://img2.jpg', isCover: false },
        { id: '3', url: 'https://img3.jpg', isCover: false }
      ];

      // Remove photo 1 (which was cover)
      const remaining = gallery.filter(i => i.id !== '1');
      expect(remaining.length).toBe(2);

      // Next available becomes cover
      const nextCoverUrl = remaining[0]?.url || '';
      remaining[0].isCover = true;
      expect(nextCoverUrl).toBe('https://img2.jpg');
      expect(remaining[0].isCover).toBe(true);
    });
  });

  describe('6. Canonical MozBook Commission Verification Preservation', () => {
    it('maintains the authoritative 15% platform commission and 85% partner payout', () => {
      expect(MOZBOOK_COMMISSION_PERCENT).toBe(15);
      expect(PARTNER_SHARE_PERCENT).toBe(85);

      const priceMzn = 100000;
      const calc = calculateCommission(priceMzn);

      expect(calc.commissionAmount).toBe(15000);
      expect(calc.partnerShare).toBe(85000);
      expect(calc.commissionPercent).toBe(15);
      expect(calc.partnerPercent).toBe(85);
      expect(calc.commissionAmount + calc.partnerShare).toBe(priceMzn);
    });
  });

  describe('7. Storage Error Formatting and Timeout Safety', () => {
    it('formats 404 / bucket-not-found into actionable instructions to enable Firebase Storage', async () => {
      const { formatStorageError } = await import('../../src/services/packageImageService');
      
      const err404 = { status_: 404, code: 'storage/unknown', message: 'Not found' };
      const formatted = formatStorageError(err404);
      expect(formatted).toMatch(/Firebase Storage bucket is not found or not activated/i);
      expect(formatted).toMatch(/Firebase Console/i);

      const bucketErr = { code: 'storage/bucket-not-found', message: 'No bucket' };
      expect(formatStorageError(bucketErr)).toMatch(/Firebase Storage bucket is not found/i);
    });

    it('formats unauthorized / permission denied into DMC partner permission warning', async () => {
      const { formatStorageError } = await import('../../src/services/packageImageService');
      
      const err403 = { code: 'storage/unauthorized', message: 'User does not have permission' };
      const formatted = formatStorageError(err403);
      expect(formatted).toMatch(/Permission denied by Firebase Storage security rules/i);
    });

    it('formats timeouts into clear retry notifications', async () => {
      const { formatStorageError } = await import('../../src/services/packageImageService');
      
      const timeoutErr = new Error('Image upload timed out after 25 seconds');
      const formatted = formatStorageError(timeoutErr);
      expect(formatted).toMatch(/Image upload timed out/i);
      expect(formatted).toMatch(/Please check your network connection and retry/i);
    });
  });
});
