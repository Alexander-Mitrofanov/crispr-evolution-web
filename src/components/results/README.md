# Result feature slices

`ResultsView.vue` composes the canonical public summary and invokes request
lifecycles exposed by `features/results/`. Child directories own narrow
scientific or publication views:

- `overview/` — synopsis, detection, preflight, and evidence chain
- `orientation/` — likelihood comparison and orientation decision
- `reconstruction/` — selected history, events, model, and spacer inventory
- `history/` — tree layout, ancestral nodes, exact events, and interaction
- `publication/` — provenance and capability-protected downloads

Keep imports directed from the composition root into slices. A slice may use
shared utilities and common UI, but should not import another slice's internals
except the explicit reconstruction-to-history composition.
