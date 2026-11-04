/**
 * MozBook Admin Authorization & Granular Permissions System
 * Stage 2: Authorization Foundation
 *
 * Defines authoritative permission identifiers across backend and frontend.
 * Enforces least-privilege, separation of duties, and non-repudiation.
 */

// Standard Operational Permissions for Generic Sub-Admins
export const ADMIN_PERMISSIONS = {
  // Operational: Users & Hosts
  USERS_VIEW: 'users:view',
  USERS_MANAGE: 'users:manage',
  USERS_SUSPEND: 'users:suspend',
  HOSTS_VIEW: 'hosts:view',
  HOSTS_MANAGE: 'hosts:manage',
  HOSTS_SUSPEND: 'hosts:suspend',

  // Operational: Verifications & Compliance
  VERIFICATIONS_VERIFY: 'verifications:verify',

  // Operational: Support & Reporting
  SUPPORT_VIEW: 'support:view',
  REPORTS_VIEW: 'reports:view',

  // Elevated Permissions (Separately assignable, never granted by default, never implied by generic sub-admin role)
  REFUNDS_APPROVE: 'refunds:approve',
  TRANSACTIONS_APPROVE: 'transactions:approve',
  AUDIT_LOGS_VIEW_MASTER: 'audit_logs:view_master',

  // Master-Only Capabilities (Strictly reserved for mozbookinfo@gmail.com)
  ADMINS_MANAGE: 'admins:manage',
  ADMINS_ASSIGN_PERMISSIONS: 'admins:assign_permissions',
  ARCHIVE_VIEW: 'archive:view',
} as const;

export type AdminPermission = typeof ADMIN_PERMISSIONS[keyof typeof ADMIN_PERMISSIONS];

export const MASTER_ADMIN_EMAIL = 'mozbookinfo@gmail.com';

/**
 * Standard default permissions for a generic sub-admin.
 * Notice: Elevated permissions (refunds, transactions, master audit)
 * and master-only capabilities are strictly EXCLUDED by default.
 */
export const DEFAULT_SUB_ADMIN_PERMISSIONS: readonly AdminPermission[] = [
  ADMIN_PERMISSIONS.USERS_VIEW,
  ADMIN_PERMISSIONS.HOSTS_VIEW,
  ADMIN_PERMISSIONS.VERIFICATIONS_VERIFY,
  ADMIN_PERMISSIONS.REPORTS_VIEW,
  ADMIN_PERMISSIONS.SUPPORT_VIEW,
];

/**
 * Elevated permissions requiring explicit individual master assignment
 */
export const ELEVATED_PERMISSIONS: readonly AdminPermission[] = [
  ADMIN_PERMISSIONS.REFUNDS_APPROVE,
  ADMIN_PERMISSIONS.TRANSACTIONS_APPROVE,
  ADMIN_PERMISSIONS.AUDIT_LOGS_VIEW_MASTER,
];

/**
 * Capabilities strictly reserved for the Master Admin (mozbookinfo@gmail.com)
 */
export const MASTER_ONLY_PERMISSIONS: readonly AdminPermission[] = [
  ADMIN_PERMISSIONS.ADMINS_MANAGE,
  ADMIN_PERMISSIONS.ADMINS_ASSIGN_PERMISSIONS,
  ADMIN_PERMISSIONS.ARCHIVE_VIEW,
];

/**
 * Represents an authoritative administrator profile stored in Firestore `admin_profiles/{uid}`
 */
export interface AdminProfileRecord {
  uid: string;
  email: string;
  displayName?: string;
  isMaster: boolean;
  isActive: boolean;
  permissions: AdminPermission[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  statusNotes?: string;
}

/**
 * Authenticated server-side context evaluated for administrative requests
 */
export interface AdminContextInfo {
  uid: string;
  email: string;
  displayName?: string;
  isMaster: boolean;
  isActive: boolean;
  permissions: AdminPermission[];
}

export function isElevatedPermission(perm: string): boolean {
  return (ELEVATED_PERMISSIONS as readonly string[]).includes(perm);
}

export function isMasterOnlyPermission(perm: string): boolean {
  return (MASTER_ONLY_PERMISSIONS as readonly string[]).includes(perm);
}
