import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Worker } from "node:worker_threads";
import { gzipSync } from "node:zlib";
import { build as bundle } from "esbuild";
import Graph from "graphology";
import louvain from "graphology-communities-louvain";
import forceAtlas2 from "graphology-layout-forceatlas2";
import picomatch from "picomatch";
import type {
  BuildDiagnostic,
  EdgeEvidence,
  GraphEdge,
  GraphManifest,
  GraphNode,
  NodeDetails,
} from "../shared/contracts";
import { loadConfig } from "./config";
import { parseNote } from "./parse";
import { renderNote } from "./render";
import { assertNoCaseCollisions, ResolutionError, ResourceIndex } from "./resolve";
import type { CompilationResult, ParsedNote, ResolvedOccurrence, RhizomeConfig } from "./types";

const IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);
const MAX_PAGES_BYTES = 900 * 1024 * 1024;
const MANIFEST_GZIP_TARGET = 6 * 1024 * 1024;
const workerBundles = new Map<string, Promise<string>>();

interface CompileOptions {
  projectRoot?: string;
  configPath?: string;
  incremental?: boolean;
  changedPaths?: string[];
}

interface EdgeAccumulator {
  id: string;
  source: string;
  target: string;
  type: string;
  directed: boolean;
  evidence: EdgeEvidence[];
}

interface InternalBuild {
  result: CompilationResult;
  manifest: GraphManifest;
}

function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

function stableId(prefix: string, input: string): string {
  return `${prefix}:${sha256(input).slice(0, 16)}`;
}

function seededRandom(seed: string): () => number {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) || 1;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

async function parseWithWorkers(
  files: string[],
  vaultRoot: string,
  config: RhizomeConfig,
  projectRoot: string,
): Promise<ParsedNote[]> {
  const batches: string[][] = [];
  for (let index = 0; index < files.length; index += 128)
    batches.push(files.slice(index, index + 128));
  const workerCount = Math.min(4, batches.length);
  const results = new Map<number, ParsedNote[]>();
  let nextBatch = 0;
  let workerBundle = workerBundles.get(projectRoot);
  if (!workerBundle) {
    workerBundle = (async () => {
      const cacheDirectory = path.join(projectRoot, ".rhizome-cache");
      const output = path.join(cacheDirectory, "parse-worker.cjs");
      await mkdir(cacheDirectory, { recursive: true });
      await bundle({
        entryPoints: [path.resolve(process.cwd(), "src/compiler/parse-worker.ts")],
        outfile: output,
        bundle: true,
        platform: "node",
        format: "cjs",
        target: "node22",
        sourcemap: "inline",
      });
      return output;
    })();
    workerBundles.set(projectRoot, workerBundle);
  }
  const workerPath = await workerBundle;

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      const worker = new Worker(workerPath);
      try {
        while (nextBatch < batches.length) {
          const index = nextBatch;
          nextBatch += 1;
          const notes = await new Promise<ParsedNote[]>((resolve, reject) => {
            const message = (payload: { notes?: ParsedNote[]; error?: string }) => {
              cleanup();
              if (payload.error) reject(new Error(payload.error));
              else resolve(payload.notes ?? []);
            };
            const failure = (error: Error) => {
              cleanup();
              reject(error);
            };
            const cleanup = () => {
              worker.off("message", message);
              worker.off("error", failure);
            };
            worker.on("message", message);
            worker.on("error", failure);
            worker.postMessage({ files: batches[index], vaultRoot, config });
          });
          results.set(index, notes);
        }
      } finally {
        await worker.terminate();
      }
    }),
  );
  return [...results.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([, notes]) => notes);
}

function titleForExternal(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return url;
  }
}

function normalizeMissingTarget(target: string): string {
  return target.replace(/\\/g, "/").replace(/\.md$/i, "").replace(/^\/+/, "");
}

function edgeKey(source: string, target: string, type: string, directed: boolean): string {
  if (!directed && source.localeCompare(target) > 0) return `${target}\0${source}\0${type}\0${"0"}`;
  return `${source}\0${target}\0${type}\0${directed ? "1" : "0"}`;
}

