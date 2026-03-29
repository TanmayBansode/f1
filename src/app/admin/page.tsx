"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = "setup" | "input" | "review" | "confirm";
type ResultType = "race" | "qualifying" | "sprint" | "sprint-qualifying";
type FetchMethod = "auto" | "paste";

interface DriverUpdate {
  driverId: string;
  driverName: string;
  pointsEarned: number;
  newCumulativePoints: number;
  previousCumulativePoints: number;
}

interface ConstructorUpdate {
  teamId: string;
  teamName: string;
  previousPoints: number;
  pointsAdded: number;
  newPoints: number;
}

interface RaceResultRow {
  position: number;
  driverId: string;
  driver: string;
  team: string;
  laps?: number;
  time?: string;
  points?: number;
  status?: string;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  startingGrid?: number | null;
}

interface RaceDetailUpdate {
  round: number;
  type: string;
  raceResults?: RaceResultRow[];
  qualifyingResults?: RaceResultRow[];
  sprintResults?: RaceResultRow[];
  sprintQualifyingResults?: RaceResultRow[];
}

interface PreviewData {
  raceEntry: Record<string, unknown>;
  raceDetailUpdate: RaceDetailUpdate;
  driverUpdates: DriverUpdate[];
  constructorUpdates: ConstructorUpdate[];
  validationErrors: string[];
  warnings: string[];
  newRoundNumber: number;
  updatedJson: object | null;
  computedPoints: Record<string, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small UI components
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: Step; steps: { key: Step; label: string }[] }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-between px-1 mb-6">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          <div className="flex flex-col items-center flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < idx
                  ? "bg-red-600 border-red-600 text-white"
                  : i === idx
                  ? "bg-transparent border-red-500 text-red-400"
                  : "bg-transparent border-neutral-700 text-neutral-600"
              }`}
            >
              {i < idx ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs mt-1 text-center leading-tight ${
                i === idx ? "text-red-400" : i < idx ? "text-neutral-400" : "text-neutral-700"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`flex-1 h-0.5 mx-1 mb-4 transition-all ${
                i < idx ? "bg-red-600" : "bg-neutral-800"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">{children}</h2>;
}

