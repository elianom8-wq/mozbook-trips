import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createListing,
  updateListing,
  getListings,
  getHostListings,
  checkHostVerificationStatus,
  updateVerificationStatus,
  evaluateListingAutoPublishEligibility,
  submitHostVerification,
  Listing
} from '../../src/services/listingService';

// In-memory Firestore simulation state
let mockUsersDoc: Record<string, any> = {};
let mockVerificationsDoc: Record<string, any> = {};
let mockListingsColl: Record<string, any> = {};

// Mock fetch for backend API tests
globalThis.fetch = vi.fn(async (url: any, opts: any) => {
  throw new Error('Fetch offline in unit test; falling back to direct client batch');
});

// Mock Firebase client auth & db
vi.mock('../../src/firebase', () => {
  return {
    db: { _isMock: true },
    auth: {
      currentUser: {
        uid: 'test_host_pending_1',
        email: 'test_host@mozbook.mz',
        displayName: 'MozBook Pending Host',
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
      const newId = 'doc_' + Math.random().toString(36).substring(2, 9);
      if (collRef.collName === 'listings') {
        mockListingsColl[newId] = { ...data, id: newId };
      } else if (collRef.collName === 'verifications') {
        mockVerificationsDoc[newId] = { ...data, id: newId };
      }
      return { id: newId };
    }),
    updateDoc: vi.fn(async (docRef, updates) => {
      if (docRef.collName === 'listings') {
        mockListingsColl[docRef.id] = { ...mockListingsColl[docRef.id], ...updates };
      } else if (docRef.collName === 'verifications') {
        mockVerificationsDoc[docRef.id] = { ...mockVerificationsDoc[docRef.id], ...updates };
      } else if (docRef.collName === 'users') {
        mockUsersDoc[docRef.id] = { ...mockUsersDoc[docRef.id], ...updates };
      }
    }),
    setDoc: vi.fn(async (docRef, data, options) => {
      if (docRef.collName === 'users') {
        mockUsersDoc[docRef.id] = options?.merge ? { ...mockUsersDoc[docRef.id], ...data } : data;
      }
    }),
    getDoc: vi.fn(async (docRef) => {
      if (docRef.collName === 'users') {
        const u = mockUsersDoc[docRef.id];
        return {
          exists: () => Boolean(u),
          data: () => u,
          id: docRef.id
        };
      }
      if (docRef.collName === 'listings') {
        const l = mockListingsColl[docRef.id];
        return {
          exists: () => Boolean(l),
          data: () => l,
          id: docRef.id
        };
      }
      return {
        exists: () => false,
        data: () => null,
        id: docRef.id
      };
    }),
    getDocs: vi.fn(async (queryRef) => {
      const collName = queryRef.collName || queryRef._collName;
      if (collName === 'verifications') {
        const docs = Object.values(mockVerificationsDoc)
          .filter((v: any) => !queryRef._userId || v.userId === queryRef._userId)
          .map((v: any) => ({
            id: v.id,
            data: () => v
          }));
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs
        };
      }
      if (collName === 'listings') {
        const docs = Object.values(mockListingsColl)
          .filter((l: any) => !queryRef._hostId || l.hostId === queryRef._hostId)
          .map((l: any) => ({
            id: l.id,
            data: () => l
          }));
        return {
          empty: docs.length === 0,
          size: docs.length,
          docs
        };
      }
      return { empty: true, size: 0, docs: [] };
    }),
    query: vi.fn((collRef, ...clauses) => {
      const qObj: any = { collName: collRef.collName, _clauses: clauses };
      clauses.forEach((c: any) => {
        if (c?.field === 'userId') qObj._userId = c.val;
        if (c?.field === 'hostId') qObj._hostId = c.val;
      });
      return qObj;
    }),
    where: vi.fn((field, op, val) => ({ field, op, val })),
    serverTimestamp: vi.fn(() => new Date().toISOString()),
    writeBatch: vi.fn(() => {
      const batchUpdates: Array<() => void> = [];
      return {
        update: (docRef: any, updates: any) => {
          batchUpdates.push(() => {
            if (docRef.collName === 'listings') {
              mockListingsColl[docRef.id] = { ...mockListingsColl[docRef.id], ...updates };
            } else if (docRef.collName === 'verifications') {
              mockVerificationsDoc[docRef.id] = { ...mockVerificationsDoc[docRef.id], ...updates };
            }
          });
        },
        commit: async () => {
          batchUpdates.forEach(fn => fn());
        }
      };
    }),
    onSnapshot: vi.fn((queryOrColl, onNext) => {
      const docs = Object.values(mockListingsColl).map((l: any) => ({
        id: l.id,
        data: () => l
      }));
      onNext({ docs, size: docs.length });
      return () => {};
    })
  };
});

