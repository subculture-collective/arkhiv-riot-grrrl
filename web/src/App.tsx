import { lazy, Suspense, useEffect, useState } from "react";
import Catalog from "./Catalog";
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
async function json<T>(url: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok)
    throw new Error(
      r.status === 404
        ? "This document is unavailable."
        : "The archive could not load. Please try again.",
    );
  return r.json();
}
// Catalog languages are ISO 639-2 codes ("eng"); show their English names.
const languageCodes: Record<string, string> = { eng: "en", fre: "fr", fra: "fr", ger: "de", deu: "de", spa: "es", ita: "it", por: "pt", dut: "nl", nld: "nl", jpn: "ja" };
export function languageName(code: string | undefined) {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(languageCodes[code] || code) || code;
  } catch {
    return code;
  }
}
export const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
export const textStatus = (v: Variant) =>
  v.text_status === "page-text"
    ? "Page text searchable."
    : v.text_status === "document-text"
      ? "Document text searchable; page mapping unavailable."
      : "Text search unavailable.";
export const originalDate = (doc: DocumentRecord) =>
  (doc.original_date === undefined ? doc.metadata.date : doc.original_date) ||
  "Date unknown";
export const selectVariant = (variants: Variant[], requested: string | null) =>
  requested ? variants.find((v) => v.id === requested) : variants[0];
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
export default function App() {
  const params = new URLSearchParams(location.search);
  const id = location.pathname.startsWith("/documents/")
    ? location.pathname.split("/")[2]
    : "";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [listing, setListing] = useState<Listing | null>(null);
  const [doc, setDoc] = useState<DocumentRecord | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [error, setError] = useState("");
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
          setDoc(d);
          setCollectionID(d.collection);
        }
      } else if (all.length) {
        const selected =
          new URLSearchParams(location.search).get("collection") || all[0].id;
        setCollectionID(selected);
        const q = new URLSearchParams(location.search);
        q.set("collection", selected);
        const [data, facets] = await Promise.all([
          json<Listing>(`/api/documents?${q}`, controller.signal),
          json<{ subjects: string[] }>(
            `/api/facets?collection=${encodeURIComponent(selected)}`,
            controller.signal,
          ),
        ]);
        if (active) {
          setListing(data);
          setSubjects(facets.subjects);
        }
      }
    }
    load()
      .catch((e) => {
        if (active)
          setError(
            controller.signal.aborted
              ? "The archive took too long to respond. Please try again."
              : e.message,
          );
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
  }, [id]);
  const collection = collections.find((c) => c.id === collectionID);
  const requestedVariant = params.get("variant");
  const variant = doc && selectVariant(doc.variants, requestedVariant);
  useEffect(() => {
    document.title = `${doc?.metadata.title || collection?.name || "Riot Grrrl zines"} · Riot Grrrl Archive`;
    let canonical = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.append(canonical);
    }
    canonical.href = new URL(
      id
        ? `/documents/${id}`
        : collectionID
          ? `/?collection=${encodeURIComponent(collectionID)}`
          : "/",
      publicURL,
    ).href;
  }, [doc, collection, collectionID, id]);
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
      </header>
      {loading && (
        <p role="status" className="notice">
          Loading the archive…
        </p>
      )}
      {error && (
        <div role="alert" className="notice">
          <p>{error}</p>
          <a href={location.href}>Try again</a>
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
          {doc ? (
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
                      <Suspense
                        fallback={<p role="status">Loading reader…</p>}
                      >
                        <Reader
                          variant={variant}
                          title={doc.metadata.title}
                          initialPage={Number(params.get("page") || 1)}
                        />
                      </Suspense>
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
          ) : (
            <Catalog
              collection={collection}
              collectionID={collectionID}
              listing={listing}
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
