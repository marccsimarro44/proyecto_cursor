import { describe, expect, it } from "vitest";
import { findEmails, isValidEmail } from "./email";

describe("isValidEmail", () => {
  it.each([
    "ana@example.com",
    "ana.garcia@example.es",
    "ana+facturas@sub.dominio.example.org",
    "a_b-c%d@ejemplo.cat",
    "soporte@españa.es",
    "JUAN@EMPRESA.COM",
    "12345678z@gmail.com",
  ])("accepts %s", (value) => {
    expect(isValidEmail(value)).toBe(true);
  });

  it.each([
    "ana@example", // no TLD
    "ana@.com",
    "@example.com",
    "ana@example.c", // one-letter TLD
    "ana@example.123", // numeric TLD
    "ana..garcia@example.com", // consecutive dots
    ".ana@example.com",
    "ana.@example.com",
    "ana@-example.com",
    "ana@example-.com",
    "ana@exa mple.com",
    "ana@@example.com",
    "ana",
    "",
  ])("rejects %s", (value) => {
    expect(isValidEmail(value)).toBe(false);
  });

  it("rejects a local part longer than 64 characters", () => {
    expect(isValidEmail(`${"a".repeat(64)}@example.com`)).toBe(true);
    expect(isValidEmail(`${"a".repeat(65)}@example.com`)).toBe(false);
  });
});

describe("findEmails", () => {
  it("finds an email and reports its exact position", () => {
    const text = "Escribe a ana.garcia@example.es para más información.";
    expect(findEmails(text)).toEqual([
      { value: "ana.garcia@example.es", start: 10, end: 31 },
    ]);
  });

  it("does not swallow the punctuation around an email", () => {
    const text =
      "Contacto: ana@example.com, luis@example.org. (maria@example.net) <jose@example.es>";
    expect(findEmails(text).map((match) => match.value)).toEqual([
      "ana@example.com",
      "luis@example.org",
      "maria@example.net",
      "jose@example.es",
    ]);
  });

  it("finds emails inside CSV and mailto contexts", () => {
    const text = 'id;email\n1;"ana@example.com"\n2;mailto:luis@example.org';
    expect(findEmails(text).map((match) => match.value)).toEqual([
      "ana@example.com",
      "luis@example.org",
    ]);
  });

  it("ignores things that only look like emails", () => {
    expect(findEmails("usuario@localhost")).toEqual([]);
    expect(findEmails("precio @ 3.50 la unidad")).toEqual([]);
    expect(findEmails("@mencion en redes")).toEqual([]);
    expect(findEmails("a@@b.com")).toEqual([]);
  });

  it("stays linear on long runs without an at sign", () => {
    const text = `${"a".repeat(2_000_000)} ana@example.com`;
    const started = performance.now();
    const matches = findEmails(text);
    expect(matches.map((match) => match.value)).toEqual(["ana@example.com"]);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("handles a long local run before the at sign", () => {
    const text = `${"a".repeat(100_000)}@example.com`;
    expect(findEmails(text)).toEqual([]);
  });
});
