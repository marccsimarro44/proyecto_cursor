import { describe, expect, it } from "vitest";
import { countByType, formatBytes, sortedCounts } from "./format";

describe("formatBytes", () => {
  it("uses Spanish decimal commas and the largest fitting unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(4_966_713)).toBe("4,7 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3 GB");
  });
});

describe("countByType / sortedCounts", () => {
  it("counts detections per type and sorts the biggest first", () => {
    const counts = countByType([
      { type: "EMAIL" },
      { type: "DNI" },
      { type: "DNI" },
      { type: "DNI" },
      { type: "EMAIL" },
      { type: "IBAN" },
    ]);

    expect(counts).toEqual({ EMAIL: 2, DNI: 3, IBAN: 1 });
    expect(sortedCounts(counts)).toEqual([
      ["DNI", 3],
      ["EMAIL", 2],
      ["IBAN", 1],
    ]);
  });

  it("returns nothing for no detections", () => {
    expect(sortedCounts(countByType([]))).toEqual([]);
  });
});
