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
  isMotionEligible,
  type LayoutStatus,
  nodeColorWithAlpha,
  nodeRadius,
  projectionBaseBounds,
} from "./graph-layout";
import { backTraceNodeTone, blendGraphTone, nodeTone, relationTone } from "./graph-theme";

export interface GraphViewportSnapshot {
  backTraceVisits: ReadonlyMap<string, number>;
  projection: GraphProjection;
  selected?: string;
  focus: boolean;
  motionEnabled: boolean;
  compact: boolean;
  reducedMotion: boolean;
  searchMatches?: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onClearSelection: () => void;
}

interface GraphViewportEvents {
  onStatus: (status: LayoutStatus) => void;
  onPinnedCount: (count: number) => void;
}

interface DragState {
  id: string;
  moved: boolean;
  touch: boolean;
  wasPinned: boolean;
  startX: number;
  startY: number;
}

interface HoverVisualState {
  hovered?: string;
  neighbors: ReadonlySet<string>;
}

interface HoverTransition {
  from: HoverVisualState;
  to: HoverVisualState;
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
      if (key === this.hovered) {
        context.beginPath();
        context.arc(data.x, data.y, data.size + 5, 0, Math.PI * 2);
        context.strokeStyle = "#f5f5f7";
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
      const labelOpacity = key ? labelOpacityForHover(opacity, this.hoverRelevance(key)) : opacity;
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
    const size = node === this.selected ? Math.max(12.5, baseSize + 2) : baseSize;
    const neighborSize = this.selectedNeighbors.has(node) ? size + 0.7 : size;
    return neighborSize + this.hoverEmphasis(node) * 1.5;
  }

  private reduceNode(node: string, data: GraphNode) {
    const isSelected = node === this.selected;
    const isSelectedNeighbor = this.selectedNeighbors.has(node);
    const isHovered = node === this.hovered;
    const isPinned = this.positions.isPinned(node);
    const isSearchMatch = this.searchMatches?.has(node) ?? false;
    const searchRelated = !this.searchMatches || isSearchMatch;
    const hoverRelevance = this.hoverRelevance(node);
    const minimumAlpha = this.searchMatches ? 0x22 / 0xff : 0x2e / 0xff;
    const hoverAlpha = interpolateHoverValue(minimumAlpha, 1, hoverRelevance);
    const alpha = searchRelated ? hoverAlpha : minimumAlpha;
    const visits = this.backTraceVisits.get(node) ?? 0;
    const isStained = visits > 0;
    const color = isStained ? backTraceNodeTone(visits) : isSelected ? "#ffffff" : nodeTone();
    const size = this.nodeSize(node, data);
    return {
      ...data,
      label: String(data.title ?? node),
      color: nodeColorWithAlpha(
        color,
        Math.round(alpha * 0xff)
          .toString(16)
          .padStart(2, "0"),
      ),
      size: isSearchMatch ? size + 1.2 : size,
      zIndex:
        isSelected || isHovered ? 4 : isPinned || isSearchMatch ? 3 : isSelectedNeighbor ? 2 : 1,
      forceLabel: true,
      highlighted: isPinned || isHovered || (isSelected && isStained),
    };
  }

