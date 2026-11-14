import { useEffect, useState } from "react";
import { originalDate, type Collection, type DocumentRecord } from "./App";
import { Cover } from "./Catalog";
import {
  catalogDocuments,
  creatorNames,
  issueLabel,
  seriesFor,
  seriesLink,
} from "./series";

function years(docs: DocumentRecord[]) {
  const found = docs
    .map((doc) => originalDate(doc).match(/^\d{4}/)?.[0])
    .filter((year): year is string => !!year)
    .sort();
  if (!found.length) return "";
  return found[0] === found[found.length - 1]
    ? found[0]
    : `${found[0]}–${found[found.length - 1]}`;
}

export default function SeriesIndex({
  collection,
  collectionID,
}: {
  collection?: Collection;
  collectionID: string;
}) {
  const [docs, setDocs] = useState<Map<string, DocumentRecord> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    catalogDocuments<DocumentRecord>(collectionID)
      .then((all) => {
        if (active) setDocs(new Map(all.map((doc) => [doc.id, doc])));
      })
      .catch(() => {
        if (active) setError("The series could not load. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [collectionID]);
  const list = seriesFor(collectionID)
    .map((series) => ({
      series,
      issues: series.issues.flatMap((issue) => {
        const doc = docs?.get(issue.id);
        return doc ? [{ ...issue, doc }] : [];
      }),
    }))
    .filter((entry) => entry.issues.length > 0);
  return (
    <section className="series-index" aria-labelledby="series-heading">
      <div className="catalog-heading">
        <h1 id="series-heading">Series</h1>
        <p>
          {collection?.name ? `${collection.name}: ` : ""}each title the
          archive holds, with its issues in order.{" "}
          <a href={`/?collection=${encodeURIComponent(collectionID)}`}>
            Browse every document
          </a>
        </p>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error} <a href={location.href}>Try again</a>
        </p>
      )}
      {!docs && !error && (
        <p role="status" className="notice">
          Loading the series…
        </p>
      )}
      {docs && list.length === 0 && (
        <p className="notice">This collection has no series yet.</p>
      )}
      <div className="publication-grid series-grid">
        {list.map(({ series, issues }) => {
          const first = issues[0].doc;
          const span = years(issues.map((issue) => issue.doc));
          const creators = creatorNames(
            issues.map((issue) => issue.doc.metadata.creator),
          );
          return (
            <article key={series.slug} className="publication series-card">
              <Cover document={first} />
              <div className="publication-caption">
                <h2>
                  <a href={seriesLink(collectionID, series.slug)}>
                    {series.name}
                  </a>
                </h2>
                <p className="series-count">
                  {issues.length} {issues.length === 1 ? "issue" : "issues"}
                  {span ? ` · ${span}` : ""}
                </p>
                {creators.length > 0 && <p>{creators.join(", ")}</p>}
                <ol className="series-issues">
                  {issues.map((issue) => (
                    <li key={issue.id}>
                      <a href={`/documents/${issue.id}`}>
                        {issueLabel(issue.issue)}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
