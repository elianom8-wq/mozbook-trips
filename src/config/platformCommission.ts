/**
 * ============================================================================
 * MOZBOOK GLOBAL BUSINESS RULE — PLATFORM COMMISSION
 * ============================================================================
 * 
 * Standard platform commission: 15% (0.15)
 * Partner corresponding share:   85% (0.85)
 * 
 * This is the SINGLE AUTHORITATIVE RULE across the entire MozBook application.
 * All accommodation, activity, trip/tour, and future supplier earnings, payout
 * calculations, and fee displays MUST derive from this configuration.
 * 
 * Formula:
 *   Gross booking amount × 15% = MozBook commission
 *   Gross booking amount × 85% = Partner share
 * 
 * Example:
 *   Customer booking:      MZN 10,000
 *   MozBook commission:    MZN  1,500 (15%)
 *   Partner share:         MZN  8,500 (85%)
 */

export const MOZBOOK_COMMISSION_RATE = 0.15;
export const MOZBOOK_COMMISSION_PERCENT = 15;

export const PARTNER_SHARE_RATE = 0.85;
export const PARTNER_SHARE_PERCENT = 85;

export interface CommissionBreakdown {
  /** Gross booking amount in MZN */
  grossAmount: number;
  /** MozBook platform commission rate (0.15) */
  commissionRate: number;
  /** MozBook platform commission percentage (15) */
  commissionPercent: number;
  /** MozBook platform commission amount in MZN (15%) */
  commissionAmount: number;
  /** Partner earnings rate (0.85) */
  partnerRate: number;
  /** Partner earnings percentage (85) */
  partnerPercent: number;
  /** Partner net share in MZN (85%) */
  partnerShare: number;
}

/**
 * Calculates authoritative platform commission and partner share from gross amount.
 * Guarantees that commissionAmount + partnerShare exactly equals grossAmount.
 */
export function calculateCommission(grossAmount: number): CommissionBreakdown {
  const safeGross = Math.max(0, Math.round(grossAmount || 0));
  const commissionAmount = Math.round(safeGross * MOZBOOK_COMMISSION_RATE);
  const partnerShare = safeGross - commissionAmount;

  return {
    grossAmount: safeGross,
    commissionRate: MOZBOOK_COMMISSION_RATE,
    commissionPercent: MOZBOOK_COMMISSION_PERCENT,
    commissionAmount,
    partnerRate: PARTNER_SHARE_RATE,
    partnerPercent: PARTNER_SHARE_PERCENT,
    partnerShare
  };
}

/**
 * Calculates net partner earnings from gross booking amount (85%).
 */
export function calculatePartnerShare(grossAmount: number): number {
  return calculateCommission(grossAmount).partnerShare;
}

/**
 * Calculates MozBook platform commission from gross booking amount (15%).
 */
export function calculatePlatformCommission(grossAmount: number): number {
  return calculateCommission(grossAmount).commissionAmount;
}
