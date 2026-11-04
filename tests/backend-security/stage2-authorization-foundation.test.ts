import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ADMIN_PERMISSIONS, 
  MASTER_ADMIN_EMAIL, 
  DEFAULT_SUB_ADMIN_PERMISSIONS,
  isElevatedPermission,
  isMasterOnlyPermission,
  AdminPermission
} from '../../src/types/adminPermissions';
import {
  isMasterAdminIdentity,
  resolveAdminContext,
  hasAdminPermission,
  authorizeAdminRequest,
  AuthenticatedAdminIdentity
} from '../../src/server/adminAuth';

// Mock paymentService getPrivilegedFirestore to return isolated in-memory Firestore mock
const mockFirestoreData: Record<string, Record<string, any>> = {};

vi.mock('../../src/server/paymentService', () => {
  return {
    getPrivilegedFirestore: () => ({
      collection: (colName: string) => ({
        doc: (docId: string) => ({
          get: async () => ({
            exists: Boolean(mockFirestoreData[colName] && mockFirestoreData[colName][docId]),
            data: () => mockFirestoreData[colName]?.[docId]
          }),
          set: async (payload: any) => {
            if (!mockFirestoreData[colName]) mockFirestoreData[colName] = {};
            mockFirestoreData[colName][docId] = payload;
          }
        })
      })
    }),
    isUserAdmin: (user: any) => {
      if (!user) return false;
      const email = user.email?.toLowerCase();
      return email === 'mozbookinfo@gmail.com' || email === 'admin@mozbook.mz' || user.role === 'admin';
    }
  };
});

