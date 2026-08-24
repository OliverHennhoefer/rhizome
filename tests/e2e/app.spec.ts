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
  await expect(page.getByRole("group", { name: "Graph view" })).toHaveCount(0);
});

test("clears hover state when a focused projection removes the hovered node", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });
  await page.getByLabel("Search notes").fill("graph projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");

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
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });
  await page.getByLabel("Search notes").fill("graph projection");
  await page.getByRole("button", { name: /Graph projection/ }).click();
  await page.waitForTimeout(350);

  const bounds = await graph.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await expect(graph).toHaveAttribute("data-hovered-node", "Graph projection");
  await expect(graph).toHaveAttribute("data-hovered-neighbor-count", "1");

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
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });

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
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });

  await page.getByRole("button", { name: "Motion on" }).click();
  await expect(graph).toHaveAttribute("data-layout-status", "paused");
  await expect(page.getByRole("button", { name: "Motion off" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.reload();
  await expect(graph).toHaveAttribute("data-layout-status", "paused");
  await expect(page.getByRole("button", { name: "Motion off" })).toBeVisible();

  await page.getByRole("button", { name: "Motion off" }).click();
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });
  await page.getByRole("button", { name: "Reset layout" }).click();
  await expect(graph).toHaveAttribute("data-pinned-count", "0");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });
});

test("does not load D3 by default under reduced motion", async ({ page }, testInfo) => {
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

  await page.getByRole("button", { name: "Motion off" }).click();
  await expect.poll(() => d3Requests.length).toBeGreaterThan(0);
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });
});

test("shift-drag pins and normal drag releases a node", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "root", "root desktop project only");
  await page.goto("");
  const graph = page.getByTestId("graph-2d");
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });
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
  await expect(graph).toHaveAttribute("data-layout-status", "settled", { timeout: 5_000 });

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
  await expect(page.getByText("Focus or filter to enable motion")).toBeVisible();
  await expect(page.getByRole("button", { name: "Motion on" })).toBeDisabled();
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
  await expect(page.getByText("Outgoing")).toBeVisible();
});
