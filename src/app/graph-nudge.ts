export type CollisionBox = [[number, number], [number, number]];
export type NudgeStatus = "idle" | "active" | "disabled";

export const NUDGE_SETTINGS = {
  alpha: 0.22,
  alphaTarget: 0.08,
  idleDelay: 120,
  labelGap: 5,
  labelHeight: 12,
  labelLimit: 12,
  labelMaxWidth: 240,
  maxDisplacementPixels: 48,
  nodeMargin: 4,
  zoomEpsilon: 0.002,
} as const;

export interface CollisionBoxInput {
  radiusPixels: number;
  unitsPerPixel: number;
  labelWidthPixels?: number;
  labelHeightPixels?: number;
}

export interface LabelLod {
  density: number;
  renderedSizeThreshold: number;
}

export function collisionBoxForNode({
  radiusPixels,
  unitsPerPixel,
  labelWidthPixels,
  labelHeightPixels = NUDGE_SETTINGS.labelHeight,
}: CollisionBoxInput): CollisionBox {
  const scale = Number.isFinite(unitsPerPixel) && unitsPerPixel > 0 ? unitsPerPixel : 1;
  const extent = (Math.max(0, radiusPixels) + NUDGE_SETTINGS.nodeMargin) * scale;
  const labelWidth = Math.max(0, labelWidthPixels ?? 0);
  if (labelWidth === 0)
    return [
      [-extent, -extent],
      [extent, extent],
    ];

  const labelRight =
    (Math.max(0, radiusPixels) +
      NUDGE_SETTINGS.labelGap +
      Math.min(NUDGE_SETTINGS.labelMaxWidth, labelWidth) +
      NUDGE_SETTINGS.nodeMargin) *
    scale;
  const verticalExtent = Math.max(
    extent,
    (Math.max(0, labelHeightPixels) / 2 + NUDGE_SETTINGS.nodeMargin) * scale,
  );
  return [
    [-extent, -verticalExtent],
    [labelRight, verticalExtent],
  ];
}

export function graphUnitsPerPixel(
  viewportToGraph: (point: { x: number; y: number }) => { x: number; y: number },
): number {
  const origin = viewportToGraph({ x: 0, y: 0 });
  const unit = viewportToGraph({ x: 1, y: 0 });
  const distance = Math.hypot(unit.x - origin.x, unit.y - origin.y);
  return Number.isFinite(distance) && distance > 0 ? distance : 1;
}

export function labelLodForRatio(ratio: number): LabelLod {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return {
    density: Math.max(0.015, 0.08 / safeRatio ** 1.5),
    renderedSizeThreshold: Math.max(6, Math.min(12, 8 + 2 * Math.log2(safeRatio))),
  };
}

export function selectPriorityLabels(
  candidates: Iterable<string>,
  degreeOf: (id: string) => number,
  limit: number = NUDGE_SETTINGS.labelLimit,
): Set<string> {
  return new Set(
    [...candidates]
      .sort((left, right) => {
        const degreeDifference = degreeOf(right) - degreeOf(left);
        return degreeDifference || left.localeCompare(right);
      })
      .slice(0, Math.max(0, limit)),
  );
}

export class LabelWidthCache {
  private readonly widths = new Map<string, number>();
  private readonly measure: (label: string) => number;

  constructor(measure: (label: string) => number) {
    this.measure = measure;
  }

  get(label: string): number {
    const cached = this.widths.get(label);
    if (cached !== undefined) return cached;
    const measured = Math.max(0, this.measure(label));
    this.widths.set(label, measured);
    return measured;
  }

  get size(): number {
    return this.widths.size;
  }

  clear(): void {
    this.widths.clear();
  }
}
