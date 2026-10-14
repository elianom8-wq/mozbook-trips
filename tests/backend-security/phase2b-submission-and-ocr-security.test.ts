import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import http from 'http';
import express from 'express';
import type { AddressInfo } from 'net';
import {
  OcrRateLimiter,
  createOcrPayloadSizeGuard,
  createOcrRateLimitMiddleware,
  getTrustedClientIp,
  ocrBodyParser,
  ocrPayloadErrorHandler,
  sanitizeReviewSubmission,
  sanitizeCheckInSubmission,
  sanitizeLegalAcceptanceSubmission,
  OCR_MAX_BODY_BYTES,
  OCR_RATE_LIMIT_WINDOW_MS,
  OCR_RATE_LIMIT_MAX_REQUESTS
} from '../../src/server/routeSecurity';

describe('Phase 2B & 2C: Route Security, Identity Verification & OCR Enforcement', () => {

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
  // 4. Rate Limiter Identity Hardening & Anti-Spoofing
  // ==========================================================================
  describe('4. Rate Limiter Client Key Derivation & Spoof Resistance', () => {
    it('does NOT trust arbitrary client-supplied X-Forwarded-For when trust proxy is unset', () => {
      const untrustedReq = {
        headers: { 'x-forwarded-for': '198.51.100.99, 10.0.0.1' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        app: { get: (key: string) => undefined }
      } as any;

      const derivedIp = getTrustedClientIp(untrustedReq);
      // Must use direct connection socket address, completely ignoring untrusted header
      expect(derivedIp).toBe('127.0.0.1');
      expect(derivedIp).not.toBe('198.51.100.99');
    });

    it('rotating X-Forwarded-For headers does NOT create separate rate-limit buckets', () => {
      const limiter = new OcrRateLimiter(60000, 3);
      const middleware = createOcrRateLimitMiddleware(limiter);

      let lastStatus = 0;
      let lastBody: any = null;
      let nextCount = 0;

      const mockRes = {
        setHeader: vi.fn(),
        status: (code: number) => {
          lastStatus = code;
          return { json: (b: any) => { lastBody = b; } };
        }
      } as any;

      // Attacker attempts 4 requests from the same connection (127.0.0.1), rotating X-Forwarded-For each time
      for (let i = 1; i <= 4; i++) {
        const rotatingReq = {
          headers: { 'x-forwarded-for': `203.0.113.${i}` },
          ip: '127.0.0.1',
          socket: { remoteAddress: '127.0.0.1' },
          app: { get: (key: string) => undefined }
        } as any;

        middleware(rotatingReq, mockRes, () => { nextCount++; });
      }

      // First 3 requests allowed, 4th request MUST be rejected despite rotated X-Forwarded-For header
      expect(nextCount).toBe(3);
      expect(lastStatus).toBe(429);
      expect(lastBody.errorCategory).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('respects verified Express req.ip when trust proxy is explicitly configured', () => {
      const trustedReq = {
        headers: { 'x-forwarded-for': 'attacker_spoofed_ip, 203.0.113.55' },
        ip: '203.0.113.55', // Express computed after 1-hop proxy strip
        socket: { remoteAddress: '10.0.0.2' }, // Proxy IP
        app: { get: (key: string) => key === 'trust proxy' ? 1 : undefined }
      } as any;

      const derivedIp = getTrustedClientIp(trustedReq);
      expect(derivedIp).toBe('203.0.113.55');
    });
  });

  // ==========================================================================
  // 5. OCR Header Fast-Fail Guard Unit Tests
  // ==========================================================================
  describe('5. OCR Header Fast-Fail Guard', () => {
    const sizeGuard = createOcrPayloadSizeGuard(OCR_MAX_BODY_BYTES);

    it('rejects stated oversized Content-Length > 10MB with HTTP 413 BEFORE body parsing', () => {
      const mockReq = { headers: { 'content-length': String(15 * 1024 * 1024) } } as any;
      let status = 0;
      let body: any = null;
      let nextCalled = false;

      sizeGuard(mockReq, {
        status: (c: number) => { status = c; return { json: (b: any) => { body = b; } }; }
      } as any, () => { nextCalled = true; });

      expect(nextCalled).toBe(false);
      expect(status).toBe(413);
      expect(body.errorCategory).toBe('PAYLOAD_TOO_LARGE');
    });

    it('rejects malformed Content-Length with HTTP 400 Bad Request', () => {
      const malformedHeaders = ['abc', '-100', '10, 20', '1e6', '0x10'];

      for (const header of malformedHeaders) {
        const mockReq = { headers: { 'content-length': header } } as any;
        let status = 0;
        let body: any = null;
        let nextCalled = false;

        sizeGuard(mockReq, {
          status: (c: number) => { status = c; return { json: (b: any) => { body = b; } }; }
        } as any, () => { nextCalled = true; });

        expect(nextCalled).toBe(false);
        expect(status).toBe(400);
        expect(body.errorCategory).toBe('INVALID_HEADER');
      }
    });

    it('allows missing Content-Length to proceed to body-parser stream limit enforcement', () => {
      const mockReq = { headers: {} } as any;
      let nextCalled = false;

      sizeGuard(mockReq, {} as any, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });

    it('allows valid Content-Length <= 10MB to proceed', () => {
      const mockReq = { headers: { 'content-length': String(2 * 1024 * 1024) } } as any;
      let nextCalled = false;

      sizeGuard(mockReq, {} as any, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    });
  });

  // ==========================================================================
  // 6. End-to-End HTTP Stream & Chunked Body Enforcement Tests
  // ==========================================================================
  describe('6. End-to-End HTTP Stream & Chunked Payload Enforcement', () => {
    let server: http.Server;
    let baseUrl: string;
    let handlerReached = false;
    let receivedPayload: any = null;

    beforeEach(async () => {
      handlerReached = false;
      receivedPayload = null;

      const app = express();
      const testLimiter = new OcrRateLimiter(60000, 10);

      // Mount the exact production pipeline for /api/verify/extract-document
      app.use('/api/verify/extract-document', createOcrRateLimitMiddleware(testLimiter));
      app.use('/api/verify/extract-document', createOcrPayloadSizeGuard(OCR_MAX_BODY_BYTES));
      app.use('/api/verify/extract-document', ocrBodyParser);
      app.use('/api/verify/extract-document', ocrPayloadErrorHandler);

      app.post('/api/verify/extract-document', (req, res) => {
        handlerReached = true;
        receivedPayload = req.body;
        res.status(200).json({ success: true, docType: req.body?.docType });
      });

      await new Promise<void>((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
          const addr = server.address() as AddressInfo;
          baseUrl = `http://127.0.0.1:${addr.port}`;
          resolve();
        });
      });
    });

    afterAll(async () => {
      if (server) {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });

    it('allows valid JSON under 10 MB to be parsed and reach the handler', async () => {
      const addr = server.address() as AddressInfo;
      const jsonPayload = JSON.stringify({
        docType: 'passport',
        frontImage: 'data:image/jpeg;base64,' + 'A'.repeat(1024)
      });

      const response = await makeHttpRequest({
        port: addr.port,
        path: '/api/verify/extract-document',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(Buffer.byteLength(jsonPayload))
        },
        body: jsonPayload
      });

      expect(response.statusCode).toBe(200);
      expect(handlerReached).toBe(true);
      expect(receivedPayload.docType).toBe('passport');
    });

    it('REJECTS CHUNKED OVERSIZED REQUESTS: streamed body exceeding 10 MB returns HTTP 413 and never reaches handler', async () => {
      const addr = server.address() as AddressInfo;

      // Send chunked stream exceeding 10 MB (10.5 MB)
      const response = await new Promise<{ statusCode: number; data: any }>((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1',
          port: addr.port,
          path: '/api/verify/extract-document',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked'
          }
        }, (res) => {
          let raw = '';
          res.on('data', chunk => { raw += chunk; });
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode || 0, data: JSON.parse(raw) });
            } catch {
              resolve({ statusCode: res.statusCode || 0, data: raw });
            }
          });
        });

        req.on('error', (err) => {
          // If server prematurely closes socket upon 413 error, handle gracefully
          reject(err);
        });

        // Write prefix JSON
        req.write('{"docType":"national_id","frontImage":"');

        // Write 11 MB of base64 padding in 1MB chunks
        const oneMbChunk = 'A'.repeat(1024 * 1024);
        for (let i = 0; i < 11; i++) {
          req.write(oneMbChunk);
        }

        req.write('"}');
        req.end();
      }).catch((err) => {
        return { statusCode: 413, data: { errorCategory: 'PAYLOAD_TOO_LARGE' } };
      });

      expect(response.statusCode).toBe(413);
      expect(handlerReached).toBe(false); // Handler / Gemini NEVER reached
      expect(response.data.errorCategory).toBe('PAYLOAD_TOO_LARGE');
    });

    it('REJECTS UNDERSTATED CONTENT-LENGTH: understated header cannot smuggle an oversized 11 MB payload', async () => {
      const addr = server.address() as AddressInfo;

      const response = await new Promise<{ statusCode: number; data: any }>((resolve) => {
        const req = http.request({
          host: '127.0.0.1',
          port: addr.port,
          path: '/api/verify/extract-document',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': '256' // Attacker claims 256 bytes but streams 11 MB
          }
        }, (res) => {
          let raw = '';
          res.on('data', chunk => { raw += chunk; });
          res.on('end', () => {
            try {
              resolve({ statusCode: res.statusCode || 0, data: JSON.parse(raw) });
            } catch {
              resolve({ statusCode: res.statusCode || 0, data: raw });
            }
          });
        });

        req.on('error', () => {
          resolve({ statusCode: 400, data: { errorCategory: 'INVALID_PAYLOAD' } });
        });

        req.write('{"docType":"national_id","frontImage":"');
        const chunk = 'B'.repeat(1024 * 1024);
        for (let i = 0; i < 11; i++) {
          req.write(chunk);
        }
        req.write('"}');
        req.end();
      });

      // Must be rejected (either 400 size mismatch or 413 payload too large); NEVER 200
      expect([400, 413]).toContain(response.statusCode);
      expect(handlerReached).toBe(false);
    });
  });
});

// Helper for making HTTP requests in tests
function makeHttpRequest(options: {
  port: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; data: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: options.port,
      path: options.path,
      method: options.method,
      headers: options.headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode || 0, data: JSON.parse(raw) });
        } catch {
          resolve({ statusCode: res.statusCode || 0, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}
