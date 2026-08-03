# CRISPR Evolution Workbench frontend

Static React/Vite frontend for GitHub Pages. The analysis API is operator-provided at build time. Job credentials exist only in the current tab's React memory, are sent in `Authorization` headers, and are never added to URLs or browser storage. A user can explicitly download a versioned recovery JSON file and must protect it like a password until the job expires.

## Local development

```bash
cp .env.example .env.local
npm ci --ignore-scripts
npm run dev
```

Use an HTTPS API URL in production. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `::1` during development.

## GitHub Pages

Create the repository variable `VITE_API_BASE_URL` with the public HTTPS origin of the de.NBI API. The Pages workflow derives the correct project-site base path from the repository name, tests the application, builds it, and deploys the static artifact.

For the production repository, the public settings are:

```text
repository: Alexander-Mitrofanov/crispr-evolution-web
site:       https://alexander-mitrofanov.github.io/crispr-evolution-web/
API origin: https://crispr-evor-web-server.tail58d78e.ts.net
```

The workflow deploys only `main`; a manual run selected on another branch is
rejected. Configure Pages to use GitHub Actions (`build_type=workflow`) and set
the repository variable before the first push so the initial deployment is not
an intentionally failed run.

The backend must allow the final Pages origin in its CORS allowlist. No secret is required to build the frontend: `VITE_API_BASE_URL` is a public endpoint, not a credential.

GitHub project Pages sites share an origin with other repositories under the same account. Memory-only credentials prevent passive cross-project storage reads, but a compromised sibling Pages deployment could still attack an open tab. A dedicated custom hostname is the preferred production isolation boundary.

GitHub Pages does not let this project emit operator-controlled response headers such as `Content-Security-Policy: frame-ancestors 'none'` or `X-Frame-Options`, and an HTML meta policy cannot enforce `frame-ancestors`. As a fail-closed defense, `index.html` ships the application, skip link, and framed-load notice hidden. The boot guard mounts React only after confirming that the page is its own top-level browsing context; framed or inaccessible ancestry reveals only an “open in a new tab” notice, so no analysis API request or sequence submission UI starts in the frame. This is defense in depth, not a substitute for a dedicated hostname behind an edge that sets response headers.

The public Pages interface is for non-sensitive research data only. Do not submit personal, clinical, controlled, or unpublished sensitive sequences. Use an institutionally approved private route for those data.
