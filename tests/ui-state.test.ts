import { describe, expect, it } from "vitest";
import { buildRelationshipViews, externalDisplay } from "../src/app/relationship-model";
import {
  clampReaderWidth,
  nearestMobileReaderSnap,
  parseReaderWidth,
  readerWidthBounds,
  toggleDirectionalFocus,
} from "../src/app/ui-state";
import type { GraphManifest, NodeDetails } from "../src/shared/contracts";

const manifest: GraphManifest = {
  schemaVersion: 2,
  contentHash: "reader",
  config: {
    site: { title: "Rhizome" },
    relations: {
      "depends-on": { label: "Depends on", directed: true, color: "#fff" },
      "supported-by": { label: "Supported by", directed: true, color: "#aaa" },
    },
  },
  nodes: [
    {
      id: "a",
      kind: "note",
      title: "Alpha",
      path: "Alpha.md",
      aliases: [],
      types: ["note"],
      tags: [],
      detailsRef: "a.json",
      x: 0,
      y: 0,
      community: 0,
      degree: 2,
    },
    {
      id: "b",
      kind: "note",
      title: "Beta",
      path: "Beta.md",
      aliases: [],
      types: ["note"],
      tags: [],
      detailsRef: "b.json",
      x: 1,
      y: 0,
      community: 0,
      degree: 1,
    },
    {
      id: "external",
      kind: "external",
      title: "example.com/library/Source%20Note",
      path: "https://example.com/library/Source%20Note",
      aliases: [],
      types: ["external"],
      tags: [],
      detailsRef: "external.json",
      x: 2,
      y: 0,
      community: 0,
      degree: 1,
    },
  ],
  edges: [
    {
      id: "depends",
      source: "a",
      target: "b",
      type: "depends-on",
      directed: true,
      occurrences: 1,
    },
    {
      id: "source",
      source: "a",
      target: "external",
      type: "supported-by",
      directed: true,
      occurrences: 1,
    },
  ],
  facets: { tags: {}, types: {}, relations: {} },
  diagnostics: [],
};

const details: NodeDetails = {
  schemaVersion: 1,
  id: "a",
  incoming: [],
  outgoing: [
    {
      edgeId: "depends",
      source: "a",
      target: "b",
      type: "depends-on",
      origin: "body",
      range: { startLine: 8, startColumn: 1, endLine: 8, endColumn: 12 },
      excerpt: "See [[Beta]].",
    },
    {
      edgeId: "source",
      source: "a",
      target: "external",
      type: "supported-by",
      origin: "frontmatter",
      range: { startLine: 4, startColumn: 1, endLine: 4, endColumn: 40 },
      excerpt: "https://example.com/library/Source%20Note",
    },
  ],
};

describe("reader layout state", () => {
  it("clamps stored widths while preserving enough graph space", () => {
    expect(readerWidthBounds(1440)).toEqual({ minimum: 320, maximum: 720 });
    expect(readerWidthBounds(700)).toEqual({ minimum: 320, maximum: 320 });
    expect(clampReaderWidth(900, 1200)).toBe(720);
    expect(parseReaderWidth("not-a-number", 1200)).toBe(420);
    expect(parseReaderWidth("510", 1200)).toBe(510);
  });

  it("snaps mobile readers to the nearest stable height", () => {
    expect(nearestMobileReaderSnap(42)).toBe(35);
    expect(nearestMobileReaderSnap(70)).toBe(65);
    expect(nearestMobileReaderSnap(88)).toBe(92);
  });

  it("toggles an active directional focus off", () => {
    expect(toggleDirectionalFocus({ focus: false, direction: "both" }, "in")).toEqual({
      focus: true,
      direction: "in",
    });
    expect(toggleDirectionalFocus({ focus: true, direction: "in" }, "in")).toEqual({
      focus: false,
      direction: "both",
    });
  });
});

describe("relationship view model", () => {
  it("uses human labels, stable direction, and decoded external display", () => {
    const views = buildRelationshipViews(details, manifest);
    expect(views.map((view) => [view.label, view.direction])).toEqual([
      ["Depends on", "outgoing"],
      ["Supported by", "outgoing"],
    ]);
    expect(views[1].external).toEqual({
      hostname: "example.com",
      path: "library/Source Note",
      url: "https://example.com/library/Source%20Note",
    });
    expect(views[1].evidence[0].origin).toBe("frontmatter");
  });

  it("returns no external display for local notes", () => {
    expect(externalDisplay(manifest.nodes[0])).toBeUndefined();
  });
});
