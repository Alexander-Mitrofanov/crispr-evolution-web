# CRISPR Evolution Workbench frontend

Static React frontend for the public CRISPRidentify v2, SpacerPlacer, and CRISPR-evOr web workflow.

## Built-in example

“Run example” fetches `public/example-input.fasta` and `public/example-result.json`. The FASTA contains five spacer-rich records using the neutral headers `example_record_01` through `example_record_05`; the result omits organism, strain, accession, coordinate, and source-record identity.

The browser verifies raw and normalized SHA-256 bindings and initially only copies the masked FASTA into the text field. When the user presses “Compute,” the exact input and recorded options reveal the matching cached four-stage result locally. Loading and computing the unchanged example submit no API request, create no job, and consume no analysis-worker compute; edited input or options use the normal server path. The selected example forms one exact repeat group, reconstructs 42 acquisitions and 4 deletions, and crosses the evOr evidence boundary decisively (Delta lnL +15.50).

## Development

```bash
npm ci
npm test
VITE_API_BASE_URL=https://crispr-evor-web-server.tail58d78e.ts.net \
  VITE_BASE_PATH=/crispr-evolution-web/ npm run build
```

`npm run build` also runs `scripts/scan-public-example.mjs`, which validates the masked FASTA and precomputed snapshot, checks both SHA-256 bindings and exact header order, rejects unexpected sequence assets, and rejects source-identity metadata.

API origin: https://crispr-evor-web-server.tail58d78e.ts.net
