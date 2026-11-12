# Shared print reader adoption

This frontend pins the `@subcult/archive-viewer` version recorded in
`deploy/viewer-release.json`; `scripts/check_viewer_pin.py` checks that
`web/package.json` and the lockfile match it. The receipt of the first adopted
version is kept in `docs/releases/archive-viewer-0.2.1.json`. The frontend imports reader controls from the exact published
`@subcult/archive-viewer/print` dependency. The catalog, collection branding,
document routes, PDF.js runtime/assets and asset-access policy remain owned here.
The local adapter preserves variant IDs, page links and text-coverage status.

Upgrades change the dependency, lockfile and release receipt together. Check
reader behavior in the isolated frontend and existing backend before deployment.
The shared engine is a migration candidate; this component adoption keeps the
existing backend/database and does not transfer archive or worker ownership.

Run `make verify` and the separate browser gate. Local checks, hosted CI,
real reading, independent recovery and public deployment are separate evidence.
