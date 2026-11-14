# Automatic public frontend deployment

Since November 10, 2026 GitHub Actions deploys this app. On every branch except
main, `.github/workflows/mirror-ci.yml` runs the full repository verification and
the browser suite, and builds the production images without registry or
deployment credentials. On main pushes and manual dispatches,
`.github/workflows/deploy.yml` builds the frontend image, publishes it to GitHub
Packages, joins the tailnet and streams it to the existing Almaz service. When
the core pin changes it first deploys the shared core (see
[`runbooks/shared-core-release.md`](runbooks/shared-core-release.md)). The Gitea
`verify` workflow still runs the verification on main but no longer deploys.

The frontend is Compose service `riot-public-web` (container
`arkhiv-platform-public-20261004-riot-public-web-1`) at
https://riot-grrrl.subcult.tv/. From November 14, 2026 until the core cutover
the same job also deployed the API in `backend/` (`riot-public-api`); that
container is now stopped and kept only for rollback, and the web receiver
profile no longer lists it. Deployment uses this repository's dedicated
`HOMELAB_DEPLOY_KEY` and pinned `HOMELAB_KNOWN_HOSTS`. The forced-command
receiver is maintained in the private `subculture-collective/fleet-deploy`
repository. Its local profile permits only this app's web service. It refuses
stale commits and wrong-app images, retains the live Compose configuration,
verifies image identity, resources, runtime overrides and public HTML, and
restores the previous image if readiness fails. CI also compares the full
public HTML with the image it built. Private host receipts retain exact prior
image IDs and rollback commands.

The homelab operator owns the key; its first rotation deadline is 2027-02-03.
Register and test the receiver/key before merging the pipeline. Keep prior
images, deployment files and receipts for recovery. Raw failure diagnostics stay
in mode-0600 host files and must not be attached to PRs or CI artifacts.

The shared core pins, database, media/archive mounts, public collection review,
original source metadata and engine release procedures retain their own
controls. This job updates only the frontend of the already public app; it does
not acquire content or publish additional material. Browser playback/reading,
audiovisual review, independent restore and deployment remain separate evidence.

The public image sets `CORE_UPSTREAM` to `riot-grrrl-core:8080` at build time,
using Docker DNS to reach the core's alias on the platform network. The default
`api:8080` remains suitable for the isolated local stack. On Almaz the receiver
uses a locally reviewed Compose baseline and its registered runtime guard, so
it can deploy without reading sibling services' private env files.

The nginx config the public web container uses is a host copy of
`web/nginx.public.conf` (with `public-api:8080` replaced by
`riot-grrrl-core:8080`), bind-mounted over the image's config. It is not
deployed with the image: after changing `web/nginx.public.conf`, update the
host copy in place (it is a single-file bind mount, so keep its inode) and
reload nginx.

Before building on main, CI queries the receiver for an already accepted image
for that exact commit. A retry reuses that immutable image and the public HTML
hash instead of rebuilding it. PRs still build and run the nginx configuration
check; the existing verification gate also remains on every run.
