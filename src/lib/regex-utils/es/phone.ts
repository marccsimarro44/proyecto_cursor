import { type PatternMatch, scanPattern } from "../match";

/** Optional `+34`, `0034` or `(+34)` followed by one separator. */
const PREFIX_SOURCE = "(?:\\(?(?:\\+|00)34\\)?[ .-]?)?";

/**
 * Nine digits starting with 6 or 7, written together or grouped as 3-3-3 or
 * 3-2-2-2 with spaces, dots or hyphens. Line breaks are never crossed.
 */
const MOBILE_SOURCE = `${PREFIX_SOURCE}[67]\\d{2}(?:(?:[ .-]?\\d{3}){2}|(?:[ .-]?\\d{2}){3})`;
const MOBILE_PATTERN = new RegExp(MOBILE_SOURCE, "g");
const MOBILE_EXACT = new RegExp(`^(?:${MOBILE_SOURCE})$`);

/** Ranges assigned to mobile services in Spain: 6XX and 71X-74X. */
const MOBILE_RANGE = /^(?:6\d{8}|7[1-4]\d{7})$/;

const DOT = 46;

function isDigitCode(code: number): boolean {
  return code >= 48 && code <= 57;
}

/**
 * The E.164 form (`+34612345678`) of a Spanish mobile number, or `null` if
 * `value` is not one. Landlines (8XX, 9XX) are not mobiles.
 */
export function normalizeSpanishMobile(value: string): string | null {
  if (!MOBILE_EXACT.test(value)) return null;

  const national = value.replace(/\D/g, "").slice(-9);
  return MOBILE_RANGE.test(national) ? `+34${national}` : null;
}

/** Whether `value` is a Spanish mobile number, with or without prefix. */
export function isValidSpanishMobile(value: string): boolean {
  return normalizeSpanishMobile(value) !== null;
}

/**
 * Every Spanish mobile number in `text`, in order of appearance.
 *
 * Phone numbers have no checksum, so context is the only guard against false
 * positives: digits that continue a dotted number (`0.612345678`,
 * `612345678.50`) are skipped. Commas are deliberately not treated the same
 * way because next to a digit they are usually a CSV delimiter.
 */
export function findSpanishMobiles(text: string): PatternMatch[] {
  return scanPattern(text, MOBILE_PATTERN, (candidate, source) => {
    if (!isValidSpanishMobile(candidate.value)) return false;

    const { start, end } = candidate;
    const followsDottedNumber =
      source.charCodeAt(start - 1) === DOT &&
      isDigitCode(source.charCodeAt(start - 2));
    const continuesAsDottedNumber =
      source.charCodeAt(end) === DOT && isDigitCode(source.charCodeAt(end + 1));

    return !followsDottedNumber && !continuesAsDottedNumber;
  });
}
