/**
 * Formatting and normalizing helpers for MozBook Administrator Audit Logs.
 * Ensures consistent, unambiguous timestamp formatting and ISO parsing across historical
 * string dates and Firestore timestamps.
 */

export interface FormattedAuditDate {
  catDisplay: string; // Time in Mozambique Central Africa Time (CAT / UTC+2)
  utcDisplay: string; // Explicit UTC fallback
  fullDisplay: string;
}

/**
 * Format any audit log timestamp (ISO string, number, or Timestamp object) into unambiguous
 * display strings:
 * e.g., "11 Oct 2026, 02:05:41 CAT" (and "11 Oct 2026, 00:05:41 UTC")
 */
export function formatAuditTimestamp(
  rawTimestamp: string | number | { seconds: number; nanoseconds?: number } | null | undefined
): FormattedAuditDate {
  if (!rawTimestamp) {
    return {
      catDisplay: '—',
      utcDisplay: '—',
      fullDisplay: '—',
    };
  }

  let date: Date;
  if (typeof rawTimestamp === 'object' && 'seconds' in rawTimestamp) {
    date = new Date(rawTimestamp.seconds * 1000);
  } else if (typeof rawTimestamp === 'number') {
    date = new Date(rawTimestamp);
  } else if (typeof rawTimestamp === 'string') {
    date = new Date(rawTimestamp);
  } else {
    date = new Date(String(rawTimestamp));
  }

  if (isNaN(date.getTime())) {
    const fallback = String(rawTimestamp);
    return {
      catDisplay: fallback,
      utcDisplay: fallback,
      fullDisplay: fallback,
    };
  }

  // Mozambique is in Africa/Maputo (Central Africa Time, CAT, UTC+2, No daylight savings)
  const catFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Maputo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const utcFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const catFormatted = `${catFormatter.format(date)} CAT`;
  const utcFormatted = `${utcFormatter.format(date)} UTC`;

  return {
    catDisplay: catFormatted,
    utcDisplay: utcFormatted,
    fullDisplay: `${catFormatted} (${utcFormatted})`,
  };
}
