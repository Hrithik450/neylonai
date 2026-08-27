"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Code2,
  Copy,
  Globe,
  Play,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@neylonai/ui";
import { websiteUrlIssue } from "@/lib/website-url";
import { buildWidgetSnippet } from "@/lib/widget-script";
import { landingFontClassName } from "@/assets/fonts";
import { WidgetLogoControls } from "@/components/dashboard/widget-logo-controls";
import { type StoredWidgetConfig } from "@/lib/widget-config-types";

/** A real explainer clip drops in here later; null keeps a static placeholder. */
const INSTALL_VIDEO_SRC: string | null = null;

const DEVELOPER_HREF = "/dashboard/settings?section=developer";

type PlatformId = "coded" | "wordpress" | "wix" | "framer" | "webflow";

const PLATFORMS: Array<{
  id: PlatformId;
  label: string;
  hint: string;
  coded?: boolean;
}> = [
  {
    id: "coded",
    label: "Custom-coded",
    hint: "React, Next.js, or plain HTML — anywhere you can paste a script tag",
    coded: true,
  },
  { id: "wordpress", label: "WordPress", hint: "Self-hosted or wordpress.com" },
  { id: "wix", label: "Wix", hint: "Wix site builder" },
  { id: "framer", label: "Framer", hint: "Framer-published sites" },
  { id: "webflow", label: "Webflow", hint: "Webflow-published sites" },
];

const PLATFORM_LABEL: Record<string, string> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p.label]),
);

const ACTIVE_CRAWL = new Set([
  "queued",
  "discovering",
  "crawling",
  "cancelling",
]);

type CrawlJob = {
  id: string;
  status: string;
  seedUrl: string;
  found: number;
  eligible: number;
  selected: number;
  scraped: number;
  skipped: number;
  failed: number;
  error: string | null;
};

/**
 * Mirrors the Integrations panel: the page cap is a ceiling, never a
 * denominator, so a total only appears once discovery knows how many pages the
 * run will fetch.
 */
function crawlProgressLabel(job: CrawlJob): string {
  if (job.status === "queued") return "Waiting to start…";
  if (job.status === "discovering") return "Finding useful pages on your site…";
  if (job.status === "cancelling") return "Stopping import…";
  const done = job.scraped + job.skipped + job.failed;
  if (job.selected > 0) {
    return `Importing pages (${done.toLocaleString()} of ${job.selected.toLocaleString()})`;
  }
  return done > 0
    ? `Importing pages (${done.toLocaleString()} so far)`
    : "Importing pages…";
}

const clampStep = (n: number): 1 | 2 | 3 | 4 | 5 | 6 =>
  n <= 1 ? 1 : n >= 6 ? 6 : (n as 2 | 3 | 4 | 5);

