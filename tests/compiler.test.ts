import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VaultCompiler } from "../src/compiler/compile";
import { emitKnowledge } from "../src/compiler/knowledge";
import { parseNote } from "../src/compiler/parse";
import { sha256, verifyEnvelope } from "../src/mcp/artifacts";
import type {
  GraphManifest,
  KnowledgeCatalog,
  KnowledgeManifest,
  NodeDetails,
} from "../src/shared/contracts";

const workspaces: string[] = [];

async function fixture(files: Record<string, string>, exclude: string[] = []): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "rhizome-test-"));
  workspaces.push(root);
  await mkdir(path.join(root, "content"), { recursive: true });
  await writeFile(
    path.join(root, "rhizome.config.yaml"),
    `site:\n  title: Test\ncontent:\n  root: content\n  exclude: ${JSON.stringify(exclude)}\nrelations:\n  depends-on:\n    label: Depends on\n    inverseLabel: Dependency of\n    directed: true\n    color: "#d97757"\n  related-to:\n    label: Related to\n    directed: false\n    color: "#4f8fba"\n`,
  );
  await writeFile(
    path.join(root, "rhizome.schema.json"),
    await readFile(path.resolve("rhizome.schema.json"), "utf8"),
  );
  for (const [relative, source] of Object.entries(files)) {
    const absolute = path.join(root, "content", relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, source);
  }
  return root;
}

function manifestFrom(assets: Map<string, string | Uint8Array>): GraphManifest {
  return JSON.parse(String(assets.get("data/graph.json"))) as GraphManifest;
}

function knowledgeFrom(assets: Map<string, string | Uint8Array>): KnowledgeManifest {
  return JSON.parse(String(assets.get("data/knowledge.json"))) as KnowledgeManifest;
}

function semantic(manifest: GraphManifest) {
  return {
    nodes: manifest.nodes.map(({ x: _x, y: _y, community: _community, ...node }) => node),
    edges: manifest.edges,
    facets: manifest.facets,
    diagnostics: manifest.diagnostics,
  };
}

