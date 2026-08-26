import { expect, type Locator, type Page, test } from "@playwright/test";

async function searchNotes(page: Page, query: string): Promise<void> {
  const filters = page.getByRole("button", { name: "Filters" });
  if ((await filters.getAttribute("aria-expanded")) !== "true") await filters.click();
  await page.getByLabel("Search notes").fill(query);
}

async function searchNotesWithTouch(page: Page, query: string): Promise<void> {
  const filters = page.getByRole("button", { name: "Filters" });
  if ((await filters.getAttribute("aria-expanded")) !== "true") await filters.tap();
  await page.getByLabel("Search notes").fill(query);
}

async function dragTouch(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...from, radiusX: 6, radiusY: 6 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ ...to, radiusX: 6, radiusY: 6 }],
  });
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await session.detach();
}

async function findEmptyGraphPoint(page: Page, graph: Locator): Promise<{ x: number; y: number }> {
  const bounds = await graph.boundingBox();
  if (!bounds) throw new Error("Graph viewport is not visible.");
  const candidates = [
    [0.08, 0.12],
    [0.08, 0.5],
    [0.5, 0.08],
    [0.92, 0.5],
    [0.5, 0.92],
  ];
  for (const [relativeX, relativeY] of candidates) {
    const point = {
      x: bounds.x + bounds.width * relativeX,
      y: bounds.y + bounds.height * relativeY,
    };
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(80);
    if ((await graph.getAttribute("data-hovered-node")) === null) return point;
  }
  throw new Error("Could not find an empty point in the graph viewport.");
}

async function selectedNodePoint(graph: Locator): Promise<{ x: number; y: number }> {
  await expect(graph).toHaveAttribute("data-selected-viewport-x", /.+/);
  await expect(graph).toHaveAttribute("data-selected-viewport-y", /.+/);
  const bounds = await graph.boundingBox();
  if (!bounds) throw new Error("Graph viewport is not visible.");
  return {
    x: bounds.x + Number(await graph.getAttribute("data-selected-viewport-x")),
    y: bounds.y + Number(await graph.getAttribute("data-selected-viewport-y")),
  };
}

test("selects notes, restores query state, and loads details lazily", async ({ page }) => {
  let detailsRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/data/details/")) detailsRequests += 1;
  });
  await page.goto(
    "?note=Foundations%2FLinear%20algebra%2FMatrix%20multiplication&focus=1&direction=in&depth=2",
  );
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Matrix multiplication" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/focus=1/);
  await expect(page).toHaveURL(/direction=in/);
  const readerFocus = page.getByTestId("reader").getByRole("region", { name: "Graph focus" });
  await expect(readerFocus).toBeVisible();
  await expect(readerFocus.getByRole("button", { name: "What depends on this?" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(detailsRequests).toBeLessThanOrEqual(2);
  await searchNotes(page, "scaled dot");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /Scaled dot-product attention/ })
    .click();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Scaled dot-product attention" }),
  ).toBeVisible();
  await expect(page.getByTestId("reader").locator(".katex-display")).toBeVisible();
  await expect(page.getByTestId("reader").locator("math").first()).toBeAttached();
  await page.evaluate(async () => {
    const browserDocument = (
      globalThis as unknown as { document: { fonts: { ready: Promise<unknown> } } }
    ).document;
    await browserDocument.fonts.ready;
  });
  expect(
    await page.evaluate(() => {
      const browserDocument = (
        globalThis as unknown as { document: { fonts: { check(value: string): boolean } } }
      ).document;
      return browserDocument.fonts.check("16px KaTeX_Main");
    }),
  ).toBe(true);
});

test("renders the analytical graph without a renderer switch", async ({ page }) => {
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toBeVisible();
  await expect(graph).toHaveAttribute("data-camera-ratio", "1.0800");
  await expect(page.getByTestId("reader")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show reader" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Focus" })).toHaveCount(0);
  await expect(page.getByText(/Graph (settled|relaxing)/)).toHaveCount(0);
  await expect(page.getByText(/Drag nodes/)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Graph view" })).toHaveCount(0);
});

test("opens a random visible note from filters", async ({ page }) => {
  await page.goto("");
  await page.getByRole("button", { name: "Filters" }).click();

  const randomNote = page.getByRole("button", { name: "Open a random visible note" });
  await expect(randomNote).toBeVisible();
  await expect(randomNote).toContainText("I’m feeling lucky");
  await randomNote.click();

  await expect(page.getByRole("dialog", { name: "Graph filters" })).toHaveCount(0);
  await expect(page.getByTestId("reader")).toBeVisible();
  await expect(page).toHaveURL(/note=/);
});

