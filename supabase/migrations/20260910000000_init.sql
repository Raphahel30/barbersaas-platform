begin;

create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.tenant_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.appointment_status as enum ('hold', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'expired');
create type public.payment_method as enum ('cash', 'card_machine', 'pix_tenant', 'online_gateway', 'vip', 'credit', 'complimentary');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'overdue', 'cancelled');
create type public.user_role as enum ('super_admin', 'owner', 'barber', 'receptionist', 'client');
create type public.closing_period as enum ('daily', 'weekly', 'monthly');
create type public.gateway_provider as enum ('mercado_pago', 'asaas', 'pagseguro', 'infinitepay');
create type public.subscription_status as enum ('active', 'past_due', 'suspended', 'cancelled', 'expired');
create type public.commission_status as enum ('pending', 'payable', 'paid', 'cancelled');
create type public.credit_type as enum ('reservation', 'cancellation', 'fidelity', 'birthday', 'manual');
create type public.reward_type as enum ('full_discount', 'percentage_discount', 'fixed_discount', 'free_product', 'free_service');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) >= 2),
  document text not null unique check (length(regexp_replace(document, '\D', '', 'g')) in (11, 14)),
  email text not null unique check (email = lower(email)),
  phone text not null unique check (length(regexp_replace(phone, '\D', '', 'g')) between 10 and 13),
  is_multi_branch boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  max_barbers integer not null check (max_barbers in (3, 7, 15)),
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  asaas_external_id text unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict,
  name text not null check (length(btrim(name)) >= 2),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  custom_domain text unique check (custom_domain is null or custom_domain = lower(custom_domain)),
  status public.tenant_status not null default 'trial',
  past_due_since timestamptz,
  address jsonb not null default '{}'::jsonb check (jsonb_typeof(address) = 'object'),
  active_gateway public.gateway_provider,
  gateway_credentials jsonb not null default '{}'::jsonb check (jsonb_typeof(gateway_credentials) = 'object'),
  visual_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(visual_settings) = 'object'),
  asaas_customer_id text,
  asaas_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.system_settings (
  id boolean primary key default true check (id),
  landing_content jsonb not null default '{}'::jsonb check (jsonb_typeof(landing_content) = 'object'),
  grace_period_days integer not null default 5 check (grace_period_days between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  evolution_api_enabled boolean not null default false,
  evolution_api_url text,
  evolution_api_key text,
  evolution_instance text,
  notify_barber_on_booking boolean not null default true,
  closing_buffer_minutes integer not null default 10 check (closing_buffer_minutes in (10, 20, 30, 40)),
  cancellation_notice_hours integer not null default 3 check (cancellation_notice_hours between 0 and 168),
  no_show_commission_enabled boolean not null default true,
  no_show_commission_percent numeric(5,2) not null default 100 check (no_show_commission_percent between 0 and 100),
  enable_product_commission boolean not null default false,
  credits_validity_days integer not null default 30 check (credits_validity_days between 1 and 365),
  hold_timeout_minutes integer not null default 5 check (hold_timeout_minutes between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null check (length(btrim(full_name)) >= 2),
  email text not null check (email = lower(email)),
  phone text,
  birth_date date,
  avatar_url text,
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, email),
  check ((role = 'super_admin' and tenant_id is null) or (role <> 'super_admin' and tenant_id is not null))
);

create table public.barber_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  break_starts_at time,
  break_ends_at time,
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes between 5 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (barber_id, weekday),
  check (starts_at < ends_at),
  check ((break_starts_at is null and break_ends_at is null) or (break_starts_at is not null and break_ends_at is not null and break_starts_at < break_ends_at))
);

create table public.barber_blocked_slots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (starts_at < ends_at)
);

