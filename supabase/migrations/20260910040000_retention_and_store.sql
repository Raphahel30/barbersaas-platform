alter type public.subscription_status add value if not exists 'overdue' after 'past_due';

begin;

create type public.birthday_mode as enum ('exact_day', 'birth_month');
create type public.vip_payment_mode as enum ('recurrent_card', 'manual_pix');
create type public.vip_frequency as enum ('weekly', 'biweekly', 'unlimited');
create type public.retention_reward_source as enum ('fidelity', 'birthday');
create type public.retention_reward_status as enum ('available', 'redeemed', 'expired', 'cancelled');

alter table public.fidelity_cards rename column stamps to stamps_count;

alter table public.tenant_settings
  add column allow_vip_members boolean not null default false,
  add column fidelity_rules jsonb not null default '{"target_stamps":10,"reward_type":"full_discount","reward_value":null,"reward_reference_id":null}'::jsonb,
  add column birthday_rules jsonb not null default '{"enabled":false,"mode":"exact_day","reward_type":"percentage_discount","reward_value":10,"reward_reference_id":null}'::jsonb,
  add column vip_payment_mode public.vip_payment_mode not null default 'manual_pix',
  add constraint tenant_settings_fidelity_rules_object check (jsonb_typeof(fidelity_rules) = 'object'),
  add constraint tenant_settings_birthday_rules_object check (jsonb_typeof(birthday_rules) = 'object');

alter table public.vip_plans
  add column frequency public.vip_frequency not null default 'unlimited',
  add column usage_interval_days integer,
  add column barber_id uuid references public.profiles(id) on delete set null,
  add constraint vip_plans_usage_interval check (
    (frequency = 'weekly' and usage_interval_days = 7) or
    (frequency = 'biweekly' and usage_interval_days = 15) or
    (frequency = 'unlimited' and usage_interval_days is null)
  );

alter table public.client_subscriptions
  add column gateway_payment_id text,
  add column next_payment_due date;

alter table public.client_credits
  add column invalidated_at timestamptz,
  add constraint client_credits_not_used_and_invalidated check (used_at is null or invalidated_at is null);

create table public.fidelity_stamp_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  fidelity_card_id uuid not null references public.fidelity_cards(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  unique (appointment_id)
);