describe('MozBook — Stage 2: Authorization Foundation & RBAC Security Engine', () => {
  beforeEach(() => {
    // Clear mock firestore state
    for (const key of Object.keys(mockFirestoreData)) {
      delete mockFirestoreData[key];
    }
  });

  // =========================================================================
  // 1. Master-Admin Tests
  // =========================================================================
  describe('1. Master Administrator Server-Enforced Identity', () => {
    it('verifies the designated master account with verified email', () => {
      const verifiedMaster: AuthenticatedAdminIdentity = {
        uid: 'uid_master_123',
        email: MASTER_ADMIN_EMAIL,
        emailVerified: true
      };

      expect(isMasterAdminIdentity(verifiedMaster)).toBe(true);
    });

    it('rejects master privilege if email is unverified (spoofing protection)', () => {
      const spoofedMaster: AuthenticatedAdminIdentity = {
        uid: 'uid_attacker_999',
        email: MASTER_ADMIN_EMAIL,
        emailVerified: false // Unverified email address
      };

      expect(isMasterAdminIdentity(spoofedMaster)).toBe(false);
    });

    it('rejects normal user claiming admin or master role in client payload', () => {
      const normalUser: AuthenticatedAdminIdentity = {
        uid: 'uid_guest_1',
        email: 'attacker@evil.com',
        emailVerified: true
      };

      expect(isMasterAdminIdentity(normalUser)).toBe(false);
    });

    it('resolves master admin context with all permissions and isMaster: true', async () => {
      const verifiedMaster: AuthenticatedAdminIdentity = {
        uid: 'uid_master_123',
        email: MASTER_ADMIN_EMAIL,
        displayName: 'Master Administrator',
        emailVerified: true
      };

      const context = await resolveAdminContext(verifiedMaster);
      expect(context).not.toBeNull();
      expect(context?.isMaster).toBe(true);
      expect(context?.isActive).toBe(true);
      expect(context?.email).toBe(MASTER_ADMIN_EMAIL);
      expect(context?.permissions).toContain(ADMIN_PERMISSIONS.USERS_VIEW);
      expect(context?.permissions).toContain(ADMIN_PERMISSIONS.REFUNDS_APPROVE);
      expect(context?.permissions).toContain(ADMIN_PERMISSIONS.TRANSACTIONS_APPROVE);
      expect(context?.permissions).toContain(ADMIN_PERMISSIONS.ADMINS_MANAGE);
      expect(context?.permissions).toContain(ADMIN_PERMISSIONS.ARCHIVE_VIEW);
    });
  });

  // =========================================================================
  // 2. Generic Sub-Admin Tests
  // =========================================================================
  describe('2. Generic Sub-Admin Authorization & Permission Boundaries', () => {
    const subAdminUid = 'uid_subadmin_456';
    const subAdminIdentity: AuthenticatedAdminIdentity = {
      uid: subAdminUid,
      email: 'verifier@mozbook.mz',
      displayName: 'KYC Reviewer',
      emailVerified: true
    };

    it('allows an authorized active sub-admin to perform actions covered by granted permissions', async () => {
      mockFirestoreData['admin_profiles'] = {
        [subAdminUid]: {
          uid: subAdminUid,
          email: 'verifier@mozbook.mz',
          displayName: 'KYC Reviewer',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.USERS_VIEW, ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const result = await authorizeAdminRequest(subAdminIdentity, ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY);
      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.context?.isMaster).toBe(false);
    });

    it('rejects an unprivileged sub-admin from performing actions not in their profile', async () => {
      mockFirestoreData['admin_profiles'] = {
        [subAdminUid]: {
          uid: subAdminUid,
          email: 'verifier@mozbook.mz',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.USERS_VIEW], // Missing VERIFICATIONS_VERIFY
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const result = await authorizeAdminRequest(subAdminIdentity, ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY);
      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain("Missing required administrator permission 'verifications:verify'");
    });

    it('fails closed when sub-admin is suspended or deactivated (isActive: false)', async () => {
      mockFirestoreData['admin_profiles'] = {
        [subAdminUid]: {
          uid: subAdminUid,
          email: 'verifier@mozbook.mz',
          isMaster: false,
          isActive: false, // SUSPENDED
          permissions: [ADMIN_PERMISSIONS.USERS_VIEW, ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const result = await authorizeAdminRequest(subAdminIdentity, ADMIN_PERMISSIONS.USERS_VIEW);
      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('not recognized as an active administrator');
    });

    it('fails closed when caller has no admin_profile and is not master (HTTP 403)', async () => {
      const stranger: AuthenticatedAdminIdentity = {
        uid: 'uid_stranger_777',
        email: 'random@gmail.com',
        emailVerified: true
      };

      const result = await authorizeAdminRequest(stranger, ADMIN_PERMISSIONS.USERS_VIEW);
      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(403);
    });

    it('fails closed on unauthenticated request (HTTP 401)', async () => {
      const result = await authorizeAdminRequest(null, ADMIN_PERMISSIONS.USERS_VIEW);
      expect(result.authorized).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('prevents sub-admins from ever acquiring master-only permissions via stored profile injection', async () => {
      mockFirestoreData['admin_profiles'] = {
        [subAdminUid]: {
          uid: subAdminUid,
          email: 'verifier@mozbook.mz',
          isMaster: false,
          isActive: true,
          // Attacker managed to inject master permission into profile
          permissions: [
            ADMIN_PERMISSIONS.USERS_VIEW,
            ADMIN_PERMISSIONS.ADMINS_MANAGE,
            ADMIN_PERMISSIONS.ARCHIVE_VIEW
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const context = await resolveAdminContext(subAdminIdentity);
      // Master-only permissions must be stripped by server authority
      expect(context?.permissions).not.toContain(ADMIN_PERMISSIONS.ADMINS_MANAGE);
      expect(context?.permissions).not.toContain(ADMIN_PERMISSIONS.ARCHIVE_VIEW);
      expect(hasAdminPermission(context, ADMIN_PERMISSIONS.ADMINS_MANAGE)).toBe(false);
      expect(hasAdminPermission(context, ADMIN_PERMISSIONS.ARCHIVE_VIEW)).toBe(false);
    });
  });

  // =========================================================================
  // 3. Elevated Permission Tests
  // =========================================================================
  describe('3. Elevated Permissions Separation (Refunds, Transactions, Master Audit)', () => {
    const refundAdminUid = 'uid_refund_admin';
    const refundAdminIdentity: AuthenticatedAdminIdentity = {
      uid: refundAdminUid,
      email: 'refunds@mozbook.mz',
      emailVerified: true
    };

    const payoutAdminUid = 'uid_payout_admin';
    const payoutAdminIdentity: AuthenticatedAdminIdentity = {
      uid: payoutAdminUid,
      email: 'payouts@mozbook.mz',
      emailVerified: true
    };

    it('verifies refund approval requires explicit refunds:approve permission', async () => {
      mockFirestoreData['admin_profiles'] = {
        [refundAdminUid]: {
          uid: refundAdminUid,
          email: 'refunds@mozbook.mz',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.REFUNDS_APPROVE],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const refundResult = await authorizeAdminRequest(refundAdminIdentity, ADMIN_PERMISSIONS.REFUNDS_APPROVE);
      expect(refundResult.authorized).toBe(true);
    });

    it('verifies refund approval permission does NOT imply transaction payout approval', async () => {
      mockFirestoreData['admin_profiles'] = {
        [refundAdminUid]: {
          uid: refundAdminUid,
          email: 'refunds@mozbook.mz',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.REFUNDS_APPROVE],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const payoutResult = await authorizeAdminRequest(refundAdminIdentity, ADMIN_PERMISSIONS.TRANSACTIONS_APPROVE);
      expect(payoutResult.authorized).toBe(false);
      expect(payoutResult.statusCode).toBe(403);
      expect(payoutResult.error).toContain("Missing required administrator permission 'transactions:approve'");
    });

    it('verifies transaction approval does NOT imply refund approval', async () => {
      mockFirestoreData['admin_profiles'] = {
        [payoutAdminUid]: {
          uid: payoutAdminUid,
          email: 'payouts@mozbook.mz',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.TRANSACTIONS_APPROVE],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const refundResult = await authorizeAdminRequest(payoutAdminIdentity, ADMIN_PERMISSIONS.REFUNDS_APPROVE);
      expect(refundResult.authorized).toBe(false);
      expect(refundResult.statusCode).toBe(403);
      expect(refundResult.error).toContain("Missing required administrator permission 'refunds:approve'");
    });

    it('verifies master audit-log access requires its own exceptional permission and does NOT grant archive access', async () => {
      const auditAuditorUid = 'uid_external_auditor';
      const auditorIdentity: AuthenticatedAdminIdentity = {
        uid: auditAuditorUid,
        email: 'auditor@kpmg.co.mz',
        emailVerified: true
      };

      mockFirestoreData['admin_profiles'] = {
        [auditAuditorUid]: {
          uid: auditAuditorUid,
          email: 'auditor@kpmg.co.mz',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.AUDIT_LOGS_VIEW_MASTER],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      // Auditor can access master audit log
      const auditResult = await authorizeAdminRequest(auditorIdentity, ADMIN_PERMISSIONS.AUDIT_LOGS_VIEW_MASTER);
      expect(auditResult.authorized).toBe(true);

      // Auditor CANNOT access deleted records archive
      const archiveResult = await authorizeAdminRequest(auditorIdentity, ADMIN_PERMISSIONS.ARCHIVE_VIEW);
      expect(archiveResult.authorized).toBe(false);

      // Auditor CANNOT manage administrators
      const adminManageResult = await authorizeAdminRequest(auditorIdentity, ADMIN_PERMISSIONS.ADMINS_MANAGE);
      expect(adminManageResult.authorized).toBe(false);
    });
  });

  // =========================================================================
  // 4. Data-Access & Export Boundaries
  // =========================================================================
  describe('4. Operational Reports vs Unrestricted Data Export Boundaries', () => {
    const reportingSubAdminUid = 'uid_reporter';
    const reportingSubAdminIdentity: AuthenticatedAdminIdentity = {
      uid: reportingSubAdminUid,
      email: 'ops@mozbook.mz',
      emailVerified: true
    };

    it('allows generic sub-admin to access operational reports on-screen', async () => {
      mockFirestoreData['admin_profiles'] = {
        [reportingSubAdminUid]: {
          uid: reportingSubAdminUid,
          email: 'ops@mozbook.mz',
          isMaster: false,
          isActive: true,
          permissions: [ADMIN_PERMISSIONS.REPORTS_VIEW],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      };

      const result = await authorizeAdminRequest(reportingSubAdminIdentity, ADMIN_PERMISSIONS.REPORTS_VIEW);
      expect(result.authorized).toBe(true);
      expect(result.statusCode).toBe(200);
    });

    it('verifies that canExportData permission is NOT part of the sub-admin permission model', () => {
      // Prompt Requirement: "Do not introduce a canExportData permission for sub-admins."
      expect(Object.values(ADMIN_PERMISSIONS)).not.toContain('canExportData');
      expect(DEFAULT_SUB_ADMIN_PERMISSIONS).not.toContain('canExportData');
    });

    it('verifies classification helper functions correctly identify elevated and master-only permissions', () => {
      expect(isElevatedPermission(ADMIN_PERMISSIONS.REFUNDS_APPROVE)).toBe(true);
      expect(isElevatedPermission(ADMIN_PERMISSIONS.TRANSACTIONS_APPROVE)).toBe(true);
      expect(isElevatedPermission(ADMIN_PERMISSIONS.AUDIT_LOGS_VIEW_MASTER)).toBe(true);
      expect(isElevatedPermission(ADMIN_PERMISSIONS.USERS_VIEW)).toBe(false);

      expect(isMasterOnlyPermission(ADMIN_PERMISSIONS.ADMINS_MANAGE)).toBe(true);
      expect(isMasterOnlyPermission(ADMIN_PERMISSIONS.ADMINS_ASSIGN_PERMISSIONS)).toBe(true);
      expect(isMasterOnlyPermission(ADMIN_PERMISSIONS.ARCHIVE_VIEW)).toBe(true);
      expect(isMasterOnlyPermission(ADMIN_PERMISSIONS.USERS_VIEW)).toBe(false);
      expect(isMasterOnlyPermission(ADMIN_PERMISSIONS.REFUNDS_APPROVE)).toBe(false);
    });
  });
});
