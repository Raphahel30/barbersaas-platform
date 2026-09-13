-- DOCUMENTAÇÃO DE ROLLBACK EMERGENCIAL (NÃO APLICAR DIRETAMENTE)
-- Este script restaura a assinatura legada de 10 argumentos caso um rollback emergencial da aplicação seja necessário.

CREATE OR REPLACE FUNCTION public.create_appointment_hold_atomic(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[],
  p_client_name text,
  p_client_phone text,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_total_amount numeric,
  p_reservation_fee numeric,
  p_notes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $function$
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
$function$;

REVOKE EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  uuid, uuid, uuid[], text, text, timestamptz, timestamptz, numeric, numeric, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  uuid, uuid, uuid[], text, text, timestamptz, timestamptz, numeric, numeric, text
) TO service_role;
