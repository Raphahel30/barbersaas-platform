-- Make the database role the single authorization source for super-admin access.
-- A super-admin profile already exists in production; no identity is hardcoded here.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role = 'super_admin'
      AND p.is_active = true
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'appointment_services', 'appointments', 'barber_blocked_slots',
    'barber_schedules', 'cash_closings', 'client_credits',
    'client_subscriptions', 'commissions', 'fidelity_cards', 'gallery_photos',
    'organizations', 'plans', 'products', 'profiles', 'services',
    'system_settings', 'tenant_holidays', 'tenant_settings', 'tenants', 'vip_plans'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super admin full access" ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY "super admin full access" ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_super_admin())) WITH CHECK ((SELECT public.is_super_admin()))',
      target_table
    );
  END LOOP;
END
$$;