test("records and resets the session-only reading path across reader navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");

  await page.getByRole("button", { name: "Filters" }).click();
  let backTrace = page.getByRole("region", { name: "Reading path" });
  const reset = backTrace.getByRole("button", { name: "Reset" });
  const activate = backTrace.getByRole("button", { name: "Activate" });
  await expect(activate).toHaveAttribute("aria-pressed", "false");
  await expect(reset).toBeDisabled();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "0");
  await activate.click();
  await expect(backTrace.getByRole("button", { name: "Deactivate" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.getByLabel("Search notes").fill("AdamW");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /AdamW/ })
    .click();
  await expect(page.getByTestId("reader").getByRole("heading", { name: "AdamW" })).toBeVisible();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "1");
  await expect(graph).toHaveAttribute("data-back-trace-selected-visits", "1");

  await searchNotes(page, "AdamW");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /AdamW/ })
    .click();
  await expect(graph).toHaveAttribute("data-back-trace-selected-visits", "1");

  const relationships = page.getByTestId("reader").locator(".relationships");
  const source = relationships
    .locator(".relationship")
    .filter({ hasText: "Decoupled Weight Decay Regularization" });
  await expect(source.locator(".relationship-type")).toHaveText("Interrelated with");
  await expect(source).toBeVisible({ timeout: 15_000 });
  await source.locator(".relationship-main > button").click();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "2");
  await expect(graph).toHaveAttribute("data-back-trace-selected-visits", "1");

  await searchNotes(page, "AdamW");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /AdamW/ })
    .click();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "2");
  await expect(graph).toHaveAttribute("data-back-trace-selected-visits", "2");

  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.getByRole("dialog", { name: "Graph filters" });
  await filters.getByText("Types", { exact: true }).click();
  await filters.getByLabel("component", { exact: true }).check();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "2");
  await filters.getByLabel("component", { exact: true }).uncheck();

  backTrace = page.getByRole("region", { name: "Reading path" });
  await backTrace.getByRole("button", { name: "Deactivate" }).click();
  await expect(backTrace.getByRole("button", { name: "Activate" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByLabel("Search notes").fill("RMS normalization");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /RMS normalization/ })
    .click();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "2");
  await expect(graph).toHaveAttribute("data-back-trace-selected-visits", "0");

  await page.getByRole("button", { name: "Filters" }).click();
  backTrace = page.getByRole("region", { name: "Reading path" });
  await backTrace.getByRole("button", { name: "Reset" }).click();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "0");
  await expect(backTrace.getByRole("button", { name: "Reset" })).toBeDisabled();
  await expect(backTrace.getByRole("button", { name: "Activate" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await backTrace.getByRole("button", { name: "Activate" }).click();
  await expect(graph).toHaveAttribute("data-back-trace-selected-visits", "0");
  await page.getByLabel("Search notes").fill("AdamW");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /AdamW/ })
    .click();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "1");

  await page.reload();
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "0");
  await page.getByRole("button", { name: "Filters" }).click();
  backTrace = page.getByRole("region", { name: "Reading path" });
  await expect(backTrace.getByRole("button", { name: "Activate" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(backTrace.getByRole("button", { name: "Reset" })).toBeDisabled();
});

test("shows every label uniformly, fades them with distance, then hides them", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-label-visibility", "all");
  await expect(graph).toHaveAttribute("data-label-opacity", "0.927");
  await expect(graph).toHaveAttribute("data-label-size", "11.547");

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  for (let step = 0; step < 3; step += 1) {
    await page.mouse.wheel(0, 1_000);
    await page.waitForTimeout(120);
  }
  await expect(graph).toHaveAttribute("data-camera-ratio", "4.0000");
  await expect(graph).toHaveAttribute("data-label-visibility", "none");
  await expect(graph).toHaveAttribute("data-label-opacity", "0.000");

  for (let step = 0; step < 4; step += 1) {
    await page.mouse.wheel(0, -1_000);
    await page.waitForTimeout(120);
  }
  await expect(graph).toHaveAttribute("data-label-visibility", "all");
  await expect(graph).toHaveAttribute("data-label-opacity", "1.000");
  await expect(graph).toHaveAttribute("data-label-size", "13.000");
});

