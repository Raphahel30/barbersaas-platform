-- Close production security and concurrency gaps found in the 2026-09-13 audit.

-- Serialize and reject overlapping active appointments for every write path.
CREATE OR REPLACE FUNCTION public.prevent_appointment_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.barber_id IS NULL OR NEW.tenant_id IS NULL OR NEW.starts_at IS NULL OR NEW.ends_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('hold', 'confirmed', 'scheduled', 'arrived') THEN
    RETURN NEW;
  END IF;

  -- All appointments for one tenant/professional serialize inside the transaction.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.tenant_id::text || ':' || NEW.barber_id::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.appointments existing
    WHERE existing.tenant_id = NEW.tenant_id
      AND existing.barber_id = NEW.barber_id
      AND existing.id IS DISTINCT FROM NEW.id
      AND (
        existing.status IN ('confirmed', 'scheduled', 'arrived')
        OR (existing.status = 'hold' AND existing.hold_expires_at > pg_catalog.now())
      )
      AND existing.starts_at < NEW.ends_at
      AND existing.ends_at > NEW.starts_at
  ) THEN
    RAISE EXCEPTION 'Horário indisponível ou já reservado.' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_prevent_overlap ON public.appointments;
CREATE TRIGGER appointments_prevent_overlap
BEFORE INSERT OR UPDATE OF tenant_id, barber_id, starts_at, ends_at, status, hold_expires_at
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_appointment_overlap();

REVOKE EXECUTE ON FUNCTION public.prevent_appointment_overlap() FROM PUBLIC, anon, authenticated;

-- The application now always uses the canonical RPC with a tracking-token hash.
DROP FUNCTION IF EXISTS public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT
);

-- Keep the existing canonical implementation, but make trial tenants operational.
DO $$
DECLARE
  function_definition TEXT;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.create_appointment_hold_atomic(uuid,uuid,uuid[],text,text,timestamp with time zone,timestamp with time zone,numeric,numeric,text,text)'::regprocedure
  ) INTO function_definition;

  function_definition := pg_catalog.replace(
    function_definition,
    'SELECT (status = ''active'') INTO v_tenant_active',
    'SELECT (status IN (''active'', ''trial'')) INTO v_tenant_active'
  );

  EXECUTE function_definition;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT
) TO service_role;

-- Staff-only, tenant-scoped and atomic monthly-cut consumption.
CREATE OR REPLACE FUNCTION public.consume_monthly_subscription_cut(
  p_subscription_id UUID,
  p_tenant_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  remaining INTEGER;
BEGIN
  UPDATE public.monthly_subscriptions
  SET cuts_remaining = cuts_remaining - 1
  WHERE id = p_subscription_id
    AND tenant_id = p_tenant_id
    AND status = 'active'
    AND cuts_remaining > 0
    AND CURRENT_DATE BETWEEN cycle_start_date AND cycle_end_date
  RETURNING cuts_remaining INTO remaining;

  RETURN remaining;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_monthly_subscription_cut(UUID, UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_monthly_subscription_cut(UUID, UUID) TO service_role;

-- SECURITY DEFINER helpers used by RLS are authenticated-only. Trigger functions
-- do not need direct API execution. The public resolver remains explicitly public.
REVOKE EXECUTE ON FUNCTION public.barber_belongs_to_tenant(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_organization_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_appointment() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.barber_belongs_to_tenant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.resolve_tenant_by_host(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant_by_host(TEXT, TEXT) TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_appointments_active_overlap
ON public.appointments (tenant_id, barber_id, starts_at, ends_at)
WHERE status IN ('hold', 'confirmed', 'scheduled', 'arrived');

CREATE INDEX IF NOT EXISTS idx_monthly_subscriptions_tenant_phone_active
ON public.monthly_subscriptions (tenant_id, client_phone, cycle_end_date)
WHERE status = 'active';
