import { expect, test } from "@playwright/test";

test("selects notes, restores query state, and loads details lazily", async ({ page }) => {
  let detailsRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/data/details/")) detailsRequests += 1;
  });
  await page.goto("?note=Event%20model&focus=1&direction=in&depth=2");
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Event model" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/focus=1/);
  await expect(page).toHaveURL(/direction=in/);
  expect(detailsRequests).toBeLessThanOrEqual(2);
  await page.getByLabel("Search notes").fill("projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Graph projection" }),
  ).toBeVisible();
});

test("renders the analytical graph without a renderer switch", async ({ page }) => {
  await page.goto("");
  await expect(page.getByTestId("graph-2d")).toBeVisible();
  await expect(page.getByTestId("reader")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show reader" })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Graph view" })).toHaveCount(0);
});

test("clears hover state when a focused projection removes the hovered node", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await page.getByLabel("Search notes").fill("graph projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");

  await page
    .getByRole("button", { name: "Focus" })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await page
    .getByRole("button", { name: "What depends on this?" })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "0");

  await page.getByLabel("Search notes").fill("event model");
  await page
    .getByRole("button", { name: /Event model/ })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Event model" }),
  ).toBeVisible();
  await expect(graph).not.toHaveAttribute("data-hovered-node", /.+/);
  await expect(graph).not.toHaveAttribute("data-hovered-neighbor-count", /.+/);
});

test("recomputes retained hover neighbors after relation filtering", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await page.getByLabel("Search notes").fill("graph projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "1");

  await page
    .getByRole("button", { name: "Filters" })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  const relations = page.locator("details.filter-group").filter({ hasText: "Relations" });
  await relations
    .locator("summary")
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await relations
    .getByRole("checkbox", { name: "link", exact: true })
    .evaluate((element) => (element as unknown as { click(): void }).click());
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "0");
});

test("selection-only navigation does not reheat the settled graph", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });

  await page.getByLabel("Search notes").fill("event model");
  await page
    .locator(".search-results")
    .getByRole("button", { name: /Event model/ })
    .click();
  const statuses: Array<string | null> = [];
  for (let sample = 0; sample < 10; sample += 1) {
    statuses.push(await graph.getAttribute("data-layout-status"));
    await page.waitForTimeout(50);
  }
  expect(statuses).not.toContain("loading");
  expect(statuses).not.toContain("running");
  await expect(graph).toHaveAttribute("data-layout-status", "settled");
});

test("runs bounded motion, pauses, resumes, and resets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });

  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByRole("button", { name: "Motion on" }).click();
  await expect(graph).toHaveAttribute("data-layout-status", "paused");
  await expect(page.getByRole("button", { name: "Motion off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.reload();
  await expect(graph).toHaveAttribute("data-layout-status", "paused");
  await page.getByRole("button", { name: "Layout" }).click();
  await expect(page.getByRole("button", { name: "Motion off" })).toBeVisible();

  await page.getByRole("button", { name: "Motion off" }).click();
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await page.getByRole("button", { name: "Reset layout" }).click();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
});

test("nudges live while zooming and ignores pure camera panning", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await expect(graph).toHaveAttribute("data-nudge-status", "idle");

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width * 0.75, bounds.y + bounds.height * 0.75);
  await page.mouse.wheel(0, 700);
  await expect(graph).toHaveAttribute("data-nudge-status", "active");
  await expect(graph).toHaveAttribute("data-layout-status", "running");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await expect(graph).toHaveAttribute("data-nudge-status", "idle");

  await page.mouse.move(bounds.x + 24, bounds.y + 24);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 64, bounds.y + 44, { steps: 4 });
  await page.mouse.up();
  await expect(graph).toHaveAttribute("data-nudge-status", "idle");
  await expect(graph).toHaveAttribute("data-layout-status", "settled");
});

test("does not load D3 by default under reduced motion", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const d3Requests: string[] = [];
  const bboxRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("d3-force")) d3Requests.push(request.url());
    if (request.url().includes("d3-bboxCollide")) bboxRequests.push(request.url());
  });

  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "paused");
  await page.waitForTimeout(250);
  expect(d3Requests).toEqual([]);
  expect(bboxRequests).toEqual([]);
  await expect(graph).toHaveAttribute("data-nudge-status", "disabled");

  await page.getByRole("button", { name: "Layout" }).click();
  await page.getByRole("button", { name: "Motion off" }).click();
  await expect.poll(() => d3Requests.length).toBeGreaterThan(0);
  await expect.poll(() => bboxRequests.length).toBeGreaterThan(0);
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await expect(graph).toHaveAttribute("data-nudge-status", "disabled");
});

test("shift-drag pins and normal drag releases a node", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await page.getByLabel("Search notes").fill("graph projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;

  await page.keyboard.down("Shift");
  await page.mouse.move(x, y);
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "1");
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 20, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(graph).toHaveAttribute("data-pinned-count", "1");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });

  await page.getByLabel("Search notes").fill("event model");
  await page.getByRole("button", { name: /Event model/ }).click();
  await page.getByLabel("Search notes").fill("graph projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await page.waitForTimeout(350);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 35, y + 15, { steps: 4 });
  await page.mouse.up();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
});

