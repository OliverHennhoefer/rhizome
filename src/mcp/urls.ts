import { KnowledgeError } from "./errors.ts";

export function normalizeSiteUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new KnowledgeError("INVALID_INPUT", "RHIZOME_SITE_URL must be an absolute HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new KnowledgeError(
      "INVALID_INPUT",
      "RHIZOME_SITE_URL must be a fixed HTTPS URL without credentials or query data",
    );
  }
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url;
}
export function noteUrl(site: string, id: string): string {
  const url = normalizeSiteUrl(site);
  url.searchParams.set("note", id);
  return url.href;
}
