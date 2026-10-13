/**
 * MozBook Cancellation Policy Framework & Versioned Snapshots (Stage 4A)
 *
 * Grounded in Mozambique operating principles (Elvira da Gloria Consulting SU, Lda),
 * consumer protection statutory standards, and global marketplace best practices
 * (Booking.com & Airbnb tier models).
 *
 * Core Principles:
 * 1. Snapshotting: Every booking preserves the exact terms agreed to at checkout.
 * 2. Immutable Versioning: Subsequent updates to listings never alter existing bookings.
 * 3. Graceful Legacy Fallback: Historical bookings without snapshots are safely handled without fabrication.
 * 4. Transparent Split: 15% MozBook commission and 85% Partner share calculated on the net retained/refunded portion.
 * 5. Provider Accountability: Operator-initiated cancellations trigger 100% customer refund plus 15% operator debit.
 */

export type CancellationTierId =
  | 'flexible'
  | 'moderate'
  | 'strict'
  | 'non_refundable'
  | 'weather_dependent'
  | 'custom';

export type CancellationInitiator = 'customer' | 'operator' | 'admin' | 'system';

export type CancellationReasonType =
  | 'customer_request_before_deadline'
  | 'customer_request_after_deadline'
  | 'non_refundable'
  | 'customer_no_show'
  | 'customer_date_change'
  | 'operator_inventory_failure'
  | 'operator_cancellation'
  | 'material_inaccuracy'
  | 'exceptional_circumstances'
  | 'severe_weather'
  | 'mutual_agreement'
  | 'duplicate_payment'
  | 'admin_intervention';

export interface CancellationPolicyTierConfig {
  tierId: CancellationTierId;
  name: string;
  description: string;
  /** Cutoff hours prior to check-in/start date for full refund (e.g. 24 for flexible, 120 (5 days) for moderate, 336 (14 days) for strict) */
  cutoffHours: number;
  /** Percent refunded if cancelled before cutoff deadline */
  refundPercentBeforeDeadline: number;
  /** Percent refunded if cancelled after cutoff deadline */
  refundPercentAfterDeadline: number;
  /** Whether date change / rescheduling is permitted */
  reschedulingAllowed: boolean;
  /** Human-readable explanation shown at checkout and voucher */
  summaryTerms: string;
}

export const CANCELLATION_POLICY_VERSION = '1.0.0';
export const MOZAMBIQUE_TIMEZONE = 'Africa/Maputo'; // CAT (UTC+2)

export const CANCELLATION_POLICY_TIERS: Record<CancellationTierId, CancellationPolicyTierConfig> = {
  flexible: {
    tierId: 'flexible',
    name: 'Flexible',
    description: 'Full refund up to 24 hours before check-in/start time (Africa/Maputo).',
    cutoffHours: 24,
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    reschedulingAllowed: true,
    summaryTerms: 'Free cancellation up to 24 hours before arrival. Cancellations made within 24 hours are non-refundable.'
  },
  moderate: {
    tierId: 'moderate',
    name: 'Moderate',
    description: 'Full refund up to 5 days (120 hours) before check-in/start time; 50% refund thereafter.',
    cutoffHours: 120,
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 50,
    reschedulingAllowed: true,
    summaryTerms: 'Free cancellation up to 5 days before arrival. Cancellations within 5 days receive a 50% refund.'
  },
  strict: {
    tierId: 'strict',
    name: 'Strict',
    description: 'Full refund up to 14 days before check-in/start time; 50% refund up to 7 days; non-refundable thereafter.',
    cutoffHours: 336, // 14 days
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    reschedulingAllowed: false,
    summaryTerms: 'Free cancellation up to 14 days before arrival. Cancellations made less than 14 days before arrival are non-refundable.'
  },
  non_refundable: {
    tierId: 'non_refundable',
    name: 'Non-Refundable',
    description: 'Non-refundable reservation at a discounted or promotional rate.',
    cutoffHours: 0,
    refundPercentBeforeDeadline: 0,
    refundPercentAfterDeadline: 0,
    reschedulingAllowed: false,
    summaryTerms: 'This reservation is non-refundable. In case of cancellation or no-show, 100% of the booking amount is retained.'
  },
  weather_dependent: {
    tierId: 'weather_dependent',
    name: 'Weather-Dependent (Maritime & Outdoor)',
    description: 'Protected by MozBook Maritime Safety Rules. 100% full refund or free rescheduling if severe weather or INAM ban prevents activity.',
    cutoffHours: 24,
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    reschedulingAllowed: true,
    summaryTerms: 'Free customer cancellation up to 24 hours before departure. If hazardous weather or official maritime warnings prevent departure, you receive free rescheduling or an immediate 100% full refund.'
  },
  custom: {
    tierId: 'custom',
    name: 'Custom Partner Terms',
    description: 'Custom operator cancellation policy disclosed in listing description.',
    cutoffHours: 48,
    refundPercentBeforeDeadline: 100,
    refundPercentAfterDeadline: 0,
    reschedulingAllowed: true,
    summaryTerms: 'Standard 48-hour cancellation policy applies unless explicitly varied by written provider agreement.'
  }
};

