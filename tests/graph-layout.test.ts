import { describe, expect, it } from "vitest";
import { createGraph, type GraphProjection, type RhizomeGraph } from "../src/app/graph";
import { labelZoomStyleForRatio } from "../src/app/graph-labels";
import {
  buildPhysicalLinks,
  clampPositionToRadius,
  createDisplayGraph,
  DEFAULT_GRAPH_FORCE_SETTINGS,
  FORCE_SETTINGS,
  GraphMotionController,
  GraphPositionStore,
  graphForceParameters,
  isMotionEligible,
  nodeRadius,
  ProjectionInvariantError,
  physicalLinkStrength,
  projectionBaseBounds,
} from "../src/app/graph-layout";
import { blendGraphTone, nodeTone } from "../src/app/graph-theme";
import type { GraphManifest } from "../src/shared/contracts";

const manifest: GraphManifest = {
  schemaVersion: 2,
  contentHash: "layout-fixture",
  config: {
    site: { title: "Layout" },
    relations: {
      "depends-on": { label: "Depends on", directed: true, color: "#d97757" },
    },
  },
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
    expect(physicalLinkStrength(1)).toBeGreaterThan(0.06);
    expect(physicalLinkStrength(1)).toBeLessThan(0.08);
    expect(physicalLinkStrength(1_000_000)).toBe(0.16);
  });

  it("carries configured relation colors into the runtime graph", () => {
    const graph = createGraph(manifest);
    expect(graph.getEdgeAttribute("ab-relation", "relationColor")).toBe("#d97757");
    expect(graph.getEdgeAttribute("ab-link", "relationColor")).toBe("#73818d");
  });
});

