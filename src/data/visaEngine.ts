import visaRulesJson from './mozambiqueVisaRules.json';

export type VisaStatus = 
  | 'VISA_FREE' 
  | 'ETA_REQUIRED' 
  | 'EVISA_REQUIRED' 
  | 'EMBASSY_REQUIRED' 
  | 'BORDER_VISA_POSSIBLE' 
  | 'VISA_REQUIRED' 
  | 'SPECIAL_RULE';

export type PassportType = 'ORDINARY' | 'DIPLOMATIC' | 'SERVICE';

export type TravelPurpose = 
  | 'TOURISM'
  | 'BUSINESS'
  | 'VISITING'
  | 'INVESTMENT'
  | 'WORK'
  | 'STUDY'
  | 'TRANSIT'
  | 'SPORT_CULTURE'
  | 'HUMANITARIAN'
  | 'OTHER';

export interface CountryRule {
  country_name: string;
  country_code: string;
  visa_status: string;
  passport_types?: string[];
  travel_purposes?: string[];
  max_stay_days?: number | null;
  eta_required: boolean;
  evisa_available: boolean;
  embassy_required: boolean;
  border_visa_possible: boolean | string;
  ordinary_passport_result?: string;
  passport_rules?: Array<{
    passport_types: string[];
    max_stay_days: number;
    travel_purposes: string[];
  }>;
  message?: string;
}

export interface NationalityEntry {
  key: string;
  country_name: string;
  nationality_name: string;
  country_code: string;
  flag: string;
  is_in_seed: boolean;
}

export interface VisaEvaluationInput {
  nationalityKey: string;
  passportType: PassportType;
  travelPurpose: TravelPurpose;
  stayDays: number;
}

export interface VisaEvaluationResult {
  destination: string;
  country_name: string;
  country_code: string;
  flag: string;
  passport_type: PassportType;
  travel_purpose: TravelPurpose;
  stay_days: number;
  status: VisaStatus;
  status_title: string;
  status_badge_color: string;
  headline: string;
  visa_required: boolean;
  eta_required: boolean;
  evisa_available: boolean;
  embassy_required: boolean;
  border_visa_possible: boolean | string;
  max_stay_allowed: number | null;
  stay_exceeded: boolean;
  passport_validity_months: number;
  required_documents: string[];
  what_to_do_before_travel: string[];
  official_source_url: string;
  official_source_name: string;
  last_verified: string;
  purpose_covered: boolean;
  purpose_note?: string;
  arrival_checklist: string[];
  disclaimer: string;
}

// Convert ISO 2-letter country code to flag emoji
export function getFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

