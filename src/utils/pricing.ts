/**
 * Authoritative Experience and Trip Pricing Utility for MozBook
 */

export interface ExperiencePricingInput {
  pricingType: 'per_person' | 'per_group' | 'per_vehicle' | 'per_day' | 'per_trip' | string;
  priceAdult: number;
  priceChild?: number;
  priceGroup?: number;
  pricePerBooking?: number;
  specialOffer?: {
    enabled?: boolean;
    specialPrice?: number;
  };
  adults: number;
  children: number;
  pickup?: {
    fee?: number;
  };
  includePickup?: boolean;
}

export interface ExperiencePricingResult {
  baseTotal: number;
  pickupCost: number;
  finalTotal: number;
  effectiveAdultPrice: number;
  effectiveChildPrice: number;
}

export function calculateExperiencePrice(input: ExperiencePricingInput): ExperiencePricingResult {
  const effectiveAdultPrice = (input.specialOffer?.enabled && input.specialOffer.specialPrice)
    ? input.specialOffer.specialPrice
    : Math.max(0, input.priceAdult || 0);

  const effectiveChildPrice = (input.priceChild !== undefined && input.priceChild >= 0)
    ? input.priceChild
    : Math.round(effectiveAdultPrice * 0.6);

  let baseTotal = 0;
  if (input.pricingType === 'per_person') {
    const adults = Math.max(0, input.adults || 0);
    const children = Math.max(0, input.children || 0);
    baseTotal = (effectiveAdultPrice * adults) + (effectiveChildPrice * children);
  } else if (input.pricingType === 'per_group') {
    baseTotal = input.priceGroup !== undefined && input.priceGroup > 0 
      ? input.priceGroup 
      : effectiveAdultPrice;
  } else {
    baseTotal = input.pricePerBooking !== undefined && input.pricePerBooking > 0 
      ? input.pricePerBooking 
      : effectiveAdultPrice;
  }

  const pickupCost = (input.includePickup && input.pickup?.fee) ? Math.max(0, input.pickup.fee) : 0;
  const finalTotal = baseTotal + pickupCost;

  return {
    baseTotal,
    pickupCost,
    finalTotal,
    effectiveAdultPrice,
    effectiveChildPrice
  };
}
