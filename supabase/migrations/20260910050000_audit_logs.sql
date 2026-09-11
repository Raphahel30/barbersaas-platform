begin;

create table public.audit_logs (
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

create index audit_logs_tenant_idx on public.audit_logs(tenant_id, created_at desc);
create index audit_logs_category_idx on public.audit_logs(category, created_at desc);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);

alter table public.audit_logs enable row level security;

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;
grant insert on public.audit_logs to authenticated;

-- Super admin visualiza tudo
create policy "super admin full access to audit_logs" on public.audit_logs for select to authenticated
using ((select auth.is_super_admin()));

-- Owner visualiza apenas os logs da sua própria barbearia
create policy "owner reads tenant audit_logs" on public.audit_logs for select to authenticated
using (tenant_id = (select auth.current_tenant_id()) and (select auth.current_user_role()) = 'owner');

-- Inserção permitida para usuários autenticados para seu próprio tenant
create policy "authenticated users insert audit_logs" on public.audit_logs for insert to authenticated
with check (
  (select auth.is_super_admin()) or
  tenant_id = (select auth.current_tenant_id())
);

commit;
