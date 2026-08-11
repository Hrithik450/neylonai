/**
 * Unit Economics — admin reference / capacity-planning catalog.
 *
 * Not a live usage tracker. Rates from official provider docs only
 * (see each row’s `source` + `asOf`). Refresh by re-checking those URLs.
 *
 * Stack mirrors .env.example / docker-compose / ARCHITECTURE.md.
 */

import { PLAN_CATALOG } from "./plans";

const AS_OF = "2026-08-11";

const SRC = {
  gemini: "https://ai.google.dev/gemini-api/docs/pricing",
  geminiLimits: "https://ai.google.dev/gemini-api/docs/rate-limits",
  geminiAudio: "https://ai.google.dev/gemini-api/docs/generate-content/audio",
  tavily: "https://docs.tavily.com/documentation/api-credits",
  firecrawl: "https://www.firecrawl.dev/pricing",
  jina: "https://jina.ai/reader",
  supabase: "https://supabase.com/pricing",
  upstash: "https://upstash.com/pricing/redis",
  lightsail: "https://aws.amazon.com/lightsail/pricing/",
  vercel: "https://vercel.com/pricing",
  vercelBlob: "https://vercel.com/docs/vercel-blob/usage-and-pricing",
  stripe: "https://stripe.com/pricing",
  razorpay: "https://razorpay.com/pricing/",
} as const;

export type StackCatalogRow = {
  category: string;
  provider: string;
  service: string;
  usedFor: string;
  pricing: string;
  unit: string;
  freeTierOrQuotas: string;
  source: string;
  asOf: string;
};

