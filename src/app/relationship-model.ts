import type {
  EdgeEvidence,
  GraphEdge,
  GraphManifest,
  GraphNode,
  NodeDetails,
} from "../shared/contracts";

export type RelationshipDirection = "bidirectional" | "incoming" | "outgoing" | "undirected";

export interface ExternalDisplay {
  hostname: string;
  path?: string;
  title?: string;
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

function combinedDirection(directions: ReadonlySet<RelationshipDirection>): RelationshipDirection {
  if (directions.has("undirected")) return "undirected";
  if (directions.has("incoming") && directions.has("outgoing")) return "bidirectional";
  if (directions.has("outgoing")) return "outgoing";
  return "incoming";
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
    const fallbackTitle = `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
    return {
      hostname: url.hostname,
      ...(path ? { path } : {}),
      ...(node.title !== fallbackTitle ? { title: node.title } : {}),
      url: url.href,
    };
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

  const grouped = new Map<
    string,
    {
      counterpart: GraphNode;
      directions: Set<RelationshipDirection>;
      edgeIds: string[];
      edge: GraphEdge;
      evidence: Map<string, EdgeEvidence>;
    }
  >();
  for (const [edgeId, evidence] of evidenceByEdge) {
    const edge = edges.get(edgeId);
    if (!edge) continue;
    const counterpartId = edge.source === details.id ? edge.target : edge.source;
    const counterpart = nodes.get(counterpartId);
    if (!counterpart) continue;
    const direction = directionFor(edge, details.id);
    const groupKey = JSON.stringify([counterpartId, edge.type, edge.directed]);
    const group = grouped.get(groupKey) ?? {
      counterpart,
      directions: new Set<RelationshipDirection>(),
      edgeIds: [],
      edge,
      evidence: new Map<string, EdgeEvidence>(),
    };
    group.directions.add(direction);
    group.edgeIds.push(edgeId);
    for (const item of evidence.values()) group.evidence.set(evidenceKey(item), item);
    grouped.set(groupKey, group);
  }

  const views: RelationshipView[] = [...grouped.values()].map((group) => {
    const direction = combinedDirection(group.directions);
    return {
      edgeId: group.edgeIds.sort((left, right) => left.localeCompare(right))[0],
      counterpart: group.counterpart,
      direction,
      label: relationLabel(group.edge, direction, manifest),
      evidence: [...group.evidence.values()].sort(
        (left, right) =>
          left.source.localeCompare(right.source) ||
          left.range.startLine - right.range.startLine ||
          left.range.startColumn - right.range.startColumn,
      ),
      external: externalDisplay(group.counterpart),
    };
  });

  const rank: Record<RelationshipDirection, number> = {
    bidirectional: 0,
    outgoing: 1,
    incoming: 2,
    undirected: 3,
  };
  return views.sort(
    (left, right) =>
      rank[left.direction] - rank[right.direction] ||
      left.label.localeCompare(right.label) ||
      left.counterpart.title.localeCompare(right.counterpart.title) ||
      left.edgeId.localeCompare(right.edgeId),
  );
}
