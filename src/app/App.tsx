import { useEffect, useMemo, useState } from "react";
import type { GraphManifest } from "../shared/contracts";
import { Graph2D } from "./Graph2D";
import { createGraph, projectGraph } from "./graph";
import { Reader } from "./Reader";
import { readUrlState, type UrlState, writeUrlState } from "./url-state";

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function ToggleGroup({
  title,
  values,
  active,
  onToggle,
}: {
  title: string;
  values: string[];
  active: Set<string>;
  onToggle: (value: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <details className="filter-group">
      <summary>
        {title}
        <span>{active.size || "All"}</span>
      </summary>
      <div className="filter-options">
        {values.map((value) => (
          <label key={value}>
            <input type="checkbox" checked={active.has(value)} onChange={() => onToggle(value)} />
            <span>{value}</span>
          </label>
        ))}
      </div>
    </details>
  );
}

export function App() {
  const [manifest, setManifest] = useState<GraphManifest>();
  const [loadError, setLoadError] = useState<string>();
  const [state, setState] = useState<UrlState>(() => readUrlState());
  const [search, setSearch] = useState("");
  const webgl = useMemo(hasWebGl, []);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/graph.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Graph request failed (${response.status})`);
        return response.json() as Promise<GraphManifest>;
      })
      .then((value) => {
        setManifest(value);
        const url = readUrlState();
        if (!url.note && value.nodes.length)
          url.note = value.nodes.find((node) => node.kind === "note")?.id;
        setState(url);
        document.title = value.config.site.title;
      })
      .catch((reason: Error) => setLoadError(reason.message));
  }, []);

  useEffect(() => writeUrlState(state), [state]);

  const graph = useMemo(() => (manifest ? createGraph(manifest) : undefined), [manifest]);
  const focusNode = state.focus ? state.note : undefined;
  const projection = useMemo(
    () =>
      graph
        ? projectGraph(graph, {
            visibleTypes: state.types,
            visibleTags: state.tags,
            visibleRelations: state.relations,
            direction: state.direction,
            focusNode,
            depth: state.depth,
          })
        : undefined,
    [graph, state.depth, state.direction, focusNode, state.relations, state.tags, state.types],
  );

  const results = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!manifest || !query) return [];
    return manifest.nodes
      .filter((node) =>
        [node.title, node.path, ...node.aliases, ...node.tags]
          .filter(Boolean)
          .some((value) => value?.toLocaleLowerCase().includes(query)),
      )
      .slice(0, 12);
  }, [manifest, search]);

  const update = (change: Partial<UrlState>) => setState((current) => ({ ...current, ...change }));
  const select = (note: string) => update({ note: note || undefined });
  const toggle = (key: "types" | "tags" | "relations", value: string) => {
    setState((current) => {
      const next = new Set(current[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [key]: next };
    });
  };

  if (loadError)
    return (
      <main className="load-state">
        <h1>Rhizome could not load</h1>
        <p>{loadError}</p>
      </main>
    );
  if (!manifest || !graph || !projection)
    return (
      <main className="load-state">
        <p>Compiling the knowledge graph…</p>
      </main>
    );

  const relationNames = Object.keys(manifest.facets.relations).sort();
  return (
    <main className={`app-shell ${state.note ? "has-reader" : ""}`}>
      <header className="app-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark" aria-hidden="true">
            R
          </span>
          <span>
            <strong>{manifest.config.site.title}</strong>
            <small>Graph-native Markdown</small>
          </span>
        </a>
        <div className="search-wrap">
          <input
            aria-label="Search notes"
            placeholder="Search titles, aliases, paths, tags…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {results.length > 0 && (
            <div className="search-results">
              {results.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    select(node.id);
                    setSearch("");
                  }}
                >
                  <span>{node.title}</span>
                  <small>{node.path ?? node.kind}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <aside className="controls">
        <div className="graph-stats">
          <span>
            <strong>{projection.nodes.size}</strong> nodes
          </span>
          <span>
            <strong>{projection.edges.size}</strong> relations
          </span>
        </div>
        {state.note && (
          <section className="focus-tools">
            <p className="eyebrow">Directional focus</p>
            <button
              type="button"
              className={state.focus && state.direction === "in" ? "active" : ""}
              onClick={() => update({ focus: true, direction: "in" })}
            >
              What depends on this?
            </button>
            <button
              type="button"
              className={state.focus && state.direction === "out" ? "active" : ""}
              onClick={() => update({ focus: true, direction: "out" })}
            >
              What does this depend on?
            </button>
            <div className="depth-control">
              <label htmlFor="depth">
                Depth <strong>{state.depth}</strong>
              </label>
              <input
                id="depth"
                type="range"
                min="1"
                max="5"
                value={state.depth}
                onChange={(event) => update({ depth: Number(event.target.value) })}
              />
            </div>
            {state.focus && (
              <button
                className="subtle"
                type="button"
                onClick={() => update({ focus: false, direction: "both" })}
              >
                Show full graph
              </button>
            )}
          </section>
        )}
        <section className="filters">
          <p className="eyebrow">Filter projection</p>
          <ToggleGroup
            title="Types"
            values={Object.keys(manifest.facets.types).sort()}
            active={state.types}
            onToggle={(value) => toggle("types", value)}
          />
          <ToggleGroup
            title="Tags"
            values={Object.keys(manifest.facets.tags).sort()}
            active={state.tags}
            onToggle={(value) => toggle("tags", value)}
          />
          <ToggleGroup
            title="Relations"
            values={relationNames}
            active={state.relations}
            onToggle={(value) => toggle("relations", value)}
          />
        </section>
        <section className="legend">
          {relationNames.map((relation) => (
            <span key={relation}>
              <i style={{ background: manifest.config.relations[relation]?.color ?? "#667166" }} />
              {manifest.config.relations[relation]?.label ?? relation}
            </span>
          ))}
        </section>
      </aside>

      <section className="stage">
        {!webgl ? (
          <div className="webgl-fallback">
            <h2>Graph rendering unavailable</h2>
            <p>Search and relationship navigation remain available in this browser.</p>
          </div>
        ) : (
          <Graph2D
            graph={graph}
            manifest={manifest}
            projection={projection}
            selected={state.note}
            onSelect={select}
          />
        )}
        <div className="stage-hint">
          {state.focus
            ? `${state.direction === "in" ? "Inbound" : "Outbound"} · ${state.depth} hop${state.depth === 1 ? "" : "s"}`
            : "Select a node to interrogate its context"}
        </div>
      </section>

      <Reader manifest={manifest} selected={state.note} onSelect={select} />
    </main>
  );
}
