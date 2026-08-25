export interface UrlState {
  note?: string;
  focus: boolean;
  depth: number;
  direction: "in" | "out" | "both";
  types: Set<string>;
  tags: Set<string>;
}

export function readUrlState(): UrlState {
  const query = new URLSearchParams(window.location.search);
  const direction = query.get("direction");
  return {
    note: query.get("note") ?? undefined,
    focus: query.get("focus") === "1",
    depth: Math.max(1, Math.min(5, Number.parseInt(query.get("depth") ?? "1", 10) || 1)),
    direction: direction === "in" || direction === "out" ? direction : "both",
    types: new Set(query.getAll("type")),
    tags: new Set(query.getAll("tag")),
  };
}

export function writeUrlState(state: UrlState): void {
  const query = new URLSearchParams();
  if (state.note) query.set("note", state.note);
  if (state.focus) query.set("focus", "1");
  if (state.depth !== 1) query.set("depth", String(state.depth));
  if (state.direction !== "both") query.set("direction", state.direction);
  for (const type of [...state.types].sort()) query.append("type", type);
  for (const tag of [...state.tags].sort()) query.append("tag", tag);
  const value = query.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${value ? `?${value}` : ""}`);
}
