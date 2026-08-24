import { readFile } from "node:fs/promises";
import path from "node:path";
import remarkObsidian from "@quartz-community/remark-obsidian";
import type { Root, RootContent } from "mdast";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { isScalar, isSeq, LineCounter, parseDocument, type Node as YamlNode } from "yaml";
import type { SourceRange } from "../shared/contracts";
import type { ParsedNote, RawOccurrence, RhizomeConfig } from "./types";

type PositionedNode = RootContent & {
  position?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
};

type WikilinkNode = PositionedNode & {
  type: "wikilink";
  path: string;
  heading: string;
  alias: string;
  embedded: boolean;
};

type TagNode = PositionedNode & { type: "tag"; value: string };

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkObsidian, {
    wikilinks: true,
    highlights: true,
    comments: true,
    tags: true,
    customTaskChars: true,
    math: false,
  });

function asStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, "").toLocaleLowerCase();
}

function excerptAt(source: string, range: SourceRange): string {
  const lines = source.split(/\r?\n/);
  return (lines[range.startLine - 1] ?? "").trim().replace(/\s+/g, " ").slice(0, 240);
}

function nodeRange(node: PositionedNode, lineOffset: number): SourceRange {
  const start = node.position?.start ?? { line: 1, column: 1 };
  const end = node.position?.end ?? start;
  return {
    startLine: start.line + lineOffset,
    startColumn: start.column,
    endLine: end.line + lineOffset,
    endColumn: end.column,
  };
}

function splitFrontmatter(source: string): { body: string; yaml: string; bodyStartLine: number } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return { body: source, yaml: "", bodyStartLine: 1 };
  return {
    body: source.slice(match[0].length),
    yaml: match[1],
    bodyStartLine: match[0].split(/\r?\n/).length,
  };
}

function yamlValues(node: YamlNode | null | undefined): YamlNode[] {
  if (!node) return [];
  return isSeq(node) ? (node.items.filter(Boolean) as YamlNode[]) : [node];
}

function frontmatterRange(node: YamlNode, counter: LineCounter): SourceRange {
  const range = node.range ?? [0, 0, 0];
  const start = counter.linePos(range[0]);
  const end = counter.linePos(range[1]);
  return {
    startLine: start.line + 1,
    startColumn: start.col,
    endLine: end.line + 1,
    endColumn: end.col,
  };
}

function scalarValue(node: YamlNode): string | undefined {
  if (!isScalar(node)) return undefined;
  return typeof node.value === "string" ? node.value : String(node.value ?? "");
}

function parseWikilinkTarget(value: string): { target: string; anchor?: string } {
  const wiki = value.match(/^!?\[\[([\s\S]*?)\]\]$/);
  const raw = (wiki?.[1] ?? value).split("|")[0].trim();
  const hash = raw.indexOf("#");
  if (hash < 0) return { target: raw };
  return { target: raw.slice(0, hash), anchor: raw.slice(hash + 1) };
}

export async function parseNote(
  absolutePath: string,
  vaultRoot: string,
  config: RhizomeConfig,
): Promise<ParsedNote> {
  const source = await readFile(absolutePath, "utf8");
  const relativePath = path.relative(vaultRoot, absolutePath).split(path.sep).join("/");
  const id = relativePath.replace(/\.md$/i, "");
  const split = splitFrontmatter(source);
  const counter = new LineCounter();
  const document = parseDocument(split.yaml, { lineCounter: counter, keepSourceTokens: true });
  if (document.errors.length) {
    throw new Error(`${relativePath}: ${document.errors[0].message}`);
  }
  const metadata = (document.toJS() ?? {}) as Record<string, unknown>;
  const root = markdownProcessor.parse(split.body) as Root;
  await markdownProcessor.run(root, { path: relativePath, value: split.body });

  const occurrences: RawOccurrence[] = [];
  const bodyTags: string[] = [];
  const headings: string[] = [];
  const blocks: string[] = [];
  const lineOffset = split.bodyStartLine - 1;

  visit(root, (rawNode) => {
    const node = rawNode as PositionedNode;
    if (node.type === "wikilink") {
      const wiki = node as WikilinkNode;
      const range = nodeRange(wiki, lineOffset);
      occurrences.push({
        target: wiki.path,
        anchor: wiki.heading || undefined,
        origin: "body",
        type: "link",
        embedded: wiki.embedded,
        range,
        excerpt: excerptAt(source, range),
      });
    } else if (node.type === "link") {
      const url = (node as PositionedNode & { url: string }).url;
      if (!/^[a-z][a-z\d+.-]*:/i.test(url) && !url.startsWith("#")) {
        const decoded = decodeURIComponent(url);
        const hash = decoded.indexOf("#");
        const range = nodeRange(node, lineOffset);
        occurrences.push({
          target: hash < 0 ? decoded : decoded.slice(0, hash),
          anchor: hash < 0 ? undefined : decoded.slice(hash + 1),
          origin: "body",
          type: "link",
          embedded: false,
          range,
          excerpt: excerptAt(source, range),
        });
      }
    } else if (node.type === "tag") {
      bodyTags.push(normalizeTag((node as TagNode).value));
    } else if (node.type === "heading") {
      const text: string[] = [];
      visit(node, "text", (child: { value: string }) => text.push(child.value));
      headings.push(text.join("").trim());
    } else if (node.type === "paragraph") {
      const text: string[] = [];
      visit(node, "text", (child: { value: string }) => text.push(child.value));
      const block = text.join(" ").match(/\s\^([^\s^]+)\s*$/)?.[1];
      if (block) blocks.push(block);
    }
  });

  for (const key of Object.keys(config.relations)) {
    const valueNode = document.getIn([key], true) as YamlNode | undefined;
    for (const item of yamlValues(valueNode)) {
      const value = scalarValue(item);
      if (!value) continue;
      const parsed = parseWikilinkTarget(value);
      const range = frontmatterRange(item, counter);
      occurrences.push({
        target: parsed.target,
        anchor: parsed.anchor,
        origin: "frontmatter",
        type: key,
        embedded: false,
        range,
        excerpt: excerptAt(source, range),
      });
    }
  }

  const title = typeof metadata.title === "string" ? metadata.title : path.posix.basename(id);
  const tags = [...new Set([...asStrings(metadata.tags).map(normalizeTag), ...bodyTags])].sort();
  const types = asStrings(metadata.types ?? metadata.type)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    absolutePath,
    id,
    path: relativePath,
    source,
    body: split.body,
    bodyStartLine: split.bodyStartLine,
    root,
    title,
    aliases: asStrings(metadata.aliases ?? metadata.alias)
      .map((item) => item.trim())
      .filter(Boolean),
    types: types.length ? [...new Set(types)].sort() : ["note"],
    tags,
    permalink: typeof metadata.permalink === "string" ? metadata.permalink : undefined,
    draft: metadata.draft === true,
    metadata,
    occurrences,
    headings,
    blocks,
  };
}
