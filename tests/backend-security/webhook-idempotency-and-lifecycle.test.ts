import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { 
  verifyPaySuiteWebhookSignature, 
  getProductionAppUrl, 
  getProductionWebhookUrl,
  DEPLOYED_PRODUCTION_DOMAIN,
  PAYSUITE_WEBHOOK_ROUTE 
} from '../../src/server/paysuiteClient';

describe('PaySuite Webhook HMAC Verification, Idempotency & Lifecycle', () => {
  const originalSecret = process.env.PAYSUITE_WEBHOOK_SECRET;
  const originalAppUrl = process.env.APP_URL;
  const testSecret = 'test_webhook_secret_key_12345';

  beforeEach(() => {
    process.env.PAYSUITE_WEBHOOK_SECRET = testSecret;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    process.env.PAYSUITE_WEBHOOK_SECRET = originalSecret;
    if (originalAppUrl !== undefined) {
      process.env.APP_URL = originalAppUrl;
    } else {
      delete process.env.APP_URL;
    }
  });

  describe('Production URL & Routing Verification', () => {
    it('resolves production webhook URL to canonical Cloud Run domain by default', () => {
      expect(DEPLOYED_PRODUCTION_DOMAIN).toBe('https://ais-pre-yndx2tyrfrmr7fjpucr3wb-285674361792.europe-west2.run.app');
      expect(PAYSUITE_WEBHOOK_ROUTE).toBe('/api/webhooks/paysuite');
      
      const webhookUrl = getProductionWebhookUrl();
      expect(webhookUrl).toBe('https://ais-pre-yndx2tyrfrmr7fjpucr3wb-285674361792.europe-west2.run.app/api/webhooks/paysuite');
      expect(webhookUrl.startsWith('https://')).toBe(true);
      expect(webhookUrl).not.toContain('localhost');
    });

    it('uses injected APP_URL if valid production domain is provided in environment', () => {
      process.env.APP_URL = 'https://custom-mozbook-domain.com/';
      expect(getProductionAppUrl()).toBe('https://custom-mozbook-domain.com');
      expect(getProductionWebhookUrl()).toBe('https://custom-mozbook-domain.com/api/webhooks/paysuite');
    });

    it('ignores localhost or placeholder APP_URL and safely falls back to Cloud Run production ingress', () => {
      process.env.APP_URL = 'http://localhost:3000';
      expect(getProductionWebhookUrl()).toBe('https://ais-pre-yndx2tyrfrmr7fjpucr3wb-285674361792.europe-west2.run.app/api/webhooks/paysuite');

      process.env.APP_URL = 'MY_APP_URL';
      expect(getProductionWebhookUrl()).toBe('https://ais-pre-yndx2tyrfrmr7fjpucr3wb-285674361792.europe-west2.run.app/api/webhooks/paysuite');
    });
  });

  describe('HMAC-SHA256 Signature Verification', () => {
    it('successfully validates a genuine webhook with matching HMAC signature (bare hex)', () => {
      const payloadString = JSON.stringify({
        event: 'payment.success',
        data: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 5000, reference: 'MB-EXP-123456' }
      });

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(Buffer.from(payloadString, 'utf8'));
      const validSignature = hmac.digest('hex');

      const isValid = verifyPaySuiteWebhookSignature(payloadString, validSignature);
      expect(isValid).toBe(true);
    });

    it('successfully validates a genuine webhook with sha256= prefix', () => {
      const payloadString = JSON.stringify({
        event: 'payment.success',
        data: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 5000, reference: 'MB-EXP-123456' }
      });

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(Buffer.from(payloadString, 'utf8'));
      const validSignature = `sha256=${hmac.digest('hex')}`;

      const isValid = verifyPaySuiteWebhookSignature(payloadString, validSignature);
      expect(isValid).toBe(true);
    });

    it('supports Buffer raw body input matching express.json verify middleware', () => {
      const payloadBuffer = Buffer.from(JSON.stringify({
        event: 'payment.success',
        data: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 5000, reference: 'MB-EXP-123456' }
      }), 'utf8');

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(payloadBuffer);
      const validSignature = hmac.digest('hex');

      const isValid = verifyPaySuiteWebhookSignature(payloadBuffer, validSignature);
      expect(isValid).toBe(true);
    });

    it('rejects a tampered payload where amount was modified', () => {
      const originalPayload = JSON.stringify({
        event: 'payment.success',
        data: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 5000, reference: 'MB-EXP-123456' }
      });

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(Buffer.from(originalPayload, 'utf8'));
      const originalSignature = hmac.digest('hex');

      // Attacker tampers amount to 500
      const tamperedPayload = JSON.stringify({
        event: 'payment.success',
        data: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 500, reference: 'MB-EXP-123456' }
      });

      const isValid = verifyPaySuiteWebhookSignature(tamperedPayload, originalSignature);
      expect(isValid).toBe(false);
    });

    it('rejects an invalid signature string', () => {
      const payload = JSON.stringify({ event: 'payment.success' });
      const fakeSignature = 'a'.repeat(64);
      expect(verifyPaySuiteWebhookSignature(payload, fakeSignature)).toBe(false);
    });

    it('rejects when signature header is missing or empty', () => {
      const payload = JSON.stringify({ event: 'payment.success' });
      expect(verifyPaySuiteWebhookSignature(payload, undefined)).toBe(false);
      expect(verifyPaySuiteWebhookSignature(payload, '')).toBe(false);
      expect(verifyPaySuiteWebhookSignature(payload, '   ')).toBe(false);
    });

    it('rejects when server webhook secret is unset or set to placeholder', () => {
      process.env.PAYSUITE_WEBHOOK_SECRET = '';
      expect(verifyPaySuiteWebhookSignature('{}', 'some_sig')).toBe(false);

      process.env.PAYSUITE_WEBHOOK_SECRET = 'MY_PAYSUITE_WEBHOOK_SECRET';
      expect(verifyPaySuiteWebhookSignature('{}', 'some_sig')).toBe(false);
    });
  });

  describe('Authoritative Webhook Processing & Contract Simulation', () => {
    interface MockPayment {
      id: string;
      status: 'pending' | 'paid' | 'failed' | 'refunded';
      amount: number;
      currency: string;
      bookingId: string;
      bookingRef: string;
      paysuitePaymentId: string;
      refundStatus?: 'pending' | 'processing' | 'completed' | 'failed';
      refundAmount?: number;
    }

    interface MockBookingRecord {
      id: string;
      status: 'pending' | 'confirmed' | 'cancelled';
      paymentStatus: 'unpaid' | 'paid' | 'failed' | 'refunded';
      fulfillmentStatus: 'unfulfilled' | 'ready' | 'checked_in';
      amount: number;
      currency: string;
    }

    interface MockPayout {
      id: string;
      paysuitePayoutId: string;
      reference: string;
      amount: number;
      status: 'pending' | 'completed' | 'failed';
    }

    // Pure state transition engine reflecting paymentService.ts logic
    function processAuthoritativeWebhook(params: {
      event: string;
      payloadData: any;
      payment?: MockPayment | null;
      booking?: MockBookingRecord | null;
      payout?: MockPayout | null;
      dbFailure?: boolean;
    }) {
      const { event, payloadData, payment, booking, payout, dbFailure } = params;

      if (dbFailure) {
        return {
          statusCode: 500,
          error: 'Firestore write error: simulated database failure to trigger PaySuite retry'
        };
      }

      // Handle payout events
      if (event.startsWith('payout.')) {
        if (!payout) {
          return { statusCode: 404, error: 'No host payout request found' };
        }
        if (event === 'payout.completed') {
          if (payout.status === 'completed') {
            return { statusCode: 200, status: 'already_completed' };
          }
          payout.status = 'completed';
          return { statusCode: 200, status: 'payout_completed' };
        }
        if (event === 'payout.failed') {
          if (payout.status === 'failed') {
            return { statusCode: 200, status: 'already_failed' };
          }
          payout.status = 'failed';
          return { statusCode: 200, status: 'payout_failed_recorded' };
        }
      }

      if (!payment) {
        return { statusCode: 404, error: 'No MozBook payment record found' };
      }

      if (!booking) {
        return { statusCode: 404, error: 'Associated reservation not found' };
      }

      // Currency check
      if (booking.currency !== 'MZN' || payment.currency !== 'MZN') {
        return { statusCode: 422, error: 'Unsupported currency' };
      }

      const isPaymentSuccess = event === 'payment.success' || event === 'payment.completed';
      const isPaymentFailed = event === 'payment.failed';
      const isPaymentPending = event === 'payment.pending';
      const isRefundSuccess = event === 'refund.success' || event === 'refund.completed';
      const isRefundFailed = event === 'refund.failed';

      // Cancelled booking check
      if (booking.status === 'cancelled' && isPaymentSuccess) {
        return { statusCode: 400, error: 'Cannot apply payment to a cancelled reservation.' };
      }

      // Amount checks
      const webhookAmount = payloadData.amount !== undefined ? Number(payloadData.amount) : payment.amount;
      if (isPaymentSuccess) {
        if (webhookAmount !== payment.amount || payment.amount !== booking.amount) {
          return {
            statusCode: 422,
            error: `Amount mismatch: Webhook=${webhookAmount}, Payment=${payment.amount}, Booking=${booking.amount}`
          };
        }
      }

      if (isRefundSuccess) {
        if (webhookAmount <= 0 || webhookAmount > payment.amount) {
          return {
            statusCode: 422,
            error: `Invalid refund amount: ${webhookAmount}`
          };
        }
      }

      // Idempotency guards
      if (isPaymentSuccess && payment.status === 'paid') {
        return { statusCode: 200, status: 'already_settled', idempotent: true };
      }
      if (isPaymentFailed && payment.status === 'failed') {
        return { statusCode: 200, status: 'already_failed', idempotent: true };
      }
      if (isRefundSuccess && payment.refundStatus === 'completed') {
        return { statusCode: 200, status: 'already_refunded', idempotent: true };
      }
      if (isRefundFailed && payment.refundStatus === 'failed') {
        return { statusCode: 200, status: 'already_refund_failed', idempotent: true };
      }

      // Transitions
      if (isPaymentPending) {
        return { statusCode: 200, status: 'pending_acknowledged' };
      }

      if (isPaymentSuccess) {
        payment.status = 'paid';
        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        booking.fulfillmentStatus = 'unfulfilled';
        return {
          statusCode: 200,
          status: 'settled',
          inventoryConfirmed: true
        };
      }

      if (isPaymentFailed) {
        payment.status = 'failed';
        booking.paymentStatus = 'failed';
        return {
          statusCode: 200,
          status: 'failed_recorded',
          inventoryReleased: true
        };
      }

      if (isRefundSuccess) {
        payment.status = 'refunded';
        payment.refundStatus = 'completed';
        payment.refundAmount = webhookAmount;
        booking.paymentStatus = 'refunded';
        return {
          statusCode: 200,
          status: 'refund_completed'
        };
      }

      if (isRefundFailed) {
        payment.refundStatus = 'failed';
        return {
          statusCode: 200,
          status: 'refund_failed_recorded'
        };
      }

      return { statusCode: 200, status: 'unhandled_event_acknowledged' };
    }

    it('settles payment.success, marks booking confirmed, and preserves unfulfilled status', () => {
      const payment: MockPayment = {
        id: 'pay_1',
        status: 'pending',
        amount: 8000,
        currency: 'MZN',
        bookingId: 'bk_1',
        bookingRef: 'MB-EXP-100001',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8F8'
      };
      const booking: MockBookingRecord = {
        id: 'bk_1',
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        amount: 8000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.success',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 8000, reference: 'MB-EXP-100001' },
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('settled');
      expect(result.inventoryConfirmed).toBe(true);
      expect(payment.status).toBe('paid');
      expect(booking.status).toBe('confirmed');
      expect(booking.paymentStatus).toBe('paid');
      expect(booking.fulfillmentStatus).toBe('unfulfilled');
    });

    it('idempotently ignores duplicate payment.success without re-confirming or double-processing', () => {
      const payment: MockPayment = {
        id: 'pay_1',
        status: 'paid',
        amount: 8000,
        currency: 'MZN',
        bookingId: 'bk_1',
        bookingRef: 'MB-EXP-100001',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8F8'
      };
      const booking: MockBookingRecord = {
        id: 'bk_1',
        status: 'confirmed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        amount: 8000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.success',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F8', amount: 8000, reference: 'MB-EXP-100001' },
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('already_settled');
      expect(result.idempotent).toBe(true);
      expect(payment.status).toBe('paid');
      expect(booking.status).toBe('confirmed');
    });

    it('handles payment.failed by updating payment/booking records and releasing inventory', () => {
      const payment: MockPayment = {
        id: 'pay_2',
        status: 'pending',
        amount: 4500,
        currency: 'MZN',
        bookingId: 'bk_2',
        bookingRef: 'MB-EXP-100002',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8F9'
      };
      const booking: MockBookingRecord = {
        id: 'bk_2',
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        amount: 4500,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.failed',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F9', amount: 4500, reference: 'MB-EXP-100002' },
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('failed_recorded');
      expect(result.inventoryReleased).toBe(true);
      expect(payment.status).toBe('failed');
      expect(booking.paymentStatus).toBe('failed');
      expect(booking.status).toBe('pending');
    });

    it('idempotently handles duplicate payment.failed delivery', () => {
      const payment: MockPayment = {
        id: 'pay_2',
        status: 'failed',
        amount: 4500,
        currency: 'MZN',
        bookingId: 'bk_2',
        bookingRef: 'MB-EXP-100002',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8F9'
      };
      const booking: MockBookingRecord = {
        id: 'bk_2',
        status: 'pending',
        paymentStatus: 'failed',
        fulfillmentStatus: 'unfulfilled',
        amount: 4500,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.failed',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F9', amount: 4500 },
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('already_failed');
    });

    it('acknowledges payment.pending without marking reservation confirmed', () => {
      const payment: MockPayment = {
        id: 'pay_p',
        status: 'pending',
        amount: 3000,
        currency: 'MZN',
        bookingId: 'bk_p',
        bookingRef: 'MB-EXP-100003',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8P1'
      };
      const booking: MockBookingRecord = {
        id: 'bk_p',
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        amount: 3000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.pending',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8P1', amount: 3000 },
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('pending_acknowledged');
      expect(booking.status).toBe('pending');
      expect(booking.paymentStatus).toBe('unpaid');
    });

    it('processes refund.success and marks payment and booking as refunded', () => {
      const payment: MockPayment = {
        id: 'pay_r',
        status: 'paid',
        amount: 5000,
        currency: 'MZN',
        bookingId: 'bk_r',
        bookingRef: 'MB-EXP-100004',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8R1'
      };
      const booking: MockBookingRecord = {
        id: 'bk_r',
        status: 'confirmed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        amount: 5000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'refund.success',
        payloadData: { 
          id: '01J8REFUND8X9Y8Z9A8B8C8D8E', 
          payment_id: '01H8X9V8X9Y8Z9A8B8C8D8E8R1', 
          amount: 5000 
        },
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('refund_completed');
      expect(payment.status).toBe('refunded');
      expect(payment.refundStatus).toBe('completed');
      expect(booking.paymentStatus).toBe('refunded');
    });

    it('rejects refund if refund amount exceeds original payment amount', () => {
      const payment: MockPayment = {
        id: 'pay_r2',
        status: 'paid',
        amount: 5000,
        currency: 'MZN',
        bookingId: 'bk_r2',
        bookingRef: 'MB-EXP-100005',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8R2'
      };
      const booking: MockBookingRecord = {
        id: 'bk_r2',
        status: 'confirmed',
        paymentStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        amount: 5000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'refund.success',
        payloadData: { 
          id: '01J8REFUND8X9Y8Z9A8B8C8D8E', 
          payment_id: '01H8X9V8X9Y8Z9A8B8C8D8E8R2', 
          amount: 9000 // Exceeds 5000
        },
        payment,
        booking
      });

      expect(result.statusCode).toBe(422);
      expect(result.error).toContain('Invalid refund amount');
    });

    it('processes host payout.completed and updates payout request', () => {
      const payout: MockPayout = {
        id: 'po_1',
        paysuitePayoutId: '01J8PAYOUT8X9Y8Z9A8B8C8D8E',
        reference: 'PO-HST-100001',
        amount: 25000,
        status: 'pending'
      };

      const result = processAuthoritativeWebhook({
        event: 'payout.completed',
        payloadData: { id: '01J8PAYOUT8X9Y8Z9A8B8C8D8E', reference: 'PO-HST-100001' },
        payout
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('payout_completed');
      expect(payout.status).toBe('completed');
    });

    it('rejects late payment settlement if reservation was already cancelled', () => {
      const payment: MockPayment = {
        id: 'pay_3',
        status: 'pending',
        amount: 6000,
        currency: 'MZN',
        bookingId: 'bk_3',
        bookingRef: 'MB-EXP-100003',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8F0'
      };
      const booking: MockBookingRecord = {
        id: 'bk_3',
        status: 'cancelled',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        amount: 6000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.success',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F0', amount: 6000 },
        payment,
        booking
      });

      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('cancelled reservation');
      expect(booking.status).toBe('cancelled');
    });

    it('rejects webhook with 422 if amount does not match authoritative booking amount', () => {
      const payment: MockPayment = {
        id: 'pay_4',
        status: 'pending',
        amount: 10000,
        currency: 'MZN',
        bookingId: 'bk_4',
        bookingRef: 'MB-EXP-100004',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8F1'
      };
      const booking: MockBookingRecord = {
        id: 'bk_4',
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        amount: 10000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.success',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8F1', amount: 5000 },
        payment,
        booking
      });

      expect(result.statusCode).toBe(422);
      expect(result.error).toContain('Amount mismatch');
      expect(payment.status).toBe('pending');
      expect(booking.status).toBe('pending');
    });

    it('returns 404 if payment identifier does not match any record', () => {
      const result = processAuthoritativeWebhook({
        event: 'payment.success',
        payloadData: { id: 'non_existent_ulid', amount: 5000 },
        payment: null,
        booking: null
      });

      expect(result.statusCode).toBe(404);
      expect(result.error).toContain('No MozBook payment record found');
    });

    it('returns 500 on database write failure to trigger PaySuite exponential backoff retry', () => {
      const payment: MockPayment = {
        id: 'pay_err',
        status: 'pending',
        amount: 5000,
        currency: 'MZN',
        bookingId: 'bk_err',
        bookingRef: 'MB-EXP-100006',
        paysuitePaymentId: '01H8X9V8X9Y8Z9A8B8C8D8E8E1'
      };
      const booking: MockBookingRecord = {
        id: 'bk_err',
        status: 'pending',
        paymentStatus: 'unpaid',
        fulfillmentStatus: 'unfulfilled',
        amount: 5000,
        currency: 'MZN'
      };

      const result = processAuthoritativeWebhook({
        event: 'payment.success',
        payloadData: { id: '01H8X9V8X9Y8Z9A8B8C8D8E8E1', amount: 5000 },
        payment,
        booking,
        dbFailure: true
      });

      expect(result.statusCode).toBe(500);
      expect(result.error).toContain('simulated database failure');
    });
  });
});
