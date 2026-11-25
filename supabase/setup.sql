-- Septer-M database setup: schema + security rules + order functions + starter catalogue.
-- Paste this whole file into Supabase > SQL Editor and click Run. Run it once on an empty project.
-- Generated from supabase/migrations/* and supabase/seed.sql (pnpm db:bundle). Do not edit by hand.

-- ===================== 20261030100000_schema.sql ====================
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
  -- Email sign-up sends full_name; Google sends full_name and name.
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));
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

-- ===================== 20261030100100_rls.sql ====================
-- Row Level Security. The NestJS API uses the service role (bypasses RLS) and
-- enforces its own rules; RLS is the safety net for anything that talks to
-- Supabase directly with the public (anon) key, e.g. the storefront catalogue.

grant usage on schema private to anon, authenticated, service_role;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
grant execute on function private.is_admin() to anon, authenticated, service_role;

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.products            enable row level security;
alter table public.product_prices      enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.order_events        enable row level security;
alter table public.payments            enable row level security;
alter table public.inventory_movements enable row level security;

/* ---------- Catalogue: public read of active products, admin full access ---------- */

create policy "categories are public" on public.categories
  for select to anon, authenticated using (true);
create policy "admins manage categories" on public.categories
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

create policy "active products are public" on public.products
  for select to anon, authenticated using (status = 'active' or private.is_admin());
create policy "admins manage products" on public.products
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

-- Visible exactly when the parent product is (products RLS filters the subquery).
create policy "prices follow product visibility" on public.product_prices
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id));
create policy "admins manage prices" on public.product_prices
  for all to authenticated using (private.is_admin()) with check (private.is_admin());

/* ---------- Profiles ---------- */

create policy "read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or private.is_admin());
create policy "update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

/* ---------- Orders: customers read their own; admins read all; no direct writes ---------- */

create policy "read own orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()) or private.is_admin());
create policy "read own order items" on public.order_items
  for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));
create policy "read own order events" on public.order_events
  for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id));

create policy "admins read payments" on public.payments
  for select to authenticated using (private.is_admin());
create policy "admins read inventory movements" on public.inventory_movements
  for select to authenticated using (private.is_admin());

/* ---------- Privileges (belt and braces on top of RLS) ---------- */

-- Customers can only change their display name, never their role.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;
revoke insert, delete, truncate on public.profiles from anon, authenticated;

revoke all on public.orders, public.order_items, public.order_events,
              public.payments, public.inventory_movements from anon;
revoke insert, update, delete, truncate on public.orders, public.order_items,
              public.order_events, public.payments, public.inventory_movements from authenticated;

revoke insert, update, delete, truncate on public.categories, public.products,
              public.product_prices from anon;
revoke all on public.profiles from anon;

-- ===================== 20261030100200_functions.sql ====================
-- Business logic that must be atomic. Callable only by the service role (the
-- NestJS API); never by anon/authenticated clients.
--
-- Errors are raised with a stable machine code in the message and the subject
-- (usually a product slug) in the detail, e.g. OUT_OF_STOCK / tonic-serum.

/* ---------- Internal helpers ---------- */

create function private.restock_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  for r in
    select product_id, sum(qty)::int as qty
    from public.order_items
    where order_id = p_order_id and product_id is not null
    group by product_id
    order by product_id
  loop
    update public.products set stock = stock + r.qty where id = r.product_id;
    insert into public.inventory_movements (product_id, delta, reason, order_id)
    values (r.product_id, r.qty, p_reason, p_order_id);
  end loop;
end $$;
revoke all on function private.restock_order(uuid, text) from public;

/* ---------- create_order ---------- */
-- Validates every line against live data, reserves stock and writes the order
-- in one transaction. The API computes the expected subtotal (and so the
-- shipping cost); we re-check it here so a price change mid-checkout fails
-- loudly instead of charging the wrong amount.

