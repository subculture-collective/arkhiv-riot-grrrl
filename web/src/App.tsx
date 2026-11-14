import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import Catalog from "./Catalog";
import SeriesIndex from "./SeriesIndex";
import {
  allDocuments,
  issueLabel,
  seriesFor,
  seriesLink,
  seriesOf,
} from "./series";
import {
  FavoriteButton,
  FavoriteShelf,
  ShareControls,
  useBrowserFavorites,
} from "./Preferences";
const publicURL =
  import.meta.env.VITE_PUBLIC_URL ||
  globalThis.location?.origin ||
  "http://localhost";
const contact = import.meta.env.VITE_CORRECTION_CONTACT || "info@subcult.tv";
const Reader = lazy(() => import("./Reader"));
export interface Variant {
  public_approved?: boolean;
  id: string;
  filename: string;
  sha256: string;
  size: number;
  pages: number;
  text_status: string;
}
export interface DocumentRecord {
  id: string;
  collection: string;
  source_item: string;
  original_date?: string;
  metadata: {
    title: string;
    creator?: string;
    date?: string;
    language?: string;
    subjects?: string[];
  };
  rights: string;
  variants: Variant[];
  hits: { page: number; variant: string; snippet: string }[];
}
export interface Collection {
  id: string;
  name: string;
  introduction: string;
  accent: string;
}
export interface Listing {
  documents: DocumentRecord[];
  total: number;
  limit: number;
  offset: number;
}
// A 404 is permanent: retrying the same link cannot help, so the page offers the catalog instead.
class NotFoundError extends Error {}
// A 400 carries the API's reason so the catalog can show it beside the form.
class InvalidRequestError extends Error {}
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (r.status === 400) {
    const body = await r.json().catch(() => null);
    throw new InvalidRequestError(
      typeof body?.error === "string" && body.error
        ? body.error
        : "this request is not valid",
    );
  }
  if (r.status === 404)
    throw new NotFoundError(
      "This zine is not in the archive. The link may be mistyped, or the zine may no longer be public.",
    );
  if (!r.ok) throw new Error("The archive could not load. Please try again.");
  return r.json();
}
// If the reader's code cannot load (a failed request, or a tab left open across a
// deploy), the rest of the document page stays and the reader area says so.
class ReaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="notice">
        <p>The reader could not load.</p>
        <a href={location.href}>Reload the page</a>
      </div>
    ) : (
      this.props.children
    );
  }
}
// Catalog languages are usually ISO 639-2 codes ("eng"); show their English
// names. Codes Intl does not know fall through to languageName's free-text path.
const languageCodes: Record<string, string> = { eng: "en", fre: "fr", fra: "fr", ger: "de", deu: "de", spa: "es", ita: "it", por: "pt", dut: "nl", nld: "nl", jpn: "ja" };
let displayNames: Intl.DisplayNames | undefined;
function knownLanguage(code: string) {
  try {
    displayNames ??= new Intl.DisplayNames(["en"], { type: "language" });
    const name = displayNames.of(languageCodes[code.toLowerCase()] || code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : undefined;
  } catch {
    return undefined;
  }
}
// Some source records carry free text such as "english-handwritten" instead
// of a code. The stored value is kept; it is shown as "English (handwritten)".
export function languageName(code: string | undefined) {
  const value = code?.trim();
  if (!value) return "Unknown";
  const known = knownLanguage(value);
  if (known) return known;
  const [base, ...notes] = value.split(/[-_]+/).map((part) => part.trim()).filter(Boolean);
  if (!base) return "Unknown";
  const name = knownLanguage(base) || base.charAt(0).toUpperCase() + base.slice(1);
  return notes.length ? `${name} (${notes.join(" ")})` : name;
}
export const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
export const textStatus = (v: Variant) =>
  v.text_status === "page-text"
    ? "Page text searchable."
    : v.text_status === "document-text"
      ? "Document text searchable; page mapping unavailable."
      : "Text search unavailable.";
// Source records sometimes spell a missing date out ("unknown").
const missingDates = new Set(["unknown", "undated", "n.d.", "nd"]);
export const originalDate = (doc: DocumentRecord) => {
  const date = (
    doc.original_date === undefined ? doc.metadata.date : doc.original_date
  )?.trim();
  return date && !missingDates.has(date.toLowerCase()) ? date : "Date unknown";
};
export const selectVariant = (variants: Variant[], requested: string | null) =>
  requested ? variants.find((v) => v.id === requested) : variants[0];
// The address without one query parameter. It serialises the query rather
// than reading URLSearchParams.size, which older supported browsers lack.
export const addressWithout = (pathname: string, search: string, key: string) => {
  const q = new URLSearchParams(search);
  q.delete(key);
  const rest = q.toString();
  return rest ? `${pathname}?${rest}` : pathname;
};
const favoriteDocument = async (
  id: string,
  signal: AbortSignal,
  scope: string,
) => {
  const doc = await json<DocumentRecord>(
    `/api/documents/${encodeURIComponent(id)}`,
    signal,
  );
  if (doc.collection !== scope)
    throw new Error("Favorite is unavailable in this collection");
  return {
    title: doc.metadata.title,
    href: `/documents/${encodeURIComponent(id)}?collection=${encodeURIComponent(doc.collection)}`,
  };
};
// A series view runs the other catalog filters and keeps the series' issues,
// in issue order.
async function seriesListing(query: URLSearchParams, ids: string[]) {
  const docs = new Map(
    (await allDocuments<DocumentRecord>(query)).map((doc) => [doc.id, doc]),
  );
  const documents = ids.flatMap((id) => docs.get(id) || []);
  return { documents, total: documents.length, limit: documents.length, offset: 0 };
}
export default function App() {
  const params = new URLSearchParams(location.search);
  const id = location.pathname.startsWith("/documents/")
    ? location.pathname.split("/")[2]
    : "";
  const seriesPage = location.pathname === "/series";
  // Only the catalog, series and document pages exist; any other path is not found.
  const unknownPath = !id && !seriesPage && location.pathname !== "/";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [staleEdition, setStaleEdition] = useState(false);
  const [listingError, setListingError] = useState("");
  const [missingCollection, setMissingCollection] = useState("");
  const [loading, setLoading] = useState(true);
  const [collectionID, setCollectionID] = useState(
    params.get("collection") || "",
  );
  const favorites = useBrowserFavorites(collectionID);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 15000);
    async function load() {
      if (unknownPath) throw new NotFoundError("This page does not exist.");
      const all = await json<Collection[]>(
        "/api/collections",
        controller.signal,
      );
      if (!active) return;
      setCollections(all);
      if (id) {
        const d = await json<DocumentRecord>(
          `/api/documents/${encodeURIComponent(id)}`,
          controller.signal,
        );
        if (active) {
          // A link to a replaced or withdrawn edition opens the document's
          // available edition instead, with a notice, and the address and
          // share links drop the stale edition.
          const requested = new URLSearchParams(location.search).get("variant");
          if (requested && d.variants.length && !selectVariant(d.variants, requested)) {
            history.replaceState(null, "", addressWithout(location.pathname, location.search, "variant"));
            setStaleEdition(true);
          }
          setDoc(d);
          setCollectionID(d.collection);
        }
      } else if (all.length) {
        const selected =
          new URLSearchParams(location.search).get("collection") || all[0].id;
        if (!all.some((c) => c.id === selected)) {
          setCollectionID("");
          setMissingCollection(selected);
          return;
        }
        setCollectionID(selected);
        if (seriesPage) return;
        const q = new URLSearchParams(location.search);
        q.set("collection", selected);
        const series = seriesFor(selected).find(
          (s) => s.slug === q.get("series"),
        );
        const [data, facets] = await Promise.all([
          (series
            ? seriesListing(q, series.issues.map((issue) => issue.id))
            : json<Listing>(`/api/documents?${q}`, controller.signal)
          ).catch((e) => {
            // Invalid filters keep the form on screen with the API's reason.
            if (e instanceof InvalidRequestError) return e;
            throw e;
          }),
          json<{ subjects: string[] }>(
            `/api/facets?collection=${encodeURIComponent(selected)}`,
            controller.signal,
          ),
        ]);
        if (active) {
          if (data instanceof InvalidRequestError) setListingError(data.message);
          else setListing(data);
          setSubjects(facets.subjects);
        }
      }
    }
    load()
      .catch((e) => {
        if (active) {
          setNotFound(e instanceof NotFoundError);
          setError(
            controller.signal.aborted
              ? "The archive took too long to respond. Please try again."
              : e.message,
          );
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [id, seriesPage, unknownPath]);
  const collection = collections.find((c) => c.id === collectionID);
  const requestedVariant = params.get("variant");
  const variant = doc && selectVariant(doc.variants, requestedVariant);
  const docSeries = doc ? seriesOf(doc.collection, doc.id) : undefined;
  // Link only the series' issues that are publicly readable.
  const seriesCollection = docSeries && doc ? doc.collection : "";
  const [publicIssues, setPublicIssues] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (!seriesCollection) return;
    let active = true;
    allDocuments<DocumentRecord>(new URLSearchParams({ collection: seriesCollection }))
      .then((docs) => {
        if (active) setPublicIssues(new Set(docs.map((d) => d.id)));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [seriesCollection]);
  useEffect(() => {
    // The SPA is always served with HTTP 200, so a missing page tells search
    // engines not to index it and does not claim a canonical address.
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (notFound || missingCollection) {
      document.title = "Not found · Riot Grrrl Archive";
      canonical?.remove();
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.append(robots);
      }
      robots.content = "noindex";
      return;
    }
    robots?.remove();
    document.title = `${doc?.metadata.title || (seriesPage ? "Series" : collection?.name) || "Riot Grrrl zines"} · Riot Grrrl Archive`;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(
      id
        ? `/documents/${id}`
        : seriesPage
          ? "/series"
          : collectionID
          ? `/?collection=${encodeURIComponent(collectionID)}`
          : "/",
      publicURL,
    ).href;
  }, [doc, collection, collectionID, id, seriesPage, notFound, missingCollection]);
  const offsetLink = (n: number) => {
    const q = new URLSearchParams(location.search);
    q.set("collection", collectionID);
    q.set("offset", String(n));
    return `/?${q}`;
  };
  return (
    <main
      style={
        { "--accent": collection?.accent || "#9b1459" } as React.CSSProperties
      }
    >
      <header className="masthead">
        <a href="/" aria-label="Riot Grrrl Archive home">
          RIOT GRRRL
        </a>
        <span>Zines. Noise. Herstory.</span>
        <nav aria-label="Archive navigation">
          <a href="/" aria-current={!id && !seriesPage ? "page" : undefined}>
            Zines
          </a>
          <a
            href={`/series${collectionID ? `?collection=${encodeURIComponent(collectionID)}` : ""}`}
            aria-current={seriesPage ? "page" : undefined}>
            Series
          </a>
        </nav>
      </header>
      {loading && (
        <p role="status" className="notice">
          Loading the archive…
        </p>
      )}
      {error && (
        <div role="alert" className="notice">
          <p>{error}</p>
          {notFound ? (
            <a href={collectionID ? `/?collection=${encodeURIComponent(collectionID)}` : "/"}>
              Browse all zines
            </a>
          ) : (
            <a href={location.href}>Try again</a>
          )}
        </div>
      )}
      {!loading && !error && !collections.length && (
        <section className="introduction">
          <p className="eyebrow">Collection in preparation</p>
          <h1>
            The Riot Grrrl
            <br />
            Zine Archive
          </h1>
          <p>No documents have been imported yet.</p>
        </section>
      )}
      {!loading && !error && collections.length > 0 && (
        <>
          {!doc && <nav className="collection-nav" aria-label="Collections">
            {collections.map((c) => (
              <a
                key={c.id}
                href={`/?collection=${encodeURIComponent(c.id)}`}
                aria-current={c.id === collectionID ? "page" : undefined}
              >
                {c.name}
              </a>
            ))}
          </nav>}
          {missingCollection ? (
            <section className="catalog" id="catalog">
              <div className="front-heading">
                <h1>Collection not found</h1>
              </div>
              <p role="alert" className="notice">
                There is no collection called “{missingCollection}”.{" "}
                <a href={`/?collection=${encodeURIComponent(collections[0].id)}`}>
                  Browse {collections[0].name}
                </a>
              </p>
            </section>
          ) : doc ? (
            <article className="document">
              {requestedVariant && !variant && (
                <p role="alert" className="notice">
                  This edition is unavailable.{" "}
                  <a
                    href={`/?collection=${encodeURIComponent(doc.collection)}`}
                  >
                    Back to the catalog
                  </a>
                </p>
              )}
              {staleEdition && (
                <p role="status" className="notice">
                  The edition in this link is no longer available, so the
                  current edition is shown.
                </p>
              )}
              <div className="document-body">
                <div className="document-main">
                  <nav className="document-crumbs" aria-label="Breadcrumb">
                    <a href={`/?collection=${encodeURIComponent(doc.collection)}`}>
                      <span className="back" aria-hidden="true">← </span>All zines
                    </a>
                  </nav>
                  <header className="document-header">
                    <h1>{doc.metadata.title}</h1>
                    <p className="byline">
                      <span>{doc.metadata.creator || "Creator unknown"}</span>
                      <span>{originalDate(doc)}</span>
                      {variant?.pages ? <span>{variant.pages} pages</span> : null}
                      {doc.metadata.language ? <span>{languageName(doc.metadata.language)}</span> : null}
                    </p>
                  </header>
                  {variant && (
                    <div className="document-reader">
                      <ReaderBoundary>
                        <Suspense
                          fallback={<p role="status">Loading reader…</p>}
                        >
                          <Reader
                            variant={variant}
                            title={doc.metadata.title}
                            initialPage={Number(params.get("page") || 1)}
                          />
                        </Suspense>
                      </ReaderBoundary>
                    </div>
                  )}
                </div>
                <aside
                  className="document-details"
                  aria-label="About this zine"
                >
                  <div className="document-actions">
                    {variant && (
                      <a
                        className="button download"
                        href={`/api/assets/${variant.id}?download=1`}
                      >
                        Download PDF <span className="download-size">({megabytes(variant.size)})</span>
                      </a>
                    )}
                    <FavoriteButton
                      id={doc.id}
                      title={doc.metadata.title}
                      favorites={favorites}
                    />
                    <ShareControls
                      url={() => location.href}
                      title={doc.metadata.title}
                    />
                  </div>
                  {favorites.notice && (
                    <p role="status" className="favorite-notice">
                      {favorites.notice}
                    </p>
                  )}
                  {docSeries && (
                    <section className="series" aria-labelledby="series-title">
                      <h2 id="series-title">Series</h2>
                      <p>
                        <a href={seriesLink(doc.collection, docSeries.series.slug)}>
                          {docSeries.series.name}
                        </a>{" "}
                        · {issueLabel(docSeries.issue)}
                      </p>
                      {publicIssues && docSeries.series.issues.filter((issue) => publicIssues.has(issue.id)).length > 1 && (
                        <ol className="series-issues">
                          {docSeries.series.issues.filter((issue) => publicIssues.has(issue.id)).map((issue) => (
                            <li key={issue.id}>
                              {issue.id === doc.id ? (
                                <span aria-current="page">
                                  {issueLabel(issue.issue)}
                                </span>
                              ) : (
                                <a href={`/documents/${issue.id}`}>
                                  {issueLabel(issue.issue)}
                                </a>
                              )}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  )}
                  {doc.metadata.subjects?.length ? (
                    <section className="subjects" aria-labelledby="subjects-title">
                      <h2 id="subjects-title">Subjects</h2>
                      <ul className="subject-list">
                        {doc.metadata.subjects.map((subject) => (
                          <li key={subject}>
                            <a href={`/?${new URLSearchParams({ collection: doc.collection, subject })}`}>
                              {subject}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                  {doc.variants.length > 1 && <section
                    className="editions"
                    aria-labelledby="editions-title"
                  >
                    <h2 id="editions-title">Editions</h2>
                    <ul>
                      {doc.variants.map((v) => (
                        <li
                          key={v.id}
                          aria-current={v.id === variant?.id ? "true" : undefined}
                        >
                          <p className="edition-name">{v.filename}</p>
                          <p>
                            {megabytes(v.size)}. {textStatus(v)}
                          </p>
                          <p className="edition-actions">
                            {v.id !== variant?.id && (
                              <a href={`?variant=${v.id}&page=1`}>
                                Read on site
                              </a>
                            )}
                            <a href={`/api/assets/${v.id}?download=1`}>
                              Download original PDF
                            </a>
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>}
                  <section className="access-policy" aria-labelledby="rights-title">
                    <h2 id="rights-title">Rights and source</h2>
                    <details className="rights">
                      <summary>
                        <strong>
                          Rights: {doc.rights === "unknown" ? "Unknown" : doc.rights}.
                        </strong>{" "}
                        No reuse license is asserted.
                      </summary>
                      <p>
                        {doc.variants.some((v) => v.public_approved)
                          ? "Public reading and downloads are approved for archival access."
                          : "This record is available in the private archive; public access has not been approved."}
                      </p>
                    </details>
                    <p>
                      Source:{" "}
                      <a
                        href={`https://archive.org/details/${encodeURIComponent(doc.source_item)}`}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Internet Archive · {doc.source_item}
                      </a>
                    </p>
                    <p>
                      <a
                        href={`mailto:${contact}?subject=${encodeURIComponent(`Riot Grrrl Archive correction or removal: ${doc.metadata.title}`)}&body=${encodeURIComponent(`Document: ${new URL(`/documents/${doc.id}`, publicURL).href}\n\nRequest and supporting information:\n`)}`}
                      >
                        Request a correction or removal
                      </a>
                    </p>
                  </section>
                  <details className="provenance">
                    <summary>Preservation details</summary>
                    <p>Rights/access statement: {doc.rights}</p>
                    <p>Files are served from preserved local copies.</p>
                    {doc.variants.map((v) => (
                      <div key={v.id}>
                        <p className="edition-name">{v.filename}</p>
                        <p>
                          {megabytes(v.size)}. {textStatus(v)}
                        </p>
                        <p className="hash">SHA-256: {v.sha256}</p>
                      </div>
                    ))}
                  </details>
                </aside>
              </div>
            </article>
          ) : seriesPage ? (
            <SeriesIndex collection={collection} collectionID={collectionID} />
          ) : (
            <Catalog
              collection={collection}
              collectionID={collectionID}
              listing={listing}
              listingError={listingError}
              subjects={subjects}
              params={params}
              offsetLink={offsetLink}
              favorites={favorites}
            />
          )}
        </>
      )}
      {collectionID && !id && (
        <FavoriteShelf
          favorites={favorites}
          scope={collectionID}
          label={collection?.name}
          resolve={favoriteDocument}
        />
      )}
      {!id && <section className="about" id="about" aria-labelledby="about-title">
        <h2 id="about-title">About this archive</h2>
        <p>
          The Riot Grrrl Archive preserves feminist punk zines and serves
          original PDFs in a local reader. Catalog metadata and available
          document text are searchable. Source links identify the Internet
          Archive item each file came from.
        </p>
        <p>
          Public access is reviewed for each PDF variant. Availability here does
          not grant permission to reuse a document. Rights remain unknown unless
          stated, and This archive asserts no reuse license. Newly acquired
          editions remain private until reviewed.
        </p>
        <p>
          For corrections or removal requests, contact{" "}
          <a href={`mailto:${contact}`}>{contact}</a> with the document link and
          details of your request. Access can be withdrawn while preservation
          and decision records remain in the private archive.
        </p>
      </section>}
      <footer>
        <span>Riot Grrrl Archive · Preserved with Arkhiv</span>
        <a href={id ? "/#about" : "#about"}>About, rights and contact</a>
        <a href="https://subcult.tv/support">Support SUBCULT’s archive software</a>
      </footer>
    </main>
  );
}
