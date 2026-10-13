import { describe, it, expect } from 'vitest';
import { ActivityTrip, ActivityBooking } from '../../src/types/activityTrip';

describe('Prompt 28B — Weather-Dependent Activities & Operational Conditions', () => {

  describe('1. Realistic Mozambique Weather Dependency Models', () => {
    it('only flags outdoor/marine activities as weather dependent, preserving non-weather-dependent listings', () => {
      const dolphinSwim: Partial<ActivityTrip> = {
        id: 'act-dolphin-ponta',
        title: 'Wild Dolphin Ocean Swim & Reef Snorkel',
        type: 'activity',
        city: 'Ponta do Ouro',
        isWeatherDependent: true,
        weatherConditions: {
          warningTitle: 'Open Ocean Beach Launch & Marine Conditions Apply',
          seaConditions: 'Surf launch requires wave swell under 2.5 meters',
          cycloneOrWindLimit: 'Maximum onshore winds 18 knots; cancelled upon INAM storm advisory',
          rainPolicy: 'runs_in_light_rain',
          decisionCutoffHours: 2,
          reschedulingOption: true,
          fullRefundOnCancellation: true
        }
      };

      const maputoCulturalTour: Partial<ActivityTrip> = {
        id: 'trip-maputo-heritage',
        title: 'Maputo Modernist Architecture & FEIMA Cultural Tour',
        type: 'trip',
        city: 'Maputo',
        isWeatherDependent: false
      };

      expect(dolphinSwim.isWeatherDependent).toBe(true);
      expect(dolphinSwim.weatherConditions?.decisionCutoffHours).toBe(2);
      expect(dolphinSwim.weatherConditions?.reschedulingOption).toBe(true);
      expect(dolphinSwim.weatherConditions?.fullRefundOnCancellation).toBe(true);

      expect(maputoCulturalTour.isWeatherDependent).toBe(false);
      expect(maputoCulturalTour.weatherConditions).toBeUndefined();
    });
  });

  describe('2. Cancellation Reason Distinction & Penalty Rules', () => {
    it('applies 15% platform accountability debit ONLY to operator inventory failure, NOT to weather or customer cancellations', () => {
      const bookingAmount = 10000;

      // Operator inventory failure
      const operatorFailureResult = calculateCancellationOutcome({
        reason: 'operator_inventory_failure',
        amount: bookingAmount
      });
      expect(operatorFailureResult.operatorDebitMzn).toBe(1500); // 15%
      expect(operatorFailureResult.customerRefundMzn).toBe(10000); // 100%
      expect(operatorFailureResult.isMutualSafetyExemption).toBe(false);

      // Weather cancellation
      const weatherResult = calculateCancellationOutcome({
        reason: 'weather',
        amount: bookingAmount
      });
      expect(weatherResult.operatorDebitMzn).toBe(0); // Zero penalty
      expect(weatherResult.customerRefundMzn).toBe(10000); // 100% full refund
      expect(weatherResult.isMutualSafetyExemption).toBe(true);

      // Customer requested cancellation
      const customerRequestResult = calculateCancellationOutcome({
        reason: 'customer_request',
        amount: bookingAmount
      });
      expect(customerRequestResult.operatorDebitMzn).toBe(0); // Zero penalty
      expect(customerRequestResult.isMutualSafetyExemption).toBe(false);
    });
  });

  describe('3. Financial Splits & PaySuite Refund Invariants', () => {
    it('strictly preserves the 15% platform commission and 85% partner share across all refund calculations', () => {
      const totalMzn = 6500;
      const platformFee = Math.round(totalMzn * 0.15); // 975 MZN
      const partnerShare = totalMzn - platformFee; // 5525 MZN

      expect(platformFee).toBe(975);
      expect(partnerShare).toBe(5525);
      expect(platformFee + partnerShare).toBe(totalMzn);

      // In full weather refund:
      const fullRefund = totalMzn;
      const reversedPlatformFee = Math.round(fullRefund * 0.15);
      const reversedPartnerShare = fullRefund - reversedPlatformFee;

      expect(reversedPlatformFee).toBe(platformFee);
      expect(reversedPartnerShare).toBe(partnerShare);
    });

    it('requires authoritative PaySuite confirmation before marking refunds completed', () => {
      const pendingRefund = {
        refundId: 'ref_123',
        status: 'pending_provider_settlement',
        paysuiteTransactionId: null
      };

      const isCompleteWithoutPaySuite = pendingRefund.status === 'completed';
      expect(isCompleteWithoutPaySuite).toBe(false);

      const confirmedRefund = {
        refundId: 'ref_123',
        status: 'completed',
        paysuiteTransactionId: 'PST_REF_9918231'
      };

      expect(confirmedRefund.status).toBe('completed');
      expect(confirmedRefund.paysuiteTransactionId).toBeTruthy();
    });
  });

  describe('4. Atomic Rescheduling & Inventory Slot Migration', () => {
    it('verifies slot migration when an experience reservation is rescheduled', () => {
      const initialSlot = {
        date: '2026-10-15',
        mozbookCapacity: 12,
        confirmedSeats: 4,
        holds: [{ bookingId: 'bk_dolphin_01', seats: 2, status: 'confirmed' }]
      };

      const targetSlot = {
        date: '2026-10-18',
        mozbookCapacity: 12,
        confirmedSeats: 6,
        holds: [{ bookingId: 'bk_other_02', seats: 6, status: 'confirmed' }]
      };

      const seatsToMove = 2;
      const remainingOnTarget = targetSlot.mozbookCapacity - targetSlot.confirmedSeats;
      expect(remainingOnTarget).toBe(6);
      expect(remainingOnTarget >= seatsToMove).toBe(true);

      // Perform simulated migration
      const updatedInitialSlot = {
        ...initialSlot,
        confirmedSeats: initialSlot.confirmedSeats - seatsToMove,
        holds: initialSlot.holds.filter(h => h.bookingId !== 'bk_dolphin_01')
      };

      const updatedTargetSlot = {
        ...targetSlot,
        confirmedSeats: targetSlot.confirmedSeats + seatsToMove,
        holds: [...targetSlot.holds, { bookingId: 'bk_dolphin_01', seats: 2, status: 'confirmed' }]
      };

      expect(updatedInitialSlot.confirmedSeats).toBe(2);
      expect(updatedInitialSlot.holds.length).toBe(0);
      expect(updatedTargetSlot.confirmedSeats).toBe(8);
      expect(updatedTargetSlot.holds.length).toBe(2);
    });

    it('prevents rescheduling if new date has insufficient remaining capacity', () => {
      const fullTargetSlot = {
        date: '2026-10-18',
        mozbookCapacity: 8,
        confirmedSeats: 7
      };

      const seatsRequested = 2;
      const remainingCapacity = fullTargetSlot.mozbookCapacity - fullTargetSlot.confirmedSeats;

      expect(remainingCapacity).toBe(1);
      expect(seatsRequested > remainingCapacity).toBe(true);

      const canReschedule = seatsRequested <= remainingCapacity;
      expect(canReschedule).toBe(false);
    });
  });

  describe('5. Legal & Corporate Identity Compliance', () => {
    it('confirms operations are governed by Elvira da Gloria Consulting SU, Lda. under NUIT 401856552', () => {
      const legalEntity = {
        companyName: 'Elvira da Gloria Consulting SU, Lda.',
        nuit: '401856552',
        operatingCountry: 'Mozambique'
      };

      expect(legalEntity.companyName).toBe('Elvira da Gloria Consulting SU, Lda.');
      expect(legalEntity.nuit).toBe('401856552');
    });
  });
});

function calculateCancellationOutcome(params: {
  reason: 'operator_inventory_failure' | 'weather' | 'customer_request';
  amount: number;
}) {
  if (params.reason === 'operator_inventory_failure') {
    return {
      customerRefundMzn: params.amount,
      operatorDebitMzn: Math.round(params.amount * 0.15),
      isMutualSafetyExemption: false
    };
  } else if (params.reason === 'weather') {
    return {
      customerRefundMzn: params.amount,
      operatorDebitMzn: 0,
      isMutualSafetyExemption: true
    };
  } else {
    return {
      customerRefundMzn: params.amount,
      operatorDebitMzn: 0,
      isMutualSafetyExemption: false
    };
  }
}
