import type { Detection } from "@/core-engine/types";

/**
 * Carries detections found in `before` over to `after`, a later version of
 * the same text.
 *
 * The engine answers a few hundred milliseconds after the last keystroke, so
 * for a moment the highlights belong to an older text. Rather than drop them
 * (they would flicker on every pause) or draw them in the wrong place, the
 * edit is located by its common prefix and suffix: detections before it stay,
 * detections after it shift by the length change, and any detection the edit
 * touched is dropped until the engine answers again.
 */
export function remapDetections(
  before: string,
  after: string,
  detections: readonly Detection[],
): Detection[] {
  if (before === after) return [...detections];

  const limit = Math.min(before.length, after.length);
  let prefix = 0;
  while (
    prefix < limit &&
    before.charCodeAt(prefix) === after.charCodeAt(prefix)
  ) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix < limit - prefix &&
    before.charCodeAt(before.length - 1 - suffix) ===
      after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }

  const delta = after.length - before.length;
  const suffixStart = before.length - suffix;
  const carried: Detection[] = [];
  for (const detection of detections) {
    let start = detection.start;
    let end = detection.end;
    if (end <= prefix) {
      // Untouched, before the edit.
    } else if (start >= suffixStart) {
      start += delta;
      end += delta;
    } else {
      continue;
    }
    // Never trust arithmetic alone: the text under the range must be the
    // value that was detected.
    if (after.slice(start, end) !== detection.value) continue;
    carried.push({ ...detection, start, end });
  }
  return carried;
}
