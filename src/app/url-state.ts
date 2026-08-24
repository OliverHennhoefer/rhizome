export interface UrlState {
  note?: string;
  view: "2d" | "3d";
  focus: boolean;
  depth: number;
  direction: "in" | "out" | "both";
  types: Set<string>;
  tags: Set<string>;
  relations: Set<string>;
}

export function readUrlState(defaultView: "2d" | "3d" = "2d"): UrlState {
  const query = new URLSearchParams(window.location.search);
  const view = query.get("view") === "3d" ? "3d" : query.get("view") === "2d" ? "2d" : defaultView;
  const direction = query.get("direction");
  return {
    note: query.get("note") ?? undefined,
    view,
    focus: query.get("focus") === "1",
    depth: Math.max(1, Math.min(5, Number.parseInt(query.get("depth") ?? "1", 10) || 1)),
    direction: direction === "in" || direction === "out" ? direction : "both",
    types: new Set(query.getAll("type")),
    tags: new Set(query.getAll("tag")),
    relations: new Set(query.getAll("relation")),
  };
}

export function writeUrlState(state: UrlState): void {
  const query = new URLSearchParams();
  if (state.note) query.set("note", state.note);
  if (state.view !== "2d") query.set("view", state.view);
  if (state.focus) query.set("focus", "1");
  if (state.depth !== 1) query.set("depth", String(state.depth));
  if (state.direction !== "both") query.set("direction", state.direction);
  for (const type of [...state.types].sort()) query.append("type", type);
  for (const tag of [...state.tags].sort()) query.append("tag", tag);
  for (const relation of [...state.relations].sort()) query.append("relation", relation);
  const value = query.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${value ? `?${value}` : ""}`);
}
