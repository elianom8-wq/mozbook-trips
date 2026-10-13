import { describe, it, expect } from 'vitest';
import {
  CANCELLATION_POLICY_TIERS,
  buildBookingCancellationSnapshot,
  calculateCancellationDeadline,
  evaluateCancellationSettlement,
  BookingCancellationSnapshot
} from '../../src/types/cancellationPolicy';

describe('Stage 4A: Marketplace Cancellation Policy & Settlement Integrity', () => {
  describe('Policy Tiers Configuration & Deadlines', () => {
    it('defines standard flexible, moderate, strict, non-refundable, and weather-dependent tiers', () => {
      expect(CANCELLATION_POLICY_TIERS.flexible).toBeDefined();
      expect(CANCELLATION_POLICY_TIERS.moderate).toBeDefined();
      expect(CANCELLATION_POLICY_TIERS.strict).toBeDefined();
      expect(CANCELLATION_POLICY_TIERS.non_refundable).toBeDefined();
      expect(CANCELLATION_POLICY_TIERS.weather_dependent).toBeDefined();

      expect(CANCELLATION_POLICY_TIERS.flexible.cutoffHours).toBe(24);
      expect(CANCELLATION_POLICY_TIERS.moderate.cutoffHours).toBe(120);
      expect(CANCELLATION_POLICY_TIERS.strict.cutoffHours).toBe(336);
    });

    it('calculates Africa/Maputo timezone deadline accurately', () => {
      // 2026-12-20 check-in at 14:00 CAT (UTC+2) -> 12:00 UTC
      // Flexible (24h cutoff) deadline is 2026-12-19 12:00 UTC (14:00 CAT)
      const deadline = calculateCancellationDeadline('2026-12-20', 24, '14:00');
      const d = new Date(deadline);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(d.getUTCDate()).toBe(19);
      expect(d.getUTCHours()).toBe(12);
    });
  });

  describe('Booking Cancellation Snapshots', () => {
    it('builds an immutable snapshot preserving agreed checkout terms and policy version', () => {
      const snapshot = buildBookingCancellationSnapshot({
        tierId: 'moderate',
        startDate: '2026-12-25',
        startTime: '14:00',
        isWeatherDependent: false
      });

      expect(snapshot.policyVersion).toBe('1.0.0');
      expect(snapshot.tierId).toBe('moderate');
      expect(snapshot.cutoffHours).toBe(120);
      expect(snapshot.refundPercentBeforeDeadline).toBe(100);
      expect(snapshot.refundPercentAfterDeadline).toBe(50);
      expect(snapshot.timezone).toBe('Africa/Maputo');
      expect(snapshot.deadlineIso).toBeDefined();
      expect(snapshot.acceptedAt).toBeDefined();
    });

    it('automatically uses weather_dependent tier when activity is flagged weather dependent', () => {
      const snapshot = buildBookingCancellationSnapshot({
        startDate: '2026-12-25',
        isWeatherDependent: true
      });

      expect(snapshot.tierId).toBe('weather_dependent');
      expect(snapshot.isWeatherDependent).toBe(true);
      expect(snapshot.summaryTerms).toContain('maritime warnings');
    });

    it('automatically uses non_refundable tier when booking is non-refundable', () => {
      const snapshot = buildBookingCancellationSnapshot({
        startDate: '2026-12-25',
        isNonRefundable: true
      });

      expect(snapshot.tierId).toBe('non_refundable');
      expect(snapshot.isNonRefundable).toBe(true);
      expect(snapshot.refundPercentBeforeDeadline).toBe(0);
      expect(snapshot.refundPercentAfterDeadline).toBe(0);
    });
  });

  describe('Cancellation Settlement Engine & 15/85 Reconciliation', () => {
    it('evaluates customer cancellation before flexible deadline (100% refund, 0 retained)', () => {
      const snapshot: BookingCancellationSnapshot = {
        policyId: 'cancellation_refund_policy_v1',
        policyVersion: '1.0.0',
        tierId: 'flexible',
        tierName: 'Flexible',
        cutoffHours: 24,
        deadlineIso: '2026-12-20T12:00:00.000Z',
        timezone: 'Africa/Maputo',
        refundPercentBeforeDeadline: 100,
        refundPercentAfterDeadline: 0,
        reschedulingAllowed: true,
        acceptedAt: '2026-10-10T00:00:00.000Z',
        summaryTerms: 'Free cancellation up to 24h before arrival',
        isNonRefundable: false,
        isWeatherDependent: false
      };

      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_123',
        totalBookingAmountMzn: 10000,
        initiator: 'customer',
        reason: 'customer_request_before_deadline',
        snapshot,
        cancelledAt: '2026-12-18T10:00:00.000Z' // Prior to deadline
      });

      expect(settlement.refundPercent).toBe(100);
      expect(settlement.customerRefundMzn).toBe(10000);
      expect(settlement.retainedAmountMzn).toBe(0);
      expect(settlement.platformCommissionReversedMzn).toBe(1500);
      expect(settlement.partnerShareReversedMzn).toBe(8500);
      expect(settlement.platformCommissionRetainedMzn).toBe(0);
      expect(settlement.partnerShareRetainedMzn).toBe(0);
      expect(settlement.operatorAccountabilityDebitMzn).toBe(0);
    });

    it('evaluates customer cancellation after flexible deadline (0% refund, 100% retained with 15/85 split)', () => {
      const snapshot: BookingCancellationSnapshot = {
        policyId: 'cancellation_refund_policy_v1',
        policyVersion: '1.0.0',
        tierId: 'flexible',
        tierName: 'Flexible',
        cutoffHours: 24,
        deadlineIso: '2026-12-20T12:00:00.000Z',
        timezone: 'Africa/Maputo',
        refundPercentBeforeDeadline: 100,
        refundPercentAfterDeadline: 0,
        reschedulingAllowed: true,
        acceptedAt: '2026-10-10T00:00:00.000Z',
        summaryTerms: 'Free cancellation up to 24h before arrival',
        isNonRefundable: false,
        isWeatherDependent: false
      };

      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_123',
        totalBookingAmountMzn: 10000,
        initiator: 'customer',
        reason: 'customer_request_after_deadline',
        snapshot,
        cancelledAt: '2026-12-20T13:00:00.000Z' // Past deadline
      });

      expect(settlement.refundPercent).toBe(0);
      expect(settlement.customerRefundMzn).toBe(0);
      expect(settlement.retainedAmountMzn).toBe(10000);
      // Retained split: 15% MozBook commission (1,500), 85% Partner share (8,500)
      expect(settlement.platformCommissionRetainedMzn).toBe(1500);
      expect(settlement.partnerShareRetainedMzn).toBe(8500);
      expect(settlement.platformCommissionRetainedMzn + settlement.partnerShareRetainedMzn).toBe(10000);
    });

    it('evaluates moderate tier late cancellation (50% refund, 50% retained)', () => {
      const snapshot: BookingCancellationSnapshot = {
        policyId: 'cancellation_refund_policy_v1',
        policyVersion: '1.0.0',
        tierId: 'moderate',
        tierName: 'Moderate',
        cutoffHours: 120,
        deadlineIso: '2026-12-20T12:00:00.000Z',
        timezone: 'Africa/Maputo',
        refundPercentBeforeDeadline: 100,
        refundPercentAfterDeadline: 50,
        reschedulingAllowed: true,
        acceptedAt: '2026-10-10T00:00:00.000Z',
        summaryTerms: '50% refund after deadline',
        isNonRefundable: false,
        isWeatherDependent: false
      };

      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_123',
        totalBookingAmountMzn: 10000,
        initiator: 'customer',
        reason: 'customer_request_after_deadline',
        snapshot,
        cancelledAt: '2026-12-21T00:00:00.000Z' // Past deadline
      });

      expect(settlement.refundPercent).toBe(50);
      expect(settlement.customerRefundMzn).toBe(5000);
      expect(settlement.retainedAmountMzn).toBe(5000);

      // Reversal on refund (5,000 MZN): 750 MozBook reversal, 4,250 Partner reversal
      expect(settlement.platformCommissionReversedMzn).toBe(750);
      expect(settlement.partnerShareReversedMzn).toBe(4250);

      // Earnings on retained (5,000 MZN): 750 MozBook commission, 4,250 Partner share
      expect(settlement.platformCommissionRetainedMzn).toBe(750);
      expect(settlement.partnerShareRetainedMzn).toBe(4250);
    });

    it('evaluates operator inventory failure with 100% customer refund and 15% platform accountability debit', () => {
      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_oversold',
        totalBookingAmountMzn: 20000,
        initiator: 'operator',
        reason: 'operator_inventory_failure'
      });

      expect(settlement.refundPercent).toBe(100);
      expect(settlement.customerRefundMzn).toBe(20000);
      expect(settlement.retainedAmountMzn).toBe(0);
      // 15% operator accountability debit
      expect(settlement.operatorAccountabilityDebitMzn).toBe(3000); // 20000 * 0.15
      expect(settlement.explanation).toContain('Operator inventory failure');
    });

    it('evaluates severe weather cancellation with 100% full customer refund and 0 operator debit', () => {
      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_weather',
        totalBookingAmountMzn: 8000,
        initiator: 'operator',
        reason: 'severe_weather',
        isWeatherDependent: true
      });

      expect(settlement.refundPercent).toBe(100);
      expect(settlement.customerRefundMzn).toBe(8000);
      expect(settlement.operatorAccountabilityDebitMzn).toBe(0);
      expect(settlement.explanation).toContain('maritime weather');
    });

    it('evaluates customer no-show with 0% refund and full retained split', () => {
      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_noshow',
        totalBookingAmountMzn: 10000,
        initiator: 'operator',
        reason: 'customer_no_show'
      });

      expect(settlement.refundPercent).toBe(0);
      expect(settlement.customerRefundMzn).toBe(0);
      expect(settlement.retainedAmountMzn).toBe(10000);
      expect(settlement.platformCommissionRetainedMzn).toBe(1500);
      expect(settlement.partnerShareRetainedMzn).toBe(8500);
    });

    it('safely handles legacy bookings without snapshots without fabricating records', () => {
      const settlement = evaluateCancellationSettlement({
        bookingId: 'bk_legacy',
        totalBookingAmountMzn: 5000,
        initiator: 'customer',
        reason: 'customer_request_before_deadline',
        snapshot: null,
        legacyStartDate: '2026-12-25',
        cancelledAt: '2026-12-20T00:00:00.000Z'
      });

      expect(settlement.snapshotAvailable).toBe(false);
      expect(settlement.refundPercent).toBe(100);
      expect(settlement.explanation).toContain('Legacy booking without stored snapshot');
    });
  });
});
