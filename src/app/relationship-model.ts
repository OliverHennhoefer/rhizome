import type {
  EdgeEvidence,
  GraphEdge,
  GraphManifest,
  GraphNode,
  NodeDetails,
} from "../shared/contracts";
import { compareText } from "../shared/order";

import {
  compareEvidence,
  directionFor,
  directionRank,
  type EdgeDirection,
  evidenceKey,
  relationLabel,
} from "../shared/relationships";

export type RelationshipDirection = "bidirectional" | EdgeDirection;

export interface ExternalDisplay {
  hostname: string;
  path?: string;
  title?: string;
  url: string;
}

export interface RelationshipKindView {
  type: string;
  direction: RelationshipDirection;
  label: string;
}

export interface RelationshipView {
  edgeId: string;
  counterpart: GraphNode;
  relations: RelationshipKindView[];
  summary?: RelationshipKindView;
  evidence: EdgeEvidence[];
  external?: ExternalDisplay;
}

function combinedDirection(directions: ReadonlySet<RelationshipDirection>): RelationshipDirection {
  if (directions.has("self")) return "self";
  if (directions.has("undirected")) return "undirected";
  if (directions.has("incoming") && directions.has("outgoing")) return "bidirectional";
  if (directions.has("outgoing")) return "outgoing";
  return "incoming";
}

function relationshipSummary(
  relations: readonly RelationshipKindView[],
): RelationshipKindView | undefined {
  if (relations.length < 2) return undefined;
  const hasOutgoing = relations.some(
    ({ direction }) => direction === "outgoing" || direction === "bidirectional",
  );
  const hasIncoming = relations.some(
    ({ direction }) => direction === "incoming" || direction === "bidirectional",
  );
  if (!hasOutgoing || !hasIncoming) return undefined;
  return { type: "interrelated", direction: "bidirectional", label: "Interrelated with" };
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
      relations: Map<
        string,
        {
          directions: Set<RelationshipDirection>;
          edge: GraphEdge;
        }
      >;
      edgeIds: string[];
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
    const group = grouped.get(counterpartId) ?? {
      counterpart,
      relations: new Map<string, { directions: Set<RelationshipDirection>; edge: GraphEdge }>(),
      edgeIds: [] as string[],
      evidence: new Map<string, EdgeEvidence>(),
    };
    const relationKey = JSON.stringify([edge.type, edge.directed]);
    const relation = group.relations.get(relationKey) ?? {
      directions: new Set<RelationshipDirection>(),
      edge,
    };
    relation.directions.add(direction);
    group.relations.set(relationKey, relation);
    group.edgeIds.push(edgeId);
    for (const item of evidence.values()) group.evidence.set(evidenceKey(item), item);
    grouped.set(counterpartId, group);
  }

  const rank = directionRank;
  const views: RelationshipView[] = [...grouped.values()].map((group) => {
    const relations = [...group.relations.values()]
      .map(({ directions, edge }) => {
        const direction = combinedDirection(directions);
        return {
          type: edge.type,
          direction,
          label: relationLabel(edge, direction, manifest),
        };
      })
      .sort(
        (left, right) =>
          rank[left.direction] - rank[right.direction] ||
          compareText(left.label, right.label) ||
          compareText(left.type, right.type),
      );
    const summary = relationshipSummary(relations);
    return {
      edgeId: group.edgeIds.sort(compareText)[0],
      counterpart: group.counterpart,
      relations,
      ...(summary ? { summary } : {}),
      evidence: [...group.evidence.values()].sort(compareEvidence),
      external: externalDisplay(group.counterpart),
    };
  });

  return views.sort((left, right) => {
    const leftRelation = left.relations[0];
    const rightRelation = right.relations[0];
    return (
      rank[leftRelation.direction] - rank[rightRelation.direction] ||
      compareText(leftRelation.label, rightRelation.label) ||
      compareText(left.counterpart.title, right.counterpart.title) ||
      compareText(left.edgeId, right.edgeId)
    );
  });
}
