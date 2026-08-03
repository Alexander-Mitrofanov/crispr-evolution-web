# CRISPR Evolution Workbench frontend

Static React frontend for the public CRISPRidentify v2, SpacerPlacer, and CRISPR-evOr web workflow.

## Built-in biological example

“Explore Klebsiella publication cohort” fetches one precomputed JSON snapshot from `public/example-klebsiella-g768-reference-v1.json`. The snapshot is derived from the local CRISPR-evOr publication bundle `g_768_klebsiella_pneumoniae_I-E` and contains 12 exact NCBI accessions with 1-based inclusive coordinates, publication orientation classes, and derived pipeline summaries.

The public example hosts genome references only. It does not host nucleotide bases, repeat/spacer strings, alignments, complete run payloads, bearer credentials, artifact URLs, sequence files, or sequence-file hashes. Opening the example does not populate the FASTA form and does not submit a job.

The snapshot demonstrates the full workflow: CRISPRidentify detects arrays from referenced genomic context, the integration adapter selects comparable cohorts, SpacerPlacer reconstructs spacer gain/loss histories, and CRISPR-evOr compares forward versus reverse likelihoods while preserving uncertainty. CRISPRidentify v2 and other tools may change future fresh-run results; the bundled snapshot is version-bound to its recorded backend/scientific release identities.

## Development

```bash
npm ci
npm test
VITE_API_BASE_URL=https://crispr-evor-web-server.tail58d78e.ts.net \
  VITE_BASE_PATH=/crispr-evolution-web/ npm run build
```

`npm run build` also runs `scripts/scan-public-example.mjs`, which validates the reference-only snapshot and fails if public assets contain stale example files, sequence-like assets, long IUPAC-only strings, private payload fields, repeat-derived IDs, or other forbidden public payloads.

API origin: https://crispr-evor-web-server.tail58d78e.ts.net
