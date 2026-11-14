import { beforeEach, describe, expect, it } from "vitest";
import { Sanitizer } from "./sanitizer";
import { generateVaultKey } from "./vault/crypto";
import { createMemoryStorage } from "./vault/storage";
import { Vault } from "./vault/vault";

let sanitizer: Sanitizer;

beforeEach(async () => {
  const vault = await Vault.open({
    sessionId: "test",
    key: await generateVaultKey(),
    storage: createMemoryStorage(),
  });
  sanitizer = new Sanitizer(vault);
});

describe("Sanitizer.sanitize", () => {
  it("replaces every detection with its token", () => {
    const result = sanitizer.sanitize(
      "Ana (DNI 12345678Z, ana@example.com) llamó desde el 612345678.",
    );

    expect(result.sanitizedText).toBe(
      "Ana (DNI [DNI_1], [EMAIL_1]) llamó desde el [PHONE_1].",
    );
    expect(result.detections.map((detection) => detection.type)).toEqual([
      "DNI",
      "EMAIL",
      "PHONE",
    ]);
    expect(result.entries).toEqual([
      { token: "[DNI_1]", type: "DNI", original: "12345678Z" },
      { token: "[EMAIL_1]", type: "EMAIL", original: "ana@example.com" },
      { token: "[PHONE_1]", type: "PHONE", original: "612345678" },
    ]);
  });

  it("reuses the token of a repeated value, within and across texts", () => {
    const first = sanitizer.sanitize(
      "12345678Z y 87654321X, otra vez 12345678Z",
    );
    const second = sanitizer.sanitize("Sobre 87654321X: nada nuevo.");

    expect(first.sanitizedText).toBe("[DNI_1] y [DNI_2], otra vez [DNI_1]");
    expect(first.detections).toHaveLength(3);
    expect(first.entries).toHaveLength(2);
    expect(second.sanitizedText).toBe("Sobre [DNI_2]: nada nuevo.");
  });

  it("returns text without personal data unchanged", () => {
    const text = "Nada que ocultar aquí.\nNi aquí.";

    expect(sanitizer.sanitize(text)).toEqual({
      sanitizedText: text,
      detections: [],
      entries: [],
    });
  });

  it("leaves tokens from an earlier pass untouched", () => {
    const once = sanitizer.sanitize("DNI 12345678Z").sanitizedText;

    expect(sanitizer.sanitize(once).sanitizedText).toBe(once);
  });
});

describe("Sanitizer terms", () => {
  it("hides the names the user lists and restores them", () => {
    sanitizer.setTerms(["Ana García", "ACME S.L."]);
    const text =
      "Ana García (ACME S.L.) escribió a ana@example.com; ana garcía firmó.";

    const result = sanitizer.sanitize(text);

    expect(result.sanitizedText).toBe(
      "[TERM_1] ([TERM_2]) escribió a [EMAIL_1]; [TERM_3] firmó.",
    );
    expect(sanitizer.restore(result.sanitizedText).restoredText).toBe(text);
  });

  it("gives each spelling its own token so the text restores exactly", () => {
    sanitizer.setTerms(["Ana"]);

    const { sanitizedText } = sanitizer.sanitize("Ana y ANA");

    expect(sanitizedText).toBe("[TERM_1] y [TERM_2]");
  });

  it("stops hiding a term once it is removed from the list", () => {
    sanitizer.setTerms(["Ana"]);
    sanitizer.setTerms([]);

    expect(sanitizer.sanitize("Ana").sanitizedText).toBe("Ana");
  });

  it("exposes the characters its terms use", () => {
    sanitizer.setTerms(["Smith, John"]);

    expect(sanitizer.termCharacters).toContain(",");
    expect(sanitizer.termCharacters).toContain("S");
  });

  it("hides payment cards", () => {
    expect(
      sanitizer.sanitize("Tarjeta 4111 1111 1111 1111.").sanitizedText,
    ).toBe("Tarjeta [CREDIT_CARD_1].");
    expect(sanitizer.restore("[CREDIT_CARD_1]").restoredText).toBe(
      "4111 1111 1111 1111",
    );
  });
});

describe("Sanitizer.restore", () => {
  it.each([
    "Ana (DNI 12345678Z, ana@example.com) llamó desde el +34 612 345 678.",
    "IBAN ES91 2100 0418 4502 0005 1332; CIF B-12345674; NIE x1234567l",
    'id;dni;email\n1;"12345678Z";ana@example.com\n2;87654321X;luis@example.org\n',
    "12345678Z12345678Z no es un DNI, 12345678Z sí.",
    "",
  ])("round-trips %j back to the exact source", (text) => {
    const { sanitizedText } = sanitizer.sanitize(text);

    expect(sanitizer.restore(sanitizedText).restoredText).toBe(text);
  });

  it("restores tokens inside text rewritten by the model", () => {
    sanitizer.sanitize("Ana: 12345678Z, ana@example.com");

    const result = sanitizer.restore(
      "Estimada clienta con documento [DNI_1]: le escribiremos a [EMAIL_1]. Ref: [DNI_1].",
    );

    expect(result.restoredText).toBe(
      "Estimada clienta con documento 12345678Z: le escribiremos a ana@example.com. Ref: 12345678Z.",
    );
    expect(result.restoredCount).toBe(3);
    expect(result.unresolvedTokens).toEqual([]);
  });

  it("understands tokens the model escaped as Markdown or lowercased", () => {
    sanitizer.sanitize("12345678Z");

    expect(sanitizer.restore("\\[DNI\\_1\\] / [dni_1]").restoredText).toBe(
      "12345678Z / 12345678Z",
    );
  });

  it("leaves unknown tokens in place and reports them once", () => {
    sanitizer.sanitize("12345678Z");

    const result = sanitizer.restore("[DNI_1], [DNI_7], [IBAN_1] y [DNI_7]");

    expect(result.restoredText).toBe("12345678Z, [DNI_7], [IBAN_1] y [DNI_7]");
    expect(result.restoredCount).toBe(1);
    expect(result.unresolvedTokens).toEqual(["[DNI_7]", "[IBAN_1]"]);
  });

  it("ignores brackets that are not tokens", () => {
    const text = "Ver [1], [nota_2] y lista[DNI]";

    expect(sanitizer.restore(text)).toEqual({
      restoredText: text,
      restoredCount: 0,
      unresolvedTokens: [],
    });
  });

  it("does not expand a restored value that itself looks like a token", () => {
    sanitizer.sanitize("12345678Z");

    // Each token is replaced exactly once; the output is not scanned again.
    expect(sanitizer.restore("[DNI_1][DNI_1]").restoredText).toBe(
      "12345678Z12345678Z",
    );
  });
});