/** Every provider/model currently used in this repo — planning reference only. */
export const STACK_CATALOG: StackCatalogRow[] = [
  {
    category: "LLM (text)",
    provider: "Google Gemini",
    service: "gemini-3.1-flash-lite",
    usedFor: "Router low tier, classifier, thinking tips, STT default",
    pricing:
      "Paid Standard: $0.25 / 1M input (text·image·video); $0.50 / 1M input (audio); $1.50 / 1M output (incl. thinking)",
    unit: "Tokens (per 1M)",
    freeTierOrQuotas:
      "Free tier: free of charge with project/model RPM·TPM·RPD in AI Studio (not a single fixed public number)",
    source: SRC.gemini,
    asOf: AS_OF,
  },
  {
    category: "LLM (text)",
    provider: "Google Gemini",
    service: "gemini-3.5-flash",
    usedFor: "Router medium tier (main chat)",
    pricing:
      "Paid Standard: $1.50 / 1M input; $9.00 / 1M output (incl. thinking)",
    unit: "Tokens (per 1M)",
    freeTierOrQuotas:
      "Free tier: free of charge; limits via AI Studio (see rate-limits docs)",
    source: SRC.gemini,
    asOf: AS_OF,
  },
  {
    category: "LLM (text)",
    provider: "Google Gemini",
    service: "gemini-3.6-flash",
    usedFor: "Router high / max complexity tier",
    pricing:
      "Paid Standard: $1.50 / 1M input; $7.50 / 1M output (incl. thinking)",
    unit: "Tokens (per 1M)",
    freeTierOrQuotas:
      "Free tier: free of charge; limits via AI Studio (see rate-limits docs)",
    source: SRC.gemini,
    asOf: AS_OF,
  },
  {
    category: "LLM (text)",
    provider: "Google Gemini",
    service: "gemini-3.5-flash-lite",
    usedFor: "Utility (reframe, titles, expansion)",
    pricing:
      "Paid Standard: $0.30 / 1M input (text·image·video·audio); $2.50 / 1M output (incl. thinking)",
    unit: "Tokens (per 1M)",
    freeTierOrQuotas:
      "Free tier: free of charge; limits via AI Studio (see rate-limits docs)",
    source: SRC.gemini,
    asOf: AS_OF,
  },
  {
    category: "Speech-to-text",
    provider: "Google Gemini",
    service: "gemini-3.1-flash-lite (STT_MODEL)",
    usedFor: "Widget mic → transcript (multimodal audio understanding)",
    pricing:
      "Same model Standard rates; audio input billed at $0.50 / 1M tokens (not the text $0.25 rate). Audio ≈ 32 tokens/sec (Gemini audio docs)",
    unit: "Tokens (per 1M); audio tokens from duration",
    freeTierOrQuotas:
      "Shares Gemini free/paid project quotas with other generateContent calls",
    source: `${SRC.gemini} · ${SRC.geminiAudio}`,
    asOf: AS_OF,
  },
  {
    category: "Embeddings",
    provider: "Google Gemini",
    service: "gemini-embedding-001",
    usedFor: "Knowledge base vectors (halfvec 3072)",
    pricing: "Paid Standard: $0.15 / 1M input tokens (no output tokens)",
    unit: "Input tokens (per 1M)",
    freeTierOrQuotas: "Free tier: free of charge on free + paid Gemini API tiers",
    source: SRC.gemini,
    asOf: AS_OF,
  },
  {
    category: "Web search",
    provider: "Tavily",
    service: "tavily.search (basic / advanced)",
    usedFor: "Agent web_search tool",
    pricing:
      "PAYG $0.008 / credit · Project $30 / 4k ($0.0075) · Bootstrap $100 / 15k ($0.0067) · Startup $220 / 38k · Growth $500 / 100k ($0.005). Basic search = 1 credit; advanced = 2 credits",
    unit: "API credits",
    freeTierOrQuotas: "1,000 free credits / month (Researcher; no card)",
    source: SRC.tavily,
    asOf: AS_OF,
  },
  {
    category: "Web scrape",
    provider: "Firecrawl",
    service: "firecrawl.scrape (website import + scrape_url)",
    usedFor:
      "Primary JS-aware website import when FIRECRAWL_API_KEY is set (CSR / Next.js sites)",
    pricing:
      "1 credit / page scrape · Hobby $16 / 5,000 credits (~$0.0032/credit) · Standard $83 / 100k · Growth $333 / 500k. JSON/Enhanced modes add credits",
    unit: "API credits (1 / page)",
    freeTierOrQuotas:
      "Free: 1,000 credits / month · 2 concurrent · no card. Override COGS with FIRECRAWL_USD_PER_CREDIT",
    source: SRC.firecrawl,
    asOf: AS_OF,
  },
  {
    category: "Web scrape",
    provider: "Jina",
    service: "jina.reader (r.jina.ai)",
    usedFor:
      "Default free fallback for website import + scrape_url when Firecrawl key unset / fails (URL → markdown, JS render)",
    pricing:
      "Free tier $0 (rate-limited). Optional JINA_API_KEY for higher RPM; paid is token-based (~$0.005/page class rates on standard — verify current)",
    unit: "Request / tokens (paid)",
    freeTierOrQuotas:
      "No-key: rate-limited free access. With key: higher RPM; free token grants vary by account",
    source: SRC.jina,
    asOf: AS_OF,
  },
  {
    category: "Database",
    provider: "Supabase",
    service: "Postgres + pgvector (cloud)",
    usedFor: "App DB, knowledge embeddings, billing tables",
    pricing:
      "Free $0 · Pro from $25/mo (+ $10 Micro compute credit) · disk overage $0.125/GB · egress overage $0.09/GB · Team $599/mo",
    unit: "Plan $/mo + usage overages (disk, egress, MAU, …)",
    freeTierOrQuotas:
      "Free: 500 MB DB · ~500 MB RAM · 5+5 GB egress · 1 GB file storage · 50k MAU · 2 active projects · paused after 7 days idle",
    source: SRC.supabase,
    asOf: AS_OF,
  },
  {
    category: "Database (local/VPS)",
    provider: "Docker",
    service: "pgvector/pgvector:pg16",
    usedFor: "Local / self-host via docker-compose",
    pricing: "Host RAM/disk only (no vendor fee)",
    unit: "Infrastructure (VM)",
    freeTierOrQuotas: "Limited by host only",
    source: "docker-compose.yml",
    asOf: AS_OF,
  },
  {
    category: "Cache / rate limits",
    provider: "Upstash Redis",
    service: "REDIS_URL (Upstash REST/Redis)",
    usedFor: "Rate limits, suggestion cache, sessions helpers",
    pricing:
      "Free $0 · PAYG $0.20 / 100k commands + $0.25/GB storage (1 GB free) · Fixed 250 MB $10/mo · Fixed 1 GB $20/mo · Fixed 5 GB $100/mo",
    unit: "Commands / storage GB / fixed plan $/mo",
    freeTierOrQuotas:
      "Free: 256 MB · 500k commands/mo · 10 GB bandwidth · 10k cmd/sec · 1 database",
    source: SRC.upstash,
    asOf: AS_OF,
  },
  {
    category: "Cache (local/VPS)",
    provider: "Docker",
    service: "redis:7-alpine",
    usedFor: "Local / self-host Redis",
    pricing: "Host RAM/disk only",
    unit: "Infrastructure (VM)",
    freeTierOrQuotas: "Limited by host only",
    source: "docker-compose.yml",
    asOf: AS_OF,
  },
  {
    category: "App compute",
    provider: "Vercel",
    service: "Next.js serverless (apps/web)",
    usedFor: "Optional cloud deploy of web/orchestration",
    pricing: "Hobby free · Pro from vendor list (verify current seat + usage)",
    unit: "Plan $/mo + usage",
    freeTierOrQuotas: "Hobby limits apply; Pro raises ceilings — see Vercel pricing",
    source: SRC.vercel,
    asOf: AS_OF,
  },
  {
    category: "Object storage (widget assets)",
    provider: "Vercel",
    service: "Vercel Blob (BLOB_READ_WRITE_TOKEN)",
    usedFor:
      "Org-uploaded widget assets: custom fonts (max 10/org, ≤2 MB each) + brand logo (max 1/org, ≤1 MB). Required on Vercel — local disk under data/org-fonts and data/org-logos is ephemeral there. Local/Docker can use filesystem without Blob.",
    pricing:
      "Hobby: included within free caps (cannot buy overage). Pro: Storage ≈ $0.023/GB · Simple ops ≈ $0.40 / 1M · Advanced ops ≈ $5 / 1M · Blob data transfer from ≈ $0.05/GB (verify current regional rates)",
    unit: "Storage GB · ops · transfer GB",
    freeTierOrQuotas:
      "Hobby free: ~1 GB storage · ~10K simple ops (reads) · ~2K advanced ops (writes/lists) · ~10 GB Blob data transfer / month. Caps pause Blob until the period resets — do not rely on disk on Vercel.",
    source: `${SRC.vercelBlob} · ${SRC.vercel}`,
    asOf: AS_OF,
  },
  {
    category: "App compute",
    provider: "AWS Lightsail",
    service: "Linux instance (docker-compose.cloud.yml)",
    usedFor: "Always-on VPS alternative to serverless",
    pricing:
      "Linux + public IPv4: 2 GB ≈ $12/mo · 4 GB ≈ $24/mo · managed DB from $15/mo",
    unit: "Instance $/mo",
    freeTierOrQuotas: "No free always-on tier (AWS free trial may apply separately)",
    source: SRC.lightsail,
    asOf: AS_OF,
  },
  {
    category: "Customer billing",
    provider: "Stripe",
    service: "Checkout + webhooks",
    usedFor: "Subscription payments (not AI COGS)",
    pricing: "Standard Stripe processing fees (see Stripe pricing)",
    unit: "% + fixed fee / charge",
    freeTierOrQuotas: "No platform fee beyond payment processing",
    source: SRC.stripe,
    asOf: AS_OF,
  },
  {
    category: "Customer billing",
    provider: "Razorpay",
    service: "Checkout + webhooks (India)",
    usedFor: "INR subscriptions (not AI COGS)",
    pricing: "Standard Razorpay MDR (see Razorpay pricing)",
    unit: "% / charge",
    freeTierOrQuotas: "See Razorpay plan limits",
    source: SRC.razorpay,
    asOf: AS_OF,
  },
  {
    category: "Auth",
    provider: "Google Identity",
    service: "Google OAuth / One Tap",
    usedFor: "Dashboard + widget Google login",
    pricing: "No per-login fee for standard OAuth client use",
    unit: "N/A",
    freeTierOrQuotas: "Subject to Google Cloud / OAuth client policies",
    source: "https://developers.google.com/identity",
    asOf: AS_OF,
  },
];

