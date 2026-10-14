import express, { Request, Response, NextFunction } from 'express';

/**
 * MozBook Phase 2B Route Security & Verification Module
 *
 * Implements security hardening across reviews, social check-ins,
 * legal acceptance audit logging, and document OCR extraction.
 */

// ============================================================================
// 1. Document OCR Protection Settings & In-Memory Rate Limiter
// ============================================================================

/**
 * Dedicated maximum request-body size for OCR document extraction (10MB).
 * Appropriately sized for high-resolution dual-sided identity photos while
 * preventing server memory exhaustion and resource starvation.
 */
export const OCR_MAX_BODY_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Document extraction rate limit parameters.
 * Window: 15 minutes.
 * Maximum attempts: 10 extraction requests per client key.
 */
export const OCR_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const OCR_RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * In-memory sliding-window rate limiter for document OCR extraction.
 *
 * ARCHITECTURAL NOTICE:
 * This rate limiter maintains state in memory within the current Node.js process.
 * It is strictly bounded per server/container instance and does NOT share rate-limit
 * state across multiple Cloud Run instances. When scaled across multiple replicas,
 * each container maintains its own sliding-window counter. For unified distributed
 * throttling across horizontally scaled instances, a shared backend (such as Redis
 * or Firestore atomic counters) would be required.
 */
export class OcrRateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs: number = OCR_RATE_LIMIT_WINDOW_MS, maxRequests: number = OCR_RATE_LIMIT_MAX_REQUESTS) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Evaluates if a request from the given client key is permitted.
   */
  public checkLimit(clientKey: string): { allowed: boolean; retryAfterSeconds?: number; currentCount: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.requests.get(clientKey) || [];
    // Prune timestamps outside current sliding window
    const validTimestamps = timestamps.filter(ts => ts > windowStart);

    if (validTimestamps.length >= this.maxRequests) {
      const oldestInWindow = validTimestamps[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldestInWindow + this.windowMs - now) / 1000));
      this.requests.set(clientKey, validTimestamps);
      return { allowed: false, retryAfterSeconds, currentCount: validTimestamps.length };
    }

    validTimestamps.push(now);
    this.requests.set(clientKey, validTimestamps);
    return { allowed: true, currentCount: validTimestamps.length };
  }

  /**
   * Clears state for testing or administration.
   */
  public reset(clientKey?: string): void {
    if (clientKey) {
      this.requests.delete(clientKey);
    } else {
      this.requests.clear();
    }
  }

  public getCount(clientKey: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.requests.get(clientKey) || [];
    return timestamps.filter(ts => ts > windowStart).length;
  }
}

export const defaultOcrRateLimiter = new OcrRateLimiter();

/**
 * Safely derives the client identifier for rate limiting.
 *
 * ARCHITECTURAL NOTICE ON REVERSE PROXIES & TOPOLOGY:
 * In untrusted or direct network environments, headers such as `X-Forwarded-For` are client-controlled
 * and can be arbitrarily forged or rotated by malicious callers to bypass IP-based rate limiting.
 * Therefore, arbitrary forwarding headers MUST NOT be trusted by default.
 *
 * If the application is explicitly configured with Express `trust proxy` (e.g. `app.set('trust proxy', 1)`
 * behind a verified single-hop reverse proxy such as Google Cloud Run / GFE), Express's built-in `req.ip`
 * resolves the client IP securely by counting hops from the right, discarding preceding client-forged headers.
 * Otherwise, the direct network connection address (`req.socket.remoteAddress`) is strictly used,
 * ensuring untrusted forwarding headers cannot provide a fresh rate-limit identity.
 */
export function getTrustedClientIp(req: Request): string {
  const isProxyTrusted = Boolean(req.app && req.app.get('trust proxy'));
  if (isProxyTrusted && req.ip) {
    return req.ip;
  }
  return req.socket?.remoteAddress || req.ip || 'unknown-client';
}

/**
 * Fast-fail header guard: Rejects requests with malformed Content-Length (HTTP 400)
 * or stated oversized Content-Length > 10MB (HTTP 413) BEFORE reading or buffering stream chunks.
 * Note: Stream-level byte limits for chunked, missing, or understated Content-Length
 * are strictly enforced by the downstream `ocrBodyParser`.
 */
export function createOcrPayloadSizeGuard(maxBytes: number = OCR_MAX_BODY_BYTES) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLengthHeader = req.headers['content-length'];
    if (contentLengthHeader !== undefined) {
      const trimmed = String(contentLengthHeader).trim();
      // Safely validate decimal integer format; reject non-digits or negative values
      if (!/^\d+$/.test(trimmed)) {
        res.status(400).json({
          success: false,
          errorCategory: 'INVALID_HEADER',
          error: 'Bad Request: Malformed Content-Length header.'
        });
        return;
      }

      const contentLength = parseInt(trimmed, 10);
      if (contentLength > maxBytes) {
        res.status(413).json({
          success: false,
          errorCategory: 'PAYLOAD_TOO_LARGE',
          error: `Payload Too Large: Document extraction payload exceeds maximum allowed size of ${Math.round(maxBytes / (1024 * 1024))}MB.`
        });
        return;
      }
    }
    next();
  };
}