export function OnboardingWizard({
  hasBeenOnboarded,
  onboardingStep,
}: {
  hasBeenOnboarded: boolean;
  onboardingStep: number;
}) {
  const [open, setOpen] = useState(!hasBeenOnboarded);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(clampStep(onboardingStep));
  const [error, setError] = useState<string | null>(null);

  // Step 1 — platform
  const [platform, setPlatform] = useState<PlatformId | null>(null);
  const [savingPlatform, setSavingPlatform] = useState(false);

  // Step 2 — connect
  const [url, setUrl] = useState("");
  const [startingCrawl, setStartingCrawl] = useState(false);
  const urlIssue = useMemo(() => websiteUrlIssue(url), [url]);

  // Step 3 — getting ready (wait for the crawl, then AI-seed widget content)
  const [job, setJob] = useState<CrawlJob | null>(null);
  const seedFiredRef = useRef(false);

  
  // Step 4 — chatbot branding
  const [widgetConfig, setWidgetConfig] = useState<StoredWidgetConfig | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftLogoUrl, setDraftLogoUrl] = useState<string | undefined>();
  const [savingBranding, setSavingBranding] = useState(false);

  // Step 5 — finish / install
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isCoded = platform === "coded";
  const crawlActive = job ? ACTIVE_CRAWL.has(job.status) : false;
  const crawlDone = job?.status === "completed";
  const crawlFailed = job?.status === "failed" || job?.status === "cancelled";

  const router = useRouter();

  /** Persist the furthest step reached — best-effort; the row drives resume. */
  const saveStep = useCallback((next: number) => {
    void fetch("/api/v1/onboarding/step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ step: next }),
    }).catch(() => undefined);
  }, []);

  /** Finish: mark onboarding done so the wizard doesn't reopen, then close and refresh. */
  const finish = useCallback(async () => {
    setOpen(false);
    try {
      await fetch("/api/v1/onboarding/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step }),
      });
    } catch {
      // Best-effort
    } finally {
      router.refresh();
    }
  }, [step, router]);

  // Escape / X / overlay click: close WITHOUT dismissing, so the wizard
  // reopens at the saved step next full load. (Radix only calls this on
  // user-driven close, never on our programmatic setOpen.)
  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) setOpen(false);
  }, []);

  const choosePlatform = useCallback(async () => {
    if (!platform || savingPlatform) return;
    setSavingPlatform(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/organization-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ websitePlatform: platform }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) {
        throw new Error(json.error ?? "Could not save your choice.");
      }
      saveStep(2);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your choice.");
    } finally {
      setSavingPlatform(false);
    }
  }, [platform, savingPlatform, saveStep]);

  const startCrawl = useCallback(
    async (seed: string) => {
      const res = await fetch("/api/v1/integrations/website/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url: seed, mode: "initial" }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { job: CrawlJob };
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Could not start the import.");
      }
      return json.data.job;
    },
    [],
  );

  const connectWebsite = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || urlIssue || startingCrawl) {
      if (urlIssue) setError(urlIssue);
      return;
    }
    setStartingCrawl(true);
    setError(null);
    try {
      const started = await startCrawl(trimmed);
      setJob(started);
      saveStep(3);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the import.");
    } finally {
      setStartingCrawl(false);
    }
  }, [url, urlIssue, startingCrawl, startCrawl, saveStep]);

  const retryCrawl = useCallback(async () => {
    const seed = job?.seedUrl ?? url.trim();
    if (!seed) {
      setStep(2);
      return;
    }
    setError(null);
    try {
      const started = await startCrawl(seed);
      setJob(started);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not restart the import.",
      );
    }
  }, [job, url, startCrawl]);

  const loadCrawl = useCallback(async () => {
    const res = await fetch("/api/v1/integrations/website/crawl", {
      credentials: "include",
    });
    const json = (await res.json()) as {
      success: boolean;
      data?: { job: CrawlJob | null };
    };
    if (json.success && json.data && json.data.job) setJob(json.data.job);
  }, []);

  // On reaching step 3, hydrate the latest crawl state (covers resume, where
  // we arrive with no job in local state).
  useEffect(() => {
    if (!open || step !== 3) return;
    void loadCrawl().catch(() => undefined);
  }, [open, step, loadCrawl]);

  // Poll while the crawl is active; stops as soon as it settles.
  useEffect(() => {
    if (!open || step !== 3 || !crawlActive) return;
    const id = window.setInterval(() => {
      void loadCrawl().catch(() => undefined);
    }, 2500);
    return () => window.clearInterval(id);
  }, [open, step, crawlActive, loadCrawl]);

  // Crawl finished on step 3 → load config, then advance to step 4.
  useEffect(() => {
    if (!open || step !== 3 || !crawlDone) return;
    void (async () => {
      try {
        const res = await fetch("/api/v1/widget-config", { credentials: "include" });
        const json = await res.json();
        if (json.success && json.data?.config) {
          setWidgetConfig(json.data.config);
          setDraftName(json.data.config.branding?.name ?? "");
          setDraftLogoUrl(json.data.config.branding?.logoUrl);
        }
      } catch {
      } finally {
        saveStep(4);
        setStep(4);
      }
    })();
  }, [open, step, crawlDone, saveStep]);

  const saveBrandingAndSeed = useCallback(async () => {
    setSavingBranding(true);
    setError(null);
    try {
      if (widgetConfig) {
        const nextConfig = {
          ...widgetConfig,
          branding: {
            ...widgetConfig.branding,
            name: draftName,
            logoUrl: draftLogoUrl,
          },
        };
        await fetch("/api/v1/widget-config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextConfig),
        });
      }

      saveStep(5);
      setStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSavingBranding(false);
    }
  }, [widgetConfig, draftName, draftLogoUrl, saveStep]);

  // Reached step 5 → AI-seed the widget content once, then advance to step 6.
  useEffect(() => {
    if (!open || step !== 5 || seedFiredRef.current) return;
    seedFiredRef.current = true;
    void (async () => {
      try {
        await fetch("/api/v1/widget-content/seed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
      } catch {
        // Best-effort
      } finally {
        saveStep(6);
        setStep(6);
      }
    })();
  }, [open, step, saveStep]);

  // Coded sites: fetch the active key so the snippet shows the real value.
  useEffect(() => {
    if (!open || step !== 6 || !isCoded) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/api-keys", { credentials: "include" });
        const json = (await res.json()) as {
          success: boolean;
          data?: {
            apiKeys: Array<{ revoked: boolean; publicKey?: string | null }>;
          };
        };
        if (cancelled || !json.success || !json.data) return;
        const active = json.data.apiKeys.find((k) => !k.revoked);
        if (active?.publicKey) setPublicKey(active.publicKey);
      } catch {
        // Placeholder key + mint-on-copy still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, isCoded]);

  const snippetKey = publicKey ?? "nk_live_YOUR_API_KEY";

  const copySnippet = useCallback(async () => {
    setError(null);
    const writeClip = async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        setError(
          "Couldn’t reach the clipboard — select the snippet and copy it manually.",
        );
      }
    };
    // Real key already on hand — copy immediately.
    if (publicKey) {
      await writeClip(buildWidgetSnippet(publicKey));
      return;
    }
    // Otherwise mint one (rotating any legacy secret) and copy that.
    setMinting(true);
    try {
      const res = await fetch("/api/v1/api-keys/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ rotateLegacy: true }),
      });
      const json = (await res.json()) as {
        success: boolean;
        data?: { apiKey: string | null };
        error?: string;
      };
      if (!json.success) {
        throw new Error(json.error ?? "Could not create your key.");
      }
      const minted = json.data?.apiKey ?? null;
      if (!minted) throw new Error("Could not create your key.");
      setPublicKey(minted);
      await writeClip(buildWidgetSnippet(minted));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your key.");
    } finally {
      setMinting(false);
    }
  }, [publicKey]);

  const stepTitle =
    step === 1
      ? "Let’s set up your assistant"
      : step === 2
        ? "Connect your website"
        : step === 3
          ? crawlFailed
            ? "Import didn’t finish"
            : "Importing pages"
          : step === 4
            ? "Customize your assistant"
          : step === 5
            ? "Getting your support widget ready"
          : isCoded
            ? "You’re ready to go live"
            : "Almost there";

  const stepDescription =
    step === 1
      ? "Where does your website live? This tailors your install steps."
      : step === 2
        ? "We’ll learn from your public pages so your assistant answers from your real content — and lock your key to this domain."
        : step === 3
          ? crawlFailed
            ? "We couldn’t finish importing your site. You can try again."
            : "We’re reading your pages to learn about your product. Hang tight — this usually takes a minute."
          : step === 4
            ? "Give your assistant a name and upload your logo."
          : step === 5
            ? "We’re writing your widget’s welcome, suggested questions, and FAQs from your imported pages. Hang tight — this usually takes a minute."
          : isCoded
            ? "Your site is imported. Drop this script into your pages and the assistant goes live."
            : `Your site is imported. One-click ${PLATFORM_LABEL[platform ?? ""] ?? "install"} setup is coming soon.`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={`paper max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-3xl ${landingFontClassName}`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <div className="flex flex-col gap-6 sm:gap-8 p-6 sm:p-8">
          <DialogHeader className="gap-2.5">
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <span
                  key={n}
                  aria-hidden
                  className={`h-1.5 rounded-full transition-all ${
                    n === step
                      ? "w-6 bg-[var(--ink)]"
                      : n < step
                        ? "w-4 bg-[var(--ink)]/50"
                        : "w-4 bg-[var(--ink)]/15"
                  }`}
                />
              ))}
              <span className="caption ml-1 text-[0.65rem]">
                Step {step} of 6
              </span>
            </div>
            <DialogTitle className="text-xl">{stepTitle}</DialogTitle>
            <DialogDescription className="text-sm">
              {stepDescription}
            </DialogDescription>
          </DialogHeader>

          {/* ---- Step 1: platform ---- */}
          {step === 1 ? (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PLATFORMS.map((p) => {
                const selected = platform === p.id;
                const Icon = p.coded ? Code2 : Globe;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlatform(p.id);
                      setError(null);
                    }}
                    aria-pressed={selected}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                      p.coded ? "sm:col-span-2" : ""
                    } ${
                      selected
                        ? "border-[var(--ink)] bg-[var(--cream)]"
                        : "border-[var(--ink)]/15 bg-white hover:border-[var(--ink)]/40"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        selected
                          ? "border-[var(--ink)] bg-[var(--ink)] text-white"
                          : "border-[var(--ink)]/15 text-[var(--ink)]/70"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-3">
                        <span className="font-medium">{p.label}</span>
                        {p.coded ? (
                          <span className="rounded-full border border-[var(--ink)]/15 px-2 py-0.5 text-[0.6rem] uppercase tracking-wide text-[var(--ink)]/60">
                            Script install
                          </span>
                        ) : null}
                      </span>
                      <span className="caption mt-0.5 block text-[0.7rem]">
                        {p.hint}
                      </span>
                    </span>
                    {selected ? (
                      <Check
                        className="mt-1 h-4 w-4 shrink-0 text-[var(--ink)]"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* ---- Step 2: connect website ---- */}
          {step === 2 ? (
            <label className="block space-y-1.5 text-sm">
              <span className="font-medium">Website address</span>
              <input
                className="ink-input w-full text-sm"
                placeholder="https://example.com"
                value={url}
                autoFocus
                inputMode="url"
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !urlIssue && url.trim()) {
                    e.preventDefault();
                    void connectWebsite();
                  }
                }}
                disabled={startingCrawl}
              />
              <span className="caption block text-[0.65rem]">
                {urlIssue ??
                  "Only secure (https) websites that resolve can be imported."}
              </span>
            </label>
          ) : null}

          {/* ---- Step 3: getting ready (wait for crawl, then AI-seed) ---- */}
          {step === 3 ? (
            <div className="space-y-4">
              {/* Live progress while the crawl runs */}
              {!crawlDone && !crawlFailed ? (
                <div
                  className="space-y-1 rounded-xl border border-[var(--ink)]/15 bg-[var(--cream)] px-4 py-3"
                  role="status"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--ink)]/25 border-t-[var(--ink)]"
                      aria-hidden
                    />
                    {job ? crawlProgressLabel(job) : "Starting import…"}
                  </div>
                  {job && job.found > 0 ? (
                    <p className="caption text-[0.65rem]">
                      Found {job.found} · useful {job.eligible} · imported{" "}
                      {job.scraped} · skipped {job.skipped} · failed {job.failed}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Crawl finished — advancing to branding... */}
              {crawlDone ? (
                <div
                  className="space-y-1 rounded-xl border border-[var(--ink)]/15 bg-[var(--cream)] px-4 py-3"
                  role="status"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--ink)]/25 border-t-[var(--ink)]"
                      aria-hidden
                    />
                    Preparing the next step…
                  </div>
                </div>
              ) : null}

              {/* Terminal failure */}
              {crawlFailed ? (
                <div className="space-y-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                  <p className="text-sm text-red-900">
                    {job?.error ?? "The import didn’t finish."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void retryCrawl()}
                    className="btn-ink bg-white px-3 py-1.5 text-xs"
                  >
                    Try again
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          
          {/* ---- Step 4: Chatbot Name & Logo ---- */}
          {step === 4 ? (
            <div className="space-y-6">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Chatbot Name (optional)</span>
                <input
                  className="ink-input w-full text-sm"
                  placeholder="Leave empty if your logo already includes the name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  disabled={savingBranding}
                />
              </label>
              <div className="space-y-1.5">
                <span className="font-medium text-sm">Logo</span>
                <WidgetLogoControls
                  logoUrl={draftLogoUrl}
                  onLogoUrlChange={setDraftLogoUrl}
                />
              </div>
            </div>
          ) : null}

          {/* ---- Step 5: Personalization (AI Seed) ---- */}
          {step === 5 ? (
            <div className="space-y-4">
              <div
                className="space-y-1 rounded-xl border border-[var(--ink)]/15 bg-[var(--cream)] px-4 py-3"
                role="status"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[var(--ink)]/25 border-t-[var(--ink)]"
                    aria-hidden
                  />
                  Personalizing your assistant from your site…
                </div>
                <p className="caption text-[0.65rem]">
                  Writing your widget’s welcome, suggested questions, and FAQs
                  from your imported pages.
                </p>
              </div>
            </div>
          ) : null}

          {/* ---- Step 6: finish / install ---- */}
          {step === 6 ? (
            <div className="space-y-4">
              {/* Coded: show the install snippet */}
              {isCoded ? (
                <div className="grid gap-6 sm:grid-cols-2 items-start">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base font-medium">
                        Your install script
                      </span>
                      <button
                        type="button"
                        onClick={() => void copySnippet()}
                        disabled={minting}
                        className="btn-ink inline-flex items-center gap-1.5 bg-[var(--ink)] px-3 py-1.5 text-xs text-white"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden />
                            {minting ? "Preparing…" : "Copy"}
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="mono max-sm:overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-[var(--ink)]/15 bg-[var(--cream)] px-5 py-4 text-xs leading-relaxed">
                      <code>{buildWidgetSnippet(snippetKey)}</code>
                    </pre>
                    <p className="caption text-xs">
                      Paste this in your source code.
                      You can always find it again in{" "}
                      <a className="underline" href={DEVELOPER_HREF}>
                        Settings → Developer
                      </a>
                      .
                    </p>
                  </div>

                  {/* Walkthrough video (placeholder until a clip is set) */}
                  <div className="overflow-hidden rounded-xl border border-[var(--ink)]/15 flex flex-col">
                    {INSTALL_VIDEO_SRC ? (
                      <video
                        className="aspect-video w-full bg-black mt-auto mb-auto"
                        src={INSTALL_VIDEO_SRC}
                        controls
                        playsInline
                      />
                    ) : (
                      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[var(--cream)] text-center h-full">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--ink)]/20 text-[var(--ink)]/60">
                          <Play className="h-5 w-5" aria-hidden />
                        </span>
                        <span className="caption text-xs">
                          Setup walkthrough — coming soon
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2 rounded-xl border border-[var(--ink)]/15 bg-[var(--cream)] px-4 py-3.5">
                  <p className="text-sm font-medium">
                    One-click {PLATFORM_LABEL[platform ?? ""] ?? "install"} setup
                    is coming soon
                  </p>
                  <p className="caption text-[0.7rem]">
                    Your site is already imported and your assistant is learning
                    from it. We’re building a guided installer for{" "}
                    {PLATFORM_LABEL[platform ?? ""] ?? "your platform"} — until
                    then, your install snippet is always available in{" "}
                    <a className="underline" href={DEVELOPER_HREF}>
                      Settings → Developer
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
          ) : null}

          {/* Inline error (steps 1 & 2, and non-terminal step-3 errors) */}
          {error && !(step === 3 && crawlFailed) ? (
            <p
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-900"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {/* ---- Footer ---- */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-[var(--ink)]/60 hover:text-[var(--ink)]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  Back
                </button>
              ) : null}

            </div>

            {step === 1 ? (
              <button
                type="button"
                onClick={() => void choosePlatform()}
                disabled={!platform || savingPlatform}
                className="btn-ink inline-flex items-center gap-1.5 bg-[var(--ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {savingPlatform ? "Saving…" : "Continue"}
                {!savingPlatform ? (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                ) : null}
              </button>
            ) : null}

            {step === 2 ? (
              <button
                type="button"
                onClick={() => void connectWebsite()}
                disabled={!url.trim() || Boolean(urlIssue) || startingCrawl}
                className="btn-ink inline-flex items-center gap-1.5 bg-[var(--ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {startingCrawl ? "Starting…" : "Connect & import"}
                {!startingCrawl ? (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                ) : null}
              </button>
            ) : null}

            {step === 4 ? (
              <button
                type="button"
                onClick={() => void saveBrandingAndSeed()}
                disabled={savingBranding}
                className="btn-ink inline-flex items-center gap-1.5 bg-[var(--ink)] px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                {savingBranding ? "Generating…" : "Continue"}
                {!savingBranding ? (
                  <ArrowRight className="h-4 w-4" aria-hidden />
                ) : null}
              </button>
            ) : null}

            {step === 6 ? (
              <button
                type="button"
                onClick={finish}
                className="btn-ink bg-[var(--ink)] px-3 py-1.5 text-xs text-white"
              >
                Finish
              </button>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
