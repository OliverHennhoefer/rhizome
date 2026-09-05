# Markdown retrieval: implementation and acceptance

Milestone 1.1 implements public, read-only lexical retrieval. Markdown remains authoritative;
neither an OpenAI API key nor a database is needed. This is not a private-vault or write-back system.

## Architecture

- The compiler extracts headings and searchable text from the existing Markdown AST: visible link
  labels, code and math are indexed; YAML metadata has dedicated fields. Original Markdown is
  stored byte-for-byte as UTF-8, including frontmatter, BOM and line endings.
- `data/knowledge.json` is a small versioned manifest. It references SHA-256-named catalog,
  serialized MiniSearch index, graph and per-note Markdown. The browser still uses `data/graph.json`
  and the unchanged node-detail format. The search hash includes the analyzer version, not layout.
- The Worker checks the manifest after 60 seconds, coalesces downloads, and pins each operation to
  one snapshot. Search loads only the catalog and index; fetch loads one Markdown file; graph
  context loads the graph and the root's detail file. One search index is hydrated at a time.
- Immutable Markdown/details use an 8 MiB text LRU. Graph adjacency is built once per snapshot.
  Cache accounting conservatively uses two bytes per character plus key text; it is not a total
  isolate memory measurement. Obsolete snapshots/indexes become collectible after in-flight reads.
- Artifact hashes, runtime schemas, IDs, endpoints, metadata agreement, evidence ownership and
  exact per-line source bounds are checked. Downloads have five-second deadlines and streamed size
  limits. Only fixed HTTPS site-relative artifact paths are allowed; redirects are never followed.
  Failed or inconsistent reads retry once, then produce an explicit error, never an empty success.

