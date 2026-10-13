import { describe, it, expect } from 'vitest';
import { 
  calculateCommission, 
  calculatePartnerShare, 
  calculatePlatformCommission,
  MOZBOOK_COMMISSION_PERCENT,
  PARTNER_SHARE_PERCENT 
} from '../../src/config/platformCommission';
import { calculateExperiencePrice } from '../../src/utils/pricing';

describe('Pricing & Platform Commission Engine', () => {
  describe('MozBook 15% Platform Commission & 85% Partner Share', () => {
    it('verifies standard rates are exactly 15% and 85%', () => {
      expect(MOZBOOK_COMMISSION_PERCENT).toBe(15);
      expect(PARTNER_SHARE_PERCENT).toBe(85);
      expect(MOZBOOK_COMMISSION_PERCENT + PARTNER_SHARE_PERCENT).toBe(100);
    });

    it('calculates exact 15/85 split on standard 10,000 MZN gross', () => {
      const breakdown = calculateCommission(10000);
      expect(breakdown.grossAmount).toBe(10000);
      expect(breakdown.commissionAmount).toBe(1500);
      expect(breakdown.partnerShare).toBe(8500);
      expect(breakdown.commissionAmount + breakdown.partnerShare).toBe(10000);
    });

    it('guarantees zero cent drift on uneven odd gross amounts (e.g. 3,333 MZN)', () => {
      const gross = 3333;
      const breakdown = calculateCommission(gross);
      // 3333 * 0.15 = 499.95 -> 500
      expect(breakdown.commissionAmount).toBe(500);
      // partnerShare must be safeGross - commissionAmount = 2833
      expect(breakdown.partnerShare).toBe(2833);
      expect(breakdown.commissionAmount + breakdown.partnerShare).toBe(gross);
    });

    it('handles small numbers, 0, and boundary cases gracefully', () => {
      const zero = calculateCommission(0);
      expect(zero.commissionAmount).toBe(0);
      expect(zero.partnerShare).toBe(0);

      const one = calculateCommission(1);
      expect(one.commissionAmount + one.partnerShare).toBe(1);

      const hundred = calculateCommission(100);
      expect(hundred.commissionAmount).toBe(15);
      expect(hundred.partnerShare).toBe(85);
    });

    it('verifies helper functions calculatePartnerShare and calculatePlatformCommission match breakdown', () => {
      const gross = 12500;
      expect(calculatePartnerShare(gross)).toBe(10625);
      expect(calculatePlatformCommission(gross)).toBe(1875);
      expect(calculatePartnerShare(gross) + calculatePlatformCommission(gross)).toBe(gross);
    });
  });

  describe('Adult/Child and Group Pricing Engine', () => {
    it('calculates per_person pricing for adults and explicit children price', () => {
      const result = calculateExperiencePrice({
        pricingType: 'per_person',
        priceAdult: 2000,
        priceChild: 1000,
        adults: 2,
        children: 2
      });

      // (2000 * 2) + (1000 * 2) = 4000 + 2000 = 6000
      expect(result.effectiveAdultPrice).toBe(2000);
      expect(result.effectiveChildPrice).toBe(1000);
      expect(result.baseTotal).toBe(6000);
      expect(result.finalTotal).toBe(6000);
    });

    it('calculates per_person pricing with default 60% child discount when child price not specified', () => {
      const result = calculateExperiencePrice({
        pricingType: 'per_person',
        priceAdult: 3000,
        adults: 1,
        children: 1
      });

      // Child price defaults to 60% of adult: 3000 * 0.6 = 1800
      expect(result.effectiveAdultPrice).toBe(3000);
      expect(result.effectiveChildPrice).toBe(1800);
      // (3000 * 1) + (1800 * 1) = 4800
      expect(result.baseTotal).toBe(4800);
      expect(result.finalTotal).toBe(4800);
    });

    it('calculates per_group flat rate regardless of traveler count', () => {
      const result = calculateExperiencePrice({
        pricingType: 'per_group',
        priceAdult: 2500,
        priceGroup: 8000,
        adults: 4,
        children: 2
      });

      expect(result.baseTotal).toBe(8000);
      expect(result.finalTotal).toBe(8000);
    });

    it('applies special offer discounted rate when enabled', () => {
      const result = calculateExperiencePrice({
        pricingType: 'per_person',
        priceAdult: 4000,
        priceChild: 2000,
        specialOffer: {
          enabled: true,
          specialPrice: 3200
        },
        adults: 2,
        children: 1
      });

      // Effective adult price is 3200
      expect(result.effectiveAdultPrice).toBe(3200);
      expect(result.effectiveChildPrice).toBe(2000);
      // (3200 * 2) + (2000 * 1) = 6400 + 2000 = 8400
      expect(result.baseTotal).toBe(8400);
      expect(result.finalTotal).toBe(8400);
    });

    it('ignores special offer when disabled', () => {
      const result = calculateExperiencePrice({
        pricingType: 'per_person',
        priceAdult: 4000,
        specialOffer: {
          enabled: false,
          specialPrice: 3000
        },
        adults: 2,
        children: 0
      });

      expect(result.effectiveAdultPrice).toBe(4000);
      expect(result.baseTotal).toBe(8000);
    });

    it('incorporates pickup fees correctly when requested', () => {
      const withPickup = calculateExperiencePrice({
        pricingType: 'per_person',
        priceAdult: 1500,
        adults: 2,
        children: 0,
        pickup: { fee: 1000 },
        includePickup: true
      });

      expect(withPickup.baseTotal).toBe(3000);
      expect(withPickup.pickupCost).toBe(1000);
      expect(withPickup.finalTotal).toBe(4000);

      const withoutPickup = calculateExperiencePrice({
        pricingType: 'per_person',
        priceAdult: 1500,
        adults: 2,
        children: 0,
        pickup: { fee: 1000 },
        includePickup: false
      });

      expect(withoutPickup.baseTotal).toBe(3000);
      expect(withoutPickup.pickupCost).toBe(0);
      expect(withoutPickup.finalTotal).toBe(3000);
    });
  });
});
