#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import snapshot from "../public/example-klebsiella-g768-reference-v1.json" with { type: "json" };
import { validateExampleSnapshot } from "../src/example.js";

const roots = ["public", "dist"].filter((root) => existsSync(root));
const sequenceExtension = /\.(?:fa|fasta|fna|ffn|fas)$/i;
const stale = /example-related-isolates|example-listeria|Listeria monocytogenes|Show Listeria example result/i;
const fastaHeader = /^>[^\n\r]+[\n\r]+[ACGTRYSWKMBDHVN\s]{20,}/im;
const longIupac = /(?<![A-Za-z0-9])[ACGTRYSWKMBDHVN]{20,}(?![A-Za-z0-9])/gi;
const forbiddenText = /repeat_key|repeat_[0-9a-f]{8,}|raw_job|artifact_url/i;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function walk(root) {
  const files = [];
  if (!existsSync(root)) return files;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

try {
  validateExampleSnapshot(snapshot);
} catch (error) {
  fail(`public snapshot failed validation: ${error.message}`);
}

for (const root of roots) {
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file);
    if (sequenceExtension.test(file)) fail(`sequence-like asset is present: ${rel}`);
    const text = readFileSync(file, "utf8");
    if (stale.test(text) || stale.test(rel)) fail(`stale example text or asset is present: ${rel}`);
    const publicDataFile = /\.(?:json|html|txt|csv)$/i.test(file);
    if (publicDataFile && forbiddenText.test(text)) fail(`forbidden private/snapshot field is present: ${rel}`);
    if (fastaHeader.test(text)) fail(`FASTA-like content is present: ${rel}`);
    if (publicDataFile) {
      const matches = text.match(longIupac) || [];
      if (matches.length) fail(`long IUPAC-only scalar is present: ${rel}`);
    }
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(JSON.stringify({ scanned_roots: roots, snapshot: "ok" }));
