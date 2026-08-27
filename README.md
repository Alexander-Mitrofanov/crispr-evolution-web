# CRISPR Evolution Workbench frontend

Static Vue 3 frontend for the CRISPRidentify v2, SpacerPlacer, and CRISPR-evOr
workflow. It is built with Vite and contains no server-side runtime or secrets.

## Structure

The implementation intentionally uses small files so independent changes and
reviews stay local:

- `src/App.vue` composes the page and owns no scientific rendering details.
- `src/components/submission/` contains input, mode, readiness, and option controls.
- `src/components/jobs/` contains capability recovery, progress, and resume flows.
- `src/components/results/` contains one focused scientific result view per file.
- `src/components/shell/` and `src/components/common/` contain layout and shared UI.
- `src/composables/` owns service configuration and in-memory job session state.
- `src/utils/` contains framework-neutral formatting, Newick, result, and download helpers.

Bearer capabilities stay in memory unless the user explicitly exports a
recovery file. They are never stored in URLs, cookies, local storage, or session
storage.

## Bundled example

The “Run example” button loads two versioned static assets together:

- public/example-input.fasta: 5 spacer-rich records with neutral sequential headers, 8,380 bases total.
- public/example-result.json: the corresponding precomputed orientation-mode result from the four-stage pipeline, with source identity metadata removed.

The button verifies both FASTA SHA-256 bindings, checks record order, count, and base count, resets the form to the recorded analysis policy, and only copies the masked FASTA into the input textarea. No result is displayed yet. When the user presses “Compute,” the exact input and options are matched locally and the precomputed result is displayed without an API submission or analysis-worker compute. Edited input or changed options use the normal server submission path.

The precomputed result is a versioned demonstration bound to the exact masked input and recorded policy. It is used only for that exact request. A future tool update can change fresh-run output, so modified requests continue through the normal server workflow.

The snapshot demonstrates CRISPRidentify detection, integration/group eligibility, SpacerPlacer ancestral reconstruction, and CRISPR-evOr input-versus-reverse likelihood comparison. Its input-order call crosses the configured evidence threshold by ΔlnL +15.50. Both hypotheses require 42 first acquisitions, but the supported history needs 4 deletions and places 1 acquisition at the root; the reversed history needs 45 deletions and places all 42 acquisitions at the root.

The result view renders both hypotheses as responsive SVG rather than embedding the native PDF: rooted model topology, aligned leaf spacer states, branch gain/loss badges, and selectable inferred node states. Canonical numeric spacer IDs are stable across the two views; raw spacer identities are not included in the public summary. These trees and ancestral events are array-derived model estimates, not an independent organismal phylogeny or observed mutations.

## Independent users

Anonymous jobs use capability authorization instead of shared browser sessions. Every submission receives a random 128-bit job locator and a separate 256-bit bearer token; only the token digest is stored. There is no job-list endpoint. Status, cancellation, artifacts, and bundles all require the token bound to that job, and a wrong job/token pair returns the same 404 as an unknown job.

The frontend keeps a credential only in the current tab state unless the user explicitly downloads a recovery file. API requests omit cookies and use no-store and no-referrer policies plus an Authorization header. Tokens are never placed in URLs or browser storage. Two jobs can coexist in the durable queue and complete independently, including when users share one NAT address under the configured per-client allowance.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run dev
```

Build the deployable Pages artifact with an exact HTTPS API origin and project
base path:

```bash
VITE_API_BASE_URL=https://crispr-evor-web-server.tail58d78e.ts.net \
VITE_BASE_PATH=/crispr-evolution-web/ \
npm run build
```

`VITE_API_BASE_URL` must be an origin without a path, query, credentials, or
fragment; production builds fail closed when it is missing or invalid.
`VITE_BASE_PATH` is normalized to one leading and trailing `/`, so both
`crispr-evolution-web` and `/crispr-evolution-web/` produce the same base.

The public repository contains the contents of this directory at its root.
Consequently, `.github/workflows/pages.yml` here is intentionally shaped for a
frontend-only checkout; it is not the private monorepo workflow. Export through
`../deploy/export-pages-frontend.sh` so dotfiles are included and private
backend/scientific directories cannot cross the publication boundary.

The build also runs scripts/scan-public-example.mjs. The scanner validates the snapshot and both SHA-256 bindings in public and dist, permits the intended FASTA asset, rejects unexpected sequence assets, and rejects superseded example material.

Production frontend: <https://alexander-mitrofanov.github.io/crispr-evolution-web/>

API origin: <https://crispr-evor-web-server.tail58d78e.ts.net>