create table public.tenant_holidays (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  holiday_date date not null,
  name text not null,
  is_closed boolean not null default true,
  opens_at time,
  closes_at time,
  created_at timestamptz not null default now(),
  unique (tenant_id, holiday_date),
  check (is_closed or (opens_at is not null and closes_at is not null and opens_at < closes_at))
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  cleanup_minutes integer not null default 0 check (cleanup_minutes between 0 and 120),
  price numeric(12,2) not null check (price >= 0),
  reservation_fee numeric(12,2) not null default 0 check (reservation_fee >= 0 and reservation_fee <= price),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  sku text,
  description text,
  price numeric(12,2) not null check (price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  commission_percent numeric(5,2) not null default 0 check (commission_percent between 0 and 100),
  commission_fixed numeric(12,2) not null default 0 check (commission_fixed >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table public.vip_plans (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  included_services jsonb not null default '[]'::jsonb check (jsonb_typeof(included_services) = 'array'),
  allow_fidelity_stamps boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete restrict,
  client_id uuid references public.profiles(id) on delete set null,
  status public.appointment_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  hold_expires_at timestamptz,
  is_walk_in boolean not null default false,
  is_quick_sale boolean not null default false,
  guest_name text,
  guest_phone text,
  notes text,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  reservation_fee numeric(12,2) not null default 0 check (reservation_fee >= 0),
  reservation_fee_paid numeric(12,2) not null default 0 check (reservation_fee_paid >= 0),
  balance_due numeric(12,2) generated always as (greatest(total_amount - reservation_fee_paid, 0)) stored,
  payment_method public.payment_method,
  payment_status public.payment_status not null default 'pending',
  gateway_payment_id text,
  cancelled_at timestamptz,
  cancellation_reason text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  check (reservation_fee <= total_amount),
  check (reservation_fee_paid <= total_amount),
  check ((status = 'hold' and hold_expires_at is not null) or status <> 'hold'),
  check (client_id is not null or (guest_name is not null and guest_phone is not null))
);

create table public.appointment_services (
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  primary key (appointment_id, service_id)
);

create table public.client_credits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  type public.credit_type not null,
  amount numeric(12,2) not null check (amount > 0),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  created_at timestamptz not null default now(),
  check (used_at is null or used_at <= expires_at)
);

create table public.fidelity_cards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  stamps integer not null default 0 check (stamps >= 0),
  target_stamps integer not null default 10 check (target_stamps > 0),
  reward_type public.reward_type not null default 'full_discount',
  reward_value numeric(12,2),
  reward_reference_id uuid,
  expires_at timestamptz not null default (now() + interval '30 days'),
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_id)
);

create table public.client_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  vip_plan_id uuid not null references public.vip_plans(id) on delete restrict,
  status public.subscription_status not null default 'active',
  payment_method public.payment_method not null,
  gateway_subscription_id text,
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  past_due_since timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (current_period_start < current_period_end)
);

create table public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete restrict,
  period public.closing_period not null,
  period_start date not null,
  period_end date not null,
  gross_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  cash_in_hand numeric(12,2) not null default 0,
  net_transfer_amount numeric(12,2) generated always as (commission_amount - cash_in_hand) stored,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (tenant_id, barber_id, period, period_start, period_end),
  check (period_start <= period_end)
);

create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid not null references public.profiles(id) on delete restrict,
  appointment_id uuid references public.appointments(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  cash_closing_id uuid references public.cash_closings(id) on delete set null,
  base_amount numeric(12,2) not null check (base_amount >= 0),
  rate_percent numeric(5,2) not null default 0 check (rate_percent between 0 and 100),
  fixed_amount numeric(12,2) not null default 0 check (fixed_amount >= 0),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  status public.commission_status not null default 'pending',
  is_no_show boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  check (appointment_id is not null or product_id is not null)
);

create table public.gallery_photos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  barber_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  storage_path text not null,
  caption text,
  is_public boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, storage_path)
);

create index tenants_organization_id_idx on public.tenants (organization_id);
create index profiles_tenant_role_idx on public.profiles (tenant_id, role);
create index barber_schedules_tenant_barber_idx on public.barber_schedules (tenant_id, barber_id);
create index barber_blocked_slots_lookup_idx on public.barber_blocked_slots (tenant_id, barber_id, starts_at, ends_at);
create index appointments_calendar_idx on public.appointments (tenant_id, barber_id, starts_at, ends_at);
create index appointments_client_idx on public.appointments (client_id, starts_at desc);
create index appointments_hold_expiry_idx on public.appointments (hold_expires_at) where status = 'hold';
create index client_credits_available_idx on public.client_credits (tenant_id, client_id, expires_at) where used_at is null;
create index subscriptions_client_idx on public.client_subscriptions (tenant_id, client_id, status);
create index commissions_barber_status_idx on public.commissions (tenant_id, barber_id, status);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','plans','tenants','system_settings','tenant_settings','profiles','barber_schedules','services','products','vip_plans','appointments','fidelity_cards','client_subscriptions']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name);
  end loop;
end $$;

create or replace function auth.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((auth.jwt() ->> 'email') = 'rafaelcassu@gmail.com', false)
$$;

create or replace function auth.current_tenant_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.tenant_id from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function auth.current_user_role()
returns public.user_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid())
$$;

