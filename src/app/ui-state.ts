export const READER_WIDTH = {
  default: 420,
  minimum: 320,
  maximum: 720,
  minimumGraph: 420,
} as const;

export const MOBILE_READER_SNAPS = [35, 65, 92] as const;

export interface ReaderWidthBounds {
  minimum: number;
  maximum: number;
}

export function readerWidthBounds(viewportWidth: number): ReaderWidthBounds {
  const available = Math.max(
    READER_WIDTH.minimum,
    Math.floor(viewportWidth) - READER_WIDTH.minimumGraph,
  );
  return {
    minimum: READER_WIDTH.minimum,
    maximum: Math.max(READER_WIDTH.minimum, Math.min(READER_WIDTH.maximum, available)),
  };
}

export function clampReaderWidth(width: number, viewportWidth: number): number {
  const bounds = readerWidthBounds(viewportWidth);
  const safeWidth = Number.isFinite(width) ? width : READER_WIDTH.default;
  return Math.round(Math.max(bounds.minimum, Math.min(bounds.maximum, safeWidth)));
}

export function parseReaderWidth(value: string | null, viewportWidth: number): number {
  if (!value) return clampReaderWidth(READER_WIDTH.default, viewportWidth);
  const parsed = Number.parseFloat(value);
  return clampReaderWidth(parsed, viewportWidth);
}

export function nearestMobileReaderSnap(height: number): (typeof MOBILE_READER_SNAPS)[number] {
  return MOBILE_READER_SNAPS.reduce((nearest, candidate) =>
    Math.abs(candidate - height) < Math.abs(nearest - height) ? candidate : nearest,
  );
}

export function toggleDirectionalFocus(
  current: { focus: boolean; direction: "in" | "out" | "both" },
  direction: "in" | "out",
): { focus: boolean; direction: "in" | "out" | "both" } {
  if (current.focus && current.direction === direction) {
    return { focus: false, direction: "both" };
  }
  return { focus: true, direction };
}
