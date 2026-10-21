export type ActivityTripType = 'activity' | 'trip' | 'transport' | 'dmc_package';

export type ActivityTripStatus = 'draft' | 'pending' | 'published' | 'paused';

export type ScheduleType = 'specific_dates' | 'recurring' | 'flexible';

export type PricingType = 'per_person' | 'per_group' | 'per_booking';

export interface MultiDayDetails {
  days: number;
  nights: number;
}

export interface PickupDetails {
  offered: boolean;
  areas?: string;
  location?: string;
  instructions?: string;
  fee?: number;
}

export interface SpecialOfferConfig {
  enabled: boolean;
  offerName: string;
  discountPercent?: number;
  specialPrice?: number;
  startDate?: string;
  endDate?: string;
  seasonalTag?: string;
}

export interface ActivityTrip {
  id: string;
  hostId: string;
  hostName: string;
  hostEmail?: string;
  hostPhone?: string;
  type: ActivityTripType;
  title: string;
  shortDescription: string;
  description: string;
  category: string;
  customCategory?: string;
  city: string;
  meetingPoint: string;
  meetingPointInstructions?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  pickup: PickupDetails;
  duration: string;
  multiDayDetails?: MultiDayDetails;
  scheduleType: ScheduleType;
  recurringDays: string[];
  startTimes: string[];
  specificDates?: string[];
  maxGuests: number;
  minGuests: number;
  // MozBook Inventory Separation (Prompt 28)
  totalCapacity?: number; // Total physical experience capacity
  mozbookAllocatedCapacity?: number; // Capacity allocated to MozBook bookable inventory
  blockedDates?: string[]; // Dates blocked by operator due to external sale or maintenance
  pricingType: PricingType;
  priceAdult: number;
  priceChild?: number;
  priceGroup?: number;
  groupMaxGuests?: number;
  pricePerBooking?: number;
  currency: string; // 'MZN'
  specialOffer?: SpecialOfferConfig;
  images: string[];
  coverImage: string;
  videos?: string[];
  vehicleType?: string;
  included: string[];
  notIncluded: string[];
  whatToBring: string[];
  requirements: string[];
  status: ActivityTripStatus;
  rating: number;
  reviewsCount: number;

  // Weather-Dependent Activities & Operational Conditions (Prompt 28B)
  isWeatherDependent?: boolean;
  weatherConditions?: {
    warningTitle?: string;
    description?: string;
    seaConditions?: string; // e.g. "Calm to moderate swell required for beach launch"
    cycloneOrWindLimit?: string; // e.g. "Wind speeds under 20 knots; INAM maritime warnings trigger automatic postponement"
    rainPolicy?: 'runs_in_light_rain' | 'cancelled_on_rain' | 'operator_assessment';
    decisionCutoffHours?: number; // Hours before scheduled start operator makes final weather call (e.g. 2, 4, 12, 24)
    reschedulingOption?: boolean; // Operator offers priority rescheduling
    fullRefundOnCancellation?: boolean; // 100% full refund guarantee on severe weather cancellation
  };

  // Marketplace Cancellation Policy (Stage 4A)
  cancellationTier?: import('./cancellationPolicy').CancellationTierId;
  isNonRefundable?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface ActivityBooking {
  id: string;
  activityId: string;
  activityTitle: string;
  activityType: ActivityTripType;
  city: string;
  hostId: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  time?: string;
  adults: number;
  children: number;
  totalGuests: number;
  pricingType: PricingType;
  totalMzn: number;
  pickupRequested: boolean;
  pickupNotes?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus?: 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';
  fulfillmentStatus?: 'unfulfilled' | 'ready' | 'checked_in' | 'redeemed' | 'completed';
  travelGroupId?: string;
  paymentId?: string;
  paysuitePaymentId?: string;
  bookingRef: string;

  /** Operator Accountability & Customer Protection Fields */
  cancellationInitiator?: 'customer' | 'operator' | 'admin';
  cancellationReason?: 'operator_inventory_failure' | 'customer_request' | 'weather' | 'force_majeure' | 'other';
  operatorFailureNotes?: string;
  customerProtectionRefundMzn?: number;
  inventoryFailureDebitMzn?: number;

  /** Weather-Dependent Management & Rescheduling (Prompt 28B) */
  isWeatherDependent?: boolean;
  weatherStatus?: 'normal' | 'weather_watch' | 'weather_cancelled' | 'rescheduled';
  rescheduledFromDate?: string;
  rescheduledToDate?: string;
  rescheduledAt?: string;
  rescheduledBy?: 'operator' | 'customer' | 'admin';
  rescheduleNotes?: string;

  /** Stage 4A Versioned Cancellation Policy Snapshot & Dispute Tracking */
  cancellationSnapshot?: import('./cancellationPolicy').BookingCancellationSnapshot;
  cancellationSettlement?: import('./cancellationPolicy').CancellationSettlementCalculation;
  isDisputed?: boolean;
  disputeStatus?: 'open' | 'investigating' | 'resolved' | 'dismissed';
  disputeReason?: string;
  disputeOpenedAt?: string;
  disputeResolvedAt?: string;

  createdAt: string;
  updatedAt?: string;
}

export const ACTIVITY_CATEGORIES = [
  'Snorkeling',
  'Scuba Diving',
  'Fishing',
  'Kayaking',
  'Boat Experiences',
  'Quad Biking',
  'Paragliding',
  'Horse Riding',
  'Cooking Classes',
  'Cultural Experiences',
  'Wildlife Experiences',
  'Guided Tours',
  'Adventure Activities',
  'Wellness Experiences',
  'Family Activities',
  'Other'
];

export const TRIP_CATEGORIES = [
  'Island Excursions',
  'Boat Trips',
  'Safari',
  'Day Trips',
  'Cultural Tours',
  'Wildlife Trips',
  'Beach Excursions',
  'Multi-Day Tours',
  '4x4 Trips',
  'Other'
];

export const MOZAMBIQUE_DESTINATIONS = [
  'Tofo',
  'Vilankulo',
  'Ponta do Ouro',
  'Maputo',
  'Gorongosa',
  'Inhambane',
  'Pemba',
  'Bazaruto Archipelago',
  'Bilene',
  'Quirimbas Archipelago',
  'Ilha de Moçambique',
  'Inhaca Island'
];

export const DURATION_OPTIONS_ACTIVITY = [
  '30 minutes',
  '1 hour',
  '2 hours',
  '3 hours',
  'Half Day (4 hrs)',
  'Full Day (7-8 hrs)',
  'Custom'
];

export const DURATION_OPTIONS_TRIP = [
  'Half Day (4 hrs)',
  'Full Day (7-8 hrs)',
  '2 Days / 1 Night',
  '3 Days / 2 Nights',
  '4 Days / 3 Nights',
  'Custom Multiple Days'
];

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

export const COMMON_INCLUSIONS = [
  'Professional licensed guide',
  'Snorkeling gear (mask, snorkel, fins)',
  'Marine park entry permits',
  'Bottled mineral water',
  'Tropical fruit refreshments',
  'Seafood beach barbecue lunch',
  'Safety briefing & life jackets',
  'Open 4x4 safari viewer vehicle',
  'Skipper & fuel costs'
];

export const COMMON_WHAT_TO_BRING = [
  'Swimwear & beach towel',
  'Reef-safe sunscreen & sunglasses',
  'Hat / cap for sun protection',
  'Waterproof phone case or action camera',
  'Passports or ID copy',
  'Cash in MZN for souvenirs / gratuities',
  'Comfortable walking or reef shoes'
];