/**
 * Versioned snapshot stored directly in the booking document upon creation.
 * Preserves the exact terms agreed to at checkout.
 */
export interface BookingCancellationSnapshot {
  policyId: string; // e.g. 'cancellation_refund_policy_v1'
  policyVersion: string; // e.g. '1.0.0'
  tierId: CancellationTierId;
  tierName: string;
  cutoffHours: number;
  /** ISO timestamp for absolute cancellation cutoff in Africa/Maputo timezone */
  deadlineIso: string;
  timezone: string; // 'Africa/Maputo'
  refundPercentBeforeDeadline: number;
  refundPercentAfterDeadline: number;
  reschedulingAllowed: boolean;
  acceptedAt: string;
  summaryTerms: string;
  /** Whether the reservation is non-refundable */
  isNonRefundable: boolean;
  /** Whether severe weather safety rules apply */
  isWeatherDependent: boolean;
}

/**
 * Result of evaluating cancellation settlement against authoritative policy rules
 */
export interface CancellationSettlementCalculation {
  bookingId: string;
  totalBookingAmountMzn: number;
  initiator: CancellationInitiator;
  reason: CancellationReasonType;
  snapshotAvailable: boolean;
  tierId: CancellationTierId;
  isPastDeadline: boolean;
  deadlineIso?: string;
  /** Customer refund percentage (0 - 100) */
  refundPercent: number;
  /** Customer refund amount in MZN */
  customerRefundMzn: number;
  /** Net amount retained across platform and partner */
  retainedAmountMzn: number;
  /** MozBook platform fee reversed on the refund (15% of customerRefundMzn) */
  platformCommissionReversedMzn: number;
  /** MozBook platform fee earned on retained portion (15% of retainedAmountMzn) */
  platformCommissionRetainedMzn: number;
  /** Partner share reversed on the refund (85% of customerRefundMzn) */
  partnerShareReversedMzn: number;
  /** Partner share earned on retained portion (85% of retainedAmountMzn) */
  partnerShareRetainedMzn: number;
  /** Operator inventory accountability penalty (15% debit) when operator fails */
  operatorAccountabilityDebitMzn: number;
  /** Third party PaySuite gateway fee treatment: fees are separate and non-refundable by default */
  gatewayFeeDeductedMzn: number;
  explanation: string;
}

/**
 * Computes the exact cancellation cutoff deadline ISO string for a given arrival/start date.
 * Assumes 14:00 (2:00 PM) check-in time for stays and 08:00 AM start time for activities if unspecified,
 * in Africa/Maputo (UTC+2) timezone.
 */
export function calculateCancellationDeadline(
  startDateStr: string,
  cutoffHours: number,
  startTimeStr?: string
): string {
  if (!startDateStr) return new Date().toISOString();

  // Parse YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = startDateStr.split('T')[0].split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let hours = 14; // Default check-in 14:00 Africa/Maputo
  let minutes = 0;

  if (startTimeStr) {
    const parts = startTimeStr.split(':');
    if (parts.length >= 2) {
      hours = parseInt(parts[0], 10) || 14;
      minutes = parseInt(parts[1], 10) || 0;
    }
  }

  // Mozambique is UTC+2 (no daylight saving time)
  // Create UTC date corresponding to UTC+2 time
  const targetUtcMs = Date.UTC(year, month, day, hours - 2, minutes, 0, 0);
  const deadlineUtcMs = targetUtcMs - cutoffHours * 60 * 60 * 1000;

  return new Date(deadlineUtcMs).toISOString();
}

/**
 * Creates an immutable snapshot for a new booking based on listing / activity configuration.
 */
