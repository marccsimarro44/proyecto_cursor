import { describe, expect, it } from "vitest";
import { detectPii } from "./detect";

describe("detectPii", () => {
  it("detects every supported entity type in one text", () => {
    const text = [
      "Cliente: Ana García, DNI 12345678Z, NIE X1234567L.",
      "Empresa con CIF B12345674.",
      "Cuenta ES91 2100 0418 4502 0005 1332.",
      "Contacto: +34 612 345 678 / ana@example.com",
    ].join("\n");

    expect(
      detectPii(text).map((detection) => [detection.type, detection.value]),
    ).toEqual([
      ["DNI", "12345678Z"],
      ["NIE", "X1234567L"],
      ["CIF", "B12345674"],
      ["IBAN", "ES91 2100 0418 4502 0005 1332"],
      ["PHONE", "+34 612 345 678"],
      ["EMAIL", "ana@example.com"],
    ]);
  });

  it("reports offsets that slice back to the detected value", () => {
    const text = "a 12345678Z b ana@example.com c 612345678 d";
    const detections = detectPii(text);

    expect(detections).toHaveLength(3);
    for (const detection of detections) {
      expect(text.slice(detection.start, detection.end)).toBe(detection.value);
    }
  });

  it("returns detections ordered by position and never overlapping", () => {
    const text = "612345678 ana@example.com 12345678Z ES9121000418450200051332";
    const detections = detectPii(text);

    for (let index = 1; index < detections.length; index++) {
      expect(detections[index].start).toBeGreaterThanOrEqual(
        detections[index - 1].end,
      );
    }
    expect(detections.map((detection) => detection.type)).toEqual([
      "PHONE",
      "EMAIL",
      "DNI",
      "IBAN",
    ]);
  });

  it("keeps the whole email when its local part looks like a DNI", () => {
    expect(detectPii("Usuario: 12345678z@gmail.com")).toEqual([
      { type: "EMAIL", value: "12345678z@gmail.com", start: 9, end: 28 },
    ]);
  });

  it("keeps the whole email when its local part looks like a phone", () => {
    expect(
      detectPii("612345678@example.com").map((detection) => detection.type),
    ).toEqual(["EMAIL"]);
  });

  it("reports user terms with their own type", () => {
    expect(
      detectPii("Hola Ana García", { terms: ["Ana García"] }).map(
        (detection) => [detection.type, detection.value],
      ),
    ).toEqual([["TERM", "Ana García"]]);
  });

  it("lets a validated value win over a term that overlaps it", () => {
    expect(
      detectPii("ana@example.com", { terms: ["ana"] }).map(
        (detection) => detection.type,
      ),
    ).toEqual(["EMAIL"]);
  });

  it("detects a payment card and keeps its separators in the value", () => {
    expect(detectPii("pago 4111-1111-1111-1111 ok")).toEqual([
      { type: "CREDIT_CARD", value: "4111-1111-1111-1111", start: 5, end: 24 },
    ]);
  });

  it("finds people and companies only when asked to", () => {
    const text = "Ana García Ruiz trabaja en Construcciones Levante, S.L.";
    expect(detectPii(text)).toEqual([]);
    expect(
      detectPii(text, { names: true }).map((d) => [d.type, d.value]),
    ).toEqual([
      ["PERSON", "Ana García Ruiz"],
      ["ORG", "Construcciones Levante, S.L."],
    ]);
  });

  it("keeps a company whole when it contains a person's name", () => {
    expect(
      detectPii("Factura de Talleres José Pérez SL.", { names: true }).map(
        (d) => [d.type, d.value],
      ),
    ).toEqual([["ORG", "Talleres José Pérez SL"]]);
  });

  it("keeps a person and a company apart across «y»", () => {
    expect(
      detectPii("Contrato entre Ana Martín y Bricolaje Express, S.A.", {
        names: true,
      }).map((d) => [d.type, d.value]),
    ).toEqual([
      ["PERSON", "Ana Martín"],
      ["ORG", "Bricolaje Express, S.A."],
    ]);
  });

  it("prefers the user's term over a guessed name of the same span", () => {
    expect(
      detectPii("Hola Ana García", { names: true, terms: ["Ana García"] }).map(
        (d) => d.type,
      ),
    ).toEqual(["TERM"]);
  });

  it("drops ignored names and the shorter names inside them", () => {
    const text = "Pide Construcciones Levante SL y llama a Marta López.";
    expect(
      detectPii(text, {
        names: true,
        ignored: ["construcciones  LEVANTE sl"],
      }).map((d) => d.value),
    ).toEqual(["Marta López"]);
  });

  it("never ignores data with a format of its own", () => {
    expect(
      detectPii("DNI 12345678Z", { names: true, ignored: ["12345678Z"] }).map(
        (d) => d.type,
      ),
    ).toEqual(["DNI"]);
  });

  it("returns nothing for text without personal data", () => {
    expect(detectPii("Reunión el 12/03/2025 a las 10:30, sala 4.")).toEqual([]);
    expect(detectPii("")).toEqual([]);
  });
});
