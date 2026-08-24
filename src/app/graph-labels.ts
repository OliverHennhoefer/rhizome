export interface LabelLod {
  density: number;
  renderedSizeThreshold: number;
}

export const LABEL_SETTINGS = {
  focusedNeighborLimit: 6,
  focusedProjectionLimit: 48,
  focusedZoomRatio: 1.25,
} as const;

export function labelLodForRatio(ratio: number): LabelLod {
  const safeRatio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return {
    density: Math.max(0.008, Math.min(0.08, 0.045 / safeRatio ** 1.7)),
    renderedSizeThreshold: Math.max(5, Math.min(10, 5.5 + 2 * Math.log2(safeRatio))),
  };
}

export function shouldForceNeighborLabels(
  focused: boolean,
  projectionOrder: number,
  cameraRatio: number,
): boolean {
  return (
    focused &&
    projectionOrder <= LABEL_SETTINGS.focusedProjectionLimit &&
    cameraRatio <= LABEL_SETTINGS.focusedZoomRatio
  );
}

export function selectPriorityLabels(
  candidates: Iterable<string>,
  degreeOf: (id: string) => number,
  limit: number = LABEL_SETTINGS.focusedNeighborLimit,
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