export function buildBookingCancellationSnapshot(params: {
  tierId?: CancellationTierId;
  startDate: string;
  startTime?: string;
  isWeatherDependent?: boolean;
  isNonRefundable?: boolean;
}): BookingCancellationSnapshot {
  const effectiveTierId: CancellationTierId = params.isNonRefundable
    ? 'non_refundable'
    : params.isWeatherDependent
    ? 'weather_dependent'
    : params.tierId || 'flexible';

  const tier = CANCELLATION_POLICY_TIERS[effectiveTierId] || CANCELLATION_POLICY_TIERS.flexible;
  const deadlineIso = calculateCancellationDeadline(params.startDate, tier.cutoffHours, params.startTime);
  const nowIso = new Date().toISOString();

  return {
    policyId: 'cancellation_refund_policy_v1',
    policyVersion: CANCELLATION_POLICY_VERSION,
    tierId: tier.tierId,
    tierName: tier.name,
    cutoffHours: tier.cutoffHours,
    deadlineIso,
    timezone: MOZAMBIQUE_TIMEZONE,
    refundPercentBeforeDeadline: tier.refundPercentBeforeDeadline,
    refundPercentAfterDeadline: tier.refundPercentAfterDeadline,
    reschedulingAllowed: tier.reschedulingAllowed,
    acceptedAt: nowIso,
    summaryTerms: tier.summaryTerms,
    isNonRefundable: Boolean(params.isNonRefundable || tier.tierId === 'non_refundable'),
    isWeatherDependent: Boolean(params.isWeatherDependent || tier.tierId === 'weather_dependent')
  };
}

/**
 * Authoritative financial settlement evaluation for any cancellation scenario.
 * Strictly implements the 15% MozBook / 85% Partner split on retained amounts,
 * protects customers from provider failures, and handles legacy bookings safely.
 */
