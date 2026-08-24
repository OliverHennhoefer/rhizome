import type { Simulation, SimulationLinkDatum, SimulationNodeDatum } from "d3-force";
import type { GraphNode } from "../shared/contracts";
import type { GraphProjection, RhizomeGraph } from "./graph";

export type LayoutStatus = "loading" | "running" | "settled" | "paused" | "static";

export interface Position {
  x: number;
  y: number;
}

export interface MotionLimits {
  nodes: number;
  edges: number;
}

export const DESKTOP_MOTION_LIMITS: MotionLimits = { nodes: 600, edges: 4_000 };
export const COMPACT_MOTION_LIMITS: MotionLimits = { nodes: 200, edges: 1_000 };

export const FORCE_SETTINGS = {
  anchorStrength: 0.015,
  centerStrength: 0.04,
  charge: -55,
  initialAlpha: 0.65,
  alphaDecay: 0.035,
  alphaMin: 0.025,
  collisionIterations: 2,
  linkDistance: 36,
  velocityDecay: 0.32,
} as const;

export interface PhysicalLink {
  source: string;
  target: string;
  occurrences: number;
}

interface LayoutNode extends SimulationNodeDatum {
  id: string;
  baseX: number;
  baseY: number;
  degree: number;
}

interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  source: string | LayoutNode;
  target: string | LayoutNode;
  occurrences: number;
}

interface MotionControllerOptions {
  graph: RhizomeGraph;
  positions: GraphPositionStore;
  onStatus: (status: LayoutStatus) => void;
  onPinnedChange: () => void;
}

interface StoredPosition {
  base: Position;
  current: Position;
  pinned: boolean;
}

export type ProjectionInvariantCode = "missing-node" | "missing-edge" | "edge-outside-projection";

export class ProjectionInvariantError extends Error {
  readonly code: ProjectionInvariantCode;

  constructor(code: ProjectionInvariantCode, message: string) {
    super(message);
    this.name = "ProjectionInvariantError";
    this.code = code;
  }
}

export class GraphPositionStore {
  private readonly nodes = new Map<string, StoredPosition>();
  private pins = 0;

  constructor(graph: RhizomeGraph) {
    graph.forEachNode((id, node) => {
      const position = { x: node.x, y: node.y };
      this.nodes.set(id, { base: position, current: { ...position }, pinned: false });
    });
  }

  private require(id: string): StoredPosition {
    const stored = this.nodes.get(id);
    if (!stored) throw new Error(`Position store does not contain node "${id}".`);
    return stored;
  }

  getBase(id: string): Position {
    return { ...this.require(id).base };
  }

  getCurrent(id: string): Position {
    return { ...this.require(id).current };
  }

  setCurrent(id: string, position: Position): void {
    this.require(id).current = { ...position };
  }

  isPinned(id: string): boolean {
    return this.require(id).pinned;
  }

  pin(id: string, position?: Position): void {
    const stored = this.require(id);
    if (position) stored.current = { ...position };
    if (!stored.pinned) {
      stored.pinned = true;
      this.pins += 1;
    }
  }

  release(id: string): void {
    const stored = this.require(id);
    if (stored.pinned) {
      stored.pinned = false;
      this.pins -= 1;
    }
  }

  get pinnedCount(): number {
    return this.pins;
  }

  reset(): void {
    for (const stored of this.nodes.values()) {
      stored.current = { ...stored.base };
      stored.pinned = false;
    }
    this.pins = 0;
  }
}

export function motionLimits(compact: boolean): MotionLimits {
  return compact ? COMPACT_MOTION_LIMITS : DESKTOP_MOTION_LIMITS;
}

export function isMotionEligible(projection: GraphProjection, compact: boolean): boolean {
  const limits = motionLimits(compact);
  return (
    projection.nodes.size > 1 &&
    projection.nodes.size <= limits.nodes &&
    projection.edges.size <= limits.edges
  );
}

