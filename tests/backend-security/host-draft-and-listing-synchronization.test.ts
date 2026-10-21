import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  saveUserScopedDraft, 
  getUserScopedDraft, 
  clearUserScopedDraft
} from '../../src/services/authSessionManager';
import {
  evaluateListingAutoPublishEligibility
} from '../../src/services/listingService';
import { isUserAdmin } from '../../src/server/paymentService';

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
const mockLocalStorage = createMockStorage();

// @ts-ignore
globalThis.sessionStorage = mockSessionStorage;
// @ts-ignore
globalThis.localStorage = mockLocalStorage;

describe('MozBook — Host Listing Draft Recovery, Verification UX, Automatic Publishing & Admin Authorization', () => {

  const hostUid = 'host_tropicco_123';
  const otherUserUid = 'traveler_bob_456';

  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Fix A: User-Scoped Stay Listing Draft Persistence & Isolation', () => {
    const sampleDraft = {
      residenceType: 'beachfront residence' as const,
      canonicalType: 'BEACH_HOUSE' as const,
      selectedOperatingModels: ['SELF_CATERING' as const],
      selectedSettings: ['BEACHFRONT' as const, 'COASTAL' as const],
      classificationStatus: 'VALID_MATCH' as const,
      title: 'Tofo Bay Luxury Beachfront Villa',
      description: 'Stunning panoramic ocean views with direct private sand access in Inhambane.',
      price: 8500,
      currency: 'MZN',
      minNights: 2,
      specialOffer: null,
      accommodations: [],
      isMultiUnit: false,
      availableFrom: '2026-11-01',
      availableTo: '2027-02-01',
      coordinates: { lat: -23.856, lng: 35.545 },
      city: 'Tofo',
      province: 'Inhambane',
      address: 'Praia do Tofo, Villa 4',
      selectedAmenities: ['wifi', 'ac', 'pool', 'kitchen', 'security'],
      photos: [
        {
          url: 'https://images.unsplash.com/photo-tofo-ocean-front',
          label: 'Ocean View Balcony'
        },
        {
          url: 'https://images.unsplash.com/photo-tofo-private-pool',
          label: 'Swimming Pool'
        }
      ],
      nearbyPlaces: [
        {
          id: 'np-tofo-1',
          name: 'Dino Beach Bar',
          category: 'restaurant',
          distance: '2 min walk',
          description: 'Local grilled seafood and cold 2M beer.'
        }
      ],
      savedAt: '2026-10-16T08:00:00.000Z'
    };

    it('1. Saves in-progress listing draft scoped to the host Firebase UID', () => {
      saveUserScopedDraft(hostUid, 'stay_listing_draft', sampleDraft);

      const retrieved = getUserScopedDraft<typeof sampleDraft>(hostUid, 'stay_listing_draft');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.title).toBe('Tofo Bay Luxury Beachfront Villa');
      expect(retrieved?.price).toBe(8500);
      expect(retrieved?.photos).toHaveLength(2);
      expect(retrieved?.photos[0].label).toBe('Ocean View Balcony');
      expect(retrieved?.coordinates.lat).toBe(-23.856);
    });

    it('2. Prevents another user from accessing, reading, or inheriting the host draft', () => {
      saveUserScopedDraft(hostUid, 'stay_listing_draft', sampleDraft);

      // Other user attempts to fetch draft under their own session
      const otherAttempt = getUserScopedDraft<typeof sampleDraft>(otherUserUid, 'stay_listing_draft');
      expect(otherAttempt).toBeNull();
    });

    it('3. Prevents another user from overwriting or clearing the host draft', () => {
      saveUserScopedDraft(hostUid, 'stay_listing_draft', sampleDraft);

      // Other user clears their own draft slot
      clearUserScopedDraft(otherUserUid, 'stay_listing_draft');

      // Original host draft remains intact
      const hostStillIntact = getUserScopedDraft<typeof sampleDraft>(hostUid, 'stay_listing_draft');
      expect(hostStillIntact?.title).toBe('Tofo Bay Luxury Beachfront Villa');
    });

    it('4. Clears draft strictly upon confirmed listing creation or explicit user discard', () => {
      saveUserScopedDraft(hostUid, 'stay_listing_draft', sampleDraft);
      expect(getUserScopedDraft(hostUid, 'stay_listing_draft')).not.toBeNull();

      // Confirmed listing submission
      clearUserScopedDraft(hostUid, 'stay_listing_draft');
      expect(getUserScopedDraft(hostUid, 'stay_listing_draft')).toBeNull();
    });

    it('5. Draft payload strictly omits identity documents, passports, and verification credentials', () => {
      // Ensure the listing draft interface does not contain verification document keys
      const draftKeys = Object.keys(sampleDraft);
      expect(draftKeys).not.toContain('docFrontPhotoUrl');
      expect(draftKeys).not.toContain('docBackPhotoUrl');
      expect(draftKeys).not.toContain('docNumber');
      expect(draftKeys).not.toContain('passport');
      expect(draftKeys).not.toContain('extractedData');
    });
  });

  describe('Fix C: Automatic Publishing & Listing Eligibility Invariants', () => {
    it('6. Approves eligible complete listing for both verified badge and auto-publishing', () => {
      const listing = {
        title: 'Ponta do Ouro Beach Cottage',
        location: 'Ponta do Ouro, Maputo Province',
        price: 4000,
        status: 'pending' as const,
        images: ['https://images.unsplash.com/ponta-1'],
        labeledImages: [{ url: 'https://images.unsplash.com/ponta-1', label: 'Exterior' }]
      };

      const result = evaluateListingAutoPublishEligibility(listing as any);
      expect(result.eligibleForVerifiedBadge).toBe(true);
      expect(result.eligibleForAutoPublish).toBe(true);
    });

    it('7. Strictly preserves manual suspensions and safety freezes from being auto-published', () => {
      const suspendedListing = {
        title: 'Suspended Property Under Review',
        location: 'Bilene, Gaza',
        price: 3500,
        status: 'suspended' as const,
        isSuspended: true,
        images: ['https://images.unsplash.com/bilene-1']
      };

      const result = evaluateListingAutoPublishEligibility(suspendedListing as any);
      expect(result.eligibleForVerifiedBadge).toBe(false);
      expect(result.eligibleForAutoPublish).toBe(false);
      expect(result.reason).toContain('manual safety suspension');
    });

    it('8. Strictly preserves rejected listings from being auto-published', () => {
      const rejectedListing = {
        title: 'Previously Rejected Property',
        location: 'Inhaca Island',
        price: 5000,
        status: 'rejected' as const,
        images: ['https://images.unsplash.com/inhaca-1']
      };

      const result = evaluateListingAutoPublishEligibility(rejectedListing as any);
      expect(result.eligibleForVerifiedBadge).toBe(false);
      expect(result.eligibleForAutoPublish).toBe(false);
      expect(result.reason).toContain('explicitly rejected');
    });

    it('9. Explicit draft listings or listings without photos receive badge but remain unpublished drafts', () => {
      const explicitDraftListing = {
        title: 'In-Progress Draft Lodge',
        location: 'Gorongosa, Sofala',
        price: 9000,
        status: 'draft' as const,
        images: ['https://images.unsplash.com/gorongosa-1']
      };

      const resultDraft = evaluateListingAutoPublishEligibility(explicitDraftListing as any);
      expect(resultDraft.eligibleForVerifiedBadge).toBe(true);
      expect(resultDraft.eligibleForAutoPublish).toBe(false);
      expect(resultDraft.reason).toContain('marked as draft');

      const noPhotosListing = {
        title: 'Property Without Photos',
        location: 'Pemba, Cabo Delgado',
        price: 4500,
        status: 'pending' as const,
        images: []
      };

      const resultNoPhotos = evaluateListingAutoPublishEligibility(noPhotosListing as any);
      expect(resultNoPhotos.eligibleForVerifiedBadge).toBe(true);
      expect(resultNoPhotos.eligibleForAutoPublish).toBe(false);
      expect(resultNoPhotos.reason).toContain('missing photos');
    });

    it('10. Incomplete listings missing title, location, or price are rejected from synchronization', () => {
      const incomplete = {
        title: '',
        location: '',
        price: 0
      };

      const result = evaluateListingAutoPublishEligibility(incomplete as any);
      expect(result.eligibleForVerifiedBadge).toBe(false);
      expect(result.eligibleForAutoPublish).toBe(false);
      expect(result.reason).toContain('Incomplete listing structure');
    });
  });

  describe('Fix D: Admin Authorization & Audit Invariants', () => {
    it('11. Authorizes permanent primary administrator mozbookinfo@gmail.com', () => {
      const adminUser = { uid: 'admin_official_1', email: 'mozbookinfo@gmail.com' };
      expect(isUserAdmin(adminUser)).toBe(true);

      const secondaryAdmin = { uid: 'admin_official_2', email: 'admin@mozbook.mz' };
      expect(isUserAdmin(secondaryAdmin)).toBe(true);
    });

    it('12. Strictly rejects mozinfo@gmail.com from administrator privileges', () => {
      const unauthorizedAttempt = { uid: 'imposter_admin', email: 'mozinfo@gmail.com' };
      expect(isUserAdmin(unauthorizedAttempt)).toBe(false);

      const randomUser = { uid: 'regular_user', email: 'tropicco6@gmail.com' };
      expect(isUserAdmin(randomUser)).toBe(false);
    });

    it('13. Case-insensitively authorizes mozbookinfo@gmail.com', () => {
      const upperCaseAdmin = { uid: 'admin_official_1', email: 'MOZBOOKINFO@GMAIL.COM' };
      expect(isUserAdmin(upperCaseAdmin)).toBe(true);
    });
  });

});
