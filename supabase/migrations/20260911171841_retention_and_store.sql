create type public.birthday_mode as enum ('exact_day', 'birth_month');
create type public.vip_payment_mode as enum ('recurrent_card', 'manual_pix');
create type public.vip_frequency as enum ('weekly', 'biweekly', 'unlimited');
create type public.retention_reward_source as enum ('fidelity', 'birthday');
create type public.retention_reward_status as enum ('available', 'redeemed', 'expired', 'cancelled');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='fidelity_cards' AND column_name='stamps') THEN
    ALTER TABLE public.fidelity_cards RENAME COLUMN stamps TO stamps_count;
  END IF;
END $$;

alter table public.tenant_settings
  add column if not exists allow_vip_members boolean not null default false,
  add column if not exists fidelity_rules jsonb not null default '{"target_stamps":10,"reward_type":"full_discount","reward_value":null,"reward_reference_id":null}'::jsonb,
  add column if not exists birthday_rules jsonb not null default '{"enabled":false,"mode":"exact_day","reward_type":"percentage_discount","reward_value":10,"reward_reference_id":null}'::jsonb,
  add column if not exists vip_payment_mode public.vip_payment_mode not null default 'manual_pix';

alter table public.vip_plans
  add column if not exists frequency public.vip_frequency not null default 'unlimited',
  add column if not exists usage_interval_days integer,
  add column if not exists barber_id uuid references public.profiles(id) on delete set null;

alter table public.client_subscriptions
  add column if not exists gateway_payment_id text,
  add column if not exists next_payment_due date;

alter table public.client_credits
  add column if not exists invalidated_at timestamptz;

create table if not exists public.fidelity_stamp_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  fidelity_card_id uuid not null references public.fidelity_cards(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (appointment_id)
);

create table if not exists public.retention_rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  source public.retention_reward_source not null,
  reward_type public.reward_type not null,
  reward_value numeric(12,2),
  reward_reference_id uuid,
  status public.retention_reward_status not null default 'available',
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  check (reward_value is null or reward_value >= 0),
  check ((status = 'redeemed' and redeemed_at is not null) or status <> 'redeemed')
);

create table if not exists public.birthday_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  benefit_year integer not null check (benefit_year between 2000 and 2200),
  reward_id uuid not null unique references public.retention_rewards(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (tenant_id, client_id, benefit_year)
);

create table if not exists public.counter_sales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete restrict,
  payment_method public.payment_method not null check (payment_method in ('cash', 'card_machine', 'pix_tenant')),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  cash_received_by_barber numeric(12,2) not null default 0 check (cash_received_by_barber >= 0),
  sold_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.product_sales add column if not exists counter_sale_id uuid references public.counter_sales(id) on delete cascade;

create index if not exists fidelity_stamp_events_client_idx on public.fidelity_stamp_events (tenant_id, client_id, awarded_at desc);
create index if not exists retention_rewards_available_idx on public.retention_rewards (tenant_id, client_id, status, expires_at);
create index if not exists birthday_redemptions_lookup_idx on public.birthday_redemptions (tenant_id, client_id, benefit_year);
create index if not exists counter_sales_closing_idx on public.counter_sales (tenant_id, barber_id, sold_at);