function edgeEndpoints(
  source: string,
  target: string,
  directed: boolean,
): { source: string; target: string } {
  if (!directed && source.localeCompare(target) > 0) return { source: target, target: source };
  return { source, target };
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

async function discover(
  vaultRoot: string,
  excludes: string[],
): Promise<{ markdown: string[]; media: string[] }> {
  const ignored = picomatch(excludes, { dot: true });
  const markdown: string[] = [];
  const media: string[] = [];
  for (const absolute of await walk(vaultRoot)) {
    const relative = path.relative(vaultRoot, absolute).split(path.sep).join("/");
    if (ignored(relative)) continue;
    const extension = path.extname(relative).toLocaleLowerCase();
    if (extension === ".md") markdown.push(absolute);
    else if (IMAGE_EXTENSIONS.has(extension)) media.push(absolute);
  }
  return { markdown, media };
}

async function mediaAssets(
  vaultRoot: string,
  mediaFiles: string[],
): Promise<{ assets: Map<string, Uint8Array>; lookup: Map<string, string> }> {
  const assets = new Map<string, Uint8Array>();
  const lookup = new Map<string, string>();
  for (const absolute of mediaFiles) {
    const bytes = new Uint8Array(await readFile(absolute));
    const relative = path.relative(vaultRoot, absolute).split(path.sep).join("/");
    const output = `media/${sha256(bytes).slice(0, 20)}${path.extname(relative).toLocaleLowerCase()}`;
    assets.set(output, bytes);
    lookup.set(relative.toLocaleLowerCase(), output);
  }
  return { assets, lookup };
}

function isExternalRelation(
  occurrence: ResolvedOccurrence | ParsedNote["occurrences"][number],
): boolean {
  return occurrence.origin === "frontmatter" && /^https?:\/\//i.test(occurrence.target);
}

function isImageOccurrence(occurrence: ParsedNote["occurrences"][number]): boolean {
  return (
    occurrence.embedded &&
    IMAGE_EXTENSIONS.has(path.posix.extname(occurrence.target).toLocaleLowerCase())
  );
}

function resolveAll(
  notes: ParsedNote[],
  index: ResourceIndex,
  config: RhizomeConfig,
  diagnostics: BuildDiagnostic[],
): { occurrences: ResolvedOccurrence[]; extraNodes: Map<string, GraphNode> } {
  const occurrences: ResolvedOccurrence[] = [];
  const extraNodes = new Map<string, GraphNode>();
  const missingByFoldedTarget = new Map<string, string>();

  for (const note of notes) {
    for (const occurrence of note.occurrences) {
      if (isImageOccurrence(occurrence)) continue;
      let targetId: string;
      if (isExternalRelation(occurrence)) {
        const id = stableId("external", occurrence.target);
        targetId = id;
        if (!extraNodes.has(id)) {
          extraNodes.set(id, {
            id,
            kind: "external",
            title: titleForExternal(occurrence.target),
            path: occurrence.target,
            aliases: [],
            types: ["external"],
            tags: [],
            detailsRef: "",
            x: 0,
            y: 0,
            community: 0,
            degree: 0,
          });
        }
      } else {
        const resolved = index.resolve(note.id, occurrence);
        if (resolved) {
          targetId = resolved;
        } else {
          const target = normalizeMissingTarget(occurrence.target);
          const folded = target.toLocaleLowerCase();
          targetId = missingByFoldedTarget.get(folded) ?? `missing:${target}`;
          missingByFoldedTarget.set(folded, targetId);
          if (!extraNodes.has(targetId)) {
            extraNodes.set(targetId, {
              id: targetId,
              kind: "missing",
              title: path.posix.basename(target) || "Missing note",
              aliases: [],
              types: ["missing"],
              tags: [],
              detailsRef: "",
              x: 0,
              y: 0,
              community: 0,
              degree: 0,
            });
            diagnostics.push({
              severity: "warning",
              code: "missing-link",
              message: `${note.id} links to missing target "${occurrence.target}"`,
              path: note.path,
              line: occurrence.range.startLine,
            });
          }
        }
      }

      if (occurrence.type !== "link" && !config.relations[occurrence.type]) continue;
      occurrences.push({ ...occurrence, source: note.id, targetId });
    }
  }
  return { occurrences, extraNodes };
}

function buildEdges(
  resolved: ResolvedOccurrence[],
  config: RhizomeConfig,
): { edges: GraphEdge[]; evidence: EdgeEvidence[] } {
  const accumulators = new Map<string, EdgeAccumulator>();
  for (const occurrence of resolved) {
    const directed = occurrence.type === "link" ? true : config.relations[occurrence.type].directed;
    const endpoints = edgeEndpoints(occurrence.source, occurrence.targetId, directed);
    const key = edgeKey(endpoints.source, endpoints.target, occurrence.type, directed);
    const edgeId = stableId("edge", key);
    const accumulator = accumulators.get(key) ?? {
      id: edgeId,
      ...endpoints,
      type: occurrence.type,
      directed,
      evidence: [],
    };
    accumulator.evidence.push({
      edgeId,
      source: occurrence.source,
      target: occurrence.targetId,
      type: occurrence.type,
      origin: occurrence.origin,
      anchor: occurrence.anchor,
      range: occurrence.range,
      excerpt: occurrence.excerpt.slice(0, 240),
    });
    accumulators.set(key, accumulator);
  }

  const values = [...accumulators.values()].sort((a, b) => a.id.localeCompare(b.id));
  return {
    edges: values.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type,
      directed: edge.directed,
      occurrences: edge.evidence.length,
    })),
    evidence: values.flatMap((edge) => edge.evidence),
  };
}

