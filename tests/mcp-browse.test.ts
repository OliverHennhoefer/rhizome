import { describe, expect, it } from "vitest";
import { knowledgeFixture } from "./knowledge-fixture";

describe("vault discovery", () => {
  it("lists directories, then children, and applies combined subtree filters", async () => {
    const f = await knowledgeFixture({
      "Root.md": "# Root\n",
      "Folder/A.md": "---\ntags: [Physics]\ntype: concept\naliases: [Alpha]\n---\n# A\n",
      "Folder/nested/B.md": "---\ntags: [physics]\ntype: paper\n---\n# B\n",
    });
    const kb = await f.source.get();
    const root = await kb.browse({});
    expect(root.entries.map((entry) => entry.kind)).toEqual(["directory", "note"]);
    expect(root.entries[0]).toMatchObject({ path: "Folder", noteCount: 2 });
    expect((await kb.browse({ path: "Folder" })).entries.map((entry) => entry.path)).toEqual([
      "Folder/nested",
      "Folder/A.md",
    ]);
    expect(
      (await kb.browse({ path: "Folder", tag: "#PHYSICS", type: "concept" })).entries,
    ).toMatchObject([{ id: "Folder/A", aliases: ["Alpha"] }]);
    expect((await kb.browse({ tag: "absent" })).total).toBe(0);
    await expect(kb.browse({ path: "../" })).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(kb.browse({ path: "https://example.org" })).rejects.toMatchObject({
      code: "UNKNOWN_ID",
    });
    await expect(kb.browse({ path: "Unknown" })).rejects.toMatchObject({ code: "UNKNOWN_ID" });
  });
  it("paginates without duplication and binds cursors to snapshot and filters", async () => {
    const f = await knowledgeFixture(
      Object.fromEntries(
        Array.from({ length: 55 }, (_, i) => [
          `Note${String(i).padStart(2, "0")}.md`,
          `# Note ${i}\n`,
        ]),
      ),
    );
    const kb = await f.source.get();
    const first = await kb.browse({});
    expect(first.entries).toHaveLength(50);
    expect(first.total).toBe(55);
    expect(first.truncated).toBe(true);
    const second = await kb.browse({ cursor: first.nextCursor });
    expect(second.entries).toHaveLength(5);
    expect(second.nextCursor).toBeUndefined();
    expect(new Set([...first.entries, ...second.entries].map((entry) => entry.path)).size).toBe(55);
    await expect(kb.browse({ tag: "changed", cursor: first.nextCursor })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(kb.browse({ cursor: "not-json" })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    if (!first.nextCursor) throw new Error("Missing pagination cursor");
    const cursor = JSON.parse(decodeURIComponent(first.nextCursor));
    cursor.snapshot = "changed";
    await expect(
      kb.browse({ cursor: encodeURIComponent(JSON.stringify(cursor)) }),
    ).rejects.toMatchObject({ code: "SNAPSHOT_CHANGED" });
  });
});
