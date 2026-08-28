# Submission feature

`index.js` is the stable component-facing boundary. `useAnalysisForm.js` owns
form state, FASTA inspection, bounded example loading, submission transport,
and credential normalization. The SFCs in `components/submission/` only render
that state and emit user intent.

Keep backend calls and example fetches in this feature composable. Add pure
payload rules to `submission.js` or `fasta.js`, then cover the narrowest owning
module with a focused test.
