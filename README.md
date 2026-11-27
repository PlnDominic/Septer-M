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
| `GET /v1/products`, `GET /v1/products/:slug` | Public (includes `inStock` and `lowStock`, never the stock count) |
| `POST /v1/orders` | Guests and signed-in customers. Prices, discount and stock are decided on the server; returns what to do next to pay |
| `POST /v1/promo/validate` | Public, rate limited |
| `GET /v1/orders/:number?token=` | Guest, with the secret token from checkout or an email link |
| `POST /v1/orders/:number/payment`, `.../payment/otp` | Retry paying, or enter a Mobile Money one-time code (needs the token) |
| `POST /v1/orders/track` | Order number + email, rate limited |
| `POST /v1/subscribe`, `GET /v1/unsubscribe?token=` | Newsletter; a new subscriber is emailed a one-off 10% code |
| `GET/POST /v1/products/:slug/reviews`, `GET .../eligibility` | List is public; writing needs sign-in and a shipped order of that product |
| `GET /v1/me`, `GET /v1/me/orders` | Signed in |
| `POST /v1/webhooks/stripe`, `POST /v1/webhooks/paystack` | The payment providers, verified by signature on the raw body |
| `/v1/admin/*` (dashboard, orders, products, customers, promo codes, reviews) | Admins only |
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

Without the two variables the page shows a clear "sign-in isn't switched on yet" notice instead of a form. Customers can see only their own orders (Row Level Security), and an account becomes an admin only when you set `role = 'admin'` on its `profiles` row.

**Admin lock.** When `NEXT_PUBLIC_API_URL` is set, `/admin` shows only to signed-in admins (everyone else sees a sign-in prompt or "no access" and no data is requested). That screen is a courtesy: the real lock is the API, which refuses every `/v1/admin/*` request that is not from an admin. Without `NEXT_PUBLIC_API_URL` the admin is a browser-only demo with fake data.

**Payments.** Set the keys from `.env.example` on the **API** project, and `WEB_URL` to the storefront address.

| | UK | Ghana |
|---|---|---|
| Provider | Stripe Checkout (cards, Apple Pay, Google Pay) | Paystack (cards via hosted page; Mobile Money charge to the customer's phone) |
| Webhook to add in the dashboard | `https://YOUR-API/v1/webhooks/stripe` | `https://YOUR-API/v1/webhooks/paystack` |

The order is only marked Paid by a verified webhook, never by the browser coming back from the payment page. Payments are idempotent (a repeated webhook does nothing), the amount and currency must match the order, and a payment that arrives after an order expired is flagged for review instead of being lost.

**Email.** Order confirmation, shipping and welcome-code emails go through [Resend](https://resend.com) (`RESEND_API_KEY`, `EMAIL_FROM` on a domain you verified). With no key the shop works and simply sends nothing. A failing email never blocks an order or payment.

**Promo codes and reviews.** Create and switch off codes in **Admin > Promo codes**; approve reviews in **Admin > Reviews**. The discount is calculated and re-checked inside the same database transaction that reserves stock, so it cannot be edited in the browser or used twice.

**Updating an existing database.** If you ran an older `setup.sql`, apply the newer files in `supabase/migrations/` (the latest is `20261130100000_commerce_extras.sql`) in the SQL Editor instead of starting over.

## Before launch

Run `pnpm check:launch` for a live checklist of what is still missing. The storefront shows your business details only when you set them, and never invents any:

| Variable | Where it appears |
|---|---|
| `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_WHATSAPP`, `NEXT_PUBLIC_SUPPORT_HOURS` | Contact page and footer |
| `NEXT_PUBLIC_BUSINESS_LEGAL_NAME`, `NEXT_PUBLIC_COMPANY_NUMBER`, `NEXT_PUBLIC_BUSINESS_ADDRESS`, `NEXT_PUBLIC_VAT_NUMBER` | Footer, Contact, Terms, Privacy (UK law expects a shop to show these) |
| `NEXT_PUBLIC_INSTAGRAM_URL`, `NEXT_PUBLIC_TIKTOK_URL` | Footer |

The Delivery, Returns, Privacy and Terms pages are good-faith drafts written from how the shop currently works. Their delivery prices, times and free-delivery thresholds come from the same code as checkout (`packages/shared/src/checkout.ts`), so they cannot disagree. Have a solicitor read the policy wording before you launch, and update `LEGAL_UPDATED` in `apps/web/src/lib/site.ts` when you change it.

Set `NEXT_PUBLIC_SITE_URL` to your real address so the sitemap, share previews (WhatsApp, Instagram) and Google product data point at the right place. Search engines are told to skip `/admin`, `/checkout`, `/account`, `/cart` and `/wishlist`.

Ratings are hidden until real reviews exist. Reviews can only be written by customers whose order of that product shipped, and show only after you approve them. Do not add placeholder ratings or reviews: fake reviews are illegal in the UK.

## Deploying to Vercel

Two Vercel projects from this one repo, both with **Include source files outside of the Root Directory** enabled (they depend on `packages/shared`):

| Project | Root directory | Notes |
|---|---|---|
| Storefront + admin | `apps/web` (Next.js) | Set the `NEXT_PUBLIC_*` variables. `NEXT_PUBLIC_API_URL` is the API project's address. |
| API | `apps/api` | `apps/api/vercel.json` routes every request to the NestJS function and registers a cron for `/v1/internal/release-expired`. Set `SUPABASE_*`, `WEB_URL`, `WEB_ORIGIN` (the storefront address, for CORS), `CRON_SECRET`, the Stripe/Paystack keys and the Resend settings. |

The API is a separate project because a Next.js project cannot also run the NestJS app. (Serving it from the storefront's own project would be possible with a route-handler bridge; that is not built.) `NEXT_PUBLIC_*` values are baked in at build time, so redeploy the storefront after changing them.

The in-memory rate limiter is per serverless instance, so it is best-effort protection against abuse, not a hard guarantee.

## Conventions

- Money is stored as integer minor units (pence / pesewas) with an explicit currency.
- Serverless: no in-memory state, no long-lived workers. Use Vercel Cron / Supabase for background jobs.
