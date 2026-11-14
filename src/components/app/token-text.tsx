import { PII_ENTITY_TYPES } from "@/core-engine/types";

const TOKEN_SPLIT = new RegExp(
  `(\\[(?:${PII_ENTITY_TYPES.join("|")})_\\d+\\])`,
  "g",
);

/** Above this size the text is shown as plain text to keep the page fast. */
const HIGHLIGHT_LIMIT = 100_000;

/** Text in which every vault token is highlighted. */
export function TokenText({ text }: { text: string }) {
  if (text.length > HIGHLIGHT_LIMIT) return <>{text}</>;

  // Splitting on a capturing group puts the tokens at the odd indexes.
  return (
    <>
      {text.split(TOKEN_SPLIT).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            className="bg-primary/15 text-primary rounded px-1 py-0.5 font-mono text-[0.85em]"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}
