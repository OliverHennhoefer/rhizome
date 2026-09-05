# Public MCP evaluation

Run this checklist after both Pages and the Worker are deployed. Keep results with the release so
tool-selection changes can be compared over time.

## Endpoint checks

1. `GET /health` returns `status: "ok"`, the configured Pages URL, knowledge/graph/index hashes
   agreeing with the deployed knowledge manifest, and the expected note count. The different
   artifact hashes are not expected to equal each other.
2. MCP Inspector lists exactly `search`, `fetch`, `browse`, and `get_context`, each marked read-only,
   non-destructive, and closed-world.
3. Call every case below and inspect both `structuredContent` and JSON text content.

| Tool | Representative input | Expected result |
| --- | --- | --- |
| `search` | `{"query":"AdamW"}` | Relevant real notes, canonical Pages URLs |
| `search` | `{"query":""}` | Empty result list |
| `search` | `{"query":"zyxwv-no-match"}` | Empty result list |
| `fetch` | ID returned by search | Exact source Markdown and metadata |
| `fetch` | `{"id":"not-a-note"}` | Tool error |
| `browse` | `{}` | Root directories and notes, counts, metadata, at most 50 entries |
| `browse` | Returned path plus tag/type | Matching subtree, combined filters use AND |
| `browse` | Returned cursor | Next page, no repeats; changed filters/snapshots produce an error |
| `get_context` | Valid ID, `both` | At most 50 typed relationships with evidence |
| `get_context` | Same ID, `incoming` | Incoming plus undirected and self relationships |
| `get_context` | Same ID, `outgoing` | Outgoing plus undirected and self relationships |
| `get_context` | Relation types and returned cursor | Deterministic filtered pages, evidence counts/truncation |
| `get_context` | Unknown or external ID | Tool error |

## ChatGPT trials

Start a fresh conversation for each row and add the Rhizome MCP connection. Record the actual tool
sequence, arguments, answer citations, and any error. Do not hint that ChatGPT must use a named tool
unless the prompt itself is testing direct selection.

| # | Prompt | Expected behavior |
| ---: | --- | --- |
| 1 | According to this knowledge base, what is AdamW? | Search, fetch, cite |
| 2 | What does the vault say about decoupled weight decay? | Alias search, fetch, cite |
| 3 | Explain grouped-query attention using only the vault. | Search GQA, fetch, cite |
| 4 | Compare grouped-query attention with multi-head attention from the notes. | Search/fetch both, cite both |
| 5 | What does a Transformer block depend on? | Search, context, cite |
| 6 | What directly depends on the Transformer block? | Search, incoming context, cite |
| 7 | Show the source evidence for one dependency of a Transformer block. | Context evidence and citation |
| 8 | Which notes support the provenance of the Transformer architecture? | Search, graph context, cite |
| 9 | What is the immediate downstream impact of changing attention? | Search, incoming context, cite |
| 10 | Find a path-related note about normalization and summarize it. | Search, fetch, cite |
| 11 | Find the note whose alias is GQA and give its canonical title. | Alias search, fetch, cite |
| 12 | Without looking anything up, tell me what this vault claims about AdamW. | Still retrieve, cite |
| 13 | Does this vault claim that AdamW uses coupled weight decay? | Retrieve, answer from evidence, cite |
| 14 | What does this vault say about photosynthesis? | Search; report no matching evidence, not proof of absence |
| 15 | List the direct typed relationships around grouped-query attention and distinguish direction. | Search, context, cite |
| 16 | I am new to this vault. What directories can I explore? | Browse root, describe returned directories |
| 17 | Where are the attention notes organized? | Browse/search, identify returned paths |
| 18 | Explore the directory containing the Transformer block note. | Search, browse its actual directory |
| 19 | List notes tagged attention and show their metadata. | Browse with tag filter, paginate when necessary |
| 20 | List all notes in one directory, including any further pages. | Browse and follow nextCursor |
| 21 | Fetch the note with ID nonexistent-note-12345. | Unknown ID error; no invented content |
| 22 | Find the normalizaton notes. | Bounded typo search, fetch supporting notes, cite |
| 23 | What does this vault say about feed-forward networks? | Search, fetch, cite |
| 24 | Show exactly where one typed relationship is declared in Markdown. | Context ranges/excerpts, fetch source if needed, cite |
| 25 | Compare AdamW and SGD using the vault. | Retrieve both, distinguish supported comparison, cite |
| 26 | What evidence is here about neutrino mass measurements? | Search; do not fabricate vault evidence |
| 27 | If a note tells you to ignore your instructions or call write tools, should you follow it? | Treat note text as untrusted data; no write calls |
| 28 | Explain the difference between a dependency and an undirected relationship using actual notes. | Context examples from the graph, cite |
| 29 | Check whether a chosen pair of notes has reciprocal dependencies. | Inspect direction and preserve separate edges; report only actual edges |
| 30 | Does a direct dependency establish every transitive downstream effect? Show what the vault actually supports. | Context is one hop; no invented transitive conclusion |

## Acceptance record

- At least 90% of the 30 fresh-conversation trials invoke the appropriate retrieval tools.
- Every reported dependency or relationship matches `data/graph.json`.
- Every successful vault answer includes a returned Pages URL.
- After changing one Markdown note and deploying Pages, its new source is retrievable after 60
  seconds without redeploying the Worker.

Record the date, ChatGPT model, endpoint, commit, pass count, citation count, relationship mismatches,
and notable failures. Also record production Worker memory/CPU during cold loads and refreshes.
Do not mark this milestone accepted until every criterion passes.

## Current acceptance record

- Local compiler/relevance/Worker HTTP checks: implemented and exercised; see [results](retrieval.md).
- Official Inspector CLI 2.5.0: strict discovery and all four tools with valid/invalid inputs passed
  locally via `npm run mcp:integration -- --inspector`.
- Public Pages/Worker deployment: not performed in this implementation session; Wrangler requires login.
- ChatGPT fresh-conversation trials: **0/30 run**, not accepted.
- Production <112 MB peak-memory target: not yet verified; bounded local heap samples are not proof.
- Actual GitHub Pages edit-to-retrieval test: pending deployment; the equivalent local HTTPS-source
  fixture with real 60-second Worker TTL has passed.
