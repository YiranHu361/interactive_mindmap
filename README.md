# Interactive Mind Map (MVP)

Next.js + Neon Postgres career exploration map with AI chat.

## Getting Started

1. Copy env vars

```bash
cp env.template .env.local
```

Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and optionally `OPENAI_API_KEY` or `PERPLEXITY_API_KEY`.

### API Keys

- **Perplexity API (Recommended for web browsing)**: 
  - Get your key at: https://www.perplexity.ai/settings/api
  - Supports real-time web browsing and current information
  - Add to `.env.local`: `PERPLEXITY_API_KEY="pplx-..."`
  
- **OpenAI API (Fallback)**:
  - Get your key at: https://platform.openai.com/api-keys
  - Add to `.env.local`: `OPENAI_API_KEY="sk-..."`

**Priority**: If both are set, Perplexity (with web browsing) will be used first, falling back to OpenAI if needed.

2. Install and run

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Deploy to Vercel and set the same env vars. Use Neon connection string for `DATABASE_URL`.
