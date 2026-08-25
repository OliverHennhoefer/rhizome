import Sigma from "sigma";
import {
  EdgeLineProgram,
  type EdgeProgramType,
  type NodeHoverDrawingFunction,
  type NodeLabelDrawingFunction,
} from "sigma/rendering";
import type { GraphNode } from "../shared/contracts";
import {
  type GraphProjection,
  neighborsOf,
  type RhizomeGraph,
  type RuntimeGraphEdge,
  reconcileProjectedHover,
} from "./graph";
import { closestNodeAtPoint, type NodeHitArea } from "./graph-hit-testing";
import {
  ADAPTIVE_MOTION_SETTINGS,
  dragThreshold,
  effectiveGraphEmphasis,
  effectiveLabelRelevance,
  type GraphEmphasisState,
  sameGraphEmphasis,
  selectionViewportPoint,
  shouldLimitAdaptiveMotion,
  unrelatedNodeOpacity,
} from "./graph-interaction";
import {
  hoverTransitionProgress,
  interpolateHoverValue,
  type LabelZoomStyle,
  labelOpacityForHover,
  labelZoomStyleForRatio,
} from "./graph-labels";
import {
  createDisplayGraph,
  GraphMotionController,
  GraphPositionStore,
  type LayoutStatus,
  type MotionPolicy,
  nodeRadius,
  projectionBaseBounds,
  resolveMotionPolicy,
} from "./graph-layout";
import {
  backTraceNodeTone,
  blendGraphTone,
  emphasizeNodeTone,
  nodeTone,
  relationTone,
} from "./graph-theme";

export interface GraphViewportSnapshot {
  backTraceVisits: ReadonlyMap<string, number>;
  projection: GraphProjection;
  selected?: string;
  focus: boolean;
  motionEnabled: boolean;
  compact: boolean;
  touchMode: boolean;
  readerOpen: boolean;
  readerCompact: boolean;
  mobileReaderHeight: number;
  reducedMotion: boolean;
  searchMatches?: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
}

interface GraphViewportEvents {
  onStatus: (status: LayoutStatus) => void;
  onPinnedChange: (pinned: ReadonlySet<string>) => void;
}

interface DragState {
  id: string;
  moved: boolean;
  touch: boolean;
  wasPinned: boolean;
  startX: number;
  startY: number;
}

interface HoverTransition {
  from: GraphEmphasisState;
  to: GraphEmphasisState;
  startedAt: number;
  progress: number;
}

interface EdgeVisualStyle {
  tone: number;
  size: number;
  zIndex: number;
}

const edgePrograms = {
  line: EdgeLineProgram as EdgeProgramType<GraphNode, RuntimeGraphEdge>,
};
const OVERVIEW_CAMERA_RATIO = 1.08;
const STAGE_CLICK_GRACE_MS = 24;

export class GraphViewportSession {
  private readonly container: HTMLDivElement;
  private readonly sourceGraph: RhizomeGraph;
  private readonly renderer: Sigma<GraphNode, RuntimeGraphEdge>;
  private readonly positions: GraphPositionStore;
  private readonly events: GraphViewportEvents;
  private displayGraph: RhizomeGraph;
  private snapshot?: GraphViewportSnapshot;
  private motion?: GraphMotionController;
  private motionFrame?: number;
  private adaptiveFrame?: number;
  private adaptiveLastTimestamp?: number;
  private adaptiveWarmupFrames = 0;
  private adaptiveDurations: number[] = [];
  private performanceLimitedProjection?: GraphProjection;
  private cameraFrame?: number;
  private hoverFrame?: number;
  private hoverTransitionFrame?: number;
  private hoverTransition?: HoverTransition;
  private pendingHoverPoint?: { x: number; y: number };
  private cameraOperation = 0;
  private stageClickTimer?: number;
  private labelZoomStyle: LabelZoomStyle = labelZoomStyleForRatio(OVERVIEW_CAMERA_RATIO);
  private drag?: DragState;
  private hovered?: string;
  private hoverNeighbors = new Set<string>();
  private selected?: string;
  private searchMatches?: ReadonlySet<string>;
  private selectedNeighbors = new Set<string>();
  private backTraceVisits: ReadonlyMap<string, number> = new Map();
  private suppressClickUntil = 0;
  private destroyed = false;

