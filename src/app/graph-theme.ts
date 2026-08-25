export const NODE_TONE = "#b8bcc2";
export const EDGE_TONE = "#8c9197";
export const BACK_TRACE_TONE = "#dc5555";
const GRAPH_STAGE_TONE = "#17181a";

function blendHexTone(from: string, to: string, amount: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(from) || !/^#[0-9a-f]{6}$/i.test(to)) return to;
  const weight = Math.max(0, Math.min(1, amount));
  const channel = (value: string, offset: number) =>
    Number.parseInt(value.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) =>
    Math.round(channel(from, offset) * (1 - weight) + channel(to, offset) * weight)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${mixed.join("")}`;
}

export function blendGraphTone(color: string, amount: number): string {
  return blendHexTone(GRAPH_STAGE_TONE, color, amount);
}

export function emphasizeNodeTone(color: string, amount: number): string {
  return blendHexTone(color, "#ffffff", amount);
}

export function backTraceNodeTone(visits: number): string {
  const count = Number.isFinite(visits) ? Math.max(0, Math.floor(visits)) : 0;
  if (count === 0) return NODE_TONE;
  const amount = 1 - 0.45 * 0.82 ** (count - 1);
  return blendHexTone(NODE_TONE, BACK_TRACE_TONE, amount);
}

export function nodeTone(): string {
  return NODE_TONE;
}

export function relationTone(): string {
  return EDGE_TONE;
}
