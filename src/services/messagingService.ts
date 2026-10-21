import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Conversation,
  Message,
  CreateConversationParams,
  ConversationParticipant
} from '../types/messaging';

const STORAGE_KEY_PREFIX_CONV = 'mozbook_conversations_';
const STORAGE_KEY_PREFIX_MSGS = 'mozbook_messages_';

/**
 * Privacy-safe diagnostic logger for tracing Firestore messaging operations
 */
function logMessagingDiagnostic(
  operation: string,
  targetUserId?: string,
  error?: any
): void {
  const currentAuthUser = auth.currentUser;
  const projectId = (db.app.options as any)?.projectId || (firebaseConfig as any)?.projectId || 'unknown';
  const databaseId = (firebaseConfig as any)?.firestoreDatabaseId || 'default';
  const isAuthInitialized = !!currentAuthUser;
  const isTargetMatching = currentAuthUser && targetUserId ? currentAuthUser.uid === targetUserId : false;

  let errorCategory = 'none';
  if (error) {
    if (error.code === 'permission-denied') {
      errorCategory = 'permission-denied';
    } else if (error.code === 'unauthenticated') {
      errorCategory = 'unauthenticated';
    } else if (error.code === 'unavailable' || error.code === 'deadline-exceeded') {
      errorCategory = 'network';
    } else {
      errorCategory = 'configuration-or-other';
    }
  }

  const logPayload = {
    operation,
    projectId,
    databaseId,
    authInitialized: isAuthInitialized,
    isAuthenticated: !!currentAuthUser,
    authUidMatchesTarget: isTargetMatching,
    collectionPath: 'conversations',
    hasQueryFilter: true,
    errorCategory,
    errorCode: error?.code || null
  };

  if (error) {
    console.warn(`[messagingService] Diagnostic trace for ${operation}:`, logPayload);
  }
}

const memoryStore = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
    return memoryStore.get(key) || null;
  } catch {
    return memoryStore.get(key) || null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    } else {
      memoryStore.set(key, value);
    }
  } catch {
    memoryStore.set(key, value);
  }
}

function safeGetStorageKeys(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      return Object.keys(localStorage);
    }
    return Array.from(memoryStore.keys());
  } catch {
    return Array.from(memoryStore.keys());
  }
}

function cleanFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = cleanFirestorePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Validate that a conversation is a legitimate booking relationship,
 * and not an automatically generated welcome/concierge conversation.
 */
export function isLegitimateConversation(c: Conversation): boolean {
  if (!c || !c.id) return false;
  if (c.id.startsWith('conv_welcome_')) return false;
  if (c.hostId && c.hostId.toLowerCase().includes('concierge')) return false;
  if (c.listingTitle && c.listingTitle.toLowerCase().includes('concierge')) return false;
  return true;
}

/**
 * Retrieve cached conversations from localStorage for offline/fast load,
 * strictly filtering out any non-booking or welcome conversations.
 */
function getLocalConversations(userId: string): Conversation[] {
  try {
    const raw = safeGetItem(`${STORAGE_KEY_PREFIX_CONV}${userId}`);
    if (!raw) return [];
    const list: Conversation[] = JSON.parse(raw);
    const legitimate = list.filter(isLegitimateConversation);
    if (legitimate.length !== list.length) {
      saveLocalConversations(userId, legitimate);
    }
    return legitimate;
  } catch {
    return [];
  }
}

/**
 * Cache conversations to localStorage
 */
function saveLocalConversations(userId: string, conversations: Conversation[]): void {
  try {
    const legitimateOnly = conversations.filter(isLegitimateConversation);
    safeSetItem(`${STORAGE_KEY_PREFIX_CONV}${userId}`, JSON.stringify(legitimateOnly));
  } catch (err) {
    console.warn('Could not cache conversations in localStorage:', err);
  }
}

/**
 * Retrieve cached messages for a specific conversation
 */