create table public.retention_rewards (
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

create table public.birthday_redemptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_id uuid not null references public.profiles(id) on delete cascade,
  benefit_year integer not null check (benefit_year between 2000 and 2200),
  reward_id uuid not null unique references public.retention_rewards(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (tenant_id, client_id, benefit_year)
);

create table public.counter_sales (
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

alter table public.product_sales add column counter_sale_id uuid references public.counter_sales(id) on delete cascade;

create index fidelity_stamp_events_client_idx on public.fidelity_stamp_events (tenant_id, client_id, awarded_at desc);
create index retention_rewards_available_idx on public.retention_rewards (tenant_id, client_id, status, expires_at);
create index birthday_redemptions_lookup_idx on public.birthday_redemptions (tenant_id, client_id, benefit_year);
create index counter_sales_closing_idx on public.counter_sales (tenant_id, barber_id, sold_at);
create unique index commissions_counter_product_once_idx on public.commissions (product_id, cash_closing_id, created_at)
  where appointment_id is null and product_id is not null;

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

create or replace function public.redeem_fidelity_reward_internal(requested_tenant_id uuid, requested_client_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare card_row public.fidelity_cards; reward_row public.retention_rewards;
begin
  select * into card_row from public.fidelity_cards
  where tenant_id = requested_tenant_id and client_id = requested_client_id for update;
  if not found then raise exception 'fidelity card not found'; end if;
  if card_row.expires_at <= now() then raise exception 'fidelity stamps expired'; end if;
  if card_row.stamps_count < card_row.target_stamps then raise exception 'insufficient fidelity stamps'; end if;
  if card_row.reward_type = 'free_product' then
    perform 1 from public.products where id = card_row.reward_reference_id and tenant_id = requested_tenant_id and is_active and stock_quantity > 0 for update;
    if not found then raise exception 'reward product unavailable'; end if;
    update public.products set stock_quantity = stock_quantity - 1 where id = card_row.reward_reference_id;
  elsif card_row.reward_type = 'free_service' then
    perform 1 from public.services where id = card_row.reward_reference_id and tenant_id = requested_tenant_id and is_active;
    if not found then raise exception 'reward service unavailable'; end if;
  end if;
  insert into public.retention_rewards (tenant_id, client_id, source, reward_type, reward_value, reward_reference_id, expires_at)
  values (requested_tenant_id, requested_client_id, 'fidelity', card_row.reward_type, card_row.reward_value, card_row.reward_reference_id, now() + interval '30 days')
  returning * into reward_row;
  update public.fidelity_cards set stamps_count = stamps_count - target_stamps, redeemed_at = now(), updated_at = now()
  where id = card_row.id;
  return jsonb_build_object('reward_id', reward_row.id, 'reward_type', reward_row.reward_type, 'reward_value', reward_row.reward_value, 'reward_reference_id', reward_row.reward_reference_id, 'expires_at', reward_row.expires_at, 'remaining_stamps', card_row.stamps_count - card_row.target_stamps);
end;
$$;

create or replace function public.register_counter_sale_internal(
  requested_tenant_id uuid,
  requested_barber_id uuid,
  requested_created_by uuid,
  requested_items jsonb,
  requested_payment_method public.payment_method
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb; product_row public.products; settings_row public.tenant_settings;
  sale_id uuid; total_cents bigint := 0; line_cents bigint; commission_cents bigint; total_commission_cents bigint := 0;
  quantity_value integer; product_id_value uuid;
begin
  if requested_payment_method not in ('cash', 'card_machine', 'pix_tenant') then raise exception 'invalid counter payment method'; end if;
  if jsonb_typeof(requested_items) <> 'array' or jsonb_array_length(requested_items) = 0 then raise exception 'counter sale requires items'; end if;
  if exists (select 1 from jsonb_array_elements(requested_items) x group by x->>'product_id' having count(*) > 1) then raise exception 'duplicate products are not allowed'; end if;
  perform 1 from public.profiles where id = requested_barber_id and tenant_id = requested_tenant_id and role = 'barber' and is_active;
  if not found then raise exception 'invalid barber'; end if;
  select * into settings_row from public.tenant_settings where tenant_id = requested_tenant_id;

  for item in select value from jsonb_array_elements(requested_items) loop
    product_id_value := (item->>'product_id')::uuid;
    quantity_value := (item->>'quantity')::integer;
    if quantity_value <= 0 then raise exception 'quantity must be positive'; end if;
    select * into product_row from public.products where id = product_id_value and tenant_id = requested_tenant_id and is_active for update;
    if not found then raise exception 'product unavailable: %', product_id_value; end if;
    if product_row.stock_quantity < quantity_value then raise exception 'insufficient stock for product: %', product_row.name; end if;
    total_cents := total_cents + round(product_row.price * 100)::bigint * quantity_value;
  end loop;

  insert into public.counter_sales (tenant_id, barber_id, payment_method, total_amount, cash_received_by_barber, created_by)
  values (requested_tenant_id, requested_barber_id, requested_payment_method, total_cents / 100.0, case when requested_payment_method = 'cash' then total_cents / 100.0 else 0 end, requested_created_by)
  returning id into sale_id;

  for item in select value from jsonb_array_elements(requested_items) loop
    product_id_value := (item->>'product_id')::uuid; quantity_value := (item->>'quantity')::integer;
    select * into product_row from public.products where id = product_id_value for update;
    line_cents := round(product_row.price * 100)::bigint * quantity_value;
    update public.products set stock_quantity = stock_quantity - quantity_value, updated_at = now() where id = product_id_value;
    insert into public.product_sales (tenant_id, barber_id, product_id, counter_sale_id, quantity, unit_price, payment_method)
    values (requested_tenant_id, requested_barber_id, product_id_value, sale_id, quantity_value, product_row.price, requested_payment_method);
    if settings_row.enable_product_commission then
      commission_cents := round(line_cents * product_row.commission_percent / 100.0)::bigint + round(product_row.commission_fixed * 100)::bigint * quantity_value;
      total_commission_cents := total_commission_cents + commission_cents;
      insert into public.commissions (tenant_id, barber_id, product_id, base_amount, rate_percent, fixed_amount, commission_amount, status)
      values (requested_tenant_id, requested_barber_id, product_id_value, line_cents / 100.0, product_row.commission_percent, product_row.commission_fixed * quantity_value, commission_cents / 100.0, 'payable');
    end if;
  end loop;
  return jsonb_build_object('sale_id', sale_id, 'total_amount', total_cents / 100.0, 'commission_amount', total_commission_cents / 100.0, 'cash_received_by_barber', case when requested_payment_method = 'cash' then total_cents / 100.0 else 0 end);
end;
$$;

revoke all on function public.award_fidelity_stamp_internal(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.redeem_fidelity_reward_internal(uuid, uuid) from public, anon, authenticated;
revoke all on function public.register_counter_sale_internal(uuid, uuid, uuid, jsonb, public.payment_method) from public, anon, authenticated;
grant execute on function public.award_fidelity_stamp_internal(uuid, uuid, uuid) to service_role;
grant execute on function public.redeem_fidelity_reward_internal(uuid, uuid) to service_role;
grant execute on function public.register_counter_sale_internal(uuid, uuid, uuid, jsonb, public.payment_method) to service_role;

alter table public.fidelity_stamp_events enable row level security;
alter table public.retention_rewards enable row level security;
alter table public.birthday_redemptions enable row level security;
alter table public.counter_sales enable row level security;

revoke all on public.fidelity_stamp_events, public.retention_rewards, public.birthday_redemptions, public.counter_sales from anon, authenticated;
grant select on public.fidelity_stamp_events, public.retention_rewards, public.birthday_redemptions, public.counter_sales to authenticated;

do $$ declare table_name text;
begin
  foreach table_name in array array['fidelity_stamp_events','retention_rewards','birthday_redemptions','counter_sales'] loop
    execute format('create policy "super admin full access" on public.%I for all to authenticated using ((select auth.is_super_admin())) with check ((select auth.is_super_admin()))', table_name);
    execute format('create policy "owner tenant access" on public.%I for all to authenticated using (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = ''owner'') with check (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = ''owner'')', table_name);
  end loop;
end $$;
create policy "client reads own fidelity events" on public.fidelity_stamp_events for select to authenticated using (client_id = (select auth.uid()));
create policy "client reads own rewards" on public.retention_rewards for select to authenticated using (client_id = (select auth.uid()));
create policy "client reads own birthday claims" on public.birthday_redemptions for select to authenticated using (client_id = (select auth.uid()));
create policy "barber reads own counter sales" on public.counter_sales for select to authenticated using (barber_id = (select auth.uid()) and tenant_id = (select auth.current_tenant_id()));

commit;
