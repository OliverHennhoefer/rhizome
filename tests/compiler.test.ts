import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { VaultCompiler } from "../src/compiler/compile";
import type { GraphManifest, NodeDetails } from "../src/shared/contracts";

const workspaces: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "rhizome-test-"));
  workspaces.push(root);
  await mkdir(path.join(root, "content"), { recursive: true });
  await writeFile(
    path.join(root, "rhizome.config.yaml"),
    `site:\n  title: Test\ncontent:\n  root: content\n  exclude: []\nrelations:\n  depends-on:\n    label: Depends on\n    directed: true\n    color: "#d97757"\n  related-to:\n    label: Related to\n    directed: false\n    color: "#4f8fba"\n`,
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
    expect(manifest.nodes.map((node) => node.id)).toEqual(["Alpha", "folder/Beta"]);
    expect(manifest.nodes.every((node) => !("z" in node))).toBe(true);
    expect(manifest.edges.map((edge) => edge.type).sort()).toEqual(["depends-on", "link"]);
    expect(manifest.facets.tags.architecture).toEqual(["Alpha"]);
    expect(manifest.facets.tags.compiler).toEqual(["Alpha"]);

    const alpha = manifest.nodes.find((node) => node.id === "Alpha");
    const details = JSON.parse(String(result.assets.get(alpha?.detailsRef ?? ""))) as NodeDetails;
    expect(details.html).toContain('class="callout callout-note"');
    expect(details.html).toContain("?note=folder%2FBeta");
    expect(details.outgoing).toHaveLength(2);
    expect(details.outgoing[0].range.startLine).toBeGreaterThan(1);
    expect(details.outgoing.every((item) => item.excerpt.length <= 240)).toBe(true);
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
});