function getLocalMessages(conversationId: string): Message[] {
  try {
    const raw = safeGetItem(`${STORAGE_KEY_PREFIX_MSGS}${conversationId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Cache messages for a specific conversation
 */
function saveLocalMessages(conversationId: string, messages: Message[]): void {
  try {
    safeSetItem(`${STORAGE_KEY_PREFIX_MSGS}${conversationId}`, JSON.stringify(messages));
  } catch (err) {
    console.warn('Could not cache messages in localStorage:', err);
  }
}

/**
 * Safely consolidates duplicate conversation records for display.
 * Rules:
 * 1. Groups conversations by logical participants and context: (participantIds, listingId/bookingId).
 * 2. If a group has multiple conversations:
 *    - If redundant duplicates are unpopulated initial stubs (e.g. lastMessageText is the default
 *      "Inquiry regarding..." template or "Conversation started") and another conversation in the group
 *      has real user messages, collapse the stubs into the active conversation so the inbox doesn't show duplicates.
 *    - Reconciles unread counts across all records in the group so no unread messages are lost.
 *    - If multiple conversations in the group contain DIFFERENT real user messages, PRESERVE BOTH so message
 *      history is never hidden or made inaccessible.
 * 3. Sorts conversations by latest activity (updatedAt or lastMessageTimestamp).
 */
export function consolidateConversationsForDisplay(
  conversations: Conversation[],
  currentUserId: string
): Conversation[] {
  if (!conversations || conversations.length <= 1) return conversations;

  // Group by logical relationship
  const groups = new Map<string, Conversation[]>();
  for (const c of conversations) {
    const otherId = (c.participantIds || []).find((id) => id !== currentUserId) || 'other';
    const contextKey = c.bookingId 
      ? `b_${c.bookingId}` 
      : (c.listingId ? `l_${c.listingId}` : 'general');
    const groupKey = `${[currentUserId, otherId].sort().join('_')}__${contextKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(c);
  }

  const result: Conversation[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }

    // Sort group conversations by latest activity descending
    group.sort((a, b) => {
      const tA = new Date(a.updatedAt || a.lastMessageTimestamp || 0).getTime();
      const tB = new Date(b.updatedAt || b.lastMessageTimestamp || 0).getTime();
      return tB - tA;
    });

    // Check if any in the group are default stubs vs active threads with real custom messages
    const isDefaultStub = (c: Conversation) => {
      const text = c.lastMessageText || '';
      return text.startsWith('Inquiry regarding') || text === 'Conversation started' || text.trim() === '';
    };

    const activeThreads = group.filter((c) => !isDefaultStub(c));
    const stubs = group.filter(isDefaultStub);

    if (activeThreads.length === 0) {
      // All are stubs with default text: keep the most recent one, merge unread counts
      const primary = { ...group[0] };
      const mergedUnread = { ...(primary.unreadCount || {}) };
      for (let i = 1; i < group.length; i++) {
        const otherUnread = group[i].unreadCount || {};
        for (const [uid, count] of Object.entries(otherUnread)) {
          mergedUnread[uid] = (mergedUnread[uid] || 0) + (count as number);
        }
      }
      primary.unreadCount = mergedUnread;
      result.push(primary);
    } else if (activeThreads.length === 1) {
      // Exactly 1 active thread and some redundant stubs:
      // Collapse stubs into the active thread!
      const primary = { ...activeThreads[0] };
      const mergedUnread = { ...(primary.unreadCount || {}) };
      for (const stub of stubs) {
        const otherUnread = stub.unreadCount || {};
        for (const [uid, count] of Object.entries(otherUnread)) {
          mergedUnread[uid] = (mergedUnread[uid] || 0) + (count as number);
        }
      }
      primary.unreadCount = mergedUnread;
      result.push(primary);
    } else {
      // Multiple active threads have different custom messages!
      // Preserve all active threads so message history remains accessible,
      // and collapse any empty stubs into the latest active thread.
      const primary = { ...activeThreads[0] };
      const mergedUnread = { ...(primary.unreadCount || {}) };
      for (const stub of stubs) {
        const otherUnread = stub.unreadCount || {};
        for (const [uid, count] of Object.entries(otherUnread)) {
          mergedUnread[uid] = (mergedUnread[uid] || 0) + (count as number);
        }
      }
      primary.unreadCount = mergedUnread;
      result.push(primary);

      for (let i = 1; i < activeThreads.length; i++) {
        result.push(activeThreads[i]);
      }
    }
  }

  // Final sort by latest activity
  return result.sort((a, b) => {
    const tA = new Date(a.updatedAt || a.lastMessageTimestamp || 0).getTime();
    const tB = new Date(b.updatedAt || b.lastMessageTimestamp || 0).getTime();
    return tB - tA;
  });
}

/**
 * Subscribe in real time to all conversations involving the specified user
 */
export function subscribeToUserConversations(
  userId: string,
  _userName: string,
  onUpdate: (conversations: Conversation[]) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  let unsubscribeFirestore: (() => void) | null = null;
  let isSubscribed = true;

  // Immediate local cache emission for fast render
  let cached = getLocalConversations(userId);
  onUpdate(consolidateConversationsForDisplay(cached, userId));

  const initFirestoreSubscription = (authUid: string) => {
    if (!isSubscribed) return;
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
      unsubscribeFirestore = null;
    }

    try {
      const convRef = collection(db, 'conversations');
      const q = query(
        convRef,
        where('participantIds', 'array-contains', authUid)
      );

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const remoteList: Conversation[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data() as Conversation;
            if (isLegitimateConversation(data)) {
              remoteList.push({
                ...data,
                id: docSnap.id
              });
            }
          });

          // Merge remote with local cache for this user
          const combinedMap = new Map<string, Conversation>();
          cached.forEach((c) => combinedMap.set(c.id, c));
          remoteList.forEach((c) => combinedMap.set(c.id, c));

          const rawList = Array.from(combinedMap.values());
          const consolidated = consolidateConversationsForDisplay(rawList, authUid);

          saveLocalConversations(authUid, consolidated);
          onUpdate(consolidated);
        },
        (error) => {
          logMessagingDiagnostic('subscribeToUserConversations.onSnapshot', authUid, error);
          if (error?.code !== 'permission-denied') {
            console.warn('[messagingService] Firestore conversation subscription fallback to local cache:', error);
          }
          const consolidatedCached = consolidateConversationsForDisplay(cached, authUid);
          onUpdate(consolidatedCached);
        }
      );
    } catch (err) {
      logMessagingDiagnostic('subscribeToUserConversations.setup', authUid, err);
      console.warn('[messagingService] Failed to establish Firestore listener:', err);
      const consolidatedCached = consolidateConversationsForDisplay(cached, authUid);
      onUpdate(consolidatedCached);
    }
  };

  // If already authenticated and matches requested userId, initialize immediately
  if (auth.currentUser && auth.currentUser.uid === userId) {
    initFirestoreSubscription(auth.currentUser.uid);
  }

  // Monitor auth state changes to coordinate initialization timing, sign-in, sign-out and account switching
  const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
    if (!isSubscribed) return;

    if (!currentUser || currentUser.uid !== userId) {
      // User signed out or switched account
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      if (!currentUser) {
        onUpdate([]);
      }
      return;
    }

    // Authenticated user verified and matches userId
    if (!unsubscribeFirestore) {
      cached = getLocalConversations(currentUser.uid);
      initFirestoreSubscription(currentUser.uid);
    }
  });

  return () => {
    isSubscribed = false;
    unsubscribeAuth();
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Subscribe in real time to messages within a specific conversation
 */
export function subscribeToConversationMessages(
  conversationId: string,
  onUpdate: (messages: Message[]) => void
): () => void {
  if (!conversationId) {
    onUpdate([]);
    return () => {};
  }

  // Immediate local cache emission
  const localMsgs = getLocalMessages(conversationId);
  onUpdate(localMsgs);

  let unsubscribeFirestore: (() => void) | null = null;
  let isSubscribed = true;

  const initMessagesSubscription = () => {
    if (!isSubscribed || unsubscribeFirestore) return;
    try {
      const msgsRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(msgsRef, orderBy('timestampMs', 'asc'));

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const remoteMsgs: Message[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as Message;
              remoteMsgs.push({
                ...data,
                id: docSnap.id
              });
            });

            // Merge by ID
            const msgMap = new Map<string, Message>();
            localMsgs.forEach((m) => msgMap.set(m.id, m));
            remoteMsgs.forEach((m) => msgMap.set(m.id, m));

            const sorted = Array.from(msgMap.values()).sort((a, b) => a.timestampMs - b.timestampMs);
            saveLocalMessages(conversationId, sorted);
            onUpdate(sorted);
          } else if (localMsgs.length > 0) {
            onUpdate(localMsgs);
          }
        },
        (error) => {
          logMessagingDiagnostic('subscribeToConversationMessages.onSnapshot', auth.currentUser?.uid, error);
          if (error?.code !== 'permission-denied') {
            console.warn('[messagingService] Messages snapshot listener fallback:', error);
          }
          onUpdate(localMsgs);
        }
      );
    } catch (err) {
      logMessagingDiagnostic('subscribeToConversationMessages.setup', auth.currentUser?.uid, err);
      console.warn('[messagingService] Could not listen to messages:', err);
      onUpdate(localMsgs);
    }
  };

  if (auth.currentUser) {
    initMessagesSubscription();
  }

  const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
    if (!isSubscribed) return;
    if (!currentUser) {
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
        unsubscribeFirestore = null;
      }
      return;
    }
    if (!unsubscribeFirestore) {
      initMessagesSubscription();
    }
  });

  return () => {
    isSubscribed = false;
    unsubscribeAuth();
    if (unsubscribeFirestore) {
      unsubscribeFirestore();
    }
  };
}

