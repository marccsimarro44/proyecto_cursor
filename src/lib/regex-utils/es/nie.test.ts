import { describe, expect, it } from "vitest";
import { findNies, isValidNie } from "./nie";

describe("isValidNie", () => {
  it.each(["X1234567L", "Y1234567X", "Z1234567R"])("accepts %s", (value) => {
    expect(isValidNie(value)).toBe(true);
  });

  it.each(["X-1234567-L", "x1234567l", "Y1234567-X"])(
    "accepts the formatted variant %s",
    (value) => {
      expect(isValidNie(value)).toBe(true);
    },
  );

  it.each([
    "X1234567A", // wrong control letter
    "Y1234567L", // the prefix changes the checksum
    "W1234567L", // invalid prefix
    "X123456L", // too short
    "X12345678L", // too long
    "12345678Z", // a DNI, not a NIE
    "",
  ])("rejects %s", (value) => {
    expect(isValidNie(value)).toBe(false);
  });
});

describe("findNies", () => {
  it("finds a NIE and reports its exact position", () => {
    const text = "Residente con NIE X1234567L desde 2019.";
    expect(findNies(text)).toEqual([
      { value: "X1234567L", start: 18, end: 27 },
    ]);
  });

  it("finds several NIEs in different formats", () => {
    const text = "X-1234567-L; y1234567x; Z1234567R";
    expect(findNies(text).map((match) => match.value)).toEqual([
      "X-1234567-L",
      "y1234567x",
      "Z1234567R",
    ]);
  });

  it("ignores invalid checksums and glued candidates", () => {
    expect(findNies("X1234567A")).toEqual([]);
    expect(findNies("AX1234567L")).toEqual([]);
    expect(findNies("X1234567LL")).toEqual([]);
    expect(findNies("X12345678L")).toEqual([]);
  });
});
