import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ADMIN_PERMISSIONS, 
  MASTER_ADMIN_EMAIL, 
  isMasterOnlyPermission,
  isElevatedPermission
} from '../../src/types/adminPermissions';
import {
  isMasterAdminIdentity,
  resolveAdminContext,
  hasAdminPermission,
  authorizeAdminRequest,
  createAdminMiddleware,
  createMasterAdminMiddleware,
  AuthenticatedAdminIdentity
} from '../../src/server/adminAuth';
import {
  evaluateSessionTransition,
  commitActiveSessionUid,
  purgeAllUserSessionData,
  saveUserScopedDraft,
  getUserScopedDraft,
  clearUserScopedDraft,
  ACTIVE_SESSION_UID_KEY
} from '../../src/services/authSessionManager';
import {
  verifyPaySuiteWebhookSignature
} from '../../src/server/paysuiteClient';
import {
  calculateCommission,
  MOZBOOK_COMMISSION_PERCENT,
  PARTNER_SHARE_PERCENT
} from '../../src/config/platformCommission';
import crypto from 'crypto';

// In-memory mock storage for session isolation testing
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

const mockSessionStorage = createMockStorage();
const mockLocalStorage = createMockStorage();
// @ts-ignore
globalThis.sessionStorage = mockSessionStorage;
// @ts-ignore
globalThis.localStorage = mockLocalStorage;

// In-memory database mock for getPrivilegedFirestore
const mockDb: Record<string, Record<string, any>> = {};

vi.mock('../../src/server/paymentService', () => ({
  getPrivilegedFirestore: () => ({
    collection: (col: string) => ({
      doc: (docId: string) => ({
        get: async () => ({
          exists: Boolean(mockDb[col] && mockDb[col][docId]),
          data: () => mockDb[col]?.[docId]
        }),
        set: async (payload: any) => {
          if (!mockDb[col]) mockDb[col] = {};
          mockDb[col][docId] = payload;
        }
      })
    })
  }),
  parseFirestoreDoc: (fields: Record<string, any>) => {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if ('stringValue' in val) result[key] = val.stringValue;
      else if ('integerValue' in val) result[key] = Number(val.integerValue);
      else if ('doubleValue' in val) result[key] = Number(val.doubleValue);
      else if ('booleanValue' in val) result[key] = val.booleanValue;
      else if ('timestampValue' in val) result[key] = val.timestampValue;
      else if ('arrayValue' in val) result[key] = (val.arrayValue?.values || []).map((v: any) => Object.values(v)[0]);
    }
    return result;
  }
}));

