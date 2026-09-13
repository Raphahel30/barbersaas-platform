-- Migration: 20260913020000_reconcile_and_harden.sql
-- FASE A (EXPAND): Reconciliação, atomicidade, concorrência, backward-compatibility e blindagem

-- 1. Constraint de saldo não-negativo em monthly_subscriptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cuts_remaining_non_negative'
  ) THEN
    ALTER TABLE public.monthly_subscriptions 
      ADD CONSTRAINT cuts_remaining_non_negative CHECK (cuts_remaining >= 0);
  END IF;
END $$;

-- 2. Coluna tracking_token_hash na tabela appointments para proteção IDOR/BOLA no polling
ALTER TABLE public.appointments 
  ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT;

-- 3. Nova Função RPC Atômica Canônica (11 argumentos)
CREATE OR REPLACE FUNCTION public.create_appointment_hold_atomic(
  p_tenant_id UUID,
  p_barber_id UUID,
  p_service_ids UUID[],
  p_client_name TEXT,
  p_client_phone TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_total_amount NUMERIC,
  p_reservation_fee NUMERIC,
  p_notes TEXT DEFAULT NULL,
  p_tracking_token_hash TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_conflict_count INT;
  v_appointment_id UUID;
  v_is_monthly BOOLEAN := false;
  v_is_exempt BOOLEAN := false;
  v_monthly_sub_id UUID := NULL;
  v_cuts_remaining INT := 0;
  v_clean_phone TEXT;
  v_service RECORD;
  v_service_count INT;
  v_hold_expires_at TIMESTAMPTZ;
  v_status public.appointment_status;
  v_payment_status public.payment_status;
  v_rows_updated INT;
  v_tenant_active BOOLEAN;
  v_barber_valid BOOLEAN;
BEGIN
  -- 1. Validações defensivas de entrada
  IF p_tenant_id IS NULL OR p_barber_id IS NULL OR p_starts_at IS NULL OR p_ends_at IS NULL THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Parâmetros obrigatórios ausentes.');
  END IF;

  IF p_starts_at <= pg_catalog.now() THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Horário de agendamento deve ser futuro.');
  END IF;

  IF p_ends_at <= p_starts_at THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Horário de término inválido.');
  END IF;

  IF p_client_name IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_client_name)) > 150 THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Nome do cliente excede limite.');
  END IF;

  -- Valida tenant ativo
  SELECT (status = 'active') INTO v_tenant_active
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF v_tenant_active IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Barbearia inativa ou inexistente.');
  END IF;

  -- Valida barbeiro ativo no tenant
  SELECT (is_active AND role IN ('barber', 'owner')) INTO v_barber_valid
  FROM public.profiles
  WHERE id = p_barber_id AND tenant_id = p_tenant_id;

  IF v_barber_valid IS NOT TRUE THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Profissional inválido ou inativo.');
  END IF;

  -- Valida lista de serviços
  IF p_service_ids IS NULL OR pg_catalog.array_length(p_service_ids, 1) IS NULL OR pg_catalog.array_length(p_service_ids, 1) = 0 THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Nenhum serviço selecionado.');
  END IF;

  SELECT pg_catalog.count(*) INTO v_service_count
  FROM public.services
  WHERE id = ANY(p_service_ids)
    AND tenant_id = p_tenant_id
    AND is_active = true;

  IF v_service_count != pg_catalog.array_length(p_service_ids, 1) THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Um ou mais serviços são inválidos ou inativos.');
  END IF;

  -- Normaliza telefone
  v_clean_phone := pg_catalog.regexp_replace(pg_catalog.coalesce(p_client_phone, ''), '\D', '', 'g');
  IF pg_catalog.length(v_clean_phone) > 11 AND pg_catalog.starts_with(v_clean_phone, '55') THEN
    v_clean_phone := pg_catalog.substring(v_clean_phone, 3);
  END IF;

  -- 2. Verifica choque de horários (Hold ativo não expirado ou confirmado/agendado)
  SELECT pg_catalog.count(*) INTO v_conflict_count
  FROM public.appointments
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND (
      status IN ('confirmed', 'scheduled', 'arrived', 'completed')
      OR (status = 'hold' AND hold_expires_at > pg_catalog.now())
    )
    AND starts_at < p_ends_at
    AND ends_at > p_starts_at;

  IF v_conflict_count > 0 THEN
    RETURN pg_catalog.jsonb_build_object('success', false, 'error', 'Horário indisponível ou já reservado.');
  END IF;

  -- 3. Checa mensalista ativo com saldo de corte no tenant e trava a linha com FOR UPDATE
  IF pg_catalog.length(v_clean_phone) >= 8 THEN
    SELECT id, cuts_remaining INTO v_monthly_sub_id, v_cuts_remaining
    FROM public.monthly_subscriptions
    WHERE tenant_id = p_tenant_id
      AND (
        pg_catalog.regexp_replace(client_phone, '\D', '', 'g') = v_clean_phone
        OR pg_catalog.regexp_replace(client_phone, '\D', '', 'g') = ('55' || v_clean_phone)
      )
      AND status = 'active'
      AND cuts_remaining > 0
      AND CURRENT_DATE BETWEEN cycle_start_date AND cycle_end_date
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_monthly_sub_id IS NOT NULL AND v_cuts_remaining > 0 THEN
      -- Débito atômico defensivo com checagem de row count
      UPDATE public.monthly_subscriptions
      SET cuts_remaining = cuts_remaining - 1
      WHERE id = v_monthly_sub_id
        AND cuts_remaining > 0;

      GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
      IF v_rows_updated = 1 THEN
        v_is_monthly := true;
      END IF;
    END IF;
  END IF;

  -- 4. Determina se é isento de sinal (mensalista OU taxa de sinal <= 0)
  v_is_exempt := (v_is_monthly OR p_reservation_fee <= 0);

  IF v_is_exempt THEN
    v_status := 'confirmed'::public.appointment_status;
    v_payment_status := 'paid'::public.payment_status;
    v_hold_expires_at := NULL;
  ELSE
    v_status := 'hold'::public.appointment_status;
    v_payment_status := 'pending'::public.payment_status;
    v_hold_expires_at := pg_catalog.now() + INTERVAL '5 minutes';
  END IF;

  -- 5. Insere o agendamento
  INSERT INTO public.appointments (
    tenant_id,
    barber_id,
    guest_name,
    guest_phone,
    starts_at,
    ends_at,
    hold_expires_at,
    total_amount,
    reservation_fee,
    reservation_fee_paid,
    status,
    payment_status,
    notes,
    tracking_token_hash,
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    p_barber_id,
    p_client_name,
    p_client_phone,
    p_starts_at,
    p_ends_at,
    v_hold_expires_at,
    CASE WHEN v_is_monthly THEN 0 ELSE p_total_amount END,
    CASE WHEN v_is_exempt THEN 0 ELSE p_reservation_fee END,
    0,
    v_status,
    v_payment_status,
    CASE 
      WHEN v_is_monthly THEN pg_catalog.coalesce(p_notes || ' ', '') || '[MENSALISTA VIP - ISENTO DE SINAL]'
      ELSE p_notes 
    END,
    p_tracking_token_hash,
    pg_catalog.now(),
    pg_catalog.now()
  ) RETURNING id INTO v_appointment_id;

  -- 6. Insere snapshots na tabela appointment_services
  FOR v_service IN 
    SELECT id, name, price, duration_minutes, cleanup_minutes 
    FROM public.services 
    WHERE id = ANY(p_service_ids) AND tenant_id = p_tenant_id
  LOOP
    INSERT INTO public.appointment_services (
      appointment_id,
      service_id,
      service_name,
      duration_minutes,
      unit_price
    ) VALUES (
      v_appointment_id,
      v_service.id,
      v_service.name,
      v_service.duration_minutes + pg_catalog.coalesce(v_service.cleanup_minutes, 0),
      v_service.price
    );
  END LOOP;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'status', v_status,
    'is_monthly', v_is_monthly,
    'requires_payment', (NOT v_is_exempt),
    'reservation_fee', CASE WHEN v_is_exempt THEN 0 ELSE p_reservation_fee END,
    'total_amount', CASE WHEN v_is_monthly THEN 0 ELSE p_total_amount END,
    'hold_expires_at', v_hold_expires_at
  );
