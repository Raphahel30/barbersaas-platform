-- Prevent authenticated users from reading every tenant row and sensitive columns.
-- Public tenant resolution remains available through resolve_tenant_by_host(text, text),
-- whose result is intentionally limited to the public tenant identity fields.

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Tenants" ON public.tenants;
DROP POLICY IF EXISTS "Public read for tenants by slug or domain" ON public.tenants;

DROP POLICY IF EXISTS "Authenticated read own tenant" ON public.tenants;
CREATE POLICY "Authenticated read own tenant"
ON public.tenants
FOR SELECT
TO authenticated
USING (
  id = (SELECT public.current_tenant_id())
  OR (SELECT public.is_super_admin())
);

-- Remove table-wide SELECT first: a table grant would override column restrictions.
-- Public callers must use the resolver RPC; signed-in callers only receive the
-- non-secret columns required by the application.
REVOKE SELECT ON TABLE public.tenants FROM anon, authenticated;

GRANT SELECT (
  id,
  organization_id,
  plan_id,
  name,
  slug,
  custom_domain,
  status,
  past_due_since,
  address,
  active_gateway,
  visual_settings,
  created_at,
  updated_at,
  address_street,
  address_number,
  address_neighborhood,
  address_city,
  address_state,
  address_cep
) ON public.tenants TO authenticated;

-- Intentionally excluded from authenticated SELECT:
-- gateway_credentials, asaas_customer_id, asaas_subscription_id,
-- document_number and owner_name.

