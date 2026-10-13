/**
 * PaySuite Server-Side Client (Stage 2B)
 *
 * AUTHORITATIVE TECHNICAL CONTRACT:
 * Strictly complies with PaySuite production OpenAPI 3.0.3 specification (openapi.yaml).
 * Live Production Gateway Only: https://paysuite.tech (No Sandbox/Test environments).
 *
 * SECURITY:
 * All PaySuite API credentials (PAYSUITE_API_TOKEN, PAYSUITE_WEBHOOK_SECRET)
 * are read ONLY on the server and NEVER exposed to frontend bundles or Firestore.
 */

import crypto from 'crypto';
import { PaySuitePaymentMethod } from '../types/payment';

export const PAYSUITE_BASE_URL = process.env.PAYSUITE_BASE_URL || 'https://paysuite.tech';

export interface CreatePaySuitePaymentParams {
  /** Total amount in Mozambican Meticais (MZN) - Authoritatively derived from MozBook booking */
  amount: number;

  /** Server-controlled unique booking reference (Max 50 characters) */
  reference: string;

  /** Human-readable transaction description */
  description?: string;

  /** Optional customer payment rail strictly from openapi.yaml */
  method?: PaySuitePaymentMethod;

  /** URL to redirect customer after PaySuite hosted checkout */
  return_url?: string;

  /** PaySuite Webhook notification endpoint for asynchronous confirmation */
  webhook_url?: string;

  /** Optional PaySuite Contact ULID */
  contact_id?: string;
}

export interface PaySuitePaymentResponse {
  /** PaySuite Payment Request ULID (e.g. 01H8X9V8X9Y8Z9A8B8C8D8E8F8) */
  id: string;
  amount: number;
  reference: string;
  status: 'pending' | 'paid';
  method?: string;
  checkout_url?: string;
  created_at: string;
}

export class PaySuiteError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'PaySuiteError';
  }
}

/**
 * Returns the server-configured PaySuite API Bearer Token.
 * Throws a safe PaySuiteError if not configured.
 */
function getApiToken(): string {
  const token = process.env.PAYSUITE_API_TOKEN;
  if (!token || token === 'MY_PAYSUITE_API_TOKEN' || token.trim().length === 0) {
    throw new PaySuiteError(
      'PaySuite API token is not configured on the server. Set PAYSUITE_API_TOKEN in server environment to enable live payment processing.',
      503
    );
  }
  return token.trim();
}

/**
 * Submits a Payment Request to PaySuite production API: POST /api/v1/payments
 *
 * Strictly adheres to PaySuite OpenAPI contract:
 * - Base URL: https://paysuite.tech
 * - Headers: Authorization: Bearer <API_TOKEN>, Content-Type: application/json, Accept: application/json
 * - Body: amount, reference, description, method, return_url, webhook_url, contact_id
 */
export async function requestPaySuitePayment(
  params: CreatePaySuitePaymentParams
): Promise<PaySuitePaymentResponse> {
  const token = getApiToken();
  const url = `${PAYSUITE_BASE_URL}/api/v1/payments`;

  // Build request payload using ONLY documented OpenAPI fields
  const payload: Record<string, any> = {
    amount: Math.round(params.amount),
    reference: params.reference.substring(0, 50) // Enforce PaySuite 50-character limit
  };

  if (params.description) {
    payload.description = params.description.substring(0, 255);
  }

  if (params.method) {
    payload.method = params.method;
  }

  if (params.return_url) {
    payload.return_url = params.return_url;
  }

  if (params.webhook_url) {
    payload.webhook_url = params.webhook_url;
  }

  if (params.contact_id) {
    payload.contact_id = params.contact_id;
  }

  console.log(`[PaySuite] Creating payment request for reference: ${payload.reference}, amount: ${payload.amount} MZN`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr: any) {
    console.error('[PaySuite] Network communication failure:', netErr);
    throw new PaySuiteError(
      `Failed to connect to PaySuite gateway at ${PAYSUITE_BASE_URL}: ${netErr.message}`,
      502
    );
  }

  let responseJson: any = null;
  try {
    responseJson = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorMsg = responseJson?.message || responseJson?.error || `PaySuite returned HTTP ${response.status}`;
    console.error(`[PaySuite] API error (${response.status}):`, errorMsg);
    throw new PaySuiteError(errorMsg, response.status, responseJson);
  }

  // PaySuite wraps the payment object inside data: { ... } or top-level
  const paymentData = responseJson?.data || responseJson;

  if (!paymentData || !paymentData.id) {
    console.error('[PaySuite] Malformed API response:', responseJson);
    throw new PaySuiteError('PaySuite returned an invalid payment response (missing payment ID).', 502);
  }

  return {
    id: paymentData.id,
    amount: paymentData.amount || params.amount,
    reference: paymentData.reference || params.reference,
    status: paymentData.status || 'pending',
    method: paymentData.method || params.method,
    checkout_url: paymentData.checkout_url || `${PAYSUITE_BASE_URL}/pay/${paymentData.id}`,
    created_at: paymentData.created_at || new Date().toISOString()
  };
}

