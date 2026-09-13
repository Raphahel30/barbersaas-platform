-- docs/deployment/contract_cleanup.sql
-- FASE B (CONTRACT / CLEANUP) — TEMPLATE DE MIGRATION
-- APLICAR SOMENTE APÓS O DEPLOY DA NOVA APLICAÇÃO, TESTES DE SMOKE APROVADOS E ZERO ACTIVE HOLDS
-- Remove a sobrecarga legada de 10 parâmetros de create_appointment_hold_atomic

REVOKE EXECUTE ON FUNCTION public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT
) FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.create_appointment_hold_atomic(
  UUID, UUID, UUID[], TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT
);
