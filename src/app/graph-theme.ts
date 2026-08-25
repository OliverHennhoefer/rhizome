export const NODE_TONE = "#b8bcc2";
export const EDGE_TONE = "#8c9197";
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

export function nodeTone(): string {
  return NODE_TONE;
}

export function relationTone(): string {
  return EDGE_TONE;
}
