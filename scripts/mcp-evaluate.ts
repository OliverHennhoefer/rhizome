import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { searchDocument } from "../src/compiler/knowledge.ts";
import { parseMarkdown, parseNote } from "../src/compiler/parse.ts";
import type { ParsedNote } from "../src/compiler/types.ts";
import { NoteSearch } from "../src/mcp/search.ts";
import type { KnowledgeDocument } from "../src/shared/contracts.ts";
import { buildSearchIndex } from "../src/shared/search-analyzer.ts";
import { retrievalCases } from "./retrieval-cases.ts";

async function documents(root: string): Promise<ParsedNote[]> {
  const files = await readdir(root, { recursive: true });
  return Promise.all(
    files
      .filter((file) => file.endsWith(".md"))
      .sort()
      .map(async (file) => {
        const note = await parseNote(path.resolve(root, file), path.resolve(root), {
          site: { title: "Evaluation" },
          content: { root, exclude: [] },
          relations: {},
        });
        return note;
      }),
  );
}

const roots = {
  vault: "tests/fixtures/retrieval-vault.json",
  kitchen: "tests/fixtures/retrieval-kitchen",
  systems: "tests/fixtures/retrieval-systems",
};
const bases = new Map<string, NoteSearch>();
for (const [name, root] of Object.entries(roots)) {
  const docs = root.endsWith(".json")
    ? await Promise.all(
        (JSON.parse(await readFile(root, "utf8")) as Array<{ path: string; source: string }>).map(
          async (document) => ({
            absolutePath: document.path,
            ...(await parseMarkdown(document.source, document.path, {
              site: { title: "Evaluation" },
              content: { root: "content", exclude: [] },
              relations: {},
            })),
          }),
        ),
      )
    : await documents(root);
  const catalog: KnowledgeDocument[] = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    path: doc.path,
    aliases: doc.aliases,
    tags: doc.tags,
    types: doc.types,
    markdownRef: { path: "", hash: "", bytes: 0 },
    lineLengths: [0],
  }));
  bases.set(
    name,
    new NoteSearch(buildSearchIndex(docs.map(searchDocument)), catalog, "https://example.com/"),
  );
}
const rows = retrievalCases.map((test) => {
  const base = bases.get(test.corpus);
  assert(base, `Missing corpus: ${test.corpus}`);
  const ids = base.search(test.query).results.map((result) => result.id);
  const relevant = new Set(test.relevant);
  const hit = ids.slice(0, 5).filter((id) => relevant.has(id)).length;
  const rank = ids.findIndex((id) => relevant.has(id));
  return {
    ...test,
    returned: ids,
    precisionAt5: hit / Math.min(5, ids.length || 1),
    recallAt5: relevant.size ? hit / relevant.size : 1,
    reciprocalRank: rank < 0 ? 0 : 1 / (rank + 1),
    pass: relevant.size ? (test.first ? rank === 0 : hit > 0) : ids.length === 0,
  };
});
function metrics(split?: string) {
  const selected = rows.filter((row) => !split || row.split === split);
  const positive = selected.filter((row) => row.relevant.length);
  const negative = selected.filter((row) => !row.relevant.length);
  const exact = positive.filter((row) => row.first);
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / (values.length || 1);
  return {
    cases: selected.length,
    precisionAt5: mean(positive.map((row) => row.precisionAt5)),
    recallAt5: mean(positive.map((row) => row.recallAt5)),
    mrr: mean(positive.map((row) => row.reciprocalRank)),
    hitAt5: mean(positive.map((row) => Number(row.reciprocalRank >= 0.2))),
    exactFirst: mean(exact.map((row) => Number(row.pass))),
    emptyAccuracy: mean(negative.map((row) => Number(row.pass))),
  };
}
const report = {
  total: metrics(),
  development: metrics("development"),
  heldOut: metrics("held-out"),
  failures: rows.filter((row) => !row.pass),
};
console.log(JSON.stringify(report, null, 2));
if (
  !process.argv.includes("--report-only") &&
  (report.total.exactFirst < 1 || report.total.hitAt5 < 0.9 || report.total.emptyAccuracy < 0.95)
)
  process.exitCode = 1;