/**
 * Real-time listener for total unread message badge count
 */
export function subscribeToUnreadCount(
  userId: string,
  userName: string,
  onUpdate: (count: number) => void
): () => void {
  return subscribeToUserConversations(userId, userName, (conversations) => {
    const totalUnread = conversations.reduce((sum, c) => {
      const count = c.unreadCount?.[userId] || 0;
      return sum + count;
    }, 0);
    onUpdate(totalUnread);
  });
}

/**
 * Send a new message to a conversation
 */
export async function sendMessage(
  conversationId: string,
  sender: ConversationParticipant,
  text: string
): Promise<Message> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Message text cannot be empty');
  }

  const now = new Date();
  const timestampIso = now.toISOString();
  const timestampMs = now.getTime();
  const msgId = `msg_${timestampMs}_${Math.random().toString(36).substring(2, 8)}`;

  const newMessage: Message = {
    id: msgId,
    conversationId,
    senderId: sender.uid,
    senderName: sender.displayName || 'User',
    senderPhotoURL: sender.photoURL,
    senderRole: sender.role || 'guest',
    text: trimmed,
    read: false,
    createdAt: timestampIso,
    timestampMs
  };

  // 1. Instantly update local messages cache
  const localMsgs = getLocalMessages(conversationId);
  localMsgs.push(newMessage);
  saveLocalMessages(conversationId, localMsgs);

  // 2. Update local conversation lastMessage and unread count
  const allUserKeys = safeGetStorageKeys().filter((k) =>
    k.startsWith(STORAGE_KEY_PREFIX_CONV)
  );

  allUserKeys.forEach((key) => {
    try {
      const convs = JSON.parse(safeGetItem(key) || '[]') as Conversation[];
      const idx = convs.findIndex((c) => c.id === conversationId);
      if (idx !== -1) {
        const c = convs[idx];
        c.lastMessageText = trimmed;
        c.lastMessageTimestamp = timestampIso;
        c.lastMessageSenderId = sender.uid;
        c.updatedAt = timestampIso;

        // Increment unread count for other participants
        c.participantIds.forEach((pid) => {
          if (pid !== sender.uid) {
            c.unreadCount[pid] = (c.unreadCount[pid] || 0) + 1;
          }
        });

        convs[idx] = c;
        safeSetItem(key, JSON.stringify(convs));
      }
    } catch {
      // ignore
    }
  });

  // 3. Persist to Firestore
  try {
    const msgDocRef = doc(db, 'conversations', conversationId, 'messages', msgId);
    await setDoc(msgDocRef, cleanFirestorePayload({
      ...newMessage,
      serverTime: serverTimestamp()
    }));

    // Update conversation doc
    const convDocRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convDocRef);

    if (convSnap.exists()) {
      const data = convSnap.data() as Conversation;
      const unreadCount = { ...(data.unreadCount || {}) };
      (data.participantIds || []).forEach((pid) => {
        if (pid !== sender.uid) {
          unreadCount[pid] = (unreadCount[pid] || 0) + 1;
        }
      });

      await updateDoc(convDocRef, cleanFirestorePayload({
        lastMessageText: trimmed,
        lastMessageTimestamp: timestampIso,
        lastMessageSenderId: sender.uid,
        unreadCount,
        updatedAt: timestampIso
      }));
    }
  } catch (err: any) {
    logMessagingDiagnostic('sendMessage.firestore', sender.uid, err);
    if (err?.code !== 'permission-denied') {
      console.warn('[messagingService] Firestore write failed, stored in local cache:', err);
    }
  }

  return newMessage;
}

