import { type PatternMatch, scanPattern } from "../match";

/**
 * Organization letter, seven digits and a control character (digit or A-J),
 * with optional hyphens.
 */
const CIF_SOURCE = "[A-HJNP-SUVWa-hjnp-suvw]-?\\d{7}-?[0-9A-Ja-j]";
const CIF_PATTERN = new RegExp(CIF_SOURCE, "g");
const CIF_EXACT = new RegExp(`^(?:${CIF_SOURCE})$`);

/** Control letters indexed by the control digit. */
const CONTROL_LETTERS = "JABCDEFGHI";

/** Organization types whose control character must be a letter. */
const LETTER_CONTROL_ONLY = "NPQSW";
/** Organization types whose control character must be a digit. */
const DIGIT_CONTROL_ONLY = "ABEH";

/**
 * Whether `value` is a well-formed CIF whose control character matches.
 *
 * Accepts `B12345674`, `B-12345674` and lowercase letters. The control
 * character must be a letter or a digit depending on the organization type;
 * types not listed above may use either form.
 */
export function isValidCif(value: string): boolean {
  if (!CIF_EXACT.test(value)) return false;

  const compact = value.replace(/-/g, "").toUpperCase();
  const organization = compact.charAt(0);
  const control = compact.charAt(8);

  let sum = 0;
  for (let index = 0; index < 7; index++) {
    const digit = compact.charCodeAt(index + 1) - 48;
    if (index % 2 === 0) {
      // Odd positions (1st, 3rd, ...) are doubled and their digits added.
      const doubled = digit * 2;
      sum += doubled > 9 ? doubled - 9 : doubled;
    } else {
      sum += digit;
    }
  }
  const controlDigit = (10 - (sum % 10)) % 10;

  const matchesDigit = control === String(controlDigit);
  const matchesLetter = control === CONTROL_LETTERS.charAt(controlDigit);

  if (LETTER_CONTROL_ONLY.includes(organization)) return matchesLetter;
  if (DIGIT_CONTROL_ONLY.includes(organization)) return matchesDigit;
  return matchesDigit || matchesLetter;
}

/** Every valid CIF in `text`, in order of appearance. */
export function findCifs(text: string): PatternMatch[] {
  return scanPattern(text, CIF_PATTERN, (candidate) =>
    isValidCif(candidate.value),
  );
}