/**
 * Dedicated 10MB JSON body parser for OCR document extraction.
 * Enforces a strict 10MB limit during stream receiving and parsing,
 * protecting against chunked transfers and understated Content-Length.
 * Captures rawBody buffer for any downstream integrity verification.
 */
export const ocrBodyParser = express.json({
  limit: OCR_MAX_BODY_BYTES,
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
});

/**
 * Route-specific error handler for OCR body parsing errors.
 * Catches 413 entity.too.large (from stream parsing) and returns a consistent safe JSON response.
 */
export function ocrPayloadErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (err) {
    if (err.status === 413 || err.statusCode === 413 || err.type === 'entity.too.large') {
      res.status(413).json({
        success: false,
        errorCategory: 'PAYLOAD_TOO_LARGE',
        error: `Payload Too Large: Document extraction payload exceeds maximum allowed size of ${Math.round(OCR_MAX_BODY_BYTES / (1024 * 1024))}MB.`
      });
      return;
    }
    if (err.status === 400 || err.statusCode === 400 || err.type === 'request.size.invalid') {
      res.status(400).json({
        success: false,
        errorCategory: 'INVALID_PAYLOAD',
        error: 'Bad Request: Invalid request payload size or malformed JSON.'
      });
      return;
    }
    return next(err);
  }
  next();
}

/**
 * Middleware: Enforces per-instance rate limiting on OCR document extraction.
 * Derives client identity safely via `getTrustedClientIp(req)` to prevent forwarding-header evasion.
 * Rejects requests exceeding threshold with HTTP 429 and Retry-After header before body parsing and Gemini.
 */
export function createOcrRateLimitMiddleware(limiter: OcrRateLimiter = defaultOcrRateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = getTrustedClientIp(req);

    const check = limiter.checkLimit(clientKey);
    if (!check.allowed) {
      res.setHeader('Retry-After', String(check.retryAfterSeconds || 60));
      res.status(429).json({
        success: false,
        errorCategory: 'RATE_LIMIT_EXCEEDED',
        error: 'Too Many Requests: Document verification extraction rate limit exceeded. Please wait before retrying.',
        retryAfterSeconds: check.retryAfterSeconds
      });
      return;
    }
    next();
  };
}

// ============================================================================
// 2. Reviews Security & Identity Validation
// ============================================================================

export interface AuthenticatedUserIdentity {
  uid: string;
  email?: string;
  displayName?: string;
  idToken?: string;
}

export interface ReviewValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  review?: {
    id: string;
    user_id: string;
    user_name: string;
    google_place_id: string;
    rating: number;
    review_text: string;
    created_at: string;
  };
}

/**
 * Validates review submission:
 * - Requires authenticated token user.
 * - Derives user_id exclusively from user.uid (ignoring req.body.user_id).
 * - Derives user_name exclusively from verified profile display name or safe email fallback.
 * - Validates google_place_id and review_text.
 */
export function sanitizeReviewSubmission(
  user: AuthenticatedUserIdentity | null,
  body: any
): ReviewValidationResult {
  if (!user || !user.uid) {
    return {
      valid: false,
      statusCode: 401,
      error: 'Authentication required. Please provide a valid Firebase ID token.'
    };
  }

  const { google_place_id, rating = 5, review_text = '' } = body || {};

  const trimmedPlaceId = typeof google_place_id === 'string' ? google_place_id.trim() : '';
  const trimmedReviewText = typeof review_text === 'string' ? review_text.trim() : '';

  if (!trimmedPlaceId || !trimmedReviewText) {
    return {
      valid: false,
      statusCode: 400,
      error: 'google_place_id and review_text are required.'
    };
  }

  const sanitizedDisplayName = user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'MozBook Traveler';
  const numericRating = Math.min(5, Math.max(1, Number(rating) || 5));

  return {
    valid: true,
    statusCode: 200,
    review: {
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: user.uid,
      user_name: sanitizedDisplayName,
      google_place_id: trimmedPlaceId,
      rating: numericRating,
      review_text: trimmedReviewText,
      created_at: new Date().toISOString()
    }
  };
}

// ============================================================================
// 3. Social Check-Ins Security & Identity Validation
// ============================================================================

export interface CheckInValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  checkIn?: {
    id: string;
    user_id: string;
    user_name: string;
    google_place_id: string;
    place_name: string;
    latitude: number;
    longitude: number;
    trip_id?: string;
    checked_in_at: string;
    spot: string;
    note: string;
    expires_at: number;
  };
}

