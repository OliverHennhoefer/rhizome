# Rhizome

**A graph-native knowledge space that lives entirely in GitHub.**

Rhizome turns an Obsidian-compatible Markdown repository into an explorable knowledge graph. The
repository is the system: Markdown is the source, Git is the history, pull requests are the review
workflow, GitHub Actions is the compiler, and GitHub Pages is the interface. No CMS, database, or
hosted backend.

```text
Markdown repository → GitHub Actions → graph-native GitHub Pages site
```

> [!TIP]
> Fork this repository or use it as a template, then replace the example notes in
> [`content/`](content) with your Obsidian vault. For most vaults, that is the only content change
> required; enable GitHub Pages once to publish.

## What it does

- Compiles wikilinks, Markdown links, tags, aliases, and declared Properties into a typed graph.
- Makes dependencies, backlinks, missing targets, source evidence, and direction first-class.
- Answers “what depends on this?” and “what does this depend on?” through bounded focus views.
- Produces deterministic layouts, with automatic bounded motion for small projections.
- Loads the graph once and fetches note bodies only when selected.
- Renders inline and display math at build time with locally bundled KaTeX.
- Publishes as static assets under both root and repository GitHub Pages paths.

Markdown remains portable and editable in Obsidian, GitHub, or any text editor. Nested folders are
supported; node IDs preserve their vault-relative paths.

## Publish from GitHub

1. Click **Use this template**.
2. Add Markdown and local images to [`content/`](content).
3. Declare relationship fields in [`rhizome.config.yaml`](rhizome.config.yaml).
4. Select **Settings → Pages → GitHub Actions** once.
5. Push to `main` or run **Deploy to GitHub Pages**.

Every subsequent content change is checked, compiled, and published by the repository workflows.

## Connect ChatGPT to the public vault

Rhizome includes an anonymous, read-only MCP Worker with `search`, `fetch`, `browse`, and `get_context`
tools. It retrieves exact Markdown and typed one-hop graph evidence from the deployed Pages site.
This is a raw endpoint—not a published plugin—and it has no credentials, database, OpenAI API key,
or Markdown write access.

> [!WARNING]
> The Pages build publishes exact source Markdown—including frontmatter—in
> content-hashed artifacts referenced by `data/knowledge.json`. Use this milestone only for content
> intended to be public. Drafts and excluded notes are omitted.

One public vault needs one Worker endpoint; every reader can connect that same endpoint. A template
fork with different content should deploy its own Worker and set `RHIZOME_SITE_URL` in
[`wrangler.jsonc`](wrangler.jsonc) to that fork's fixed HTTPS Pages URL.

1. Publish the Pages site first and verify that `data/knowledge.json` below its base URL is
   reachable.
2. Authenticate Wrangler and validate the Worker bundle:

   ```sh
   npx wrangler login
   npm run mcp:check
   ```

3. Deploy and copy the resulting `workers.dev` URL:

   ```sh
   npm run mcp:deploy
   curl https://YOUR-WORKER.workers.dev/health
   ```

4. Inspect `https://YOUR-WORKER.workers.dev/mcp` and call every tool:

   ```sh
   npx @modelcontextprotocol/inspector@latest
   ```

5. In ChatGPT, enable **Settings → Security and login → Developer mode**. Open
   [ChatGPT Plugins](https://chatgpt.com/plugins), add a connection, and enter the complete
   `/mcp` URL. Review the discovered tools, start a fresh conversation, and add the connection from
   the tools menu. Developer mode availability depends on the ChatGPT account and workspace policy.

See OpenAI's [MCP server guidance](https://developers.openai.com/plugins/build/mcp-server),
[ChatGPT connection workflow](https://developers.openai.com/plugins/deploy/connect-chatgpt), and
the repository's [evaluation checklist](docs/mcp-evaluation.md). Content changes become visible
after the next Pages deployment and the Worker's 60-second manifest cache expires; the Worker does
not need redeployment.

`browse` discovers directories, tags and types without guessing a query. `search` finds candidate
notes; `fetch` reads their exact source; `get_context` returns one-hop relationships and source
evidence. Discovery and context are paginated. Cursors must be restarted when the vault changes.
Search is English-first and lexical: it is not semantic search and scores are not confidence.

See [retrieval architecture, measured results and limits](docs/retrieval.md). Run:

```sh
npm run mcp:evaluate
npm run mcp:check
npm run mcp:integration
npm run mcp:integration -- --inspector
npm run mcp:benchmark
```

The evaluation uses frozen corpora, so replacing `content/` does not change its labelled tests.
The integration test runs the actual Worker over HTTP and waits for its real cache expiry. The
optional Inspector run downloads the pinned official Inspector CLI. Use Node 24 LTS for tooling.
The 10,000-note target is a measured size envelope, not a promise for arbitrary vaults; production
memory and ChatGPT tool-selection acceptance must be checked on the deployed endpoint.

## Declare relationships

Only configured top-level Properties become typed edges. Other frontmatter remains metadata.

```yaml
---
title: Scaled dot-product attention
types: [mechanism]
tags: [attention, transformer]
depends-on:
  - "[[Attention]]"
  - "[[Matrix multiplication]]"
supported-by:
  - "[Attention Is All You Need](https://arxiv.org/abs/1706.03762)"
---
```

```yaml
relations:
  depends-on:
    label: Depends on
    inverseLabel: Dependency of
    directed: true
    color: "#d97757"
```

Directed relations can use `inverseLabel` to describe the relationship from the target note's
perspective. The reader therefore shows `Depends on` in one direction and `Dependency of` in the
other without requiring directional arrows.

Missing links remain visible. Ambiguous links and case-colliding paths fail the build rather than
silently connecting the wrong knowledge. Configuration is validated against
[`rhizome.schema.json`](rhizome.schema.json).

## Develop locally

Requires Node 22.18+ or Node 24.11+.

```sh
npm install
npm run dev
```

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run benchmark
npm run mcp:check
```

`npm run mcp:dev` starts the Worker locally, still reading from the fixed public HTTPS Pages source.
`npm run mcp:deploy` performs the manual Cloudflare deployment.

The compiler follows `discover → parse → filter → resolve → graph → layout → emit`. Production
builds are clean and deterministic; development reparses changed notes incrementally. The browser
receives one compact graph manifest and lazy, content-hashed note artifacts—never the Markdown
parser or layout compiler.

Rhizome is MIT licensed. See [`NOTICE.md`](NOTICE.md) for ecosystem attribution.
