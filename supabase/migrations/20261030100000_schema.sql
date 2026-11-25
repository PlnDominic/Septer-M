-- Septer-M core schema: catalogue, orders, payments, stock.
-- Money is always integer minor units (pence / pesewas) with an explicit currency.

create schema if not exists private;

create type public.user_role      as enum ('customer', 'admin');
create type public.region_code    as enum ('UK', 'GH');
create type public.currency_code  as enum ('GBP', 'GHS');
create type public.product_status as enum ('draft', 'active');
create type public.order_status   as enum ('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');
create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded');

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

/* ---------- Profiles (one per auth user) ---------- */

create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

/* ---------- Catalogue ---------- */

create table public.categories (
  id       uuid primary key default gen_random_uuid(),
  slug     text not null unique,
  label    text not null,
  position int  not null default 0
);

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name         text not null check (length(name) > 0),
  tagline      text not null default '',
  category_id  uuid not null references public.categories (id),
  size_ml      int  not null check (size_ml > 0),
  skin_types   text[] not null default '{}',
  concerns     text[] not null default '{}',
  ingredients  text not null default '',
  how_to_use   text not null default '',
  image_path   text not null default '',
  is_new       boolean not null default false,
  best_seller  boolean not null default false,
  status       public.product_status not null default 'draft',
  stock        int  not null default 0 check (stock >= 0),
  rating_value numeric(2, 1) not null default 0 check (rating_value between 0 and 5),
  rating_count int  not null default 0 check (rating_count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index products_category_idx on public.products (category_id);
create index products_status_idx   on public.products (status);
create trigger products_updated_at before update on public.products
  for each row execute function private.set_updated_at();

-- One price per currency, set by hand (not converted live).
create table public.product_prices (
  product_id uuid not null references public.products (id) on delete cascade,
  currency   public.currency_code not null,
  amount     int not null check (amount > 0),
  compare_at int check (compare_at is null or compare_at > amount),
  primary key (product_id, currency)
);

/* ---------- Orders ---------- */

create sequence public.order_number_seq start 1001;

create table public.orders (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique default ('SM-' || nextval('public.order_number_seq')),
  -- Guest checkout: the confirmation page proves ownership with number + token.
  public_token       uuid not null default gen_random_uuid(),
  user_id            uuid references auth.users (id) on delete set null,
  email              text not null,
  region             public.region_code   not null,
  currency           public.currency_code not null,
  status             public.order_status  not null default 'pending_payment',
  shipping_address   jsonb not null,
  shipping_method_id text  not null,
  shipping_label     text  not null,
  shipping_detail    text  not null default '',
  shipping_cost      int   not null check (shipping_cost >= 0),
  subtotal           int   not null check (subtotal >= 0),
  total              int   not null check (total >= 0),
  payment            jsonb not null,
  -- Unpaid orders release their stock after this time.
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (total = subtotal + shipping_cost),
  check ((region = 'UK' and currency = 'GBP') or (region = 'GH' and currency = 'GHS'))
);
create index orders_user_idx    on public.orders (user_id);
create index orders_email_idx   on public.orders (email);
create index orders_status_idx  on public.orders (status);
create index orders_created_idx on public.orders (created_at desc);
create index orders_expiry_idx  on public.orders (expires_at) where status = 'pending_payment';
create trigger orders_updated_at before update on public.orders
  for each row execute function private.set_updated_at();

-- Snapshot of what was bought, so later catalogue edits never rewrite history.
create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  slug       text not null,
  name       text not null,
  qty        int  not null check (qty > 0),
  unit_price int  not null check (unit_price >= 0)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  status     public.order_status not null,
  note       text,
  actor_id   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders (id) on delete cascade,
  provider     text not null check (provider in ('stripe', 'paystack', 'manual')),
  provider_ref text not null,
  amount       int  not null,
  currency     public.currency_code not null,
  status       public.payment_status not null,
  raw          jsonb,
  created_at   timestamptz not null default now(),
  -- Webhooks are retried by providers; this makes processing idempotent.
  unique (provider, provider_ref)
);
create index payments_order_idx on public.payments (order_id);

create table public.inventory_movements (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  delta      int  not null check (delta <> 0),
  reason     text not null,
  order_id   uuid references public.orders (id) on delete set null,
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);
