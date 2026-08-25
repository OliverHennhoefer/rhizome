import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_MOTION_SETTINGS,
  DESKTOP_UNRELATED_NODE_OPACITY,
  dragThreshold,
  effectiveGraphEmphasis,
  effectiveLabelRelevance,
  selectionViewportPoint,
  shouldLimitAdaptiveMotion,
  TOUCH_UNRELATED_NODE_OPACITY,
  unrelatedNodeOpacity,
} from "../src/app/graph-interaction";

describe("touch graph interaction policy", () => {
  it("keeps mouse precision while allowing ordinary finger movement", () => {
    expect(dragThreshold(false)).toBe(4);
    expect(dragThreshold(true)).toBe(10);
  });

  it("uses selection as persistent emphasis while allowing hover to take precedence", () => {
    const hover = { neighbors: new Set<string>() };
    const selected = { root: "a", neighbors: new Set(["b", "c"]) };
    expect(effectiveGraphEmphasis(hover, selected)).toEqual(selected);
    expect(effectiveGraphEmphasis({ root: "d", neighbors: new Set(["e"]) }, selected).root).toBe(
      "d",
    );
  });

  it("moderately fades unrelated nodes for touch and desktop interactions", () => {
    expect(unrelatedNodeOpacity(false, true)).toBe(TOUCH_UNRELATED_NODE_OPACITY);
    expect(unrelatedNodeOpacity(false, false)).toBe(DESKTOP_UNRELATED_NODE_OPACITY);
    expect(unrelatedNodeOpacity(true, true)).toBeCloseTo(0x22 / 0xff);
  });

  it("keeps every focused-projection label visible outside active hover", () => {
    expect(effectiveLabelRelevance(0, true, false)).toBe(1);
    expect(effectiveLabelRelevance(0, false, false)).toBe(0);
    expect(effectiveLabelRelevance(0, true, true)).toBe(0);
  });

  it("targets the uncovered mobile graph while preserving the desktop center", () => {
    expect(
      selectionViewportPoint({
        width: 390,
        height: 844,
        touchMode: false,
        readerOpen: true,
        readerCompact: true,
        mobileReaderHeight: 65,
      }),
    ).toEqual({ x: 195, y: 422 });
    expect(
      selectionViewportPoint({
        width: 390,
        height: 844,
        touchMode: true,
        readerOpen: true,
        readerCompact: true,
        mobileReaderHeight: 65,
      }),
    ).toEqual({ x: 195, y: 147.7 });
    expect(
      selectionViewportPoint({
        width: 390,
        height: 844,
        touchMode: true,
        readerOpen: true,
        readerCompact: true,
        mobileReaderHeight: 92,
      }),
    ).toBeUndefined();
  });
});

describe("adaptive motion frame budget", () => {
  it("ignores healthy frames and isolated stalls", () => {
    expect(shouldLimitAdaptiveMotion(Array(24).fill(16))).toBe(false);
    expect(shouldLimitAdaptiveMotion([...Array(23).fill(16), 120])).toBe(false);
  });

  it("limits sustained slow or stalled motion", () => {
    const slow = [
      ...Array(
        ADAPTIVE_MOTION_SETTINGS.windowFrames - ADAPTIVE_MOTION_SETTINGS.slowFramesToLimit,
      ).fill(16),
      ...Array(ADAPTIVE_MOTION_SETTINGS.slowFramesToLimit).fill(40),
    ];
    expect(shouldLimitAdaptiveMotion(slow)).toBe(true);
    expect(
      shouldLimitAdaptiveMotion(
        Array(ADAPTIVE_MOTION_SETTINGS.consecutiveStalledFramesToLimit).fill(90),
      ),
    ).toBe(true);
  });
});