function initialCoordinate(id: string): { x: number; y: number } {
  const random = seededRandom(id);
  const angle = random() * Math.PI * 2;
  const radius = 1 + random() * 4;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function layout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  previous: Map<string, { x: number; y: number; community: number }> | undefined,
  incremental: boolean,
): void {
  const graph = new Graph({ type: "undirected", multi: false, allowSelfLoops: false });
  for (const node of nodes) {
    const coordinate = previous?.get(node.id) ?? initialCoordinate(node.id);
    graph.addNode(node.id, { x: coordinate.x, y: coordinate.y, size: 1 });
  }
  const physicalPairs = new Map<string, { source: string; target: string }>();
  for (const edge of edges) {
    if (edge.source === edge.target || !graph.hasNode(edge.source) || !graph.hasNode(edge.target))
      continue;
    const [source, target] =
      edge.source.localeCompare(edge.target) <= 0
        ? [edge.source, edge.target]
        : [edge.target, edge.source];
    physicalPairs.set(JSON.stringify([source, target]), { source, target });
  }
  for (const [pair, { source, target }] of [...physicalPairs].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    graph.addUndirectedEdgeWithKey(stableId("layout-edge", pair), source, target, { weight: 1 });
  }
  graph.updateEachNodeAttributes(
    (id, attributes) => ({
      ...attributes,
      size: Math.min(6, 1.5 + Math.sqrt(graph.degree(id)) * 0.4),
    }),
    { attributes: ["size"] },
  );

  let communities: Record<string, number> = {};
  if (graph.order > 1 && graph.size > 0) {
    communities = louvain(graph, { rng: seededRandom("rhizome-communities") });
    if (!incremental) {
      const inferred = forceAtlas2.inferSettings(graph);
      forceAtlas2.assign(graph, {
        iterations: Math.min(320, 100 + Math.ceil(Math.log2(graph.order + 1) * 22)),
        settings: {
          ...inferred,
          adjustSizes: true,
          barnesHutOptimize: graph.order > 100,
          gravity: 0.08,
          outboundAttractionDistribution: true,
          scalingRatio: Math.max(12, Math.log2(graph.order + 1) * 2),
          slowDown: Math.max(5, inferred.slowDown ?? 5),
          strongGravityMode: false,
        },
      });
    }
  }

  for (const node of nodes) {
    const attributes = graph.getNodeAttributes(node.id);
    const preserved = incremental ? previous?.get(node.id) : undefined;
    const community = communities[node.id] ?? preserved?.community ?? 0;
    node.x = preserved?.x ?? attributes.x ?? 0;
    node.y = preserved?.y ?? attributes.y ?? 0;
    node.community = community;
    node.degree = graph.hasNode(node.id) ? graph.degree(node.id) : 0;
  }
}

