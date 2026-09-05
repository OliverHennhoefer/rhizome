import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, vi } from "vitest";
import { VaultCompiler } from "../src/compiler/compile";
import { RemoteKnowledgeSource } from "../src/mcp/source";
import { KnowledgeCatalogSchema, KnowledgeManifestSchema } from "../src/shared/artifact-schemas";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
export async function knowledgeFixture(files: Record<string, string>) {
  const root = await mkdtemp(path.join(tmpdir(), "rhizome-retrieval-"));
  roots.push(root);
  await writeFile(
    path.join(root, "rhizome.schema.json"),
    await readFile("rhizome.schema.json", "utf8"),
  );
  await writeFile(
    path.join(root, "rhizome.config.yaml"),
    `site:\n  title: Test vault\ncontent:\n  root: content\n  exclude: [excluded/**]\nrelations:\n  depends-on:\n    label: Depends on\n    inverseLabel: Dependency of\n    directed: true\n    color: '#000000'\n  related-to:\n    label: Related to\n    directed: false\n    color: '#000000'\n  supported-by:\n    label: Supported by\n    inverseLabel: Supports\n    directed: true\n    color: '#000000'\n`,
  );
  await mkdir(path.join(root, "content"));
  for (const [name, text] of Object.entries(files)) {
    const absolute = path.join(root, "content", name);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, text);
  }
  const compiler = new VaultCompiler({ projectRoot: root });
  const assets = (await compiler.clean()).assets;
  const manifest = KnowledgeManifestSchema.parse(
    JSON.parse(String(assets.get("data/knowledge.json"))),
  );
  const catalog = KnowledgeCatalogSchema.parse(
    JSON.parse(String(assets.get(manifest.catalog.path))),
  );
  const requests: string[] = [];
  const fetcher = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const key = url.pathname.replace(/^\/rhizome\//, "");
    requests.push(key);
    const value = assets.get(key);
    return new Response(
      value === undefined ? "Not found" : typeof value === "string" ? value : new Uint8Array(value),
      { status: value === undefined ? 404 : 200 },
    );
  });
  let time = 0;
  const source = new RemoteKnowledgeSource("https://example.com/rhizome/", fetcher, () => time);
  return {
    root,
    compiler,
    assets,
    manifest,
    catalog,
    requests,
    fetcher,
    source,
    advance: () => {
      time += 60_001;
    },
  };
}
