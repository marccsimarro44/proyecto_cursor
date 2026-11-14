import { type PatternMatch, scanPattern } from "@/lib/regex-utils/match";

const MAX_TERMS = 500;
const MIN_TERM_LENGTH = 2;

/**
 * Cleans a user-supplied term list: trims, drops terms that are too short to
 * be meaningful, removes duplicates (ignoring case) and caps the count so a
 * pasted spreadsheet column cannot make every scan slow.
 */
export function normalizeTerms(terms: readonly string[]): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of terms) {
    const term = raw.trim();
    const key = term.toLowerCase();
    if (term.length < MIN_TERM_LENGTH || seen.has(key)) continue;
    seen.add(key);
    kept.push(term);
    if (kept.length === MAX_TERMS) break;
  }
  return kept;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

let cachedKey = "";
let cachedPattern: RegExp | undefined;

/** The compiled alternation for `terms`, reused while the list is unchanged. */
function patternFor(terms: readonly string[]): RegExp | undefined {
  const key = terms.join("\u0000");
  if (key !== cachedKey) {
    cachedKey = key;
    // Longest first, so "Ana García" wins over "Ana" at the same position.
    // Whitespace inside a term matches any run of whitespace, line breaks
    // included, because pasted text is often wrapped.
    const alternatives = [...terms]
      .sort((a, b) => b.length - a.length)
      .map((term) => escapeRegExp(term).replace(/\s+/g, "\\s+"));
    cachedPattern =
      alternatives.length === 0
        ? undefined
        : new RegExp(alternatives.join("|"), "giu");
  }
  return cachedPattern;
}

/**
 * Every occurrence of any of `terms` in `text`, ignoring case and only as
 * whole words. This is how names and company names, which have no format to
 * validate, are protected: the user lists them.
 */
export function findTerms(
  text: string,
  terms: readonly string[],
): PatternMatch[] {
  const pattern = patternFor(terms);
  if (pattern === undefined || text.length === 0) return [];
  return scanPattern(text, pattern, () => true);
}
