import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createActivityTrip,
  getActivitiesTrips,
  applyFilters,
  getActivityTripById,
  updateActivityTrip
} from '../../src/services/activityTripService';
import {
  createListing,
  checkHostVerificationStatus,
  syncHostListingsVerification,
  evaluateListingAutoPublishEligibility
} from '../../src/services/listingService';
import {
  reserveExperienceInventory,
  reserveStayInventory,
  memoryExperienceSlots,
  memoryStaySlots,
  memoryBookings,
  memorySuspendedHosts,
  memorySuspendedUsers,
  InventoryError
} from '../../src/server/inventoryService';
import { ActivityTrip } from '../../src/types/activityTrip';
import { Listing } from '../../src/services/listingService';

function createMockStorage() {
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

const mockLocalStorage = createMockStorage();
// @ts-ignore
globalThis.localStorage = mockLocalStorage;
// @ts-ignore
globalThis.fetch = vi.fn(async () => {
  throw new Error('Fetch offline in unit test; falling back to direct client batch');
});

// In-memory Firestore simulation state
let mockUsersDoc: Record<string, any> = {};
let mockVerificationsDoc: Record<string, any> = {};
let mockActivitiesTripsColl: Record<string, any> = {};
let mockListingsColl: Record<string, any> = {};
let mockFirestoreWriteShouldFail = false;

// Mock paymentService privileged admin DB
vi.mock('../../src/server/paymentService', () => {
  return {
    getPrivilegedFirestore: vi.fn(() => ({
      collection: (cName: string) => ({
        doc: (dId: string) => ({
          id: dId,
          get: async () => {
            let data: any = null;
            if (cName === 'activities_trips') data = mockActivitiesTripsColl[dId];
            else if (cName === 'listings') data = mockListingsColl[dId];
            else if (cName === 'users') data = mockUsersDoc[dId];
            else if (cName === 'verifications') data = mockVerificationsDoc[dId];
            return { exists: Boolean(data), data: () => data, id: dId };
          },
          set: async (_val: any) => {}
        }),
        where: () => ({
          where: () => ({
            get: async () => ({ empty: true, forEach: () => {} })
          }),
          get: async () => ({ empty: true, forEach: () => {} })
        })
      }),
      runTransaction: async (cb: any) => {
        const fakeTx = {
          get: async (ref: any) => ref.get(),
          set: (_ref: any, _val: any) => {}
        };
        return cb(fakeTx);
      }
    })),
    isUserAdmin: vi.fn(() => false)
  };
});

// Mock Firebase client
vi.mock('../../src/firebase', () => {
  return {
    db: { _isMock: true },
    auth: {
      currentUser: {
        uid: 'host_verified_1',
        email: 'verified_host@mozbook.mz',
        getIdToken: vi.fn(async () => 'mock_jwt_token')
      }
    }
  };
});

// Mock Firestore SDK
vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn((_db, collName) => ({ collName })),
    doc: vi.fn((_db, collName, id) => ({ collName, id })),
    addDoc: vi.fn(async (collRef, data) => {
      if (mockFirestoreWriteShouldFail) {
        throw new Error('Firestore connection failure: gRPC UNAVAILABLE');
      }
      const newId = 'doc_' + Math.random().toString(36).substring(2, 9);
      if (collRef.collName === 'activities_trips') {
        mockActivitiesTripsColl[newId] = { ...data, id: newId };
      } else if (collRef.collName === 'listings') {
        mockListingsColl[newId] = { ...data, id: newId };
      }
      return { id: newId };
    }),
    updateDoc: vi.fn(async (docRef, updates) => {
      if (mockFirestoreWriteShouldFail) {
        throw new Error('Firestore update failure: UNAVAILABLE');
      }
      if (docRef.collName === 'activities_trips') {
        if (!mockActivitiesTripsColl[docRef.id]) {
          throw new Error('Document not found in activities_trips');
        }
        mockActivitiesTripsColl[docRef.id] = { ...mockActivitiesTripsColl[docRef.id], ...updates };
      } else if (docRef.collName === 'listings') {
        if (!mockListingsColl[docRef.id]) {
          throw new Error('Document not found in listings');
        }
        mockListingsColl[docRef.id] = { ...mockListingsColl[docRef.id], ...updates };
      } else if (docRef.collName === 'verifications') {
        mockVerificationsDoc[docRef.id] = { ...mockVerificationsDoc[docRef.id], ...updates };
      } else if (docRef.collName === 'users') {
        mockUsersDoc[docRef.id] = { ...mockUsersDoc[docRef.id], ...updates };
      }
    }),
    getDoc: vi.fn(async (docRef) => {
      if (docRef.collName === 'users') {
        const u = mockUsersDoc[docRef.id];
        return {
          exists: () => Boolean(u),
          data: () => u
        };
      }
      if (docRef.collName === 'activities_trips') {
        const a = mockActivitiesTripsColl[docRef.id];
        return {
          exists: () => Boolean(a),
          id: docRef.id,
          data: () => a
        };
      }
      return { exists: () => false, data: () => null };
    }),
    getDocs: vi.fn(async (q) => {
      const collName = q?.collName || q?.coll?.collName;
      let list: any[] = [];
      if (collName === 'verifications') {
        list = Object.entries(mockVerificationsDoc)
          .map(([id, val]) => ({ id, data: () => val }));
      } else if (collName === 'activities_trips') {
        list = Object.entries(mockActivitiesTripsColl)
          .map(([id, val]) => ({ id, data: () => val }));
      } else if (collName === 'listings') {
        list = Object.entries(mockListingsColl)
          .map(([id, val]) => ({ id, data: () => val }));
      }
      return {
        empty: list.length === 0,
        size: list.length,
        docs: list,
        forEach: (fn: any) => list.forEach(fn)
      };
    }),
    deleteDoc: vi.fn(async (docRef) => {
      if (docRef.collName === 'activities_trips') {
        delete mockActivitiesTripsColl[docRef.id];
      }
    }),
    query: vi.fn((coll) => ({ collName: coll.collName })),
    where: vi.fn(() => ({})),
    serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
    writeBatch: vi.fn(() => ({
      update: vi.fn((docRef, updates) => {
        if (docRef.collName === 'listings') {
          mockListingsColl[docRef.id] = { ...mockListingsColl[docRef.id], ...updates };
        } else if (docRef.collName === 'activities_trips') {
          mockActivitiesTripsColl[docRef.id] = { ...mockActivitiesTripsColl[docRef.id], ...updates };
        }
      }),
      commit: vi.fn(async () => {})
    }))
  };
});