test("clears selection on a stage click while preserving double-click zoom", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await searchNotes(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await expect(page.getByTestId("reader")).toBeVisible();
  await page.waitForTimeout(350);

  const graphBounds = await graph.boundingBox();
  expect(graphBounds).not.toBeNull();
  const singleClickPoint = await findEmptyGraphPoint(page, graph);
  await page.mouse.click(singleClickPoint.x, singleClickPoint.y);
  await expect(page.getByTestId("reader")).toHaveCount(0);
  await expect(page).not.toHaveURL(/note=/);
  await expect(graph).not.toHaveAttribute("data-emphasis-source", /.+/);
  expect(await graph.boundingBox()).toEqual(graphBounds);

  await searchNotes(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await page.waitForTimeout(350);
  const ratioBefore = Number(await graph.getAttribute("data-camera-ratio"));
  const doubleClickPoint = await findEmptyGraphPoint(page, graph);
  await page.mouse.dblclick(doubleClickPoint.x, doubleClickPoint.y, { delay: 80 });
  await expect
    .poll(async () => Number(await graph.getAttribute("data-camera-ratio")))
    .toBeLessThan(ratioBefore);
  await page.waitForTimeout(300);
  expect(new URL(page.url()).searchParams.get("note")).toBe("Language/Subword tokenization");
  await expect(page.getByTestId("reader")).toBeVisible();
});

test("keeps graph normalization stable during an extreme node drag", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  test.setTimeout(60_000);
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await searchNotes(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const { x, y } = await selectedNodePoint(graph);
  const normalizationBounds = await graph.getAttribute("data-normalization-bounds");
  expect(normalizationBounds).not.toBeNull();

  await page.mouse.move(x, y);
  await expect(graph).toHaveAttribute("data-hovered-node", "Language/Subword tokenization");
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width + 240, y, { steps: 8 });
  await page.mouse.up();

  await expect(graph).toHaveAttribute("data-normalization-bounds", normalizationBounds ?? "");
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
});

test("clears hover state when a focused projection removes the hovered node", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await searchNotes(page, "subword tokenization");
  await expect(graph).toHaveAttribute("data-search-match-count", "1");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const selectedPoint = await selectedNodePoint(graph);
  await page.mouse.move(selectedPoint.x, selectedPoint.y);
  await expect(graph).toHaveAttribute("data-hovered-node", "Language/Subword tokenization");

  await page
    .getByTestId("reader")
    .getByRole("button", { name: "What depends on this?" })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await expect(graph).toHaveAttribute("data-hovered-node", "Language/Subword tokenization");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "1");

  await searchNotes(page, "adamw");
  await page
    .getByRole("button", { name: /AdamW/ })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await expect(page.getByTestId("reader").getByRole("heading", { name: "AdamW" })).toBeVisible();
  await expect(graph).not.toHaveAttribute("data-hovered-node", /.+/);
  await expect(graph).not.toHaveAttribute("data-hovered-neighbor-count", /.+/);
});

test("omits relation filtering from graph filters", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?relation=link");
  await expect(page).not.toHaveURL(/relation=/);
  await page.getByRole("button", { name: "Filters" }).click();
  const filters = page.getByRole("dialog", { name: "Graph filters" });
  await expect(filters.getByText("Types", { exact: true })).toBeVisible();
  await expect(filters.getByText("Tags", { exact: true })).toBeVisible();
  await expect(filters.getByText("Relations", { exact: true })).toHaveCount(0);
  await filters.getByText("Types", { exact: true }).click();
  await expect(filters.locator("label").filter({ hasText: "component(12)" })).toHaveCount(1);
  await filters.getByText("Tags", { exact: true }).click();
  await expect(filters.locator("label").filter({ hasText: "attention(13)" })).toHaveCount(1);
});

