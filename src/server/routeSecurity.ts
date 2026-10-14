import type { Request, Response, NextFunction } from 'express';

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
 * Middleware: Enforces request body size limit BEFORE body parsing or buffering.
 * Checks the Content-Length header and rejects oversized payloads with HTTP 413.
 */
export function createOcrPayloadSizeGuard(maxBytes: number = OCR_MAX_BODY_BYTES) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLengthHeader = req.headers['content-length'];
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader, 10);
      if (!isNaN(contentLength) && contentLength > maxBytes) {
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
 * Middleware: Enforces per-instance rate limiting on OCR document extraction.
 * Rejects requests exceeding threshold with HTTP 429 and Retry-After header.
 */
export function createOcrRateLimitMiddleware(limiter: OcrRateLimiter = defaultOcrRateLimiter) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown-client';

    const check = limiter.checkLimit(clientIp);
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
