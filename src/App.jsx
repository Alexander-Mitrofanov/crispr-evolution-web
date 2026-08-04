import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  return (
    <div className={`service-status service-${service.state}`} role="status">
      <span className="status-pulse" aria-hidden="true" />
      <span>{label}</span>
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
          <p className="kicker"><span>CRISPRidentify v2</span><i />SpacerPlacer<i />CRISPR-evOr</p>
          <h1>From detected arrays to <em>evolutionary evidence.</em></h1>
          <p className="hero-lead">
            Analyze CRISPR spacer-array structure across related genomic records, reconstruct ancestral histories, and test which array order the evolutionary model supports.
          </p>
          <a className="hero-action" href="#analysis-form">Start an analysis <Icon name="arrow" /></a>
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
          <div className="number-control"><button type="button" aria-label="Decrease spacer edit distance" onClick={() => setOptions({ ...options, spacerEditDistance: Math.max(0, options.spacerEditDistance - 1) })}>−</button><output id="edit-distance" aria-live="polite">{options.spacerEditDistance}</output><button type="button" aria-label="Increase spacer edit distance" onClick={() => setOptions({ ...options, spacerEditDistance: Math.min(2, options.spacerEditDistance + 1) })}>+</button></div>
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
      <div className="input-heading">
        <div><label htmlFor="fasta-input">Related contigs or small genomes</label><p>Paste FASTA or upload a plain-text file. The first token in every header must be unique.</p></div>
        <button className="text-button" type="button" onClick={loadExample} disabled={loadingExample || exampleDisabled} title={exampleDisabled ? "Finish or leave the current job before opening the example." : undefined}>{loadingExample ? "Loading example…" : "Run example"}</button>
      </div>
      <div className="upload-strip">
        <button className="upload-button" type="button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={18}/> Upload FASTA</button>
        <input ref={fileRef} type="file" accept=".fa,.fasta,.fna,.ffn,.fas,.txt,text/plain" onChange={onFile} aria-label="Upload FASTA file" />
        <span className="filename">{sequence ? filename : "No file selected"}</span>
        <span className="input-stats"><b>{inspection.recordCount}</b> records <i/> <b>{readableBases(inspection.baseCount)}</b></span>
      </div>
      <textarea id="fasta-input" spellCheck="false" value={sequence} onChange={(event) => { setSequence(event.target.value); setFilename("pasted-input.fasta"); setFileError(""); }} placeholder={">isolate_A\nACGT…\n>isolate_B\nACGT…"} aria-describedby="fasta-help fasta-errors" />
      <div className="input-foot" id="fasta-help"><span>Accepted symbols: A C G T and IUPAC ambiguity codes</span><span>Input stays in this browser until submission</span></div>
      <div id="fasta-errors" className="field-errors" role="alert">{fileError && <p>{fileError}</p>}{inspection.errors.slice(0, 3).map((error) => <p key={error}>{error}</p>)}</div>
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
  const inspection = useMemo(() => inspectFasta(sequence, { maxHeaderCharacters: limits.maxHeaderCharacters || 200 }), [sequence, limits.maxHeaderCharacters]);
  const selectedMode = ANALYSIS_MODES.find((item) => item.id === mode);
  const submission = useMemo(() => buildSubmission({ sequence, filename, mode, options }), [sequence, filename, mode, options]);
  const requestBytes = useMemo(() => new TextEncoder().encode(JSON.stringify(submission)).byteLength, [submission]);
  const recordedExampleOptions = preparedExample?.job?.options;
  const precomputedPolicyMatches = Boolean(
    preparedExample
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
      <div className="section-intro"><p className="eyebrow">Analysis builder</p><h2 id="workflow-title">Make the question explicit before running the model.</h2><p>Detection confidence and evolutionary evidence answer different questions. This workflow keeps them separate.</p></div>
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
          <button className="primary-button" type="submit" disabled={!ready || submitting}>{submitting ? (precomputedPolicyMatches ? "Loading result…" : "Submitting…") : hasActiveJob ? "Current job still open" : "Compute"}<Icon name="arrow"/></button>
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
      <div><p className="eyebrow">Already submitted?</p><h2 id="resume-heading">Resume with a private recovery file.</h2><p>The file is parsed locally, then its bearer token is sent only in the API Authorization header.</p></div>
      <label className="resume-button"><Icon name="upload" size={17}/>Choose recovery JSON<input type="file" accept=".json,application/json" onChange={load}/></label>
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
        <div><p className="eyebrow">Current analysis</p><h2 id="job-heading">{statusCopy(job?.status || "queued")}</h2><p className="job-id">Job <code>{credential.jobId}</code> · {expiresAt ? `expires ${formatDate(expiresAt)}` : "retention starts when the run finishes"}</p></div>
        <span className={`job-badge ${successful ? "success" : terminal ? "terminal" : "active"}`}><i/>{successful ? "Ready" : terminal ? statusCopy(job?.status) : "In progress"}</span>
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
      {arrays.length > 0 && <div className="table-wrap"><table><thead><tr><th>Record</th><th>Coordinates</th><th>Category</th><th>Strand</th><th>Spacers</th><th>Raw CRISPRidentify Model score</th></tr></thead><tbody>{arrays.map((row, index) => {
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

function DeltaBar({ value, threshold = 5 }) {
  const delta = Number(value);
  if (!Number.isFinite(delta)) return <div className="delta-missing">No finite ΔlnL value reported</div>;
  const cutoff = Number.isFinite(Number(threshold)) && Number(threshold) >= 0 ? Number(threshold) : 5;
  const extent = Math.max(20, cutoff * 4);
  const bounded = Math.max(-extent, Math.min(extent, delta));
  return (
    <div className="delta-chart" role="img" aria-label={`Delta log likelihood ${delta.toFixed(2)}. Values from minus ${cutoff} through plus ${cutoff} are unresolved.`}>
      <div className="delta-labels"><span>Reverse input order</span><span>Unresolved</span><span>Input order</span></div>
      <div className="delta-value"><span>ΔlnL</span><strong>{delta > 0 ? "+" : ""}{delta.toFixed(2)}</strong></div>
      <input className="delta-track" type="range" min={-extent} max={extent} step="0.01" value={bounded} readOnly tabIndex="-1" aria-hidden="true" />
      <div className="delta-ticks"><span>≤ −{formatNumber(extent)}</span><span>−{formatNumber(cutoff)}</span><span>0</span><span>+{formatNumber(cutoff)}</span><span>≥ +{formatNumber(extent)}</span></div>
    </div>
  );
}

function OrientationResults({ summary }) {
  const orientation = summary?.orientation || summary?.orientation_evidence;
  if (!orientation) return null;
  const directDelta = getValue(orientation, "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood");
  const comparisons = asArray(orientation.comparisons).length
    ? asArray(orientation.comparisons)
    : asArray(orientation.groups || summary.orientation_groups).length
      ? asArray(orientation.groups || summary.orientation_groups)
      : directDelta != null || orientation.decision
        ? [{ group: "All eligible arrays", ...orientation }]
        : [];
  const comparisonDecision = (item) => {
    const thresholdValue = Number(getValue(item, "confidence_threshold") ?? getValue(orientation, "confidence_threshold") ?? 5);
    const threshold = Number.isFinite(thresholdValue) && thresholdValue >= 0 ? thresholdValue : 5;
    const delta = Number(getValue(item, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood"));
    const inferred = Number.isFinite(delta) && delta > threshold ? "input" : Number.isFinite(delta) && delta < -threshold ? "reverse" : "unresolved";
    if (item.decisive === false) return { label: "Unresolved", threshold };
    return { label: orientationLabel(item.prediction || item.decision || item.orientation || inferred), threshold };
  };
  const decisiveCount = comparisons.filter((item) => comparisonDecision(item).label !== "Unresolved").length;
  const treePolicy = orientation.tree_policy || "not_reported";
  const treePolicyText = treePolicy === "estimated_separately"
    ? "Input-order and reversed-order trees were estimated separately for each group. Both tree sets and the selected tree are retained in the result bundle."
    : treePolicy === "provided_shared"
      ? "Both order hypotheses were evaluated on the same operator-provided tree."
      : "Consult the provenance manifest for the tree-estimation policy used.";
  return (
    <section className="result-section orientation-section" aria-labelledby="orientation-heading">
      <div className="result-heading"><div><p className="eyebrow">Orientation evidence</p><h3 id="orientation-heading">{comparisons.length} group {comparisons.length === 1 ? "comparison" : "comparisons"}</h3></div><span className="orientation-chip">{decisiveCount} decisive · {comparisons.length - decisiveCount} unresolved</span></div>
      <div className="tree-policy"><span className="tree-glyph" aria-hidden="true">⑂</span><div><strong>Tree policy: {String(treePolicy).replaceAll("_", " ")}</strong><p>{treePolicyText}</p></div></div>
      {comparisons.length ? <div className="orientation-group-list">{comparisons.map((group, index) => {
        const delta = getValue(group, "forward_minus_reverse_ln_likelihood_bdm", "delta_ln_likelihood", "delta_lnL", "delta_log_likelihood");
        const { label: decision, threshold } = comparisonDecision(group);
        return <article className="orientation-group" key={group.group || group.group_id || group.id || index}><div className="orientation-group-head"><div><small>Array group</small><strong>{group.group || group.group_id || group.id || `Group ${index + 1}`}</strong></div><span className={`orientation-chip orientation-${categoryClass(decision)}`}>{decision}</span></div><DeltaBar value={delta} threshold={threshold}/><div className="likelihood-grid"><span>Input-order BDM lnL <b>{formatNumber(getValue(group, "forward_ln_likelihood_bdm"), 3)}</b></span><span>Reverse-order BDM lnL <b>{formatNumber(getValue(group, "reverse_ln_likelihood_bdm"), 3)}</b></span><span>ΔlnL <b>{formatNumber(delta, 3)}</b></span><span>Decision threshold <b>±{formatNumber(threshold, 3)}</b></span></div></article>;
      })}</div> : <div className="empty-result">No finite orientation comparison was produced.</div>}
      <div className="threshold-note"><Icon name="info" size={18}/><p><strong>Decision rule:</strong> ΔlnL = lnL(input order) − lnL(reverse input order). Values beyond the <strong>per-group threshold shown above</strong> support input or reverse input order; values at or within that threshold are unresolved. The threshold is an evidence rule, <strong>not a p-value or probability</strong>.</p></div>
    </section>
  );
}

function ReconstructionResults({ summary }) {
  const reconstruction = summary?.reconstruction || summary?.spacerplacer;
  const orientation = summary?.orientation;
  const rows = asArray(orientation?.selected_reconstructions).length
    ? asArray(orientation.selected_reconstructions)
    : asArray(reconstruction?.results).length
      ? asArray(reconstruction.results)
      : reconstruction?.selected_model
        ? [reconstruction.selected_model]
        : [];
  if (!rows.length) return null;
  const treePolicy = orientation?.tree_policy || reconstruction?.tree_policy || summary?.pipeline?.stages?.spacerplacer?.tree_source || "not_reported";
  const deletionCount = (row) => getValue(row, "nb of reconstructed deletions", "deletions", "losses", "deletion_events");
  const noDeletionGroups = rows.filter((row) => Number(deletionCount(row)) === 0).map((row, index) => row.name || row.group || `Group ${index + 1}`);
  return (
    <section className="result-section" aria-labelledby="reconstruction-heading">
      <div className="result-heading"><div><p className="eyebrow">Selected SpacerPlacer reconstruction</p><h3 id="reconstruction-heading">Ancestral spacer history</h3></div><p>Reported for the selected reconstruction, not every fitted candidate model.</p></div>
      <div className="table-wrap reconstruction-table"><table><thead><tr><th>Group</th><th>Preferred deletion model</th><th>BDM lnL</th><th>Insertions</th><th>Deletions</th><th>BDM deletion rate</th><th>Runtime</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.name || row.group || index}><td><strong>{row.name || row.group || `Group ${index + 1}`}</strong></td><td>{getValue(row, "Deletion model preferred by LRT", "preferred_model", "model_name", "model") || "—"}</td><td>{formatNumber(getValue(row, "ln_lh_bdm", "log_likelihood", "ln_likelihood", "lnL"), 3)}</td><td>{formatNumber(getValue(row, "nb of reconstructed insertions", "gains", "insertions", "gain_events"))}</td><td>{formatNumber(deletionCount(row))}</td><td>{formatNumber(getValue(row, "deletion_rate_bdm", "deletion_rate", "loss_rate"), 4)}</td><td>{formatDuration(getValue(row, "run_time", "runtime_seconds", "duration_seconds"))}</td></tr>)}</tbody></table></div>
      <div className="tree-policy"><span className="tree-glyph" aria-hidden="true">⑂</span><div><strong>Tree policy used: {String(treePolicy).replaceAll("_", " ")}</strong><p>Branch lengths, model choice, and ancestral states are reconstruction-dependent. In orientation mode this table is the reconstruction selected after the input/reverse comparison.</p></div></div>
      {noDeletionGroups.length > 0 && <div className="warning-note"><Icon name="warning"/><p><strong>No deletion events were reconstructed for {noDeletionGroups.join(", ")}.</strong> Deletion-rate estimates, model comparisons, and orientation evidence may not be meaningful for those groups; inspect the array alignment and detailed outputs.</p></div>}
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

export function Results({ job, credential, maxArchiveBytes = 0, exampleSnapshot = null }) {
  if (!["completed", "completed_no_eligible_groups"].includes(job?.status)) return null;
  const summary = job.summary || job.result || {};
  const detection = summary.detection || summary;
  const arrays = asArray(detection.arrays || detection.detected_arrays);
  const noEligible = job.status === "completed_no_eligible_groups";
  return (
    <section className="results" aria-labelledby="results-heading">
      <div className="results-title"><div><p className="eyebrow">Analysis result</p><h2 id="results-heading">{noEligible ? "Detection succeeded; evolution was not applicable." : "Evidence, with its limits visible."}</h2></div><span className="complete-stamp"><Icon name="check"/> Completed</span></div>
      {noEligible && <div className="no-eligible" role="status"><Icon name="info"/><div><strong>No eligible evolutionary groups</strong><p>The workflow completed successfully and the detection results below remain valid. No group passed the selected category, similarity, record-count, and strand preflight rules, so no evolutionary or orientation claim was made.</p></div></div>}
      <CategorySummary summary={detection} arrays={arrays}/>
      <Preflight summary={summary}/>
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
      <div><p className="eyebrow">Interpretation boundary</p><h2 id="scope-heading">What CRISPR-evOr can—and cannot—tell you.</h2></div>
      <div className="scope-grid">
        <article className="scope-can"><span><Icon name="check"/></span><h3>Evolutionary order evidence</h3><p>CRISPR-evOr compares the likelihood of observed spacer-array histories in input and reversed order, conditional on detected arrays, grouping, tree, and model.</p><ul><li>Relative support for array order</li><li>Selected ancestral reconstruction</li><li>Gain/loss model summaries</li></ul></article>
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
      <div className="references-heading"><div><p className="eyebrow">Methods & source</p><h2 id="references-heading">Primary references</h2></div><p>Use the archived bundle for run-specific versions and parameters; cite the corresponding methods when publishing results.</p></div>
      <div className="reference-grid">{citations.map((item) => (
        <article key={item.tool}>
          <span>{item.venue}</span>
          <h3>{item.tool}</h3>
          <p>{item.title}</p>
          <div><a href={item.doi} target="_blank" rel="noopener noreferrer">Publication <span aria-hidden="true">↗</span></a><a href={item.source} target="_blank" rel="noopener noreferrer">Source <span aria-hidden="true">↗</span></a></div>
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
    window.setTimeout(() => document.getElementById("job-status")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }, []);

  const onExampleLoaded = useCallback((snapshot) => {
    setExampleSnapshot(snapshot);
    if (snapshot) window.setTimeout(() => document.getElementById("example-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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
        {!credential && <ResumeJob onResume={(nextCredential) => { setExampleSnapshot(null); setCredential(nextCredential); setJob(null); setPollError(""); }}/>}
        <AnalysisForm service={service} limits={limits} onSubmitted={onSubmitted} onExampleLoaded={onExampleLoaded} hasActiveJob={Boolean(credential)}/>
        {exampleSnapshot && <div id="example-result" className="example-anchor" aria-live="polite"><Results job={exampleSnapshot.job} exampleSnapshot={exampleSnapshot}/></div>}
        {credential && <div id="job-status" className="job-anchor" aria-live="polite" aria-atomic="false"><JobProgress job={job || { status: "queued" }} credential={credential} onCancel={cancel} onForget={forget} cancelling={cancelling}/><Results job={job} credential={credential} maxArchiveBytes={limits.maxArchiveBytes}/></div>}
        {pollError && <p className="poll-error" role="alert">{pollError}</p>}
        <ScopeSection/>
        <References/>
      </main>
      <Footer service={service}/>
    </div>
  );
}
