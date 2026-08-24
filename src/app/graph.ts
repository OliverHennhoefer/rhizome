import Graph from "graphology";
import type { GraphEdge, GraphManifest, GraphNode } from "../shared/contracts";

export interface ProjectionInput {
  visibleTypes: ReadonlySet<string>;
  visibleTags: ReadonlySet<string>;
  visibleRelations: ReadonlySet<string>;
  direction: "in" | "out" | "both";
  focusNode?: string;
  depth: number;
}

export interface GraphProjection {
  nodes: ReadonlySet<string>;
  edges: ReadonlySet<string>;
}

export type RuntimeGraphEdge = GraphEdge & { relationType: string };
export type RhizomeGraph = Graph<GraphNode, RuntimeGraphEdge>;

export function createGraph(manifest: GraphManifest): RhizomeGraph {
  const graph: RhizomeGraph = new Graph({ type: "mixed", multi: true, allowSelfLoops: true });
  for (const node of manifest.nodes) graph.addNode(node.id, { ...node });
  for (const edge of manifest.edges) {
    const attributes = {
      ...edge,
      relationType: edge.type,
      type: edge.directed ? "arrow" : "line",
    };
    if (edge.directed) graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes);
    else graph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, attributes);
  }
  return graph;
}

function matchesNode(node: GraphNode, input: ProjectionInput): boolean {
  const typeMatch =
    input.visibleTypes.size === 0 || node.types.some((type) => input.visibleTypes.has(type));
  const tagMatch =
    input.visibleTags.size === 0 || node.tags.some((tag) => input.visibleTags.has(tag));
  return typeMatch && tagMatch;
}

function relationMatches(edge: RuntimeGraphEdge, input: ProjectionInput): boolean {
  return input.visibleRelations.size === 0 || input.visibleRelations.has(edge.relationType);
}

function visitEdges(
  graph: RhizomeGraph,
  node: string,
  direction: ProjectionInput["direction"],
  callback: (edge: string, neighbor: string) => void,
): void {
  const seen = new Set<string>();
  const visit = (
    edge: string,
    _attributes: RuntimeGraphEdge,
    source: string,
    target: string,
  ): void => {
    if (seen.has(edge)) return;
    seen.add(edge);
    callback(edge, source === node ? target : source);
  };
  if (direction !== "in") graph.forEachOutboundEdge(node, visit);
  if (direction !== "out") graph.forEachInboundEdge(node, visit);
}

export function projectGraph(graph: RhizomeGraph, input: ProjectionInput): GraphProjection {
  const eligibleNodes = new Set<string>();
  graph.forEachNode((id, node) => {
    if (matchesNode(node, input)) eligibleNodes.add(id);
  });

  if (!input.focusNode || !graph.hasNode(input.focusNode)) {
    const edges = new Set<string>();
    graph.forEachEdge((id, edge, source, target) => {
      if (eligibleNodes.has(source) && eligibleNodes.has(target) && relationMatches(edge, input)) {
        edges.add(id);
      }
    });
    return { nodes: eligibleNodes, edges };
  }

  const nodes = new Set<string>([input.focusNode]);
  const traversedEdges = new Set<string>();
  let frontier = new Set<string>([input.focusNode]);
  for (let depth = 0; depth < Math.max(0, input.depth); depth += 1) {
    const next = new Set<string>();
    for (const node of frontier) {
      visitEdges(graph, node, input.direction, (edgeId, neighbor) => {
        const edge = graph.getEdgeAttributes(edgeId);
        if (!relationMatches(edge, input) || !eligibleNodes.has(neighbor)) return;
        traversedEdges.add(edgeId);
        if (!nodes.has(neighbor)) next.add(neighbor);
        nodes.add(neighbor);
      });
    }
    frontier = next;
    if (frontier.size === 0) break;
  }

  const edges = new Set<string>();
  for (const edgeId of traversedEdges) {
    const source = graph.source(edgeId);
    const target = graph.target(edgeId);
    if (nodes.has(source) && nodes.has(target)) edges.add(edgeId);
  }
  return { nodes, edges };
}

export function neighborsOf(graph: RhizomeGraph, nodeId: string): Set<string> {
  const neighbors = new Set<string>();
  if (!graph.hasNode(nodeId)) return neighbors;
  graph.forEachNeighbor(nodeId, (neighbor) => neighbors.add(neighbor));
  return neighbors;
}