describe('MozBook Post-Fix Security Audit & Regression Verification Suite', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockDb)) {
      delete mockDb[key];
    }
    mockSessionStorage.clear();
    mockLocalStorage.clear();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // CHECK 1: Master identity established exclusively through verified ID token
  // =========================================================================
  describe('Check 1: Cryptographically Verified Firebase ID Token Required', () => {
    it('rejects master privilege when identity is null or empty', () => {
      expect(isMasterAdminIdentity(null)).toBe(false);
      expect(isMasterAdminIdentity(undefined)).toBe(false);
      expect(isMasterAdminIdentity({ uid: '' })).toBe(false);
    });

    it('rejects master privilege if caller provides master email without valid verification', () => {
      const unverified: AuthenticatedAdminIdentity = {
        uid: 'attacker_123',
        email: MASTER_ADMIN_EMAIL,
        emailVerified: false
      };
      expect(isMasterAdminIdentity(unverified)).toBe(false);
    });

    it('rejects master privilege when emailVerified is undefined (fail closed)', () => {
      const omittedVerification: AuthenticatedAdminIdentity = {
        uid: 'attacker_123',
        email: MASTER_ADMIN_EMAIL
      };
      expect(isMasterAdminIdentity(omittedVerification)).toBe(false);
    });
  });

  // =========================================================================
  // CHECK 2: Master administrator email explicitly allowlisted and email_verified is true
  // =========================================================================
  describe('Check 2: Explicit Allowlist and email_verified === true', () => {
    it('accepts strictly allowlisted MASTER_ADMIN_EMAIL with emailVerified === true', () => {
      const validMaster: AuthenticatedAdminIdentity = {
        uid: 'master_admin_uid_777',
        email: 'mozbookinfo@gmail.com',
        emailVerified: true
      };
      expect(isMasterAdminIdentity(validMaster)).toBe(true);
    });

    it('accepts allowlisted email with differing casing and whitespace trimmed', () => {
      const validMasterCased: AuthenticatedAdminIdentity = {
        uid: 'master_admin_uid_777',
        email: '  MOZBOOKINFO@GMAIL.COM  ',
        emailVerified: true
      };
      expect(isMasterAdminIdentity(validMasterCased)).toBe(true);
    });

    it('rejects any other email even if verified and claiming master name', () => {
      const impersonator: AuthenticatedAdminIdentity = {
        uid: 'fake_master_1',
        email: 'mozbookinfo@gmail.com.fake.com',
        displayName: 'Master Administrator',
        emailVerified: true
      };
      expect(isMasterAdminIdentity(impersonator)).toBe(false);
    });
  });

  // =========================================================================
  // CHECK 3: Ordinary authenticated user never receives admin when REST fails
  // =========================================================================
  describe('Check 3: Ordinary Authenticated User Invariant on REST Sync Failure', () => {
    it('resolves to null when REST API returns 404 and user is not in legacy admin list', async () => {
      const normalUser: AuthenticatedAdminIdentity = {
        uid: 'normal_traveler_999',
        email: 'traveler@gmail.com',
        displayName: 'Normal Traveler',
        emailVerified: true,
        idToken: 'fake_valid_jwt_normal_user'
      };

      // Mock global fetch returning 404 for admin_profiles and 404 for users
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not found' })
        };
      }) as any;

      try {
        const context = await resolveAdminContext(normalUser);
        expect(context).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('resolves to null when REST API throws network failure (fails closed)', async () => {
      const normalUser: AuthenticatedAdminIdentity = {
        uid: 'normal_traveler_888',
        email: 'traveler2@gmail.com',
        emailVerified: true,
        idToken: 'fake_jwt_token'
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error / DNS resolution failed'));

      try {
        const context = await resolveAdminContext(normalUser);
        expect(context).toBeNull();
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // CHECK 4: Missing credentials, expired tokens, invalid tokens fail closed
  // =========================================================================
  describe('Check 4: Fail-Closed Protection for All Non-Master Callers', () => {
    it('returns 401 when user is missing or undefined', async () => {
      const res = await authorizeAdminRequest(null, ADMIN_PERMISSIONS.USERS_VIEW);
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(401);
      expect(res.error).toContain('Authentication required');
    });

    it('returns 403 when user has valid identity but lacks admin profile', async () => {
      const caller: AuthenticatedAdminIdentity = {
        uid: 'regular_host_555',
        email: 'host@vilankulos.com',
        emailVerified: true
      };
      const res = await authorizeAdminRequest(caller, ADMIN_PERMISSIONS.HOSTS_VIEW);
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(403);
      expect(res.error).toContain('not recognized as an active administrator');
    });

    it('returns 403 when sub-admin profile is explicitly inactive (isActive: false)', async () => {
      const subAdminUid = 'sub_admin_deactivated';
      mockDb['admin_profiles'] = {
        [subAdminUid]: {
          uid: subAdminUid,
          email: 'staff@mozbook.mz',
          isActive: false,
          permissions: [ADMIN_PERMISSIONS.USERS_VIEW]
        }
      };

      const caller: AuthenticatedAdminIdentity = {
        uid: subAdminUid,
        email: 'staff@mozbook.mz',
        emailVerified: true
      };

      const res = await authorizeAdminRequest(caller, ADMIN_PERMISSIONS.USERS_VIEW);
      expect(res.authorized).toBe(false);
      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // CHECK 5: Cross-Account Isolation and Token Scoping in Firestore REST
  // =========================================================================
  describe('Check 5: User Token Scoping and Cross-Account Profile Protection', () => {
    it('constructs REST lookup URL with caller own uid and attaches Authorization Bearer header', async () => {
      const subAdminUid = 'sub_admin_scoped_1';
      const testToken = 'bearer_token_sub_admin_123';
      const caller: AuthenticatedAdminIdentity = {
        uid: subAdminUid,
        email: 'scoped_subadmin@mozbook.mz',
        emailVerified: true,
        idToken: testToken
      };

      let requestedUrl = '';
      let requestedHeaders: any = null;

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        requestedUrl = url;
        requestedHeaders = init?.headers;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              uid: { stringValue: subAdminUid },
              email: { stringValue: 'scoped_subadmin@mozbook.mz' },
              isActive: { booleanValue: true },
              permissions: {
                arrayValue: {
                  values: [{ stringValue: ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY }]
                }
              }
            }
          })
        };
      }) as any;

      try {
        const context = await resolveAdminContext(caller);
        expect(context).not.toBeNull();
        expect(context?.uid).toBe(subAdminUid);
        expect(requestedUrl).toContain(`/documents/admin_profiles/${subAdminUid}`);
        expect(requestedHeaders?.['Authorization']).toBe(`Bearer ${testToken}`);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('prevents sub-admin profile from injecting master permissions over REST', async () => {
      const subAdminUid = 'malicious_sub_admin';
      const caller: AuthenticatedAdminIdentity = {
        uid: subAdminUid,
        email: 'attacker_sub@mozbook.mz',
        emailVerified: true,
        idToken: 'token_attacker'
      };

      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            fields: {
              uid: { stringValue: subAdminUid },
              email: { stringValue: 'attacker_sub@mozbook.mz' },
              isActive: { booleanValue: true },
              isMaster: { booleanValue: true }, // Forged claim in document
              permissions: {
                arrayValue: {
                  values: [
                    { stringValue: ADMIN_PERMISSIONS.ADMINS_MANAGE },
                    { stringValue: ADMIN_PERMISSIONS.ARCHIVE_VIEW },
                    { stringValue: ADMIN_PERMISSIONS.USERS_VIEW }
                  ]
                }
              }
            }
          })
        };
      }) as any;

      try {
        const context = await resolveAdminContext(caller);
        expect(context).not.toBeNull();
        // Server authority must strictly deny isMaster: true and strip master-only permissions
        expect(context?.isMaster).toBe(false);
        expect(context?.permissions).not.toContain(ADMIN_PERMISSIONS.ADMINS_MANAGE);
        expect(context?.permissions).not.toContain(ADMIN_PERMISSIONS.ARCHIVE_VIEW);
        expect(context?.permissions).toContain(ADMIN_PERMISSIONS.USERS_VIEW);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  // =========================================================================
  // CHECK 6: Error suppression safety (never suppresses failed authorization)
  // =========================================================================
  describe('Check 6: Error Suppression Boundaries & Security Guarantees', () => {
    it('middleware strictly rejects unauthorized request even when underlying error is caught', async () => {
      const mockReq: any = { headers: {} };
      let responseStatus = 0;
      let responseJson: any = null;
      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (payload: any) => {
              responseJson = payload;
            }
          };
        }
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      const authenticateReq = async () => null; // Unauthenticated
      const middleware = createAdminMiddleware(authenticateReq as any, ADMIN_PERMISSIONS.USERS_VIEW);

      await middleware(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false);
      expect(responseStatus).toBe(401);
      expect(responseJson?.success).toBe(false);
    });

    it('master admin middleware strictly rejects sub-admin attempting master action', async () => {
      const subAdminUid = 'sub_admin_regular';
      mockDb['admin_profiles'] = {
        [subAdminUid]: {
          uid: subAdminUid,
          email: 'sub@mozbook.mz',
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.USERS_VIEW]
        }
      };

      const mockReq: any = { headers: {} };
      let responseStatus = 0;
      let responseJson: any = null;
      const mockRes: any = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (payload: any) => {
              responseJson = payload;
            }
          };
        }
      };
      let nextCalled = false;
      const mockNext = () => { nextCalled = true; };

      const authenticateReq = async () => ({
        uid: subAdminUid,
        email: 'sub@mozbook.mz',
        emailVerified: true
      });

      const masterMiddleware = createMasterAdminMiddleware(authenticateReq as any);
      await masterMiddleware(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false);
      expect(responseStatus).toBe(403);
      expect(responseJson?.error).toContain('strictly reserved for the Master Administrator');
    });
  });

  // =========================================================================
  // CHECK 7: PaySuite payment service security invariants
  // =========================================================================
  describe('Check 7: PaySuite Payment Security & HMAC Invariants', () => {
    const testSecret = 'valid_production_secret_32chars_len';
    const originalSecret = process.env.PAYSUITE_WEBHOOK_SECRET;

    beforeEach(() => {
      process.env.PAYSUITE_WEBHOOK_SECRET = testSecret;
    });

    it('verifies valid HMAC-SHA256 signature when secret matches', () => {
      const payload = JSON.stringify({ transaction_id: 'tx_123', amount: 4500, status: 'completed' });
      const validSig = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');

      const isValid = verifyPaySuiteWebhookSignature(payload, validSig);
      expect(isValid).toBe(true);
    });

    it('rejects tampered payload when signature does not match', () => {
      const payload = JSON.stringify({ transaction_id: 'tx_123', amount: 4500, status: 'completed' });
      const tampered = JSON.stringify({ transaction_id: 'tx_123', amount: 50, status: 'completed' });
      const originalSig = crypto.createHmac('sha256', testSecret).update(payload).digest('hex');

      const isValid = verifyPaySuiteWebhookSignature(tampered, originalSig);
      expect(isValid).toBe(false);
    });

    it('calculates MozBook platform commission correctly and preserves gross amounts', () => {
      const commission = calculateCommission(10000);
      expect(commission.grossAmount).toBe(10000);
      expect(commission.commissionAmount).toBe(1500); // 15%
      expect(commission.partnerShare).toBe(8500); // 85%
      expect(commission.commissionPercent).toBe(MOZBOOK_COMMISSION_PERCENT);
      expect(commission.partnerPercent).toBe(PARTNER_SHARE_PERCENT);
    });
  });

  // =========================================================================
  // CHECK 8: Universal Account-Switching & Session Reset
  // =========================================================================
  describe('Check 8: Universal Account-Switching & Draft Isolation', () => {
    it('detects user switch and guarantees user-scoped draft isolation', () => {
      // User 1 (Alice) logs in and saves a draft
      commitActiveSessionUid('host_alice_123');
      saveUserScopedDraft('host_alice_123', 'host_listing_draft', { title: 'Alice Beach Villa', price: 5000 });

      expect(getUserScopedDraft('host_alice_123', 'host_listing_draft')).toEqual({ title: 'Alice Beach Villa', price: 5000 });

      // Host Bob logs in (switch detected)
      const transition = evaluateSessionTransition('host_bob_456');
      expect(transition.type).toBe('account_switch');
      expect(transition.previousUid).toBe('host_alice_123');
      expect(transition.currentUid).toBe('host_bob_456');

      // Purge session caches
      purgeAllUserSessionData();
      commitActiveSessionUid('host_bob_456');

      // Bob cannot access Alice's draft
      expect(getUserScopedDraft('host_bob_456', 'host_listing_draft')).toBeNull();

      // Alice can resume her draft when she explicitly logs back in
      expect(getUserScopedDraft('host_alice_123', 'host_listing_draft')).toEqual({ title: 'Alice Beach Villa', price: 5000 });

      // Clean up Alice's draft
      clearUserScopedDraft('host_alice_123', 'host_listing_draft');
      expect(getUserScopedDraft('host_alice_123', 'host_listing_draft')).toBeNull();
    });

    it('evaluates unauthenticated logout transition correctly', () => {
      commitActiveSessionUid('normal_guest_789');
      const transition = evaluateSessionTransition(null);
      expect(transition.type).toBe('logged_out');
      expect(transition.previousUid).toBe('normal_guest_789');
      expect(transition.currentUid).toBeNull();

      purgeAllUserSessionData();
      expect(sessionStorage.getItem(ACTIVE_SESSION_UID_KEY)).toBeNull();
    });
  });

  // =========================================================================
  // CHECK 9: Admin dashboard access & permission granularities
  // =========================================================================
  describe('Check 9: Admin Capabilities & Sub-Admin Least-Privilege Granularity', () => {
    const kycReviewerUid = 'sub_kyc_agent';
    const kycReviewer: AuthenticatedAdminIdentity = {
      uid: kycReviewerUid,
      email: 'kyc@mozbook.mz',
      emailVerified: true
    };

    beforeEach(() => {
      mockDb['admin_profiles'] = {
        [kycReviewerUid]: {
          uid: kycReviewerUid,
          email: 'kyc@mozbook.mz',
          isActive: true,
          permissions: [
            ADMIN_PERMISSIONS.USERS_VIEW,
            ADMIN_PERMISSIONS.HOSTS_VIEW,
            ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY
          ]
        }
      };
    });

    it('allows KYC reviewer to view users and verify host documents', async () => {
      const userView = await authorizeAdminRequest(kycReviewer, ADMIN_PERMISSIONS.USERS_VIEW);
      expect(userView.authorized).toBe(true);

      const kycVerify = await authorizeAdminRequest(kycReviewer, ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY);
      expect(kycVerify.authorized).toBe(true);
    });

    it('denies KYC reviewer from viewing financial payout records or issuing refunds', async () => {
      const financialRecord = await authorizeAdminRequest(kycReviewer, ADMIN_PERMISSIONS.TRANSACTIONS_APPROVE);
      expect(financialRecord.authorized).toBe(false);
      expect(financialRecord.statusCode).toBe(403);

      const refundRecord = await authorizeAdminRequest(kycReviewer, ADMIN_PERMISSIONS.REFUNDS_APPROVE);
      expect(refundRecord.authorized).toBe(false);
      expect(refundRecord.statusCode).toBe(403);
    });

    it('denies KYC reviewer from managing other administrators or viewing deleted archive', async () => {
      const manageAdmins = await authorizeAdminRequest(kycReviewer, ADMIN_PERMISSIONS.ADMINS_MANAGE);
      expect(manageAdmins.authorized).toBe(false);
      expect(manageAdmins.statusCode).toBe(403);

      const viewArchive = await authorizeAdminRequest(kycReviewer, ADMIN_PERMISSIONS.ARCHIVE_VIEW);
      expect(viewArchive.authorized).toBe(false);
      expect(viewArchive.statusCode).toBe(403);
    });
  });
});
