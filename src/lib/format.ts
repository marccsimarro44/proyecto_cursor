import type { DetectionCounts, PiiEntityType } from "@/core-engine/types";

/** Spanish label of each entity type, as shown to the user. */
export const ENTITY_LABELS: Record<PiiEntityType, string> = {
  DNI: "DNI",
  NIE: "NIE",
  CIF: "CIF",
  IBAN: "IBAN",
  PHONE: "Teléfono",
  EMAIL: "Email",
  CREDIT_CARD: "Tarjeta",
  TERM: "Término propio",
};

/** `1536` -> `1,5 KB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("es-ES", { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/** Counts per entity type from a list of detections, in a stable order. */
export function countByType(
  detections: readonly { type: PiiEntityType }[],
): DetectionCounts {
  const counts: DetectionCounts = {};
  for (const { type } of detections) counts[type] = (counts[type] ?? 0) + 1;
  return counts;
}

/** `{ DNI: 2, EMAIL: 1 }` -> `[["DNI", 2], ["EMAIL", 1]]`, biggest first. */
export function sortedCounts(
  counts: DetectionCounts,
): [PiiEntityType, number][] {
  return (Object.entries(counts) as [PiiEntityType, number][]).sort(
    (a, b) => b[1] - a[1],
  );
}
