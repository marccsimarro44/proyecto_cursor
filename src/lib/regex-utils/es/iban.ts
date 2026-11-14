import { type PatternMatch, scanPattern } from "../match";

/**
 * `ES`, two check digits and twenty account digits. A single space or hyphen
 * may precede any digit, which covers both the usual groups of four and the
 * legacy CCC grouping (4-4-2-10). Line breaks are never crossed.
 */
const SPANISH_IBAN_PATTERN = /ES\d{2}(?:[ -]?\d){20}/gi;

const IBAN_SHAPE = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
const SPANISH_IBAN_SHAPE = /^ES\d{22}$/;

/** Removes separators and uppercases, e.g. `es91 2100...` -> `ES912100...`. */
function compactIban(value: string): string {
  return value.replace(/[ -]/g, "").toUpperCase();
}

/**
 * ISO 7064 mod-97 of a compact, uppercase IBAN: the first four characters
 * are moved to the end and letters are read as two-digit numbers (A = 10).
 * Computed digit by digit so no big integers are needed.
 */
function mod97(compact: string): number {
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (let index = 0; index < rearranged.length; index++) {
    const code = rearranged.charCodeAt(index);
    remainder =
      code >= 65
        ? (remainder * 100 + (code - 55)) % 97
        : (remainder * 10 + (code - 48)) % 97;
  }
  return remainder;
}

/**
 * Whether `value` has the shape of an IBAN from any country and passes the
 * mod-97 check. Spaces and hyphens between groups are ignored. Country
 * specific lengths are not checked; use {@link isValidSpanishIban} for that.
 */
export function isValidIban(value: string): boolean {
  const compact = compactIban(value);
  return IBAN_SHAPE.test(compact) && mod97(compact) === 1;
}

/** Whether `value` is a 24-character Spanish IBAN that passes mod-97. */
export function isValidSpanishIban(value: string): boolean {
  const compact = compactIban(value);
  return SPANISH_IBAN_SHAPE.test(compact) && mod97(compact) === 1;
}

/** Every valid Spanish IBAN in `text`, in order of appearance. */
export function findSpanishIbans(text: string): PatternMatch[] {
  return scanPattern(text, SPANISH_IBAN_PATTERN, (candidate) =>
    isValidSpanishIban(candidate.value),
  );
}