  constructor(container: HTMLDivElement, sourceGraph: RhizomeGraph, events: GraphViewportEvents) {
    this.container = container;
    this.sourceGraph = sourceGraph;
    this.events = events;
    this.positions = new GraphPositionStore(sourceGraph);
    this.displayGraph = sourceGraph.nullCopy();

    const drawHover: NodeHoverDrawingFunction<GraphNode, RuntimeGraphEdge> = (context, data) => {
      const key = (data as typeof data & { key?: string }).key;
      const rootEmphasis = key ? this.hoverEmphasis(key) : 0;
      if (key && this.positions.isPinned(key)) {
        context.beginPath();
        context.arc(data.x, data.y, data.size + 4, 0, Math.PI * 2);
        context.strokeStyle = "#8e8e93";
        context.lineWidth = 1.5;
        context.stroke();
      }
      if (key && key === this.selected && (this.backTraceVisits.get(key) ?? 0) > 0) {
        context.beginPath();
        context.arc(data.x, data.y, data.size + 3, 0, Math.PI * 2);
        context.strokeStyle = "#f5f5f7";
        context.lineWidth = 1.5;
        context.stroke();
      }
      if (rootEmphasis > 0) {
        context.beginPath();
        context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
        context.strokeStyle = `rgba(245, 245, 247, ${rootEmphasis})`;
        context.lineWidth = 1.5;
        context.stroke();
      }
    };

    const drawLabel: NodeLabelDrawingFunction<GraphNode, RuntimeGraphEdge> = (
      context,
      data,
      settings,
    ) => {
      if (!data.label || !this.labelZoomStyle.visible) return;
      const { opacity, size } = this.labelZoomStyle;
      const key = (data as typeof data & { key?: string }).key;
      const relevance = key
        ? effectiveLabelRelevance(
            this.hoverRelevance(key),
            this.snapshot?.focus ?? false,
            Boolean(this.hovered),
          )
        : 1;
      const labelOpacity = labelOpacityForHover(opacity, relevance);
      if (labelOpacity === 0) return;
      const x = data.x + data.size + Math.max(3, size * 0.38);
      context.save();
      context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.strokeStyle = `rgba(23, 24, 26, ${Math.min(0.94, labelOpacity + 0.18)})`;
      context.lineWidth = Math.max(2, size * 0.3);
      context.strokeText(data.label, x, data.y);
      context.fillStyle = `rgba(245, 245, 247, ${labelOpacity})`;
      context.fillText(data.label, x, data.y);
      context.restore();
    };

    this.renderer = new Sigma<GraphNode, RuntimeGraphEdge>(this.displayGraph, container, {
      allowInvalidContainer: false,
      defaultDrawNodeLabel: drawLabel,
      defaultDrawNodeHover: drawHover,
      defaultNodeColor: nodeTone(),
      defaultEdgeColor: relationTone(),
      edgeProgramClasses: edgePrograms,
      hideEdgesOnMove: true,
      hideLabelsOnMove: false,
      labelColor: { color: "#f5f5f7" },
      labelDensity: 1,
      labelFont: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      labelRenderedSizeThreshold: 0,
      labelSize: 12,
      labelWeight: "500",
      maxCameraRatio: 4,
      renderEdgeLabels: false,
      zIndex: true,
    });
    this.renderer.setSetting("nodeReducer", (node, data) => this.reduceNode(node, data));
    this.renderer.setSetting("edgeReducer", (_, data) => this.reduceEdge(data));
    this.renderer.getCamera().setState({ x: 0.5, y: 0.5, ratio: OVERVIEW_CAMERA_RATIO, angle: 0 });
    const cameraRatio = this.renderer.getCamera().getState().ratio;
    this.applyLabelZoom(cameraRatio);
    this.container.setAttribute("data-camera-ratio", cameraRatio.toFixed(4));
    this.renderer.getCamera().on("updated", this.handleCameraUpdate);
    this.bindInteractions();
  }

  private nodeSize(node: string, data: GraphNode): number {
    const baseSize = nodeRadius(data);
    return baseSize + this.hoverEmphasis(node) * 1.5 + this.neighborEmphasis(node) * 0.7;
  }

  private reduceNode(node: string, data: GraphNode) {
    const isSelected = node === this.selected;
    const isHovered = node === this.hovered;
    const rootEmphasis = this.hoverEmphasis(node);
    const neighborEmphasis = this.neighborEmphasis(node);
    const isPinned = this.positions.isPinned(node);
    const isSearchMatch = this.searchMatches?.has(node) ?? false;
    const searchRelated = !this.searchMatches || isSearchMatch;
    const hoverRelevance = this.hoverRelevance(node);
    const touchSelectionActive = Boolean(
      this.snapshot?.touchMode &&
        !this.hovered &&
        (this.selected || this.hoverTransition?.from.root),
    );
    const minimumTone = unrelatedNodeOpacity(Boolean(this.searchMatches), touchSelectionActive);
    const hoverTone = interpolateHoverValue(minimumTone, 1, hoverRelevance);
    const tone = searchRelated ? hoverTone : minimumTone;
    const visits = this.backTraceVisits.get(node) ?? 0;
    const isStained = visits > 0;
    const baseColor = isStained ? backTraceNodeTone(visits) : nodeTone();
    const color = isStained ? baseColor : emphasizeNodeTone(baseColor, rootEmphasis);
    const size = this.nodeSize(node, data);
    return {
      ...data,
      label: String(data.title ?? node),
      color: blendGraphTone(color, tone),
      size: isSearchMatch ? size + 1.2 : size,
      zIndex:
        isSelected || isHovered || rootEmphasis > 0
          ? 4
          : isPinned || isSearchMatch
            ? 3
            : neighborEmphasis > 0
              ? 2
              : 1,
      forceLabel: true,
      highlighted: isPinned || rootEmphasis > 0 || (isSelected && isStained),
    };
  }

