export const POINTER_DRAG_THRESHOLDS = {
  mouse: 4,
  touch: 10,
} as const;

export const ADAPTIVE_MOTION_SETTINGS = {
  warmupFrames: 6,
  windowFrames: 24,
  slowFrameMs: 34,
  slowFramesToLimit: 18,
  stalledFrameMs: 80,
  consecutiveStalledFramesToLimit: 6,
} as const;

export const TOUCH_UNRELATED_NODE_OPACITY = 0.62;
export const DESKTOP_UNRELATED_NODE_OPACITY = 0.62;
export const DEFAULT_EDGE_TONE = 0.24;
export const DESKTOP_HOVER_UNRELATED_NODE_OPACITY = DEFAULT_EDGE_TONE;

export interface GraphEmphasisState {
  root?: string;
  neighbors: ReadonlySet<string>;
}

export interface SelectionViewportOptions {
  width: number;
  height: number;
  readerOpen: boolean;
  readerCompact: boolean;
  desktopReaderWidth: number;
  mobileReaderHeight: number;
}

export function dragThreshold(touch: boolean): number {
  return touch ? POINTER_DRAG_THRESHOLDS.touch : POINTER_DRAG_THRESHOLDS.mouse;
}

export function unrelatedNodeOpacity(
  searchActive: boolean,
  touchSelectionActive: boolean,
  desktopHoverStrength = 0,
): number {
  if (searchActive) return 0x22 / 0xff;
  if (touchSelectionActive) return TOUCH_UNRELATED_NODE_OPACITY;
  const hoverStrength = Math.max(0, Math.min(1, desktopHoverStrength));
  return (
    DESKTOP_UNRELATED_NODE_OPACITY +
    (DESKTOP_HOVER_UNRELATED_NODE_OPACITY - DESKTOP_UNRELATED_NODE_OPACITY) * hoverStrength
  );
}

export function effectiveLabelRelevance(
  emphasisRelevance: number,
  focusActive: boolean,
  hoverActive: boolean,
): number {
  return focusActive && !hoverActive ? 1 : emphasisRelevance;
}

export function effectiveGraphEmphasis(
  hover: GraphEmphasisState,
  selected: GraphEmphasisState,
): GraphEmphasisState {
  if (hover.root) return hover;
  if (selected.root) return selected;
  return { neighbors: new Set<string>() };
}

export function sameGraphEmphasis(left: GraphEmphasisState, right: GraphEmphasisState): boolean {
  if (left.root !== right.root || left.neighbors.size !== right.neighbors.size) return false;
  for (const neighbor of left.neighbors) {
    if (!right.neighbors.has(neighbor)) return false;
  }
  return true;
}

export function selectionViewportPoint(
  options: SelectionViewportOptions,
): { x: number; y: number } | undefined {
  const { width, height, readerOpen, readerCompact, desktopReaderWidth, mobileReaderHeight } =
    options;
  if (!readerOpen) return { x: width / 2, y: height / 2 };
  if (!readerCompact) {
    const visibleWidth = width - Math.max(0, desktopReaderWidth);
    if (visibleWidth < 120) return undefined;
    return { x: visibleWidth / 2, y: height / 2 };
  }
  const visibleHeight = height * (1 - mobileReaderHeight / 100);
  if (visibleHeight < 120) return undefined;
  return { x: width / 2, y: visibleHeight / 2 };
}

export function shouldLimitAdaptiveMotion(frameDurations: readonly number[]): boolean {
  const settings = ADAPTIVE_MOTION_SETTINGS;
  const stalled = frameDurations.slice(-settings.consecutiveStalledFramesToLimit);
  if (
    stalled.length === settings.consecutiveStalledFramesToLimit &&
    stalled.every((duration) => duration > settings.stalledFrameMs)
  ) {
    return true;
  }
  const window = frameDurations.slice(-settings.windowFrames);
  return (
    window.length === settings.windowFrames &&
    window.filter((duration) => duration > settings.slowFrameMs).length >=
      settings.slowFramesToLimit
  );
}