  private reduceEdge(data: RuntimeGraphEdge) {
    const transition = this.hoverTransition;
    const from = this.edgeVisualStyle(data, transition?.from ?? this.currentHoverVisualState());
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

  private edgeVisualStyle(data: RuntimeGraphEdge, hover: HoverVisualState): EdgeVisualStyle {
    const selectedActive =
      this.selected && (data.source === this.selected || data.target === this.selected);
    const searchActive =
      this.searchMatches?.has(data.source) && this.searchMatches.has(data.target);
    const hoverActive =
      hover.hovered && (data.source === hover.hovered || data.target === hover.hovered);
    const active = hover.hovered ? hoverActive : this.searchMatches ? searchActive : selectedActive;
    return {
      tone: active ? 1 : hover.hovered || this.searchMatches ? 0.1 : 0.24,
      size: active ? 1.7 : hover.hovered || this.searchMatches ? 0.3 : 0.42,
      zIndex: active ? 2 : 1,
    };
  }

  private currentHoverVisualState(): HoverVisualState {
    return { hovered: this.hovered, neighbors: this.hoverNeighbors };
  }

  private hoverStateRelevance(node: string, state: HoverVisualState): number {
    return !state.hovered || node === state.hovered || state.neighbors.has(node) ? 1 : 0;
  }

  private hoverRelevance(node: string): number {
    const transition = this.hoverTransition;
    if (!transition) return this.hoverStateRelevance(node, this.currentHoverVisualState());
    return interpolateHoverValue(
      this.hoverStateRelevance(node, transition.from),
      this.hoverStateRelevance(node, transition.to),
      transition.progress,
    );
  }

  private hoverEmphasis(node: string): number {
    const transition = this.hoverTransition;
    if (!transition) return node === this.hovered ? 1 : 0;
    return interpolateHoverValue(
      node === transition.from.hovered ? 1 : 0,
      node === transition.to.hovered ? 1 : 0,
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
  };

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
      if (Math.hypot(point.x - drag.startX, point.y - drag.startY) <= 4) return;
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
      const keepPinned = !drag.touch && original instanceof MouseEvent && original.shiftKey;
      if (this.motion) this.motion.endDrag(drag.id, keepPinned);
      else {
        if (keepPinned) this.positions.pin(drag.id);
        else this.positions.release(drag.id);
        this.emitPinnedCount();
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

  private startHoverTransition(from: HoverVisualState, to: HoverVisualState): void {
    this.cancelHoverTransition();
    if (this.snapshot?.reducedMotion) {
      this.renderer.refresh();
      return;
    }
    this.hoverTransition = {
      from: { hovered: from.hovered, neighbors: new Set(from.neighbors) },
      to: { hovered: to.hovered, neighbors: new Set(to.neighbors) },
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
    this.emitPinnedCount();
  }

  private setHover(node: string): void {
    if (this.hovered === node) return;
    const previous = this.currentHoverVisualState();
    this.hovered = node;
    this.hoverNeighbors = neighborsOf(this.displayGraph, node);
    this.writeHoverAttributes();
    this.startHoverTransition(previous, this.currentHoverVisualState());
  }

  private clearHover(): void {
    if (!this.hovered) return;
    const previous = {
      hovered: this.hovered,
      neighbors: new Set(this.hoverNeighbors),
    };
    this.hovered = undefined;
    this.hoverNeighbors.clear();
    this.container.removeAttribute("data-hovered-node");
    this.container.removeAttribute("data-hovered-neighbor-count");
    this.startHoverTransition(previous, this.currentHoverVisualState());
  }

  private writeHoverAttributes(): void {
    if (!this.hovered) return;
    this.container.setAttribute("data-hovered-node", this.hovered);
    this.container.setAttribute("data-hovered-neighbor-count", String(this.hoverNeighbors.size));
  }

  private reconcileHover(nextGraph: RhizomeGraph): void {
    if (!this.hovered) return;
    const reconciled = reconcileProjectedHover(nextGraph, this.hovered);
    this.hovered = reconciled.hovered;
    this.hoverNeighbors = reconciled.neighbors;
    if (!this.hovered) {
      this.container.removeAttribute("data-hovered-node");
      this.container.removeAttribute("data-hovered-neighbor-count");
      return;
    }
    this.writeHoverAttributes();
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
    if (this.motionFrame !== undefined) cancelAnimationFrame(this.motionFrame);
    this.motionFrame = undefined;
    this.motion?.kill();
    this.motion = undefined;
  }

  private startMotion(settled = false): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    if (snapshot.projection.nodes.size <= 1) {
      this.emitStatus("settled");
      return;
    }
    if (!isMotionEligible(snapshot.projection, snapshot.compact)) {
      this.emitStatus("static");
      return;
    }
    if (!snapshot.motionEnabled) {
      this.emitStatus("paused");
      return;
    }

    const motion = new GraphMotionController({
      graph: this.displayGraph,
      positions: this.positions,
      onStatus: (status) => this.emitStatus(status),
      onPinnedChange: () => {
        this.emitPinnedCount();
        this.renderer.refresh();
      },
    });
    this.motion = motion;
    this.motionFrame = requestAnimationFrame(() => {
      this.motionFrame = undefined;
      void motion.start(settled).catch((error: unknown) => {
        if (this.destroyed || this.motion !== motion) return;
        console.error("Rhizome motion could not start", error);
        this.emitStatus("paused");
      });
    });
  }

  private emitStatus(status: LayoutStatus): void {
    if (!this.destroyed) this.events.onStatus(status);
  }

  private emitPinnedCount(): void {
    if (!this.destroyed) this.events.onPinnedCount(this.positions.pinnedCount);
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
      const dimensions = this.renderer.getDimensions();
      const viewportCenter = { x: dimensions.width / 2, y: dimensions.height / 2 };
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
      const dimensions = this.renderer.getDimensions();
      const nodePosition = this.renderer.viewportToFramedGraph(viewportPosition, {
        cameraState: provisionalState,
      });
      const viewportCenter = this.renderer.viewportToFramedGraph(
        { x: dimensions.width / 2, y: dimensions.height / 2 },
        { cameraState: provisionalState },
      );
      const target = {
        x: provisionalState.x + nodePosition.x - viewportCenter.x,
        y: provisionalState.y + nodePosition.y - viewportCenter.y,
        ratio,
      };
      void this.animateCamera(target).then(() => this.scheduleCenterCorrection(id, operation));
    });
  }

  sync(next: GraphViewportSnapshot): void {
    if (this.destroyed) return;
    const previous = this.snapshot;
    const projectionChanged = !previous || previous.projection !== next.projection;
    const selectionChanged = previous?.selected !== next.selected;
    const focusChanged = previous?.focus !== next.focus;
    const searchChanged = previous?.searchMatches !== next.searchMatches;
    const backTraceChanged = previous?.backTraceVisits !== next.backTraceVisits;
    const previousEligible = previous
      ? isMotionEligible(previous.projection, previous.compact)
      : undefined;
    const nextEligible = isMotionEligible(next.projection, next.compact);
    const motionPolicyChanged =
      !previous ||
      previous.motionEnabled !== next.motionEnabled ||
      previousEligible !== nextEligible;

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

    if (this.renderer.getSetting("hideEdgesOnMove") === nextEligible) {
      this.renderer.setSetting("hideEdgesOnMove", !nextEligible);
    }

    if (projectionChanged || motionPolicyChanged) {
      if (!projectionChanged) this.stopMotion();
      this.startMotion();
    }

    if (
      !projectionChanged &&
      (selectionChanged || focusChanged || searchChanged || backTraceChanged)
    ) {
      this.renderer.refresh();
    }
    if (previous && selectionChanged && next.selected && this.displayGraph.hasNode(next.selected)) {
      this.centerSelection(next.selected);
    }
  }

  resetLayout(): void {
    const snapshot = this.snapshot;
    if (!snapshot || this.destroyed) return;
    this.stopMotion();
    this.cancelDrag();
    this.cancelHoverTransition();
    this.positions.reset();
    this.emitPinnedCount();
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
    this.container.removeAttribute("data-search-match-count");
    this.container.removeAttribute("data-back-trace-node-count");
    this.container.removeAttribute("data-back-trace-selected-visits");
    this.container.removeAttribute("data-normalization-bounds");
    this.container.removeAttribute("data-camera-ratio");
    this.container.removeAttribute("data-label-visibility");
    this.container.removeAttribute("data-label-opacity");
    this.container.removeAttribute("data-label-size");
    this.renderer.kill();
  }
}
