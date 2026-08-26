export type NodeKind = "note" | "missing" | "external";

export interface BuildDiagnostic {
  severity: "warning" | "error";
  code: string;
  message: string;
  path?: string;
  line?: number;
}

export interface RelationDefinition {
  label: string;
  inverseLabel?: string;
  directed: boolean;
  color: string;
}

export interface PublicConfig {
  site: { title: string };
  relations: Record<string, RelationDefinition>;
}

export interface GraphManifest {
  schemaVersion: 2;
  contentHash: string;
  config: PublicConfig;
  nodes: GraphNode[];
  edges: GraphEdge[];
  facets: {
    tags: Record<string, string[]>;
    types: Record<string, string[]>;
    relations: Record<string, string[]>;
  };
  diagnostics: BuildDiagnostic[];
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  title: string;
  path?: string;
  aliases: string[];
  types: string[];
  tags: string[];
  detailsRef: string;
  x: number;
  y: number;
  community: number;
  degree: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  directed: boolean;
  occurrences: number;
}

export interface NodeDetails {
  schemaVersion: 1;
  id: string;
  html?: string;
  incoming: EdgeEvidence[];
  outgoing: EdgeEvidence[];
}

export interface EdgeEvidence {
  edgeId: string;
  source: string;
  target: string;
  type: string;
  origin: "body" | "frontmatter";
  anchor?: string;
  range: SourceRange;
  excerpt: string;
}

export interface SourcePoint {
  line: number;
  column: number;
}

export interface SourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
