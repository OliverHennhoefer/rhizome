import { z } from "zod";

export const ARTIFACT_LIMITS = {
  manifest: 16_384,
  catalog: 16 * 1024 * 1024,
  index: 24 * 1024 * 1024,
  graph: 32 * 1024 * 1024,
  detail: 2 * 1024 * 1024,
  markdown: 2 * 1024 * 1024,
};

export const HashSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const SourceRangeSchema = z
  .object({
    startLine: z.number().int().positive(),
    startColumn: z.number().int().positive(),
    endLine: z.number().int().positive(),
    endColumn: z.number().int().positive(),
  })
  .refine(
    (r) => r.endLine > r.startLine || (r.endLine === r.startLine && r.endColumn >= r.startColumn),
    "Reversed source range",
  );
export const RelationDefinitionSchema = z.object({
  label: z.string(),
  inverseLabel: z.string().optional(),
  directed: z.boolean(),
  color: z.string(),
});
export const PublicConfigSchema = z.object({
  site: z.object({ title: z.string() }),
  relations: z.record(z.string(), RelationDefinitionSchema),
});
export const BuildDiagnosticSchema = z.object({
  severity: z.enum(["warning", "error"]),
  code: z.string(),
  message: z.string(),
  path: z.string().optional(),
  line: z.number().int().positive().optional(),
});
export const GraphNodeSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(["note", "missing", "external"]),
    title: z.string(),
    path: z.string().optional(),
    aliases: z.array(z.string()),
    types: z.array(z.string()),
    tags: z.array(z.string()),
    detailsRef: z.string().regex(/^data\/details\/[a-f0-9]{24}\.json$/),
    x: z.number().finite(),
    y: z.number().finite(),
    community: z.number().int(),
    degree: z.number().int().nonnegative(),
  })
  .refine((node) => node.kind !== "note" || !!node.path, "Real notes require paths");
export const GraphEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.string().min(1),
  directed: z.boolean(),
  occurrences: z.number().int().positive(),
});
export const EdgeEvidenceSchema = z.object({
  edgeId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  type: z.string().min(1),
  origin: z.enum(["body", "frontmatter"]),
  anchor: z.string().optional(),
  range: SourceRangeSchema,
  excerpt: z.string().max(240),
});
export const NodeDetailsSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  html: z.string().optional(),
  incoming: z.array(EdgeEvidenceSchema),
  outgoing: z.array(EdgeEvidenceSchema),
});
export const GraphManifestSchema = z.object({
  schemaVersion: z.literal(2),
  contentHash: HashSchema,
  config: PublicConfigSchema,
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  facets: z.object({
    tags: z.record(z.string(), z.array(z.string())),
    types: z.record(z.string(), z.array(z.string())),
    relations: z.record(z.string(), z.array(z.string())),
  }),
  diagnostics: z.array(BuildDiagnosticSchema),
});
export const ArtifactReferenceSchema = z
  .object({
    path: z.string().regex(/^data\/knowledge\/[a-f0-9]{64}\.(json|md)$/),
    hash: HashSchema,
    bytes: z.number().int().nonnegative(),
  })
  .refine((ref) => ref.path.includes(`/${ref.hash}.`), "Artifact filename does not match hash");
export const KnowledgeDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  path: z.string().min(1),
  aliases: z.array(z.string()),
  types: z.array(z.string()),
  tags: z.array(z.string()),
  markdownRef: ArtifactReferenceSchema,
  lineLengths: z.array(z.number().int().nonnegative()).min(1),
});
export const KnowledgeCatalogSchema = z.object({
  schemaVersion: z.literal(1),
  documents: z.array(KnowledgeDocumentSchema),
});
export const KnowledgeManifestSchema = z.object({
  schemaVersion: z.literal(2),
  contentHash: HashSchema,
  graphContentHash: HashSchema,
  analyzerVersion: z.literal(1),
  site: z.object({ title: z.string() }),
  catalog: ArtifactReferenceSchema,
  index: ArtifactReferenceSchema,
  graph: ArtifactReferenceSchema,
  noteCount: z.number().int().nonnegative(),
  markdownBytes: z.number().int().nonnegative(),
});
