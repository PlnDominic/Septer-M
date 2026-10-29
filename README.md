# Septer-M

Skincare e-commerce for the UK (GBP) and Ghana (GHS).

| Layer | Choice |
|---|---|
| API | NestJS 11 (`apps/api`), to be served from the same Vercel project |
| Storefront + admin | Next.js (`apps/web`) |
| Backend services | Supabase (Postgres, Auth, Storage) |
| Payments (planned) | Stripe (UK), Paystack (Ghana, incl. mobile money) |

## Layout

```
apps/api        NestJS API (src/main.ts locally, api/index.ts on Vercel)
apps/web        Next.js app
packages/shared Shared types and constants (currencies, regions, roles)
supabase/       Migrations and policies
```

## Getting started

```bash
pnpm install
pnpm --filter @septer-m/shared build
cp .env.example .env
pnpm dev:api   # http://localhost:4000/v1/health
pnpm dev:web   # http://localhost:3000
```

## Deploying to Vercel

One Vercel project, rooted at `apps/web` (Framework: Next.js).
Enable "Include source files outside of the Root Directory" because the app depends on `packages/shared`.
Set the env vars from `.env.example`.

The NestJS API (`apps/api`) is not deployed yet. When the backend phase starts it will be served from this same project.
Use the Supabase **pooled** connection string for `DATABASE_URL`.

## Conventions

- Money is stored as integer minor units (pence / pesewas) with an explicit currency.
- Serverless: no in-memory state, no long-lived workers. Use Vercel Cron / Supabase for background jobs.
