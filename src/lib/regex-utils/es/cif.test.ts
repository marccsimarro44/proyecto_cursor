import { describe, expect, it } from "vitest";
import { findCifs, isValidCif } from "./cif";

describe("isValidCif", () => {
  it.each([
    "A58818501", // sociedad anónima: numeric control
    "B12345674", // sociedad limitada: numeric control
    "G28029643", // association: either control accepted
    "G2802964C",
    "Q2826000H", // public body: letter control
    "P2807900B", // local corporation: letter control
  ])("accepts %s", (value) => {
    expect(isValidCif(value)).toBe(true);
  });

  it.each(["B-12345674", "b12345674", "A-5881850-1"])(
    "accepts the formatted variant %s",
    (value) => {
      expect(isValidCif(value)).toBe(true);
    },
  );

  it.each([
    "A58818502", // wrong control digit
    "B1234567D", // S.L. must use a numeric control
    "Q28260008", // public bodies must use a letter control
    "Q2826000A", // wrong control letter
    "I12345674", // I is not an organization letter
    "B1234567", // too short
    "B123456744", // too long
    "12345678Z", // a DNI
    "",
  ])("rejects %s", (value) => {
    expect(isValidCif(value)).toBe(false);
  });
});

describe("findCifs", () => {
  it("finds a CIF and reports its exact position", () => {
    const text = "Factura emitida por ACME S.L. (CIF B12345674).";
    expect(findCifs(text)).toEqual([
      { value: "B12345674", start: 35, end: 44 },
    ]);
  });

  it("finds several CIFs in different formats", () => {
    const text = "A58818501, B-12345674 y Q2826000H";
    expect(findCifs(text).map((match) => match.value)).toEqual([
      "A58818501",
      "B-12345674",
      "Q2826000H",
    ]);
  });

  it("ignores invalid checksums and glued candidates", () => {
    expect(findCifs("B12345675")).toEqual([]);
    expect(findCifs("AB12345674")).toEqual([]);
    expect(findCifs("B123456740")).toEqual([]);
    expect(findCifs("B12345674X")).toEqual([]);
  });
});
