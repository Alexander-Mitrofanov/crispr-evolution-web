import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { ApiError, api } from "./api.js";
import { inspectFasta, readableBases } from "./fasta.js";
import {
  EXAMPLE_FASTA_PATH,
  EXAMPLE_RESULT_PATH,
  validateExampleInput,
} from "./example.js";
import {
  normalizeJobCredential,
  parseJobCredential,
  serializeJobCredential,
} from "./jobStore.js";
import {
  ANALYSIS_MODES,
  TERMINAL_STATUSES,
  categoryClass,
  orientationLabel,
  stagesForMode,
} from "./science.js";
import { buildSubmission } from "./submission.js";

const INITIAL_OPTIONS = {
  categoryPolicy: "bona_fide_possible",
  spacerEditDistance: 1,
  biasCorrection: true,
};

const ACTIVE_STATUSES = new Set([
  "queued",
  "running",
  "validate_input",
  "detect_arrays",
  "adapt_arrays",
  "preflight_groups",
  "reconstruct_spacer_histories",
  "compare_orientations",
  "package_results",
]);

function preferredScrollBehavior() {
  return typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function revealSection(id, headingSelector = "h2") {
  const region = document.getElementById(id);
  if (!region) return;
  region.scrollIntoView({ behavior: preferredScrollBehavior(), block: "start" });
  region.querySelector(headingSelector)?.focus({ preventScroll: true });
}

function Icon({ name, size = 20 }) {
  const paths = {
    helix: <><path d="M6 3c8 4 8 14 0 18M18 3c-8 4-8 14 0 18"/><path d="M7.8 6h8.4M6.7 10h10.6M6.7 14h10.6M7.8 18h8.4"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 15v4h14v-4"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
    download: <><path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
    file: <><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5M10 13h5M10 17h5"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6z"/><path d="m9 12 2 2 4-5"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.1"/></>,
    warning: <><path d="M12 3 2.8 20h18.4z"/><path d="M12 9v5M12 17.5v.1"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    downRight: <><path d="m7 7 10 10M17 7v10H7"/></>,
    external: <><path d="M10 6H6v12h12v-4M13 5h6v6M19 5l-8 8"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    minus: <path d="M5 12h14"/>,
    tree: <><path d="M7 4v16M7 8h6M7 16h6"/><circle cx="16" cy="8" r="2"/><circle cx="16" cy="16" r="2"/></>,
  };
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || paths.info}
    </svg>
  );
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function formatDate(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toLocaleString() : "—";
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  return `${Math.floor(seconds / 60)} min ${Math.round(seconds % 60)} s`;
}

function readableBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "the configured service limit";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(bytes < 10 * 1024 ** 2 ? 1 : 0)} MiB`;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function getValue(source, ...keys) {
  for (const key of keys) {
    if (source && source[key] != null) return source[key];
  }
  return null;
}

const MAX_ADAPTER_MANIFEST_BYTES = 1_000_000;

function safeManifestText(value, maxLength = 240) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function safeManifestCount(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 100_000 ? number : null;
}

function sanitizeAdapterMembership(document) {
  if (!document || typeof document !== "object" || Array.isArray(document)) return [];
  return asArray(document.groups).slice(0, 100).map((group) => {
    if (!group || typeof group !== "object" || Array.isArray(group)) return null;
    const name = safeManifestText(group.name);
    if (!name) return null;
    const rawArrays = asArray(group.arrays);
    const arrays = rawArrays.slice(0, 200).map((array) => {
      if (!array || typeof array !== "object" || Array.isArray(array)) return null;
      return {
        source_id: safeManifestText(array.source_id) || "unknown",
        array_id: safeManifestText(array.array_id) || "unknown",
        category: safeManifestText(array.category, 80) || "unknown",
        spacer_count: safeManifestCount(array.spacer_count),
        strand: safeManifestText(array.strand, 32) || "unknown",
        input_sequence_orientation: safeManifestText(array.input_sequence_orientation, 32) || "unknown",
        ccdb_strand: safeManifestText(array.ccdb_strand, 32) || "unknown",
      };
    }).filter(Boolean);
    return {
      name,
      array_count: safeManifestCount(group.array_count),
      repeat_key: safeManifestText(group.repeat_key, 512),
      arrays,
      arrays_truncated: rawArrays.length > arrays.length,
    };
  }).filter(Boolean);
}

function adapterHasMembership(summary) {
  const groups = asArray(summary?.adapter?.groups);
  return groups.length > 0 && groups.every((group) => Number(group?.array_count) === 0 || asArray(group?.arrays).length > 0);
}

function mergeAdapterMembership(summary, membershipGroups) {
  if (!membershipGroups?.length || adapterHasMembership(summary)) return summary;
  const adapter = summary?.adapter;
  if (!adapter || typeof adapter !== "object") return summary;
  const membershipByName = new Map(membershipGroups.map((group) => [String(group.name), group]));
  const summaryGroups = asArray(adapter.groups);
  const groups = summaryGroups.length ? summaryGroups.map((group) => {
    const membership = membershipByName.get(String(group?.name));
    return membership ? { ...group, repeat_key: group?.repeat_key || membership.repeat_key, arrays: membership.arrays, arrays_truncated: membership.arrays_truncated } : group;
  }) : membershipGroups;
  return { ...summary, adapter: { ...adapter, groups } };
}

function statusCopy(status) {
  return {
    queued: "Queued",
    running: "Analysis running",
    validate_input: "Validating input",
    detect_arrays: "Detecting arrays",
    adapt_arrays: "Preparing arrays",
    preflight_groups: "Checking groups",
    reconstruct_spacer_histories: "Reconstructing histories",
    compare_orientations: "Comparing orientations",
    package_results: "Packaging results",
    completed: "Analysis complete",
    completed_no_eligible_groups: "Detection complete — no eligible evolutionary groups",
    failed: "Analysis failed",
    cancelled: "Analysis cancelled",
    expired: "Results expired",
  }[status] || "Waiting for status";
}

function downloadName(value, fallback) {
  const candidate = String(value || fallback).split(/[\\/]/).pop();
  return candidate.replace(/[^A-Za-z0-9._-]+/g, "_") || fallback;
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="CRISPR Evolution Workbench home">
      <span className="brand-symbol"><span/><span/><span/><span/></span>
      <span className="brand-copy">
        <strong>CRISPR Evolution</strong>
        <small>Workbench</small>
      </span>
    </a>
  );
}

function ServiceStatus({ service }) {
  const label = service.state === "online" ? "Analysis service ready" : service.state === "checking" ? "Checking service" : "Analysis service unavailable";
  const shortLabel = service.state === "online" ? "Ready" : service.state === "checking" ? "Checking" : "Offline";
  return (
    <div className={`service-status service-${service.state}`} role="status" aria-label={label}>
      <span className="status-pulse" aria-hidden="true" />
      <span className="status-label-full" aria-hidden="true">{label}</span>
      <span className="status-label-short" aria-hidden="true">{shortLabel}</span>
    </div>
  );
}

function Hero({ service }) {
  return (
    <header className="hero" id="top">
      <div className="nav-shell">
        <Brand />
        <nav aria-label="Primary navigation">
          <a href="#workflow">Workflow</a>
          <a href="#scope">Interpretation</a>
          <ServiceStatus service={service} />
        </nav>
      </div>
      <div className="hero-grid">
        <div className="hero-copy">
          <h1>From detected arrays to <em>evolutionary evidence.</em></h1>
          <p className="hero-lead">
            Analyze CRISPR spacer-array structure across related genomic records, reconstruct ancestral histories, and test which array order the evolutionary model supports.
          </p>
          <p className="hero-suite"><span>CRISPRidentify v2</span><i />SpacerPlacer<i />CRISPR-evOr</p>
          <div className="hero-actions">
            <a className="hero-action" href="#analysis-form">Start an analysis <Icon name="arrow" /></a>
            <a className="hero-example-action" href="#example-entry">Explore the flagship example <Icon name="downRight" size={17}/></a>
          </div>
          <ol className="hero-steps" aria-label="Analysis evidence chain">
            <li><b>01</b><span>Detect arrays</span></li>
            <li><b>02</b><span>Reconstruct history</span></li>
            <li><b>03</b><span>Compare order</span></li>
          </ol>
        </div>
        <div className="array-figure" aria-label="Illustration of related CRISPR spacer arrays">
          <div className="figure-label"><span>RELATED ISOLATES</span><b>spacer history</b></div>
          {[0, 1, 2, 3].map((row) => (
            <div className={`array-row array-row-${row}`} key={row}>
              <small>{String.fromCharCode(65 + row)}</small>
              {Array.from({ length: 7 - (row % 2) }, (_, index) => <i key={index} className={`spacer spacer-${(index + row * 2) % 5}`} />)}
            </div>
          ))}
          <div className="figure-axis"><span>older</span><span>new acquisitions</span></div>
          <div className="figure-note"><Icon name="helix" /><span>Compare order under a probabilistic gain/loss model</span></div>
        </div>
      </div>
    </header>
  );
}

function ModeSelector({ mode, onChange }) {
  return (
    <fieldset className="mode-fieldset">
      <legend className="section-title">
        <span><b>1</b> Choose the analysis goal</span>
        <small>The workflow only runs the tools needed for your question.</small>
      </legend>
      <div className="mode-grid">
        {ANALYSIS_MODES.map((item) => (
          <label className={`mode-card ${mode === item.id ? "selected" : ""}`} key={item.id}>
            <input type="radio" name="mode" value={item.id} checked={mode === item.id} onChange={() => onChange(item.id)} />
            <span className="mode-top"><b>{item.number}</b>{item.badge && <small>{item.badge}</small>}<i aria-hidden="true"><Icon name="check" size={16}/></i></span>
            <strong>{item.title}</strong>
            <span className="mode-tool">{item.short}</span>
            <p>{item.description}</p>
            <span className="tool-chain">{item.tools.join("  →  ")}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CheckItem({ ok, children, detail, recommended = false }) {
  return (
    <li className={ok ? "ready" : recommended ? "recommended" : "not-ready"}>
      <span className="check-icon"><Icon name={ok ? "check" : recommended ? "info" : "close"} size={15}/></span>
      <span>{children}{detail && <small>{detail}</small>}</span>
    </li>
  );
}

function Readiness({ inspection, selectedMode, limits, service, requestBytes }) {
  const minimum = selectedMode.minimumRecords;
  const withinRecords = !limits.maxRecords || inspection.recordCount <= limits.maxRecords;
  const withinBases = !limits.maxBases || inspection.baseCount <= limits.maxBases;
  const withinRecordBases = !limits.maxRecordBases || inspection.records.every((record) => record.sequence.length <= limits.maxRecordBases);
  const withinRequest = !limits.maxRequestBytes || requestBytes <= limits.maxRequestBytes;
  return (
    <aside className="readiness" aria-labelledby="readiness-title">
      <div className="readiness-head">
        <span className="readiness-icon"><Icon name="shield" /></span>
        <div><h3 id="readiness-title">Submission readiness</h3><p>Checked locally before upload</p></div>
      </div>
      <ul>
        <CheckItem ok={inspection.valid} detail={inspection.errors[0]}>{inspection.valid ? "Valid IUPAC DNA FASTA" : "Valid FASTA required"}</CheckItem>
        <CheckItem ok={inspection.valid && inspection.records.length === new Set(inspection.records.map((record) => record.identifier)).size}>Unique record identifiers</CheckItem>
        <CheckItem
          ok={inspection.recordCount >= minimum}
          detail={selectedMode.id === "detection" ? "Detection accepts one or more records." : `This public-service cohort policy requires ${minimum} records; model eligibility still requires at least two comparable detected arrays.`}
        >{inspection.recordCount || 0} of {minimum} public cohort records</CheckItem>
        {selectedMode.id === "orientation" && <CheckItem ok={inspection.recordCount >= 3} recommended detail={inspection.recordCount < 3 ? "Three or more related isolate records usually provide a more informative comparison." : null}>3+ isolate records recommended</CheckItem>}
        <CheckItem ok={withinRecords && withinBases && withinRecordBases} detail={!withinRecords ? `Limit: ${limits.maxRecords} records` : !withinBases ? `Limit: ${formatNumber(limits.maxBases)} total bases` : !withinRecordBases ? `Limit: ${formatNumber(limits.maxRecordBases)} bases per record` : limits.maxBases ? `Configured cap: ${formatNumber(limits.maxBases)} total bases. Larger genomes require an institutional batch route.` : null}>Within bounded public-service limits</CheckItem>
        <CheckItem ok={withinRequest} detail={!withinRequest ? `The JSON request is ${readableBytes(requestBytes)}; limit: ${readableBytes(limits.maxRequestBytes)}.` : null}>Request fits the upload limit</CheckItem>
        <CheckItem ok={service.state === "online"} detail={service.state === "offline" ? service.message : null}>Analysis service available</CheckItem>
      </ul>
      {service.expiresHours && <p className="retention-note"><Icon name="info" size={16}/> Results and credentials expire after {service.expiresHours} hours.</p>}
    </aside>
  );
}

function AdvancedOptions({ mode, options, setOptions }) {
  return (
    <details className="advanced">
      <summary><span>Advanced analysis policy</span><small>Transparent, bounded settings</small></summary>
      <div className="advanced-body">
        <fieldset>
          <legend>Eligible CRISPRidentify categories</legend>
          <label className="radio-line">
            <input type="radio" name="category-policy" value="bona_fide_possible" checked={options.categoryPolicy === "bona_fide_possible"} onChange={() => setOptions({ ...options, categoryPolicy: "bona_fide_possible" })}/>
            <span><strong>Bona-fide + Possible</strong><small>Default · preserves plausible arrays for group preflight</small></span>
          </label>
          <label className="radio-line">
            <input type="radio" name="category-policy" value="bona_fide_only" checked={options.categoryPolicy === "bona_fide_only"} onChange={() => setOptions({ ...options, categoryPolicy: "bona_fide_only" })}/>
            <span><strong>Strict Bona-fide only</strong><small>Higher specificity, but may leave fewer comparable arrays</small></span>
          </label>
        </fieldset>
        {mode !== "detection" && <div className="option-column">
          <label htmlFor="edit-distance"><strong>Spacer edit distance</strong><small>Maximum sequence edits when matching homologous spacers</small></label>
          <div className="number-control"><button type="button" aria-label="Decrease spacer edit distance" onClick={() => setOptions({ ...options, spacerEditDistance: Math.max(0, options.spacerEditDistance - 1) })}><Icon name="minus" size={16}/></button><output id="edit-distance" aria-live="polite">{options.spacerEditDistance}</output><button type="button" aria-label="Increase spacer edit distance" onClick={() => setOptions({ ...options, spacerEditDistance: Math.min(2, options.spacerEditDistance + 1) })}><Icon name="plus" size={16}/></button></div>
        </div>}
        {mode !== "detection" && <div className="option-column">
          <span><strong>Deletion-parameter bias corrections</strong><small>Refine α/ρ deletion-parameter estimates; orientation ΔlnL is unchanged. On this public service, if a group/direction-specific ρ correction has no finite fit, that fit alone uses uncorrected ρ estimates and records a warning instead of failing the job. The affected deletion-rate estimates and IDM/BDM LRT remain uncorrected; strict all-corrections-or-error is a separate CLI policy.</small></span>
          <div className="segmented" role="group" aria-label="Deletion-parameter bias corrections">
            <button type="button" aria-pressed={options.biasCorrection} onClick={() => setOptions({ ...options, biasCorrection: true })}>Enabled</button>
            <button type="button" aria-pressed={!options.biasCorrection} onClick={() => setOptions({ ...options, biasCorrection: false })}>Disabled</button>
          </div>
        </div>}
        {mode !== "detection" ? <div className="policy-note"><strong>Tree policy</strong><span>The public workflow estimates trees separately for input and reversed spacer order. Independent tree upload is not available in this interface; the result reports the exact policy used.</span></div> : <div className="policy-note"><strong>Detection only</strong><span>The category policy controls which calls are emphasized. Spacer matching, deletion-parameter bias corrections, tree estimation, and evolutionary modeling are not run.</span></div>}
      </div>
    </details>
  );
}

export function InputPanel({ sequence, setSequence, filename, setFilename, inspection, loadExample, loadingExample, exampleDisabled = false, maxRequestBytes = 0 }) {
  const fileRef = useRef(null);
  const [fileError, setFileError] = useState("");
  const onFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const transportMargin = maxRequestBytes ? Math.min(65_536, Math.floor(maxRequestBytes * 0.05)) : 0;
    const safeFileLimit = maxRequestBytes ? Math.max(1, maxRequestBytes - transportMargin) : 0;
    if (safeFileLimit && file.size > safeFileLimit) {
      setFileError(`The selected file is ${readableBytes(file.size)}. Upload files must be smaller than ${readableBytes(safeFileLimit)} so the complete JSON request fits the service limit.`);
      return;
    }
    try {
      setSequence(await file.text());
      setFilename(file.name);
      setFileError("");
    } catch {
      setFileError("The selected file could not be read as plain text.");
    }
  };
  return (
    <div className="input-panel">
      <div className="input-heading" id="example-entry">
        <div><label htmlFor="fasta-input">Related contigs or small genomes</label><p>Paste FASTA or upload a plain-text file. The first token in every header must be unique.</p></div>
        <button className="text-button example-button" type="button" onClick={loadExample} disabled={loadingExample || exampleDisabled} title={exampleDisabled ? "Finish or leave the current job before opening the example." : undefined}><Icon name="file" size={16}/>{loadingExample ? "Loading example…" : "Load flagship example"}</button>
      </div>
      <div className="upload-strip">
        <button className="upload-button" type="button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18}/> Upload FASTA</button>
        <input ref={fileRef} type="file" tabIndex="-1" accept=".fa,.fasta,.fna,.ffn,.fas,.txt,text/plain" onChange={onFile} aria-label="Upload FASTA file" />
        <span className="filename">{sequence ? filename : "No file selected"}</span>
        <span className="input-stats"><b>{inspection.recordCount}</b> records <i/> <b>{readableBases(inspection.baseCount)}</b></span>
      </div>
      <textarea id="fasta-input" spellCheck="false" value={sequence} onChange={(event) => { setSequence(event.target.value); setFilename("pasted-input.fasta"); setFileError(""); }} placeholder={">isolate_A\nACGT…\n>isolate_B\nACGT…"} aria-describedby="fasta-help fasta-errors" />
      <div className="input-foot" id="fasta-help"><span>Accepted symbols: A C G T and IUPAC ambiguity codes</span><span>Input stays in this browser until submission</span></div>
      <div id="fasta-errors" className="field-errors" role="alert">{fileError && <p>{fileError}</p>}{sequence && inspection.errors.slice(0, 3).map((error) => <p key={error}>{error}</p>)}</div>
    </div>
  );
}

export function AnalysisForm({ service, limits, onSubmitted, onExampleLoaded = () => {}, hasActiveJob = false }) {
  const [mode, setMode] = useState("orientation");
  const [sequence, setSequence] = useState("");
  const [filename, setFilename] = useState("input.fasta");
  const [options, setOptions] = useState(INITIAL_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loadingExample, setLoadingExample] = useState(false);
  const [preparedExample, setPreparedExample] = useState(null);
  const [preparedExampleSequence, setPreparedExampleSequence] = useState("");
  const inspection = useMemo(() => inspectFasta(sequence, { maxHeaderCharacters: limits.maxHeaderCharacters || 200 }), [sequence, limits.maxHeaderCharacters]);
  const selectedMode = ANALYSIS_MODES.find((item) => item.id === mode);
  const submission = useMemo(() => buildSubmission({ sequence, filename, mode, options }), [sequence, filename, mode, options]);
  const requestBytes = useMemo(() => new TextEncoder().encode(JSON.stringify(submission)).byteLength, [submission]);
  const recordedExampleOptions = preparedExample?.job?.options;
  const precomputedPolicyMatches = Boolean(
    preparedExample
    && sequence === preparedExampleSequence
    && mode === preparedExample.job?.mode
    && submission.category_policy === recordedExampleOptions?.category_policy
    && submission.spacer_distance === recordedExampleOptions?.spacer_distance
    && submission.bias_corrections === recordedExampleOptions?.bias_corrections_requested
  );
  const withinLimits = (!limits.maxRecords || inspection.recordCount <= limits.maxRecords) && (!limits.maxBases || inspection.baseCount <= limits.maxBases) && (!limits.maxRecordBases || inspection.records.every((record) => record.sequence.length <= limits.maxRecordBases));
  const withinRequest = !limits.maxRequestBytes || requestBytes <= limits.maxRequestBytes;
  const ready = inspection.valid && inspection.recordCount >= selectedMode.minimumRecords && withinLimits && withinRequest && (service.state === "online" || precomputedPolicyMatches) && !hasActiveJob;
  const loadExample = async () => {
    setLoadingExample(true);
    setError("");
    try {
      const [inputResponse, resultResponse] = await Promise.all([
        fetch(`${import.meta.env.BASE_URL}${EXAMPLE_FASTA_PATH}`, { cache: "no-store", credentials: "omit" }),
        fetch(`${import.meta.env.BASE_URL}${EXAMPLE_RESULT_PATH}`, { cache: "no-store", credentials: "omit" }),
      ]);
      if (!inputResponse.ok || !resultResponse.ok) {
        throw new Error("The example demonstration could not be loaded.");
      }
      const [exampleSequence, rawSnapshot] = await Promise.all([
        inputResponse.text(),
        resultResponse.json(),
      ]);
      const { snapshot } = await validateExampleInput(rawSnapshot, exampleSequence, {
        maxHeaderCharacters: limits.maxHeaderCharacters || 200,
      });
      setMode("orientation");
      setOptions({ ...INITIAL_OPTIONS });
      setSequence(exampleSequence);
      setFilename(snapshot.example.input.filename);
      setPreparedExample(snapshot);
      setPreparedExampleSequence(exampleSequence);
      onExampleLoaded(null);
    } catch (loadError) {
      setError(loadError.message || "The example demonstration could not be loaded.");
    } finally {
      setLoadingExample(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!ready || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      if (precomputedPolicyMatches) {
        try {
          await validateExampleInput(preparedExample, sequence, {
            maxHeaderCharacters: limits.maxHeaderCharacters || 200,
          });
          onExampleLoaded(preparedExample);
          return;
        } catch {
          setPreparedExample(null);
          setPreparedExampleSequence("");
        }
      }
      const response = await api.submit(submission);
      const submittedJob = response?.job || response;
      const jobId = response?.job_id || submittedJob?.job_id || submittedJob?.id;
      const expiresAt = response?.expires_at || submittedJob?.expires_at;
      if (!jobId || !response?.access_token) {
        throw new ApiError("The service returned an incomplete job credential.");
      }
      const credential = normalizeJobCredential({
        jobId,
        accessToken: response.access_token,
        expiresAt,
      });
      onSubmitted(credential, { ...submittedJob, mode });
    } catch (submitError) {
      setError(submitError.message || "The analysis could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="workflow" id="workflow" aria-labelledby="workflow-title">
      <div className="section-intro"><h2 id="workflow-title">Make the question explicit before running the model.</h2><p>Detection confidence and evolutionary evidence answer different questions. This workflow keeps them separate.</p></div>
      <form id="analysis-form" onSubmit={submit} noValidate>
        <ModeSelector mode={mode} onChange={setMode}/>
        <div className="input-section">
          <div className="section-title"><span><b>2</b> Provide related genomic records</span><small>DNA FASTA · unique sequence identifiers</small></div>
          <div className="input-layout">
            <InputPanel sequence={sequence} setSequence={setSequence} filename={filename} setFilename={setFilename} inspection={inspection} loadExample={loadExample} loadingExample={loadingExample} exampleDisabled={hasActiveJob} maxRequestBytes={limits.maxRequestBytes}/>
            <Readiness inspection={inspection} selectedMode={selectedMode} limits={limits} service={service} requestBytes={requestBytes}/>
          </div>
        </div>
        <div className="policy-section">
          <div className="section-title"><span><b>3</b> Review analysis policy</span><small>No arbitrary command-line arguments are accepted</small></div>
          <AdvancedOptions mode={mode} options={options} setOptions={setOptions}/>
        </div>
        {error && <div className="submit-error" role="alert"><Icon name="warning"/><span>{error}</span></div>}
        {hasActiveJob && <div className="active-job-lock" role="status"><Icon name="info"/><span><strong>Another job is open.</strong> Save its recovery file, then cancel it or use “Leave this job and start another” after it reaches a terminal state.</span></div>}
        <div className="privacy-notice" role="note" aria-label="Sequence privacy and retention notice">
          <Icon name="shield"/>
          <p><strong>This public interface is for non-sensitive research data only.</strong> Submission sends sequence data to the service operator for analysis. The exact bundled masked example is matched locally and its cached result is never submitted. The job token protects result retrieval; it is not end-to-end encryption from the operator. Terminal job data is automatically deleted {service.expiresHours ? `${service.expiresHours} hours after the run finishes` : "under the configured retention policy"}. Do not submit personal, clinical, controlled, or unpublished sensitive sequences; use an institutionally approved private route instead.</p>
        </div>
        <div className="submit-bar">
          <div><strong>{selectedMode.title}</strong><span>{selectedMode.tools.join(" → ")}</span></div>
          <button className="primary-button" type="submit" disabled={!ready || submitting}>{submitting ? (precomputedPolicyMatches ? "Loading result…" : "Submitting…") : hasActiveJob ? "Current job still open" : precomputedPolicyMatches ? "View precomputed result" : "Compute"}<Icon name="arrow"/></button>
        </div>
      </form>
    </section>
  );
}

function RecoveryCredential({ credential }) {
  const download = () => {
    const blob = new Blob([serializeJobCredential(credential)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crispr-job-${credential.jobId}.recovery.json`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  return (
    <div className="credential-notice" role="note" aria-label="Private job recovery credential">
      <Icon name="shield"/>
      <div><strong>Save access before closing this page.</strong><p>The bearer credential is kept only in this tab’s memory and is never written to browser storage or a URL. Download it privately to resume later; anyone holding the file can access this job until it expires.</p></div>
      <button type="button" onClick={download}><Icon name="download" size={16}/>Download recovery file</button>
    </div>
  );
}

