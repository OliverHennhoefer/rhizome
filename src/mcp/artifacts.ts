import type { z } from "zod";
import { ArtifactReferenceSchema } from "../shared/artifact-schemas.ts";
import type { ArtifactReference } from "../shared/contracts.ts";
import { invalidArtifact, KnowledgeError } from "./errors.ts";
import { normalizeSiteUrl } from "./urls.ts";

const REFERENCE =
  /^(data\/knowledge\.json|data\/knowledge\/[a-f0-9]{64}\.(json|md)|data\/details\/[a-f0-9]{24}\.json)$/;

export async function sha256(value: string | Uint8Array<ArrayBuffer>): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
export function parseArtifact<T>(text: string, schema: z.ZodType<T>): T {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    return invalidArtifact("Artifact does not match its schema");
  }
}
export async function verifyEnvelope(text: string): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    invalidArtifact("Artifact is not JSON");
  }
  if (!raw || typeof raw !== "object" || !("contentHash" in raw))
    invalidArtifact("Artifact has no content hash");
  const { contentHash, ...core } = raw;
  if ((await sha256(JSON.stringify(core))) !== contentHash)
    invalidArtifact("Artifact content hash is invalid");
}

/** Stores immutable text only; parsed graph/index objects have separate ownership. */
export class TextCache {
  private readonly values = new Map<string, { text: string; size: number }>();
  bytes = 0;
  constructor(readonly maxBytes = 8 * 1024 * 1024) {}
  get(key: string): string | undefined {
    const value = this.values.get(key);
    if (!value) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value.text;
  }
  set(key: string, text: string): void {
    const previous = this.values.get(key);
    if (previous) {
      this.bytes -= previous.size;
      this.values.delete(key);
    }
    const size = 2 * (key.length + text.length);
    if (size > this.maxBytes) return;
    while (this.bytes + size > this.maxBytes) {
      const first = this.values.entries().next().value;
      if (!first) break;
      this.values.delete(first[0]);
      this.bytes -= first[1].size;
    }
    this.values.set(key, { text, size });
    this.bytes += size;
  }
}

export class ArtifactLoader {
  readonly site: string;
  readonly cache: TextCache;
  private readonly pending = new Map<string, Promise<string>>();
  constructor(
    site: string,
    private readonly fetcher: typeof fetch = fetch,
    cache = new TextCache(),
  ) {
    this.site = normalizeSiteUrl(site).href;
    this.cache = cache;
  }
  async artifact(reference: ArtifactReference, limit: number, cache = false): Promise<string> {
    const parsed = ArtifactReferenceSchema.safeParse(reference);
    if (!parsed.success || reference.bytes > limit)
      invalidArtifact("Unsafe or oversized artifact reference");
    const text = await this.text(reference.path, limit, cache);
    if (new TextEncoder().encode(text).byteLength !== reference.bytes)
      invalidArtifact("Artifact byte size is invalid");
    return text;
  }
  text(path: string, limit: number, cache = false, fresh = false): Promise<string> {
    if (!REFERENCE.test(path))
      return Promise.reject(new KnowledgeError("INVALID_ARTIFACT", "Unsafe artifact path"));
    const cached = cache ? this.cache.get(path) : undefined;
    if (cached !== undefined) {
      if (new TextEncoder().encode(cached).byteLength > limit)
        return Promise.reject(
          new KnowledgeError("INVALID_ARTIFACT", "Artifact exceeds its byte limit"),
        );
      return Promise.resolve(cached);
    }
    const key = `${path}:${limit}:${fresh}`;
    const prior = this.pending.get(key);
    if (prior) return prior;
    const request = this.download(path, limit, fresh)
      .then((text) => {
        if (cache) this.cache.set(path, text);
        return text;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
  private async download(path: string, limit: number, fresh: boolean): Promise<string> {
    const url = new URL(path, this.site);
    if (fresh) url.searchParams.set("rhizome", String(Date.now()));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      // Do not bind the native Worker fetch function to this loader instance.
      const fetcher = this.fetcher;
      const response = await fetcher(url, {
        // workerd does not implement redirect: "error". Never follow a redirect.
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });
      if (
        (response.status >= 300 && response.status < 400) ||
        response.redirected ||
        (response.url && response.url !== url.href)
      )
        invalidArtifact("Unexpected source redirect");
      if (!response.ok)
        throw new KnowledgeError(
          "SOURCE_UNAVAILABLE",
          `Could not load ${path}: HTTP ${response.status}`,
        );
      if (Number(response.headers.get("content-length")) > limit)
        invalidArtifact("Artifact exceeds its byte limit");
      if (!response.body) invalidArtifact("Artifact has no body");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > limit) {
          await reader.cancel();
          invalidArtifact("Artifact exceeds its byte limit");
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const expected = path.match(/\/([a-f0-9]{24}|[a-f0-9]{64})\.(json|md)$/)?.[1];
      if (expected && !(await sha256(bytes)).startsWith(expected))
        invalidArtifact("Artifact bytes do not match their hash");
      try {
        return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        invalidArtifact("Artifact is not valid UTF-8");
      }
    } catch (error) {
      if (error instanceof KnowledgeError) throw error;
      console.error("Rhizome artifact read failed", {
        path,
        message: error instanceof Error ? error.message : String(error),
      });
      throw new KnowledgeError("SOURCE_UNAVAILABLE", `Could not read ${path}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
