import { useEffect, useMemo, useState } from "react";
import type { GraphManifest } from "../shared/contracts";
import { Graph2D } from "./Graph2D";
import { createGraph, projectGraph } from "./graph";
import { Reader } from "./Reader";
import { ReaderPane } from "./ReaderPane";
import { toggleDirectionalFocus } from "./ui-state";
import { readUrlState, type UrlState, writeUrlState } from "./url-state";

type FilterKey = "types" | "tags" | "relations";

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function App() {
  const [initialState] = useState<UrlState>(() => readUrlState());
  const [manifest, setManifest] = useState<GraphManifest>();
  const [loadError, setLoadError] = useState<string>();
  const [state, setState] = useState<UrlState>(initialState);
  const [readerOpen, setReaderOpen] = useState(Boolean(initialState.note));
  const [overviewRevision, setOverviewRevision] = useState(0);
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
        if (url.note && !value.nodes.some((node) => node.id === url.note)) {
          url.note = undefined;
          url.focus = false;
          url.direction = "both";
        }
        setReaderOpen(Boolean(url.note));
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
  const filters = useMemo(
    () => ({ types: state.types, tags: state.tags, relations: state.relations }),
    [state.relations, state.tags, state.types],
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
  const select = (note: string) => {
    if (!note) return;
    update({ note });
    setReaderOpen(true);
  };
  const toggleFilter = (key: FilterKey, value: string) => {
    setState((current) => {
      const next = new Set(current[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [key]: next };
    });
  };
  const clearFilters = () =>
    update({ types: new Set<string>(), tags: new Set<string>(), relations: new Set<string>() });
  const toggleFocus = (direction: "in" | "out") =>
    setState((current) => ({
      ...current,
      ...toggleDirectionalFocus(current, direction),
    }));
  const showOverview = () => {
    update({ focus: false, direction: "both" });
    setOverviewRevision((current) => current + 1);
  };
  const closeReaderFromContent = () => {
    setReaderOpen(false);
    requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>('button[aria-label="Show reader"]')?.focus(),
    );
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

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span aria-hidden="true" className="brand-mark">
            R
          </span>
          <strong>{manifest.config.site.title}</strong>
        </a>
        <div className="search-wrap">
          <input
            aria-label="Search notes"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search notes, aliases, paths, and tags"
            value={search}
          />
          {results.length > 0 && (
            <div className="search-results">
              {results.map((node) => (
                <button
                  key={node.id}
                  onClick={() => {
                    select(node.id);
                    setSearch("");
                  }}
                  type="button"
                >
                  <span>{node.title}</span>
                  <small>{node.path ?? node.kind}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <div className="workspace">
        <section className="stage">
          {!webgl ? (
            <div className="webgl-fallback">
              <h2>Graph rendering unavailable</h2>
              <p>Search and relationship navigation remain available in this browser.</p>
              {state.note && (
                <button onClick={() => setReaderOpen((current) => !current)} type="button">
                  {readerOpen ? "Hide reader" : "Show reader"}
                </button>
              )}
            </div>
          ) : (
            <Graph2D
              depth={state.depth}
              direction={state.direction}
              filters={filters}
              focus={state.focus}
              graph={graph}
              manifest={manifest}
              onClearFilters={clearFilters}
              onDepthChange={(depth) => update({ depth })}
              onOverview={showOverview}
              onSelect={select}
              onToggleFilter={toggleFilter}
              onToggleFocus={toggleFocus}
              onToggleReader={() => state.note && setReaderOpen((current) => !current)}
              overviewRevision={overviewRevision}
              projection={projection}
              readerOpen={readerOpen}
              selected={state.note}
            />
          )}
        </section>

        {state.note && (
          <ReaderPane
            onClose={() => setReaderOpen(false)}
            onOpen={() => setReaderOpen(true)}
            open={readerOpen}
          >
            <Reader
              manifest={manifest}
              onClose={closeReaderFromContent}
              onSelect={select}
              selected={state.note}
            />
          </ReaderPane>
        )}
      </div>
    </main>
  );
}
