import { describe, expect, it } from "vitest";
import { createGraph, type GraphProjection, type RhizomeGraph } from "../src/app/graph";
import {
  buildPhysicalLinks,
  createDisplayGraph,
  GraphMotionController,
  GraphPositionStore,
  isMotionEligible,
  ProjectionInvariantError,
  physicalLinkStrength,
} from "../src/app/graph-layout";
import {
  collisionBoxForNode,
  graphUnitsPerPixel,
  LabelWidthCache,
  labelLodForRatio,
  selectPriorityLabels,
} from "../src/app/graph-nudge";
import type { GraphManifest } from "../src/shared/contracts";

const manifest: GraphManifest = {
  schemaVersion: 2,
  contentHash: "layout-fixture",
  config: { site: { title: "Layout" }, relations: {} },
  nodes: [
    {
      id: "a",
      kind: "note",
      title: "A",
      aliases: [],
      types: ["note"],
      tags: [],
      detailsRef: "a",
      x: 0,
      y: 0,
      community: 0,
      degree: 3,
    },
    {
      id: "b",
      kind: "note",
      title: "B",
      aliases: [],
      types: ["note"],
      tags: [],
      detailsRef: "b",
      x: 200,
      y: 0,
      community: 0,
      degree: 2,
    },
    {
      id: "c",
      kind: "note",
      title: "C",
      aliases: [],
      types: ["note"],
      tags: [],
      detailsRef: "c",
      x: 400,
      y: 0,
      community: 1,
      degree: 1,
    },
  ],
  edges: [
    { id: "ab-link", source: "a", target: "b", type: "link", directed: true, occurrences: 2 },
    {
      id: "ab-relation",
      source: "b",
      target: "a",
      type: "depends-on",
      directed: true,
      occurrences: 4,
    },
    { id: "bc", source: "b", target: "c", type: "link", directed: false, occurrences: 1 },
    { id: "aa", source: "a", target: "a", type: "link", directed: true, occurrences: 8 },
  ],
  facets: { tags: {}, types: {}, relations: {} },
  diagnostics: [],
};

function projection(nodes: string[], edges: string[]): GraphProjection {
  return { nodes: new Set(nodes), edges: new Set(edges) };
}

describe("display graph", () => {
  it("contains only the projection and preserves session positions", () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    positions.setCurrent("a", { x: 42, y: 24 });
    const display = createDisplayGraph(
      source,
      projection(["a", "b"], ["ab-link", "ab-relation", "aa"]),
      positions,
    );

    expect(display.nodes()).toEqual(["a", "b"]);
    expect(display.edges().sort()).toEqual(["aa", "ab-link", "ab-relation"]);
    expect(display.getNodeAttributes("a")).toMatchObject({ x: 42, y: 24 });
    expect(display.getNodeAttributes("b")).toMatchObject({ x: 200, y: 0 });

    const changed = createDisplayGraph(source, projection(["a", "c"], []), positions);
    expect(changed.nodes()).toEqual(["a", "c"]);
    expect(changed.getNodeAttributes("a")).toMatchObject({ x: 42, y: 24 });
  });

  it("preserves mixed edge direction, parallel edges, and self-loops", () => {
    const source = createGraph(manifest);
    const display = createDisplayGraph(
      source,
      projection(["a", "b", "c"], ["ab-link", "ab-relation", "bc", "aa"]),
      new GraphPositionStore(source),
    );
    expect(display.multi).toBe(true);
    expect(display.isDirected("ab-link")).toBe(true);
    expect(display.isDirected("ab-relation")).toBe(true);
    expect(display.isUndirected("bc")).toBe(true);
    expect(display.selfLoopCount).toBe(1);
  });

  it("fails when a projection references an unknown node", () => {
    const source = createGraph(manifest);
    expect(() =>
      createDisplayGraph(source, projection(["missing"], []), new GraphPositionStore(source)),
    ).toThrowError(ProjectionInvariantError);
    expect(() =>
      createDisplayGraph(source, projection(["missing"], []), new GraphPositionStore(source)),
    ).toThrow(/node "missing"/);
  });

  it("fails when a projection references an unknown edge", () => {
    const source = createGraph(manifest);
    expect(() =>
      createDisplayGraph(
        source,
        projection(["a", "b"], ["missing"]),
        new GraphPositionStore(source),
      ),
    ).toThrow(/edge "missing"/);
  });

  it("fails when a projected edge has an endpoint outside the projection", () => {
    const source = createGraph(manifest);
    expect(() =>
      createDisplayGraph(source, projection(["a"], ["ab-link"]), new GraphPositionStore(source)),
    ).toThrow(/outside the projected node set/);
  });

  it("aggregates parallel typed edges by unordered pair and excludes loops", () => {
    const links = buildPhysicalLinks(createGraph(manifest));
    expect(links).toEqual([
      { source: "a", target: "b", occurrences: 6 },
      { source: "b", target: "c", occurrences: 1 },
    ]);
    expect(physicalLinkStrength(1)).toBeGreaterThanOrEqual(0.1);
    expect(physicalLinkStrength(1_000_000)).toBe(0.35);
  });
});

