/** Locale-independent ordering for artifacts, cursors and ranking ties. */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
