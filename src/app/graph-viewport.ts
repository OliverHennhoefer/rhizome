import Sigma from "sigma";
import {
  createEdgeArrowProgram,
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
import {
  createDisplayGraph,
  GraphMotionController,
  GraphPositionStore,
  isMotionEligible,
  type LayoutStatus,
  nodeColorWithAlpha,
  nodeRadius,
} from "./graph-layout";
import {
  collisionBoxForNode,
  graphUnitsPerPixel,
  LabelWidthCache,
  labelLodForRatio,
  NUDGE_SETTINGS,
  type NudgeStatus,
  selectPriorityLabels,
} from "./graph-nudge";
import { COMMUNITY_TONES, relationTone } from "./graph-theme";

export interface GraphViewportSnapshot {
  projection: GraphProjection;
  selected?: string;
  motionEnabled: boolean;
  compact: boolean;
  reducedMotion: boolean;
  settleProjection?: boolean;
  onSelect: (id: string) => void;
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

const edgePrograms = {
  arrow: createEdgeArrowProgram<GraphNode, RuntimeGraphEdge>(),
  line: EdgeLineProgram as EdgeProgramType<GraphNode, RuntimeGraphEdge>,
};

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
  private nudgeFrame?: number;
  private nudgeIdleTimer?: ReturnType<typeof setTimeout>;
  private nudgePending = false;
  private nudgeStatus: NudgeStatus = "disabled";
  private suppressCameraNudge = false;
  private cameraAnimationToken = 0;
  private lastCameraRatio = 1;
  private labelDensity = 0.08;
  private labelThreshold = 8;
  private readonly labelWidths: LabelWidthCache;
  private drag?: DragState;
  private hovered?: string;
  private hoverNeighbors = new Set<string>();
  private selected?: string;
  private selectedNeighbors = new Set<string>();
  private priorityNeighborLabels = new Set<string>();
  private suppressClickUntil = 0;
  private destroyed = false;

  constructor(container: HTMLDivElement, sourceGraph: RhizomeGraph, events: GraphViewportEvents) {
    this.container = container;
    this.sourceGraph = sourceGraph;
    this.events = events;
    this.positions = new GraphPositionStore(sourceGraph);
    this.displayGraph = sourceGraph.nullCopy();
    const measureContext = document.createElement("canvas").getContext("2d");
    this.labelWidths = new LabelWidthCache((label) => {
      if (!measureContext) return label.length * 7;
      measureContext.font =
        '500 12px -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif';
      return measureContext.measureText(label).width;
    });

    const drawHover: NodeHoverDrawingFunction<GraphNode, RuntimeGraphEdge> = (context, data) => {
      const key = (data as typeof data & { key?: string }).key;
      if (key && this.positions.isPinned(key)) {
        context.beginPath();
        context.arc(data.x, data.y, data.size + 4, 0, Math.PI * 2);
        context.strokeStyle = "#8e8e93";
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
      if (!data.label) return;
      const x = data.x + data.size + 5;
      context.save();
      context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
      context.textBaseline = "middle";
      context.lineJoin = "round";
      context.strokeStyle = "rgba(23, 24, 26, 0.94)";
      context.lineWidth = 4;
      context.strokeText(data.label, x, data.y);
      context.fillStyle = "#f5f5f7";
      context.fillText(data.label, x, data.y);
      context.restore();
    };

    this.renderer = new Sigma<GraphNode, RuntimeGraphEdge>(this.displayGraph, container, {
      allowInvalidContainer: false,
      defaultDrawNodeLabel: drawLabel,
      defaultDrawNodeHover: drawHover,
      defaultNodeColor: "#aeaeb2",
      defaultEdgeColor: "#48484a",
      edgeProgramClasses: edgePrograms,
      hideEdgesOnMove: true,
      labelColor: { color: "#f5f5f7" },
      labelDensity: 0.08,
      labelFont: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif',
      labelGridCellSize: 120,
      labelRenderedSizeThreshold: 8,
      labelSize: 12,
      labelWeight: "500",
      maxCameraRatio: 4,
      renderEdgeLabels: false,
      zIndex: true,
    });
    this.renderer.setSetting("nodeReducer", (node, data) => this.reduceNode(node, data));
    this.renderer.setSetting("edgeReducer", (_, data) => this.reduceEdge(data));
    this.lastCameraRatio = this.renderer.getCamera().getState().ratio;
    this.applyLabelLod(this.lastCameraRatio);
    this.container.setAttribute("data-nudge-status", this.nudgeStatus);
    this.container.setAttribute("data-camera-ratio", this.lastCameraRatio.toFixed(4));
    this.renderer.getCamera().on("updated", this.handleCameraUpdate);
    this.bindInteractions();
  }

  private nodeSize(node: string, data: GraphNode): number {
    const size = node === this.selected ? 13 : nodeRadius(data);
    return node === this.hovered ? size + 2 : size;
  }

  private isPriorityLabel(node: string): boolean {
    return (
      node === this.selected ||
      node === this.hovered ||
      this.positions.isPinned(node) ||
      this.priorityNeighborLabels.has(node)
    );
  }

  private recomputePriorityNeighborLabels(): void {
    this.priorityNeighborLabels = selectPriorityLabels(this.selectedNeighbors, (id) => {
      if (!this.displayGraph.hasNode(id)) return 0;
      return Number(this.displayGraph.getNodeAttribute(id, "degree")) || 0;
    });
  }

  private reduceNode(node: string, data: GraphNode) {
    const isSelected = node === this.selected;
    const isSelectedNeighbor = this.selectedNeighbors.has(node);
    const isHovered = node === this.hovered;
    const isHoverNeighbor = this.hoverNeighbors.has(node);
    const isPinned = this.positions.isPinned(node);
    const hoverRelated = !this.hovered || isHovered || isHoverNeighbor;
    const community = Number(data.community ?? 0);
    const color = isSelected
      ? "#ffffff"
      : isSelectedNeighbor
        ? "#c7c7cc"
        : COMMUNITY_TONES[Math.abs(community) % COMMUNITY_TONES.length];
    const size = this.nodeSize(node, data);
    return {
      ...data,
      label: String(data.title ?? node),
      color: hoverRelated ? color : nodeColorWithAlpha(color, "2e"),
      size,
      zIndex: isSelected || isHovered ? 4 : isPinned ? 3 : isSelectedNeighbor ? 2 : 1,
      forceLabel: this.isPriorityLabel(node),
      highlighted: isPinned,
    };
  }

  private reduceEdge(data: RuntimeGraphEdge) {
    const selectedActive =
      this.selected && (data.source === this.selected || data.target === this.selected);
    const hoverActive =
      this.hovered && (data.source === this.hovered || data.target === this.hovered);
    const color = relationTone(data.relationType);
    const active = this.hovered ? hoverActive : selectedActive;
    return {
      ...data,
      color: active ? color : nodeColorWithAlpha(color, this.hovered ? "20" : "78"),
      size: active ? 2.4 : this.hovered ? 0.55 : 0.8,
      zIndex: active ? 2 : 1,
    };
  }

  private setNudgeStatus(status: NudgeStatus): void {
    this.nudgeStatus = status;
    this.container.setAttribute("data-nudge-status", status);
  }

  private applyLabelLod(ratio: number): void {
    const lod = labelLodForRatio(ratio);
    if (Math.abs(lod.density - this.labelDensity) > 0.0001) {
      this.labelDensity = lod.density;
      this.renderer.setSetting("labelDensity", lod.density);
    }
    if (Math.abs(lod.renderedSizeThreshold - this.labelThreshold) > 0.01) {
      this.labelThreshold = lod.renderedSizeThreshold;
      this.renderer.setSetting("labelRenderedSizeThreshold", lod.renderedSizeThreshold);
    }
  }

  private nudgeEligible(): boolean {
    const snapshot = this.snapshot;
    return Boolean(
      snapshot?.motionEnabled &&
        !snapshot.reducedMotion &&
        isMotionEligible(snapshot.projection, snapshot.compact),
    );
  }

  private collisionBoxes() {
    const ratio = this.renderer.getCamera().getState().ratio;
    const unitsPerPixel = graphUnitsPerPixel((point) => this.renderer.viewportToGraph(point));
    const boxes = new Map<string, ReturnType<typeof collisionBoxForNode>>();
    this.displayGraph.forEachNode((id, data) => {
      const radiusPixels = this.renderer.scaleSize(this.nodeSize(id, data), ratio);
      const labelWidthPixels = this.isPriorityLabel(id)
        ? this.labelWidths.get(String(data.title ?? id))
        : undefined;
      boxes.set(id, collisionBoxForNode({ radiusPixels, unitsPerPixel, labelWidthPixels }));
    });
    return {
      boxes,
      maxDisplacement: NUDGE_SETTINGS.maxDisplacementPixels * unitsPerPixel,
    };
  }

  private finishNudgeGesture(): void {
    this.nudgeIdleTimer = undefined;
    this.motion?.finishViewportNudge();
  }

  private runNudgeFrame(): void {
    this.nudgeFrame = undefined;
    if (!this.nudgeEligible()) {
      this.nudgePending = false;
      this.setNudgeStatus("disabled");
      return;
    }

    const motion = this.motion;
    if (!motion) return;
    const request = this.collisionBoxes();
    const started = motion.updateViewportNudge({ ...request, selected: this.selected });
    if (!started) return;

    this.nudgePending = false;
    this.setNudgeStatus("active");
    if (this.nudgeIdleTimer !== undefined) clearTimeout(this.nudgeIdleTimer);
    this.nudgeIdleTimer = setTimeout(() => this.finishNudgeGesture(), NUDGE_SETTINGS.idleDelay);
  }

  private scheduleNudge(): void {
    if (this.nudgeFrame !== undefined) return;
    this.nudgeFrame = requestAnimationFrame(() => this.runNudgeFrame());
  }

  private stopNudge(disabled: boolean): void {
    if (this.nudgeFrame !== undefined) cancelAnimationFrame(this.nudgeFrame);
    if (this.nudgeIdleTimer !== undefined) clearTimeout(this.nudgeIdleTimer);
    this.nudgeFrame = undefined;
    this.nudgeIdleTimer = undefined;
    this.nudgePending = false;
    this.motion?.cancelViewportNudge();
    this.setNudgeStatus(disabled ? "disabled" : "idle");
  }

  private handleMotionStatus(status: LayoutStatus): void {
    this.emitStatus(status);
    if (status === "settled" && this.nudgeStatus === "active") this.setNudgeStatus("idle");
  }

  private readonly handleCameraUpdate = (state: { ratio: number }): void => {
    this.container.setAttribute("data-camera-ratio", state.ratio.toFixed(4));
    this.applyLabelLod(state.ratio);
    if (this.suppressCameraNudge) {
      this.lastCameraRatio = state.ratio;
      return;
    }
    if (Math.abs(state.ratio - this.lastCameraRatio) <= NUDGE_SETTINGS.zoomEpsilon) return;
    this.lastCameraRatio = state.ratio;
    if (!this.nudgeEligible()) {
      this.setNudgeStatus("disabled");
      return;
    }
    this.nudgePending = true;
    this.scheduleNudge();
  };

  private bindInteractions(): void {
    this.renderer.on("downNode", ({ node, event, preventSigmaDefault }) => {
      preventSigmaDefault();
      this.beginDrag(node, event);
    });
    this.renderer.on("clickNode", ({ node }) => {
      if (performance.now() >= this.suppressClickUntil) this.snapshot?.onSelect(node);
    });
    this.renderer.on("enterNode", ({ node }) => this.setHover(node));
    this.renderer.on("leaveNode", ({ node }) => {
      if (this.hovered === node) this.clearHover();
    });

    const mouse = this.renderer.getMouseCaptor();
    const touch = this.renderer.getTouchCaptor();
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

  private beginDrag(id: string, event: { x: number; y: number; original: Event }): void {
    if (!this.displayGraph.hasNode(id)) return;
    this.stopNudge(!this.nudgeEligible());
    const position = this.positions.getCurrent(id);
    this.drag = {
      id,
      moved: false,
      touch: "touches" in event.original,
      wasPinned: this.positions.isPinned(id),
      startX: event.x,
      startY: event.y,
    };
    this.renderer.getCamera().disable();
    this.motion?.beginDrag(id, position);
  }

  private moveDrag(point: { x: number; y: number; preventSigmaDefault(): void }): void {
    const drag = this.drag;
    if (!drag || !this.displayGraph.hasNode(drag.id)) return;
    point.preventSigmaDefault();
    if (Math.hypot(point.x - drag.startX, point.y - drag.startY) > 4) drag.moved = true;
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
    const keepPinned = !drag.touch && original instanceof MouseEvent && original.shiftKey;
    if (this.motion) this.motion.endDrag(drag.id, keepPinned);
    else {
      if (keepPinned) this.positions.pin(drag.id);
      else this.positions.release(drag.id);
      this.emitPinnedCount();
    }
    if (drag.moved) this.suppressClickUntil = performance.now() + 300;
    this.drag = undefined;
    this.renderer.getCamera().enable();
    this.renderer.refresh();
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
    this.hovered = node;
    this.hoverNeighbors = neighborsOf(this.displayGraph, node);
    this.writeHoverAttributes();
    this.renderer.refresh();
  }

  private clearHover(): void {
    this.hovered = undefined;
    this.hoverNeighbors.clear();
    this.container.removeAttribute("data-hovered-node");
    this.container.removeAttribute("data-hovered-neighbor-count");
    this.renderer.refresh();
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
    this.recomputePriorityNeighborLabels();
    this.renderer.setGraph(nextGraph);
  }

  private replaceDisplayGraph(projection: GraphProjection): void {
    this.stopMotion();
    this.cancelDrag();
    this.installDisplayGraph(projection);
  }

  private stopMotion(): void {
    this.stopNudge(true);
    if (this.motionFrame !== undefined) cancelAnimationFrame(this.motionFrame);
    this.motionFrame = undefined;
    this.motion?.kill();
    this.motion = undefined;
  }

  private startMotion(settled = false): void {
    const snapshot = this.snapshot;
    if (!snapshot) return;
    if (snapshot.projection.nodes.size <= 1) {
      this.setNudgeStatus("disabled");
      this.emitStatus("settled");
      return;
    }
    if (!isMotionEligible(snapshot.projection, snapshot.compact)) {
      this.setNudgeStatus("disabled");
      this.emitStatus("static");
      return;
    }
    if (!snapshot.motionEnabled) {
      this.setNudgeStatus("disabled");
      this.emitStatus("paused");
      return;
    }

    this.setNudgeStatus(snapshot.reducedMotion ? "disabled" : "idle");

    const motion = new GraphMotionController({
      graph: this.displayGraph,
      positions: this.positions,
      onStatus: (status) => this.handleMotionStatus(status),
      onPinnedChange: () => {
        this.emitPinnedCount();
        this.renderer.refresh();
      },
    });
    this.motion = motion;
    this.motionFrame = requestAnimationFrame(() => {
      this.motionFrame = undefined;
      void motion
        .start(settled)
        .then(() => {
          if (this.destroyed || this.motion !== motion || !this.nudgePending) return;
          this.scheduleNudge();
        })
        .catch((error: unknown) => {
          if (this.destroyed || this.motion !== motion) return;
          console.error("Rhizome motion could not start", error);
          this.setNudgeStatus("disabled");
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

  private animateCamera(target: { x: number; y: number; ratio: number; angle?: number }): void {
    const camera = this.renderer.getCamera();
    const token = ++this.cameraAnimationToken;
    this.suppressCameraNudge = true;
    const finish = () => {
      if (token !== this.cameraAnimationToken) return;
      this.lastCameraRatio = camera.getState().ratio;
      this.suppressCameraNudge = false;
    };
    if (this.snapshot?.reducedMotion) {
      camera.setState(target);
      finish();
    } else {
      void camera.animate(target, { duration: 280, easing: "quadraticInOut" }).finally(finish);
    }
  }

  private centerSelection(id: string): void {
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = requestAnimationFrame(() => {
      this.cameraFrame = undefined;
      const data = this.renderer.getNodeDisplayData(id);
      if (!data) return;
      const camera = this.renderer.getCamera();
      const target = { x: data.x, y: data.y, ratio: Math.min(camera.getState().ratio, 0.85) };
      this.animateCamera(target);
    });
  }

  sync(next: GraphViewportSnapshot): void {
    if (this.destroyed) return;
    const previous = this.snapshot;
    const projectionChanged = !previous || previous.projection !== next.projection;
    const selectionChanged = previous?.selected !== next.selected;
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

    if (projectionChanged) this.replaceDisplayGraph(next.projection);
    else if (selectionChanged) {
      this.selectedNeighbors =
        next.selected && this.displayGraph.hasNode(next.selected)
          ? neighborsOf(this.displayGraph, next.selected)
          : new Set<string>();
      this.recomputePriorityNeighborLabels();
    }

    if (this.renderer.getSetting("hideEdgesOnMove") === nextEligible) {
      this.renderer.setSetting("hideEdgesOnMove", !nextEligible);
    }

    if (projectionChanged || motionPolicyChanged) {
      if (!projectionChanged) this.stopMotion();
      this.startMotion(Boolean(projectionChanged && next.settleProjection));
    }

    if (!projectionChanged && selectionChanged) this.renderer.refresh();
    if (previous && selectionChanged && next.selected && this.displayGraph.hasNode(next.selected)) {
      this.centerSelection(next.selected);
    }
  }

  resetLayout(): void {
    const snapshot = this.snapshot;
    if (!snapshot || this.destroyed) return;
    this.stopMotion();
    this.cancelDrag();
    this.positions.reset();
    this.emitPinnedCount();
    this.installDisplayGraph(snapshot.projection);
    this.animateCamera({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    this.startMotion();
  }

  fitOverview(): void {
    if (this.destroyed) return;
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = requestAnimationFrame(() => {
      this.cameraFrame = undefined;
      this.renderer.resize(true);
      this.animateCamera({ x: 0.5, y: 0.5, ratio: 1, angle: 0 });
    });
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
    if (this.cameraFrame !== undefined) cancelAnimationFrame(this.cameraFrame);
    this.cameraFrame = undefined;
    this.cameraAnimationToken += 1;
    this.suppressCameraNudge = false;
    this.hovered = undefined;
    this.hoverNeighbors.clear();
    this.priorityNeighborLabels.clear();
    this.labelWidths.clear();
    this.container.removeAttribute("data-hovered-node");
    this.container.removeAttribute("data-hovered-neighbor-count");
    this.container.removeAttribute("data-nudge-status");
    this.container.removeAttribute("data-camera-ratio");
    this.renderer.kill();
  }
}
