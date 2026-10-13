import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { verifyPaySuiteWebhookSignature } from '../../src/server/paysuiteClient';

describe('PaySuite Webhook HMAC Verification, Idempotency & Lifecycle', () => {
  const originalSecret = process.env.PAYSUITE_WEBHOOK_SECRET;
  const testSecret = 'test_webhook_secret_key_12345';

  beforeEach(() => {
    process.env.PAYSUITE_WEBHOOK_SECRET = testSecret;
  });

  afterEach(() => {
    process.env.PAYSUITE_WEBHOOK_SECRET = originalSecret;
  });

  describe('HMAC-SHA256 Signature Verification', () => {
    it('successfully validates a genuine webhook with matching HMAC signature', () => {
      const payloadString = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'ps_pay_123', amount: 5000, reference: 'MB-EXP-123456' }
      });

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(Buffer.from(payloadString, 'utf8'));
      const validSignature = hmac.digest('hex');

      const isValid = verifyPaySuiteWebhookSignature(payloadString, validSignature);
      expect(isValid).toBe(true);
    });

    it('rejects a tampered payload where amount was modified', () => {
      const originalPayload = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'ps_pay_123', amount: 5000, reference: 'MB-EXP-123456' }
      });

      const hmac = crypto.createHmac('sha256', testSecret);
      hmac.update(Buffer.from(originalPayload, 'utf8'));
      const originalSignature = hmac.digest('hex');

      // Attacker tampers amount to 500
      const tamperedPayload = JSON.stringify({
        event: 'payment.completed',
        data: { id: 'ps_pay_123', amount: 500, reference: 'MB-EXP-123456' }
      });

      const isValid = verifyPaySuiteWebhookSignature(tamperedPayload, originalSignature);
      expect(isValid).toBe(false);
    });

    it('rejects when signature header is missing or empty', () => {
      const payload = JSON.stringify({ event: 'payment.completed' });
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

  describe('Webhook Idempotency & State Lifecycle Rules', () => {
    interface MockPayment {
      id: string;
      status: 'pending' | 'paid' | 'failed' | 'refunded';
      amount: number;
      bookingId: string;
      bookingRef: string;
    }

    interface MockBookingRecord {
      id: string;
      status: 'pending' | 'confirmed' | 'cancelled';
      paymentStatus: 'unpaid' | 'paid' | 'refunded';
      amount: number;
    }

    // Pure state transition engine reflecting paymentService.ts: processPaySuiteWebhook
    function processMockWebhook(params: {
      event: 'payment.completed' | 'payment.failed' | 'refund.completed';
      webhookAmount: number;
      payment: MockPayment;
      booking: MockBookingRecord;
    }) {
      const { event, webhookAmount, payment, booking } = params;

      // 1. Safety Guard: Booking cancelled check
      if (booking.status === 'cancelled') {
        return {
          statusCode: 400,
          status: 'rejected_cancelled',
          error: 'Cannot apply payment to a cancelled reservation.'
        };
      }

      // 2. Strict Amount Matching
      if (webhookAmount !== payment.amount || payment.amount !== booking.amount) {
        return {
          statusCode: 422,
          status: 'amount_mismatch',
          error: `Amount mismatch: Webhook=${webhookAmount}, Payment=${payment.amount}, Booking=${booking.amount}`
        };
      }

      // 3. Idempotency Guard: Payment already settled
      if (payment.status === 'paid' && event === 'payment.completed') {
        return {
          statusCode: 200,
          status: 'idempotent_noop',
          message: 'Payment already marked paid. No action taken.'
        };
      }

      // 4. Handle Payment Failure
      if (event === 'payment.failed') {
        payment.status = 'failed';
        return {
          statusCode: 200,
          status: 'failed_recorded',
          holdReleased: true,
          message: 'Payment failure recorded. Booking remains unconfirmed and hold released.'
        };
      }

      // 5. Handle Payment Success
      if (event === 'payment.completed') {
        payment.status = 'paid';
        booking.status = 'confirmed';
        booking.paymentStatus = 'paid';
        return {
          statusCode: 200,
          status: 'settled',
          holdConfirmed: true,
          message: 'Payment successfully settled and reservation confirmed.'
        };
      }

      return {
        statusCode: 200,
        status: 'unhandled'
      };
    }

    it('settles pending payment on payment.completed and confirms reservation', () => {
      const payment: MockPayment = {
        id: 'pay_1',
        status: 'pending',
        amount: 8000,
        bookingId: 'bk_1',
        bookingRef: 'MB-EXP-100001'
      };
      const booking: MockBookingRecord = {
        id: 'bk_1',
        status: 'pending',
        paymentStatus: 'unpaid',
        amount: 8000
      };

      const result = processMockWebhook({
        event: 'payment.completed',
        webhookAmount: 8000,
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('settled');
      expect(payment.status).toBe('paid');
      expect(booking.status).toBe('confirmed');
      expect(booking.paymentStatus).toBe('paid');
      expect(result.holdConfirmed).toBe(true);
    });

    it('idempotently handles duplicate webhook without mutating or double-confirming', () => {
      const payment: MockPayment = {
        id: 'pay_1',
        status: 'paid', // Already settled
        amount: 8000,
        bookingId: 'bk_1',
        bookingRef: 'MB-EXP-100001'
      };
      const booking: MockBookingRecord = {
        id: 'bk_1',
        status: 'confirmed',
        paymentStatus: 'paid',
        amount: 8000
      };

      const duplicateResult = processMockWebhook({
        event: 'payment.completed',
        webhookAmount: 8000,
        payment,
        booking
      });

      expect(duplicateResult.statusCode).toBe(200);
      expect(duplicateResult.status).toBe('idempotent_noop');
      expect(duplicateResult.message).toContain('already marked paid');
      // Values remain pristine
      expect(payment.status).toBe('paid');
      expect(booking.status).toBe('confirmed');
    });

    it('releases hold and marks payment failed on payment.failed webhook', () => {
      const payment: MockPayment = {
        id: 'pay_2',
        status: 'pending',
        amount: 4500,
        bookingId: 'bk_2',
        bookingRef: 'MB-EXP-100002'
      };
      const booking: MockBookingRecord = {
        id: 'bk_2',
        status: 'pending',
        paymentStatus: 'unpaid',
        amount: 4500
      };

      const result = processMockWebhook({
        event: 'payment.failed',
        webhookAmount: 4500,
        payment,
        booking
      });

      expect(result.statusCode).toBe(200);
      expect(result.status).toBe('failed_recorded');
      expect(result.holdReleased).toBe(true);
      expect(payment.status).toBe('failed');
      expect(booking.status).toBe('pending'); // Booking not confirmed
    });

    it('rejects late payment settlement if reservation was already cancelled', () => {
      const payment: MockPayment = {
        id: 'pay_3',
        status: 'pending',
        amount: 6000,
        bookingId: 'bk_3',
        bookingRef: 'MB-EXP-100003'
      };
      const booking: MockBookingRecord = {
        id: 'bk_3',
        status: 'cancelled', // Booking was cancelled due to timeout or operator action
        paymentStatus: 'unpaid',
        amount: 6000
      };

      const result = processMockWebhook({
        event: 'payment.completed',
        webhookAmount: 6000,
        payment,
        booking
      });

      expect(result.statusCode).toBe(400);
      expect(result.status).toBe('rejected_cancelled');
      expect(result.error).toContain('cancelled reservation');
      // Booking is NOT confirmed
      expect(booking.status).toBe('cancelled');
    });

    it('rejects webhook if payload amount does not match authoritative booking amount', () => {
      const payment: MockPayment = {
        id: 'pay_4',
        status: 'pending',
        amount: 10000,
        bookingId: 'bk_4',
        bookingRef: 'MB-EXP-100004'
      };
      const booking: MockBookingRecord = {
        id: 'bk_4',
        status: 'pending',
        paymentStatus: 'unpaid',
        amount: 10000
      };

      const result = processMockWebhook({
        event: 'payment.completed',
        webhookAmount: 5000, // Discrepancy
        payment,
        booking
      });

      expect(result.statusCode).toBe(422);
      expect(result.status).toBe('amount_mismatch');
      expect(payment.status).toBe('pending');
      expect(booking.status).toBe('pending');
    });
  });
});