/**
 * Retrieves payment status from PaySuite production API: GET /api/v1/payments/{paymentId}
 * Used for server-side verification and status checks in Stage 2C.
 */
export async function fetchPaySuitePayment(paymentId: string): Promise<PaySuitePaymentResponse> {
  const token = getApiToken();
  const url = `${PAYSUITE_BASE_URL}/api/v1/payments/${encodeURIComponent(paymentId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = responseJson?.message || `Failed to fetch payment ${paymentId}`;
    throw new PaySuiteError(errorMsg, response.status, responseJson);
  }

  const paymentData = responseJson?.data || responseJson;
  return {
    id: paymentData.id,
    amount: paymentData.amount,
    reference: paymentData.reference,
    status: paymentData.status,
    method: paymentData.method,
    checkout_url: paymentData.checkout_url,
    created_at: paymentData.created_at
  };
}

// ============================================================================
// Official PaySuite Webhook Verification & Contracts (Stage 2C)
// ============================================================================

export interface PaySuiteWebhookData {
  id: string;
  amount?: number;
  reference?: string;
  status: 'paid' | 'failed' | 'completed' | 'cancelled' | string;
  method?: string;
  transaction_id?: string;
  payment_id?: string;
  refund_id?: string;
  reason?: string;
  created_at?: string;
  paid_at?: string;
  completed_at?: string;
}

export interface PaySuiteWebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'refund.completed' | 'refund.failed' | string;
  data: PaySuiteWebhookData;
}

// ============================================================================
// Official PaySuite Refund Client Methods (Prompt 28C / OpenAPI 3.0.3)
// ============================================================================

export interface CreatePaySuiteRefundParams {
  /** PaySuite Payment Request ULID (completed payment to refund) */
  payment_id: string;
  /** Optional amount to refund in MZN (defaults to full remaining amount if omitted) */
  amount?: number;
  /** Optional reason for the refund */
  reason?: string;
}

export interface PaySuiteRefundResponse {
  id: string;
  payment_id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  reason?: string;
  created_at: string;
}

/**
 * Creates a refund request on PaySuite production API: POST /api/v1/refunds
 *
 * Strict OpenAPI compliance:
 * - Base URL: https://paysuite.tech
 * - Headers: Authorization: Bearer <API_TOKEN>, Content-Type: application/json, Accept: application/json
 * - Body: payment_id (required), amount (optional), reason (optional)
 */
export async function requestPaySuiteRefund(
  params: CreatePaySuiteRefundParams
): Promise<PaySuiteRefundResponse> {
  const token = getApiToken();
  const url = `${PAYSUITE_BASE_URL}/api/v1/refunds`;

  const payload: Record<string, any> = {
    payment_id: params.payment_id
  };

  if (params.amount !== undefined && params.amount > 0) {
    payload.amount = Math.round(params.amount);
  }

  if (params.reason) {
    payload.reason = params.reason.substring(0, 255);
  }

  console.log(`[PaySuite] Submitting refund request for payment_id: ${params.payment_id}, amount: ${payload.amount || 'full'} MZN`);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (netErr: any) {
    console.error('[PaySuite Refund] Network communication failure:', netErr);
    throw new PaySuiteError(
      `Failed to connect to PaySuite refund service at ${PAYSUITE_BASE_URL}: ${netErr.message}`,
      502
    );
  }

  let responseJson: any = null;
  try {
    responseJson = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const errorMsg = responseJson?.message || responseJson?.error || `PaySuite refund returned HTTP ${response.status}`;
    console.error(`[PaySuite Refund] API error (${response.status}):`, errorMsg);
    throw new PaySuiteError(errorMsg, response.status, responseJson);
  }

  const refundData = responseJson?.data || responseJson;
  if (!refundData || !refundData.id) {
    console.error('[PaySuite Refund] Malformed response:', responseJson);
    throw new PaySuiteError('PaySuite returned an invalid refund response (missing refund ID).', 502);
  }

  return {
    id: refundData.id,
    payment_id: refundData.payment_id || params.payment_id,
    amount: refundData.amount || params.amount || 0,
    status: refundData.status || 'pending',
    reason: refundData.reason || params.reason,
    created_at: refundData.created_at || new Date().toISOString()
  };
}

/**
 * Retrieves refund status from PaySuite production API: GET /api/v1/refunds/{id}
 */
export async function fetchPaySuiteRefund(refundId: string): Promise<PaySuiteRefundResponse> {
  const token = getApiToken();
  const url = `${PAYSUITE_BASE_URL}/api/v1/refunds/${encodeURIComponent(refundId)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = responseJson?.message || `Failed to fetch refund ${refundId}`;
    throw new PaySuiteError(errorMsg, response.status, responseJson);
  }

  const data = responseJson?.data || responseJson;
  return {
    id: data.id,
    payment_id: data.payment_id,
    amount: data.amount,
    status: data.status || 'pending',
    reason: data.reason,
    created_at: data.created_at || new Date().toISOString()
  };
}

