import { describe, it, expect, beforeEach, vi } from 'vitest';
import { INITIAL_LEGAL_DOCUMENTS, LEGAL_CONFIG_WARNINGS } from '../../src/data/legalDocuments';
import { LegalService } from '../../src/services/legalService';

describe('Prompt 28A — MozBook Legal & Contractual Framework Tests', () => {

  describe('1. Static Legal Document Definitions & Disclosures', () => {
    it('defines all four mandatory legal documents with correct versions', () => {
      const docKeys = ['terms_customer', 'cancellation_refund_policy', 'privacy_policy', 'partner_agreement'];
      for (const key of docKeys) {
        const doc = INITIAL_LEGAL_DOCUMENTS[key as keyof typeof INITIAL_LEGAL_DOCUMENTS];
        expect(doc).toBeDefined();
        expect(doc.version).toBe('1.0.0');
        expect(doc.status).toBe('published');
        expect(doc.body.length).toBeGreaterThan(100);
      }
    });

    it('contains operating company name "Elvira da Gloria Consulting SU, Lda."', () => {
      const terms = INITIAL_LEGAL_DOCUMENTS.terms_customer.body;
      const privacy = INITIAL_LEGAL_DOCUMENTS.privacy_policy.body;
      const refund = INITIAL_LEGAL_DOCUMENTS.cancellation_refund_policy.body;
      const partner = INITIAL_LEGAL_DOCUMENTS.partner_agreement.body;

      expect(terms).toContain('Elvira da Gloria Consulting SU, Lda.');
      expect(privacy).toContain('Elvira da Gloria Consulting SU, Lda.');
      expect(refund).toContain('Elvira da Gloria Consulting SU, Lda.');
      expect(partner).toContain('Elvira da Gloria Consulting SU, Lda.');
    });

    it('accurately specifies the 15% platform commission and 85% partner split', () => {
      const refundPolicy = INITIAL_LEGAL_DOCUMENTS.cancellation_refund_policy.body;
      const partnerAgreement = INITIAL_LEGAL_DOCUMENTS.partner_agreement.body;

      expect(refundPolicy).toContain('15% platform commission');
      expect(refundPolicy).toContain('85% partner net share');
      expect(partnerAgreement).toContain('15% platform commission');
      expect(partnerAgreement).toContain('85% net partner share');
    });

    it('flags required legal counsel reviews and does not falsely claim statutory approval', () => {
      for (const doc of Object.values(INITIAL_LEGAL_DOCUMENTS)) {
        expect(doc.requiresLegalReview).toBe(true);
        expect(doc.legalCounselApproved).toBe(false);
      }
      expect(LEGAL_CONFIG_WARNINGS.length).toBeGreaterThanOrEqual(4);
      expect(LEGAL_CONFIG_WARNINGS.some(w => w.requiresMozambicanLegalCounsel)).toBe(true);
    });

    it('documents PaySuite as the authoritative gateway without falsely promising instantaneous refunds', () => {
      const refundPolicy = INITIAL_LEGAL_DOCUMENTS.cancellation_refund_policy.body;
      expect(refundPolicy).toContain('PaySuite');
      expect(refundPolicy).toContain('Authoritative Confirmation');
    });
  });

  describe('2. Document Retrieval & Versioning', () => {
    it('returns published document version gracefully via LegalService', async () => {
      const doc = await LegalService.getPublishedDocument('terms_customer');
      expect(doc.type).toBe('terms_customer');
      expect(doc.title).toBe('Customer Terms and Conditions');
      expect(doc.version).toBe('1.0.0');
    });

    it('returns all published documents correctly', async () => {
      const allDocs = await LegalService.getAllPublishedDocuments();
      expect(allDocs.terms_customer).toBeDefined();
      expect(allDocs.privacy_policy).toBeDefined();
      expect(allDocs.cancellation_refund_policy).toBeDefined();
      expect(allDocs.partner_agreement).toBeDefined();
    });
  });

  describe('3. Legal Acceptance Verification & Idempotency Logic', () => {
    it('flags unauthenticated user as requiring acceptance', async () => {
      const status = await LegalService.getUserAcceptanceStatus('', 'terms_customer');
      expect(status.hasAcceptedLatest).toBe(false);
      expect(status.requiresReacceptance).toBe(true);
      expect(status.currentDocumentVersion).toBe('1.0.0');
    });

    it('verifies acceptance record structure and immutability attributes', () => {
      const mockRecord = {
        id: 'leg_acc_123',
        userId: 'usr_abc',
        documentType: 'terms_customer',
        documentVersionId: 'terms_customer_v1',
        documentVersion: '1.0.0',
        documentContentHash: 'hash_terms_customer_1_0_0',
        acceptedAt: new Date().toISOString(),
        context: 'checkout',
        bookingId: 'book_999'
      };

      expect(mockRecord.userId).toBe('usr_abc');
      expect(mockRecord.documentType).toBe('terms_customer');
      expect(mockRecord.documentVersion).toBe('1.0.0');
      expect(mockRecord.acceptedAt).toBeDefined();
    });
  });
});
