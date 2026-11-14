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

  it("returns nothing for text without personal data", () => {
    expect(detectPii("Reunión el 12/03/2025 a las 10:30, sala 4.")).toEqual([]);
    expect(detectPii("")).toEqual([]);
  });
});
