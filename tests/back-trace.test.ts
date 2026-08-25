import { describe, expect, it } from "vitest";
import { BACK_TRACE_TONE, backTraceNodeTone, NODE_TONE } from "../src/app/graph-theme";

function colorDistance(left: string, right: string): number {
  const channels = (color: string) =>
    [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const leftChannels = channels(left);
  const rightChannels = channels(right);
  return leftChannels.reduce(
    (total, channel, index) => total + Math.abs(channel - rightChannels[index]),
    0,
  );
}

describe("Back trace node tone", () => {
  it("keeps unvisited and invalid counts neutral", () => {
    expect(backTraceNodeTone(0)).toBe(NODE_TONE);
    expect(backTraceNodeTone(-1)).toBe(NODE_TONE);
    expect(backTraceNodeTone(Number.NaN)).toBe(NODE_TONE);
  });

  it("makes a clear first stain followed by diminishing cumulative increments", () => {
    const first = backTraceNodeTone(1);
    const second = backTraceNodeTone(2);
    const third = backTraceNodeTone(3);

    expect(first).toBe("#cc8386");
    expect(second).toBe("#cf7b7d");
    expect(third).toBe("#d17476");
    expect(colorDistance(NODE_TONE, first)).toBeGreaterThan(colorDistance(first, second));
    expect(colorDistance(first, BACK_TRACE_TONE)).toBeGreaterThan(
      colorDistance(second, BACK_TRACE_TONE),
    );
    expect(colorDistance(second, BACK_TRACE_TONE)).toBeGreaterThan(
      colorDistance(third, BACK_TRACE_TONE),
    );
  });

  it("approaches the target red without exceeding it", () => {
    expect(backTraceNodeTone(10)).toBe("#d95d5d");
    expect(backTraceNodeTone(100)).toBe(BACK_TRACE_TONE);
  });
});