test("keeps oversized projections static with an explanation", async ({ page }, testInfo) => {
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
  await expect(graph).toHaveAttribute("data-nudge-status", "disabled");
  await expect(page.getByText("Focus or filter to enable motion")).toBeVisible();
  await page.getByRole("button", { name: "Layout" }).click();
  await expect(page.getByRole("button", { name: "Motion on" })).toBeDisabled();
});

test("toggles directional focus and returns to a filtered fitted overview", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Event%20model");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });

  await page.getByRole("button", { name: "Filters" }).click();
  const relations = page.locator("details.filter-group").filter({ hasText: "Relations" });
  await relations.locator("summary").click();
  await relations.getByRole("checkbox", { name: "link", exact: true }).click();
  await expect(page).toHaveURL(/relation=link/);

  await page.getByRole("button", { name: "Focus" }).click();
  const inbound = page.getByRole("button", { name: "What depends on this?" });
  await inbound.click();
  await expect(page).toHaveURL(/focus=1/);
  await expect(page).toHaveURL(/direction=in/);
  await inbound.click();
  await expect(page).not.toHaveURL(/focus=1/);
  await expect(page).not.toHaveURL(/direction=in/);
  await inbound.click();

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => graph.getAttribute("data-camera-ratio")).not.toBe("1.0000");

  await page.getByRole("button", { name: "Overview" }).click();
  await expect(page).not.toHaveURL(/focus=1/);
  await expect(page).not.toHaveURL(/direction=in/);
  await expect(page).toHaveURL(/relation=link/);
  await expect(graph).toHaveAttribute("data-camera-ratio", "1.0000", { timeout: 2_000 });
  await expect(graph).toHaveAttribute("data-layout-status", "settled");
  await expect(page.getByTestId("reader")).toBeVisible();
});

test("hides, restores, and resizes the reader independently from selection", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Cache%20invalidation");
  const graph = page.getByTestId("graph-2d");
  const reader = page.getByTestId("reader");
  const separator = page.getByRole("separator", { name: "Resize reader" });
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 15_000 });
  await expect(reader).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "420");
  const cameraRatio = await graph.getAttribute("data-camera-ratio");

  const handle = await separator.boundingBox();
  expect(handle).not.toBeNull();
  if (!handle) return;
  const startX = handle.x + handle.width / 2;
  await page.mouse.move(startX, handle.y + 80);
  await page.mouse.down();
  await page.mouse.move(startX - 80, handle.y + 80, { steps: 5 });
  await page.mouse.up();
  await expect(separator).toHaveAttribute("aria-valuenow", "500");
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("rhizome:reader-width")))
    .toBe("500");
  await expect(graph).toHaveAttribute("data-camera-ratio", cameraRatio ?? "1.0000");
  await expect(graph).toHaveAttribute("data-layout-status", "settled");

  await separator.focus();
  await page.keyboard.press("Home");
  await expect(separator).toHaveAttribute("aria-valuenow", "320");
  await separator.dblclick();
  await expect(separator).toHaveAttribute("aria-valuenow", "420");

  await page.getByRole("button", { name: "Close reader" }).click();
  await expect(reader).toHaveCount(0);
  await expect(page).toHaveURL(/note=Cache(?:\+|%20)invalidation/);
  await expect(page.getByRole("button", { name: "Show reader" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show reader" })).toBeFocused();
  await page.getByRole("button", { name: "Show reader" }).click();
  await expect(page.getByTestId("reader")).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "420");
});

test("formats relationships as directional rows with collapsed source evidence", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("?note=Cache%20invalidation");
  const relationships = page.getByTestId("reader").locator(".relationships");
  await expect(relationships.getByRole("heading", { name: "Relationships" })).toBeVisible();

  const external = relationships.locator(".relationship").filter({ hasText: "martinfowler.com" });
  await expect(external).toContainText("Supported by");
  await expect(external).toContainText("bliki/TwoHardThings.html");
  await expect(external.getByText("external", { exact: true })).toBeVisible();
  const evidence = external.getByRole("button", { name: "1 source" });
  await expect(evidence).toHaveAttribute("aria-expanded", "false");
  await evidence.click();
  await expect(external.getByText("Property:")).toContainText("supported-by");
  await expect(external.getByText("Cache invalidation.md:12")).toBeVisible();
  await expect(
    external.getByRole("link", { name: "Open martinfowler.com in a new tab" }),
  ).toHaveAttribute("href", "https://martinfowler.com/bliki/TwoHardThings.html");
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
  await page.addInitScript(() => localStorage.setItem("rhizome:motion", "off"));
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

  await page.goto("?note=Cache%20invalidation");
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
  await page.getByLabel("Search notes").fill("projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Graph projection" }),
  ).toBeVisible();
});

test("mobile retains search and reader navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  await page.goto("?note=Cache%20invalidation");
  await expect(page.getByLabel("Search notes")).toBeVisible();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Cache invalidation" }),
  ).toBeVisible();
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
});

test("matches the mobile reader chrome", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("rhizome:motion", "off"));
  await page.goto("?note=Cache%20invalidation");
  await expect(page.getByTestId("graph-2d")).toBeVisible();
  await expect(page.getByTestId("reader")).toBeVisible();
  await page.addStyleTag({
    content: ".graph-canvas canvas { visibility: hidden !important; }",
  });
  await expect(page).toHaveScreenshot("mobile-reader.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.001,
  });
});
