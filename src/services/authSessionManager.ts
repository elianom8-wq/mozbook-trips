/**
 * MozBook Central Authentication Lifecycle & Session Isolation Engine
 * 
 * Enforces the MozBook Platform-Wide Rule:
 * 1. Whenever a user signs out and another user signs in, MozBook establishes a completely separate authenticated session.
 * 2. Never carries the previous user's active page, unfinished workflow, account-specific state, or private data into the new user's session.
 * 3. After successful login or account switch, authoritatively navigates to the main Discover page (/discover).
 * 4. Does not automatically reopen a previous user's booking, host listing, onboarding wizard, checkout, Travel Companion group, or any other unfinished workflow.
 * 5. Users may resume their own saved progress only when they deliberately and explicitly choose to do so.
 * 6. Same authenticated user refreshing or returning in the same tab preserves their legitimate active session and route.
 */

export const ACTIVE_SESSION_UID_KEY = 'mozbook_active_session_uid';
export const FRESH_AUTH_EVENT_KEY = 'mozbook_fresh_auth_transition';

export type SessionTransitionType = 
  | 'same_session'      // Same user refreshing/continuing legitimate active session
  | 'new_login'         // Fresh login from unauthenticated state
  | 'account_switch'    // Different user signed in than previous session
  | 'logged_out';       // User signed out

// Registry for subscription terminators across services
const activeSubscriptionCleanups = new Set<() => void>();

/**
 * Register an active real-time subscription (e.g. Firestore onSnapshot)
 * to be automatically torn down whenever the session terminates or switches.
 */
export function registerSessionSubscription(cleanup: () => void): () => void {
  activeSubscriptionCleanups.add(cleanup);
  return () => {
    activeSubscriptionCleanups.delete(cleanup);
  };
}

/**
 * Terminates all active background listeners and asynchronous subscriptions.
 */
export function terminateAllSessionSubscriptions(): void {
  activeSubscriptionCleanups.forEach((cleanup) => {
    try {
      cleanup();
    } catch (err) {
      console.warn('[SessionManager] Error executing subscription cleanup:', err);
    }
  });
  activeSubscriptionCleanups.clear();
}

/**
 * Authoritatively cleans and purges all user-specific in-memory caches,
 * localStorage records, pending drafts, and session storage on logout or account switch.
 * Does NOT delete device-level preferences (like device permissions).
 */
export function purgeAllUserSessionData(): void {
  // 1. Terminate all active Firestore real-time listeners & subscriptions
  terminateAllSessionSubscriptions();

  // 2. Clear sessionStorage completely
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  } catch (err) {
    console.warn('[SessionManager] sessionStorage clear error:', err);
  }

  // 3. Purge all user-specific and workflow-specific caches in localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;

        // User private data & caching prefixes
        if (
          key.startsWith('mozbook_conversations_') ||
          key.startsWith('mozbook_messages_') ||
          key.startsWith('mozbook_stay_bookings') ||
          key.startsWith('mozbook_activity_bookings') ||
          key.startsWith('mozbook_operator_inventory_debits') ||
          key.startsWith('mozbook_travel_groups') ||
          key.startsWith('mozbook_group_members') ||
          key.startsWith('mozbook_group_invitations') ||
          key.startsWith('mozbook_group_bookings') ||
          key.startsWith('mozbook_admin_audit_logs_cache') ||
          key.startsWith('mozbook_pending_') ||
          key.startsWith('mozbook_active_group') ||
          key.startsWith('mozbook_user_')
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  } catch (err) {
    console.warn('[SessionManager] localStorage purge error:', err);
  }
}

/**
 * Evaluates the transition between the current Firebase Auth user and the previous session.
 * Detects whether this is the same user refreshing, a fresh login, or an account switch.
 */
export function evaluateSessionTransition(currentUid: string | null): {
  type: SessionTransitionType;
  previousUid: string | null;
  currentUid: string | null;
} {
  let previousUid: string | null = null;
  try {
    if (typeof sessionStorage !== 'undefined') {
      previousUid = sessionStorage.getItem(ACTIVE_SESSION_UID_KEY);
    }
  } catch {}

  if (!currentUid) {
    return {
      type: 'logged_out',
      previousUid,
      currentUid: null
    };
  }

  if (previousUid && previousUid === currentUid) {
    // Same user continuing in the same session tab (e.g. page refresh)
    return {
      type: 'same_session',
      previousUid,
      currentUid
    };
  }

  if (previousUid && previousUid !== currentUid) {
    // Different account signed in -> Account Switch
    return {
      type: 'account_switch',
      previousUid,
      currentUid
    };
  }

  // previousUid was null or not set -> Fresh Login
  return {
    type: 'new_login',
    previousUid: null,
    currentUid
  };
}

/**
 * Commits the current authenticated UID to session tracking.
 */
export function commitActiveSessionUid(uid: string | null): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (uid) {
        sessionStorage.setItem(ACTIVE_SESSION_UID_KEY, uid);
      } else {
        sessionStorage.removeItem(ACTIVE_SESSION_UID_KEY);
      }
    }
  } catch {}
}

/**
 * Marks that an explicit fresh auth transition has occurred,
 * requiring navigation to /discover.
 */
export function setFreshAuthNavigationPending(): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(FRESH_AUTH_EVENT_KEY, 'true');
    }
  } catch {}
}

/**
 * Checks and clears the pending fresh auth navigation flag.
 */
export function consumeFreshAuthNavigationPending(): boolean {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const isPending = sessionStorage.getItem(FRESH_AUTH_EVENT_KEY) === 'true';
      if (isPending) {
        sessionStorage.removeItem(FRESH_AUTH_EVENT_KEY);
        return true;
      }
    }
  } catch {}
  return false;
}

// -------------------------------------------------------------
// User-Scoped Resumable Draft Management (Requirement 1 & 5)
// -------------------------------------------------------------

/**
 * Saves a user-specific workflow draft bound strictly to their authenticated Firebase UID.
 * Ensures no other user can ever view, inherit, or auto-reopen this draft.
 */
export function saveUserScopedDraft<T>(uid: string, workflowId: string, data: T): void {
  if (!uid || !workflowId) return;
  try {
    if (typeof localStorage !== 'undefined') {
      const key = `mozbook_draft_${uid}_${workflowId}`;
      const record = {
        uid,
        workflowId,
        savedAt: new Date().toISOString(),
        payload: data
      };
      localStorage.setItem(key, JSON.stringify(record));
    }
  } catch (err) {
    console.warn('[SessionManager] Could not save user draft:', err);
  }
}

/**
 * Retrieves a user-specific draft only if the requesting user matches the owning UID.
 */
export function getUserScopedDraft<T>(uid: string, workflowId: string): T | null {
  if (!uid || !workflowId) return null;
  try {
    if (typeof localStorage !== 'undefined') {
      const key = `mozbook_draft_${uid}_${workflowId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const record = JSON.parse(raw);
      if (record && record.uid === uid) {
        return record.payload as T;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Clears a specific user-scoped draft upon successful completion or deliberate dismissal.
 */
export function clearUserScopedDraft(uid: string, workflowId: string): void {
  if (!uid || !workflowId) return;
  try {
    if (typeof localStorage !== 'undefined') {
      const key = `mozbook_draft_${uid}_${workflowId}`;
      localStorage.removeItem(key);
    }
  } catch {}
}
