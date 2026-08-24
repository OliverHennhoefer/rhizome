import type {
  ForceCenter,
  ForceLink,
  ForceManyBody,
  ForceX,
  ForceY,
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from "d3-force";
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
  anchorStrength: 0.025,
  initialAlpha: 0.48,
  alphaDecay: 0.022,
  alphaMin: 0.01,
  collisionIterations: 1,
  controlAlpha: 0.22,
  dragAlpha: 0.42,
  dragAlphaTarget: 0.18,
  dragLinkBoost: 2.2,
  interactiveAnchorStrength: 0.006,
  interactiveMaxDisplacement: 96,
  maxAutomaticDisplacement: 30,
  maxReleaseVelocity: 6,
  releaseVelocityScale: 0.5,
  velocityDecay: 0.34,
} as const;

export interface GraphForceSettings {
  centerForce: number;
  repelForce: number;
  linkForce: number;
  linkDistance: number;
}

export const DEFAULT_GRAPH_FORCE_SETTINGS: GraphForceSettings = {
  centerForce: 20,
  repelForce: 40,
  linkForce: 50,
  linkDistance: 42,
};

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
  motionOriginX: number;
  motionOriginY: number;
}

interface LayoutLink extends SimulationLinkDatum<LayoutNode> {
  source: string | LayoutNode;
  target: string | LayoutNode;
  occurrences: number;
}

interface DragKinematics {
  lastX: number;
  lastY: number;
  lastTime: number;
  velocityX: number;
  velocityY: number;
}

interface MotionControllerOptions {
  graph: RhizomeGraph;
  positions: GraphPositionStore;
  forceSettings?: GraphForceSettings;
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
  return Math.min(0.16, 0.055 + Math.log1p(Math.max(1, occurrences)) * 0.02);
}

function forceValue(value: number, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : fallback));
}

