# Stylesheet ownership

The stylesheet entry point is `index.css`. Import order preserves the cascade.

- `foundation.css` — design tokens, element defaults, focus, and utilities
- `shell.css` — navigation and compact hero layout; the attributed evOr visual is component-scoped
- `submission/` — workflow layout, input, readiness, options, and actions
- `jobs.css` — recovery, status, progress, and job actions
- `results/` — base, group, orientation, reconstruction, and provenance/download views;
  `results/history/` further separates story, controls, hypotheses, canvas, and ancestry
- `content.css` — primary publication references
- `refinements/` — final polish split by global/shell, submission, jobs, results, and content
- `responsive/` — tablet, mobile, compact, accessibility, and print overrides

Prefer a component's domain file. Preserve the listed `refinements/` import
order when a final override is required. Keep media and forced-color overrides
in the narrowest matching file under `responsive/`.