create or replace function public.award_fidelity_stamp_internal(
  requested_tenant_id uuid,
  requested_client_id uuid,
  requested_appointment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  appointment_row public.appointments;
  settings_row public.tenant_settings;
  card_row public.fidelity_cards;
  rules jsonb;
  vip_active boolean;
  target_value integer;
  configured_reward public.reward_type;
begin
  select * into appointment_row from public.appointments
  where id = requested_appointment_id for update;
  if not found or appointment_row.tenant_id <> requested_tenant_id
    or appointment_row.client_id is distinct from requested_client_id
    or appointment_row.status <> 'completed' then
    raise exception 'completed appointment does not match tenant and client';
  end if;

  if exists (select 1 from public.fidelity_stamp_events where appointment_id = requested_appointment_id) then
    select fc.* into card_row from public.fidelity_cards fc
    join public.fidelity_stamp_events fe on fe.fidelity_card_id = fc.id
    where fe.appointment_id = requested_appointment_id;
    return jsonb_build_object('awarded', false, 'reason', 'already_awarded', 'card_id', card_row.id, 'stamps_count', card_row.stamps_count, 'expires_at', card_row.expires_at);
  end if;

  select * into settings_row from public.tenant_settings where tenant_id = requested_tenant_id;
  if not found then raise exception 'tenant settings not found'; end if;

  select exists (
    select 1 from public.client_subscriptions cs
    where cs.tenant_id = requested_tenant_id and cs.client_id = requested_client_id
      and cs.status = 'active' and cs.current_period_start <= now() and cs.current_period_end > now()
  ) into vip_active;
  if vip_active and not settings_row.allow_vip_members then
    return jsonb_build_object('awarded', false, 'reason', 'vip_not_eligible');
  end if;

  rules := settings_row.fidelity_rules;
  target_value := greatest(1, least(100, coalesce((rules->>'target_stamps')::integer, 10)));
  configured_reward := coalesce((rules->>'reward_type')::public.reward_type, 'full_discount');

  insert into public.fidelity_cards (tenant_id, client_id, stamps_count, target_stamps, reward_type, reward_value, reward_reference_id, expires_at, redeemed_at)
  values (
    requested_tenant_id, requested_client_id, 1, target_value, configured_reward,
    nullif(rules->>'reward_value', '')::numeric,
    nullif(rules->>'reward_reference_id', '')::uuid,
    now() + interval '30 days', null
  )
  on conflict (tenant_id, client_id) do update set
    stamps_count = case when public.fidelity_cards.expires_at <= now() then 1 else public.fidelity_cards.stamps_count + 1 end,
    target_stamps = target_value,
    reward_type = configured_reward,
    reward_value = nullif(rules->>'reward_value', '')::numeric,
    reward_reference_id = nullif(rules->>'reward_reference_id', '')::uuid,
    expires_at = now() + interval '30 days',
    redeemed_at = null,
    updated_at = now()
  returning * into card_row;

  insert into public.fidelity_stamp_events (tenant_id, client_id, appointment_id, fidelity_card_id)
  values (requested_tenant_id, requested_client_id, requested_appointment_id, card_row.id);
  return jsonb_build_object('awarded', true, 'reason', 'awarded', 'card_id', card_row.id, 'stamps_count', card_row.stamps_count, 'target_stamps', card_row.target_stamps, 'expires_at', card_row.expires_at);
end;
$$;

revoke all on function public.award_fidelity_stamp_internal(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.award_fidelity_stamp_internal(uuid, uuid, uuid) to service_role;

alter table public.fidelity_stamp_events enable row level security;
alter table public.retention_rewards enable row level security;
alter table public.birthday_redemptions enable row level security;
alter table public.counter_sales enable row level security;

revoke all on public.fidelity_stamp_events, public.retention_rewards, public.birthday_redemptions, public.counter_sales from anon, authenticated;
grant select on public.fidelity_stamp_events, public.retention_rewards, public.birthday_redemptions, public.counter_sales to authenticated;

do $$ declare table_name text;
begin
  foreach table_name in array array['fidelity_stamp_events','retention_rewards','birthday_redemptions','counter_sales'] loop
    execute format('drop policy if exists "super admin full access" on public.%I', table_name);
    execute format('create policy "super admin full access" on public.%I for all to authenticated using ((select public.is_super_admin())) with check ((select public.is_super_admin()))', table_name);
    execute format('drop policy if exists "owner tenant access" on public.%I', table_name);
    execute format('create policy "owner tenant access" on public.%I for all to authenticated using (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = ''owner'') with check (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = ''owner'')', table_name);
  end loop;
end $$;

drop policy if exists "client reads own fidelity events" on public.fidelity_stamp_events;
create policy "client reads own fidelity events" on public.fidelity_stamp_events for select to authenticated using (client_id = (select auth.uid()));

drop policy if exists "client reads own rewards" on public.retention_rewards;
create policy "client reads own rewards" on public.retention_rewards for select to authenticated using (client_id = (select auth.uid()));

drop policy if exists "client reads own birthday claims" on public.birthday_redemptions;
create policy "client reads own birthday claims" on public.birthday_redemptions for select to authenticated using (client_id = (select auth.uid()));

drop policy if exists "barber reads own counter sales" on public.counter_sales;
create policy "barber reads own counter sales" on public.counter_sales for select to authenticated using (barber_id = (select auth.uid()) and tenant_id = (select public.current_tenant_id()));