/**
 * Mark all messages in a conversation as read by the current user
 */
export async function markConversationAsRead(
  conversationId: string,
  userId: string
): Promise<void> {
  if (!conversationId || !userId) return;

  // 1. Update local cache
  const localMsgs = getLocalMessages(conversationId);
  let changed = false;
  localMsgs.forEach((m) => {
    if (m.senderId !== userId && !m.read) {
      m.read = true;
      changed = true;
    }
  });
  if (changed) {
    saveLocalMessages(conversationId, localMsgs);
  }

  // Update conversation unreadCount locally
  const allUserKeys = safeGetStorageKeys().filter((k) =>
    k.startsWith(STORAGE_KEY_PREFIX_CONV)
  );

  allUserKeys.forEach((key) => {
    try {
      const convs = JSON.parse(safeGetItem(key) || '[]') as Conversation[];
      const idx = convs.findIndex((c) => c.id === conversationId);
      if (idx !== -1) {
        convs[idx].unreadCount[userId] = 0;
        safeSetItem(key, JSON.stringify(convs));
      }
    } catch {
      // ignore
    }
  });

  // 2. Persist to Firestore
  try {
    const convDocRef = doc(db, 'conversations', conversationId);
    const convSnap = await getDoc(convDocRef);
    if (convSnap.exists()) {
      const data = convSnap.data() as Conversation;
      const unreadCount = { ...(data.unreadCount || {}) };
      unreadCount[userId] = 0;
      await updateDoc(convDocRef, { unreadCount });
    }

    // Mark unread messages in subcollection
    const msgsRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(msgsRef, where('read', '==', false));
    const unreadSnaps = await getDocs(q);
    const updates = unreadSnaps.docs
      .filter((d) => d.data().senderId !== userId)
      .map((d) => updateDoc(d.ref, { read: true }));
    await Promise.all(updates);
  } catch (err: any) {
    logMessagingDiagnostic('markConversationAsRead.firestore', userId, err);
    if (err?.code !== 'permission-denied') {
      console.warn('[messagingService] markConversationAsRead Firestore sync failed:', err);
    }
  }
}