function Btn({
  children,
  onClick,
  loading,
  disabled,
  variant = "primary",
  fullWidth = true,
  size = "lg",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const base = `${fullWidth ? "w-full" : ""} rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
    size === "lg" ? "py-4 text-base" : size === "md" ? "py-3 text-sm" : "py-2 px-3 text-xs"
  }`;
  const variants = {
    primary: "bg-red-600 text-white hover:bg-red-500 active:scale-95 disabled:bg-neutral-800 disabled:text-neutral-600",
    secondary: "bg-neutral-800 text-white hover:bg-neutral-700 active:scale-95",
    ghost: "bg-transparent border border-neutral-700 text-neutral-300 hover:border-neutral-500",
    danger: "bg-red-900/30 border border-red-800 text-red-400 hover:bg-red-900/60",
  };
  return (
    <button
      className={`${base} ${variants[variant]} ${disabled || loading ? "pointer-events-none opacity-60" : ""}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Alert({ type, children }: { type: "error" | "warning" | "success" | "info"; children: React.ReactNode }) {
  const colors = {
    error: "bg-red-900/30 border-red-800 text-red-300",
    warning: "bg-yellow-900/20 border-yellow-800 text-yellow-300",
    success: "bg-green-900/20 border-green-700 text-green-300",
    info: "bg-blue-900/20 border-blue-800 text-blue-300",
  };
  const icons = { error: "✕", warning: "⚠", success: "✓", info: "ℹ" };
  return (
    <div className={`border rounded-xl p-3 flex gap-2 text-sm ${colors[type]}`}>
      <span className="shrink-0 font-bold">{icons[type]}</span>
      <span>{children}</span>
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = "text", helperText,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  helperText?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-400 font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-red-600 transition-colors"
      />
      {helperText && <p className="text-xs text-neutral-600">{helperText}</p>}
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-neutral-400 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-600 transition-colors appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { key: "setup" as Step, label: "Setup" },
  { key: "input" as Step, label: "URL" },
  { key: "review" as Step, label: "Review" },
  { key: "confirm" as Step, label: "Push" },
];

export default function AdminPage() {
  const [step, setStep] = useState<Step>("setup");

  // Setup
  const [githubToken, setGithubToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [tokenUser, setTokenUser] = useState("");

  // Input
  const [f1Url, setF1Url] = useState("");
  const [resultType, setResultType] = useState<ResultType>("race");
  const [fetchMethod, setFetchMethod] = useState<FetchMethod>("auto");
  const [pastedHtml, setPastedHtml] = useState("");
  const [gpDate, setGpDate] = useState("");
  const [roundOverride, setRoundOverride] = useState("");

  // Scrape & Preview state
  const [scraping, setScraping] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [scrapeError, setScrapeError] = useState("");
  const [needsPaste, setNeedsPaste] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<unknown>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [commitMessage, setCommitMessage] = useState("");

  // Push
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ commitUrl?: string; error?: string } | null>(null);

  const tokenInputRef = useRef<HTMLInputElement>(null);

  // Load saved token
  useEffect(() => {
    const saved = localStorage.getItem("f1_admin_gh_token");
    if (saved) {
      setGithubToken(saved);
      validateTokenSilently(saved);
    }
  }, []);

  // Auto-detect type from URL
  useEffect(() => {
    if (!f1Url) return;
    if (f1Url.includes("sprint-qualifying")) setResultType("sprint-qualifying");
    else if (f1Url.includes("sprint-result")) setResultType("sprint");
    else if (f1Url.includes("qualifying")) setResultType("qualifying");
    else if (f1Url.includes("race-result")) setResultType("race");
  }, [f1Url]);

  async function validateTokenSilently(token: string) {
    if (!token) return;
    setTokenStatus("checking");
    try {
      const res = await fetch("/api/admin/push", {
        headers: { "x-github-token": token },
      });
      const data = await res.json();
      if (data.valid) {
        setTokenStatus("valid");
        setTokenUser(data.user);
        localStorage.setItem("f1_admin_gh_token", token);
      } else {
        setTokenStatus("invalid");
      }
    } catch {
      setTokenStatus("invalid");
    }
  }

  const handleScrape = useCallback(async () => {
    setScraping(true);
    setScrapeError("");
    setNeedsPaste(false);
    setScrapeResult(null);

    try {
      const body: Record<string, string> = { typeOverride: resultType };
      if (f1Url) body.url = f1Url;
      if (fetchMethod === "paste" && pastedHtml) body.pastedHtml = pastedHtml;

      const res = await fetch("/api/admin/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.needsPaste) {
          setNeedsPaste(true);
          setFetchMethod("paste");
          setScrapeError("Auto-fetch failed — please paste the page HTML below.");
        } else {
          setScrapeError(data.error || "Scrape failed");
        }
        return;
      }

      if (data.rowCount === 0) {
        setScrapeError("No data rows found. Try the paste method.");
        return;
      }

      setScrapeResult(data);

      // Auto-generate commit message
      const gp = data.gpName || "Unknown GP";
      const typeLabel = resultType === "race" ? "Race" : resultType === "qualifying" ? "Qualifying" : resultType === "sprint" ? "Sprint" : "Sprint Qualifying";
      setCommitMessage(`Add ${gp} Grand Prix ${typeLabel} results`);

      // Auto-run preview
      await runPreview(data);
    } finally {
      setScraping(false);
    }
  }, [f1Url, resultType, fetchMethod, pastedHtml]);

  const runPreview = useCallback(async (rawScrape?: unknown) => {
    const src = rawScrape || scrapeResult;
    if (!src) return;
    setPreviewing(true);

    try {
      const overrides: Record<string, unknown> = {};
      if (gpDate) overrides.date = gpDate;
      if (roundOverride) overrides.roundNumber = parseInt(roundOverride);

      const res = await fetch("/api/admin/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scrapeResult: src, overrides }),
      });
      const data = await res.json();

      if (!res.ok) {
        setScrapeError(data.error || "Preview failed");
        return;
      }

      setPreview(data);
      setStep("review");
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }, [scrapeResult, gpDate, roundOverride]);

  const handlePush = useCallback(async () => {
    if (!preview?.updatedJson || !githubToken) return;
    setPushing(true);
    setPushResult(null);

    try {
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updatedJson: preview.updatedJson,
          githubToken,
          commitMessage,
        }),
      });
      const data = await res.json();
      setPushResult(data.success ? { commitUrl: data.commitUrl } : { error: data.error });
      if (data.success) setStep("confirm");
    } finally {
      setPushing(false);
    }
  }, [preview, githubToken, commitMessage]);

  function reset() {
    setStep("input");
    setScrapeResult(null);
    setPreview(null);
    setScrapeError("");
    setNeedsPaste(false);
    setF1Url("");
    setPastedHtml("");
    setCommitMessage("");
    setPushResult(null);
  }

  // ─── Render ───

  return (
    <div className="admin-page min-h-screen bg-neutral-950 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-900 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-none">F1 Admin</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Race Data Pipeline</p>
        </div>
        {tokenStatus === "valid" && (
          <div className="ml-auto flex items-center gap-1.5 bg-green-900/20 border border-green-800 rounded-full px-2.5 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-xs text-green-400 font-medium">{tokenUser}</span>
          </div>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        <StepIndicator current={step} steps={STEPS} />

        {/* ─── STEP: SETUP ─── */}
        {step === "setup" && (
          <SetupStep
            githubToken={githubToken}
            setGithubToken={setGithubToken}
            tokenStatus={tokenStatus}
            tokenUser={tokenUser}
            onValidate={() => validateTokenSilently(githubToken)}
            onContinue={() => setStep("input")}
            inputRef={tokenInputRef}
          />
        )}

        {/* ─── STEP: INPUT ─── */}
        {step === "input" && (
          <InputStep
            f1Url={f1Url}
            setF1Url={setF1Url}
            resultType={resultType}
            setResultType={setResultType}
            fetchMethod={fetchMethod}
            setFetchMethod={setFetchMethod}
            pastedHtml={pastedHtml}
            setPastedHtml={setPastedHtml}
            gpDate={gpDate}
            setGpDate={setGpDate}
            roundOverride={roundOverride}
            setRoundOverride={setRoundOverride}
            needsPaste={needsPaste}
            scrapeError={scrapeError}
            scraping={scraping}
            previewing={previewing}
            onScrape={handleScrape}
            onBack={() => setStep("setup")}
          />
        )}

        {/* ─── STEP: REVIEW ─── */}
        {step === "review" && preview && (
          <ReviewStep
            preview={preview}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            onBack={() => setStep("input")}
            onConfirm={() => {
              if (preview.validationErrors.length === 0) {
                setStep("confirm");
              }
            }}
          />
        )}

        {/* ─── STEP: CONFIRM (pre-push) ─── */}
        {step === "confirm" && preview && !pushResult && (
          <ConfirmStep
            preview={preview}
            commitMessage={commitMessage}
            setCommitMessage={setCommitMessage}
            pushing={pushing}
            onPush={handlePush}
            onBack={() => setStep("review")}
          />
        )}

        {/* ─── PUSH SUCCESS ─── */}
        {step === "confirm" && pushResult?.commitUrl && (
          <SuccessStep commitUrl={pushResult.commitUrl} onReset={reset} />
        )}

        {/* ─── PUSH ERROR ─── */}
        {pushResult?.error && (
          <Alert type="error">{pushResult.error}</Alert>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step components
// ─────────────────────────────────────────────────────────────────────────────

function SetupStep({
  githubToken, setGithubToken, tokenStatus, tokenUser, onValidate, onContinue, inputRef,
}: {
  githubToken: string;
  setGithubToken: (v: string) => void;
  tokenStatus: string;
  tokenUser: string;
  onValidate: () => void;
  onContinue: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>GitHub Authentication</SectionTitle>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs text-neutral-400 font-medium">Personal Access Token</label>
            <input
              ref={inputRef}
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-red-600 transition-colors font-mono"
            />
            <p className="text-xs text-neutral-600">Needs repo scope. Stored locally, never committed.</p>
          </div>

          {tokenStatus === "valid" && (
            <Alert type="success">Authenticated as <strong>{tokenUser}</strong></Alert>
          )}
          {tokenStatus === "invalid" && (
            <Alert type="error">Invalid token. Check it has repo scope.</Alert>
          )}
          {tokenStatus === "checking" && (
            <div className="flex items-center gap-2 text-sm text-neutral-400">
              <Spinner /> Validating…
            </div>
          )}

          <Btn onClick={onValidate} disabled={!githubToken} variant="secondary">
            Validate Token
          </Btn>
        </div>
      </Card>

      <Card className="bg-neutral-900/50 border-dashed">
        <p className="text-xs text-neutral-500 leading-relaxed">
          Create a token at{" "}
          <a
            href="https://github.com/settings/tokens/new"
            target="_blank"
            rel="noopener"
            className="text-red-400 underline"
          >
            github.com/settings/tokens
          </a>
          . Select <code className="bg-neutral-800 px-1 rounded text-xs">repo</code> scope.
          Token is saved in browser localStorage only.
        </p>
      </Card>

      <Btn onClick={onContinue} disabled={tokenStatus !== "valid"}>
        Continue →
      </Btn>
    </div>
  );
}

const TYPE_OPTIONS = [
  { value: "race", label: "🏁 Race Result" },
  { value: "qualifying", label: "🕐 Qualifying" },
  { value: "sprint", label: "⚡ Sprint Race" },
  { value: "sprint-qualifying", label: "⏱ Sprint Qualifying" },
];

function InputStep({
  f1Url, setF1Url, resultType, setResultType, fetchMethod, setFetchMethod,
  pastedHtml, setPastedHtml, gpDate, setGpDate, roundOverride, setRoundOverride,
  needsPaste, scrapeError, scraping, previewing, onScrape, onBack,
}: {
  f1Url: string; setF1Url: (v: string) => void;
  resultType: ResultType; setResultType: (v: ResultType) => void;
  fetchMethod: FetchMethod; setFetchMethod: (v: FetchMethod) => void;
  pastedHtml: string; setPastedHtml: (v: string) => void;
  gpDate: string; setGpDate: (v: string) => void;
  roundOverride: string; setRoundOverride: (v: string) => void;
  needsPaste: boolean; scrapeError: string;
  scraping: boolean; previewing: boolean;
  onScrape: () => void; onBack: () => void;
}) {
  const canFetch = f1Url.trim().length > 10 && (fetchMethod === "auto" || pastedHtml.length > 100);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Result Type</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setResultType(opt.value as ResultType)}
              className={`py-3 px-3 rounded-xl text-sm font-medium transition-all text-left ${
                resultType === opt.value
                  ? "bg-red-600 text-white"
                  : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>F1 Website URL</SectionTitle>
        <div className="space-y-3">
          <input
            type="url"
            value={f1Url}
            onChange={(e) => setF1Url(e.target.value)}
            placeholder="https://www.formula1.com/en/results/2026/races/…"
            className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-600 focus:outline-none focus:border-red-600 transition-colors"
          />
          <p className="text-xs text-neutral-600">
            e.g. .../results/2026/races/1280/china/race-result
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Fetch Method</SectionTitle>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { key: "auto", label: "🤖 Auto-fetch", desc: "Browser + Puppeteer" },
            { key: "paste", label: "📋 Paste HTML", desc: "Copy page source" },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setFetchMethod(m.key as FetchMethod)}
              className={`p-3 rounded-xl text-left transition-all ${
                fetchMethod === m.key
                  ? "bg-red-600/20 border border-red-600 text-white"
                  : "bg-neutral-800 border border-transparent text-neutral-400 hover:bg-neutral-700"
              }`}
            >
              <div className="text-sm font-medium mb-0.5">{m.label}</div>
              <div className="text-xs opacity-60">{m.desc}</div>
            </button>
          ))}
        </div>

        {(fetchMethod === "paste" || needsPaste) && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-400">
              On the F1 page, right-click → View Page Source (or Ctrl+U), then select all and paste here:
            </p>
            <textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              placeholder="Paste the full HTML source here…"
              rows={5}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white text-xs font-mono placeholder-neutral-600 focus:outline-none focus:border-red-600 resize-none"
            />
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Optional Overrides</SectionTitle>
        <div className="space-y-3">
          <Input
            label="Race Date (YYYY-MM-DD)"
            value={gpDate}
            onChange={setGpDate}
            placeholder="2026-03-15"
            type="date"
          />
          <Input
            label="Round Number Override"
            value={roundOverride}
            onChange={setRoundOverride}
            placeholder="Auto-detected (leave blank)"
            helperText="Leave blank to auto-assign the next round number"
          />
        </div>
      </Card>

      {scrapeError && <Alert type="error">{scrapeError}</Alert>}

      <div className="flex gap-2">
        <Btn variant="ghost" onClick={onBack} fullWidth={false} size="md">
          ← Back
        </Btn>
        <Btn onClick={onScrape} loading={scraping || previewing} disabled={!canFetch}>
          {scraping ? "Fetching…" : previewing ? "Processing…" : "Fetch & Parse →"}
        </Btn>
      </div>
    </div>
  );
}

