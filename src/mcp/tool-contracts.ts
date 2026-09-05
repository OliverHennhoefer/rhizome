import { z } from "zod";
import { HashSchema, SourceRangeSchema } from "../shared/artifact-schemas.ts";
import { KnowledgeErrorCodeSchema } from "./errors.ts";

export const ToolErrorOutputSchema = z.object({
  error: z.object({ code: KnowledgeErrorCodeSchema, message: z.string() }),
});

const id = z.string().min(1).max(1024);
export const SearchInputSchema = z.object({
  query: z
    .string()
    .max(512)
    .describe(
      "Keywords or a question; use distinctive titles, aliases or subject terms. Maximum 32 terms.",
    ),
});
export const FetchInputSchema = z.object({
  id: id.describe("Exact note ID returned by search, browse or context."),
});
export const BrowseInputSchema = z.object({
  path: z
    .string()
    .max(1024)
    .optional()
    .describe("Vault-relative directory, default root. Use paths returned by browse."),
  tag: z.string().min(1).max(256).optional(),
  type: z.string().min(1).max(256).optional(),
  cursor: z.string().max(8192).optional(),
});
export const ContextInputSchema = FetchInputSchema.extend({
  direction: z.enum(["incoming", "outgoing", "both"]).default("both"),
  relationTypes: z.array(z.string().min(1).max(256)).max(20).optional(),
  cursor: z.string().max(8192).optional(),
});
export const SearchItemSchema = z.object({ id, title: z.string(), url: z.url() });
export const SearchOutputSchema = z.object({ results: z.array(SearchItemSchema).max(10) });
const MetadataSchema = z.object({
  path: z.string(),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  types: z.array(z.string()),
});
export const FetchOutputSchema = SearchItemSchema.extend({
  text: z.string(),
  metadata: MetadataSchema.extend({ contentHash: HashSchema }),
});
export const ContextNodeSchema = z.object({
  id,
  title: z.string(),
  kind: z.enum(["note", "missing", "external"]),
  path: z.string().optional(),
  url: z.url().optional(),
  types: z.array(z.string()),
  tags: z.array(z.string()),
});
export const ContextEvidenceSchema = z.object({
  origin: z.enum(["body", "frontmatter"]),
  source: id,
  sourceUrl: z.url(),
  target: id,
  anchor: z.string().optional(),
  range: SourceRangeSchema,
  excerpt: z.string(),
});
export const ContextRelationshipSchema = z.object({
  edgeId: id,
  type: z.string(),
  label: z.string(),
  direction: z.enum(["incoming", "outgoing", "undirected", "self"]),
  directed: z.boolean(),
  counterpart: ContextNodeSchema,
  evidence: z.array(ContextEvidenceSchema).max(3),
  evidenceCount: z.number().int().nonnegative(),
  evidenceTruncated: z.boolean(),
});
const PageSchema = z.object({
  snapshotHash: HashSchema,
  total: z.number().int().nonnegative(),
  truncated: z.boolean(),
  nextCursor: z.string().optional(),
});
export const ContextOutputSchema = PageSchema.extend({
  root: ContextNodeSchema.extend({ kind: z.literal("note"), url: z.url(), path: z.string() }),
  direction: z.enum(["incoming", "outgoing", "both"]),
  relationships: z.array(ContextRelationshipSchema).max(50),
});
export const BrowseOutputSchema = PageSchema.extend({
  path: z.string(),
  site: z.object({ title: z.string(), noteCount: z.number().int().nonnegative() }),
  entries: z
    .array(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("directory"),
          path: z.string(),
          title: z.string(),
          noteCount: z.number().int().nonnegative(),
        }),
        SearchItemSchema.extend({ kind: z.literal("note"), ...MetadataSchema.shape }),
      ]),
    )
    .max(50),
});
export type SearchOutput = z.infer<typeof SearchOutputSchema>;
export type FetchOutput = z.infer<typeof FetchOutputSchema>;
export type BrowseInput = z.input<typeof BrowseInputSchema>;
export type BrowseOutput = z.infer<typeof BrowseOutputSchema>;
export type ContextInput = z.input<typeof ContextInputSchema>;
export type ContextOutput = z.infer<typeof ContextOutputSchema>;
export type ContextNode = z.infer<typeof ContextNodeSchema>;
export type ContextRelationship = z.infer<typeof ContextRelationshipSchema>;
export interface KnowledgeReader {
  search(query: string): Promise<SearchOutput>;
  fetch(id: string): Promise<FetchOutput>;
  browse(input: BrowseInput): Promise<BrowseOutput>;
  context(input: ContextInput): Promise<ContextOutput>;
}
export interface KnowledgeProvider {
  read<T>(operation: (reader: KnowledgeReader) => Promise<T>): Promise<T>;
}
