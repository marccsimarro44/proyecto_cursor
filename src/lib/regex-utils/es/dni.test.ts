import { describe, expect, it } from "vitest";
import { dniLetter, findDnis, isValidDni } from "./dni";

describe("dniLetter", () => {
  it("computes the mod-23 control letter", () => {
    expect(dniLetter(12345678)).toBe("Z");
    expect(dniLetter(0)).toBe("T");
    expect(dniLetter(87654321)).toBe("X");
    expect(dniLetter(99999999)).toBe("R");
  });
});

describe("isValidDni", () => {
  it.each(["12345678Z", "87654321X", "00000000T", "99999999R"])(
    "accepts %s",
    (value) => {
      expect(isValidDni(value)).toBe(true);
    },
  );

  it.each(["12345678-Z", "12345678 Z", "12.345.678-Z", "12.345.678Z"])(
    "accepts the formatted variant %s",
    (value) => {
      expect(isValidDni(value)).toBe(true);
    },
  );

  it("accepts a lowercase control letter", () => {
    expect(isValidDni("12345678z")).toBe(true);
  });

  it.each([
    "12345678A", // wrong control letter
    "12345678", // no letter
    "1234567Z", // too short
    "123456789Z", // too long
    "12345678ZZ",
    "12.345678Z", // inconsistent grouping
    "X1234567L", // a NIE, not a DNI
    "",
  ])("rejects %s", (value) => {
    expect(isValidDni(value)).toBe(false);
  });
});

describe("findDnis", () => {
  it("finds a DNI and reports its exact position", () => {
    const text = "El cliente con DNI 12345678Z firmó ayer.";
    expect(findDnis(text)).toEqual([
      { value: "12345678Z", start: 19, end: 28 },
    ]);
    expect(text.slice(19, 28)).toBe("12345678Z");
  });

  it("finds several DNIs in different formats", () => {
    const text = "12345678-Z, 87.654.321-X y también 99999999r.";
    expect(findDnis(text).map((match) => match.value)).toEqual([
      "12345678-Z",
      "87.654.321-X",
      "99999999r",
    ]);
  });

  it("ignores numbers whose control letter does not match", () => {
    expect(findDnis("Referencia 12345678A y 87654321B")).toEqual([]);
  });

  it("ignores candidates glued to other letters or digits", () => {
    expect(findDnis("912345678Z")).toEqual([]);
    expect(findDnis("12345678Zeta")).toEqual([]);
    expect(findDnis("REF12345678Z")).toEqual([]);
  });

  it("does not take a number followed by a lowercase word for a DNI", () => {
    // 12345678 % 23 -> Z; "z" here is a separate lowercase word, not a letter.
    expect(findDnis("pagó 12345678 z veces")).toEqual([]);
    expect(findDnis("pagó 12345678 Z")).toHaveLength(1);
  });

  it("finds a DNI at the very start and end of the text", () => {
    expect(findDnis("12345678Z")).toEqual([
      { value: "12345678Z", start: 0, end: 9 },
    ]);
  });

  it("finds DNIs separated by CSV delimiters", () => {
    const text = 'nombre;dni\n"Ana";"12345678Z"\nLuis;87654321X';
    expect(findDnis(text).map((match) => match.value)).toEqual([
      "12345678Z",
      "87654321X",
    ]);
  });
});