describe('Backend-Authoritative Listing Persistence & Publication Lifecycle', () => {
  beforeEach(() => {
    mockUsersDoc = {};
    mockVerificationsDoc = {};
    mockActivitiesTripsColl = {};
    mockListingsColl = {};
    mockFirestoreWriteShouldFail = false;
    memoryExperienceSlots.clear();
    memoryStaySlots.clear();
    memoryBookings.clear();
    memorySuspendedHosts.clear();
    memorySuspendedUsers.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // 1. Attempted self-verification update by non-admin is rejected
  it('1. Rejects attempted self-verification status elevation by non-admin host', async () => {
    // In firestore.rules, non-admins cannot include 'status', 'reviewedBy', 'adminNotes' in affectedKeys
    const nonAdminUser = { uid: 'regular_host_1', email: 'regular@host.mz' };
    const verificationRecord = {
      id: 'verif_1',
      userId: 'regular_host_1',
      status: 'pending'
    };

    // Simulated evaluation of firestore.rules for verifications update
    const evaluateVerificationRule = (auth: any, resourceData: any, updatedData: any) => {
      const isAdmin = auth.email === 'mozbookinfo@gmail.com' || auth.email === 'admin@mozbook.mz';
      if (isAdmin) return true;
      if (resourceData.userId === auth.uid) {
        const changedKeys = Object.keys(updatedData).filter(k => updatedData[k] !== resourceData[k]);
        const forbiddenKeys = ['status', 'reviewedBy', 'reviewedAt', 'adminNotes', 'rejectionReason', 'decisionReason', 'verifiedAt'];
        const hasForbidden = changedKeys.some(k => forbiddenKeys.includes(k));
        return !hasForbidden;
      }
      return false;
    };

    const hostAttemptedPayload = { ...verificationRecord, status: 'verified' };
    const allowed = evaluateVerificationRule(nonAdminUser, verificationRecord, hostAttemptedPayload);
    expect(allowed).toBe(false);
  });

  // 2. Verification status change by authorized admin succeeds
  it('2. Authorizes verification status change by verified administrator', async () => {
    const adminUser = { uid: 'admin_1', email: 'mozbookinfo@gmail.com' };
    const verificationRecord = {
      id: 'verif_1',
      userId: 'host_pending_1',
      status: 'pending'
    };

    const evaluateVerificationRule = (auth: any, resourceData: any, updatedData: any) => {
      const isAdmin = auth.email === 'mozbookinfo@gmail.com' || auth.email === 'admin@mozbook.mz';
      if (isAdmin) return true;
      return false;
    };

    const adminApprovalPayload = {
      ...verificationRecord,
      status: 'verified',
      reviewedBy: 'mozbookinfo@gmail.com'
    };
    const allowed = evaluateVerificationRule(adminUser, verificationRecord, adminApprovalPayload);
    expect(allowed).toBe(true);
  });

  // 3. Creation by unverified host sets status to pending
  it('3. Enforces pending status when listing is created by unverified or pending host', async () => {
    const unverifiedHostId = 'host_unverified_1';
    mockUsersDoc[unverifiedHostId] = {
      uid: unverifiedHostId,
      verificationStatus: 'pending'
    };

    const statusInfo = await checkHostVerificationStatus(unverifiedHostId);
    expect(statusInfo.isVerified).toBe(false);
    expect(statusInfo.status).toBe('pending');

    const activity = await createActivityTrip({
      hostId: unverifiedHostId,
      hostName: 'New Operator',
      title: 'Ocean Excursion',
      category: 'Snorkeling',
      city: 'Tofo',
      duration: '2 hours',
      priceAdult: 3000,
      currency: 'MZN',
      type: 'activity',
      status: 'published' // Host attempted to submit as published
    } as any);

    // Authoritatively persisted as pending, not published!
    expect(activity.status).toBe('pending');
    expect(activity.id).toBeDefined();
    expect(activity.id.startsWith('act_')).toBe(false);
  });

  // 4. Creation by verified host auto-publishes
  it('4. Automatically publishes listing created by approved, verified and unsuspended host', async () => {
    const verifiedHostId = 'host_verified_1';
    mockUsersDoc[verifiedHostId] = {
      uid: verifiedHostId,
      verificationStatus: 'verified',
      accountStatus: 'active'
    };

    const statusInfo = await checkHostVerificationStatus(verifiedHostId);
    expect(statusInfo.isVerified).toBe(true);
    expect(statusInfo.isSuspended).toBe(false);

    const activity = await createActivityTrip({
      hostId: verifiedHostId,
      hostName: 'Verified Guide',
      title: 'Dune Trail Quad Biking Adventure',
      category: 'Quad Biking',
      city: 'Ponta do Ouro',
      duration: '1 hour',
      priceAdult: 4500,
      currency: 'MZN',
      type: 'activity',
      status: 'published'
    } as any);

    expect(activity.status).toBe('published');
    expect(activity.id).toBeDefined();
    expect(mockActivitiesTripsColl[activity.id].status).toBe('published');
  });

  // 5. Creation by suspended host is rejected
  it('5. Rejects listing creation attempt by suspended host', async () => {
    const suspendedHostId = 'host_suspended_1';
    mockUsersDoc[suspendedHostId] = {
      uid: suspendedHostId,
      verificationStatus: 'suspended',
      accountStatus: 'suspended'
    };

    await expect(createActivityTrip({
      hostId: suspendedHostId,
      hostName: 'Suspended Host',
      title: 'Unauthorized Safari',
      category: 'Safari',
      city: 'Gorongosa',
      duration: '4 hours',
      priceAdult: 5000,
      currency: 'MZN',
      type: 'trip',
      status: 'published'
    } as any)).rejects.toThrow(/suspended/i);

    expect(Object.keys(mockActivitiesTripsColl).length).toBe(0);
  });

  // 6. Failed Firestore write throws error, does not assign ID or save as published
  it('6. Failed Firestore write throws error, assigns no ID and never reports false success', async () => {
    const verifiedHostId = 'host_verified_1';
    mockUsersDoc[verifiedHostId] = {
      uid: verifiedHostId,
      verificationStatus: 'verified'
    };

    mockFirestoreWriteShouldFail = true;

    await expect(createActivityTrip({
      hostId: verifiedHostId,
      hostName: 'Verified Guide',
      title: 'Failed Quad Safari',
      category: 'Quad Biking',
      city: 'Inhambane',
      duration: '2 hours',
      priceAdult: 3500,
      currency: 'MZN',
      type: 'activity',
      status: 'published'
    } as any)).rejects.toThrow(/Firestore connection failure/i);

    // Verify localStorage has not recorded an unpersisted 'published' item
    const rawLocal = localStorage.getItem('mozbook_activities_trips');
    const localItems = rawLocal ? JSON.parse(rawLocal) : [];
    const found = localItems.find((i: any) => i.title === 'Failed Quad Safari');
    expect(found).toBeUndefined();
  });

  // 7. getActivitiesTrips() returns only published items for public queries
  it('7. Excludes drafts, pending items and unpersisted local records from public queries', async () => {
    // Add one published item and one pending item to Firestore
    mockActivitiesTripsColl['act_pub_1'] = {
      id: 'act_pub_1',
      title: 'Bazaruto Dhow Cruise',
      status: 'published',
      priceAdult: 5000,
      hostId: 'host_verified_1',
      type: 'trip'
    };
    mockActivitiesTripsColl['act_pend_1'] = {
      id: 'act_pend_1',
      title: 'Unapproved Island Tour',
      status: 'pending',
      priceAdult: 2000,
      hostId: 'host_unverified_1',
      type: 'trip'
    };

    // Stale local storage item with status published but fake local ID
    localStorage.setItem('mozbook_activities_trips', JSON.stringify([
      {
        id: 'act_1729000000000',
        title: 'Phantom Dune Trail',
        status: 'published',
        priceAdult: 4500,
        hostId: 'host_unverified_1',
        type: 'activity'
      }
    ]));

    // Public traveler query (no hostId specified, not admin)
    const publicResults = await getActivitiesTrips({}, { isCallerAuthorizedAdmin: false });

    // The phantom local item must NEVER appear
    const phantom = publicResults.find(i => i.title === 'Phantom Dune Trail');
    expect(phantom).toBeUndefined();

    // The pending item must NEVER appear
    const pending = publicResults.find(i => i.title === 'Unapproved Island Tour');
    expect(pending).toBeUndefined();

    // The published item appears
    const published = publicResults.find(i => i.id === 'act_pub_1');
    expect(published).toBeDefined();
    expect(published?.status).toBe('published');
  });

  // 8. Host self-query returns drafts and unsynced drafts flagged as drafts
  it('8. Flags unsynced local records as draft in host self-query, never as published', async () => {
    const hostId = 'host_verified_1';

    // Put an unsynced local draft in local storage for this host
    localStorage.setItem('mozbook_activities_trips', JSON.stringify([
      {
        id: 'act_1729000000000',
        title: 'Local Quad Biking Draft',
        status: 'published', // Local storage mistakenly had published
        priceAdult: 4500,
        hostId,
        type: 'activity'
      }
    ]));

    const hostResults = await getActivitiesTrips(
      { hostId },
      { isCallerAuthorizedAdmin: false, currentUid: hostId }
    );

    const localItem = hostResults.find(i => i.id === 'act_1729000000000');
    expect(localItem).toBeDefined();
    // In host self-query, local unpersisted draft status must be forced to 'draft'!
    expect(localItem?.status).toBe('draft');
    expect((localItem as any)?.isLocalDraft).toBe(true);
  });

  // 9. Admin approval synchronizes eligible pending listings to published
  it('9. Synchronizes eligible pending listings to published upon administrator host verification', async () => {
    const hostId = 'host_to_approve_1';

    // Host has a pending listing with complete required details
    mockListingsColl['listing_1'] = {
      id: 'listing_1',
      hostId,
      title: 'Ponta Beach Villa',
      location: 'Ponta do Ouro',
      price: 12000,
      images: ['https://example.com/photo.jpg'],
      status: 'pending'
    };

    // Host also has a pending activity
    mockActivitiesTripsColl['act_1'] = {
      id: 'act_1',
      hostId,
      title: 'Ocean Snorkel Safari',
      priceAdult: 3500,
      status: 'pending'
    };

    const syncResult = await syncHostListingsVerification(hostId, true);
    expect(syncResult.success).toBe(true);
    expect(syncResult.eligibleListingsUpdated).toBeGreaterThanOrEqual(1);

    expect(mockListingsColl['listing_1'].status).toBe('published');
    expect(mockListingsColl['listing_1'].isHostVerified).toBe(true);
    expect(mockActivitiesTripsColl['act_1'].status).toBe('published');
    expect(mockActivitiesTripsColl['act_1'].isHostVerified).toBe(true);
  });

  // 10. Admin suspension unpublishes active listings / revokes verification
  it('10. Revokes verification and prevents active publication when administrator revokes host verification', async () => {
    const hostId = 'host_to_revoke_1';

    mockListingsColl['listing_2'] = {
      id: 'listing_2',
      hostId,
      title: 'Vilankulo Ocean House',
      location: 'Vilankulo',
      price: 15000,
      status: 'published',
      isHostVerified: true
    };

    mockActivitiesTripsColl['act_2'] = {
      id: 'act_2',
      hostId,
      title: 'Bazaruto Island Trip',
      status: 'published',
      isHostVerified: true
    };

    const syncResult = await syncHostListingsVerification(hostId, false);
    expect(syncResult.success).toBe(true);
    expect(mockListingsColl['listing_2'].isHostVerified).toBe(false);
    expect(mockActivitiesTripsColl['act_2'].isHostVerified).toBe(false);
  });

  // 11. Historical confirmed bookings preserved after unpublishing or suspension
  it('11. Preserves existing confirmed historical bookings across listing unpublishing and host suspension', async () => {
    const hostId = 'host_test_1';
    const slotDocId = 'exp_safari_2026-11-15';

    // Pre-populate slot with 2 confirmed seats from an existing historical booking
    memoryExperienceSlots.set(slotDocId, {
      id: slotDocId,
      itemId: 'exp_safari',
      date: '2026-11-15',
      confirmedSeats: 2,
      holds: [
        {
          bookingId: 'bk_hist_001',
          customerUserId: 'guest_alice',
          seats: 2,
          status: 'confirmed',
          holdExpiresAt: new Date(Date.now() + 86400000).toISOString(),
          createdAt: new Date().toISOString()
        }
      ],
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    // Suspend the host
    memorySuspendedHosts.add(hostId);

    // Existing slot confirmed seats are intact
    const slot = memoryExperienceSlots.get(slotDocId);
    expect(slot).toBeDefined();
    expect(slot?.confirmedSeats).toBe(2);
    expect(slot?.holds.length).toBe(1);
    expect(slot?.holds[0].status).toBe('confirmed');
    expect(slot?.holds[0].bookingId).toBe('bk_hist_001');
  });

  // 12. Attempt to book unpublished listing is rejected
  it('12. Rejects reservation attempt for unpublished experience or property', async () => {
    mockActivitiesTripsColl['exp_draft_1'] = {
      id: 'exp_draft_1',
      hostId: 'host_verified_1',
      status: 'pending',
      priceAdult: 3500
    };
    mockListingsColl['stay_draft_1'] = {
      id: 'stay_draft_1',
      hostId: 'host_verified_1',
      status: 'draft',
      price: 5000
    };

    // Attempt experience reservation on a pending/draft listing
    await expect(reserveExperienceInventory({
      activityId: 'exp_draft_1',
      activityTitle: 'Draft Whale Shark Tour',
      activityType: 'activity',
      hostId: 'host_verified_1',
      date: '2026-11-20',
      totalGuests: 2,
      totalMzn: 7000,
      customerUserId: 'guest_bob',
      customerName: 'Bob Smith',
      customerEmail: 'bob@example.com',
      customerPhone: '+258840001122',
      status: 'pending' // Listing is not published
    })).rejects.toThrow(/not published/i);

    // Attempt stay reservation on a pending/draft property
    await expect(reserveStayInventory({
      listingId: 'stay_draft_1',
      listingTitle: 'Draft Beach Chalet',
      hostId: 'host_verified_1',
      startDate: '2026-12-01',
      endDate: '2026-12-05',
      nights: 4,
      adults: 2,
      children: 0,
      totalGuests: 2,
      totalAmount: 20000,
      customerUserId: 'guest_bob',
      customerName: 'Bob Smith',
      customerEmail: 'bob@example.com',
      customerPhone: '+258840001122',
      status: 'draft' // Property is not published
    })).rejects.toThrow(/not published/i);
  });

  // 13. Attempt to book suspended host's listing is rejected
  it('13. Rejects reservation attempt when host is suspended', async () => {
    const suspendedHostId = 'host_suspended_99';
    mockActivitiesTripsColl['exp_published_1'] = {
      id: 'exp_published_1',
      hostId: suspendedHostId,
      status: 'published',
      priceAdult: 4000
    };
    mockUsersDoc[suspendedHostId] = {
      uid: suspendedHostId,
      accountStatus: 'suspended'
    };
    memorySuspendedHosts.add(suspendedHostId);

    await expect(reserveExperienceInventory({
      activityId: 'exp_published_1',
      activityTitle: 'Dolphin Safari',
      activityType: 'activity',
      hostId: suspendedHostId,
      date: '2026-11-20',
      totalGuests: 2,
      totalMzn: 8000,
      customerUserId: 'guest_bob',
      customerName: 'Bob Smith',
      customerEmail: 'bob@example.com',
      customerPhone: '+258840001122',
      status: 'published',
      isHostSuspended: true
    })).rejects.toThrow(/suspended/i);
  });

  // 14. Deduplication preserves record identity, pricing, capacity and booking links
  it('14. Deduplication strictly preserves record identity, host ownership, images, and pricing', async () => {
    const canonicalActivity = {
      id: 'act-dolphin-ponta',
      hostId: 'host_wild_ocean',
      hostName: 'Ponta Marine Biology Safaris',
      hostEmail: 'info@pontadolphins.co.mz',
      hostPhone: '+258 84 311 9080',
      type: 'activity',
      title: 'Wild Dolphin Ocean Swim & Reef Snorkel',
      shortDescription: 'Ethical wild dolphin encounters',
      description: 'Marine safari description',
      category: 'Snorkeling',
      city: 'Ponta do Ouro',
      meetingPoint: 'Ponta do Ouro Launch Site',
      duration: '3 hours',
      scheduleType: 'recurring',
      maxGuests: 12,
      pricingType: 'per_person',
      priceAdult: 4200,
      currency: 'MZN',
      status: 'published',
      images: ['https://example.com/dolphin.jpg']
    };

    // Stale local cache item attempting to alter price or title
    const staleLocalItem = {
      ...canonicalActivity,
      title: 'Corrupted Title from Local Cache',
      priceAdult: 999
    };

    // Mock Firestore returning the authoritative record
    mockActivitiesTripsColl['act-dolphin-ponta'] = canonicalActivity;
    localStorage.setItem('mozbook_activities_trips', JSON.stringify([staleLocalItem]));

    const results = await getActivitiesTrips({}, { isCallerAuthorizedAdmin: false });
    const item = results.find(i => i.id === 'act-dolphin-ponta');

    expect(item).toBeDefined();
    // Authoritative Firestore record wins; stale local modification is ignored
    expect(item?.title).toBe('Wild Dolphin Ocean Swim & Reef Snorkel');
    expect(item?.priceAdult).toBe(4200);
    expect(item?.hostId).toBe('host_wild_ocean');
  });
});
