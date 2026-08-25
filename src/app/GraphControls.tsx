import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphManifest, GraphNode } from "../shared/contracts";
import type { GraphProjection } from "./graph";
import { pickRandomNoteId } from "./random-note";

type FilterKey = "types" | "tags" | "relations";
type PopoverName = "filters";

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
  onOverview: () => void;
  onClearFocus: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onToggleFilter: (key: FilterKey, value: string) => void;
  onClearFilters: () => void;
  onToggleReader: () => void;
}

function Icon({ name }: { name: "overview" | "filter" | "reader" }) {
  const paths = {
    overview: <path d="M6 3H3v3M12 3h3v3M6 15H3v-3m9 3h3v-3" />,
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

function ToggleGroup({
  title,
  values,
  active,
  labelForValue,
  onToggle,
}: {
  title: string;
  values: string[];
  active: Set<string>;
  labelForValue?: (value: string) => string;
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
            <span>{labelForValue?.(value) ?? value}</span>
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
  onOverview,
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
  const visibleNoteCount = useMemo(
    () =>
      manifest.nodes.filter((node) => node.kind === "note" && projection.nodes.has(node.id)).length,
    [manifest.nodes, projection.nodes],
  );

  const openRandomNote = () => {
    const id = pickRandomNoteId(manifest.nodes, projection.nodes, selected);
    if (!id) return;
    setOpen(undefined);
    onSelect(id);
  };

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
            <button
              aria-label="Open a random visible note"
              className="popover-action random-note-action"
              disabled={visibleNoteCount === 0}
              onClick={openRandomNote}
              type="button"
            >
              <span>
                <strong>Random note</strong>
                <small>I’m feeling lucky · {visibleNoteCount} visible</small>
              </span>
              <i aria-hidden="true">↗</i>
            </button>
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
              labelForValue={(relation) =>
                relation === "link"
                  ? "Wiki links"
                  : (manifest.config.relations[relation]?.label ?? relation)
              }
              onToggle={(value) => onToggleFilter("relations", value)}
              title="Relations"
              values={relationNames}
            />
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
