import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphManifest, GraphNode } from "../shared/contracts";
import { Graph2D } from "./Graph2D";
import { createGraph, projectGraph } from "./graph";
import { Reader } from "./Reader";
import { ReaderPane } from "./ReaderPane";
import { toggleDirectionalFocus } from "./ui-state";
import { readUrlState, type UrlState, writeUrlState } from "./url-state";

type FilterKey = "types" | "tags";
const ALL_RELATIONS = new Set<string>();

function matchesSearch(node: GraphNode, query: string): boolean {
  return [node.title, node.path, ...node.aliases, ...node.tags]
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase().includes(query));
}

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
  const selectedRef = useRef(initialState.note);
  const [readerOpen, setReaderOpen] = useState(Boolean(initialState.note));
  const [overviewRevision, setOverviewRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [backTraceActive, setBackTraceActive] = useState(false);
  const [backTraceVisits, setBackTraceVisits] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );
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
        selectedRef.current = url.note;
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
            visibleRelations: ALL_RELATIONS,
            direction: state.direction,
            focusNode,
            depth: state.depth,
          })
        : undefined,
    [graph, state.depth, state.direction, focusNode, state.tags, state.types],
  );
  const filters = useMemo(
    () => ({ types: state.types, tags: state.tags }),
    [state.tags, state.types],
  );

  const searchMatches = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!manifest || !query) return undefined;
    return new Set(manifest.nodes.filter((node) => matchesSearch(node, query)).map(({ id }) => id));
  }, [manifest, search]);
  const results = useMemo(
    () =>
      !manifest || !searchMatches
        ? []
        : manifest.nodes.filter(({ id }) => searchMatches.has(id)).slice(0, 12),
    [manifest, searchMatches],
  );

  const update = (change: Partial<UrlState>) => setState((current) => ({ ...current, ...change }));
  const select = (note: string) => {
    if (!note) return;
    const readerChanged = selectedRef.current !== note;
    selectedRef.current = note;
    if (backTraceActive && readerChanged) {
      setBackTraceVisits((current) => {
        const next = new Map(current);
        next.set(note, (next.get(note) ?? 0) + 1);
        return next;
      });
    }
    update({ note });
    setSearch("");
    setReaderOpen(true);
  };
  const clearSelection = () => {
    selectedRef.current = undefined;
    update({ note: undefined, focus: false, direction: "both" });
    setReaderOpen(false);
  };
  const toggleFilter = (key: FilterKey, value: string) => {
    setState((current) => {
      const next = new Set(current[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...current, [key]: next };
    });
  };
  const clearFilters = () => {
    setSearch("");
    update({ types: new Set<string>(), tags: new Set<string>() });
  };
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
      <div className="workspace">
        <section className="stage">
          {!webgl ? (
            <div className="webgl-fallback">
              <h2>Graph rendering unavailable</h2>
              <p>Search and relationship navigation remain available in this browser.</p>
              <div className="fallback-search">
                <input
                  aria-label="Search notes"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search notes"
                  value={search}
                />
                {results.map((node) => (
                  <button key={node.id} onClick={() => select(node.id)} type="button">
                    {node.title}
                  </button>
                ))}
              </div>
              {state.note && (
                <button onClick={() => setReaderOpen((current) => !current)} type="button">
                  {readerOpen ? "Hide reader" : "Show reader"}
                </button>
              )}
            </div>
          ) : (
            <Graph2D
              backTraceActive={backTraceActive}
              backTraceVisits={backTraceVisits}
              depth={state.depth}
              direction={state.direction}
              filters={filters}
              focus={state.focus}
              graph={graph}
              manifest={manifest}
              onClearFilters={clearFilters}
              onClearFocus={() => update({ focus: false, direction: "both" })}
              onClearSelection={clearSelection}
              onOverview={showOverview}
              onResetBackTrace={() => setBackTraceVisits(new Map())}
              onSelect={select}
              onToggleBackTrace={() => setBackTraceActive((current) => !current)}
              onToggleFilter={toggleFilter}
              onToggleReader={() => state.note && setReaderOpen((current) => !current)}
              overviewRevision={overviewRevision}
              projection={projection}
              readerOpen={readerOpen}
              search={search}
              searchMatches={searchMatches}
              searchResults={results}
              selected={state.note}
              onSearchChange={setSearch}
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
              depth={state.depth}
              direction={state.direction}
              focus={state.focus}
              manifest={manifest}
              onClose={closeReaderFromContent}
              onDepthChange={(depth) => update({ depth })}
              onSelect={select}
              onToggleFocus={toggleFocus}
              selected={state.note}
            />
          </ReaderPane>
        )}
      </div>
    </main>
  );
}
