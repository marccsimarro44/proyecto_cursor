import { type PatternMatch, scanPattern } from "../match";
import { dniLetter } from "./dni";

/** X, Y or Z, seven digits and a control letter, with optional hyphens. */
const NIE_SOURCE = "[XYZxyz]-?\\d{7}-?[A-Za-z]";
const NIE_PATTERN = new RegExp(NIE_SOURCE, "g");
const NIE_EXACT = new RegExp(`^(?:${NIE_SOURCE})$`);

/** Digit that replaces the leading letter when computing the checksum. */
const PREFIX_DIGIT: Record<string, string> = { X: "0", Y: "1", Z: "2" };

/**
 * Whether `value` is a well-formed NIE whose control letter matches.
 * Accepts `X1234567L`, `X-1234567-L` and lowercase letters.
 */
export function isValidNie(value: string): boolean {
  if (!NIE_EXACT.test(value)) return false;

  const compact = value.replace(/-/g, "").toUpperCase();
  const number = Number(PREFIX_DIGIT[compact.charAt(0)] + compact.slice(1, 8));
  return dniLetter(number) === compact.charAt(8);
}

/** Every valid NIE in `text`, in order of appearance. */
export function findNies(text: string): PatternMatch[] {
  return scanPattern(text, NIE_PATTERN, (candidate) =>
    isValidNie(candidate.value),
  );
}