create function public.create_order(
  p_user_id            uuid,
  p_email              text,
  p_region             public.region_code,
  p_shipping_address   jsonb,
  p_shipping_method_id text,
  p_shipping_label     text,
  p_shipping_detail    text,
  p_shipping_cost      int,
  p_payment            jsonb,
  p_items              jsonb,
  p_expected_subtotal  int,
  p_ttl_minutes        int default 30
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_currency public.currency_code :=
    case p_region when 'UK' then 'GBP'::public.currency_code else 'GHS'::public.currency_code end;
  v_slugs    text[];
  v_item     record;
  v_product  public.products;
  v_price    int;
  v_subtotal int := 0;
  v_lines    jsonb := '[]'::jsonb;
  v_line     jsonb;
  v_order    public.orders;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_slugs := array(select distinct i ->> 'slug' from jsonb_array_elements(p_items) i);

  -- Lock every product we need in one ordered statement (avoids deadlocks).
  perform 1 from public.products p where p.slug = any (v_slugs) order by p.id for update;

  for v_item in
    select i ->> 'slug' as slug, sum((i ->> 'qty')::int)::int as qty
    from jsonb_array_elements(p_items) i
    group by 1
    order by 1
  loop
    if v_item.qty < 1 or v_item.qty > 20 then
      raise exception 'INVALID_QUANTITY' using detail = v_item.slug;
    end if;

    select * into v_product from public.products where slug = v_item.slug;
    if not found or v_product.status <> 'active' then
      raise exception 'PRODUCT_UNAVAILABLE' using detail = v_item.slug;
    end if;
    if v_product.stock < v_item.qty then
      raise exception 'OUT_OF_STOCK' using detail = v_item.slug;
    end if;

    select amount into v_price
    from public.product_prices
    where product_id = v_product.id and currency = v_currency;
    if v_price is null then
      raise exception 'NO_PRICE' using detail = v_item.slug;
    end if;

    v_subtotal := v_subtotal + v_price * v_item.qty;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'slug', v_product.slug, 'name', v_product.name,
      'qty', v_item.qty, 'unit_price', v_price);
  end loop;

  if v_subtotal <> p_expected_subtotal then
    raise exception 'PRICE_CHANGED' using detail = v_subtotal::text;
  end if;

  insert into public.orders (
    user_id, email, region, currency, shipping_address, shipping_method_id,
    shipping_label, shipping_detail, shipping_cost, subtotal, total, payment, expires_at
  ) values (
    p_user_id, lower(trim(p_email)), p_region, v_currency, p_shipping_address, p_shipping_method_id,
    p_shipping_label, coalesce(p_shipping_detail, ''), p_shipping_cost, v_subtotal,
    v_subtotal + p_shipping_cost, p_payment, now() + make_interval(mins => p_ttl_minutes)
  ) returning * into v_order;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, product_id, slug, name, qty, unit_price)
    values (v_order.id, (v_line ->> 'product_id')::uuid, v_line ->> 'slug', v_line ->> 'name',
            (v_line ->> 'qty')::int, (v_line ->> 'unit_price')::int);

    update public.products set stock = stock - (v_line ->> 'qty')::int
    where id = (v_line ->> 'product_id')::uuid;

    insert into public.inventory_movements (product_id, delta, reason, order_id)
    values ((v_line ->> 'product_id')::uuid, -(v_line ->> 'qty')::int, 'order', v_order.id);
  end loop;

  insert into public.order_events (order_id, status, note)
  values (v_order.id, 'pending_payment', 'Order placed');

  return jsonb_build_object(
    'id', v_order.id, 'number', v_order.number, 'token', v_order.public_token,
    'subtotal', v_order.subtotal, 'shipping_cost', v_order.shipping_cost,
    'total', v_order.total, 'currency', v_order.currency, 'expires_at', v_order.expires_at);
end $$;

/* ---------- set_order_status ---------- */
-- The only way an order's status changes. Enforces the allowed transitions and
-- returns stock when an order is cancelled before it ships.

