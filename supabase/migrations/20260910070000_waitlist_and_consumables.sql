-- Migration: Waitlist, Service Consumables and Arrived Appointment Status
-- Phase 16

-- Add 'arrived' to appointment_status if not present
alter type public.appointment_status add value if not exists 'arrived';

-- Waitlist table
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  guest_name text,
  guest_phone text,
  barber_id uuid references public.profiles(id) on delete set null,
  requested_date date not null,
  preferred_shift text not null default 'any' check (preferred_shift in ('morning', 'afternoon', 'night', 'any')),
  service_ids uuid[] not null default '{}',
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'claimed', 'expired')),
  claim_token text unique,
  notified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_tenant_date_idx on public.waitlist (tenant_id, requested_date, status);
create index if not exists waitlist_claim_token_idx on public.waitlist (claim_token);

-- Service Consumables (Ficha técnica de insumos por serviço)
create table if not exists public.service_consumables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity_consumed numeric(10, 4) not null default 1,
  created_at timestamptz not null default now(),
  constraint service_consumables_uniq unique (tenant_id, service_id, product_id)
);

create index if not exists service_consumables_service_idx on public.service_consumables (service_id);

-- Alter products for min stock threshold and unit
alter table public.products 
  add column if not exists min_stock_threshold numeric(10, 2) not null default 5,
  add column if not exists unit text default 'un';

-- RLS policies for waitlist
alter table public.waitlist enable row level security;

create policy "waitlist public insert" on public.waitlist 
  for insert to anon, authenticated 
  with check (true);

create policy "waitlist client view own" on public.waitlist 
  for select to authenticated 
  using (client_id = auth.uid());

create policy "waitlist tenant staff manage" on public.waitlist 
  for all to authenticated 
  using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid() and role in ('owner', 'receptionist', 'barber')
    )
  );

-- RLS policies for service_consumables
alter table public.service_consumables enable row level security;

create policy "service_consumables tenant staff manage" on public.service_consumables 
  for all to authenticated 
  using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid() and role in ('owner', 'receptionist')
    )
  );

create policy "service_consumables staff read" on public.service_consumables 
  for select to authenticated 
  using (
    tenant_id in (
      select tenant_id from public.profiles where id = auth.uid()
    )
  );
