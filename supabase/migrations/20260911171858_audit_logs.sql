create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_email text not null,
  actor_role public.user_role not null,
  action text not null,
  category text not null check (category in ('security', 'financial', 'team', 'system')),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_tenant_idx on public.audit_logs(tenant_id, created_at desc);
create index if not exists audit_logs_category_idx on public.audit_logs(category, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
grant insert on public.audit_logs to authenticated;

drop policy if exists "super admin full access to audit_logs" on public.audit_logs;
create policy "super admin full access to audit_logs" on public.audit_logs for select to authenticated
using ((select public.is_super_admin()));

drop policy if exists "owner reads tenant audit_logs" on public.audit_logs;
create policy "owner reads tenant audit_logs" on public.audit_logs for select to authenticated
using (tenant_id = (select public.current_tenant_id()) and (select public.current_user_role()) = 'owner');

drop policy if exists "authenticated users insert audit_logs" on public.audit_logs;
create policy "authenticated users insert audit_logs" on public.audit_logs for insert to authenticated
with check (
  (select public.is_super_admin()) or
  tenant_id = (select public.current_tenant_id())
);