  private reduceEdge(data: RuntimeGraphEdge) {
    const transition = this.hoverTransition;
    const from = this.edgeVisualStyle(data, transition?.from ?? this.currentEmphasisState());
    if (!transition) {
      return {
        ...data,
        color: blendGraphTone(data.relationColor, from.tone),
        size: from.size,
        zIndex: from.zIndex,
      };
    }
    const to = this.edgeVisualStyle(data, transition.to);
    const progress = transition.progress;
    return {
      ...data,
      color: blendGraphTone(
        data.relationColor,
        interpolateHoverValue(from.tone, to.tone, progress),
      ),
      size: interpolateHoverValue(from.size, to.size, progress),
      zIndex: progress < 0.5 ? from.zIndex : to.zIndex,
    };
  }

  private edgeVisualStyle(data: RuntimeGraphEdge, emphasis: GraphEmphasisState): EdgeVisualStyle {
    const selectedActive =
      this.selected && (data.source === this.selected || data.target === this.selected);
    const searchActive =
      this.searchMatches?.has(data.source) && this.searchMatches.has(data.target);
    const emphasisActive =
      emphasis.root && (data.source === emphasis.root || data.target === emphasis.root);
    const active = emphasis.root
      ? emphasisActive
      : this.searchMatches
        ? searchActive
        : selectedActive;
    return {
      tone: active ? 1 : emphasis.root || this.searchMatches ? 0.1 : 0.24,
      size: active ? 1.7 : emphasis.root || this.searchMatches ? 0.3 : 0.42,
      zIndex: active ? 2 : 1,
    };
  }

  private currentEmphasisState(): GraphEmphasisState {
    return effectiveGraphEmphasis(
      { root: this.hovered, neighbors: this.hoverNeighbors },
      { root: this.selected, neighbors: this.selectedNeighbors },
    );
  }

  private emphasisRelevance(node: string, state: GraphEmphasisState): number {
    return !state.root || node === state.root || state.neighbors.has(node) ? 1 : 0;
  }

  private hoverRelevance(node: string): number {
    const transition = this.hoverTransition;
    if (!transition) return this.emphasisRelevance(node, this.currentEmphasisState());
    return interpolateHoverValue(
      this.emphasisRelevance(node, transition.from),
      this.emphasisRelevance(node, transition.to),
      transition.progress,
    );
  }

  private hoverEmphasis(node: string): number {
    const transition = this.hoverTransition;
    if (!transition) return node === this.currentEmphasisState().root ? 1 : 0;
    return interpolateHoverValue(
      node === transition.from.root ? 1 : 0,
      node === transition.to.root ? 1 : 0,
      transition.progress,
    );
  }

  private neighborEmphasis(node: string): number {
    const strength = (state: GraphEmphasisState) =>
      state.root && state.neighbors.has(node) ? 1 : 0;
    const transition = this.hoverTransition;
    if (!transition) return strength(this.currentEmphasisState());
    return interpolateHoverValue(
      strength(transition.from),
      strength(transition.to),
      transition.progress,
    );
  }

  private applyLabelZoom(ratio: number): void {
    const previousVisibility = this.labelZoomStyle.visible;
    this.labelZoomStyle = labelZoomStyleForRatio(ratio);
    this.container.setAttribute(
      "data-label-visibility",
      this.labelZoomStyle.visible ? "all" : "none",
    );
    this.container.setAttribute("data-label-opacity", this.labelZoomStyle.opacity.toFixed(3));
    this.container.setAttribute("data-label-size", this.labelZoomStyle.size.toFixed(3));
    if (previousVisibility !== this.labelZoomStyle.visible) {
      this.renderer.setSetting("renderLabels", this.labelZoomStyle.visible);
    }
  }

  private readonly handleCameraUpdate = (state: { ratio: number }): void => {
    this.container.setAttribute("data-camera-ratio", state.ratio.toFixed(4));
    this.applyLabelZoom(state.ratio);
    this.writeSelectedViewportPosition();
  };

  private writeSelectedViewportPosition(): void {
    if (!this.selected || !this.displayGraph.hasNode(this.selected)) {
      this.container.removeAttribute("data-selected-viewport-x");
      this.container.removeAttribute("data-selected-viewport-y");
      return;
    }
    const position = this.renderer.graphToViewport(this.positions.getCurrent(this.selected));
    this.container.setAttribute("data-selected-viewport-x", position.x.toFixed(2));
    this.container.setAttribute("data-selected-viewport-y", position.y.toFixed(2));
  }

