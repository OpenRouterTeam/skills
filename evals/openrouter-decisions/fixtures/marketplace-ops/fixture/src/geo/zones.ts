export type Zone = "local" | "regional" | "national" | "remote";

const PREFIX_ZONES: [string, Zone][] = [
  ["941", "local"],
  ["940", "local"],
  ["94", "regional"],
  ["95", "regional"],
  ["9", "national"],
  ["8", "national"],
  ["99", "remote"],
  ["96", "remote"],
];

export function zoneForPostalCode(postalCode: string): Zone {
  const code = postalCode.trim();
  let best: [string, Zone] | null = null;
  for (const entry of PREFIX_ZONES) {
    if (code.startsWith(entry[0]) && (best === null || entry[0].length > best[0].length)) best = entry;
  }
  return best === null ? "remote" : best[1];
}
