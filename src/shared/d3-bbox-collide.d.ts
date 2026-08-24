declare module "d3-bboxCollide" {
  import type { Force, SimulationNodeDatum } from "d3-force";

  export type BoundingBox = [[number, number], [number, number]];
  export type BoundingBoxAccessor<NodeDatum extends SimulationNodeDatum> = (
    node: NodeDatum,
    index: number,
    nodes: NodeDatum[],
  ) => BoundingBox;

  export interface BoundingBoxForce<NodeDatum extends SimulationNodeDatum>
    extends Force<NodeDatum, undefined> {
    bbox(): BoundingBoxAccessor<NodeDatum>;
    bbox(accessor: BoundingBox | BoundingBoxAccessor<NodeDatum>): this;
    iterations(): number;
    iterations(value: number): this;
    strength(): number;
    strength(value: number): this;
  }

  export function bboxCollide<NodeDatum extends SimulationNodeDatum>(
    accessor: BoundingBox | BoundingBoxAccessor<NodeDatum>,
  ): BoundingBoxForce<NodeDatum>;
}
