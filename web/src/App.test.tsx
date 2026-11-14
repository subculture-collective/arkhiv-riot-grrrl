import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("./Reader", () => ({ default: () => null }));
import App, {
  type DocumentRecord,
  addressWithout,
  languageName,
  originalDate,
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
