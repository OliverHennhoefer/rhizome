import { useEffect, useRef } from "react";
import Sigma from "sigma";
import { createEdgeArrowProgram, EdgeLineProgram, type EdgeProgramType } from "sigma/rendering";
import type { GraphManifest, GraphNode } from "../shared/contracts";
import {
  type GraphProjection,
  neighborsOf,
  type RhizomeGraph,
  type RuntimeGraphEdge,
} from "./graph";

interface Props {
  graph: RhizomeGraph;
  manifest: GraphManifest;
  projection: GraphProjection;
  selected?: string;
  onSelect: (id: string) => void;
}

const palette = ["#d97757", "#6e9f73", "#4f8fba", "#b887d4", "#d6a74b", "#58a6a6"];
const edgePrograms = {
  arrow: createEdgeArrowProgram<GraphNode, RuntimeGraphEdge>(),
  line: EdgeLineProgram as EdgeProgramType<GraphNode, RuntimeGraphEdge>,
};

export function Graph2D({ graph, manifest, projection, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const renderer = useRef<Sigma<GraphNode, RuntimeGraphEdge> | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!container.current) return;
    const sigma = new Sigma<GraphNode, RuntimeGraphEdge>(graph, container.current, {
      allowInvalidContainer: false,
      defaultNodeColor: "#77927b",
      defaultEdgeColor: "#596059",
      edgeProgramClasses: edgePrograms,
      hideEdgesOnMove: true,
      labelColor: { color: "#e9eee8" },
      labelDensity: 0.08,
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: 8,
      renderEdgeLabels: false,
      zIndex: true,
    });
    sigma.on("clickNode", ({ node }) => onSelectRef.current(node));
    renderer.current = sigma;
    return () => {
      renderer.current = null;
      sigma.kill();
    };
  }, [graph]);

  useEffect(() => {
    const sigma = renderer.current;
    if (!sigma) return;
    const neighbors = selected ? neighborsOf(graph, selected) : new Set<string>();
    sigma.setSetting("nodeReducer", (node, data) => {
      if (!projection.nodes.has(node)) return { ...data, hidden: true };
      const isSelected = node === selected;
      const isNeighbor = neighbors.has(node);
      const community = Number(data.community ?? 0);
      return {
        ...data,
        label: String(data.title ?? node),
        color: isSelected
          ? "#f4d35e"
          : isNeighbor
            ? "#a5c9a8"
            : palette[Math.abs(community) % palette.length],
        size: isSelected ? 13 : Math.min(10, 4 + Math.sqrt(Number(data.degree ?? 0)) * 1.7),
        zIndex: isSelected ? 3 : isNeighbor ? 2 : 1,
        forceLabel: isSelected || isNeighbor,
      };
    });
    sigma.setSetting("edgeReducer", (edge, data) => {
      if (!projection.edges.has(edge)) return { ...data, hidden: true };
      const active = selected && (data.source === selected || data.target === selected);
      const relation = manifest.config.relations[data.relationType];
      return {
        ...data,
        color: active ? (relation?.color ?? "#d8e1d7") : `${relation?.color ?? "#667166"}88`,
        size: active ? 2.4 : 0.8,
        zIndex: active ? 2 : 1,
      };
    });
    sigma.refresh();
  }, [graph, manifest, projection, selected]);

  return <div className="graph-canvas" data-testid="graph-2d" ref={container} />;
}
