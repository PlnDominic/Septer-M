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
