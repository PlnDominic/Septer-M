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

## Backend (Supabase + NestJS)

**Database.** Everything lives in `supabase/`:

| File | What it is |
|---|---|
| `migrations/` | Schema, Row Level Security rules and the order/stock functions |
| `seed.sql` | Starter catalogue (the same 8 products as the storefront) |
| `setup.sql` | All of the above in one file, for pasting into the Supabase SQL Editor |
| `tests/db.test.mjs` | Runs the migrations on an in-process Postgres and tests logic + security |

Set up a new Supabase project:

1. Create the project, open **SQL Editor**, paste the whole of `supabase/setup.sql` and run it once.
2. Sign up through the app (or **Authentication > Users > Add user**), then make yourself an admin:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Copy **Project URL** and the **service_role** key (Project Settings > API) into `.env` as `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

After editing a migration, run `pnpm db:bundle` to regenerate `setup.sql` and `pnpm test:db` to check it.

**API** (`apps/api`, NestJS on Fastify). It prices orders on the server, reserves stock in one database transaction and enforces roles, so the browser is never trusted for prices or permissions.

| Route | Who |
|---|---|
| `GET /v1/products`, `GET /v1/products/:slug` | Public |
| `POST /v1/orders` | Guests and signed-in customers |
| `GET /v1/orders/:number?token=` | Guest, with the token returned at checkout |
| `GET /v1/me`, `GET /v1/me/orders` | Signed in |
| `/v1/admin/*` (dashboard, orders, products, customers) | Admins only |
| `GET /v1/internal/release-expired` | Scheduler, with `Authorization: Bearer $CRON_SECRET` |

Run the API locally with `pnpm dev:api`. `pnpm test` runs the API tests; `pnpm test:db` runs the database tests.

## Deploying to Vercel

One Vercel project, rooted at `apps/web` (Framework: Next.js).
Enable "Include source files outside of the Root Directory" because the app depends on `packages/shared`.
Set the env vars from `.env.example`.

The NestJS API (`apps/api`) is not deployed yet. When the backend phase starts it will be served from this same project.
Use the Supabase **pooled** connection string for `DATABASE_URL`.

## Conventions

- Money is stored as integer minor units (pence / pesewas) with an explicit currency.
- Serverless: no in-memory state, no long-lived workers. Use Vercel Cron / Supabase for background jobs.
