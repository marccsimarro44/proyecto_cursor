import { describe, expect, it } from "vitest";
import { findCreditCards, isValidCreditCard } from "./card";

describe("isValidCreditCard (Luhn)", () => {
  it.each([
    "4111111111111111", // Visa
    "5500005555555559", // Mastercard
    "378282246310005", // American Express
    "6011111111111117", // Discover
    "4111 1111 1111 1111",
    "4111-1111-1111-1111",
    "3782 822463 10005",
  ])("accepts %s", (value) => {
    expect(isValidCreditCard(value)).toBe(true);
  });

  it.each([
    "4111111111111112", // wrong check digit
    "1234567812345678",
    "0000000000000000",
    "4111 1111 1111", // too short
    "41111111111111111111", // too long
    "1700000000000", // epoch milliseconds, starts with 1
    "4111  1111  1111  1111", // doubled separators
    "",
  ])("rejects %s", (value) => {
    expect(isValidCreditCard(value)).toBe(false);
  });
});

describe("findCreditCards", () => {
  it("finds a card and reports its exact position", () => {
    const text = "Pago con tarjeta 4111 1111 1111 1111 aceptado.";
    expect(findCreditCards(text)).toEqual([
      { value: "4111 1111 1111 1111", start: 17, end: 36 },
    ]);
  });

  it("finds cards written together, grouped and in Amex format", () => {
    const text = "4111111111111111; 5500-0055-5555-5559; 3782 822463 10005";
    expect(findCreditCards(text).map((match) => match.value)).toEqual([
      "4111111111111111",
      "5500-0055-5555-5559",
      "3782 822463 10005",
    ]);
  });

  it("does not swallow a number that follows the card", () => {
    expect(
      findCreditCards("4111111111111111 1234").map((match) => match.value),
    ).toEqual(["4111111111111111"]);
  });

  it("ignores digit runs that fail Luhn or belong to longer numbers", () => {
    expect(findCreditCards("4111111111111112")).toEqual([]);
    expect(findCreditCards("94111111111111111")).toEqual([]);
    expect(findCreditCards("Pedido 1234567890123")).toEqual([]);
  });
});
