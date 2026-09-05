import type { z } from "zod";
import type {
  ArtifactReferenceSchema,
  BuildDiagnosticSchema,
  EdgeEvidenceSchema,
  GraphEdgeSchema,
  GraphManifestSchema,
  GraphNodeSchema,
  KnowledgeCatalogSchema,
  KnowledgeDocumentSchema,
  KnowledgeManifestSchema,
  NodeDetailsSchema,
  PublicConfigSchema,
  RelationDefinitionSchema,
  SourceRangeSchema,
} from "./artifact-schemas.ts";

export type ArtifactReference = z.infer<typeof ArtifactReferenceSchema>;
export type BuildDiagnostic = z.infer<typeof BuildDiagnosticSchema>;
export type RelationDefinition = z.infer<typeof RelationDefinitionSchema>;
export type PublicConfig = z.infer<typeof PublicConfigSchema>;
export type GraphManifest = z.infer<typeof GraphManifestSchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type NodeKind = GraphNode["kind"];
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type EdgeEvidence = z.infer<typeof EdgeEvidenceSchema>;
export type NodeDetails = z.infer<typeof NodeDetailsSchema>;
export type SourceRange = z.infer<typeof SourceRangeSchema>;
export type KnowledgeManifest = z.infer<typeof KnowledgeManifestSchema>;
export type KnowledgeCatalog = z.infer<typeof KnowledgeCatalogSchema>;
export type KnowledgeDocument = z.infer<typeof KnowledgeDocumentSchema>;
export interface SourcePoint {
  line: number;
  column: number;
}
