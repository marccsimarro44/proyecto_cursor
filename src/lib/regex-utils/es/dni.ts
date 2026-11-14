import { type PatternMatch, scanPattern } from "../match";

/** Control letters indexed by `number % 23`. */
const CONTROL_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/**
 * Eight digits (plain or grouped as `12.345.678`), an optional hyphen or
 * space, and the control letter.
 */
const DNI_SOURCE = "(?:\\d{8}|\\d{2}\\.\\d{3}\\.\\d{3})[- ]?[A-Za-z]";
const DNI_PATTERN = new RegExp(DNI_SOURCE, "g");
const DNI_EXACT = new RegExp(`^(?:${DNI_SOURCE})$`);

/** Control letter for a DNI number (also used by NIE once its prefix is mapped). */
export function dniLetter(number: number): string {
  return CONTROL_LETTERS.charAt(number % 23);
}

/**
 * Whether `value` is a well-formed DNI whose control letter matches.
 *
 * Accepts `12345678Z`, `12345678-Z`, `12.345.678-Z` and lowercase letters.
 * A space before the letter is only accepted when the letter is uppercase:
 * otherwise an ordinary number followed by a one-letter word ("12345678 a
 * nombre de...") would pass the checksum one time out of 23.
 */
export function isValidDni(value: string): boolean {
  if (!DNI_EXACT.test(value)) return false;

  const letter = value.charAt(value.length - 1);
  const spaced = value.charAt(value.length - 2) === " ";
  if (spaced && letter !== letter.toUpperCase()) return false;

  const number = Number(value.replace(/\D/g, ""));
  return dniLetter(number) === letter.toUpperCase();
}

/** Every valid DNI in `text`, in order of appearance. */
export function findDnis(text: string): PatternMatch[] {
  return scanPattern(text, DNI_PATTERN, (candidate) =>
    isValidDni(candidate.value),
  );
}
