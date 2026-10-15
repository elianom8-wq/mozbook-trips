import { SpecialOffer, RecurrenceStatus } from './listingService';

export const SEASONAL_PRESETS = [
  'Summer',
  'Christmas',
  'Easter',
  'Easter Holidays',
  'New Year',
  'Holiday Season',
  'Low Season',
  'High Season',
  'Other'
] as const;

export type SeasonalPreset = typeof SEASONAL_PRESETS[number];

/**
 * Calculates Gregorian Easter Sunday for a given year using the Meeus/Jones/Butcher algorithm.
 * Returns month (1-indexed: 3 for March, 4 for April) and day.
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/**
 * Returns current date in Mozambique (CAT, UTC+2) formatted as YYYY-MM-DD.
 */
export function getMozambiqueDateString(referenceDate?: Date): string {
  const d = referenceDate || new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const catTime = new Date(utc + (2 * 3600000));
  return catTime.toISOString().split('T')[0];
}

/**
 * Format date utility YYYY-MM-DD
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export interface SeasonalReviewProjection {
  upcomingYear: number;
  projectedStartDate: string;
  projectedEndDate: string;
  reviewDueDate: string; // Typically 30 days prior to projectedStartDate
  isDueForReview: boolean;
  isAlreadyConfirmedForYear: boolean;
  isDeclinedForYear: boolean;
  status: RecurrenceStatus;
  seasonName: string;
}

/**
 * Calculates the next seasonal occurrence and annual review window for a seasonal offer.
 * Safely handles movable feasts (Easter / Easter Holidays) and fixed/calendar seasons.
 */
export function calculateNextSeasonalReview(
  offer: SpecialOffer,
  referenceDate?: Date
): SeasonalReviewProjection {
  const todayStr = getMozambiqueDateString(referenceDate);
  const todayParts = todayStr.split('-').map(Number);
  const currentYear = todayParts[0];

  const seasonTag = offer.seasonalTag || 'Summer';
  const customName = offer.customSeasonName;
  const seasonName = seasonTag === 'Other' && customName ? customName : seasonTag;

  const isEaster = seasonTag === 'Easter' || seasonTag === 'Easter Holidays';

  // Determine original offer duration in days (minimum 1 day)
  let durationDays = 7;
  if (offer.startDate && offer.endDate) {
    const origStart = new Date(offer.startDate).getTime();
    const origEnd = new Date(offer.endDate).getTime();
    if (!isNaN(origStart) && !isNaN(origEnd) && origEnd >= origStart) {
      durationDays = Math.max(1, Math.round((origEnd - origStart) / (1000 * 60 * 60 * 24)));
    }
  }

  // Helper to project dates for a candidate year
  const projectForYear = (year: number): { startDate: string; endDate: string } => {
    if (isEaster) {
      const easter = getEasterSunday(year);
      // Good Friday is 2 days before Easter Sunday
      const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));
      const goodFriday = new Date(easterDate);
      goodFriday.setUTCDate(easterDate.getUTCDate() - 2);

      const endDate = new Date(goodFriday);
      endDate.setUTCDate(goodFriday.getUTCDate() + durationDays);

      return {
        startDate: goodFriday.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    }

    // Fixed / custom season based on original start/end month & day
    const origStartParts = (offer.startDate || `${currentYear}-12-01`).split('-').map(Number);
    const origEndParts = (offer.endDate || `${currentYear}-12-31`).split('-').map(Number);

    const startMonth = origStartParts[1] || 12;
    const startDay = origStartParts[2] || 1;
    const endMonth = origEndParts[1] || 12;
    const endDay = origEndParts[2] || 31;

    // Handle cross-year seasons (e.g. Summer in Dec -> Jan/Feb)
    const endYear = (endMonth < startMonth) ? year + 1 : year;

    const startDate = `${year}-${pad2(startMonth)}-${pad2(startDay)}`;
    const endDate = `${endYear}-${pad2(endMonth)}-${pad2(endDay)}`;

    return { startDate, endDate };
  };

  // Evaluate candidate year (currentYear vs currentYear + 1)
  let candidateYear = currentYear;
  let dates = projectForYear(candidateYear);

  // If the projected season for currentYear has already completely passed, advance to next year
  if (todayStr > dates.endDate) {
    candidateYear = currentYear + 1;
    dates = projectForYear(candidateYear);
  }

  // Review window opens 30 days before projected start date
  const projStart = new Date(dates.startDate);
  const reviewDue = new Date(projStart);
  reviewDue.setDate(reviewDue.getDate() - 30);
  const reviewDueDate = reviewDue.toISOString().split('T')[0];

  const declinedYears = offer.declinedYears || [];
  const isDeclinedForYear = declinedYears.includes(candidateYear);
  const isAlreadyConfirmedForYear = offer.targetYear === candidateYear && offer.recurrenceStatus === 'confirmed';

  const isDueForReview = Boolean(
    offer.enabled &&
    offer.annualRecurrenceEnabled &&
    !isDeclinedForYear &&
    !isAlreadyConfirmedForYear &&
    todayStr >= reviewDueDate &&
    todayStr <= dates.endDate
  );

  let status: RecurrenceStatus = 'none';
  if (offer.annualRecurrenceEnabled) {
    if (isAlreadyConfirmedForYear) {
      status = 'confirmed';
    } else if (isDeclinedForYear) {
      status = 'declined';
    } else if (isDueForReview) {
      status = 'pending_review';
    }
  }

  return {
    upcomingYear: candidateYear,
    projectedStartDate: dates.startDate,
    projectedEndDate: dates.endDate,
    reviewDueDate,
    isDueForReview,
    isAlreadyConfirmedForYear,
    isDeclinedForYear,
    status,
    seasonName
  };
}

