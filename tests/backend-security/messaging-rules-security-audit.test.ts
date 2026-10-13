import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Rules evaluation engine reflecting the exact Firestore Security Rules logic
 * for match /conversations/{conversationId} and subcollection /messages/{messageId}
 */
interface SecurityContext {
  auth: { uid: string } | null;
}

interface FirestoreDocument<T extends Record<string, any> = Record<string, any>> {
  data: T;
}

function evaluateConversationUpdateRule(
  context: SecurityContext,
  resource: FirestoreDocument,
  requestResource: FirestoreDocument
): { allowed: boolean; reason?: string } {
  // isAuthenticated()
  if (!context.auth || !context.auth.uid) {
    return { allowed: false, reason: 'Unauthenticated' };
  }
  const authUid = context.auth.uid;

  // request.auth.uid in resource.data.participantIds
  const participantIds = resource.data.participantIds;
  if (!Array.isArray(participantIds) || !participantIds.includes(authUid)) {
    return { allowed: false, reason: 'Requester is not a participant in conversation' };
  }

  // request.resource.data.participantIds == resource.data.participantIds
  if (
    JSON.stringify(requestResource.data.participantIds) !==
    JSON.stringify(resource.data.participantIds)
  ) {
    return { allowed: false, reason: 'participantIds cannot be modified by clients' };
  }

  // request.resource.data.hostId == resource.data.hostId
  if (requestResource.data.hostId !== resource.data.hostId) {
    return { allowed: false, reason: 'hostId cannot be modified by clients' };
  }

  // (!('guestId' in resource.data) || request.resource.data.guestId == resource.data.guestId)
  if ('guestId' in resource.data && requestResource.data.guestId !== resource.data.guestId) {
    return { allowed: false, reason: 'guestId cannot be modified by clients' };
  }

  // (!('bookingId' in resource.data) || request.resource.data.bookingId == resource.data.bookingId)
  if ('bookingId' in resource.data && requestResource.data.bookingId !== resource.data.bookingId) {
    return { allowed: false, reason: 'bookingId cannot be modified by clients' };
  }

  // (!('bookingRef' in resource.data) || request.resource.data.bookingRef == resource.data.bookingRef)
  if ('bookingRef' in resource.data && requestResource.data.bookingRef !== resource.data.bookingRef) {
    return { allowed: false, reason: 'bookingRef cannot be modified by clients' };
  }

  // (!('listingId' in resource.data) || request.resource.data.listingId == resource.data.listingId)
  if ('listingId' in resource.data && requestResource.data.listingId !== resource.data.listingId) {
    return { allowed: false, reason: 'listingId cannot be modified by clients' };
  }

  // (!('createdAt' in resource.data) || request.resource.data.createdAt == resource.data.createdAt)
  if ('createdAt' in resource.data && requestResource.data.createdAt !== resource.data.createdAt) {
    return { allowed: false, reason: 'createdAt cannot be modified by clients' };
  }

  // Compute affected keys
  const oldKeys = Object.keys(resource.data);
  const newKeys = Object.keys(requestResource.data);
  const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));
  const affectedKeys = allKeys.filter(
    (k) => JSON.stringify(resource.data[k]) !== JSON.stringify(requestResource.data[k])
  );

  const allowedKeys = [
    'lastMessageText',
    'lastMessageTimestamp',
    'lastMessageSenderId',
    'unreadCount',
    'updatedAt'
  ];

  const hasOnlyAllowedKeys = affectedKeys.every((k) => allowedKeys.includes(k));
  if (!hasOnlyAllowedKeys) {
    return { allowed: false, reason: `Disallowed fields modified: ${affectedKeys.filter(k => !allowedKeys.includes(k)).join(', ')}` };
  }

  // Case 1: Participant sending a message
  const hasAnyMessageUpdateKeys = ['lastMessageText', 'lastMessageTimestamp'].some(
    (k) => affectedKeys.includes(k)
  );
  const isMessageSend =
    hasAnyMessageUpdateKeys &&
    requestResource.data.lastMessageSenderId === authUid &&
    typeof requestResource.data.lastMessageText === 'string' &&
    typeof requestResource.data.lastMessageTimestamp === 'string';

  // Case 2: Participant updating own read receipts
  const isReadReceiptOnly = affectedKeys.every((k) => ['unreadCount', 'updatedAt'].includes(k));
  const isUnreadCountMap =
    requestResource.data.unreadCount &&
    typeof requestResource.data.unreadCount === 'object' &&
    !Array.isArray(requestResource.data.unreadCount);

  let isSelfUnreadZero = false;
  let isOnlySelfUnreadModified = false;

  if (isReadReceiptOnly && isUnreadCountMap) {
    isSelfUnreadZero = requestResource.data.unreadCount[authUid] === 0;

    const oldUnread = resource.data.unreadCount || {};
    const newUnread = requestResource.data.unreadCount || {};
    const unreadKeys = Array.from(new Set([...Object.keys(oldUnread), ...Object.keys(newUnread)]));
    const unreadDiff = unreadKeys.filter((k) => oldUnread[k] !== newUnread[k]);

    isOnlySelfUnreadModified = unreadDiff.every((k) => k === authUid);
  }

  const isLegitimateReadReceipt = isReadReceiptOnly && isUnreadCountMap && isSelfUnreadZero && isOnlySelfUnreadModified;

  if (isMessageSend || isLegitimateReadReceipt) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'Failed both message-send and legitimate-read-receipt validations' };
}

