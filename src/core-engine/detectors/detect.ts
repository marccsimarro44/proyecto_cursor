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

interface Detector {
  type: PiiEntityType;
  find: (text: string) => PatternMatch[];
}

/**
 * Active detectors. The order breaks ties when two detections of the same
 * length overlap: checksum-validated entities come before phone numbers,
 * which have no checksum.
 */
const DETECTORS: readonly Detector[] = [
  { type: "IBAN", find: findSpanishIbans },
  { type: "EMAIL", find: findEmails },
  { type: "DNI", find: findDnis },
  { type: "NIE", find: findNies },
  { type: "CIF", find: findCifs },
  { type: "PHONE", find: findSpanishMobiles },
];

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
 */
export function detectPii(text: string): Detection[] {
  const candidates: Candidate[] = [];
  DETECTORS.forEach((detector, rank) => {
    for (const match of detector.find(text)) {
      candidates.push({ type: detector.type, ...match, rank });
    }
  });

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
