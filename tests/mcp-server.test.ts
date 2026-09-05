import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import Ajv2020 from "ajv/dist/2020";
import { describe, expect, it } from "vitest";
import { createRhizomeMcpServer } from "../src/mcp/server";
import { knowledgeFixture } from "./knowledge-fixture";

describe("MCP protocol with actual retrieval", () => {
  it("advertises and executes four read-only tools with identical structured and text content", async () => {
    const f = await knowledgeFixture({
      "A.md": "---\naliases: [Alpha]\n---\n# A\n[[B]]\n",
      "B.md": "# B\n",
    });
    const server = createRhizomeMcpServer(f.source);
    const client = new Client({ name: "test", version: "1" });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(b), client.connect(a)]);
    try {
      const tools = (await client.listTools()).tools;
      expect(tools.map((tool) => tool.name)).toEqual(["search", "fetch", "browse", "get_context"]);
      expect(
        tools.every(
          (tool) =>
            tool.annotations?.readOnlyHint &&
            tool.annotations.destructiveHint === false &&
            tool.annotations.openWorldHint === false &&
            tool.inputSchema &&
            tool.outputSchema,
        ),
      ).toBe(true);
      expect(client.getInstructions()).toContain("untrusted reference data");
      for (const [name, args] of [
        ["search", { query: "Alpha" }],
        ["fetch", { id: "A" }],
        ["browse", {}],
        ["get_context", { id: "A" }],
      ] as const) {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError).not.toBe(true);
        expect(result.content).toEqual([
          { type: "text", text: JSON.stringify(result.structuredContent) },
        ]);
      }
      for (const [name, args] of [
        ["search", {}],
        ["search", { query: "x".repeat(513) }],
        ["fetch", { id: "absent" }],
        ["browse", { path: "../" }],
        ["get_context", { id: "A", direction: "sideways" }],
      ] as const) {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError).toBe(true);
      }
      const unknown = await client.callTool({ name: "fetch", arguments: { id: "absent" } });
      expect(unknown.structuredContent).toMatchObject({ error: { code: "UNKNOWN_ID" } });
      const advertised = tools.find((tool) => tool.name === "fetch")?.outputSchema;
      if (!advertised) throw new Error("Missing fetch output schema");
      expect(
        new Ajv2020({ strict: false, validateFormats: false }).validate(
          advertised,
          unknown.structuredContent,
        ),
      ).toBe(true);
      expect(unknown.content).toEqual([
        { type: "text", text: JSON.stringify(unknown.structuredContent) },
      ]);
    } finally {
      await client.close();
      await server.close();
    }
  });
});
