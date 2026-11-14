import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Catalog from "./Catalog";
import type { Listing } from "./App";

const listing: Listing = {
  documents: [
    {
      id: "doc-1",
      collection: "fixture-zines",
      source_item: "item",
      metadata: { title: "Mutual aid fixture" },
      rights: "unknown",
      variants: [
        {
          id: "variant-1",
          filename: "a.pdf",
          sha256: "x",
          size: 1,
          pages: 4,
          text_status: "available",
        },
      ],
      hits: [{ page: 2, variant: "variant-1", snippet: "a knownword here" }],
    },
  ],
  total: 3,
  limit: 1,
  offset: 0,
};

const render = (search: string, shown: Listing = listing) =>
  renderToString(
    <Catalog
      collectionID="fixture-zines"
      listing={shown}
      subjects={[]}
      params={new URLSearchParams(search)}
      offsetLink={(n) => `/?offset=${n}`}
      favorites={{ ids: [], toggle: () => {}, notice: "" }}
    />,
  );

describe("catalog layout", () => {
  it("defaults to the grid", () => {
    const html = render("collection=fixture-zines&q=knownword");
    expect(html).toContain('class="publication-grid"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Grid/);
    expect(html).not.toContain('name="layout"');
  });

  it("opens in the table when the URL asks for it and keeps it on a new search", () => {
    const html = render("collection=fixture-zines&q=knownword&layout=table");
    expect(html).toContain("<table>");
    expect(html).not.toContain('class="publication-grid"');
    expect(html).toMatch(/aria-pressed="true"[^>]*>Table/);
    expect(html).toContain('<input type="hidden" name="layout" value="table"/>');
  });

  it("shows search-hit page links in the table", () => {
    const html = render("collection=fixture-zines&q=knownword&layout=table");
    const table = html.slice(html.indexOf("<tbody>"), html.indexOf("</tbody>"));
    expect(table).toContain(
      'href="/documents/doc-1?read=1&amp;variant=variant-1&amp;page=2"',
    );
    expect(table).toContain("Page 2");
    expect(table).toContain("a knownword here");
  });

  it("keeps the table when clearing filters", () => {
    const empty = { ...listing, documents: [], total: 0 };
    expect(render("collection=fixture-zines&q=none&layout=table", empty)).toContain(
      'href="/?collection=fixture-zines&amp;layout=table">Clear filters',
    );
    expect(render("collection=fixture-zines&q=none", empty)).toContain(
      'href="/?collection=fixture-zines">Clear filters',
    );
  });
});