create function public.set_order_status(
  p_order_number text,
  p_status       public.order_status,
  p_note         text default null,
  p_actor        uuid default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders;
  v_ok    boolean;
begin
  select * into v_order from public.orders where number = p_order_number for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = p_order_number;
  end if;

  v_ok := case v_order.status
    when 'pending_payment' then p_status in ('paid', 'cancelled')
    when 'paid'            then p_status in ('processing', 'cancelled', 'refunded')
    when 'processing'      then p_status in ('shipped', 'cancelled', 'refunded')
    when 'shipped'         then p_status in ('delivered', 'refunded')
    when 'delivered'       then p_status = 'refunded'
    else false
  end;
  if not v_ok then
    raise exception 'INVALID_TRANSITION' using detail = v_order.status::text || ' -> ' || p_status::text;
  end if;

  if p_status = 'cancelled' then
    perform private.restock_order(v_order.id, 'order_cancelled');
  end if;

  update public.orders set status = p_status where id = v_order.id;
  insert into public.order_events (order_id, status, note, actor_id)
  values (v_order.id, p_status, nullif(trim(p_note), ''), p_actor);

  return jsonb_build_object('number', v_order.number, 'status', p_status, 'previous', v_order.status);
end $$;

/* ---------- mark_order_paid ---------- */
-- Called from payment-provider webhooks. Safe to call repeatedly with the same
-- provider reference: the second call is a no-op.

create function public.mark_order_paid(
  p_order_number text,
  p_provider     text,
  p_provider_ref text,
  p_amount       int,
  p_currency     public.currency_code,
  p_raw          jsonb default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_order      public.orders;
  v_ok         boolean;
  v_payment_id uuid;
begin
  select * into v_order from public.orders where number = p_order_number for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using detail = p_order_number;
  end if;

  v_ok := p_amount = v_order.total and p_currency = v_order.currency;

  insert into public.payments (order_id, provider, provider_ref, amount, currency, status, raw)
  values (v_order.id, p_provider, p_provider_ref, p_amount, p_currency,
          case when v_ok then 'succeeded'::public.payment_status else 'failed'::public.payment_status end, p_raw)
  on conflict (provider, provider_ref) do nothing
  returning id into v_payment_id;

  if v_payment_id is null then
    return jsonb_build_object('number', v_order.number, 'status', v_order.status, 'duplicate', true);
  end if;

  if not v_ok then
    insert into public.order_events (order_id, status, note)
    values (v_order.id, v_order.status,
            format('Payment of %s %s does not match the order total of %s %s - needs review',
                   p_amount, p_currency, v_order.total, v_order.currency));
    return jsonb_build_object('number', v_order.number, 'status', v_order.status, 'mismatch', true);
  end if;

  if v_order.status = 'pending_payment' then
    update public.orders set status = 'paid', expires_at = null where id = v_order.id;
    insert into public.order_events (order_id, status, note)
    values (v_order.id, 'paid', 'Payment received via ' || p_provider);
    return jsonb_build_object('number', v_order.number, 'status', 'paid');
  end if;

  -- Paid after the order was cancelled/expired: keep the money recorded, flag it.
  insert into public.order_events (order_id, status, note)
  values (v_order.id, v_order.status,
          'Payment received via ' || p_provider || ' while order was ' || v_order.status || ' - needs review or refund');
  return jsonb_build_object('number', v_order.number, 'status', v_order.status, 'review', true);
end $$;

/* ---------- release_expired_orders ---------- */

create function public.release_expired_orders() returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_count int := 0;
begin
  for r in
    select id from public.orders
    where status = 'pending_payment' and expires_at is not null and expires_at < now()
    order by id
    for update skip locked
  loop
    perform private.restock_order(r.id, 'order_expired');
    update public.orders set status = 'cancelled' where id = r.id;
    insert into public.order_events (order_id, status, note)
    values (r.id, 'cancelled', 'Payment window expired');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

/* ---------- admin_upsert_product ---------- */

create function public.admin_upsert_product(p_product jsonb, p_original_slug text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_cat       uuid;
  v_id        uuid;
  v_old_stock int;
  v_new_stock int := coalesce((p_product ->> 'stock')::int, 0);
  v_slug      text := p_product ->> 'slug';
begin
  select id into v_cat from public.categories where slug = p_product ->> 'category';
  if v_cat is null then
    raise exception 'UNKNOWN_CATEGORY' using detail = p_product ->> 'category';
  end if;

  if p_original_slug is not null then
    select id, stock into v_id, v_old_stock from public.products where slug = p_original_slug for update;
    if v_id is null then
      raise exception 'PRODUCT_NOT_FOUND' using detail = p_original_slug;
    end if;
    update public.products set
      slug = v_slug, name = p_product ->> 'name', tagline = coalesce(p_product ->> 'tagline', ''),
      category_id = v_cat, size_ml = (p_product ->> 'sizeMl')::int,
      skin_types = array(select jsonb_array_elements_text(coalesce(p_product -> 'skinTypes', '[]'))),
      concerns = array(select jsonb_array_elements_text(coalesce(p_product -> 'concerns', '[]'))),
      ingredients = coalesce(p_product ->> 'ingredients', ''), how_to_use = coalesce(p_product ->> 'howToUse', ''),
      image_path = coalesce(p_product ->> 'imagePath', ''),
      is_new = coalesce((p_product ->> 'isNew')::boolean, false),
      best_seller = coalesce((p_product ->> 'bestSeller')::boolean, false),
      status = (p_product ->> 'status')::public.product_status, stock = v_new_stock
    where id = v_id;
  else
    v_old_stock := 0;
    insert into public.products (
      slug, name, tagline, category_id, size_ml, skin_types, concerns, ingredients, how_to_use,
      image_path, is_new, best_seller, status, stock
    ) values (
      v_slug, p_product ->> 'name', coalesce(p_product ->> 'tagline', ''), v_cat, (p_product ->> 'sizeMl')::int,
      array(select jsonb_array_elements_text(coalesce(p_product -> 'skinTypes', '[]'))),
      array(select jsonb_array_elements_text(coalesce(p_product -> 'concerns', '[]'))),
      coalesce(p_product ->> 'ingredients', ''), coalesce(p_product ->> 'howToUse', ''),
      coalesce(p_product ->> 'imagePath', ''),
      coalesce((p_product ->> 'isNew')::boolean, false), coalesce((p_product ->> 'bestSeller')::boolean, false),
      (p_product ->> 'status')::public.product_status, v_new_stock
    ) returning id into v_id;
  end if;

  insert into public.product_prices (product_id, currency, amount, compare_at) values
    (v_id, 'GBP', (p_product -> 'price' ->> 'GBP')::int, (p_product -> 'compareAt' ->> 'GBP')::int),
    (v_id, 'GHS', (p_product -> 'price' ->> 'GHS')::int, (p_product -> 'compareAt' ->> 'GHS')::int)
  on conflict (product_id, currency) do update
    set amount = excluded.amount, compare_at = excluded.compare_at;

  if v_new_stock <> v_old_stock then
    insert into public.inventory_movements (product_id, delta, reason)
    values (v_id, v_new_stock - v_old_stock, case when p_original_slug is null then 'initial' else 'admin_adjustment' end);
  end if;

  return jsonb_build_object('id', v_id, 'slug', v_slug);
end $$;

/* ---------- Admin reporting ---------- */

create function public.admin_dashboard(p_currency public.currency_code, p_days int default 30)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with bounds as (
    select ((now() at time zone 'utc')::date - (greatest(p_days, 1) - 1)) as from_day
  ),
  days as (
    select generate_series(b.from_day, (now() at time zone 'utc')::date, interval '1 day')::date as day
    from bounds b
  ),
  sales as (
    select o.id, o.total, (o.created_at at time zone 'utc')::date as day
    from public.orders o, bounds b
    where o.currency = p_currency
      and o.status in ('paid', 'processing', 'shipped', 'delivered')
      and (o.created_at at time zone 'utc')::date >= b.from_day
  ),
  series as (
    select d.day, coalesce(sum(s.total), 0)::int as revenue, count(s.id)::int as orders
    from days d left join sales s on s.day = d.day
    group by d.day
  ),
  top as (
    select i.slug, max(i.name) as name, sum(i.qty)::int as units, sum(i.qty * i.unit_price)::int as revenue
    from public.order_items i join sales s on s.id = i.order_id
    group by i.slug
    order by revenue desc
    limit 5
  )
  select jsonb_build_object(
    'currency', p_currency,
    'revenue', coalesce((select sum(revenue) from series), 0),
    'orders', coalesce((select sum(orders) from series), 0),
    'series', coalesce((select jsonb_agg(jsonb_build_object('date', day, 'revenue', revenue, 'orders', orders) order by day) from series), '[]'::jsonb),
    'topProducts', coalesce((select jsonb_agg(to_jsonb(top)) from top), '[]'::jsonb),
    'toFulfil', (select count(*) from public.orders where status in ('paid', 'processing')),
    'awaitingPayment', (select count(*) from public.orders where status = 'pending_payment'),
    'lowStock', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'name', name, 'stock', stock) order by stock)
                          from public.products where stock <= 10), '[]'::jsonb)
  );
