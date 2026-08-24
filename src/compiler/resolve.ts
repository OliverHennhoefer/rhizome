import path from "node:path";
import type { BuildDiagnostic } from "../shared/contracts";
import type { ParsedNote, RawOccurrence } from "./types";

function fold(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase();
}

function stripMarkdown(value: string): string {
  return value.replace(/\\/g, "/").replace(/\.md$/i, "").replace(/^\.\//, "");
}

function add(map: Map<string, Set<string>>, key: string, id: string): void {
  const folded = fold(key);
  const values = map.get(folded) ?? new Set<string>();
  values.add(id);
  map.set(folded, values);
}

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export class ResolutionError extends Error {
  constructor(
    message: string,
    readonly diagnostic: BuildDiagnostic,
  ) {
    super(message);
  }
}

export class ResourceIndex {
  readonly notes = new Map<string, ParsedNote>();
  private readonly canonical = new Map<string, Set<string>>();
  private readonly suffixes = new Map<string, Set<string>>();
  private readonly basenames = new Map<string, Set<string>>();
  private readonly aliases = new Map<string, Set<string>>();
  private readonly permalinks = new Map<string, Set<string>>();

  constructor(notes: ParsedNote[]) {
    for (const note of notes) {
      this.notes.set(note.id, note);
      add(this.canonical, note.id, note.id);
      add(this.basenames, path.posix.basename(note.id), note.id);
      for (const alias of note.aliases) add(this.aliases, alias, note.id);
      if (note.permalink) add(this.permalinks, note.permalink.replace(/^\/+|\/+$/g, ""), note.id);

      const segments = note.id.split("/");
      for (let index = 0; index < segments.length; index += 1) {
        add(this.suffixes, segments.slice(index).join("/"), note.id);
      }
    }
  }

  resolve(
    sourceId: string,
    occurrence: Pick<RawOccurrence, "target" | "range">,
  ): string | undefined {
    let raw: string;
    try {
      raw = decodeURIComponent(occurrence.target.trim());
    } catch {
      throw this.error(
        sourceId,
        occurrence,
        "unsafe-target",
        `Invalid encoded link target: ${occurrence.target}`,
      );
    }
    if (!raw) return sourceId;
    if (raw.includes("\0") || raw.startsWith("~")) {
      throw this.error(sourceId, occurrence, "unsafe-target", `Unsafe link target: ${raw}`);
    }

    const target = stripMarkdown(raw);
    const sourceDirectory = path.posix.dirname(sourceId);
    const candidates: string[][] = [];

    if (raw.startsWith("/")) {
      candidates.push(this.from(this.canonical, target.replace(/^\/+/, "")));
    } else if (raw.startsWith("./") || raw.startsWith("../") || raw.includes("/")) {
      const relative = path.posix.normalize(path.posix.join(sourceDirectory, target));
      if (!relative.startsWith("../") && relative !== "..") {
        candidates.push(this.from(this.canonical, relative));
      }
      candidates.push(this.from(this.canonical, target.replace(/^\/+/, "")));
    } else {
      candidates.push(this.from(this.canonical, target));
    }

    candidates.push(this.from(this.suffixes, target.replace(/^\/+/, "")));
    candidates.push([
      ...this.from(this.basenames, path.posix.basename(target)),
      ...this.from(this.aliases, target),
      ...this.from(this.permalinks, target.replace(/^\/+|\/+$/g, "")),
    ]);

    for (const group of candidates) {
      const matches = unique(group);
      if (matches.length === 1) return matches[0];
      if (matches.length > 1) {
        throw this.error(
          sourceId,
          occurrence,
          "ambiguous-link",
          `Ambiguous link "${raw}" matches ${matches.join(", ")}`,
        );
      }
    }
    return undefined;
  }

  private from(map: Map<string, Set<string>>, key: string): string[] {
    return [...(map.get(fold(key)) ?? [])];
  }

  private error(
    sourceId: string,
    occurrence: Pick<RawOccurrence, "range">,
    code: string,
    message: string,
  ): ResolutionError {
    const source = this.notes.get(sourceId);
    const diagnostic: BuildDiagnostic = {
      severity: "error",
      code,
      message,
      path: source?.path,
      line: occurrence.range.startLine,
    };
    return new ResolutionError(message, diagnostic);
  }
}

export function assertNoCaseCollisions(notes: ParsedNote[]): void {
  const ids = new Map<string, string>();
  for (const note of notes) {
    const folded = fold(note.id);
    const prior = ids.get(folded);
    if (prior && prior !== note.id) {
      throw new ResolutionError(`Case-colliding files: ${prior}.md and ${note.id}.md`, {
        severity: "error",
        code: "case-collision",
        message: `Case-colliding files: ${prior}.md and ${note.id}.md`,
        path: note.path,
      });
    }
    ids.set(folded, note.id);
  }
}
