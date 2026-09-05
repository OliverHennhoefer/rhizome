import MiniSearch, { type Options } from "minisearch";
import { eng } from "stopword";

export const ANALYZER_VERSION = 1;
export const SEARCH_FIELDS = ["title", "aliases", "headings", "tags", "types", "path", "body"];
export const SEARCH_BOOSTS = {
  title: 8,
  aliases: 6,
  headings: 5,
  tags: 4,
  types: 4,
  path: 3,
  body: 1,
};
const stopwords = new Set(eng);
export function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}
export function identity(value: string): string {
  return normalize(value).trim().replace(/\s+/g, " ");
}
export function tokenize(value: string): string[] {
  value = normalize(value);
  // Retain punctuation-bearing identifiers as well as component words.
  const identifiers =
    value.match(/[\p{L}\p{N}_]+(?:(?:::|[.#])?[\p{L}\p{N}_]+)*(?:\+\+|#)?/gu) ?? [];
  const words: string[] = MiniSearch.getDefault("tokenize")(value);
  const present = new Set(words);
  const extras = identifiers.filter((term) => !present.has(term));
  // Preserve term frequency for BM25; deduplicate only the query, not a document.
  return [...words, ...extras].filter(Boolean);
}
export function isStopword(term: string): boolean {
  return stopwords.has(term);
}
export function queryTerms(query: string): string[] {
  return [...new Set(tokenize(query).filter((term) => !isStopword(term)))];
}
export interface SearchDocument {
  id: string;
  title: string;
  aliases: string[];
  headings: string[];
  tags: string[];
  types: string[];
  path: string;
  body: string;
}
export const searchOptions: Options<SearchDocument> = {
  fields: SEARCH_FIELDS,
  extractField: (document, field) => {
    const value = document[field as keyof SearchDocument];
    return Array.isArray(value) ? value.join(" ") : value;
  },
  tokenize,
  processTerm: (term) => (isStopword(term) ? null : normalize(term)),
  searchOptions: { boost: SEARCH_BOOSTS, prefix: false, fuzzy: false, combineWith: "OR" },
};
export function buildSearchIndex(documents: SearchDocument[]): string {
  const index = new MiniSearch(searchOptions);
  index.addAll(documents);
  return JSON.stringify({ ...index.toJSON(), analyzerVersion: ANALYZER_VERSION });
}
