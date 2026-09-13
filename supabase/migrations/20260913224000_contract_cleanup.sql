-- Migration: 20260913224000_contract_cleanup.sql
-- FASE B (CONTRACT): Remoção definitiva da RPC legada de 10 argumentos
-- Apenas a versão canônica de 11 argumentos (com p_tracking_token_hash) permanece ativa.

DROP FUNCTION IF EXISTS public.create_appointment_hold_atomic(
  p_tenant_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[],
  p_client_name text,
  p_client_phone text,
  p_starts_at timestamp with time zone,
  p_ends_at timestamp with time zone,
  p_total_amount numeric,
  p_reservation_fee numeric,
  p_notes text
);
