import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { GraphManifest, GraphNode } from "../shared/contracts";
import { GraphControls } from "./GraphControls";
import type { GraphProjection, RhizomeGraph } from "./graph";
import type { LayoutStatus } from "./graph-layout";
import { GraphViewportSession } from "./graph-viewport";

type FilterKey = "types" | "tags";

interface Props {
  graph: RhizomeGraph;
  manifest: GraphManifest;
  projection: GraphProjection;
  backTraceActive: boolean;
  backTraceVisits: ReadonlyMap<string, number>;
  selected?: string;
  focus: boolean;
  direction: "in" | "out" | "both";
  depth: number;
  filters: Record<FilterKey, Set<string>>;
  readerOpen: boolean;
  desktopReaderWidth: number;
  mobileReaderHeight: number;
  touchMode: boolean;
  search: string;
  searchMatches?: ReadonlySet<string>;
  searchResults: GraphNode[];
  overviewRevision: number;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
  onOverview: () => void;
  onResetBackTrace: () => void;
  onClearFocus: () => void;
  onToggleBackTrace: () => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onClearFilters: () => void;
  onSearchChange: (value: string) => void;
  onToggleReader: () => void;
  onPinnedNodesChange: (pinned: ReadonlySet<string>) => void;
}

export interface Graph2DHandle {
  setPinned: (id: string, pinned: boolean) => void;
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

export const Graph2D = forwardRef<Graph2DHandle, Props>(function Graph2D(
  {
    graph,
    manifest,
    projection,
    backTraceActive,
    backTraceVisits,
    selected,
    focus,
    direction,
    depth,
    filters,
    readerOpen,
    desktopReaderWidth,
    mobileReaderHeight,
    touchMode,
    search,
    searchMatches,
    searchResults,
    overviewRevision,
    onSelect,
    onClearSelection,
    onOverview,
    onResetBackTrace,
    onClearFocus,
    onToggleBackTrace,
    onToggleFilter,
    onClearFilters,
    onSearchChange,
    onToggleReader,
    onPinnedNodesChange,
  }: Props,
  ref,
) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<GraphViewportSession | undefined>(undefined);
  const appliedOverviewRevision = useRef(overviewRevision);
  const compact = useMediaQuery("(pointer: coarse), (max-width: 720px)");
  const readerCompact = useMediaQuery("(max-width: 760px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [status, setStatus] = useState<LayoutStatus>("paused");
  const [pinnedCount, setPinnedCount] = useState(0);
  const motionEnabled = !reducedMotion;

  useImperativeHandle(
    ref,
    () => ({
      setPinned: (id, pinned) => session.current?.setPinned(id, pinned),
    }),
    [],
  );

  useEffect(() => {
    if (!container.current) return;
    const viewport = new GraphViewportSession(container.current, graph, {
      onStatus: setStatus,
      onPinnedChange: (pinned) => {
        setPinnedCount(pinned.size);
        onPinnedNodesChange(pinned);
      },
    });
    const resizeObserver = new ResizeObserver(() => viewport.resize());
    resizeObserver.observe(container.current);
    session.current = viewport;
    return () => {
      resizeObserver.disconnect();
      session.current = undefined;
      viewport.destroy();
    };
  }, [graph, onPinnedNodesChange]);

  useEffect(() => {
    const viewport = session.current;
    if (!viewport) return;
    const resetOverview = appliedOverviewRevision.current !== overviewRevision;
    viewport.sync({
      backTraceVisits,
      projection,
      selected,
      focus,
      motionEnabled,
      compact,
      touchMode,
      readerOpen,
      readerCompact,
      desktopReaderWidth,
      mobileReaderHeight,
      reducedMotion,
      searchMatches,
      onSelect,
      onClearSelection,
    });
    if (resetOverview) {
      appliedOverviewRevision.current = overviewRevision;
      viewport.resetLayout();
    }
  }, [
    backTraceVisits,
    compact,
    desktopReaderWidth,
    focus,
    mobileReaderHeight,
    motionEnabled,
    onClearSelection,
    onSelect,
    overviewRevision,
    projection,
    readerCompact,
    readerOpen,
    reducedMotion,
    searchMatches,
    selected,
    touchMode,
  ]);

  return (
    <>
      <div
        className="graph-canvas"
        data-layout-status={status}
        data-pinned-count={pinnedCount}
        data-projection-node-count={projection.nodes.size}
        data-testid="graph-2d"
        ref={container}
      />
      <GraphControls
        backTraceActive={backTraceActive}
        backTraceVisitCount={backTraceVisits.size}
        depth={depth}
        direction={direction}
        filters={filters}
        focus={focus}
        manifest={manifest}
        onClearFilters={onClearFilters}
        onClearFocus={onClearFocus}
        onOverview={onOverview}
        onResetBackTrace={onResetBackTrace}
        onToggleBackTrace={onToggleBackTrace}
        onToggleFilter={onToggleFilter}
        onToggleReader={onToggleReader}
        projection={projection}
        readerOpen={readerOpen}
        search={search}
        searchResults={searchResults}
        selected={selected}
        onSearchChange={onSearchChange}
        onSelect={onSelect}
      />
    </>
  );
});