create or replace function auth.current_organization_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select t.organization_id
  from public.profiles p join public.tenants t on t.id = p.tenant_id
  where p.id = (select auth.uid())
$$;

create or replace function auth.barber_belongs_to_tenant(target_barber uuid, target_tenant uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_barber and p.tenant_id = target_tenant
      and p.role = 'barber' and p.is_active
  )
$$;

revoke all on function auth.is_super_admin() from public;
revoke all on function auth.current_tenant_id() from public;
revoke all on function auth.current_user_role() from public;
revoke all on function auth.current_organization_id() from public;
revoke all on function auth.barber_belongs_to_tenant(uuid, uuid) from public;
grant execute on function auth.is_super_admin() to anon, authenticated;
grant execute on function auth.current_tenant_id() to authenticated;
grant execute on function auth.current_user_role() to authenticated;
grant execute on function auth.current_organization_id() to authenticated;
grant execute on function auth.barber_belongs_to_tenant(uuid, uuid) to anon, authenticated;

create or replace function public.protect_profile_authorization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.is_super_admin() then return new; end if;
  if (select auth.uid()) = old.id and (new.role <> old.role or new.tenant_id is distinct from old.tenant_id) then
    raise exception 'Users cannot change their own role or tenant' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.protect_profile_authorization() from public;
create trigger protect_profile_authorization before update on public.profiles
for each row execute function public.protect_profile_authorization();

create or replace function public.validate_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not auth.barber_belongs_to_tenant(new.barber_id, new.tenant_id) then
    raise exception 'Barber does not belong to tenant' using errcode = '23514';
  end if;
  if new.status = 'hold' and new.hold_expires_at <= now() then
    raise exception 'Hold expiration must be in the future' using errcode = '23514';
  end if;
  if new.status = 'hold' and new.hold_expires_at > now() + make_interval(mins => coalesce(
    (select ts.hold_timeout_minutes from public.tenant_settings ts where ts.tenant_id = new.tenant_id), 5
  )) then
    raise exception 'Hold expiration exceeds the tenant timeout' using errcode = '23514';
  end if;
  if not new.is_walk_in and not new.is_quick_sale and new.status in ('hold','pending','confirmed') then
    perform pg_advisory_xact_lock(hashtextextended(new.barber_id::text, 0));
    if exists (
      select 1 from public.appointments a
      where a.barber_id = new.barber_id and a.id <> new.id
        and a.status in ('hold','pending','confirmed')
        and (a.status <> 'hold' or a.hold_expires_at > now())
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'Appointment overlaps an active booking' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_appointment() from public;
create trigger validate_appointment before insert or update of tenant_id, barber_id, starts_at, ends_at, status, hold_expires_at
on public.appointments for each row execute function public.validate_appointment();

create or replace function public.enforce_plan_barber_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare allowed_barbers integer;
declare current_barbers integer;
begin
  if new.role <> 'barber' or not new.is_active then return new; end if;
  select p.max_barbers into allowed_barbers
  from public.tenants t join public.plans p on p.id = t.plan_id
  where t.id = new.tenant_id and p.is_active;
  if allowed_barbers is null then
    raise exception 'Tenant must have an active plan before adding barbers' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text || ':barbers', 0));
  select count(*) into current_barbers from public.profiles p
  where p.tenant_id = new.tenant_id and p.role = 'barber' and p.is_active and p.id <> new.id;
  if current_barbers >= allowed_barbers then
    raise exception 'Active barber limit reached for tenant plan' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_plan_barber_limit() from public;
create trigger enforce_plan_barber_limit before insert or update of tenant_id, role, is_active
on public.profiles for each row execute function public.enforce_plan_barber_limit();

do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','plans','tenants','system_settings','tenant_settings','profiles','barber_schedules','barber_blocked_slots','tenant_holidays','services','products','vip_plans','appointments','appointment_services','client_credits','fidelity_cards','client_subscriptions','cash_closings','commissions','gallery_photos']
  loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.plans, public.system_settings, public.barber_schedules, public.barber_blocked_slots, public.tenant_holidays, public.services to anon, authenticated;
grant insert on public.appointments to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['organizations','plans','tenants','system_settings','tenant_settings','profiles','barber_schedules','barber_blocked_slots','tenant_holidays','services','products','vip_plans','appointments','appointment_services','client_credits','fidelity_cards','client_subscriptions','cash_closings','commissions','gallery_photos']
  loop
    execute format('create policy "super admin full access" on public.%I for all to authenticated using ((select auth.is_super_admin())) with check ((select auth.is_super_admin()))', table_name);
  end loop;
