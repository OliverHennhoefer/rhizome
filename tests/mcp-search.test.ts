import { describe, expect, it } from "vitest";
import { searchDocument } from "../src/compiler/knowledge";
import { parseNote } from "../src/compiler/parse";
import { NoteSearch } from "../src/mcp/search";
import { buildSearchIndex, tokenize } from "../src/shared/search-analyzer";
import { knowledgeFixture } from "./knowledge-fixture";

describe("compiled note search", () => {
  it("promotes aliases, preserves identifiers and does not match question scaffolding", async () => {
    const f = await knowledgeFixture({
      "Attention.md": "---\naliases: [GQA]\n---\n# Attention\nShares query groups.\n",
      "Paper.md": "---\ntitle: GQA paper\n---\n# GQA paper\n",
      "CPlus.md": "---\ntitle: C++\n---\n# C++\nstd::unique_ptr releases a socket.\n",
      "CSharp.md": "---\ntitle: C#\n---\n# C#\n",
      "Noise.md": "# Noise\nWhat does this say about other notes?\n",
    });
    const kb = await f.source.get();
    for (const [query, id] of [
      ["GQA", "Attention"],
      ["Find the note whose alias is GQA", "Attention"],
      ["GQA paper", "Paper"],
      ["C++", "CPlus"],
      ["C#", "CSharp"],
      ["std::unique_ptr", "CPlus"],
    ]) {
      expect((await kb.search(query)).results[0]?.id).toBe(id);
    }
    expect(await kb.search("What does this vault say about photosynthesis?")).toEqual({
      results: [],
    });
    expect(await kb.search("   ")).toEqual({ results: [] });
    await expect(kb.search("x".repeat(513))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      kb.search(Array.from({ length: 33 }, (_, i) => `word${i}`).join(" ")),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
  it("extracts visible Markdown, headings, link labels, code and math without frontmatter leakage", async () => {
    const source =
      "---\ntitle: Source\nprivatefield: frontmatteronlyneedle\n---\n# Headingneedle\n\n[[Target|Visiblelabel]] and [Readablelabel](https://example.org).\n\n```js\nconst socket_identifier = 42;\n```\n\n$$\nxquadratic^2\n$$\n";
    const f = await knowledgeFixture({ "Source.md": source, "Target.md": "# Target\n" });
    const kb = await f.source.get();
    for (const query of [
      "Headingneedle",
      "Visiblelabel",
      "Readablelabel",
      "socket_identifier",
      "xquadratic",
    ])
      expect((await kb.search(query)).results[0]?.id, query).toBe("Source");
    expect((await kb.search("frontmatteronlyneedle")).results).toEqual([]);
    expect((await kb.fetch("Source")).text).toBe(source);
  });
  it("preserves term frequency and deterministically orders duplicate identities", async () => {
    expect(tokenize("socket socket socket")).toEqual(["socket", "socket", "socket"]);
    expect(tokenize("Ｃ＋＋ CAFE\u0301")).toEqual(expect.arrayContaining(["c++", "café"]));
    const f = await knowledgeFixture({
      "B.md": "---\naliases: [Shared]\n---\n# B\n",
      "A.md": "---\naliases: [Shared]\n---\n# A\n",
    });
    expect((await (await f.source.get()).search("Shared")).results.map((doc) => doc.id)).toEqual([
      "A",
      "B",
    ]);
  });
  it("rejects an index whose document set differs from the catalog", async () => {
    const f = await knowledgeFixture({ "A.md": "# A\n" });
    const note = await parseNote(`${f.root}/content/A.md`, `${f.root}/content`, {
      site: { title: "Test" },
      content: { root: "content", exclude: [] },
      relations: {},
    });
    const serialized = buildSearchIndex([{ ...searchDocument(note), id: "wrong" }]);
    expect(() => new NoteSearch(serialized, f.catalog.documents, "https://example.com/")).toThrow(
      "IDs disagree",
    );
    const wrongVersion = JSON.parse(buildSearchIndex([searchDocument(note)]));
    wrongVersion.analyzerVersion = 999;
    expect(
      () =>
        new NoteSearch(JSON.stringify(wrongVersion), f.catalog.documents, "https://example.com/"),
    ).toThrow();
    expect(
      (await (await f.source.get()).search("explain a photosynthesis experiment")).results,
    ).toEqual([]);
    expect((await (await f.source.get()).search("A")).results[0].id).toBe("A");
  });
});
