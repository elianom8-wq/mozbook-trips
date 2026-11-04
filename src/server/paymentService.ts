/**
 * MozBook Authoritative Server-Side Payment Engine (Stage 2B)
 *
 * ARCHITECTURAL PRINCIPLE:
 * THE MOZBOOK BACKEND/PAYMENT REGISTRY IS AUTHORITATIVE.
 * The frontend, browser return, customer, and host must NEVER be able to declare a booking paid.
 *
 * This service manages the authoritative internal payment registry (`payments` collection),
 * validates booking eligibility, prevents client-side amount tampering, and coordinates
 * with the PaySuite production gateway.
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { PaymentLedgerEntry, PaySuitePaymentMethod, RefundRecord } from '../types/payment';
import { 
  requestPaySuitePayment, 
  requestPaySuiteRefund,
  fetchPaySuiteRefund,
  listPaySuiteRefunds,
  PaySuiteError, 
  verifyPaySuiteWebhookSignature, 
  PaySuiteWebhookPayload,
  getProductionAppUrl,
  getProductionWebhookUrl
} from './paysuiteClient';
import { initializeApp as initAdminApp, getApps as getAdminApps, App as AdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore, FieldValue as AdminFieldValue } from 'firebase-admin/firestore';

let adminAppInstance: AdminApp | null = null;
let adminDbInstance: AdminFirestore | null = null;

export function getPrivilegedFirestore(): AdminFirestore {
  if (!adminDbInstance) {
    adminAppInstance = getAdminApps().length === 0
      ? initAdminApp({ projectId: firebaseConfig.projectId })
      : getAdminApps()[0];
    adminDbInstance = getAdminFirestore(adminAppInstance, firebaseConfig.firestoreDatabaseId);
  }
  return adminDbInstance;
}

export interface CreatePaymentIntentParams {
  bookingId: string;
  bookingCategory?: 'stay' | 'activity' | 'trip';
  paymentMethod?: PaySuitePaymentMethod;
  customReturnUrl?: string;
  authenticatedUser: {
    uid: string;
    email?: string;
    displayName?: string;
    idToken?: string;
  };
}

export function parseFirestoreDoc(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if ('stringValue' in val) result[key] = val.stringValue;
    else if ('integerValue' in val) result[key] = Number(val.integerValue);
    else if ('doubleValue' in val) result[key] = Number(val.doubleValue);
    else if ('booleanValue' in val) result[key] = val.booleanValue;
    else if ('timestampValue' in val) result[key] = val.timestampValue;
    else if ('mapValue' in val) result[key] = parseFirestoreDoc(val.mapValue?.fields || {});
    else if ('arrayValue' in val) result[key] = (val.arrayValue?.values || []).map((v: any) => Object.values(v)[0]);
  }
  return result;
}

async function fetchFirestoreDocument(
  coll: string, 
  id: string, 
  idToken?: string
): Promise<{ exists: boolean; data: () => any }> {
  // If user provided a Bearer ID token, query Firestore REST API directly for instant sub-100ms response
  if (idToken) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${firebaseConfig.firestoreDatabaseId}/documents/${coll}/${id}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${idToken}` }
      });
      if (res.ok) {
        const json = await res.json();
        const parsed = parseFirestoreDoc(json.fields || {});
        return { exists: true, data: () => parsed };
      } else if (res.status === 404) {
        return { exists: false, data: () => null };
      }
    } catch (restErr) {
      console.warn('[PaymentService] REST lookup error:', restErr);
    }
  }

  // Fallback to client SDK with a 2-second timeout guard
  try {
    const snapPromise = getDoc(doc(db, coll, id));
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Firestore SDK timeout')), 2000)
    );
    const snap = await Promise.race([snapPromise, timeoutPromise]);
    if (snap && snap.exists()) {
      return { exists: true, data: () => snap.data() };
    }
  } catch (sdkErr: any) {
    // SDK timed out or permission denied
  }

  return { exists: false, data: () => null };
}

export interface PaymentIntentResult {
  success: boolean;
  paymentId: string;
  bookingId: string;
  bookingRef: string;
  amount: number;
  currency: 'MZN';
  checkoutUrl?: string;
  status: 'pending';
  reusedExisting?: boolean;
}

/**
 * Creates or reuses a pending PaySuite payment intent for an existing MozBook reservation.
 *
 * STRICT SERVER VALIDATIONS ENFORCED:
 * 1. Booking must exist in authoritative Firestore collections.
 * 2. Authenticated user must be authorized to pay for that booking.
 * 3. Booking must not be cancelled.
 * 4. Booking must not already be paid.
 * 5. Amount is authoritatively derived from the stored booking record (Client cannot tamper with amount).
 * 6. Currency is strictly MZN.
 * 7. Active pending payment intents are reused if recently created to prevent duplicate charges.
 * 8. Booking remains status: 'pending', paymentStatus: 'unpaid', fulfillmentStatus: 'unfulfilled'.
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<PaymentIntentResult> {
  const { bookingId, bookingCategory = 'stay', paymentMethod, customReturnUrl, authenticatedUser } = params;

  if (!bookingId || typeof bookingId !== 'string') {
    throw new PaySuiteError('Invalid bookingId provided.', 400);
  }

  // 1. Fetch authoritative booking from Firestore
  let targetCollection = 'bookings';
  if (bookingCategory === 'activity' || bookingCategory === 'trip') {
    targetCollection = 'activity_bookings';
  }

  let bookingDoc = await fetchFirestoreDocument(targetCollection, bookingId, authenticatedUser.idToken);
  let resolvedCategory: 'stay' | 'activity' | 'trip' = bookingCategory;

  // Fallback: If not found in primary collection, check alternate collection
  if (!bookingDoc.exists && targetCollection === 'bookings') {
    const actDoc = await fetchFirestoreDocument('activity_bookings', bookingId, authenticatedUser.idToken);
    if (actDoc.exists) {
      bookingDoc = actDoc;
      targetCollection = 'activity_bookings';
      resolvedCategory = 'activity';
    }
  }

  if (!bookingDoc.exists) {
    throw new PaySuiteError(`Booking '${bookingId}' not found.`, 404);
  }

  const booking = bookingDoc.data();

  // 2. Validate customer authorization (Payer must own or be party to the booking)
  const bookingUserId = booking.userId || '';
  const customerEmail = booking.customerEmail || '';
  const isAuthorized = 
    bookingUserId === authenticatedUser.uid ||
    (authenticatedUser.email && customerEmail && authenticatedUser.email.toLowerCase() === customerEmail.toLowerCase());

  if (!isAuthorized) {
    throw new PaySuiteError(
      'Unauthorized: You are not authorized to initiate payment for this reservation.',
      403
    );
  }

  // 3. Validate booking lifecycle state
  if (booking.status === 'cancelled') {
    throw new PaySuiteError('Cannot initiate payment for a cancelled reservation.', 400);
  }

  // 4. Validate that booking is not already paid
  if (booking.paymentStatus === 'paid') {
    throw new PaySuiteError('This reservation has already been paid and settled.', 400);
  }

  // 5. Authoritative amount extraction (STRICT SECURITY: Ignore any client amount!)
  const authoritativeAmount = Number(booking.totalAmount || booking.totalMzn || 0);
  if (!authoritativeAmount || isNaN(authoritativeAmount) || authoritativeAmount <= 0) {
    throw new PaySuiteError('Authoritative booking record does not have a valid payable amount.', 400);
  }

  // 6. Currency validation
  const currency = (booking.currency || 'MZN').toUpperCase();
  if (currency !== 'MZN') {
    throw new PaySuiteError(`Unsupported currency '${currency}'. PaySuite strictly processes MZN.`, 400);
  }

  const bookingRef = booking.bookingRef || `MB-REF-${bookingId.substring(0, 8)}`;
  const hostId = booking.hostId || 'unknown_host';
  const travelGroupId = booking.travelGroupId || undefined;

  // 7. Duplicate payment check (Idempotency)
  // Check if a pending payment intent already exists for this booking in the payments collection
  try {
    const paymentsColl = collection(db, 'payments');
    const existingQ = query(
      paymentsColl,
      where('bookingId', '==', bookingId),
      where('status', '==', 'pending')
    );
    const existingSnap = await getDocs(existingQ);

    if (!existingSnap.empty) {
      // Find the most recent pending payment intent
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data() as PaymentLedgerEntry;

      // If created within the last 15 minutes and has checkoutUrl, safely reuse
      const createdAt = new Date(existingData.createdAt).getTime();
      const ageMinutes = (Date.now() - createdAt) / (1000 * 60);

      if (ageMinutes < 15 && existingData.checkoutUrl) {
        console.log(`[PaymentService] Reusing active pending payment intent '${existingData.id}' for booking '${bookingId}'`);
        return {
          success: true,
          paymentId: existingData.id,
          bookingId,
          bookingRef: existingData.bookingRef,
          amount: existingData.amount,
          currency: 'MZN',
          checkoutUrl: existingData.checkoutUrl,
          status: 'pending',
          reusedExisting: true
        };
      }
    }
  } catch (lookupErr) {
    console.warn('[PaymentService] Error checking existing pending payments:', lookupErr);
  }

  // 8. Construct unique MozBook Payment Registry ID
  const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const idempotencyKey = `mb_idem_${bookingId}_${Date.now()}`;
  const appUrl = getProductionAppUrl();
  const defaultReturnUrl = `${appUrl}/booking/${bookingId}/status?ref=${encodeURIComponent(bookingRef)}`;
  const returnUrl = customReturnUrl || defaultReturnUrl;
  const webhookUrl = getProductionWebhookUrl();

  // 9. Call PaySuite production API
  const paysuiteResponse = await requestPaySuitePayment({
    amount: authoritativeAmount,
    reference: bookingRef,
    description: `MozBook reservation ${bookingRef} (${resolvedCategory})`,
    method: paymentMethod,
    return_url: returnUrl,
    webhook_url: webhookUrl
  });

  // 10. Persist authoritative entry in MozBook payment registry (Collection: 'payments')
  const nowIso = new Date().toISOString();
  const paymentEntry: PaymentLedgerEntry = {
    id: paymentId,
    bookingId,
    bookingCategory: resolvedCategory,
    bookingRef,
    payerUserId: authenticatedUser.uid,
    payerName: authenticatedUser.displayName || booking.customerName || 'Guest Traveler',
    payerEmail: authenticatedUser.email || booking.customerEmail || '',
    payerPhone: booking.customerPhone || undefined,
    hostId,
    travelGroupId,
    amount: authoritativeAmount,
    currency: 'MZN',
    paymentMethod,
    status: 'pending',
    checkoutUrl: paysuiteResponse.checkout_url,
    paysuitePaymentId: paysuiteResponse.id,
    idempotencyKey,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  try {
    await setDoc(doc(db, 'payments', paymentId), {
      ...paymentEntry,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp()
    });
    console.log(`[PaymentService] Successfully recorded payment ledger entry '${paymentId}' with PaySuite ID '${paysuiteResponse.id}'`);
  } catch (regErr: any) {
    console.error('[PaymentService] Failed to write to payments collection:', regErr);
    // Even if local firestore write experiences an issue, payment has been generated
  }

  // 11. Update booking linkage without advancing payment status
  // STRICT RULE: Booking remains status: 'pending', paymentStatus: 'unpaid', fulfillmentStatus: 'unfulfilled'
  try {
    await updateDoc(doc(db, targetCollection, bookingId), {
      paymentId,
      paysuitePaymentId: paysuiteResponse.id,
      updatedAt: serverTimestamp()
    });
  } catch (updErr) {
    console.warn(`[PaymentService] Could not link paymentId on booking '${bookingId}':`, updErr);
  }

  // 12. Guard in-flight inventory hold against expiration race (Prompt 28C - Part 4)
  try {
    const { markPaymentInFlight } = await import('./inventoryService');
    await markPaymentInFlight(bookingId, resolvedCategory);
  } catch (holdErr) {
    console.warn(`[PaymentService] Could not mark in-flight inventory hold for booking '${bookingId}':`, holdErr);
  }

  return {
    success: true,
    paymentId,
    bookingId,
    bookingRef,
    amount: authoritativeAmount,
    currency: 'MZN',
    checkoutUrl: paysuiteResponse.checkout_url,
    status: 'pending',
    reusedExisting: false
  };
}

/**
 * Retrieves the authoritative payment record by ID
 */