test("keeps the reader note while filters clear an excluded graph selection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Learning%2FAdamW");
  const graph = page.getByTestId("graph-2d");
  const reader = page.getByTestId("reader");
  await expect(reader.getByRole("heading", { name: "AdamW" })).toBeVisible();
  await expect(graph).toHaveAttribute("data-emphasis-source", "selection");

  const filterButton = page.getByRole("button", { name: "Filters", exact: true });
  await filterButton.click();
  const filters = page.getByRole("dialog", { name: "Graph filters" });
  await filters.getByText("Types", { exact: true }).click();
  await filters.getByLabel("foundation", { exact: true }).check();

  await expect(reader.getByRole("heading", { name: "AdamW" })).toBeVisible();
  await expect(page).toHaveURL(/note=Learning%2FAdamW/);
  await expect(graph).not.toHaveAttribute("data-emphasis-source", /.+/);
  await expect(graph).not.toHaveAttribute("data-emphasized-node", /.+/);
  await expect(graph).not.toHaveAttribute("data-selected-viewport-x", /.+/);

  await filters.getByLabel("foundation", { exact: true }).uncheck();
  await expect(graph).not.toHaveAttribute("data-emphasis-source", /.+/);
  await expect(reader.getByRole("heading", { name: "AdamW" })).toBeVisible();

  await filterButton.click();
  const emptyPoint = await findEmptyGraphPoint(page, graph);
  await page.mouse.click(emptyPoint.x, emptyPoint.y);
  await expect(reader).toHaveCount(0);
  await expect(page).not.toHaveURL(/note=/);
});

test("selection-only navigation does not reheat the settled graph", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });

  await searchNotes(page, "matrix multiplication");
  await expect(graph).toHaveAttribute("data-search-match-count", "1");
  await page
    .getByRole("region", { name: "Search results" })
    .getByRole("button", { name: /Matrix multiplication/ })
    .click();
  await expect(graph).toHaveAttribute("data-emphasis-source", "selection");
  await expect(graph).toHaveAttribute(
    "data-emphasized-node",
    "Foundations/Linear algebra/Matrix multiplication",
  );
  const statuses: Array<string | null> = [];
  for (let sample = 0; sample < 10; sample += 1) {
    statuses.push(await graph.getAttribute("data-layout-status"));
    await page.waitForTimeout(50);
  }
  expect(statuses).not.toContain("loading");
  expect(statuses).not.toContain("running");
  await expect(graph).toHaveAttribute("data-layout-status", "settled");

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const { x, y } = await selectedNodePoint(graph);
  await page.mouse.move(x, y);
  await expect(graph).toHaveAttribute(
    "data-hovered-node",
    "Foundations/Linear algebra/Matrix multiplication",
  );
  await expect(graph).toHaveAttribute("data-emphasis-source", "hover");
  await page.mouse.down();
  await page.mouse.move(x + 2, y + 2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(graph).toHaveAttribute("data-layout-status", "settled");
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
  await findEmptyGraphPoint(page, graph);
  await expect(graph).not.toHaveAttribute("data-hovered-node", /.+/);
  await expect(graph).toHaveAttribute("data-emphasis-source", "selection");
});

test("uses a gradual built-in layout without exposing physics controls", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  test.setTimeout(60_000);
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "running", { timeout: 5_000 });
  await expect(page.getByRole("button", { name: "Layout" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Graph layout" })).toHaveCount(0);
  await page.waitForTimeout(1_500);
  await expect(graph).toHaveAttribute("data-layout-status", "running");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
});

test("keeps settled node positions stable while zooming and panning", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.75);
  await page.mouse.wheel(0, 700);
  await expect(graph).toHaveAttribute("data-layout-status", "settled");

  await page.mouse.move(bounds.x + 24, bounds.y + 24);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 64, bounds.y + 44, { steps: 4 });
  await page.mouse.up();
  await expect(graph).toHaveAttribute("data-layout-status", "settled");
});

test("does not load D3 under reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const d3Requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("d3-force")) d3Requests.push(request.url());
  });

  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "paused");
  await page.waitForTimeout(250);
  expect(d3Requests).toEqual([]);
  await expect(page.getByRole("button", { name: "Layout" })).toHaveCount(0);
});