export function createDisplayGraph(
  source: RhizomeGraph,
  projection: GraphProjection,
  positions: GraphPositionStore,
): RhizomeGraph {
  const nodeIds = [...projection.nodes].sort((a, b) => a.localeCompare(b));
  const edgeIds = [...projection.edges].sort((a, b) => a.localeCompare(b));
  for (const id of nodeIds) {
    if (!source.hasNode(id)) {
      throw new ProjectionInvariantError(
        "missing-node",
        `Projection references node "${id}", which is absent from the source graph.`,
      );
    }
  }
  for (const id of edgeIds) {
    if (!source.hasEdge(id)) {
      throw new ProjectionInvariantError(
        "missing-edge",
        `Projection references edge "${id}", which is absent from the source graph.`,
      );
    }
    const sourceId = source.source(id);
    const targetId = source.target(id);
    if (!projection.nodes.has(sourceId) || !projection.nodes.has(targetId)) {
      throw new ProjectionInvariantError(
        "edge-outside-projection",
        `Projection edge "${id}" has an endpoint outside the projected node set: "${sourceId}" → "${targetId}".`,
      );
    }
  }

  const display = source.nullCopy();
  for (const id of nodeIds) {
    const node = source.getNodeAttributes(id);
    const position = positions.getCurrent(id);
    display.addNode(id, { ...node, ...position });
  }
  for (const id of edgeIds) {
    const sourceId = source.source(id);
    const targetId = source.target(id);
    const attributes = { ...source.getEdgeAttributes(id) };
    if (source.isDirected(id)) display.addDirectedEdgeWithKey(id, sourceId, targetId, attributes);
    else display.addUndirectedEdgeWithKey(id, sourceId, targetId, attributes);
  }
  return display;
}

export function buildPhysicalLinks(graph: RhizomeGraph): PhysicalLink[] {
  const links = new Map<string, PhysicalLink>();
  graph.forEachEdge((_, edge, source, target) => {
    if (source === target) return;
    const [left, right] = source.localeCompare(target) <= 0 ? [source, target] : [target, source];
    const key = `${left}\0${right}`;
    const current = links.get(key) ?? { source: left, target: right, occurrences: 0 };
    current.occurrences += Math.max(1, Number(edge.occurrences) || 1);
    links.set(key, current);
  });
  return [...links.values()].sort((a, b) =>
    a.source === b.source ? a.target.localeCompare(b.target) : a.source.localeCompare(b.source),
  );
}

export function physicalLinkStrength(occurrences: number): number {
  return Math.min(0.35, 0.1 + Math.log1p(Math.max(1, occurrences)) * 0.05);
}

