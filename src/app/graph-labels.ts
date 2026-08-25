export interface LabelZoomStyle {
  visible: boolean;
  size: number;
  opacity: number;
}

export const LABEL_ZOOM_SETTINGS = {
  baseSize: 12,
  maximumSize: 13,
  minimumSize: 6.5,
  fullOpacityRatio: 0.7,
  hiddenRatio: 3,
} as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

export function labelZoomStyleForRatio(ratio: number): LabelZoomStyle {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const size = clamp(
    LABEL_ZOOM_SETTINGS.baseSize / Math.sqrt(safeRatio),
    LABEL_ZOOM_SETTINGS.minimumSize,
    LABEL_ZOOM_SETTINGS.maximumSize,
  );
  const fadeProgress = clamp(
    (LABEL_ZOOM_SETTINGS.hiddenRatio - safeRatio) /
      (LABEL_ZOOM_SETTINGS.hiddenRatio - LABEL_ZOOM_SETTINGS.fullOpacityRatio),
    0,
    1,
  );
  const opacity = fadeProgress * fadeProgress * (3 - 2 * fadeProgress);

  return {
    visible: opacity > 0,
    size: round(size),
    opacity: round(opacity),
  };
}

export function labelOpacityForHover(
  node: string,
  opacity: number,
  hovered: string | undefined,
  hoverNeighbors: ReadonlySet<string>,
): number {
  if (!hovered || node === hovered || hoverNeighbors.has(node)) return opacity;
  return 0;
}
