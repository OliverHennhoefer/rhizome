import { useEffect, useMemo, useState } from "react";
import type { EdgeEvidence, GraphManifest, NodeDetails } from "../shared/contracts";
import { buildRelationshipViews, type RelationshipDirection } from "./relationship-model";

interface Props {
  manifest: GraphManifest;
  selected: string;
  focus: boolean;
  direction: "in" | "out" | "both";
  depth: number;
  pinAvailable: boolean;
  pinned: boolean;
  showPinAction: boolean;
  onClose: () => void;
  onPinnedChange: (pinned: boolean) => void;
  onSelect: (id: string) => void;
  onToggleFocus: (direction: "in" | "out") => void;
  onDepthChange: (depth: number) => void;
}

const detailsCache = new Map<string, Promise<NodeDetails>>();

function assetUrl(reference: string): string {
  return `${import.meta.env.BASE_URL}${reference}`;
}

function loadDetails(reference: string): Promise<NodeDetails> {
  const cached = detailsCache.get(reference);
  if (cached) return cached;
  const request = fetch(assetUrl(reference))
    .then((response) => {
      if (!response.ok) throw new Error(`Details request failed (${response.status})`);
      return response.json() as Promise<NodeDetails>;
    })
    .catch((error) => {
      detailsCache.delete(reference);
      throw error;
    });
  detailsCache.set(reference, request);
  return request;
}

function directionGlyph(direction: RelationshipDirection): string {
  if (direction === "bidirectional") return "↔";
  if (direction === "outgoing") return "→";
  if (direction === "incoming") return "←";
  return "—";
}

function evidenceLocation(item: EdgeEvidence, manifest: GraphManifest): string {
  const source = manifest.nodes.find((node) => node.id === item.source);
  return `${source?.path ?? item.source}:${item.range.startLine}`;
}

function ReaderFocus({
  focus,
  direction,
  depth,
  onToggleFocus,
  onDepthChange,
}: Pick<Props, "focus" | "direction" | "depth" | "onToggleFocus" | "onDepthChange">) {
  return (
    <section aria-label="Graph focus" className="reader-focus">
      <h3>Explore this note</h3>
      <div className="reader-focus-options">
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
        <label className="reader-focus-depth" htmlFor="reader-focus-depth">
          <span>
            Depth <strong>{depth}</strong>
          </span>
          <input
            id="reader-focus-depth"
            max="5"
            min="1"
            onChange={(event) => onDepthChange(Number(event.target.value))}
            type="range"
            value={depth}
          />
        </label>
      )}
    </section>
  );
}