$$;

create function public.admin_customers() returns jsonb
language sql stable security definer set search_path = '' as $$
  with per as (
    select email, currency, count(*) as n,
           sum(total) filter (where status in ('paid', 'processing', 'shipped', 'delivered')) as spent,
           max(created_at) as last
    from public.orders
    group by email, currency
  ),
  latest as (
    select distinct on (email) email, shipping_address, region
    from public.orders
    order by email, created_at desc
  )
  select coalesce(jsonb_agg(c order by c ->> 'last' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'email', l.email,
      'name', concat_ws(' ', l.shipping_address ->> 'firstName', l.shipping_address ->> 'lastName'),
      'region', l.region,
      'orders', (select sum(n) from per p where p.email = l.email),
      'spent', (select coalesce(jsonb_object_agg(p.currency::text, coalesce(p.spent, 0)), '{}'::jsonb) from per p where p.email = l.email),
      'last', (select max(last) from per p where p.email = l.email)
    ) as c
    from latest l
  ) x;
$$;

create function public.admin_order_counts() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(status, n), '{}'::jsonb)
  from (select status::text as status, count(*)::int as n from public.orders group by status) t;
$$;

/* ---------- Lock the API-only functions down to the service role ---------- */

revoke all on function public.create_order(uuid, text, public.region_code, jsonb, text, text, text, int, jsonb, jsonb, int, int)
  from public, anon, authenticated;
revoke all on function public.set_order_status(text, public.order_status, text, uuid)
  from public, anon, authenticated;
revoke all on function public.mark_order_paid(text, text, text, int, public.currency_code, jsonb)
  from public, anon, authenticated;
revoke all on function public.release_expired_orders() from public, anon, authenticated;
revoke all on function public.admin_upsert_product(jsonb, text) from public, anon, authenticated;
revoke all on function public.admin_dashboard(public.currency_code, int) from public, anon, authenticated;
revoke all on function public.admin_customers() from public, anon, authenticated;
revoke all on function public.admin_order_counts() from public, anon, authenticated;

grant execute on function public.create_order(uuid, text, public.region_code, jsonb, text, text, text, int, jsonb, jsonb, int, int) to service_role;
grant execute on function public.set_order_status(text, public.order_status, text, uuid) to service_role;
grant execute on function public.mark_order_paid(text, text, text, int, public.currency_code, jsonb) to service_role;
grant execute on function public.release_expired_orders() to service_role;
grant execute on function public.admin_upsert_product(jsonb, text) to service_role;
grant execute on function public.admin_dashboard(public.currency_code, int) to service_role;
grant execute on function public.admin_customers() to service_role;
grant execute on function public.admin_order_counts() to service_role;

-- ===================== 20261130100000_commerce_extras.sql ====================
-- Discount codes, newsletter (with a welcome code), verified-purchase reviews, and discounts on orders.
-- Safe to apply on top of the first three migrations (or an earlier setup.sql).

create type public.review_status as enum ('pending', 'approved', 'rejected');
create type public.discount_kind as enum ('percent', 'fixed');

/* ---------- Discounts on orders ---------- */

alter table public.orders
  add column discount      int  not null default 0 check (discount >= 0),
  add column discount_code text;

-- Replace "total = subtotal + shipping" with one that accounts for the discount.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%shipping_cost%' and pg_get_constraintdef(oid) like '%subtotal%'
  loop
    execute format('alter table public.orders drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.orders add constraint orders_total_matches
  check (discount <= subtotal and total = subtotal - discount + shipping_cost);

create table public.discount_codes (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code = upper(code) and code ~ '^[A-Z0-9-]{3,32}$'),
  description      text not null default '',
  kind             public.discount_kind not null,
  percent          int check (percent between 1 and 100),
  amount_gbp       int check (amount_gbp > 0),
  amount_ghs       int check (amount_ghs > 0),
  min_subtotal_gbp int not null default 0 check (min_subtotal_gbp >= 0),
  min_subtotal_ghs int not null default 0 check (min_subtotal_ghs >= 0),
  max_uses         int check (max_uses > 0),
  uses             int not null default 0 check (uses >= 0),
  first_order_only boolean not null default false,
  one_per_email    boolean not null default true,
  -- A code issued to one person (e.g. the newsletter welcome code) only works for that email.
  restricted_email text check (restricted_email is null or restricted_email = lower(restricted_email)),
  starts_at        timestamptz,
  ends_at          timestamptz,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  check ((kind = 'percent' and percent is not null) or (kind = 'fixed' and amount_gbp is not null and amount_ghs is not null))
);

