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

export const HOVER_TRANSITION_DURATION_MS = 150;

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

export function hoverTransitionProgress(elapsed: number): number {
  const linear = clamp(elapsed / HOVER_TRANSITION_DURATION_MS, 0, 1);
  return 1 - (1 - linear) ** 3;
}

export function interpolateHoverValue(from: number, to: number, progress: number): number {
  return from + (to - from) * clamp(progress, 0, 1);
}

export function labelOpacityForHover(opacity: number, relevance: number): number {
  return opacity * clamp(relevance, 0, 1);
}
