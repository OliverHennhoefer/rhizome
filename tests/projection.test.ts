import { describe, expect, it } from "vitest";
import { createGraph, projectGraph, reconcileProjectedHover } from "../src/app/graph";
import { createDisplayGraph, GraphPositionStore } from "../src/app/graph-layout";
import type { GraphManifest } from "../src/shared/contracts";

const manifest: GraphManifest = {
  schemaVersion: 2,
  contentHash: "fixture",
  config: { site: { title: "Test" }, relations: {} },
  nodes: [
    {
      id: "a",
      kind: "note",
      title: "A",
      aliases: [],
      types: ["concept"],
      tags: ["x"],
      detailsRef: "a",
      x: 0,
      y: 0,
      community: 0,
      degree: 1,
    },
    {
      id: "b",
      kind: "note",
      title: "B",
      aliases: [],
      types: ["concept"],
      tags: ["y"],
      detailsRef: "b",
      x: 1,
      y: 0,
      community: 0,
      degree: 2,
    },
    {
      id: "c",
      kind: "note",
      title: "C",
      aliases: [],
      types: ["source"],
      tags: ["x"],
      detailsRef: "c",
      x: 2,
      y: 0,
      community: 1,
      degree: 1,
    },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", type: "depends-on", directed: true, occurrences: 1 },
    { id: "bc", source: "b", target: "c", type: "supported-by", directed: true, occurrences: 1 },
  ],
  facets: { tags: {}, types: {}, relations: {} },
  diagnostics: [],
};

describe("graph projection", () => {
  it("combines type and tag filters", () => {
    const projection = projectGraph(createGraph(manifest), {
      visibleTypes: new Set(["concept"]),
      visibleTags: new Set(["x"]),
      visibleRelations: new Set(),
      direction: "both",
      depth: 1,
    });
    expect([...projection.nodes]).toEqual(["a"]);
    expect(projection.edges.size).toBe(0);
  });

  it("performs bounded directional BFS over graph indexes", () => {
    const graph = createGraph(manifest);
    const inbound = projectGraph(graph, {
      visibleTypes: new Set(),
      visibleTags: new Set(),
      visibleRelations: new Set(["depends-on"]),
      focusNode: "b",
      direction: "in",
      depth: 2,
    });
    expect([...inbound.nodes].sort()).toEqual(["a", "b"]);
    expect([...inbound.edges]).toEqual(["ab"]);

    const outbound = projectGraph(graph, {
      visibleTypes: new Set(),
      visibleTags: new Set(),
      visibleRelations: new Set(),
      focusNode: "a",
      direction: "out",
      depth: 2,
    });
    expect([...outbound.nodes].sort()).toEqual(["a", "b", "c"]);
  });

  it("clears removed hover state and recomputes retained visible neighbors", () => {
    const graph = createGraph(manifest);
    const positions = new GraphPositionStore(graph);
    const retained = createDisplayGraph(
      graph,
      { nodes: new Set(["a", "b"]), edges: new Set(["ab"]) },
      positions,
    );
    expect(reconcileProjectedHover(retained, "b")).toEqual({
      hovered: "b",
      neighbors: new Set(["a"]),
    });

    const removed = createDisplayGraph(
      graph,
      { nodes: new Set(["a"]), edges: new Set() },
      positions,
    );
    expect(reconcileProjectedHover(removed, "b")).toEqual({ neighbors: new Set() });
  });
});
