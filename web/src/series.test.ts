import { describe, expect, it } from "vitest";
import data from "./series.json";
import { creatorNames, issueLabel, seriesOf } from "./series";

describe("curated series", () => {
  it("gives each series a unique slug and each document one series", () => {
    for (const list of Object.values(data)) {
      const slugs = list.map((series) => series.slug);
      expect(new Set(slugs).size).toBe(slugs.length);
      const ids = list.flatMap((series) => series.issues.map((i) => i.id));
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) expect(id).toMatch(/^[0-9a-f]{64}$/);
    }
  });
  it("finds a document's series and issue", () => {
    const found = seriesOf(
      "riot-grrrl",
      "d15cf0a92d6b0870693d6a5a3dd0cc5a454cfe1f9ba979a36064730178e653bf",
    );
    expect(found?.series.name).toBe("Violet");
    expect(found?.issue).toBe("Volume 3");
    expect(seriesOf("riot-grrrl", "missing")).toBeUndefined();
  });
  it("labels plain issue numbers", () => {
    expect(issueLabel("3")).toBe("Issue 3");
    expect(issueLabel("Volume 2")).toBe("Volume 2");
  });
});

describe("creator suggestions", () => {
  it("splits shared credits and merges spellings that differ in case", () => {
    expect(
      creatorNames([
        "Lucy McKenzie",
        "Lucy Mckenzie",
        "Greta Drummond-Gillett, Layla Gibbon",
        "",
        undefined,
      ]),
    ).toEqual(["Greta Drummond-Gillett", "Layla Gibbon", "Lucy McKenzie"]);
  });
});
