import { useEffect, useRef, useState } from "react";
import type { GraphManifest } from "../shared/contracts";
import { GraphControls } from "./GraphControls";
import type { GraphProjection, RhizomeGraph } from "./graph";
import type { LayoutStatus } from "./graph-layout";
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
  overviewRevision: number;
  onSelect: (id: string) => void;
  onOverview: () => void;
  onToggleFocus: (direction: "in" | "out") => void;
  onDepthChange: (depth: number) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onClearFilters: () => void;
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
  overviewRevision,
  onSelect,
  onOverview,
  onToggleFocus,
  onDepthChange,
  onToggleFilter,
  onClearFilters,
  onToggleReader,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<GraphViewportSession | undefined>(undefined);
  const appliedOverviewRevision = useRef(overviewRevision);
  const compact = useMediaQuery("(pointer: coarse), (max-width: 720px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [status, setStatus] = useState<LayoutStatus>("paused");
  const [pinnedCount, setPinnedCount] = useState(0);
  const motionEnabled = !reducedMotion;

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
      motionEnabled,
      compact,
      reducedMotion,
      onSelect,
    });
    if (resetOverview) {
      appliedOverviewRevision.current = overviewRevision;
      viewport.resetLayout();
    }
  }, [compact, motionEnabled, onSelect, overviewRevision, projection, reducedMotion, selected]);

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
        compact={compact}
        depth={depth}
        direction={direction}
        filters={filters}
        focus={focus}
        manifest={manifest}
        onClearFilters={onClearFilters}
        onDepthChange={onDepthChange}
        onOverview={onOverview}
        onToggleFilter={onToggleFilter}
        onToggleFocus={onToggleFocus}
        onToggleReader={onToggleReader}
        projection={projection}
        readerOpen={readerOpen}
        selected={selected}
        status={status}
      />
    </>
  );
}
