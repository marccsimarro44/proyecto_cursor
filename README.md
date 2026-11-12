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
- `src/core-engine` - framework-agnostic sanitization engine (`detectors`, `vault`, `workers`)
- `src/lib/regex-utils` - patterns and checksum validators, grouped by country
