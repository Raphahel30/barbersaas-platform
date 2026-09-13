create or replace function public.resolve_tenant_by_host(
  requested_host text,
  requested_slug text default null
)
returns table (
  id uuid,
  slug text,
  status public.tenant_status
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.status
  from public.tenants as t
  where
    (requested_slug is not null and t.slug = lower(requested_slug))
    or
    (requested_slug is null and t.custom_domain = lower(requested_host))
  limit 1
$$;

revoke all on function public.resolve_tenant_by_host(text, text) from public;
grant execute on function public.resolve_tenant_by_host(text, text) to anon, authenticated, service_role;
