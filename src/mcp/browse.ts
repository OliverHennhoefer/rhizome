import type { KnowledgeCatalog, KnowledgeManifest } from "../shared/contracts.ts";
import { compareText } from "../shared/order.ts";
import { normalize } from "../shared/search-analyzer.ts";
import { KnowledgeError } from "./errors.ts";
import { page } from "./pagination.ts";
import { type BrowseInput, BrowseInputSchema, type BrowseOutput } from "./tool-contracts.ts";
import { noteUrl } from "./urls.ts";

export function browseCatalog(
  catalog: KnowledgeCatalog,
  manifest: KnowledgeManifest,
  site: string,
  input: BrowseInput,
): BrowseOutput {
  const options = BrowseInputSchema.parse(input);
  const path = (options.path ?? "").replace(/\/$/, "");
  if (
    path.startsWith("/") ||
    path.includes("\\") ||
    path.split("/").some((part) => part === "." || part === "..") ||
    path.includes("\0")
  )
    throw new KnowledgeError("INVALID_INPUT", "Use a vault-relative directory returned by browse");
  const prefix = path ? `${path}/` : "";
  const subtree = catalog.documents.filter((doc) => doc.path.startsWith(prefix));
  if (path && !subtree.length)
    throw new KnowledgeError("UNKNOWN_ID", `Directory "${path}" was not found`);
  const tag = options.tag ? normalize(options.tag).replace(/^#/, "") : undefined;
  const type = options.type ? normalize(options.type) : undefined;
  const directories = new Map<string, number>();
  const entries: BrowseOutput["entries"] = [];
  for (const doc of subtree) {
    if (tag && !doc.tags.some((value) => normalize(value) === tag)) continue;
    if (type && !doc.types.some((value) => normalize(value) === type)) continue;
    const relative = doc.path.slice(prefix.length);
    if (!tag && !type && relative.includes("/")) {
      const directory = prefix + relative.split("/")[0];
      directories.set(directory, (directories.get(directory) ?? 0) + 1);
    } else
      entries.push({
        kind: "note",
        id: doc.id,
        title: doc.title,
        url: noteUrl(site, doc.id),
        path: doc.path,
        aliases: doc.aliases,
        tags: doc.tags,
        types: doc.types,
      });
  }
  for (const [directory, noteCount] of directories)
    entries.push({
      kind: "directory",
      path: directory,
      title: directory.slice(directory.lastIndexOf("/") + 1),
      noteCount,
    });
  entries.sort((a, b) => compareText(a.kind, b.kind) || compareText(a.path, b.path));
  const { items, ...pagination } = page(
    entries,
    manifest.contentHash,
    { tool: "browse", path, tag, type },
    options.cursor,
  );
  return {
    ...pagination,
    path,
    site: { title: manifest.site.title, noteCount: manifest.noteCount },
    entries: items,
  };
}