function evaluateMessageUpdateRule(
  context: SecurityContext,
  conversationResource: FirestoreDocument,
  messageResource: FirestoreDocument,
  requestMessageResource: FirestoreDocument
): { allowed: boolean; reason?: string } {
  if (!context.auth || !context.auth.uid) {
    return { allowed: false, reason: 'Unauthenticated' };
  }
  const authUid = context.auth.uid;

  const participantIds = conversationResource.data.participantIds;
  if (!Array.isArray(participantIds) || !participantIds.includes(authUid)) {
    return { allowed: false, reason: 'User not participant in parent conversation' };
  }

  // Affected keys
  const oldKeys = Object.keys(messageResource.data);
  const newKeys = Object.keys(requestMessageResource.data);
  const allKeys = Array.from(new Set([...oldKeys, ...newKeys]));
  const affectedKeys = allKeys.filter(
    (k) => JSON.stringify(messageResource.data[k]) !== JSON.stringify(requestMessageResource.data[k])
  );

  if (!affectedKeys.every((k) => k === 'read')) {
    return { allowed: false, reason: 'Only the read field can be modified on messages' };
  }

  if (typeof requestMessageResource.data.read !== 'boolean' || requestMessageResource.data.read !== true) {
    return { allowed: false, reason: 'read must be boolean true' };
  }

  return { allowed: true };
}

