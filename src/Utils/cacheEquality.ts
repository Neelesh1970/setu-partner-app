/**
 * Shallow JSON equality for API payloads — avoids redundant Redux updates on background refresh.
 */
export function isJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return a === b;
  }
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
