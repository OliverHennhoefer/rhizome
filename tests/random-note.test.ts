import { describe, expect, it } from "vitest";
import { pickRandomNoteId } from "../src/app/random-note";
import type { GraphNode } from "../src/shared/contracts";

function node(id: string, kind: GraphNode["kind"] = "note"): GraphNode {
  return {
    id,
    kind,
    title: id,
    aliases: [],
    types: [],
    tags: [],
    detailsRef: id,
    x: 0,
    y: 0,
    community: 0,
    degree: 0,
  };
}

describe("random note selection", () => {
  const nodes = [node("a"), node("b"), node("missing", "missing"), node("filtered")];
  const visible = new Set(["a", "b", "missing"]);

  it("selects only real notes in the visible projection", () => {
    expect(pickRandomNoteId(nodes, visible, undefined, () => 0)).toBe("a");
    expect(pickRandomNoteId(nodes, visible, undefined, () => 0.999)).toBe("b");
  });

  it("avoids reopening the selected note when another note is available", () => {
    expect(pickRandomNoteId(nodes, visible, "a", () => 0)).toBe("b");
    expect(pickRandomNoteId(nodes, visible, "b", () => 0.999)).toBe("a");
  });

  it("keeps a sole selected note eligible and handles an empty projection", () => {
    expect(pickRandomNoteId(nodes, new Set(["a"]), "a", () => 0)).toBe("a");
    expect(pickRandomNoteId(nodes, new Set(), undefined, () => 0)).toBeUndefined();
  });
});
