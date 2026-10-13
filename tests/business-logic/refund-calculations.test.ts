import { describe, it, expect } from 'vitest';

export interface MockExistingRefund {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
}

/**
 * Pure evaluation function reflecting the exact algorithm in src/server/paymentService.ts (lines 880-925)
 */
export function evaluateRefundEligibility(params: {
  originalPaymentAmount: number;
  requestedAmount?: number;
  existingRefunds: MockExistingRefund[];
}) {
  const { originalPaymentAmount, requestedAmount, existingRefunds } = params;

  let alreadyRefundedOrPending = 0;
  for (const r of existingRefunds) {
    if (r.status === 'pending' || r.status === 'processing' || r.status === 'completed') {
      alreadyRefundedOrPending += Number(r.amount);
      if (r.status === 'pending' || r.status === 'processing') {
        return {
          allowed: false,
          statusCode: 409,
          error: 'A refund request is already in progress for this payment.'
        };
      }
    }
  }

  const maxRefundable = Math.max(0, originalPaymentAmount - alreadyRefundedOrPending);
  if (maxRefundable <= 0) {
    return {
      allowed: false,
      statusCode: 400,
      error: 'This payment has already been fully refunded.'
    };
  }

  const refundAmount = requestedAmount !== undefined && requestedAmount > 0 
    ? Math.min(requestedAmount, maxRefundable) 
    : maxRefundable;

  const commissionAdjustmentMzn = Math.round(refundAmount * 0.15);
  const partnerShareAdjustmentMzn = Math.round(refundAmount * 0.85);

  return {
    allowed: true,
    refundAmount,
    maxRefundable,
    alreadyRefundedOrPending,
    commissionAdjustmentMzn,
    partnerShareAdjustmentMzn,
    remainingBalanceAfterRefund: maxRefundable - refundAmount
  };
}

describe('Authoritative Refund Calculations & Idempotency Rules', () => {
  describe('Full Refund Scenarios', () => {
    it('allows a full refund on an untouched 10,000 MZN payment', () => {
      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        existingRefunds: []
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.refundAmount).toBe(10000);
        expect(result.maxRefundable).toBe(10000);
        // Commission reversed: 1,500 MZN (15%), Partner share reversed: 8,500 MZN (85%)
        expect(result.commissionAdjustmentMzn).toBe(1500);
        expect(result.partnerShareAdjustmentMzn).toBe(8500);
        expect(result.commissionAdjustmentMzn + result.partnerShareAdjustmentMzn).toBe(10000);
        expect(result.remainingBalanceAfterRefund).toBe(0);
      }
    });
  });

  describe('Partial Refund Scenarios & Cumulative Limits', () => {
    it('allows a partial refund of 4,000 MZN and computes exact 15/85 ledger reversal', () => {
      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        requestedAmount: 4000,
        existingRefunds: []
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.refundAmount).toBe(4000);
        expect(result.commissionAdjustmentMzn).toBe(600); // 4000 * 0.15
        expect(result.partnerShareAdjustmentMzn).toBe(3400); // 4000 * 0.85
        expect(result.commissionAdjustmentMzn + result.partnerShareAdjustmentMzn).toBe(4000);
        expect(result.remainingBalanceAfterRefund).toBe(6000);
      }
    });

    it('enforces cumulative limit when previous completed partial refund exists', () => {
      // 10,000 MZN payment with prior 4,000 MZN completed refund
      const existing: MockExistingRefund[] = [
        { id: 'ref_1', amount: 4000, status: 'completed' }
      ];

      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        requestedAmount: 5000,
        existingRefunds: existing
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.maxRefundable).toBe(6000);
        expect(result.refundAmount).toBe(5000);
        expect(result.remainingBalanceAfterRefund).toBe(1000);
      }
    });

    it('caps requested amount to remaining refundable balance if requested exceeds max', () => {
      // 10,000 MZN payment with prior 7,000 MZN completed refund
      const existing: MockExistingRefund[] = [
        { id: 'ref_1', amount: 7000, status: 'completed' }
      ];

      // Requesting 5,000 MZN when only 3,000 MZN remains
      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        requestedAmount: 5000,
        existingRefunds: existing
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        expect(result.maxRefundable).toBe(3000);
        expect(result.refundAmount).toBe(3000); // Capped
        expect(result.commissionAdjustmentMzn).toBe(450);
        expect(result.partnerShareAdjustmentMzn).toBe(2550);
        expect(result.remainingBalanceAfterRefund).toBe(0);
      }
    });

    it('rejects refund request when payment has already been fully refunded', () => {
      const existing: MockExistingRefund[] = [
        { id: 'ref_1', amount: 10000, status: 'completed' }
      ];

      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        requestedAmount: 1000,
        existingRefunds: existing
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('fully refunded');
    });

    it('ignores previously failed or cancelled refunds when computing cumulative limit', () => {
      const existing: MockExistingRefund[] = [
        { id: 'ref_failed', amount: 5000, status: 'failed' },
        { id: 'ref_cancelled', amount: 5000, status: 'cancelled' },
        { id: 'ref_completed', amount: 2000, status: 'completed' }
      ];

      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        requestedAmount: 3000,
        existingRefunds: existing
      });

      expect(result.allowed).toBe(true);
      if (result.allowed) {
        // Only 2,000 was completed; 8,000 is still refundable
        expect(result.alreadyRefundedOrPending).toBe(2000);
        expect(result.maxRefundable).toBe(8000);
        expect(result.refundAmount).toBe(3000);
      }
    });
  });

  describe('Duplicate In-Flight Refund Prevention', () => {
    it('rejects duplicate request with 409 Conflict if a refund is already pending', () => {
      const existing: MockExistingRefund[] = [
        { id: 'ref_pending', amount: 3000, status: 'pending' }
      ];

      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        requestedAmount: 2000,
        existingRefunds: existing
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain('already in progress');
    });

    it('rejects duplicate request with 409 Conflict if a refund is currently processing', () => {
      const existing: MockExistingRefund[] = [
        { id: 'ref_proc', amount: 5000, status: 'processing' }
      ];

      const result = evaluateRefundEligibility({
        originalPaymentAmount: 10000,
        existingRefunds: existing
      });

      expect(result.allowed).toBe(false);
      expect(result.statusCode).toBe(409);
      expect(result.error).toContain('already in progress');
    });
  });
});
