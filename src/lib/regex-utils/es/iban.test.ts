import { describe, expect, it } from "vitest";
import { findSpanishIbans, isValidIban, isValidSpanishIban } from "./iban";

describe("isValidIban (ISO 13616 mod-97)", () => {
  it.each([
    "ES9121000418450200051332",
    "ES7921000813610123456789",
    "DE89370400440532013000",
    "GB82WEST12345698765432",
    "FR1420041010050500013M02606",
  ])("accepts %s", (value) => {
    expect(isValidIban(value)).toBe(true);
  });

  it("accepts separators and lowercase", () => {
    expect(isValidIban("ES91 2100 0418 4502 0005 1332")).toBe(true);
    expect(isValidIban("es91-2100-0418-4502-0005-1332")).toBe(true);
    expect(isValidIban("GB82 WEST 1234 5698 7654 32")).toBe(true);
  });

  it.each([
    "ES9121000418450200051333", // last digit changed
    "ES9021000418450200051332", // check digits changed
    "ES91210004184502000513", // truncated
    "9121000418450200051332ES",
    "ES91_2100_0418_4502_0005_1332",
    "",
  ])("rejects %s", (value) => {
    expect(isValidIban(value)).toBe(false);
  });
});

describe("isValidSpanishIban", () => {
  it("accepts valid Spanish IBANs", () => {
    expect(isValidSpanishIban("ES9121000418450200051332")).toBe(true);
    expect(isValidSpanishIban("ES66 2100 0418 4012 3456 7891")).toBe(true);
  });

  it("rejects valid IBANs from other countries", () => {
    expect(isValidSpanishIban("DE89370400440532013000")).toBe(false);
  });

  it("rejects Spanish IBANs with a wrong checksum or length", () => {
    expect(isValidSpanishIban("ES9121000418450200051333")).toBe(false);
    expect(isValidSpanishIban("ES912100041845020005133")).toBe(false);
  });
});

describe("findSpanishIbans", () => {
  it("finds a compact IBAN and reports its exact position", () => {
    const text = "Domiciliar en ES9121000418450200051332 antes del día 5.";
    expect(findSpanishIbans(text)).toEqual([
      { value: "ES9121000418450200051332", start: 14, end: 38 },
    ]);
  });

  it("finds IBANs printed in groups", () => {
    const text =
      "IBAN: ES91 2100 0418 4502 0005 1332\nOtra: ES79-2100-0813-6101-2345-6789.";
    expect(findSpanishIbans(text).map((match) => match.value)).toEqual([
      "ES91 2100 0418 4502 0005 1332",
      "ES79-2100-0813-6101-2345-6789",
    ]);
  });

  it("finds IBANs grouped like the legacy CCC (4-4-2-10)", () => {
    const text = "Cuenta ES91 2100 0418 45 0200051332";
    expect(findSpanishIbans(text).map((match) => match.value)).toEqual([
      "ES91 2100 0418 45 0200051332",
    ]);
  });

  it("ignores IBANs with a wrong checksum", () => {
    expect(findSpanishIbans("ES9121000418450200051333")).toEqual([]);
    expect(findSpanishIbans("ES00 2100 0418 4502 0005 1332")).toEqual([]);
  });

  it("ignores candidates glued to other letters or digits", () => {
    expect(findSpanishIbans("XES9121000418450200051332")).toEqual([]);
    expect(findSpanishIbans("ES91210004184502000513321")).toEqual([]);
  });

  it("does not match across line breaks", () => {
    expect(findSpanishIbans("ES91 2100 0418\n4502 0005 1332")).toEqual([]);
  });
});