export function ResumeJob({ onResume }) {
  const [error, setError] = useState("");
  const load = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 16_384) {
      setError("Recovery file exceeds 16 KiB.");
      return;
    }
    try {
      onResume(parseJobCredential(await file.text()));
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Recovery file could not be read.");
    }
  };
  return (
    <section className="resume-job" aria-labelledby="resume-heading">
      <div><h2 id="resume-heading"><span>Already submitted?</span> Resume with a private recovery file.</h2><p id="resume-description">The file is parsed locally, then its bearer token is sent only in the API Authorization header.</p></div>
      <label className="resume-button"><Icon name="upload" size={17}/>Choose recovery JSON<input type="file" accept=".json,application/json" aria-describedby="resume-description" onChange={load}/></label>
      {error && <p className="resume-error" role="alert">{error}</p>}
    </section>
  );
}

export function JobProgress({ job, credential, onCancel, onForget, cancelling }) {
  const mode = job?.mode || job?.request?.mode || "orientation";
  const stages = stagesForMode(mode);
  const current = job?.stage || (ACTIVE_STATUSES.has(job?.status) && job?.status !== "running" ? job.status : null);
  const currentIndex = stages.findIndex((stage) => stage.id === current);
  const terminal = TERMINAL_STATUSES.has(job?.status);
  const successful = ["completed", "completed_no_eligible_groups"].includes(job?.status);
  const expiresAt = job?.expires_at || credential.expiresAt;
  return (
    <section className={`job-panel job-${job?.status || "queued"}`} aria-labelledby="job-heading">
      <div className="job-heading">
        <div><h2 id="job-heading" tabIndex="-1">{statusCopy(job?.status || "queued")}</h2><p className="job-id">Job <code>{credential.jobId}</code> · {expiresAt ? `expires ${formatDate(expiresAt)}` : "retention starts when the run finishes"}</p></div>
        <span className={`job-badge ${successful ? "success" : terminal ? "terminal" : "active"}`} role="status"><i/>{successful ? "Ready" : terminal ? statusCopy(job?.status) : "In progress"}</span>
      </div>
      <RecoveryCredential credential={credential}/>
      {!terminal && <ol className="stage-list" aria-label="Analysis progress">
        {stages.map((stage, index) => {
          const state = currentIndex >= 0 && index < currentIndex ? "complete" : index === currentIndex ? "current" : "pending";
          return <li className={state} key={stage.id} aria-current={state === "current" ? "step" : undefined}><span>{state === "complete" ? <Icon name="check" size={15}/> : index + 1}</span><div><strong>{stage.label}</strong><small>{stage.detail}</small></div></li>;
        })}
      </ol>}
      {!terminal && job?.status === "running" && !job?.stage && <p className="stage-unavailable"><Icon name="info" size={15}/> The worker reports that the workflow is running, but does not expose a reliable tool-level stage. Planned stages are shown without guessing which one is active.</p>}
      {!terminal && <div className="queue-row"><span>{job?.queue_position ? `Queue position ${job.queue_position}` : "Keep this tab open, or download the recovery file before closing it."}</span><button className="cancel-button" type="button" onClick={onCancel} disabled={cancelling}><Icon name="stop" size={16}/>{cancelling ? "Cancelling…" : "Cancel job"}</button></div>}
      {job?.status === "failed" && <div className="job-message error" role="alert"><Icon name="warning"/><div><strong>The workflow did not complete</strong><p>{job.error?.message || job.error || "The service reported an analysis failure. Downloadable diagnostics may still be available."}</p></div></div>}
      {job?.status === "cancelled" && <div className="job-message"><Icon name="info"/><div><strong>Job cancelled</strong><p>Partial working files are not presented as completed results.</p></div></div>}
      {terminal && <div className="queue-row"><span>Download any result or recovery files you need before leaving this job.</span><button className="leave-job-button" type="button" onClick={onForget}>Leave this job and start another</button></div>}
    </section>
  );
}

function CategorySummary({ summary, arrays }) {
  const reported = summary?.categories || summary?.category_counts || {};
  const derived = arrays.reduce((counts, row) => {
    const label = getValue(row, "category", "Category") || "Unclassified";
    counts[label] = (counts[label] || 0) + 1;
    return counts;
  }, {});
  const categories = Object.keys(reported).length ? reported : derived;
  const preferred = ["Bona-fide", "Possible", "Possible discarded", "Low score"];
  const ordered = [...new Set([...preferred, ...Object.keys(categories)])].filter((key) => categories[key] != null);
  return (
    <section className="result-section category-section" aria-labelledby="category-heading">
      <div className="result-heading"><div><p className="eyebrow">Primary detection result</p><h3 id="category-heading">CRISPRidentify categories</h3></div><p>Categories express the detector’s classification policy; they are not evolutionary conclusions.</p></div>
      {ordered.length ? <div className="category-grid">{ordered.map((label) => <div className={`category-card category-${categoryClass(label)}`} key={label}><span>{label}</span><strong>{formatNumber(categories[label])}</strong><small>arrays</small></div>)}</div> : <div className="empty-result">No CRISPR array calls were reported.</div>}
      {arrays.length > 0 && <div className="table-wrap" role="region" tabIndex="0" aria-label="Scrollable CRISPRidentify array results"><table><thead><tr><th>Record</th><th>Coordinates</th><th>Category</th><th>Strand</th><th>Spacers</th><th>Raw CRISPRidentify Model score</th></tr></thead><tbody>{arrays.map((row, index) => {
        const start = getValue(row, "start", "Start");
        const end = getValue(row, "end", "End");
        const sourceId = getValue(row, "source_id", "record_id", "sequence_id", "Name") || "unknown-source";
        const arrayId = getValue(row, "array_id", "id", "Name") || "unknown-array";
        return <tr key={`${sourceId}:${arrayId}:${index}`}><td><strong>{sourceId === "unknown-source" ? "—" : sourceId}</strong><small>{arrayId === "unknown-array" ? "" : arrayId}</small></td><td>{start != null && end != null ? `${formatNumber(start)}–${formatNumber(end)}` : "—"}</td><td><span className={`category-pill category-${categoryClass(getValue(row, "category", "Category"))}`}>{getValue(row, "category", "Category") || "Unclassified"}</span></td><td>{getValue(row, "strand", "Strand") || "Unknown"}</td><td>{formatNumber(getValue(row, "spacer_count", "Number of spacers"))}</td><td><span className="raw-score">{formatNumber(getValue(row, "model_score", "score", "Confidence score"), 4)}</span></td></tr>;
      })}</tbody></table></div>}
      <div className="interpretation-note"><Icon name="info" size={18}/><p><strong>About the raw Model score:</strong> this is the value emitted by CRISPRidentify’s classifier. It is <strong>not a calibrated probability</strong>, is never shown as a percentage, and should be interpreted together with the reported category and array context.</p></div>
    </section>
  );
}

function SkipReasons({ reasons }) {
  const entries = Array.isArray(reasons)
    ? reasons.map((item) => [item.reason || item.code || "Other", item.count ?? 1])
    : Object.entries(reasons || {});
  if (!entries.length) return <p className="muted">No exclusions were reported.</p>;
  return <ul className="reason-list">{entries.map(([reason, count]) => <li key={reason}><span>{String(reason).replaceAll("_", " ")}</span><b>{formatNumber(count)}</b></li>)}</ul>;
}

function Preflight({ summary }) {
  const adapter = summary?.adapter || summary?.preflight || summary?.group_preflight || {};
  if (!Object.keys(adapter).length) return null;
  const retained = getValue(adapter, "emitted_array_count", "retained_arrays", "retained");
  const excluded = getValue(adapter, "skipped_array_count", "excluded_arrays", "excluded");
  const groups = getValue(adapter, "emitted_group_count", "eligible_groups", "groups");
  const unknownStrand = getValue(adapter, "unknown_strand_excluded_count", "unknown_strand", "unknown_strand_arrays") ?? 0;
  const reasons = adapter.skipped_by_reason || adapter.skip_reasons || adapter.exclusion_reasons;
  return (
    <section className="result-section" aria-labelledby="preflight-heading">
      <div className="result-heading"><div><p className="eyebrow">Evolution preflight</p><h3 id="preflight-heading">What reached the model</h3></div><p>Filtering is reported before reconstruction so absence of a result is explainable.</p></div>
      <div className="metric-grid">
        <div><span>Retained arrays</span><strong>{formatNumber(retained)}</strong></div>
        <div><span>Excluded arrays</span><strong>{formatNumber(excluded)}</strong></div>
        <div><span>Eligible groups</span><strong>{formatNumber(groups)}</strong></div>
        <div className={Number(unknownStrand) > 0 ? "attention" : ""}><span>Unknown strand excluded</span><strong>{formatNumber(unknownStrand)}</strong></div>
      </div>
      <div className="reason-block"><h4>Exclusion and skip reasons</h4><SkipReasons reasons={reasons}/></div>
    </section>
  );
}