describe("motion policy and position state", () => {
  it("applies desktop and compact thresholds", () => {
    expect(isMotionEligible(projection(["a", "b"], []), false)).toBe(true);
    expect(
      isMotionEligible(
        projection(
          Array.from({ length: 601 }, (_, index) => `n-${index}`),
          [],
        ),
        false,
      ),
    ).toBe(false);
    expect(
      isMotionEligible(
        projection(
          Array.from({ length: 201 }, (_, index) => `n-${index}`),
          [],
        ),
        true,
      ),
    ).toBe(false);
  });

  it("resets positions and pins to immutable compiler coordinates", () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    positions.setCurrent("a", { x: 20, y: 30 });
    positions.pin("a");
    positions.reset();
    expect(positions.getCurrent("a")).toEqual({ x: 0, y: 0 });
    expect(positions.getCurrent("b")).toEqual({ x: 200, y: 0 });
    expect(positions.pinnedCount).toBe(0);
    expect(positions.isPinned("a")).toBe(false);
  });

  it("moves deterministically while fixed nodes stay pinned", async () => {
    async function run(): Promise<{ graph: RhizomeGraph; positions: GraphPositionStore }> {
      const source = createGraph(manifest);
      const positions = new GraphPositionStore(source);
      positions.pin("a");
      const display = createDisplayGraph(
        source,
        projection(["a", "b"], ["ab-link", "ab-relation"]),
        positions,
      );
      const controller = new GraphMotionController({
        graph: display,
        positions,
        onStatus: () => undefined,
        onPinnedChange: () => undefined,
      });
      await controller.start();
      controller.pause();
      controller.advance(40);
      controller.kill();
      return { graph: display, positions };
    }

    const first = await run();
    const second = await run();
    expect(first.positions.getCurrent("a")).toEqual({ x: 0, y: 0 });
    expect(first.positions.getCurrent("b").x).not.toBe(200);
    expect(first.positions.getCurrent("b")).toEqual(second.positions.getCurrent("b"));
    expect(first.graph.getNodeAttributes("a")).toMatchObject({ x: 0, y: 0 });
  });

  it("keeps shift-dragged nodes pinned and releases normal drags", async () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    const display = createDisplayGraph(source, projection(["a", "b"], ["ab-link"]), positions);
    const controller = new GraphMotionController({
      graph: display,
      positions,
      onStatus: () => undefined,
      onPinnedChange: () => undefined,
    });
    await controller.start();
    controller.pause();

    controller.beginDrag("a", { x: 25, y: 30 });
    controller.pause();
    controller.advance(10);
    controller.endDrag("a", true);
    controller.pause();
    expect(positions.getCurrent("a")).toEqual({ x: 25, y: 30 });
    expect(positions.isPinned("a")).toBe(true);

    controller.beginDrag("a", { x: 40, y: 50 });
    controller.pause();
    controller.endDrag("a", false);
    controller.pause();
    expect(positions.isPinned("a")).toBe(false);
    controller.kill();
  });

  it("bounds viewport nudges and temporarily fixes the selected node", async () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    positions.setCurrent("b", { x: 2, y: 0 });
    const display = createDisplayGraph(source, projection(["a", "b"], ["ab-link"]), positions);
    const controller = new GraphMotionController({
      graph: display,
      positions,
      onStatus: () => undefined,
      onPinnedChange: () => undefined,
    });
    await controller.start();
    controller.pause();

    const selectedOrigin = positions.getCurrent("a");
    const movingOrigin = positions.getCurrent("b");
    const box: [[number, number], [number, number]] = [
      [-12, -12],
      [12, 12],
    ];
    expect(
      controller.updateViewportNudge({
        boxes: new Map([
          ["a", box],
          ["b", box],
        ]),
        maxDisplacement: 5,
        selected: "a",
      }),
    ).toBe(true);
    expect(controller.isTemporarilyFixed("a")).toBe(true);
    controller.advance(20);

    expect(positions.getCurrent("a")).toEqual(selectedOrigin);
    expect(
      Math.hypot(
        positions.getCurrent("b").x - movingOrigin.x,
        positions.getCurrent("b").y - movingOrigin.y,
      ),
    ).toBeLessThanOrEqual(5.000_001);

    controller.cancelViewportNudge();
    expect(controller.isTemporarilyFixed("a")).toBe(false);
    controller.kill();
  });
});

describe("viewport nudge geometry", () => {
  it("builds symmetric node boxes and asymmetric priority-label boxes", () => {
    expect(collisionBoxForNode({ radiusPixels: 6, unitsPerPixel: 2 })).toEqual([
      [-20, -20],
      [20, 20],
    ]);
    expect(
      collisionBoxForNode({ radiusPixels: 6, unitsPerPixel: 2, labelWidthPixels: 50 }),
    ).toEqual([
      [-20, -20],
      [130, 20],
    ]);
  });

  it("converts viewport pixels and applies zoom-dependent label LOD", () => {
    expect(graphUnitsPerPixel(({ x, y }) => ({ x: x * 3, y: y * 3 }))).toBe(3);
    expect(labelLodForRatio(1)).toEqual({ density: 0.08, renderedSizeThreshold: 8 });
    expect(labelLodForRatio(4)).toEqual({ density: 0.015, renderedSizeThreshold: 12 });
  });

  it("selects priority labels deterministically and caches measurements", () => {
    const priorities = selectPriorityLabels(
      ["low", "tie-b", "high", "tie-a"],
      (id) => ({ low: 1, high: 5, "tie-a": 3, "tie-b": 3 })[id] ?? 0,
      3,
    );
    expect([...priorities]).toEqual(["high", "tie-a", "tie-b"]);

    let measurements = 0;
    const cache = new LabelWidthCache((label) => {
      measurements += 1;
      return label.length * 7;
    });
    expect(cache.get("Rhizome")).toBe(49);
    expect(cache.get("Rhizome")).toBe(49);
    expect(cache.size).toBe(1);
    expect(measurements).toBe(1);
  });
});
