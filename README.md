# CRISPR Evolution Workbench frontend

Static React frontend for the public CRISPRidentify v2, SpacerPlacer, and CRISPR-evOr web workflow.

## Built-in example

“Run example” fetches `public/example-input.fasta` and `public/example-result.json`. The FASTA uses the neutral headers `example_record_01` through `example_record_11`; the result omits organism, strain, accession, coordinate, and source-record identity.

The browser verifies raw and normalized SHA-256 bindings and initially only copies the masked FASTA into the text field. When the user presses “Compute,” the exact input and recorded options reveal the matching cached four-stage result locally. Loading and computing the unchanged example submit no API request, create no job, and consume no analysis-worker compute; edited input or options use the normal server path.

## Development

```bash
npm ci
npm test
VITE_API_BASE_URL=https://crispr-evor-web-server.tail58d78e.ts.net \
  VITE_BASE_PATH=/crispr-evolution-web/ npm run build
```

`npm run build` also runs `scripts/scan-public-example.mjs`, which validates the masked FASTA and precomputed snapshot, checks both SHA-256 bindings and exact header order, rejects unexpected sequence assets, and rejects source-identity metadata.

API origin: https://crispr-evor-web-server.tail58d78e.ts.net