function ReviewStep({
  preview, commitMessage, setCommitMessage, onBack, onConfirm,
}: {
  preview: PreviewData;
  commitMessage: string;
  setCommitMessage: (v: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const hasErrors = preview.validationErrors.length > 0;
  const raceEntry = preview.raceEntry as Record<string, string | number>;

  return (
    <div className="space-y-4">
      {/* Race summary */}
      <Card className="border-red-900/50 bg-red-950/10">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center shrink-0">
            <span className="text-red-400 font-bold text-sm">R{raceEntry.round}</span>
          </div>
          <div>
            <div className="font-semibold text-white text-sm">{String(raceEntry.name)}</div>
            <div className="text-xs text-neutral-400 mt-0.5">
              {String(raceEntry.circuit)} • {String(raceEntry.date)}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">{String(raceEntry.location)}</div>
          </div>
        </div>
      </Card>

      {/* Validation errors */}
      {hasErrors && (
        <div className="space-y-2">
          {preview.validationErrors.map((e, i) => (
            <Alert key={i} type="error">{e}</Alert>
          ))}
        </div>
      )}

      {/* Warnings */}
      {preview.warnings.length > 0 && (
        <div className="space-y-1">
          {preview.warnings.map((w, i) => (
            <Alert key={i} type="warning">{w}</Alert>
          ))}
        </div>
      )}

      {/* Driver standings changes */}
      {preview.driverUpdates.some((d) => d.pointsEarned > 0) && (
        <Card>
          <SectionTitle>Points Earned</SectionTitle>
          <div className="space-y-1.5">
            {preview.driverUpdates
              .filter((d) => d.pointsEarned > 0)
              .sort((a, b) => b.pointsEarned - a.pointsEarned)
              .map((d) => (
                <div key={d.driverId} className="flex items-center justify-between py-1.5 border-b border-neutral-800 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-white">{d.driverName}</span>
                    <span className="text-xs text-neutral-500 ml-2">{d.driverId}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-xs text-neutral-500">{d.previousCumulativePoints} pts</span>
                    <span className="text-xs text-neutral-600">→</span>
                    <span className="text-sm font-bold text-green-400">{d.newCumulativePoints} pts</span>
                    <span className="text-xs bg-green-900/30 text-green-400 border border-green-800 rounded-full px-2 py-0.5">+{d.pointsEarned}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Constructor changes */}
      {preview.constructorUpdates.some((c) => c.pointsAdded > 0) && (
        <Card>
          <SectionTitle>Constructor Points</SectionTitle>
          <div className="space-y-1.5">
            {preview.constructorUpdates
              .filter((c) => c.pointsAdded > 0)
              .sort((a, b) => b.pointsAdded - a.pointsAdded)
              .map((c) => (
                <div key={c.teamId} className="flex items-center justify-between py-1.5 border-b border-neutral-800 last:border-0">
                  <span className="text-sm font-medium text-white">{c.teamName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">{c.previousPoints}</span>
                    <span className="text-xs text-neutral-600">→</span>
                    <span className="text-sm font-bold text-green-400">{c.newPoints}</span>
                    <span className="text-xs bg-green-900/30 text-green-400 border border-green-800 rounded-full px-2 py-0.5">+{c.pointsAdded}</span>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Commit message */}
      <Input
        label="Commit Message"
        value={commitMessage}
        onChange={setCommitMessage}
        placeholder="Add race results…"
      />

      <div className="flex gap-2">
        <Btn variant="ghost" onClick={onBack} fullWidth={false} size="md">
          ← Back
        </Btn>
        <Btn onClick={onConfirm} disabled={hasErrors || !preview.updatedJson}>
          Continue to Push →
        </Btn>
      </div>
    </div>
  );
}

function ConfirmStep({
  preview, commitMessage, setCommitMessage, pushing, onPush, onBack,
}: {
  preview: PreviewData;
  commitMessage: string;
  setCommitMessage: (v: string) => void;
  pushing: boolean;
  onPush: () => void;
  onBack: () => void;
}) {
  const [showResults, setShowResults] = useState(true);
  const raceEntry = preview.raceEntry as Record<string, string | number>;
  const detail = preview.raceDetailUpdate;

  // Pick whichever result array is populated
  const rows: RaceResultRow[] =
    detail?.raceResults ??
    detail?.sprintResults ??
    detail?.qualifyingResults ??
    detail?.sprintQualifyingResults ??
    [];

  const isRaceType = !!(detail?.raceResults || detail?.sprintResults);
  const isQualType = !!(detail?.qualifyingResults || detail?.sprintQualifyingResults);
  const isSprint = !!detail?.sprintResults || !!detail?.sprintQualifyingResults;

  // Team color lookup from constructor updates
  const teamColorMap: Record<string, string> = {
    Mercedes: "#27F4D2", Ferrari: "#E8002D", McLaren: "#FF8000",
    "Red Bull Racing": "#3671C6", Haas: "#B6BABD", "Racing Bulls": "#6692FF",
    Sauber: "#52E252", Audi: "#52E252", Alpine: "#FF87BC",
    Williams: "#1868DB", Cadillac: "#1D1D1B", "Aston Martin": "#229971",
  };

  const positionBadge = (pos: number) => {
    if (pos === 1) return "bg-yellow-500 text-black";
    if (pos === 2) return "bg-neutral-400 text-black";
    if (pos === 3) return "bg-amber-700 text-white";
    return "bg-neutral-800 text-neutral-400";
  };

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <Card className="border-yellow-900/50 bg-yellow-950/10">
        <div className="flex gap-3">
          <span className="text-yellow-400 text-xl">⚠</span>
          <div>
            <div className="text-sm font-semibold text-yellow-200 mb-1">Ready to Push</div>
            <p className="text-xs text-yellow-300/70 leading-relaxed">
              This will commit to{" "}
              <code className="bg-yellow-900/30 px-1 rounded">TanmayBansode/f1 → data/2026.json</code>.
              Review the results below before confirming.
            </p>
          </div>
        </div>
      </Card>

      {/* Race identity */}
      <Card className="border-red-900/40 bg-red-950/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center shrink-0 text-red-400 font-bold text-sm">
            R{raceEntry.round}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-white text-sm truncate">{String(raceEntry.name)}</div>
            <div className="text-xs text-neutral-400 mt-0.5 truncate">
              {String(raceEntry.circuit)} • {String(raceEntry.date)}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <span className="text-xs bg-neutral-800 text-neutral-400 rounded-full px-2 py-1">
              {isSprint ? "Sprint" : isQualType ? "Quali" : "Race"}
            </span>
          </div>
        </div>
      </Card>

      {/* Results table — collapsible */}
      {rows.length > 0 && (
        <Card className="p-0 overflow-hidden">
          <button
            onClick={() => setShowResults((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
              Results ({rows.length} drivers)
            </span>
            <span className="text-neutral-500 text-xs">
              {showResults ? "▲ Hide" : "▼ Show"}
            </span>
          </button>

          {showResults && (
            <div className="border-t border-neutral-800">
              {/* Column headers */}
              <div className="grid px-3 py-2 bg-neutral-900/60"
                style={{ gridTemplateColumns: isQualType ? "2.5rem 1fr 1fr" : "2.5rem 1fr auto auto" }}>
                <span className="text-xs font-semibold text-neutral-600">Pos</span>
                <span className="text-xs font-semibold text-neutral-600">Driver</span>
                {isQualType ? (
                  <span className="text-xs font-semibold text-neutral-600 text-right">Best Time</span>
                ) : (
                  <>
                    <span className="text-xs font-semibold text-neutral-600 text-right">Time</span>
                    <span className="text-xs font-semibold text-neutral-600 text-right pl-2">Pts</span>
                  </>
                )}
              </div>

              {/* Rows */}
              <div className="divide-y divide-neutral-900">
                {rows.map((row, i) => {
                  const teamColor = teamColorMap[row.team] || "#888";
                  const pts = preview.computedPoints?.[row.driverId] ?? row.points ?? 0;
                  const timeDisplay = row.status || row.time || "";
                  const isDnf = timeDisplay === "DNF" || timeDisplay === "DNS";
                  const bestQTime = row.q3 || row.q2 || row.q1 || "—";

                  return (
                    <div
                      key={i}
                      className="grid items-center px-3 py-2.5 hover:bg-white/[0.03] transition-colors"
                      style={{ gridTemplateColumns: isQualType ? "2.5rem 1fr 1fr" : "2.5rem 1fr auto auto" }}
                    >
                      {/* Position */}
                      <div>
                        <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center text-xs font-bold ${
                          positionBadge(row.position)
                        }`}>
                          {row.position}
                        </span>
                      </div>

                      {/* Driver + team */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {/* Team color dot */}
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: teamColor }}
                          />
                          <span className="text-sm font-medium text-white truncate leading-tight">
                            {row.driver}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-500 mt-0.5 pl-3.5 truncate">
                          {row.team}
                          {isRaceType && row.startingGrid != null && (
                            <span className="ml-2 text-neutral-600">Grid {row.startingGrid}</span>
                          )}
                        </div>
                      </div>

                      {/* Time / Qual time */}
                      {isQualType ? (
                        <span className={`text-xs text-right font-mono ${
                          bestQTime === "—" ? "text-neutral-700" : "text-neutral-300"
                        }`}>
                          {bestQTime}
                        </span>
                      ) : (
                        <>
                          <span className={`text-xs text-right font-mono ${
                            isDnf ? "text-red-400" : i === 0 ? "text-white" : "text-neutral-400"
                          }`}>
                            {timeDisplay || (row.laps ? `${row.laps}L` : "—")}
                          </span>
                          <span className={`text-sm font-bold text-right pl-2 ${
                            pts > 0 ? "text-green-400" : "text-neutral-700"
                          }`}>
                            {pts > 0 ? pts : "—"}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="text-center py-3 px-2">
          <div className="text-lg font-bold text-white">{rows.length}</div>
          <div className="text-xs text-neutral-500 mt-0.5">Drivers</div>
        </Card>
        <Card className="text-center py-3 px-2">
          <div className="text-lg font-bold text-white">
            {preview.constructorUpdates.filter((c) => c.pointsAdded > 0).length}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">Teams</div>
        </Card>
        <Card className="text-center py-3 px-2">
          <div className="text-lg font-bold text-green-400">
            {Object.values(preview.computedPoints || {}).reduce((a, b) => a + b, 0)}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">Total Pts</div>
        </Card>
      </div>

      <Input
        label="Commit Message"
        value={commitMessage}
        onChange={setCommitMessage}
        placeholder="Add race results…"
      />

      <div className="flex gap-2">
        <Btn variant="ghost" onClick={onBack} fullWidth={false} size="md">
          ← Back
        </Btn>
        <Btn onClick={onPush} loading={pushing} variant="primary">
          🚀 Push to GitHub
        </Btn>
      </div>
    </div>
  );
}

function SuccessStep({ commitUrl, onReset }: { commitUrl: string; onReset: () => void }) {
  return (
    <div className="space-y-4">
      <Card className="border-green-800 bg-green-950/20 text-center py-8">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-green-300 mb-2">Pushed Successfully!</h2>
        <p className="text-sm text-neutral-400 mb-4">
          The race data has been committed to GitHub.
        </p>
        <a
          href={commitUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 bg-green-900/30 border border-green-700 rounded-xl px-4 py-3 text-green-300 text-sm font-medium hover:bg-green-900/50 transition-colors"
        >
          View Commit on GitHub →
        </a>
      </Card>

      <Btn onClick={onReset} variant="secondary">
        + Add Another Result
      </Btn>
    </div>
  );
}
