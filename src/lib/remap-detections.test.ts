import { describe, expect, it } from "vitest";
import type { Detection } from "@/core-engine/types";
import { remapDetections } from "./remap-detections";

function detect(text: string, value: string, type: Detection["type"]) {
  const start = text.indexOf(value);
  return { type, value, start, end: start + value.length } satisfies Detection;
}

const BEFORE = "Hola, soy Ana (DNI 12345678Z) y mi email es ana@example.com.";
const DNI = detect(BEFORE, "12345678Z", "DNI");
const EMAIL = detect(BEFORE, "ana@example.com", "EMAIL");
const NAME = detect(BEFORE, "Ana", "TERM");

describe("remapDetections", () => {
  it("returns the same detections for the same text", () => {
    expect(remapDetections(BEFORE, BEFORE, [DNI, EMAIL])).toEqual([DNI, EMAIL]);
  });

  it("keeps everything when text is appended", () => {
    const after = `${BEFORE} Gracias`;
    expect(remapDetections(BEFORE, after, [DNI, EMAIL])).toEqual([DNI, EMAIL]);
  });

  it("shifts detections after an insertion and keeps those before it", () => {
    const after = BEFORE.replace("Hola,", "Hola buenas,");
    const [dni, email] = remapDetections(BEFORE, after, [DNI, EMAIL]);
    expect(after.slice(dni.start, dni.end)).toBe("12345678Z");
    expect(after.slice(email.start, email.end)).toBe("ana@example.com");
    expect(dni.start).toBe(DNI.start + 7);
  });

  it("shifts detections left after a deletion", () => {
    const after = BEFORE.replace("Hola, ", "");
    const [dni] = remapDetections(BEFORE, after, [DNI]);
    expect(dni.start).toBe(DNI.start - 6);
    expect(after.slice(dni.start, dni.end)).toBe("12345678Z");
  });

  it("keeps detections before an edit at the end", () => {
    const after = BEFORE.replace("example.com.", "example.com. Adiós.");
    expect(remapDetections(BEFORE, after, [NAME, DNI])).toEqual([NAME, DNI]);
  });

  it("drops a detection that the edit touched, and only that one", () => {
    const after = BEFORE.replace("12345678Z", "1234567");
    const kept = remapDetections(BEFORE, after, [NAME, DNI, EMAIL]);
    expect(kept.map((d) => d.type)).toEqual(["TERM", "EMAIL"]);
    expect(after.slice(kept[1].start, kept[1].end)).toBe("ana@example.com");
  });

  it("handles text that shrinks to nothing", () => {
    expect(remapDetections(BEFORE, "", [DNI, EMAIL])).toEqual([]);
  });

  it("handles repeated characters around the edit", () => {
    const before = "aaaa 12345678Z";
    const detection = detect(before, "12345678Z", "DNI");
    const after = "aaaaaa 12345678Z";
    const [moved] = remapDetections(before, after, [detection]);
    expect(after.slice(moved.start, moved.end)).toBe("12345678Z");
  });

  it("drops a detection whose text no longer matches", () => {
    const stale: Detection = { ...DNI, value: "00000000T" };
    expect(remapDetections(BEFORE, `${BEFORE}!`, [stale])).toEqual([]);
  });
});
