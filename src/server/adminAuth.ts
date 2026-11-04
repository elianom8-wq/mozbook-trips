/**
 * MozBook Authoritative Server-Side Admin Authorization Engine
 * Stage 2: Authorization Foundation
 *
 * ARCHITECTURAL PRINCIPLE:
 * Server-authoritative role and permission enforcement.
 * Identity is derived exclusively from cryptographically verified Firebase ID tokens.
 * Neither localStorage, request bodies, nor client-side claims establish authorization.
 */

import { Request, Response, NextFunction } from 'express';
import { 
  ADMIN_PERMISSIONS, 
  AdminPermission, 
  MASTER_ADMIN_EMAIL, 
  AdminContextInfo, 
  AdminProfileRecord,
  isMasterOnlyPermission,
  isElevatedPermission
} from '../types/adminPermissions';
import { getPrivilegedFirestore } from './paymentService';
import firebaseConfig from '../../firebase-applet-config.json';

function parseFirestoreDoc(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) result[key] = val.stringValue;
    else if ('integerValue' in val) result[key] = Number(val.integerValue);
    else if ('doubleValue' in val) result[key] = Number(val.doubleValue);
    else if ('booleanValue' in val) result[key] = val.booleanValue;
    else if ('timestampValue' in val) result[key] = val.timestampValue;
    else if ('mapValue' in val) result[key] = parseFirestoreDoc(val.mapValue?.fields || {});
    else if ('arrayValue' in val) result[key] = (val.arrayValue?.values || []).map((v: any) => Object.values(v)[0]);
  }
  return result;
}

export interface AuthenticatedAdminIdentity {
  uid: string;
  email?: string;
  displayName?: string;
  emailVerified?: boolean;
  idToken?: string;
}

/**
 * Verifies whether an authenticated identity is the trusted Master Administrator.
 * Strictly requires verified email matching MASTER_ADMIN_EMAIL.
 */
export function isMasterAdminIdentity(user: AuthenticatedAdminIdentity | null | undefined): boolean {
  if (!user || !user.uid || !user.email) return false;
  const normalizedEmail = user.email.trim().toLowerCase();
  const isMasterEmail = normalizedEmail === MASTER_ADMIN_EMAIL.toLowerCase();
  // Strictly require email to be cryptographically verified (email_verified == true)
  const isVerified = user.emailVerified === true;
  return isMasterEmail && isVerified;
}

/**
 * Resolves the server-authoritative AdminContext for an authenticated identity.
 * Reads the authoritative record from Firestore `admin_profiles/{uid}` via Admin SDK.
 *
 * Invariants:
 * 1. Master admin (mozbookinfo@gmail.com) is always active and holds all permissions.
 * 2. Generic sub-admins must have a document in `admin_profiles/{uid}` with `isActive: true`.
 * 3. Inactive or deleted sub-admins are instantly revoked (fail closed).
 * 4. Sub-admins can NEVER possess master-only capabilities.
 */
