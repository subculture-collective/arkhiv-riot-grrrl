# Shared core: live layout, upgrades and rollback

Since November 14, 2026 (arkhiv#54) riot-grrrl.subcult.tv's `/api` is the shared
Arkhiv core in print compatibility mode, not the API in `backend/`. The frontend
is unchanged. `deploy/core-release.json` records the reviewed core release and
`deploy/archive-core.env` pins its immutable image digest.

## Live layout on Almaz

| Part | Where |
|---|---|
| Compose project | `riot-grrrl-core` in `/mnt/spektr/server/data/riot-grrrl-core/`; its `compose.yml` is `deploy/core-compose.yml` |
| Settings | `.env` there: `ARCHIVE_ENGINE_IMAGE` (the bootstrap pin), `ARCHIVE_ROOT`, `CORE_SUBNET` |
| Database | service `db` (PostgreSQL 17, data in `runtime/database`), network alias `riot-grrrl-core-db` |
| Credentials | `runtime/` (mode 0700): owner password and URL for `operator`, URL of the read-only `arkhiv_reader` role for `core` |
| Core | service `core`, container `riot-grrrl-core-core-1`: `ARKHIV_COMPATIBILITY=print`, `ARKHIV_PUBLIC=1`, `VHNESS_COLLECTION=riot-grrrl`, archive mounted read-only at `/archive` |
| Routing | `core` joins the platform network `arkhiv-platform-public-20261004_archive` as `riot-grrrl-core`. The web container's nginx config (`/mnt/spektr/server/data/arkhiv-platform-20261004/runtime/riot-public-nginx.conf`, a host copy of `web/nginx.public.conf`) proxies `/api/` to `riot-grrrl-core:8080` |
| Legacy API | `arkhiv-platform-public-20261004-riot-public-api-1`, stopped and kept for rollback, with database `riot_grrrl` in `db-fast` |
| Cutover evidence | `cutover-20261114/` in the project directory: the pre-cutover dump of `riot_grrrl`, the migration plan and apply receipts, comparisons and the switch script |

The `arkhiv_reader` role has `default_transaction_read_only=on`. `migrate`
grants it SELECT on new tables because `operator` sets
`ARKHIV_READER_ROLE=arkhiv_reader`.

The database was built from `riot_grrrl` with `scripts/prepare_print_migration.py`
and `scripts/apply_print_migration.py` from the arkhiv repository, as rehearsed on
arkhiv#49. Document IDs, variant IDs and URLs are the legacy ones. The site no longer reads
`db-fast/riot_grrrl`; keep it for the legacy rollback below.

Set `c="docker compose --project-directory /mnt/spektr/server/data/riot-grrrl-core -p riot-grrrl-core"`
for the commands below.

## Automatic core deploys

The `changes` job in `.github/workflows/deploy.yml` compares the `version` in
`deploy/core-release.json` with the `core_version` that
`https://riot-grrrl.subcult.tv/api/version` reports. When they differ, when
`deploy/core.Dockerfile` changed since the last successful core deploy, or when
a manual run sets `deploy_core`,
the `core` job runs before the web job, provided the repository variable
`CORE_DEPLOY_ENABLED` is `true`. The job:

1. pulls the pinned digest and refuses an image whose digest, version or
   revision differs from the pin and `deploy/core-release.json`;
2. builds `deploy/core.Dockerfile` from that digest with an empty context. The
   wrapper adds labels only (source, this repository's revision, the core
   version and the core's revision); CI refuses it if its layers differ from the
   pin's;
3. sends the image to the `arkhiv-riot-grrrl-core` receiver profile with its own
   key (`HOMELAB_CORE_DEPLOY_KEY`) and runs `deploy REVISION`. On Almaz the
   receiver takes a validated dump of the core database
   (`~/.local/libexec/riot-core-predeploy-backup`, keeping the five newest in
   `backups/`), runs `operator migrate` with the new image, swaps `core`, checks
   `/api/ready`, a catalog request and `/api/version` (`core_version` against the
   image's `org.opencontainers.image.version`), and restores the previous image
   if a check fails;
4. fails with an annotation when the receiver refuses or rolls back, and
   otherwise checks the live `core_version` and records the deploy as a GitHub
   deployment with task `deploy:core` in the `production` environment. The
   `changes` job compares `deploy/core.Dockerfile` with that commit, so a wrapper
   change whose deploy failed carries forward to the next run. Before the first
   record exists, the core deploys once to create it.

The web job then deploys only `riot-public-web`. The web receiver profile
(`arkhiv-riot-grrrl`) no longer lists `riot-public-api`, so web deploys never
start the legacy API. The receipt and registration record are under
`~/.local/state/fleet-deploy/arkhiv-riot-grrrl-core/`.

## Deploy the core by hand

Back up the database first:

```sh
~/.local/libexec/riot-core-predeploy-backup
```

Then set `ARCHIVE_ENGINE_IMAGE` in `.env`, and run `$c --profile operator run --rm operator migrate`
followed by `$c up -d core`.

## Roll back to the legacy API

Tested on 2026-11-14 (switch to legacy, verify, switch forward again). The
switch script writes the nginx config in place, because it is a single-file bind
mount, and reloads nginx without recreating the web container:

```sh
S=/mnt/spektr/server/data/riot-grrrl-core/cutover-20261114/scripts/switch.sh
bash $S legacy   # start the legacy API, wait for health, point /api at riot-public-api:8080
bash $S core     # point /api at riot-grrrl-core:8080, check /api/version, stop the legacy API
```

On the legacy API `/api/version` returns 404 and `/api/ready` reports the
legacy revision. The original nginx config is kept beside the live one as
`riot-public-nginx.conf.before-core-20261114`. While the legacy API serves, an
automatic web deploy does not touch it; the original web profile is kept as
`~/.config/fleet-deploy/arkhiv-riot-grrrl.json.before-core-cutover-20261114`.

## Roll back a core upgrade

Migrations are additive. To return to the previous core image, use the
receiver's rollback overlay from the release receipt, or set the previous digest
in `.env` and run `$c up -d core`. A core older than the database schema may not
start; restore the matching pre-deploy dump from `backups/` into a separate
database first, and preserve newer writes before any restore.

The original document and variant identities, metadata, source history and
access decisions belong to the recovered archive. A core upgrade does not
approve additional media or change collection policy.
