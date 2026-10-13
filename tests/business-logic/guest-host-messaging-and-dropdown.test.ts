import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  sendMessage,
  markConversationAsRead,
  getOrCreateConversation,
  subscribeToUserConversations
} from '../../src/services/messagingService';

describe('MozBook Guest–Host Messaging System & Scrollable Profile Dropdown', () => {
  const navbarPath = path.resolve(__dirname, '../../src/components/Navbar.tsx');
  const appPath = path.resolve(__dirname, '../../src/App.tsx');
  const messagesPagePath = path.resolve(__dirname, '../../src/pages/Messages.tsx');
  const listingDetailsPath = path.resolve(__dirname, '../../src/pages/ListingDetails.tsx');
  const myBookingsPath = path.resolve(__dirname, '../../src/pages/MyBookings.tsx');
  const bookingStatusPath = path.resolve(__dirname, '../../src/pages/BookingStatusPage.tsx');
  const firestoreRulesPath = path.resolve(__dirname, '../../firestore.rules');

  const navbarContent = fs.readFileSync(navbarPath, 'utf-8');
  const appContent = fs.readFileSync(appPath, 'utf-8');
  const messagesPageContent = fs.readFileSync(messagesPagePath, 'utf-8');
  const listingDetailsContent = fs.readFileSync(listingDetailsPath, 'utf-8');
  const myBookingsContent = fs.readFileSync(myBookingsPath, 'utf-8');
  const bookingStatusContent = fs.readFileSync(bookingStatusPath, 'utf-8');
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');

  describe('1. Profile Dropdown Integration', () => {
    it('contains the Messages menu item linking to /messages', () => {
      expect(navbarContent).toContain('to="/messages"');
      expect(navbarContent).toContain('Messages</span>');
    });

    it('positions Messages directly below My Trips & Bookings and above Partner & Hosting', () => {
      const tripsIdx = navbarContent.indexOf('My Trips & Bookings');
      const messagesIdx = navbarContent.indexOf('Messages</span>');
      const partnerHostingIdx = navbarContent.indexOf('Partner & Hosting');

      expect(tripsIdx).toBeGreaterThan(-1);
      expect(messagesIdx).toBeGreaterThan(tripsIdx);
      expect(partnerHostingIdx).toBeGreaterThan(messagesIdx);
    });

    it('uses a message icon and renders dynamic unread badge', () => {
      expect(navbarContent).toContain('MessageCircle');
      expect(navbarContent).toContain('unreadCount > 0');
    });

    it('preserves all required host, partner and admin menu items', () => {
      expect(navbarContent).toContain('Partner Business Dashboard');
      expect(navbarContent).toContain('Partner Onboarding');
      expect(navbarContent).toContain('Mozbook your home (Properties)');
      expect(navbarContent).toContain('Host Activities & Trips');
      expect(navbarContent).toContain('Host Portal Hub');
      expect(navbarContent).toContain('Host Verification (ID & Docs)');
      expect(navbarContent).toContain('App Permissions & Privacy');
      expect(navbarContent).toContain('Log out');
    });
  });

  describe('2. Scrollable Profile Dropdown UX', () => {
    it('applies viewport max-height constraint and internal scrollability', () => {
      expect(navbarContent).toMatch(/max-h-\[min\(82vh,620px\)\]|max-h-\[calc\(100vh/);
      expect(navbarContent).toContain('overflow-y-auto');
      expect(navbarContent).toContain('overscroll-contain');
    });

    it('keeps account header pinned while menu items scroll independently', () => {
      expect(navbarContent).toContain('shrink-0 px-4 py-3 bg-gray-50');
      expect(navbarContent).toContain('overflow-y-auto overscroll-contain py-2 flex-1');
    });

    it('supports escape and click-outside dismissal', () => {
      expect(navbarContent).toContain("event.key === 'Escape'");
      expect(navbarContent).toContain('handleClickOutside');
    });
  });

  describe('3. Dedicated Messages Page (/messages)', () => {
    it('registers the /messages route in App.tsx', () => {
      expect(appContent).toContain('import Messages from \'./pages/Messages\';');
      expect(appContent).toContain('path="/messages" element={<Messages />}');
    });

    it('provides unauthenticated sign-in gate', () => {
      expect(messagesPageContent).toContain('Sign In to Access Messages');
      expect(messagesPageContent).toContain('Sign In with Google');
    });

    it('implements responsive split view with conversation list and active chat thread', () => {
      expect(messagesPageContent).toContain('Search conversations');
      expect(messagesPageContent).toContain('Quick:');
      expect(messagesPageContent).toContain('Select a conversation');
    });

    it('handles query parameter deep-linking for direct host inquiries', () => {
      expect(messagesPageContent).toContain("searchParams.get('conversationId')");
      expect(messagesPageContent).toContain("searchParams.get('hostId')");
      expect(messagesPageContent).toContain('getOrCreateConversation');
    });
  });

  describe('4. Contextual Deep Linking Across MozBook', () => {
    it('includes Contact Host button on ListingDetails page', () => {
      expect(listingDetailsContent).toContain('Contact Host');
      expect(listingDetailsContent).toContain('/messages?hostId=');
    });

    it('includes Message Host button on MyBookings page', () => {
      expect(myBookingsContent).toContain('Message Host');
      expect(myBookingsContent).toContain('/messages?bookingId=');
    });

    it('includes Message Host button on BookingStatusPage', () => {
      expect(bookingStatusContent).toContain('Message Host');
      expect(bookingStatusContent).toContain('/messages?bookingId=');
    });
  });

  describe('5. Messaging Service & Security Rules', () => {
    it('secures conversations and messages in firestore.rules to authenticated participants', () => {
      expect(firestoreRulesContent).toContain('match /conversations/{conversationId}');
      expect(firestoreRulesContent).toContain('match /messages/{messageId}');
      expect(firestoreRulesContent).toContain('request.auth.uid in resource.data.participantIds');
      expect(firestoreRulesContent).toContain('request.resource.data.senderId == request.auth.uid');
    });

    it('creates or retrieves conversation and sends real messages', async () => {
      const guestId = 'guest_test_uid_101';
      const hostId = 'host_test_uid_202';

      const convId = await getOrCreateConversation({
        currentUserId: guestId,
        currentUser: { displayName: 'John Explorer', role: 'guest' },
        otherUserId: hostId,
        otherUser: { displayName: 'Maria Host Tofo', role: 'host', isHostVerified: true },
        listingId: 'listing_tofo_1',
        listingTitle: 'Tofo Ocean Chalet',
        initialMessage: 'Olá! Is airport shuttle available?'
      });

      expect(convId).toBeTruthy();

      // Send follow-up message
      const msg = await sendMessage(
        convId,
        { uid: guestId, displayName: 'John Explorer', role: 'guest' },
        'Also, what is the check-in time?'
      );

      expect(msg.id).toBeTruthy();
      expect(msg.text).toBe('Also, what is the check-in time?');
      expect(msg.senderId).toBe(guestId);

      // Mark as read
      await markConversationAsRead(convId, hostId);
    });
  });
});
