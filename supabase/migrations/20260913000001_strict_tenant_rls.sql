-- Migration: Validação Estrita de Pertença de Tenant em Tabelas Críticas

-- 1. monthly_subscriptions
ALTER TABLE monthly_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow All Service Role on Monthly Subscriptions" ON monthly_subscriptions;
DROP POLICY IF EXISTS "Tenant Staff Access Monthly Subscriptions" ON monthly_subscriptions;

CREATE POLICY "Tenant Staff Access Monthly Subscriptions" ON monthly_subscriptions
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'super_admin', 'barber')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'super_admin', 'barber')
    )
  );

-- 2. services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Services" ON services;
CREATE POLICY "Public Read Services" ON services
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Tenant Owner Manage Services" ON services;
CREATE POLICY "Tenant Owner Manage Services" ON services
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'super_admin')
    )
  );

-- 3. audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Owner Read Audit Logs" ON audit_logs;
CREATE POLICY "Tenant Owner Read Audit Logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p 
      WHERE p.id = auth.uid() AND p.role IN ('owner', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Tenant Staff Insert Audit Logs" ON audit_logs;
CREATE POLICY "Tenant Staff Insert Audit Logs" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT p.tenant_id FROM profiles p 
      WHERE p.id = auth.uid() AND p.is_active = true
    )
  );