export async function getAuthoritativePayment(paymentId: string): Promise<PaymentLedgerEntry | null> {
  try {
    const adminDb = getPrivilegedFirestore();
    const snap = await adminDb.collection('payments').doc(paymentId).get();
    if (snap.exists) {
      return snap.data() as PaymentLedgerEntry;
    }
  } catch (err) {
    console.error(`[PaymentService] Failed to fetch payment '${paymentId}':`, err);
  }
  return null;
}

/**
 * Authoritative Admin / Role Authorization Helper
 * Reused across all admin and privileged resource checks.
 */
export function isUserAdmin(user: { uid: string; email?: string; role?: string } | null | undefined): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  return email === 'mozbookinfo@gmail.com' || email === 'admin@mozbook.mz' || user.role === 'admin';
}

/**
 * Retrieves the authoritative booking record across Stays and Activities
 */
export async function getAuthoritativeBooking(bookingId: string): Promise<{ data: any; category: 'stay' | 'activity' | 'trip' } | null> {
  try {
    const adminDb = getPrivilegedFirestore();
    const staySnap = await adminDb.collection('bookings').doc(bookingId).get();
    if (staySnap.exists) {
      return { data: { id: staySnap.id, ...staySnap.data() }, category: 'stay' };
    }

    const actSnap = await adminDb.collection('activity_bookings').doc(bookingId).get();
    if (actSnap.exists) {
      const actData = actSnap.data() || {};
      return {
        data: { id: actSnap.id, ...actData },
        category: actData.activityType === 'trip' ? 'trip' : 'activity'
      };
    }
  } catch (err) {
    console.error(`[PaymentService] Error loading authoritative booking '${bookingId}':`, err);
  }
  return null;
}

