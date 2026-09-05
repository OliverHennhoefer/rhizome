import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { Miniflare, Response as MiniflareResponse } from "miniflare";
import { z } from "zod";
import { VaultCompiler } from "../src/compiler/compile.ts";
import { FetchOutputSchema, SearchOutputSchema } from "../src/mcp/tool-contracts.ts";

const healthSchema = z.object({
  status: z.literal("ok"),
  notes: z.number(),
  knowledgeHash: z.string(),
});

const root = await mkdtemp(path.join(tmpdir(), "rhizome-http-"));
await mkdir(path.join(root, "content"));
await writeFile(path.join(root, "rhizome.schema.json"), await readFile("rhizome.schema.json"));
await writeFile(
  path.join(root, "rhizome.config.yaml"),
  "site:\n  title: HTTP test\ncontent:\n  root: content\n  exclude: []\nrelations: {}\n",
);
await writeFile(
  path.join(root, "content/Alpha.md"),
  "---\naliases: [First]\n---\n# Alpha\n[[Beta]]\n",
);
await writeFile(path.join(root, "content/Beta.md"), "# Beta\n");
const compiler = new VaultCompiler({ projectRoot: root });
let assets = (await compiler.clean()).assets;
const worker = new Miniflare({
  telemetry: { enabled: false },
  workers: [
    {
      config: {
        name: "rhizome-test",
        type: "worker",
        compatibilityDate: "2026-09-04",
        compatibilityFlags: ["nodejs_compat"],
        manifest: {
          mainModule: "worker.js",
          modules: {
            "worker.js": {
              type: "esm",
              contents: await readFile(".rhizome-cache/worker/worker.js", "utf8"),
            },
          },
        },
        env: { RHIZOME_SITE_URL: { type: "text", value: "https://source.test/rhizome/" } },
      },
      dev: {
        outboundService: {
          type: "fetcher",
          handler: async (request) => {
            const url = new URL(request.url);
            assert.equal(url.origin, "https://source.test");
            const asset = assets.get(url.pathname.replace(/^\/rhizome\//, ""));
            return new MiniflareResponse(asset === undefined ? "Missing" : String(asset), {
              status: asset === undefined ? 404 : 200,
            });
          },
        },
      },
    },
  ],
});
const client = new Client({ name: "rhizome-http-tests", version: "1" });
try {
  const base = await worker.ready;
  await client.connect(new StreamableHTTPClientTransport(new URL("/mcp", base)));
  const tools = (await client.listTools()).tools;
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ["search", "fetch", "browse", "get_context"],
  );
  for (const tool of tools) assert.equal(tool.annotations?.readOnlyHint, true);
  for (const [name, args] of [
    ["search", { query: "First" }],
    ["fetch", { id: "Alpha" }],
    ["browse", {}],
    ["get_context", { id: "Alpha" }],
  ] as const) {
    const result = await client.callTool({ name, arguments: args });
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.deepEqual(result.content, [
      { type: "text", text: JSON.stringify(result.structuredContent) },
    ]);
  }
  for (const [name, args] of [
    ["search", {}],
    ["search", { query: "x".repeat(513) }],
    ["fetch", { id: "missing" }],
    ["browse", { cursor: "bad" }],
    ["get_context", { id: "Alpha", direction: "sideways" }],
  ] as const) {
    assert.equal((await client.callTool({ name, arguments: args })).isError, true);
  }
  const health = healthSchema.parse(await (await fetch(new URL("/health", base))).json());
  assert.equal(health.notes, 2);
  assert.equal(health.status, "ok");
  assert.equal((await fetch(new URL("/health", base), { method: "POST" })).status, 405);
  assert.equal((await fetch(new URL("/missing", base))).status, 404);
  assert.equal(
    (await fetch(new URL("/mcp", base), { method: "POST", body: "x".repeat(65_537) })).status,
    413,
  );
  console.log(
    "Worker HTTP: all four tools, valid/invalid inputs, annotations, JSON compatibility and health passed.",
  );
  if (process.argv.includes("--inspector")) {
    const inspect = promisify(execFile);
    const common = [
      "--yes",
      "@modelcontextprotocol/inspector@2.5.0",
      "--cli",
      new URL("/mcp", base).href,
      "--transport",
      "http",
      "--format",
      "json",
      "--stored-auth-only",
    ];
    console.log(
      (await inspect("npx", [...common, "--method", "tools/list", "--strict"], { timeout: 60_000 }))
        .stdout,
    );
    for (const [name, args] of [
      ["search", { query: "Alpha" }],
      ["fetch", { id: "Alpha" }],
      ["browse", {}],
      ["get_context", { id: "Alpha" }],
      ["search", {}],
      ["fetch", { id: "missing" }],
      ["browse", { cursor: "invalid" }],
      ["get_context", { id: "Alpha", direction: "sideways" }],
    ] as const) {
      try {
        const output = await inspect(
          "npx",
          [
            ...common,
            "--method",
            "tools/call",
            "--tool-name",
            name,
            "--tool-args-json",
            JSON.stringify(args),
          ],
          { timeout: 60_000 },
        );
        console.log(`Inspector ${name} ${JSON.stringify(args)}: ${output.stdout}`);
      } catch (error) {
        // Inspector uses a non-zero exit for a tool error. Preserve its report.
        if (
          !error ||
          typeof error !== "object" ||
          !("stdout" in error) ||
          !String(error.stdout).includes('"isError":true')
        )
          throw error;
        console.log(`Inspector ${name} ${JSON.stringify(args)}: ${error.stdout}`);
      }
    }
  }
  await writeFile(
    path.join(root, "content/Alpha.md"),
    "# Alpha\n[[Beta]]\ndeploymentrefreshcanary\n",
  );
  assets = (await compiler.clean()).assets;
  console.log(
    "Waiting for the real 60-second manifest TTL to expire before testing a changed deployment.",
  );
  await new Promise((resolve) => setTimeout(resolve, 60_100));
  const updated = await client.callTool({
    name: "search",
    arguments: { query: "deploymentrefreshcanary" },
  });
  assert.deepEqual(
    SearchOutputSchema.parse(updated.structuredContent).results.map((result) => result.id),
    ["Alpha"],
  );
  const fetched = await client.callTool({ name: "fetch", arguments: { id: "Alpha" } });
  assert.match(FetchOutputSchema.parse(fetched.structuredContent).text, /deploymentrefreshcanary/);
  const newHealth = healthSchema.parse(await (await fetch(new URL("/health", base))).json());
  assert.notEqual(newHealth.knowledgeHash, health.knowledgeHash);
  console.log(
    "Worker HTTP: changed Markdown is retrievable after deployment/cache expiry without Worker redeployment.",
  );
} finally {
  await client.close();
  await worker.dispose();
  await rm(root, { recursive: true, force: true });
}
