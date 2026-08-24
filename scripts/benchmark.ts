import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { VaultCompiler } from "../src/compiler/compile";

const NOTE_COUNT = 10_000;
const EDGE_COUNT = 75_000;
const root = await mkdtemp(path.join(tmpdir(), "rhizome-benchmark-"));
const content = path.join(root, "content");
await mkdir(content);
await writeFile(
  path.join(root, "rhizome.config.yaml"),
  `site:\n  title: Benchmark\ncontent:\n  root: content\n  exclude: []\nrelations: {}\n`,
);
await writeFile(
  path.join(root, "rhizome.schema.json"),
  await readFile(path.resolve("rhizome.schema.json"), "utf8"),
);

try {
  const writes: Promise<void>[] = [];
  for (let index = 0; index < NOTE_COUNT; index += 1) {
    const linkCount =
      Math.floor(EDGE_COUNT / NOTE_COUNT) + (index < EDGE_COUNT % NOTE_COUNT ? 1 : 0);
    const links = Array.from(
      { length: linkCount },
      (_, offset) => `[[Note ${String((index + offset + 1) % NOTE_COUNT).padStart(5, "0")}]]`,
    ).join("\n");
    writes.push(
      writeFile(
        path.join(content, `Note ${String(index).padStart(5, "0")}.md`),
        `---\ntags: [cluster-${index % 20}]\n---\n# Note ${index}\n\n${links}\n`,
      ),
    );
    if (writes.length === 256) await Promise.all(writes.splice(0));
  }
  await Promise.all(writes);
  const compiler = new VaultCompiler({ projectRoot: root });
  const started = performance.now();
  const result = await compiler.clean();
  const elapsed = performance.now() - started;
  const changedPath = path.join(content, "Note 00000.md");
  await writeFile(
    changedPath,
    `---\ntags: [cluster-0]\n---\n# Note 0 changed\n\n${Array.from(
      { length: Math.floor(EDGE_COUNT / NOTE_COUNT) + 1 },
      (_, offset) => `[[Note ${String(offset + 1).padStart(5, "0")}]]`,
    ).join("\n")}\n`,
  );
  const incrementalStarted = performance.now();
  await compiler.update([changedPath]);
  const incrementalElapsed = performance.now() - incrementalStarted;
  const manifest = String(result.assets.get("data/graph.json"));
  const gzipBytes = gzipSync(manifest).byteLength;
  const stats = {
    notes: NOTE_COUNT,
    edges: EDGE_COUNT,
    seconds: Number((elapsed / 1000).toFixed(2)),
    incrementalSeconds: Number((incrementalElapsed / 1000).toFixed(2)),
    manifestGzipMb: Number((gzipBytes / 1024 / 1024).toFixed(2)),
    targetUnderTwoMinutes: elapsed < 120_000,
    manifestUnderSixMb: gzipBytes <= 6 * 1024 * 1024,
  };
  process.stdout.write(`${JSON.stringify(stats, null, 2)}\n`);
  if (elapsed > 480_000 || gzipBytes > 6 * 1024 * 1024) process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}
