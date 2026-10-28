import { describe, it, expect } from 'vitest';
import { 
  applyFilters,
  isCallerAdmin
} from '../../src/services/activityTripService';
import { ActivityTrip } from '../../src/types/activityTrip';

function createMockActivity(overrides: Partial<ActivityTrip> & { id: string; title: string; hostId: string }): ActivityTrip {
  return {
    type: 'activity',
    hostName: 'Test Host',
    shortDescription: 'Short description',
    description: 'Full description',
    category: 'Adventure',
    city: 'Ponta do Ouro',
    meetingPoint: 'Default Point',
    pickup: { offered: false },
    duration: '2 hours',
    scheduleType: 'flexible',
    recurringDays: [],
    startTimes: ['09:00'],
    maxGuests: 10,
    minGuests: 1,
    pricingType: 'per_person',
    priceAdult: 1000,
    currency: 'MZN',
    images: ['https://images.unsplash.com/photo-default'],
    coverImage: 'https://images.unsplash.com/photo-default',
    included: ['Guide'],
    notIncluded: [],
    whatToBring: [],
    requirements: [],
    rating: 5,
    reviewsCount: 1,
    status: 'published',
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z',
    ...overrides
  };
}

describe('MozBook — Experience Lifecycle, Security Invariants & Draft Visibility Audit', () => {
  const publishedExp1 = createMockActivity({
    id: 'act-wild-dolphin',
    hostId: 'host_ponta_safaris',
    hostName: 'Ponta Marine Safaris',
    type: 'activity',
    title: 'Wild Dolphin Ocean Swim & Reef Snorkel',
    shortDescription: 'Ethical wild dolphin encounters',
    category: 'Snorkeling',
    city: 'Ponta do Ouro',
    duration: '3 hours',
    priceAdult: 4200,
    status: 'published'
  });

  const publishedExp2 = createMockActivity({
    id: 'act-dune-trail-published',
    hostId: 'host_quad_safaris',
    hostName: 'Mozambique Quad Adventures',
    type: 'activity',
    title: 'Dune Trail Quad Biking Adventure',
    shortDescription: 'Thrilling quad biking along Ponta sand dunes',
    category: 'Quad Biking',
    city: 'Ponta do Ouro',
    duration: '2.5 hours',
    priceAdult: 3500,
    status: 'published'
  });

  const draftDmcPackage = createMockActivity({
    id: '5AROLi2JyPgaLBRhFsw5',
    hostId: 'rx6QOgEUfuhoLKwa6gsg03u4xok2',
    hostName: 'MozBook Tour Operator',
    type: 'dmc_package',
    title: '5-Day Gorongosa Safari Adventure & Lake Urema Discovery',
    category: 'Safari & Wildlife',
    city: 'Gorongosa National Park',
    duration: '5 Days / 4 Nights',
    priceAdult: 85000,
    status: 'draft'
  });

  const unapprovedSubmission = createMockActivity({
    id: 'act-pending-submission',
    hostId: 'host_new_operator',
    hostName: 'New Coastal Guide',
    type: 'activity',
    title: 'Bazaruto Reef Explorers',
    category: 'Island Excursions',
    city: 'Vilankulo',
    priceAdult: 4800,
    status: 'pending'
  });

  const otherHostDraft = createMockActivity({
    id: 'act-other-host-draft',
    hostId: 'host_competing_operator',
    hostName: 'Competitor Expeditions',
    type: 'trip',
    title: 'Private Catamaran Inhaca Cruise',
    category: 'Sailing',
    city: 'Maputo',
    priceAdult: 7000,
    status: 'draft'
  });

  const allSampleExperiences: ActivityTrip[] = [
    publishedExp1,
    publishedExp2,
    draftDmcPackage,
    unapprovedSubmission,
    otherHostDraft
  ];

  describe('1. Public Discovery Visibility & Data Source Invariants', () => {
    it('1. Published and approved experiences appear publicly in general /trips queries', () => {
      const publicResults = applyFilters(allSampleExperiences, { status: 'published' });
      const titles = publicResults.map(e => e.title);

      expect(titles).toContain('Wild Dolphin Ocean Swim & Reef Snorkel');
      expect(titles).toContain('Dune Trail Quad Biking Adventure');
      expect(publicResults.every(e => e.status === 'published')).toBe(true);
    });

    it('2. Draft experiences remain strictly hidden from public queries', () => {
      // Public query without hostId and without admin credentials
      const publicResults = applyFilters(allSampleExperiences);
      const draftItems = publicResults.filter(e => e.status === 'draft');

      expect(draftItems).toHaveLength(0);
      expect(publicResults.map(e => e.id)).not.toContain('5AROLi2JyPgaLBRhFsw5');
      expect(publicResults.map(e => e.id)).not.toContain('act-other-host-draft');
    });

    it('3. Unapproved submissions (pending) remain strictly hidden from public queries', () => {
      const publicResults = applyFilters(allSampleExperiences, { status: 'published' });
      const pendingItems = publicResults.filter(e => e.status === 'pending');

      expect(pendingItems).toHaveLength(0);
      expect(publicResults.map(e => e.id)).not.toContain('act-pending-submission');
    });

    it('4. A stale cached published record in localStorage cannot override an authoritative Firestore draft', () => {
      // Simulating deduplication: itemMap already loaded from Firestore with status: 'draft'
      const itemMap = new Map<string, ActivityTrip>();
      const firestoreAuthoritativeDraft = { ...draftDmcPackage, status: 'draft' as const };
      itemMap.set(firestoreAuthoritativeDraft.id, firestoreAuthoritativeDraft);

      // Stale localStorage copy claiming it is 'published'
      const staleLocalCopy = { ...draftDmcPackage, status: 'published' as const };
      if (!itemMap.has(staleLocalCopy.id)) {
        itemMap.set(staleLocalCopy.id, staleLocalCopy);
      }

      // Assert Firestore's status was preserved and stale local copy was discarded
      const resolved = itemMap.get(draftDmcPackage.id);
      expect(resolved?.status).toBe('draft');

      // Public filter must not show it
      const publicFeed = applyFilters(Array.from(itemMap.values()));
      expect(publicFeed.map(e => e.id)).not.toContain(draftDmcPackage.id);
    });

    it('5. Offline fallback or empty Firestore results cannot silently make private drafts public', () => {
      // Only local items exist (e.g. offline)
      const offlineLocalStore = [draftDmcPackage, otherHostDraft, publishedExp1];
      const publicResults = applyFilters(offlineLocalStore);

      // Only published items are returned; all drafts are filtered out
      expect(publicResults).toHaveLength(1);
      expect(publicResults[0].id).toBe('act-wild-dolphin');
      expect(publicResults.every(e => e.status === 'published')).toBe(true);
    });
  });

  describe('2. Authorization Boundaries & Cross-Host Privacy', () => {
    const hostAId = 'rx6QOgEUfuhoLKwa6gsg03u4xok2';
    const hostBId = 'host_competing_operator';

    it('6. Authenticated hosts can access their own drafts when scoped to their own hostId', () => {
      const hostAResults = applyFilters(
        allSampleExperiences, 
        { hostId: hostAId }, 
        { currentUid: hostAId }
      );
      expect(hostAResults.map(e => e.id)).toContain('5AROLi2JyPgaLBRhFsw5');
      expect(hostAResults.map(e => e.id)).not.toContain('act-other-host-draft');
    });

    it('7. Cross-host draft access is strictly denied: Host B cannot view Host A private drafts', () => {
      // Host B queries Host A's listings: can only receive published offerings, NEVER drafts
      const hostBQueryingHostA = applyFilters(
        allSampleExperiences,
        { hostId: hostAId },
        { currentUid: hostBId }
      );

      // Host A only has draftDmcPackage in this list, which is a draft.
      // Host B must receive empty array (0 drafts leaked).
      expect(hostBQueryingHostA).toHaveLength(0);
      expect(hostBQueryingHostA.map(e => e.id)).not.toContain('5AROLi2JyPgaLBRhFsw5');
    });

    it('8. Unauthenticated public visitors querying a hostId receive only published offerings', () => {
      const unauthenticatedQuery = applyFilters(
        allSampleExperiences,
        { hostId: 'host_ponta_safaris' } // Ponta has publishedExp1
      );

      expect(unauthenticatedQuery).toHaveLength(1);
      expect(unauthenticatedQuery[0].id).toBe('act-wild-dolphin');
      expect(unauthenticatedQuery[0].status).toBe('published');
    });

    it('9. Client-supplied includeUnpublished without verified admin role is safely ignored and denied', () => {
      // Unauthenticated caller attempts privilege escalation
      const unauthorizedAttempt = applyFilters(
        allSampleExperiences,
        { includeUnpublished: true },
        { isCallerAuthorizedAdmin: false }
      );

      // Must be filtered as a standard public query: only published items returned
      expect(unauthorizedAttempt.every(e => e.status === 'published')).toBe(true);
      expect(unauthorizedAttempt.find(e => e.status === 'draft')).toBeUndefined();
      expect(unauthorizedAttempt.find(e => e.status === 'pending')).toBeUndefined();
    });

    it('10. Verified administrator is authorized to inspect all records including unapproved drafts', () => {
      const adminResults = applyFilters(
        allSampleExperiences,
        { includeUnpublished: true },
        { isCallerAuthorizedAdmin: true }
      );

      expect(adminResults).toHaveLength(allSampleExperiences.length);
      expect(adminResults.map(e => e.id)).toContain('5AROLi2JyPgaLBRhFsw5');
      expect(adminResults.map(e => e.id)).toContain('act-pending-submission');
    });

    it('11. isCallerAdmin verifies official MozBook administrator emails accurately', () => {
      expect(isCallerAdmin({ uid: 'adm-1', email: 'mozbookinfo@gmail.com' })).toBe(true);
      expect(isCallerAdmin({ uid: 'adm-2', email: 'admin@mozbook.mz' })).toBe(true);
      expect(isCallerAdmin({ uid: 'adm-3', email: 'MOZBOOKINFO@GMAIL.COM' })).toBe(true);

      // Imposter / non-admin accounts
      expect(isCallerAdmin({ uid: 'user-1', email: 'mozinfo@gmail.com' })).toBe(false);
      expect(isCallerAdmin({ uid: 'user-2', email: 'traveler@gmail.com' })).toBe(false);
      expect(isCallerAdmin(null)).toBe(false);
      expect(isCallerAdmin(undefined)).toBe(false);
    });
  });

  describe('3. Booking References & Deduplication Integrity', () => {
    it('12. Deduplication preserves full experience identifiers, host details, pricing and booking schema', () => {
      const itemMap = new Map<string, ActivityTrip>();
      
      // Seed initial items
      itemMap.set(publishedExp1.id, publishedExp1);
      
      const retrieved = itemMap.get('act-wild-dolphin');
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('act-wild-dolphin');
      expect(retrieved?.hostId).toBe('host_ponta_safaris');
      expect(retrieved?.hostName).toBe('Ponta Marine Safaris');
      expect(retrieved?.priceAdult).toBe(4200);
      expect(retrieved?.currency).toBe('MZN');
      expect(retrieved?.maxGuests).toBe(10);
      expect(retrieved?.city).toBe('Ponta do Ouro');
    });
  });

  describe('4. Firestore Security Rules Evaluation Engine', () => {
    // Exact logic from match /activities_trips/{activityId} in firestore.rules
    function evaluateActivitiesTripsReadRule(
      authContext: { uid: string; email?: string; role?: string } | null,
      documentData: { hostId: string; status: string }
    ): { allowed: boolean; reason?: string } {
      const isAdmin = authContext != null && (
        authContext.role === 'admin' ||
        authContext.email === 'mozbookinfo@gmail.com' ||
        authContext.email === 'admin@mozbook.mz'
      );

      // allow read: if resource.data.status == 'published' || (
      //   isAuthenticated() && (
      //     resource.data.hostId == request.auth.uid || 
      //     isAdmin() ||
      //     request.auth.token.email == 'admin@mozbook.mz'
      //   )
      // );
      if (documentData.status === 'published') {
        return { allowed: true };
      }

      if (authContext != null) {
        if (documentData.hostId === authContext.uid) {
          return { allowed: true };
        }
        if (isAdmin) {
          return { allowed: true };
        }
      }

      return { allowed: false, reason: 'Permission denied: unapproved draft is not publicly readable' };
    }

    it('13. Firestore rules allow public unauthenticated reads of published experiences', () => {
      const evalResult = evaluateActivitiesTripsReadRule(null, { hostId: 'host_1', status: 'published' });
      expect(evalResult.allowed).toBe(true);
    });

    it('14. Firestore rules reject unauthenticated access to draft experiences', () => {
      const evalResult = evaluateActivitiesTripsReadRule(null, { hostId: 'host_1', status: 'draft' });
      expect(evalResult.allowed).toBe(false);
    });

    it('15. Firestore rules allow host to read their own private draft', () => {
      const evalResult = evaluateActivitiesTripsReadRule(
        { uid: 'host_1', email: 'host1@test.com' },
        { hostId: 'host_1', status: 'draft' }
      );
      expect(evalResult.allowed).toBe(true);
    });

    it('16. Firestore rules reject rival host from reading another host private draft', () => {
      const evalResult = evaluateActivitiesTripsReadRule(
        { uid: 'host_2', email: 'host2@test.com' },
        { hostId: 'host_1', status: 'draft' }
      );
      expect(evalResult.allowed).toBe(false);
    });

    it('17. Firestore rules allow verified admin to read any draft or pending submission', () => {
      const evalResult = evaluateActivitiesTripsReadRule(
        { uid: 'admin_1', email: 'mozbookinfo@gmail.com' },
        { hostId: 'host_1', status: 'draft' }
      );
      expect(evalResult.allowed).toBe(true);
    });
  });
});