describe("motion policy and position state", () => {
  it("gives connected hubs a pronounced but bounded size advantage", () => {
    const radius = (degree: number) => nodeRadius({ ...manifest.nodes[0], degree });

    expect(radius(0)).toBeCloseTo(3.25);
    expect(radius(1)).toBeCloseTo(4.4);
    expect(radius(4)).toBeLessThan(radius(16));
    expect(radius(25) - radius(1)).toBeGreaterThan(4);
    expect(radius(100)).toBe(10.5);
    expect(radius(10_000)).toBe(10.5);
  });

  it("derives stable padded normalization bounds from compiler positions", () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    positions.setCurrent("a", { x: -10_000, y: 10_000 });

    expect(projectionBaseBounds(projection(["a", "b"], ["ab-link"]), positions)).toEqual({
      x: [-10, 210],
      y: [-1, 1],
    });
    expect(projectionBaseBounds(projection([], []), positions)).toEqual({
      x: [0, 1],
      y: [0, 1],
    });
  });

  it("caps pointer excursions within the recoverable drag radius", () => {
    expect(clampPositionToRadius({ x: 30, y: 40 }, { x: 0, y: 0 }, 100)).toEqual({
      x: 30,
      y: 40,
    });
    expect(clampPositionToRadius({ x: 300, y: 400 }, { x: 0, y: 0 }, 100)).toEqual({
      x: 60,
      y: 80,
    });
  });

  it("maps Obsidian-style force controls to bounded simulation parameters", () => {
    const defaults = graphForceParameters(DEFAULT_GRAPH_FORCE_SETTINGS);
    expect(defaults.centerStrength).toBeCloseTo(0.006);
    expect(defaults.chargeStrength).toBe(-32);
    expect(defaults.linkStrengthScale).toBe(1);
    expect(defaults.linkDistance).toBe(42);

    const bounded = graphForceParameters({
      centerForce: 500,
      repelForce: -10,
      linkForce: Number.NaN,
      linkDistance: 200,
    });
    expect(Math.abs(bounded.chargeStrength)).toBe(0);
    expect(bounded.linkStrengthScale).toBe(1);
    expect(bounded.linkDistance).toBe(100);
  });

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
        forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS,
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
      forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS,
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

  it("pulls linked nodes during a drag and preserves release inertia", async () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    const display = createDisplayGraph(source, projection(["a", "b"], ["ab-link"]), positions);
    const controller = new GraphMotionController({
      graph: display,
      positions,
      forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS,
      onStatus: () => undefined,
      onPinnedChange: () => undefined,
    });
    await controller.start(true);

    const neighborOrigin = positions.getCurrent("b");
    controller.beginDrag("a", positions.getCurrent("a"), 0);
    controller.moveDrag("a", { x: 80, y: 0 }, 16);
    controller.pause();
    controller.advance(12);
    expect(positions.getCurrent("b").x).toBeLessThan(neighborOrigin.x);

    controller.endDrag("a", false, 16);
    controller.pause();
    const release = positions.getCurrent("a");
    controller.advance(1);
    expect(positions.getCurrent("a").x).toBeGreaterThan(release.x);
    expect(positions.isPinned("a")).toBe(false);
    controller.kill();
  });

  it("springs a released node firmly back toward its linked neighborhood", async () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    const display = createDisplayGraph(source, projection(["a", "b"], ["ab-link"]), positions);
    const controller = new GraphMotionController({
      graph: display,
      positions,
      forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS,
      onStatus: () => undefined,
      onPinnedChange: () => undefined,
    });
    await controller.start(true);

    controller.beginDrag("a", positions.getCurrent("a"), 0);
    controller.moveDrag("a", { x: -100, y: 0 }, 16);
    controller.endDrag("a", false, 200);
    controller.pause();
    const released = positions.getCurrent("a");
    const neighbor = positions.getCurrent("b");
    const releasedDistance = Math.abs(neighbor.x - released.x);
    controller.advance(8);

    expect(positions.getCurrent("a").x).toBeGreaterThan(released.x);
    expect(Math.abs(positions.getCurrent("b").x - positions.getCurrent("a").x)).toBeLessThan(
      releasedDistance,
    );
    controller.kill();
  });

  it("recovers after an extreme pointer excursion without stranding the node", async () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    const display = createDisplayGraph(source, projection(["a", "b"], ["ab-link"]), positions);
    const controller = new GraphMotionController({
      graph: display,
      positions,
      forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS,
      onStatus: () => undefined,
      onPinnedChange: () => undefined,
    });
    await controller.start(true);

    const origin = positions.getCurrent("a");
    controller.beginDrag("a", origin, 0);
    controller.moveDrag("a", { x: -100_000, y: 0 }, 16);
    const dragged = positions.getCurrent("a");
    expect(Math.hypot(dragged.x - origin.x, dragged.y - origin.y)).toBeCloseTo(
      FORCE_SETTINGS.interactiveMaxDisplacement,
    );

    controller.endDrag("a", false, 200);
    controller.pause();
    const releasedDistance = Math.hypot(dragged.x - origin.x, dragged.y - origin.y);
    controller.advance(20);
    const settled = positions.getCurrent("a");
    expect(Math.hypot(settled.x - origin.x, settled.y - origin.y)).toBeLessThan(releasedDistance);
    controller.kill();
  });

  it("bounds automatic motion around the session origin", async () => {
    const source = createGraph(manifest);
    const positions = new GraphPositionStore(source);
    const display = createDisplayGraph(source, projection(["a", "b"], ["ab-link"]), positions);
    const controller = new GraphMotionController({
      graph: display,
      positions,
      forceSettings: DEFAULT_GRAPH_FORCE_SETTINGS,
      onStatus: () => undefined,
      onPinnedChange: () => undefined,
    });
    await controller.start();
    controller.pause();
    const origin = positions.getCurrent("b");
    controller.advance(200);
    expect(
      Math.hypot(positions.getCurrent("b").x - origin.x, positions.getCurrent("b").y - origin.y),
    ).toBeLessThanOrEqual(FORCE_SETTINGS.maxAutomaticDisplacement + 0.000_001);
    controller.kill();
  });
});

describe("label policy", () => {
  it("scales and fades every label uniformly with zoom", () => {
    expect(labelZoomStyleForRatio(0.5)).toEqual({ visible: true, size: 13, opacity: 1 });
    expect(labelZoomStyleForRatio(1)).toEqual({ visible: true, size: 12, opacity: 0.953 });
    expect(labelZoomStyleForRatio(2)).toEqual({ visible: true, size: 8.485, opacity: 0.403 });
  });

  it("removes every label at the distant threshold", () => {
    expect(labelZoomStyleForRatio(2.99).visible).toBe(true);
    expect(labelZoomStyleForRatio(3)).toEqual({ visible: false, size: 6.928, opacity: 0 });
    expect(labelZoomStyleForRatio(4)).toEqual({ visible: false, size: 6.5, opacity: 0 });
  });
});

describe("graph color policy", () => {
  it("uses muted community hues and blends inactive relations into the graph stage", () => {
    expect(nodeTone("note", 0)).toBe("#71849b");
    expect(nodeTone("missing", 0)).toBe("#a18463");
    expect(blendGraphTone("#d97757", 0)).toBe("#17181a");
    expect(blendGraphTone("#d97757", 1)).toBe("#d97757");
  });
});
