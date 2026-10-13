export type LegalDocumentType = 
  | 'terms_customer'
  | 'privacy_policy'
  | 'cancellation_refund_policy'
  | 'partner_agreement';

export type LegalDocumentStatus = 'published' | 'draft' | 'archived';

export interface LegalDocumentVersion {
  id: string; // e.g. "terms_customer_v1"
  type: LegalDocumentType;
  title: string;
  version: string; // e.g. "1.0.0"
  contentHash: string; // SHA-256 or digest of content
  status: LegalDocumentStatus;
  effectiveDate: string; // ISO date string, e.g. "2026-10-10"
  requiresLegalReview: boolean; // Flag if legal counsel in Mozambique must approve
  legalCounselApproved: boolean; // Must be false unless verified signed legal review exists
  summaryOfChanges?: string;
  body: string; // Markdown or rich structured text
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  publishedBy?: string;
}

export interface LegalAcceptanceRecord {
  id: string; // acceptance record ID
  userId: string;
  documentType: LegalDocumentType;
  documentVersionId: string;
  documentVersion: string;
  documentContentHash: string;
  acceptedAt: string; // Server authoritative ISO string
  context: 'checkout' | 'partner_onboarding' | 'signup' | 'reacceptance';
  bookingId?: string;
  hostId?: string;
  userAgent?: string;
}

export interface LegalConfigWarning {
  field: string;
  documentType: LegalDocumentType;
  description: string;
  actionRequired: string;
  requiresMozambicanLegalCounsel: boolean;
}

export interface LegalAcceptanceStatus {
  hasAcceptedLatest: boolean;
  acceptedVersion?: string;
  acceptedAt?: string;
  requiresReacceptance: boolean;
  documentType: LegalDocumentType;
  currentDocumentVersion: string;
}
