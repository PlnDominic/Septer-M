# Septer-M

Skincare e-commerce for the UK (GBP) and Ghana (GHS).

| Layer | Choice |
|---|---|
| API | NestJS 11 (`apps/api`), deployed to Vercel as a serverless function |
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

Create two Vercel projects from this repo:

| Project | Root Directory |
|---|---|
| septer-m-api | `apps/api` |
| septer-m-web | `apps/web` |

Enable "Include source files outside of the Root Directory" for both (the apps depend on `packages/shared`).
Set the env vars from `.env.example`. Use the Supabase **pooled** connection string for `DATABASE_URL`.

## Conventions

- Money is stored as integer minor units (pence / pesewas) with an explicit currency.
- Serverless: no in-memory state, no long-lived workers. Use Vercel Cron / Supabase for background jobs.
