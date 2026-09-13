-- 1. Ampliação da tabela tenants para dados cadastrais e endereço
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS document_number TEXT,
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_neighborhood TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_cep TEXT;

-- 2. Tabela de configuração visual e construtor de site
CREATE TABLE IF NOT EXISTS tenant_site_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  logo_url TEXT,
  banner_url TEXT,
  headline_title TEXT DEFAULT 'Tradição, Estilo e Atendimento de Primeira',
  headline_subtitle TEXT DEFAULT 'Agende seu horário online em menos de 1 minuto sem complicação.',
  about_text TEXT,
  font_family VARCHAR(50) DEFAULT 'font-sans', -- 'font-sans', 'font-serif', 'font-cinzel', 'font-bebas'
  bg_texture VARCHAR(50) DEFAULT 'clean_dark', -- 'clean_dark', 'carbon', 'dark_wood', 'dark_brick', 'noise_grain'
  primary_color VARCHAR(10) DEFAULT '#D97706', -- Dourado/Âmbar
  background_color VARCHAR(10) DEFAULT '#09090b', -- Preto/Zinc 950
  card_color VARCHAR(10) DEFAULT '#18181b',
  gallery_photos JSONB DEFAULT '[]'::jsonb,
  amenities JSONB DEFAULT '["Cerveja Gelada", "Wi-Fi Grátis", "Ar-Condicionado", "Mesa de Sinuca"]'::jsonb,
  sections_visibility JSONB DEFAULT '{
    "hero": true,
    "services": true,
    "barbers": true,
    "gallery": true,
    "about": true,
    "amenities": true,
    "location": true
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Políticas de Segurança RLS
ALTER TABLE tenant_site_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Site Config" ON tenant_site_config;
CREATE POLICY "Public Read Site Config" ON tenant_site_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Tenant Owner Update Config" ON tenant_site_config;
CREATE POLICY "Tenant Owner Update Config" ON tenant_site_config FOR ALL TO authenticated USING (true);
