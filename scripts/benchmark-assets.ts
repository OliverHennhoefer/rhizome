import { createHash } from "node:crypto";
import { emitKnowledge } from "../src/compiler/knowledge.ts";
import type { ParsedNote } from "../src/compiler/types.ts";
import type { EdgeEvidence, GraphEdge, GraphManifest, GraphNode } from "../src/shared/contracts.ts";

const topics = [
  [
    "Cache design",
    "ETag revalidation avoids transferring an unchanged representation. Byte budgets bound memory and LRU evicts old entries.",
  ],
  [
    "Sourdough",
    "Feed the starter with flour and water. Lactic acid bacteria create aroma. Stretch and fold strengthens the gluten network.",
  ],
  [
    "Attention",
    "Grouped query attention shares key and value heads. Rotary position embeddings encode position. Residual streams carry activations.",
  ],
  [
    "Resource ownership",
    "C++ RAII releases resources in destructors. A std::unique_ptr owns a socket. C# uses a garbage collector for managed objects.",
  ],
  [
    "Field observations",
    "Record the transect, soil texture, canopy density and rainfall. Species identification requires a reference specimen.",
  ],
  [
    "Release operations",
    "A canary deployment exposes a small fraction of traffic. Error budgets and latency percentiles determine whether rollout continues.",
  ],
];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function benchmarkAssets(count: number, revision = 0): Map<string, string | Uint8Array> {
  const assets = new Map<string, string | Uint8Array>();
  const notes: ParsedNote[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const incoming = new Map<string, EdgeEvidence[]>();
  const outgoing = new Map<string, EdgeEvidence[]>();
  const idFor = (i: number) => `Collection${i % 20}/Record${String(i).padStart(5, "0")}`;
  for (let i = 0; i < count; i++) {
    const id = idFor(i);
    const [topic, paragraph] = topics[i % topics.length];
    const title = `${topic} ${i}`;
    const body =
      `${paragraph}\n\nCase reference project_${i} release_${i % 97}. ${i === 0 ? `revisionneedle${revision}` : ""}\n` +
      (i % 100 === 0
        ? Array.from({ length: 150 }, (_, line) => `Observation ${line}: ${paragraph}\n`).join("")
        : "");
    const neighbors = Array.from({ length: i % 2 ? 7 : 8 }, (_, j) => idFor((i + j + 1) % count));
    const source = `# ${title}\n${neighbors.map((id) => `[[${id}]]`).join("\n")}\n\n${body}`;
    notes.push({
      absolutePath: id,
      path: `${id}.md`,
      id,
      title,
      source,
      body,
      bodyStartLine: 1,
      aliases: [`Entry ${i}`],
      tags: [`topic-${i % topics.length}`],
      types: ["note"],
      draft: false,
      metadata: {},
      occurrences: [],
      headings: [title],
      blocks: [],
      root: {
        type: "root",
        children: [
          { type: "heading", depth: 1, children: [{ type: "text", value: title }] },
          {
            type: "paragraph",
            children: [{ type: "text", value: `${body} ${neighbors.join(" ")}` }],
          },
        ],
      },
    });
    nodes.push({
      id,
      title,
      kind: "note",
      path: `${id}.md`,
      aliases: [`Entry ${i}`],
      tags: [`topic-${i % topics.length}`],
      types: ["note"],
      detailsRef: "",
      x: 0,
      y: 0,
      degree: 15,
      community: i % 20,
    });
    for (const [j, target] of neighbors.entries()) {
      const edgeId = `edge:${i}:${j}`;
      edges.push({ id: edgeId, source: id, target, type: "link", directed: true, occurrences: 1 });
      const evidence: EdgeEvidence = {
        edgeId,
        source: id,
        target,
        type: "link",
        origin: "body",
        range: { startLine: j + 2, endLine: j + 2, startColumn: 1, endColumn: target.length + 5 },
        excerpt: `[[${target}]]`,
      };
      const ins = incoming.get(target) ?? [];
      ins.push(evidence);
      incoming.set(target, ins);
      const outs = outgoing.get(id) ?? [];
      outs.push(evidence);
      outgoing.set(id, outs);
    }
  }
  for (const node of nodes) {
    const text = JSON.stringify({
      schemaVersion: 1,
      id: node.id,
      incoming: incoming.get(node.id) ?? [],
      outgoing: outgoing.get(node.id) ?? [],
    });
    node.detailsRef = `data/details/${hash(text).slice(0, 24)}.json`;
    assets.set(node.detailsRef, text);
  }
  const core = {
    schemaVersion: 2 as const,
    config: { site: { title: "Retrieval benchmark" }, relations: {} },
    nodes,
    edges,
    facets: { tags: {}, types: {}, relations: {} },
    diagnostics: [],
  };
  const graph: GraphManifest = { ...core, contentHash: hash(JSON.stringify(core)) };
  emitKnowledge(notes, graph, assets);
  return assets;
}