const inFlightConversationPromises = new Map<string, Promise<string>>();

/**
 * Find existing conversation between two users (optionally matching listing or booking),
 * or create a new conversation and return its ID.
 * 
 * Idempotent: Concurrent or repeated calls for the same guest, host, and listing/booking
 * return the identical conversation without creating duplicate records.
 */
export async function getOrCreateConversation(
  params: CreateConversationParams
): Promise<string> {
  const { currentUserId, otherUserId, listingId, bookingId } = params;
  const flightKey = `${currentUserId}_${otherUserId}_${listingId || 'general'}_${bookingId || 'none'}`;

  const existingFlight = inFlightConversationPromises.get(flightKey);
  if (existingFlight) {
    return existingFlight;
  }

  const promise = executeGetOrCreateConversation(params);
  inFlightConversationPromises.set(flightKey, promise);
  try {
    return await promise;
  } finally {
    inFlightConversationPromises.delete(flightKey);
  }
}

async function executeGetOrCreateConversation(
  params: CreateConversationParams
): Promise<string> {
  const {
    currentUserId,
    currentUser,
    otherUserId,
    otherUser,
    listingId,
    listingTitle,
    listingImage,
    listingCity,
    listingLocation,
    residenceType,
    bookingId,
    bookingRef,
    bookingDates,
    initialMessage
  } = params;

  // 1. Check local cache first — reuse existing conversation with this partner and context
  const localList = getLocalConversations(currentUserId);
  let existingLocal = localList.find((c) => {
    const hasBothUsers =
      c.participantIds.includes(currentUserId) && c.participantIds.includes(otherUserId);
    if (!hasBothUsers || !isLegitimateConversation(c)) return false;
    if (bookingId && c.bookingId === bookingId) return true;
    if (listingId && c.listingId === listingId) return true;
    return false;
  });

  // If no exact context match in cache, fallback to general conversation or historical conversation between these users
  if (!existingLocal) {
    existingLocal = localList.find((c) => {
      const hasBothUsers =
        c.participantIds.includes(currentUserId) && c.participantIds.includes(otherUserId);
      return hasBothUsers && isLegitimateConversation(c);
    });
  }

  if (existingLocal) {
    let modified = false;
    if (bookingId && existingLocal.bookingId !== bookingId) {
      existingLocal.bookingId = bookingId;
      if (bookingRef) existingLocal.bookingRef = bookingRef;
      if (listingTitle) existingLocal.listingTitle = listingTitle;
      if (listingId) existingLocal.listingId = listingId;
      modified = true;
    }
    if (modified) {
      saveLocalConversations(currentUserId, localList);
      try {
        updateDoc(doc(db, 'conversations', existingLocal.id), cleanFirestorePayload({
          bookingId: existingLocal.bookingId,
          bookingRef: existingLocal.bookingRef,
          listingTitle: existingLocal.listingTitle,
          listingId: existingLocal.listingId,
          updatedAt: new Date().toISOString()
        })).catch(() => {});
      } catch {
        // ignore
      }
    }
    if (initialMessage && initialMessage.trim()) {
      await sendMessage(
        existingLocal.id,
        {
          uid: currentUserId,
          displayName: currentUser.displayName,
          email: currentUser.email,
          photoURL: currentUser.photoURL,
          role: currentUser.role || 'guest'
        },
        initialMessage
      );
    }
    return existingLocal.id;
  }

  // 2. Deterministic Canonical ID Check
  const cleanPartA = currentUserId.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanPartB = otherUserId.replace(/[^a-zA-Z0-9_-]/g, '');
  const sortedParticipants = [cleanPartA, cleanPartB].sort().join('_');
  const contextKey = listingId
    ? `l_${listingId.replace(/[^a-zA-Z0-9_-]/g, '')}`
    : (bookingId ? `b_${bookingId.replace(/[^a-zA-Z0-9_-]/g, '')}` : 'general');
  const canonicalConvId = `conv_${sortedParticipants}_${contextKey}`;

  try {
    const canonicalSnap = await getDoc(doc(db, 'conversations', canonicalConvId));
    if (canonicalSnap.exists()) {
      const data = canonicalSnap.data() as Conversation;
      if (isLegitimateConversation(data)) {
        const userConvs = getLocalConversations(currentUserId);
        if (!userConvs.some((c) => c.id === canonicalConvId)) {
          userConvs.unshift({ ...data, id: canonicalConvId });
          saveLocalConversations(currentUserId, userConvs);
        }
        if (initialMessage && initialMessage.trim()) {
          await sendMessage(
            canonicalConvId,
            {
              uid: currentUserId,
              displayName: currentUser.displayName,
              email: currentUser.email,
              photoURL: currentUser.photoURL,
              role: currentUser.role || 'guest'
            },
            initialMessage
          );
        }
        return canonicalConvId;
      }
    }
  } catch (err: any) {
    logMessagingDiagnostic('getOrCreateConversation.canonicalCheck', currentUserId, err);
  }

  // 3. Query Firestore — find existing conversation between the two participants
  try {
    const convRef = collection(db, 'conversations');
    const q = query(
      convRef,
      where('participantIds', 'array-contains', currentUserId),
      limit(30)
    );
    const snap = await getDocs(q);

    let matchedDoc: any = null;
    for (const docSnap of snap.docs) {
      const data = docSnap.data() as Conversation;
      if (data.participantIds?.includes(otherUserId) && isLegitimateConversation(data)) {
        if (bookingId && data.bookingId === bookingId) {
          matchedDoc = docSnap;
          break;
        }
        if (listingId && data.listingId === listingId) {
          matchedDoc = docSnap;
          break;
        }
        if (!matchedDoc && !bookingId && !listingId) {
          matchedDoc = docSnap;
        }
      }
    }

    if (matchedDoc) {
      const data = matchedDoc.data() as Conversation;
      if (bookingId && data.bookingId !== bookingId) {
        try {
          await updateDoc(matchedDoc.ref, cleanFirestorePayload({
            bookingId,
            bookingRef: bookingRef || data.bookingRef,
            listingTitle: listingTitle || data.listingTitle,
            listingId: listingId || data.listingId,
            updatedAt: new Date().toISOString()
          }));
        } catch {
          // ignore
        }
      }
      const userConvs = getLocalConversations(currentUserId);
      if (!userConvs.some((c) => c.id === matchedDoc.id)) {
        userConvs.unshift({ ...data, id: matchedDoc.id });
        saveLocalConversations(currentUserId, userConvs);
      }
      if (initialMessage && initialMessage.trim()) {
        await sendMessage(
          matchedDoc.id,
          {
            uid: currentUserId,
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            role: currentUser.role || 'guest'
          },
          initialMessage
        );
      }
      return matchedDoc.id;
    }
  } catch (err: any) {
    logMessagingDiagnostic('getOrCreateConversation.lookup', currentUserId, err);
    // Explicit error handling: do not create duplicate records on transient network error
    if (err?.code === 'unavailable' || err?.code === 'deadline-exceeded') {
      const fallback = localList.find((c) => c.participantIds.includes(currentUserId) && c.participantIds.includes(otherUserId));
      if (fallback) return fallback.id;
      throw new Error(`Unable to reach messaging server (${err.code}). Please check your connection.`);
    }
  }

  // 4. Create new conversation under deterministic canonical ID
  const now = new Date();
  const timestampIso = now.toISOString();
  const convId = canonicalConvId;

  const isCurrentGuest = (currentUser.role || 'guest') !== 'host';
  const guestId = isCurrentGuest ? currentUserId : otherUserId;
  const guestName = isCurrentGuest ? currentUser.displayName : otherUser.displayName;
  const guestEmail = isCurrentGuest ? currentUser.email : otherUser.email;
  const guestPhotoURL = isCurrentGuest ? currentUser.photoURL : otherUser.photoURL;

  const hostId = isCurrentGuest ? otherUserId : currentUserId;
  const hostName = isCurrentGuest ? otherUser.displayName : currentUser.displayName;
  const hostEmail = isCurrentGuest ? otherUser.email : currentUser.email;
  const hostPhotoURL = isCurrentGuest ? otherUser.photoURL : currentUser.photoURL;

  const initialText = initialMessage?.trim() || `Inquiry regarding ${listingTitle || 'MozBook reservation'}`;

  const newConversation: Conversation = {
    id: convId,
    participantIds: [currentUserId, otherUserId],
    participants: {
      [currentUserId]: {
        uid: currentUserId,
        displayName: currentUser.displayName,
        email: currentUser.email,
        photoURL: currentUser.photoURL,
        role: currentUser.role || 'guest'
      },
      [otherUserId]: {
        uid: otherUserId,
        displayName: otherUser.displayName,
        email: otherUser.email,
        photoURL: otherUser.photoURL,
        role: otherUser.role || 'host'
      }
    },
    guestId,
    guestName,
    guestEmail,
    guestPhotoURL,
    hostId,
    hostName,
    hostEmail,
    hostPhotoURL,
    isHostVerified: otherUser.isHostVerified || false,
    listingId,
    listingTitle,
    listingImage,
    listingCity,
    listingLocation,
    residenceType,
    bookingId,
    bookingRef,
    bookingDates,
    lastMessageText: initialText,
    lastMessageTimestamp: timestampIso,
    lastMessageSenderId: currentUserId,
    unreadCount: {
      [currentUserId]: 0,
      [otherUserId]: 1
    },
    createdAt: timestampIso,
    updatedAt: timestampIso
  };

  // Save to local cache
  const userConvs = getLocalConversations(currentUserId);
  const existingIdx = userConvs.findIndex((c) => c.id === convId);
  if (existingIdx !== -1) {
    userConvs[existingIdx] = newConversation;
  } else {
    userConvs.unshift(newConversation);
  }
  saveLocalConversations(currentUserId, userConvs);

  const initialMsg: Message = {
    id: `msg_${now.getTime()}_${Math.random().toString(36).substring(2, 8)}`,
    conversationId: convId,
    senderId: currentUserId,
    senderName: currentUser.displayName,
    senderPhotoURL: currentUser.photoURL,
    senderRole: currentUser.role || 'guest',
    text: initialText,
    read: false,
    createdAt: timestampIso,
    timestampMs: now.getTime()
  };
  saveLocalMessages(convId, [initialMsg]);

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'conversations', convId), cleanFirestorePayload(newConversation));
    await setDoc(doc(db, 'conversations', convId, 'messages', initialMsg.id), cleanFirestorePayload(initialMsg));
  } catch (err) {
    console.warn('[messagingService] Firestore write failed for new conversation:', err);
  }

  return convId;
}

/**
 * Platform-Wide Session Isolation:
 * Wipes all cached conversation lists and message histories from localStorage.
 */
export function clearAllMessagingCache(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(STORAGE_KEY_PREFIX_CONV) || k.startsWith(STORAGE_KEY_PREFIX_MSGS))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn('[messagingService] Error clearing messaging caches:', e);
  }
}

