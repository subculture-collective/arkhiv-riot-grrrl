# Automatic public frontend deployment

Since November 10, 2026 GitHub Actions deploys this app. On every branch except
main, `.github/workflows/mirror-ci.yml` runs the full repository verification and
the browser suite, and builds the production images without registry or
deployment credentials. On main pushes and manual dispatches,
`.github/workflows/deploy.yml` builds the images, publishes them to GitHub
Packages, joins the tailnet and streams the frontend image to the existing Almaz
service. The Gitea `verify` workflow still runs the verification on main but no
longer deploys.

This app uses Compose service `riot-public-web`, container `arkhiv-platform-public-20261004-riot-public-web-1`, at
https://riot-grrrl.subcult.tv/. Deployment uses this repository's dedicated `HOMELAB_DEPLOY_KEY` and
pinned `HOMELAB_KNOWN_HOSTS`. The forced-command receiver is maintained in the
private `subculture-collective/fleet-deploy` repository. Its local profile permits
only this app and frontend service. It refuses stale commits and wrong-app
images, retains the live Compose configuration, verifies image identity,
resources, runtime overrides and public HTML, and restores the previous image
if readiness fails. CI also compares the full public HTML with the image it
built. Private host receipts retain exact prior image IDs and rollback commands.

The homelab operator owns the key; its first rotation deadline is 2027-02-03.
Register and test the receiver/key before merging the pipeline. Keep prior
images, deployment files and receipts for recovery. Raw failure diagnostics stay
in mode-0600 host files and must not be attached to PRs or CI artifacts.

The shared core pins, database, media/archive mounts, public collection review,
original source metadata and engine release procedures retain their own
controls. This pipeline updates the frontend of the already public app; it does
not acquire content or publish additional material. Browser playback/reading,
audiovisual review, independent restore and deployment remain separate evidence.

The public image sets `CORE_UPSTREAM` to `riot-public-api:8080` at build time,
using Docker DNS to reach the existing collection-specific API. The default
`api:8080` remains suitable for the isolated local stack. On Almaz the receiver
uses a locally reviewed frontend-only Compose baseline and its registered runtime
guard, so it can deploy without reading sibling services’ private env files.

Before building on main, CI queries the receiver for an already accepted image
for that exact commit. A retry reuses that immutable image and its public HTML
hash, skipping image rebuild/publication. PRs still build and run the nginx
configuration check; the existing verification gate also remains on every run.
