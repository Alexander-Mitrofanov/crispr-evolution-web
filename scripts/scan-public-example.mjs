#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { EXAMPLE_FASTA_PATH, EXAMPLE_RESULT_PATH, validateExampleInput } from "../src/example.js";

const roots = ["public", "dist"].filter((root) => existsSync(root));
const sequenceExtension = /\.(?:fa|fasta|fna|ffn|fas)$/i;
const forbiddenIdentityMetadata =
  /(?:(?:CP|FR|LN|LR|AP)\d{6}|(?:organism|strain|accession|ncbi_url|region_start_1based|region_end_1based)\s*[=:"])/i;

function fail(message) {
  throw new Error(message);
}

function walk(root) {
  const files = [];
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) files.push(...walk(path));
    else if (stat.isFile()) files.push(path);
  }
  return files;
}

for (const root of roots) {
  const fastaPath = resolve(root, EXAMPLE_FASTA_PATH);
  const resultPath = resolve(root, EXAMPLE_RESULT_PATH);
  if (!existsSync(fastaPath) || !existsSync(resultPath)) {
    fail(`bound example assets are missing from ${root}`);
  }
  const sequenceAssets = walk(root).filter((path) => sequenceExtension.test(path));
  if (sequenceAssets.length !== 1 || resolve(sequenceAssets[0]) !== fastaPath) {
    fail(
      `unexpected public sequence asset set in ${root}: ${sequenceAssets.map((path) => relative(root, path)).join(", ")}`,
    );
  }
  const fasta = readFileSync(fastaPath, "utf8");
  const snapshot = JSON.parse(readFileSync(resultPath, "utf8"));
  await validateExampleInput(snapshot, fasta);
  const headers = fasta.split(/\r?\n/).filter((line) => line.startsWith(">"));
  const expectedHeaders = snapshot.example.records.map((record) => `>${record.record_id}`);
  if (
    headers.length !== expectedHeaders.length ||
    headers.some((header, index) => header !== expectedHeaders[index])
  ) {
    fail(`example FASTA headers are not fully masked in ${root}`);
  }
  if (
    forbiddenIdentityMetadata.test(fasta) ||
    forbiddenIdentityMetadata.test(JSON.stringify(snapshot))
  ) {
    fail(`source identity metadata is present in ${root}`);
  }
  for (const file of walk(root)) {
    if (!/\.(?:html|js|json|txt|css)$/i.test(file)) continue;
    const text = readFileSync(file, "utf8");
    if (
      forbiddenIdentityMetadata.test(text) ||
      forbiddenIdentityMetadata.test(relative(root, file))
    ) {
      fail(`source identity metadata is present: ${relative(root, file)}`);
    }
  }
}

console.log(
  JSON.stringify({
    scanned_roots: roots,
    stored_input: "sha256-bound",
    precomputed_result: "validated",
  }),
);