function facets(nodes: GraphNode[], edges: GraphEdge[]): GraphManifest["facets"] {
  const output: GraphManifest["facets"] = { tags: {}, types: {}, relations: {} };
  const push = (group: Record<string, string[]>, key: string, value: string) => {
    const values = group[key] ?? [];
    values.push(value);
    group[key] = values;
  };
  for (const node of nodes) {
    for (const tag of node.tags) push(output.tags, tag, node.id);
    for (const type of node.types) push(output.types, type, node.id);
  }
  for (const edge of edges) push(output.relations, edge.type, edge.id);
  for (const group of [output.tags, output.types, output.relations]) {
    for (const values of Object.values(group)) values.sort((a, b) => a.localeCompare(b));
  }
  return output;
}

function groupEvidence(
  evidence: EdgeEvidence[],
): Map<string, Pick<NodeDetails, "incoming" | "outgoing">> {
  const groups = new Map<string, Pick<NodeDetails, "incoming" | "outgoing">>();
  const get = (nodeId: string) => {
    const group = groups.get(nodeId) ?? { incoming: [], outgoing: [] };
    groups.set(nodeId, group);
    return group;
  };
  for (const item of evidence) {
    get(item.source).outgoing.push(item);
    get(item.target).incoming.push(item);
  }
  return groups;
}

function previousCoordinates(manifest: GraphManifest | undefined) {
  if (!manifest) return undefined;
  return new Map(
    manifest.nodes.map((node) => [node.id, { x: node.x, y: node.y, community: node.community }]),
  );
}

export class VaultCompiler {
  private readonly projectRoot: string;
  private readonly configPath: string;
  private parsed = new Map<string, ParsedNote>();
  private mtimes = new Map<string, number>();
  private html = new Map<string, string>();
  private outgoingLinks = new Map<string, Set<string>>();
  private backlinks = new Map<string, Set<string>>();
  private lastManifest?: GraphManifest;

  constructor(options: Pick<CompileOptions, "projectRoot" | "configPath"> = {}) {
    this.projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    this.configPath = options.configPath ?? "rhizome.config.yaml";
  }

  async clean(): Promise<CompilationResult> {
    this.parsed.clear();
    this.mtimes.clear();
    this.html.clear();
    this.outgoingLinks.clear();
    this.backlinks.clear();
    this.lastManifest = undefined;
    return (await this.build(false)).result;
  }

  async update(changedPaths: string[] = []): Promise<CompilationResult> {
    return (await this.build(true, changedPaths)).result;
  }

