create type public.refund_policy as enum ('gateway_refund', 'client_credit');
create type public.refund_status as enum ('pending', 'processing', 'completed', 'failed', 'manual_required');

alter table public.barber_schedules
  add column if not exists is_day_off boolean not null default false;

alter table public.tenant_settings
  add column if not exists timezone text not null default 'America/Sao_Paulo',
  add column if not exists no_show_policy public.refund_policy not null default 'client_credit';

alter table public.appointments
  add column if not exists vip_discount_amount numeric(12,2) not null default 0 check (vip_discount_amount >= 0),
  add column if not exists fidelity_discount_amount numeric(12,2) not null default 0 check (fidelity_discount_amount >= 0),
  add column if not exists fidelity_card_id uuid references public.fidelity_cards(id) on delete set null,
  add column if not exists cancelled_by public.user_role;

create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  gateway public.gateway_provider,
  gateway_payment_id text,
  status public.refund_status not null default 'pending',
  reason text not null,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id, amount)
);

create or replace trigger set_updated_at before update on public.refund_requests
for each row execute function public.set_updated_at();

create index if not exists refund_requests_tenant_status_idx
on public.refund_requests (tenant_id, status, created_at);

create unique index if not exists commissions_no_show_once_idx
on public.commissions (appointment_id)
where is_no_show;

create unique index if not exists client_credits_cancellation_once_idx
on public.client_credits (appointment_id)
where type = 'cancellation';

create or replace function public.validate_appointment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not public.barber_belongs_to_tenant(new.barber_id, new.tenant_id) then
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
  if not new.is_walk_in and not new.is_quick_sale and new.status in ('hold','pending','scheduled','confirmed') then
    perform pg_advisory_xact_lock(hashtextextended(new.barber_id::text, 0));
    if exists (
      select 1 from public.appointments a
      where a.barber_id = new.barber_id and a.id <> new.id
        and a.status in ('hold','pending','scheduled','confirmed')
        and (a.status <> 'hold' or a.hold_expires_at > now())
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
    ) then
      raise exception 'Appointment overlaps an active booking' using errcode = '23P01';
    end if;
  end if;
  return new;
end;
$$;

alter table public.refund_requests enable row level security;
revoke all on public.refund_requests from anon, authenticated;
grant select, insert, update, delete on public.refund_requests to authenticated;

drop policy if exists "super admin full access" on public.refund_requests;
create policy "super admin full access" on public.refund_requests for all to authenticated
using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

drop policy if exists "owner tenant access" on public.refund_requests;
create policy "owner tenant access" on public.refund_requests for all to authenticated
using (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner')
with check (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner');

drop policy if exists "barber reads own refund requests" on public.refund_requests;
create policy "barber reads own refund requests" on public.refund_requests for select to authenticated
using (exists (
  select 1 from public.appointments a
  where a.id = appointment_id and a.barber_id = (select auth.uid())
));

drop policy if exists "client reads own refund requests" on public.refund_requests;
create policy "client reads own refund requests" on public.refund_requests for select to authenticated
using (client_id = (select auth.uid()));