/**
 * Validates whether an offer is eligible for annual seasonal review.
 */
export function isOfferEligibleForSeasonalReview(
  offer?: SpecialOffer | null,
  referenceDate?: Date
): { eligible: boolean; reason: string; projection?: SeasonalReviewProjection } {
  if (!offer) {
    return { eligible: false, reason: 'No special offer configured' };
  }
  if (!offer.enabled) {
    return { eligible: false, reason: 'Special offer is disabled' };
  }
  if (!offer.isSeasonal) {
    return { eligible: false, reason: 'Offer is not designated as seasonal' };
  }
  if (!offer.annualRecurrenceEnabled) {
    return { eligible: false, reason: 'Annual seasonal recurrence is not enabled' };
  }

  const projection = calculateNextSeasonalReview(offer, referenceDate);
  if (projection.isAlreadyConfirmedForYear) {
    return {
      eligible: false,
      reason: `Offer already reviewed and confirmed for ${projection.upcomingYear}`,
      projection
    };
  }
  if (projection.isDeclinedForYear) {
    return {
      eligible: false,
      reason: `Offer declined by owner for ${projection.upcomingYear}`,
      projection
    };
  }
  if (!projection.isDueForReview) {
    return {
      eligible: false,
      reason: `Review window opens on ${projection.reviewDueDate} (30 days prior to ${projection.projectedStartDate})`,
      projection
    };
  }

  return {
    eligible: true,
    reason: `Offer is due for owner review for upcoming ${projection.seasonName} ${projection.upcomingYear}`,
    projection
  };
}

/**
 * Dispatches an annual seasonal review reminder to the host via backend API.
 */
export async function sendSeasonalReviewReminder(payload: {
  listingId: string;
  listingTitle: string;
  hostId: string;
  hostEmail?: string;
  hostName?: string;
  seasonalTag: string;
  offerName?: string;
  upcomingYear: number;
  projectedStartDate: string;
  projectedEndDate: string;
  reviewDueDate: string;
}): Promise<{ success: boolean; message?: string; alreadyDispatched?: boolean; reviewUrl?: string }> {
  try {
    const { auth } = await import('../firebase');
    const token = auth.currentUser && typeof (auth.currentUser as any).getIdToken === 'function'
      ? await auth.currentUser.getIdToken().catch(() => null)
      : null;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch('/api/offers/seasonal-reviews/send-reminder', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    console.error('Error sending seasonal review reminder:', err);
    return { success: false, message: err.message };
  }
}

/**
 * Confirms a seasonal offer for the upcoming year with reviewed dates and optional updated price.
 * Only upon confirmation are dates and status updated for the new year.
 */
export async function confirmSeasonalOffer(
  listingId: string,
  currentOffer: SpecialOffer,
  upcomingYear: number,
  newStartDate: string,
  newEndDate: string,
  updatedPrice?: number
): Promise<boolean> {
  const { saveListingSpecialOffer } = await import('./listingService');
  const updatedOffer: SpecialOffer = {
    ...currentOffer,
    startDate: newStartDate,
    endDate: newEndDate,
    targetYear: upcomingYear,
    recurrenceStatus: 'confirmed',
    lastConfirmedAt: new Date().toISOString(),
    specialPrice: updatedPrice !== undefined ? updatedPrice : currentOffer.specialPrice,
  };

  return await saveListingSpecialOffer(listingId, updatedOffer);
}

/**
 * Declines running the seasonal offer for the upcoming year.
 * Retains existing offer configuration without publishing or activating it for the upcoming year.
 */
export async function declineSeasonalOffer(
  listingId: string,
  currentOffer: SpecialOffer,
  upcomingYear: number
): Promise<boolean> {
  const { saveListingSpecialOffer } = await import('./listingService');
  const existingDeclined = currentOffer.declinedYears || [];
  const updatedOffer: SpecialOffer = {
    ...currentOffer,
    declinedYears: Array.from(new Set([...existingDeclined, upcomingYear])),
    recurrenceStatus: 'declined',
  };

  return await saveListingSpecialOffer(listingId, updatedOffer);
}
