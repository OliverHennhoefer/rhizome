import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { build } from "esbuild";
import { Miniflare, Response as MiniflareResponse } from "miniflare";
import { NoteSearch } from "../src/mcp/search.ts";
import { KnowledgeCatalogSchema, KnowledgeManifestSchema } from "../src/shared/artifact-schemas.ts";
import { benchmarkAssets } from "./benchmark-assets.ts";

// Local workerd otherwise uses desktop-sized V8 heaps, unlike production isolates.
// This is a conservative test profile, not a simulation of Cloudflare accounting.
process.env.MINIFLARE_WORKERD_V8_FLAGS ??= "--max-old-space-size=96 --max-semi-space-size=8";
await build({
  entryPoints: ["scripts/benchmark-worker.ts"],
  outfile: ".rhizome-cache/benchmark-worker.js",
  bundle: true,
  format: "esm",
  platform: "neutral",
  mainFields: ["module", "main"],
  conditions: ["workerd", "worker", "browser"],
  external: ["cloudflare:*", "node:*"],
  target: "es2022",
});
const report: object[] = [];
for (const count of [100, 1_000, 10_000]) {
  console.log(`Benchmarking ${count} notes across six snapshots...`);
  let assets = benchmarkAssets(count);
  const manifest = KnowledgeManifestSchema.parse(
    JSON.parse(String(assets.get("data/knowledge.json"))),
  );
  const catalog = KnowledgeCatalogSchema.parse(
    JSON.parse(String(assets.get(manifest.catalog.path))),
  );
  const queries = [
    "Entry 0",
    "cache design",
    "sourdough",
    "attention heads",
    "ETag revalidation",
    "resorce ownership",
    "photosynthesis",
    "warmupneedle",
    "release operations",
    "canary deployment error budgets",
  ];
  let local: NoteSearch | undefined = new NoteSearch(
    String(assets.get(manifest.index.path)),
    catalog.documents,
    "https://source.test/rhizome/",
  );
  const times: number[] = [];
  for (let i = 0; i < 110; i++) {
    const start = performance.now();
    local.search(queries[i % queries.length]);
    if (i >= 10) times.push(performance.now() - start);
  }
  local = undefined;
  global.gc?.();
  times.sort((a, b) => a - b);
  const worker = new Miniflare({
    telemetry: { enabled: false },
    inspectorPort: 0,
    workers: [
      {
        config: {
          name: "rhizome-benchmark",
          type: "worker",
          compatibilityDate: "2026-09-04",
          compatibilityFlags: ["nodejs_compat"],
          manifest: {
            mainModule: "worker.js",
            modules: {
              "worker.js": {
                type: "esm",
                contents: await readFile(".rhizome-cache/benchmark-worker.js", "utf8"),
              },
            },
          },
        },
        dev: {
          outboundService: {
            type: "fetcher",
            handler: async (request) => {
              const asset = assets.get(new URL(request.url).pathname.replace(/^\/rhizome\//, ""));
              return new MiniflareResponse(asset === undefined ? "Missing" : String(asset), {
                status: asset === undefined ? 404 : 200,
              });
            },
          },
        },
      },
    ],
  });
  const client = new Client({ name: "benchmark", version: "1" });
  let socket: WebSocket | undefined;
  try {
    const base = await worker.ready;
    const inspector = await worker.getInspectorURL();
    inspector.protocol = "http:";
    const targets = (await (await fetch(new URL("/json", inspector))).json()) as Array<{
      webSocketDebuggerUrl: string;
      title: string;
    }>;
    const target = targets.find((target) => target.title.includes("benchmark")) ?? targets.at(-1);
    assert(target, "Worker inspector target missing");
    socket = new WebSocket(target.webSocketDebuggerUrl);
    const connectedSocket = socket;
    await new Promise<void>((resolve, reject) => {
      connectedSocket.addEventListener("open", () => resolve(), { once: true });
      connectedSocket.addEventListener("error", reject, { once: true });
    });
    let requestId = 0;
    const pending = new Map<
      number,
      {
        resolve: (result: { usedSize: number }) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >();
    connectedSocket.addEventListener("message", (event) => {
      const data = JSON.parse(String(event.data));
      const request = pending.get(data.id);
      if (request) {
        pending.delete(data.id);
        clearTimeout(request.timer);
        if (data.error) request.reject(new Error(JSON.stringify(data.error)));
        else request.resolve(data.result);
      }
    });
    async function inspectorCommand(method: string): Promise<{ usedSize: number }> {
      const id = ++requestId;
      const result = new Promise<{ usedSize: number }>((resolve, reject) =>
        pending.set(id, {
          resolve,
          reject,
          timer: setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Inspector timed out: ${method}`));
          }, 10_000),
        }),
      );
      connectedSocket.send(JSON.stringify({ id, method }));
      return result;
    }
    async function heap() {
      return (await inspectorCommand("Runtime.getHeapUsage")).usedSize;
    }
    await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", base)));
    let peak = await heap();
    const http: number[] = [];
    const retained: number[] = [];
    const cold: number[] = [];
    for (let revision = 0; revision < 6; revision++) {
      if (revision) {
        assets = benchmarkAssets(count, revision);
        await fetch(new URL("/advance", base));
      }
      for (const [position, query] of queries.entries()) {
        const start = performance.now();
        const result = await client.callTool({ name: "search", arguments: { query } });
        assert.notEqual(result.isError, true, JSON.stringify(result));
        (position ? http : cold).push(performance.now() - start);
        peak = Math.max(peak, await heap());
      }
      for (const name of ["fetch", "get_context"] as const) {
        const result = await client.callTool({
          name,
          arguments: { id: "Collection0/Record00000" },
        });
        assert.notEqual(result.isError, true, JSON.stringify(result));
        peak = Math.max(peak, await heap());
      }
      retained.push(await heap());
    }
    http.sort((a, b) => a - b);
    const row = {
      notes: count,
      edges: count * 7.5,
      markdownMiB: manifest.markdownBytes / 1048576,
      indexMiB: manifest.index.bytes / 1048576,
      catalogMiB: manifest.catalog.bytes / 1048576,
      graphMiB: manifest.graph.bytes / 1048576,
      localSearchP95Ms: times[94],
      workerWarmHttpP95Ms: http[Math.ceil(http.length * 0.95) - 1],
      coldSearchMs: cold,
      sampledWorkerPeakMiB: peak / 1048576,
      refreshHeapMiB: retained.map((bytes) => bytes / 1048576),
    };
    report.push(row);
    console.log(JSON.stringify(row));
    assert(row.localSearchP95Ms <= 50, "Warm search latency budget exceeded");
    assert(row.sampledWorkerPeakMiB < 112, "Sampled Worker memory budget exceeded");
  } finally {
    socket?.close();
    await client.close();
    await worker.dispose();
  }
}
console.log(
  JSON.stringify(
    {
      measurements: report,
      v8Flags: process.env.MINIFLARE_WORKERD_V8_FLAGS,
      method:
        "Node warm search timings; real workerd HTTP and inspector heap samples after each tool across six snapshot revisions. The bounded V8 profile is not Cloudflare memory accounting; samples are not a continuous peak-memory proof.",
    },
    null,
    2,
  ),
);