/**
 * Lists refund requests from PaySuite production API: GET /api/v1/refunds
 */
export async function listPaySuiteRefunds(): Promise<PaySuiteRefundResponse[]> {
  const token = getApiToken();
  const url = `${PAYSUITE_BASE_URL}/api/v1/refunds`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = responseJson?.message || 'Failed to list refunds';
    throw new PaySuiteError(errorMsg, response.status, responseJson);
  }

  const items = Array.isArray(responseJson?.data) ? responseJson.data : Array.isArray(responseJson) ? responseJson : [];
  return items.map((r: any) => ({
    id: r.id,
    payment_id: r.payment_id,
    amount: r.amount,
    status: r.status || 'pending',
    reason: r.reason,
    created_at: r.created_at
  }));
}

/**
 * Validates the PaySuite Webhook HMAC-SHA256 signature against the raw request body.
 *
 * SPECIFICATION:
 * - Header: X-Signature (or X-Webhook-Signature)
 * - Algorithm: HMAC-SHA256
 * - Key: PAYSUITE_WEBHOOK_SECRET
 * - Comparison: crypto.timingSafeEqual to avoid timing side-channel attacks
 */
export function verifyPaySuiteWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader?: string
): boolean {
  const secret = process.env.PAYSUITE_WEBHOOK_SECRET;
  if (!secret || secret === 'MY_PAYSUITE_WEBHOOK_SECRET' || secret.trim().length === 0) {
    console.warn('[PaySuite Webhook] PAYSUITE_WEBHOOK_SECRET is not configured on the server.');
    return false;
  }

  if (!signatureHeader || typeof signatureHeader !== 'string' || signatureHeader.trim().length === 0) {
    console.warn('[PaySuite Webhook] Missing signature header on incoming webhook.');
    return false;
  }

  const cleanSignature = signatureHeader.trim().toLowerCase();

  try {
    const hmac = crypto.createHmac('sha256', secret.trim());
    hmac.update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody);
    const expectedSignature = hmac.digest('hex').toLowerCase();

    if (cleanSignature.length !== expectedSignature.length) {
      return false;
    }

    const signatureBuffer = Buffer.from(cleanSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch (err) {
    console.error('[PaySuite Webhook] Signature calculation error:', err);
    return false;
  }
}

