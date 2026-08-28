# Bundled-example boundary

This feature verifies the public, precomputed demonstration before it reaches
the submission UI:

- `contract.js` owns schema constants and small validation predicates.
- `newick.js` validates the bounded tree grammar used by the snapshot.
- `reconstruction.js` cross-checks trees, node states, and reported metrics.
- `snapshot.js` validates public metadata, privacy rules, and teaching claims.
- `input.js` binds the snapshot to the exact masked FASTA bytes.

Keep validators framework-neutral and fail closed. UI components should import
the stable facade at `src/example.js`, not feature internals.
