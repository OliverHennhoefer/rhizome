import type {
  EdgeEvidence,
  GraphEdge,
  GraphManifest,
  GraphNode,
  NodeDetails,
} from "../shared/contracts";

export type RelationshipDirection = "incoming" | "outgoing" | "undirected";

export interface ExternalDisplay {
  hostname: string;
  path?: string;
  url: string;
}

export interface RelationshipView {
  edgeId: string;
  counterpart: GraphNode;
  direction: RelationshipDirection;
  label: string;
  evidence: EdgeEvidence[];
  external?: ExternalDisplay;
}

function evidenceKey(item: EdgeEvidence): string {
  return [
    item.edgeId,
    item.source,
    item.target,
    item.origin,
    item.range.startLine,
    item.range.startColumn,
    item.range.endLine,
    item.range.endColumn,
  ].join(":");
}

function directionFor(edge: GraphEdge, nodeId: string): RelationshipDirection {
  if (!edge.directed) return "undirected";
  return edge.source === nodeId ? "outgoing" : "incoming";
}

function relationLabel(
  edge: GraphEdge,
  direction: RelationshipDirection,
  manifest: GraphManifest,
): string {
  if (edge.type === "link") {
    if (direction === "outgoing") return "Links to";
    if (direction === "incoming") return "Linked from";
    return "Linked";
  }
  return manifest.config.relations[edge.type]?.label ?? edge.type;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function externalDisplay(node: GraphNode): ExternalDisplay | undefined {
  if (node.kind !== "external" || !node.path) return undefined;
  try {
    const url = new URL(node.path);
    const path = safeDecode(url.pathname).replace(/^\/+|\/+$/g, "");
    return { hostname: url.hostname, ...(path ? { path } : {}), url: url.href };
  } catch {
    return { hostname: node.title, url: node.path };
  }
}

export function buildRelationshipViews(
  details: NodeDetails,
  manifest: GraphManifest,
): RelationshipView[] {
  const nodes = new Map(manifest.nodes.map((node) => [node.id, node]));
  const edges = new Map(manifest.edges.map((edge) => [edge.id, edge]));
  const evidenceByEdge = new Map<string, Map<string, EdgeEvidence>>();

  for (const item of [...details.outgoing, ...details.incoming]) {
    const group = evidenceByEdge.get(item.edgeId) ?? new Map<string, EdgeEvidence>();
    group.set(evidenceKey(item), item);
    evidenceByEdge.set(item.edgeId, group);
  }

  const views: RelationshipView[] = [];
  for (const [edgeId, evidence] of evidenceByEdge) {
    const edge = edges.get(edgeId);
    if (!edge) continue;
    const counterpartId = edge.source === details.id ? edge.target : edge.source;
    const counterpart = nodes.get(counterpartId);
    if (!counterpart) continue;
    const direction = directionFor(edge, details.id);
    views.push({
      edgeId,
      counterpart,
      direction,
      label: relationLabel(edge, direction, manifest),
      evidence: [...evidence.values()].sort(
        (left, right) =>
          left.range.startLine - right.range.startLine ||
          left.range.startColumn - right.range.startColumn,
      ),
      external: externalDisplay(counterpart),
    });
  }

  const rank: Record<RelationshipDirection, number> = {
    outgoing: 0,
    incoming: 1,
    undirected: 2,
  };
  return views.sort(
    (left, right) =>
      rank[left.direction] - rank[right.direction] ||
      left.label.localeCompare(right.label) ||
      left.counterpart.title.localeCompare(right.counterpart.title) ||
      left.edgeId.localeCompare(right.edgeId),
  );
}
