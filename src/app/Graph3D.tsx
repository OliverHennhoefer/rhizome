import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GraphProjection, RhizomeGraph } from "./graph";

interface Props {
  graph: RhizomeGraph;
  projection: GraphProjection;
  selected?: string;
  onSelect: (id: string) => void;
}

const palette = [0xd97757, 0x6e9f73, 0x4f8fba, 0xb887d4, 0xd6a74b, 0x58a6a6];

export default function Graph3D({ graph, projection, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [hovered, setHovered] = useState<string>();
  onSelectRef.current = onSelect;
  const label = useMemo(() => {
    const node = hovered ?? selected;
    return node && graph.hasNode(node) ? graph.getNodeAttribute(node, "title") : undefined;
  }, [graph, hovered, selected]);

  useEffect(() => {
    if (!container.current) return;
    const host = container.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x10130f);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 1000);
    camera.position.set(0, 4, 22);
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const nodeIds = [...projection.nodes];
    const extents = nodeIds.reduce(
      (value, id) => {
        const node = graph.getNodeAttributes(id);
        value.minX = Math.min(value.minX, node.x);
        value.maxX = Math.max(value.maxX, node.x);
        value.minY = Math.min(value.minY, node.y);
        value.maxY = Math.max(value.maxY, node.y);
        value.minZ = Math.min(value.minZ, node.z);
        value.maxZ = Math.max(value.maxZ, node.z);
        return value;
      },
      {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity,
      },
    );
    const span = Math.max(
      extents.maxX - extents.minX,
      extents.maxY - extents.minY,
      extents.maxZ - extents.minZ,
      1,
    );
    const scale = 15 / span;
    const center = new THREE.Vector3(
      (extents.minX + extents.maxX) / 2,
      (extents.minY + extents.maxY) / 2,
      (extents.minZ + extents.maxZ) / 2,
    );
    const coordinates = new Map<string, THREE.Vector3>();
    const positions = new Float32Array(nodeIds.length * 3);
    const colors = new Float32Array(nodeIds.length * 3);
    nodeIds.forEach((id, index) => {
      const node = graph.getNodeAttributes(id);
      const point = new THREE.Vector3(node.x, node.y, node.z).sub(center).multiplyScalar(scale);
      coordinates.set(id, point);
      positions.set([point.x, point.y, point.z], index * 3);
      const color = new THREE.Color(
        id === selected ? 0xf4d35e : palette[Math.abs(node.community) % palette.length],
      );
      colors.set([color.r, color.g, color.b], index * 3);
    });
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      pointsGeometry,
      new THREE.PointsMaterial({ size: 0.18, vertexColors: true, sizeAttenuation: true }),
    );
    scene.add(points);

    const linePositions: number[] = [];
    for (const edgeId of projection.edges) {
      const source = coordinates.get(graph.source(edgeId));
      const target = coordinates.get(graph.target(edgeId));
      if (source && target)
        linePositions.push(source.x, source.y, source.z, target.x, target.y, target.z);
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(linePositions, 3));
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({ color: 0x667166, transparent: true, opacity: 0.42 }),
    );
    scene.add(lines);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.28 };
    const pointer = new THREE.Vector2();
    const hit = (event: PointerEvent): string | undefined => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const point = raycaster.intersectObject(points)[0];
      return point?.index === undefined ? undefined : nodeIds[point.index];
    };
    const pointerMove = (event: PointerEvent) => {
      const node = hit(event);
      renderer.domElement.style.cursor = node ? "pointer" : "grab";
      setHovered(node);
    };
    const pointerDown = (event: PointerEvent) => {
      const node = hit(event);
      if (node) onSelectRef.current(node);
    };
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerdown", pointerDown);

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      controls.dispose();
      pointsGeometry.dispose();
      lineGeometry.dispose();
      (points.material as THREE.Material).dispose();
      (lines.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [graph, projection, selected]);

  return (
    <div className="graph-canvas graph-3d" data-testid="graph-3d" ref={container}>
      {label && <div className="graph-label">{label}</div>}
    </div>
  );
}