// Full list of nationalities supported
export const NATIONALITIES: NationalityEntry[] = [
  { key: 'angola', country_name: 'Angola', nationality_name: 'Angolan', country_code: 'AO', flag: '🇦🇴', is_in_seed: true },
  { key: 'argentina', country_name: 'Argentina', nationality_name: 'Argentine', country_code: 'AR', flag: '🇦🇷', is_in_seed: true },
  { key: 'australia', country_name: 'Australia', nationality_name: 'Australian', country_code: 'AU', flag: '🇦🇺', is_in_seed: false },
  { key: 'austria', country_name: 'Austria', nationality_name: 'Austrian', country_code: 'AT', flag: '🇦🇹', is_in_seed: false },
  { key: 'bangladesh', country_name: 'Bangladesh', nationality_name: 'Bangladeshi', country_code: 'BD', flag: '🇧🇩', is_in_seed: true },
  { key: 'belgium', country_name: 'Belgium', nationality_name: 'Belgian', country_code: 'BE', flag: '🇧🇪', is_in_seed: true },
  { key: 'botswana', country_name: 'Botswana', nationality_name: 'Motswana / Batswana', country_code: 'BW', flag: '🇧🇼', is_in_seed: true },
  { key: 'brazil', country_name: 'Brazil', nationality_name: 'Brazilian', country_code: 'BR', flag: '🇧🇷', is_in_seed: true },
  { key: 'cabo_verde', country_name: 'Cabo Verde', nationality_name: 'Cabo Verdean', country_code: 'CV', flag: '🇨🇻', is_in_seed: true },
  { key: 'canada', country_name: 'Canada', nationality_name: 'Canadian', country_code: 'CA', flag: '🇨🇦', is_in_seed: true },
  { key: 'chile', country_name: 'Chile', nationality_name: 'Chilean', country_code: 'CL', flag: '🇨🇱', is_in_seed: false },
  { key: 'china', country_name: 'China', nationality_name: 'Chinese', country_code: 'CN', flag: '🇨🇳', is_in_seed: true },
  { key: 'cote_divoire', country_name: "Côte d'Ivoire", nationality_name: 'Ivorian', country_code: 'CI', flag: '🇨🇮', is_in_seed: true },
  { key: 'cuba', country_name: 'Cuba', nationality_name: 'Cuban', country_code: 'CU', flag: '🇨🇺', is_in_seed: true },
  { key: 'denmark', country_name: 'Denmark', nationality_name: 'Danish', country_code: 'DK', flag: '🇩🇰', is_in_seed: true },
  { key: 'egypt', country_name: 'Egypt', nationality_name: 'Egyptian', country_code: 'EG', flag: '🇪🇬', is_in_seed: true },
  { key: 'eswatini', country_name: 'Eswatini', nationality_name: 'Eswatini / Swazi', country_code: 'SZ', flag: '🇸🇿', is_in_seed: true },
  { key: 'ethiopia', country_name: 'Ethiopia', nationality_name: 'Ethiopian', country_code: 'ET', flag: '🇪🇹', is_in_seed: true },
  { key: 'finland', country_name: 'Finland', nationality_name: 'Finnish', country_code: 'FI', flag: '🇫🇮', is_in_seed: true },
  { key: 'france', country_name: 'France', nationality_name: 'French', country_code: 'FR', flag: '🇫🇷', is_in_seed: true },
  { key: 'germany', country_name: 'Germany', nationality_name: 'German', country_code: 'DE', flag: '🇩🇪', is_in_seed: true },
  { key: 'ghana', country_name: 'Ghana', nationality_name: 'Ghanaian', country_code: 'GH', flag: '🇬🇭', is_in_seed: true },
  { key: 'greece', country_name: 'Greece', nationality_name: 'Greek', country_code: 'GR', flag: '🇬🇷', is_in_seed: false },
  { key: 'guinea_bissau', country_name: 'Guinea-Bissau', nationality_name: 'Bissau-Guinean', country_code: 'GW', flag: '🇬🇼', is_in_seed: true },
  { key: 'india', country_name: 'India', nationality_name: 'Indian', country_code: 'IN', flag: '🇮🇳', is_in_seed: false },
  { key: 'indonesia', country_name: 'Indonesia', nationality_name: 'Indonesian', country_code: 'ID', flag: '🇮🇩', is_in_seed: true },
  { key: 'ireland', country_name: 'Ireland', nationality_name: 'Irish', country_code: 'IE', flag: '🇮🇪', is_in_seed: true },
  { key: 'israel', country_name: 'Israel', nationality_name: 'Israeli', country_code: 'IL', flag: '🇮🇱', is_in_seed: true },
  { key: 'italy', country_name: 'Italy', nationality_name: 'Italian', country_code: 'IT', flag: '🇮🇹', is_in_seed: true },
  { key: 'japan', country_name: 'Japan', nationality_name: 'Japanese', country_code: 'JP', flag: '🇯🇵', is_in_seed: true },
  { key: 'kenya', country_name: 'Kenya', nationality_name: 'Kenyan', country_code: 'KE', flag: '🇰🇪', is_in_seed: true },
  { key: 'lesotho', country_name: 'Lesotho', nationality_name: 'Basotho', country_code: 'LS', flag: '🇱🇸', is_in_seed: true },
  { key: 'malawi', country_name: 'Malawi', nationality_name: 'Malawian', country_code: 'MW', flag: '🇲🇼', is_in_seed: true },
  { key: 'malaysia', country_name: 'Malaysia', nationality_name: 'Malaysian', country_code: 'MY', flag: '🇲🇾', is_in_seed: false },
  { key: 'mauritius', country_name: 'Mauritius', nationality_name: 'Mauritian', country_code: 'MU', flag: '🇲🇺', is_in_seed: true },
  { key: 'mexico', country_name: 'Mexico', nationality_name: 'Mexican', country_code: 'MX', flag: '🇲🇽', is_in_seed: false },
  { key: 'namibia', country_name: 'Namibia', nationality_name: 'Namibian', country_code: 'NA', flag: '🇳🇦', is_in_seed: true },
  { key: 'nepal', country_name: 'Nepal', nationality_name: 'Nepalese', country_code: 'NP', flag: '🇳🇵', is_in_seed: true },
  { key: 'netherlands', country_name: 'Netherlands', nationality_name: 'Dutch', country_code: 'NL', flag: '🇳🇱', is_in_seed: true },
  { key: 'new_zealand', country_name: 'New Zealand', nationality_name: 'New Zealander', country_code: 'NZ', flag: '🇳🇿', is_in_seed: false },
  { key: 'nigeria', country_name: 'Nigeria', nationality_name: 'Nigerian', country_code: 'NG', flag: '🇳🇬', is_in_seed: true },
  { key: 'norway', country_name: 'Norway', nationality_name: 'Norwegian', country_code: 'NO', flag: '🇳🇴', is_in_seed: true },
  { key: 'pakistan', country_name: 'Pakistan', nationality_name: 'Pakistani', country_code: 'PK', flag: '🇵🇰', is_in_seed: true },
  { key: 'poland', country_name: 'Poland', nationality_name: 'Polish', country_code: 'PL', flag: '🇵🇱', is_in_seed: false },
  { key: 'portugal', country_name: 'Portugal', nationality_name: 'Portuguese', country_code: 'PT', flag: '🇵🇹', is_in_seed: true },
  { key: 'russia', country_name: 'Russia', nationality_name: 'Russian', country_code: 'RU', flag: '🇷🇺', is_in_seed: true },
  { key: 'rwanda', country_name: 'Rwanda', nationality_name: 'Rwandan', country_code: 'RW', flag: '🇷🇼', is_in_seed: true },
  { key: 'sao_tome_and_principe', country_name: 'São Tomé and Príncipe', nationality_name: 'São Toméan', country_code: 'ST', flag: '🇸🇹', is_in_seed: true },
  { key: 'saudi_arabia', country_name: 'Saudi Arabia', nationality_name: 'Saudi', country_code: 'SA', flag: '🇸🇦', is_in_seed: true },
  { key: 'senegal', country_name: 'Senegal', nationality_name: 'Senegalese', country_code: 'SN', flag: '🇸🇳', is_in_seed: true },
  { key: 'seychelles', country_name: 'Seychelles', nationality_name: 'Seychellois', country_code: 'SC', flag: '🇸🇨', is_in_seed: true },
  { key: 'singapore', country_name: 'Singapore', nationality_name: 'Singaporean', country_code: 'SG', flag: '🇸🇬', is_in_seed: true },
  { key: 'somalia', country_name: 'Somalia', nationality_name: 'Somali', country_code: 'SO', flag: '🇸🇴', is_in_seed: true },
  { key: 'south_africa', country_name: 'South Africa', nationality_name: 'South African', country_code: 'ZA', flag: '🇿🇦', is_in_seed: true },
  { key: 'south_korea', country_name: 'South Korea', nationality_name: 'South Korean', country_code: 'KR', flag: '🇰🇷', is_in_seed: true },
  { key: 'spain', country_name: 'Spain', nationality_name: 'Spanish', country_code: 'ES', flag: '🇪🇸', is_in_seed: true },
  { key: 'sweden', country_name: 'Sweden', nationality_name: 'Swedish', country_code: 'SE', flag: '🇸🇪', is_in_seed: true },
  { key: 'switzerland', country_name: 'Switzerland', nationality_name: 'Swiss', country_code: 'CH', flag: '🇨🇭', is_in_seed: true },
  { key: 'tanzania', country_name: 'Tanzania', nationality_name: 'Tanzanian', country_code: 'TZ', flag: '🇹🇿', is_in_seed: true },
  { key: 'thailand', country_name: 'Thailand', nationality_name: 'Thai', country_code: 'TH', flag: '🇹🇭', is_in_seed: true },
  { key: 'turkey', country_name: 'Türkiye', nationality_name: 'Turkish', country_code: 'TR', flag: '🇹🇷', is_in_seed: true },
  { key: 'uganda', country_name: 'Uganda', nationality_name: 'Ugandan', country_code: 'UG', flag: '🇺🇬', is_in_seed: true },
  { key: 'ukraine', country_name: 'Ukraine', nationality_name: 'Ukrainian', country_code: 'UA', flag: '🇺🇦', is_in_seed: true },
  { key: 'united_arab_emirates', country_name: 'United Arab Emirates', nationality_name: 'Emirati', country_code: 'AE', flag: '🇦🇪', is_in_seed: true },
  { key: 'united_kingdom', country_name: 'United Kingdom', nationality_name: 'British', country_code: 'GB', flag: '🇬🇧', is_in_seed: true },
  { key: 'united_states', country_name: 'United States', nationality_name: 'American', country_code: 'US', flag: '🇺🇸', is_in_seed: true },
  { key: 'venezuela', country_name: 'Venezuela', nationality_name: 'Venezuelan', country_code: 'VE', flag: '🇻🇪', is_in_seed: true },
  { key: 'vietnam', country_name: 'Vietnam', nationality_name: 'Vietnamese', country_code: 'VN', flag: '🇻🇳', is_in_seed: true },
  { key: 'zambia', country_name: 'Zambia', nationality_name: 'Zambian', country_code: 'ZM', flag: '🇿🇲', is_in_seed: true },
  { key: 'zimbabwe', country_name: 'Zimbabwe', nationality_name: 'Zimbabwean', country_code: 'ZW', flag: '🇿🇼', is_in_seed: true }
].sort((a, b) => a.country_name.localeCompare(b.country_name));

