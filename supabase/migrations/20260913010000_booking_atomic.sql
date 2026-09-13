-- Migration: Transação Atômica de Agendamento, Benefícios de Mensalistas e Proteção de Cortes
CREATE OR REPLACE FUNCTION create_appointment_hold_atomic(
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
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_conflict_count INT;
  v_appointment_id UUID;
  v_is_monthly BOOLEAN := false;
  v_monthly_sub_id UUID := NULL;
  v_clean_phone TEXT;
  v_service RECORD;
  v_hold_expires_at TIMESTAMPTZ;
BEGIN
  -- Normaliza telefone
  v_clean_phone := regexp_replace(p_client_phone, '\D', '', 'g');
  IF length(v_clean_phone) > 11 AND starts_with(v_clean_phone, '55') THEN
    v_clean_phone := substring(v_clean_phone from 3);
  END IF;

  -- 1. Verifica choque de horários (Hold ativo não expirado ou confirmado)
  SELECT COUNT(*) INTO v_conflict_count
  FROM appointments
  WHERE tenant_id = p_tenant_id
    AND barber_id = p_barber_id
    AND (
      status IN ('confirmed', 'scheduled', 'arrived', 'completed')
      OR (status = 'hold' AND hold_expires_at > NOW())
    )
    AND starts_at < p_ends_at
    AND ends_at > p_starts_at;

  IF v_conflict_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Horário indisponível ou já reservado');
  END IF;

  -- 2. Checa se é mensalista ativo com saldo de corte no tenant
  SELECT id INTO v_monthly_sub_id
  FROM monthly_subscriptions
  WHERE tenant_id = p_tenant_id
    AND (
      regexp_replace(client_phone, '\D', '', 'g') = v_clean_phone
      OR regexp_replace(client_phone, '\D', '', 'g') = ('55' || v_clean_phone)
    )
    AND status = 'active'
    AND cuts_remaining > 0
    AND CURRENT_DATE BETWEEN cycle_start_date AND cycle_end_date
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_monthly_sub_id IS NOT NULL THEN
    v_is_monthly := true;
  END IF;

  v_hold_expires_at := NOW() + INTERVAL '5 minutes';

  -- 3. Insere o agendamento (Se mensalista, nasce confirmado; se não, nasce hold)
  INSERT INTO appointments (
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
    created_at,
    updated_at
  ) VALUES (
    p_tenant_id,
    p_barber_id,
    p_client_name,
    p_client_phone,
    p_starts_at,
    p_ends_at,
    CASE WHEN v_is_monthly THEN NULL ELSE v_hold_expires_at END,
    CASE WHEN v_is_monthly THEN 0 ELSE p_total_amount END,
    CASE WHEN v_is_monthly THEN 0 ELSE p_reservation_fee END,
    0,
    CASE WHEN v_is_monthly THEN 'confirmed'::appointment_status ELSE 'hold'::appointment_status END,
    CASE WHEN v_is_monthly THEN 'paid'::payment_status ELSE 'pending'::payment_status END,
    CASE WHEN v_is_monthly THEN COALESCE(p_notes || ' ', '') || '[MENSALISTA VIP - ISENTO DE SINAL]' ELSE p_notes END,
    NOW(),
    NOW()
  ) RETURNING id INTO v_appointment_id;

  -- 4. Insere snapshots na tabela appointment_services
  IF p_service_ids IS NOT NULL AND array_length(p_service_ids, 1) > 0 THEN
    FOR v_service IN 
      SELECT id, name, price, duration_minutes, cleanup_minutes 
      FROM services 
      WHERE id = ANY(p_service_ids) AND tenant_id = p_tenant_id
    LOOP
      INSERT INTO appointment_services (
        appointment_id,
        service_id,
        service_name,
        duration_minutes,
        unit_price
      ) VALUES (
        v_appointment_id,
        v_service.id,
        v_service.name,
        v_service.duration_minutes + COALESCE(v_service.cleanup_minutes, 0),
        v_service.price
      );
    END LOOP;
  END IF;

  -- 5. Se for mensalista, debita o corte atomicamente agora que está confirmado
  IF v_is_monthly THEN
    UPDATE monthly_subscriptions
    SET cuts_remaining = cuts_remaining - 1
    WHERE id = v_monthly_sub_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'appointment_id', v_appointment_id,
    'is_monthly', v_is_monthly,
    'requires_pix', (NOT v_is_monthly AND p_reservation_fee > 0),
    'hold_expires_at', v_hold_expires_at
  );
END;
$$;
