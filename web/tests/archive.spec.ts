import { test, expect } from "@playwright/test";
import { createHash } from "node:crypto";
test.beforeEach(async ({ page }) => {
  await page.route(/https?:\/\/([^/]*\.)?archive\.org\//, (r) => r.abort());
});
test("catalog, page search, local PDF rendering, navigation and download", async ({
  page,
  request,
}) => {
  await page.goto("/?collection=fixture-zines");
  await expect(page.getByRole("link", { name: "Riot Grrrl Archive home" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Riot Grrrl Archive home" })).toBeFocused();
  expect(await page.getByRole("link", { name: "Riot Grrrl Archive home" }).evaluate((e) => {
    const style = getComputedStyle(e);
    return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
  })).toBeTruthy();
  await expect(
    page.getByRole("heading", { name: "Mutual aid fixture" }).first(),
  ).toBeVisible();
  await expect(page.getByText("Private fixture", { exact: true })).toHaveCount(
    0,
  );
  await page.getByLabel("Search titles and available text").fill("knownword");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("link", { name: "Page 2", exact: true }).click();
  await expect(page.getByLabel("Page number")).toHaveValue("2");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Page number")).toHaveAttribute("max", "2");
  const canvas = page.getByTestId("pdf-canvas");
  await expect(canvas).toBeVisible();
  expect(
    await canvas.evaluate(
      (c: HTMLCanvasElement) => c.width > 100 && c.height > 100,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByLabel("Page number")).toHaveValue("1");
  await page.getByLabel("Zoom", { exact: true }).selectOption("1.5");
  await page.getByRole("button", { name: "Search & text", exact: true }).click();
  await page.getByLabel("Search this document").fill("knownword");
  await page.getByRole("button", { name: "Find", exact: true }).click();
  await page.getByRole("button", { name: "Page 2", exact: true }).click();
  await expect(page.getByLabel("Page number")).toHaveValue("2");
  const link = page.getByRole("link", { name: /^Download PDF/ });
  const response = await request.get((await link.getAttribute("href"))!);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-disposition"]).toContain("attachment");
  const digest = createHash("sha256")
    .update(await response.body())
    .digest("hex");
  await page.getByText("Preservation details", { exact: true }).click();
  await expect(
    page.getByText("SHA-256: " + digest, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("empty, error, loading and second configuration", async ({ page }) => {
  await page.goto("/?collection=fixture-second");
  await expect(
    page.getByRole("heading", { name: "Mutual aid fixture" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Second synthetic archive" }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "A different editorial introduction for the second synthetic collection.",
    ),
  ).toBeVisible();
  expect(
    await page
      .locator("main")
      .evaluate((e) => (e as HTMLElement).style.getPropertyValue("--accent")),
  ).toBe("#245c42");
  await page.goto("/?collection=fixture-zines&q=nomatchesxyz");
  await expect(
    page.getByText(/No documents match these filters/),
  ).toBeVisible();
  await page.route("**/api/collections", async (r) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await r.fulfill({
      status: 503,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Loading");
  await expect(page.getByRole("alert")).toContainText("could not load");
});

test("cover fallback, scoped filters and narrow catalog layout", async ({ page }) => {
  await page.route("**/api/assets/*/cover", route => route.abort());
  await page.goto("/?collection=fixture-zines");
  await expect(page.getByText("Cover unavailable").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "From the collection" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.getByLabel("Search titles and available text").fill("knownword");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await expect(page.getByRole("region", { name: "From the collection" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Page 2", exact: true })).toBeVisible();
  await expect(page.locator('input[name="collection"]')).toHaveValue("fixture-zines");
});

test("table layout is visibly selected and survives pages, Back and search", async ({ page }) => {
  // The fixture holds one document; report more so Next appears with limit=1.
  await page.route("**/api/documents?*", async route => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), total: 3 } });
  });
  const layout = page.getByRole("group", { name: "Catalog layout" });
  const grid = layout.getByRole("button", { name: "Grid", exact: true });
  const table = layout.getByRole("button", { name: "Table", exact: true });
  const background = (button: typeof grid) => button.evaluate(element => getComputedStyle(element).backgroundColor);
  await page.goto("/?collection=fixture-zines&limit=1");
  await table.click();
  await page.mouse.move(0, 0);
  await expect(table).toHaveAttribute("aria-pressed", "true");
  expect(await background(table)).not.toBe(await background(grid));
  await expect(page).toHaveURL(/layout=table/);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/offset=1/);
  await expect(page.getByRole("table")).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/offset=1/);
  await expect(page.getByRole("table")).toBeVisible();
  await page.getByLabel("Search titles and available text").fill("knownword");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Search results" })).toBeVisible();
  await expect(page.getByRole("table").getByRole("link", { name: "Page 2", exact: true })).toBeVisible();
  await grid.click();
  await expect(page).not.toHaveURL(/layout=/);
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("selected identity fits the configured catalog", async ({ page }) => {
  await page.route("**/api/collections", async route => {
    const response = await route.fetch();
    const collections = await response.json();
    const collection = collections.find((entry: { id: string }) => entry.id === "fixture-zines");
    collection.name = "Riot Grrrl Zine Archive";
    await route.fulfill({ response, json: collections });
  });
  await page.goto("/?collection=fixture-zines");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Zine Archive");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect(page.getByRole("link", { name: "Open Mutual aid fixture", exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Open Mutual aid fixture", exact: true }).first().click();
  await expect(page.getByLabel("Page number")).toHaveValue("1");
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Previous page", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Zoom")).toHaveValue("page");
  const canvas = await page.getByTestId("pdf-canvas").boundingBox();
  expect(canvas && canvas.y + canvas.height <= (page.viewportSize()?.height ?? 0) + 1).toBeTruthy();
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await expect(page.getByRole("region", { name: "Document reader" })).toHaveAttribute("data-fullscreen", "true");
  await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
  await expect(page.getByRole("region", { name: "Document reader" })).not.toHaveAttribute("data-fullscreen", "true");
  await expect(page.getByText("No reuse license is asserted.", { exact: false })).toBeVisible();
});

test("series page, series filter and creator suggestions", async ({ page }) => {
  await page.goto("/series?collection=fixture-zines");
  await expect(page.getByRole("heading", { name: "Series", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Fixture series", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Fixture series" })).toBeVisible();
  await expect(page.getByText("1 document in this series")).toBeVisible();
  await expect(page.getByLabel("Series")).toHaveValue("fixture-series");
  await page.getByLabel("Creator").focus();
  await expect(page.locator('#creator-suggestions option[value="Fixture author"]')).toHaveCount(1);
  await page.getByRole("link", { name: "Mutual aid fixture", exact: true }).first().click();
  await expect(page.getByRole("region", { name: "Series" })).toContainText("Fixture series");
  await expect(page.getByRole("region", { name: "Series" })).toContainText("Issue 1");
});

test("hashed assets, including the pdf.js worker, are cached for a year", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const entryMatch = html.match(/\/assets\/index-[\w-]+\.js/);
  expect(entryMatch, "entry chunk in index.html").toBeTruthy();
  const entry = entryMatch![0];
  const readerMatch = (await (await request.get(entry)).text()).match(/Reader-[\w-]+\.js/);
  expect(readerMatch, "Reader chunk in entry chunk").toBeTruthy();
  const reader = readerMatch![0];
  const workerMatch = (await (await request.get("/assets/" + reader)).text()).match(/\/assets\/pdf\.worker[\w.-]*\.mjs/);
  expect(workerMatch, "worker URL in Reader chunk").toBeTruthy();
  const worker = workerMatch![0];
  for (const path of [entry, "/assets/" + reader, worker]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain("application/javascript");
    expect(response.headers()["cache-control"], path).toBe("public, max-age=31536000, immutable");
    expect(response.headers()["content-security-policy"], path).toContain("default-src 'self'");
  }
  for (const path of ["/assets/missing-0000.js", "/assets/missing-0000.mjs"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("missing pages, stale links and a reader that cannot load", async ({ page }) => {
  await page.goto("/documents/doesnotexist");
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This zine is not in the archive.");
  await expect(alert.getByRole("link", { name: "Browse all zines" })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: "Try again" })).toHaveCount(0);
  await expect(page).toHaveTitle("Not found · Riot Grrrl Archive");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  await page.goto("/made-up-path");
  await expect(page.getByRole("alert")).toContainText("This page does not exist.");
  await expect(page.getByRole("link", { name: "Open Mutual aid fixture", exact: true })).toHaveCount(0);

  await page.goto("/?collection=fixture-zines");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  const href = await page.getByRole("link", { name: "Open Mutual aid fixture", exact: true }).first().getAttribute("href");
  const path = new URL(href!, "http://web").pathname;
  // A shared search-hit link whose edition was replaced, with an out-of-range page.
  await page.goto(`${path}?read=1&variant=stale&page=99`);
  await expect(page.getByRole("status").filter({ hasText: "no longer available" })).toBeVisible();
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByLabel("Page number")).toHaveValue("2");
  await expect(page.getByRole("link", { name: /^Download PDF/ })).toBeVisible();
  await expect.poll(() => new URL(page.url()).search).toBe("?read=1&page=2");
  await page.goto(`${path}?page=abc`);
  await expect(page.getByLabel("Page number")).toHaveValue("1");
  await expect.poll(() => new URL(page.url()).search).toBe("?page=1");

  // An edition without text offers no Search & text panel.
  const documentAPI = /\/api\/documents\/[0-9a-f]+$/;
  await page.route(documentAPI, async (route) => {
    const response = await route.fetch();
    const doc = await response.json();
    for (const variant of doc.variants) variant.text_status = "no-text";
    await route.fulfill({ response, json: doc });
  });
  await page.goto(path);
  await expect(page.getByTestId("pdf-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Search & text", exact: true })).toHaveCount(0);
  await page.unroute(documentAPI);

  // The reader's code fails to load: the rest of the page stays.
  await page.route(/\/assets\/Reader-[^/]*\.js$/, (route) => route.abort());
  await page.goto(path);
  await expect(page.getByRole("alert")).toContainText("The reader could not load.");
  await expect(page.getByRole("link", { name: "Reload the page" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Mutual aid fixture" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Download PDF/ })).toBeVisible();
});
test("favorite toggle keeps its name and reports what was saved", async ({ page }) => {
  await page.goto("/?collection=fixture-zines");
  await page.getByRole("link", { name: "Mutual aid fixture" }).first().click();
  const favorite = page.getByRole("button", {
    name: "Favorite Mutual aid fixture",
    exact: true,
  });
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await expect(favorite).toHaveText("Favorite");
  await page.getByRole("link", { name: "All zines" }).click();
  await expect(
    page.getByText(
      "1 reference saved in this browser for Synthetic verification collection.",
    ),
  ).toBeVisible();
});
test("document page warns when browser storage refuses a favorite", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.goto("/?collection=fixture-zines");
  await page.getByRole("link", { name: "Mutual aid fixture" }).first().click();
  const favorite = page.getByRole("button", {
    name: "Favorite Mutual aid fixture",
    exact: true,
  });
  await favorite.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Browser storage is unavailable" }),
  ).toBeVisible();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
});
test("catalog grid and table favorites show the saved state", async ({ page }) => {
  await page.goto("/?collection=fixture-zines");
  const favorite = page
    .getByRole("button", { name: "Favorite Mutual aid fixture", exact: true })
    .first();
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await expect(favorite).toHaveText("Favorite");
  await expect(favorite).toHaveCSS("background-color", "rgb(35, 23, 34)");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const row = page.getByRole("table").getByRole("button", {
    name: "Favorite Mutual aid fixture",
    exact: true,
  });
  await expect(row).toHaveAttribute("aria-pressed", "true");
  await expect(row).toHaveCSS("background-color", "rgb(35, 23, 34)");
  await row.click();
  await expect(row).toHaveAttribute("aria-pressed", "false");
});

test("invalid filters, stale pages and unknown collections explain themselves", async ({ page }) => {
  const search = page.getByLabel("Search titles and available text");
  const count = page.locator(".catalog-heading [role=status]");
  await page.goto("/?collection=fixture-zines");
  const total = await count.textContent();
  await page.getByLabel("Original date from").fill("2000-01-01");
  await page.getByLabel("Original date to").fill("1990-01-01");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The original-date range is reversed.");
  await expect(search).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("could not load")).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.getByLabel("Original date from")).toHaveValue("");

  // A series view fetches the listing another way and must explain itself too.
  await page.goto("/?collection=fixture-zines&series=fixture-series");
  await page.getByLabel("Original date from").fill("2000-01-01");
  await page.getByLabel("Original date to").fill("1990-01-01");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The original-date range is reversed.");
  await expect(search).toBeVisible();
  await expect(page.getByText("could not load")).toHaveCount(0);
  await page.goto("/?collection=fixture-zines&series=fixture-series&date_from=1990-13-01");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(search).toBeVisible();
  await expect(page.getByText("could not load")).toHaveCount(0);

  await page.goto("/?collection=fixture-zines&offset=abc");
  await expect(page.getByRole("alert")).toContainText("page offset must be a whole number");
  await expect(search).toBeVisible();

  await page.goto("/?collection=fixture-zines&offset=500");
  await expect(page.getByText("This page is past the end of the results.")).toBeVisible();
  await expect(page.getByText("No documents match")).toHaveCount(0);
  await page.getByRole("link", { name: "Go to the first page" }).click();
  await expect(page.getByRole("heading", { name: "Mutual aid fixture" }).first()).toBeVisible();

  await page.goto("/?collection=fixture-zines&q=+++");
  await expect(page.getByRole("heading", { name: "The collection" })).toBeVisible();
  await expect(count).toHaveText(total!);

  await page.goto("/?collection=fixture-zinez");
  await expect(page.getByRole("heading", { name: "Collection not found" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("There is no collection called “fixture-zinez”.");
  await expect(page.getByText("No documents match")).toHaveCount(0);
  await page.getByRole("link", { name: /^Browse / }).click();
  await expect(page.getByRole("heading", { name: "Collection not found" })).toHaveCount(0);
  await expect(search).toBeVisible();
});