test("shift-drag pins, overview resets, and normal drag releases a node", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  test.setTimeout(75_000);
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await searchNotes(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  let { x, y } = await selectedNodePoint(graph);

  await page.keyboard.down("Shift");
  await findEmptyGraphPoint(page, graph);
  await page.mouse.move(x, y);
  await expect(graph).toHaveAttribute("data-hovered-node", "Language/Subword tokenization");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "3");
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 20, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(graph).toHaveAttribute("data-pinned-count", "1");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });

  await searchNotes(page, "adamw");
  await page.getByRole("button", { name: /AdamW/ }).click();
  await expect(page.getByTestId("reader").getByRole("heading", { name: "AdamW" })).toBeVisible();
  await searchNotes(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Subword tokenization" }),
  ).toBeVisible();
  await page.waitForTimeout(350);
  ({ x, y } = await selectedNodePoint(graph));
  await findEmptyGraphPoint(page, graph);
  await page.mouse.move(x, y);
  await expect(graph).toHaveAttribute("data-hovered-node", "Language/Subword tokenization");
  await page.mouse.down();
  await page.mouse.up();
  await expect(graph).toHaveAttribute("data-pinned-count", "1");
  await expect(graph).toHaveAttribute("data-layout-status", "settled");

  await page.mouse.down();
  await page.mouse.move(x + 35, y + 15, { steps: 4 });
  await page.mouse.up();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");

  await page.goto("");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await searchNotes(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).click();
  await page.waitForTimeout(350);
  const resetBounds = await graph.boundingBox();
  expect(resetBounds).not.toBeNull();
  if (!resetBounds) return;
  const { x: resetX, y: resetY } = await selectedNodePoint(graph);
  await page.keyboard.down("Shift");
  await page.mouse.move(resetX, resetY);
  await expect(graph).toHaveAttribute("data-hovered-node", "Language/Subword tokenization");
  await page.mouse.down();
  await page.mouse.move(resetX + 60, resetY + 20, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(graph).toHaveAttribute("data-pinned-count", "1");

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
  await expect(graph).toHaveAttribute("data-camera-ratio", "1.0800", { timeout: 2_000 });
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
});

test("keeps oversized projections static without status chrome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  const nodes = Array.from({ length: 601 }, (_, index) => ({
    id: `note-${index}`,
    kind: "note",
    title: `Note ${index}`,
    aliases: [],
    types: ["note"],
    tags: [],
    detailsRef: `note-${index}`,
    x: index % 30,
    y: Math.floor(index / 30),
    community: index % 5,
    degree: 0,
  }));
  await page.route("**/data/graph.json", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 2,
        contentHash: "oversized",
        config: { site: { title: "Large Rhizome" }, relations: {} },
        nodes,
        edges: [],
        facets: { tags: {}, types: { note: nodes.map((node) => node.id) }, relations: {} },
        diagnostics: [],
      }),
    });
  });

  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "static");
  await expect(page.getByText("Focus or filter to enable motion")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Layout" })).toHaveCount(0);
});

test("toggles directional focus and returns to a fitted overview", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  test.setTimeout(60_000);
  await page.goto("?note=Foundations%2FArithmetic%2FMultiplication");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });

  const readerFocus = page.getByTestId("reader").getByRole("region", { name: "Graph focus" });
  const inbound = readerFocus.getByRole("button", { name: "What depends on this?" });
  await inbound.click();
  await expect(page).toHaveURL(/focus=1/);
  await expect(page).toHaveURL(/direction=in/);
  await expect(page.getByRole("region", { name: "Active graph focus" })).toBeVisible();
  await inbound.click();
  await expect(page).not.toHaveURL(/focus=1/);
  await expect(page).not.toHaveURL(/direction=in/);
  await inbound.click();
  await page.getByRole("button", { name: "Close reader" }).click();
  await page.getByRole("button", { name: "Exit focus" }).click();
  await expect(page).not.toHaveURL(/focus=1/);
  await expect(page.getByRole("region", { name: "Active graph focus" })).toHaveCount(0);
  await page.getByRole("button", { name: "Show reader" }).click();
  await inbound.click();

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const overviewRatio = await graph.getAttribute("data-camera-ratio");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => graph.getAttribute("data-camera-ratio")).not.toBe(overviewRatio);

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page).not.toHaveURL(/focus=1/);
  await expect(page).not.toHaveURL(/direction=in/);
  await expect(graph).toHaveAttribute("data-camera-ratio", "1.0800", { timeout: 2_000 });
  await expect(graph).toHaveAttribute("data-layout-status", "running");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await expect(page.getByTestId("reader")).toBeVisible();
  await expect
    .poll(async () => Math.abs(Number(await graph.getAttribute("data-overview-viewport-x")) - 510))
    .toBeLessThan(2);
  await expect
    .poll(async () => Math.abs(Number(await graph.getAttribute("data-overview-viewport-y")) - 450))
    .toBeLessThan(2);
});

