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
