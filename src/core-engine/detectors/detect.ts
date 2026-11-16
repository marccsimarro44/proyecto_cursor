import { findCreditCards } from "@/lib/regex-utils/card";
import type { PatternMatch } from "@/lib/regex-utils/match";
import {
  findCifs,
  findDnis,
  findEmails,
  findNies,
  findSpanishIbans,
  findSpanishMobiles,
} from "@/lib/regex-utils/es";
import type { Detection, PiiEntityType } from "../types";
import { findCompanyNames, findPersonNames } from "./names";
import { findTerms } from "./terms";

interface Detector {
  type: PiiEntityType;
  find: (text: string) => PatternMatch[];
}

/**
 * Active detectors. The order breaks ties when two detections of the same
 * length overlap: checksum-validated entities come before phone numbers,
 * which have no checksum. User terms rank last: a term that equals a
 * validated value is still reported as that value.
 */
const DETECTORS: readonly Detector[] = [
  { type: "IBAN", find: findSpanishIbans },
  { type: "EMAIL", find: findEmails },
  { type: "DNI", find: findDnis },
  { type: "NIE", find: findNies },
  { type: "CIF", find: findCifs },
  { type: "CREDIT_CARD", find: findCreditCards },
  { type: "PHONE", find: findSpanishMobiles },
];

export interface DetectOptions {
  /** Extra names or phrases to detect, matched as whole words. */
  terms?: readonly string[];
  /** Also look for names of people and companies (see names.ts). */
  names?: boolean;
  /**
   * Values the user marked as not personal, e.g. a product called "Victoria
   * Bitter". A name found with one of these values is dropped, together
   * with any shorter name inside it.
   */
  ignored?: readonly string[];
}

/** Case and spacing do not matter when comparing with `ignored`. */
export function ignoreKey(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

function findNames(
  text: string,
  ignored: readonly string[],
): { type: PiiEntityType; match: PatternMatch }[] {
  const found = [
    ...findCompanyNames(text).map((match) => ({ type: "ORG" as const, match })),
    ...findPersonNames(text).map((match) => ({
      type: "PERSON" as const,
      match,
    })),
  ];
  if (ignored.length === 0) return found;

  const keys = new Set(ignored.map(ignoreKey));
  const dropped = found
    .filter(({ match }) => keys.has(ignoreKey(match.value)))
    .map(({ match }) => match);
  return found.filter(
    ({ match }) =>
      !dropped.some(
        (outer) => match.start >= outer.start && match.end <= outer.end,
      ),
  );
}

interface Candidate extends Detection {
  rank: number;
}

function outranks(candidate: Candidate, other: Candidate): boolean {
  const length = candidate.end - candidate.start;
  const otherLength = other.end - other.start;
  return (
    length > otherLength ||
    (length === otherLength && candidate.rank < other.rank)
  );
}

/**
 * Finds every piece of personal data in `text`.
 *
 * Detections are returned ordered by `start` and never overlap. When two
 * detectors claim overlapping spans the longer one wins, so an email such as
 * `12345678z@gmail.com` is reported once as an EMAIL instead of leaving half
 * of the address in the sanitized text.
 *
 * `options.terms` are names or phrases the user wants hidden as well; they
 * should already be cleaned with `normalizeTerms`.
 */
export function detectPii(
  text: string,
  options: DetectOptions = {},
): Detection[] {
  const candidates: Candidate[] = [];
  DETECTORS.forEach((detector, rank) => {
    for (const match of detector.find(text)) {
      candidates.push({ type: detector.type, ...match, rank });
    }
  });
  const rank = DETECTORS.length;
  for (const match of findTerms(text, options.terms ?? [])) {
    candidates.push({ type: "TERM", ...match, rank });
  }
  // Guessed names rank after the user's own terms, companies before people
  // so "Talleres José Pérez" is not split into a person and a leftover.
  if (options.names) {
    for (const { type, match } of findNames(text, options.ignored ?? [])) {
      candidates.push({
        type,
        ...match,
        rank: rank + (type === "ORG" ? 1 : 2),
      });
    }
  }

  candidates.sort(
    (a, b) => a.start - b.start || b.end - a.end || a.rank - b.rank,
  );

  const kept: Candidate[] = [];
  for (const candidate of candidates) {
    const last = kept[kept.length - 1];
    if (last === undefined || candidate.start >= last.end) {
      kept.push(candidate);
    } else if (outranks(candidate, last)) {
      kept[kept.length - 1] = candidate;
    }
  }

  return kept.map(({ type, value, start, end }) => ({
    type,
    value,
    start,
    end,
  }));
}
