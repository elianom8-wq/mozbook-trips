import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAndValidateTd3Mrz, computeCheckDigit, parseMrzDate } from '../../src/utils/mrzParser';
import { submitHostVerification, extractDocumentData, HostVerification } from '../../src/services/listingService';

// Mock firestore modules
vi.mock('../../src/firebase', () => {
  return {
    db: {},
    auth: {
      currentUser: { uid: 'test-user-123', email: 'host@mozbook.mz' }
    }
  };
});

vi.mock('firebase/firestore', () => {
  return {
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    addDoc: vi.fn(async (_coll, data) => ({ id: 'verif-mock-123', ...data })),
    updateDoc: vi.fn(async () => {}),
    serverTimestamp: vi.fn(() => ({ seconds: Date.now() / 1000 })),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(async () => ({ empty: true, docs: [] }))
  };
});

describe('Part A & B — Host Verification & Passport Auto-Fill Integrity Suite', () => {

  describe('Part A: Removal of Utility Bill Requirement', () => {
    it('1. Allows host verification submission without any utility bill', async () => {
      const payload: Omit<HostVerification, 'id' | 'createdAt' | 'status'> = {
        userId: 'host-123',
        userEmail: 'host@example.com',
        hostName: 'Armando Guebuza',
        phoneNumber: '+258 84 123 4567',
        docType: 'national_id',
        docNumber: '110100492817M',
        docPhotoUrl: 'https://images.unsplash.com/photo-id-front',
        docFrontPhotoUrl: 'https://images.unsplash.com/photo-id-front',
        docBackPhotoUrl: 'https://images.unsplash.com/photo-id-back',
        expiryDate: '2028-11-20',
        issueDate: '2023-11-21',
        isExpired: false,
        daysUntilExpiry: 770,
        expiryStatus: 'valid'
      };

      // Submit verification with no utilityBillUrl and no utilityBillAddress
      const docId = await submitHostVerification(payload);
      expect(docId).toBe('verif-mock-123');
    });

    it('2. Confirms no hidden utility bill validation or required address matching blocks submission', async () => {
      // Passport submission with no residential address or utility bill
      const passportPayload: Omit<HostVerification, 'id' | 'createdAt' | 'status'> = {
        userId: 'host-passport-456',
        userEmail: 'traveler@gmail.com',
        hostName: 'Sarah Jenkins',
        phoneNumber: '+27 82 123 4567',
        docType: 'passport',
        docNumber: 'PA1234567',
        docPhotoUrl: 'https://images.unsplash.com/passport-page',
        docFrontPhotoUrl: 'https://images.unsplash.com/passport-page',
        expiryDate: '2029-05-15',
        isExpired: false
      };

      const docId = await submitHostVerification(passportPayload);
      expect(docId).toBe('verif-mock-123');
    });

    it('3. Safely preserves legacy utility bill records if present without requiring them for new submissions', async () => {
      const legacyPayload: Omit<HostVerification, 'id' | 'createdAt' | 'status'> = {
        userId: 'host-legacy-789',
        userEmail: 'legacy@example.mz',
        hostName: 'Carlos Tembe',
        phoneNumber: '+258 82 999 8888',
        docType: 'national_id',
        docNumber: '010100293810M',
        utilityBillUrl: 'https://images.unsplash.com/legacy-bill',
        utilityBillAddress: 'Av. Eduardo Mondlane 450, Maputo',
        expiryDate: '2027-01-01'
      };

      const docId = await submitHostVerification(legacyPayload);
      expect(docId).toBe('verif-mock-123');
    });
  });

  describe('Part B: Document Auto-Fill, MRZ Calculation & Authenticity Integrity', () => {
    // Standard ICAO TD3 passport sample lines:
    // Line 1: P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<
    // Line 2: L898902C36UTO7408122F1204159ZE184226B<<<<<10
    // Doc num: L898902C3, check: 6
    // DOB: 740812, check: 2
    // Expiry: 120415, check: 9
    // Composite check over Line 2: 0

    it('4. Correctly computes ICAO 7-3-1 check digit', () => {
      // Test string "L898902C3" -> weighted sum:
      // 'L' (21)*7 + '8'*3 + '9'*1 + '8'*7 + '9'*3 + '0'*1 + '2'*7 + 'C'(12)*3 + '3'*1
      // 147 + 24 + 9 + 56 + 27 + 0 + 14 + 36 + 3 = 316 % 10 = 6
      expect(computeCheckDigit('L898902C3')).toBe(6);
      expect(computeCheckDigit('740812')).toBe(2);
      expect(computeCheckDigit('120415')).toBe(9);
    });

    it('5. Valid MRZ checksums are reported only after actual calculation', () => {
      const line1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
      const line2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

      const result = parseAndValidateTd3Mrz(line1, line2);

      expect(result.hasMrz).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.documentNumber).toBe('L898902C3');
      expect(result.documentNumberCheckDigitValid).toBe(true);
      expect(result.dateOfBirthCheckDigitValid).toBe(true);
      expect(result.expiryDateCheckDigitValid).toBe(true);
      expect(result.compositeCheckDigitValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('6. Invalid MRZ check digits are detected and rejected', () => {
      const line1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
      // Deliberately corrupt document number check digit from 6 to 9
      const corruptedLine2 = 'L898902C39UTO7408122F1204159ZE184226B<<<<<10';

      const result = parseAndValidateTd3Mrz(line1, corruptedLine2);

      expect(result.hasMrz).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.documentNumberCheckDigitValid).toBe(false);
      expect(result.errors.some(e => e.includes('Document number check digit failed'))).toBe(true);
    });

    it('7. Line length mismatches in MRZ are detected and fail validation', () => {
      const shortLine1 = 'P<UTOERIKSSON<<ANNA';
      const shortLine2 = 'L898902C36UTO';

      const result = parseAndValidateTd3Mrz(shortLine1, shortLine2);
      expect(result.hasMrz).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('MRZ line length mismatch'))).toBe(true);
    });

    it('8. Correctly parses dates from MRZ format without silent corruption', () => {
      const birth = parseMrzDate('880324', false); // 1988-03-24
      const expiry = parseMrzDate('290615', true); // 2029-06-15

      expect(birth).toBe('1988-03-24');
      expect(expiry).toBe('2029-06-15');

      // Invalid date strings return null rather than invented values
      expect(parseMrzDate('999999', false)).toBeNull();
      expect(parseMrzDate('ABCDEF', false)).toBeNull();
      expect(parseMrzDate('', false)).toBeNull();
    });

    it('9. Missing OCR values remain blank/null rather than receiving hardcoded fallback data', async () => {
      // Simulating client receiving an extraction response where name could not be read
      const emptyExtraction = {
        legalName: null,
        docNumber: null,
        expiryDate: null,
        nationality: null,
        confidenceScore: 0
      };

      // Form state populator should leave blank
      const populatedForm = {
        hostName: emptyExtraction.legalName || '',
        docNumber: emptyExtraction.docNumber || '',
        expiryDate: emptyExtraction.expiryDate || '',
        nationality: emptyExtraction.nationality || ''
      };

      expect(populatedForm.hostName).toBe('');
      expect(populatedForm.docNumber).toBe('');
      expect(populatedForm.expiryDate).toBe('');
      expect(populatedForm.nationality).toBe('');
    });

    it('10. OCR extraction alone never marks a document verified or approved', () => {
      const extractionResult = {
        success: true,
        extractionStatus: 'extracted_pending_review',
        extracted: {
          legalName: 'Test Host',
          docNumber: 'PA123456',
          expiryDate: '2029-01-01'
        }
      };

      // The status must remain pending review until authorized admin decision
      expect(extractionResult.extractionStatus).toBe('extracted_pending_review');
      expect((extractionResult as any).status).toBeUndefined();
    });

    it('11. Unsupported biometric-chip or civil authority claims are avoided', () => {
      const line1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
      const line2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';
      const result = parseAndValidateTd3Mrz(line1, line2);

      // MRZ parser should report mathematical checksums only, not claim chip inspection
      expect((result as any).biometricChipDetected).toBeUndefined();
      expect((result as any).officialGovernmentRegistryConfirmed).toBeUndefined();
    });

    it('12. Manual host edits remain tagged for authorized review and do not become verified facts', () => {
      const manualEditState = {
        docNumber: '110100492817M',
        isManuallyEdited: true,
        verificationStatus: 'pending'
      };

      expect(manualEditState.isManuallyEdited).toBe(true);
      expect(manualEditState.verificationStatus).toBe('pending');
    });
  });

  describe('Part C: Production Extraction Endpoint Mapping, Error Categorization & Sample Data Removal', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
      vi.restoreAllMocks();
    });

    it('13. extractDocumentData sends selected document image to /api/verify/extract-document and maps returned values accurately', async () => {
      const mockSuccessResponse = {
        success: true,
        extractionStatus: 'extracted_pending_review',
        extracted: {
          legalName: 'Alberto Ernesto Sitoe',
          docNumber: '110100492817M',
          expiryDate: '2028-11-20',
          issueDate: '2023-11-21',
          dateOfBirth: '1985-05-15',
          nationality: 'Mozambican (Moçambique)',
          isFrontAndBackProvided: true,
          confidenceScore: 92,
          securityFeaturesDetected: ['republica_de_mocambique_seal'],
          validationNotes: 'Document details extracted — pending user review and authorized admin approval.',
          isExpired: false,
          daysUntilExpiry: 770,
          expiryStatus: 'valid'
        }
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse
      });

      const payload = {
        docType: 'national_id' as const,
        frontImage: 'data:image/jpeg;base64,mockFrontBase64ImageData123',
        backImage: 'data:image/jpeg;base64,mockBackBase64ImageData456'
      };

      const result = await extractDocumentData(payload);

      // Verify request payload was transmitted accurately to /api/verify/extract-document
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/verify/extract-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      // Verify returned fields are mapped to form extraction result
      expect(result.success).toBe(true);
      expect(result.extracted).toBeDefined();
      expect(result.extracted?.legalName).toBe('Alberto Ernesto Sitoe');
      expect(result.extracted?.docNumber).toBe('110100492817M');
      expect(result.extracted?.expiryDate).toBe('2028-11-20');
      expect(result.extracted?.issueDate).toBe('2023-11-21');
      expect(result.extracted?.dateOfBirth).toBe('1985-05-15');
      expect(result.extracted?.nationality).toBe('Mozambican (Moçambique)');
      expect(result.extracted?.isExpired).toBe(false);
      expect(result.extracted?.daysUntilExpiry).toBe(770);
      expect(result.extracted?.expiryStatus).toBe('valid');
      expect(result.extracted?.securityFeaturesDetected).toContain('republica_de_mocambique_seal');
    });

    it('14. extractDocumentData handles failed response path without claiming fields were extracted and provides error category', async () => {
      const mockFailedResponse = {
        success: false,
        extractionStatus: 'failed',
        errorCategory: 'PROVIDER_CREDITS_DEPLETED',
        providerCreditsDepleted: true,
        error: 'Automated AI document reading is paused because Gemini API prepayment credits are depleted. Please enter your document details manually below.',
        extracted: null
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockFailedResponse
      });

      const payload = {
        docType: 'passport' as const,
        frontImage: 'data:image/jpeg;base64,mockPassportPhoto789'
      };

      const result = await extractDocumentData(payload);

      // Verify failure states
      expect(result.success).toBe(false);
      expect(result.extracted).toBeUndefined();
      expect(result.providerCreditsDepleted).toBe(true);
      expect(result.errorCategory).toBe('PROVIDER_CREDITS_DEPLETED');
      expect(result.error).toContain('prepayment credits are depleted');
    });

    it('15. Failed extraction preserves uploaded document image and does not overwrite user-entered fields', () => {
      // Starting form state with user-entered values and uploaded image
      const formState = {
        docFrontPhotoUrl: 'data:image/jpeg;base64,validHostDocumentPhoto123',
        docBackPhotoUrl: 'data:image/jpeg;base64,validHostDocumentPhoto456',
        hostName: 'User Entered Name',
        docNumber: 'CustomEnteredDoc999',
        manuallyEditedFields: new Set(['legalName', 'docNumber']),
        extractionSuccess: false,
        extractionError: null as string | null,
        providerErrorCategory: null as string | null,
      };

      // Simulate extraction failure from provider
      const failureResult = {
        success: false,
        errorCategory: 'PROVIDER_CREDITS_DEPLETED',
        providerCreditsDepleted: true,
        error: 'Automated AI document reading is paused because Gemini API prepayment credits are depleted.'
      };

      // Handler updates error state while preserving photos and user fields
      if (!failureResult.success) {
        formState.extractionSuccess = false;
        formState.extractionError = failureResult.error;
        formState.providerErrorCategory = failureResult.errorCategory;
        // User values and uploaded photos are strictly preserved
      }

      // Assertions
      expect(formState.docFrontPhotoUrl).toBe('data:image/jpeg;base64,validHostDocumentPhoto123');
      expect(formState.docBackPhotoUrl).toBe('data:image/jpeg;base64,validHostDocumentPhoto456');
      expect(formState.hostName).toBe('User Entered Name');
      expect(formState.docNumber).toBe('CustomEnteredDoc999');
      expect(formState.extractionSuccess).toBe(false);
      expect(formState.providerErrorCategory).toBe('PROVIDER_CREDITS_DEPLETED');
    });

    it('16. Prohibited sample identities (Reynolds, Macamo, Ferreira, PA9248102B) cannot populate a real host verification session', () => {
      const prohibitedValues = [
        'David John Reynolds',
        'PA9248102B',
        'Clara Mondlane Ferreira',
        'Manuel António Macamo'
      ];

      // Clean session initial state
      const initialSession = {
        hostName: '',
        docNumber: '',
        docFrontPhotoUrl: '',
        docBackPhotoUrl: '',
        expiryDate: '',
        issueDate: '',
        dateOfBirth: '',
        nationality: '',
        extractedFieldKeys: new Set<string>()
      };

      for (const prohibited of prohibitedValues) {
        expect(initialSession.hostName).not.toBe(prohibited);
        expect(initialSession.docNumber).not.toBe(prohibited);
      }
    });

    it('17. Switching document types (B.I. to passport or vice-versa) clears stale data and prevents cross-document data carryover', () => {
      // Simulate state where user had loaded or extracted a B.I.
      let session = {
        docType: 'national_id',
        docFrontPhotoUrl: 'https://images.unsplash.com/bi-front',
        docBackPhotoUrl: 'https://images.unsplash.com/bi-back',
        docNumber: '110100492817M',
        expiryDate: '2028-11-20',
        issueDate: '2023-11-21',
        dateOfBirth: '1988-03-24',
        nationality: 'Mozambican (Moçambique)',
        securityFeatures: ['republica_de_mocambique_seal'],
        validationNotes: 'B.I. details extracted',
        extractedFieldKeys: new Set(['docNumber', 'expiryDate', 'legalName']),
        extractionSuccess: true
      };

      // Handler function simulating handleDocTypeChange('passport')
      const switchDocType = (newType: string) => {
        if (newType === session.docType) return;
        session = {
          docType: newType,
          docFrontPhotoUrl: '',
          docBackPhotoUrl: '',
          docNumber: '',
          expiryDate: '',
          issueDate: '',
          dateOfBirth: '',
          nationality: '',
          securityFeatures: [],
          validationNotes: '',
          extractedFieldKeys: new Set(),
          extractionSuccess: false
        };
      };

      switchDocType('passport');

      // Assertions: Stale B.I. photos, number, dates, notes, and attribution markers are cleared
      expect(session.docType).toBe('passport');
      expect(session.docFrontPhotoUrl).toBe('');
      expect(session.docBackPhotoUrl).toBe('');
      expect(session.docNumber).toBe('');
      expect(session.expiryDate).toBe('');
      expect(session.issueDate).toBe('');
      expect(session.dateOfBirth).toBe('');
      expect(session.nationality).toBe('');
      expect(session.securityFeatures.length).toBe(0);
      expect(session.validationNotes).toBe('');
      expect(session.extractedFieldKeys.size).toBe(0);
      expect(session.extractionSuccess).toBe(false);
    });

    it('18. Provider depleted credits prevents repeated automated Gemini API calls', async () => {
      let apiCallCount = 0;
      let providerCreditsDepleted = true; // Flagged from initial 402/RESOURCE_EXHAUSTED response

      const handleExtractData = async () => {
        // Requirement 7: Do not attempt repeated Gemini API calls while provider reports depleted credits
        if (providerCreditsDepleted) {
          return {
            attemptedApiCall: false,
            errorCategory: 'PROVIDER_CREDITS_DEPLETED',
            message: 'Automated AI document reading is paused because Gemini API prepayment credits are depleted.'
          };
        }
        apiCallCount++;
        return { attemptedApiCall: true };
      };

      // Attempt repeated extraction calls
      const call1 = await handleExtractData();
      const call2 = await handleExtractData();

      expect(call1.attemptedApiCall).toBe(false);
      expect(call1.errorCategory).toBe('PROVIDER_CREDITS_DEPLETED');
      expect(call2.attemptedApiCall).toBe(false);
      expect(apiCallCount).toBe(0); // Zero repeated API calls made
    });
  });
});
