import data from "./series.json";

// Series are curated here, by document ID, because the catalog API has no
// series field. Issues are listed in reading order.
export interface SeriesIssue {
  id: string;
  issue: string;
}
export interface Series {
  slug: string;
  name: string;
  issues: SeriesIssue[];
}

const curated = data as Record<string, Series[]>;

export const seriesFor = (collection: string): Series[] =>
  curated[collection] || [];

export function seriesOf(collection: string, id: string) {
  for (const series of seriesFor(collection)) {
    const entry = series.issues.find((issue) => issue.id === id);
    if (entry) return { series, issue: entry.issue };
  }
  return undefined;
}

export const issueLabel = (issue: string) =>
  /^\d/.test(issue) ? `Issue ${issue}` : issue;

export const seriesLink = (collection: string, slug: string) =>
  `/?${new URLSearchParams({ collection, series: slug })}`;

// One suggestion per person: credits such as "A, B" are split, and spellings
// that differ only in case are shown once.
export function creatorNames(creators: (string | undefined)[]) {
  const names = new Map<string, string>();
  for (const credit of creators)
    for (const name of (credit || "").split(","))
      if (name.trim() && !names.has(name.trim().toLowerCase()))
        names.set(name.trim().toLowerCase(), name.trim());
  return [...names.values()].sort((a, b) => a.localeCompare(b));
}

interface CatalogPage<T> {
  documents: T[];
  total: number;
}
const loaded = new Map<string, Promise<unknown[]>>();

// Every document a catalog query matches, fetched once per page load. The
// listing API returns at most 50 documents per request.
export function allDocuments<T>(query: URLSearchParams): Promise<T[]> {
  const filters = new URLSearchParams(query);
  for (const key of ["series", "offset", "limit"]) filters.delete(key);
  filters.sort();
  const key = String(filters);
  let all = loaded.get(key);
  if (!all) {
    const page = async (offset: number) => {
      const q = new URLSearchParams(filters);
      q.set("limit", "50");
      q.set("offset", String(offset));
      const response = await fetch(`/api/documents?${q}`);
      if (!response.ok) throw new Error("The archive could not load.");
      return (await response.json()) as CatalogPage<unknown>;
    };
    all = page(0).then(async (first) => {
      const offsets = [];
      for (let offset = 50; offset < first.total; offset += 50)
        offsets.push(offset);
      const rest = await Promise.all(offsets.map(page));
      return [first, ...rest].flatMap((p) => p.documents);
    });
    all.catch(() => loaded.delete(key));
    loaded.set(key, all);
  }
  return all as Promise<T[]>;
}

export const catalogDocuments = <T>(collection: string) =>
  allDocuments<T>(new URLSearchParams({ collection }));
