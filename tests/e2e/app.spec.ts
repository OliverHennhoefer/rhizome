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

test("keeps 3D out of the initial path and loads it on demand", async ({ page }) => {
  const scripts: string[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "script") scripts.push(response.url());
  });
  await page.goto("");
  await expect(page.getByTestId("graph-2d")).toBeVisible();
  expect(scripts.some((url) => url.includes("Graph3D"))).toBe(false);
  await page.getByRole("button", { name: "3D" }).click();
  await expect(page.getByTestId("graph-3d")).toBeVisible();
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