test("hides, restores, and resizes the reader independently from selection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Learning%2FAdamW");
  const graph = page.getByTestId("graph-2d");
  const reader = page.getByTestId("reader");
  const readerPane = page.locator("#reader-pane");
  const controls = page.locator(".graph-controls");
  const separator = page.getByRole("separator", { name: "Resize reader" });
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await expect(reader).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "420");
  const cameraRatio = await graph.getAttribute("data-camera-ratio");
  const graphBounds = await graph.boundingBox();
  expect(graphBounds).not.toBeNull();
  const expectSelectedAtVisibleCenter = async (readerPixels: number) => {
    if (!graphBounds) return;
    const expectedX = (graphBounds.width - readerPixels) / 2;
    await expect
      .poll(async () =>
        Math.abs(Number(await graph.getAttribute("data-selected-viewport-x")) - expectedX),
      )
      .toBeLessThan(2);
  };
  await expectSelectedAtVisibleCenter(420);
  await expect
    .poll(async () => {
      const [controlBounds, readerBounds] = await Promise.all([
        controls.boundingBox(),
        readerPane.boundingBox(),
      ]);
      return Boolean(
        controlBounds && readerBounds && controlBounds.x + controlBounds.width < readerBounds.x,
      );
    })
    .toBe(true);
  await page.getByRole("button", { name: "Filters", exact: true }).click();
  await expect(page.getByLabel("Search notes")).toBeVisible();
  await page.getByRole("button", { name: "Filters", exact: true }).click();

  const handle = await separator.boundingBox();
  expect(handle).not.toBeNull();
  if (!handle) return;
  const startX = handle.x + handle.width / 2;
  await page.mouse.move(startX, handle.y + 80);
  await page.mouse.down();
  await page.mouse.move(startX - 80, handle.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(separator).toHaveAttribute("aria-valuenow", "500");
  await expectSelectedAtVisibleCenter(500);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("rhizome:reader-width")))
    .toBe("500");
  await expect(graph).toHaveAttribute("data-camera-ratio", cameraRatio ?? "1.0000");
  await expect(graph).toHaveAttribute("data-layout-status", "settled");
  expect(await graph.boundingBox()).toEqual(graphBounds);
  await expect
    .poll(async () => {
      const [controlBounds, readerBounds] = await Promise.all([
        controls.boundingBox(),
        readerPane.boundingBox(),
      ]);
      return Boolean(
        controlBounds && readerBounds && controlBounds.x + controlBounds.width < readerBounds.x,
      );
    })
    .toBe(true);

  await separator.focus();
  await page.keyboard.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", "320");
  await expectSelectedAtVisibleCenter(320);
  await separator.dblclick();
  await expect(separator).toHaveAttribute("aria-valuenow", "420");
  await expectSelectedAtVisibleCenter(420);

  await page.getByRole("button", { name: "Close reader" }).click();
  await expect(reader).toHaveCount(0);
  await expect(page).toHaveURL(/note=Learning%2FAdamW/);
  await expect(page.getByRole("button", { name: "Show reader" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show reader" })).toBeFocused();
  await expectSelectedAtVisibleCenter(0);
  expect(await graph.boundingBox()).toEqual(graphBounds);
  await page.getByRole("button", { name: "Show reader" }).click();
  await expect(page.getByTestId("reader")).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "420");
  await expectSelectedAtVisibleCenter(420);
});

test("formats relationships with perspective-aware labels and collapsed local evidence", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Learning%2FAdamW");
  const relationships = page.getByTestId("reader").locator(".relationships");
  await expect(relationships.getByRole("heading", { name: "Relationships" })).toBeVisible({
    timeout: 15_000,
  });

  const source = relationships
    .locator(".relationship")
    .filter({ hasText: "Decoupled Weight Decay Regularization" });
  await expect(source).toContainText("Interrelated with");
  await expect(source).toContainText("Sources/Decoupled Weight Decay Regularization.md");
  await expect(source.getByText("external", { exact: true })).toHaveCount(0);
  await expect(source.getByRole("link", { name: /new tab/ })).toHaveCount(0);
  await expect(source.locator(".relationship-type")).toHaveText("Interrelated with");
  const evidence = source.getByRole("button", { name: "2 sources" });
  await expect(evidence).toHaveAttribute("aria-expanded", "false");
  await evidence.click();
  await expect(source.getByText("Property:")).toContainText("supported-by");
  await expect(source.getByText("Learning/AdamW.md:11")).toBeVisible();
  await expect(
    source.getByText("Sources/Decoupled Weight Decay Regularization.md:24"),
  ).toBeVisible();
  await source.locator(".relationship-main > button").click();
  await expect(page).toHaveURL(
    (url) => url.searchParams.get("note") === "Sources/Decoupled Weight Decay Regularization",
  );
});

