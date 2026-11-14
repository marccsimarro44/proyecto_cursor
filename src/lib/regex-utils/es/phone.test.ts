import { describe, expect, it } from "vitest";
import {
  findSpanishMobiles,
  isValidSpanishMobile,
  normalizeSpanishMobile,
} from "./phone";

describe("isValidSpanishMobile", () => {
  it.each([
    "612345678",
    "712345678",
    "742345678",
    "+34612345678",
    "+34 612 345 678",
    "+34 612 34 56 78",
    "0034612345678",
    "0034 612-345-678",
    "(+34) 612 345 678",
    "612 345 678",
    "612.345.678",
    "612-34-56-78",
    "612 3456 78", // unusual grouping, still the nine digits of a mobile
  ])("accepts %s", (value) => {
    expect(isValidSpanishMobile(value)).toBe(true);
  });

  it.each([
    "912345678", // landline
    "812345678", // landline
    "512345678", // unassigned range
    "752345678", // 75-79 are not mobile ranges
    "61234567", // too short
    "6123456789", // too long
    "+44612345678", // not a Spanish prefix
    "+34 912 345 678",
    "612  345  678", // doubled separators
    "612/345/678",
    "",
  ])("rejects %s", (value) => {
    expect(isValidSpanishMobile(value)).toBe(false);
  });
});

describe("normalizeSpanishMobile", () => {
  it("returns the E.164 form", () => {
    expect(normalizeSpanishMobile("612 34 56 78")).toBe("+34612345678");
    expect(normalizeSpanishMobile("0034 612-345-678")).toBe("+34612345678");
    expect(normalizeSpanishMobile("(+34) 612.345.678")).toBe("+34612345678");
  });

  it("returns null for anything that is not a Spanish mobile", () => {
    expect(normalizeSpanishMobile("912345678")).toBeNull();
  });
});

describe("findSpanishMobiles", () => {
  it("finds a mobile and reports its exact position", () => {
    const text = "Llámame al 612345678 mañana.";
    expect(findSpanishMobiles(text)).toEqual([
      { value: "612345678", start: 11, end: 20 },
    ]);
  });

  it("includes the international prefix in the match", () => {
    const text =
      "Tel: +34 612 345 678, WhatsApp: 0034722123456 o (+34) 699-11-22-33";
    expect(findSpanishMobiles(text).map((match) => match.value)).toEqual([
      "+34 612 345 678",
      "0034722123456",
      "(+34) 699-11-22-33",
    ]);
  });

  it("ignores landlines and non-mobile ranges", () => {
    expect(findSpanishMobiles("Oficina: 912345678 / 934 567 890")).toEqual([]);
    expect(findSpanishMobiles("752345678")).toEqual([]);
  });

  it("ignores digits that belong to a longer number", () => {
    expect(findSpanishMobiles("1612345678")).toEqual([]);
    expect(findSpanishMobiles("6123456789")).toEqual([]);
    expect(findSpanishMobiles("Pedido 20612345678")).toEqual([]);
  });

  it("ignores candidates glued to letters", () => {
    expect(findSpanishMobiles("REF612345678")).toEqual([]);
    expect(findSpanishMobiles("612345678A")).toEqual([]);
  });

  it("ignores digits that are part of a dotted number", () => {
    expect(findSpanishMobiles("ratio: 0.612345678")).toEqual([]);
    expect(findSpanishMobiles("Importe: 612345678.50")).toEqual([]);
    expect(findSpanishMobiles("Total 1.612.345.678")).toEqual([]);
  });

  it("finds mobiles in comma-delimited CSV rows", () => {
    // A comma next to a digit is far more often a CSV delimiter than a
    // decimal separator, and missing a phone is worse than over-redacting.
    expect(
      findSpanishMobiles("1,612345678,622345678,Ana").map(
        (match) => match.value,
      ),
    ).toEqual(["612345678", "622345678"]);
  });

  it("still matches a mobile followed by sentence punctuation", () => {
    expect(
      findSpanishMobiles("Mi número es 612345678.").map((match) => match.value),
    ).toEqual(["612345678"]);
    expect(
      findSpanishMobiles("612345678, 622345678").map((match) => match.value),
    ).toEqual(["612345678", "622345678"]);
  });

  it("does not match across line breaks", () => {
    expect(findSpanishMobiles("612\n345 678")).toEqual([]);
  });
});
