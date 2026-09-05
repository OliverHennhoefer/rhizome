import { describe, expect, it } from "vitest";
import { GraphQueries } from "../src/mcp/graph";
import { GraphManifestSchema, NodeDetailsSchema } from "../src/shared/artifact-schemas";
import { knowledgeFixture } from "./knowledge-fixture";

const files = {
  "Root.md":
    "---\ndepends-on: ['[[Dependency]]', '[[Root]]']\nrelated-to: ['[[Absent]]']\nsupported-by: ['[Source](https://example.org/paper)']\n---\n# Root\n[[Dependency]]\n[[Dependency]]\n[[Dependency]]\n[[Dependency]]\n",
  "Dependency.md": "---\ndepends-on: '[[Root]]'\n---\n# Dependency\n",
};
describe("traceable graph queries", () => {
  it("returns correct inverse labels, reciprocal edges, self links and non-note counterparts", async () => {
    const f = await knowledgeFixture(files);
    const kb = await f.source.get();
    const both = await kb.context({ id: "Root" });
    expect(
      both.relationships.some(
        (edge) => edge.direction === "incoming" && edge.label === "Dependency of",
      ),
    ).toBe(true);
    expect(
      both.relationships.some(
        (edge) => edge.direction === "outgoing" && edge.label === "Depends on",
      ),
    ).toBe(true);
    expect(both.relationships.filter((edge) => edge.direction === "self")).toHaveLength(1);
    expect(both.relationships.find((edge) => edge.direction === "self")?.evidenceCount).toBe(1);
    expect(
      both.relationships.some(
        (edge) => edge.counterpart.kind === "missing" && !edge.counterpart.url,
      ),
    ).toBe(true);
    expect(
      both.relationships.find((edge) => edge.counterpart.kind === "external")?.counterpart.url,
    ).toBe("https://example.org/paper");
    const repeated = both.relationships.find((edge) => edge.type === "link");
    if (!repeated) throw new Error("Missing link evidence");
    expect(repeated.evidence).toHaveLength(3);
    expect(repeated.evidenceCount).toBe(4);
    expect(repeated.evidenceTruncated).toBe(true);
    for (const direction of ["incoming", "outgoing"] as const) {
      const context = await kb.context({ id: "Root", direction });
      expect(
        context.relationships.every((edge) =>
          [direction, "undirected", "self"].includes(edge.direction),
        ),
      ).toBe(true);
      expect(context.relationships.some((edge) => edge.direction === "self")).toBe(true);
    }
    expect(
      (await kb.context({ id: "Root", relationTypes: ["supported-by"] })).relationships.map(
        (edge) => edge.type,
      ),
    ).toEqual(["supported-by"]);
    await expect(kb.context({ id: "Root", relationTypes: ["nonexistent"] })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(kb.context({ id: "Absent" })).rejects.toMatchObject({ code: "UNKNOWN_ID" });
    for (const relationship of both.relationships)
      for (const evidence of relationship.evidence) {
        const source = files[`${evidence.source}.md` as keyof typeof files];
        const line = source.split("\n")[evidence.range.startLine - 1];
        expect(line.trim()).toBe(evidence.excerpt);
        expect(evidence.range.endColumn).toBeLessThanOrEqual(line.length + 1);
        expect(evidence.sourceUrl).toContain(`note=${evidence.source}`);
      }
    expect(f.requests.some((request) => request.endsWith(".md"))).toBe(false);
  });
  it("paginates high-degree roots deterministically", async () => {
    const names = Array.from({ length: 55 }, (_, i) => `Note${String(i).padStart(2, "0")}`);
    const f = await knowledgeFixture({
      "Root.md": `# Root\n${names.map((name) => `[[${name}]]`).join("\n")}\n`,
      ...Object.fromEntries(names.map((name) => [`${name}.md`, `# ${name}\n`])),
    });
    const kb = await f.source.get();
    const first = await kb.context({ id: "Root" });
    const second = await kb.context({ id: "Root", cursor: first.nextCursor });
    expect(first.total).toBe(55);
    expect(first.relationships).toHaveLength(50);
    expect(second.relationships).toHaveLength(5);
    expect(
      new Set([...first.relationships, ...second.relationships].map((edge) => edge.edgeId)).size,
    ).toBe(55);
    await expect(
      kb.context({ id: "Root", direction: "incoming", cursor: first.nextCursor }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("represents undirected self-links once in either direction", async () => {
    const f = await knowledgeFixture({ "Root.md": "---\nrelated-to: ['[[Root]]']\n---\n# Root\n" });
    const reader = await f.source.get();
    for (const direction of ["both", "incoming", "outgoing"] as const) {
      const context = await reader.context({ id: "Root", direction });
      expect(context.relationships).toHaveLength(1);
      expect(context.relationships[0]).toMatchObject({
        direction: "self",
        directed: false,
        evidenceCount: 1,
      });
    }
  });
  it("rejects broken endpoints, duplicate IDs, metadata mismatch and malformed evidence", async () => {
    const f = await knowledgeFixture(files);
    const original = GraphManifestSchema.parse(
      JSON.parse(String(f.assets.get(f.manifest.graph.path))),
    );
    for (const mutate of [
      (graph: typeof original) => {
        graph.edges[0].source = "unknown";
      },
      (graph: typeof original) => {
        graph.nodes.push(graph.nodes[0]);
      },
      (graph: typeof original) => {
        const root = graph.nodes.find((node) => node.id === "Root");
        if (!root) throw new Error("Missing root");
        root.title = "Wrong";
      },
    ]) {
      const graph = structuredClone(original);
      mutate(graph);
      expect(() => new GraphQueries(graph, f.catalog, "https://example.com/")).toThrow();
    }
    const queries = new GraphQueries(original, f.catalog, "https://example.com/");
    const details = NodeDetailsSchema.parse(
      JSON.parse(String(f.assets.get(queries.detailsReference("Root")))),
    );
    for (const mutate of [
      (value: typeof details) => {
        value.id = "Other";
      },
      (value: typeof details) => {
        value.outgoing[0].type = "invalid";
      },
      (value: typeof details) => {
        value.outgoing[0].range.endLine = 999;
      },
      (value: typeof details) => {
        value.outgoing[0].range = { startLine: 1, endLine: 1, startColumn: 1, endColumn: 10 };
      },
      (value: typeof details) => {
        value.outgoing[0].source = "Dependency";
      },
      (value: typeof details) => {
        value.outgoing = [];
      },
    ]) {
      const value = structuredClone(details);
      mutate(value);
      expect(() => queries.context(f.manifest.contentHash, { id: "Root" }, value)).toThrow();
    }
    expect(
      NodeDetailsSchema.safeParse({
        ...details,
        incoming: [
          {
            ...details.incoming[0],
            range: { startLine: 2, endLine: 1, startColumn: 1, endColumn: 1 },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
