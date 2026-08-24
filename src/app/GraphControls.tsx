import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphManifest, GraphNode } from "../shared/contracts";
import type { GraphProjection } from "./graph";
import { DEFAULT_GRAPH_FORCE_SETTINGS, type GraphForceSettings } from "./graph-layout";
import { relationTone } from "./graph-theme";

type FilterKey = "types" | "tags" | "relations";
type PopoverName = "filters" | "layout";

interface Props {
  manifest: GraphManifest;
  projection: GraphProjection;
  selected?: string;
  focus: boolean;
  direction: "in" | "out" | "both";
  depth: number;
  filters: Record<FilterKey, Set<string>>;
  readerOpen: boolean;
  search: string;
  searchResults: GraphNode[];
  forceSettings: GraphForceSettings;
  pinnedCount: number;
  motionAvailable: boolean;
  onOverview: () => void;
  onForceChange: (key: keyof GraphForceSettings, value: number) => void;
  onRestoreForceDefaults: () => void;
  onResetLayout: () => void;
  onClearFocus: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onClearFilters: () => void;
  onToggleReader: () => void;
}

function Icon({ name }: { name: "overview" | "filter" | "layout" | "reader" }) {
  const paths = {
    overview: <path d="M6 3H3v3M12 3h3v3M6 15H3v-3m9 3h3v-3" />,
    filter: <path d="M3 5h12M5.5 9h7M8 13h2" />,
    layout: <path d="M3 5h4m3 0h5M7 3v4M3 9h8m3 0h1m-4-2v4M3 13h2m3 0h7M5 11v4" />,
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

function ForceControl({
  label,
  value,
  minimum = 0,
  maximum = 100,
  onChange,
}: {
  label: string;
  value: number;
  minimum?: number;
  maximum?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="force-control">
      <span>
        {label}
        <output>{value}</output>
      </span>
      <input
        aria-label={label}
        max={maximum}
        min={minimum}
        onChange={(event) => onChange(Number(event.target.value))}
        type="range"
        value={value}
      />
    </label>
  );
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
  search,
  searchResults,
  forceSettings,
  pinnedCount,
  motionAvailable,
  onOverview,
  onForceChange,
  onRestoreForceDefaults,
  onResetLayout,
  onClearFocus,
  onSearchChange,
  onSelect,
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
  const activeCount = activeFilters.length + (search.trim() ? 1 : 0);
  const forcesAreDefault = Object.entries(DEFAULT_GRAPH_FORCE_SETTINGS).every(
    ([key, value]) => forceSettings[key as keyof GraphForceSettings] === value,
  );

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
  return (
    <>
      <section aria-label="Visible graph summary" className="graph-summary">
        <span>
          {projection.nodes.size} nodes <i aria-hidden="true">·</i> {projection.edges.size}{" "}
          relationships
        </span>
        {activeCount > 0 && (
          <div className="active-filter-chips">
            {search.trim() && (
              <button
                aria-label="Clear search filter"
                onClick={() => onSearchChange("")}
                type="button"
              >
                “{search.trim()}”<span aria-hidden="true">×</span>
              </button>
            )}
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

      <div className={`graph-controls${open ? " has-open-popover" : ""}`} ref={controls}>
        <div aria-label="Graph controls" className="graph-toolbar" role="toolbar">
          <button aria-label="Overview" onClick={onOverview} type="button">
            <Icon name="overview" />
            <span className="control-label">Overview</span>
          </button>
          <button
            aria-label="Filters"
            aria-controls="filters-popover"
            aria-expanded={open === "filters"}
            className={activeCount ? "is-active" : ""}
            data-popover-trigger="filters"
            onClick={() => togglePopover("filters")}
            type="button"
          >
            <Icon name="filter" />
            <span className="control-label">Filters</span>
            {activeCount > 0 && <small>{activeCount}</small>}
          </button>
          {motionAvailable && (
            <button
              aria-label="Layout"
              aria-controls="layout-popover"
              aria-expanded={open === "layout"}
              data-popover-trigger="layout"
              onClick={() => togglePopover("layout")}
              type="button"
            >
              <Icon name="layout" />
              <span className="control-label">Layout</span>
            </button>
          )}
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
            <div className="filter-search">
              <input
                aria-label="Search notes"
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Titles, aliases, paths, and tags"
                value={search}
              />
              {search && (
                <button aria-label="Clear search" onClick={() => onSearchChange("")} type="button">
                  ×
                </button>
              )}
            </div>
            {search.trim() && (
              <section aria-label="Search results" className="filter-search-results">
                {searchResults.length > 0 ? (
                  searchResults.map((node) => (
                    <button
                      key={node.id}
                      onClick={() => {
                        setOpen(undefined);
                        onSelect(node.id);
                      }}
                      type="button"
                    >
                      <span>{node.title}</span>
                      <small>{node.path ?? node.kind}</small>
                    </button>
                  ))
                ) : (
                  <p>No matching notes</p>
                )}
              </section>
            )}
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
                    <i
                      style={{
                        background:
                          manifest.config.relations[relation]?.color ?? relationTone(relation),
                      }}
                    />
                    {manifest.config.relations[relation]?.label ?? relation}
                  </span>
                ))}
              </div>
            )}
            <button
              className="popover-action"
              disabled={!activeCount}
              onClick={onClearFilters}
              type="button"
            >
              Clear filters
            </button>
          </section>
        )}

        {open === "layout" && motionAvailable && (
          <section
            aria-label="Graph layout"
            className="control-popover"
            id="layout-popover"
            role="dialog"
          >
            <header>
              <div>
                <p className="eyebrow">Physics</p>
                <h2>Layout</h2>
              </div>
              <button aria-label="Close layout" onClick={() => setOpen(undefined)} type="button">
                ×
              </button>
            </header>
            <div className="force-controls">
              <ForceControl
                label="Center force"
                onChange={(value) => onForceChange("centerForce", value)}
                value={forceSettings.centerForce}
              />
              <ForceControl
                label="Repel force"
                onChange={(value) => onForceChange("repelForce", value)}
                value={forceSettings.repelForce}
              />
              <ForceControl
                label="Link force"
                onChange={(value) => onForceChange("linkForce", value)}
                value={forceSettings.linkForce}
              />
              <ForceControl
                label="Link distance"
                maximum={100}
                minimum={20}
                onChange={(value) => onForceChange("linkDistance", value)}
                value={forceSettings.linkDistance}
              />
            </div>
            <div className="layout-meta">
              <span>{pinnedCount} pinned</span>
            </div>
            <div className="layout-actions">
              <button
                className="popover-action"
                disabled={forcesAreDefault}
                onClick={onRestoreForceDefaults}
                type="button"
              >
                Restore force defaults
              </button>
              <button className="popover-action" onClick={onResetLayout} type="button">
                Reset layout
              </button>
            </div>
          </section>
        )}
      </div>

      {focus && (
        <section aria-label="Active graph focus" className="focus-status">
          <span>
            {direction === "in" ? "Inbound" : "Outbound"} · {depth} hop
            {depth === 1 ? "" : "s"}
          </span>
          <button onClick={onClearFocus} type="button">
            Exit focus
          </button>
        </section>
      )}
    </>
  );
}
