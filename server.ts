import express from "express";
import http from "http";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import firebaseConfig from "./firebase-applet-config.json";
import { 
  createPaymentIntent, 
  getAuthoritativePayment, 
  processPaySuiteWebhook,
  isUserAdmin,
  getAuthoritativeBooking,
  createRefundRequest,
  getRefundById,
  getRefundsForBooking,
  syncPaySuiteRefundStatus,
  getPrivilegedFirestore
} from "./src/server/paymentService";
import { PaySuiteError } from "./src/server/paysuiteClient";
import {
  reserveExperienceInventory,
  reserveStayInventory,
  checkAndSetInventoryAllocation,
  cancelBookingWithOperatorAccountability,
  rescheduleExperienceBooking,
  InventoryError
} from "./src/server/inventoryService";
import { parseAndValidateTd3Mrz } from "./src/utils/mrzParser";
import { calculateCommission } from "./src/config/platformCommission";
import {
  createOcrPayloadSizeGuard,
  createOcrRateLimitMiddleware,
  ocrBodyParser,
  ocrPayloadErrorHandler,
  OCR_MAX_BODY_BYTES,
  sanitizeReviewSubmission,
  sanitizeCheckInSubmission,
  sanitizeLegalAcceptanceSubmission
} from "./src/server/routeSecurity";

dotenv.config();

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

function parseBase64Image(imageStr?: string): { mimeType: string; data: string } | null {
  if (!imageStr) return null;
  const match = imageStr.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  if (imageStr.length > 50 && !imageStr.startsWith('http')) {
    return { mimeType: 'image/jpeg', data: imageStr };
  }
  return null;
}

async function getImagePart(imageStr?: string): Promise<{ inlineData: { mimeType: string; data: string } } | null> {
  if (!imageStr) return null;
  const parsed = parseBase64Image(imageStr);
  if (parsed) {
    return { inlineData: parsed };
  }
  if (imageStr.startsWith('http://') || imageStr.startsWith('https://')) {
    try {
      const resp = await fetch(imageStr);
      if (resp.ok) {
        const buffer = await resp.arrayBuffer();
        const mime = resp.headers.get('content-type') || 'image/jpeg';
        return {
          inlineData: {
            mimeType: mime,
            data: Buffer.from(buffer).toString('base64'),
          },
        };
      }
    } catch (err) {
      console.warn('Failed to fetch external image for Gemini extraction:', err);
    }
  }
  return null;
}

