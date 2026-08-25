import type { GraphNode } from "../shared/contracts";

export function pickRandomNoteId(
  nodes: readonly GraphNode[],
  visibleNodes: ReadonlySet<string>,
  selected: string | undefined,
  random = Math.random,
): string | undefined {
  const visibleNotes = nodes.filter((node) => node.kind === "note" && visibleNodes.has(node.id));
  if (visibleNotes.length === 0) return undefined;

  const alternatives = selected
    ? visibleNotes.filter((node) => node.id !== selected)
    : visibleNotes;
  const candidates = alternatives.length > 0 ? alternatives : visibleNotes;
  const index = Math.min(
    candidates.length - 1,
    Math.floor(Math.max(0, random()) * candidates.length),
  );
  return candidates[index]?.id;
}
