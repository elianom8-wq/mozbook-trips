import visaDataJson from './visaExemptionData.json';

export type VisaStatus = 'NO_VISA' | 'VISA_EXEMPT_ETA' | 'VISA_REQUIRED';

export interface CountryVisaInfo {
  key: string;
  country_name: string;
  visa_status: VisaStatus;
  eta_required: boolean;
  max_stay_days: number;
  passport_validity_months: number;
  entry_message: string;
}

export const VISA_DEFAULTS = visaDataJson.defaults as CountryVisaInfo;

export const COUNTRY_VISA_LIST: CountryVisaInfo[] = Object.entries(visaDataJson)
  .filter(([key]) => key !== 'defaults')
  .map(([key, value]) => ({
    key,
    country_name: value.country_name,
    visa_status: value.visa_status as VisaStatus,
    eta_required: value.eta_required,
    max_stay_days: value.max_stay_days,
    passport_validity_months: value.passport_validity_months,
    entry_message: value.entry_message
  }))
  .sort((a, b) => a.country_name.localeCompare(b.country_name));

export function checkVisaStatus(countryNameOrKey: string): CountryVisaInfo {
  if (!countryNameOrKey) return VISA_DEFAULTS;

  const normalized = countryNameOrKey.toLowerCase().trim();

  // Try direct key or name match
  const found = COUNTRY_VISA_LIST.find(
    (c) =>
      c.key.toLowerCase() === normalized ||
      c.country_name.toLowerCase() === normalized ||
      c.country_name.toLowerCase().includes(normalized) ||
      normalized.includes(c.country_name.toLowerCase())
  );

  if (found) return found;

  // Fallback to default
  return {
    key: 'custom',
    country_name: countryNameOrKey.trim(),
    visa_status: VISA_DEFAULTS.visa_status,
    eta_required: VISA_DEFAULTS.eta_required,
    max_stay_days: VISA_DEFAULTS.max_stay_days,
    passport_validity_months: VISA_DEFAULTS.passport_validity_months,
    entry_message: VISA_DEFAULTS.entry_message
  };
}