function Relationships({
  details,
  manifest,
  onSelect,
}: {
  details: NodeDetails;
  manifest: GraphManifest;
  onSelect: (id: string) => void;
}) {
  const relationships = useMemo(
    () => buildRelationshipViews(details, manifest),
    [details, manifest],
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (relationships.length === 0) return null;

  const toggleEvidence = (edgeId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(edgeId)) next.delete(edgeId);
      else next.add(edgeId);
      return next;
    });
  };

  return (
    <section className="relationships">
      <h3>Relationships</h3>
      <div className="relationship-list">
        {relationships.map((relationship) => {
          const isExpanded = expanded.has(relationship.edgeId);
          const evidenceId = `evidence-${relationship.edgeId}`;
          return (
            <article className="relationship" key={relationship.edgeId}>
              <div className="relationship-main">
                <button
                  className="relationship-target"
                  onClick={() => onSelect(relationship.counterpart.id)}
                  type="button"
                >
                  <span className="relationship-types">
                    {relationship.relations.map((relation) => (
                      <span
                        className="relationship-type"
                        key={`${relation.type}-${relation.direction}`}
                      >
                        <i aria-hidden="true">{directionGlyph(relation.direction)}</i>
                        {relation.label}
                      </span>
                    ))}
                  </span>
                  <strong>
                    {relationship.external?.title ??
                      relationship.external?.hostname ??
                      relationship.counterpart.title}
                  </strong>
                  <small>
                    {relationship.external?.title
                      ? `${relationship.external.hostname}${
                          relationship.external.path ? `/${relationship.external.path}` : ""
                        }`
                      : (relationship.external?.path ??
                        relationship.counterpart.path ??
                        relationship.counterpart.kind)}
                  </small>
                </button>
                <div className="relationship-actions">
                  {relationship.counterpart.kind !== "note" && (
                    <span className={`node-kind kind-${relationship.counterpart.kind}`}>
                      {relationship.counterpart.kind}
                    </span>
                  )}
                  {relationship.external && (
                    <a
                      aria-label={`Open ${relationship.external.hostname} in a new tab`}
                      href={relationship.external.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      ↗
                    </a>
                  )}
                  <button
                    aria-controls={evidenceId}
                    aria-expanded={isExpanded}
                    className="evidence-toggle"
                    onClick={() => toggleEvidence(relationship.edgeId)}
                    type="button"
                  >
                    {relationship.evidence.length} source
                    {relationship.evidence.length === 1 ? "" : "s"}
                    <span aria-hidden="true">⌄</span>
                  </button>
                </div>
              </div>
              <div className="relationship-evidence" hidden={!isExpanded} id={evidenceId}>
                {relationship.evidence.map((item) => (
                  <div
                    className="source-context"
                    key={`${item.edgeId}-${item.range.startLine}-${item.range.startColumn}-${item.range.endLine}-${item.range.endColumn}`}
                  >
                    {item.origin === "frontmatter" ? (
                      <p>
                        Property: <strong>{item.type}</strong>
                      </p>
                    ) : (
                      <blockquote>{item.excerpt}</blockquote>
                    )}
                    <span>{evidenceLocation(item, manifest)}</span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function Reader({
  manifest,
  selected,
  focus,
  direction,
  depth,
  pinAvailable,
  pinned,
  showPinAction,
  onClose,
  onPinnedChange,
  onSelect,
  onToggleFocus,
  onDepthChange,
}: Props) {
  const [details, setDetails] = useState<NodeDetails>();
  const [error, setError] = useState<string>();
  const node = manifest.nodes.find((item) => item.id === selected);

  useEffect(() => {
    setDetails(undefined);
    setError(undefined);
    if (!node) return;
    let active = true;
    loadDetails(node.detailsRef)
      .then((value) => {
        if (active) setDetails(value);
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => {
      active = false;
    };
  }, [node]);

  if (!node) return null;

  const navigateInternalLink = (targetElement: EventTarget | null, preventDefault: () => void) => {
    const anchor = (targetElement as HTMLElement | null)?.closest("a");
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    const target = url.searchParams.get("note");
    if (!target) return;
    preventDefault();
    onSelect(target);
  };

  return (
    <aside aria-label="Reader" className="reader" data-testid="reader">
      <header className="reader-header">
        <div>
          <p className="eyebrow">
            {node.kind}
            {node.types.length ? ` · ${node.types.join(", ")}` : ""}
          </p>
          <h2>{node.title}</h2>
          {node.path && <p className="node-path">{node.path}</p>}
        </div>
        {showPinAction && (
          <button
            aria-label={pinned ? "Unpin node" : "Pin node"}
            aria-pressed={pinned}
            className="mobile-pin-action"
            disabled={!pinAvailable}
            onClick={() => onPinnedChange(!pinned)}
            type="button"
          >
            {pinned ? "Unpin" : "Pin"}
          </button>
        )}
        <button aria-label="Close reader" className="close-reader" onClick={onClose} type="button">
          ×
        </button>
      </header>
      <ReaderFocus
        depth={depth}
        direction={direction}
        focus={focus}
        onDepthChange={onDepthChange}
        onToggleFocus={onToggleFocus}
      />
      {node.tags.length > 0 && (
        <div className="tag-row">
          {node.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {!details && !error && <div className="reader-loading">Loading context…</div>}
      {details?.html && (
        <article
          className="note-content"
          onClick={(event) => navigateInternalLink(event.target, () => event.preventDefault())}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              navigateInternalLink(event.target, () => event.preventDefault());
            }
          }}
          dangerouslySetInnerHTML={{ __html: details.html }}
        />
      )}
      {details && !details.html && (
        <p className="empty-note">
          This node has no local note. Its graph relationships remain navigable.
        </p>
      )}
      {details && (
        <Relationships details={details} key={details.id} manifest={manifest} onSelect={onSelect} />
      )}
    </aside>
  );
}