export function evaluateCancellationSettlement(params: {
  bookingId: string;
  totalBookingAmountMzn: number;
  initiator: CancellationInitiator;
  reason: CancellationReasonType;
  snapshot?: BookingCancellationSnapshot | null;
  /** Optional cancellation timestamp (defaults to now) */
  cancelledAt?: string;
  /** Legacy fallback values if snapshot is absent */
  legacyStartDate?: string;
  isWeatherDependent?: boolean;
  notes?: string;
}): CancellationSettlementCalculation {
  const totalAmount = Math.max(0, Math.round(params.totalBookingAmountMzn || 0));
  const cancelledTimeMs = params.cancelledAt ? new Date(params.cancelledAt).getTime() : Date.now();

  let refundPercent = 0;
  let operatorAccountabilityDebitMzn = 0;
  let explanation = '';
  let isPastDeadline = false;
  let deadlineIso: string | undefined = undefined;

  const snapshot = params.snapshot;
  const snapshotAvailable = Boolean(snapshot && snapshot.policyVersion);
  const tierId: CancellationTierId = snapshot?.tierId || (params.isWeatherDependent ? 'weather_dependent' : 'flexible');

  // 1. SEVERE WEATHER / MARITIME SAFETY BANS / FORCE MAJEURE (100% Refund Guarantee, No Operator Penalty)
  if (
    params.reason === 'severe_weather' ||
    params.reason === 'exceptional_circumstances'
  ) {
    refundPercent = 100;
    operatorAccountabilityDebitMzn = 0;
    explanation =
      params.reason === 'severe_weather'
        ? 'Adverse maritime weather / official INAM safety ban: Customer protected with 100% full refund without penalty to either party.'
        : 'Recognized exceptional circumstances: 100% full refund issued in accordance with MozBook Special Circumstances policy.';
  }
  // 2. CUSTOMER NO-SHOW (0% Refund, 100% Retained)
  else if (params.reason === 'customer_no_show') {
    refundPercent = 0;
    operatorAccountabilityDebitMzn = 0;
    explanation = 'Customer no-show: Reservation is non-refundable. Host retained share released; platform fee retained.';
  }
  // 3. MUTUAL AGREEMENT / DUPLICATE PAYMENT / ADMIN INTERVENTION
  else if (
    params.reason === 'mutual_agreement' ||
    params.reason === 'duplicate_payment' ||
    params.reason === 'admin_intervention'
  ) {
    refundPercent = 100;
    operatorAccountabilityDebitMzn = 0;
    explanation =
      params.reason === 'duplicate_payment'
        ? 'Duplicate payment detected and verified against PaySuite transaction ledger: 100% full reversal.'
        : params.reason === 'mutual_agreement'
        ? 'Mutual agreement between traveler and host: 100% refund approved.'
        : 'Administrative intervention: 100% full refund authorized.';
  }
  // 4. PROVIDER / OPERATOR FAILURES & SERVICE INACCURACY (100% Refund Guarantee + 15% Accountability Debit)
  else if (
    params.initiator === 'operator' ||
    params.reason === 'operator_inventory_failure' ||
    params.reason === 'operator_cancellation' ||
    params.reason === 'material_inaccuracy'
  ) {
    refundPercent = 100;
    // Platform accountability debit: 15% platform penalty debited from operator earnings
    operatorAccountabilityDebitMzn = Math.round(totalAmount * 0.15);
    explanation =
      params.reason === 'operator_inventory_failure'
        ? 'Operator inventory failure / external oversell: Customer receives 100% full refund; Operator incurs 15% platform accountability debit.'
        : params.reason === 'material_inaccuracy'
        ? 'Material listing inaccuracy / unfulfilled experience: Customer receives 100% full refund under MozBook Quality Protection; Operator debited.'
        : 'Operator-initiated cancellation: Customer protected with 100% full refund; Operator debited platform accountability fee.';
  }
  // 5. NON-REFUNDABLE RESERVATIONS
  else if (snapshot?.isNonRefundable || tierId === 'non_refundable' || params.reason === 'non_refundable') {
    refundPercent = 0;
    explanation = 'Non-refundable reservation: 0% refund. 100% booking amount retained according to accepted checkout terms.';
  }
  // 6. SNAPSHOTTED CANCELLATION EVALUATION AGAINST AGREED DEADLINE
  else if (snapshot && snapshot.deadlineIso) {
    deadlineIso = snapshot.deadlineIso;
    const deadlineMs = new Date(snapshot.deadlineIso).getTime();
    isPastDeadline = cancelledTimeMs > deadlineMs;

    if (!isPastDeadline) {
      refundPercent = snapshot.refundPercentBeforeDeadline ?? 100;
      explanation = `Customer cancelled before policy deadline (${snapshot.deadlineIso} CAT). Entitled to ${refundPercent}% refund under ${snapshot.tierName} policy.`;
    } else {
      refundPercent = snapshot.refundPercentAfterDeadline ?? 0;
      explanation = `Customer cancelled after policy deadline (${snapshot.deadlineIso} CAT). Entitled to ${refundPercent}% refund under ${snapshot.tierName} policy.`;
    }
  }
  // 7. LEGACY BOOKING FALLBACK (No Snapshot fabricated)
  else {
    // If legacy booking has a start date, calculate whether cancellation is > 24 hours prior (default flexible)
    if (params.legacyStartDate) {
      const calculatedDeadline = calculateCancellationDeadline(params.legacyStartDate, 24);
      deadlineIso = calculatedDeadline;
      isPastDeadline = cancelledTimeMs > new Date(calculatedDeadline).getTime();

      if (!isPastDeadline) {
        refundPercent = 100;
        explanation = 'Legacy booking without stored snapshot: Evaluated under baseline statutory 24-hour flexible terms. Cancelled prior to arrival; 100% refund.';
      } else {
        refundPercent = 0;
        explanation = 'Legacy booking without stored snapshot: Cancelled within 24 hours of arrival; non-refundable under baseline policy.';
      }
    } else {
      // Missing start date on legacy booking: require manual administrative review or default to customer protection
      refundPercent = params.reason === 'customer_request_before_deadline' ? 100 : 0;
      explanation = 'Legacy booking without snapshot or valid start date: Evaluated based on explicit cancellation parameters.';
    }
  }

  // Financial breakdown calculation
  const customerRefundMzn = Math.round((totalAmount * refundPercent) / 100);
  const retainedAmountMzn = totalAmount - customerRefundMzn;

  // Split calculations (15% MozBook / 85% Partner)
  // On refunded amount: Reversals
  const platformCommissionReversedMzn = Math.round(customerRefundMzn * 0.15);
  const partnerShareReversedMzn = customerRefundMzn - platformCommissionReversedMzn;

  // On retained amount: Retained revenue & earnings
  const platformCommissionRetainedMzn = Math.round(retainedAmountMzn * 0.15);
  const partnerShareRetainedMzn = retainedAmountMzn - platformCommissionRetainedMzn;

  // Third-party PaySuite processing fee is separately tracked and non-refundable by default
  const gatewayFeeDeductedMzn = 0;

  return {
    bookingId: params.bookingId,
    totalBookingAmountMzn: totalAmount,
    initiator: params.initiator,
    reason: params.reason,
    snapshotAvailable,
    tierId,
    isPastDeadline,
    deadlineIso,
    refundPercent,
    customerRefundMzn,
    retainedAmountMzn,
    platformCommissionReversedMzn,
    platformCommissionRetainedMzn,
    partnerShareReversedMzn,
    partnerShareRetainedMzn,
    operatorAccountabilityDebitMzn,
    gatewayFeeDeductedMzn,
    explanation
  };
}
