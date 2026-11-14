import { isWordCode, type PatternMatch } from "../match";

const MAX_LOCAL_LENGTH = 64;
const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

const TLD_SHAPE = /^(?:[A-Za-z]{2,}|xn--[A-Za-z0-9]+)$/i;

const DOT = 46;
const HYPHEN = 45;

/** Characters allowed before the at sign: letters, digits and `._%+-`. */
function isLocalCode(code: number): boolean {
  return (
    isWordCode(code) ||
    code === DOT ||
    code === HYPHEN ||
    code === 95 || // _
    code === 37 || // %
    code === 43 // +
  );
}

/** Characters allowed after the at sign: letters, digits, dots and hyphens. */
function isDomainCode(code: number): boolean {
  return isWordCode(code) || code === DOT || code === HYPHEN;
}

function hasValidStructure(local: string, domain: string): boolean {
  if (local.length === 0 || local.length > MAX_LOCAL_LENGTH) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  if (domain.length > MAX_DOMAIN_LENGTH) return false;

  const labels = domain.split(".");
  if (labels.length < 2) return false;
  for (const label of labels) {
    if (
      label.length === 0 ||
      label.length > MAX_LABEL_LENGTH ||
      label.startsWith("-") ||
      label.endsWith("-")
    ) {
      return false;
    }
  }
  return TLD_SHAPE.test(labels[labels.length - 1]);
}

function everyCode(value: string, test: (code: number) => boolean): boolean {
  for (let index = 0; index < value.length; index++) {
    if (!test(value.charCodeAt(index))) return false;
  }
  return true;
}

/**
 * Whether `value` is a plausible email address: one at sign, a dot-separated
 * domain with an alphabetic TLD, and no leading, trailing or doubled dots.
 * This is a pragmatic check for PII detection, not a full RFC 5322 parser.
 */
export function isValidEmail(value: string): boolean {
  const at = value.indexOf("@");
  if (at === -1 || at !== value.lastIndexOf("@")) return false;

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);
  return (
    everyCode(local, isLocalCode) &&
    everyCode(domain, isDomainCode) &&
    hasValidStructure(local, domain)
  );
}

/**
 * Every email address in `text`, in order of appearance.
 *
 * The scan is anchored on each at sign and grows outwards a bounded number
 * of characters. A regular expression such as `[\w.]+@...` would instead
 * rescan every long run of letters from each of its positions, which takes
 * quadratic time on large files.
 */
export function findEmails(text: string): PatternMatch[] {
  const matches: PatternMatch[] = [];
  let floor = 0; // Never grow into the previous match.

  for (let at = text.indexOf("@"); at !== -1; at = text.indexOf("@", at + 1)) {
    let start = at;
    while (
      start > floor &&
      at - start <= MAX_LOCAL_LENGTH &&
      isLocalCode(text.charCodeAt(start - 1))
    ) {
      start--;
    }
    if (at - start > MAX_LOCAL_LENGTH) continue;

    let end = at + 1;
    while (
      end < text.length &&
      end - at <= MAX_DOMAIN_LENGTH + 1 &&
      isDomainCode(text.charCodeAt(end))
    ) {
      end++;
    }

    // Sentence punctuation is not part of the address: "...ana@example.com."
    while (start < at && text.charCodeAt(start) === DOT) start++;
    const doubledDot = text.slice(start, at).lastIndexOf("..");
    if (doubledDot !== -1) start += doubledDot + 2;

    const domainBreak = text.slice(at + 1, end).indexOf("..");
    if (domainBreak !== -1) end = at + 1 + domainBreak;
    while (end > at + 1) {
      const last = text.charCodeAt(end - 1);
      if (last !== DOT && last !== HYPHEN) break;
      end--;
    }

    if (hasValidStructure(text.slice(start, at), text.slice(at + 1, end))) {
      matches.push({ value: text.slice(start, end), start, end });
      floor = end;
    }
  }

  return matches;
}
