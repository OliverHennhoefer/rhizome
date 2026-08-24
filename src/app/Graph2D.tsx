import { useEffect, useRef, useState } from "react";
import type { GraphManifest } from "../shared/contracts";
import { GraphControls } from "./GraphControls";
import type { GraphProjection, RhizomeGraph } from "./graph";
import { isMotionEligible, type LayoutStatus } from "./graph-layout";
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

const MOTION_STORAGE_KEY = "rhizome:motion";

function readMotionOverride(): boolean | undefined {
  try {
    const value = window.localStorage.getItem(MOTION_STORAGE_KEY);
    return value === "on" ? true : value === "off" ? false : undefined;
  } catch {
    return undefined;
  }
}

function saveMotionOverride(value: boolean): void {
  try {
    window.localStorage.setItem(MOTION_STORAGE_KEY, value ? "on" : "off");
  } catch {
    // The graph remains usable when storage is unavailable.
  }
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
  const [motionOverride, setMotionOverride] = useState<boolean | undefined>(readMotionOverride);
  const [status, setStatus] = useState<LayoutStatus>("paused");
  const [pinnedCount, setPinnedCount] = useState(0);
  const motionEnabled = motionOverride ?? !reducedMotion;
  const eligible = isMotionEligible(projection, compact);

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
    const fitOverview = appliedOverviewRevision.current !== overviewRevision;
    viewport.sync({
      projection,
      selected,
      motionEnabled,
      compact,
      reducedMotion,
      settleProjection: fitOverview,
      onSelect,
    });
    if (fitOverview) {
      appliedOverviewRevision.current = overviewRevision;
      viewport.fitOverview();
    }
  }, [compact, motionEnabled, onSelect, overviewRevision, projection, reducedMotion, selected]);

  const toggleMotion = () => {
    const next = !motionEnabled;
    setMotionOverride(next);
    saveMotionOverride(next);
  };

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
        motionEligible={eligible}
        motionEnabled={motionEnabled}
        onClearFilters={onClearFilters}
        onDepthChange={onDepthChange}
        onOverview={onOverview}
        onResetLayout={() => session.current?.resetLayout()}
        onToggleFilter={onToggleFilter}
        onToggleFocus={onToggleFocus}
        onToggleMotion={toggleMotion}
        onToggleReader={onToggleReader}
        pinnedCount={pinnedCount}
        projection={projection}
        readerOpen={readerOpen}
        selected={selected}
        status={status}
      />
    </>
  );
}
