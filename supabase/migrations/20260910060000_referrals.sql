begin;

-- 1. Programa B2B: Barbeiro Indica Barbeiro
create table public.tenant_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_tenant_id uuid not null references public.tenants(id) on delete cascade,
  referred_tenant_id uuid references public.tenants(id) on delete set null,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending', 'converted', 'rewarded')),
  reward_amount numeric(12,2) not null default 30.00,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. Programa B2C: Cliente Indica Amigo
create table public.client_referrals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  referrer_client_id uuid not null references public.profiles(id) on delete cascade,
  referred_client_id uuid references public.profiles(id) on delete set null,
  referred_phone text,
  status text not null default 'pending' check (status in ('pending', 'completed', 'rewarded')),
  reward_type text not null default 'fidelity_stamp' check (reward_type in ('fidelity_stamp', 'credit_discount')),
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);

create index tenant_referrals_referrer_idx on public.tenant_referrals(referrer_tenant_id);
create index tenant_referrals_referred_idx on public.tenant_referrals(referred_tenant_id);
create index client_referrals_tenant_idx on public.client_referrals(tenant_id, referrer_client_id);

alter table public.tenant_referrals enable row level security;
alter table public.client_referrals enable row level security;

revoke all on public.tenant_referrals, public.client_referrals from anon, authenticated;
grant select on public.tenant_referrals, public.client_referrals to authenticated;
grant insert, update on public.tenant_referrals, public.client_referrals to authenticated;

-- Super admin visualiza todas as indicações
create policy "super admin full access to tenant_referrals" on public.tenant_referrals for all to authenticated
using ((select auth.is_super_admin()));

create policy "super admin full access to client_referrals" on public.client_referrals for all to authenticated
using ((select auth.is_super_admin()));

-- Owner visualiza e gerencia indicações do seu tenant
create policy "owner manages tenant_referrals" on public.tenant_referrals for all to authenticated
using (referrer_tenant_id = (select auth.current_tenant_id()) or referred_tenant_id = (select auth.current_tenant_id()));

create policy "owner manages client_referrals" on public.client_referrals for all to authenticated
using (tenant_id = (select auth.current_tenant_id()));

-- Cliente visualiza suas próprias indicações feitas
create policy "client reads own referrals" on public.client_referrals for select to authenticated
using (referrer_client_id = (select auth.uid()));

commit;
