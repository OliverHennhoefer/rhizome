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

export const TOUCH_UNRELATED_NODE_OPACITY = 0.42;

export interface GraphEmphasisState {
  root?: string;
  neighbors: ReadonlySet<string>;
}

export interface SelectionViewportOptions {
  width: number;
  height: number;
  touchMode: boolean;
  readerOpen: boolean;
  readerCompact: boolean;
  mobileReaderHeight: number;
}

export function dragThreshold(touch: boolean): number {
  return touch ? POINTER_DRAG_THRESHOLDS.touch : POINTER_DRAG_THRESHOLDS.mouse;
}

export function unrelatedNodeOpacity(searchActive: boolean, touchSelectionActive: boolean): number {
  if (searchActive) return 0x22 / 0xff;
  return touchSelectionActive ? TOUCH_UNRELATED_NODE_OPACITY : 0x2e / 0xff;
}

export function effectiveLabelRelevance(
  emphasisRelevance: number,
  touchMode: boolean,
  focusActive: boolean,
  hoverActive: boolean,
): number {
  return touchMode && focusActive && !hoverActive ? 1 : emphasisRelevance;
}

export function effectiveGraphEmphasis(
  hover: GraphEmphasisState,
  selected: GraphEmphasisState,
  touchMode: boolean,
): GraphEmphasisState {
  if (hover.root) return hover;
  if (touchMode && selected.root) return selected;
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
  const { width, height, touchMode, readerOpen, readerCompact, mobileReaderHeight } = options;
  if (!touchMode || !readerOpen || !readerCompact) {
    return { x: width / 2, y: height / 2 };
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