The static-index/lazy-loading direction is informed by [Pagefind](https://pagefind.app/docs/api/);
explicit document context is informed by [QMD](https://github.com/tobi/qmd). Rhizome retains
MiniSearch and its compiled graph; it does not incorporate either project's retrieval engine.

## Ranking and discovery

Unicode NFKC normalization and an English stopword list are shared by compiler and query code.
Punctuation-bearing identifiers such as `C++`, `C#` and `std::unique_ptr` retain atomic tokens in
addition to component words. Exact IDs, paths, titles and aliases bypass stopword removal. Natural
questions recognize maximal identity spans; ambiguous identities remain separate, deterministic
results. A stopword-only name matches an exact query, not an incidental article in a question.

MiniSearch retains its default BM25 parameters with field boosts: title 8, aliases 6, headings 5,
tags/types 4, path 3 and body 1. Question scaffolding is ignored when substantive terms exist.
An identity or literal meaningful metadata match qualifies; body-only matches require at least
60% of distinct substantive query terms. Ordering is identity, BM25, coverage, title, then ID.
Expansion only applies to terms absent from literal results: prefix on the final term of at least
three characters; at most two fuzzy terms of at least five characters, with one edit maximum.
Queries are limited to 512 characters and 32 terms; search returns at most ten real notes.

| Tool | Purpose |
| --- | --- |
| `search({query})` | Standard `{results:[{id,title,url}]}` candidates; not answer confidence. |
| `fetch({id})` | Exact Markdown, metadata, content hash and canonical `?note=` citation URL. |
| `browse({path?,tag?,type?,cursor?})` | Immediate children by default; filtered subtree with tag/type AND. |
| `get_context({id,direction?,relationTypes?,cursor?})` | One-hop graph edges, direction-aware labels and source evidence. |

Browse/context pages contain at most 50 entries with totals, truncation and snapshot/filter-bound
cursors. Changed snapshots require restarting pagination. Context preserves reciprocal edges;
self-links appear once and qualify in both directions. Undirected links qualify in either
direction. Each relationship has up to three deduplicated excerpts plus its full evidence count.
Counterparts can be missing or external; search and fetch only expose real notes.

All tools return identical structured and JSON text output, and are annotated read-only,
non-destructive and closed-world. Markdown is reference data, never executable server code.
Instructions tell the model to retrieve, cite, and ignore instructions embedded in notes; this
does not prove that a model can never be influenced by prompt injection. Empty search means
"no matching evidence found", not "the vault has no evidence". Semantic paraphrases remain a limit.

## Relevance results

The frozen demo corpus plus independent kitchen and systems Markdown fixtures contain 100 labelled
queries: 70 development, 30 held-out; 80 answerable, 20 unsupported. Labels include expected IDs
and mandatory first rank for unambiguous identity tests. The baseline was recorded before replacing
the old implementation. Changing a template fork's content does not change this benchmark.

| Metric | Baseline | Current |
| --- | ---: | ---: |
| Relevant evidence in top five | 100% | 100% |
| Unambiguous identities ranked first | 88.9% | 100% |
| Unsupported subjects correctly empty | 20% | 100% |
| Mean reciprocal rank | 0.9373 | 0.9844 |
| Recall over labelled relevant IDs at five | 99.17% | 98.92% |
| Precision over up to five returned results | 46.02% | 56.38% |

All 100 cases pass their per-query criterion; the held-out set has 100% first-rank, hit-at-five,
and empty-result accuracy. Precision divides by the number returned, capped at five, rather than
padding missing results. These are small lexical corpora, not evidence of universal retrieval
quality. Broader human-labelled corpora and actual ChatGPT conversations remain important.
See [baseline](retrieval-baseline.json), [current results](retrieval-results.json), and
`npm run mcp:evaluate` for the gate and per-query failures.

## Performance and hosting envelope

Local measurements on macOS arm64, Node 22.17.0, workerd through Miniflare 5.20260903.0-alpha.
The fixture mixes six subjects, unique project identifiers, 7.5 directed edges per note, and a
150-paragraph long note every 100 notes. Six changed snapshots exercise index and graph refreshes.

| Notes | Edges | Markdown / index / catalog / graph MiB | Warm search p95 | Warm HTTP p95 | Sampled heap peak |
| ---: | ---: | --- | ---: | ---: | ---: |
| 100 | 750 | 0.058 / 0.057 / 0.039 / 0.123 | 0.74 ms | 11.3 ms | 17.7 MiB |
| 1,000 | 7,500 | 0.583 / 0.575 / 0.394 / 1.236 | 2.75 ms | 20.4 ms | 32.0 MiB |
| 10,000 | 75,000 | 5.852 / 6.271 / 3.961 / 12.450 | 30.1 ms | 26.6 ms | 82.5 MiB |

Warm search is the pure Node search function (100 timed calls after warm-up); warm HTTP uses the
actual Worker and MCP SDK client (54 calls, excluding each snapshot's first search). Cold search at
10,000 notes took 585–747 ms locally; production Pages/network latency is additional. Refresh heap
samples at 10,000 notes were 78.6, 78.3, 82.5, 77.2, 73.9 and 76.7 MiB, without monotonic growth.

**Important measurement caveat:** unconstrained desktop workerd runs reached 141–195 MiB of sampled
heap. The reported repeatable bounded-profile run uses V8 `--max-old-space-size=96
--max-semi-space-size=8` to exercise garbage collection under pressure. That is a test profile,
not a deployable Cloudflare setting or a simulation of its accounting. Heap samples after tools
are not continuous peak measurements and exclude some native memory. The production <112 MB
acceptance criterion remains unverified. Do not advertise arbitrary 10,000-note vaults as proven safe.

Runtime/build rejection limits (uncompressed bytes): manifest 16 KiB; catalog 16 MiB; index 24 MiB;
graph 32 MiB; each Markdown/detail 2 MiB. These are safety ceilings, **not** a supported performance
envelope. The existing total Pages build guard remains 900 MiB. Very long notes, large vocabularies,
high-degree nodes, graph density and concurrent cold requests can exceed the measured envelope even
below these ceilings. Run `npm run mcp:benchmark` and deployed profiling on representative content.

For this target, use Workers Paid where needed: Free permits 10 ms CPU per HTTP request, while both
plans have a 128 MB isolate limit. See [Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/).
No database, vector index, private source, credentials or write endpoint has been added.

## Release status

Unit/relevance tests, production build, Worker type-check/dry-run and actual local Worker HTTP
calls have passed. The HTTP test verified that changed Markdown is retrievable after the real
60-second TTL without a Worker redeploy. CI includes relevance and HTTP integration checks.
The final unit suite has 88 passing tests. A full compiled-vault check covered all 100 notes,
all 360 graph relationships and 720 returned source excerpts, with no disagreement.
Official MCP Inspector 2.5.0 also passed strict tool discovery and all four tools with valid and
invalid inputs. Output schemas explicitly admit coded tool errors while preserving the standard
successful search/fetch shapes and identical JSON text/structured content. SDK-level malformed
arguments use the SDK's own text-only validation errors.

Browser regression run: 26 passed, 50 intentionally skipped, eight failed; serial rerun passed
all six functional failures. Two pre-existing desktop/mobile screenshot baselines still differ
(including 349 vs 360 relationships and existing chrome/typography differences). They were inspected
and left unchanged. Thus the complete browser suite is not green, despite no remaining functional
failure in the rerun. Do not silently refresh snapshots to conceal this status.

Live acceptance is **not complete**: Wrangler is not authenticated here. Deploy Pages and the
Worker, profile production memory, then run the [30-conversation checklist](mcp-evaluation.md).
Do not substitute local protocol tests for evidence of ChatGPT tool selection or live deployment.