// ============================================================================
// Authoritative PaySuite Webhook Processor (Stage 2C)
// Privileged Server-Side State Transitions via Firebase Admin SDK
// ============================================================================

export interface WebhookProcessResult {
  success: boolean;
  statusCode: number;
  status?: string;
  message?: string;
  error?: string;
  paymentId?: string;
  bookingId?: string;
  bookingRef?: string;
}

export async function processPaySuiteWebhook(
  payload: PaySuiteWebhookPayload,
  rawBody: Buffer | string,
  signatureHeader?: string
): Promise<WebhookProcessResult> {
  const logPrefix = `[PaySuite Webhook ${Date.now()}]`;
  console.log(`${logPrefix} Processing incoming webhook event: ${payload?.event}`);

  // 1. Webhook Signature Verification (HMAC-SHA256 with timingSafeEqual)
  const isSignatureValid = verifyPaySuiteWebhookSignature(rawBody, signatureHeader);
  if (!isSignatureValid) {
    console.error(`${logPrefix} Webhook signature verification FAILED.`);
    return {
      success: false,
      statusCode: 401,
      error: 'Invalid or missing X-Signature webhook signature.'
    };
  }
  console.log(`${logPrefix} Webhook signature verified successfully.`);

  // 2. Validate payload structure
  if (!payload || !payload.event || !payload.data) {
    console.error(`${logPrefix} Malformed webhook payload: missing event or data.`);
    return {
      success: false,
      statusCode: 400,
      error: 'Malformed webhook payload structure.'
    };
  }

  const adminDb = getPrivilegedFirestore();
  const eventName = payload.event;
  const data: any = payload.data || {};
  const { 
    id: paysuiteId, 
    payment_id: refundPaymentId, 
    amount, 
    reference, 
    status: webhookStatus, 
    transaction_id, 
    paid_at, 
    reason 
  } = data;

  // 3. Handle Host Payout Events (payout.completed, payout.failed)
  if (eventName.startsWith('payout.')) {
    console.log(`${logPrefix} Processing payout webhook: ${eventName}`);
    const payoutId = paysuiteId;
    const payoutRef = reference;

    let matchedPayoutDoc: any = null;
    try {
      if (payoutId) {
        const qSnap = await adminDb.collection('payout_requests')
          .where('paysuitePayoutId', '==', payoutId)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          matchedPayoutDoc = qSnap.docs[0];
        }
      }
      if (!matchedPayoutDoc && payoutRef) {
        const qSnap = await adminDb.collection('payout_requests')
          .where('reference', '==', payoutRef)
          .limit(1)
          .get();
        if (!qSnap.empty) {
          matchedPayoutDoc = qSnap.docs[0];
        } else {
          const dSnap = await adminDb.collection('payout_requests').doc(payoutRef).get();
          if (dSnap.exists) {
            matchedPayoutDoc = dSnap;
          }
        }
      }
    } catch (payoutErr: any) {
      console.warn(`${logPrefix} Error querying payout_requests:`, payoutErr.message);
    }

    if (!matchedPayoutDoc) {
      console.error(`${logPrefix} No host payout request found for identifier '${payoutId || payoutRef}'.`);
      return {
        success: false,
        statusCode: 404,
        error: `No host payout request found for PaySuite identifier '${payoutId || payoutRef}'.`
      };
    }

    const payoutData = matchedPayoutDoc.data();
    const isCompleted = eventName === 'payout.completed' || webhookStatus === 'completed';
    const isFailed = eventName === 'payout.failed' || webhookStatus === 'failed';

    if (isCompleted) {
      if (payoutData.status === 'completed') {
        return {
          success: true,
          statusCode: 200,
          status: 'already_completed',
          message: 'Payout was already completed and settled.'
        };
      }
      try {
        await matchedPayoutDoc.ref.update({
          status: 'completed',
          completedAt: paid_at || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        await adminDb.collection('payment_audit_logs').add({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: eventName,
          payoutId: matchedPayoutDoc.id,
          reference: payoutData.reference,
          amount: payoutData.amount,
          status: 'completed',
          timestamp: new Date().toISOString(),
          createdAtServer: AdminFieldValue.serverTimestamp()
        });
        return {
          success: true,
          statusCode: 200,
          status: 'payout_completed',
          message: 'Payout completed successfully.'
        };
      } catch (err: any) {
        console.error(`${logPrefix} Failed to update payout completion:`, err.message);
        return {
          success: false,
          statusCode: 500,
          error: `Failed to update payout completion: ${err.message}`
        };
      }
    } else if (isFailed) {
      if (payoutData.status === 'failed') {
        return {
          success: true,
          statusCode: 200,
          status: 'already_failed',
          message: 'Payout failure was already recorded.'
        };
      }
      try {
        await matchedPayoutDoc.ref.update({
          status: 'failed',
          failureReason: reason || 'PaySuite payout delivery failed',
          updatedAt: new Date().toISOString()
        });
        await adminDb.collection('payment_audit_logs').add({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: eventName,
          payoutId: matchedPayoutDoc.id,
          reference: payoutData.reference,
          amount: payoutData.amount,
          status: 'failed',
          timestamp: new Date().toISOString(),
          createdAtServer: AdminFieldValue.serverTimestamp()
        });
        return {
          success: true,
          statusCode: 200,
          status: 'payout_failed_recorded',
          message: 'Payout failure recorded.'
        };
      } catch (err: any) {
        console.error(`${logPrefix} Failed to update payout failure:`, err.message);
        return {
          success: false,
          statusCode: 500,
          error: `Failed to update payout failure: ${err.message}`
        };
      }
    }
  }

  // 4. Validate identifier for payment/refund events
  const lookupPaymentId = refundPaymentId || paysuiteId;
  if (!lookupPaymentId && !reference) {
    console.error(`${logPrefix} Malformed webhook data: missing payment id and reference.`);
    return {
      success: false,
      statusCode: 400,
      error: 'Webhook data must include payment ID or reference.'
    };
  }

  // 5. Locate Authoritative MozBook Payment Ledger Record
  let matchedPayment: PaymentLedgerEntry | null = null;
  let paymentDocId: string | null = null;

  try {
    // A. Match by paysuitePaymentId
    if (lookupPaymentId) {
      const qSnap = await adminDb.collection('payments')
        .where('paysuitePaymentId', '==', lookupPaymentId)
        .limit(1)
        .get();

      if (!qSnap.empty) {
        matchedPayment = qSnap.docs[0].data() as PaymentLedgerEntry;
        paymentDocId = qSnap.docs[0].id;
      }
    }

    // B. Fallback: match by bookingRef or payment doc ID
    if (!matchedPayment && reference) {
      const qSnap = await adminDb.collection('payments')
        .where('bookingRef', '==', reference)
        .limit(1)
        .get();

      if (!qSnap.empty) {
        matchedPayment = qSnap.docs[0].data() as PaymentLedgerEntry;
        paymentDocId = qSnap.docs[0].id;
      } else {
        const docSnap = await adminDb.collection('payments').doc(reference).get();
        if (docSnap.exists) {
          matchedPayment = docSnap.data() as PaymentLedgerEntry;
          paymentDocId = docSnap.id;
        }
      }
    }

    // C. Fallback for refund events: match by paysuiteRefundId in refunds collection
    if (!matchedPayment && paysuiteId) {
      const rSnap = await adminDb.collection('refunds')
        .where('paysuiteRefundId', '==', paysuiteId)
        .limit(1)
        .get();

      if (!rSnap.empty) {
        const rData = rSnap.docs[0].data();
        if (rData.paymentId) {
          const pDoc = await adminDb.collection('payments').doc(rData.paymentId).get();
          if (pDoc.exists) {
            matchedPayment = pDoc.data() as PaymentLedgerEntry;
            paymentDocId = pDoc.id;
          }
        }
      }
    }
  } catch (lookupErr: any) {
    console.warn(`${logPrefix} Admin query error during payment lookup:`, lookupErr.message);
  }

  if (!matchedPayment || !paymentDocId) {
    console.error(`${logPrefix} Unknown payment: No MozBook payment record matched (ID: ${lookupPaymentId || paysuiteId}, Ref: ${reference}).`);
    return {
      success: false,
      statusCode: 404,
      error: `No MozBook payment record found for PaySuite identifier '${lookupPaymentId || paysuiteId || reference}'.`
    };
  }

  console.log(`${logPrefix} Matched payment '${paymentDocId}' (Booking: ${matchedPayment.bookingId}, Ref: ${matchedPayment.bookingRef}).`);

  // 6. Locate Associated Booking Document
  const targetCollection = matchedPayment.bookingCategory === 'activity' || matchedPayment.bookingCategory === 'trip'
    ? 'activity_bookings'
    : 'bookings';

  let booking: any = null;
  try {
    const bookingDocSnap = await adminDb.collection(targetCollection).doc(matchedPayment.bookingId).get();
    if (bookingDocSnap.exists) {
      booking = bookingDocSnap.data();
    }
  } catch (bErr: any) {
    console.warn(`${logPrefix} Error loading booking document:`, bErr.message);
  }

  if (!booking) {
    console.error(`${logPrefix} Associated booking '${matchedPayment.bookingId}' not found in ${targetCollection}.`);
    return {
      success: false,
      statusCode: 404,
      error: `Associated reservation '${matchedPayment.bookingId}' not found.`
    };
  }

  // 7. Event Classification
  const isPaymentSuccessEvent = 
    eventName === 'payment.success' || 
    eventName === 'payment.completed' || 
    (eventName.startsWith('payment.') && webhookStatus === 'paid');

  const isPaymentFailedEvent = 
    eventName === 'payment.failed' || 
    (eventName.startsWith('payment.') && webhookStatus === 'failed');

  const isPaymentPendingEvent = 
    eventName === 'payment.pending' || 
    (eventName.startsWith('payment.') && webhookStatus === 'pending');

  const isRefundSuccessEvent = 
    eventName === 'refund.success' || 
    eventName === 'refund.completed' || 
    (eventName.startsWith('refund.') && (webhookStatus === 'completed' || webhookStatus === 'paid'));

  const isRefundFailedEvent = 
    eventName === 'refund.failed' || 
    (eventName.startsWith('refund.') && webhookStatus === 'failed');

  // 8. Financial and Lifecycle Integrity Checks
  const authoritativeCurrency = (booking.currency || matchedPayment.currency || 'MZN').toUpperCase();
  if (authoritativeCurrency !== 'MZN') {
    console.error(`${logPrefix} Currency mismatch: expected MZN, got '${authoritativeCurrency}'.`);
    return {
      success: false,
      statusCode: 422,
      error: `Unsupported currency '${authoritativeCurrency}'. PaySuite only processes MZN.`
    };
  }

  // Cancelled booking guard: Cannot confirm payment for an already cancelled booking
  if (booking.status === 'cancelled' && isPaymentSuccessEvent) {
    console.error(`${logPrefix} Booking '${matchedPayment.bookingId}' is cancelled. Rejecting payment confirmation.`);
    return {
      success: false,
      statusCode: 400,
      error: 'Cannot apply payment to a cancelled reservation.'
    };
  }

  const paymentAmount = Math.round(Number(matchedPayment.amount));
  const bookingAmount = Math.round(Number(booking.totalAmount || booking.totalMzn || 0));
  const webhookAmount = amount !== undefined ? Math.round(Number(amount)) : paymentAmount;

  if (isPaymentSuccessEvent) {
    if (webhookAmount !== paymentAmount || paymentAmount !== bookingAmount) {
      console.error(
        `${logPrefix} Amount mismatch detected: Webhook=${webhookAmount}, PaymentRecord=${paymentAmount}, BookingRecord=${bookingAmount}. REJECTING.`
      );
      return {
        success: false,
        statusCode: 422,
        error: `Amount mismatch: PaySuite amount (${webhookAmount} MZN) does not match authoritative booking amount (${bookingAmount} MZN).`
      };
    }
  } else if (isRefundSuccessEvent) {
    if (webhookAmount <= 0 || webhookAmount > paymentAmount) {
      console.error(`${logPrefix} Invalid refund amount: ${webhookAmount} MZN (Payment: ${paymentAmount} MZN).`);
      return {
        success: false,
        statusCode: 422,
        error: `Invalid refund amount: ${webhookAmount} MZN exceeds payment amount ${paymentAmount} MZN.`
      };
    }
  }

  // 9. Idempotency Checks
  if (isPaymentSuccessEvent && matchedPayment.status === 'paid') {
    console.log(`${logPrefix} Duplicate webhook delivery: Payment '${paymentDocId}' is already settled.`);
    return {
      success: true,
      statusCode: 200,
      status: 'already_settled',
      message: 'Payment was already confirmed and settled.',
      paymentId: paymentDocId,
      bookingId: matchedPayment.bookingId,
      bookingRef: matchedPayment.bookingRef
    };
  }

  if (isPaymentFailedEvent && matchedPayment.status === 'failed') {
    console.log(`${logPrefix} Duplicate webhook delivery: Payment '${paymentDocId}' is already recorded as failed.`);
    return {
      success: true,
      statusCode: 200,
      status: 'already_failed',
      message: 'Payment was already recorded as failed.',
      paymentId: paymentDocId,
      bookingId: matchedPayment.bookingId
    };
  }

  if (isRefundSuccessEvent && matchedPayment.refundStatus === 'completed') {
    console.log(`${logPrefix} Duplicate webhook delivery: Refund for payment '${paymentDocId}' is already completed.`);
    return {
      success: true,
      statusCode: 200,
      status: 'already_refunded',
      message: 'Refund was already completed and settled.',
      paymentId: paymentDocId,
      bookingId: matchedPayment.bookingId
    };
  }

  if (isRefundFailedEvent && matchedPayment.refundStatus === 'failed') {
    console.log(`${logPrefix} Duplicate webhook delivery: Refund failure for '${paymentDocId}' was already recorded.`);
    return {
      success: true,
      statusCode: 200,
      status: 'already_refund_failed',
      message: 'Refund failure was already recorded.',
      paymentId: paymentDocId
    };
  }

  // 10. Handle Pending Payment Event (Keep reservation unconfirmed, acknowledge receipt)
  if (isPaymentPendingEvent) {
    console.log(`${logPrefix} Acknowledged pending payment event for '${paymentDocId}'.`);
    try {
      await adminDb.collection('payment_audit_logs').add({
        eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        eventType: eventName,
        paymentId: paymentDocId,
        bookingId: matchedPayment.bookingId,
        bookingRef: matchedPayment.bookingRef,
        amount: webhookAmount,
        currency: 'MZN',
        status: 'pending',
        paysuitePaymentId: paysuiteId || lookupPaymentId,
        timestamp: new Date().toISOString(),
        createdAtServer: AdminFieldValue.serverTimestamp()
      });
    } catch (auditErr) {
      console.warn(`${logPrefix} Audit log recording note:`, auditErr);
    }

    return {
      success: true,
      statusCode: 200,
      status: 'pending_acknowledged',
      message: 'Payment is pending. Reservation remains unconfirmed.',
      paymentId: paymentDocId,
      bookingId: matchedPayment.bookingId
    };
  }

  // 11. Authoritative State Transition: Successful Payment
  if (isPaymentSuccessEvent) {
    console.log(`${logPrefix} Executing authoritative settlement transition for payment '${paymentDocId}'...`);
    const settledAt = paid_at || new Date().toISOString();
    const txnRef = transaction_id || paysuiteId || lookupPaymentId;

    try {
      await adminDb.runTransaction(async (transaction) => {
        const pRef = adminDb.collection('payments').doc(paymentDocId!);
        const bRef = adminDb.collection(targetCollection).doc(matchedPayment!.bookingId);

        const currentPSnap = await transaction.get(pRef);
        const currentBSnap = await transaction.get(bRef);

        if (!currentPSnap.exists || !currentBSnap.exists) {
          throw new Error('Payment or booking document does not exist inside transaction.');
        }

        const currentPData = currentPSnap.data() as PaymentLedgerEntry;
        if (currentPData.status === 'paid') {
          return;
        }

        // Authoritative Payment State Transition
        transaction.update(pRef, {
          status: 'paid',
          paidAt: settledAt,
          paysuiteTransactionId: txnRef,
          verifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedAtServer: AdminFieldValue.serverTimestamp()
        });

        // Authoritative Booking State Transition
        // NOTE: fulfillmentStatus remains strictly 'unfulfilled' (paid != fulfilled!)
        transaction.update(bRef, {
          status: 'confirmed',
          paymentStatus: 'paid',
          fulfillmentStatus: 'unfulfilled',
          paidAt: settledAt,
          confirmedAt: new Date().toISOString(),
          updatedAt: AdminFieldValue.serverTimestamp()
        });
      });

      console.log(`${logPrefix} Settlement successful! Payment '${paymentDocId}' is PAID, Booking '${matchedPayment.bookingId}' is CONFIRMED.`);

      // Update atomic inventory slot to convert temporary hold to confirmed capacity
      try {
        const { confirmInventorySlotReservation } = await import('./inventoryService');
        await confirmInventorySlotReservation(matchedPayment.bookingId, matchedPayment.bookingCategory);
      } catch (slotErr) {
        console.warn(`${logPrefix} Inventory slot confirm note:`, slotErr);
      }

      // Record server audit log (Zero sensitive credentials)
      try {
        await adminDb.collection('payment_audit_logs').add({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: eventName,
          paymentId: paymentDocId,
          bookingId: matchedPayment.bookingId,
          bookingRef: matchedPayment.bookingRef,
          amount: webhookAmount,
          currency: 'MZN',
          status: 'settled',
          paysuitePaymentId: paysuiteId || lookupPaymentId,
          timestamp: new Date().toISOString(),
          createdAtServer: AdminFieldValue.serverTimestamp()
        });
      } catch (auditErr) {
        console.warn(`${logPrefix} Audit log recording note:`, auditErr);
      }

      return {
        success: true,
        statusCode: 200,
        status: 'settled',
        message: 'Payment successfully settled and reservation confirmed.',
        paymentId: paymentDocId,
        bookingId: matchedPayment.bookingId,
        bookingRef: matchedPayment.bookingRef
      };
    } catch (txErr: any) {
      console.error(`${logPrefix} Transaction failure during settlement:`, txErr.message);
      return {
        success: false,
        statusCode: 500,
        error: `Settlement transaction failed: ${txErr.message}`
      };
    }
  }

  // 12. Authoritative State Transition: Failed Payment
  if (isPaymentFailedEvent) {
    console.log(`${logPrefix} Recording payment failure for payment '${paymentDocId}'...`);
    try {
      await adminDb.collection('payments').doc(paymentDocId).update({
        status: 'failed',
        failureReason: reason || 'Payment transaction failed on PaySuite gateway',
        updatedAt: new Date().toISOString(),
        updatedAtServer: AdminFieldValue.serverTimestamp()
      });

      await adminDb.collection(targetCollection).doc(matchedPayment.bookingId).update({
        paymentStatus: 'failed',
        updatedAt: AdminFieldValue.serverTimestamp()
      });

      // Release atomic inventory hold
      try {
        const { releaseInventorySlotReservation } = await import('./inventoryService');
        await releaseInventorySlotReservation(matchedPayment.bookingId, matchedPayment.bookingCategory);
      } catch (relErr) {
        console.warn(`${logPrefix} Inventory hold release note:`, relErr);
      }

      try {
        await adminDb.collection('payment_audit_logs').add({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: eventName,
          paymentId: paymentDocId,
          bookingId: matchedPayment.bookingId,
          bookingRef: matchedPayment.bookingRef,
          amount: webhookAmount,
          currency: 'MZN',
          status: 'failed',
          paysuitePaymentId: paysuiteId || lookupPaymentId,
          timestamp: new Date().toISOString(),
          createdAtServer: AdminFieldValue.serverTimestamp()
        });
      } catch (auditErr) {
        console.warn(`${logPrefix} Audit log recording note:`, auditErr);
      }

      return {
        success: true,
        statusCode: 200,
        status: 'failed_recorded',
        message: 'Payment failure recorded. Booking remains unconfirmed.',
        paymentId: paymentDocId,
        bookingId: matchedPayment.bookingId
      };
    } catch (failErr: any) {
      console.error(`${logPrefix} Failed to record payment failure state:`, failErr.message);
      return {
        success: false,
        statusCode: 500,
        error: `Failed to record payment failure: ${failErr.message}`
      };
    }
  }

  // 13. Authoritative State Transition: Refund Success
  if (isRefundSuccessEvent) {
    console.log(`${logPrefix} Processing authoritative refund completion for payment '${paymentDocId}'...`);
    const completedAt = paid_at || new Date().toISOString();
    const refundAmount = Number(amount || matchedPayment.amount);

    try {
      await adminDb.runTransaction(async (transaction) => {
        const pRef = adminDb.collection('payments').doc(paymentDocId!);
        const bRef = adminDb.collection(targetCollection).doc(matchedPayment!.bookingId);

        transaction.update(pRef, {
          refundStatus: 'completed',
          status: 'refunded',
          refundAmount: refundAmount,
          updatedAt: new Date().toISOString(),
          updatedAtServer: AdminFieldValue.serverTimestamp()
        });

        transaction.update(bRef, {
          paymentStatus: 'refunded',
          refundStatus: 'completed',
          customerProtectionRefundMzn: refundAmount,
          updatedAt: AdminFieldValue.serverTimestamp()
        });
      });

      // Update matching refund records in refunds collection
      const refundDocs = await adminDb.collection('refunds')
        .where('paymentId', '==', paymentDocId)
        .get();
      if (!refundDocs.empty) {
        for (const rDoc of refundDocs.docs) {
          if (rDoc.data().status !== 'completed') {
            await rDoc.ref.update({
              status: 'completed',
              completedAt,
              updatedAt: new Date().toISOString()
            });
          }
        }
      }

      try {
        await adminDb.collection('payment_audit_logs').add({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: eventName,
          paymentId: paymentDocId,
          bookingId: matchedPayment.bookingId,
          bookingRef: matchedPayment.bookingRef,
          amount: refundAmount,
          currency: 'MZN',
          status: 'refunded',
          timestamp: new Date().toISOString(),
          createdAtServer: AdminFieldValue.serverTimestamp()
        });
      } catch (auditErr) {
        console.warn(`${logPrefix} Audit log recording note:`, auditErr);
      }

      return {
        success: true,
        statusCode: 200,
        status: 'refund_completed',
        message: 'Refund successfully completed and reconciled.',
        paymentId: paymentDocId,
        bookingId: matchedPayment.bookingId,
        bookingRef: matchedPayment.bookingRef
      };
    } catch (rErr: any) {
      console.error(`${logPrefix} Refund settlement transaction failure:`, rErr.message);
      return {
        success: false,
        statusCode: 500,
        error: `Refund settlement transaction failure: ${rErr.message}`
      };
    }
  }

  // 14. Authoritative State Transition: Refund Failure
  if (isRefundFailedEvent) {
    console.log(`${logPrefix} Recording refund failure for payment '${paymentDocId}'...`);
    try {
      const refundDocs = await adminDb.collection('refunds').where('paymentId', '==', paymentDocId).get();
      if (!refundDocs.empty) {
        for (const rDoc of refundDocs.docs) {
          if (rDoc.data().status !== 'completed') {
            await rDoc.ref.update({
              status: 'failed',
              failureReason: reason || 'Provider reported refund failure',
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
      await adminDb.collection('payments').doc(paymentDocId).update({
        refundStatus: 'failed',
        updatedAt: new Date().toISOString()
      });

      try {
        await adminDb.collection('payment_audit_logs').add({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          eventType: eventName,
          paymentId: paymentDocId,
          bookingId: matchedPayment.bookingId,
          status: 'refund_failed',
          timestamp: new Date().toISOString(),
          createdAtServer: AdminFieldValue.serverTimestamp()
        });
      } catch (auditErr) {
        console.warn(`${logPrefix} Audit log recording note:`, auditErr);
      }

      return {
        success: true,
        statusCode: 200,
        status: 'refund_failed_recorded',
        message: 'Refund failure recorded.',
        paymentId: paymentDocId
      };
    } catch (rFailErr: any) {
      console.error(`${logPrefix} Failed to record refund failure:`, rFailErr.message);
      return {
        success: false,
        statusCode: 500,
        error: `Failed to record refund failure: ${rFailErr.message}`
      };
    }
  }

  // 15. Other unhandled events (gracefully acknowledged with 200)
  return {
    success: true,
    statusCode: 200,
    status: 'unhandled_event_acknowledged',
    message: `Received event '${eventName}' without state transition.`
  };
}

// ============================================================================
// Authoritative Refund Service (Prompt 28C - Parts 2 & 3)
// ============================================================================

export interface CreateRefundRequestParams {
  bookingId: string;
  bookingCategory?: 'stay' | 'activity' | 'trip';
  amount?: number;
  reason: string;
  incidentType?: 'operator_inventory_failure' | 'customer_request' | 'weather' | 'admin_intervention' | 'duplicate_payment' | any;
  policyTier?: string;
  policyVersion?: string;
  retainedAmountMzn?: number;
  authenticatedUser: {
    uid: string;
    email?: string;
    displayName?: string;
  };
}

/**
 * Creates an authoritative refund request for a confirmed reservation (Prompt 28C / Stage 4A).
 *
 * Enforces strict requirements:
 * 1. Authenticates & authorizes requester.
 * 2. Verifies payment exists and is 'paid'.
 * 3. Prevents duplicate in-flight refund requests.
 * 4. Ensures cumulative refunds cannot exceed amount paid.
 * 5. Calls PaySuite POST /api/v1/refunds.
 * 6. Records refund record with truthful status (never claims money returned without provider confirmation).
 * 7. Links policy tier, version snapshot, and retained amounts.
 */
export async function createRefundRequest(params: CreateRefundRequestParams): Promise<{
  success: boolean;
  refundId: string;
  amount: number;
  status: string;
  paysuiteRefundId?: string;
  message: string;
}> {
  const { bookingId, bookingCategory = 'stay', amount, reason, incidentType, policyTier, policyVersion, retainedAmountMzn, authenticatedUser } = params;
  const adminDb = getPrivilegedFirestore();

  // 1. Fetch booking
  const targetCollection = bookingCategory === 'activity' || bookingCategory === 'trip' ? 'activity_bookings' : 'bookings';
  const bookingSnap = await adminDb.collection(targetCollection).doc(bookingId).get();
  if (!bookingSnap.exists) {
    throw new PaySuiteError(`Reservation '${bookingId}' not found.`, 404);
  }

  const booking = bookingSnap.data()!;

  // 2. Authorize requester
  const isOwner = booking.userId === authenticatedUser.uid || 
    (authenticatedUser.email && booking.customerEmail && authenticatedUser.email.toLowerCase() === booking.customerEmail.toLowerCase());
  const isHost = booking.hostId === authenticatedUser.uid;
  const isAdmin = isUserAdmin(authenticatedUser);

  if (!isOwner && !isHost && !isAdmin) {
    throw new PaySuiteError('Unauthorized: You are not authorized to request a refund for this reservation.', 403);
  }

  // 3. Locate paid payment in payments collection
  const paymentsSnap = await adminDb.collection('payments')
    .where('bookingId', '==', bookingId)
    .where('status', '==', 'paid')
    .limit(1)
    .get();

  if (paymentsSnap.empty) {
    throw new PaySuiteError('No confirmed paid payment found for this reservation. Cannot refund unpaid booking.', 400);
  }

  const paymentDoc = paymentsSnap.docs[0];
  const payment = paymentDoc.data() as PaymentLedgerEntry;
  const originalPaymentAmount = Number(payment.amount);

  // 4. Query existing refunds to validate cumulative amounts and prevent duplicates
  const existingRefundsSnap = await adminDb.collection('refunds')
    .where('paymentId', '==', paymentDoc.id)
    .get();

  let alreadyRefundedOrPending = 0;
  existingRefundsSnap.forEach(d => {
    const r = d.data() as RefundRecord;
    if (r.status === 'pending' || r.status === 'processing' || r.status === 'completed') {
      alreadyRefundedOrPending += Number(r.amount);
      if (r.status === 'pending' || r.status === 'processing') {
        throw new PaySuiteError('A refund request is already in progress for this payment.', 409);
      }
    }
  });

  const maxRefundable = Math.max(0, originalPaymentAmount - alreadyRefundedOrPending);
  if (maxRefundable <= 0) {
    throw new PaySuiteError('This payment has already been fully refunded.', 400);
  }

  const refundAmount = amount !== undefined && amount > 0 ? Math.min(amount, maxRefundable) : maxRefundable;

  // 5. Build Refund Record
  const now = new Date().toISOString();
  const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const commissionAdjustmentMzn = Math.round(refundAmount * 0.15);
  const partnerShareAdjustmentMzn = Math.round(refundAmount * 0.85);

  const refundRecord: RefundRecord = {
    id: refundId,
    paymentId: paymentDoc.id,
    paysuitePaymentId: payment.paysuitePaymentId || '',
    bookingId,
    bookingRef: payment.bookingRef,
    bookingCategory: payment.bookingCategory,
    hostId: payment.hostId || booking.hostId || 'unknown_host',
    requestedByUserId: authenticatedUser.uid,
    requestedByRole: isAdmin ? 'admin' : isHost ? 'host' : 'customer',
    amount: refundAmount,
    currency: 'MZN',
    originalPaymentAmount,
    reason,
    incidentType,
    policyTier: policyTier || (booking.cancellationSnapshot?.tierId ?? 'flexible'),
    policyVersion: policyVersion || (booking.cancellationSnapshot?.policyVersion ?? '1.0.0'),
    retainedAmountMzn: retainedAmountMzn !== undefined ? retainedAmountMzn : Math.max(0, originalPaymentAmount - refundAmount),
    gatewayFeeDeductedMzn: 0,
    status: 'pending',
    commissionAdjustmentMzn,
    partnerShareAdjustmentMzn,
    createdAt: now,
    updatedAt: now
  };

  // 6. Submit to PaySuite Production Gateway if paysuitePaymentId exists
  let paysuiteRefundId: string | undefined = undefined;
  let providerStatus: any = 'pending';
  let failureReason: string | undefined = undefined;

  if (payment.paysuitePaymentId) {
    try {
      const psRes = await requestPaySuiteRefund({
        payment_id: payment.paysuitePaymentId,
        amount: refundAmount,
        reason
      });
      paysuiteRefundId = psRes.id;
      providerStatus = psRes.status || 'pending';
      refundRecord.paysuiteRefundId = psRes.id;
      refundRecord.status = providerStatus;
    } catch (gatewayErr: any) {
      console.warn(`[RefundService] PaySuite refund gateway call returned: ${gatewayErr.message}`);
      failureReason = gatewayErr.message;
      // Do not simulate success! Record gateway response state accurately
      refundRecord.status = 'failed';
      refundRecord.failureReason = failureReason;
    }
  } else {
    failureReason = 'Payment record lacks external PaySuite payment identifier.';
    refundRecord.status = 'failed';
    refundRecord.failureReason = failureReason;
  }

  // 7. Persist authoritative refund record via Admin SDK
  await adminDb.collection('refunds').doc(refundId).set(refundRecord);

  // 8. Update payment doc and booking doc
  await paymentDoc.ref.update({
    refundId,
    refundStatus: refundRecord.status,
    refundAmount: alreadyRefundedOrPending + (refundRecord.status !== 'failed' ? refundAmount : 0),
    updatedAt: now
  });

  await bookingSnap.ref.update({
    refundId,
    refundStatus: refundRecord.status,
    customerProtectionRefundMzn: refundAmount,
    updatedAt: AdminFieldValue.serverTimestamp()
  });

  return {
    success: refundRecord.status !== 'failed',
    refundId,
    amount: refundAmount,
    status: refundRecord.status,
    paysuiteRefundId,
    message: refundRecord.status === 'failed'
      ? `Refund request logged with failure: ${failureReason}. Requires administrative gateway review.`
      : `Refund request submitted to provider in '${providerStatus}' status.`
  };
}

export async function getRefundById(refundId: string): Promise<RefundRecord | null> {
  const adminDb = getPrivilegedFirestore();
  const snap = await adminDb.collection('refunds').doc(refundId).get();
  if (snap.exists) {
    return snap.data() as RefundRecord;
  }
  return null;
}

export async function getRefundsForBooking(bookingId: string): Promise<RefundRecord[]> {
  const adminDb = getPrivilegedFirestore();
  const snap = await adminDb.collection('refunds').where('bookingId', '==', bookingId).get();
  const results: RefundRecord[] = [];
  snap.forEach(d => results.push(d.data() as RefundRecord));
  return results;
}

/**
 * Authoritatively polls and reconciles provider refund status with PaySuite GET /api/v1/refunds/{id}
 */
export async function syncPaySuiteRefundStatus(refundId: string): Promise<RefundRecord> {
  const adminDb = getPrivilegedFirestore();
  const rRef = adminDb.collection('refunds').doc(refundId);
  const rSnap = await rRef.get();
  if (!rSnap.exists) {
    throw new PaySuiteError(`Refund record '${refundId}' not found.`, 404);
  }

  const refund = rSnap.data() as RefundRecord;
  if (!refund.paysuiteRefundId) {
    return refund;
  }

  try {
    const providerRefund = await fetchPaySuiteRefund(refund.paysuiteRefundId);
    if (providerRefund && providerRefund.status) {
      const nowIso = new Date().toISOString();
      const updates: Partial<RefundRecord> = {
        status: providerRefund.status,
        updatedAt: nowIso
      };

      if (providerRefund.status === 'completed' && refund.status !== 'completed') {
        updates.completedAt = nowIso;
        const pRef = adminDb.collection('payments').doc(refund.paymentId);
        await pRef.update({
          refundStatus: 'completed',
          status: 'refunded',
          refundAmount: refund.amount,
          updatedAt: nowIso
        });

        const targetCollection = refund.bookingCategory === 'stay' ? 'bookings' : 'activity_bookings';
        await adminDb.collection(targetCollection).doc(refund.bookingId).update({
          paymentStatus: 'refunded',
          refundStatus: 'completed',
          customerProtectionRefundMzn: refund.amount,
          updatedAt: AdminFieldValue.serverTimestamp()
        });
      } else if (providerRefund.status === 'failed') {
        updates.failureReason = providerRefund.reason || 'Provider reported refund failure';
      }

      await rRef.update(updates);
      return { ...refund, ...updates };
    }
  } catch (err: any) {
    console.warn(`[RefundSync] Error checking PaySuite refund ${refund.paysuiteRefundId}:`, err.message);
  }

  return refund;
}
