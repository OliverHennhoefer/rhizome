import MiniSearch from "minisearch";
import type { KnowledgeDocument } from "../shared/contracts.ts";
import { compareText } from "../shared/order.ts";
import {
  ANALYZER_VERSION,
  identity,
  isStopword,
  normalize,
  queryTerms,
  type SearchDocument,
  searchOptions,
} from "../shared/search-analyzer.ts";
import { invalidArtifact, KnowledgeError } from "./errors.ts";
import type { SearchOutput } from "./tool-contracts.ts";
import { normalizeSiteUrl, noteUrl } from "./urls.ts";

// Query scaffolding is not evidence of a subject match. These words remain
// searchable when they are the entire query, and remain in the body index.
const scaffolding = new Set(
  "according alias canonical discuss explain find give guidance information knowledge note notes recommendations say says summarize tell title using vault whose".split(
    " ",
  ),
);
function identityWords(value: string): string[] {
  return normalize(value).match(/[\p{L}\p{N}_]+(?:[.:/][\p{L}\p{N}_]+)*(?:\+\+|#)?/gu) ?? [];
}

export class NoteSearch {
  private readonly index: MiniSearch<SearchDocument>;
  private readonly identities = new Map<string, Set<string>>();
  private readonly documents: Map<string, KnowledgeDocument>;
  private readonly site: string;

  constructor(serialized: string, documents: KnowledgeDocument[], site: string) {
    this.site = normalizeSiteUrl(site).href;
    this.documents = new Map(documents.map((doc) => [doc.id, doc]));
    try {
      const data = JSON.parse(serialized);
      if (data.analyzerVersion !== ANALYZER_VERSION)
        invalidArtifact("Search index analyzer version is invalid");
      this.index = MiniSearch.loadJS(data, searchOptions);
    } catch {
      invalidArtifact("Search index could not be decoded");
    }
    if (
      this.index.documentCount !== documents.length ||
      documents.some((doc) => !this.index.has(doc.id))
    )
      invalidArtifact("Search index and catalog IDs disagree");
    for (const doc of documents)
      for (const name of [doc.id, doc.path, doc.title, ...doc.aliases]) {
        const key = identityWords(name).join(" ");
        const ids = this.identities.get(key) ?? new Set<string>();
        ids.add(doc.id);
        this.identities.set(key, ids);
      }
  }

  private exactMatches(query: string): Set<string> {
    const words = identityWords(query);
    const matches: Array<{ start: number; end: number; ids: Set<string> }> = [];
    for (let start = 0; start < words.length; start++)
      for (let end = words.length; end > start; end--) {
        const ids = this.identities.get(words.slice(start, end).join(" "));
        if (
          ids &&
          ((start === 0 && end === words.length) ||
            words.slice(start, end).some((word) => !isStopword(word)))
        )
          matches.push({ start, end, ids });
      }
    return new Set(
      matches
        .filter(
          (match) =>
            !matches.some(
              (other) =>
                other.start <= match.start &&
                other.end >= match.end &&
                other.end - other.start > match.end - match.start,
            ),
        )
        .flatMap((match) => [...match.ids]),
    );
  }

  private document(id: string): KnowledgeDocument {
    const document = this.documents.get(id);
    if (!document) invalidArtifact("Search result has an unknown document ID");
    return document;
  }

  search(query: string): SearchOutput {
    if (query.length > 512)
      throw new KnowledgeError("INVALID_INPUT", "Search query exceeds 512 characters");
    const raw = queryTerms(query);
    if (raw.length > 32 || identityWords(query).length > 32)
      throw new KnowledgeError("INVALID_INPUT", "Search query exceeds 32 terms");
    if (!identity(query)) return { results: [] };
    const exact = this.exactMatches(query);
    const meaningful = raw.filter((term) => !scaffolding.has(term));
    const terms = meaningful.length ? meaningful : raw;
    const termSet = new Set(terms);
    const literal = this.index.search(query, { tokenize: () => terms });
    const matched = new Set(literal.flatMap((result) => result.queryTerms));
    const fuzzy = new Set(
      terms
        .filter((term) => !matched.has(term) && term.length >= 5 && term.length <= 64)
        .slice(0, 2),
    );
    const last = queryTerms(query.trim().split(/\s+/u).at(-1) ?? "").at(-1);
    const prefix =
      last && termSet.has(last) && last.length >= 3 && !matched.has(last) ? last : undefined;
    const results =
      fuzzy.size || prefix
        ? this.index.search(query, {
            tokenize: () => terms,
            fuzzy: (term) => (fuzzy.has(term) ? 1 : false),
            maxFuzzy: 1,
            prefix: (term) => term === prefix,
          })
        : literal;
    const candidates = new Map(
      results.map((result) => [
        String(result.id),
        {
          score: result.score,
          coverage: result.queryTerms.length / (terms.length || 1),
          metadata: Object.entries(result.match).some(
            ([term, fields]) =>
              termSet.has(term) &&
              !isStopword(term) &&
              !scaffolding.has(term) &&
              fields.some((field) => field !== "body" && !(field === "types" && term === "note")),
          ),
        },
      ]),
    );
    for (const id of exact)
      if (!candidates.has(id)) candidates.set(id, { score: 0, coverage: 0, metadata: true });
    const ranked = [...candidates]
      .filter(([id, result]) => exact.has(id) || result.metadata || result.coverage >= 0.6)
      .sort(
        ([a, left], [b, right]) =>
          Number(exact.has(b)) - Number(exact.has(a)) ||
          right.score - left.score ||
          right.coverage - left.coverage ||
          compareText(this.document(a).title, this.document(b).title) ||
          compareText(a, b),
      );
    return {
      results: ranked
        .slice(0, 10)
        .map(([id]) => ({ id, title: this.document(id).title, url: noteUrl(this.site, id) })),
    };
  }
}