test("uses natural labels for outgoing and incoming relationships", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Learning%2FOptimizers");
  const relationships = page.getByTestId("reader").locator(".relationships");
  await expect(relationships.getByRole("heading", { name: "Relationships" })).toBeVisible({
    timeout: 15_000,
  });

  const dependency = relationships.locator(".relationship").filter({ hasText: "Gradient descent" });
  await expect(dependency.locator(".relationship-type")).toHaveText("Depends on");
  const dependent = relationships.locator(".relationship").filter({ hasText: "AdamW" });
  await expect(dependent.locator(".relationship-type")).toHaveText("Dependency of");
  const link = relationships.locator(".relationship").filter({ hasText: "Inference" });
  await expect(link.locator(".relationship-type")).toHaveText("Links to");
});

test("combines multiple relationship kinds for the same note into one row", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Foundations%2FArithmetic%2FExponentials");
  const relationships = page.getByTestId("reader").locator(".relationships");
  await expect(relationships.getByRole("heading", { name: "Relationships" })).toBeVisible({
    timeout: 15_000,
  });

  const softmax = relationships.locator(".relationship").filter({ hasText: "Softmax and logits" });
  await expect(softmax).toHaveCount(1);
  await expect(softmax.locator(".relationship-type")).toHaveText("Interrelated with");
  await expect(softmax.getByRole("button", { name: "2 sources" })).toBeVisible();
});

test("closes graph popovers with Escape and restores trigger focus", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const filters = page.getByRole("button", { name: "Filters" });
  await filters.click();
  await expect(page.getByRole("dialog", { name: "Graph filters" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Graph filters" })).toHaveCount(0);
  await expect(filters).toBeFocused();
});

test("matches the graph-first desktop chrome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toBeVisible();
  await expect(page.getByRole("button", { name: "Overview" })).toBeVisible();
  await page.addStyleTag({
    content: ".graph-canvas canvas { visibility: hidden !important; }",
  });
  await expect(page).toHaveScreenshot("graph-overview.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });

  await page.goto("?note=Learning%2FAdamW");
  await expect(page.getByTestId("reader")).toBeVisible();
  await page.addStyleTag({
    content: ".graph-canvas canvas { visibility: hidden !important; }",
  });
  await expect(page).toHaveScreenshot("graph-reader.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });
});

test("retains DOM navigation when WebGL is unavailable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.addInitScript(
    'Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { value: () => null })',
  );
  await page.goto("");
  await expect(page.getByText("Graph rendering unavailable")).toBeVisible();
  await page.getByLabel("Search notes").fill("scaled dot");
  await page.getByRole("button", { name: /Scaled dot-product attention/ }).click();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Scaled dot-product attention" }),
  ).toBeVisible();
});