/**
 * Validates social check-in submission:
 * - Requires authenticated token user.
 * - Derives user_id exclusively from user.uid (never trusts client body user_id).
 * - Derives user_name exclusively from verified profile display name or safe fallback.
 * - Validates google_place_id and place_name.
 * - Check-ins are transient in-memory entries valid for active server session.
 */
export function sanitizeCheckInSubmission(
  user: AuthenticatedUserIdentity | null,
  body: any
): CheckInValidationResult {
  if (!user || !user.uid) {
    return {
      valid: false,
      statusCode: 401,
      error: 'Authentication required. Please provide a valid Firebase ID token.'
    };
  }

  const {
    google_place_id,
    place_name,
    latitude,
    longitude,
    trip_id = null,
    spot = 'Main Area',
    note = ''
  } = body || {};

  const trimmedPlaceId = typeof google_place_id === 'string' ? google_place_id.trim() : '';
  const trimmedPlaceName = typeof place_name === 'string' ? place_name.trim() : '';

  if (!trimmedPlaceId || !trimmedPlaceName) {
    return {
      valid: false,
      statusCode: 400,
      error: 'google_place_id and place_name are required.'
    };
  }

  const sanitizedDisplayName = user.displayName?.trim() || user.email?.split('@')[0]?.trim() || 'MozBook Traveler';

  return {
    valid: true,
    statusCode: 200,
    checkIn: {
      id: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      user_id: user.uid,
      user_name: sanitizedDisplayName,
      google_place_id: trimmedPlaceId,
      place_name: trimmedPlaceName,
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      trip_id: trip_id || undefined,
      checked_in_at: new Date().toISOString(),
      spot: (typeof spot === 'string' ? spot.trim() : '') || 'Main Dining Area',
      note: typeof note === 'string' ? note.trim() : '',
      expires_at: Date.now() + 3 * 3600000 // 3 hours validity in active server runtime
    }
  };
}

// ============================================================================
// 4. Legal Acceptance Security & Identity Validation
// ============================================================================

export interface LegalAcceptanceRecord {
  id: string;
  userId: string;
  documentType: string;
  documentVersionId: string;
  documentVersion: string;
  documentContentHash: string;
  acceptedAt: string;
  context: string;
  bookingId?: string;
  hostId?: string;
  userAgent?: string;
}

export const VALID_LEGAL_DOC_TYPES = [
  'terms_customer',
  'privacy_policy',
  'cancellation_refund_policy',
  'partner_agreement'
] as const;

export interface LegalAcceptanceValidationResult {
  valid: boolean;
  statusCode?: number;
  error?: string;
  acceptance?: LegalAcceptanceRecord;
}

/**
 * Validates legal acceptance submission:
 * - Requires authenticated token user.
 * - Sets userId exclusively from user.uid (never trusts req.body.userId or bodyUserId).
 * - Rejects unauthenticated requests with HTTP 401 without recording any record.
 * - Validates documentType and context.
 *
 * ARCHITECTURAL NOTICE:
 * The in-memory legal acceptance ledger records acceptance events for the active server session
 * to enforce idempotency and audit runtime transactions. It does NOT serve as permanent durable
 * legal evidence across server restarts. For durable legal non-repudiation, records should be
 * committed to a write-restricted Firestore audit collection.
 */
export function sanitizeLegalAcceptanceSubmission(
  user: AuthenticatedUserIdentity | null,
  body: any,
  userAgentHeader?: string
): LegalAcceptanceValidationResult {
  if (!user || !user.uid) {
    return {
      valid: false,
      statusCode: 401,
      error: 'Authentication required: A valid Firebase ID token is required to record legal acceptance.'
    };
  }

  const { documentType, documentVersionId, context, bookingId, hostId } = body || {};

  if (!documentType || !context) {
    return {
      valid: false,
      statusCode: 400,
      error: 'Missing required fields: documentType and context are mandatory.'
    };
  }

  if (!VALID_LEGAL_DOC_TYPES.includes(documentType)) {
    return {
      valid: false,
      statusCode: 400,
      error: `Invalid documentType '${documentType}'. Must be one of: ${VALID_LEGAL_DOC_TYPES.join(', ')}`
    };
  }

  return {
    valid: true,
    statusCode: 201,
    acceptance: {
      id: `leg_acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      userId: user.uid,
      documentType,
      documentVersionId: documentVersionId || 'v1',
      documentVersion: '1.0.0',
      documentContentHash: `sha256_${documentType}_1.0.0`,
      acceptedAt: new Date().toISOString(),
      context: String(context).trim(),
      bookingId: bookingId || undefined,
      hostId: hostId || undefined,
      userAgent: userAgentHeader || 'unknown'
    }
  };
}