export type PhaseId = "bootstrap" | "growth" | "scale";

export type PhaseRow = {
  component: string;
  provider: string;
  freeOrIncluded: string;
  unitCost: string;
  bottleneck: string;
  migrationTrigger: string;
  nextStageCost: string;
  source: string;
};

export type PhaseBlock = {
  id: PhaseId;
  title: string;
  summary: string;
  infrastructureMonthlyUsd: { min: number; max: number; note: string };
  estimatedCustomers: { min: number | null; max: number | null; basis: string };
  recommendedPricing: string;
  notes: string;
  rows: PhaseRow[];
};

function buildPhases(): PhaseBlock[] {
  const starter = PLAN_CATALOG.starter;
  const pro = PLAN_CATALOG.pro;
  const business = PLAN_CATALOG.business;

  return [
    {
      id: "bootstrap",
      title: "Phase 1 — Bootstrap",
      summary:
        "Supabase Free + Upstash Free (or Docker Postgres/Redis locally). Gemini free/paid keys + Tavily free credits + Jina Reader (free) / Firecrawl free 1k credits for website import. Fine for demos and design partners — not reliable multi-tenant production (Supabase Free pauses after 7 days idle).",
      infrastructureMonthlyUsd: {
        min: 0,
        max: 0,
        note: "Infra $0 on free tiers; Gemini/Tavily/Firecrawl may still accrue on paid API keys beyond free quotas.",
      },
      estimatedCustomers: {
        min: 5,
        max: 30,
        basis: "Rough band before 500 MB DB, Tavily 1k credits, Firecrawl 1k credits, Upstash 500k cmds, Gemini free RPD, or idle pause bind. Estimate only.",
      },
      recommendedPricing: `Free (${PLAN_CATALOG.free.conversationsPerMonth} chats) · Starter $${starter.priceUsdMonthly}/mo`,
      notes:
        "Use the stack catalog above for exact rates. Do not invent per-customer COGS here — meter in product usage elsewhere.",
      rows: [
        {
          component: "PostgreSQL + pgvector",
          provider: "Supabase Free",
          freeOrIncluded:
            "500 MB DB · ~500 MB RAM · 5+5 GB egress · pause after 7d idle · 2 active projects",
          unitCost: "$0",
          bottleneck: "DB size (embeddings) + idle pause + no backups",
          migrationTrigger: "Need uptime without pause, backups, or DB >~400 MB",
          nextStageCost: "Supabase Pro from $25/mo (incl. $10 Micro credit)",
          source: SRC.supabase,
        },
        {
          component: "Redis",
          provider: "Upstash Free or Docker Redis",
          freeOrIncluded:
            "Upstash: 256 MB · 500k cmds/mo · 10 GB BW. Docker: host-limited",
          unitCost: "$0 on free / Docker",
          bottleneck: "500k commands/mo",
          migrationTrigger: ">~400k cmds/mo or >200 MB data",
          nextStageCost: "PAYG $0.20/100k cmds or Fixed 250 MB $10/mo",
          source: SRC.upstash,
        },
        {
          component: "App compute",
          provider: "Local Docker / Vercel Hobby",
          freeOrIncluded: "docker-compose or Vercel Hobby",
          unitCost: "$0 typical",
          bottleneck: "Cold starts / no SLA",
          migrationTrigger: "Need always-on production + SLA",
          nextStageCost: "Lightsail 2 GB ≈ $12/mo or Vercel Pro (verify)",
          source: SRC.lightsail,
        },
        {
          component: "Widget fonts + logo (object storage)",
          provider: "Vercel Blob (Hobby) or local data/org-fonts + data/org-logos",
          freeOrIncluded:
            "Hobby Blob ≈ 1 GB storage · 10K reads · 2K writes · 10 GB transfer. Local/Docker: disk paths (not durable on Vercel). Product limits: 10 fonts/org ≤2 MB each; 1 logo/org ≤1 MB.",
          unitCost: "$0 within Hobby Blob caps",
          bottleneck:
            "Hobby caps pause Blob until reset; Vercel FS is ephemeral — never store fonts/logos only on disk in serverless",
          migrationTrigger:
            "Need BLOB_READ_WRITE_TOKEN for Vercel deploys; upgrade Pro if storage/ops/transfer caps bind",
          nextStageCost:
            "Pro usage: ~$0.023/GB storage · ~$0.40/1M simple ops · ~$5/1M advanced ops · transfer from ~$0.05/GB",
          source: SRC.vercelBlob,
        },
        {
          component: "Gemini + Tavily + scrape",
          provider: "Google + Tavily + Jina / Firecrawl",
          freeOrIncluded:
            "Gemini free tier (AI Studio limits) · Tavily 1,000 credits/mo · Jina Reader free rate-limited · Firecrawl Free 1,000 credits/mo",
          unitCost: "See stack catalog (per-model / per-credit)",
          bottleneck:
            "Free RPD / 1k Tavily / 1k Firecrawl under multi-tenant chat + website syncs",
          migrationTrigger: "Paid customers or 429 / credit exhaustion",
          nextStageCost:
            "Gemini billing Tier 1+ · Tavily PAYG or Project $30 · Firecrawl Hobby $16",
          source: `${SRC.gemini} · ${SRC.tavily} · ${SRC.jina} · ${SRC.firecrawl}`,
        },
      ],
    },
    {
      id: "growth",
      title: "Phase 2 — Growth",
      summary:
        "First real production: Supabase Pro + Upstash paid + Gemini paid. Optional Lightsail 2 GB or Vercel Pro. Target tens–low hundreds of SMB customers.",
      infrastructureMonthlyUsd: {
        min: 25,
        max: 25 + 10 + 12,
        note: "Supabase Pro $25 · Upstash Fixed 250 MB $10 · optional Lightsail 2 GB ≈ $12.",
      },
      estimatedCustomers: {
        min: 30,
        max: 150,
        basis: "8 GB disk + paid Gemini; still watch embeddings + Tavily. Validate with finance, not this page.",
      },
      recommendedPricing: `Starter $${starter.priceUsdMonthly} · Pro $${pro.priceUsdMonthly}/mo`,
      notes:
        "Provider COGS scales with chats × routed models × tools. Catalog rates are the source of truth.",
      rows: [
        {
          component: "PostgreSQL + pgvector",
          provider: "Supabase Pro",
          freeOrIncluded:
            "8 GB disk · 250 GB egress · Micro 60 direct / 200 pooler · daily backups 7d",
          unitCost: "$25/mo plan; disk $0.125/GB overage",
          bottleneck: "halfvec disk growth; pooler on serverless",
          migrationTrigger: "Disk >> 8 GB or need Small+ compute",
          nextStageCost: "Small compute $15/mo or self-host Postgres",
          source: SRC.supabase,
        },
        {
          component: "Redis",
          provider: "Upstash PAYG or Fixed 250 MB",
          freeOrIncluded: "Fixed: 250 MB / 50 GB BW / no per-command bill",
          unitCost: "$10 Fixed or $0.20/100k cmds PAYG",
          bottleneck: "Command or memory growth",
          migrationTrigger: "Bill > Fixed 250 MB or need HA (Prod Pack)",
          nextStageCost: "Fixed 1 GB $20/mo",
          source: SRC.upstash,
        },
        {
          component: "App compute",
          provider: "Vercel Pro or Lightsail 2 GB",
          freeOrIncluded: "N/A",
          unitCost: "Lightsail 2 GB ≈ $12/mo; Vercel Pro per seat (verify)",
          bottleneck: "Concurrency / single VM CPU",
          migrationTrigger: "CPU >~70% sustained or multi-region need",
          nextStageCost: "Lightsail 4 GB ≈ $24/mo",
          source: SRC.lightsail,
        },
        {
          component: "Gemini + Tavily + scrape",
          provider: "Paid usage",
          freeOrIncluded: "N/A — usage-priced (Jina free may still cover light syncs)",
          unitCost:
            "Per catalog model + Tavily credits + Firecrawl ~$0.0032/credit after free",
          bottleneck: "Token spend / search / scrape credits per conversation + sync",
          migrationTrigger: "COGS rising (always-high routing, heavy search/scrape)",
          nextStageCost: "Prompt caching, tighter tools (product work)",
          source: `${SRC.gemini} · ${SRC.tavily} · ${SRC.firecrawl}`,
        },
      ],
    },
    {
      id: "scale",
      title: "Phase 3 — Scale",
      summary:
        "Hundreds+ customers: larger Supabase compute or self-hosted Postgres, Redis Fixed ≥1 GB, always-on fleet, Gemini Tier 2+, optional ops cost. India: Razorpay + GST.",
      infrastructureMonthlyUsd: {
        min: 80,
        max: 300,
        note: "Illustrative: Supabase Medium $60+ / Lightsail 4 GB ≈ $24 + managed DB $15+ / Upstash 1–5 GB Fixed. Size from dashboards — not a quote.",
      },
      estimatedCustomers: {
        min: 150,
        max: null,
        basis: "Open-ended with spend; null max = no free-tier ceiling.",
      },
      recommendedPricing: `Pro $${pro.priceUsdMonthly} · Business $${business.priceUsdMonthly}/mo · custom enterprise`,
      notes:
        "Amortize fixed infra across customers; keep AI COGS on the catalog rates.",
      rows: [
        {
          component: "PostgreSQL + pgvector",
          provider: "Supabase Medium+ or self-host",
          freeOrIncluded: "Paid only",
          unitCost: "Medium compute $60/mo; Lightsail DB from $15/mo",
          bottleneck: "HNSW RAM + IO under large KBs",
          migrationTrigger: "Query p95 / disk IO saturation",
          nextStageCost: "Large/XL or dedicated vector ops",
          source: SRC.supabase,
        },
        {
          component: "Redis",
          provider: "Upstash Fixed 1–5 GB",
          freeOrIncluded: "Paid only",
          unitCost: "$20–$100/mo Fixed (Upstash table)",
          bottleneck: "Multi-tenant cache cardinality",
          migrationTrigger: "Memory / cmd rate pressure",
          nextStageCost: "Larger Fixed or Redis on VPS",
          source: SRC.upstash,
        },
        {
          component: "App + team",
          provider: "Lightsail 4 GB+ / multi-instance",
          freeOrIncluded: "N/A",
          unitCost: "Lightsail 4 GB ≈ $24/mo + human ops (not priced)",
          bottleneck: "Ops / support load",
          migrationTrigger: "Uptime or support needs",
          nextStageCost: "Team ops budget (business decision)",
          source: SRC.lightsail,
        },
      ],
    },
  ];
}

/** Static planning report — no DB / usage_events. */
export function getUnitEconomicsReport() {
  return {
    asOf: AS_OF,
    purpose:
      "Reference catalog of technologies we use and official pricing, plus Phase 1–3 capacity planning. Not a live usage or billing dashboard.",
    sources: SRC,
    catalog: STACK_CATALOG,
    phases: buildPhases(),
    rateLimitsNote: {
      text: "Exact Gemini free RPM/TPM/RPD are project- and model-specific in Google AI Studio — do not hardcode a single free quota here.",
      source: SRC.geminiLimits,
    },
  };
}
