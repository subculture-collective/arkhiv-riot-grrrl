# Riot Grrrl Zine Archive

![Riot Grrrl Zine Archive identity](docs/brand/arkhiv-riot-grrrl/readme-lockup.png)

A catalog and reader for preserved Riot Grrrl zines: *Girl Germs*, *VOOP*, *Drop Babies*, *Violet*, *No Apologies*, *Personality Liberation Front* and related feminist punk zines. Each record keeps the original scan, any text that could be extracted, its source history and a note on rights.

The zines come from Internet Archive items listed in [`collections/riot-grrrl.yaml`](collections/riot-grrrl.yaml). Their rights are unknown, and the archive does not grant any reuse license. Titles and dates follow the source records. To ask for a correction or removal, write to info@subcult.tv.

Public site: https://riot-grrrl.subcult.tv/

This repository is a separate copy of SUBCULT's Arkhiv archive software with its own collection, catalog design and deployment. It shares no data with the other archives built on that software.

## Features

For readers:

- A catalog of covers with search across metadata and page text, subject filters and a choice of layouts.
- Document pages with editions, pages, source details and rights notes.
- An on-site PDF reader (PDF.js) with a reading focus mode, and search inside documents that have extracted text.
- Downloads of the original preserved files.
- Favorites saved in your browser, and share links.

For operators, the `arkhiv` CLI:

- Plans and acquires explicitly selected source files in bounded, resumable batches, and keeps the original bytes with their SHA-256 hashes.
- Extracts text and cover images, and supports editorial edits and grouping of editions without changing the source metadata.
- Refreshes the source inventory and queues added, changed or removed files for review instead of publishing them.
- Approves or withdraws public access per file from a reviewed manifest.
- Audits stored files, and backs up and restores the catalog and archive.

## Quick start

Requirements: Go 1.26, Node.js 24, pnpm 10.33.0 and Docker with Compose.

Run everything in containers:

```sh
cp .env.example .env    # then choose a local database password
docker compose up --build
```

The web app is served on http://localhost:5175 and the API on port 8082 (both loopback, set by `WEB_PORT` and `API_PORT`).

Or run the API and frontend directly against a PostgreSQL 17 database. The API does not read `.env`; export `DATABASE_URL` and an archive folder first (migrations are applied from `../migrations` at startup):

```sh
export DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/DB?sslmode=disable
export ARKHIV_ARCHIVE=$PWD/var/archive
make dev-api    # Go API from backend/cmd/app
make dev-web    # Vite on port 5173
```

Vite proxies `/api` to `http://127.0.0.1:8080`. Set `ARKHIV_DEV_API` to use another API address.

Checks:

```sh
make verify               # Go format, vet and tests; web typecheck, lint, tests and build; Compose config; dependency pins
make test-browser         # desktop and narrow-screen browser tests in a disposable Docker stack
make test-operations      # Python tests for the scheduled job scripts
make test-integration     # catalog, search, asset and recovery tests; needs a disposable TEST_DATABASE_URL
```

## Configuration

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | API, CLI | PostgreSQL connection string |
| `API_ADDR` | API | Listen address |
| `ARKHIV_ARCHIVE` | API, CLI | Root folder of preserved files |
| `MIGRATIONS_DIR` | API | Folder of SQL migrations, applied at startup |
| `ARKHIV_PUBLIC` | API | Set to `1` to serve only publicly approved files, without running migrations |
| `ARKHIV_REVISION` | API | Revision string reported by the server |
| `VITE_PUBLIC_URL` | Web build | Canonical public address; the current origin is used when unset |
| `VITE_CORRECTION_CONTACT` | Web build | Address for correction and removal requests |

Local Compose also reads `PROJECT_NAME`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT`, `API_PORT` and `WEB_PORT` from `.env` (see [`.env.example`](.env.example)), and `ARKHIV_ARCHIVE_PATH` for the archive folder.

The collection itself (source items, selected files, size and batch limits, update policy) is defined in [`collections/riot-grrrl.yaml`](collections/riot-grrrl.yaml). Public access is granted by the reviewed manifest [`collections/riot-grrrl-public-review.json`](collections/riot-grrrl-public-review.json).

## Operator commands

Build the CLI with `make build`, then run `bin/arkhiv <command> --config ../collections/riot-grrrl.yaml` from `backend/`. Commands include:

| Command | Purpose |
| --- | --- |
| `migrate` | Apply database migrations |
| `plan`, `acquire` | Preview and run a bounded acquisition |
| `refresh`, `changes`, `review-change`, `acquire-changes` | Check the source for changes, list them, decide on each, and fetch approved changes |
| `list`, `inspect`, `edit`, `group` | Inspect documents, apply editorial overrides, group editions |
| `extract` | Extract text and covers |
| `publish`, `unpublish` | Publish documents in the private catalog |
| `approve-public`, `revoke-public` | Grant or withdraw public access from a reviewed manifest |
| `audit`, `backup`, `restore` | Check stored files, back up and restore |

[`docs/runbooks/source-updates.md`](docs/runbooks/source-updates.md) explains the source refresh and change review process.

## Deploy

The repository builds two images:

- [`backend/Dockerfile`](backend/Dockerfile): the API and the `arkhiv` CLI, with migrations, collection files, `poppler-utils` and the PostgreSQL client. The API listens on port 8080 and stores files under `/data/archive`.
- [`web/Dockerfile`](web/Dockerfile): the static frontend on nginx. [`web/nginx.public.conf`](web/nginx.public.conf) is the configuration for a public site.

For a public deployment, run migrations and acquisition with an operator database role, then start the API with `ARKHIV_PUBLIC=1`, a read-only database role and a read-only archive mount. Approve files with `approve-public` before they appear. Serve the frontend over HTTPS.

## Project layout

```text
backend/       Go API (cmd/app) and operator CLI (cmd/arkhiv)
web/           React and Vite frontend with the PDF reader
migrations/    SQL migrations
collections/   Collection configuration and public access manifest
scripts/       Browser test stack and scheduled job scripts
deploy/        Shared-engine Compose file and version pins
docs/          Brand assets, design studies, plans and runbooks
```

## Contributing

- Bugs and feature requests: [GitHub issues](https://github.com/subculture-collective/arkhiv-riot-grrrl/issues).
- Code: pull requests on GitHub against `main`. CI runs `make verify`, the browser tests and a production image build on every pull request. All must pass.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

The software is licensed under GPL-3.0-only. See [LICENSE](LICENSE). The license does not apply to the archived zines, whose rights remain with their creators.
