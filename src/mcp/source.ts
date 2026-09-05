import {
  ARTIFACT_LIMITS,
  GraphManifestSchema,
  KnowledgeCatalogSchema,
  KnowledgeManifestSchema,
  NodeDetailsSchema,
} from "../shared/artifact-schemas.ts";
import type {
  KnowledgeCatalog,
  KnowledgeDocument,
  KnowledgeManifest,
} from "../shared/contracts.ts";
import { ArtifactLoader, parseArtifact, verifyEnvelope } from "./artifacts.ts";
import { browseCatalog } from "./browse.ts";
import { invalidArtifact, KnowledgeError } from "./errors.ts";
import { GraphQueries } from "./graph.ts";
import { NoteSearch } from "./search.ts";
import type { BrowseInput, ContextInput, KnowledgeReader, SearchOutput } from "./tool-contracts.ts";
import { noteUrl } from "./urls.ts";

const MANIFEST_TTL = 60_000;
export class KnowledgeSnapshot implements KnowledgeReader {
  private readonly documents: Map<string, KnowledgeDocument>;
  private graph?: Promise<GraphQueries>;
  constructor(
    readonly manifest: KnowledgeManifest,
    readonly catalog: KnowledgeCatalog,
    private readonly loader: ArtifactLoader,
    private readonly runSearch: (
      snapshot: KnowledgeSnapshot,
      query: string,
    ) => Promise<SearchOutput>,
  ) {
    this.documents = new Map(catalog.documents.map((doc) => [doc.id, doc]));
    if (
      this.documents.size !== catalog.documents.length ||
      catalog.documents.length !== manifest.noteCount ||
      new Set(catalog.documents.map((doc) => doc.path)).size !== catalog.documents.length ||
      catalog.documents.some(
        (doc) => doc.path.slice(0, -3) !== doc.id || !/\.md$/i.test(doc.path),
      ) ||
      catalog.documents.reduce((sum, doc) => sum + doc.markdownRef.bytes, 0) !==
        manifest.markdownBytes
    )
      invalidArtifact("Catalog IDs, paths or counts are invalid");
  }
  private requireDocument(id: string): KnowledgeDocument {
    const document = this.documents.get(id);
    if (!document)
      throw new KnowledgeError("UNKNOWN_ID", `Note "${id}" was not found; use search or browse`);
    return document;
  }
  search(query: string): Promise<SearchOutput> {
    return this.runSearch(this, query);
  }
  async fetch(id: string) {
    const doc = this.requireDocument(id);
    const text = await this.loader.artifact(doc.markdownRef, ARTIFACT_LIMITS.markdown, true);
    return {
      id,
      title: doc.title,
      text,
      url: noteUrl(this.loader.site, id),
      metadata: {
        path: doc.path,
        aliases: doc.aliases,
        tags: doc.tags,
        types: doc.types,
        contentHash: doc.markdownRef.hash,
      },
    };
  }
  async browse(input: BrowseInput) {
    return browseCatalog(this.catalog, this.manifest, this.loader.site, input);
  }
  async context(input: ContextInput) {
    this.requireDocument(input.id);
    this.graph ??= this.loadGraph().catch((error) => {
      this.graph = undefined;
      throw error;
    });
    const graph = await this.graph;
    const text = await this.loader.text(
      graph.detailsReference(input.id),
      ARTIFACT_LIMITS.detail,
      true,
    );
    return graph.context(this.manifest.contentHash, input, parseArtifact(text, NodeDetailsSchema));
  }
  private async loadGraph(): Promise<GraphQueries> {
    const text = await this.loader.artifact(this.manifest.graph, ARTIFACT_LIMITS.graph);
    // The full-byte SHA-256 reference already authenticates this immutable graph.
    // Re-parsing/stringifying its inner envelope duplicates the largest artifact.
    const graph = parseArtifact(text, GraphManifestSchema);
    if (graph.contentHash !== this.manifest.graphContentHash)
      invalidArtifact("Graph snapshot hash disagrees with knowledge manifest");
    return new GraphQueries(graph, this.catalog, this.loader.site);
  }
  health() {
    return {
      status: "ok" as const,
      source: this.loader.site,
      knowledgeHash: this.manifest.contentHash,
      graphHash: this.manifest.graphContentHash,
      indexHash: this.manifest.index.hash,
      notes: this.manifest.noteCount,
    };
  }
}

export class RemoteKnowledgeSource {
  readonly loader: ArtifactLoader;
  private current?: KnowledgeSnapshot;
  private expiresAt = 0;
  private loading?: Promise<KnowledgeSnapshot>;
  private index?: { key: string; value: NoteSearch };
  private searchQueue: Promise<unknown> = Promise.resolve();
  constructor(
    site: string,
    fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    this.loader = new ArtifactLoader(site, fetcher);
  }
  async get(): Promise<KnowledgeSnapshot> {
    if (this.current && this.now() < this.expiresAt) return this.current;
    if (this.loading) return this.loading;
    const pending = this.refresh();
    this.loading = pending;
    try {
      const snapshot = await pending;
      this.current = snapshot;
      this.expiresAt = this.now() + MANIFEST_TTL;
      return snapshot;
    } finally {
      if (this.loading === pending) this.loading = undefined;
    }
  }
  async read<T>(operation: (reader: KnowledgeReader) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await operation(await this.get());
      } catch (error) {
        if (
          attempt ||
          !(error instanceof KnowledgeError) ||
          !["INVALID_ARTIFACT", "SOURCE_UNAVAILABLE"].includes(error.code)
        )
          throw error;
        this.expiresAt = 0;
      }
    }
  }
  private async refresh(): Promise<KnowledgeSnapshot> {
    const text = await this.loader.text(
      "data/knowledge.json",
      ARTIFACT_LIMITS.manifest,
      false,
      true,
    );
    await verifyEnvelope(text);
    const manifest = parseArtifact(text, KnowledgeManifestSchema);
    if (manifest.contentHash === this.current?.manifest.contentHash) return this.current;
    const catalog = parseArtifact(
      await this.loader.artifact(manifest.catalog, ARTIFACT_LIMITS.catalog),
      KnowledgeCatalogSchema,
    );
    return new KnowledgeSnapshot(manifest, catalog, this.loader, (snapshot, query) =>
      this.search(snapshot, query),
    );
  }
  private search(snapshot: KnowledgeSnapshot, query: string): Promise<SearchOutput> {
    // Only one hydrated index can exist. Loading and synchronous queries share
    // this queue, so refresh never constructs a second index alongside the old one.
    const pending = this.searchQueue
      .catch(() => {})
      .then(async () => {
        const key = `${snapshot.manifest.index.hash}:${snapshot.manifest.catalog.hash}`;
        if (this.index?.key !== key) {
          this.index = undefined;
          const text = await this.loader.artifact(snapshot.manifest.index, ARTIFACT_LIMITS.index);
          this.index = {
            key,
            value: new NoteSearch(text, snapshot.catalog.documents, this.loader.site),
          };
        }
        return this.index.value.search(query);
      });
    this.searchQueue = pending;
    return pending;
  }
}
