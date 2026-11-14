import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./Reader", () => ({ default: () => null }));
import App, {
  type DocumentRecord,
  addressWithout,
  languageName,
  originalDate,
  pageMeta,
  selectVariant,
} from "./App";
describe("catalog before the API responds", () => {
  it("shows loading without claiming an empty or imported catalog", () => {
    vi.stubGlobal("location", {
      search: "",
      pathname: "/",
      href: "http://localhost/",
    });
    const html = renderToString(<App />);
    expect(html).toContain("Loading the archive");
    expect(html).not.toContain("No documents have been imported");
    expect(html).not.toContain("Download original PDF");
    vi.unstubAllGlobals();
  });
});
describe("edition selection", () => {
  const edition = (id: string) => ({
    id,
    filename: `${id}.pdf`,
    sha256: id,
    size: 1,
    pages: 1,
    text_status: "none",
  });
  it("does not substitute another edition for an unknown variant", () => {
    const variants = [edition("first"), edition("second")];
    expect(selectVariant(variants, "second")?.id).toBe("second");
    expect(selectVariant(variants, null)?.id).toBe("first");
    expect(selectVariant(variants, "stale")).toBeUndefined();
  });
});
describe("byline values", () => {
  const doc = (date?: string, original_date?: string) =>
    ({ metadata: { title: "Zine", date }, original_date }) as DocumentRecord;
  it("shows a spelled-out missing date as Date unknown", () => {
    expect(originalDate(doc("unknown"))).toBe("Date unknown");
    expect(originalDate(doc("Unknown "))).toBe("Date unknown");
    expect(originalDate(doc("n.d."))).toBe("Date unknown");
    expect(originalDate(doc(""))).toBe("Date unknown");
    expect(originalDate(doc("1993", "unknown"))).toBe("Date unknown");
    expect(originalDate(doc("1992-12"))).toBe("1992-12");
  });
  it("names catalog languages instead of showing raw values", () => {
    expect(languageName("eng")).toBe("English");
    expect(languageName("english-handwritten")).toBe("English (handwritten)");
    expect(languageName("fre")).toBe("French");
    expect(languageName("fr-CA")).toBe("Canadian French");
    expect(languageName("english")).toBe("English");
    expect(languageName(undefined)).toBe("Unknown");
    for (const messy of [" ", "-", "_", " - _ "]) expect(languageName(messy)).toBe("Unknown");
    expect(languageName(" eng ")).toBe("English");
    expect(languageName("english and french")).toBe("English and french");
  });
});
describe("stale edition address", () => {
  const path = "/documents/zine";
  it("keeps the other parameters when dropping the edition", () => {
    expect(
      addressWithout(path, "?read=1&variant=stale&page=2&collection=x", "variant"),
    ).toBe(`${path}?read=1&page=2&collection=x`);
    expect(addressWithout(path, "?variant=stale", "variant")).toBe(path);
  });
  it("does not rely on URLSearchParams.size", () => {
    const size = Object.getOwnPropertyDescriptor(URLSearchParams.prototype, "size");
    Object.defineProperty(URLSearchParams.prototype, "size", {
      configurable: true,
      get: () => undefined,
    });
    try {
      expect(addressWithout(path, "?read=1&variant=stale&page=2", "variant")).toBe(
        `${path}?read=1&page=2`,
      );
    } finally {
      if (size) Object.defineProperty(URLSearchParams.prototype, "size", size);
    }
  });
});
describe("head metadata", () => {
  const base = "https://riot-grrrl.subcult.tv";
  const doc = {
    id: "abc",
    collection: "riot-grrrl",
    source_item: "item",
    metadata: { title: "Drop Babies - Issue 1", creator: "Layla Gibbon", date: "1992" },
    rights: "unknown",
    variants: [],
    hits: [],
  };
  it("names the zine and its own address on a document page", () => {
    const meta = pageMeta(doc, "Riot Grrrl", "riot-grrrl", "riot-grrrl", "abc", false, base);
    expect(meta.url).toBe("https://riot-grrrl.subcult.tv/documents/abc");
    expect(meta.title).toBe("Drop Babies - Issue 1 · Riot Grrrl Archive");
    expect(meta.socialTitle).toBe("Drop Babies - Issue 1");
    expect(meta.description).toContain("Drop Babies - Issue 1 (Layla Gibbon, 1992)");
    expect(meta.socialDescription).toBe(meta.description);
    const undated = { ...doc, metadata: { ...doc.metadata, date: "unknown" } };
    expect(pageMeta(undated, "", "", "", "abc", false, base).description).toMatch(/^Drop Babies - Issue 1 \(Layla Gibbon\):/);
  });
  it("keeps the document address before the record loads", () => {
    expect(pageMeta(null, undefined, "", undefined, "abc", false, base).url).toBe(
      "https://riot-grrrl.subcult.tv/documents/abc",
    );
  });
  it("restores the site values on the catalog", () => {
    const meta = pageMeta(null, "Riot Grrrl", "riot-grrrl", "riot-grrrl", "", false, base);
    expect(meta.url).toBe("https://riot-grrrl.subcult.tv/");
    expect(meta.socialTitle).toBe("Riot Grrrl Zine Archive");
    expect(meta.description).toMatch(/^Read preserved feminist punk zines/);
    expect(pageMeta(null, "Other", "other", "riot-grrrl", "", false, base).url).toBe(
      "https://riot-grrrl.subcult.tv/?collection=other",
    );
    const series = pageMeta(null, "Riot Grrrl", "riot-grrrl", "riot-grrrl", "", true, base);
    expect(series.url).toBe("https://riot-grrrl.subcult.tv/series");
    expect(series.title).toBe("Series · Riot Grrrl Archive");
  });
});