export async function resolveAdminContext(
  user: AuthenticatedAdminIdentity | null | undefined
): Promise<AdminContextInfo | null> {
  if (!user || !user.uid) return null;

  const isMaster = isMasterAdminIdentity(user);

  if (isMaster) {
    const allPermissions = Object.values(ADMIN_PERMISSIONS) as AdminPermission[];
    // Lazy sync/ensure master profile document exists in Firestore for consistency.
    // If a verified Bearer ID token is present, sync directly via Firestore REST API (allowed by security rules).
    if (user.idToken) {
      (async () => {
        try {
          const docUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/admin_profiles/${user.uid}`;
          const checkRes = await fetch(docUrl, {
            headers: { 'Authorization': `Bearer ${user.idToken}` }
          });
          if (checkRes.status === 404) {
            await fetch(docUrl, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${user.idToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  uid: { stringValue: user.uid },
                  email: { stringValue: MASTER_ADMIN_EMAIL },
                  displayName: { stringValue: user.displayName || 'MozBook Master Administrator' },
                  isMaster: { booleanValue: true },
                  isActive: { booleanValue: true },
                  permissions: {
                    arrayValue: {
                      values: allPermissions.map(p => ({ stringValue: p }))
                    }
                  },
                  createdAt: { timestampValue: new Date().toISOString() },
                  updatedAt: { timestampValue: new Date().toISOString() },
                  createdBy: { stringValue: 'system:bootstrap' }
                }
              })
            });
          }
        } catch {
          // Non-fatal: master authorization is authoritatively established in-memory
        }
      })().catch(() => {});
    } else {
      // Fallback: sync via Admin SDK (e.g., during tests or headless execution)
      try {
        const adminDb = getPrivilegedFirestore();
        const masterDocRef = adminDb.collection('admin_profiles').doc(user.uid);
        const masterDoc = await masterDocRef.get();
        if (!masterDoc.exists) {
          const masterProfile: AdminProfileRecord = {
            uid: user.uid,
            email: MASTER_ADMIN_EMAIL,
            displayName: user.displayName || 'MozBook Master Administrator',
            isMaster: true,
            isActive: true,
            permissions: allPermissions,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: 'system:bootstrap'
          };
          await masterDocRef.set(masterProfile);
        }
      } catch (err: any) {
        // Non-fatal: master authorization is guaranteed in-memory.
        // Suppress uncredentialed gRPC permission warnings in development/preview environments.
        const errMsg = err?.message || String(err);
        const isPermissionDenied = errMsg.includes('PERMISSION_DENIED') || errMsg.includes('code: 7') || err?.code === 7 || err?.code === 'permission-denied';
        if (!isPermissionDenied && process.env.NODE_ENV !== 'production' && process.env.DEBUG_ADMIN_AUTH) {
          console.debug('[AdminAuth] Master profile sync note:', errMsg);
        }
      }
    }

    return {
      uid: user.uid,
      email: MASTER_ADMIN_EMAIL,
      displayName: user.displayName || 'MozBook Master Administrator',
      isMaster: true,
      isActive: true,
      permissions: allPermissions
    };
  }

  // Generic Sub-Admin Verification via Firestore `admin_profiles/{uid}`
  try {
    // 1. If ID token is present, try direct Firestore REST lookup first
    if (user.idToken) {
      try {
        const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/admin_profiles/${user.uid}`;
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${user.idToken}` }
        });
        if (res.ok) {
          const json = await res.json();
          const data = parseFirestoreDoc(json.fields || {}) as AdminProfileRecord;
          if (data && data.isActive === true) {
            const sanitizedPermissions = (Array.isArray(data.permissions) ? data.permissions : [])
              .filter((p): p is AdminPermission => Object.values(ADMIN_PERMISSIONS).includes(p as AdminPermission))
              .filter(p => !isMasterOnlyPermission(p));

            return {
              uid: user.uid,
              email: data.email || user.email || '',
              displayName: data.displayName || user.displayName || 'Sub-Administrator',
              isMaster: false,
              isActive: true,
              permissions: sanitizedPermissions
            };
          }
          return null;
        } else if (res.status === 404) {
          // Compatibility fallback: check legacy user record in `users/{uid}`
          const userUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/users/${user.uid}`;
          const userRes = await fetch(userUrl, {
            headers: { 'Authorization': `Bearer ${user.idToken}` }
          });
          if (userRes.ok) {
            const userJson = await userRes.json();
            const userData = parseFirestoreDoc(userJson.fields || {});
            if (userData?.role === 'admin') {
              const legacyEmail = user.email || userData?.email || '';
              if (legacyEmail.toLowerCase() === 'admin@mozbook.mz') {
                return {
                  uid: user.uid,
                  email: legacyEmail,
                  displayName: user.displayName || 'MozBook Operations Admin',
                  isMaster: false,
                  isActive: true,
                  permissions: [
                    ADMIN_PERMISSIONS.USERS_VIEW,
                    ADMIN_PERMISSIONS.HOSTS_VIEW,
                    ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY,
                    ADMIN_PERMISSIONS.REPORTS_VIEW,
                    ADMIN_PERMISSIONS.SUPPORT_VIEW,
                  ]
                };
              }
            }
          }
          return null;
        }
      } catch {
        // Fall back to Admin SDK
      }
    }

    const adminDb = getPrivilegedFirestore();
    const profileSnap = await adminDb.collection('admin_profiles').doc(user.uid).get();

    if (!profileSnap.exists) {
      // Compatibility fallback: check legacy user record in `users/{uid}` for existing admin role
      const userSnap = await adminDb.collection('users').doc(user.uid).get();
      if (userSnap.exists && userSnap.data()?.role === 'admin') {
        const legacyEmail = user.email || userSnap.data()?.email || '';
        // Legacy fallback only applies to pre-configured mozbook domains if active
        if (legacyEmail.toLowerCase() === 'admin@mozbook.mz') {
          return {
            uid: user.uid,
            email: legacyEmail,
            displayName: user.displayName || 'MozBook Operations Admin',
            isMaster: false,
            isActive: true,
            permissions: [
              ADMIN_PERMISSIONS.USERS_VIEW,
              ADMIN_PERMISSIONS.HOSTS_VIEW,
              ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY,
              ADMIN_PERMISSIONS.REPORTS_VIEW,
              ADMIN_PERMISSIONS.SUPPORT_VIEW,
            ]
          };
        }
      }
      return null;
    }

    const data = profileSnap.data() as AdminProfileRecord;

    // Fail closed if deactivated or suspended
    if (!data || data.isActive !== true) {
      return null;
    }

    // Sub-admins can NEVER claim isMaster or master-only permissions
    const sanitizedPermissions = (Array.isArray(data.permissions) ? data.permissions : [])
      .filter((p): p is AdminPermission => Object.values(ADMIN_PERMISSIONS).includes(p as AdminPermission))
      .filter(p => !isMasterOnlyPermission(p));

    return {
      uid: user.uid,
      email: data.email || user.email || '',
      displayName: data.displayName || user.displayName || 'Sub-Administrator',
      isMaster: false,
      isActive: true,
      permissions: sanitizedPermissions
    };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    const isPermissionOrAuthError =
      errMsg.includes('PERMISSION_DENIED') ||
      errMsg.includes('7') ||
      err?.code === 7 ||
      err?.code === 'permission-denied' ||
      errMsg.includes('Could not load the default credentials');

    if (!isPermissionOrAuthError) {
      console.error(`[AdminAuth] Error resolving admin context for uid ${user.uid}:`, errMsg);
    }
    return null;
  }
}

/**
 * Checks whether an AdminContext satisfies a specific permission requirement.
 */
export function hasAdminPermission(
  context: AdminContextInfo | null | undefined, 
  requiredPermission: AdminPermission
): boolean {
  if (!context || !context.isActive) return false;
  if (context.isMaster) return true; // Master administrator holds all permissions
  if (isMasterOnlyPermission(requiredPermission)) return false; // Sub-admins never possess master-only capabilities
  return context.permissions.includes(requiredPermission);
}

/**
 * Comprehensive authorization check returning granular status codes and errors
 */
export async function authorizeAdminRequest(
  user: AuthenticatedAdminIdentity | null | undefined,
  requiredPermission?: AdminPermission
): Promise<{
  authorized: boolean;
  statusCode: number;
  error?: string;
  context?: AdminContextInfo;
}> {
  if (!user || !user.uid) {
    return {
      authorized: false,
      statusCode: 401,
      error: 'Authentication required. Please provide a valid Firebase ID token.'
    };
  }

  const context = await resolveAdminContext(user);

  if (!context) {
    return {
      authorized: false,
      statusCode: 403,
      error: 'Access denied: You are not recognized as an active administrator.'
    };
  }

  if (requiredPermission && !hasAdminPermission(context, requiredPermission)) {
    return {
      authorized: false,
      statusCode: 403,
      error: `Access denied: Missing required administrator permission '${requiredPermission}'.`,
      context
    };
  }

  return {
    authorized: true,
    statusCode: 200,
    context
  };
}

/**
 * Express middleware helper to enforce general administrator access
 */
export function createAdminMiddleware(
  authenticateRequest: (req: Request) => Promise<AuthenticatedAdminIdentity | null>,
  requiredPermission?: AdminPermission
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authenticateRequest(req);
      const authResult = await authorizeAdminRequest(user, requiredPermission);

      if (!authResult.authorized) {
        res.status(authResult.statusCode).json({
          success: false,
          error: authResult.error
        });
        return;
      }

      // Attach authoritative admin context to request
      (req as any).adminContext = authResult.context;
      next();
    } catch (err: any) {
      console.error('[AdminAuthMiddleware] Unexpected failure:', err);
      res.status(500).json({
        success: false,
        error: 'Internal authorization evaluation error.'
      });
    }
  };
}

/**
 * Express middleware helper strictly enforcing Master Administrator identity
 */
export function createMasterAdminMiddleware(
  authenticateRequest: (req: Request) => Promise<AuthenticatedAdminIdentity | null>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authenticateRequest(req);
      if (!user || !user.uid) {
        res.status(401).json({ success: false, error: 'Authentication required.' });
        return;
      }

      const context = await resolveAdminContext(user);
      if (!context || !context.isMaster) {
        res.status(403).json({
          success: false,
          error: 'Forbidden: This operation is strictly reserved for the Master Administrator (mozbookinfo@gmail.com).'
        });
        return;
      }

      (req as any).adminContext = context;
      next();
    } catch (err: any) {
      console.error('[MasterAdminMiddleware] Unexpected failure:', err);
      res.status(500).json({ success: false, error: 'Internal authorization error.' });
    }
  };
}