  private async build(incremental: boolean, changedPaths: string[] = []): Promise<InternalBuild> {
    const config = await loadConfig(this.projectRoot, this.configPath);
    const vaultRoot = path.resolve(this.projectRoot, config.content.root);
    const discovered = await discover(vaultRoot, config.content.exclude);
    const current = new Set(discovered.markdown);
    const previousNotes = new Map(this.parsed);
    let resolutionIndexChanged = [...this.parsed.keys()].some((cached) => !current.has(cached));
    const explicitlyChanged = new Set(changedPaths.map((item) => path.resolve(item)));
    const parsedFiles: string[] = [];

    for (const cached of this.parsed.keys()) {
      if (!current.has(cached)) {
        this.parsed.delete(cached);
        this.mtimes.delete(cached);
      }
    }

    const toParse: string[] = [];
    for (const absolute of discovered.markdown) {
      const modified = (await stat(absolute)).mtimeMs;
      if (
        incremental &&
        !explicitlyChanged.has(absolute) &&
        this.parsed.has(absolute) &&
        this.mtimes.get(absolute) === modified
      )
        continue;
      if (!this.parsed.has(absolute)) resolutionIndexChanged = true;
      toParse.push(absolute);
      this.mtimes.set(absolute, modified);
    }
    const newlyParsed =
      discovered.markdown.length < 256
        ? await Promise.all(toParse.map((absolute) => parseNote(absolute, vaultRoot, config)))
        : await parseWithWorkers(toParse, vaultRoot, config, this.projectRoot);
    for (const note of newlyParsed) {
      const previous = previousNotes.get(note.absolutePath);
      if (
        previous &&
        (previous.draft !== note.draft ||
          previous.permalink !== note.permalink ||
          previous.aliases.join("\0") !== note.aliases.join("\0"))
      ) {
        resolutionIndexChanged = true;
      }
      this.parsed.set(note.absolutePath, note);
      this.html.delete(note.id);
      parsedFiles.push(note.absolutePath);
    }
    if (changedPaths.some((changed) => path.extname(changed).toLocaleLowerCase() !== ".md")) {
      this.html.clear();
    }
    if (resolutionIndexChanged) this.html.clear();

    const notes = [...this.parsed.values()]
      .filter((note) => !note.draft)
      .sort((a, b) => a.id.localeCompare(b.id));
    assertNoCaseCollisions(notes);
    const index = new ResourceIndex(notes);
    const diagnostics: BuildDiagnostic[] = [];
    const media = await mediaAssets(vaultRoot, discovered.media);
    const resolved = resolveAll(notes, index, config, diagnostics);
    this.outgoingLinks = new Map();
    this.backlinks = new Map();
    for (const occurrence of resolved.occurrences) {
      const outgoing = this.outgoingLinks.get(occurrence.source) ?? new Set<string>();
      outgoing.add(occurrence.targetId);
      this.outgoingLinks.set(occurrence.source, outgoing);
      const incoming = this.backlinks.get(occurrence.targetId) ?? new Set<string>();
      incoming.add(occurrence.source);
      this.backlinks.set(occurrence.targetId, incoming);
    }
    const builtEdges = buildEdges(resolved.occurrences, config);

    const nodes: GraphNode[] = [
      ...notes.map<GraphNode>((note) => ({
        id: note.id,
        kind: "note",
        title: note.title,
        path: note.path,
        aliases: note.aliases,
        types: note.types,
        tags: note.tags,
        detailsRef: "",
        x: 0,
        y: 0,
        community: 0,
        degree: 0,
      })),
      ...resolved.extraNodes.values(),
    ].sort((a, b) => a.id.localeCompare(b.id));

    layout(nodes, builtEdges.edges, previousCoordinates(this.lastManifest), incremental);
    const assets = new Map<string, string | Uint8Array>(media.assets);
    const notesById = new Map(notes.map((note) => [note.id, note]));
    const evidenceByNode = groupEvidence(builtEdges.evidence);
    for (const node of nodes) {
      const note = notesById.get(node.id);
      let html = note ? this.html.get(note.id) : undefined;
      if (note && !html) {
        html = await renderNote(note, index, media.lookup);
        this.html.set(note.id, html);
      }
      const details: NodeDetails = {
        schemaVersion: 1,
        id: node.id,
        ...(html ? { html } : {}),
        ...(evidenceByNode.get(node.id) ?? { incoming: [], outgoing: [] }),
      };
      const json = JSON.stringify(details);
      node.detailsRef = `data/details/${sha256(json).slice(0, 24)}.json`;
      assets.set(node.detailsRef, json);
    }

    const manifestCore = {
      schemaVersion: 2 as const,
      config: {
        site: config.site,
        relations: config.relations,
      },
      nodes,
      edges: builtEdges.edges,
      facets: facets(nodes, builtEdges.edges),
      diagnostics,
    };
    const manifest: GraphManifest = {
      ...manifestCore,
      contentHash: sha256(JSON.stringify(manifestCore)),
    };
    const manifestJson = JSON.stringify(manifest);
    if (gzipSync(manifestJson).byteLength > MANIFEST_GZIP_TARGET) {
      diagnostics.push({
        severity: "warning",
        code: "manifest-budget",
        message: "Compressed graph manifest exceeds the 6 MB benchmark target",
      });
    }
    assets.set("data/graph.json", JSON.stringify(manifest));
    assets.set(".nojekyll", "");

    const totalBytes = [...assets.values()].reduce(
      (sum, value) =>
        sum + (typeof value === "string" ? Buffer.byteLength(value) : value.byteLength),
      0,
    );
    if (totalBytes > MAX_PAGES_BYTES) {
      throw new Error(
        `Generated site is ${(totalBytes / 1024 / 1024).toFixed(1)} MB; refusing Pages deploy`,
      );
    }
    this.lastManifest = manifest;
    return { result: { assets, diagnostics, parsedFiles }, manifest };
  }
}

export async function compileVault(options: CompileOptions = {}): Promise<CompilationResult> {
  try {
    const compiler = new VaultCompiler(options);
    return options.incremental ? compiler.update(options.changedPaths) : compiler.clean();
  } catch (error) {
    if (error instanceof ResolutionError) {
      throw new Error(`${error.diagnostic.path ?? "content"}: ${error.message}`, { cause: error });
    }
    throw error;
  }
}
