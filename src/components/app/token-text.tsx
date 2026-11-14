import { PII_ENTITY_TYPES, type PiiEntityType } from "@/core-engine/types";
import { entityStyle } from "@/lib/entity-style";

const TOKEN_SPLIT = new RegExp(
  `(\\[(?:${PII_ENTITY_TYPES.join("|")})_\\d+\\])`,
  "g",
);

/** Above this size the text is shown as plain text to keep the page fast. */
const HIGHLIGHT_LIMIT = 100_000;

/** `[DNI_12]` -> `DNI`. Only called on text matched by `TOKEN_SPLIT`. */
function typeOf(token: string): PiiEntityType {
  return token.slice(1, token.lastIndexOf("_")) as PiiEntityType;
}

/** Text in which every vault token is highlighted in the color of its type. */
export function TokenText({ text }: { text: string }) {
  if (text.length > HIGHLIGHT_LIMIT) return <>{text}</>;

  // Splitting on a capturing group puts the tokens at the odd indexes.
  return (
    <>
      {text.split(TOKEN_SPLIT).map((part, index) =>
        index % 2 === 1 ? (
          <mark
            key={index}
            style={entityStyle(typeOf(part))}
            className="tok animate-in fade-in zoom-in-95 rounded-md px-1.5 py-0.5 font-mono text-[0.85em] duration-300"
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