function seededRandom(seed: string): () => number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export class GraphMotionController {
  private readonly graph: RhizomeGraph;
  private readonly positions: GraphPositionStore;
  private readonly onStatus: (status: LayoutStatus) => void;
  private readonly onPinnedChange: () => void;
  private simulation?: Simulation<LayoutNode, LayoutLink>;
  private nodes = new Map<string, LayoutNode>();
  private activeDrag?: string;
  private killed = false;

  constructor(options: MotionControllerOptions) {
    this.graph = options.graph;
    this.positions = options.positions;
    this.onStatus = options.onStatus;
    this.onPinnedChange = options.onPinnedChange;
  }

  async start(): Promise<void> {
    this.onStatus("loading");
    const d3 = await import("d3-force");
    if (this.killed) return;

    const nodes: LayoutNode[] = [];
    this.graph.forEachNode((id, attributes) => {
      const base = this.positions.getBase(id);
      const current = this.positions.getCurrent(id);
      const pinned = this.positions.isPinned(id);
      const node: LayoutNode = {
        id,
        x: current.x,
        y: current.y,
        baseX: base.x,
        baseY: base.y,
        degree: Number(attributes.degree) || 0,
        ...(pinned || this.activeDrag === id
          ? {
              fx: current.x,
              fy: current.y,
            }
          : {}),
      };
      nodes.push(node);
      this.nodes.set(id, node);
    });

    const links: LayoutLink[] = buildPhysicalLinks(this.graph).map((link) => ({ ...link }));
    const linkForce = d3
      .forceLink<LayoutNode, LayoutLink>(links)
      .id((node) => node.id)
      .distance(FORCE_SETTINGS.linkDistance)
      .strength((link) => physicalLinkStrength(link.occurrences));

    this.simulation = d3
      .forceSimulation(nodes)
      .randomSource(
        seededRandom(
          nodes
            .map((node) => node.id)
            .sort()
            .join("\0"),
        ),
      )
      .alpha(FORCE_SETTINGS.initialAlpha)
      .alphaDecay(FORCE_SETTINGS.alphaDecay)
      .alphaMin(FORCE_SETTINGS.alphaMin)
      .velocityDecay(FORCE_SETTINGS.velocityDecay)
      .force("link", linkForce)
      .force("charge", d3.forceManyBody<LayoutNode>().strength(FORCE_SETTINGS.charge))
      .force("center", d3.forceCenter<LayoutNode>(0, 0).strength(FORCE_SETTINGS.centerStrength))
      .force(
        "anchor-x",
        d3.forceX<LayoutNode>((node) => node.baseX).strength(FORCE_SETTINGS.anchorStrength),
      )
      .force(
        "anchor-y",
        d3.forceY<LayoutNode>((node) => node.baseY).strength(FORCE_SETTINGS.anchorStrength),
      )
      .force(
        "collide",
        d3
          .forceCollide<LayoutNode>((node) => 6 + Math.sqrt(node.degree) * 1.3)
          .iterations(FORCE_SETTINGS.collisionIterations),
      )
      .on("tick", () => this.syncPositions())
      .on("end", () => {
        this.syncPositions();
        if (!this.killed) this.onStatus("settled");
      });
    this.onStatus("running");
  }

  private syncPositions(): void {
    if (this.killed) return;
    this.graph.updateEachNodeAttributes(
      (id, attributes) => {
        const node = this.nodes.get(id);
        if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return attributes;
        const position = { x: node.x as number, y: node.y as number };
        this.positions.setCurrent(id, position);
        return { ...attributes, ...position };
      },
      { attributes: ["x", "y"] },
    );
  }

  beginDrag(id: string, position: Position): void {
    this.activeDrag = id;
    const node = this.nodes.get(id);
    if (node) {
      node.fx = position.x;
      node.fy = position.y;
      node.x = position.x;
      node.y = position.y;
    }
    this.moveDrag(id, position);
    this.simulation?.alphaTarget(0.18).restart();
    if (this.simulation) this.onStatus("running");
  }

  moveDrag(id: string, position: Position): void {
    const node = this.nodes.get(id);
    if (node) {
      node.fx = position.x;
      node.fy = position.y;
      node.x = position.x;
      node.y = position.y;
    }
    this.positions.setCurrent(id, position);
    if (this.graph.hasNode(id)) {
      this.graph.mergeNodeAttributes(id, position);
    }
  }

  endDrag(id: string, keepPinned: boolean): void {
    const node = this.nodes.get(id);
    const position = this.positions.getCurrent(id);
    if (keepPinned) {
      this.positions.pin(id, position);
      if (node) {
        node.fx = position.x;
        node.fy = position.y;
      }
    } else {
      this.positions.release(id);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    this.activeDrag = undefined;
    this.onPinnedChange();
    if (this.simulation) {
      this.simulation.alphaTarget(0).alpha(Math.max(this.simulation.alpha(), 0.35)).restart();
      this.onStatus("running");
    }
  }

  pause(): void {
    this.simulation?.stop();
    if (!this.killed) this.onStatus("paused");
  }

  advance(iterations: number): void {
    this.simulation?.tick(Math.max(0, iterations));
    this.syncPositions();
  }

  kill(): void {
    this.killed = true;
    this.simulation?.stop();
    this.simulation = undefined;
    this.nodes.clear();
  }
}

export function nodeColorWithAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function nodeRadius(node: GraphNode): number {
  return Math.min(10, 4 + Math.sqrt(Number(node.degree) || 0) * 1.7);
}
