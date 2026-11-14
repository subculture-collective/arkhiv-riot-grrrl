import { useState } from "react";
import { catalogDocuments, creatorNames, seriesFor } from "./series";
import {
  originalDate,
  type Collection,
  type DocumentRecord,
  type Listing,
} from "./App";
import { FavoriteButton, type BrowserFavorites } from "./Preferences";

export function Cover({
  document: doc,
  eager = false,
}: {
  document: DocumentRecord;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const variant = doc.variants[0];
  return (
    <a
      className="publication-cover"
      href={`/documents/${doc.id}`}
      aria-label={`Open ${doc.metadata.title}`}
    >
      {variant && !failed ? (
        <img
          src={`/api/assets/${variant.id}/cover`}
          alt=""
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cover-fallback">
          <span>Cover unavailable</span>
          <strong>{doc.metadata.title}</strong>
          <span>Open document →</span>
        </div>
      )}
    </a>
  );
}

function SearchHits({ document: doc }: { document: DocumentRecord }) {
  return doc.hits.map((hit, index) => (
    <p className="search-hit" key={index}>
      <a
        href={`/documents/${doc.id}?read=1&variant=${hit.variant}${hit.page > 0 ? `&page=${hit.page}` : ""}`}
      >
        {hit.page > 0 ? `Page ${hit.page}` : "Document text"}
      </a>
      : {hit.snippet}
    </p>
  ));
}

type Layout = "grid" | "table";

export default function Catalog({
  collection,
  collectionID,
  listing,
  subjects,
  params,
  offsetLink,
  favorites,
}: {
  collection?: Collection;
  collectionID: string;
  listing: Listing | null;
  subjects: string[];
  params: URLSearchParams;
  offsetLink: (offset: number) => string;
  favorites: BrowserFavorites;
}) {
  // The layout lives in the URL so pagination, Back and a new search keep it.
  const [layout, setLayout] = useState<Layout>(
    params.get("layout") === "table" ? "table" : "grid",
  );
  const chooseLayout = (next: Layout) => {
    const q = new URLSearchParams(location.search);
    if (next === "table") q.set("layout", "table");
    else q.delete("layout");
    const search = q.toString();
    history.replaceState(
      history.state,
      "",
      `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
    );
    setLayout(next);
  };
  // Unfiltered catalog link that keeps the chosen layout.
  const everyDocument = `/?${new URLSearchParams({
    collection: collectionID,
    ...(layout === "table" ? { layout } : {}),
  })}`;
  const [creators, setCreators] = useState<string[] | null>(null);
  const series = seriesFor(collectionID);
  const activeSeries = series.find((s) => s.slug === params.get("series"));
  // Suggestions load the first time the creator field is used.
  const suggestCreators = () => {
    if (creators) return;
    setCreators([]);
    catalogDocuments<DocumentRecord>(collectionID)
      .then((docs) => setCreators(creatorNames(docs.map((d) => d.metadata.creator))))
      .catch(() => setCreators(null));
  };
  const riot = true;
  const unfiltered =
    !params.get("q") &&
    !params.get("subject") &&
    !params.get("creator") &&
    !params.get("series") &&
    !params.get("date_from") &&
    !params.get("date_to") &&
    !listing?.offset;
  const featured = unfiltered ? listing?.documents[0] : undefined;
  const branded =
    collection?.name ===
    (riot ? "Riot Grrrl Zine Archive" : "The Anarchist Zine Archive");
  return (
    <section className="catalog" id="catalog">
      <div className="front-heading">
        <p className="eyebrow">
          {collectionID.startsWith("fixture-")
            ? "Synthetic verification collection"
            : "Independent print / preserved collection"}
        </p>
        <h1>
          {branded ? (
            <>
              {riot ? (
                <span
                  className="cutletters"
                  role="img"
                  aria-label="Riot Grrrl"
                >
                  <span aria-hidden="true">
                    {"RIOT GRRRL".split("").map((letter, index) =>
                      letter === " " ? (
                        <i className="cutspace" key={index} />
                      ) : (
                        <b className="cutletter" key={index}>
                          {letter}
                        </b>
                      ),
                    )}
                  </span>
                </span>
              ) : (
                "ANARCHIST"
              )}
              <span className="archive-subtitle">Zine Archive</span>
            </>
          ) : (
            collection?.name || "Collection unavailable"
          )}
        </h1>
        <p className="collection-introduction">{collection?.introduction}</p>
      </div>
      {featured && (
        <section className="front-feature" aria-label="From the collection">
          <div className="feature-copy">
            <p className="eyebrow">From the collection</p>
            <h2>
              <a href={`/documents/${featured.id}`}>
                {featured.metadata.title}
              </a>
            </h2>
            <p>{featured.metadata.creator || "Creator unknown"}</p>
            <p>{originalDate(featured)}</p>
            <a className="feature-action" href={`/documents/${featured.id}`}>
              Open document ↗
            </a>
            <p className="feature-foot">
              Original PDFs · Read on site · Download
            </p>
          </div>
          <div className="feature-book">
            <Cover document={featured} eager />
          </div>
          {(listing?.documents.length || 0) > 1 && (
            <aside
              className="feature-contents"
              aria-label="More from the collection"
            >
              <p className="eyebrow">Also inside</p>
              {listing?.documents.slice(1, 4).map((doc) => (
                <a key={doc.id} href={`/documents/${doc.id}`}>
                  <strong>{doc.metadata.title}</strong>
                  <small>{doc.metadata.creator || "Creator unknown"}</small>
                </a>
              ))}
            </aside>
          )}
        </section>
      )}
      <div className="catalog-heading">
        <h2>
          {activeSeries
            ? activeSeries.name
            : params.get("q") || params.get("subject")
              ? "Search results"
              : "The collection"}
        </h2>
        <p role="status">
          {activeSeries
            ? `${listing?.total || 0} ${listing?.total === 1 ? "document" : "documents"} in this series`
            : `${listing?.total || 0} ${listing?.total === 1 ? "document" : "documents"}`}
          {params.get("q") ? ` matching “${params.get("q")}”` : ""}
        </p>
        {activeSeries && (
          <p className="series-links">
            <a href={`/series?collection=${encodeURIComponent(collectionID)}`}>
              All series
            </a>{" "}
            ·{" "}
            <a href={everyDocument}>Every document</a>
          </p>
        )}
      </div>
      <form method="get" action="/" className="search">
        <input type="hidden" name="collection" value={collectionID} />
        <label>
          Search titles and available text
          <input
            name="q"
            type="search"
            defaultValue={params.get("q") || ""}
            maxLength={200}
          />
        </label>
        <label>
          Subject
          <select name="subject" defaultValue={params.get("subject") || ""}>
            <option value="">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject}>{subject}</option>
            ))}
          </select>
        </label>
        {series.length > 0 && (
          <label>
            Series
            <select name="series" defaultValue={activeSeries?.slug || ""}>
              <option value="">All series</option>
              {series.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <button type="submit">Search</button>
        <label>
          Creator
          <input
            name="creator"
            defaultValue={params.get("creator") || ""}
            maxLength={200}
            list="creator-suggestions"
            autoComplete="off"
            onFocus={suggestCreators}
          />
          <datalist id="creator-suggestions">
            {creators?.map((name) => <option key={name} value={name} />)}
          </datalist>
        </label>
        <label>
          Original date from
          <input
            type="date"
            name="date_from"
            defaultValue={params.get("date_from") || ""}
          />
        </label>
        <label>
          Original date to
          <input
            type="date"
            name="date_to"
            defaultValue={params.get("date_to") || ""}
          />
        </label>
        {layout === "table" && (
          <input type="hidden" name="layout" value="table" />
        )}
        {params.get("language") && (
          <input
            type="hidden"
            name="language"
            value={params.get("language")!}
          />
        )}
      </form>
      <p>
        Date bounds match complete original source dates. Partial and unknown
        dates remain visible without a date bound.
      </p>
      <div role="group" aria-label="Catalog layout" className="catalog-layout">
        <button
          aria-pressed={layout === "grid"}
          onClick={() => chooseLayout("grid")}
        >
          Grid
        </button>
        <button
          aria-pressed={layout === "table"}
          onClick={() => chooseLayout("table")}
        >
          Table
        </button>
      </div>
      {listing?.documents.length === 0 && (
        <p className="notice">
          No documents match these filters.{" "}
          <a href={everyDocument}>Clear filters</a>
        </p>
      )}
      {layout === "table" ? (
        <div className="publication-table-wrap">
          <table>
            <caption>Document catalog</caption>
            <thead>
              <tr>
                <th scope="col">Document</th>
                <th scope="col">Original date</th>
                <th scope="col">Creator</th>
                <th scope="col">Editions and pages</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {listing?.documents.map((doc) => (
                <tr key={doc.id}>
                  <th scope="row">
                    <a href={`/documents/${doc.id}`}>{doc.metadata.title}</a>
                    <SearchHits document={doc} />
                  </th>
                  <td>{originalDate(doc)}</td>
                  <td>{doc.metadata.creator || "Unknown"}</td>
                  <td>
                    {doc.variants
                      .map(
                        (v) => `${v.filename} · ${v.pages || "Unknown"} pages`,
                      )
                      .join(" / ")}
                  </td>
                  <td>
                    <FavoriteButton
                      id={doc.id}
                      title={doc.metadata.title}
                      favorites={favorites}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="publication-grid">
          {listing?.documents.map((doc) => (
            <article key={doc.id} className="publication">
              <Cover document={doc} />
              <div className="publication-caption">
                <p className="publication-subjects">
                  {doc.metadata.subjects?.join(" / ")}
                </p>
                <h2>
                  <a href={`/documents/${doc.id}`}>{doc.metadata.title}</a>
                </h2>
                <p>
                  {doc.metadata.creator || "Creator unknown"} ·{" "}
                  {originalDate(doc)}
                </p>
                <FavoriteButton
                  id={doc.id}
                  title={doc.metadata.title}
                  favorites={favorites}
                />
                <p className="rights-label">
                  Rights: {doc.rights === "unknown" ? "Unknown" : doc.rights} ·
                  No reuse license asserted
                </p>
                <SearchHits document={doc} />
              </div>
            </article>
          ))}
        </div>
      )}
      {listing && (
        <nav className="pagination" aria-label="Catalog pages">
          {listing.offset > 0 && (
            <a href={offsetLink(Math.max(0, listing.offset - listing.limit))}>
              Previous
            </a>
          )}
          {listing.offset + listing.limit < listing.total && (
            <a href={offsetLink(listing.offset + listing.limit)}>Next</a>
          )}
        </nav>
      )}
    </section>
  );
}
