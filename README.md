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

## Bundled examples

Every analysis method has an exact input and real precomputed output in
`public/examples/<method>/`. RNA repeats and Type V tracrRNA have separate
examples selected by their molecule/model option. Load example fills the input
and restores the recorded options. View precomputed result displays the normal
result components without submitting sequences, including when the API is offline.

All examples are generated with the pinned tools and reproduced by a second
independent worker job with the same input, options and references. Only execution
durations may vary. Input bytes, normalized sequences, counts and all submitted
options are checked before a stored result is used. Edited inputs or options use
the normal live submission path, which still requires the advertised capability.
The result includes input/output downloads and exact tool provenance.

Reference-dependent examples use small, explicitly labeled demonstration panels;
a fresh run using larger or different references can produce different matches.
Scientific uncertainty and missing values remain explicit. The older masked
orientation teaching assets remain validated for compatibility.

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
VITE_API_BASE_URL=https://analysis.example.org \
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

The build also runs scripts/scan-public-example.mjs. The scanner validates every example and its exact input binding in public and dist, permits only the declared sequence assets, and rejects source identities, capabilities and private paths. Synthetic viral identifiers and null reference accessions are allowed only within validated example contracts.

Production origin is chosen at deployment; no production site is changed by this migration.

API origin: configured by the operator at build time.