test("mobile retains search and reader navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  await page.goto("?note=Learning%2FAdamW");
  await page.getByRole("button", { name: "Filters" }).click();
  await expect(page.getByLabel("Search notes")).toBeVisible();
  await expect(page.getByTestId("reader").getByRole("heading", { name: "AdamW" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Relationships" })).toBeVisible();
  const separator = page.getByRole("separator", { name: "Resize reader" });
  await expect(separator).toHaveAttribute("aria-orientation", "horizontal");
  await expect(separator).toHaveAttribute("aria-valuenow", "65");
  await separator.focus();
  await page.keyboard.press("End");
  await expect(separator).toHaveAttribute("aria-valuenow", "92");
  await page.locator("#reader-pane").evaluate(async (pane) => {
    await Promise.all(
      pane.getAnimations().map((animation: { finished: Promise<unknown> }) => animation.finished),
    );
  });
  const handle = await separator.boundingBox();
  expect(handle).not.toBeNull();
  if (!handle) return;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await expect(page.locator("body")).toHaveClass(/is-resizing-reader/);
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 230, { steps: 5 });
  await page.mouse.up();
  await expect(separator).toHaveAttribute("aria-valuenow", "65");

  const graph = page.getByTestId("graph-2d");
  await page.getByRole("button", { name: "Overview" }).click();
  await expect(graph).toHaveAttribute("data-camera-ratio", "1.0800", { timeout: 2_000 });
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await expect
    .poll(async () => Math.abs(Number(await graph.getAttribute("data-overview-viewport-x")) - 195))
    .toBeLessThan(2);
  await expect
    .poll(async () =>
      Math.abs(Number(await graph.getAttribute("data-overview-viewport-y")) - 147.7),
    )
    .toBeLessThan(2);
});

test("mobile touch opens, emphasizes, drags, and pins nodes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  test.setTimeout(75_000);
  await page.goto("?note=Language%2FSubword%20tokenization");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 30_000 });
  await expect(graph).toHaveAttribute("data-emphasis-source", "selection");
  await expect(graph).toHaveAttribute("data-emphasized-node", "Language/Subword tokenization");
  await expect
    .poll(async () => Number(await graph.getAttribute("data-selected-viewport-y")))
    .toBeLessThan(844 * 0.35);

  const pin = page.getByRole("button", { name: "Pin node" });
  await expect(pin).toBeVisible();
  await pin.tap();
  await expect(page.getByRole("button", { name: "Unpin node" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(graph).toHaveAttribute("data-pinned-count", "1");
  await page.getByRole("button", { name: "Unpin node" }).tap();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
  await page.getByRole("button", { name: "Pin node" }).tap();
  await expect(graph).toHaveAttribute("data-pinned-count", "1");

  await page.getByRole("button", { name: "Close reader" }).tap();
  await expect(page.getByTestId("reader")).toHaveCount(0);
  const selectedCenter = {
    x: Number(await graph.getAttribute("data-selected-viewport-x")),
    y: Number(await graph.getAttribute("data-selected-viewport-y")),
  };
  expect(selectedCenter.y).toBeLessThan(844 * 0.35);
  await dragTouch(page, selectedCenter, { x: 201, y: 152 });
  await expect(page.getByTestId("reader")).toBeVisible();

  await page.getByRole("button", { name: "Close reader" }).tap();
  await dragTouch(page, selectedCenter, { x: 230, y: 148 });
  await expect(page.getByTestId("reader")).toHaveCount(0);
  await expect(graph).toHaveAttribute("data-pinned-count", "1");

  await searchNotesWithTouch(page, "adamw");
  await page.getByRole("button", { name: /AdamW/ }).tap();
  await expect(page.getByRole("button", { name: "Pin node" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await searchNotesWithTouch(page, "subword tokenization");
  await page.getByRole("button", { name: /Subword tokenization/ }).tap();
  await expect(page.getByRole("button", { name: "Unpin node" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Overview" }).tap();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
});

test("mobile touch retains graph controls and directional navigation", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  await page.goto("");
  await page.getByRole("button", { name: "Filters" }).tap();
  const backTrace = page.getByRole("region", { name: "Reading path" });
  await backTrace.getByRole("button", { name: "Activate" }).tap();
  await page.getByLabel("Search notes").fill("multiplication");
  await page.getByRole("button", { name: /^Multiplication/ }).tap();
  await expect(page.getByTestId("reader")).toBeVisible();
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-back-trace-node-count", "1");
  await page.getByRole("button", { name: "What depends on this?" }).tap();
  await expect(page).toHaveURL(/focus=1/);
  await expect(page.getByRole("region", { name: "Active graph focus" })).toBeVisible();
  const initialNodeCount = Number(await graph.getAttribute("data-projection-node-count"));
  await page.getByLabel(/Depth/).fill("2");
  await expect(page).toHaveURL(/depth=2/);
  await expect
    .poll(async () => Number(await graph.getAttribute("data-projection-node-count")))
    .toBeGreaterThan(initialNodeCount);
  await page.getByRole("button", { name: "Overview" }).tap();
  await expect(page).not.toHaveURL(/focus=1/);
});

test("matches the mobile reader chrome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("?note=Learning%2FAdamW");
  await expect(page.getByTestId("graph-2d")).toBeVisible();
  await expect(page.getByTestId("reader")).toBeVisible();
  await page.addStyleTag({
    content:
      ".graph-canvas canvas { visibility: hidden !important; } .mobile-pin-action { display: none !important; }",
  });
  await expect(page).toHaveScreenshot("mobile-reader.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });
});
