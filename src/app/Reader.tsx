import { useEffect, useMemo, useState } from "react";
import type { EdgeEvidence, GraphManifest, NodeDetails } from "../shared/contracts";

interface Props {
  manifest: GraphManifest;
  selected?: string;
  onSelect: (id: string) => void;
}

const detailsCache = new Map<string, Promise<NodeDetails>>();

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

function assetUrl(reference: string): string {
  return `${import.meta.env.BASE_URL}${reference}`;
}

function EvidenceList({
  title,
  evidence,
  manifest,
  onSelect,
}: {
  title: string;
  evidence: EdgeEvidence[];
  manifest: GraphManifest;
  onSelect: (id: string) => void;
}) {
  const nodes = useMemo(() => new Map(manifest.nodes.map((node) => [node.id, node])), [manifest]);
  const groups = new Map<string, EdgeEvidence[]>();
  for (const item of evidence) {
    const group = groups.get(item.edgeId) ?? [];
    group.push(item);
    groups.set(item.edgeId, group);
  }
  if (evidence.length === 0) return null;
  return (
    <section className="relationships">
      <h3>{title}</h3>
      {[...groups.values()].map((items) => {
        const first = items[0];
        const counterpart = title === "Incoming" ? first.source : first.target;
        return (
          <article className="evidence" key={first.edgeId}>
            <button type="button" onClick={() => onSelect(counterpart)}>
              <span>{nodes.get(counterpart)?.title ?? counterpart}</span>
              <small>
                {first.type} · {items.length} occurrence{items.length === 1 ? "" : "s"}
              </small>
            </button>
            {items.map((item) => (
              <div
                className="source-context"
                key={`${item.edgeId}-${item.range.startLine}-${item.range.startColumn}-${item.range.endLine}-${item.range.endColumn}`}
              >
                <q>{item.excerpt}</q>
                <span>
                  {nodes.get(item.source)?.path ?? item.source}:{item.range.startLine}
                </span>
              </div>
            ))}
          </article>
        );
      })}
    </section>
  );
}

export function Reader({ manifest, selected, onSelect }: Props) {
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

  if (!node) {
    return (
      <aside className="reader reader-empty">
        <p className="eyebrow">Knowledge context</p>
        <h2>Select a node</h2>
        <p>Inspect its note, dependencies, evidence, backlinks, and exact source occurrences.</p>
      </aside>
    );
  }

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
    <aside className="reader" data-testid="reader">
      <header className="reader-header">
        <div>
          <p className="eyebrow">
            {node.kind}
            {node.types.length ? ` · ${node.types.join(", ")}` : ""}
          </p>
          <h2>{node.title}</h2>
          {node.path && <p className="node-path">{node.path}</p>}
        </div>
        <button
          className="close-reader"
          type="button"
          aria-label="Close reader"
          onClick={() => onSelect("")}
        >
          ×
        </button>
      </header>
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
        <EvidenceList
          title="Outgoing"
          evidence={details.outgoing}
          manifest={manifest}
          onSelect={onSelect}
        />
      )}
      {details && (
        <EvidenceList
          title="Incoming"
          evidence={details.incoming}
          manifest={manifest}
          onSelect={onSelect}
        />
      )}
    </aside>
  );
}
