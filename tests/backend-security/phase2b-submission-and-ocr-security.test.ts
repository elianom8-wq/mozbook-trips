import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OcrRateLimiter,
  createOcrPayloadSizeGuard,
  createOcrRateLimitMiddleware,
  sanitizeReviewSubmission,
  sanitizeCheckInSubmission,
  sanitizeLegalAcceptanceSubmission,
  OCR_MAX_BODY_BYTES,
  OCR_RATE_LIMIT_WINDOW_MS,
  OCR_RATE_LIMIT_MAX_REQUESTS
} from '../../src/server/routeSecurity';

describe('Phase 2B: Route Security & Identity Verification Hardening', () => {

  // ==========================================================================
  // 1. POST /api/reviews Security & Identity Integrity
  // ==========================================================================
  describe('1. POST /api/reviews Security & Anti-Spoofing', () => {
    const validUser = {
      uid: 'user_authentic_123',
      displayName: 'Mateus Chissano',
      email: 'mateus@mozbook.mz'
    };

    it('rejects unauthenticated requests with HTTP 401', () => {
      const result = sanitizeReviewSubmission(null, {
        google_place_id: 'ChIJjYOF6K6b5h4RqV5dETAGrcs',
        review_text: 'Excellent seafood!'
      });

      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Authentication required');
    });

    it('rejects submissions with missing token UID with HTTP 401', () => {
      const result = sanitizeReviewSubmission({ uid: '' }, {
        google_place_id: 'ChIJjYOF6K6b5h4RqV5dETAGrcs',
        review_text: 'Excellent seafood!'
      });

      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(401);
    });

    it('rejects missing google_place_id or review_text with HTTP 400', () => {
      const missingPlace = sanitizeReviewSubmission(validUser, {
        review_text: 'Great food'
      });
      expect(missingPlace.valid).toBe(false);
      expect(missingPlace.statusCode).toBe(400);

      const missingText = sanitizeReviewSubmission(validUser, {
        google_place_id: 'ChIJjYOF6K6b5h4RqV5dETAGrcs',
        review_text: '   '
      });
      expect(missingText.valid).toBe(false);
      expect(missingText.statusCode).toBe(400);
    });

    it('PREVENTS IDENTITY FORGERY: derives user_id strictly from verified token UID, never body user_id', () => {
      const maliciousBody = {
        user_id: 'attacker_spoofed_victim_id',
        userId: 'attacker_alternate_spoofed_id',
        user_name: 'Impersonated VIP Admin',
        google_place_id: 'ChIJjYOF6K6b5h4RqV5dETAGrcs',
        rating: 5,
        review_text: 'Authentic local lobster and 2M beer.'
      };

      const result = sanitizeReviewSubmission(validUser, maliciousBody);

      expect(result.valid).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.review).toBeDefined();
      // Must be the verified token UID, NEVER the attacker's body value
      expect(result.review?.user_id).toBe('user_authentic_123');
      expect(result.review?.user_id).not.toBe('attacker_spoofed_victim_id');
      expect(result.review?.user_name).toBe('Mateus Chissano');
      expect(result.review?.user_name).not.toBe('Impersonated VIP Admin');
    });

    it('uses safe email fallback when displayName is not present', () => {
      const userWithoutDisplayName = {
        uid: 'user_no_name_456',
        email: 'traveller.sofia@gmail.com'
      };

      const result = sanitizeReviewSubmission(userWithoutDisplayName, {
        google_place_id: 'ChIJjYOF6K6b5h4RqV5dETAGrcs',
        review_text: 'Lovely sunset view.'
      });

      expect(result.valid).toBe(true);
      expect(result.review?.user_id).toBe('user_no_name_456');
      expect(result.review?.user_name).toBe('traveller.sofia');
    });

    it('safely clamps rating values between 1 and 5', () => {
      const overHigh = sanitizeReviewSubmission(validUser, {
        google_place_id: 'place_1',
        rating: 99,
        review_text: 'Good'
      });
      expect(overHigh.review?.rating).toBe(5);

      const underLow = sanitizeReviewSubmission(validUser, {
        google_place_id: 'place_1',
        rating: -10,
        review_text: 'Good'
      });
      expect(underLow.review?.rating).toBe(1);
    });
  });

  // ==========================================================================
  // 2. POST /api/check-ins Security & Identity Integrity
  // ==========================================================================
  describe('2. POST /api/check-ins Security & Anti-Spoofing', () => {
    const validUser = {
      uid: 'user_checkin_789',
      displayName: 'Sofia M.',
      email: 'sofia@mozbook.mz'
    };

    it('rejects unauthenticated check-ins with HTTP 401', () => {
      const result = sanitizeCheckInSubmission(null, {
        google_place_id: 'place_checkin_1',
        place_name: 'Mood Restaurante & Bar'
      });

      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Authentication required');
    });

    it('rejects check-in missing place_name or google_place_id with HTTP 400', () => {
      const missingName = sanitizeCheckInSubmission(validUser, {
        google_place_id: 'place_checkin_1'
      });
      expect(missingName.valid).toBe(false);
      expect(missingName.statusCode).toBe(400);
    });

    it('PREVENTS IDENTITY FORGERY: derives check-in user identity strictly from token UID', () => {
      const spoofAttempt = {
        user_id: 'spoofed_celebrity_uid',
        user_name: 'Fake Host Account',
        google_place_id: 'place_checkin_1',
        place_name: 'Mood Restaurante & Bar',
        latitude: -25.966,
        longitude: 32.589,
        spot: 'Terrace Table 4',
        note: 'Drinks with travelers'
      };

      const result = sanitizeCheckInSubmission(validUser, spoofAttempt);

      expect(result.valid).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.checkIn?.user_id).toBe('user_checkin_789');
      expect(result.checkIn?.user_id).not.toBe('spoofed_celebrity_uid');
      expect(result.checkIn?.user_name).toBe('Sofia M.');
      expect(result.checkIn?.user_name).not.toBe('Fake Host Account');
      expect(result.checkIn?.expires_at).toBeGreaterThan(Date.now());
    });
  });

  // ==========================================================================
  // 3. POST /api/legal/accept Security & Identity Integrity
  // ==========================================================================
  describe('3. POST /api/legal/accept Security & Anti-Spoofing', () => {
    const validCustomer = {
      uid: 'customer_contract_uid',
      email: 'customer@gmail.com'
    };

    it('rejects unauthenticated requests with HTTP 401 without recording acceptance', () => {
      const result = sanitizeLegalAcceptanceSubmission(null, {
        documentType: 'terms_customer',
        context: 'checkout'
      });

      expect(result.valid).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Authentication required');
      expect(result.acceptance).toBeUndefined();
    });

    it('PREVENTS IDENTITY FORGERY: sets userId exclusively from token UID, ignoring body userId / bodyUserId', () => {
      const spoofBody = {
        userId: 'victim_user_who_did_not_accept',
        bodyUserId: 'victim_user_alternate',
        documentType: 'terms_customer',
        documentVersionId: 'v1',
        context: 'checkout',
        bookingId: 'bk_12345'
      };

      const result = sanitizeLegalAcceptanceSubmission(validCustomer, spoofBody, 'Mozilla/5.0');

      expect(result.valid).toBe(true);
      expect(result.statusCode).toBe(201);
      expect(result.acceptance).toBeDefined();
      expect(result.acceptance?.userId).toBe('customer_contract_uid');
      expect(result.acceptance?.userId).not.toBe('victim_user_who_did_not_accept');
    });

    it('validates documentType and rejects invalid document types with HTTP 400', () => {
      const invalidType = sanitizeLegalAcceptanceSubmission(validCustomer, {
        documentType: 'unauthorized_arbitrary_doc',
        context: 'checkout'
      });

      expect(invalidType.valid).toBe(false);
      expect(invalidType.statusCode).toBe(400);
      expect(invalidType.error).toContain("Invalid documentType 'unauthorized_arbitrary_doc'");
    });

    it('rejects submission missing context with HTTP 400', () => {
      const missingContext = sanitizeLegalAcceptanceSubmission(validCustomer, {
        documentType: 'terms_customer'
      });

      expect(missingContext.valid).toBe(false);
      expect(missingContext.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // 4. POST /api/verify/extract-document: Rate Limiter & Size Guard
  // ==========================================================================
  describe('4. Document OCR Rate Limiting & Payload Size Protection', () => {
    let testLimiter: OcrRateLimiter;

    beforeEach(() => {
      // 5 requests per 1000ms window for focused testing
      testLimiter = new OcrRateLimiter(1000, 5);
    });

    it('allows requests within threshold and tracks count accurately', () => {
      const clientIp = '192.168.1.100';

      for (let i = 1; i <= 5; i++) {
        const check = testLimiter.checkLimit(clientIp);
        expect(check.allowed).toBe(true);
        expect(check.currentCount).toBe(i);
      }
    });

    it('blocks the (maxRequests + 1) request with HTTP 429 semantics and retryAfterSeconds', () => {
      const clientIp = '192.168.1.101';

      // Exhaust 5 allowed requests
      for (let i = 0; i < 5; i++) {
        testLimiter.checkLimit(clientIp);
      }

      // 6th request must be rejected
      const blocked = testLimiter.checkLimit(clientIp);
      expect(blocked.allowed).toBe(false);
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
      expect(blocked.currentCount).toBe(5);
    });

    it('isolates rate limits between distinct client identifiers', () => {
      const clientA = '10.0.0.1';
      const clientB = '10.0.0.2';

      for (let i = 0; i < 5; i++) {
        testLimiter.checkLimit(clientA);
      }

      // Client A is blocked
      expect(testLimiter.checkLimit(clientA).allowed).toBe(false);

      // Client B is still fresh and allowed
      expect(testLimiter.checkLimit(clientB).allowed).toBe(true);
    });

    it('OCR Rate Limit Middleware sends 429 response and Retry-After header when limit exceeded', () => {
      const middleware = createOcrRateLimitMiddleware(testLimiter);
      const clientIp = '203.0.113.1';

      const mockReq = {
        headers: { 'x-forwarded-for': clientIp },
        ip: clientIp,
        socket: {}
      } as any;

      let responseStatusCode = 0;
      let responseBody: any = null;
      let headersSet: Record<string, string> = {};
      let nextCalled = false;

      const mockRes = {
        setHeader: (k: string, v: string) => { headersSet[k] = v; },
        status: (code: number) => {
          responseStatusCode = code;
          return {
            json: (body: any) => { responseBody = body; }
          };
        }
      } as any;

      const mockNext = () => { nextCalled = true; };

      // Exhaust limit
      for (let i = 0; i < 5; i++) {
        nextCalled = false;
        middleware(mockReq, mockRes, mockNext);
        expect(nextCalled).toBe(true);
      }

      // Next request must be rejected before reaching next middleware / Gemini
      nextCalled = false;
      middleware(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false); // Does NOT invoke downstream handler/Gemini
      expect(responseStatusCode).toBe(429);
      expect(responseBody.errorCategory).toBe('RATE_LIMIT_EXCEEDED');
      expect(headersSet['Retry-After']).toBeDefined();
    });

    it('OCR Payload Size Guard rejects oversized Content-Length > 10MB with HTTP 413 BEFORE body parsing', () => {
      const sizeGuard = createOcrPayloadSizeGuard(OCR_MAX_BODY_BYTES);

      const oversizedLength = 15 * 1024 * 1024; // 15MB
      const mockReq = {
        headers: { 'content-length': String(oversizedLength) }
      } as any;

      let responseStatusCode = 0;
      let responseBody: any = null;
      let nextCalled = false;

      const mockRes = {
        status: (code: number) => {
          responseStatusCode = code;
          return {
            json: (body: any) => { responseBody = body; }
          };
        }
      } as any;

      const mockNext = () => { nextCalled = true; };

      sizeGuard(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(false); // Immediately rejected BEFORE express.json body parser or Gemini
      expect(responseStatusCode).toBe(413);
      expect(responseBody.errorCategory).toBe('PAYLOAD_TOO_LARGE');
      expect(responseBody.error).toContain('10MB');
    });

    it('OCR Payload Size Guard allows legitimate 2MB document payloads to proceed', () => {
      const sizeGuard = createOcrPayloadSizeGuard(OCR_MAX_BODY_BYTES);

      const validLength = 2 * 1024 * 1024; // 2MB
      const mockReq = {
        headers: { 'content-length': String(validLength) }
      } as any;

      let nextCalled = false;
      const mockRes = {} as any;
      const mockNext = () => { nextCalled = true; };

      sizeGuard(mockReq, mockRes, mockNext);

      expect(nextCalled).toBe(true);
    });
  });
});
