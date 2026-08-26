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

Requires Node 22 or newer.

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
```

The compiler follows `discover → parse → filter → resolve → graph → layout → emit`. Production
builds are clean and deterministic; development reparses changed notes incrementally. The browser
receives one compact graph manifest and lazy, content-hashed note artifacts—never the Markdown
parser or layout compiler.

Rhizome is MIT licensed. See [`NOTICE.md`](NOTICE.md) for ecosystem attribution.