create table public.discount_redemptions (
  id         uuid primary key default gen_random_uuid(),
  code_id    uuid not null references public.discount_codes (id) on delete cascade,
  order_id   uuid not null unique references public.orders (id) on delete cascade,
  email      text not null,
  amount     int  not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index discount_redemptions_code_email_idx on public.discount_redemptions (code_id, email);

/* ---------- Newsletter ---------- */

create table public.subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique check (email = lower(email)),
  source            text not null default 'website',
  welcome_code      text,
  unsubscribe_token uuid not null default gen_random_uuid(),
  subscribed_at     timestamptz not null default now(),
  unsubscribed_at   timestamptz
);

/* ---------- Reviews (verified purchases only) ---------- */

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  rating       int  not null check (rating between 1 and 5),
  title        text not null default '' check (length(title) <= 120),
  body         text not null check (length(body) between 10 and 2000),
  display_name text not null check (length(display_name) between 1 and 60),
  status       public.review_status not null default 'pending',
  created_at   timestamptz not null default now(),
  moderated_at timestamptz,
  unique (product_id, user_id)
);
create index reviews_product_idx on public.reviews (product_id, status, created_at desc);

-- Keep the product's average rating and review count in step with approved reviews.
create function private.refresh_product_rating(p_product_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.products p set
    rating_value = coalesce((select round(avg(r.rating)::numeric, 1) from public.reviews r where r.product_id = p.id and r.status = 'approved'), 0),
    rating_count = (select count(*) from public.reviews r where r.product_id = p.id and r.status = 'approved')
  where p.id = p_product_id;
$$;

create function private.reviews_rating_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.refresh_product_rating(coalesce(new.product_id, old.product_id));
  return null;
end $$;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function private.reviews_rating_trigger();

/* ---------- Row Level Security ---------- */

alter table public.discount_codes       enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.subscribers          enable row level security;
alter table public.reviews              enable row level security;

revoke all on public.discount_codes, public.discount_redemptions, public.subscribers from anon, authenticated;

create policy "approved reviews are public" on public.reviews
  for select to anon, authenticated using (status = 'approved');
create policy "read own reviews" on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));
create policy "admins read all reviews" on public.reviews
  for select to authenticated using (private.is_admin());

revoke insert, update, delete, truncate on public.reviews from anon, authenticated;

/* ---------- Discount logic ---------- */

-- Checks a code and works out the discount. Pure read; callers lock the code row first when it matters.
create function private.check_discount(p_code text, p_email text, p_currency public.currency_code, p_subtotal int)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v       public.discount_codes;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_min   int;
  v_amt   int;
begin
  select * into v from public.discount_codes where code = upper(trim(coalesce(p_code, '')));
  -- A code meant for someone else looks like it doesn't exist.
  if not found or (v.restricted_email is not null and v.restricted_email <> v_email) then
    if found and v_email = '' then
      return jsonb_build_object('valid', false, 'reason', 'EMAIL_REQUIRED');
    end if;
    return jsonb_build_object('valid', false, 'reason', 'NOT_FOUND');
  end if;
  if not v.active then return jsonb_build_object('valid', false, 'reason', 'INACTIVE'); end if;
  if v.starts_at is not null and v.starts_at > now() then return jsonb_build_object('valid', false, 'reason', 'NOT_STARTED'); end if;
  if v.ends_at is not null and v.ends_at < now() then return jsonb_build_object('valid', false, 'reason', 'EXPIRED'); end if;
  if v.max_uses is not null and v.uses >= v.max_uses then return jsonb_build_object('valid', false, 'reason', 'USED_UP'); end if;

  v_min := case p_currency when 'GBP' then v.min_subtotal_gbp else v.min_subtotal_ghs end;
  if p_subtotal < v_min then return jsonb_build_object('valid', false, 'reason', 'MIN_SUBTOTAL', 'min', v_min); end if;

  if (v.first_order_only or v.one_per_email) and v_email = '' then
    return jsonb_build_object('valid', false, 'reason', 'EMAIL_REQUIRED');
  end if;
  if v.first_order_only and exists (select 1 from public.orders o where o.email = v_email and o.status <> 'cancelled') then
    return jsonb_build_object('valid', false, 'reason', 'FIRST_ORDER_ONLY');
  end if;
  if v.one_per_email and exists (select 1 from public.discount_redemptions r where r.code_id = v.id and r.email = v_email) then
    return jsonb_build_object('valid', false, 'reason', 'ALREADY_USED');
  end if;

  v_amt := case v.kind
    when 'percent' then (p_subtotal * v.percent) / 100
    else least(case p_currency when 'GBP' then v.amount_gbp else v.amount_ghs end, p_subtotal)
  end;
  return jsonb_build_object('valid', true, 'code', v.code, 'discount', v_amt, 'description', v.description);
end $$;

create function public.validate_discount(p_code text, p_email text, p_region public.region_code, p_subtotal int)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.check_discount(
    p_code, p_email,
    case p_region when 'UK' then 'GBP'::public.currency_code else 'GHS'::public.currency_code end,
    p_subtotal);
$$;

