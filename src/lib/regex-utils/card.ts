import { type PatternMatch, scanPattern } from "./match";

/**
 * Three layouts, tried separately because a single pattern would let a card
 * swallow the number that follows it: 4-4-4-4 (one separator kind), Amex
 * 4-6-5, and an unbroken run of 13 to 19 digits.
 */
const LAYOUTS = [
  /[2-6]\d{3}([ -]?)\d{4}\1\d{4}\1\d{4}/g,
  /3[47]\d{2}([ -]?)\d{6}\1\d{5}/g,
  /[2-6]\d{12,18}/g,
];

const CARD_EXACT =
  /^(?:[2-6]\d{3}([ -]?)\d{4}\1\d{4}\1\d{4}|3[47]\d{2}([ -]?)\d{6}\2\d{5}|[2-6]\d{12,18})$/;

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    let digit = digits.charCodeAt(index) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Whether `value` is a payment card number: 13-19 digits that pass the Luhn
 * check, starting with 2-6 (the leading digits of every major network, which
 * also keeps millisecond timestamps, which start with 1, from matching).
 */
export function isValidCreditCard(value: string): boolean {
  if (!CARD_EXACT.test(value)) return false;

  const digits = value.replace(/\D/g, "");
  return (
    digits.length >= 13 &&
    digits.length <= 19 &&
    !/^(\d)\1+$/.test(digits) &&
    passesLuhn(digits)
  );
}

/** Every valid card number in `text`, in order of appearance. */
export function findCreditCards(text: string): PatternMatch[] {
  const found = new Map<number, PatternMatch>();
  for (const layout of LAYOUTS) {
    for (const match of scanPattern(text, layout, (candidate) =>
      isValidCreditCard(candidate.value),
    )) {
      const known = found.get(match.start);
      if (known === undefined || match.end > known.end) {
        found.set(match.start, match);
      }
    }
  }
  return [...found.values()].sort((a, b) => a.start - b.start);
}
