import path from "node:path";
import rehypeObsidian from "@quartz-community/rehype-obsidian";
import type { Element, Root as HastRoot, Text } from "hast";
import type { Link, Parent, Root, RootContent } from "mdast";
import rehypeKatex from "rehype-katex";
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import type { ResourceIndex } from "./resolve";
import type { ParsedNote } from "./types";

type WikiNode = RootContent & {
  type: "wikilink";
  path: string;
  heading: string;
  alias: string;
  embedded: boolean;
};

const imageExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

function isExternal(url: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(url);
}

function queryHref(id: string, anchor?: string): string {
  const query = `?note=${encodeURIComponent(id)}`;
  return anchor ? `${query}&anchor=${encodeURIComponent(anchor)}` : query;
}

function callouts(tree: Root): void {
  visit(tree, "blockquote", (blockquote) => {
    const node = blockquote as Parent & { data?: Record<string, unknown> };
    const paragraph = node.children[0] as Parent | undefined;
    const first = paragraph?.children?.[0] as { type?: string; value?: string } | undefined;
    if (first?.type !== "text" || !first.value) return;
    const match = first.value.match(/^\[!([\w-]+)\]([+-])?\s*([\s\S]*)$/);
    if (!match) return;
    const kind = match[1].toLocaleLowerCase();
    first.value =
      match[3] || kind.replace(/(^|-)(\w)/g, (_, lead, letter) => `${lead}${letter.toUpperCase()}`);
    node.data = {
      ...node.data,
      hProperties: { className: ["callout", `callout-${kind}`], "data-callout": kind },
    };
  });
}

function rewriteAst(
  note: ParsedNote,
  index: ResourceIndex,
  media: Map<string, string>,
): typeof note.root {
  const tree = structuredClone(note.root);
  callouts(tree);

  visit(tree, (rawNode, childIndex, rawParent) => {
    const node = rawNode as RootContent;
    const parent = rawParent as Parent | undefined;
    if (!parent || childIndex === undefined) return;
    if (node.type === "wikilink") {
      const wiki = node as WikiNode;
      const extension = path.posix.extname(wiki.path).toLocaleLowerCase();
      const mediaRef = resolveMedia(note.id, wiki.path, media);
      if (wiki.embedded && imageExtensions.has(extension) && mediaRef) {
        parent.children[childIndex] = {
          type: "image",
          url: mediaRef,
          alt: wiki.alias || path.posix.basename(wiki.path),
          title: null,
        };
        return;
      }
      const target = index.resolve(note.id, {
        target: wiki.path,
        range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
      });
      const label = wiki.alias || wiki.path || wiki.heading || note.title;
      parent.children[childIndex] = {
        type: "link",
        url: target
          ? queryHref(target, wiki.heading || undefined)
          : queryHref(`missing:${wiki.path}`),
        children: [{ type: "text", value: label }],
      } as Link;
      return;
    }
    if (node.type === "highlight") {
      parent.children[childIndex] = { type: "emphasis", children: node.children as any };
      return;
    }
    if (node.type === "tag") {
      parent.children[childIndex] = { type: "text", value: `#${node.value}` };
      return;
    }
    if (node.type === "link") {
      const link = node as Link;
      if (!isExternal(link.url) && !link.url.startsWith("#")) {
        const [targetText, anchor] = link.url.split("#", 2);
        const target = index.resolve(note.id, {
          target: targetText,
          range: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
        });
        link.url = target ? queryHref(target, anchor) : queryHref(`missing:${targetText}`);
      }
    }
    if (node.type === "image") {
      const image = node as RootContent & { url: string };
      if (!isExternal(image.url)) image.url = resolveMedia(note.id, image.url, media) ?? image.url;
    }
  });
  return tree;
}

function resolveMedia(
  sourceId: string,
  target: string,
  media: Map<string, string>,
): string | undefined {
  const clean = decodeURIComponent(target).replace(/^\//, "");
  const relative = path.posix.normalize(path.posix.join(path.posix.dirname(sourceId), clean));
  return media.get(relative.toLocaleLowerCase()) ?? media.get(clean.toLocaleLowerCase());
}

function externalLinkSafety(tree: HastRoot): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "a") return;
    const href = String(node.properties.href ?? "");
    if (!isExternal(href)) return;
    node.properties.target = "_blank";
    node.properties.rel = ["noopener", "noreferrer"];
  });
}

function annotateCalloutTitles(tree: HastRoot): void {
  visit(tree, "element", (node: Element) => {
    if (node.tagName !== "blockquote" || !node.properties.className) return;
    const classes = Array.isArray(node.properties.className) ? node.properties.className : [];
    if (!classes.includes("callout")) return;
    const paragraph = node.children.find(
      (child): child is Element => child.type === "element" && child.tagName === "p",
    );
    const title = paragraph?.children[0];
    if (title?.type === "text") (title as Text).value = title.value.trim();
  });
}

export async function renderNote(
  note: ParsedNote,
  index: ResourceIndex,
  media: Map<string, string>,
): Promise<string> {
  const sanitizeSchema: SanitizeOptions = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
      code: [["className", /^language-./, "math-inline", "math-display"]],
      blockquote: [
        ...(defaultSchema.attributes?.blockquote ?? []),
        ["className", /^callout(?:-[\w-]+)?$/],
        "dataCallout",
      ],
    },
  };
  const processor = unified()
    .use(remarkRehype)
    .use(rehypeObsidian, {
      blockReferences: true,
      youTubeEmbed: false,
      tweetEmbed: false,
      checkbox: false,
      mermaid: false,
      obsidianUri: false,
    })
    .use(() => externalLinkSafety)
    .use(() => annotateCalloutTitles)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeKatex)
    .use(rehypeStringify);
  const hast = (await processor.run(rewriteAst(note, index, media))) as HastRoot;
  return processor.stringify(hast);
}
