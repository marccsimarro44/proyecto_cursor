import { detectPii } from "./detectors/detect";
import { normalizeTerms } from "./detectors/terms";
import {
  PII_ENTITY_TYPES,
  type RestoreResult,
  type SanitizeResult,
  type VaultEntry,
  type VaultToken,
} from "./types";
import type { Vault } from "./vault/vault";

/**
 * A token as it may come back from an LLM: `[DNI_1]`, lowercased
 * (`[dni_1]`) or with Markdown escapes (`\[DNI\_1\]`).
 */
const TOKEN_PATTERN = new RegExp(
  `\\\\?\\[(${PII_ENTITY_TYPES.join("|")})\\\\?_(\\d+)\\\\?\\]`,
  "gi",
);

/** Punctuation inside names: "Pérez & Asociados, S.L.", "O'Donnell". */
const NAME_CHARACTERS = ",&'’·ª";

/**
 * Replaces personal data with vault tokens and back.
 *
 * Both operations are synchronous: they only touch the in-memory side of
 * the vault. Persisting new entries (`vault.flush()`) is up to the caller,
 * so a large job can batch many texts per write.
 */
export class Sanitizer {
  private terms: readonly string[] = [];
  private names = false;
  private ignored: readonly string[] = [];

  constructor(private readonly vault: Vault) {}

  /**
   * Sets the names and phrases to hide in addition to the built-in
   * detectors. Replaces the previous list; applies to later calls only.
   */
  setTerms(terms: readonly string[]): void {
    this.terms = normalizeTerms(terms);
  }

  /**
   * Turns the guessing of people's and companies' names on or off.
   * `ignored` lists names the user marked as not personal.
   */
  setNameDetection(enabled: boolean, ignored: readonly string[] = []): void {
    this.names = enabled;
    this.ignored = ignored;
  }

  /**
   * Every distinct character a value can contain beyond letters, digits
   * and the separators of the built-in formats.
   */
  get termCharacters(): string {
    const extra = this.names ? NAME_CHARACTERS : "";
    return [...new Set(this.terms.join("") + extra)].join("");
  }

  /** Replaces every piece of personal data in `text` with its token. */
  sanitize(text: string): SanitizeResult {
    const detections = detectPii(text, {
      terms: this.terms,
      names: this.names,
      ignored: this.ignored,
    });
    const entries = new Map<VaultToken, VaultEntry>();

    let sanitizedText = "";
    let cursor = 0;
    for (const { type, value, start, end } of detections) {
      const token = this.vault.tokenize(type, value);
      entries.set(token, { token, type, original: value });
      sanitizedText += text.slice(cursor, start) + token;
      cursor = end;
    }
    sanitizedText += text.slice(cursor);

    return { sanitizedText, detections, entries: [...entries.values()] };
  }

  /**
   * Replaces every token the vault knows with its original value. Tokens it
   * does not know are left as they are and listed in `unresolvedTokens`.
   */
  restore(text: string): RestoreResult {
    let restoredCount = 0;
    const unresolved = new Set<string>();

    const restoredText = text.replace(
      TOKEN_PATTERN,
      (match: string, type: string, number: string) => {
        const token = `[${type.toUpperCase()}_${Number(number)}]` as VaultToken;
        const original = this.vault.resolve(token);
        if (original === undefined) {
          unresolved.add(token);
          return match;
        }
        restoredCount++;
        return original;
      },
    );

    return { restoredText, restoredCount, unresolvedTokens: [...unresolved] };
  }
}