describe('Host Verification, Listing Setup & Automatic Publication Lifecycle', () => {
  beforeEach(() => {
    mockUsersDoc = {};
    mockVerificationsDoc = {};
    mockListingsColl = {};
    vi.clearAllMocks();
  });

  // 1. Document Submission
  it('1. Submits host verification documents and records status as pending in backend', async () => {
    const hostId = 'host_pending_42';
    mockUsersDoc[hostId] = { uid: hostId, email: 'host42@mozbook.mz', verificationStatus: 'unverified' };

    const verifId = await submitHostVerification({
      userId: hostId,
      userEmail: 'host42@mozbook.mz',
      hostName: 'Carlos Machel',
      phoneNumber: '+258 84 123 4567',
      docType: 'national_id',
      docNumber: '110100492817M',
      docFrontPhotoUrl: 'https://storage.mozbook.mz/docs/front.jpg',
      docBackPhotoUrl: 'https://storage.mozbook.mz/docs/back.jpg',
      expiryDate: '2028-06-30',
      isExpired: false
    });

    expect(verifId).toBeDefined();
    expect(mockVerificationsDoc[verifId!].status).toBe('pending');
    expect(mockVerificationsDoc[verifId!].userId).toBe(hostId);
  });

  // 2. Allow Full Listing Setup While Pending
  it('2. Allows host to set up full listing information while pending, saving as pending publication', async () => {
    const hostId = 'host_pending_42';
    mockUsersDoc[hostId] = { uid: hostId, verificationStatus: 'pending' };
    mockVerificationsDoc['verif_42'] = { id: 'verif_42', userId: hostId, status: 'pending' };

    // Check host verification status returns pending
    const statusInfo = await checkHostVerificationStatus(hostId);
    expect(statusInfo.isVerified).toBe(false);
    expect(statusInfo.status).toBe('pending');

    // Host creates full accommodation details
    const listingId = await createListing({
      title: 'Tofo Beachfront Chalet',
      description: 'Authentic palm thatch beachfront chalet with ocean view deck and solar power.',
      location: 'Praia do Tofo, Inhambane',
      city: 'Tofo',
      province: 'Inhambane',
      country: 'Mozambique',
      price: 4500,
      minNights: 2,
      rating: 4.9,
      images: [
        'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750'
      ],
      labeledImages: [
        { url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2', label: 'Ocean Deck' }
      ],
      amenities: ['wifi', 'ac', 'pool', 'kitchen', 'security'],
      hostId,
      hostName: 'Carlos Machel'
    });

    expect(listingId).toBeDefined();
    const saved = mockListingsColl[listingId];
    expect(saved).toBeDefined();
    expect(saved.hostId).toBe(hostId);
    // Preserved full details
    expect(saved.title).toBe('Tofo Beachfront Chalet');
    expect(saved.price).toBe(4500);
    expect(saved.images.length).toBe(2);
    // Crucial requirement: saved as pending, not published
    expect(saved.status).toBe('pending');
    expect(saved.isHostVerified).toBe(false);
  });

  // 3. Keep listings unpublished until approval
  it('3. Keeps pending listings hidden from public search feeds but visible in host portfolio', async () => {
    const hostId = 'host_pending_42';
    mockListingsColl['listing_pending_1'] = {
      id: 'listing_pending_1',
      hostId,
      title: 'Tofo Beachfront Chalet',
      status: 'pending',
      price: 4500,
      images: ['https://example.com/photo.jpg']
    };
    mockListingsColl['listing_published_1'] = {
      id: 'listing_published_1',
      hostId: 'host_verified_99',
      title: 'Maputo Central Suite',
      status: 'published',
      price: 3200,
      images: ['https://example.com/maputo.jpg']
    };

    // Public search (getListings without options) must filter out pending
    const publicListings = await getListings();
    expect(publicListings.some(l => l.id === 'listing_pending_1')).toBe(false);
    expect(publicListings.some(l => l.id === 'listing_published_1')).toBe(true);

    // Host portfolio (getHostListings) must include all host listings so host can manage them
    const hostPortfolio = await getHostListings(hostId);
    expect(hostPortfolio.some(l => l.id === 'listing_pending_1')).toBe(true);
  });

  // 4. Incomplete Listings Saved as Drafts
  it('4. Incomplete listings without photos or required fields are saved as drafts, not pending', async () => {
    const hostId = 'host_pending_42';
    mockUsersDoc[hostId] = { uid: hostId, verificationStatus: 'pending' };

    // Incomplete listing: missing photos
    const draftId = await createListing({
      title: 'Incomplete Bush Chalet',
      description: 'Work in progress',
      location: 'Gorongosa, Sofala',
      price: 3000,
      rating: 5,
      images: [], // Missing photos!
      hostId
    });

    expect(mockListingsColl[draftId].status).toBe('draft');
  });

  // 5. Unauthorized Publication Guard
  it('5. Prevents unverified host from setting status to published via client-side update', async () => {
    const hostId = 'host_pending_42';
    mockUsersDoc[hostId] = { uid: hostId, verificationStatus: 'pending' };
    mockListingsColl['listing_test'] = {
      id: 'listing_test',
      hostId,
      title: 'My Property',
      status: 'pending',
      price: 5000
    };

    // Attempt client manipulation to force status: published
    await updateListing('listing_test', {
      hostId,
      status: 'published' as any
    });

    // Must be downgraded back to pending because host is not verified
    expect(mockListingsColl['listing_test'].status).toBe('pending');
  });

  // 6. Automatic Publication Upon Admin Approval
  it('6. Automatically publishes eligible completed listings upon administrator approval without duplicate work', async () => {
    const hostId = 'host_to_approve_55';
    mockUsersDoc[hostId] = { uid: hostId, verificationStatus: 'pending' };
    mockVerificationsDoc['verif_55'] = {
      id: 'verif_55',
      userId: hostId,
      status: 'pending',
      docType: 'national_id',
      docNumber: '110293847561B'
    };

    // Host has 1 complete pending listing and 1 incomplete draft listing
    mockListingsColl['listing_complete'] = {
      id: 'listing_complete',
      hostId,
      title: 'Bazaruto Island Eco-Villa',
      location: 'Vilankulo, Inhambane',
      price: 9500,
      images: ['https://example.com/bazaruto.jpg'],
      status: 'pending',
      isHostVerified: false
    };

    mockListingsColl['listing_incomplete_draft'] = {
      id: 'listing_incomplete_draft',
      hostId,
      title: 'Unfinished Camping Spot',
      location: 'Inhambane',
      price: 1000,
      images: [], // Missing photos!
      status: 'draft',
      isHostVerified: false
    };

    // Admin approves the host
    const approvalResult = await updateVerificationStatus('verif_55', hostId, 'verified', 'Approved by Operations Team');

    expect(approvalResult.success).toBe(true);
    expect(approvalResult.verificationUpdated).toBe(true);

    // Host verification status in users collection updated
    expect(mockUsersDoc[hostId].verificationStatus).toBe('verified');

    // 1. Complete listing is automatically published without separate host action
    expect(mockListingsColl['listing_complete'].status).toBe('published');
    expect(mockListingsColl['listing_complete'].isHostVerified).toBe(true);

    // 2. Incomplete draft listing remains draft
    expect(mockListingsColl['listing_incomplete_draft'].status).toBe('draft');
  });

  // 7. Revocation / Expiry Suspends Verification
  it('7. Revoking verification revokes verified badge across listings', async () => {
    const hostId = 'host_revoked_77';
    mockUsersDoc[hostId] = { uid: hostId, verificationStatus: 'verified' };
    mockVerificationsDoc['verif_77'] = { id: 'verif_77', userId: hostId, status: 'verified' };

    mockListingsColl['listing_live'] = {
      id: 'listing_live',
      hostId,
      title: 'Ponta Beach Cottage',
      status: 'published',
      isHostVerified: true
    };

    const revokeResult = await updateVerificationStatus('verif_77', hostId, 'rejected', 'Document invalid');
    expect(revokeResult.success).toBe(true);

    expect(mockUsersDoc[hostId].verificationStatus).toBe('rejected');
    expect(mockListingsColl['listing_live'].isHostVerified).toBe(false);
  });
});
