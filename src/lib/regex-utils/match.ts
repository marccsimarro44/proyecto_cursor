/** A raw pattern occurrence inside a text, before it is given a PII type. */
export interface PatternMatch {
  /** Exact substring matched in the source text. */
  value: string;
  /** Inclusive start offset, in UTF-16 code units. */
  start: number;
  /** Exclusive end offset, in UTF-16 code units. */
  end: number;
}

/**
 * Whether a UTF-16 code unit is a digit or a letter, including accented
 * Latin-1 letters. Returns false for `NaN`, so it can be fed
 * `text.charCodeAt()` of an out-of-range index.
 */
export function isWordCode(code: number): boolean {
  return (
    (code >= 48 && code <= 57) || // 0-9
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    (code >= 0xc0 && code <= 0xff && code !== 0xd7 && code !== 0xf7) // À-ÿ
  );
}

/**
 * Runs `pattern` over `text` and keeps the occurrences that stand alone (not
 * glued to a letter or digit on either side) and that `accept` approves.
 *
 * Word boundaries are checked here instead of with lookbehind assertions
 * because a lookbehind is a syntax error in older Safari versions, which
 * would break the whole bundle rather than a single detector.
 *
 * A rejected candidate is retried from its next character, so a valid value
 * that overlaps a rejected one is not lost. Patterns must have a bounded
 * match length to keep the scan linear.
 */
export function scanPattern(
  text: string,
  pattern: RegExp,
  accept: (candidate: PatternMatch, text: string) => boolean,
): PatternMatch[] {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  const matches: PatternMatch[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const value = match[0];
    const start = match.index;
    const end = start + value.length;
    const candidate: PatternMatch = { value, start, end };

    if (
      !isWordCode(text.charCodeAt(start - 1)) &&
      !isWordCode(text.charCodeAt(end)) &&
      accept(candidate, text)
    ) {
      matches.push(candidate);
    } else {
      regex.lastIndex = start + 1;
    }
  }

  return matches;
}
