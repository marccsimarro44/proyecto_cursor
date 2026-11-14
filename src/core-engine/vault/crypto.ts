import type { VaultEntry } from "../types";

/**
 * A batch of vault entries as it is written to storage. Structured-clone
 * safe.
 */
export interface EncryptedRecord {
  /** Random 96-bit nonce, unique per record. */
  iv: Uint8Array<ArrayBuffer>;
  /** AES-GCM ciphertext followed by its authentication tag. */
  data: ArrayBuffer;
}

const ALGORITHM = "AES-GCM";
const IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Creates the AES-GCM 256 key of a vault session.
 *
 * The key is non-extractable: scripts can use it to encrypt and decrypt but
 * can never read its bytes, and it is never written to storage. Once the
 * page that holds it goes away, everything encrypted with it is unreadable.
 */
export function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: ALGORITHM, length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts a batch of entries into one record. `context` (the storage key
 * of the record) is authenticated but not encrypted, so a record copied
 * under another storage key fails to decrypt.
 */
export async function encryptEntries(
  key: CryptoKey,
  entries: VaultEntry[],
  context: string,
): Promise<EncryptedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const data = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, additionalData: encoder.encode(context) },
    key,
    encoder.encode(JSON.stringify(entries)),
  );
  return { iv, data };
}

/**
 * Decrypts one record. Rejects if the key or `context` differ from the ones
 * used to encrypt it, or if the record was modified.
 */
export async function decryptEntries(
  key: CryptoKey,
  record: EncryptedRecord,
  context: string,
): Promise<VaultEntry[]> {
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: record.iv, additionalData: encoder.encode(context) },
    key,
    record.data,
  );
  return JSON.parse(decoder.decode(plaintext)) as VaultEntry[];
}
