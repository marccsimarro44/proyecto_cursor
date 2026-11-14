import type { CSSProperties } from "react";
import type { PiiEntityType } from "@/core-engine/types";

/**
 * OKLCH hue of each kind of personal data. The same color follows a value
 * from its badge to its highlighted marker, so the user learns the code once.
 */
export const ENTITY_HUE: Record<PiiEntityType, number> = {
  DNI: 155,
  NIE: 178,
  CIF: 235,
  IBAN: 275,
  PHONE: 330,
  EMAIL: 205,
  CREDIT_CARD: 22,
  TERM: 78,
};

/** Inline style that feeds the `.tok` and `.tok-dot` classes. */
export function entityStyle(type: PiiEntityType): CSSProperties {
  return { "--hue": ENTITY_HUE[type] } as CSSProperties;
}
