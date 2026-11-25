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

**Customer sign-in.** The account page signs customers in with Supabase Auth (email + password, with sign-up, email confirmation and password reset). It talks to Supabase directly from the browser using the public anon key, so it only works once these are set for the web app:

```
NEXT_PUBLIC_SUPABASE_URL=...        # Project Settings > API > Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Project Settings > API > anon / publishable key
```

Then in Supabase **Authentication > URL Configuration**, set **Site URL** to your site address and add these **Redirect URLs** (use your real domain, and `http://localhost:3000` for local work):

```
https://YOUR-DOMAIN/account
https://YOUR-DOMAIN/account/reset
```

**Google sign-in.** The "Continue with Google" button works through Supabase, but Google has to be switched on in two places first:

1. In [Google Cloud Console](https://console.cloud.google.com/) create a project (or pick one), then **APIs & Services > OAuth consent screen** (set the app name to Septer-M and add your support email) and **Credentials > Create credentials > OAuth client ID > Web application**.
2. Add this under **Authorized redirect URIs** (your Supabase project reference is the part before `.supabase.co` in the Project URL):
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
3. Copy the **Client ID** and **Client secret** into Supabase: **Authentication > Providers > Google**, switch it on and save.
4. Make sure the Site URL and Redirect URLs above are set. Without them Google sends people back to the wrong place.

Until Google is enabled in Supabase the button shows "Google sign-in isn't switched on for this store yet" instead of failing. Google accounts get a profile automatically (name included), exactly like email sign-ups. While the Google consent screen is in "Testing" mode only the test users you list can sign in; publish it to open it to everyone.

Without the two variables the page shows a clear "sign-in isn't switched on yet" notice instead of a form. Customers can see only their own orders (Row Level Security), and an account becomes an admin only when you set `role = 'admin'` on its `profiles` row. The admin pages are not yet locked behind sign-in.

## Deploying to Vercel

One Vercel project, rooted at `apps/web` (Framework: Next.js).
Enable "Include source files outside of the Root Directory" because the app depends on `packages/shared`.
Set the env vars from `.env.example`.

The NestJS API (`apps/api`) is not deployed yet. When the backend phase starts it will be served from this same project.
Use the Supabase **pooled** connection string for `DATABASE_URL`.

## Conventions

- Money is stored as integer minor units (pence / pesewas) with an explicit currency.
- Serverless: no in-memory state, no long-lived workers. Use Vercel Cron / Supabase for background jobs.
