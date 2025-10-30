# Interactive Mind Map (MVP)

Next.js + Neon Postgres career exploration map with AI chat.

## Getting Started

1. Copy env vars

```bash
cp .env.example .env.local
```

Set `DATABASE_URL`, `NEXTAUTH_SECRET`, `OPENAI_API_KEY`.

2. Install and run

```bash
pnpm install
pnpm dlx prisma migrate dev
pnpm seed
pnpm dev
```

Deploy to Vercel and set the same env vars. Use Neon connection string for `DATABASE_URL`.
