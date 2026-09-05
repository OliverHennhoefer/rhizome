import type {
  GraphEdge,
  GraphManifest,
  GraphNode,
  KnowledgeCatalog,
  NodeDetails,
} from "../shared/contracts.ts";
import { compareText } from "../shared/order.ts";
import {
  compareEvidence,
  directionFor,
  directionRank,
  evidenceKey,
  relationLabel,
} from "../shared/relationships.ts";
import { invalidArtifact, KnowledgeError } from "./errors.ts";
import { page } from "./pagination.ts";
import {
  type ContextInput,
  ContextInputSchema,
  type ContextNode,
  type ContextOutput,
  type ContextRelationship,
} from "./tool-contracts.ts";
import { normalizeSiteUrl, noteUrl } from "./urls.ts";

export class GraphQueries {
  private readonly nodes: Map<string, GraphNode>;
  private readonly edges: Map<string, GraphEdge>;
  private readonly adjacency = new Map<string, GraphEdge[]>();
  private readonly documents: Map<string, KnowledgeCatalog["documents"][number]>;
  private readonly site: string;
  constructor(
    private readonly graph: GraphManifest,
    catalog: KnowledgeCatalog,
    site: string,
  ) {
    this.site = normalizeSiteUrl(site).href;
    this.nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    this.edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
    this.documents = new Map(catalog.documents.map((doc) => [doc.id, doc]));
    if (this.nodes.size !== graph.nodes.length || this.edges.size !== graph.edges.length)
      invalidArtifact("Duplicate graph IDs");
    if (graph.nodes.filter((node) => node.kind === "note").length !== catalog.documents.length)
      invalidArtifact("Graph and catalog note counts disagree");
    for (const doc of catalog.documents) {
      const node = this.nodes.get(doc.id);
      if (
        node?.kind !== "note" ||
        ["title", "path", "aliases", "tags", "types"].some(
          (key) =>
            JSON.stringify(node[key as keyof GraphNode]) !==
            JSON.stringify(doc[key as keyof typeof doc]),
        )
      )
        invalidArtifact("Graph and catalog note metadata disagree");
    }
    for (const edge of graph.edges) {
      if (!this.nodes.has(edge.source) || !this.nodes.has(edge.target))
        invalidArtifact("Graph edge has an unknown endpoint");
      const relation = graph.config.relations[edge.type];
      if ((edge.type !== "link" && !relation) || (relation && relation.directed !== edge.directed))
        invalidArtifact("Graph edge has an invalid relationship type");
      for (const id of new Set([edge.source, edge.target])) {
        const edges = this.adjacency.get(id) ?? [];
        edges.push(edge);
        this.adjacency.set(id, edges);
      }
    }
  }
  private view(node: GraphNode): ContextNode {
    let url: string | undefined;
    if (node.kind === "note") url = noteUrl(this.site, node.id);
    else if (node.kind === "external" && node.path) {
      try {
        const parsed = new URL(node.path);
        if (["http:", "https:"].includes(parsed.protocol)) url = parsed.href;
      } catch {
        /* Not a navigable external node. */
      }
    }
    return {
      id: node.id,
      title: node.title,
      kind: node.kind,
      path: node.path,
      url,
      types: node.types,
      tags: node.tags,
    };
  }
  private node(id: string): GraphNode {
    const node = this.nodes.get(id);
    if (!node) invalidArtifact("Graph relationship has an unknown node");
    return node;
  }
  detailsReference(id: string): string {
    const node = this.nodes.get(id);
    if (node?.kind !== "note") throw new KnowledgeError("UNKNOWN_ID", `Note "${id}" was not found`);
    return node.detailsRef;
  }
  context(snapshot: string, input: ContextInput, details: NodeDetails): ContextOutput {
    const { id, direction, cursor, relationTypes } = ContextInputSchema.parse(input);
    const root = this.nodes.get(id);
    const document = this.documents.get(id);
    if (!document || root?.kind !== "note")
      throw new KnowledgeError("UNKNOWN_ID", `Note "${id}" was not found`);
    if (details.id !== id) invalidArtifact("Details belong to another note");
    const types = relationTypes ? [...new Set(relationTypes)].sort(compareText) : undefined;
    if (types?.some((type) => type !== "link" && !this.graph.config.relations[type]))
      throw new KnowledgeError("INVALID_INPUT", "Unknown relationship type");
    const byEdge = new Map<string, Map<string, NodeDetails["incoming"][number]>>();
    for (const [side, items] of [
      ["incoming", details.incoming],
      ["outgoing", details.outgoing],
    ] as const)
      for (const item of items) {
        const edge = this.edges.get(item.edgeId);
        const source = this.documents.get(item.source);
        const endpoints =
          edge &&
          ((edge.source === item.source && edge.target === item.target) ||
            (!edge.directed && edge.target === item.source && edge.source === item.target));
        const range = item.range;
        if (
          !edge ||
          !endpoints ||
          item.type !== edge.type ||
          (side === "incoming" ? item.target !== id : item.source !== id) ||
          !source ||
          range.endLine > source.lineLengths.length ||
          range.startColumn > source.lineLengths[range.startLine - 1] + 1 ||
          range.endColumn > source.lineLengths[range.endLine - 1] + 1
        )
          invalidArtifact("Invalid graph source evidence");
        const group = byEdge.get(edge.id) ?? new Map();
        group.set(evidenceKey(item), item);
        byEdge.set(edge.id, group);
      }
    const incident = this.adjacency.get(id) ?? [];
    for (const edge of incident)
      if (byEdge.get(edge.id)?.size !== edge.occurrences)
        invalidArtifact("Relationship evidence count disagrees with graph");
    const selected = incident
      .filter((edge) => {
        const relative = directionFor(edge, id);
        return (
          (!types || types.includes(edge.type)) &&
          (direction === "both" ||
            relative === "self" ||
            relative === "undirected" ||
            relative === direction)
        );
      })
      .sort(
        (a, b) =>
          directionRank[directionFor(a, id)] - directionRank[directionFor(b, id)] ||
          compareText(
            relationLabel(a, directionFor(a, id), this.graph),
            relationLabel(b, directionFor(b, id), this.graph),
          ) ||
          compareText(
            this.node(a.source === id ? a.target : a.source).title,
            this.node(b.source === id ? b.target : b.source).title,
          ) ||
          compareText(a.id, b.id),
      );
    const { items, ...pagination } = page(
      selected,
      snapshot,
      { tool: "get_context", id, direction, types },
      cursor,
    );
    const relationships: ContextRelationship[] = items.map((edge) => {
      const group = byEdge.get(edge.id);
      if (!group) invalidArtifact("Relationship has no evidence");
      const evidence = [...group.values()].sort(compareEvidence);
      const relative = directionFor(edge, id);
      return {
        edgeId: edge.id,
        type: edge.type,
        directed: edge.directed,
        direction: relative,
        label: relationLabel(edge, relative, this.graph),
        counterpart: this.view(this.node(edge.source === id ? edge.target : edge.source)),
        evidence: evidence.slice(0, 3).map((item) => ({
          origin: item.origin,
          source: item.source,
          sourceUrl: noteUrl(this.site, item.source),
          target: item.target,
          anchor: item.anchor,
          range: item.range,
          excerpt: item.excerpt,
        })),
        evidenceCount: evidence.length,
        evidenceTruncated: evidence.length > 3,
      };
    });
    return {
      ...pagination,
      root: { ...this.view(root), kind: "note", path: document.path, url: noteUrl(this.site, id) },
      direction,
      relationships,
    };
  }
}
