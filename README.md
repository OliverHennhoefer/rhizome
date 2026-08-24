# Rhizome

Turn an Obsidian-compatible Markdown vault into a graph-native knowledge space. Markdown is the
source material; the graph is the product.

Rhizome compiles links, typed frontmatter relationships, source ranges, backlinks, communities,
and deterministic coordinates into a static browser application. Notes are fetched only when
selected. One focused 2D interface handles graph exploration, filtering, and directional analysis.

## Publish your vault

1. Click **Use this template** on GitHub.
2. Put Markdown and local images in [`content`](content).
3. Edit [`rhizome.config.yaml`](rhizome.config.yaml) to declare relationship fields.
4. Before the first workflow run, select **Settings → Pages → GitHub Actions** once. This creates
   the Pages site that the deployment workflow reads and updates.
5. Push to `main` or run **Deploy to GitHub Pages** from the Actions tab.

The workflow discovers the repository base path automatically, builds with Node 24, emits
`.nojekyll`, and deploys `dist`. Query-based navigation works at both `/` and `/repository/` without
redirect rules.

## Authoring contract

Rhizome supports normal Markdown links and Obsidian wikilinks, aliases, headings, blocks, tags,
highlights, comments, GFM, callouts, and top-level Properties. Relation fields accept wikilinks,
internal paths, or HTTP(S) URLs.

```yaml
---
title: Cache invalidation
aliases:
  - Caching
types:
  - concept
tags:
  - architecture
draft: false
depends-on:
  - "[[Event model]]"
supported-by:
  - https://example.com/paper
---
```

Only fields declared under `relations` become edges. Unknown frontmatter remains metadata. Missing
links become visible nodes; ambiguous links and case-colliding paths fail the build.

```yaml
relations:
  depends-on:
    label: Depends on
    directed: true
    color: "#d97757"
```

The committed [`rhizome.schema.json`](rhizome.schema.json) is the configuration contract.

## Local development

Node 22 or newer is required.

```sh
npm install
npm run dev
```

The Vite integration keeps parsed resources in memory. A changed note is reparsed independently;
production builds always start clean. At 256 notes, parsing switches to batches of 128 across at
most four worker threads.

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Run `npm run benchmark` to generate 10,000 notes and 75,000 edges in temporary storage, compile the
vault, report build time and compressed manifest size, and remove the fixture.

## Architecture

```text
content/                  Obsidian-compatible source vault
src/compiler/             discover → parse → filter → resolve → graph → layout → emit
src/shared/contracts.ts   versioned compiler/browser boundary
src/app/                  projection, URL state, Sigma, reader, controls
```

The browser receives `data/graph.json` at startup. Every node points to one content-hashed details
artifact containing sanitized HTML and exact relationship evidence. Markdown parsing and layout
code never enter the browser bundle.

Raw HTML, math, Mermaid, transclusion, non-image media embeds, Canvas, Bases, full-text search,
editing, authentication, collaboration, and arbitrary graph queries are deliberately outside v1.

## License and ecosystem

Rhizome is MIT licensed. See [`NOTICE.md`](NOTICE.md) for Quartz-community, Quartz, Foam, and Cosma
attribution and boundaries.