export function graphForceParameters(settings: GraphForceSettings): {
  centerStrength: number;
  chargeStrength: number;
  linkStrengthScale: number;
  linkDistance: number;
} {
  return {
    centerStrength:
      forceValue(settings.centerForce, DEFAULT_GRAPH_FORCE_SETTINGS.centerForce, 0, 100) * 0.0003,
    chargeStrength:
      forceValue(settings.repelForce, DEFAULT_GRAPH_FORCE_SETTINGS.repelForce, 0, 100) * -0.8,
    linkStrengthScale:
      forceValue(settings.linkForce, DEFAULT_GRAPH_FORCE_SETTINGS.linkForce, 0, 100) / 50,
    linkDistance: forceValue(
      settings.linkDistance,
      DEFAULT_GRAPH_FORCE_SETTINGS.linkDistance,
      20,
      100,
    ),
  };
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
  private linkForce?: ForceLink<LayoutNode, LayoutLink>;
  private chargeForce?: ForceManyBody<LayoutNode>;
  private centerForce?: ForceCenter<LayoutNode>;
  private anchorXForce?: ForceX<LayoutNode>;
  private anchorYForce?: ForceY<LayoutNode>;
  private forceSettings: GraphForceSettings;
  private nodes = new Map<string, LayoutNode>();
  private activeDrag?: string;
  private dragKinematics?: DragKinematics;
  private interactive = false;
  private killed = false;

  constructor(options: MotionControllerOptions) {
    this.graph = options.graph;
    this.positions = options.positions;
    this.forceSettings = { ...(options.forceSettings ?? DEFAULT_GRAPH_FORCE_SETTINGS) };
    this.onStatus = options.onStatus;
    this.onPinnedChange = options.onPinnedChange;
  }

  async start(settled = false): Promise<void> {
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
        motionOriginX: current.x,
        motionOriginY: current.y,
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
    const parameters = graphForceParameters(this.forceSettings);
    this.linkForce = d3
      .forceLink<LayoutNode, LayoutLink>(links)
      .id((node) => node.id)
      .distance(parameters.linkDistance)
      .strength((link) => physicalLinkStrength(link.occurrences) * parameters.linkStrengthScale);
    this.chargeForce = d3.forceManyBody<LayoutNode>().strength(parameters.chargeStrength);
    this.centerForce = d3.forceCenter<LayoutNode>(0, 0).strength(parameters.centerStrength);
    this.anchorXForce = d3
      .forceX<LayoutNode>((node) => node.baseX)
      .strength(FORCE_SETTINGS.anchorStrength);
    this.anchorYForce = d3
      .forceY<LayoutNode>((node) => node.baseY)
      .strength(FORCE_SETTINGS.anchorStrength);
    const collisionForce = d3
      .forceCollide<LayoutNode>((node) => Math.min(10.5, 4.5 + Math.sqrt(node.degree) * 0.75))
      .strength(0.72)
      .iterations(FORCE_SETTINGS.collisionIterations);

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
      .force("link", this.linkForce)
      .force("charge", this.chargeForce)
      .force("center", this.centerForce)
      .force("anchor-x", this.anchorXForce)
      .force("anchor-y", this.anchorYForce)
      .force("collide", collisionForce)
      .on("tick", () => this.syncPositions())
      .on("end", () => {
        this.syncPositions();
        if (!this.killed) this.onStatus("settled");
      });
    if (settled) {
      this.simulation.stop().alpha(0);
      this.syncPositions();
      this.onStatus("settled");
    } else {
      this.onStatus("running");
    }
  }

  private clampAutomaticDisplacement(node: LayoutNode): void {
    if (node.id === this.activeDrag || this.positions.isPinned(node.id)) return;
    const x = Number(node.x);
    const y = Number(node.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const deltaX = x - node.motionOriginX;
    const deltaY = y - node.motionOriginY;
    const distance = Math.hypot(deltaX, deltaY);
    const maximum = this.interactive
      ? FORCE_SETTINGS.interactiveMaxDisplacement
      : FORCE_SETTINGS.maxAutomaticDisplacement;
    if (distance <= maximum || distance === 0) return;
    const scale = maximum / distance;
    node.x = node.motionOriginX + deltaX * scale;
    node.y = node.motionOriginY + deltaY * scale;
    node.vx = 0;
    node.vy = 0;
  }

  private syncPositions(): void {
    if (this.killed) return;
    this.graph.updateEachNodeAttributes(
      (id, attributes) => {
        const node = this.nodes.get(id);
        if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return attributes;
        this.clampAutomaticDisplacement(node);
        const position = { x: node.x as number, y: node.y as number };
        this.positions.setCurrent(id, position);
        return { ...attributes, ...position };
      },
      { attributes: ["x", "y"] },
    );
  }

  private applyLinkStrength(): void {
    const parameters = graphForceParameters(this.forceSettings);
    const activeDrag = this.activeDrag;
    this.linkForce?.strength((link) => {
      const source = typeof link.source === "string" ? link.source : link.source.id;
      const target = typeof link.target === "string" ? link.target : link.target.id;
      const boost =
        activeDrag && (source === activeDrag || target === activeDrag)
          ? FORCE_SETTINGS.dragLinkBoost
          : 1;
      return physicalLinkStrength(link.occurrences) * parameters.linkStrengthScale * boost;
    });
  }

  private setInteractiveAnchors(): void {
    this.anchorXForce?.strength(FORCE_SETTINGS.interactiveAnchorStrength);
    this.anchorYForce?.strength(FORCE_SETTINGS.interactiveAnchorStrength);
  }

  beginDrag(id: string, position: Position, timestamp = performance.now()): void {
    this.activeDrag = id;
    this.interactive = true;
    this.dragKinematics = {
      lastX: position.x,
      lastY: position.y,
      lastTime: timestamp,
      velocityX: 0,
      velocityY: 0,
    };
    this.setInteractiveAnchors();
    this.applyLinkStrength();
    const node = this.nodes.get(id);
    if (node) {
      node.motionOriginX = position.x;
      node.motionOriginY = position.y;
      node.fx = position.x;
      node.fy = position.y;
      node.x = position.x;
      node.y = position.y;
    }
    this.moveDrag(id, position, timestamp);
    this.simulation
      ?.alpha(Math.max(this.simulation.alpha(), FORCE_SETTINGS.dragAlpha))
      .alphaTarget(FORCE_SETTINGS.dragAlphaTarget)
      .restart();
    if (this.simulation) this.onStatus("running");
  }

  moveDrag(id: string, position: Position, timestamp = performance.now()): void {
    const kinematics = this.dragKinematics;
    if (kinematics && id === this.activeDrag) {
      const elapsed = Math.max(1, Math.min(64, timestamp - kinematics.lastTime));
      const velocityX = ((position.x - kinematics.lastX) / elapsed) * (1000 / 60);
      const velocityY = ((position.y - kinematics.lastY) / elapsed) * (1000 / 60);
      kinematics.velocityX = kinematics.velocityX * 0.35 + velocityX * 0.65;
      kinematics.velocityY = kinematics.velocityY * 0.35 + velocityY * 0.65;
      const speed = Math.hypot(kinematics.velocityX, kinematics.velocityY);
      if (speed > FORCE_SETTINGS.maxReleaseVelocity) {
        const scale = FORCE_SETTINGS.maxReleaseVelocity / speed;
        kinematics.velocityX *= scale;
        kinematics.velocityY *= scale;
      }
      kinematics.lastX = position.x;
      kinematics.lastY = position.y;
      kinematics.lastTime = timestamp;
    }
    const node = this.nodes.get(id);
    if (node) {
      node.motionOriginX = position.x;
      node.motionOriginY = position.y;
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

  endDrag(id: string, keepPinned: boolean, timestamp = performance.now()): void {
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
        const freshness = this.dragKinematics
          ? Math.max(0, 1 - Math.max(0, timestamp - this.dragKinematics.lastTime) / 120)
          : 0;
        node.vx =
          (this.dragKinematics?.velocityX ?? 0) * FORCE_SETTINGS.releaseVelocityScale * freshness;
        node.vy =
          (this.dragKinematics?.velocityY ?? 0) * FORCE_SETTINGS.releaseVelocityScale * freshness;
      }
    }
    this.activeDrag = undefined;
    this.dragKinematics = undefined;
    this.nodes.forEach((item) => {
      if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) return;
      item.motionOriginX = item.x as number;
      item.motionOriginY = item.y as number;
    });
    this.applyLinkStrength();
    this.onPinnedChange();
    if (this.simulation) {
      this.simulation
        .alphaTarget(0)
        .alpha(Math.max(this.simulation.alpha(), FORCE_SETTINGS.dragAlpha))
        .restart();
      this.onStatus("running");
    }
  }

  updateForces(settings: GraphForceSettings): void {
    this.forceSettings = { ...settings };
    const parameters = graphForceParameters(this.forceSettings);
    this.linkForce?.distance(parameters.linkDistance);
    this.applyLinkStrength();
    this.chargeForce?.strength(parameters.chargeStrength);
    this.centerForce?.strength(parameters.centerStrength);
    if (this.simulation) {
      this.simulation
        .alpha(Math.max(this.simulation.alpha(), FORCE_SETTINGS.controlAlpha))
        .restart();
      this.onStatus("running");
    }
  }

  pause(): void {
    this.simulation?.stop();
    if (!this.killed) this.onStatus("paused");
  }

  advance(iterations: number): void {
    this.simulation?.stop();
    this.simulation?.tick(Math.max(0, iterations));
    this.syncPositions();
  }

  kill(): void {
    this.killed = true;
    this.simulation?.stop();
    this.simulation = undefined;
    this.linkForce = undefined;
    this.chargeForce = undefined;
    this.centerForce = undefined;
    this.anchorXForce = undefined;
    this.anchorYForce = undefined;
    this.dragKinematics = undefined;
    this.nodes.clear();
  }
}

export function nodeColorWithAlpha(color: string, alpha: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? `${color}${alpha}` : color;
}

export function nodeRadius(node: GraphNode): number {
  return Math.min(9, 3.5 + Math.sqrt(Number(node.degree) || 0) * 0.85);
}
