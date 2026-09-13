create type public.oauth_state_status as enum ('pending', 'consumed', 'expired');
create type public.webhook_status as enum ('processing', 'processed', 'ignored', 'failed');

create table if not exists public.gateway_oauth_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider public.gateway_provider not null,
  state_hash text not null unique,
  code_verifier_encrypted jsonb,
  redirect_uri text not null,
  status public.oauth_state_status not null default 'pending',
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.gateway_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider public.gateway_provider not null,
  external_event_id text not null,
  appointment_id uuid references public.appointments(id) on delete set null,
  status public.webhook_status not null default 'processing',
  payload_hash text not null,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create table if not exists public.product_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  total_amount numeric(12,2) generated always as (quantity * unit_price) stored,
  payment_method public.payment_method not null,
  sold_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.appointments
  add column if not exists balance_paid_amount numeric(12,2) not null default 0 check (balance_paid_amount >= 0),
  add column if not exists cash_received_by_barber numeric(12,2) not null default 0 check (cash_received_by_barber >= 0),
  add column if not exists settled_at timestamptz;

alter table public.cash_closings
  add column if not exists services_gross_amount numeric(12,2) not null default 0,
  add column if not exists products_gross_amount numeric(12,2) not null default 0;

create index if not exists gateway_oauth_states_lookup_idx on public.gateway_oauth_states (state_hash, status, expires_at);
create index if not exists product_sales_closing_idx on public.product_sales (tenant_id, barber_id, sold_at);
create unique index if not exists commissions_service_once_idx on public.commissions (appointment_id) where product_id is null;
create unique index if not exists commissions_product_once_idx on public.commissions (appointment_id, product_id) where product_id is not null;

do $$
declare table_name text;
begin
  foreach table_name in array array['gateway_oauth_states','gateway_webhook_events','product_sales'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

revoke all on public.gateway_oauth_states, public.gateway_webhook_events, public.product_sales from anon, authenticated;
grant select, insert, update, delete on public.gateway_oauth_states, public.product_sales to authenticated;

drop policy if exists "super admin full access" on public.gateway_oauth_states;
create policy "super admin full access" on public.gateway_oauth_states for all to authenticated
using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists "owner manages gateway states" on public.gateway_oauth_states;
create policy "owner manages gateway states" on public.gateway_oauth_states for all to authenticated
using (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner')
with check (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner');

drop policy if exists "super admin full access" on public.gateway_webhook_events;
create policy "super admin full access" on public.gateway_webhook_events for all to authenticated
using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists "super admin full access" on public.product_sales;
create policy "super admin full access" on public.product_sales for all to authenticated
using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists "owner tenant access" on public.product_sales;
create policy "owner tenant access" on public.product_sales for all to authenticated
using (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner')
with check (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner');

drop policy if exists "barber reads own product sales" on public.product_sales;
create policy "barber reads own product sales" on public.product_sales for select to authenticated
using (barber_id = (select auth.uid()) and tenant_id = (select public.current_tenant_id()));

drop policy if exists "barber creates own product sales" on public.product_sales;
create policy "barber creates own product sales" on public.product_sales for insert to authenticated
with check (barber_id = (select auth.uid()) and tenant_id = (select public.current_tenant_id()));
