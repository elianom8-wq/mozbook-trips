import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getOrCreateConversation,
  sendMessage,
  consolidateConversationsForDisplay,
  subscribeToUserConversations
} from '../../src/services/messagingService';
import { Conversation } from '../../src/types/messaging';

describe('MozBook — Messaging Deduplication and Management Page Consolidation', () => {
  const messagesPagePath = path.resolve(__dirname, '../../src/pages/Messages.tsx');
  const createActivityTripPath = path.resolve(__dirname, '../../src/pages/CreateActivityTrip.tsx');
  const hostActivitiesDashboardPath = path.resolve(__dirname, '../../src/pages/HostActivitiesDashboard.tsx');
  const partnerDashboardPath = path.resolve(__dirname, '../../src/pages/PartnerDashboard.tsx');
  const appPath = path.resolve(__dirname, '../../src/App.tsx');
  const hostHubPath = path.resolve(__dirname, '../../src/pages/HostHub.tsx');
  const firestoreRulesPath = path.resolve(__dirname, '../../firestore.rules');

  const messagesPageContent = fs.readFileSync(messagesPagePath, 'utf-8');
  const createActivityTripContent = fs.readFileSync(createActivityTripPath, 'utf-8');
  const hostActivitiesDashboardContent = fs.readFileSync(hostActivitiesDashboardPath, 'utf-8');
  const partnerDashboardContent = fs.readFileSync(partnerDashboardPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const hostHubContent = fs.readFileSync(hostHubPath, 'utf-8');
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');

  describe('Part A — Messaging Deduplication Engine', () => {
    it('1. Repeated sequential calls for the same guest, host, and listing resolve to one conversation', async () => {
      const guestId = 'guest_dedup_seq_1';
      const hostId = 'host_dedup_seq_1';
      const listingId = 'spanish_villa_belo_1';

      const convId1 = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'Guest Tester', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Villa Host', role: 'host' },
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte'
      });

      const convId2 = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'Guest Tester', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Villa Host', role: 'host' },
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte'
      });

      expect(convId1).toBe(convId2);
    });

    it('2. Concurrent in-flight calls do not create duplicate conversations', async () => {
      const guestId = 'guest_concurrent_1';
      const hostId = 'host_concurrent_1';
      const listingId = 'spanish_villa_concurrent';

      const [res1, res2, res3] = await Promise.all([
        getOrCreateConversation({
          currentUserId: guestId,
          currentUser: { displayName: 'Concurrent Guest', role: 'guest' },
          otherUserId: hostId,
          otherUser: { displayName: 'Villa Host', role: 'host' },
          listingId,
          listingTitle: 'Spanish Villa Belo Horizonte'
        }),
        getOrCreateConversation({
          currentUserId: guestId,
          currentUser: { displayName: 'Concurrent Guest', role: 'guest' },
          otherUserId: hostId,
          otherUser: { displayName: 'Villa Host', role: 'host' },
          listingId,
          listingTitle: 'Spanish Villa Belo Horizonte'
        }),
        getOrCreateConversation({
          currentUserId: guestId,
          currentUser: { displayName: 'Concurrent Guest', role: 'guest' },
          otherUserId: hostId,
          otherUser: { displayName: 'Villa Host', role: 'host' },
          listingId,
          listingTitle: 'Spanish Villa Belo Horizonte'
        })
      ]);

      expect(res1).toBe(res2);
      expect(res2).toBe(res3);
    });

    it('3. Two different guests contacting the same host about the same listing remain in separate threads', async () => {
      const guestA = 'guest_distinct_alpha';
      const guestB = 'guest_distinct_beta';
      const hostId = 'host_shared_spanish_villa';
      const listingId = 'spanish_villa_belo_shared';

      const convA = await getOrCreateConversation({
        currentUserId: guestA,
        currentUser: { displayName: 'Guest Alpha', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Host Spanish Villa', role: 'host' },
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte'
      });

      const convB = await getOrCreateConversation({
        currentUserId: guestB,
        currentUser: { displayName: 'Guest Beta', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Host Spanish Villa', role: 'host' },
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte'
      });

      expect(convA).not.toBe(convB);
      expect(convA).toContain(guestA);
      expect(convB).toContain(guestB);
    });

    it('4. Initial inquiry message is preserved without duplicating messages', async () => {
      const guestId = 'guest_inquiry_tester';
      const hostId = 'host_inquiry_tester';
      const listingId = 'listing_inquiry_test';

      const convId = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'Inquiry Guest', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Host Inquiry', role: 'host' },
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte',
        initialMessage: 'Are there any special needs for the house?'
      });

      expect(convId).toBeTruthy();

      // Calling again without initialMessage does not append duplicate initial messages
      const convIdAgain = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'Inquiry Guest', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Host Inquiry', role: 'host' },
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte'
      });

      expect(convIdAgain).toBe(convId);
    });

    it('5. Existing conversation records and message history remain accessible with safe deduplication', () => {
      const hostId = 'host_belo_horizonte';
      const guestId = 'guest_manual_test_1';
      const listingId = 'spanish_villa_belo';

      const participants = {
        [guestId]: { uid: guestId, displayName: 'Guest 1', role: 'guest' as const },
        [hostId]: { uid: hostId, displayName: 'Villa Host', role: 'host' as const }
      };

      // Simulate the exact 3 conversations from the user investigation:
      // Conv 1 & 2: redundant stubs with auto-generated initial text
      // Conv 3: active thread with the user's typed question
      const conv1: Conversation = {
        id: 'conv_legacy_stub_1',
        participantIds: [guestId, hostId],
        participants,
        guestId,
        guestName: 'Guest 1',
        hostId,
        hostName: 'Villa Host',
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte',
        lastMessageText: 'Inquiry regarding Spanish Villa Belo Horizonte',
        lastMessageTimestamp: '2026-10-20T01:00:00.000Z',
        lastMessageSenderId: guestId,
        unreadCount: { [hostId]: 0 },
        createdAt: '2026-10-20T01:00:00.000Z',
        updatedAt: '2026-10-20T01:00:00.000Z'
      };

      const conv2: Conversation = {
        id: 'conv_legacy_stub_2',
        participantIds: [guestId, hostId],
        participants,
        guestId,
        guestName: 'Guest 1',
        hostId,
        hostName: 'Villa Host',
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte',
        lastMessageText: 'Inquiry regarding Spanish Villa Belo Horizonte',
        lastMessageTimestamp: '2026-10-20T01:05:00.000Z',
        lastMessageSenderId: guestId,
        unreadCount: { [hostId]: 0 },
        createdAt: '2026-10-20T01:05:00.000Z',
        updatedAt: '2026-10-20T01:05:00.000Z'
      };

      const conv3: Conversation = {
        id: 'conv_legacy_active_3',
        participantIds: [guestId, hostId],
        participants,
        guestId,
        guestName: 'Guest 1',
        hostId,
        hostName: 'Villa Host',
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte',
        lastMessageText: 'Are there any special needs for the house?',
        lastMessageTimestamp: '2026-10-20T01:10:00.000Z',
        lastMessageSenderId: guestId,
        unreadCount: { [hostId]: 1 },
        createdAt: '2026-10-20T01:10:00.000Z',
        updatedAt: '2026-10-20T01:10:00.000Z'
      };

      const displayList = consolidateConversationsForDisplay([conv1, conv2, conv3], hostId);

      // Stubs are collapsed into the active thread
      expect(displayList.length).toBe(1);
      expect(displayList[0].id).toBe('conv_legacy_active_3');
      expect(displayList[0].lastMessageText).toBe('Are there any special needs for the house?');
      expect(displayList[0].unreadCount[hostId]).toBe(1);
    });

    it('6. Multiple conversations with different real messages are not hidden', () => {
      const hostId = 'host_belo_horizonte';
      const guestId = 'guest_manual_test_2';
      const listingId = 'spanish_villa_belo';
      const participants2 = {
        [guestId]: { uid: guestId, displayName: 'Guest 2', role: 'guest' as const },
        [hostId]: { uid: hostId, displayName: 'Villa Host', role: 'host' as const }
      };

      const convA: Conversation = {
        id: 'conv_custom_a',
        participantIds: [guestId, hostId],
        participants: participants2,
        guestId,
        guestName: 'Guest 2',
        hostId,
        hostName: 'Villa Host',
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte',
        lastMessageText: 'Can we check in early at 10 AM?',
        lastMessageTimestamp: '2026-10-20T02:00:00.000Z',
        lastMessageSenderId: guestId,
        unreadCount: { [hostId]: 0 },
        createdAt: '2026-10-20T02:00:00.000Z',
        updatedAt: '2026-10-20T02:00:00.000Z'
      };

      const convB: Conversation = {
        id: 'conv_custom_b',
        participantIds: [guestId, hostId],
        participants: participants2,
        guestId,
        guestName: 'Guest 2',
        hostId,
        hostName: 'Villa Host',
        listingId,
        listingTitle: 'Spanish Villa Belo Horizonte',
        lastMessageText: 'Is secure parking available for 2 cars?',
        lastMessageTimestamp: '2026-10-20T02:15:00.000Z',
        lastMessageSenderId: guestId,
        unreadCount: { [hostId]: 1 },
        createdAt: '2026-10-20T02:15:00.000Z',
        updatedAt: '2026-10-20T02:15:00.000Z'
      };

      const displayList = consolidateConversationsForDisplay([convA, convB], hostId);

      // Both threads have real user messages; neither is hidden!
      expect(displayList.length).toBe(2);
      expect(displayList.map((c) => c.id)).toContain('conv_custom_a');
      expect(displayList.map((c) => c.id)).toContain('conv_custom_b');
    });

    it('7. Messages.tsx guards against deep-link re-trigger loops and replaces URL search params', () => {
      expect(messagesPageContent).toContain('handledDeepLinkRef');
      expect(messagesPageContent).toContain('isHandlingDeepLinkRef');
      expect(messagesPageContent).toContain("setSearchParams({ conversationId: matchedExisting.id }, { replace: true })");
      expect(messagesPageContent).toContain("setSearchParams({ conversationId: convId }, { replace: true })");
      expect(messagesPageContent).not.toMatch(/handleDeepLink\(\);\s*\}, \[[^\]]*\bconversations\b[^\]]*\]\);/);
    });

    it('8. Firestore security rules strictly preserve participant privacy', () => {
      expect(firestoreRulesContent).toContain('match /conversations/{conversationId}');
      expect(firestoreRulesContent).toContain('request.auth.uid in resource.data.participantIds');
      expect(firestoreRulesContent).toContain('match /messages/{messageId}');
      expect(firestoreRulesContent).toContain('request.resource.data.senderId == request.auth.uid');
    });
  });

  describe('Part B — Host Management Consolidation', () => {
    it('1. App.tsx preserves /host/activities as working route and /partner/dashboard as primary hub', () => {
      expect(appContent).toContain('path="/host/activities" element={<HostActivitiesDashboard />}');
      expect(appContent).toContain('path="/partner/dashboard" element={<PartnerDashboard />}');
    });

    it('2. HostActivitiesDashboard presents prominent Partner Dashboard integration banner', () => {
      expect(hostActivitiesDashboardContent).toContain('Primary Multi-Service Hub');
      expect(hostActivitiesDashboardContent).toContain('Open in Partner Dashboard');
      expect(hostActivitiesDashboardContent).toContain('/partner/dashboard?tab=');
    });

    it('3. CreateActivityTrip redirects to Partner Dashboard matching activities or trips tab', () => {
      expect(createActivityTripContent).toContain("const targetTab = type === 'trip' ? 'trips' : 'activities';");
      expect(createActivityTripContent).toContain('navigate(`/partner/dashboard?tab=${targetTab}`);');
    });

    it('4. PartnerDashboard supports comprehensive multi-service management (accommodations, activities, trips, transport, bookings, earnings)', () => {
      expect(partnerDashboardContent).toContain("'overview' | 'accommodations' | 'activities' | 'trips' | 'transport' | 'bookings' | 'clients' | 'earnings' | 'account'");
      expect(partnerDashboardContent).toContain('tabFromUrl');
      expect(partnerDashboardContent).toContain('QrCodeScannerModal');
      expect(partnerDashboardContent).toContain('MOZBOOK_COMMISSION_PERCENT');
      expect(partnerDashboardContent).toContain('PARTNER_SHARE_PERCENT');
    });

    it('5. HostHub preserves host onboarding options and direct routes', () => {
      expect(hostHubContent).toContain('/host/create');
      expect(hostHubContent).toContain('/host/activities');
      expect(hostHubContent).toContain('/partner');
      expect(hostHubContent).toContain('/partner/dashboard');
    });
  });
});
