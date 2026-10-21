import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACTIVE_SESSION_UID_KEY,
  FRESH_AUTH_EVENT_KEY,
  evaluateSessionTransition,
  commitActiveSessionUid,
  setFreshAuthNavigationPending,
  consumeFreshAuthNavigationPending,
  purgeAllUserSessionData,
  registerSessionSubscription,
  terminateAllSessionSubscriptions,
  saveUserScopedDraft,
  getUserScopedDraft,
  clearUserScopedDraft
} from '../../src/services/authSessionManager';

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

// Assign global mock storage
const mockSessionStorage = createMockStorage();
const mockLocalStorage = createMockStorage();

// @ts-ignore
globalThis.sessionStorage = mockSessionStorage;
// @ts-ignore
globalThis.localStorage = mockLocalStorage;

describe('MozBook Platform-Wide Rule: Universal Account Isolation, Session Reset & Navigation', () => {
  beforeEach(() => {
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    terminateAllSessionSubscriptions();
    vi.clearAllMocks();
  });

  describe('1. Universal Account-Switching & Fresh Login Rule', () => {
    it('evaluates fresh login from unauthenticated state to new_login and sets fresh auth pending', () => {
      // Initially, no session stored
      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBeNull();

      const transition = evaluateSessionTransition('guest_user_123');
      expect(transition.type).toBe('new_login');
      expect(transition.previousUid).toBeNull();
      expect(transition.currentUid).toBe('guest_user_123');

      // Commit and flag fresh navigation
      commitActiveSessionUid('guest_user_123');
      setFreshAuthNavigationPending();

      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBe('guest_user_123');
      expect(sessionStorage.getItem(FRESH_AUTH_EVENT_KEY)).toBe('true');

      // Consuming fresh auth navigation pending should return true and clear the flag
      const shouldRedirectToDiscover = consumeFreshAuthNavigationPending();
      expect(shouldRedirectToDiscover).toBe(true);
      expect(sessionStorage.getItem(FRESH_AUTH_EVENT_KEY)).toBeNull();

      // Subsequent consumption is false
      expect(consumeFreshAuthNavigationPending()).toBe(false);
    });

    it('evaluates account switch between different users and isolates session state', () => {
      // User A was previously active
      commitActiveSessionUid('host_user_alfredo');
      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBe('host_user_alfredo');

      // User B signs in
      const transition = evaluateSessionTransition('guest_user_maria');
      expect(transition.type).toBe('account_switch');
      expect(transition.previousUid).toBe('host_user_alfredo');
      expect(transition.currentUid).toBe('guest_user_maria');

      // Purge and commit User B
      purgeAllUserSessionData();
      commitActiveSessionUid('guest_user_maria');
      setFreshAuthNavigationPending();

      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBe('guest_user_maria');
      expect(consumeFreshAuthNavigationPending()).toBe(true);
    });

    it('evaluates same authenticated user refreshing or continuing as same_session without forced reset', () => {
      // User A is active
      commitActiveSessionUid('user_regular_traveler');

      // User A refreshes the page
      const transition = evaluateSessionTransition('user_regular_traveler');
      expect(transition.type).toBe('same_session');
      expect(transition.previousUid).toBe('user_regular_traveler');
      expect(transition.currentUid).toBe('user_regular_traveler');

      // Fresh auth navigation flag should NOT be set on refresh
      expect(consumeFreshAuthNavigationPending()).toBe(false);
    });

    it('evaluates sign-out as logged_out and purges stored session uid', () => {
      commitActiveSessionUid('user_logging_out');

      const transition = evaluateSessionTransition(null);
      expect(transition.type).toBe('logged_out');
      expect(transition.previousUid).toBe('user_logging_out');
      expect(transition.currentUid).toBeNull();

      commitActiveSessionUid(null);
      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBeNull();
    });
  });

  describe('2. Comprehensive Cache & Private State Purge Across Modules', () => {
    it('purges all user-specific data from localStorage and sessionStorage on purgeAllUserSessionData', () => {
      // Seed user-specific items across multiple modules
      localStorage.setItem('mozbook_conversations_user1', JSON.stringify([{ id: 'c1' }]));
      localStorage.setItem('mozbook_messages_conv1', JSON.stringify([{ text: 'secret' }]));
      localStorage.setItem('mozbook_stay_bookings_cache', JSON.stringify([{ id: 'b1' }]));
      localStorage.setItem('mozbook_travel_groups_user1', JSON.stringify([{ id: 'g1' }]));
      localStorage.setItem('mozbook_pending_checkout', JSON.stringify({ listingId: 'stay_1' }));
      localStorage.setItem('mozbook_active_group_session', JSON.stringify({ groupId: 'grp_99' }));
      sessionStorage.setItem('mozbook_active_workflow', 'checkout_step_3');

      // Non-user preference that should be kept
      localStorage.setItem('mozbook_theme_preference', 'dark');

      purgeAllUserSessionData();

      // All sensitive session caches and temporary states are wiped
      expect(localStorage.getItem('mozbook_conversations_user1')).toBeNull();
      expect(localStorage.getItem('mozbook_messages_conv1')).toBeNull();
      expect(localStorage.getItem('mozbook_stay_bookings_cache')).toBeNull();
      expect(localStorage.getItem('mozbook_travel_groups_user1')).toBeNull();
      expect(localStorage.getItem('mozbook_admin_audit_logs_cache')).toBeNull();
      expect(localStorage.getItem('mozbook_pending_checkout')).toBeNull();
      expect(localStorage.getItem('mozbook_active_group_session')).toBeNull();
      expect(sessionStorage.getItem('mozbook_active_workflow')).toBeNull();

      // Non-user preference is preserved
      expect(localStorage.getItem('mozbook_theme_preference')).toBe('dark');
    });
  });

  describe('3. User-Scoped Resumable Drafts (Explicit Ownership Verification)', () => {
    it('saves draft bound to Firebase UID and prevents other users from accessing it', () => {
      const userAUid = 'host_alice_777';
      const userBUid = 'host_bob_888';
      const listingDraft = { title: 'Ponta Beach Cottage', price: 15000, step: 3 };

      // Alice saves her in-progress listing draft
      saveUserScopedDraft(userAUid, 'onboarding_wizard', listingDraft);

      // Alice can retrieve her draft
      const aliceDraft = getUserScopedDraft<typeof listingDraft>(userAUid, 'onboarding_wizard');
      expect(aliceDraft).toEqual(listingDraft);

      // Bob attempts to retrieve Alice's draft -> strictly returns null
      const bobAttempt = getUserScopedDraft<typeof listingDraft>(userBUid, 'onboarding_wizard');
      expect(bobAttempt).toBeNull();
    });

    it('clears user-scoped draft upon completion or explicit cancellation', () => {
      const uid = 'traveler_carol_999';
      saveUserScopedDraft(uid, 'group_invite_creation', { groupName: 'Inhaca Expedition' });

      expect(getUserScopedDraft(uid, 'group_invite_creation')).not.toBeNull();

      clearUserScopedDraft(uid, 'group_invite_creation');
      expect(getUserScopedDraft(uid, 'group_invite_creation')).toBeNull();
    });

    it('preserves user-scoped draft across sign-out purge so owner can resume upon re-authenticating', () => {
      const aliceUid = 'host_alice_777';
      const bobUid = 'host_bob_888';
      const draft = { title: 'Tofo Bay Beach Villa', price: 4500 };

      // Alice saves draft
      saveUserScopedDraft(aliceUid, 'stay_listing_draft', draft);

      // Session ends (purgeAllUserSessionData called on logout)
      purgeAllUserSessionData();

      // Alice's draft is preserved in storage
      const aliceRestored = getUserScopedDraft(aliceUid, 'stay_listing_draft');
      expect(aliceRestored).toEqual(draft);

      // Bob signs in and cannot access Alice's draft
      const bobAttempt = getUserScopedDraft(bobUid, 'stay_listing_draft');
      expect(bobAttempt).toBeNull();
    });
  });

  describe('4. Active Real-Time Subscription Invalidation', () => {
    it('registers and executes subscription cleanup callbacks upon session termination', () => {
      const cleanupMock1 = vi.fn();
      const cleanupMock2 = vi.fn();

      const unregister1 = registerSessionSubscription(cleanupMock1);
      registerSessionSubscription(cleanupMock2);

      expect(cleanupMock1).not.toHaveBeenCalled();
      expect(cleanupMock2).not.toHaveBeenCalled();

      // Invalidate all subscriptions on session end
      terminateAllSessionSubscriptions();

      expect(cleanupMock1).toHaveBeenCalledTimes(1);
      expect(cleanupMock2).toHaveBeenCalledTimes(1);

      // Subsequent termination does not re-call cleared cleanups
      terminateAllSessionSubscriptions();
      expect(cleanupMock1).toHaveBeenCalledTimes(1);
    });

    it('allows clean unregistration before session terminates', () => {
      const cleanupMock = vi.fn();
      const unregister = registerSessionSubscription(cleanupMock);

      // Component unmounts naturally before session switch
      unregister();

      terminateAllSessionSubscriptions();
      expect(cleanupMock).not.toHaveBeenCalled();
    });
  });

  describe('5. Role Isolation & Prevention of Privilege Inheritance', () => {
    it('ensures admin credentials or audit cache are never inherited by ordinary users', () => {
      // Simulate Admin session
      localStorage.setItem('mozbook_admin_audit_logs_cache', JSON.stringify([{ action: 'SUSPEND_HOST' }]));
      sessionStorage.setItem(ACTIVE_SESSION_UID_KEY, 'admin_super_user');

      // Admin logs out -> purge
      purgeAllUserSessionData();
      commitActiveSessionUid(null);

      expect(localStorage.getItem('mozbook_admin_audit_logs_cache')).toBeNull();
      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBeNull();

      // Guest logs in
      const guestTransition = evaluateSessionTransition('ordinary_guest_user');
      expect(guestTransition.type).toBe('new_login');
      expect(localStorage.getItem('mozbook_admin_audit_logs_cache')).toBeNull();
    });
  });
});
