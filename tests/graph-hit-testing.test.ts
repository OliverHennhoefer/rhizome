import { describe, expect, it } from "vitest";
import {
  closestNodeAtPoint,
  MINIMUM_NODE_HIT_RADIUS,
  type NodeHitArea,
} from "../src/app/graph-hit-testing";

const node = (overrides: Partial<NodeHitArea> = {}): NodeHitArea => ({
  id: "node",
  x: 50,
  y: 50,
  visibleRadius: 4,
  ...overrides,
});

describe("graph node hit testing", () => {
  it("gives small nodes the same minimum click radius", () => {
    const point = { x: 50 + MINIMUM_NODE_HIT_RADIUS - 0.1, y: 50 };

    expect(closestNodeAtPoint(point, [node({ visibleRadius: 2 })])).toBe("node");
    expect(closestNodeAtPoint(point, [node({ visibleRadius: 8 })])).toBe("node");
  });

  it("does not shrink the clickable area of a visibly larger node", () => {
    expect(closestNodeAtPoint({ x: 65, y: 50 }, [node({ visibleRadius: 16 })])).toBe("node");
    expect(closestNodeAtPoint({ x: 67, y: 50 }, [node({ visibleRadius: 16 })])).toBeUndefined();
  });

  it("chooses the closest center when hit areas overlap", () => {
    const nodes = [node({ id: "left", x: 45 }), node({ id: "right", x: 55 })];

    expect(closestNodeAtPoint({ x: 48, y: 50 }, nodes)).toBe("left");
    expect(closestNodeAtPoint({ x: 53, y: 50 }, nodes)).toBe("right");
  });

  it("uses z-index and id to resolve exact distance ties deterministically", () => {
    const nodes = [node({ id: "low", x: 45, zIndex: 1 }), node({ id: "high", x: 55, zIndex: 2 })];
    expect(closestNodeAtPoint({ x: 50, y: 50 }, nodes)).toBe("high");

    expect(
      closestNodeAtPoint({ x: 50, y: 50 }, [
        node({ id: "zebra", x: 45 }),
        node({ id: "alpha", x: 55 }),
      ]),
    ).toBe("alpha");
  });
});
