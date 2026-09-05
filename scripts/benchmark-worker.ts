import { createMcpHandler } from "agents/mcp/server";
import { createRhizomeMcpServer } from "../src/mcp/server.ts";
import { RemoteKnowledgeSource } from "../src/mcp/source.ts";

// Test-only clock injection. This entry point is never deployed by Wrangler.
let now = 0;
const source = new RemoteKnowledgeSource("https://source.test/rhizome/", fetch, () => now);
const handler = createMcpHandler(() => createRhizomeMcpServer(source), {
  route: "/mcp",
  legacy: "stateless",
});
export default {
  async fetch(request: Request, env: unknown, context: ExecutionContext) {
    if (new URL(request.url).pathname === "/advance") {
      now += 60_001;
      return new Response("advanced");
    }
    return handler(request, env, context);
  },
};
