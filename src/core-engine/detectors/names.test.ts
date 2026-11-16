import { describe, expect, it } from "vitest";
import { findCompanyNames, findPersonNames } from "./names";

const people = (text: string) => findPersonNames(text).map((m) => m.value);
const companies = (text: string) => findCompanyNames(text).map((m) => m.value);

describe("findPersonNames", () => {
  it.each([
    ["Me llamo Ana García Ruiz y vivo en Murcia.", ["Ana García Ruiz"]],
    ["Firmado por María José de la Fuente.", ["María José de la Fuente"]],
    ["El cliente es Iñaki Etxeberria.", ["Iñaki Etxeberria"]],
    ["Llama a Jordi Puig i Soler mañana.", ["Jordi Puig i Soler"]],
    ["Hablé con Juan M. Soler ayer.", ["Juan M. Soler"]],
    ["Revisado por Carmen.", ["Carmen"]],
    ["TITULAR: JOSÉ ANTONIO PÉREZ LÓPEZ", ["JOSÉ ANTONIO PÉREZ LÓPEZ"]],
    ["Ana García DNI 12345678Z", ["Ana García"]],
    ["Ana,García,12345678Z", ["Ana", "García"]],
    ["7;Pilar;García López;Madrid", ["Pilar", "García López"]],
    ["7\tPILAR\tGARCÍA DE LA ROSA\n", ["PILAR", "GARCÍA DE LA ROSA"]],
    ["Ana,Luis,Marta", ["Ana", "Luis", "Marta"]],
  ])("finds the name in %j", (text, expected) => {
    expect(people(text)).toEqual(expected);
  });

  it.each([
    ["Atiende la Sra. Lozano.", ["Lozano"]],
    ["Dña. Rosa Martínez firmó.", ["Rosa Martínez"]],
    ["Lo envía el Dr. Fernández Ortega.", ["Fernández Ortega"]],
    ["Hola Ainhize, te escribo por la factura.", ["Ainhize"]],
    ["Hola, Pilar\n¿Qué tal?", ["Pilar"]],
    ["Atentamente,\nRosa Vidal", ["Rosa Vidal"]],
  ])("finds the name after a title or greeting in %j", (text, expected) => {
    expect(people(text)).toEqual(expected);
  });

  it.each([
    "La rosa del jardín. Rosa es también un color.",
    "Nos vemos en Julio o en Abril.",
    "Hola Equipo, os paso el informe.",
    "Hola. Necesito ayuda con esto.",
    "Gracias. Mañana lo revisamos.",
    "Pregúntale a Claude o a ChatGPT.",
    "Vitamina D. Después del análisis.",
    "Mercedes y Santiago son ciudades y marcas.",
    "NOMBRE,APELLIDOS,DNI",
    "Pilar,Mañana vamos al centro",
    "El IBAN y el DNI están en el anexo.",
  ])("finds no person in %j", (text) => {
    expect(people(text)).toEqual([]);
  });

  it("reports offsets into the original text", () => {
    const text = "Hola, soy Marta López.";
    const [match] = findPersonNames(text);
    expect(text.slice(match.start, match.end)).toBe("Marta López");
  });
});

describe("findCompanyNames", () => {
  it.each([
    [
      "Factura de Construcciones Levante, S.L. por obra.",
      ["Construcciones Levante, S.L."],
    ],
    ["Proveedor: Talleres Hermanos Gil SL", ["Talleres Hermanos Gil SL"]],
    ["Contrato con Pérez & Asociados S.L.P. hoy", ["Pérez & Asociados S.L.P."]],
    ["Cliente: ACME IBERIA S.A.U.", ["ACME IBERIA S.A.U."]],
    ["Pagado a Gestoría Ruiz y Asociados.", ["Gestoría Ruiz y Asociados"]],
    ["Donación a la Fundación Mar de Plata.", ["Fundación Mar de Plata"]],
    ["Socio de Northwind Traders Ltd.", ["Northwind Traders Ltd."]],
  ])("finds the company in %j", (text, expected) => {
    expect(companies(text)).toEqual(expected);
  });

  it.each([
    "la empresa s.l. no consta",
    "Grupo de trabajo del lunes.",
    "El SA de la oferta no aplica.",
    "Cliente: S.L.",
  ])("finds no company in %j", (text) => {
    expect(companies(text)).toEqual([]);
  });
});
