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

test("mobile retains search and reader navigation", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-reader", "mobile project only");
  await page.goto("?note=Cache%20invalidation");
  await expect(page.getByLabel("Search notes")).toBeVisible();
  await expect(
    page.getByTestId("reader").getByRole("heading", { name: "Cache invalidation" }),
  ).toBeVisible();
  await expect(page.getByText("Outgoing")).toBeVisible();
});
