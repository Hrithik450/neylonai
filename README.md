# Neylon AI — Intelligent Conversational Widget

Neylon AI is a production-ready, embeddable AI chat widget built with **Next.js 15**, **LangGraph**, and **Google Gemini**. Drop it into any website to give your visitors a smart, context-aware assistant that can answer questions, capture leads, book demos, and search the web in real time.

---

## Features

- **AI-Powered Chat** — LangGraph agent with Google Gemini (flash-lite) and OpenAI models
- **Semantic Search** — ChromaDB Cloud vector search with OpenAI Embeddings and query expansion
- **Live Web Search** — Tavily API integration for up-to-date answers
- **Lead Capture** — Automatic lead extraction and PostgreSQL persistence
- **Demo Booking** — Configurable meeting/demo booking flow
- **Team Notifications** — Webhook-based team alerting when high-intent leads are detected
- **Google One-Tap Login** — Frictionless authentication with JWT session management
- **Thread History** — Persistent conversation threads per user
- **Real-time Streaming** — Server-Sent Events (SSE) for live AI responses
- **Redis Caching** — Fast response times via ioredis caching layer
- **Responsive UI** — Beautiful landing page + embeddable widget built with Shadcn UI

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Drizzle ORM |
| Cache | Redis (ioredis) |
| Auth | Google One-Tap + JWT (jose) |
| AI Agent | LangGraph + LangChain |
| LLM | Google Gemini, OpenAI GPT-4.1 |
| Vector DB | ChromaDB Cloud |
| Web Search | Tavily API |
| UI | Shadcn UI, Tailwind CSS |
| State | Zustand |
| Package Manager | pnpm |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database (Supabase recommended)
- Redis instance

### Installation

```bash
git clone https://github.com/Hrithik450/neylonai.git
cd neylonai
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

### Database Setup

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## Project Structure

```
src/
├── app/
│   ├── api/v1/           # REST API routes (auth, threads, messages, cron)
│   ├── orchestration/    # AI chat streaming endpoint
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── actions/              # Server-side data access (Drizzle + Redis)
│   ├── users/
│   ├── threads/
│   ├── thread-messages/
│   └── cron/
├── components/
│   ├── landing-page/     # Marketing page sections
│   ├── navigation/
│   ├── ui/               # Shadcn UI primitives + charts
│   └── widget/           # Embeddable chat widget
├── hooks/                # React custom hooks
├── lib/
│   ├── agent/            # LangGraph agent, tools, memory
│   ├── auth/             # JWT session management
│   ├── db/               # Drizzle database connection
│   ├── drizzle/          # Schema + migrations
│   ├── redis/            # ioredis client
│   ├── services/         # Client-side API services
│   └── types/            # TypeScript type definitions
├── store/                # Zustand state stores
└── middleware.ts          # Route protection
```

---

## Environment Variables Reference

See `.env.example` for the full list of required and optional variables.

---

## License

MIT
