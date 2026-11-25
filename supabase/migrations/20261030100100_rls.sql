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
