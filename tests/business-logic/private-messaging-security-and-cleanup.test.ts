import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isLegitimateConversation,
  getOrCreateConversation,
  sendMessage,
  markConversationAsRead,
  subscribeToUserConversations
} from '../../src/services/messagingService';
import { Conversation } from '../../src/types/messaging';

describe('MozBook — Private Guest–Host Messaging System & Cleanup', () => {
  const messagesPagePath = path.resolve(__dirname, '../../src/pages/Messages.tsx');
  const firestoreRulesPath = path.resolve(__dirname, '../../firestore.rules');
  const messagingServicePath = path.resolve(__dirname, '../../src/services/messagingService.ts');
  const myBookingsPath = path.resolve(__dirname, '../../src/pages/MyBookings.tsx');
  const bookingStatusPath = path.resolve(__dirname, '../../src/pages/BookingStatusPage.tsx');

  const messagesPageContent = fs.readFileSync(messagesPagePath, 'utf-8');
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');
  const messagingServiceContent = fs.readFileSync(messagingServicePath, 'utf-8');
  const myBookingsContent = fs.readFileSync(myBookingsPath, 'utf-8');
  const bookingStatusContent = fs.readFileSync(bookingStatusPath, 'utf-8');

  describe('1. Strictly Private Account-Specific Access & Rules', () => {
    it('restricts conversation read, create and update to authenticated participants only in firestore.rules', () => {
      expect(firestoreRulesContent).toContain('match /conversations/{conversationId}');
      expect(firestoreRulesContent).toContain('request.auth.uid in resource.data.participantIds');
      expect(firestoreRulesContent).toContain('request.resource.data.participantIds is list &&');
      expect(firestoreRulesContent).toContain('request.auth.uid in request.resource.data.participantIds');
    });

    it('removes automatic unrestricted admin access to private messages in firestore.rules', () => {
      // Find the conversations block
      const convBlockStart = firestoreRulesContent.indexOf('match /conversations/{conversationId}');
      const convBlockEnd = firestoreRulesContent.indexOf('match /legal_acceptances', 0);
      const convBlock = firestoreRulesContent.slice(convBlockStart);

      // Verify isAdmin() is not present inside the private conversation or message rules
      expect(convBlock).not.toContain('isAdmin() ||');
      expect(convBlock).toContain('allow delete: if false;');
    });

    it('secures message creation strictly to senderId matching authenticated user', () => {
      expect(firestoreRulesContent).toContain('request.resource.data.senderId == request.auth.uid');
    });
  });

  describe('2. Removal of Starter Concierge and Welcome Conversations', () => {
    it('does not contain createStarterWelcomeConversation in messaging service', () => {
      expect(messagingServiceContent).not.toContain('createStarterWelcomeConversation');
      expect(messagingServiceContent).not.toContain('mozbook_concierge_elvira');
    });

    it('filters out illegitimate, concierge, and welcome conversations from inboxes', () => {
      const legitimateConv: Conversation = {
        id: 'conv_legit_101',
        participantIds: ['guest_1', 'host_1'],
        participants: {
          guest_1: { uid: 'guest_1', displayName: 'Explorer', role: 'guest' },
          host_1: { uid: 'host_1', displayName: 'Maria Host', role: 'host' }
        },
        guestId: 'guest_1',
        guestName: 'Explorer',
        hostId: 'host_1',
        hostName: 'Maria Host',
        listingTitle: 'Vilankulo Ocean Villa',
        lastMessageText: 'Check-in confirmed for 14:00.',
        lastMessageTimestamp: new Date().toISOString(),
        lastMessageSenderId: 'host_1',
        unreadCount: { guest_1: 0, host_1: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const welcomeConv: Conversation = {
        ...legitimateConv,
        id: 'conv_welcome_guest_1',
        listingTitle: 'MozBook Concierge & Travel Assistance',
        hostId: 'mozbook_concierge_elvira'
      };

      expect(isLegitimateConversation(legitimateConv)).toBe(true);
      expect(isLegitimateConversation(welcomeConv)).toBe(false);
    });
  });

  describe('3. Clean Interface: Removal of Promotional & Distracting Content', () => {
    it('removes My Bookings and Discover Stays promotional buttons from the Messages header', () => {
      // Header area should not have the promotional links
      const headerIndex = messagesPageContent.indexOf('Direct guest–host messaging');
      const containerIndex = messagesPageContent.indexOf('Main Messaging Container');
      const headerSlice = messagesPageContent.slice(headerIndex, containerIndex);

      expect(headerSlice).not.toContain('to="/my-bookings"');
      expect(headerSlice).not.toContain('to="/discover"');
      expect(headerSlice).not.toContain('Discover Stays');
    });

    it('removes Protected by MozBook Booking Guarantee banner from conversation interface', () => {
      expect(messagesPageContent).not.toContain('Protected by MozBook Booking Guarantee');
    });

    it('removes generic quick-inquiry prompt pills from conversation interface', () => {
      expect(messagesPageContent).not.toContain('👋 Olá! Is this property available for my dates?');
      expect(messagesPageContent).not.toContain('📶 Is high-speed Wi-Fi available at the property?');
    });

    it('removes Browse Stays and Explore Activities promotional links from empty state', () => {
      const emptyStateIndex = messagesPageContent.indexOf('Select a conversation');
      const emptyStateSlice = messagesPageContent.slice(emptyStateIndex);

      expect(emptyStateSlice).not.toContain('Browse Stays');
      expect(emptyStateSlice).not.toContain('Explore Activities');
    });
  });

  describe('4. Booking-Linked Conversation Access & Relationship Reuse', () => {
    it('reuses existing conversation for the same booking relationship and updates context without duplicating', async () => {
      const guestId = 'guest_suite_101';
      const hostId = 'host_suite_202';

      // First booking relationship
      const convId1 = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'Alice Guest', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Carlos Host', role: 'host' },
        listingId: 'stay_1',
        listingTitle: 'Bazaruto Island Bungalow',
        bookingId: 'bk_stay_001',
        bookingRef: 'MB-STAY-001'
      });

      // Second booking with same host (historical or consecutive booking)
      const convId2 = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'Alice Guest', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Carlos Host', role: 'host' },
        listingId: 'stay_1',
        listingTitle: 'Bazaruto Island Bungalow - Extended Stay',
        bookingId: 'bk_stay_002',
        bookingRef: 'MB-STAY-002'
      });

      // Must reuse existing conversation ID instead of duplicating
      expect(convId1).toBe(convId2);
    });

    it('links Message Host on MyBookings with authoritative booking parameters', () => {
      expect(myBookingsContent).toContain('/messages?bookingId=');
      expect(myBookingsContent).toContain('hostId=');
    });

    it('links Message Host on BookingStatusPage with authoritative booking parameters', () => {
      expect(bookingStatusContent).toContain('/messages?bookingId=');
      expect(bookingStatusContent).toContain('hostId=');
    });
  });
});