  private bindInteractions(): void {
    this.renderer.on("downNode", ({ node, event, preventSigmaDefault }) => {
      this.cancelStageClick();
      preventSigmaDefault();
      this.beginDrag(node, event);
    });
    this.renderer.on("downStage", ({ event, preventSigmaDefault }) => {
      const node = this.nodeAtPoint(event);
      if (!node) return;
      this.cancelStageClick();
      preventSigmaDefault();
      this.beginDrag(node, event);
    });
    this.renderer.on("clickNode", ({ node }) => {
      this.cancelStageClick();
      if (performance.now() >= this.suppressClickUntil) this.snapshot?.onSelect(node);
    });
    this.renderer.on("clickStage", ({ event }) => {
      const node = this.nodeAtPoint(event);
      if (!node) {
        this.scheduleClearSelection();
        return;
      }
      this.cancelStageClick();
      if (performance.now() >= this.suppressClickUntil) this.snapshot?.onSelect(node);
    });
    this.renderer.on("doubleClickStage", () => this.cancelStageClick());
    this.renderer.on("leaveStage", () => {
      this.cancelHoverProbe();
      this.clearHover();
    });

    const mouse = this.renderer.getMouseCaptor();
    const touch = this.renderer.getTouchCaptor();
    mouse.on("mousemove", (event) => {
      if (!this.drag) this.scheduleHoverProbe(event);
    });
    mouse.on("mousemovebody", (event) => this.moveDrag(event));
    mouse.on("mouseup", (event) => this.finishDrag(event.original));
    touch.on("touchmovebody", (event) => {
      if (event.touches.length !== 1) {
        this.finishDrag(event.original);
        return;
      }
      this.moveDrag({
        ...event.touches[0],
        preventSigmaDefault: event.preventSigmaDefault,
      });
    });
    touch.on("touchup", (event) => this.finishDrag(event.original));
  }

  private nodeHitAreas(): NodeHitArea[] {
    const nodes: NodeHitArea[] = [];
    this.displayGraph.forEachNode((id, data) => {
      const position = this.renderer.graphToViewport(this.positions.getCurrent(id));
      const searchSize = this.searchMatches?.has(id) ? 1.2 : 0;
      nodes.push({
        id,
        x: position.x,
        y: position.y,
        visibleRadius: this.renderer.scaleSize(this.nodeSize(id, data) + searchSize),
        zIndex:
          id === this.selected || id === this.hovered
            ? 4
            : this.positions.isPinned(id) || this.searchMatches?.has(id)
              ? 3
              : this.selectedNeighbors.has(id)
                ? 2
                : 1,
      });
    });
    return nodes;
  }

  private nodeAtPoint(point: { x: number; y: number }): string | undefined {
    return closestNodeAtPoint(point, this.nodeHitAreas());
  }

