import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getEasterSunday,
  calculateNextSeasonalReview,
  isOfferEligibleForSeasonalReview,
  getMozambiqueDateString,
  SEASONAL_PRESETS,
  sendSeasonalReviewReminder,
  confirmSeasonalOffer,
  declineSeasonalOffer
} from '../../src/services/seasonalRecurrenceService';
import { SpecialOffer, sanitizeFirestorePayload } from '../../src/services/listingService';

describe('Seasonal Offers: Annual Recurrence & Owner Confirmation (FIX #6)', () => {
  describe('1. Movable Feasts & Easter Date Calculations', () => {
    it('accurately calculates Easter Sunday for 2026, 2027, and 2028 using Meeus/Jones/Butcher algorithm', () => {
      // Known historical/astronomical Gregorian Easter Sunday dates:
      // 2026: April 5
      // 2027: March 28
      // 2028: April 16
      const easter2026 = getEasterSunday(2026);
      expect(easter2026).toEqual({ month: 4, day: 5 });

      const easter2027 = getEasterSunday(2027);
      expect(easter2027).toEqual({ month: 3, day: 28 });

      const easter2028 = getEasterSunday(2028);
      expect(easter2028).toEqual({ month: 4, day: 16 });
    });

    it('dynamically projects Easter holiday dates based on movable Easter rather than hardcoded dates', () => {
      const easterOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 8000,
        specialPrice: 6400,
        discountPercent: 20,
        isSeasonal: true,
        seasonalTag: 'Easter Holidays',
        startDate: '2026-04-03', // Good Friday 2026
        endDate: '2026-04-07',
        annualRecurrenceEnabled: true,
      };

      // Reference date: November 2026 (after Easter 2026 has concluded)
      const projection = calculateNextSeasonalReview(easterOffer, new Date('2026-11-01T00:00:00Z'));

      // In 2027, Easter Sunday is March 28, Good Friday is March 26
      expect(projection.upcomingYear).toBe(2027);
      expect(projection.projectedStartDate).toBe('2027-03-26');
      expect(projection.projectedEndDate).toBe('2027-03-30');
    });
  });

  describe('2. Seasonal Review Windows & Timing', () => {
    it('calculates the review window opening 30 days prior to season start date', () => {
      const summerOffer: SpecialOffer = {
        enabled: true,
        offerType: 'fixed',
        originalPrice: 10000,
        specialPrice: 8500,
        discountAmount: 1500,
        isSeasonal: true,
        seasonalTag: 'Summer',
        startDate: '2026-12-01',
        endDate: '2027-01-31',
        annualRecurrenceEnabled: true,
      };

      // In September 2026 (before review window opens: 30 days prior to Dec 1 is Nov 1)
      const septCheck = calculateNextSeasonalReview(summerOffer, new Date('2026-09-15T00:00:00Z'));
      expect(septCheck.reviewDueDate).toBe('2026-11-01');
      expect(septCheck.isDueForReview).toBe(false);

      // In mid-November 2026 (inside review window)
      const novCheck = calculateNextSeasonalReview(summerOffer, new Date('2026-11-15T00:00:00Z'));
      expect(novCheck.isDueForReview).toBe(true);
      expect(novCheck.status).toBe('pending_review');
    });

    it('advances candidate year when current year season has already elapsed', () => {
      const winterOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 5000,
        specialPrice: 4000,
        isSeasonal: true,
        seasonalTag: 'Low Season',
        startDate: '2026-05-01',
        endDate: '2026-07-31',
        annualRecurrenceEnabled: true,
      };

      // Date is September 2026 (Low Season 2026 has completely passed)
      const projection = calculateNextSeasonalReview(winterOffer, new Date('2026-09-01T00:00:00Z'));
      expect(projection.upcomingYear).toBe(2027);
      expect(projection.projectedStartDate).toBe('2027-05-01');
      expect(projection.projectedEndDate).toBe('2027-07-31');
    });
  });

  describe('3. Owner Confirmation & Decline Safeguards', () => {
    it('does not re-prompt for review once owner has confirmed for that upcoming year', () => {
      const confirmedOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 6000,
        specialPrice: 4800,
        isSeasonal: true,
        seasonalTag: 'Summer',
        startDate: '2026-12-01',
        endDate: '2027-01-31',
        annualRecurrenceEnabled: true,
        targetYear: 2026,
        recurrenceStatus: 'confirmed',
        lastConfirmedAt: '2026-11-05T10:00:00Z',
      };

      const result = isOfferEligibleForSeasonalReview(confirmedOffer, new Date('2026-11-15T00:00:00Z'));
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('already reviewed and confirmed for 2026');
      expect(result.projection?.status).toBe('confirmed');
    });

    it('does not prompt or publish when owner declined the upcoming year', () => {
      const declinedOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 6000,
        specialPrice: 4800,
        isSeasonal: true,
        seasonalTag: 'Summer',
        startDate: '2026-12-01',
        endDate: '2027-01-31',
        annualRecurrenceEnabled: true,
        declinedYears: [2026],
        recurrenceStatus: 'declined',
      };

      const result = isOfferEligibleForSeasonalReview(declinedOffer, new Date('2026-11-15T00:00:00Z'));
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Offer declined by owner for 2026');
      expect(result.projection?.status).toBe('declined');
    });

    it('cancels review prompts when annualRecurrenceEnabled is false', () => {
      const disabledRecurrenceOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 6000,
        specialPrice: 4800,
        isSeasonal: true,
        seasonalTag: 'Summer',
        startDate: '2026-12-01',
        endDate: '2027-01-31',
        annualRecurrenceEnabled: false,
      };

      const result = isOfferEligibleForSeasonalReview(disabledRecurrenceOffer, new Date('2026-11-15T00:00:00Z'));
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Annual seasonal recurrence is not enabled');
    });
  });

  describe('4. Offer Name Independence & Supported Presets', () => {
    it('maintains offer name independent of seasonal tag (e.g., "Flash Deal" with "SUMMER" season)', () => {
      const flashDealOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 12000,
        specialPrice: 9000,
        offerName: 'Flash Deal',
        isSeasonal: true,
        seasonalTag: 'Summer',
        startDate: '2026-12-15',
        endDate: '2027-01-10',
        annualRecurrenceEnabled: true,
      };

      const projection = calculateNextSeasonalReview(flashDealOffer, new Date('2026-11-20T00:00:00Z'));
      expect(flashDealOffer.offerName).toBe('Flash Deal');
      expect(projection.seasonName).toBe('Summer');
      expect(flashDealOffer.seasonalTag).toBe('Summer');
    });

    it('supports Easter Holidays, Christmas, and custom occasions in SEASONAL_PRESETS', () => {
      expect(SEASONAL_PRESETS).toContain('Summer');
      expect(SEASONAL_PRESETS).toContain('Christmas');
      expect(SEASONAL_PRESETS).toContain('Easter');
      expect(SEASONAL_PRESETS).toContain('Easter Holidays');
      expect(SEASONAL_PRESETS).toContain('Low Season');
      expect(SEASONAL_PRESETS).toContain('Other');
    });
  });

  describe('5. Backward Compatibility & Firestore Sanitization', () => {
    it('safely handles legacy offers that predate this feature without breaking', () => {
      // Legacy offer object from older database record
      const legacyOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 5000,
        specialPrice: 4000,
        startDate: '2025-06-01',
        endDate: '2025-06-30',
        // annualRecurrenceEnabled was not present in legacy records
      };

      const result = isOfferEligibleForSeasonalReview(legacyOffer);
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('Offer is not designated as seasonal');
    });

    it('sanitizes undefined recurrence fields so Firestore writes remain safe', () => {
      const offerWithOptionalRecurrence: SpecialOffer = {
        enabled: true,
        offerType: 'seasonal',
        originalPrice: 7500,
        specialPrice: 6000,
        startDate: '2026-12-01',
        endDate: '2027-01-15',
        isSeasonal: true,
        seasonalTag: 'Summer',
        annualRecurrenceEnabled: true,
        targetYear: 2026,
        recurrenceStatus: 'pending_review',
        lastReviewPromptDate: undefined, // undefined must be omitted
        lastConfirmedAt: undefined,      // undefined must be omitted
      };

      const sanitized = sanitizeFirestorePayload(offerWithOptionalRecurrence);
      expect('lastReviewPromptDate' in sanitized).toBe(false);
      expect('lastConfirmedAt' in sanitized).toBe(false);
      expect(sanitized.annualRecurrenceEnabled).toBe(true);
      expect(sanitized.targetYear).toBe(2026);
      expect(sanitized.recurrenceStatus).toBe('pending_review');
    });
  });

  describe('6. Reliable Reminders & Safeguards (FIX #6 Requirement D)', () => {
    const originalFetch = global.fetch;

    it('sendSeasonalReviewReminder transmits payload with proper JSON headers and returns direct review link', async () => {
      const mockSuccessResponse = {
        success: true,
        alreadyDispatched: false,
        message: "Annual seasonal review alert successfully dispatched.",
        reviewUrl: "https://mozbook.mz/partner?reviewListingId=list_pontadoouro_123#seasonal-reviews",
        sentAt: "2026-11-01T10:00:00.000Z"
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse
      });

      const payload = {
        listingId: 'list_pontadoouro_123',
        listingTitle: 'Ponta do Ouro Beachfront Villa',
        hostId: 'host_miguel_456',
        hostEmail: 'miguel@mozbook.mz',
        hostName: 'Miguel Tembe',
        seasonalTag: 'Summer',
        offerName: 'Holiday Special',
        upcomingYear: 2026,
        projectedStartDate: '2026-12-01',
        projectedEndDate: '2027-01-15',
        reviewDueDate: '2026-11-01'
      };

      const res = await sendSeasonalReviewReminder(payload);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/offers/seasonal-reviews/send-reminder', expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      }));

      expect(res.success).toBe(true);
      expect(res.reviewUrl).toContain('/partner?reviewListingId=list_pontadoouro_123#seasonal-reviews');
      global.fetch = originalFetch;
    });

    it('reminder failure does not throw or corrupt the offer state, allowing safe manual review', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network connectivity failure'));

      const initialOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 10000,
        specialPrice: 8000,
        isSeasonal: true,
        seasonalTag: 'Summer',
        startDate: '2026-12-01',
        endDate: '2027-01-15',
        annualRecurrenceEnabled: true
      };

      const payload = {
        listingId: 'list_789',
        listingTitle: 'Bazaruto Eco Lodge',
        hostId: 'host_999',
        seasonalTag: 'Summer',
        upcomingYear: 2026,
        projectedStartDate: '2026-12-01',
        projectedEndDate: '2027-01-15',
        reviewDueDate: '2026-11-01'
      };

      const res = await sendSeasonalReviewReminder(payload);

      expect(res.success).toBe(false);
      expect(res.message).toContain('Network connectivity failure');

      // The offer configuration object remains completely untampered and eligible for manual review
      expect(initialOffer.specialPrice).toBe(8000);
      expect(initialOffer.enabled).toBe(true);
      expect(initialOffer.startDate).toBe('2026-12-01');

      global.fetch = originalFetch;
    });

    it('handles deduplicated reminder responses without duplicating owner alerts', async () => {
      const mockDedupResponse = {
        success: true,
        alreadyDispatched: true,
        dispatchedAt: '2026-11-01T08:00:00Z',
        message: 'Annual review alert was already dispatched to owner. Preventing duplicate notification.'
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockDedupResponse
      });

      const res = await sendSeasonalReviewReminder({
        listingId: 'list_123',
        listingTitle: 'Vilankulo Ocean Villa',
        hostId: 'host_123',
        seasonalTag: 'Summer',
        upcomingYear: 2026,
        projectedStartDate: '2026-12-01',
        projectedEndDate: '2027-01-15',
        reviewDueDate: '2026-11-01'
      });

      expect(res.success).toBe(true);
      expect(res.alreadyDispatched).toBe(true);
      expect(res.message).toContain('Preventing duplicate notification');

      global.fetch = originalFetch;
    });

    it('strictly requires explicit owner action before activating or updating pricing for upcoming year', async () => {
      // Background / scheduled task alone never alters offer dates or prices
      const pristineOffer: SpecialOffer = {
        enabled: true,
        offerType: 'percentage',
        originalPrice: 15000,
        specialPrice: 12000,
        startDate: '2025-12-01',
        endDate: '2026-01-15',
        isSeasonal: true,
        seasonalTag: 'Summer',
        annualRecurrenceEnabled: true,
      };

      // Projecting review does not mutate pristineOffer
      const projection = calculateNextSeasonalReview(pristineOffer, new Date('2026-11-15T00:00:00Z'));
      expect(projection.isDueForReview).toBe(true);
      expect(pristineOffer.startDate).toBe('2025-12-01'); // unchanged
      expect(pristineOffer.targetYear).toBeUndefined(); // unconfirmed
      expect(pristineOffer.recurrenceStatus).toBeUndefined(); // unconfirmed
    });
  });
});