describe('MozBook Messaging Firestore Security Rules Audit (Prompt 28A / Prompt 29)', () => {
  const firestoreRulesPath = path.resolve(__dirname, '../../firestore.rules');
  const firestoreRulesContent = fs.readFileSync(firestoreRulesPath, 'utf-8');

  describe('1. Static Rules Verification', () => {
    it('contains strict field restrictions preventing participantIds modification', () => {
      expect(firestoreRulesContent).toContain('request.resource.data.participantIds == resource.data.participantIds');
    });

    it('contains strict hostId immutability checks', () => {
      expect(firestoreRulesContent).toContain('request.resource.data.hostId == resource.data.hostId');
    });

    it('contains booking and listing association immutability checks', () => {
      expect(firestoreRulesContent).toContain('request.resource.data.bookingId == resource.data.bookingId');
      expect(firestoreRulesContent).toContain('request.resource.data.bookingRef == resource.data.bookingRef');
      expect(firestoreRulesContent).toContain('request.resource.data.listingId == resource.data.listingId');
    });

    it('contains least-privilege affectedKeys restrictions on conversations', () => {
      expect(firestoreRulesContent).toContain("'lastMessageText', 'lastMessageTimestamp', 'lastMessageSenderId', 'unreadCount', 'updatedAt'");
    });

    it('contains unread-state isolation preventing modification of another participant read state', () => {
      expect(firestoreRulesContent).toContain('request.resource.data.unreadCount[request.auth.uid] == 0');
      expect(firestoreRulesContent).toContain('request.resource.data.unreadCount.diff(resource.data.unreadCount).affectedKeys().hasOnly([request.auth.uid])');
    });

    it('contains message immutability rules restricting updates exclusively to read: true', () => {
      expect(firestoreRulesContent).toContain("request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read'])");
      expect(firestoreRulesContent).toContain('request.resource.data.read is bool &&');
      expect(firestoreRulesContent).toContain('request.resource.data.read == true');
    });
  });

  describe('2. Authorised Conversation Operations', () => {
    const baseConversation: FirestoreDocument = {
      data: {
        id: 'conv_bazaruto_001',
        participantIds: ['guest_ana', 'host_rui'],
        hostId: 'host_rui',
        guestId: 'guest_ana',
        bookingId: 'bk_stay_77',
        bookingRef: 'MB-STAY-77',
        listingId: 'listing_island_lodge',
        createdAt: '2026-10-01T10:00:00.000Z',
        lastMessageText: 'Hello host!',
        lastMessageTimestamp: '2026-10-01T10:00:00.000Z',
        lastMessageSenderId: 'guest_ana',
        unreadCount: { guest_ana: 0, host_rui: 1 },
        updatedAt: '2026-10-01T10:00:00.000Z'
      }
    };

    it('allows legitimate participant to send a new message and update delivery metadata', () => {
      const sendUpdate: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          lastMessageText: 'Will breakfast be served at 8am?',
          lastMessageTimestamp: '2026-10-02T08:00:00.000Z',
          lastMessageSenderId: 'guest_ana',
          unreadCount: { guest_ana: 0, host_rui: 2 },
          updatedAt: '2026-10-02T08:00:00.000Z'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        sendUpdate
      );
      expect(result.allowed).toBe(true);
    });

    it('allows legitimate recipient to mark conversation as read, resetting only their own unread count', () => {
      const readUpdate: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          unreadCount: { guest_ana: 0, host_rui: 0 },
          updatedAt: '2026-10-02T08:30:00.000Z'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'host_rui' } },
        baseConversation,
        readUpdate
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('3. Unauthorised Conversation Attacks (Must Be Rejected)', () => {
    const baseConversation: FirestoreDocument = {
      data: {
        id: 'conv_bazaruto_001',
        participantIds: ['guest_ana', 'host_rui'],
        hostId: 'host_rui',
        guestId: 'guest_ana',
        bookingId: 'bk_stay_77',
        bookingRef: 'MB-STAY-77',
        listingId: 'listing_island_lodge',
        createdAt: '2026-10-01T10:00:00.000Z',
        lastMessageText: 'Hello host!',
        lastMessageTimestamp: '2026-10-01T10:00:00.000Z',
        lastMessageSenderId: 'guest_ana',
        unreadCount: { guest_ana: 0, host_rui: 1 },
        updatedAt: '2026-10-01T10:00:00.000Z'
      }
    };

    it('rejects attempt to modify participantIds (injecting attacker or removing participants)', () => {
      const hijackedConv: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          participantIds: ['guest_ana', 'host_rui', 'attacker_mallory']
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        hijackedConv
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('participantIds cannot be modified');
    });

    it('rejects attempt to modify hostId', () => {
      const tamperedHost: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          hostId: 'attacker_mallory'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        tamperedHost
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('hostId cannot be modified');
    });

    it('rejects attempt to modify booking references (bookingId / bookingRef)', () => {
      const tamperedBooking: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          bookingId: 'bk_fraud_999',
          bookingRef: 'MB-FRAUD-999'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        tamperedBooking
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('bookingId cannot be modified');
    });

    it('rejects attempt to modify listingId association', () => {
      const tamperedListing: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          listingId: 'listing_malicious_target'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        tamperedListing
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('listingId cannot be modified');
    });

    it('rejects attempt to tamper with another participant unread count during read receipts', () => {
      // Guest Ana tries to alter Host Rui's unreadCount to 0 without Host Rui reading
      const forgedReadReceipt: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          unreadCount: { guest_ana: 0, host_rui: 0 },
          updatedAt: '2026-10-02T09:00:00.000Z'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        forgedReadReceipt
      );
      expect(result.allowed).toBe(false);
    });

    it('rejects attempt to forge sender identity on conversation lastMessageSenderId', () => {
      // Ana sends update claiming Rui sent it
      const spoofedSender: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          lastMessageText: 'I accept full cancellation refund.',
          lastMessageTimestamp: '2026-10-02T09:00:00.000Z',
          lastMessageSenderId: 'host_rui', // Forged sender!
          unreadCount: { guest_ana: 1, host_rui: 0 },
          updatedAt: '2026-10-02T09:00:00.000Z'
        }
      };

      const result = evaluateConversationUpdateRule(
        { auth: { uid: 'guest_ana' } },
        baseConversation,
        spoofedSender
      );
      expect(result.allowed).toBe(false);
    });

    it('rejects update by an unauthenticated user or unrelated third-party account', () => {
      const sendUpdate: FirestoreDocument = {
        data: {
          ...baseConversation.data,
          lastMessageText: 'Unrelated message',
          lastMessageSenderId: 'stranger_charlie'
        }
      };

      const resultNoAuth = evaluateConversationUpdateRule(
        { auth: null },
        baseConversation,
        sendUpdate
      );
      expect(resultNoAuth.allowed).toBe(false);

      const resultStranger = evaluateConversationUpdateRule(
        { auth: { uid: 'stranger_charlie' } },
        baseConversation,
        sendUpdate
      );
      expect(resultStranger.allowed).toBe(false);
    });
  });

  describe('4. Message-Level Least-Privilege Verification', () => {
    const parentConversation: FirestoreDocument = {
      data: {
        participantIds: ['guest_ana', 'host_rui']
      }
    };

    const originalMessage: FirestoreDocument = {
      data: {
        id: 'msg_001',
        conversationId: 'conv_bazaruto_001',
        senderId: 'guest_ana',
        senderName: 'Ana Guest',
        senderRole: 'guest',
        text: 'Can we check in early?',
        read: false,
        createdAt: '2026-10-01T10:00:00.000Z',
        timestampMs: 1727776800000
      }
    };

    it('allows authorized participant to mark incoming message read: true', () => {
      const readUpdate: FirestoreDocument = {
        data: {
          ...originalMessage.data,
          read: true
        }
      };

      const result = evaluateMessageUpdateRule(
        { auth: { uid: 'host_rui' } },
        parentConversation,
        originalMessage,
        readUpdate
      );
      expect(result.allowed).toBe(true);
    });

    it('rejects attempt to alter message text content', () => {
      const tamperedText: FirestoreDocument = {
        data: {
          ...originalMessage.data,
          text: 'The host promised a 100% discount on the entire villa.'
        }
      };

      const result = evaluateMessageUpdateRule(
        { auth: { uid: 'guest_ana' } },
        parentConversation,
        originalMessage,
        tamperedText
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Only the read field can be modified');
    });

    it('rejects attempt to alter message senderId', () => {
      const tamperedSender: FirestoreDocument = {
        data: {
          ...originalMessage.data,
          senderId: 'host_rui'
        }
      };

      const result = evaluateMessageUpdateRule(
        { auth: { uid: 'guest_ana' } },
        parentConversation,
        originalMessage,
        tamperedSender
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Only the read field can be modified');
    });

    it('rejects non-participant attempting to mark message as read', () => {
      const readUpdate: FirestoreDocument = {
        data: {
          ...originalMessage.data,
          read: true
        }
      };

      const result = evaluateMessageUpdateRule(
        { auth: { uid: 'stranger_mallory' } },
        parentConversation,
        originalMessage,
        readUpdate
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('User not participant in parent conversation');
    });
  });
});
