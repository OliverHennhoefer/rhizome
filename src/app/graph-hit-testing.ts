export const MINIMUM_NODE_HIT_RADIUS = 12;

export interface NodeHitArea {
  id: string;
  x: number;
  y: number;
  visibleRadius: number;
  zIndex?: number;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Finds the nearest node center inside a node's visible or minimum hit radius.
 * Nearest-center selection keeps overlapping invisible targets deterministic.
 */
export function closestNodeAtPoint(
  point: Point,
  nodes: Iterable<NodeHitArea>,
  minimumRadius = MINIMUM_NODE_HIT_RADIUS,
): string | undefined {
  let closest: NodeHitArea | undefined;
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const node of nodes) {
    const radius = Math.max(minimumRadius, node.visibleRadius);
    const distanceSquared = (point.x - node.x) ** 2 + (point.y - node.y) ** 2;
    if (distanceSquared > radius ** 2) continue;

    const isCloser = distanceSquared < closestDistanceSquared;
    const sameDistance = distanceSquared === closestDistanceSquared;
    const isHigher = (node.zIndex ?? 0) > (closest?.zIndex ?? 0);
    const isStableTieBreak =
      (node.zIndex ?? 0) === (closest?.zIndex ?? 0) && node.id < (closest?.id ?? "");
    if (isCloser || (sameDistance && (isHigher || isStableTieBreak))) {
      closest = node;
      closestDistanceSquared = distanceSquared;
    }
  }

  return closest?.id;
}
