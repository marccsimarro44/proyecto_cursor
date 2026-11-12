/**
 * Core contracts of the PromptShield sanitization engine.
 *
 * Everything in `core-engine` is framework-agnostic and runs both on the main
 * thread and inside Web Workers, so these types must stay free of DOM and
 * React dependencies and remain structured-clone safe.
 */

/** Every category of personal data the engine can detect and tokenize. */
export const PII_ENTITY_TYPES = [
  "DNI",
  "NIE",
  "CIF",
  "IBAN",
  "PHONE",
  "EMAIL",
  "CREDIT_CARD",
] as const;

export type PiiEntityType = (typeof PII_ENTITY_TYPES)[number];

/** A single occurrence of personal data found in a source text. */
export interface Detection {
  type: PiiEntityType;
  /** Exact substring matched in the source text. */
  value: string;
  /** Inclusive start offset in the source text, in UTF-16 code units. */
  start: number;
  /** Exclusive end offset in the source text, in UTF-16 code units. */
  end: number;
}

/**
 * Placeholder that replaces a detected value, e.g. `[DNI_1]`.
 * The numeric suffix is unique per entity type within a session.
 */
export type VaultToken = `[${PiiEntityType}_${number}]`;

/**
 * One reversible mapping between a token and the original value.
 * The same original value always maps to the same token within a session, so
 * the sanitized text keeps its referential meaning for the LLM.
 */
export interface VaultEntry {
  token: VaultToken;
  type: PiiEntityType;
  original: string;
}

/** Outcome of sanitizing one text. */
export interface SanitizeResult {
  /** Source text with every detection replaced by its token. */
  sanitizedText: string;
  /** Detections ordered by `start`, non-overlapping. */
  detections: Detection[];
  /** Vault entries needed to restore `sanitizedText` to the source text. */
  entries: VaultEntry[];
}
