import type { NodeKind } from "../shared/contracts";

export const COMMUNITY_TONES = [
  "#71849b",
  "#748b7a",
  "#668c91",
  "#88758f",
  "#9a7464",
  "#9a855d",
  "#92737c",
  "#737d9d",
] as const;

const RELATION_TONES = ["#8a7a9b", "#5f8990", "#9a7567", "#7f8f68", "#8d7180"] as const;

export const LINK_TONE = "#73818d";
const GRAPH_STAGE_TONE = "#17181a";

export function blendGraphTone(color: string, amount: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const weight = Math.max(0, Math.min(1, amount));
  const channel = (value: string, offset: number) =>
    Number.parseInt(value.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) =>
    Math.round(channel(GRAPH_STAGE_TONE, offset) * (1 - weight) + channel(color, offset) * weight)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}

export function nodeTone(kind: NodeKind, community: number): string {
  if (kind === "missing") return "#a18463";
  if (kind === "external") return "#668892";
  return COMMUNITY_TONES[Math.abs(community) % COMMUNITY_TONES.length];
}

export function relationTone(relation: string): string {
  if (relation === "link") return LINK_TONE;
  let hash = 0;
  for (let index = 0; index < relation.length; index += 1) {
    hash = Math.imul(hash ^ relation.charCodeAt(index), 16777619);
  }
  return RELATION_TONES[Math.abs(hash) % RELATION_TONES.length];
}
