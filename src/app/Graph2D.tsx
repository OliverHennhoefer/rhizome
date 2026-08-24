import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphManifest, GraphNode } from "../shared/contracts";
import { GraphControls } from "./GraphControls";
import type { GraphProjection, RhizomeGraph } from "./graph";
import {
  DEFAULT_GRAPH_FORCE_SETTINGS,
  type GraphForceSettings,
  type LayoutStatus,
} from "./graph-layout";
import { GraphViewportSession } from "./graph-viewport";

type FilterKey = "types" | "tags" | "relations";

interface Props {
  graph: RhizomeGraph;
  manifest: GraphManifest;
  projection: GraphProjection;
  selected?: string;
  focus: boolean;
  direction: "in" | "out" | "both";
  depth: number;
  filters: Record<FilterKey, Set<string>>;
  readerOpen: boolean;
  search: string;
  searchMatches?: ReadonlySet<string>;
  searchResults: GraphNode[];
  overviewRevision: number;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onOverview: () => void;
  onClearFocus: () => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  onToggleReader: () => void;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function Graph2D({
  graph,
  manifest,
  projection,
  selected,
  focus,
  direction,
  depth,
  filters,
  readerOpen,
  search,
  searchMatches,
  searchResults,
  overviewRevision,
  onSelect,
  onClearSelection,
  onOverview,
  onClearFocus,
  onToggleFilter,
  onClearFilters,
  onSearchChange,
  onToggleReader,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<GraphViewportSession | undefined>(undefined);
  const appliedOverviewRevision = useRef(overviewRevision);
  const compact = useMediaQuery("(pointer: coarse), (max-width: 720px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [status, setStatus] = useState<LayoutStatus>("paused");
  const [pinnedCount, setPinnedCount] = useState(0);
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() => ({
    ...DEFAULT_GRAPH_FORCE_SETTINGS,
  }));
  const motionEnabled = !reducedMotion;
  const handleForceChange = useCallback((key: keyof GraphForceSettings, value: number) => {
    setForceSettings((current) => ({ ...current, [key]: value }));
  }, []);
  const handleRestoreForceDefaults = useCallback(
    () => setForceSettings({ ...DEFAULT_GRAPH_FORCE_SETTINGS }),
    [],
  );
  const handleResetLayout = useCallback(() => session.current?.resetLayout(), []);

  useEffect(() => {
    if (!container.current) return;
    const viewport = new GraphViewportSession(container.current, graph, {
      onStatus: setStatus,
      onPinnedCount: setPinnedCount,
    });
    const resizeObserver = new ResizeObserver(() => viewport.resize());
    resizeObserver.observe(container.current);
    session.current = viewport;
    return () => {
      resizeObserver.disconnect();
      session.current = undefined;
      viewport.destroy();
    };
  }, [graph]);

  useEffect(() => {
    const viewport = session.current;
    if (!viewport) return;
    const resetOverview = appliedOverviewRevision.current !== overviewRevision;
    viewport.sync({
      projection,
      selected,
      focus,
      motionEnabled,
      compact,
      reducedMotion,
      forceSettings,
      searchMatches,
      onSelect,
      onClearSelection,
    });
    if (resetOverview) {
      appliedOverviewRevision.current = overviewRevision;
      viewport.resetLayout();
    }
  }, [
    compact,
    forceSettings,
    focus,
    motionEnabled,
    onClearSelection,
    onSelect,
    overviewRevision,
    projection,
    reducedMotion,
    searchMatches,
    selected,
  ]);

  return (
    <>
      <div
        className="graph-canvas"
        data-layout-status={status}
        data-pinned-count={pinnedCount}
        data-testid="graph-2d"
        ref={container}
      />
      <GraphControls
        depth={depth}
        direction={direction}
        filters={filters}
        forceSettings={forceSettings}
        focus={focus}
        manifest={manifest}
        onClearFilters={onClearFilters}
        onClearFocus={onClearFocus}
        onForceChange={handleForceChange}
        onOverview={onOverview}
        onResetLayout={handleResetLayout}
        onRestoreForceDefaults={handleRestoreForceDefaults}
        onToggleFilter={onToggleFilter}
        onToggleReader={onToggleReader}
        projection={projection}
        pinnedCount={pinnedCount}
        readerOpen={readerOpen}
        search={search}
        searchResults={searchResults}
        selected={selected}
        onSearchChange={onSearchChange}
        onSelect={onSelect}
        motionAvailable={motionEnabled}
      />
    </>
  );
}
