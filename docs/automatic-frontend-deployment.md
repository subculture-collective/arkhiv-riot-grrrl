# Automatic public frontend deployment

Since November 10, 2026 GitHub Actions deploys this app. On every branch except
main, `.github/workflows/mirror-ci.yml` runs the full repository verification and
the browser suite, and builds the production images without registry or
deployment credentials. On main pushes and manual dispatches,
`.github/workflows/deploy.yml` builds the images, publishes them to GitHub
Packages, joins the tailnet and streams the frontend and API images to the
existing Almaz services. The Gitea `verify` workflow still runs the verification on main but no
longer deploys.

This app uses Compose services `riot-public-web` and `riot-public-api`
(containers `arkhiv-platform-public-20261004-riot-public-web-1` and
`arkhiv-platform-public-20261004-riot-public-api-1`) at
https://riot-grrrl.subcult.tv/. Until November 14, 2026 only the frontend was
deployed, and the API stayed on its October 4 image (`53cd3ec`). Deployment uses this repository's dedicated `HOMELAB_DEPLOY_KEY` and
pinned `HOMELAB_KNOWN_HOSTS`. The forced-command receiver is maintained in the
private `subculture-collective/fleet-deploy` repository. Its local profile permits
only this app and these two services, and deploys them together. It refuses stale commits and wrong-app
images, retains the live Compose configuration, verifies image identity,
resources, runtime overrides and public HTML, and restores the previous image
of both services if readiness fails. CI also compares the full public HTML with the image it
built. Private host receipts retain exact prior image IDs and rollback commands.

The homelab operator owns the key; its first rotation deadline is 2027-02-03.
Register and test the receiver/key before merging the pipeline. Keep prior
images, deployment files and receipts for recovery. Raw failure diagnostics stay
in mode-0600 host files and must not be attached to PRs or CI artifacts.

The shared core pins, database, media/archive mounts, public collection review,
original source metadata and engine release procedures retain their own
controls. This pipeline updates the frontend and the read-only public API of the
already public app. The public API runs no migrations; it does
not acquire content or publish additional material. Browser playback/reading,
audiovisual review, independent restore and deployment remain separate evidence.

The public image sets `CORE_UPSTREAM` to `riot-public-api:8080` at build time,
using Docker DNS to reach the existing collection-specific API. The default
`api:8080` remains suitable for the isolated local stack. On Almaz the receiver
uses a locally reviewed Compose baseline with only these two services and their
registered runtime guards, so it can deploy without reading sibling services’
private env files. The API image sets `ARKHIV_REVISION` from the commit it was
built from, so `/api/ready` reports the deployed revision.

The nginx config the public web container uses is a host copy of
`web/nginx.public.conf` (with `public-api` renamed to `riot-public-api`),
bind-mounted over the image's config. It is not deployed with the image: after
changing `web/nginx.public.conf`, update the host copy in place and reload nginx.

Before building on main, CI queries the receiver for already accepted images
for that exact commit. A retry reuses those immutable images and the public
HTML hash, and receives only an image the receiver does not yet have. PRs still build and run the nginx
configuration check; the existing verification gate also remains on every run.
