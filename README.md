# CRISPRloci v2 frontend

Static Vue 3 frontend for CRISPRidentify v2, CasAndra, CRISPRtracrRNA v3,
SpacerPlacer and evOr workflows. It is built with Vite and contains no server-side runtime or secrets.

## Structure

The implementation intentionally uses small files so independent changes and
reviews stay local:

- `src/App.vue` composes the page and owns no scientific rendering details.
- `src/components/submission/` contains input, mode, readiness, and option controls.
- `src/components/jobs/` contains capability-link recovery and progress flows.
- `src/components/catalog/` presents the read-only reference database, with state in
  `src/composables/useCatalog.js` and scientific formatting in `src/features/catalog/`.
- `src/components/results/` contains vertical overview, orientation,
  reconstruction, history, and publication slices behind `ResultsView.vue`.
- `src/components/shell/` and `src/components/common/` contain layout and shared UI.
- `src/composables/` owns service configuration and in-memory job session state.
- `src/utils/` contains framework-neutral formatting, Newick, result, and download helpers.

Bearer capabilities stay in memory and in the explicit `#job=` recovery fragment. URL fragments
are client-side and are not included in HTTP requests, so API calls still carry the capability only
in the Authorization header. The complete recovery link is a bearer secret and must be kept private.
Capabilities are never stored in cookies, local storage, or session storage.

## Spacer searches

Choose **Spacer searches** on the main page, then select a direction:

- **Find spacers in my sequence:** submit target DNA to find full-length exact
  reference-spacer matches on both strands, using the NCBI-hosted 2017 research
  spacer collection.
- **Find viruses for my spacers:** submit one DNA spacer per FASTA record and
  choose 0, 1 or 2 substitutions. The server searches viral RefSeq with BLAST+
  and retains full-length ungapped alignments. Eligible spacers are 18–80 nt;
  shorter or ambiguous records are reported as skipped. The displayed service
  record and request limits also apply.

Both modes appear only when their server reference is configured. The two forms
keep separate drafts while switching direction. Results show coordinates, strands,
reference identity, and complete JSON/TSV downloads. Viral results can be filtered
by spacer, accession or title and summarize support from distinct spacer sequences.
BLAST retrieval is heuristic; matches do not establish infection, host range or
functional targeting. PAM compatibility and CRISPR-array overlap are not evaluated.
Reference databases stay on the server and are not bundled with this frontend.

`python scripts/browser_spacer_searches.py --origin http://127.0.0.1:4187 --output
/tmp/spacer-browser` verifies both UI flows against an already running build using
intercepted synthetic API responses. Build with `VITE_API_BASE_URL=https://analysis.example.org`
and serve the Vite preview on port 4187 first. This browser check makes no live jobs.

## Reference database

The main page's **Search the database** option and the **Database** navigation link
open `?view=database` while preserving any active job recovery
fragment. Public catalog requests use the same configured API origin and never include
job credentials. The dataset is served by the API; database files are not bundled in this
static public frontend.

The initial page shows only a search form. Select accession number, repeat, spacer or
Cas gene, enter a specific value, and submit it. No records are fetched before submission;
editing the input or changing the search type clears results and cancels pending reads.
Accessions must be complete and versioned. Repeat/spacer queries match exact nucleotide
sequences globally. Cas queries match original annotations/profiles or explicit gene-name
tokens from those labels, ignoring case. The API's snapshot-pinned search index supports
these global searches. Every result uses bounded pagination; an empty intermediate page
can still have a next page. Coverage, provenance and scientific limits are collapsed
beneath submitted results.

Arrays link to ordered repeat and spacer occurrence pages. Unknown values stay unknown;
deletions use explicit 0-based interbase boundaries rather than invented intervals or
sequences. Cas evidence retains caller scores and flags without treating predictions as
experimentally established. Downloads contain only the currently displayed page: CSV
includes all public record fields, and FASTA includes observed sequences (or explicitly
labelled array repeat consensus). Repeats and spacers are occurrences, not unique families.

From the private monorepo, `backend/.venv/bin/python scripts/browser_catalog.py --origin
http://127.0.0.1:5173` checks the running frontend against a configured, imported catalog
with its exact-search index. It checks the empty initial screen, explicit searches,
genome context, details, downloads, browser history and mobile layout, saving screenshots under
`output/playwright/catalog/`. It starts no services and submits no analysis jobs.

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

The frontend writes the active credential to a strict `#job=<locator>.<token>` fragment so reloading
or copying the current page can recover the job. The fragment is never sent to GitHub Pages or the
API, but it is visible in browser history and to scripts on the same origin; anyone holding the full
link can access that job until expiry. API requests omit cookies and use no-store and no-referrer
policies plus an Authorization header. No capability enters an API URL, local storage, or session
storage. Two jobs can coexist in the durable queue and complete independently, including when users
share one NAT address under the configured per-client allowance.

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
VITE_BASE_PATH=/YOUR-FRONTEND-REPOSITORY/ \
npm run build
```

`VITE_API_BASE_URL` must be an origin without a path, query, credentials, or
fragment; production builds fail closed when it is missing or invalid.
`VITE_BASE_PATH` is normalized to one leading and trailing `/`, so both
`YOUR-FRONTEND-REPOSITORY` and `/YOUR-FRONTEND-REPOSITORY/` produce the same base.

The public repository contains the contents of this directory at its root.
Consequently, `.github/workflows/pages.yml` here is intentionally shaped for a
frontend-only checkout; it is not the private monorepo workflow. Export through
`../deploy/export-pages-frontend.sh` so dotfiles are included and private
backend/scientific directories cannot cross the publication boundary.

The build also runs scripts/scan-public-example.mjs. The scanner validates the snapshot and both SHA-256 bindings in public and dist, permits the intended FASTA asset, rejects unexpected sequence assets, and rejects superseded example material.

Production origin is chosen at deployment; no production site is changed by this migration.

API origin: <https://crispr-evor-web-server.tail58d78e.ts.net>
