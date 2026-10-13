/**
 * ICAO 9303 Machine Readable Zone (MRZ) Parser and Check Digit Validator
 * 
 * Supports TD3 format (standard passports): 2 lines of 44 characters each.
 * Calculates standard 7-3-1 check digit algorithms defined by ICAO 9303 Part 3.
 */

export interface MrzValidationResult {
  hasMrz: boolean;
  isValid: boolean;
  lines?: [string, string];
  documentNumber?: string;
  documentNumberCheckDigitValid?: boolean;
  dateOfBirth?: string;
  dateOfBirthCheckDigitValid?: boolean;
  expiryDate?: string;
  expiryDateCheckDigitValid?: boolean;
  compositeCheckDigitValid?: boolean;
  nationality?: string;
  issuer?: string;
  surname?: string;
  givenNames?: string;
  sex?: string;
  errors: string[];
}

// ICAO 7-3-1 weights
const WEIGHTS = [7, 3, 1];

/**
 * Maps a single MRZ character to its numeric value for checksum calculation
 * 0-9: 0-9
 * A-Z: 10-35
 * <: 0
 */
export function charToValue(ch: string): number {
  const code = ch.charCodeAt(0);
  if (code >= 48 && code <= 57) {
    return code - 48; // '0'-'9'
  }
  if (code >= 65 && code <= 90) {
    return code - 65 + 10; // 'A'-'Z'
  }
  return 0; // '<' filler or others
}

/**
 * Computes ICAO 7-3-1 check digit for an input string
 */
export function computeCheckDigit(input: string): number {
  let sum = 0;
  for (let i = 0; i < input.length; i++) {
    const val = charToValue(input[i]);
    const weight = WEIGHTS[i % 3];
    sum += val * weight;
  }
  return sum % 10;
}

/**
 * Validates whether string matches expected check digit
 */
export function verifyCheckDigit(data: string, expectedCheckChar: string): boolean {
  const expected = parseInt(expectedCheckChar, 10);
  if (isNaN(expected)) return false;
  return computeCheckDigit(data) === expected;
}

/**
 * Parses YYMMDD into YYYY-MM-DD
 * For birth date: uses cutoff around current year
 * For expiry date: assumed to be 2000s or within reasonable window
 */
export function parseMrzDate(yymmdd: string, isExpiry: boolean = false): string | null {
  if (!yymmdd || yymmdd.length !== 6 || !/^\d{6}$/.test(yymmdd)) {
    return null;
  }
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);

  const currentYear = new Date().getFullYear();
  const currentCentury = Math.floor(currentYear / 100) * 100;
  const currentYY = currentYear % 100;

  let fullYear: number;
  if (isExpiry) {
    // Expiry dates are typically current or next decade (e.g., 2020-2040)
    fullYear = currentCentury + yy;
  } else {
    // Birth dates: if yy > currentYY, likely previous century (e.g. 85 -> 1985)
    if (yy > currentYY) {
      fullYear = currentCentury - 100 + yy;
    } else {
      fullYear = currentCentury + yy;
    }
  }

  // Validate month and day
  const m = parseInt(mm, 10);
  const d = parseInt(dd, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  return `${fullYear}-${mm}-${dd}`;
}

/**
 * Parses and verifies TD3 (2 x 44 character lines) Passport MRZ
 */
export function parseAndValidateTd3Mrz(line1Raw: string, line2Raw: string): MrzValidationResult {
  const line1 = line1Raw.trim().toUpperCase().replace(/\s/g, '');
  const line2 = line2Raw.trim().toUpperCase().replace(/\s/g, '');

  const errors: string[] = [];

  if (line1.length !== 44 || line2.length !== 44) {
    return {
      hasMrz: true,
      isValid: false,
      errors: [`MRZ line length mismatch: Line 1 is ${line1.length} (expected 44), Line 2 is ${line2.length} (expected 44)`]
    };
  }

  // Line 1:
  // 0..1: Document code (P, PO, etc)
  // 2..4: Issuing state (3 chars)
  // 5..43: Name (Surname<<Given<Names)
  const docCode = line1.slice(0, 2);
  const issuer = line1.slice(2, 5).replace(/</g, '');
  const namesField = line1.slice(5, 44);
  const nameParts = namesField.split('<<');
  const surname = nameParts[0]?.replace(/</g, ' ').trim() || '';
  const givenNames = nameParts[1]?.replace(/</g, ' ').trim() || '';

  // Line 2:
  // 0..8: Document number (9 chars)
  // 9: Document number check digit (1 char)
  // 10..12: Nationality (3 chars)
  // 13..18: Date of birth YYMMDD (6 chars)
  // 19: Date of birth check digit (1 char)
  // 20: Sex (M, F, X, <) (1 char)
  // 21..26: Date of expiry YYMMDD (6 chars)
  // 27: Date of expiry check digit (1 char)
  // 28..41: Optional data (14 chars)
  // 42: Optional data check digit (or <)
  // 43: Composite check digit (over 0..9, 13..19, 21..42)
  const docNumField = line2.slice(0, 9);
  const docNumCheck = line2.slice(9, 10);
  const docNumber = docNumField.replace(/</g, '');

  const docNumberCheckDigitValid = verifyCheckDigit(docNumField, docNumCheck);
  if (!docNumberCheckDigitValid) {
    errors.push(`Document number check digit failed: expected ${docNumCheck}, calculated ${computeCheckDigit(docNumField)}`);
  }

  const nationality = line2.slice(10, 13).replace(/</g, '');

  const dobField = line2.slice(13, 19);
  const dobCheck = line2.slice(19, 20);
  const dateOfBirthCheckDigitValid = verifyCheckDigit(dobField, dobCheck);
  if (!dateOfBirthCheckDigitValid) {
    errors.push(`Date of birth check digit failed: expected ${dobCheck}, calculated ${computeCheckDigit(dobField)}`);
  }
  const dateOfBirth = parseMrzDate(dobField, false) || undefined;

  const sex = line2.slice(20, 21).replace(/</g, '');

  const expiryField = line2.slice(21, 27);
  const expiryCheck = line2.slice(27, 28);
  const expiryDateCheckDigitValid = verifyCheckDigit(expiryField, expiryCheck);
  if (!expiryDateCheckDigitValid) {
    errors.push(`Expiry date check digit failed: expected ${expiryCheck}, calculated ${computeCheckDigit(expiryField)}`);
  }
  const expiryDate = parseMrzDate(expiryField, true) || undefined;

  // Composite check digit string: line2[0..9] + line2[13..19] + line2[21..42]
  const compositeString = line2.slice(0, 10) + line2.slice(13, 20) + line2.slice(21, 43);
  const compositeCheck = line2.slice(43, 44);
  const compositeCheckDigitValid = verifyCheckDigit(compositeString, compositeCheck);
  if (!compositeCheckDigitValid) {
    errors.push(`Composite check digit failed: expected ${compositeCheck}, calculated ${computeCheckDigit(compositeString)}`);
  }

  const isValid = docNumberCheckDigitValid && dateOfBirthCheckDigitValid && expiryDateCheckDigitValid && compositeCheckDigitValid;

  return {
    hasMrz: true,
    isValid,
    lines: [line1, line2],
    documentNumber: docNumber,
    documentNumberCheckDigitValid: docNumberCheckDigitValid,
    dateOfBirth,
    dateOfBirthCheckDigitValid,
    expiryDate,
    expiryDateCheckDigitValid,
    compositeCheckDigitValid,
    nationality,
    issuer,
    surname,
    givenNames,
    sex,
    errors
  };
}
