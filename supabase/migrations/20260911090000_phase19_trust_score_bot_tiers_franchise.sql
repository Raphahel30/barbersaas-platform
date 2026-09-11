-- Migration: 20260911090000_phase19_trust_score_bot_tiers_franchise.sql
-- Description: Fase 19 - Score de Confiança, Bot de Atendimento WhatsApp, Categorias de Profissionais e Franquias

-- 1. Tabela de Score de Confiabilidade do Cliente (Anti-No-Show)
CREATE TABLE IF NOT EXISTS client_trust_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    phone text NOT NULL,
    client_name text,
    score integer NOT NULL DEFAULT 70 CHECK (score >= 0 AND score <= 100),
    classification text NOT NULL CHECK (classification IN ('reliable', 'neutral', 'high_risk')) DEFAULT 'neutral',
    completed_count integer NOT NULL DEFAULT 0,
    late_cancellation_count integer NOT NULL DEFAULT 0,
    no_show_count integer NOT NULL DEFAULT 0,
    consecutive_no_shows integer NOT NULL DEFAULT 0,
    is_blacklisted boolean NOT NULL DEFAULT false,
    blacklist_reason text,
    blacklisted_at timestamptz,
    custom_reservation_fee_percent numeric(5,2),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_client_trust_tenant_phone UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_client_trust_tenant_score ON client_trust_scores(tenant_id, score);
CREATE INDEX IF NOT EXISTS idx_client_trust_tenant_phone ON client_trust_scores(tenant_id, phone);

-- 2. Tabela de Sessões e Transbordo do Bot de WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_bot_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    phone text NOT NULL,
    client_name text,
    last_interaction_at timestamptz NOT NULL DEFAULT now(),
    bot_paused_until timestamptz,
    transferred_to_human boolean NOT NULL DEFAULT false,
    transferred_at timestamptz,
    current_step text NOT NULL DEFAULT 'main_menu',
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_bot_session_tenant_phone UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_bot_tenant_phone ON whatsapp_bot_sessions(tenant_id, phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_bot_human_transfer ON whatsapp_bot_sessions(tenant_id, transferred_to_human);

-- 3. Adicionar Nível de Senioridade em Profiles e Tabela de Preços por Categoria
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS seniority_tier text CHECK (seniority_tier IN ('junior', 'pleno', 'senior', 'master')) DEFAULT 'pleno';

CREATE TABLE IF NOT EXISTS service_tier_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    tier text NOT NULL CHECK (tier IN ('junior', 'pleno', 'senior', 'master')),
    custom_price numeric(10,2) NOT NULL,
    custom_duration_minutes integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_service_tier UNIQUE (service_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_service_tier_pricing_service ON service_tier_pricing(service_id);

-- 4. Tabelas de Franquias (Contratos de Royalties & Apuração Mensal)
CREATE TABLE IF NOT EXISTS franchise_contracts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    royalties_percentage numeric(5,2) NOT NULL DEFAULT 5.00,
    marketing_fund_percentage numeric(5,2) NOT NULL DEFAULT 2.00,
    fixed_monthly_fee numeric(10,2) NOT NULL DEFAULT 0.00,
    due_day integer NOT NULL DEFAULT 10 CHECK (due_day >= 1 AND due_day <= 31),
    asaas_customer_id text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_franchise_contracts_org ON franchise_contracts(organization_id);

CREATE TABLE IF NOT EXISTS franchise_settlements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contract_id uuid REFERENCES franchise_contracts(id) ON DELETE SET NULL,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    gross_revenue numeric(12,2) NOT NULL,
    royalties_amount numeric(12,2) NOT NULL,
    marketing_fund_amount numeric(12,2) NOT NULL,
    fixed_fee_amount numeric(12,2) NOT NULL DEFAULT 0.00,
    total_due numeric(12,2) NOT NULL,
    asaas_payment_id text,
    asaas_invoice_url text,
    status text NOT NULL CHECK (status IN ('pending', 'invoiced', 'paid', 'overdue', 'waived')) DEFAULT 'pending',
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_franchise_settlement_period UNIQUE (tenant_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_franchise_settlements_org_period ON franchise_settlements(organization_id, period_year, period_month);

-- 5. RLS Policies
ALTER TABLE client_trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_bot_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tier_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for client_trust_scores"
    ON client_trust_scores FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for whatsapp_bot_sessions"
    ON whatsapp_bot_sessions FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for service_tier_pricing"
    ON service_tier_pricing FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Org isolation for franchise_contracts"
    ON franchise_contracts FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM tenants WHERE id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Org isolation for franchise_settlements"
    ON franchise_settlements FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM tenants WHERE id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    ));
