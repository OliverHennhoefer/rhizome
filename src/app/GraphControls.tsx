import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphManifest } from "../shared/contracts";
import type { GraphProjection } from "./graph";
import type { LayoutStatus } from "./graph-layout";
import { relationTone } from "./graph-theme";

type FilterKey = "types" | "tags" | "relations";
type PopoverName = "focus" | "filters";

interface Props {
  manifest: GraphManifest;
  projection: GraphProjection;
  selected?: string;
  focus: boolean;
  direction: "in" | "out" | "both";
  depth: number;
  filters: Record<FilterKey, Set<string>>;
  readerOpen: boolean;
  status: LayoutStatus;
  compact: boolean;
  onOverview: () => void;
  onToggleFocus: (direction: "in" | "out") => void;
  onDepthChange: (depth: number) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onClearFilters: () => void;
  onToggleReader: () => void;
}

function Icon({ name }: { name: "overview" | "focus" | "filter" | "reader" }) {
  const paths = {
    overview: <path d="M6 3H3v3M12 3h3v3M6 15H3v-3m9 3h3v-3" />,
    focus: <path d="M3 6h7m0 0L8 4m2 2L8 8m7 4H8m0 0 2-2m-2 2 2 2" />,
    filter: <path d="M3 5h12M5.5 9h7M8 13h2" />,
    reader: <path d="M3 3.5h12v11H3zM10.5 3.5v11" />,
  } as const;
  return (
    <svg aria-hidden="true" className="control-icon" fill="none" viewBox="0 0 18 18">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.35">
        {paths[name]}
      </g>
    </svg>
  );
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
        <span>{title}</span>
        <small>{active.size || "All"}</small>
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

export function GraphControls({
  manifest,
  projection,
  selected,
  focus,
  direction,
  depth,
  filters,
  readerOpen,
  status,
  compact,
  onOverview,
  onToggleFocus,
  onDepthChange,
  onToggleFilter,
  onClearFilters,
  onToggleReader,
}: Props) {
  const [open, setOpen] = useState<PopoverName>();
  const controls = useRef<HTMLDivElement>(null);
  const activeFilters = useMemo(
    () =>
      (["types", "tags", "relations"] as const).flatMap((key) =>
        [...filters[key]].sort().map((value) => ({ key, value })),
      ),
    [filters],
  );
  const relationNames = Object.keys(manifest.facets.relations).sort();

  useEffect(() => {
    if (!open) return;
    const close = (restoreFocus: boolean) => {
      const trigger = controls.current?.querySelector<HTMLButtonElement>(
        `[data-popover-trigger="${open}"]`,
      );
      setOpen(undefined);
      if (restoreFocus) requestAnimationFrame(() => trigger?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!controls.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const togglePopover = (name: PopoverName) =>
    setOpen((current) => (current === name ? undefined : name));
  const selectedTitle = selected
    ? (manifest.nodes.find((node) => node.id === selected)?.title ?? selected)
    : undefined;

  return (
    <>
      <section aria-label="Visible graph summary" className="graph-summary">
        <span>
          {projection.nodes.size} nodes <i aria-hidden="true">·</i> {projection.edges.size}{" "}
          relationships
        </span>
        {activeFilters.length > 0 && (
          <div className="active-filter-chips">
            {activeFilters.slice(0, 3).map(({ key, value }) => (
              <button
                aria-label={`Remove ${key.slice(0, -1)} filter ${value}`}
                key={`${key}:${value}`}
                onClick={() => onToggleFilter(key, value)}
                type="button"
              >
                {value}
                <span aria-hidden="true">×</span>
              </button>
            ))}
            {activeFilters.length > 3 && <span>+{activeFilters.length - 3}</span>}
          </div>
        )}
      </section>

      <div className="graph-controls" ref={controls}>
        <div aria-label="Graph controls" className="graph-toolbar" role="toolbar">
          <button onClick={onOverview} type="button">
            <Icon name="overview" />
            <span className="control-label">Overview</span>
          </button>
          <button
            aria-controls="focus-popover"
            aria-expanded={open === "focus"}
            className={focus ? "is-active" : ""}
            data-popover-trigger="focus"
            disabled={!selected}
            onClick={() => togglePopover("focus")}
            type="button"
          >
            <Icon name="focus" />
            <span className="control-label">Focus</span>
          </button>
          <button
            aria-controls="filters-popover"
            aria-expanded={open === "filters"}
            className={activeFilters.length ? "is-active" : ""}
            data-popover-trigger="filters"
            onClick={() => togglePopover("filters")}
            type="button"
          >
            <Icon name="filter" />
            <span className="control-label">Filters</span>
            {activeFilters.length > 0 && <small>{activeFilters.length}</small>}
          </button>
          <button
            aria-label={readerOpen ? "Hide reader" : "Show reader"}
            aria-pressed={readerOpen}
            disabled={!selected}
            onClick={onToggleReader}
            type="button"
          >
            <Icon name="reader" />
            <span className="control-label">Reader</span>
          </button>
        </div>

        {open === "focus" && (
          <section
            aria-label="Directional focus"
            className="control-popover"
            id="focus-popover"
            role="dialog"
          >
            <header>
              <div>
                <p className="eyebrow">Directional focus</p>
                <h2>{selectedTitle}</h2>
              </div>
              <button
                aria-label="Close focus controls"
                onClick={() => setOpen(undefined)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="focus-options">
              <button
                aria-pressed={focus && direction === "in"}
                onClick={() => onToggleFocus("in")}
                type="button"
              >
                <span>What depends on this?</span>
                <small>Inbound</small>
              </button>
              <button
                aria-pressed={focus && direction === "out"}
                onClick={() => onToggleFocus("out")}
                type="button"
              >
                <span>What does this depend on?</span>
                <small>Outbound</small>
              </button>
            </div>
            {focus && (
              <label className="depth-control" htmlFor="focus-depth">
                <span>
                  Depth <strong>{depth}</strong>
                </span>
                <input
                  id="focus-depth"
                  max="5"
                  min="1"
                  onChange={(event) => onDepthChange(Number(event.target.value))}
                  type="range"
                  value={depth}
                />
              </label>
            )}
          </section>
        )}

        {open === "filters" && (
          <section
            aria-label="Graph filters"
            className="control-popover"
            id="filters-popover"
            role="dialog"
          >
            <header>
              <div>
                <p className="eyebrow">Projection</p>
                <h2>Filters</h2>
              </div>
              <button aria-label="Close filters" onClick={() => setOpen(undefined)} type="button">
                ×
              </button>
            </header>
            <ToggleGroup
              active={filters.types}
              onToggle={(value) => onToggleFilter("types", value)}
              title="Types"
              values={Object.keys(manifest.facets.types).sort()}
            />
            <ToggleGroup
              active={filters.tags}
              onToggle={(value) => onToggleFilter("tags", value)}
              title="Tags"
              values={Object.keys(manifest.facets.tags).sort()}
            />
            <ToggleGroup
              active={filters.relations}
              onToggle={(value) => onToggleFilter("relations", value)}
              title="Relations"
              values={relationNames}
            />
            {relationNames.length > 0 && (
              <div className="relation-legend">
                {relationNames.map((relation) => (
                  <span key={relation}>
                    <i style={{ background: relationTone(relation) }} />
                    {manifest.config.relations[relation]?.label ?? relation}
                  </span>
                ))}
              </div>
            )}
            <button
              className="popover-action"
              disabled={!activeFilters.length}
              onClick={onClearFilters}
              type="button"
            >
              Clear filters
            </button>
          </section>
        )}
      </div>

      <div className={`graph-status status-${status}`}>
        <i aria-hidden="true" />
        <span aria-live="polite">{layoutLabel(status)}</span>
        <span aria-hidden="true">·</span>
        <span>
          {status === "static"
            ? "Focus or filter to enable motion"
            : compact
              ? "Drag nodes to explore"
              : "Drag nodes · Shift-drag to pin"}
        </span>
      </div>
      {focus && (
        <div className="focus-status">
          {direction === "in" ? "Inbound" : "Outbound"} · {depth} hop{depth === 1 ? "" : "s"}
        </div>
      )}
    </>
  );
}