end $$;

create policy "public reads active plans" on public.plans for select to anon, authenticated using (is_active);
create policy "public reads landing settings" on public.system_settings for select to anon, authenticated using (true);
create policy "owner manages organization" on public.organizations for all to authenticated
using (id = (select auth.current_organization_id()) and (select auth.current_user_role()) = 'owner')
with check (id = (select auth.current_organization_id()) and (select auth.current_user_role()) = 'owner');
create policy "owner manages tenants in organization" on public.tenants for all to authenticated
using (organization_id = (select auth.current_organization_id()) and (select auth.current_user_role()) = 'owner')
with check (organization_id = (select auth.current_organization_id()) and (select auth.current_user_role()) = 'owner');

do $$
declare table_name text;
begin
  foreach table_name in array array['tenant_settings','profiles','barber_schedules','barber_blocked_slots','tenant_holidays','services','products','vip_plans','appointments','client_credits','fidelity_cards','client_subscriptions','cash_closings','commissions','gallery_photos']
  loop
    execute format('create policy "owner tenant access" on public.%I for all to authenticated using (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = ''owner'') with check (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = ''owner'')', table_name);
  end loop;
end $$;

create policy "owner appointment services access" on public.appointment_services for all to authenticated
using (exists (select 1 from public.appointments a where a.id = appointment_id and a.tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'owner'))
with check (exists (select 1 from public.appointments a where a.id = appointment_id and a.tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'owner'));

create policy "user reads own profile" on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "user updates own profile" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "barber reads own schedule" on public.barber_schedules for select to authenticated using (barber_id = (select auth.uid()));
create policy "barber manages own schedule" on public.barber_schedules for all to authenticated
using (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber')
with check (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber');
create policy "barber manages own blocked slots" on public.barber_blocked_slots for all to authenticated
using (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber')
with check (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber');
create policy "barber reads tenant holidays" on public.tenant_holidays for select to authenticated using (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber');
create policy "barber reads tenant services" on public.services for select to authenticated using (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber');
create policy "barber reads tenant products" on public.products for select to authenticated using (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber');
create policy "barber manages own appointments" on public.appointments for all to authenticated
using (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber')
with check (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'barber');
create policy "barber reads own appointment services" on public.appointment_services for select to authenticated
using (exists (select 1 from public.appointments a where a.id = appointment_id and a.barber_id = (select auth.uid())));
create policy "barber reads own cash closings" on public.cash_closings for select to authenticated using (barber_id = (select auth.uid()));
create policy "barber reads own commissions" on public.commissions for select to authenticated using (barber_id = (select auth.uid()));
create policy "barber manages own gallery" on public.gallery_photos for all to authenticated
using (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()))
with check (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()));

create policy "public reads active schedules" on public.barber_schedules for select to anon, authenticated using (is_active);
create policy "public reads blocked time ranges" on public.barber_blocked_slots for select to anon, authenticated using (ends_at > now());
create policy "public reads holidays" on public.tenant_holidays for select to anon, authenticated using (holiday_date >= current_date);
create policy "public reads active services" on public.services for select to anon, authenticated using (is_active);
create policy "visitor creates booking or hold" on public.appointments for insert to anon
with check (
  status in ('hold','pending') and client_id is null and not is_walk_in and not is_quick_sale
  and payment_status = 'pending' and (select auth.barber_belongs_to_tenant(barber_id, tenant_id))
);

create policy "client reads own appointments" on public.appointments for select to authenticated using (client_id = (select auth.uid()));
create policy "client creates own booking or hold" on public.appointments for insert to authenticated
with check (
  client_id = (select auth.uid()) and status in ('hold','pending') and not is_walk_in and not is_quick_sale
  and payment_status = 'pending' and (select auth.barber_belongs_to_tenant(barber_id, tenant_id))
);
create policy "client reads own appointment services" on public.appointment_services for select to authenticated
using (exists (select 1 from public.appointments a where a.id = appointment_id and a.client_id = (select auth.uid())));
create policy "client reads own credits" on public.client_credits for select to authenticated using (client_id = (select auth.uid()));
create policy "client reads own fidelity" on public.fidelity_cards for select to authenticated using (client_id = (select auth.uid()));
create policy "client reads own subscriptions" on public.client_subscriptions for select to authenticated using (client_id = (select auth.uid()));
create policy "public reads gallery" on public.gallery_photos for select to anon, authenticated using (is_public);

insert into public.system_settings (id) values (true) on conflict (id) do nothing;

commit;
