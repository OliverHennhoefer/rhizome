import { createMcpHandler } from "agents/mcp/server";
import { createRhizomeMcpServer } from "./server.ts";
import { RemoteKnowledgeSource } from "./source.ts";
import { normalizeSiteUrl } from "./urls.ts";

interface Env {
  RHIZOME_SITE_URL: string;
}

type McpHandler = ReturnType<typeof createMcpHandler>;

interface Runtime {
  source: RemoteKnowledgeSource;
  handler: McpHandler;
}

let active: { site: string; runtime: Runtime } | undefined;

function runtimeFor(env: Env): Runtime {
  if (typeof env.RHIZOME_SITE_URL !== "string" || env.RHIZOME_SITE_URL.length === 0) {
    throw new Error("RHIZOME_SITE_URL is required.");
  }

  const sourceUrl = normalizeSiteUrl(env.RHIZOME_SITE_URL).href;
  if (active?.site === sourceUrl) return active.runtime;

  const source = new RemoteKnowledgeSource(sourceUrl);
  const handler = createMcpHandler(() => createRhizomeMcpServer(source), {
    route: "/mcp",
    legacy: "stateless",
  });
  const runtime = { source, handler };
  active = { site: sourceUrl, runtime };
  return runtime;
}

function jsonResponse(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env, context): Promise<Response> {
    const url = new URL(request.url);

    try {
      const runtime = runtimeFor(env);

      if (url.pathname === "/health") {
        if (request.method !== "GET") {
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { allow: "GET" },
          });
        }
        return jsonResponse((await runtime.source.get()).health());
      }

      if (url.pathname !== "/mcp") {
        return jsonResponse({ error: "Not found." }, 404);
      }

      if (request.method === "POST") {
        if (Number(request.headers.get("content-length")) > 65_536)
          return jsonResponse({ error: "Request too large" }, 413);
        const reader = request.body?.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        if (reader)
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            length += value.length;
            if (length > 65_536) {
              await reader.cancel();
              return jsonResponse({ error: "Request too large" }, 413);
            }
            chunks.push(value);
          }
        const body = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.length;
        }
        return await runtime.handler(new Request(request, { body }), env, context);
      }
      return await runtime.handler(request, env, context);
    } catch (error) {
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : "Unexpected Worker error.",
        },
        503,
      );
    }
  },
} satisfies ExportedHandler<Env>;