-- Cancelling or expiring an order frees its stock AND its discount code use.
create or replace function private.restock_order(p_order_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  v_code uuid;
begin
  for r in
    select product_id, sum(qty)::int as qty
    from public.order_items
    where order_id = p_order_id and product_id is not null
    group by product_id
    order by product_id
  loop
    update public.products set stock = stock + r.qty where id = r.product_id;
    insert into public.inventory_movements (product_id, delta, reason, order_id)
    values (r.product_id, r.qty, p_reason, p_order_id);
  end loop;

  delete from public.discount_redemptions where order_id = p_order_id returning code_id into v_code;
  if v_code is not null then
    update public.discount_codes set uses = greatest(uses - 1, 0) where id = v_code;
  end if;
end $$;

/* ---------- create_order, now with an optional discount code ---------- */

drop function public.create_order(uuid, text, public.region_code, jsonb, text, text, text, int, jsonb, jsonb, int, int);

create function public.create_order(
  p_user_id            uuid,
  p_email              text,
  p_region             public.region_code,
  p_shipping_address   jsonb,
  p_shipping_method_id text,
  p_shipping_label     text,
  p_shipping_detail    text,
  p_shipping_cost      int,
  p_payment            jsonb,
  p_items              jsonb,
  p_expected_subtotal  int,
  p_ttl_minutes        int default 30,
  p_discount_code      text default null,
  p_expected_discount  int default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_currency public.currency_code :=
    case p_region when 'UK' then 'GBP'::public.currency_code else 'GHS'::public.currency_code end;
  v_slugs    text[];
  v_item     record;
  v_product  public.products;
  v_price    int;
  v_subtotal int := 0;
  v_discount int := 0;
  v_check    jsonb;
  v_code_id  uuid;
  v_lines    jsonb := '[]'::jsonb;
  v_line     jsonb;
  v_order    public.orders;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'EMPTY_CART';
  end if;

  v_slugs := array(select distinct i ->> 'slug' from jsonb_array_elements(p_items) i);

  -- Lock every product we need in one ordered statement (avoids deadlocks).
  perform 1 from public.products p where p.slug = any (v_slugs) order by p.id for update;

  for v_item in
    select i ->> 'slug' as slug, sum((i ->> 'qty')::int)::int as qty
    from jsonb_array_elements(p_items) i
    group by 1
    order by 1
  loop
    if v_item.qty < 1 or v_item.qty > 20 then
      raise exception 'INVALID_QUANTITY' using detail = v_item.slug;
    end if;

    select * into v_product from public.products where slug = v_item.slug;
    if not found or v_product.status <> 'active' then
      raise exception 'PRODUCT_UNAVAILABLE' using detail = v_item.slug;
    end if;
    if v_product.stock < v_item.qty then
      raise exception 'OUT_OF_STOCK' using detail = v_item.slug;
    end if;

    select amount into v_price
    from public.product_prices
    where product_id = v_product.id and currency = v_currency;
    if v_price is null then
      raise exception 'NO_PRICE' using detail = v_item.slug;
    end if;

    v_subtotal := v_subtotal + v_price * v_item.qty;
    v_lines := v_lines || jsonb_build_object(
      'product_id', v_product.id, 'slug', v_product.slug, 'name', v_product.name,
      'qty', v_item.qty, 'unit_price', v_price);
  end loop;

  if v_subtotal <> p_expected_subtotal then
    raise exception 'PRICE_CHANGED' using detail = v_subtotal::text;
  end if;

  if p_discount_code is not null and trim(p_discount_code) <> '' then
    -- Lock the code so two checkouts cannot both use its last redemption.
    select id into v_code_id from public.discount_codes where code = upper(trim(p_discount_code)) for update;
    v_check := private.check_discount(p_discount_code, p_email, v_currency, v_subtotal);
    if not (v_check ->> 'valid')::boolean then
      raise exception 'DISCOUNT_INVALID' using detail = v_check ->> 'reason';
    end if;
    v_discount := (v_check ->> 'discount')::int;
  end if;

  if p_expected_discount is not null and p_expected_discount <> v_discount then
    raise exception 'PRICE_CHANGED' using detail = v_subtotal::text;
  end if;

  insert into public.orders (
    user_id, email, region, currency, shipping_address, shipping_method_id,
    shipping_label, shipping_detail, shipping_cost, subtotal, discount, discount_code, total, payment, expires_at
  ) values (
    p_user_id, lower(trim(p_email)), p_region, v_currency, p_shipping_address, p_shipping_method_id,
    p_shipping_label, coalesce(p_shipping_detail, ''), p_shipping_cost, v_subtotal, v_discount,
    case when v_discount > 0 or v_code_id is not null then upper(trim(p_discount_code)) end,
    v_subtotal - v_discount + p_shipping_cost, p_payment, now() + make_interval(mins => p_ttl_minutes)
  ) returning * into v_order;

  if v_code_id is not null then
    insert into public.discount_redemptions (code_id, order_id, email, amount)
    values (v_code_id, v_order.id, v_order.email, v_discount);
    update public.discount_codes set uses = uses + 1 where id = v_code_id;
  end if;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    insert into public.order_items (order_id, product_id, slug, name, qty, unit_price)
    values (v_order.id, (v_line ->> 'product_id')::uuid, v_line ->> 'slug', v_line ->> 'name',
            (v_line ->> 'qty')::int, (v_line ->> 'unit_price')::int);

    update public.products set stock = stock - (v_line ->> 'qty')::int
    where id = (v_line ->> 'product_id')::uuid;

    insert into public.inventory_movements (product_id, delta, reason, order_id)
    values ((v_line ->> 'product_id')::uuid, -(v_line ->> 'qty')::int, 'order', v_order.id);
  end loop;

  insert into public.order_events (order_id, status, note)
  values (v_order.id, 'pending_payment', 'Order placed');

  return jsonb_build_object(
    'id', v_order.id, 'number', v_order.number, 'token', v_order.public_token,
    'subtotal', v_order.subtotal, 'discount', v_order.discount, 'shipping_cost', v_order.shipping_cost,
    'total', v_order.total, 'currency', v_order.currency, 'expires_at', v_order.expires_at);
end $$;

/* ---------- Newsletter ---------- */

-- Adds (or re-activates) a subscriber and, the first time, issues a one-off 10% welcome code for them.
create function public.subscribe_email(p_email text, p_source text default 'website') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_sub   public.subscribers;
  v_new   boolean := false;
  v_code  text;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'INVALID_EMAIL';
  end if;

  select * into v_sub from public.subscribers where email = v_email;
  if not found then
    insert into public.subscribers (email, source) values (v_email, coalesce(nullif(trim(p_source), ''), 'website')) returning * into v_sub;
    v_new := true;
  elsif v_sub.unsubscribed_at is not null then
    update public.subscribers set unsubscribed_at = null where id = v_sub.id returning * into v_sub;
  end if;

  if v_sub.welcome_code is null then
    loop
      v_code := 'WELCOME-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
      exit when not exists (select 1 from public.discount_codes where code = v_code);
    end loop;
    insert into public.discount_codes (code, description, kind, percent, first_order_only, one_per_email, restricted_email, max_uses)
    values (v_code, 'Welcome offer: 10% off your first order', 'percent', 10, true, true, v_email, 1);
    update public.subscribers set welcome_code = v_code where id = v_sub.id returning * into v_sub;
  end if;

  return jsonb_build_object('email', v_sub.email, 'code', v_sub.welcome_code, 'isNew', v_new, 'token', v_sub.unsubscribe_token);
end $$;

create function public.unsubscribe_email(p_token uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  update public.subscribers set unsubscribed_at = coalesce(unsubscribed_at, now())
  where unsubscribe_token = p_token returning id into v_id;
  return v_id is not null;
end $$;

/* ---------- Reviews ---------- */

-- Only people who bought the product (order shipped or delivered) can review it, once.
create function public.submit_review(p_user_id uuid, p_slug text, p_rating int, p_title text, p_body text, p_name text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_product uuid;
  v_id      uuid;
begin
  select id into v_product from public.products where slug = p_slug and status = 'active';
  if v_product is null then raise exception 'PRODUCT_NOT_FOUND' using detail = p_slug; end if;

  if not exists (
    select 1 from public.order_items i join public.orders o on o.id = i.order_id
    where o.user_id = p_user_id and i.product_id = v_product and o.status in ('shipped', 'delivered')
  ) then
    raise exception 'NOT_PURCHASED' using detail = p_slug;
  end if;

  begin
    insert into public.reviews (product_id, user_id, rating, title, body, display_name)
    values (v_product, p_user_id, p_rating, coalesce(trim(p_title), ''), trim(p_body), trim(p_name))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ALREADY_REVIEWED' using detail = p_slug;
  end;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end $$;

create function public.moderate_review(p_id uuid, p_status public.review_status) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_row public.reviews;
begin
  update public.reviews set status = p_status, moderated_at = now() where id = p_id returning * into v_row;
  if not found then raise exception 'REVIEW_NOT_FOUND'; end if;
  return jsonb_build_object('id', v_row.id, 'status', v_row.status);
end $$;

/* ---------- Lock the API-only functions down to the service role ---------- */

revoke all on function public.create_order(uuid, text, public.region_code, jsonb, text, text, text, int, jsonb, jsonb, int, int, text, int) from public, anon, authenticated;
revoke all on function public.validate_discount(text, text, public.region_code, int) from public, anon, authenticated;
revoke all on function public.subscribe_email(text, text) from public, anon, authenticated;
revoke all on function public.unsubscribe_email(uuid) from public, anon, authenticated;
revoke all on function public.submit_review(uuid, text, int, text, text, text) from public, anon, authenticated;
revoke all on function public.moderate_review(uuid, public.review_status) from public, anon, authenticated;
revoke all on function private.check_discount(text, text, public.currency_code, int) from public;
revoke all on function private.refresh_product_rating(uuid) from public;
revoke all on function private.reviews_rating_trigger() from public;

grant execute on function public.create_order(uuid, text, public.region_code, jsonb, text, text, text, int, jsonb, jsonb, int, int, text, int) to service_role;
grant execute on function public.validate_discount(text, text, public.region_code, int) to service_role;
grant execute on function public.subscribe_email(text, text) to service_role;
grant execute on function public.unsubscribe_email(uuid) to service_role;
grant execute on function public.submit_review(uuid, text, int, text, text, text) to service_role;
grant execute on function public.moderate_review(uuid, public.review_status) to service_role;

-- ===================== seed.sql ====================
-- Starter catalogue. Safe to re-run: upserts by slug.
-- Stock numbers are placeholders. Ratings start at 0 (no reviews yet): the storefront shows a rating only when real reviews exist.

insert into public.categories (slug, label, position) values
  ('cleanser',    'Cleansers',    1),
  ('serum',       'Serums',       2),
  ('moisturiser', 'Moisturisers', 3),
  ('sunscreen',   'Sunscreen',    4),
  ('mask',        'Masks',        5)
on conflict (slug) do update set label = excluded.label, position = excluded.position;

with seed (slug, name, tagline, category, size_ml, skin_types, concerns, ingredients, how_to_use,
           is_new, best_seller, stock, rating_value, rating_count, gbp, ghs, was_gbp, was_ghs) as (values
  ('gentle-gel-cleanser', 'Gentle Gel Cleanser', 'Lifts dirt and SPF without stripping', 'cleanser', 150,
   array['All','Sensitive'], array['Everyday cleansing'],
   'Aqua, Glycerin, Coco-Glucoside, Aloe Barbadensis Leaf Juice, Panthenol, Allantoin',
   'Massage onto damp skin morning and evening, then rinse with lukewarm water.',
   false, true, 42, 0, 0, 1400, 18500, null::int, null::int),
  ('vitamin-c-brightening-serum', 'Vitamin C Brightening Serum', 'Visibly brighter, more even tone', 'serum', 30,
   array['Normal','Combination','Dull'], array['Dark spots','Dullness'],
   'Aqua, Ascorbyl Glucoside, Glycerin, Niacinamide, Sodium Hyaluronate, Ferulic Acid',
   'Apply 3-4 drops to clean skin in the morning, followed by moisturiser and SPF.',
   true, true, 18, 0, 0, 2800, 36000, null, null),
  ('niacinamide-clarifying-serum', 'Niacinamide Clarifying Serum', 'Balances oil and refines pores', 'serum', 30,
   array['Oily','Combination'], array['Blemishes','Excess oil','Pores'],
   'Aqua, Niacinamide, Zinc PCA, Propanediol, Panthenol, Allantoin',
   'Apply a few drops to clean skin morning or evening before moisturiser.',
   false, true, 7, 0, 0, 1800, 23500, null, null),
  ('barrier-repair-moisturiser', 'Barrier Repair Moisturiser', 'Rich, calming comfort for dry skin', 'moisturiser', 50,
   array['Dry','Sensitive'], array['Dryness','Redness'],
   'Aqua, Butyrospermum Parkii (Shea) Butter, Ceramide NP, Squalane, Glycerin, Panthenol',
   'Smooth over face and neck morning and night as the final step of your routine.',
   true, false, 25, 0, 0, 2200, 28500, null, null),
  ('light-gel-moisturiser', 'Light Gel Moisturiser', 'Weightless hydration that never feels greasy', 'moisturiser', 50,
   array['Oily','Combination','Normal'], array['Dehydration'],
   'Aqua, Sodium Hyaluronate, Glycerin, Aloe Barbadensis Leaf Juice, Squalane, Allantoin',
   'Apply to clean skin morning and evening.',
   false, false, 3, 0, 0, 1900, 24500, 2100, 27000),
  ('daily-sunscreen-spf-50', 'Daily Sunscreen SPF 50', 'Invisible on every skin tone', 'sunscreen', 50,
   array['All'], array['Sun protection','Dark spots'],
   'Aqua, Zinc Oxide, Caprylic/Capric Triglyceride, Glycerin, Tocopherol, Squalane',
   'Apply generously as the last step every morning and reapply every two hours in strong sun.',
   true, true, 56, 0, 0, 1600, 21000, null, null),
  ('overnight-hydration-mask', 'Overnight Hydration Mask', 'Wake up to plump, rested skin', 'mask', 75,
   array['Dry','Normal','Dull'], array['Dryness','Dullness'],
   'Aqua, Glycerin, Sodium Hyaluronate, Shea Butter, Squalane, Panthenol',
   'Apply a thin layer as the last step 2-3 nights a week. Rinse in the morning.',
   true, false, 12, 0, 0, 2400, 31000, null, null),
  ('clay-purifying-mask', 'Clay Purifying Mask', 'Deep clean without the tight feeling', 'mask', 75,
   array['Oily','Combination'], array['Blemishes','Pores'],
   'Aqua, Kaolin, Bentonite, Glycerin, Salicylic Acid, Allantoin',
   'Apply an even layer, leave 8-10 minutes, then rinse. Use once or twice weekly.',
   false, false, 0, 0, 0, 1700, 22000, 2000, 26000)
),
upserted as (
  insert into public.products (slug, name, tagline, category_id, size_ml, skin_types, concerns, ingredients,
                               how_to_use, image_path, is_new, best_seller, status, stock, rating_value, rating_count)
  select s.slug, s.name, s.tagline, c.id, s.size_ml, s.skin_types, s.concerns, s.ingredients, s.how_to_use,
         '/images/products/' || s.slug || '.jpg', s.is_new, s.best_seller, 'active', s.stock, s.rating_value, s.rating_count
  from seed s join public.categories c on c.slug = s.category
  on conflict (slug) do update set
    name = excluded.name, tagline = excluded.tagline, category_id = excluded.category_id, size_ml = excluded.size_ml,
    skin_types = excluded.skin_types, concerns = excluded.concerns, ingredients = excluded.ingredients,
    how_to_use = excluded.how_to_use, image_path = excluded.image_path, is_new = excluded.is_new,
    best_seller = excluded.best_seller
  returning id, slug
)
insert into public.product_prices (product_id, currency, amount, compare_at)
select u.id, p.currency, p.amount, p.compare_at
from upserted u
join seed s on s.slug = u.slug
cross join lateral (values
  ('GBP'::public.currency_code, s.gbp, s.was_gbp),
  ('GHS'::public.currency_code, s.ghs, s.was_ghs)
) as p (currency, amount, compare_at)
on conflict (product_id, currency) do update set amount = excluded.amount, compare_at = excluded.compare_at;

