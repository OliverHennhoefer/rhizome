import { useEffect, useRef, useState } from "react";
import type { GraphProjection, RhizomeGraph } from "./graph";
import { isMotionEligible, type LayoutStatus } from "./graph-layout";
import { GraphViewportSession } from "./graph-viewport";

interface Props {
  graph: RhizomeGraph;
  projection: GraphProjection;
  selected?: string;
  onSelect: (id: string) => void;
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

function layoutLabel(status: LayoutStatus): string {
  switch (status) {
    case "loading":
      return "Preparing motion";
    case "running":
      return "Graph in motion";
    case "settled":
      return "Graph settled";
    case "paused":
      return "Motion paused";
    case "static":
      return "Static layout";
  }
}

export function Graph2D({ graph, projection, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const session = useRef<GraphViewportSession | undefined>(undefined);
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
    session.current = viewport;
    return () => {
      session.current = undefined;
      viewport.destroy();
    };
  }, [graph]);

  useEffect(() => {
    session.current?.sync({
      projection,
      selected,
      motionEnabled,
      compact,
      reducedMotion,
      onSelect,
    });
  }, [compact, motionEnabled, onSelect, projection, reducedMotion, selected]);

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
      <div className="graph-toolbar" aria-label="Graph layout controls" role="toolbar">
        <span aria-live="polite" className={`layout-status status-${status}`}>
          <i aria-hidden="true" />
          {layoutLabel(status)}
        </span>
        <button
          aria-pressed={motionEnabled}
          disabled={!eligible}
          onClick={toggleMotion}
          title={
            !eligible
              ? projection.nodes.size <= 1
                ? "Motion requires at least two visible nodes"
                : "Focus or filter the graph to enable motion"
              : undefined
          }
          type="button"
        >
          Motion {motionEnabled ? "on" : "off"}
        </button>
        <button onClick={() => session.current?.resetLayout()} type="button">
          Reset layout
        </button>
      </div>
      <div className="graph-help">
        {status === "static"
          ? "Focus or filter to enable motion"
          : compact
            ? "Drag nodes to explore"
            : "Drag nodes · Shift-drag to pin"}
      </div>
    </>
  );
}
