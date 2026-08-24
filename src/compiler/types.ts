import type { Root } from "mdast";
import type { BuildDiagnostic, SourceRange } from "../shared/contracts";

export interface RhizomeConfig {
  site: { title: string };
  content: { root: string; exclude: string[] };
  relations: Record<string, { label: string; directed: boolean; color: string }>;
}

export interface RawOccurrence {
  target: string;
  anchor?: string;
  origin: "body" | "frontmatter";
  type: string;
  embedded: boolean;
  range: SourceRange;
  excerpt: string;
}

export interface ParsedNote {
  absolutePath: string;
  id: string;
  path: string;
  source: string;
  body: string;
  bodyStartLine: number;
  root: Root;
  title: string;
  aliases: string[];
  types: string[];
  tags: string[];
  permalink?: string;
  draft: boolean;
  metadata: Record<string, unknown>;
  occurrences: RawOccurrence[];
  headings: string[];
  blocks: string[];
}

export interface ResolvedOccurrence extends RawOccurrence {
  source: string;
  targetId: string;
}

export interface CompilationResult {
  assets: Map<string, string | Uint8Array>;
  diagnostics: BuildDiagnostic[];
  parsedFiles: string[];
}