afterEach(async () => {
  await Promise.all(workspaces.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("vault compiler", () => {
  it("compiles Obsidian syntax, typed relations, provenance, callouts, and lazy details", async () => {
    const root = await fixture({
      "Alpha.md": `---\ntitle: Alpha\naliases: [First]\ntypes: [concept]\ntags: [Architecture]\ndepends-on: "[[folder/Beta]]"\n---\n# Alpha\n\n> [!note] Context\n> Evidence matters.\n\nSee [[Beta#Details|the detail]] and **GFM**. #compiler\n`,
      "folder/Beta.md": `---\ntitle: Beta\n---\n# Beta\n\n## Details\n\nA block. ^proof\n`,
    });
    const result = await new VaultCompiler({ projectRoot: root }).clean();
    const manifest = manifestFrom(result.assets);
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.config.relations["depends-on"].inverseLabel).toBe("Dependency of");
    expect(manifest.nodes.map((node) => node.id)).toEqual(["Alpha", "folder/Beta"]);
    expect(manifest.nodes.every((node) => !("z" in node))).toBe(true);
    expect(manifest.edges.map((edge) => edge.type).sort()).toEqual(["depends-on", "link"]);
    expect(manifest.facets.tags.architecture).toEqual(["Alpha"]);
    expect(manifest.facets.tags.compiler).toEqual(["Alpha"]);

    const alpha = manifest.nodes.find((node) => node.id === "Alpha");
    const beta = manifest.nodes.find((node) => node.id === "folder/Beta");
    expect(alpha?.degree).toBe(1);
    expect(beta?.degree).toBe(1);
    const details = JSON.parse(String(result.assets.get(alpha?.detailsRef ?? ""))) as NodeDetails;
    expect(details.html).toContain('class="callout callout-note"');
    expect(details.html).toContain("?note=folder%2FBeta");
    expect(details.outgoing).toHaveLength(2);
    expect(details.outgoing[0].range.startLine).toBeGreaterThan(1);
    expect(details.outgoing.every((item) => item.excerpt.length <= 240)).toBe(true);
  });

  it("renders sanitized inline and display math without requiring browser JavaScript", async () => {
    const root = await fixture({
      "Math.md": String.raw`# Math

Inline math uses $x^2 + y^2$.

$$
\operatorname{softmax}(z_i) = \frac{e^{z_i}}{\sum_j e^{z_j}}
$$

Malformed surrounding Markdown stays readable: $x + y.

[unsafe](javascript:alert(1))
`,
    });
    const result = await new VaultCompiler({ projectRoot: root }).clean();
    const manifest = manifestFrom(result.assets);
    const math = manifest.nodes.find((node) => node.id === "Math");
    const details = JSON.parse(String(result.assets.get(math?.detailsRef ?? ""))) as NodeDetails;

    expect(details.html).toContain('class="katex"');
    expect(details.html).toContain('class="katex-display"');
    expect(details.html).toContain("<math");
    expect(details.html).toContain("Malformed surrounding Markdown stays readable");
    expect(details.html).not.toContain("javascript:");
    expect(details.html).not.toContain("<script");
  });

  it("uses labels from Markdown-linked external relationship values", async () => {
    const root = await fixture({
      "Attention.md": `---\nrelated-to: "[Attention Is All You Need](https://arxiv.org/abs/1706.03762)"\n---\n# Attention\n`,
    });
    const manifest = manifestFrom((await new VaultCompiler({ projectRoot: root }).clean()).assets);
    const source = manifest.nodes.find((node) => node.kind === "external");

    expect(source?.title).toBe("Attention Is All You Need");
    expect(source?.path).toBe("https://arxiv.org/abs/1706.03762");
  });

  it("treats missing links as nodes and ambiguous links as fatal", async () => {
    const missingRoot = await fixture({ "A.md": "# A\n\n[[Absent]]\n" });
    const missing = manifestFrom(
      (await new VaultCompiler({ projectRoot: missingRoot }).clean()).assets,
    );
    expect(
      missing.nodes.some((node) => node.id === "missing:Absent" && node.kind === "missing"),
    ).toBe(true);
    expect(missing.diagnostics[0].code).toBe("missing-link");

    const ambiguousRoot = await fixture({
      "A.md": "# A\n\n[[Target]]\n",
      "one/Target.md": "# One\n",
      "two/Target.md": "# Two\n",
    });
    await expect(new VaultCompiler({ projectRoot: ambiguousRoot }).clean()).rejects.toThrow(
      "Ambiguous link",
    );
  });

  it("reparses only a changed note and matches a clean rebuild semantically", async () => {
    const root = await fixture({
      "A.md": "# A\n\n[[B]]\n",
      "B.md": "# B\n",
      "C.md": "# C\n",
    });
    const incrementalCompiler = new VaultCompiler({ projectRoot: root });
    await incrementalCompiler.clean();
    const changed = path.join(root, "content", "A.md");
    await writeFile(changed, "# A changed\n\n[[C]]\n");
    const incremental = await incrementalCompiler.update([changed]);
    const clean = await new VaultCompiler({ projectRoot: root }).clean();
    expect(incremental.parsedFiles).toEqual([changed]);
    expect(semantic(manifestFrom(incremental.assets))).toEqual(
      semantic(manifestFrom(clean.assets)),
    );
  });

  it("filters drafts before public indexes are constructed", async () => {
    const root = await fixture({
      "Public.md": "# Public\n\n[[Draft]]\n",
      "Draft.md": "---\ndraft: true\naliases: [Hidden]\n---\n# Draft\n",
    });
    const manifest = manifestFrom((await new VaultCompiler({ projectRoot: root }).clean()).assets);
    expect(manifest.nodes.some((node) => node.kind === "note" && node.id === "Draft")).toBe(false);
    expect(manifest.nodes.some((node) => node.kind === "missing" && node.title === "Draft")).toBe(
      true,
    );
  });

  it("emits exact public Markdown in a deterministic knowledge manifest", async () => {
    const publicSource = `---\ntitle: Public note\naliases: [Visible]\ntags: [Test]\n---\n# Public\n\nExact **Markdown**.\n`;
    const root = await fixture(
      {
        "a/First.md": "# First\n",
        "z/Public.md": publicSource,
        "Draft.md": "---\ndraft: true\n---\n# Private draft\n",
        "excluded/Secret.md": "# Excluded secret\n",
      },
      ["excluded/**"],
    );

    const first = await new VaultCompiler({ projectRoot: root }).clean();
    const second = await new VaultCompiler({ projectRoot: root }).clean();
    const graph = manifestFrom(first.assets);
    const knowledge = knowledgeFrom(first.assets);

    expect(knowledge).toEqual(knowledgeFrom(second.assets));
    expect(knowledge.schemaVersion).toBe(2);
    expect(knowledge.graphContentHash).toBe(graph.contentHash);
    const catalog: KnowledgeCatalog = JSON.parse(String(first.assets.get(knowledge.catalog.path)));
    expect(
      catalog.documents.map(({ markdownRef, lineLengths: _lines, ...doc }) => ({
        ...doc,
        markdown: first.assets.get(markdownRef.path),
      })),
    ).toEqual([
      {
        id: "a/First",
        title: "First",
        path: "a/First.md",
        aliases: [],
        types: ["note"],
        tags: [],
        markdown: "# First\n",
      },
      {
        id: "z/Public",
        title: "Public note",
        path: "z/Public.md",
        aliases: ["Visible"],
        types: ["note"],
        tags: ["test"],
        markdown: publicSource,
      },
    ]);
    expect(knowledge.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(knowledge.noteCount).toBe(2);
    const parsed = await Promise.all(
      catalog.documents.map((doc) =>
        parseNote(path.join(root, "content", doc.path), path.join(root, "content"), {
          site: { title: "Test" },
          content: { root: "content", exclude: [] },
          relations: {},
        }),
      ),
    );
    const relayout = structuredClone(graph);
    relayout.nodes[0].x += 100;
    relayout.diagnostics.push({
      severity: "warning",
      code: "layout-only",
      message: "Layout changed",
    });
    const { contentHash: _oldHash, ...relayoutCore } = relayout;
    relayout.contentHash = await sha256(JSON.stringify(relayoutCore));
    const relayoutAssets = new Map<string, string | Uint8Array>();
    emitKnowledge(parsed, relayout, relayoutAssets);
    const relayoutKnowledge = knowledgeFrom(relayoutAssets);
    expect(relayoutKnowledge.graph.hash).not.toBe(knowledge.graph.hash);
    expect(relayoutKnowledge.index.hash).toBe(knowledge.index.hash);
    expect(() =>
      emitKnowledge([{ ...parsed[0], source: "x".repeat(2 * 1024 * 1024 + 1) }], graph, new Map()),
    ).toThrow("byte limit");
    expect(JSON.stringify(knowledge).length).toBeLessThan(2048);
    await verifyEnvelope(String(first.assets.get("data/knowledge.json")));
    await verifyEnvelope(String(first.assets.get(knowledge.graph.path)));
    for (const ref of [
      knowledge.catalog,
      knowledge.index,
      knowledge.graph,
      ...catalog.documents.map((doc) => doc.markdownRef),
    ]) {
      expect(await sha256(String(first.assets.get(ref.path)))).toBe(ref.hash);
      expect(Buffer.byteLength(String(first.assets.get(ref.path)))).toBe(ref.bytes);
      expect(first.assets.get(ref.path)).toEqual(second.assets.get(ref.path));
    }

    await writeFile(
      path.join(root, "content", "z/Public.md"),
      publicSource.replace("Exact **Markdown**.", "Changed **Markdown**."),
    );
    const changedAssets = (await new VaultCompiler({ projectRoot: root }).clean()).assets;
    const changed = knowledgeFrom(changedAssets);
    expect(changed.contentHash).not.toBe(knowledge.contentHash);
    expect(changed.index.hash).not.toBe(knowledge.index.hash);
    const changedCatalog: KnowledgeCatalog = JSON.parse(
      String(changedAssets.get(changed.catalog.path)),
    );
    const changedDoc = changedCatalog.documents.find((doc) => doc.id === "z/Public");
    expect(changedDoc).toBeDefined();
    if (!changedDoc) throw new Error("Changed document missing");
    expect(changedAssets.get(changedDoc.markdownRef.path)).toContain("Changed **Markdown**.");
  });

  it("keeps the demonstration vault resolved, connected, and reachable from the LLM", async () => {
    const result = await new VaultCompiler({ projectRoot: path.resolve(".") }).clean();
    const manifest = manifestFrom(result.assets);
    const notes = manifest.nodes.filter((node) => node.kind === "note");
    const internalEdges = manifest.edges.filter(
      (edge) => !edge.source.startsWith("external:") && !edge.target.startsWith("external:"),
    );

    expect(notes).toHaveLength(100);
    expect(manifest.nodes).toHaveLength(notes.length);
    expect(manifest.nodes.some((node) => node.kind === "missing")).toBe(false);
    expect(manifest.diagnostics).toEqual([]);
    expect(
      manifest.nodes
        .filter((node) => {
          const details = JSON.parse(String(result.assets.get(node.detailsRef))) as NodeDetails;
          return !details.html?.trim();
        })
        .map((node) => node.id),
    ).toEqual([]);
    expect(internalEdges.length).toBeGreaterThanOrEqual(250);
    expect(internalEdges.length).toBeLessThanOrEqual(375);
    expect(notes.every((node) => node.degree > 0)).toBe(true);

    const outgoing = new Map<string, string[]>();
    for (const edge of manifest.edges) {
      const targets = outgoing.get(edge.source) ?? [];
      targets.push(edge.target);
      outgoing.set(edge.source, targets);
    }
    const reachable = new Set(["Modern large language model"]);
    const queue = [...reachable];
    while (queue.length) {
      for (const target of outgoing.get(queue.shift() ?? "") ?? []) {
        if (reachable.has(target)) continue;
        reachable.add(target);
        queue.push(target);
      }
    }

    expect(
      notes
        .filter((node) => !node.types.includes("map"))
        .filter((node) => !reachable.has(node.id))
        .map((node) => node.id),
    ).toEqual([]);
  });
});