function finiteMetric(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function signedNumber(value, digits = 2) {
  const number = finiteMetric(value);
  if (number == null) return "not reported";
  return (number > 0 ? "+" : "") + number.toFixed(digits);
}

function groupIdentity(item, index) {
  return String(item?.group || item?.name || item?.group_id || item?.id || "group_" + (index + 1));
}

function comparisonDecisionFor(item, orientation = {}) {
  const thresholdValue = Number(getValue(item, "confidence_threshold") ?? getValue(orientation, "confidence_threshold") ?? 5);
  const threshold = Number.isFinite(thresholdValue) && thresholdValue >= 0 ? thresholdValue : 5;
  const reportedDelta = finiteMetric(getValue(item, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood"));
  const forward = finiteMetric(getValue(item, "forward_ln_likelihood_bdm"));
  const reverse = finiteMetric(getValue(item, "reverse_ln_likelihood_bdm"));
  const delta = reportedDelta ?? (forward != null && reverse != null ? forward - reverse : null);
  if (item?.decisive === false) return { label: "Unresolved", threshold };
  if (delta == null || Math.abs(delta) <= threshold) return { label: "Unresolved", threshold };
  return { label: delta > threshold ? "Input order supported" : "Reverse input order supported", threshold };
}

function RepeatSequence({ value }) {
  const bases = String(value || "").slice(0, 120);
  if (!bases) return <span className="repeat-unavailable">Canonical repeat not reported</span>;
  return <span className="repeat-sequence" role="img" tabIndex="0" aria-label={"Canonical repeat " + bases}>{[...bases].map((base, index) => <i className={"repeat-base repeat-base-" + base.toLowerCase()} key={index}>{base}</i>)}</span>;
}

function MiniSpacerArray({ count }) {
  const total = safeManifestCount(count) ?? 0;
  const visible = Math.min(22, total);
  return <span className="mini-spacer-array" role="img" aria-label={formatNumber(total) + " detected spacers; count only, spacer identities are not shown"}>{Array.from({ length: visible }, (_, index) => <i className="mini-spacer-count" key={index}/>)}{total > visible && <b>+{total - visible}</b>}</span>;
}

function EvolutionaryGroupMap({ summary, membershipStatus = "inline" }) {
  const groups = asArray(summary?.adapter?.groups);
  if (!groups.length) return null;
  const orientation = summary?.orientation || summary?.orientation_evidence || {};
  const comparisons = asArray(orientation.comparisons || orientation.groups || summary?.orientation_groups);
  const reconstruction = summary?.reconstruction || summary?.spacerplacer || {};
  const reconstructions = asArray(orientation.selected_reconstructions).length ? asArray(orientation.selected_reconstructions) : asArray(reconstruction.results);
  const comparisonByGroup = new Map(comparisons.map((item, index) => [groupIdentity(item, index), item]));
  const reconstructionByGroup = new Map(reconstructions.map((item, index) => [groupIdentity(item, index), item]));
  return (
    <section className="result-section group-map-section" aria-labelledby="group-map-heading">
      <div className="result-heading"><div><p className="eyebrow">Connected evidence</p><h3 id="group-map-heading">How detections became evolutionary evidence</h3></div><p>Follow each exact CRISPRidentify call through its shared canonical repeat into the evOr comparison and reported SpacerPlacer history.</p></div>
      <div className="group-bridge-list">{groups.map((group, index) => {
        const groupName = groupIdentity(group, index);
        const members = asArray(group?.arrays);
        const comparison = comparisonByGroup.get(groupName);
        const selected = reconstructionByGroup.get(groupName);
        const decision = comparison ? comparisonDecisionFor(comparison, orientation) : null;
        const delta = finiteMetric(getValue(comparison, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood"));
        const acquisitions = finiteMetric(getValue(selected, "nb of reconstructed insertions", "gains", "insertions", "gain_events"));
        const deletions = finiteMetric(getValue(selected, "nb of reconstructed deletions", "deletions", "losses", "deletion_events"));
        const uniqueSpacers = finiteMetric(getValue(selected, "nb of unique spacers", "unique_spacers"));
        const repeatLength = String(group?.repeat_key || "").length;
        return <article className={"group-bridge group-tone-" + (index % 4)} key={groupName}>
          <div className="group-bridge-heading"><div><small>Evolutionary group {index + 1}</small><strong>{formatNumber(group?.array_count ?? members.length)} connected arrays</strong></div><code title={groupName}>{groupName}</code></div>
          <div className="repeat-band"><span><b>Grouping key · canonical repeat</b>{repeatLength > 0 && <small>{repeatLength} nt <i aria-hidden="true">· scroll →</i></small>}</span><RepeatSequence value={group?.repeat_key}/></div>
          <div className="group-bridge-flow">
            <div className="group-members"><div className="flow-label"><span>1</span><strong>CRISPRidentify detections</strong></div>{members.length ? <div className="group-member-list">{members.map((member, memberIndex) => <div className="group-member" key={String(member?.source_id) + ":" + String(member?.array_id) + ":" + memberIndex}><div><strong>{member?.source_id || "Unknown record"}</strong><small>{member?.array_id || "Unknown array"}</small></div><span className={"category-pill category-" + categoryClass(member?.category)}>{member?.category || "Unclassified"}</span><span className="member-strand">strand {member?.strand || "?"}</span><MiniSpacerArray count={member?.spacer_count}/></div>)}</div> : <div className="membership-pending">{membershipStatus === "loading" ? "Loading exact group members…" : "Exact member mapping was not available in this completed result."}</div>}</div>
            <div className="group-connector" aria-hidden="true"><span>2</span><i/><strong>same repeat<br/>shared spacers</strong><b>→</b></div>
            <div className="group-outcomes"><div className="flow-label"><span>3</span><strong>Evolutionary results</strong></div><div className="outcome-card outcome-evor"><small>CRISPR-evOr orientation</small>{decision ? <><strong>{decision.label}</strong><span>Δ lnL {signedNumber(delta, 2)} · boundary ±{formatNumber(decision.threshold, 2)}</span></> : <strong>Not evaluated</strong>}</div><div className="outcome-card outcome-spacerplacer"><small>SpacerPlacer reported history</small>{selected ? <><strong>{formatNumber(acquisitions)} acquisitions · {formatNumber(deletions)} deletions</strong><span>{formatNumber(uniqueSpacers)} unique spacers reconstructed</span></> : <strong>Not reconstructed</strong>}</div></div>
          </div>
        </article>;
      })}</div>
    </section>
  );
}

function OrientationEvidencePlot({ comparisons, decisionFor }) {
  const values = comparisons.map((item) => ({
    item,
    delta: finiteMetric(getValue(item, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood")),
    threshold: decisionFor(item).threshold,
  }));
  const extent = Math.max(10, ...values.map(({ delta, threshold }) => Math.max(Math.abs(delta || 0) * 1.18, threshold * 1.65)));
  const position = (value) => Math.max(0, Math.min(100, ((value + extent) / (extent * 2)) * 100));
  return (
    <div className="orientation-landscape" aria-label="Orientation evidence overview">
      <div className="orientation-landscape-header"><span>Reverse order supported</span><span>Unresolved zone</span><span>Input order supported</span></div>
      <div className="orientation-landscape-scale"><span>{signedNumber(-extent, 1)}</span><span>0</span><span>{signedNumber(extent, 1)}</span></div>
      <div className="orientation-plot-rows">{values.map(({ item, delta, threshold }, index) => {
        const group = groupIdentity(item, index);
        const decision = decisionFor(item).label;
        const leftBoundary = position(-threshold);
        const rightBoundary = position(threshold);
        const marker = position(delta || 0);
        const aria = delta == null ? "No finite delta log likelihood was reported for " + group : "Delta log likelihood " + delta.toFixed(2) + " for " + group + ". Values from minus " + threshold + " through plus " + threshold + " are unresolved.";
        return <div className={"orientation-plot-row group-tone-" + (index % 4)} key={group}>
          <div className="orientation-plot-label"><strong>Group {index + 1}</strong><code title={group}>{group}</code></div>
          <div className="orientation-axis" role="img" aria-label={aria}>
            <span className="orientation-zone orientation-zone-reverse" style={{ width: leftBoundary + "%" }}/>
            <span className="orientation-zone orientation-zone-unresolved" style={{ left: leftBoundary + "%", width: (rightBoundary - leftBoundary) + "%" }}/>
            <span className="orientation-zone orientation-zone-input" style={{ left: rightBoundary + "%", width: (100 - rightBoundary) + "%" }}/>
            <i className="orientation-zero" style={{ left: position(0) + "%" }}/>
            <i className={"orientation-marker orientation-marker-" + categoryClass(decision)} style={{ left: marker + "%" }}><b>{delta == null ? "?" : signedNumber(delta)}</b></i>
          </div>
          <span className={"orientation-chip orientation-" + categoryClass(decision)}>{decision}</span>
        </div>;
      })}</div>
    </div>
  );
}

function HypothesisComparison({ group, index, decision, threshold }) {
  const forward = finiteMetric(getValue(group, "forward_ln_likelihood_bdm"));
  const reverse = finiteMetric(getValue(group, "reverse_ln_likelihood_bdm"));
  const delta = finiteMetric(getValue(group, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood"));
  const tied = forward != null && reverse != null && Math.abs(forward - reverse) < 1e-12;
  const inputLeads = !tied && forward != null && reverse != null && forward > reverse;
  const reverseLeads = !tied && forward != null && reverse != null && reverse > forward;
  const distance = delta == null ? null : Math.abs(delta);
  const gap = distance == null ? null : Math.max(0, threshold - distance);
  const surplus = distance == null ? null : Math.max(0, distance - threshold);
  const groupName = groupIdentity(group, index);
  return (
    <article className={"hypothesis-comparison group-tone-" + (index % 4)}>
      <div className="hypothesis-heading"><div><small>Array group {index + 1}</small><strong>{groupName}</strong></div><span className={"orientation-chip orientation-" + categoryClass(decision)}>{decision}</span></div>
      <div className="hypothesis-pair" aria-label={"Likelihood comparison for " + groupName}>
        <div className={"hypothesis-card hypothesis-input" + (inputLeads ? " is-leading" : "")}><span>Input spacer order</span><strong>{formatNumber(forward, 3)}</strong><small>BDM log likelihood</small></div>
        <div className="hypothesis-versus"><span>vs</span><b>{delta == null ? "No delta" : "Delta " + signedNumber(delta, 2)}</b></div>
        <div className={"hypothesis-card hypothesis-reverse" + (reverseLeads ? " is-leading" : "")}><span>Reversed spacer order</span><strong>{formatNumber(reverse, 3)}</strong><small>BDM log likelihood</small></div>
      </div>
      <div className={"decision-distance " + (decision === "Unresolved" ? "is-unresolved" : "is-decisive")}><span>{decision === "Unresolved" ? "Distance still needed" : "Boundary crossed by"}</span><strong>{formatNumber(decision === "Unresolved" ? gap : surplus, 2)} Delta lnL</strong><small>Decision boundary: +/-{formatNumber(threshold, 2)}</small></div>
    </article>
  );
}

function OrientationResults({ summary }) {
  const orientation = summary?.orientation || summary?.orientation_evidence;
  if (!orientation) return null;
  const directDelta = getValue(orientation, "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood");
  const comparisons = asArray(orientation.comparisons).length ? asArray(orientation.comparisons) : asArray(orientation.groups || summary.orientation_groups).length ? asArray(orientation.groups || summary.orientation_groups) : directDelta != null || orientation.decision ? [{ group: "All eligible arrays", ...orientation }] : [];
  const comparisonDecision = (item) => comparisonDecisionFor(item, orientation);
  const decisiveCount = comparisons.filter((item) => comparisonDecision(item).label !== "Unresolved").length;
  const treePolicy = orientation.tree_policy || "not_reported";
  const treePolicyText = treePolicy === "estimated_separately" ? "Input-order and reversed-order model trees were estimated separately from the spacer arrays. A decisive group reports the supported history; an unresolved group reports input order only as a default. These are not independent organismal phylogenies." : treePolicy === "provided_shared" ? "Both order hypotheses were evaluated on the same provided rooted tree; consult provenance to establish whether that tree is independently supported." : "Consult the provenance manifest for the tree-estimation policy used.";
  return (
    <section className="result-section orientation-section" aria-labelledby="orientation-heading">
      <div className="result-heading"><div><p className="eyebrow">CRISPR-evOr hypothesis test</p><h3 id="orientation-heading">Which spacer order is better supported?</h3></div><span className="orientation-chip">{decisiveCount} decisive · {comparisons.length - decisiveCount} unresolved</span></div>
      <p className="visual-intro">Each marker is the forward-minus-reverse BDM log-likelihood difference. The colored center band is deliberately inconclusive; a marker must cross a boundary before an orientation is assigned.</p>
      {comparisons.length ? <><OrientationEvidencePlot comparisons={comparisons} decisionFor={comparisonDecision}/><div className="hypothesis-list">{comparisons.map((group, index) => { const result = comparisonDecision(group); return <HypothesisComparison key={groupIdentity(group, index)} group={group} index={index} decision={result.label} threshold={result.threshold}/>; })}</div></> : <div className="empty-result">No finite orientation comparison was produced.</div>}
      <div className="tree-policy"><span className="tree-glyph" aria-hidden="true"><Icon name="tree"/></span><div><strong>Tree policy: {String(treePolicy).replaceAll("_", " ")}</strong><p>{treePolicyText}</p></div></div>
      <div className="threshold-note"><Icon name="info" size={18}/><p><strong>How to read this:</strong> positive Delta lnL favors the supplied spacer order and negative Delta lnL favors the reversed order. The threshold is an evidence rule, <strong>not a p-value or probability</strong>.</p></div>
    </section>
  );
}

function parseNewickTree(value) {
  const source = String(value || "").trim();
  if (!source || source.length > 10000) return null;
  let position = 0;
  let nextId = 0;
  const skip = () => { while (position < source.length && /\s/.test(source[position])) position += 1; };
  const readLabel = (required) => {
    skip();
    const start = position;
    while (position < source.length && /[A-Za-z0-9_.+|\-]/.test(source[position])) position += 1;
    if (required && start === position) throw new Error("missing Newick label");
    return source.slice(start, position);
  };
  const readLength = () => {
    skip();
    if (source[position] !== ":") return 0;
    position += 1;
    skip();
    const start = position;
    while (position < source.length && /[0-9eE+\-.]/.test(source[position])) position += 1;
    const number = Number(source.slice(start, position));
    if (!Number.isFinite(number) || number < 0) throw new Error("invalid Newick length");
    return number;
  };
  const readNode = () => {
    skip();
    const node = { id: nextId++, name: "", length: 0, children: [] };
    if (source[position] === "(") {
      position += 1;
      node.children.push(readNode());
      while (true) { skip(); if (source[position] !== ",") break; position += 1; node.children.push(readNode()); }
      skip();
      if (source[position] !== ")" || node.children.length < 2) throw new Error("invalid Newick branch");
      position += 1;
      node.name = readLabel(false);
    } else node.name = readLabel(true);
    node.length = readLength();
    return node;
  };
  try {
    const root = readNode();
    skip();
    if (source[position] !== ";") return null;
    position += 1;
    skip();
    return position === source.length ? root : null;
  } catch { return null; }
}

function TreeGraphic({ newick, group, reportedByDefault = false }) {
  const tree = useMemo(() => parseNewickTree(newick), [newick]);
  if (!tree) return null;
  const leaves = [];
  const nodes = [];
  const visit = (node, depth = 0, distance = 0) => {
    node.depth = depth;
    node.distance = distance;
    nodes.push(node);
    if (node.children.length) node.children.forEach((child) => visit(child, depth + 1, distance + child.length));
    else leaves.push(node);
  };
  visit(tree);
  const maxDepth = Math.max(1, ...nodes.map((node) => node.depth));
  const maxDistance = Math.max(0, ...nodes.map((node) => node.distance));
  const height = Math.max(170, leaves.length * 38 + 42);
  const top = 21;
  const bottom = height - 21;
  leaves.forEach((leaf, index) => { leaf.y = leaves.length === 1 ? height / 2 : top + (index / (leaves.length - 1)) * (bottom - top); });
  const placeInternal = (node) => {
    if (!node.children.length) return node.y;
    const ys = node.children.map(placeInternal);
    node.y = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    return node.y;
  };
  placeInternal(tree);
  nodes.forEach((node) => { const measure = maxDistance > 0 ? node.distance / maxDistance : node.depth / maxDepth; node.x = 25 + measure * 470; });
  const edgeGroups = nodes.filter((node) => node.children.length);
  return (
    <div className="tree-graphic">
      <div className="graphic-label"><span>{reportedByDefault ? "Input-order model tree reported by default" : "Rooted model tree for supported order"}</span><small>Array-derived branch lengths scaled when available</small></div>
      <svg viewBox={"0 0 720 " + height} role="img" aria-label={(reportedByDefault ? "Reported input-order" : "Supported-order") + " SpacerPlacer model tree for " + group + " with " + leaves.length + " leaves"}>
        <desc>{`Rooted model tree for ${group}. Leaf labels in display order: ${leaves.map((leaf) => leaf.name).join(", ")}. Exact Newick: ${newick}`}</desc>
        {edgeGroups.map((node) => { const ys = node.children.map((child) => child.y); return <g key={"edges-" + node.id}><line x1={node.x} x2={node.x} y1={Math.min(...ys)} y2={Math.max(...ys)} className="tree-line"/>{node.children.map((child) => <line key={"edge-" + child.id} x1={node.x} x2={child.x} y1={child.y} y2={child.y} className="tree-line"/>)}</g>; })}
        {nodes.map((node) => <circle key={"node-" + node.id} cx={node.x} cy={node.y} r={node.children.length ? 3 : 4} className={node.children.length ? "tree-node" : "tree-leaf-node"}/>)}
        {leaves.map((leaf) => <text key={"label-" + leaf.id} x={leaf.x + 10} y={leaf.y + 4} className="tree-leaf-label"><title>{leaf.name}</title>{leaf.name.length > 30 ? leaf.name.slice(0, 28) + "…" : leaf.name}</text>)}
      </svg>
    </div>
  );
}

function selectedTree(summary, group) {
  const entries = [...asArray(summary?.orientation?.trees), ...asArray(summary?.reconstruction?.trees)];
  const entry = entries.find((item) => String(item?.group || item?.name) === String(group));
  return entry?.selected_newick || entry?.newick || null;
}

const HISTORY_COLOR_COUNT = 12;
const MAX_HISTORY_SPACER_COLUMNS = 160;
const MAX_HISTORY_LEAVES = 40;
const MAX_HISTORY_NODES = 120;

function spacerColorClass(spacer) {
  const number = Math.abs(Number(spacer));
  return "history-color-" + (Number.isFinite(number) ? number % HISTORY_COLOR_COUNT : 0);
}

function publicNodeName(value) {
  const text = String(value || "unnamed node");
  return text.includes("__") ? text.split("__")[0] : text;
}

function layoutNewick(value, height, scaleMode = "topology", sharedDistance = null) {
  const tree = parseNewickTree(value);
  if (!tree) return null;
  const nodes = [];
  const leaves = [];
  const visit = (node, depth = 0, distance = 0, parent = null) => {
    node.depth = depth;
    node.distance = distance;
    node.parent = parent;
    nodes.push(node);
    if (node.children.length) node.children.forEach((child) => visit(child, depth + 1, distance + child.length, node));
    else leaves.push(node);
  };
  visit(tree);
  const top = 50;
  const bottom = height - 42;
  leaves.forEach((leaf, index) => { leaf.y = leaves.length === 1 ? height / 2 : top + (index / Math.max(1, leaves.length - 1)) * (bottom - top); });
  const placeInternal = (node) => {
    if (!node.children.length) return node.y;
    const ys = node.children.map(placeInternal);
    node.y = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    return node.y;
  };
  placeInternal(tree);
  const maxDepth = Math.max(1, ...nodes.map((node) => node.depth));
  const ownDistance = Math.max(0, ...nodes.map((node) => node.distance));
  const distanceExtent = Number(sharedDistance) > 0 ? Number(sharedDistance) : ownDistance;
  nodes.forEach((node) => {
    const measure = scaleMode === "branch" && distanceExtent > 0 ? node.distance / distanceExtent : node.depth / maxDepth;
    node.x = 28 + measure * 280;
  });
  return { tree, nodes, leaves, maxDistance: ownDistance };
}

function historyLossCount(node) {
  return asArray(node?.loss_blocks).reduce((total, block) => total + asArray(block).length, 0);
}

function historyValueList(value) {
  const values = asArray(value).flat(4).filter((item) => item != null && String(item).trim());
  return values.length ? values.map(String).join(", ") : "—";
}

function entryRootGains(entry) {
  const parsed = parseNewickTree(entry?.newick);
  if (!parsed) return null;
  const root = asArray(entry?.nodes).find((node) => String(node?.name) === String(parsed.name));
  return root ? asArray(root.gains).length : null;
}

function entryTreeHeight(entry) {
  const layout = layoutNewick(entry?.newick, 100);
  return layout?.maxDistance ?? null;
}

function AncestralHistoryExplorer({ summary, group, fallbackTree, reportedByDefault }) {
  const orientation = summary?.orientation || {};
  const reconstructions = asArray(orientation.reconstructions).filter((entry) => String(entry?.group || entry?.name) === String(group) && ["input", "reverse"].includes(entry?.hypothesis));
  const comparison = asArray(orientation.comparisons).find((item, index) => groupIdentity(item, index) === String(group));
  const decision = comparison ? comparisonDecisionFor(comparison, orientation).label : "Unresolved";
  const supportedHypothesis = decision === "Input order supported" ? "input" : decision === "Reverse input order supported" ? "reverse" : null;
  const requiredHypothesis = supportedHypothesis || "input";
  const requiredHistoryAvailable = reconstructions.some((item) => item.hypothesis === requiredHypothesis);
  const initialHypothesis = requiredHistoryAvailable ? requiredHypothesis : reconstructions[0]?.hypothesis || requiredHypothesis;
  const [hypothesis, setHypothesis] = useState(initialHypothesis);
  const [scaleMode, setScaleMode] = useState("topology");
  const [fitCanvas, setFitCanvas] = useState(() => Boolean(typeof window !== "undefined" && window.matchMedia?.("(max-width: 980px)")?.matches));
  const [selectedNodeName, setSelectedNodeName] = useState("");
  const descriptionId = useId();
  if (!reconstructions.length) return fallbackTree ? <TreeGraphic newick={fallbackTree} group={group} reportedByDefault={reportedByDefault}/> : null;
  const entry = reconstructions.find((item) => item.hypothesis === hypothesis) || reconstructions[0];
  const completeOrder = asArray(entry.spacer_order).map(Number).filter((value) => Number.isInteger(value) && value > 0);
  const order = completeOrder.slice(0, MAX_HISTORY_SPACER_COLUMNS);
  const omittedSpacerColumns = completeOrder.length - order.length;
  const treeHeights = reconstructions.map(entryTreeHeight).filter((value) => value != null);
  const sharedDistance = Math.max(0, ...treeHeights);
  const provisional = layoutNewick(entry.newick, 100);
  if (!provisional) return fallbackTree ? <TreeGraphic newick={fallbackTree} group={group} reportedByDefault={reportedByDefault}/> : null;
  if (provisional.leaves.length > MAX_HISTORY_LEAVES || provisional.nodes.length > MAX_HISTORY_NODES) {
    return <div className="history-explorer history-size-limit"><Icon name="info"/><div><strong>Structured history available in the result bundle</strong><p>This group contains {formatNumber(provisional.leaves.length)} leaves and {formatNumber(provisional.nodes.length)} tree nodes. The inline browser is capped at {MAX_HISTORY_LEAVES} leaves and {MAX_HISTORY_NODES} nodes to keep this page responsive; use the detailed JSON/Newick artifacts for the complete reconstruction.</p></div></div>;
  }
  const height = Math.max(310, provisional.leaves.length * 74 + 78);
  const layout = layoutNewick(entry.newick, height, scaleMode, sharedDistance);
  const nodeData = asArray(entry.nodes);
  const dataByName = new Map(nodeData.map((node) => [String(node?.name), node]));
  const leafNames = new Set(layout.leaves.map((leaf) => String(leaf.name)));
  const internalData = nodeData.filter((node) => !leafNames.has(String(node?.name)));
  const rootData = dataByName.get(String(layout.tree.name)) || internalData[0] || nodeData[0];
  const selectedNode = nodeData.find((node) => String(node?.name) === selectedNodeName) || rootData;
  const selectedSpacers = new Set(asArray(selectedNode?.spacers).map(Number));
  const shownSelectedSpacers = order.filter((spacer) => selectedSpacers.has(spacer)).length;
  const cellSize = order.length > 50 ? 10 : 13;
  const arrayStart = 485;
  const width = Math.max(930, arrayStart + order.length * cellSize + 30);
  const likelihood = (kind) => finiteMetric(getValue(comparison, kind === "input" ? "forward_ln_likelihood_bdm" : "reverse_ln_likelihood_bdm"));
  const hypothesisLabel = (kind) => kind === "input" ? "Input spacer order" : "Reversed spacer order";
  const inputEntry = reconstructions.find((item) => item.hypothesis === "input");
  const reverseEntry = reconstructions.find((item) => item.hypothesis === "reverse");
  const inputLosses = finiteMetric(inputEntry?.deletion_count);
  const reverseLosses = finiteMetric(reverseEntry?.deletion_count);
  const inputRoot = entryRootGains(inputEntry);
  const reverseRoot = entryRootGains(reverseEntry);
  const nodeLabel = publicNodeName(selectedNode?.name);
  const nodeKind = leafNames.has(String(selectedNode?.name)) ? "Observed leaf" : String(selectedNode?.name) === String(layout.tree.name) ? "Inferred root" : "Inferred ancestor";
  const selectedSpacerIds = asArray(selectedNode?.spacers).map(Number).filter((value) => Number.isInteger(value) && value > 0);
  const branchSummary = layout.nodes.filter((node) => node.parent).map((node) => {
    const data = dataByName.get(String(node.name));
    return `${publicNodeName(node.parent.name)} to ${publicNodeName(node.name)}: ${asArray(data?.gains).length} gains, ${historyLossCount(data)} losses, branch length ${formatNumber(node.length, 6)}`;
  }).join("; ");
  const chooseNode = (name) => setSelectedNodeName(String(name || ""));
  return (
    <div className="history-explorer">
      <p className="sr-only" id={descriptionId}>Ancestral reconstruction for {group} under {hypothesisLabel(entry.hypothesis)}. Leaves in display order: {layout.leaves.map((leaf) => publicNodeName(leaf.name)).join(", ")}. Branches: {branchSummary}. Use the node browser and exact node data table following the visual to inspect ordered spacer identities and events.</p>
      <div className="history-heading"><div><p className="eyebrow">Interactive ancestral history</p><h5>Where gains and losses are placed</h5><p>Switch hypotheses to see why their likelihoods differ. Numeric column IDs identify clustered spacers; the repeating palette helps trace a column across rows.</p></div><div className="history-legend"><span><i className="legend-gain"/> acquisition</span><span><i className="legend-loss"/> deletion</span><span><i className="legend-absence"/> absent</span></div></div>
      {!requiredHistoryAvailable && <div className="history-availability" role="note"><Icon name="warning" size={18}/><p><strong>{supportedHypothesis ? hypothesisLabel(requiredHypothesis) + " is supported, but its structured reconstruction is unavailable." : "The input-order default reconstruction is unavailable for this unresolved group."}</strong> The available hypothesis is shown for inspection only; it is not substituted for the missing reported history. Review the workflow warning and detailed artifacts.</p></div>}
      <div className="history-controls" aria-label={"Reconstruction hypotheses for " + group}>
        {reconstructions.map((candidate) => {
          const active = candidate.hypothesis === entry.hypothesis;
          const selected = candidate.hypothesis === supportedHypothesis;
          const defaulted = !supportedHypothesis && candidate.hypothesis === "input";
          return <button type="button" className={"history-hypothesis" + (active ? " active" : "")} aria-pressed={active} onClick={() => { setHypothesis(candidate.hypothesis); setSelectedNodeName(""); }} key={candidate.hypothesis}><span>{hypothesisLabel(candidate.hypothesis)}{selected && <b>supported</b>}{defaulted && <b>reported default</b>}</span><strong>{formatNumber(candidate.acquisition_count)} gains · {formatNumber(candidate.deletion_count)} losses</strong><small>BDM lnL {formatNumber(likelihood(candidate.hypothesis), 3)} · max root-to-tip {formatNumber(entryTreeHeight(candidate), 6)}</small></button>;
        })}
      </div>
      {inputEntry && reverseEntry && <div className="history-contrast"><Icon name="info" size={18}/><p><strong>Why the histories differ:</strong> input order needs {formatNumber(inputLosses)} inferred deletions and places {formatNumber(inputRoot)} acquisition{inputRoot === 1 ? "" : "s"} at the root; reversed order needs {formatNumber(reverseLosses)} deletions and places {formatNumber(reverseRoot)} at the root. CRISPR-evOr compares the full model likelihoods, not counts alone.</p></div>}
      <div className="history-scale"><span>Tree layout</span><button type="button" className={scaleMode === "topology" ? "active" : ""} aria-pressed={scaleMode === "topology"} onClick={() => setScaleMode("topology")}>Readable topology</button><button type="button" className={scaleMode === "branch" ? "active" : ""} aria-pressed={scaleMode === "branch"} onClick={() => setScaleMode("branch")}>Shared branch scale</button><small>Shared scale uses {formatNumber(sharedDistance, 6)} as the common root-to-tip extent.{omittedSpacerColumns > 0 ? " Showing the first " + MAX_HISTORY_SPACER_COLUMNS + " of " + completeOrder.length + " spacer columns." : ""}</small></div>
      <div className="history-view-controls" role="group" aria-label="Ancestral history canvas view">
        <span>Canvas view</span>
        <button type="button" className={fitCanvas ? "active" : ""} aria-pressed={fitCanvas} onClick={() => setFitCanvas(true)}>Fit overview</button>
        <button type="button" className={!fitCanvas ? "active" : ""} aria-pressed={!fitCanvas} onClick={() => setFitCanvas(false)}>Readable detail</button>
        <small>{fitCanvas ? "Overview fits the full tree and matrix; switch to detail to read every label." : "Readable detail preserves label size; pan horizontally when the matrix exceeds the available width."}</small>
      </div>
      <div className={"history-canvas" + (fitCanvas ? " is-fit" : "")} role="region" tabIndex="0" aria-label={"Scrollable ancestral reconstruction canvas for " + group}>
        <svg width={width} height={height} viewBox={["0", "0", width, height].join(" ")} role="img" aria-describedby={descriptionId} aria-label={"Ancestral reconstruction for " + group + " under " + hypothesisLabel(entry.hypothesis) + " with " + layout.leaves.length + " observed leaves"}>
          <text x={arrayStart} y="24" className="history-axis-label">aligned spacer identity →</text>
          {order.map((spacer, index) => <text key={"column-" + spacer} x={arrayStart + index * cellSize + (cellSize - 2) / 2} y="41" textAnchor="middle" className="history-column-label">{spacer}</text>)}
          {layout.nodes.filter((node) => node.children.length).map((node) => { const ys = node.children.map((child) => child.y); return <g key={"history-edges-" + node.id}><line x1={node.x} x2={node.x} y1={Math.min(...ys)} y2={Math.max(...ys)} className="history-tree-line"/>{node.children.map((child) => <line key={child.id} x1={node.x} x2={child.x} y1={child.y} y2={child.y} className="history-tree-line"/>)}</g>; })}
          {layout.leaves.map((leaf) => <rect key={"row-" + leaf.id} x="320" y={leaf.y - 18} width={width - 338} height="36" rx="4" className="history-leaf-row"/>)}
          {layout.nodes.filter((node) => node.parent).map((node) => {
            const data = dataByName.get(String(node.name));
            const gains = asArray(data?.gains).length;
            const losses = historyLossCount(data);
            if (!gains && !losses) return null;
            const badgeX = Math.max(node.parent.x + 8, (node.parent.x + node.x) / 2 - 14);
            return <g className="history-event-badge" key={"events-" + node.id} transform={"translate(" + badgeX + " " + (node.y - 18) + ")"}><rect width="44" height="16" rx="8"/><text x="22" y="11" textAnchor="middle"><tspan className="history-gain-text">+{gains}</tspan><tspan className="history-loss-text"> −{losses}</tspan></text></g>;
          })}
          {rootData && (asArray(rootData.gains).length > 0 || historyLossCount(rootData) > 0) && <g className="history-event-badge root-event" transform={"translate(" + Math.max(4, layout.tree.x - 8) + " " + (layout.tree.y - 25) + ")"}><rect width="44" height="16" rx="8"/><text x="22" y="11" textAnchor="middle"><tspan className="history-gain-text">+{asArray(rootData.gains).length}</tspan><tspan className="history-loss-text"> −{historyLossCount(rootData)}</tspan></text></g>}
          {layout.nodes.map((node) => <g key={"history-node-" + node.id}><circle cx={node.x} cy={node.y} r={node.children.length ? 5 : 4} className={String(selectedNode?.name) === String(node.name) ? "history-node selected" : node.children.length ? "history-node" : "history-node leaf"}><title>{publicNodeName(node.name)} · {asArray(dataByName.get(String(node.name))?.spacers).length} spacers</title></circle></g>)}
          {layout.leaves.map((leaf) => {
            const data = dataByName.get(String(leaf.name));
            const present = new Set(asArray(data?.spacers).map(Number));
            return <g key={"leaf-state-" + leaf.id}><text x="330" y={leaf.y + 4} className="history-leaf-label"><title>{leaf.name}</title>{publicNodeName(leaf.name).slice(0, 24)}</text>{order.map((spacer, index) => <rect key={spacer} x={arrayStart + index * cellSize} y={leaf.y - 9} width={cellSize - 2} height="18" rx="2" className={present.has(spacer) ? "history-spacer present " + spacerColorClass(spacer) : "history-spacer absent"}><title>Spacer {spacer}: {present.has(spacer) ? "present" : "absent"}</title></rect>)}</g>;
          })}
        </svg>
      </div>
      <div className="ancestor-browser"><div className="ancestor-tabs" role="group" aria-label="Observed and reconstructed nodes">{nodeData.map((node) => <button type="button" className={String(selectedNode?.name) === String(node.name) ? "active" : ""} aria-pressed={String(selectedNode?.name) === String(node.name)} onClick={() => chooseNode(node.name)} key={String(node.name)}>{publicNodeName(node.name)}<small>{leafNames.has(String(node.name)) ? "observed · " : "inferred · "}{asArray(node.spacers).length} spacers</small></button>)}</div>{selectedNode && <div className="ancestor-state"><div><span>{nodeKind}</span><strong>{nodeLabel}</strong><small>{asArray(selectedNode.spacers).length} spacers · +{asArray(selectedNode.gains).length} gains · −{historyLossCount(selectedNode)} losses on the incoming branch{omittedSpacerColumns > 0 ? " · " + shownSelectedSpacers + " present spacers shown in the first " + order.length + " columns" : ""}</small></div><div className="history-spacer-strip" role="img" aria-label={nodeKind + " " + nodeLabel + " contains " + selectedSpacerIds.length + " reconstructed spacers, spacer IDs " + (selectedSpacerIds.length ? selectedSpacerIds.join(", ") : "none") + "; " + shownSelectedSpacers + " are visible in " + order.length + " of " + completeOrder.length + " displayed or available columns"}>{order.map((spacer) => <i className={selectedSpacers.has(spacer) ? "present " + spacerColorClass(spacer) : "absent"} key={spacer}><span>{spacer}</span></i>)}</div></div>}</div>
      <details className="history-data-table">
        <summary>Exact node and branch data</summary>
        <div className="table-wrap" role="region" tabIndex="0" aria-label={"Scrollable exact ancestral reconstruction data for " + group}>
          <table>
            <thead><tr><th>Node</th><th>Parent</th><th>Type</th><th>Branch length</th><th>Ordered spacer IDs</th><th>Gains</th><th>Loss blocks</th><th>Special-event candidates</th></tr></thead>
            <tbody>{layout.nodes.map((node) => {
              const data = dataByName.get(String(node.name)) || {};
              const specialEvents = [
                ["contradictions", data.contradictions],
                ["duplications", data.duplications],
                ["rearrangements", data.rearrangements],
                ["reacquisitions", data.reacquisitions],
                ["independent gains", data.independent_gains],
                ["other duplications", data.other_duplication_events],
              ].filter(([, values]) => historyValueList(values) !== "—").map(([label, values]) => label + ": " + historyValueList(values)).join("; ") || "—";
              const type = leafNames.has(String(node.name)) ? "Observed leaf" : node === layout.tree ? "Inferred root" : "Inferred ancestor";
              return <tr key={"exact-" + node.id}><td><strong>{publicNodeName(node.name)}</strong></td><td>{node.parent ? publicNodeName(node.parent.name) : "—"}</td><td>{type}</td><td>{node.parent ? formatNumber(node.length, 6) : "root"}</td><td>{historyValueList(data.spacers)}</td><td>{historyValueList(data.gains)}</td><td>{historyValueList(data.loss_blocks)}</td><td>{specialEvents}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </details>
      <p className="history-caveat"><strong>Model interpretation:</strong> internal arrays, branch events, topology, and branch lengths are array-derived model estimates—not an independent organismal phylogeny. Every unique spacer requires a first inferred acquisition somewhere in the history; these totals are not newly observed mutations, and orientation support does not establish transcription direction or a leader sequence.</p>
    </div>
  );
}

function EventGlyph({ type }) {
  return <i className={"event-glyph event-glyph-" + type} aria-hidden="true"/>;
}

function SpacerPlacerVerdict({ row }) {
  const acquisitions = Math.max(0, finiteMetric(getValue(row, "nb of reconstructed insertions", "gains", "insertions", "gain_events")) || 0);
  const deletions = Math.max(0, finiteMetric(getValue(row, "nb of reconstructed deletions", "deletions", "losses", "deletion_events")) || 0);
  const leaves = finiteMetric(getValue(row, "nb of leafs (after combining non-uniques)", "leaf_count"));
  const patterns = finiteMetric(getValue(row, "nb of unique spacer arrays", "unique_arrays"));
  const unique = finiteMetric(getValue(row, "nb of unique spacers", "unique_spacers"));
  return <div className="spacerplacer-verdict"><div><small>Evolutionary reconstruction at a glance</small><strong>{formatNumber(acquisitions)} acquisitions · {formatNumber(deletions)} deletions</strong><p>SpacerPlacer placed ancestral events across {formatNumber(leaves)} related arrays. An acquisition includes a spacer’s inferred first entry into the history; these are model estimates, not newly observed mutations.</p></div><div className="verdict-metrics"><span><b>{formatNumber(unique)}</b><small>unique spacers</small></span><span><b>{formatNumber(patterns)}</b><small>distinct array patterns</small></span><span><b>{formatNumber(leaves)}</b><small>modeled leaves</small></span></div></div>;
}

function SpacerInventory({ row }) {
  const unique = finiteMetric(getValue(row, "nb of unique spacers", "unique_spacers"));
  const aligned = finiteMetric(getValue(row, "nb of spacers in alignment", "nb of spacers in model matrix", "alignment_spacers"));
  const visible = Math.min(18, Math.max(0, Math.round(unique || 0)));
  if (unique == null && aligned == null) return null;
  return (
    <div className="spacer-inventory">
      <div className="graphic-label"><span>Spacer inventory</span><small>Count view, not branch placement</small></div>
      <div className="spacer-blocks" role="img" aria-label={(unique == null ? "Unknown number of" : formatNumber(unique)) + " unique spacers in " + formatNumber(aligned) + " aligned spacer positions; count view only"}>{Array.from({ length: visible }, (_, index) => <i className="spacer-block spacer-block-neutral" key={index}><span>{index + 1}</span></i>)}{unique > visible && <b>+{formatNumber(unique - visible)}</b>}</div>
      <div className="inventory-counts"><span><strong>{formatNumber(unique)}</strong> unique spacers</span><span><strong>{formatNumber(aligned)}</strong> aligned positions</span><span><strong>{formatNumber(getValue(row, "nb of leafs (after combining non-uniques)", "leaf_count"))}</strong> tree leaves</span><span><strong>{formatNumber(getValue(row, "nb of unique spacer arrays", "unique_arrays"))}</strong> unique array patterns</span></div>
    </div>
  );
}

function ModelSelectionGauge({ row }) {
  const reportedStatistic = finiteMetric(getValue(row, "test_statistic (-2*ln_lh_ratio)", "likelihood_ratio_statistic"));
  const statistic = Math.max(0, reportedStatistic ?? 0);
  const cutoff = finiteMetric(getValue(row, "chi2_quantile", "model_selection_cutoff"));
  const preferred = String(getValue(row, "Deletion model preferred by LRT", "preferred_model", "model_name", "model") || "not reported");
  const extent = Math.max(1, cutoff ? cutoff * 1.45 : 0, statistic * 1.18);
  const valuePosition = Math.min(100, (statistic / extent) * 100);
  const cutoffPosition = cutoff == null ? null : Math.min(100, (cutoff / extent) * 100);
  const aria = "Deletion model likelihood-ratio statistic " + formatNumber(statistic, 3) + (cutoff == null ? "" : ", cutoff " + formatNumber(cutoff, 3)) + ". Preferred model " + preferred + ".";
  return (
    <div className="model-selection">
      <div className="graphic-label"><span>Deletion-pattern model</span><small>IDM versus BDM</small></div>
      <div className="model-call"><strong>{preferred}</strong><span>{preferred === "BDM" ? "Block deletion model favored by this LRT" : preferred === "IDM" ? "BDM not favored by this LRT" : "Reported model"}</span></div>
      {reportedStatistic != null ? <><div className="model-gauge" role="img" aria-label={aria}><span className="model-gauge-fill" style={{ width: valuePosition + "%" }}/>{cutoffPosition != null && <i className="model-cutoff" style={{ left: cutoffPosition + "%" }}><b>LRT cutoff</b></i>}<i className="model-value" style={{ left: valuePosition + "%" }}/></div><div className="model-axis"><span>IDM retained</span><span>Evidence for BDM</span></div></> : <p className="model-unavailable">Likelihood-ratio statistic not reported.</p>}
      <div className="model-likelihoods"><span>IDM lnL <b>{formatNumber(getValue(row, "ln_lh_idm"), 3)}</b></span><span>BDM lnL <b>{formatNumber(getValue(row, "ln_lh_bdm"), 3)}</b></span></div>
      <p className="model-interpretation">Retaining IDM is not proof that deletions are biologically independent. Rates are conditional on this model tree and its branch scale, not per-generation measurements.</p>
    </div>
  );
}

function ReconstructionEventGraphic({ row }) {
  const acquisitions = Math.max(0, finiteMetric(getValue(row, "nb of reconstructed insertions", "gains", "insertions", "gain_events")) || 0);
  const deletions = Math.max(0, finiteMetric(getValue(row, "nb of reconstructed deletions", "deletions", "losses", "deletion_events")) || 0);
  const total = acquisitions + deletions;
  const acquisitionWidth = total ? (acquisitions / total) * 100 : 50;
  const deletionWidth = total ? 100 - acquisitionWidth : 50;
  const specials = [["duplication", "Duplication candidates", getValue(row, "nb of reconstructed duplications", "duplications")], ["rearrangement", "Rearrangement candidates", getValue(row, "nb of reconstructed rearrangements", "rearrangements")], ["reacquisition", "Reacquisition candidates", getValue(row, "nb of reconstructed reacquisitions", "reacquisitions")], ["independent", "Independent-gain candidates", getValue(row, "nb of reconstructed independent gains", "independent_gains")]].filter(([, , value]) => Number(finiteMetric(value)) > 0);
  return (
    <div className="event-graphic">
      <div className="graphic-label"><span>Reconstructed event totals</span><small>Reported ancestral history</small></div>
      <div className="event-ribbon" role="img" aria-label={"Reconstructed event tally: " + formatNumber(acquisitions) + " acquisitions and " + formatNumber(deletions) + " deletions"}><span className="event-ribbon-gains" style={{ width: acquisitionWidth + "%" }}><EventGlyph type="acquisition"/><b>{formatNumber(acquisitions)}</b><small>acquisitions</small></span><span className="event-ribbon-losses" style={{ width: deletionWidth + "%" }}><EventGlyph type="deletion"/><b>{formatNumber(deletions)}</b><small>deletions</small></span></div>
      {specials.length > 0 ? <div className="special-event-grid">{specials.map(([type, label, value]) => <span key={type}><EventGlyph type={type}/><b>{formatNumber(value)}</b><small>{label}</small></span>)}</div> : <p className="no-special-events">No duplication, rearrangement, reacquisition, or independent-gain candidates were reported.</p>}
      <p>The visual key is adapted from SpacerPlacer: green denotes acquisitions, red denotes deletions, and distinct shapes flag special-event candidates when present.</p>
    </div>
  );
}

function ReconstructionResults({ summary }) {
  const reconstruction = summary?.reconstruction || summary?.spacerplacer;
  const orientation = summary?.orientation;
  const rows = asArray(orientation?.selected_reconstructions).length ? asArray(orientation.selected_reconstructions) : asArray(reconstruction?.results).length ? asArray(reconstruction.results) : reconstruction?.selected_model ? [reconstruction.selected_model] : [];
  if (!rows.length) return null;
  const treePolicy = orientation?.tree_policy || reconstruction?.tree_policy || summary?.pipeline?.stages?.spacerplacer?.tree_source || "not_reported";
  const deletionCount = (row) => getValue(row, "nb of reconstructed deletions", "deletions", "losses", "deletion_events");
  const noDeletionGroups = rows.filter((row) => Number(deletionCount(row)) === 0).map((row, index) => row.name || row.group || "Group " + (index + 1));
  return (
    <section className="result-section reconstruction-section" aria-labelledby="reconstruction-heading">
      <div className="result-heading"><div><p className="eyebrow">SpacerPlacer ancestral reconstruction</p><h3 id="reconstruction-heading">How the spacer arrays changed</h3></div><p>Inspect the reported history as a rooted tree, aligned spacer states, branch events, spacer diversity, and deletion-model evidence.</p></div>
      <div className="tree-policy"><span className="tree-glyph" aria-hidden="true"><Icon name="tree"/></span><div><strong>Tree policy used: {String(treePolicy).replaceAll("_", " ")}</strong><p>Decisive groups report the evidence-supported hypothesis. Unresolved groups retain input order as a reporting default and are not presented as selected by evidence.</p></div></div>
      {orientation?.reconstructions_truncated && <div className="history-truncation" role="note"><Icon name="warning" size={18}/><p><strong>Some structured ancestral histories were omitted from this summary.</strong> A group may fall back to its bounded tree/count view below; use the result artifacts for complete detail.</p></div>}
      <div className="reconstruction-story-list">{rows.map((row, index) => {
        const group = String(row.name || row.group || "Group " + (index + 1));
        const tree = selectedTree(summary, group);
        const comparison = asArray(orientation?.comparisons).find((item, comparisonIndex) => groupIdentity(item, comparisonIndex) === group);
        const reportedByDefault = !comparison || comparisonDecisionFor(comparison, orientation).label === "Unresolved";
        return <article className={"reconstruction-story group-tone-" + (index % 4)} key={group}><div className="reconstruction-story-heading"><div><small>Reconstructed group {index + 1}</small><h4>{group}</h4></div><span>{formatNumber(getValue(row, "nb of leafs (after combining non-uniques)", "leaf_count"))} leaves</span></div><SpacerPlacerVerdict row={row}/><AncestralHistoryExplorer key={group} summary={summary} group={group} fallbackTree={tree} reportedByDefault={reportedByDefault}/><div className="reconstruction-visual-grid"><ReconstructionEventGraphic row={row}/><ModelSelectionGauge row={row}/></div><SpacerInventory row={row}/></article>;
      })}</div>
      <details className="reconstruction-values"><summary>Exact SpacerPlacer estimates and runtime</summary><div className="table-wrap reconstruction-table"><table><thead><tr><th>Group</th><th>Preferred deletion model</th><th>BDM lnL</th><th>Insertions</th><th>Deletions</th><th>BDM deletion rate (model branch scale)</th><th>Runtime</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.name || row.group || index}><td><strong>{row.name || row.group || "Group " + (index + 1)}</strong></td><td>{getValue(row, "Deletion model preferred by LRT", "preferred_model", "model_name", "model") || "—"}</td><td>{formatNumber(getValue(row, "ln_lh_bdm", "log_likelihood", "ln_likelihood", "lnL"), 3)}</td><td>{formatNumber(getValue(row, "nb of reconstructed insertions", "gains", "insertions", "gain_events"))}</td><td>{formatNumber(deletionCount(row))}</td><td>{formatNumber(getValue(row, "deletion_rate_bdm", "deletion_rate", "loss_rate"), 4)}</td><td>{formatDuration(getValue(row, "run_time", "runtime_seconds", "duration_seconds"))}</td></tr>)}</tbody></table></div></details>
      {noDeletionGroups.length > 0 && <div className="warning-note"><Icon name="warning"/><p><strong>No deletion events were reconstructed for {noDeletionGroups.join(", ")}.</strong> Deletion-rate estimates, model comparisons, and orientation evidence may not be meaningful for those groups; inspect the detailed outputs.</p></div>}
    </section>
  );
}

function Provenance({ job, summary }) {
  const warnings = [...asArray(summary?.warnings), ...asArray(job?.options?.warnings), ...asArray(job?.warnings)].filter(Boolean);
  const provenance = summary?.provenance || job?.provenance || {};
  const versions = provenance.tool_versions || provenance.versions || {};
  const parameters = provenance.parameters || job?.options || job?.request?.options || {};
  return (
    <section className="result-section provenance-section" aria-labelledby="provenance-heading">
      <div className="result-heading"><div><p className="eyebrow">Reproducibility</p><h3 id="provenance-heading">Warnings & provenance</h3></div><p>Warnings remain part of the result bundle and should travel with downstream interpretations.</p></div>
      {warnings.length ? <ul className="warning-list">{warnings.map((warning, index) => <li key={`${warning?.stage || "workflow"}:${warning?.group || ""}:${warning?.orientation || ""}:${warning?.code || "warning"}:${index}`}><Icon name="warning" size={18}/><span><strong>{warning.title || warning.code || "Analysis warning"}</strong>{warning.message || String(warning)}</span></li>)}</ul> : <p className="no-warnings"><Icon name="check" size={17}/> No workflow warnings were reported.</p>}
      <div className="provenance-grid">
        <div><h4>Tool versions</h4>{Object.keys(versions).length ? <dl>{Object.entries(versions).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{String(value)}</dd></div>)}</dl> : <p className="muted">See the provenance manifest in the result bundle.</p>}</div>
        <div><h4>Recorded policy</h4>{Object.keys(parameters).length ? <dl>{Object.entries(parameters).map(([key, value]) => <div key={key}><dt>{key.replaceAll("_", " ")}</dt><dd>{typeof value === "boolean" ? (value ? "enabled" : "disabled") : String(value)}</dd></div>)}</dl> : <p className="muted">See the provenance manifest in the result bundle.</p>}</div>
      </div>
    </section>
  );
}

function Downloads({ job, credential, maxArchiveBytes = 0 }) {
  const [downloading, setDownloading] = useState("");
  const [error, setError] = useState("");
  const artifacts = asArray(job?.artifacts || job?.summary?.artifacts).filter((artifact) => {
    const size = Number(artifact?.size_bytes);
    return !Number.isFinite(size) || size > 0;
  });
  const bundleArtifact = artifacts.find((artifact) => {
    const label = `${artifact?.kind || ""} ${artifact?.filename || artifact?.name || ""}`.toLowerCase();
    return label.includes("bundle") || label.includes("archive") || label.includes("results.zip");
  });
  const individualArtifacts = artifacts.filter((artifact) => artifact !== bundleArtifact);
  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const download = async (artifact = null) => {
    const id = artifact ? String(artifact.artifact_id || artifact.id) : "bundle";
    setDownloading(id);
    setError("");
    try {
      const blob = artifact
        ? await api.downloadArtifact(credential.jobId, id, credential.accessToken)
        : await api.downloadArtifact(credential.jobId, String(bundleArtifact.artifact_id || bundleArtifact.id), credential.accessToken);
      saveBlob(blob, artifact ? downloadName(artifact.filename || artifact.name, `${id}.dat`) : `crispr-analysis-${credential.jobId}.zip`);
    } catch (downloadError) {
      setError(downloadError.message || "Download failed.");
    } finally {
      setDownloading("");
    }
  };
  return (
    <section className="result-section downloads" aria-labelledby="downloads-heading">
      <div className="result-heading"><div><p className="eyebrow">Export</p><h3 id="downloads-heading">Reports and result bundle</h3></div><p>Downloads are authenticated in the request header. The private access token is never placed in a URL.</p></div>
      <p className="download-memory-note"><Icon name="info" size={16}/> Authenticated files are buffered in this browser tab before saving{maxArchiveBytes ? ` and the server caps the complete archive at ${readableBytes(maxArchiveBytes)}` : ""}. Keep enough free browser memory for the download.</p>
      {bundleArtifact ? <button className="bundle-button" type="button" onClick={() => download()} disabled={Boolean(downloading)}><span><Icon name="download"/><i>ZIP</i></span><span><strong>{downloading === "bundle" ? "Preparing download…" : "Download complete result bundle"}</strong><small>Tables · trees · alignments · warnings · provenance</small></span></button> : <div className="archive-unavailable" role="note"><Icon name="warning" size={17}/><p><strong>Complete ZIP not available.</strong> The service did not register a bundle, for example because safe archive limits were reached. Inspect run warnings and use any individual outputs listed below.</p></div>}
      {individualArtifacts.length > 0 && <div className="artifact-grid">{individualArtifacts.map((artifact, index) => {
        const id = String(artifact.artifact_id || artifact.id || index);
        return <button type="button" key={id} onClick={() => download(artifact)} disabled={Boolean(downloading)}><Icon name="file"/><span><strong>{artifact.label || artifact.filename || artifact.name || `Artifact ${index + 1}`}</strong><small>{artifact.media_type || artifact.kind || "Result file"}</small></span><Icon name="download" size={17}/></button>;
      })}</div>}
      {error && <p className="download-error" role="alert">{error}</p>}
    </section>
  );
}

function ResultSynopsis({ summary, exampleSnapshot, noEligible }) {
  const detection = summary?.detection || summary || {};
  const adapter = summary?.adapter || {};
  const orientation = summary?.orientation || summary?.orientation_evidence || {};
  const comparisons = asArray(orientation.comparisons || orientation.groups);
  const reconstructions = asArray(orientation.selected_reconstructions).length ? asArray(orientation.selected_reconstructions) : asArray(summary?.reconstruction?.results);
  const comparison = comparisons[0];
  const reconstruction = reconstructions[0];
  const categories = detection.category_counts || detection.categories || {};
  const categoryTotal = Object.values(categories).reduce((total, value) => total + (finiteMetric(value) ?? 0), 0);
  const arrayCount = finiteMetric(detection.array_count) ?? (categoryTotal || asArray(detection.arrays).length);
  const bonaFide = finiteMetric(categories["Bona-fide"]) ?? 0;
  const modeled = finiteMetric(getValue(adapter, "emitted_array_count", "retained_arrays"));
  const groups = finiteMetric(getValue(adapter, "emitted_group_count", "eligible_groups"));
  const patterns = finiteMetric(getValue(reconstruction, "nb of unique spacer arrays", "unique_arrays"));
  const delta = finiteMetric(getValue(comparison, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL"));
  const decision = comparison ? comparisonDecisionFor(comparison, orientation).label : null;
  const acquisitions = finiteMetric(getValue(reconstruction, "nb of reconstructed insertions", "gains", "insertions"));
  const deletions = finiteMetric(getValue(reconstruction, "nb of reconstructed deletions", "deletions", "losses"));
  const example = exampleSnapshot?.example;
  const generatedTakeaway = noEligible
    ? "CRISPR array detection completed, but no group met the requirements for an evolutionary comparison."
    : decision
      ? decision + (delta == null ? "." : " with Δ lnL " + signedNumber(delta, 2) + "; inspect the two reconstructed histories below to see what drives that support.")
      : "Detection and reconstruction completed; inspect each evidence layer and its warnings below.";
  const cards = [
    { label: "Detection", value: formatNumber(bonaFide) + " / " + formatNumber(arrayCount), detail: "Bona-fide arrays" },
    { label: "Model input", value: modeled == null || groups == null ? "Not reported" : formatNumber(modeled) + " → " + formatNumber(groups), detail: "arrays → eligible groups" },
    { label: "Orientation evidence", value: delta == null ? "Not evaluated" : "Δ lnL " + signedNumber(delta, 2), detail: decision || "No decision" },
    { label: "Reported history", value: acquisitions == null || deletions == null ? "Not reconstructed" : formatNumber(acquisitions) + " / " + formatNumber(deletions), detail: "acquisitions / deletions" + (patterns == null ? "" : " · " + formatNumber(patterns) + " array patterns") },
  ];
  return (
    <section className={"result-synopsis" + (example ? " precomputed-synopsis" : "")} aria-labelledby="synopsis-heading">
      <div className="synopsis-copy"><p className="eyebrow">{example ? "Precomputed example · biological question" : "Result synopsis"}</p><h3 id="synopsis-heading">{example?.analysis_question || "What does this run support?"}</h3><p>{example?.analysis_takeaway || generatedTakeaway}</p></div>
      <div className="synopsis-cards">{cards.map((card) => <div key={card.label}><span>{card.label}</span><strong>{card.value}</strong><small>{card.detail}</small></div>)}</div>
    </section>
  );
}

export function Results({ job, credential, maxArchiveBytes = 0, exampleSnapshot = null }) {
  const sourceSummary = job?.summary || job?.result || {};
  const [artifactGroups, setArtifactGroups] = useState(null);
  const [membershipStatus, setMembershipStatus] = useState(adapterHasMembership(sourceSummary) ? "inline" : "idle");
  const membershipArtifact = asArray(job?.artifacts || sourceSummary?.artifacts).find((artifact) => String(artifact?.name || artifact?.filename || "") === "adapter/manifest.json");
  const membershipArtifactId = membershipArtifact ? String(membershipArtifact.artifact_id || membershipArtifact.id || "") : "";
  const jobId = credential?.jobId || "";
  const accessToken = credential?.accessToken || "";
  const inlineMembership = adapterHasMembership(sourceSummary);

  useEffect(() => {
    if (inlineMembership) {
      setArtifactGroups(null);
      setMembershipStatus("inline");
      return undefined;
    }
    if (!membershipArtifactId || !jobId || !accessToken) {
      setArtifactGroups(null);
      setMembershipStatus("unavailable");
      return undefined;
    }
    const controller = new AbortController();
    setArtifactGroups(null);
    setMembershipStatus("loading");
    void (async () => {
      try {
        const blob = await api.downloadArtifact(jobId, membershipArtifactId, accessToken, { signal: controller.signal });
        if (Number(blob?.size) > MAX_ADAPTER_MANIFEST_BYTES) throw new Error("Adapter manifest is too large.");
        const text = await blob.text();
        if (new TextEncoder().encode(text).byteLength > MAX_ADAPTER_MANIFEST_BYTES) throw new Error("Adapter manifest is too large.");
        const groups = sanitizeAdapterMembership(JSON.parse(text));
        if (!groups.some((group) => group.arrays.length > 0)) throw new Error("Adapter manifest has no valid group membership.");
        if (!controller.signal.aborted) {
          setArtifactGroups(groups);
          setMembershipStatus("loaded");
        }
      } catch (error) {
        if (!controller.signal.aborted) setMembershipStatus("unavailable");
      }
    })();
    return () => controller.abort();
  }, [accessToken, inlineMembership, jobId, membershipArtifactId]);

  const summary = useMemo(() => mergeAdapterMembership(sourceSummary, artifactGroups), [sourceSummary, artifactGroups]);
  if (!["completed", "completed_no_eligible_groups"].includes(job?.status)) return null;
  const detection = summary.detection || summary;
  const arrays = asArray(detection.arrays || detection.detected_arrays);
  const noEligible = job.status === "completed_no_eligible_groups";
  return (
    <section className="results" aria-labelledby="results-heading">
      <div className="results-title"><div><h2 id="results-heading" tabIndex="-1"><span className="sr-only">Analysis result</span>{" "}{noEligible ? "Detection succeeded; evolution was not applicable." : "Evidence, with its limits visible."}</h2></div><span className="complete-stamp"><Icon name="check"/> Completed</span></div>
      <nav className="result-jump-nav" aria-label="Result sections">
        <span>Result map</span>
        <a href="#synopsis-heading">Synopsis</a>
        {!noEligible && <a href="#orientation-heading">CRISPR-evOr</a>}
        {!noEligible && <a href="#reconstruction-heading">SpacerPlacer</a>}
        <a href="#category-heading">Detection</a>
        {!noEligible && <a href="#group-map-heading">Evidence chain</a>}
        <a href="#preflight-heading">Preflight</a>
        <a href="#provenance-heading">Provenance</a>
      </nav>
      {noEligible && <div className="no-eligible" role="status"><Icon name="info"/><div><strong>No eligible evolutionary groups</strong><p>The workflow completed successfully and the detection results below remain valid. No group passed the selected category, similarity, record-count, and strand preflight rules, so no evolutionary or orientation claim was made.</p></div></div>}
      <ResultSynopsis summary={summary} exampleSnapshot={exampleSnapshot} noEligible={noEligible}/>
      <CategorySummary summary={detection} arrays={arrays}/>
      <Preflight summary={summary}/>
      <EvolutionaryGroupMap summary={summary} membershipStatus={membershipStatus}/>
      <OrientationResults summary={summary}/>
      <ReconstructionResults summary={summary}/>
      <Provenance job={job} summary={summary}/>
      {!exampleSnapshot && <Downloads job={job} credential={credential} maxArchiveBytes={maxArchiveBytes}/>}
    </section>
  );
}

function ScopeSection() {
  return (
    <section className="scope" id="scope" aria-labelledby="scope-heading">
      <div><h2 id="scope-heading">What CRISPR-evOr can—and cannot—tell you.</h2></div>
      <div className="scope-grid">
        <article className="scope-can"><span><Icon name="check"/></span><h3>Evolutionary order evidence</h3><p>CRISPR-evOr compares the likelihood of observed spacer-array histories in input and reversed order, conditional on detected arrays, grouping, tree, and model.</p><ul><li>Relative support for array order</li><li>Reported ancestral reconstruction</li><li>Gain/loss model summaries</li></ul></article>
        <article className="scope-cannot"><span>≠</span><h3>Not functional annotation</h3><p>Array-order support is not direct experimental evidence of molecular function or expression.</p><ul><li>Does not infer transcription direction or leader sequence</li><li>Does not infer PAMs or target sites</li><li>Does not design or validate genome-editing guides</li></ul></article>
      </div>
      <p className="scope-footnote">Treat “input” and “reverse input” as ordering hypotheses—not automatically as leader-proximal or transcribed orientations.</p>
    </section>
  );
}

function References() {
  const citations = [
    { tool: "CRISPRidentify", venue: "Nucleic Acids Research · 2021", title: "Identification of CRISPR arrays using a machine-learning approach", doi: "https://doi.org/10.1093/nar/gkaa1158", source: "https://github.com/BackofenLab/CRISPRidentify" },
    { tool: "SpacerPlacer", venue: "Nucleic Acids Research · 2024", title: "Ancestral reconstruction of CRISPR arrays reveals spacer-deletion dynamics", doi: "https://doi.org/10.1093/nar/gkae772", source: "https://github.com/fbaumdicker/SpacerPlacer" },
    { tool: "CRISPR-evOr", venue: "PLOS · 2025", title: "An evolutionary approach to predict the orientation of CRISPR arrays", doi: "https://doi.org/10.1371/journal.pcbi.1013706", source: "https://github.com/fbaumdicker/SpacerPlacer" },
  ];
  return (
    <section className="references" aria-labelledby="references-heading">
      <div className="references-heading"><div><h2 id="references-heading">Primary references</h2></div><p>Use the archived bundle for run-specific versions and parameters; cite the corresponding methods when publishing results.</p></div>
      <div className="reference-grid">{citations.map((item) => (
        <article key={item.tool}>
          <span>{item.venue}</span>
          <h3>{item.tool}</h3>
          <p>{item.title}</p>
          <div><a href={item.doi} target="_blank" rel="noopener noreferrer">Publication <Icon name="external" size={15}/></a><a href={item.source} target="_blank" rel="noopener noreferrer">Source <Icon name="external" size={15}/></a></div>
        </article>
      ))}</div>
    </section>
  );
}

function Footer({ service }) {
  let hostname = "not configured";
  try { hostname = api.displayBase ? new URL(api.displayBase).hostname : hostname; } catch { /* Invalid configuration is shown by service status. */ }
  return (
    <footer><div><Brand/><p>Research software for transparent CRISPR array detection and evolutionary reconstruction.</p></div><div><strong>Analysis service</strong><span>{hostname}</span><small>{service.version ? `API ${service.version}` : "Operator-provided endpoint"}</small></div><div><strong>Data handling</strong><span>Token-protected jobs</span><small>Automatic expiry · no token in URLs</small></div></footer>
  );
}

export default function App() {
  const [service, setService] = useState({ state: "checking", message: "" });
  const [limits, setLimits] = useState({ maxBases: 0, maxRecordBases: 0, maxRecords: 0, maxRequestBytes: 0, maxArchiveBytes: 0, maxHeaderCharacters: 200 });
  const [credential, setCredential] = useState(null);
  const [job, setJob] = useState(null);
  const [exampleSnapshot, setExampleSnapshot] = useState(null);
  const [pollError, setPollError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    if (!api.configured) {
      setService({ state: "offline", message: "The site operator has not configured VITE_API_BASE_URL." });
      return () => controller.abort();
    }
    Promise.all([api.health({ signal: controller.signal }), api.config({ signal: controller.signal })])
      .then(([health, config]) => {
        setService({ state: "online", version: health?.version || config?.api_version, expiresHours: config?.retention_hours || health?.retention_hours || (config?.retention_seconds ? Math.round(config.retention_seconds / 3600) : null) });
        setLimits({
          maxBases: config?.max_total_bases || config?.max_sequence_bases || health?.max_sequence_bases || 0,
          maxRecordBases: config?.max_record_bases || 0,
          maxRecords: config?.max_records || health?.max_records || 0,
          maxRequestBytes: config?.max_request_bytes || 0,
          maxArchiveBytes: config?.max_archive_bytes || 0,
          maxHeaderCharacters: config?.max_header_characters || 200,
        });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setService({ state: "offline", message: error.message || "The analysis API could not be reached." });
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!credential) return undefined;
    let stopped = false;
    let timer;
    let controller;
    const poll = async () => {
      controller = new AbortController();
      try {
        const latest = await api.getJob(credential.jobId, credential.accessToken, { signal: controller.signal });
        if (stopped) return;
        setJob(latest);
        setPollError("");
        if (latest.expires_at && latest.expires_at !== credential.expiresAt) {
          const updatedCredential = normalizeJobCredential({
            ...credential,
            expiresAt: latest.expires_at,
          });
          setCredential(updatedCredential);
          return;
        }
        if (!TERMINAL_STATUSES.has(latest.status)) timer = window.setTimeout(poll, 2500);
      } catch (error) {
        if (stopped || error.name === "AbortError") return;
        if ([401, 403, 404, 410].includes(error.status)) {
          setCredential(null);
          setJob(null);
        }
        setPollError(error.message || "Job status could not be refreshed.");
        if (![401, 403, 404, 410].includes(error.status)) timer = window.setTimeout(poll, 5000);
      }
    };
    poll();
    return () => { stopped = true; window.clearTimeout(timer); controller?.abort(); };
  }, [credential]);

  const onSubmitted = useCallback((nextCredential, initialJob) => {
    setExampleSnapshot(null);
    setCredential(nextCredential);
    setJob(initialJob);
    setPollError("");
    window.setTimeout(() => revealSection("job-status", "#job-heading"), 50);
  }, []);

  const onResumed = useCallback((nextCredential) => {
    setExampleSnapshot(null);
    setCredential(nextCredential);
    setJob(null);
    setPollError("");
    window.setTimeout(() => revealSection("job-status", "#job-heading"), 50);
  }, []);

  const onExampleLoaded = useCallback((snapshot) => {
    setExampleSnapshot(snapshot);
    if (snapshot) window.setTimeout(() => revealSection("example-result", "#results-heading"), 50);
  }, []);

  const cancel = async () => {
    if (!credential || cancelling) return;
    setCancelling(true);
    setPollError("");
    try {
      const cancelled = await api.cancelJob(credential.jobId, credential.accessToken);
      setJob(cancelled?.job || cancelled);
    } catch (error) {
      setPollError(error.message || "The cancellation request failed.");
    } finally {
      setCancelling(false);
    }
  };

  const forget = useCallback(() => {
    setCredential(null);
    setJob(null);
    setPollError("");
  }, []);

  return (
    <div className="site-shell">
      <Hero service={service}/>
      <main>
        {!credential && <ResumeJob onResume={onResumed}/>}
        <AnalysisForm service={service} limits={limits} onSubmitted={onSubmitted} onExampleLoaded={onExampleLoaded} hasActiveJob={Boolean(credential)}/>
        {exampleSnapshot && <><p className="sr-only" role="status">Precomputed example result ready.</p><div id="example-result" className="example-anchor"><Results job={exampleSnapshot.job} exampleSnapshot={exampleSnapshot}/></div></>}
        {credential && <div id="job-status" className="job-anchor"><JobProgress job={job || { status: "queued" }} credential={credential} onCancel={cancel} onForget={forget} cancelling={cancelling}/><Results job={job} credential={credential} maxArchiveBytes={limits.maxArchiveBytes}/></div>}
        {pollError && <p className="poll-error" role="alert">{pollError}</p>}
        <ScopeSection/>
        <References/>
      </main>
      <Footer service={service}/>
    </div>
  );
}