END;
$$;

-- 4. Função Legada (10 argumentos) para Backward Compatibility durante a Transição
CREATE OR REPLACE FUNCTION public.create_appointment_hold_atomic(
  p_tenant_id UUID,
  p_barber_id UUID,
  p_service_ids UUID[],
  p_client_name TEXT,
  p_client_phone TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_total_amount NUMERIC,
  p_reservation_fee NUMERIC,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Delega para a versão canônica passando tracking_token_hash como NULL
  RETURN public.create_appointment_hold_atomic(
    p_tenant_id,
    p_barber_id,
    p_service_ids,
    p_client_name,
    p_client_phone,
    p_starts_at,
    p_ends_at,
    p_total_amount,
    p_reservation_fee,
    p_notes,
    NULL::TEXT
  );
END;
$$;

-- 5. Restrição de Grants: Executável estritamente pelo service_role (backend Server Actions)
REVOKE EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT
) TO service_role;

-- 6. Hardening de Storage Policies no bucket barbershop-media (Tenant-scoped)
DROP POLICY IF EXISTS "Tenant Owner Upload Media" ON storage.objects;
DROP POLICY IF EXISTS "Tenant Staff Upload Media" ON storage.objects;
DROP POLICY IF EXISTS "Tenant Staff Update Media" ON storage.objects;
DROP POLICY IF EXISTS "Tenant Staff Delete Media" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Media" ON storage.objects;

CREATE POLICY "Public Read Media" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'barbershop-media');

CREATE POLICY "Tenant Staff Upload Media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'barbershop-media'
    AND (
      (
        split_part(name, '/', 1) = 'tenants'
        AND split_part(name, '/', 2)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
      OR (
        split_part(name, '/', 1)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
    )
  );

CREATE POLICY "Tenant Staff Update Media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'barbershop-media'
    AND (
      (
        split_part(name, '/', 1) = 'tenants'
        AND split_part(name, '/', 2)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
      OR (
        split_part(name, '/', 1)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
    )
  )
  WITH CHECK (
    bucket_id = 'barbershop-media'
    AND (
      (
        split_part(name, '/', 1) = 'tenants'
        AND split_part(name, '/', 2)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
      OR (
        split_part(name, '/', 1)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
    )
  );

CREATE POLICY "Tenant Staff Delete Media" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'barbershop-media'
    AND (
      (
        split_part(name, '/', 1) = 'tenants'
        AND split_part(name, '/', 2)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
      OR (
        split_part(name, '/', 1)::uuid IN (
          SELECT tenant_id FROM public.profiles WHERE id = (select auth.uid())
        )
      )
    )
  );

-- 7. Índices de cobertura em Foreign Keys críticas para Hot Paths
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_id ON public.appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_id ON public.appointments(barber_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client_id ON public.appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_service_id ON public.appointment_services(service_id);
CREATE INDEX IF NOT EXISTS idx_monthly_subscriptions_tenant_id ON public.monthly_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_commissions_barber_id ON public.commissions(barber_id);
CREATE INDEX IF NOT EXISTS idx_commissions_tenant_id ON public.commissions(tenant_id);
