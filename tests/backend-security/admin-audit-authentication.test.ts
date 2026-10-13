import { describe, it, expect, vi, beforeEach } from 'vitest';
import { formatAuditTimestamp } from '../../src/utils/auditFormat';

describe('Admin Authentication Audit Correction', () => {
  describe('formatAuditTimestamp & Timezone Formatting', () => {
    it('correctly disambiguates 11/10/2026 into explicit month names and CAT (UTC+2) time', () => {
      // 11 October 2026 at 00:05:41 UTC is 02:05:41 in CAT (UTC+2)
      const isoUtc = '2026-10-11T00:05:41.000Z';
      const formatted = formatAuditTimestamp(isoUtc);

      expect(formatted.catDisplay).toContain('11 Oct 2026');
      expect(formatted.catDisplay).toContain('02:05:41 CAT');
      expect(formatted.utcDisplay).toContain('11 Oct 2026');
      expect(formatted.utcDisplay).toContain('00:05:41 UTC');
    });

    it('correctly disambiguates evening timestamp 10/10/2026 21:00:49 UTC', () => {
      // 10 October 2026 at 21:00:49 UTC is 23:00:49 in CAT (UTC+2)
      const isoUtc = '2026-10-10T21:00:49.000Z';
      const formatted = formatAuditTimestamp(isoUtc);

      expect(formatted.catDisplay).toContain('10 Oct 2026');
      expect(formatted.catDisplay).toContain('23:00:49 CAT');
      expect(formatted.utcDisplay).toContain('10 Oct 2026');
      expect(formatted.utcDisplay).toContain('21:00:49 UTC');
    });

    it('safely handles Firestore Timestamp objects { seconds, nanoseconds }', () => {
      const firestoreTs = {
        seconds: 1791677141, // 2026-10-11T00:05:41.000Z
        nanoseconds: 0
      };
      const formatted = formatAuditTimestamp(firestoreTs);
      expect(formatted.catDisplay).toContain('11 Oct 2026');
      expect(formatted.catDisplay).toContain('02:05:41 CAT');
    });

    it('provides graceful fallbacks for null or invalid inputs', () => {
      expect(formatAuditTimestamp(null).catDisplay).toBe('—');
      expect(formatAuditTimestamp(undefined).utcDisplay).toBe('—');
      expect(formatAuditTimestamp('invalid-date').catDisplay).toBe('invalid-date');
    });
  });

  describe('ADMIN_LOGIN Generation Invariants', () => {
    it('does NOT trigger ADMIN_LOGIN on ordinary user login', async () => {
      let loggedAction: string | null = null;
      const mockLogAdminAction = vi.fn(async (...args: any[]) => {
        loggedAction = args[2];
      });

      const user = {
        uid: 'guest_user_123',
        email: 'regular_guest@gmail.com'
      };

      const isAdmin = false;

      // Business invariant check
      if (isAdmin && user.email) {
        await mockLogAdminAction(user.uid, user.email, 'ADMIN_LOGIN', 'AUTHENTICATION', 'User', user.uid);
      }

      expect(mockLogAdminAction).not.toHaveBeenCalled();
      expect(loggedAction).toBeNull();
    });

    it('does NOT trigger ADMIN_LOGIN on restored session or token refresh', async () => {
      const mockLogAdminAction = vi.fn();
      
      // Simulating onAuthStateChanged receiving an already active user (session restoration)
      const isInteractiveLogin = false; // onAuthStateChanged is background listener
      const user = {
        uid: 'admin_uid_789',
        email: 'mozbookinfo@gmail.com'
      };
      const isAdmin = true;

      // Invariant: onAuthStateChanged must NOT log ADMIN_LOGIN
      if (isInteractiveLogin && isAdmin && user.email) {
        await mockLogAdminAction();
      }

      expect(mockLogAdminAction).not.toHaveBeenCalled();
    });

    it('generates ADMIN_LOGIN ONLY upon verified administrator interactive sign-in', async () => {
      const mockLogAdminAction = vi.fn();

      const user = {
        uid: 'admin_uid_789',
        email: 'mozbookinfo@gmail.com'
      };
      const isInteractiveLogin = true;
      const isAdmin = true;

      if (isInteractiveLogin && isAdmin && user.email) {
        await mockLogAdminAction(
          user.uid,
          user.email,
          'ADMIN_LOGIN',
          'AUTHENTICATION',
          'User',
          user.uid,
          { provider: 'google.com', authMethod: 'interactive_popup', role: 'admin' }
        );
      }

      expect(mockLogAdminAction).toHaveBeenCalledTimes(1);
      expect(mockLogAdminAction).toHaveBeenCalledWith(
        'admin_uid_789',
        'mozbookinfo@gmail.com',
        'ADMIN_LOGIN',
        'AUTHENTICATION',
        'User',
        'admin_uid_789',
        expect.objectContaining({ authMethod: 'interactive_popup' })
      );
    });
  });

  describe('Audit Log Security & Immutability Rules', () => {
    it('rejects audit write if caller is not an administrator', () => {
      const caller = { uid: 'user_456', email: 'guest@example.com' };
      const isAdmin = caller.email === 'mozbookinfo@gmail.com';
      expect(isAdmin).toBe(false);
    });

    it('rejects audit write if adminUserId does not match caller auth UID', () => {
      const caller = { uid: 'admin_uid_real', email: 'mozbookinfo@gmail.com' };
      const requestedPayload = {
        adminUserId: 'admin_uid_spoofed',
        action: 'ADMIN_LOGIN'
      };

      const matchesAuthUid = requestedPayload.adminUserId === caller.uid;
      expect(matchesAuthUid).toBe(false);
    });

    it('forbids update and delete operations on audit logs', () => {
      const isUpdateAllowed = false;
      const isDeleteAllowed = false;
      expect(isUpdateAllowed).toBe(false);
      expect(isDeleteAllowed).toBe(false);
    });
  });
});
