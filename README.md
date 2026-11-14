# PromptShield

Browser-first tool that strips personal data (DNI, NIE, CIF, IBAN, phone numbers) from text and spreadsheets before they are sent to an LLM, and restores the original values afterwards. All processing happens client-side; the app is a static export with no backend.

## Stack

- Next.js (App Router) with `output: "export"`
- Tailwind CSS v4, shadcn/ui (Base UI), Motion
- Papa Parse and SheetJS for CSV/XLSX
- Vitest, ESLint, Prettier

## Scripts

| Command             | Description                           |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Start the dev server                  |
| `npm run build`     | Build the static site into `out/`     |
| `npm run lint`      | Run ESLint                            |
| `npm run typecheck` | Run the TypeScript compiler (no emit) |
| `npm run test`      | Run unit tests                        |
| `npm run format`    | Format the codebase with Prettier     |

## Structure

- `src/app` - routes, layout and design tokens (`globals.css`)
- `src/components` - product UI; shadcn primitives live in `src/components/ui`
- `src/core-engine` - framework-agnostic sanitization engine
  - `detectors` - combines the pattern finders into typed, non-overlapping detections
  - `vault` - token dictionary, AES-GCM encryption, IndexedDB storage and session handling
  - `files` - streaming text/CSV processing and spreadsheet processing
  - `workers` - the sanitizer Web Worker, its message protocol and the page-side client
  - `sanitizer.ts` - replaces detections with tokens and tokens with originals
- `src/lib/regex-utils` - patterns and checksum validators, grouped by country

## Engine

The UI talks to the engine only through `SanitizerClient` (`src/core-engine/workers/client.ts`), which runs everything in a Web Worker:

```ts
const client = await SanitizerClient.create();
const { sanitizedText } = await client.sanitizeText("DNI 12345678Z"); // "DNI [DNI_1]"
const { restoredText } = await client.restoreText("Sobre [DNI_1]..."); // original back
const result = await client.processFile(file, "sanitize", onProgress); // .csv, .xlsx, ...
```

Detected today: DNI, NIE and CIF (control character verified), Spanish IBAN (mod-97), Spanish mobile numbers and email addresses. Names and postal addresses are not detected.

The vault is volatile by design. Its AES-GCM key is non-extractable and lives only in the page's memory; IndexedDB only ever holds ciphertext. Reloading or closing the tab discards the key, so tokens issued before can no longer be restored, and the leftover ciphertext is deleted the next time the app opens.

Files: text formats (`csv`, `tsv`, `txt`, `json`, ...) are streamed without being parsed, so everything except the replaced values is preserved; UTF-8, UTF-16 and Windows-1252 input is accepted and output is UTF-8. Spreadsheets (`xlsx`, `xls`) are loaded in memory and rewritten as `.xlsx` with values, formulas and sheets, but without styling, charts or macros.
