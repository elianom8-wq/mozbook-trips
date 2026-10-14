import { db, auth } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  LegalDocumentType, 
  LegalDocumentVersion, 
  LegalAcceptanceRecord, 
  LegalAcceptanceStatus 
} from '../types/legal';
import { INITIAL_LEGAL_DOCUMENTS } from '../data/legalDocuments';

/**
 * Service managing MozBook legal document definitions, versioning,
 * authoritative acceptance tracking, and legal compliance checks.
 */
export class LegalService {
  /**
   * Fetch the current published version of a legal document.
   * Falls back gracefully to system initial defaults if Firestore is not yet populated.
   */
  static async getPublishedDocument(type: LegalDocumentType): Promise<LegalDocumentVersion> {
    try {
      const q = query(
        collection(db, 'legal_documents'),
        where('type', '==', type),
        where('status', '==', 'published'),
        orderBy('effectiveDate', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data() as LegalDocumentVersion;
      }
    } catch (err) {
      console.warn(`[LegalService] Firestore lookup failed for ${type}, falling back to static config:`, err);
    }
    return INITIAL_LEGAL_DOCUMENTS[type];
  }

  /**
   * Fetch all legal documents for public viewer or admin review.
   */
  static async getAllPublishedDocuments(): Promise<Record<LegalDocumentType, LegalDocumentVersion>> {
    const types: LegalDocumentType[] = [
      'terms_customer',
      'privacy_policy',
      'cancellation_refund_policy',
      'partner_agreement'
    ];
    const results = await Promise.all(types.map(t => this.getPublishedDocument(t)));
    return {
      terms_customer: results[0],
      privacy_policy: results[1],
      cancellation_refund_policy: results[2],
      partner_agreement: results[3]
    };
  }

  /**
   * Check if a specific user has authoritatively accepted the latest version of a document.
   */
  static async getUserAcceptanceStatus(
    userId: string, 
    documentType: LegalDocumentType
  ): Promise<LegalAcceptanceStatus> {
    const currentDoc = await this.getPublishedDocument(documentType);
    if (!userId) {
      return {
        hasAcceptedLatest: false,
        requiresReacceptance: true,
        documentType,
        currentDocumentVersion: currentDoc.version
      };
    }

    try {
      const q = query(
        collection(db, 'legal_acceptances'),
        where('userId', '==', userId),
        where('documentType', '==', documentType),
        orderBy('acceptedAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const lastAcceptance = snapshot.docs[0].data() as LegalAcceptanceRecord;
        const isLatest = lastAcceptance.documentVersion === currentDoc.version;
        return {
          hasAcceptedLatest: isLatest,
          acceptedVersion: lastAcceptance.documentVersion,
          acceptedAt: lastAcceptance.acceptedAt,
          requiresReacceptance: !isLatest,
          documentType,
          currentDocumentVersion: currentDoc.version
        };
      }
    } catch (err) {
      console.warn(`[LegalService] Error querying acceptance status for user ${userId}:`, err);
    }

    return {
      hasAcceptedLatest: false,
      requiresReacceptance: true,
      documentType,
      currentDocumentVersion: currentDoc.version
    };
  }

  /**
   * Record authoritative acceptance via server API endpoint.
   * Prevents client-side timestamp tampering and logs immutable records.
   */
  static async recordAcceptanceViaApi(params: {
    userId?: string;
    documentType: LegalDocumentType;
    documentVersionId: string;
    context: 'checkout' | 'partner_onboarding' | 'signup' | 'reacceptance';
    bookingId?: string;
    hostId?: string;
    idToken?: string;
  }): Promise<{ success: boolean; acceptanceId?: string; error?: string }> {
    try {
      const idToken = params.idToken || (await auth.currentUser?.getIdToken());
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
      }

      const response = await fetch('/api/legal/accept', {
        method: 'POST',
        headers,
        body: JSON.stringify(params)
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error('[LegalService] Failed to record acceptance via API:', err);
      return { success: false, error: err.message || 'Failed to record legal acceptance.' };
    }
  }
}