  private scheduleHoverProbe(point: { x: number; y: number }): void {
    this.pendingHoverPoint = { x: point.x, y: point.y };
    if (this.hoverFrame !== undefined) return;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = undefined;
      const pending = this.pendingHoverPoint;
      this.pendingHoverPoint = undefined;
      if (!pending || this.destroyed || this.drag) return;
      const node = this.nodeAtPoint(pending);
      if (node) this.setHover(node);
      else this.clearHover();
    });
  }

  private cancelHoverProbe(): void {
    if (this.hoverFrame !== undefined) cancelAnimationFrame(this.hoverFrame);
    this.hoverFrame = undefined;
    this.pendingHoverPoint = undefined;
  }

  private cancelStageClick(): void {
    if (this.stageClickTimer === undefined) return;
    window.clearTimeout(this.stageClickTimer);
    this.stageClickTimer = undefined;
  }

  private scheduleClearSelection(): void {
    this.cancelStageClick();
    if (!this.selected) return;
    this.stageClickTimer = window.setTimeout(() => {
      this.stageClickTimer = undefined;
      if (this.selected) this.snapshot?.onClearSelection();
    }, this.renderer.getSetting("doubleClickTimeout") + STAGE_CLICK_GRACE_MS);
  }

  private beginDrag(id: string, event: { x: number; y: number; original: Event }): void {
    if (!this.displayGraph.hasNode(id)) return;
    this.drag = {
      id,
      moved: false,
      touch: "touches" in event.original,
      wasPinned: this.positions.isPinned(id),
      startX: event.x,
      startY: event.y,
    };
    this.renderer.getCamera().disable();
  }

  private moveDrag(point: { x: number; y: number; preventSigmaDefault(): void }): void {
    const drag = this.drag;
    if (!drag || !this.displayGraph.hasNode(drag.id)) return;
    point.preventSigmaDefault();
    if (!drag.moved) {
      if (Math.hypot(point.x - drag.startX, point.y - drag.startY) <= dragThreshold(drag.touch)) {
        return;
      }
      drag.moved = true;
      this.motion?.beginDrag(drag.id, this.positions.getCurrent(drag.id));
    }
    const position = this.renderer.viewportToGraph(point);
    if (this.motion) this.motion.moveDrag(drag.id, position);
    else {
      this.positions.setCurrent(drag.id, position);
      this.displayGraph.mergeNodeAttributes(drag.id, position);
    }
  }

  private finishDrag(original?: Event): void {
    const drag = this.drag;
    if (!drag) return;
    if (drag.moved) {
      const keepPinned = drag.touch
        ? drag.wasPinned
        : original instanceof MouseEvent && original.shiftKey;
      if (this.motion) this.motion.endDrag(drag.id, keepPinned);
      else {
        if (keepPinned) this.positions.pin(drag.id);
        else this.positions.release(drag.id);
        this.emitPinnedState();
      }
    }
    if (drag.moved) this.suppressClickUntil = performance.now() + 300;
    this.drag = undefined;
    this.renderer.getCamera().enable();
    this.renderer.refresh();
  }

  private cancelHoverTransition(): void {
    if (this.hoverTransitionFrame !== undefined) {
      cancelAnimationFrame(this.hoverTransitionFrame);
    }
    this.hoverTransitionFrame = undefined;
    this.hoverTransition = undefined;
  }

  private scheduleHoverTransitionFrame(): void {
    this.hoverTransitionFrame = requestAnimationFrame((timestamp) => {
      this.hoverTransitionFrame = undefined;
      const transition = this.hoverTransition;
      if (!transition || this.destroyed) return;
      transition.progress = hoverTransitionProgress(timestamp - transition.startedAt);
      this.renderer.refresh();
      if (transition.progress < 1) {
        this.scheduleHoverTransitionFrame();
        return;
      }
      this.hoverTransition = undefined;
    });
  }

  private startHoverTransition(from: GraphEmphasisState, to: GraphEmphasisState): void {
    this.cancelHoverTransition();
    if (sameGraphEmphasis(from, to)) {
      this.renderer.refresh();
      return;
    }
    if (this.snapshot?.reducedMotion) {
      this.renderer.refresh();
      return;
    }
    this.hoverTransition = {
      from: { root: from.root, neighbors: new Set(from.neighbors) },
      to: { root: to.root, neighbors: new Set(to.neighbors) },
      startedAt: performance.now(),
      progress: 0,
    };
    this.renderer.refresh();
    this.scheduleHoverTransitionFrame();
  }

  private cancelDrag(): void {
    const drag = this.drag;
    if (!drag) return;
    if (drag.wasPinned) this.positions.pin(drag.id);
    else this.positions.release(drag.id);
    this.drag = undefined;
    this.renderer.getCamera().enable();
    this.emitPinnedState();
  }

  private setHover(node: string): void {
    if (this.hovered === node) return;
    const previous = this.currentEmphasisState();
    this.hovered = node;
    this.hoverNeighbors = neighborsOf(this.displayGraph, node);
    this.writeHoverAttributes();
    this.writeEmphasisAttributes();
    this.startHoverTransition(previous, this.currentEmphasisState());
  }

  private clearHover(): void {
    if (!this.hovered) return;
    const previous = this.currentEmphasisState();
    this.hovered = undefined;
    this.hoverNeighbors.clear();
    this.container.removeAttribute("data-hovered-node");
    this.container.removeAttribute("data-hovered-neighbor-count");
    this.container.removeAttribute("data-emphasized-node");
    this.container.removeAttribute("data-emphasis-source");
    this.writeEmphasisAttributes();
    this.startHoverTransition(previous, this.currentEmphasisState());
  }

  private writeHoverAttributes(): void {
    if (!this.hovered) return;
    this.container.setAttribute("data-hovered-node", this.hovered);
    this.container.setAttribute("data-hovered-neighbor-count", String(this.hoverNeighbors.size));
  }

  private writeEmphasisAttributes(): void {
    const emphasis = this.currentEmphasisState();
    if (!emphasis.root) {
      this.container.removeAttribute("data-emphasized-node");
      this.container.removeAttribute("data-emphasis-source");
      return;
    }
    this.container.setAttribute("data-emphasized-node", emphasis.root);
    this.container.setAttribute("data-emphasis-source", this.hovered ? "hover" : "selection");
  }

  private reconcileHover(nextGraph: RhizomeGraph): void {
    if (!this.hovered) return;
    const reconciled = reconcileProjectedHover(nextGraph, this.hovered);
    this.hovered = reconciled.hovered;
    this.hoverNeighbors = reconciled.neighbors;
    if (!this.hovered) {
      this.container.removeAttribute("data-hovered-node");
      this.container.removeAttribute("data-hovered-neighbor-count");
      this.writeEmphasisAttributes();
      return;
    }
    this.writeHoverAttributes();
    this.writeEmphasisAttributes();
  }

  private installDisplayGraph(projection: GraphProjection): void {
    const nextGraph = createDisplayGraph(this.sourceGraph, projection, this.positions);
    this.reconcileHover(nextGraph);
    this.displayGraph = nextGraph;
    this.selectedNeighbors =
      this.selected && nextGraph.hasNode(this.selected)
        ? neighborsOf(nextGraph, this.selected)
        : new Set<string>();
    const normalizationBounds = projectionBaseBounds(projection, this.positions);
    this.renderer.setCustomBBox(normalizationBounds);
    this.container.setAttribute("data-normalization-bounds", JSON.stringify(normalizationBounds));
    this.renderer.setGraph(nextGraph);
  }

  private replaceDisplayGraph(projection: GraphProjection): void {
    this.stopMotion();
    this.cancelDrag();
    this.cancelHoverProbe();
    this.cancelHoverTransition();
    this.installDisplayGraph(projection);
  }

  private stopMotion(): void {
    this.stopAdaptiveMonitor();
    if (this.motionFrame !== undefined) cancelAnimationFrame(this.motionFrame);
    this.motionFrame = undefined;
    this.motion?.kill();
    this.motion = undefined;
  }

  private stopAdaptiveMonitor(): void {
    if (this.adaptiveFrame !== undefined) cancelAnimationFrame(this.adaptiveFrame);
    this.adaptiveFrame = undefined;
    this.adaptiveLastTimestamp = undefined;
    this.adaptiveWarmupFrames = 0;
    this.adaptiveDurations = [];
  }

  private startAdaptiveMonitor(): void {
    this.stopAdaptiveMonitor();
    const sample = (timestamp: number) => {
      this.adaptiveFrame = undefined;
      const snapshot = this.snapshot;
      const motion = this.motion;
      if (!snapshot || !motion || this.destroyed) return;
      if (document.visibilityState !== "visible" || motion.interacting) {
        this.adaptiveLastTimestamp = undefined;
        this.adaptiveWarmupFrames = 0;
        this.adaptiveDurations = [];
      } else if (this.adaptiveLastTimestamp === undefined) {
        this.adaptiveLastTimestamp = timestamp;
      } else {
        const duration = timestamp - this.adaptiveLastTimestamp;
        this.adaptiveLastTimestamp = timestamp;
        if (this.adaptiveWarmupFrames < ADAPTIVE_MOTION_SETTINGS.warmupFrames) {
          this.adaptiveWarmupFrames += 1;
        } else {
          this.adaptiveDurations.push(duration);
          if (this.adaptiveDurations.length > ADAPTIVE_MOTION_SETTINGS.windowFrames) {
            this.adaptiveDurations.shift();
          }
          if (shouldLimitAdaptiveMotion(this.adaptiveDurations)) {
            this.performanceLimitedProjection = snapshot.projection;
            this.stopMotion();
            this.container.setAttribute("data-motion-policy", "performance-limited");
            this.emitStatus("static");
            return;
          }
        }
      }
      this.adaptiveFrame = requestAnimationFrame(sample);
    };
    this.adaptiveFrame = requestAnimationFrame(sample);
  }

  private motionPolicy(snapshot: GraphViewportSnapshot): MotionPolicy {
    if (this.performanceLimitedProjection === snapshot.projection) return "static";
    return resolveMotionPolicy(snapshot.projection, snapshot.compact, snapshot.touchMode);
  }

  private startMotion(settled = false): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    if (snapshot.projection.nodes.size <= 1) {
      this.container.setAttribute("data-motion-policy", "full");
      this.emitStatus("settled");
      return;
    }
    const policy = this.motionPolicy(snapshot);
    if (policy === "static") {
      this.container.setAttribute(
        "data-motion-policy",
        this.performanceLimitedProjection === snapshot.projection
          ? "performance-limited"
          : "size-limited",
      );
      this.emitStatus("static");
      return;
    }
    if (!snapshot.motionEnabled) {
      this.container.setAttribute("data-motion-policy", "paused");
      this.emitStatus("paused");
      return;
    }
    this.container.setAttribute("data-motion-policy", policy);

    const motion = new GraphMotionController({
      graph: this.displayGraph,
      positions: this.positions,
      onStatus: (status) => {
        this.emitStatus(status);
        if (status === "settled") {
          this.stopAdaptiveMonitor();
          const current = this.snapshot;
          if (
            current?.touchMode &&
            current.readerOpen &&
            current.readerCompact &&
            current.selected &&
            this.displayGraph.hasNode(current.selected)
          ) {
            this.centerSelection(current.selected);
          }
        }
      },
      onPinnedChange: () => {
        this.emitPinnedState();
        this.renderer.refresh();
      },
    });
    this.motion = motion;
    this.motionFrame = requestAnimationFrame(() => {
      this.motionFrame = undefined;
      void motion
        .start(settled)
        .then(() => {
          if (!settled && policy === "adaptive" && !this.destroyed && this.motion === motion) {
            this.startAdaptiveMonitor();
          }
        })
        .catch((error: unknown) => {
          if (this.destroyed || this.motion !== motion) return;
          console.error("Rhizome motion could not start", error);
          this.emitStatus("paused");
        });
    });
  }

  private emitStatus(status: LayoutStatus): void {
    if (!this.destroyed) this.events.onStatus(status);
  }

  private emitPinnedState(): void {
    if (!this.destroyed) this.events.onPinnedChange(this.positions.getPinnedIds());
  }

  private animateCamera(target: {
    x: number;
    y: number;
    ratio: number;
    angle?: number;
  }): Promise<void> {
    const camera = this.renderer.getCamera();
    if (this.snapshot?.reducedMotion) {
      camera.setState(target);
      return Promise.resolve();
    }
    return camera.animate(target, { duration: 280, easing: "quadraticInOut" });
  }

  private selectionViewportCenter(): { x: number; y: number } | undefined {
    const snapshot = this.snapshot;
    if (!snapshot) return undefined;
    const dimensions = this.renderer.getDimensions();
    return selectionViewportPoint({
      width: dimensions.width,
      height: dimensions.height,
      touchMode: snapshot.touchMode,
      readerOpen: snapshot.readerOpen,
      readerCompact: snapshot.readerCompact,
      mobileReaderHeight: snapshot.mobileReaderHeight,
    });
  }

  private scheduleCenterCorrection(id: string, operation: number, attempts = 3): void {
    if (operation !== this.cameraOperation) return;
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = requestAnimationFrame(() => {
      this.cameraFrame = undefined;
      if (
        this.destroyed ||
        operation !== this.cameraOperation ||
        this.selected !== id ||
        !this.displayGraph.hasNode(id)
      ) {
        return;
      }
      const camera = this.renderer.getCamera();
      const cameraState = camera.getState();
      const viewportCenter = this.selectionViewportCenter();
      if (!viewportCenter) return;
      const nodeViewport = this.renderer.graphToViewport(this.positions.getCurrent(id));
      if (Math.hypot(nodeViewport.x - viewportCenter.x, nodeViewport.y - viewportCenter.y) <= 1) {
        return;
      }
      const nodePosition = this.renderer.viewportToFramedGraph(nodeViewport);
      const centerPosition = this.renderer.viewportToFramedGraph(viewportCenter);
      camera.setState({
        x: cameraState.x + nodePosition.x - centerPosition.x,
        y: cameraState.y + nodePosition.y - centerPosition.y,
      });
      if (attempts > 1) this.scheduleCenterCorrection(id, operation, attempts - 1);
    });
  }

  private centerSelection(id: string): void {
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    const operation = ++this.cameraOperation;
    this.cameraFrame = requestAnimationFrame(() => {
      this.cameraFrame = undefined;
      if (operation !== this.cameraOperation || !this.displayGraph.hasNode(id)) return;
      const camera = this.renderer.getCamera();
      const cameraState = camera.getState();
      const ratio = Math.min(cameraState.ratio, 0.85);
      const provisionalState = { ...cameraState, ratio };
      const viewportPosition = this.renderer.graphToViewport(this.positions.getCurrent(id), {
        cameraState: provisionalState,
      });
      const viewportCenter = this.selectionViewportCenter();
      if (!viewportCenter) return;
      const nodePosition = this.renderer.viewportToFramedGraph(viewportPosition, {
        cameraState: provisionalState,
      });
      const centerPosition = this.renderer.viewportToFramedGraph(viewportCenter, {
        cameraState: provisionalState,
      });
      const target = {
        x: provisionalState.x + nodePosition.x - centerPosition.x,
        y: provisionalState.y + nodePosition.y - centerPosition.y,
        ratio,
      };
      void this.animateCamera(target).then(() => this.scheduleCenterCorrection(id, operation));
    });
  }

  sync(next: GraphViewportSnapshot): void {
    if (this.destroyed) return;
    const previous = this.snapshot;
    const previousEmphasis = this.currentEmphasisState();
    const projectionChanged = !previous || previous.projection !== next.projection;
    const selectionChanged = previous?.selected !== next.selected;
    const touchModeChanged = previous?.touchMode !== next.touchMode;
    const focusChanged = previous?.focus !== next.focus;
    const searchChanged = previous?.searchMatches !== next.searchMatches;
    const backTraceChanged = previous?.backTraceVisits !== next.backTraceVisits;
    const previousPolicy = previous ? this.motionPolicy(previous) : undefined;
    const nextPolicy = this.motionPolicy(next);
    const nextEligible = nextPolicy !== "static";
    const motionPolicyChanged =
      !previous || previous.motionEnabled !== next.motionEnabled || previousPolicy !== nextPolicy;

    this.snapshot = next;
    this.selected = next.selected;
    this.backTraceVisits = next.backTraceVisits;
    if (selectionChanged) this.cancelStageClick();
    this.searchMatches = next.searchMatches;
    if (next.searchMatches) {
      this.container.setAttribute("data-search-match-count", String(next.searchMatches.size));
    } else {
      this.container.removeAttribute("data-search-match-count");
    }
    this.container.setAttribute("data-back-trace-node-count", String(this.backTraceVisits.size));
    this.container.setAttribute(
      "data-back-trace-selected-visits",
      String(this.selected ? (this.backTraceVisits.get(this.selected) ?? 0) : 0),
    );

    if (projectionChanged) this.replaceDisplayGraph(next.projection);
    else if (selectionChanged) {
      this.selectedNeighbors =
        next.selected && this.displayGraph.hasNode(next.selected)
          ? neighborsOf(this.displayGraph, next.selected)
          : new Set<string>();
    }
    this.writeEmphasisAttributes();
    this.writeSelectedViewportPosition();
    if (previous && (projectionChanged || selectionChanged || touchModeChanged)) {
      this.startHoverTransition(previousEmphasis, this.currentEmphasisState());
    }

    if (this.renderer.getSetting("hideEdgesOnMove") === nextEligible) {
      this.renderer.setSetting("hideEdgesOnMove", !nextEligible);
    }

    if (projectionChanged || motionPolicyChanged) {
      if (!projectionChanged) this.stopMotion();
      this.startMotion();
    }

    if (
      !projectionChanged &&
      (selectionChanged || touchModeChanged || focusChanged || searchChanged || backTraceChanged)
    ) {
      this.renderer.refresh();
    }
    const readerOpened = Boolean(previous && !previous.readerOpen && next.readerOpen);
    const readerGrew = Boolean(
      previous?.readerOpen &&
        next.readerOpen &&
        next.mobileReaderHeight > previous.mobileReaderHeight,
    );
    const initialTouchSelection = !previous && next.touchMode && next.readerOpen;
    if (
      next.selected &&
      this.displayGraph.hasNode(next.selected) &&
      ((previous && selectionChanged) ||
        initialTouchSelection ||
        (next.touchMode && next.readerCompact && (readerOpened || readerGrew)))
    ) {
      this.centerSelection(next.selected);
    }
  }

  setPinned(id: string, pinned: boolean): void {
    if (this.destroyed || !this.displayGraph.hasNode(id)) return;
    if (this.motion) this.motion.setPinned(id, pinned);
    else {
      if (pinned) this.positions.pin(id);
      else this.positions.release(id);
      this.emitPinnedState();
      this.renderer.refresh();
    }
  }

  resetLayout(): void {
    const snapshot = this.snapshot;
    if (!snapshot || this.destroyed) return;
    this.stopMotion();
    this.cancelDrag();
    this.cancelHoverTransition();
    this.positions.reset();
    this.emitPinnedState();
    this.installDisplayGraph(snapshot.projection);
    this.cameraOperation += 1;
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = undefined;
    void this.animateCamera({ x: 0.5, y: 0.5, ratio: OVERVIEW_CAMERA_RATIO, angle: 0 });
    this.startMotion();
  }

  resize(): void {
    if (this.destroyed) return;
    this.renderer.resize(true).scheduleRender();
    const snapshot = this.snapshot;
    if (
      snapshot?.touchMode &&
      snapshot.readerOpen &&
      snapshot.readerCompact &&
      snapshot.selected &&
      this.displayGraph.hasNode(snapshot.selected)
    ) {
      this.centerSelection(snapshot.selected);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.renderer.getCamera().off("updated", this.handleCameraUpdate);
    this.stopMotion();
    this.cancelDrag();
    this.cancelHoverProbe();
    this.cancelHoverTransition();
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = undefined;
    this.cameraOperation += 1;
    this.cancelStageClick();
    this.hovered = undefined;
    this.hoverNeighbors.clear();
    this.searchMatches = undefined;
    this.container.removeAttribute("data-hovered-node");
    this.container.removeAttribute("data-hovered-neighbor-count");
    this.container.removeAttribute("data-emphasized-node");
    this.container.removeAttribute("data-emphasis-source");
    this.container.removeAttribute("data-search-match-count");
    this.container.removeAttribute("data-back-trace-node-count");
    this.container.removeAttribute("data-back-trace-selected-visits");
    this.container.removeAttribute("data-normalization-bounds");
    this.container.removeAttribute("data-camera-ratio");
    this.container.removeAttribute("data-label-visibility");
    this.container.removeAttribute("data-label-opacity");
    this.container.removeAttribute("data-label-size");
    this.container.removeAttribute("data-motion-policy");
    this.container.removeAttribute("data-selected-viewport-x");
    this.container.removeAttribute("data-selected-viewport-y");
    this.renderer.kill();
  }
}
