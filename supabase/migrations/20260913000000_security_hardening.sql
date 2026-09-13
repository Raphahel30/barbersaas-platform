-- Migration de Blindagem de Segurança RLS e Isolamento Multi-Tenant

ALTER TABLE tenant_site_config ENABLE ROW LEVEL SECURITY;

-- Leitura pública para carregar a vitrine da barbearia
DROP POLICY IF EXISTS "Public Read Site Config" ON tenant_site_config;
CREATE POLICY "Public Read Site Config" ON tenant_site_config
  FOR SELECT TO anon, authenticated USING (true);

-- Escrita restrita ao proprietário do tenant correspondente ou super admin
DROP POLICY IF EXISTS "Tenant Owner Update Config" ON tenant_site_config;
CREATE POLICY "Tenant Owner Update Config" ON tenant_site_config
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
