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
- `src/components` - product UI; `app/` holds the tool (text, files, terms, vault), shadcn primitives live in `ui/`
- `src/core-engine` - framework-agnostic sanitization engine
  - `detectors` - combines the pattern finders into typed, non-overlapping detections
  - `vault` - token dictionary, AES-GCM encryption, IndexedDB storage and session handling
  - `files` - streaming text/CSV processing and spreadsheet processing
  - `workers` - the sanitizer Web Worker, its message protocol and the page-side client
  - `sanitizer.ts` - replaces detections with tokens and tokens with originals
- `src/lib/regex-utils` - patterns and checksum validators, grouped by country

## Deployment (Cloudflare Pages / any static host)

`npm run build` writes the site to `out/`. `public/_headers` is copied there and sets a Content-Security-Policy with `connect-src 'none'`, so the browser itself refuses any network request made by the page, which is what makes the "nothing leaves your browser" claim verifiable. Cloudflare Pages applies that file natively; on another host, replicate those headers. If you ever add analytics or any third-party script you must loosen that policy, and the privacy copy on the page has to change with it.

**Public address.** Canonical links, the share image, `sitemap.xml` and `robots.txt` all read the site address from `src/lib/site.ts`. It defaults to the `pages.dev` address; when a custom domain replaces it, set `NEXT_PUBLIC_SITE_URL` in the Pages build settings (or change the default) and redeploy.

**Share image.** `public/og.png` and `src/app/apple-icon.png` are rendered from `design/og.html` and `design/apple-icon.html` with the Edge or Chrome already on the machine: `npm run brand:render`. Change the HTML, run the script, commit the PNGs.

## Engine

The UI talks to the engine only through `SanitizerClient` (`src/core-engine/workers/client.ts`), which runs everything in a Web Worker:

```ts
const client = await SanitizerClient.create();
const { sanitizedText } = await client.sanitizeText("DNI 12345678Z"); // "DNI [DNI_1]"
const { restoredText } = await client.restoreText("Sobre [DNI_1]..."); // original back
const result = await client.processFile(file, "sanitize", onProgress); // .csv, .xlsx, ...
```

Detected today: DNI, NIE and CIF (control character verified), Spanish IBAN (mod-97), Spanish mobile numbers, email addresses and payment cards (Luhn). Names and postal addresses are not detected automatically: the user lists names and companies as "terms" (`client.setTerms`), which are matched as whole words, ignoring case.

The vault is volatile by design. Its AES-GCM key is non-extractable and lives only in the page's memory; IndexedDB only ever holds ciphertext. Reloading or closing the tab discards the key, so tokens issued before can no longer be restored, and the leftover ciphertext is deleted the next time the app opens.

Files: text formats (`csv`, `tsv`, `txt`, `json`, ...) are streamed without being parsed, so everything except the replaced values is preserved; UTF-8, UTF-16 and Windows-1252 input is accepted and output is UTF-8. Spreadsheets (`xlsx`, `xls`) are loaded in memory and rewritten as `.xlsx` with values, formulas and sheets, but without styling, charts or macros.
