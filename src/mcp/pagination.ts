import { z } from "zod";
import { KnowledgeError } from "./errors.ts";

export const PAGE_SIZE = 50;
const CursorSchema = z.object({
  snapshot: z.string(),
  filter: z.string(),
  offset: z.number().int().nonnegative(),
});
export function page<T>(items: T[], snapshot: string, filters: object, cursor?: string) {
  const filter = JSON.stringify(filters);
  let offset = 0;
  if (cursor) {
    let parsed: z.infer<typeof CursorSchema>;
    try {
      parsed = CursorSchema.parse(JSON.parse(decodeURIComponent(cursor)));
    } catch {
      throw new KnowledgeError("INVALID_INPUT", "Invalid pagination cursor");
    }
    if (parsed.snapshot !== snapshot)
      throw new KnowledgeError(
        "SNAPSHOT_CHANGED",
        "The vault changed; restart pagination without a cursor",
      );
    if (parsed.filter !== filter || parsed.offset > items.length || parsed.offset % PAGE_SIZE)
      throw new KnowledgeError("INVALID_INPUT", "Cursor does not match this query");
    offset = parsed.offset;
  }
  const next = offset + PAGE_SIZE;
  return {
    items: items.slice(offset, next),
    snapshotHash: snapshot,
    total: items.length,
    truncated: next < items.length,
    ...(next < items.length
      ? { nextCursor: encodeURIComponent(JSON.stringify({ snapshot, filter, offset: next })) }
      : {}),
  };
}