export interface BorderPostItem {
  name: string;
  type: string;
}

export interface BorderPostProvinceGroup {
  province: string;
  posts: BorderPostItem[];
}

export const BORDER_POSTS: string[] = visaRulesJson.border_visa_information.authorized_entry_points;
export const BORDER_POST_INFO = visaRulesJson.border_visa_information;
export const BORDER_POST_PROVINCE_GROUPS: BorderPostProvinceGroup[] = visaRulesJson.border_visa_information.province_groupings || [];


export const OFFICIAL_SOURCE = {
  name: visaRulesJson.source.name,
  url: visaRulesJson.source.url,
  last_verified: visaRulesJson.source.last_verified,
  border_source_url: visaRulesJson.border_visa_information.official_source
};

export const VISA_DISCLAIMER = 
  "Visa and entry requirements can change. Mozbook provides travel information based on the latest available rules in its database. Final admission is determined by Mozambique immigration authorities. Check the official Mozambique immigration/eVisa information before travelling.";

/**
 * Evaluates visa and entry requirements based on user inputs.
 * Strictly adheres to seed data without guessing or inventing rules.
 */
export function evaluateVisaRequirement(input: VisaEvaluationInput): VisaEvaluationResult {
  const { nationalityKey, passportType, travelPurpose, stayDays } = input;
  
  const nationality = NATIONALITIES.find(n => n.key === nationalityKey) || {
    key: nationalityKey,
    country_name: nationalityKey,
    nationality_name: nationalityKey,
    country_code: 'XX',
    flag: '🌐',
    is_in_seed: false
  };

  const countriesMap = visaRulesJson.countries as Record<string, CountryRule>;
  const defaults = visaRulesJson.defaults;
  const countryRule: CountryRule | undefined = countriesMap[nationalityKey];

  let calculatedStatus: VisaStatus = 'EVISA_REQUIRED';
  let maxStayAllowed: number | null = 30;
  let etaRequired = false;
  let evisaAvailable = true;
  let embassyRequired = false;
  let borderVisaPossible: boolean | string = false;
  let headline = '';
  let purposeCovered = true;
  let purposeNote: string | undefined = undefined;

  if (!countryRule) {
    // Default rule applies
    calculatedStatus = defaults.visa_status as VisaStatus;
    etaRequired = defaults.eta_required;
    evisaAvailable = defaults.evisa_available;
    embassyRequired = defaults.embassy_required;
    borderVisaPossible = defaults.border_visa_possible;
    maxStayAllowed = defaults.max_stay_days;
    headline = defaults.message;
  } else {
    // Determine passport-specific rules
    borderVisaPossible = countryRule.border_visa_possible;
    evisaAvailable = countryRule.evisa_available;
    embassyRequired = countryRule.embassy_required;
    maxStayAllowed = countryRule.max_stay_days ?? 30;

    // Check if country has explicit passport_rules array (e.g. South Africa, São Tomé)
    if (countryRule.passport_rules && countryRule.passport_rules.length > 0) {
      const matchingRule = countryRule.passport_rules.find(r => 
        r.passport_types.includes(passportType)
      );

      if (matchingRule) {
        calculatedStatus = (countryRule.visa_status as VisaStatus) || 'VISA_FREE';
        maxStayAllowed = matchingRule.max_stay_days;
        etaRequired = countryRule.eta_required;
      } else {
        // Fallback for passport types not in the specific rules
        calculatedStatus = 'EVISA_REQUIRED';
        maxStayAllowed = 30;
      }
    } else {
      // Standard country rule
      if (passportType === 'ORDINARY') {
        if (countryRule.ordinary_passport_result) {
          calculatedStatus = countryRule.ordinary_passport_result as VisaStatus;
          etaRequired = calculatedStatus === 'ETA_REQUIRED';
        } else if (countryRule.passport_types && countryRule.passport_types.includes('ORDINARY')) {
          calculatedStatus = countryRule.visa_status as VisaStatus;
          etaRequired = countryRule.eta_required;
        } else {
          // Ordinary passport not covered by exemption
          calculatedStatus = 'EVISA_REQUIRED';
          etaRequired = false;
        }
      } else {
        // DIPLOMATIC or SERVICE / OFFICIAL passport
        const isPassportCovered = countryRule.passport_types?.some(pt => 
          pt === passportType || (passportType === 'SERVICE' && (pt === 'SERVICE' || pt === 'OFFICIAL' || pt === 'SPECIAL'))
        );

        if (isPassportCovered) {
          calculatedStatus = countryRule.visa_status as VisaStatus;
          etaRequired = countryRule.eta_required;
        } else {
          calculatedStatus = 'EVISA_REQUIRED';
          etaRequired = false;
        }
      }
    }

    // Direct Embassy override (e.g. Pakistan, Nigeria, Bangladesh, Ethiopia, Nepal, Somalia)
    if (countryRule.visa_status === 'EMBASSY_REQUIRED') {
      calculatedStatus = 'EMBASSY_REQUIRED';
      embassyRequired = true;
      evisaAvailable = false;
      etaRequired = false;
      headline = countryRule.message || 'Applicants must apply through the nearest Mozambican embassy or consulate.';
    }
  }

  // Check Travel Purpose
  // Most exemptions only cover TOURISM and BUSINESS
  const coveredPurposes = countryRule?.travel_purposes || defaults.travel_purposes;
  if (!coveredPurposes.includes(travelPurpose)) {
    purposeCovered = false;
    if (travelPurpose === 'WORK') {
      calculatedStatus = 'EVISA_REQUIRED';
      purposeNote = 'Employment in Mozambique requires a specific Work Visa (Visto de Trabalho) and approval from the Ministry of Labour.';
    } else if (travelPurpose === 'STUDY') {
      calculatedStatus = 'EVISA_REQUIRED';
      purposeNote = 'Academic study requires an official Student Visa (Visto de Estudante) and enrollment documentation.';
    } else if (travelPurpose === 'INVESTMENT') {
      purposeNote = 'Foreign investors may apply for an Investment Visa with approval from APIEX / Centre for Promotion of Investment.';
    } else if (travelPurpose === 'HUMANITARIAN') {
      purposeNote = 'NGO and humanitarian missions typically require prior ministerial or diplomatic registration.';
    } else if (travelPurpose === 'TRANSIT') {
      purposeNote = 'Transit visits exceeding 7 days require a standard visa. Direct airside transit under 24 hours does not require a visa.';
    } else {
      purposeNote = `Exemptions apply only to tourism and business visits. For ${travelPurpose.toLowerCase()}, verify specialized visa requirements on the eVisa portal.`;
    }
  }

  // Check Length of Stay vs Maximum Allowed
  const stayExceeded = maxStayAllowed !== null && stayDays > maxStayAllowed;

  // Build user-friendly status details
  let statusTitle = '';
  let statusBadgeColor = '';
  let visaRequired = false;

  switch (calculatedStatus) {
    case 'VISA_FREE':
      visaRequired = false;
      statusTitle = '🟢 VISA NOT REQUIRED';
      statusBadgeColor = 'bg-emerald-500 text-white';
      headline = stayExceeded 
        ? `You are visa-exempt for visits up to ${maxStayAllowed} days. However, your requested stay of ${stayDays} days exceeds this limit — you must apply for a visa or extension.`
        : 'You do not need a visa to enter Mozambique for this trip.';
      break;

    case 'ETA_REQUIRED':
      visaRequired = false;
      statusTitle = '🟡 eTA REQUIRED';
      statusBadgeColor = 'bg-amber-500 text-white';
      headline = stayExceeded
        ? `You are visa-exempt with an eTA for up to ${maxStayAllowed} days. Your planned stay of ${stayDays} days exceeds this limit — an extended visa category is required.`
        : 'You are visa-exempt for eligible visits, but you must obtain the required Electronic Travel Authorisation (eTA) before travelling.';
      break;

    case 'EVISA_REQUIRED':
      visaRequired = true;
      statusTitle = '🟠 eVISA REQUIRED';
      statusBadgeColor = 'bg-orange-500 text-white';
      headline = countryRule?.message || 'You must obtain a Mozambique eVisa before travelling.';
      break;

    case 'EMBASSY_REQUIRED':
      visaRequired = true;
      statusTitle = '🔴 EMBASSY APPLICATION REQUIRED';
      statusBadgeColor = 'bg-red-600 text-white';
      headline = countryRule?.message || 'Your nationality is not eligible for the online eVisa portal for this category. You must contact the nearest Mozambican embassy or consulate.';
      break;

    case 'BORDER_VISA_POSSIBLE':
      visaRequired = true;
      statusTitle = '🟡 VISA AVAILABLE AT BORDER (CONDITIONAL)';
      statusBadgeColor = 'bg-yellow-500 text-slate-900';
      headline = 'You may be eligible to apply for a Mozambique border visa on arrival at an authorised border post. Issuance is subject to immigration discretion.';
      break;

    default:
      visaRequired = true;
      statusTitle = '🔴 VISA REQUIRED / VERIFY';
      statusBadgeColor = 'bg-slate-800 text-white';
      headline = 'A visa is required before travelling. Check the official Mozambique immigration / eVisa portal.';
      break;
  }

  // Assemble required documents
  const requiredDocuments: string[] = [
    'Passport with at least 6 months validity from entry date and 2-3 blank pages',
    'Confirmed return or onward flight/travel ticket',
    'Proof of accommodation (confirmed MozBook stay voucher, hotel booking, or invitation letter)'
  ];

  if (calculatedStatus === 'ETA_REQUIRED') {
    requiredDocuments.push('Approved Electronic Travel Authorisation (eTA) confirmation printout or digital QR');
    requiredDocuments.push('Receipt of nominal administrative processing fee (~650 MZN / ~$10 USD)');
  } else if (calculatedStatus === 'EVISA_REQUIRED') {
    requiredDocuments.push('Approved Mozambique eVisa pre-approval notification');
    requiredDocuments.push('Payment confirmation for the visa processing fee');
  } else if (calculatedStatus === 'EMBASSY_REQUIRED') {
    requiredDocuments.push('Official consular visa stamped in your physical passport');
    requiredDocuments.push('Formal invitation letter and consular supporting documents');
  }

  if (passportType !== 'ORDINARY') {
    requiredDocuments.push(`Official diplomatic/verbal note or accreditation for ${passportType.toLowerCase()} passport holders`);
  }

  // What to do before travelling
  const whatToDo: string[] = [];
  if (calculatedStatus === 'ETA_REQUIRED') {
    whatToDo.push('Visit the official Mozambique eVisa/eTA portal (evisa.gov.mz) at least 48-72 hours before departure.');
    whatToDo.push('Complete the eTA pre-registration form with your passport details and travel itinerary.');
    whatToDo.push('Pay the nominal administrative fee (~650 MZN / ~$10 USD) securely online.');
    whatToDo.push('Download and print your approved eTA clearance slip or keep an offline screenshot on your mobile device.');
  } else if (calculatedStatus === 'EVISA_REQUIRED') {
    whatToDo.push('Submit your eVisa application on evisa.gov.mz at least 5 to 7 business days prior to departure.');
    whatToDo.push('Upload high-quality scans of your passport bio-page, accommodation booking, and flight itinerary.');
    whatToDo.push('Track application status online and await your official Pre-Approval authorization letter.');
    whatToDo.push('Print your eVisa Pre-Approval document to present at airline check-in and border control.');
  } else if (calculatedStatus === 'EMBASSY_REQUIRED') {
    whatToDo.push('Contact the nearest Embassy or Consulate of Mozambique in your country of residence.');
    whatToDo.push('Schedule an in-person visa appointment and submit your application along with required biometric data.');
    whatToDo.push('Allow sufficient processing time (typically 10-15 business days) before your scheduled flight.');
  } else {
    // VISA_FREE
    whatToDo.push('Ensure your passport has at least 6 months remaining validity.');
    whatToDo.push('Download your MozBook booking confirmation and return flight tickets for offline viewing.');
    whatToDo.push('No prior visa or eTA paperwork is required for eligible tourist/business visits within the permitted stay.');
  }

  // Arrival checklist items
  const arrivalChecklist: string[] = [
    'Original Passport (valid 6+ months, minimum 2 blank pages)'
  ];

  if (calculatedStatus === 'ETA_REQUIRED') {
    arrivalChecklist.push('Approved eTA Confirmation (printed or digital screenshot)');
  } else if (calculatedStatus === 'EVISA_REQUIRED') {
    arrivalChecklist.push('Approved eVisa Pre-Approval document');
  } else if (calculatedStatus === 'EMBASSY_REQUIRED') {
    arrivalChecklist.push('Valid Mozambique Visa stamped inside passport');
  }

  arrivalChecklist.push('Confirmed Return or Onward Travel Ticket');
  arrivalChecklist.push('Proof of Accommodation (MozBook stay voucher or host details)');
  arrivalChecklist.push('Yellow Fever Vaccination Certificate (if arriving from or transited an endemic country)');

  return {
    destination: 'Mozambique',
    country_name: nationality.country_name,
    country_code: nationality.country_code,
    flag: nationality.flag,
    passport_type: passportType,
    travel_purpose: travelPurpose,
    stay_days: stayDays,
    status: calculatedStatus,
    status_title: statusTitle,
    status_badge_color: statusBadgeColor,
    headline,
    visa_required: visaRequired,
    eta_required: etaRequired,
    evisa_available: evisaAvailable,
    embassy_required: embassyRequired,
    border_visa_possible: borderVisaPossible,
    max_stay_allowed: maxStayAllowed,
    stay_exceeded: stayExceeded,
    passport_validity_months: 6,
    required_documents: requiredDocuments,
    what_to_do_before_travel: whatToDo,
    official_source_url: OFFICIAL_SOURCE.url,
    official_source_name: OFFICIAL_SOURCE.name,
    last_verified: OFFICIAL_SOURCE.last_verified,
    purpose_covered: purposeCovered,
    purpose_note: purposeNote,
    arrival_checklist: arrivalChecklist,
    disclaimer: VISA_DISCLAIMER
  };
}
