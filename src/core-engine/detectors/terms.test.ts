import { describe, expect, it } from "vitest";
import { findTerms, normalizeTerms } from "./terms";

describe("normalizeTerms", () => {
  it("trims, drops blanks and one-letter terms, and removes duplicates", () => {
    expect(
      normalizeTerms(["  Ana García ", "", "x", "ana garcía", "ACME S.L."]),
    ).toEqual(["Ana García", "ACME S.L."]);
  });

  it("limits how many terms are kept", () => {
    const many = Array.from({ length: 800 }, (_, index) => `término${index}`);

    expect(normalizeTerms(many)).toHaveLength(500);
  });
});

describe("findTerms", () => {
  it("finds a term and reports its exact position", () => {
    const text = "Informe de Ana García sobre el pedido.";
    expect(findTerms(text, ["Ana García"])).toEqual([
      { value: "Ana García", start: 11, end: 21 },
    ]);
  });

  it("ignores case and keeps the spelling found in the text", () => {
    expect(
      findTerms("ANA GARCÍA y ana garcía", ["Ana García"]).map(
        (match) => match.value,
      ),
    ).toEqual(["ANA GARCÍA", "ana garcía"]);
  });

  it("matches across a line break or doubled spaces inside the term", () => {
    expect(
      findTerms("Ana\nGarcía y Ana   García", ["Ana García"]).map(
        (match) => match.value,
      ),
    ).toEqual(["Ana\nGarcía", "Ana   García"]);
  });

  it("only matches whole words", () => {
    expect(findTerms("Anabel, Susana y Ana.", ["Ana"])).toEqual([
      { value: "Ana", start: 17, end: 20 },
    ]);
  });

  it("prefers the longest term when several start at the same place", () => {
    expect(
      findTerms("Ana García López", ["Ana", "Ana García"]).map(
        (match) => match.value,
      ),
    ).toEqual(["Ana García"]);
  });

  it("treats regular expression characters as plain text", () => {
    expect(
      findTerms("Cliente (S.L.) y [VIP] c++", ["(S.L.)", "[VIP]", "c++"]).map(
        (match) => match.value,
      ),
    ).toEqual(["(S.L.)", "[VIP]", "c++"]);
    expect(findTerms("sXlX", ["s.l."])).toEqual([]);
  });

  it("finds nothing when there are no terms", () => {
    expect(findTerms("Ana García", [])).toEqual([]);
    expect(findTerms("", ["Ana"])).toEqual([]);
  });
});
