import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { 
  saveUserScopedDraft, 
  getUserScopedDraft, 
  clearUserScopedDraft,
  purgeAllUserSessionData
} from '../../src/services/authSessionManager';
import { evaluateListingAutoPublishEligibility } from '../../src/services/listingService';

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

describe('MozBook — Discarded Listing Draft Persistence & Recovery Invariants', () => {
  const hostUid = 'host_spanish_villa_owner';
  const otherHostUid = 'host_other_property_owner';
  const draftKey = 'stay_listing_draft';

  const spanishVillaDraft = {
    residenceType: 'beachfront residence' as const,
    canonicalType: 'BEACH_HOUSE' as const,
    selectedOperatingModels: ['SELF_CATERING' as const],
    selectedSettings: ['BEACHFRONT' as const, 'COASTAL' as const],
    classificationStatus: 'VALID_MATCH' as const,
    title: 'Spanish Villa Belo Horizonte',
    description: 'Luxury beachfront villa overlooking Maputo Bay with private swimming pool.',
    price: 9500,
    currency: 'MZN',
    minNights: 2,
    specialOffer: null,
    accommodations: [],
    isMultiUnit: false,
    availableFrom: '2026-11-01',
    availableTo: '2027-02-01',
    coordinates: { lat: -25.9692, lng: 32.5732 },
    city: 'Belo Horizonte',
    province: 'Maputo',
    address: 'Belo Horizonte Coastal Road, Villa 7',
    selectedAmenities: ['wifi', 'ac', 'pool', 'kitchen', 'security'],
    photos: [
      { url: 'https://images.unsplash.com/photo-spanish-villa-1', label: 'Ocean View Balcony' },
      { url: 'https://images.unsplash.com/photo-spanish-villa-2', label: 'Swimming Pool' },
      { url: 'https://images.unsplash.com/photo-spanish-villa-3', label: 'Lounge' }
    ],
    nearbyPlaces: [],
    savedAt: '2026-10-20T02:00:00.000Z'
  };

  const otherHostDraft = {
    residenceType: 'safari lodge' as const,
    canonicalType: 'SAFARI_LODGE' as const,
    selectedOperatingModels: ['FULLY_SERVICED' as const],
    selectedSettings: ['SAFARI' as const],
    classificationStatus: 'VALID_MATCH' as const,
    title: 'Gorongosa Wild Bush Camp',
    description: 'Eco-lodge in Gorongosa buffer zone.',
    price: 12000,
    currency: 'MZN',
    minNights: 1,
    specialOffer: null,
    accommodations: [],
    isMultiUnit: false,
    availableFrom: '2026-12-01',
    availableTo: '2027-03-01',
    coordinates: { lat: -18.9692, lng: 34.5732 },
    city: 'Gorongosa',
    province: 'Sofala',
    address: 'Gorongosa Gate 2',
    selectedAmenities: ['wifi', 'pool', 'security'],
    photos: [
      { url: 'https://images.unsplash.com/photo-safari-1', label: 'Exterior' }
    ],
    nearbyPlaces: [],
    savedAt: '2026-10-20T02:30:00.000Z'
  };

  beforeEach(() => {
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Discard Draft Immediate & Persistent Purge', () => {
    it('discards the draft and clears it immediately from storage', () => {
      // 1. Initial state: host has draft in localStorage
      saveUserScopedDraft(hostUid, draftKey, spanishVillaDraft);
      expect(getUserScopedDraft(hostUid, draftKey)).not.toBeNull();

      // 2. User clicks "Discard Draft" -> clearUserScopedDraft is executed
      clearUserScopedDraft(hostUid, draftKey);

      // 3. Draft disappears immediately from storage
      expect(getUserScopedDraft(hostUid, draftKey)).toBeNull();
      expect(mockLocalStorage.getItem(`mozbook_draft_${hostUid}_${draftKey}`)).toBeNull();
    });

    it('simulates page refresh: discarded draft does not return after reload', () => {
      // 1. Draft was saved, then discarded
      saveUserScopedDraft(hostUid, draftKey, spanishVillaDraft);
      clearUserScopedDraft(hostUid, draftKey);

      // 2. Simulate page reload by re-reading from storage
      const refreshedDraft = getUserScopedDraft(hostUid, draftKey);
      expect(refreshedDraft).toBeNull();
    });

    it('simulates navigating away and reopening: draft remains discarded', () => {
      saveUserScopedDraft(hostUid, draftKey, spanishVillaDraft);
      clearUserScopedDraft(hostUid, draftKey);

      // Simulate navigating to /discover or /partner/dashboard and returning
      const reopenedDraft = getUserScopedDraft(hostUid, draftKey);
      expect(reopenedDraft).toBeNull();
    });
  });

  describe('2. Isolation & Other Users Draft Preservation', () => {
    it('preserves unfinished drafts belonging to other listings and accounts', () => {
      // Host A has Spanish Villa draft; Host B has Gorongosa Safari draft
      saveUserScopedDraft(hostUid, draftKey, spanishVillaDraft);
      saveUserScopedDraft(otherHostUid, draftKey, otherHostDraft);

      // Host A discards their draft
      clearUserScopedDraft(hostUid, draftKey);

      // Host A draft is gone
      expect(getUserScopedDraft(hostUid, draftKey)).toBeNull();

      // Host B draft is 100% intact and unaffected
      const hostBRetrieved = getUserScopedDraft<typeof otherHostDraft>(otherHostUid, draftKey);
      expect(hostBRetrieved).not.toBeNull();
      expect(hostBRetrieved?.title).toBe('Gorongosa Wild Bush Camp');
      expect(hostBRetrieved?.price).toBe(12000);
      expect(hostBRetrieved?.city).toBe('Gorongosa');
    });

    it('allows a genuine new draft to be created and recovered when user deliberately starts a new listing', () => {
      // Discard previous draft
      saveUserScopedDraft(hostUid, draftKey, spanishVillaDraft);
      clearUserScopedDraft(hostUid, draftKey);
      expect(getUserScopedDraft(hostUid, draftKey)).toBeNull();

      // User deliberately starts a fresh new listing
      const newDeliberateDraft = {
        ...spanishVillaDraft,
        title: 'Bazaruto Island Ocean Chalet',
        price: 15000,
        city: 'Vilankulos',
        province: 'Inhambane',
        savedAt: new Date().toISOString()
      };

      saveUserScopedDraft(hostUid, draftKey, newDeliberateDraft);

      // New draft is properly persisted and recovered
      const recoveredNewDraft = getUserScopedDraft<typeof newDeliberateDraft>(hostUid, draftKey);
      expect(recoveredNewDraft).not.toBeNull();
      expect(recoveredNewDraft?.title).toBe('Bazaruto Island Ocean Chalet');
      expect(recoveredNewDraft?.price).toBe(15000);
      expect(recoveredNewDraft?.city).toBe('Vilankulos');
    });
  });

  describe('3. Published Listing Invariants & Host Verification', () => {
    it('confirms published Spanish Villa listing remains eligible and active', () => {
      const publishedListing = {
        id: 'stay_spanish_villa_belo_horizonte',
        title: 'Spanish Villa Belo Horizonte',
        location: 'Belo Horizonte, Maputo',
        price: 9500,
        status: 'active' as const,
        images: ['https://images.unsplash.com/photo-spanish-villa-1'],
        labeledImages: [
          { url: 'https://images.unsplash.com/photo-spanish-villa-1', label: 'Ocean View Balcony' }
        ],
        hostId: hostUid,
        isHostVerified: true
      };

      const eligibility = evaluateListingAutoPublishEligibility(publishedListing as any);
      expect(eligibility.eligibleForVerifiedBadge).toBe(true);
      expect(eligibility.eligibleForAutoPublish).toBe(true);
    });

    it('preserves user-scoped draft across sign-out purge so owner can resume upon re-authenticating', () => {
      saveUserScopedDraft(hostUid, draftKey, spanishVillaDraft);
      expect(getUserScopedDraft(hostUid, draftKey)).not.toBeNull();

      // User logs out or switches accounts
      purgeAllUserSessionData();

      // Owner draft remains safely preserved for owner to resume deliberately
      expect(getUserScopedDraft(hostUid, draftKey)).not.toBeNull();
      // Other user cannot access it
      expect(getUserScopedDraft(otherHostUid, draftKey)).toBeNull();
    });
  });

  describe('4. CreateListing.tsx Code Architecture Verification', () => {
    const createListingPath = path.resolve(__dirname, '../../src/pages/CreateListing.tsx');
    const content = fs.readFileSync(createListingPath, 'utf-8');

    it('verifies CreateListing.tsx has guards against post-discard autosave resurrection', () => {
      // 1. Must track discard state
      expect(content).toContain('isDiscardedRef = useRef<boolean>(false)');
      
      // 2. Must track submission state to avoid re-saving published listings as drafts
      expect(content).toContain('hasSubmittedRef = useRef<boolean>(false)');
      
      // 3. Must track user deliberate modifications
      expect(content).toContain('hasUserModifiedRef = useRef<boolean>(false)');
      
      // 4. Must flag isDiscardedRef and clear draft in handleDiscardDraft
      expect(content).toContain('isDiscardedRef.current = true');
      expect(content).toContain('clearUserScopedDraft(user.uid, STAY_LISTING_DRAFT_KEY)');
      
      // 5. saveDraftImmediately must guard against discarded, submitted, or un-modified states
      expect(content).toContain('isDiscardedRef.current');
      expect(content).toContain('hasSubmittedRef.current');
      expect(content).toContain('hasUserModifiedRef.current');

      // 6. beforeunload/unmount effect must NOT re-run on intermediate state changes
      expect(content).not.toMatch(/handleBeforeUnload\(\);\s*\}, \[[^\]]*\btitle\b[^\]]*\]\);/);
      expect(content).toContain("window.addEventListener('beforeunload', handleBeforeUnload);");

      // 7. Verified host badges and approval cards are preserved
      expect(content).toContain('Host Document & Identity Verification');
      expect(content).toContain('Review Submitted Docs');
    });
  });
});
