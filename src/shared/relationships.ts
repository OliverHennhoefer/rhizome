import type { EdgeEvidence, GraphEdge, PublicConfig } from "./contracts.ts";
import { compareText } from "./order.ts";

export type EdgeDirection = "incoming" | "outgoing" | "undirected" | "self";
export const directionRank = { self: 0, outgoing: 1, incoming: 2, undirected: 3, bidirectional: 0 };
export function directionFor(edge: GraphEdge, root: string): EdgeDirection {
  if (edge.source === root && edge.target === root) return "self";
  if (!edge.directed) return "undirected";
  return edge.source === root ? "outgoing" : "incoming";
}
export function relationLabel(
  edge: GraphEdge,
  direction: EdgeDirection | "bidirectional",
  graph: { config: PublicConfig },
): string {
  if (edge.type === "link") {
    if (direction === "outgoing") return "Links to";
    if (direction === "incoming") return "Linked from";
    return direction === "self" ? "Links to itself" : "Linked";
  }
  const definition = graph.config.relations[edge.type];
  return direction === "incoming"
    ? (definition?.inverseLabel ?? definition?.label ?? edge.type)
    : (definition?.label ?? edge.type);
}
export function evidenceKey(item: EdgeEvidence): string {
  return JSON.stringify([item.edgeId, item.source, item.target, item.origin, item.range]);
}
export function compareEvidence(a: EdgeEvidence, b: EdgeEvidence): number {
  return (
    compareText(a.source, b.source) ||
    a.range.startLine - b.range.startLine ||
    a.range.startColumn - b.range.startColumn ||
    a.range.endLine - b.range.endLine ||
    a.range.endColumn - b.range.endColumn ||
    compareText(a.target, b.target) ||
    compareText(a.origin, b.origin) ||
    compareText(a.edgeId, b.edgeId)
  );
}