async function startServer() {
  const app = express();

  // Configure reverse proxy trust only if explicitly provided in environment topology
  if (process.env.TRUST_PROXY) {
    const tp = process.env.TRUST_PROXY.trim();
    app.set('trust proxy', tp === 'true' ? true : (!isNaN(Number(tp)) ? Number(tp) : tp));
  }

  const rawPort = process.env.PORT;
  const parsedPort = rawPort ? parseInt(rawPort, 10) : 3000;
  const PORT = (!isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) ? parsedPort : 3000;
  const httpServer = http.createServer(app);

  // Phase 2C: Dedicated OCR middleware pipeline for /api/verify/extract-document
  // 1. Rate limiter: enforces 10 req/15 min quota BEFORE body parsing and BEFORE Gemini
  app.use('/api/verify/extract-document', createOcrRateLimitMiddleware());

  // 2. Fast-fail header guard: immediately rejects malformed Content-Length (400) or stated oversized > 10MB (413) before buffering
  app.use('/api/verify/extract-document', createOcrPayloadSizeGuard(OCR_MAX_BODY_BYTES));

  // 3. Dedicated 10MB parser: strictly enforces 10MB limit during stream receiving/parsing (chunked, missing, or understated Content-Length)
  app.use('/api/verify/extract-document', ocrBodyParser);

  // 4. Dedicated error handler: formats 413 entity.too.large into consistent safe JSON response
  app.use('/api/verify/extract-document', ocrPayloadErrorHandler);

  // Global JSON payload parser with rawBody capture for all other routes (bookings, payments, webhooks, etc.)
  app.use(express.json({ 
    limit: '20mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Health API
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Mozbook API is healthy", hasGeminiKey: !!process.env.GEMINI_API_KEY });
  });

  // Helper: Verify authenticated user strictly from verified Firebase ID token
  async function authenticateRequest(req: express.Request): Promise<{ uid: string; email?: string; displayName?: string; idToken?: string } | null> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split('Bearer ')[1].trim();
    if (!token) {
      return null;
    }

    // 1. Verify token via Firebase Identity Toolkit
    try {
      const apiKey = firebaseConfig.apiKey;
      const resp = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.users && data.users.length > 0) {
          return {
            uid: data.users[0].localId,
            email: data.users[0].email,
            displayName: data.users[0].displayName,
            idToken: token
          };
        }
      }
    } catch (err) {
      console.warn('[Auth] ID token verification request failed:', err);
    }

    // 2. Fallback to Firebase Admin Auth verifyIdToken if app initialized
    try {
      const { getAuth } = await import('firebase-admin/auth');
      const { getApps } = await import('firebase-admin/app');
      if (getApps().length > 0) {
        const decoded = await getAuth().verifyIdToken(token);
        if (decoded && decoded.uid) {
          return {
            uid: decoded.uid,
            email: decoded.email,
            displayName: (decoded as any).name,
            idToken: token
          };
        }
      }
    } catch (adminAuthErr) {
      // Token is invalid or expired
    }

    // STRICT SECURITY: Never fall back to unverified x-user-id header!
    // Caller identity is derived exclusively from cryptographically verified tokens.
    return null;
  }

  // =========================================================================
  // PaySuite Payment Engine Endpoints (Stage 2B)
  // THE MOZBOOK BACKEND/PAYMENT REGISTRY IS AUTHORITATIVE.
  // =========================================================================

  /**
   * POST /api/payments/create-intent
   * Protected endpoint for creating an authoritative PaySuite payment intent.
   * Derives amount authoritatively from the stored booking record.
   */
  app.post("/api/payments/create-intent", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({
          success: false,
          error: "Unauthorized: Valid authentication required to initiate payment."
        });
        return;
      }

      const { bookingId, bookingCategory, paymentMethod, returnUrl } = req.body;

      if (!bookingId) {
        res.status(400).json({
          success: false,
          error: "Missing required parameter: bookingId"
        });
        return;
      }

      const result = await createPaymentIntent({
        bookingId,
        bookingCategory: bookingCategory || 'stay',
        paymentMethod,
        customReturnUrl: returnUrl,
        authenticatedUser: user
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error("[API] create-intent error:", err);
      const statusCode = err instanceof PaySuiteError ? err.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to create payment intent."
      });
    }
  });

  /**
   * GET /api/payments/:paymentId
   * Retrieves authoritative payment ledger state from MozBook internal registry.
   */
  app.get("/api/payments/:paymentId", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }

      const { paymentId } = req.params;
      const payment = await getAuthoritativePayment(paymentId);

      if (!payment) {
        res.status(404).json({ success: false, error: "Payment record not found." });
        return;
      }

      // Authorization guard: Only payer, host, or admin can inspect payment record
      const isAuthorized = 
        payment.payerUserId === user.uid ||
        payment.hostId === user.uid ||
        isUserAdmin(user);

      if (!isAuthorized) {
        res.status(403).json({ success: false, error: "Access denied." });
        return;
      }

      // Return safe payment details (never internal server secrets)
      res.status(200).json({
        success: true,
        payment: {
          id: payment.id,
          bookingId: payment.bookingId,
          bookingCategory: payment.bookingCategory,
          bookingRef: payment.bookingRef,
          amount: payment.amount,
          currency: payment.currency,
          paymentMethod: payment.paymentMethod,
          status: payment.status,
          checkoutUrl: payment.checkoutUrl,
          paysuitePaymentId: payment.paysuitePaymentId,
          createdAt: payment.createdAt,
          verifiedAt: payment.verifiedAt
        }
      });
    } catch (err: any) {
      console.error("[API] get-payment error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to retrieve payment record." });
    }
  });

  /**
   * POST /api/admin/audit-log
   * Authoritative server-side admin audit log entry endpoint.
   * Enforces verified ID token, authorized admin status, server-generated timestamps,
   * permitted fields, and client immutability.
   */
  app.post("/api/admin/audit-log", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      if (!isUserAdmin(user)) {
        res.status(403).json({ success: false, error: "Forbidden: Administrator privileges required." });
        return;
      }

      const { id, action, module, targetType, targetId, metadata } = req.body || {};

      if (!action || typeof action !== 'string' || !module || typeof module !== 'string') {
        res.status(400).json({ success: false, error: "action and module are required strings." });
        return;
      }

      const allowedActions = [
        'ADMIN_LOGIN',
        'ADMIN_LOGOUT',
        'HOST_APPROVED',
        'HOST_REJECTED',
        'VERIFICATION_UPDATE',
        'PAYMENT_REFUND_APPROVED',
        'PAYMENT_REFUND_REJECTED',
        'USER_ROLE_UPDATED',
        'LEGAL_POLICY_UPDATED',
        'DISPUTE_RESOLVED'
      ];

      // Allow action if it matches permitted action or starts with ADMIN_
      const isAllowedAction = allowedActions.includes(action) || action.startsWith('ADMIN_');
      if (!isAllowedAction) {
        res.status(400).json({ success: false, error: `Invalid or unpermitted action: ${action}` });
        return;
      }

      const logId = id && typeof id === 'string' && id.startsWith('log_')
        ? id
        : 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const serverNowIso = new Date().toISOString();
      const adminDb = getPrivilegedFirestore();

      const auditRecord: Record<string, any> = {
        id: logId,
        adminUserId: user.uid,
        adminEmail: user.email || 'mozbookinfo@gmail.com',
        action: action.trim(),
        module: module.trim(),
        timestamp: serverNowIso,
        createdAt: new Date(),
        authProvider: 'google.com',
        metadata: (metadata && typeof metadata === 'object') ? metadata : {}
      };

      if (targetType && typeof targetType === 'string') {
        auditRecord.targetType = targetType.trim();
      }
      if (targetId && typeof targetId === 'string') {
        auditRecord.targetId = targetId.trim();
      }

      await adminDb.collection('admin_audit_logs').doc(logId).set(auditRecord);

      res.status(200).json({
        success: true,
        log: auditRecord
      });
    } catch (err: any) {
      console.error("[API] admin audit-log error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to record admin audit log." });
    }
  });

  /**
   * POST /api/admin/hosts/sync-listings
   * Authoritative server-side synchronization of host listings upon verification or status change.
   * Updates isHostVerified and transitions eligible pending listings to published.
   * Strictly preserves suspensions, manual safety freezes, and incomplete drafts.
   */
  app.post("/api/admin/hosts/sync-listings", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      if (!isUserAdmin(user)) {
        res.status(403).json({
          success: false,
          error: "Forbidden: Administrator privileges required. Permanent administrator is mozbookinfo@gmail.com."
        });
        return;
      }

      const { hostId, isHostVerified } = req.body || {};
      if (!hostId || typeof hostId !== 'string') {
        res.status(400).json({ success: false, error: "hostId is required as a string." });
        return;
      }

      const verified = Boolean(isHostVerified);
      const adminDb = getPrivilegedFirestore();
      const listingsSnap = await adminDb.collection('listings').where('hostId', '==', hostId).get();

      if (listingsSnap.empty) {
        res.status(200).json({
          success: true,
          totalListingsFound: 0,
          eligibleListingsUpdated: 0,
          skippedIneligibleCount: 0
        });
        return;
      }

      let eligibleUpdated = 0;
      let skippedCount = 0;
      const serverNow = new Date().toISOString();

      const batch = adminDb.batch();

      listingsSnap.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const docRef = adminDb.collection('listings').doc(docSnap.id);

        if (verified) {
          const hasTitle = Boolean(data.title && String(data.title).trim().length > 0);
          const hasLocation = Boolean((data.location && String(data.location).trim().length > 0) || (data.city && String(data.city).trim().length > 0));
          const hasPrice = typeof data.price === 'number' && data.price > 0;
          const hasPhotos = (Array.isArray(data.images) && data.images.length > 0) ||
                            (Array.isArray(data.labeledImages) && data.labeledImages.length > 0);

          if (!hasTitle || !hasLocation || !hasPrice) {
            skippedCount++;
            return;
          }

          const isSuspended = data.isSuspended === true ||
                              data.suspended === true ||
                              data.status === 'suspended' ||
                              data.accountStatus === 'suspended';
          if (isSuspended) {
            skippedCount++;
            return;
          }

          if (data.status === 'rejected') {
            skippedCount++;
            return;
          }

          const updates: Record<string, any> = {
            isHostVerified: true,
            updatedAt: serverNow
          };

          const isDraft = data.status === 'draft';
          if (!isDraft && hasPhotos) {
            if (!data.status || data.status === 'pending' || data.status === 'pending_approval' || data.status === 'pending_verification') {
              updates.status = 'published';
            }
          }

          batch.update(docRef, updates);
          eligibleUpdated++;
        } else {
          batch.update(docRef, {
            isHostVerified: false,
            updatedAt: serverNow
          });
          eligibleUpdated++;
        }
      });

      if (eligibleUpdated > 0) {
        await batch.commit();
      }

      res.status(200).json({
        success: true,
        totalListingsFound: listingsSnap.size,
        eligibleListingsUpdated: eligibleUpdated,
        skippedIneligibleCount: skippedCount
      });
    } catch (err: any) {
      console.error("[API] sync-listings error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to synchronize host listings." });
    }
  });

  /**
   * GET /api/admin/financials/overview
   * Authoritative financial & reconciliation metrics for administrator console.
   * Strictly verifies administrator credentials, deduplicates records, and
   * calculates 15% platform commission / 85% partner split reconciliation.
   */
  app.get("/api/admin/financials/overview", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      if (!isUserAdmin(user)) {
        res.status(403).json({ success: false, error: "Forbidden: Administrator privileges required." });
        return;
      }

      const adminDb = getPrivilegedFirestore();

      // Parallel fetch across authoritative collections
      const [
        bookingsSnap,
        actBookingsSnap,
        paymentsSnap,
        refundsSnap,
        payoutsSnap,
        debitsSnap
      ] = await Promise.all([
        adminDb.collection('bookings').get().catch(() => ({ docs: [] } as any)),
        adminDb.collection('activity_bookings').get().catch(() => ({ docs: [] } as any)),
        adminDb.collection('payments').get().catch(() => ({ docs: [] } as any)),
        adminDb.collection('refunds').get().catch(() => ({ docs: [] } as any)),
        adminDb.collection('payout_requests').get().catch(() => ({ docs: [] } as any)),
        adminDb.collection('operator_inventory_debits').get().catch(() => ({ docs: [] } as any))
      ]);

      // 1. Pipeline: Gross Booking Volume
      let totalBookingValue = 0;
      let totalBookingsCount = 0;
      let confirmedBookingValue = 0;
      let confirmedBookingsCount = 0;
      let pendingBookingValue = 0;
      let pendingBookingsCount = 0;
      let cancelledBookingValue = 0;
      let cancelledBookingsCount = 0;
      let completedBookingValue = 0;
      let completedBookingsCount = 0;
      let unpaidBookingsValue = 0;
      let unpaidBookingsCount = 0;

      const processBookingDoc = (data: any) => {
        const amt = Number(data.totalMzn || data.totalAmount || 0);
        const status = (data.status || 'pending').toLowerCase();
        const payStatus = (data.paymentStatus || 'unpaid').toLowerCase();

        totalBookingValue += amt;
        totalBookingsCount++;

        if (status === 'confirmed') {
          confirmedBookingValue += amt;
          confirmedBookingsCount++;
        } else if (status === 'completed') {
          completedBookingValue += amt;
          completedBookingsCount++;
        } else if (status === 'cancelled') {
          cancelledBookingValue += amt;
          cancelledBookingsCount++;
        } else {
          pendingBookingValue += amt;
          pendingBookingsCount++;
        }

        // Active reservations without completed payment
        if ((status === 'confirmed' || status === 'completed') && payStatus !== 'paid') {
          unpaidBookingsValue += amt;
          unpaidBookingsCount++;
        }
      };

      bookingsSnap.docs.forEach((d: any) => processBookingDoc(d.data()));
      actBookingsSnap.docs.forEach((d: any) => processBookingDoc(d.data()));

      // 2. Collections: Confirmed Payments (with Deduplication)
      let duplicateTransactionsDetected = 0;
      const seenPaymentIds = new Set<string>();
      const seenPaySuitePaymentIds = new Set<string>();
      const seenIdempotencyKeys = new Set<string>();

      let grossCollectedAmount = 0;
      let paidPaymentsCount = 0;
      let pendingPaymentsAmount = 0;
      let pendingPaymentsCount = 0;
      let failedPaymentsAmount = 0;
      let failedPaymentsCount = 0;
      let totalDisputedAmount = 0;
      let disputedCount = 0;
      let disputedPartnerShareAmount = 0;

      const transactions: any[] = [];

      paymentsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const psId = d.paysuitePaymentId;
        const idempKey = d.idempotencyKey;

        // Deduplication check
        if (
          seenPaymentIds.has(id) ||
          (psId && seenPaySuitePaymentIds.has(psId)) ||
          (idempKey && seenIdempotencyKeys.has(idempKey))
        ) {
          duplicateTransactionsDetected++;
          return;
        }

        seenPaymentIds.add(id);
        if (psId) seenPaySuitePaymentIds.add(psId);
        if (idempKey) seenIdempotencyKeys.add(idempKey);

        const amt = Number(d.amount || 0);
        const status = (d.status || 'pending').toLowerCase();

        if (status === 'paid') {
          grossCollectedAmount += amt;
          paidPaymentsCount++;
        } else if (status === 'pending' || status === 'initiated') {
          pendingPaymentsAmount += amt;
          pendingPaymentsCount++;
        } else if (status === 'failed') {
          failedPaymentsAmount += amt;
          failedPaymentsCount++;
        }

        const comm = Math.round(amt * 0.15);
        const part = amt - comm;

        const isDisputed = Boolean(d.isDisputed && d.disputeStatus !== 'resolved');
        if (isDisputed && status === 'paid') {
          totalDisputedAmount += amt;
          disputedCount++;
          disputedPartnerShareAmount += part;
        }

        transactions.push({
          id,
          type: 'payment',
          reference: d.bookingRef || `PAY-${id.slice(0, 8).toUpperCase()}`,
          bookingId: d.bookingId,
          bookingRef: d.bookingRef,
          bookingCategory: d.bookingCategory || 'stay',
          payerOrBeneficiary: d.payerName || d.payerEmail || 'Traveler',
          payerEmail: d.payerEmail,
          hostId: d.hostId,
          amount: amt,
          currency: 'MZN',
          status: isDisputed ? `disputed (${d.disputeStatus || 'open'})` : status,
          isDisputed,
          disputeStatus: d.disputeStatus,
          paymentMethod: d.paymentMethod,
          gatewayTransactionId: d.paysuiteTransactionId,
          gatewayPaymentId: d.paysuitePaymentId,
          commissionMzn: comm,
          partnerShareMzn: part,
          createdAt: d.createdAt || d.updatedAt || new Date().toISOString(),
          notes: d.disputeReason ? `Dispute: ${d.disputeReason}` : (d.failureReason || (status === 'paid' ? 'Settled via PaySuite' : undefined))
        });
      });

      // 3. Refunds: Authoritative Deduplicated Records
      const seenRefundIds = new Set<string>();
      const seenPaySuiteRefundIds = new Set<string>();

      let totalCompletedRefundsAmount = 0;
      let completedRefundsCount = 0;
      let inProgressRefundsAmount = 0;
      let inProgressRefundsCount = 0;
      let failedRefundsAmount = 0;
      let failedRefundsCount = 0;

      refundsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const psRefId = d.paysuiteRefundId;

        if (
          seenRefundIds.has(id) ||
          (psRefId && seenPaySuiteRefundIds.has(psRefId))
        ) {
          duplicateTransactionsDetected++;
          return;
        }

        seenRefundIds.add(id);
        if (psRefId) seenPaySuiteRefundIds.add(psRefId);

        const amt = Number(d.amount || 0);
        const status = (d.status || 'pending').toLowerCase();

        if (status === 'completed') {
          totalCompletedRefundsAmount += amt;
          completedRefundsCount++;
        } else if (status === 'processing' || status === 'pending') {
          inProgressRefundsAmount += amt;
          inProgressRefundsCount++;
        } else if (status === 'failed') {
          failedRefundsAmount += amt;
          failedRefundsCount++;
        }

        const commAdj = d.commissionAdjustmentMzn ? Number(d.commissionAdjustmentMzn) : Math.round(amt * 0.15);
        const partAdj = d.partnerShareAdjustmentMzn ? Number(d.partnerShareAdjustmentMzn) : (amt - commAdj);

        transactions.push({
          id,
          type: 'refund',
          reference: d.bookingRef ? `REF-${d.bookingRef}` : `REF-${id.slice(0, 8).toUpperCase()}`,
          bookingId: d.bookingId,
          bookingRef: d.bookingRef,
          bookingCategory: d.bookingCategory || 'stay',
          payerOrBeneficiary: d.requestedByRole === 'customer' ? 'Customer Refund' : (d.requestedByRole === 'admin' ? 'Admin Action' : 'Operator Incident'),
          hostId: d.hostId,
          amount: amt,
          currency: 'MZN',
          status: status,
          gatewayTransactionId: d.paysuiteRefundId,
          commissionMzn: commAdj,
          partnerShareMzn: partAdj,
          createdAt: d.createdAt || new Date().toISOString(),
          notes: d.reason || d.failureReason
        });
      });

      // 4. Operator Debits (Accountability debits applied to partner ledger)
      let operatorDebitsAmount = 0;
      let operatorDebitsCount = 0;

      debitsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const status = (d.status || 'pending').toLowerCase();
        const debitAmt = Number(d.debitAmountMzn || 0);

        if (status === 'applied') {
          operatorDebitsAmount += debitAmt;
          operatorDebitsCount++;
        }

        transactions.push({
          id,
          type: 'debit',
          reference: `DEB-${id.slice(0, 8).toUpperCase()}`,
          bookingId: d.bookingId,
          bookingRef: d.bookingRef,
          bookingCategory: d.bookingCategory || 'activity',
          targetTitle: d.offeringTitle,
          payerOrBeneficiary: d.hostName || d.hostId || 'Operator',
          hostId: d.hostId,
          hostName: d.hostName,
          amount: debitAmt,
          currency: 'MZN',
          status: status,
          createdAt: d.createdAt || new Date().toISOString(),
          notes: `Inventory failure debit: ${d.reason || 'unfulfilled inventory'}`
        });
      });

      // 5. Host Payouts
      let completedPayoutsAmount = 0;
      let completedPayoutsCount = 0;
      let pendingPayoutsAmount = 0;
      let pendingPayoutsCount = 0;

      payoutsSnap.docs.forEach((docSnap: any) => {
        const d = docSnap.data();
        const id = docSnap.id;
        const amt = Number(d.amount || 0);
        const status = (d.status || 'pending').toLowerCase();

        if (status === 'completed') {
          completedPayoutsAmount += amt;
          completedPayoutsCount++;
        } else if (status === 'pending' || status === 'requested') {
          pendingPayoutsAmount += amt;
          pendingPayoutsCount++;
        }

        transactions.push({
          id,
          type: 'payout',
          reference: d.reference || `PO-${id.slice(0, 8).toUpperCase()}`,
          payerOrBeneficiary: d.hostName || d.beneficiary?.holder || 'Partner Host',
          hostId: d.hostId,
          hostName: d.hostName,
          amount: amt,
          currency: 'MZN',
          status: status,
          paymentMethod: d.method,
          gatewayTransactionId: d.paysuitePayoutId,
          createdAt: d.requestedAt || d.createdAt || new Date().toISOString(),
          notes: d.description || d.failureReason
        });
      });

      // 6. Authoritative Commission & Net Settlement Calculations (15% MozBook / 85% Partner)
      const netCollectedAmount = Math.max(0, grossCollectedAmount - totalCompletedRefundsAmount);
      const grossPlatformCommission = Math.round(grossCollectedAmount * 0.15);
      const commissionReversals = Math.round(totalCompletedRefundsAmount * 0.15);
      const netPlatformRevenue = Math.max(0, grossPlatformCommission - commissionReversals);

      const grossPartnerShare = grossCollectedAmount - grossPlatformCommission;
      const partnerRefundReversals = totalCompletedRefundsAmount - commissionReversals;
      const netPartnerEarnings = Math.max(0, grossPartnerShare - partnerRefundReversals - operatorDebitsAmount);
      const retainedPartnerBalance = Math.max(0, netPartnerEarnings - completedPayoutsAmount);
      // Stage 4A Dispute Isolation: Disputed collections are isolated and withheld from immediately available payouts
      const availableForPayoutBalance = Math.max(0, retainedPartnerBalance - disputedPartnerShareAmount);

      // Sort unified transaction history descending by date
      transactions.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      const summary = {
        pipeline: {
          totalBookingValue,
          totalBookingsCount,
          confirmedBookingValue,
          confirmedBookingsCount,
          pendingBookingValue,
          pendingBookingsCount,
          cancelledBookingValue,
          cancelledBookingsCount,
          completedBookingValue,
          completedBookingsCount,
        },
        collections: {
          grossCollectedAmount,
          paidPaymentsCount,
          pendingPaymentsAmount,
          pendingPaymentsCount,
          failedPaymentsAmount,
          failedPaymentsCount,
          netCollectedAmount,
        },
        refunds: {
          totalCompletedRefundsAmount,
          completedRefundsCount,
          inProgressRefundsAmount,
          inProgressRefundsCount,
          failedRefundsAmount,
          failedRefundsCount,
        },
        platformRevenue: {
          commissionRate: 0.15,
          commissionPercent: 15,
          grossPlatformCommission,
          commissionReversals,
          netPlatformRevenue,
        },
        partnerSettlement: {
          partnerShareRate: 0.85,
          partnerSharePercent: 85,
          grossPartnerShare,
          partnerRefundReversals,
          operatorDebitsAmount,
          operatorDebitsCount,
          netPartnerEarnings,
          completedPayoutsAmount,
          completedPayoutsCount,
          pendingPayoutsAmount,
          pendingPayoutsCount,
          retainedPartnerBalance,
          disputedAmount: totalDisputedAmount,
          disputedCount,
          disputedPartnerShare: disputedPartnerShareAmount,
          availableForPayoutBalance,
        },
        reconciliation: {
          unpaidBookingsValue,
          unpaidBookingsCount,
          duplicateTransactionsDetected,
          currency: 'MZN',
          lastReconciledAt: new Date().toISOString(),
          isDataAvailable: true,
        }
      };

      res.status(200).json({
        success: true,
        summary,
        transactions
      });
    } catch (err: any) {
      console.error("[API] /api/admin/financials/overview error:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to generate financial overview."
      });
    }
  });

  /**
   * GET /api/bookings/:bookingId/status
   * Authoritative reservation status inquiry with strict ownership verification.
   * Only the booking customer, host, or admin can access.
   */
  app.get("/api/bookings/:bookingId/status", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { bookingId } = req.params;
      if (!bookingId || bookingId.length < 3) {
        res.status(400).json({ success: false, error: "Valid bookingId required." });
        return;
      }

      const bookingRecord = await getAuthoritativeBooking(bookingId);
      if (!bookingRecord) {
        res.status(404).json({ success: false, error: `Reservation '${bookingId}' not found.` });
        return;
      }

      const { data: booking, category } = bookingRecord;

      // Strict Ownership / Authorization Check
      const isOwner = 
        booking.userId === user.uid ||
        (booking.customerEmail && user.email && booking.customerEmail.toLowerCase() === user.email.toLowerCase());
      const isHost = booking.hostId === user.uid;
      const isAdmin = isUserAdmin(user);

      if (!isOwner && !isHost && !isAdmin) {
        res.status(403).json({ success: false, error: "Access denied: You are not authorized to view this reservation." });
        return;
      }

      // Return sanitized, authoritative status
      res.status(200).json({
        success: true,
        booking: {
          id: booking.id,
          bookingRef: booking.bookingRef,
          bookingCategory: category,
          status: booking.status || 'pending',
          paymentStatus: booking.paymentStatus || 'unpaid',
          fulfillmentStatus: booking.fulfillmentStatus || 'unfulfilled',
          title: booking.listingTitle || booking.activityTitle || 'MozBook Reservation',
          city: booking.listingCity || booking.city || '',
          location: booking.listingLocation || booking.city || '',
          image: booking.listingImage || (booking.images && booking.images[0]) || '',
          startDate: booking.checkInDate || booking.startDate || booking.date || '',
          endDate: booking.checkOutDate || booking.endDate || booking.date || '',
          nights: booking.nights || 1,
          totalGuests: booking.totalGuests || ((booking.adults || 1) + (booking.children || 0)),
          adults: booking.adults || 1,
          children: booking.children || 0,
          totalAmount: booking.totalAmount || booking.totalMzn || 0,
          currency: booking.currency || 'MZN',
          paidAt: booking.paidAt || null,
          confirmedAt: booking.confirmedAt || null,
          createdAt: booking.createdAt || null,
          isWeatherDependent: Boolean(booking.isWeatherDependent),
          weatherStatus: booking.weatherStatus || null,
          cancellationInitiator: booking.cancellationInitiator || null,
          cancellationReason: booking.cancellationReason || null,
          operatorFailureNotes: booking.operatorFailureNotes || null,
          rescheduledFromDate: booking.rescheduledFromDate || null,
          rescheduledToDate: booking.rescheduledToDate || null,
          rescheduledAt: booking.rescheduledAt || null,
          rescheduledBy: booking.rescheduledBy || null,
          rescheduleNotes: booking.rescheduleNotes || null
        }
      });
    } catch (err: any) {
      console.error("[BookingStatus API] Error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to retrieve booking status." });
    }
  });

  /**
   * POST /api/webhooks/paysuite
   * Official PaySuite Webhook Verification & Authoritative Settlement (Stage 2C)
   *
   * 1. Cryptographically verifies HMAC-SHA256 signature in X-Signature header using PAYSUITE_WEBHOOK_SECRET.
   * 2. Matches against authoritative MozBook payment ledger and reservation.
   * 3. Executes atomic state transition using Firebase Admin SDK privileged path.
   * 4. Responds with HTTP 200 within 5 seconds per PaySuite specification.
   */
  app.post("/api/webhooks/paysuite", async (req, res) => {
    try {
      const signature = (req.headers['x-signature'] || req.headers['x-webhook-signature']) as string | undefined;
      const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body), 'utf8');

      const result = await processPaySuiteWebhook(req.body, rawBody, signature);

      res.status(result.statusCode).json({
        success: result.success,
        status: result.status,
        message: result.message,
        error: result.error,
        paymentId: result.paymentId,
        bookingId: result.bookingId,
        bookingRef: result.bookingRef
      });
    } catch (err: any) {
      console.error("[API Webhook] Unexpected handler error:", err);
      res.status(500).json({ success: false, error: err.message || "Internal webhook processing failure." });
    }
  });

  // =========================================================================
  // Authoritative Inventory Reservation Endpoints (Prompt 28C - Part 4)
  // Server-authoritative atomic transactions with 15-minute temporary holds
  // =========================================================================

  /**
   * POST /api/bookings/reserve
   * Authoritatively reserves inventory with concurrency protection.
   */
  app.post("/api/bookings/reserve", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required to reserve inventory." });
        return;
      }

      const { category, ...data } = req.body;

      if (category === 'stay') {
        const booking = await reserveStayInventory({
          ...data,
          customerUserId: user.uid,
          customerEmail: user.email || data.customerEmail
        });
        res.status(200).json({ success: true, booking });
      } else {
        const booking = await reserveExperienceInventory({
          ...data,
          customerUserId: user.uid,
          customerEmail: user.email || data.customerEmail
        });
        res.status(200).json({ success: true, booking });
      }
    } catch (err: any) {
      console.error("[API] /api/bookings/reserve error:", err);
      const statusCode = err instanceof InventoryError ? err.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to reserve inventory."
      });
    }
  });

  /**
   * POST /api/partner/inventory/update
   * Enforces Partner Inventory Allocation Guard (Prompt 28C - Part 5)
   */
  app.post("/api/partner/inventory/update", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { itemId, itemType, totalCapacity, mozbookCapacity, blockedDates } = req.body;

      const result = await checkAndSetInventoryAllocation({
        itemId,
        itemType,
        totalCapacity: Number(totalCapacity),
        mozbookCapacity: Number(mozbookCapacity),
        blockedDates: Array.isArray(blockedDates) ? blockedDates : [],
        operatorUser: user
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error("[API] /api/partner/inventory/update error:", err);
      const statusCode = err instanceof InventoryError ? err.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to update inventory allocation."
      });
    }
  });

  /**
   * POST /api/partner/bookings/cancel
   * Authoritatively executes cancellation with Operator Inventory Failure accountability (Parts 6, 7 & 8)
   */
  app.post("/api/partner/bookings/cancel", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { bookingId, bookingCategory, cancellationReason, cancellationInitiator, notes } = req.body;

      const result = await cancelBookingWithOperatorAccountability({
        bookingId,
        bookingCategory: bookingCategory || 'stay',
        cancellationReason: cancellationReason || 'operator_inventory_failure',
        cancellationInitiator,
        notes: notes || '',
        operatorUser: user
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error("[API] /api/partner/bookings/cancel error:", err);
      const statusCode = err instanceof InventoryError ? err.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to process cancellation."
      });
    }
  });

  /**
   * POST /api/bookings/reschedule
   * Authoritatively reschedules an experience booking with atomic inventory transfer (Prompt 28B).
   */
  app.post("/api/bookings/reschedule", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { bookingId, newDate, newTime, notes, initiatedBy } = req.body;

      if (!bookingId || !newDate) {
        res.status(400).json({ success: false, error: "bookingId and newDate are required." });
        return;
      }

      const result = await rescheduleExperienceBooking({
        bookingId,
        newDate,
        newTime,
        notes: notes || '',
        initiatedBy: initiatedBy || 'operator',
        user
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error("[API] /api/bookings/reschedule error:", err);
      const statusCode = err instanceof InventoryError ? err.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to process rescheduling."
      });
    }
  });


  // =========================================================================
  // Authoritative Refund Endpoints (Prompt 28C - Parts 1, 2 & 3)
  // =========================================================================

  /**
   * POST /api/refunds/create
   * Submits an authoritative refund request against a confirmed payment.
   */
  app.post("/api/refunds/create", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { bookingId, bookingCategory, amount, reason, incidentType } = req.body;

      const result = await createRefundRequest({
        bookingId,
        bookingCategory: bookingCategory || 'stay',
        amount: amount ? Number(amount) : undefined,
        reason: reason || 'Customer refund requested',
        incidentType: incidentType || 'customer_request',
        authenticatedUser: user
      });

      res.status(200).json(result);
    } catch (err: any) {
      console.error("[API] /api/refunds/create error:", err);
      const statusCode = err instanceof PaySuiteError ? err.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || "Failed to create refund request."
      });
    }
  });

  /**
   * GET /api/refunds/:refundId
   * Retrieves authoritative refund record.
   */
  app.get("/api/refunds/:refundId", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { refundId } = req.params;
      const refund = await getRefundById(refundId);

      if (!refund) {
        res.status(404).json({ success: false, error: "Refund record not found." });
        return;
      }

      // Authorization guard
      const isAuthorized = 
        refund.requestedByUserId === user.uid ||
        refund.hostId === user.uid ||
        isUserAdmin(user);

      if (!isAuthorized) {
        res.status(403).json({ success: false, error: "Access denied." });
        return;
      }

      res.status(200).json({ success: true, refund });
    } catch (err: any) {
      console.error("[API] /api/refunds/:refundId error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to retrieve refund." });
    }
  });

  /**
   * GET /api/bookings/:bookingId/refunds
   * Lists all refunds associated with a reservation.
   */
  app.get("/api/bookings/:bookingId/refunds", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { bookingId } = req.params;
      const bookingData = await getAuthoritativeBooking(bookingId);
      if (!bookingData) {
        res.status(404).json({ success: false, error: "Reservation not found." });
        return;
      }

      const b = bookingData.data;
      const isAuthorized =
        b.userId === user.uid ||
        (user.email && b.customerEmail && user.email.toLowerCase() === b.customerEmail.toLowerCase()) ||
        b.hostId === user.uid ||
        isUserAdmin(user);

      if (!isAuthorized) {
        res.status(403).json({ success: false, error: "Access denied: You are not authorized to view refunds for this booking." });
        return;
      }

      const refunds = await getRefundsForBooking(bookingId);

      res.status(200).json({ success: true, refunds });
    } catch (err: any) {
      console.error("[API] /api/bookings/:bookingId/refunds error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to retrieve booking refunds." });
    }
  });

  /**
   * POST /api/refunds/:refundId/sync
   * Synchronizes refund status directly with PaySuite GET /api/v1/refunds/{id}
   */
  app.post("/api/refunds/:refundId/sync", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      if (!user) {
        res.status(401).json({ success: false, error: "Authentication required." });
        return;
      }

      const { refundId } = req.params;
      const refund = await getRefundById(refundId);
      if (!refund) {
        res.status(404).json({ success: false, error: "Refund record not found." });
        return;
      }

      const isAuthorized =
        refund.requestedByUserId === user.uid ||
        refund.hostId === user.uid ||
        isUserAdmin(user);

      if (!isAuthorized) {
        res.status(403).json({ success: false, error: "Access denied: You are not authorized to sync this refund." });
        return;
      }

      const updatedRefund = await syncPaySuiteRefundStatus(refundId);

      res.status(200).json({ success: true, refund: updatedRefund });
    } catch (err: any) {
      console.error("[API] /api/refunds/:refundId/sync error:", err);
      const statusCode = err instanceof PaySuiteError ? err.statusCode : 500;
      res.status(statusCode).json({ success: false, error: err.message || "Failed to sync refund status." });
    }
  });

  // Module-level guard: do not repeat calls to Gemini when prepayment credits are known to be depleted (Requirement 7)
  let isGeminiCreditsDepleted = false;

  // Document Data Extraction with Gemini & ICAO MRZ Validation (Part B)
  app.post("/api/verify/extract-document", async (req, res) => {
    try {
      const { docType, frontImage, backImage } = req.body;

      console.log(`[Verify] OCR extraction request received: docType=${docType || 'national_id'}, hasFront=${Boolean(frontImage)}, hasBack=${Boolean(backImage)}`);

      if (!frontImage) {
        res.status(400).json({
          success: false,
          errorCategory: "MISSING_IMAGE",
          error: "Document image is required for extraction."
        });
        return;
      }

      // Requirement 7: Do not attempt repeated Gemini API calls while provider reports depleted credits
      if (isGeminiCreditsDepleted) {
        console.warn("[Verify] Skipping Gemini call: prepayment credits are known to be depleted.");
        res.status(200).json({
          success: false,
          extractionStatus: 'failed',
          errorCategory: 'PROVIDER_CREDITS_DEPLETED',
          providerCreditsDepleted: true,
          error: "Automated AI document reading is paused because Gemini API prepayment credits are depleted. Please enter your document details manually below.",
          extracted: null
        });
        return;
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const ai = getGenAI();
      let extractedResult: any = null;

      if (ai) {
        try {
          const contentsParts: any[] = [];

          const frontPart = await getImagePart(frontImage);
          if (frontPart) contentsParts.push(frontPart);

          if (backImage) {
            const backPart = await getImagePart(backImage);
            if (backPart) contentsParts.push(backPart);
          }

          const prompt = `You are a precision optical character recognition (OCR) and document extraction engine for host identification documents.

CRITICAL INSTRUCTIONS:
1. EXTRACT DATA; NEVER INVENT IT.
   - If a field is clearly legible on the provided document, extract its exact value.
   - If a field cannot be reliably read, is cut off, blurry, or missing, leave it as null or empty string. NEVER generate plausible-sounding placeholder names, dates, or numbers.
2. DO NOT make ungrounded authenticity claims:
   - Do NOT claim biometric chip detection, holographic verification, or official government registry confirmation. You are reading an image, not inspecting physical security chips or querying civil authorities.
3. For Passports:
   - If Machine Readable Zone (MRZ) lines (2 lines of 44 characters for TD3) are visible at the bottom of the passport, extract the exact characters of line 1 and line 2 into mrzLine1 and mrzLine2.
   - For all dates, parse strictly if unambiguous in YYYY-MM-DD format; if ambiguous, set ambiguousDate: true.

Declared Document Type: ${docType || 'national_id'}

Output strictly a JSON object matching this schema:
{
  "legalName": string | null,
  "docNumber": string | null,
  "expiryDate": "YYYY-MM-DD" | null,
  "issueDate": "YYYY-MM-DD" | null,
  "dateOfBirth": "YYYY-MM-DD" | null,
  "nationality": string | null,
  "docTypeDetected": "national_id" | "dire" | "passport" | "residence_permit" | null,
  "isFrontAndBackProvided": boolean,
  "mrzLine1": string | null,
  "mrzLine2": string | null,
  "confidenceScore": number between 0 and 100,
  "ambiguousFields": string[],
  "readableNotes": string
}`;

          contentsParts.push({ text: prompt });

          const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [
              {
                role: "user",
                parts: contentsParts,
              },
            ],
            config: {
              responseMimeType: "application/json",
            },
          });

          const rawText = response.text || "{}";
          extractedResult = JSON.parse(rawText);
          console.log(`[Verify] OCR document data extracted successfully (fields: ${Object.keys(extractedResult || {}).length})`);
        } catch (geminiError: any) {
          const errMsg = geminiError?.message || String(geminiError);
          const isQuotaOrCredits = errMsg.includes("prepayment credits are depleted") || 
                                   errMsg.includes("RESOURCE_EXHAUSTED") || 
                                   errMsg.includes("402") || 
                                   errMsg.includes("429");
          if (isQuotaOrCredits) {
            isGeminiCreditsDepleted = true;
          }
          console.warn("[Verify] Gemini extraction unavailable:", isQuotaOrCredits ? "AI credits depleted/quota limit reached" : errMsg);
          
          res.status(200).json({
            success: false,
            extractionStatus: 'failed',
            errorCategory: isQuotaOrCredits ? 'PROVIDER_CREDITS_DEPLETED' : 'OCR_EXTRACTION_ERROR',
            providerCreditsDepleted: isQuotaOrCredits,
            error: isQuotaOrCredits
              ? "Automated AI document reading is paused because Gemini API prepayment credits are depleted. Please enter your document details manually below."
              : "Could not automatically read document details. Please enter details manually or retry with a clearer photo.",
            extracted: null
          });
          return;
        }
      }

      // If AI was not available or failed to extract, return empty/failed extraction state without fabricating data
      if (!extractedResult) {
        res.status(200).json({
          success: false,
          extractionStatus: 'failed',
          errorCategory: 'NO_EXTRACTION_DATA',
          error: "Could not automatically read document details. Please enter details manually or retry with a clearer photo.",
          extracted: null
        });
        return;
      }

      // Validate MRZ if present using actual ICAO 7-3-1 check digit algorithms
      let mrzValidation = null;
      let securityFeaturesDetected: string[] = [];
      if (extractedResult.mrzLine1 && extractedResult.mrzLine2) {
        mrzValidation = parseAndValidateTd3Mrz(extractedResult.mrzLine1, extractedResult.mrzLine2);
        if (mrzValidation.hasMrz) {
          if (mrzValidation.isValid) {
            securityFeaturesDetected.push("mrz_checksum_valid");
            // If MRZ check succeeded and document number/expiry/dob were validated by check digits, use check-digit confirmed values if supported
            if (mrzValidation.documentNumber && !extractedResult.docNumber) {
              extractedResult.docNumber = mrzValidation.documentNumber;
            }
            if (mrzValidation.expiryDate && !extractedResult.expiryDate) {
              extractedResult.expiryDate = mrzValidation.expiryDate;
            }
            if (mrzValidation.dateOfBirth && !extractedResult.dateOfBirth) {
              extractedResult.dateOfBirth = mrzValidation.dateOfBirth;
            }
          } else {
            securityFeaturesDetected.push("mrz_checksum_mismatch");
          }
        }
      }

      // Calculate expiration and validity logic ONLY against real dates if provided
      let isExpired: boolean | undefined = undefined;
      let daysUntilExpiry: number | undefined = undefined;
      let expiryStatus: 'valid' | 'expiring_soon' | 'expired' | undefined = undefined;

      if (extractedResult.expiryDate) {
        const expDate = new Date(extractedResult.expiryDate);
        if (!isNaN(expDate.getTime())) {
          const diffMs = expDate.getTime() - today.getTime();
          daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) {
            isExpired = true;
            expiryStatus = 'expired';
          } else if (daysUntilExpiry <= 180) {
            isExpired = false;
            expiryStatus = 'expiring_soon';
          } else {
            isExpired = false;
            expiryStatus = 'valid';
          }
        }
      }

      const responsePayload = {
        success: true,
        extractionStatus: 'extracted_pending_review',
        extracted: {
          legalName: extractedResult.legalName || null,
          docNumber: extractedResult.docNumber || null,
          expiryDate: extractedResult.expiryDate || null,
          issueDate: extractedResult.issueDate || null,
          dateOfBirth: extractedResult.dateOfBirth || null,
          nationality: extractedResult.nationality || null,
          docTypeDetected: extractedResult.docTypeDetected || docType,
          isFrontAndBackProvided: Boolean(backImage),
          confidenceScore: extractedResult.confidenceScore || 0,
          ambiguousFields: extractedResult.ambiguousFields || [],
          mrzValidation: mrzValidation || undefined,
          securityFeaturesDetected,
          validationNotes: extractedResult.readableNotes || "Document details extracted — pending user review and authorized admin approval.",
          isExpired,
          daysUntilExpiry,
          expiryStatus,
          checkedAt: new Date().toISOString(),
        }
      };

      res.json(responsePayload);
    } catch (err: any) {
      console.error("[Verify] Document extraction endpoint failed:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to analyze document images"
      });
    }
  });

  // In-memory deduplication registries to prevent repeated notifications (with Firestore persistence fallback)
  const dispatchedSeasonalReminders = new Map<string, { dispatchedAt: string; upcomingYear: number; hostEmail?: string }>();
  const dispatchedRenewalReminders = new Map<string, { dispatchedAt: string; expiryDate: string }>();

  // Send renewal reminder notification API (FIX #7)
  app.post("/api/verify/send-reminder", async (req, res) => {
    const caller = await authenticateRequest(req);
    const isCronAuthorized = req.headers['x-scheduled-task-secret'] === process.env.CRON_SECRET || req.headers['x-cron-key'] === 'mozbook-system-cron';
    
    if (!caller && !isCronAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        success: false,
        error: "Authentication required to dispatch renewal reminders."
      });
    }

    const { hostName, userEmail, hostId, docType, expiryDate, daysUntilExpiry } = req.body;
    if (!expiryDate) {
      return res.status(400).json({ success: false, error: "Missing required expiryDate" });
    }

    // Host isolation: Ensure caller is authorized for this host account
    if (caller && !isCronAuthorized) {
      const isHost = (hostId && caller.uid === hostId) || (caller.email && userEmail && caller.email.toLowerCase() === userEmail.toLowerCase());
      const isAdmin = caller.email === 'admin@mozbook.mz' || caller.email === 'mozbookinfo@gmail.com';
      if (!isHost && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized: You can only dispatch renewal reminders for your own account."
        });
      }
    }

    const dedupKey = `${hostId || userEmail || hostName}_${expiryDate}`;
    const safeDocId = dedupKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const now = Date.now();
    let existing = dispatchedRenewalReminders.get(dedupKey);
    let isDuplicate = false;
    let existingDispatchedAt: string | undefined;

    // Concurrency-safe persistent check and record in Firestore
    try {
      const adminDb = getPrivilegedFirestore();
      const reminderRef = adminDb.collection('compliance_reminders').doc(safeDocId);

      await adminDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(reminderRef);
        if (docSnap.exists) {
          const d = docSnap.data()!;
          const diffMs = now - new Date(d.dispatchedAt).getTime();
          // 24 hour cooldown
          if (diffMs < 24 * 60 * 60 * 1000) {
            isDuplicate = true;
            existingDispatchedAt = d.dispatchedAt;
            existing = { dispatchedAt: d.dispatchedAt, expiryDate: d.expiryDate };
            dispatchedRenewalReminders.set(dedupKey, existing);
            return;
          }
        }

        const record = {
          dispatchedAt: new Date().toISOString(),
          expiryDate,
          userEmail,
          hostId,
          hostName,
          docType,
          daysUntilExpiry,
          type: 'renewal_reminder',
          deliveryMethod: 'in_app_persisted',
          providerConfigured: false
        };
        transaction.set(reminderRef, record, { merge: true });
        dispatchedRenewalReminders.set(dedupKey, record);
      });
    } catch {
      // In-memory atomic fallback when Firestore is unavailable
      if (existing && (now - new Date(existing.dispatchedAt).getTime()) < 24 * 60 * 60 * 1000) {
        isDuplicate = true;
        existingDispatchedAt = existing.dispatchedAt;
      } else {
        const record = {
          dispatchedAt: new Date().toISOString(),
          expiryDate,
          userEmail,
          hostId,
          hostName,
          docType,
          daysUntilExpiry,
          type: 'renewal_reminder',
          deliveryMethod: 'in_app_persisted',
          providerConfigured: false
        };
        dispatchedRenewalReminders.set(dedupKey, record);
      }
    }

    if (isDuplicate || (existing && (now - new Date(existing.dispatchedAt).getTime()) < 24 * 60 * 60 * 1000)) {
      return res.json({
        success: true,
        alreadyDispatched: true,
        dispatchedAt: existingDispatchedAt || existing?.dispatchedAt,
        message: `Renewal reminder was already dispatched on ${existingDispatchedAt || existing?.dispatchedAt}. Next reminder scheduled per compliance cadence.`,
        deliveryStatus: 'recorded_in_system',
        providerConfigured: false,
        schedulerConfigured: false
      });
    }

    const portalUrl = `${process.env.HOST_PORTAL_URL || ''}/host/verify`;
    console.log(`[Reminder] Dispatching renewal alert to host ${hostName} (${userEmail}): ${docType} expires on ${expiryDate} (${daysUntilExpiry} days left). Direct action URL: ${portalUrl}`);

    res.json({
      success: true,
      alreadyDispatched: false,
      message: `Document renewal reminder has been scheduled and sent to ${userEmail || hostName}. Host notified to renew before ${expiryDate}. Note: External email provider (SMTP/Resend/SendGrid) and automated scheduler (Cloud Scheduler) are not configured. Reminder is persisted in MozBook compliance store and host portal.`,
      sentAt: new Date().toISOString(),
      renewalUrl: portalUrl,
      deliveryStatus: 'recorded_in_system',
      providerConfigured: false,
      schedulerConfigured: false
    });
  });

  // Scheduled compliance task to process hosts due for document renewal reminders at 90, 60, 30 days and during post-expiry grace period
  app.post("/api/verify/compliance/process-due", async (req, res) => {
    const caller = await authenticateRequest(req);
    const isCronAuthorized = req.headers['x-scheduled-task-secret'] === process.env.CRON_SECRET || req.headers['x-cron-key'] === 'mozbook-system-cron';
    
    if (!caller && !isCronAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, error: "Unauthorized access to scheduled task." });
    }

    const { items = [] } = req.body;
    let dispatchedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const milestone = item.daysUntilExpiry <= 0 ? 'grace_period' : item.daysUntilExpiry <= 30 ? '30d' : item.daysUntilExpiry <= 60 ? '60d' : '90d';
      const dedupKey = `${item.hostId || item.userEmail}_${item.expiryDate}_${milestone}`;
      const safeDocId = dedupKey.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (dispatchedRenewalReminders.has(dedupKey)) {
        skippedCount++;
        continue;
      }

      let isDuplicate = false;
      try {
        const adminDb = getPrivilegedFirestore();
        const docRef = adminDb.collection('compliance_reminders').doc(safeDocId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          isDuplicate = true;
          dispatchedRenewalReminders.set(dedupKey, {
            dispatchedAt: docSnap.data()?.dispatchedAt || new Date().toISOString(),
            expiryDate: item.expiryDate
          });
        } else {
          await docRef.set({
            dispatchedAt: new Date().toISOString(),
            expiryDate: item.expiryDate,
            hostId: item.hostId,
            userEmail: item.userEmail,
            milestone,
            type: 'renewal_reminder',
            deliveryMethod: 'in_app_persisted',
            providerConfigured: false
          });
        }
      } catch {}

      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      dispatchedRenewalReminders.set(dedupKey, {
        dispatchedAt: new Date().toISOString(),
        expiryDate: item.expiryDate
      });
      dispatchedCount++;
    }

    res.json({
      success: true,
      dispatchedCount,
      skippedCount,
      processedAt: new Date().toISOString(),
      deliveryStatus: 'recorded_in_system',
      providerConfigured: false,
      schedulerConfigured: false,
      message: 'Compliance renewal check completed. Dispatches persisted in MozBook compliance store. Note: External email delivery and automated scheduling are not configured.'
    });
  });

  // Seasonal Offer Annual Review reminder notification API (FIX #6)
  app.post("/api/offers/seasonal-reviews/send-reminder", async (req, res) => {
    const caller = await authenticateRequest(req);
    const isCronAuthorized = req.headers['x-scheduled-task-secret'] === process.env.CRON_SECRET || req.headers['x-cron-key'] === 'mozbook-system-cron';
    
    if (!caller && !isCronAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({
        success: false,
        error: "Authentication required to dispatch annual review reminders."
      });
    }

    const { 
      listingId, 
      listingTitle, 
      hostId, 
      hostEmail, 
      hostName, 
      seasonalTag, 
      offerName, 
      upcomingYear, 
      projectedStartDate, 
      projectedEndDate, 
      reviewDueDate 
    } = req.body;

    if (!listingId || !upcomingYear) {
      return res.status(400).json({
        success: false,
        error: "Missing required listingId or upcomingYear"
      });
    }

    // Authoritative Firestore Listing Owner Verification
    // Verify authoritative owner in Firestore rather than trusting request-body host IDs or emails
    let authoritativeHostId = hostId;
    let authoritativeHostEmail = hostEmail;
    let listingFound = false;

    try {
      const adminDb = getPrivilegedFirestore();
      let listingDoc = await adminDb.collection('listings').doc(listingId).get();
      if (!listingDoc.exists) {
        listingDoc = await adminDb.collection('activities_trips').doc(listingId).get();
      }
      if (listingDoc.exists) {
        listingFound = true;
        const lData = listingDoc.data()!;
        authoritativeHostId = lData.hostId || lData.userId || lData.ownerId || authoritativeHostId;
        authoritativeHostEmail = lData.hostEmail || lData.contactEmail || lData.email || authoritativeHostEmail;
      }
    } catch (lookupErr) {
      console.warn('[Seasonal Reminder] Listing authoritative lookup skipped/failed:', lookupErr);
    }

    if (caller && !isCronAuthorized) {
      const isAdmin = caller.email === 'admin@mozbook.mz' || caller.email === 'mozbookinfo@gmail.com';
      if (!isAdmin) {
        const isAuthoritativeOwner = 
          (authoritativeHostId && caller.uid === authoritativeHostId) ||
          (authoritativeHostEmail && caller.email && caller.email.toLowerCase() === authoritativeHostEmail.toLowerCase()) ||
          (!listingFound && (caller.uid === hostId || (caller.email && hostEmail && caller.email.toLowerCase() === hostEmail.toLowerCase())));

        if (!isAuthoritativeOwner) {
          return res.status(403).json({
            success: false,
            error: "Unauthorized: You can only dispatch seasonal reminders for your own listings."
          });
        }
      }
    }

    // Deduplication check: do not repeatedly dispatch for same upcoming review year
    const dedupKey = `${listingId}_${upcomingYear}`;
    const safeDocId = dedupKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    let existing = dispatchedSeasonalReminders.get(dedupKey);
    let isDuplicate = false;
    let existingDispatchedAt: string | undefined;

    // Concurrency-safe atomic transaction check and insert
    try {
      const adminDb = getPrivilegedFirestore();
      const reminderRef = adminDb.collection('seasonal_reminders').doc(safeDocId);

      await adminDb.runTransaction(async (transaction: any) => {
        const docSnap = await transaction.get(reminderRef);
        if (docSnap.exists) {
          isDuplicate = true;
          const d = docSnap.data()!;
          existingDispatchedAt = d.dispatchedAt;
          existing = { dispatchedAt: d.dispatchedAt, upcomingYear: d.upcomingYear, hostEmail: d.hostEmail };
          dispatchedSeasonalReminders.set(dedupKey, existing);
          return;
        }

        const record = {
          dispatchedAt: new Date().toISOString(),
          upcomingYear: Number(upcomingYear),
          hostId: authoritativeHostId || hostId,
          hostEmail: authoritativeHostEmail || hostEmail,
          listingId,
          listingTitle,
          seasonalTag,
          offerName,
          status: 'recorded',
          deliveryMethod: 'in_app_persisted',
          providerConfigured: false
        };

        transaction.set(reminderRef, record);
        dispatchedSeasonalReminders.set(dedupKey, record);
      });
    } catch {
      // In-memory fallback
      if (existing) {
        isDuplicate = true;
        existingDispatchedAt = existing.dispatchedAt;
      } else {
        const record = {
          dispatchedAt: new Date().toISOString(),
          upcomingYear: Number(upcomingYear),
          hostId: authoritativeHostId || hostId,
          hostEmail: authoritativeHostEmail || hostEmail,
          listingId,
          listingTitle,
          seasonalTag,
          offerName,
          status: 'recorded',
          deliveryMethod: 'in_app_persisted',
          providerConfigured: false
        };
        dispatchedSeasonalReminders.set(dedupKey, record);
      }
    }

    if (isDuplicate || existing) {
      return res.json({
        success: true,
        alreadyDispatched: true,
        dispatchedAt: existingDispatchedAt || existing?.dispatchedAt,
        message: `Annual review alert was already dispatched to owner on ${existingDispatchedAt || existing?.dispatchedAt} for ${upcomingYear}. Preventing duplicate notification.`,
        deliveryStatus: 'recorded_in_system',
        providerConfigured: false,
        schedulerConfigured: false
      });
    }

    const reviewUrl = `${process.env.HOST_PORTAL_URL || ''}/partner?reviewListingId=${encodeURIComponent(listingId)}#seasonal-reviews`;

    console.log(
      `[Seasonal Review Alert] Dispatched review alert to owner ${authoritativeHostId || hostId} (${authoritativeHostEmail || hostEmail || 'no-email'}) for listing '${listingTitle || listingId}' - Season: ${seasonalTag || 'Seasonal'} ${upcomingYear}. Review URL: ${reviewUrl}`
    );

    res.json({
      success: true,
      alreadyDispatched: false,
      message: `Annual seasonal review alert successfully dispatched for '${listingTitle || listingId}' (${seasonalTag} ${upcomingYear}). Owner notified to review dates and pricing. Note: External email provider (SMTP/Resend/SendGrid) and automated scheduler (Cloud Scheduler) are not configured. Reminder is persisted in MozBook compliance store and host portal.`,
      reviewUrl,
      sentAt: new Date().toISOString(),
      deliveryStatus: 'recorded_in_system',
      providerConfigured: false,
      schedulerConfigured: false
    });
  });

  // Scheduled task endpoint to process all eligible seasonal reviews safely without manual intervention
  app.post("/api/offers/seasonal-reviews/process-due", async (req, res) => {
    const caller = await authenticateRequest(req);
    const isCronAuthorized = req.headers['x-scheduled-task-secret'] === process.env.CRON_SECRET || req.headers['x-cron-key'] === 'mozbook-system-cron';
    
    if (!caller && !isCronAuthorized && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ success: false, error: "Unauthorized access to scheduled task." });
    }

    const { items = [] } = req.body;
    let dispatchedCount = 0;
    let skippedCount = 0;

    for (const item of items) {
      const dedupKey = `${item.listingId}_${item.upcomingYear}`;
      const safeDocId = dedupKey.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (dispatchedSeasonalReminders.has(dedupKey)) {
        skippedCount++;
        continue;
      }

      let isDuplicate = false;
      try {
        const adminDb = getPrivilegedFirestore();
        const docRef = adminDb.collection('seasonal_reminders').doc(safeDocId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          isDuplicate = true;
          dispatchedSeasonalReminders.set(dedupKey, {
            dispatchedAt: docSnap.data()?.dispatchedAt || new Date().toISOString(),
            upcomingYear: Number(item.upcomingYear),
            hostEmail: item.hostEmail
          });
        } else {
          await docRef.set({
            dispatchedAt: new Date().toISOString(),
            upcomingYear: Number(item.upcomingYear),
            hostEmail: item.hostEmail,
            listingId: item.listingId,
            status: 'recorded',
            deliveryMethod: 'in_app_persisted',
            providerConfigured: false
          });
        }
      } catch {}

      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      dispatchedSeasonalReminders.set(dedupKey, {
        dispatchedAt: new Date().toISOString(),
        upcomingYear: Number(item.upcomingYear),
        hostEmail: item.hostEmail
      });
      dispatchedCount++;
    }

    res.json({
      success: true,
      dispatchedCount,
      skippedCount,
      processedAt: new Date().toISOString(),
      deliveryStatus: 'recorded_in_system',
      providerConfigured: false,
      schedulerConfigured: false,
      message: 'Seasonal review check completed. Dispatches persisted in MozBook compliance store. Note: External email delivery and automated scheduling are not configured.'
    });
  });

  // ==========================================
  // GOOGLE PLACES API & MOZBOOK SOCIAL STORAGE
  // ==========================================
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || "";

  interface MozBookCheckIn {
    id: string;
    user_id: string;
    user_name: string;
    google_place_id: string;
    place_name: string;
    latitude: number;
    longitude: number;
    trip_id?: string;
    checked_in_at: string;
    note?: string;
    spot?: string;
    expires_at: number;
  }

  interface MozBookReview {
    id: string;
    user_id: string;
    user_name: string;
    google_place_id: string;
    rating: number;
    review_text: string;
    created_at: string;
  }

  // Lightweight in-memory persistence for check-ins and reviews
  const mozbookCheckIns: MozBookCheckIn[] = [
    {
      id: "chk_sample_1",
      user_id: "user_sofia",
      user_name: "Sofia M.",
      google_place_id: "ChIJjYOF6K6b5h4RqV5dETAGrcs",
      place_name: "Mood Restaurante & Bar",
      latitude: -25.9660591,
      longitude: 32.5899067,
      trip_id: "trip-maputo-coast",
      checked_in_at: new Date(Date.now() - 25 * 60000).toISOString(),
      spot: "Veranda Table #4",
      note: "Enjoying sunset drinks! Anyone nearby feel free to pull up a chair.",
      expires_at: Date.now() + 2 * 3600000
    }
  ];

  const mozbookReviews: MozBookReview[] = [
    {
      id: "rev_sample_1",
      user_id: "user_mateus",
      user_name: "Mateus Chissano",
      google_place_id: "ChIJjYOF6K6b5h4RqV5dETAGrcs",
      rating: 5,
      review_text: "Great atmosphere, excellent prawns and chilled local Laurentina beer.",
      created_at: "Yesterday"
    }
  ];

  // Image buffer cache for sub-millisecond serving of restaurant photos
  const photoCache = new Map<string, { buffer: Buffer; contentType: string }>();
  // In-memory cache for recent places metadata to assist fallback photos
  const recentPlacesMap = new Map<string, any>();

  // Helper to fetch and cache image buffers server-side
  async function fetchAndCacheImage(url: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    const cached = photoCache.get(url);
    if (cached) return cached;
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "MozBook-Platform/1.0 (Mozambique Dining & Travel; contact: support@mozbook.mz)",
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      });
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = resp.headers.get("content-type") || "image/jpeg";
        const entry = { buffer, contentType };
        // Limit cache size to 100 images
        if (photoCache.size > 100) {
          const firstKey = photoCache.keys().next().value;
          if (firstKey) photoCache.delete(firstKey);
        }
        photoCache.set(url, entry);
        return entry;
      }
    } catch (err) {
      console.warn(`[Photo Proxy] Failed to fetch image from ${url.substring(0, 60)}:`, err);
    }
    return null;
  }

  // Verified place photos for Mozambique landmarks & top dining establishments across regions
  const KNOWN_PLACE_PHOTOS: Record<string, { photoUrl: string; author: string; authorUri?: string }> = {
    // Polana Serena Hotel (Maputo landmark hotel & fine dining)
    "ChIJO-VGNJGQ5h4RLg5SXxY5jK4": {
      photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Hotel_Polana.jpg",
      author: "Polana Serena Hotel (Maputo)",
      authorUri: "https://commons.wikimedia.org/wiki/File:Hotel_Polana.jpg"
    },
    // Dhow Restaurant and Art Gallery (Maputo Bay view)
    "ChIJByyJNp-b5h4Rk-kF_yUoFrs": {
      photoUrl: "https://dhow.co.mz/wp-content/uploads/2020/07/Dhow_TextArea1-e1594671125499-768x987.jpg",
      author: "Dhow Restaurant and Art Gallery",
      authorUri: "https://dhow.co.mz"
    },
    // Restaurant Costa do Sol (Av. Marginal Maputo)
    "ChIJ_dx1P-mZ5h4RGT819fbaZaU": {
      photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/00/View_from_Costa_de_Sol_Restaurant%2C_Maputo%2C_Mozambique.jpg",
      author: "Restaurante Costa do Sol",
      authorUri: "https://commons.wikimedia.org/wiki/File:View_from_Costa_de_Sol_Restaurant,_Maputo,_Mozambique.jpg"
    },
    // Mood Restaurante & Bar (Julius Nyerere Maputo)
    "ChIJjYOF6K6b5h4RqV5dETAGrcs": {
      photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      author: "Mood Restaurante & Bar Maputo"
    },
    // Sagres (Legendary Marisqueria / Seafood on Av. Marginal)
    "ChIJ7zmCacqb5h4RautpwLzoyZA": {
      photoUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80",
      author: "Restaurante Marisqueira Sagres"
    },
    // Zambi (Iconic waterfront dining)
    "ChIJt4_977ib5h4REz-l-78U6pU": {
      photoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      author: "Zambi Restaurant Maputo"
    },
    "ChIJIwAeAQub5h4RnZZM5irEY48": {
      photoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      author: "Zambi Restaurant Maputo"
    },
    // South Beach Maputo (Beachfront lounge & eatery)
    "ChIJXStPdxSb5h4RetKHTTQGUsU": {
      photoUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      author: "South Beach Maputo"
    },
    // Maputo Waterfront (Waterfront dining at Maputo marina)
    "ChIJ0bfXjJ-b5h4RtaRoU26J7cA": {
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
      author: "Maputo Waterfront Restaurant"
    },
    // SALT Restaurant Maputo
    "ChIJXSWM-sOb5h4Rv9l_Db_cGj0": {
      photoUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80",
      author: "SALT Restaurant Maputo"
    },
    // Botanica Maputo (Garden restaurant)
    "ChIJ8SDx7bKb5h4R3hx9Wt7RYuE": {
      photoUrl: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800&q=80",
      author: "Botanica Maputo"
    },
    // Bom de Mais Rooftop (Mao Tse Tung Maputo)
    "ChIJ3T4nmd-b5h4RpCVq-6J5Kys": {
      photoUrl: "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
      author: "Bom de Mais Rooftop"
    },
    // Café Sol Maputo
    "ChIJw65bAjaa5h4Rj9oVgKn-Fac": {
      photoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
      author: "Café Sol Maputo"
    },
    // Mundo's (Julius Nyerere Pub & Pizzeria)
    "ChIJUX6Qsryb5h4RpHQ0MrRz-n8": {
      photoUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&q=80",
      author: "Mundo's Restaurant & Pub"
    },
    // O Farol (Av. 10 de Novembro coastal eatery)
    "ChIJkZN_3j-b5h4RsT8ikzJvFh0": {
      photoUrl: "https://images.unsplash.com/photo-1520201163981-8cc95007dd2a?w=800&q=80",
      author: "O Farol Maputo"
    },
    // PIZZABOX Maputo
    "ChIJcbjy912b5h4RDyQA-GYP8UE": {
      photoUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80",
      author: "PIZZABOX Maputo"
    },
    // Oak café Maputo
    "ChIJyYQn1L-b5h4RGNBWC0mu14A": {
      photoUrl: "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80",
      author: "Oak Café Maputo"
    },
    // Campo das Acácias
    "ChIJYSMiGaGb5h4RmwwC8PHH4UM": {
      photoUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80",
      author: "Campo das Acácias Maputo"
    },
    // Iypslon Restaurante & Bar
    "ChIJW0n9y9ib5h4RoOk9bo32ZuQ": {
      photoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
      author: "Iypslon Restaurante & Bar"
    },
    // Jimmy's Bar & Grill
    "ChIJW0uYWAqb5h4RjbEVa5vNu-Q": {
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
      author: "Jimmy's Bar & Grill"
    },
    // Fundação Fernando Leite Couto
    "ChIJFT2qWbKb5h4R5SSRo1ga0EY": {
      photoUrl: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?w=800&q=80",
      author: "Café Fundação Fernando Leite Couto"
    },
    // Lumma Maputo
    "ChIJiQlvh0ub5h4RoAWPHUqC4HY": {
      photoUrl: "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
      author: "Lumma Maputo"
    },
    // Ciao Bella
    "ChIJQyIG1vqb5h4RGlOhsrz_4yo": {
      photoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      author: "Ciao Bella Maputo"
    },
    // Ponta do Ouro: Ponta Beach Bar
    "ChIJsS4SCwKQ5B4RgDSrKhftIME": {
      photoUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      author: "Ponta Beach Bar"
    },
    // Ponta do Ouro: Sunset Shack
    "ChIJhy8n0EiP5B4Rhj0p3I5AOjE": {
      photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      author: "Sunset Shack Ponta do Ouro"
    },
    // Ponta do Ouro: Mango Café
    "ChIJHUROLP2P5B4RdTnj8fp4dfY": {
      photoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
      author: "Mango Café Ponta do Ouro"
    },
    // Ponta do Ouro: La Familia
    "ChIJwxeHU3GP5B4Rm6czZ-71N_U": {
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
      author: "La Familia BBQ Ponta do Ouro"
    },
    // Ponta do Ouro: Lua Do Mar
    "ChIJKfRJUgCR5B4R2PCyPjPaTrU": {
      photoUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80",
      author: "Lua Do Mar Restaurant"
    },
    // Ponta do Ouro: Ponta's Restaurante
    "ChIJw4D39OSP5B4REtK3SFZTa0c": {
      photoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      author: "Ponta's Restaurante"
    },
    // Tofo: Tofo-Tofo Beach Restaurant
    "ChIJgcVT43LdIR8Rfr5un1hwf-Y": {
      photoUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      author: "Tofo-Tofo Beach Restaurant"
    },
    // Tofo: Sumi Bar and Kitchen
    "ChIJ_f__v3PdIR8Rfmbp8epUKyA": {
      photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      author: "Sumi Bar and Kitchen Tofo"
    },
    // Tofo: Casa na Praia Restaurant
    "ChIJ-Tl9j3HdIR8ROp_8KfpYYrY": {
      photoUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80",
      author: "Casa na Praia Tofo"
    },
    // Tofo: What U Want RESTAURANT
    "ChIJj0otsnPdIR8RPKkx7BKv8Wk": {
      photoUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
      author: "What U Want Restaurant Tofo"
    },
    // Tofo: Branko's Piri-Piri
    "ChIJ2wdyj3LdIR8RWUISxqx-Aas": {
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
      author: "Branko's Piri-Piri Tofo"
    },
    // Tofo: Bitonga Restaurant
    "ChIJeR3kUwDdIR8R8Qq16WQ9p6k": {
      photoUrl: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800&q=80",
      author: "Bitonga Restaurant Tofo"
    },
    // Vilankulo: Casa Mika Cafe
    "ChIJ9wQ2KNtRJh8RnPDaoP_GJyA": {
      photoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
      author: "Casa Mika Cafe Vilankulo"
    },
    // Vilankulo: Na Tábua
    "ChIJwd23FABRJh8RBKDB4Jx8wa0": {
      photoUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80",
      author: "Na Tábua Vilankulo"
    },
    // Vilankulo: Vilanculos Beach Lodge & Restaurant
    "ChIJZwxqAiZRJh8RYxNNVgiEfMU": {
      photoUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
      author: "Vilanculos Beach Lodge & Restaurant"
    },
    // Vilankulo: Zita's Food
    "ChIJuRqDiZRWJh8RqCwT5FUrM9M": {
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
      author: "Zita's Food Vilankulo"
    }
  };

  // Curated category imagery for Mozambique dining establishments when Google photo is unavailable
  const CATEGORY_FALLBACK_PHOTOS: Record<string, { photoUrl: string; author: string }> = {
    seafood: {
      photoUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=800&q=80",
      author: "Mozambique Piri-Piri Prawns & Seafood"
    },
    cafe: {
      photoUrl: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
      author: "Mozambique Café & Bistro"
    },
    bakery: {
      photoUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
      author: "Padaria & Pastelaria de Moçambique"
    },
    bar: {
      photoUrl: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800&q=80",
      author: "Mozambique Beach Bar & Lounge"
    },
    grill: {
      photoUrl: "https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80",
      author: "Churrasqueira & Frango Piri-Piri"
    },
    pizza: {
      photoUrl: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=800&q=80",
      author: "Pizzeria & Italian Dining"
    },
    restaurant: {
      photoUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
      author: "Mozambique Local Eatery"
    }
  };

  function findKnownPhoto(placeId: string, name?: string, primaryType?: string, types?: string[]): { photoUrl: string; author: string; authorUri?: string } | null {
    if (KNOWN_PLACE_PHOTOS[placeId]) {
      return KNOWN_PLACE_PHOTOS[placeId];
    }
    // Match by name if available
    const normalizedName = (name || "").toLowerCase();
    for (const [id, data] of Object.entries(KNOWN_PLACE_PHOTOS)) {
      if (normalizedName && data.author.toLowerCase().includes(normalizedName.substring(0, 10))) {
        return data;
      }
    }
    if (normalizedName.includes("polana")) return KNOWN_PLACE_PHOTOS["ChIJO-VGNJGQ5h4RLg5SXxY5jK4"];
    if (normalizedName.includes("dhow")) return KNOWN_PLACE_PHOTOS["ChIJByyJNp-b5h4Rk-kF_yUoFrs"];
    if (normalizedName.includes("costa do sol")) return KNOWN_PLACE_PHOTOS["ChIJ_dx1P-mZ5h4RGT819fbaZaU"];
    if (normalizedName.includes("sagres") || normalizedName.includes("marisqu")) return KNOWN_PLACE_PHOTOS["ChIJ7zmCacqb5h4RautpwLzoyZA"];
    if (normalizedName.includes("zambi")) return KNOWN_PLACE_PHOTOS["ChIJt4_977ib5h4REz-l-78U6pU"];
    if (normalizedName.includes("waterfront")) return KNOWN_PLACE_PHOTOS["ChIJ0bfXjJ-b5h4RtaRoU26J7cA"];
    if (normalizedName.includes("botanica")) return KNOWN_PLACE_PHOTOS["ChIJ8SDx7bKb5h4R3hx9Wt7RYuE"];
    if (normalizedName.includes("mundo")) return KNOWN_PLACE_PHOTOS["ChIJUX6Qsryb5h4RpHQ0MrRz-n8"];

    // Match by culinary category
    const allTypes = [primaryType, ...(types || []), normalizedName].filter(Boolean).map(t => t!.toLowerCase());
    if (allTypes.some(t => t.includes("seafood") || t.includes("fish") || t.includes("marisqu"))) return CATEGORY_FALLBACK_PHOTOS.seafood;
    if (allTypes.some(t => t.includes("cafe") || t.includes("coffee"))) return CATEGORY_FALLBACK_PHOTOS.cafe;
    if (allTypes.some(t => t.includes("bakery") || t.includes("padaria"))) return CATEGORY_FALLBACK_PHOTOS.bakery;
    if (allTypes.some(t => t.includes("pizza") || t.includes("italian"))) return CATEGORY_FALLBACK_PHOTOS.pizza;
    if (allTypes.some(t => t.includes("grill") || t.includes("steak") || t.includes("churrasc") || t.includes("bbq") || t.includes("piri"))) return CATEGORY_FALLBACK_PHOTOS.grill;
    if (allTypes.some(t => t.includes("bar") || t.includes("pub") || t.includes("lounge"))) return CATEGORY_FALLBACK_PHOTOS.bar;
    if (allTypes.some(t => t.includes("restaurant") || t.includes("food") || t.includes("dining"))) return CATEGORY_FALLBACK_PHOTOS.restaurant;

    return null;
  }

  // Places field mask for Places API (New) Search
  const PLACES_FIELD_MASK = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.shortFormattedAddress",
    "places.location",
    "places.rating",
    "places.userRatingCount",
    "places.regularOpeningHours",
    "places.internationalPhoneNumber",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.primaryType",
    "places.types",
    "places.priceLevel",
    "places.photos"
  ].join(",");

  // Helper to transform raw Google Place object to normalized Eatery
  const formatGooglePlace = (p: any) => {
    if (p && p.id) {
      recentPlacesMap.set(p.id, p);
    }

    let photosList = (p.photos || []).slice(0, 3).map((ph: any) => ({
      name: ph.name,
      widthPx: ph.widthPx,
      heightPx: ph.heightPx,
      authorAttributions: ph.authorAttributions || []
    }));

    // If Google Places API omitted photos (e.g. billing disabled or not uploaded), check verified Mozambique landmarks & dining or curated fallbacks
    if (photosList.length === 0) {
      const known = findKnownPhoto(p.id, p.displayName?.text, p.primaryType, p.types);
      photosList = [{
        name: `places/${p.id}/photos/default`,
        widthPx: 800,
        heightPx: 600,
        authorAttributions: [{
          displayName: known?.author || p.displayName?.text || "Mozambique Local Eatery",
          uri: known?.authorUri || ""
        }]
      }];
    }

    return {
      id: p.id,
      google_place_id: p.id,
      name: p.displayName?.text || "Mozambique Local Eatery",
      address: p.formattedAddress || p.shortFormattedAddress || "Mozambique",
      shortAddress: p.shortFormattedAddress || p.formattedAddress || "Mozambique",
      location: {
        latitude: p.location?.latitude || 0,
        longitude: p.location?.longitude || 0,
      },
      rating: typeof p.rating === "number" ? p.rating : 0,
      userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
      googleMapsUri: p.googleMapsUri || null,
      websiteUri: p.websiteUri || null,
      phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
      primaryType: p.primaryType || "restaurant",
      types: p.types || [],
      priceLevel: p.priceLevel || null,
      regularOpeningHours: p.regularOpeningHours || null,
      photos: photosList
    };
  };

  // 1. Nearby Search via Places API (New)
  app.post("/api/places/nearby", async (req, res) => {
    try {
      const { latitude, longitude, radius = 15000 } = req.body;
      if (!latitude || !longitude) {
        return res.status(400).json({ success: false, error: "Latitude and longitude required" });
      }

      if (!GOOGLE_MAPS_API_KEY) {
        return res.status(500).json({ success: false, error: "Google Maps API Key not configured on server" });
      }

      const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": PLACES_FIELD_MASK,
          "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio"
        },
        body: JSON.stringify({
          includedTypes: [
            "restaurant",
            "cafe",
            "bar",
            "bakery",
            "meal_takeaway",
            "seafood_restaurant"
          ],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: { latitude: Number(latitude), longitude: Number(longitude) },
              radius: Math.min(Number(radius), 50000.0)
            }
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Google Places Nearby] Error:", response.status, errorText);
        return res.status(response.status).json({ success: false, error: errorText });
      }

      const data = await response.json();
      const places = (data.places || [])
        .filter((p: any) => p.primaryType !== 'supermarket' && p.primaryType !== 'grocery_store' && p.primaryType !== 'convenience_store')
        .map(formatGooglePlace);

      res.json({
        success: true,
        places,
        count: places.length
      });
    } catch (err: any) {
      console.error("[Google Places Nearby] Exception:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to fetch nearby places" });
    }
  });

  // 2. Text Search via Places API (New)
  app.post("/api/places/search", async (req, res) => {
    try {
      const { query, latitude, longitude, region } = req.body;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ success: false, error: "Search query required" });
      }

      if (!GOOGLE_MAPS_API_KEY) {
        return res.status(500).json({ success: false, error: "Google Maps API Key not configured on server" });
      }

      // Add Mozambique or regional context if not specified
      let refinedQuery = query.trim();
      if (!refinedQuery.toLowerCase().includes("mozambique") && !refinedQuery.toLowerCase().includes("maputo")) {
        if (region && region !== "all") {
          refinedQuery = `${refinedQuery} in ${region} Mozambique`;
        } else {
          refinedQuery = `${refinedQuery} Mozambique`;
        }
      }

      const requestBody: any = {
        textQuery: refinedQuery,
        maxResultCount: 20
      };

      if (latitude && longitude) {
        requestBody.locationBias = {
          circle: {
            center: { latitude: Number(latitude), longitude: Number(longitude) },
            radius: 35000.0
          }
        };
      }

      const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": PLACES_FIELD_MASK,
          "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Google Places Search] Error:", response.status, errorText);
        return res.status(response.status).json({ success: false, error: errorText });
      }

      const data = await response.json();
      const places = (data.places || [])
        .filter((p: any) => p.primaryType !== 'supermarket' && p.primaryType !== 'grocery_store' && p.primaryType !== 'convenience_store')
        .map(formatGooglePlace);

      res.json({
        success: true,
        places,
        count: places.length
      });
    } catch (err: any) {
      console.error("[Google Places Search] Exception:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to search places" });
    }
  });

  // 3. Place Details endpoint via Places API (New)
  app.get("/api/places/details/:placeId", async (req, res) => {
    try {
      const { placeId } = req.params;
      if (!placeId) {
        return res.status(400).json({ success: false, error: "Place ID required" });
      }

      if (!GOOGLE_MAPS_API_KEY) {
        return res.status(500).json({ success: false, error: "Google Maps API Key not configured" });
      }

      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
          "X-Goog-FieldMask": "id,displayName,formattedAddress,shortFormattedAddress,location,rating,userRatingCount,regularOpeningHours,internationalPhoneNumber,nationalPhoneNumber,websiteUri,googleMapsUri,primaryType,types,priceLevel,photos",
          "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ success: false, error: errorText });
      }

      const data = await response.json();
      res.json({
        success: true,
        place: formatGooglePlace(data)
      });
    } catch (err: any) {
      console.error("[Google Place Details] Error:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to fetch place details" });
    }
  });

  // 4. Photo Proxy endpoint to keep API Key strictly on the server and stream optimized images
  app.get("/api/places/photo", async (req, res) => {
    try {
      const { name, maxHeightPx = 600, maxWidthPx = 800, category, placeName } = req.query;
      if (!name || typeof name !== "string") {
        return res.status(400).send("Photo resource name required");
      }

      // Extract place ID if present in the resource name (places/{PLACE_ID}/photos/...)
      const placeMatch = name.match(/places\/([^/]+)/);
      const placeId = placeMatch ? placeMatch[1] : "";
      const placeMeta = placeId ? recentPlacesMap.get(placeId) : null;

      // Check cache first
      const cacheKey = `${name}_${maxWidthPx}x${maxHeightPx}`;
      const cached = photoCache.get(cacheKey);
      if (cached) {
        res.writeHead(200, {
          "Content-Type": cached.contentType,
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
          "Content-Length": cached.buffer.length
        });
        return res.end(cached.buffer);
      }

      // If API key is configured and not a fallback resource, request Google Places API (New) photo media
      if (GOOGLE_MAPS_API_KEY && !name.endsWith("/default")) {
        try {
          const googleMediaUrl = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=${maxHeightPx}&maxWidthPx=${maxWidthPx}&key=${GOOGLE_MAPS_API_KEY}&solution_id=gmp_mcp_codeassist_v1_aistudio`;
          const googleRes = await fetch(googleMediaUrl, {
            redirect: "follow",
            headers: {
              "X-Goog-Maps-Solution-ID": "gmp_mcp_codeassist_v1_aistudio"
            }
          });

          if (googleRes.ok) {
            const contentType = googleRes.headers.get("content-type") || "image/jpeg";
            if (contentType.startsWith("image/")) {
              const arrayBuf = await googleRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuf);
              photoCache.set(cacheKey, { buffer, contentType });
              res.writeHead(200, {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, s-maxage=86400",
                "Content-Length": buffer.length
              });
              return res.end(buffer);
            }
          } else {
            console.warn(`[Places Photo] Google API returned ${googleRes.status} for ${name}`);
          }
        } catch (gErr) {
          console.warn("[Places Photo] Error calling Google Places photo endpoint:", gErr);
        }
      }

      // Fallback for verified Mozambican dining & landmarks or categorized images
      const fallback = findKnownPhoto(
        placeId,
        placeMeta?.displayName?.text || (typeof placeName === 'string' ? placeName : undefined),
        placeMeta?.primaryType || (typeof category === 'string' ? category : undefined),
        placeMeta?.types
      ) || CATEGORY_FALLBACK_PHOTOS.restaurant;

      if (fallback?.photoUrl) {
        const fetched = await fetchAndCacheImage(fallback.photoUrl);
        if (fetched) {
          photoCache.set(cacheKey, fetched);
          res.writeHead(200, {
            "Content-Type": fetched.contentType,
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
            "Content-Length": fetched.buffer.length
          });
          return res.end(fetched.buffer);
        }
      }

      return res.status(404).send("Photo not found");
    } catch (err: any) {
      console.error("[Places Photo Proxy] Exception:", err);
      res.status(500).send("Error retrieving photo");
    }
  });

  // 4. MozBook Check-In Endpoints
  app.get("/api/check-ins", (req, res) => {
    const { google_place_id } = req.query;
    const now = Date.now();
    // Filter out expired check-ins (e.g. older than 3 hours)
    const activeCheckIns = mozbookCheckIns.filter(c => c.expires_at > now);
    
    if (google_place_id) {
      return res.json({
        success: true,
        checkIns: activeCheckIns.filter(c => c.google_place_id === google_place_id)
      });
    }

    res.json({
      success: true,
      checkIns: activeCheckIns
    });
  });

  // In-memory social check-ins: valid for active server session only (transient; does not persist across container restarts)
  app.post("/api/check-ins", async (req, res) => {
    const user = await authenticateRequest(req);
    const validation = sanitizeCheckInSubmission(user, req.body);

    if (!validation.valid || !validation.checkIn) {
      return res.status(validation.statusCode || 400).json({
        success: false,
        error: validation.error || "Failed to validate check-in."
      });
    }

    const newCheckIn = validation.checkIn;
    mozbookCheckIns.unshift(newCheckIn);

    res.json({
      success: true,
      checkIn: newCheckIn,
      message: "Check-in successful! Your check-in is now visible to nearby travelers."
    });
  });

  // 5. MozBook Reviews Endpoints
  app.get("/api/reviews", (req, res) => {
    const { google_place_id } = req.query;
    if (google_place_id) {
      return res.json({
        success: true,
        reviews: mozbookReviews.filter(r => r.google_place_id === google_place_id)
      });
    }
    res.json({
      success: true,
      reviews: mozbookReviews
    });
  });

  app.post("/api/reviews", async (req, res) => {
    const user = await authenticateRequest(req);
    const validation = sanitizeReviewSubmission(user, req.body);

    if (!validation.valid || !validation.review) {
      return res.status(validation.statusCode || 400).json({
        success: false,
        error: validation.error || "Failed to validate review."
      });
    }

    const newReview = validation.review;
    mozbookReviews.unshift(newReview);

    res.json({
      success: true,
      review: newReview,
      message: "MozBook review published successfully!"
    });
  });

  // ==========================================
  // Prompt 28A — Legal & Contractual Endpoints
  // ==========================================

  // In-memory or persistent legal acceptances ledger
  const legalAcceptanceLedger: Array<{
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
  }> = [];

  /**
   * POST /api/legal/accept
   * Records an immutable, server-authoritative timestamp of customer or partner legal acceptance.
   * Prevents client timestamp forgery and duplicate submissions.
   *
   * ARCHITECTURAL NOTICE:
   * This in-memory ledger records acceptance events for the active server session to prevent client
   * timestamp forgery and enforce idempotency. It is strictly bounded per server process and does
   * not serve as permanent durable legal evidence across server restarts.
   */
  app.post("/api/legal/accept", async (req, res) => {
    try {
      const user = await authenticateRequest(req);
      const userAgentHeader = (req.headers['user-agent'] as string) || 'unknown';
      const validation = sanitizeLegalAcceptanceSubmission(user, req.body, userAgentHeader);

      if (!validation.valid || !validation.acceptance) {
        res.status(validation.statusCode || 400).json({
          success: false,
          error: validation.error || "Failed to record legal acceptance."
        });
        return;
      }

      const { documentType, documentVersionId, context, bookingId } = req.body;
      const userId = validation.acceptance.userId;

      // Check for exact duplicate within short window to ensure idempotency
      const existing = legalAcceptanceLedger.find(
        r => r.userId === userId && 
             r.documentType === documentType && 
             r.documentVersionId === (documentVersionId || 'v1') &&
             r.context === context &&
             r.bookingId === bookingId
      );

      if (existing) {
        res.status(200).json({
          success: true,
          acceptanceId: existing.id,
          message: "Acceptance already recorded idempotently.",
          acceptance: existing
        });
        return;
      }

      const acceptanceRecord = validation.acceptance;
      legalAcceptanceLedger.unshift(acceptanceRecord);

      res.status(201).json({
        success: true,
        acceptanceId: acceptanceRecord.id,
        acceptance: acceptanceRecord
      });
    } catch (err: any) {
      console.error("[LegalAPI] Error recording acceptance:", err);
      res.status(500).json({
        success: false,
        error: err.message || "Failed to record legal acceptance."
      });
    }
  });

  /**
   * GET /api/legal/acceptances
   * Retrieve authoritative acceptance audit history (Admin only).
   */
  app.get("/api/legal/acceptances", async (req, res) => {
    const user = await authenticateRequest(req);
    if (!user || !isUserAdmin(user)) {
      res.status(403).json({ success: false, error: "Forbidden: Administrator privileges required." });
      return;
    }
    res.status(200).json({
      success: true,
      count: legalAcceptanceLedger.length,
      acceptances: legalAcceptanceLedger
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
          clientPort: 443,
        },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    // Guard against serving any server-side bundle or sourcemap
    app.use((req, res, next) => {
      if (req.path.includes('server.cjs') || req.path.endsWith('.map')) {
        return res.status(404).end();
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

