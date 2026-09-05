import { createHash } from "node:crypto";
import type { Nodes, Root } from "mdast";
import { ARTIFACT_LIMITS } from "../shared/artifact-schemas.ts";
import type {
  ArtifactReference,
  GraphManifest,
  KnowledgeCatalog,
  KnowledgeManifest,
} from "../shared/contracts.ts";
import { compareText } from "../shared/order.ts";
import {
  ANALYZER_VERSION,
  buildSearchIndex,
  type SearchDocument,
} from "../shared/search-analyzer.ts";
import type { ParsedNote } from "./types.ts";

export function searchableText(root: Root): { body: string; headings: string[] } {
  const headings: string[] = [];
  function text(node: Nodes): string {
    if (node.type === "yaml" || node.type === "html") return "";
    // Obsidian extensions use custom mdast nodes; this is a parser boundary.
    if (String(node.type) === "wikilink") {
      const link = node as unknown as { alias?: string; path: string };
      return link.alias || link.path;
    }
    if ("value" in node && typeof node.value === "string") return node.value;
    if (node.type === "image") return node.alt ?? "";
    const value = "children" in node ? node.children.map(text).join(" ") : "";
    if (node.type === "heading") headings.push(value);
    return value;
  }
  return { body: text(root), headings };
}
export function searchDocument(note: ParsedNote): SearchDocument {
  return {
    id: note.id,
    title: note.title,
    aliases: note.aliases,
    tags: note.tags,
    types: note.types,
    path: note.path,
    ...searchableText(note.root),
  };
}
export function emitKnowledge(
  notes: ParsedNote[],
  graph: GraphManifest,
  assets: Map<string, string | Uint8Array>,
): void {
  function emit(
    value: string,
    kind: "markdown" | "catalog" | "index" | "graph",
  ): ArtifactReference {
    if (Buffer.byteLength(value) > ARTIFACT_LIMITS[kind])
      throw new Error(
        `Retrieval ${kind} exceeds its ${ARTIFACT_LIMITS[kind]}-byte limit; refusing an unusable MCP deployment`,
      );
    const extension = kind === "markdown" ? "md" : "json";
    const hash = createHash("sha256").update(value).digest("hex");
    const reference = {
      path: `data/knowledge/${hash}.${extension}`,
      hash,
      bytes: Buffer.byteLength(value),
    };
    assets.set(reference.path, value);
    return reference;
  }
  const sorted = [...notes].sort((a, b) => compareText(a.id, b.id));
  const catalog: KnowledgeCatalog = {
    schemaVersion: 1,
    documents: sorted.map((note) => {
      const lines = note.source.split(/\r?\n/);
      return {
        id: note.id,
        title: note.title,
        path: note.path,
        aliases: note.aliases,
        tags: note.tags,
        types: note.types,
        markdownRef: emit(note.source, "markdown"),
        lineLengths: lines.map((line) => line.length),
      };
    }),
  };
  const core = {
    schemaVersion: 2 as const,
    analyzerVersion: ANALYZER_VERSION,
    site: graph.config.site,
    graphContentHash: graph.contentHash,
    catalog: emit(JSON.stringify(catalog), "catalog"),
    index: emit(buildSearchIndex(sorted.map(searchDocument)), "index"),
    graph: emit(JSON.stringify(graph), "graph"),
    noteCount: sorted.length,
    markdownBytes: catalog.documents.reduce((sum, doc) => sum + doc.markdownRef.bytes, 0),
  } satisfies Omit<KnowledgeManifest, "contentHash">;
  const manifest: KnowledgeManifest = {
    ...core,
    contentHash: createHash("sha256").update(JSON.stringify(core)).digest("hex"),
  };
  assets.set("data/knowledge.json", JSON.stringify(manifest));
}
