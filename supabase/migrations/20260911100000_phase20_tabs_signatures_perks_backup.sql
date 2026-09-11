-- Migration: 20260911100000_phase20_tabs_signatures_perks_backup.sql
-- Description: Fase 20 - Comanda Digital de Bar/Conveniência, Assinatura Eletrônica em Tela Touch, Convênios B2B e Backup Criptografado

-- 1. Comandas de Bar, Drinks & Conveniência
CREATE TABLE IF NOT EXISTS customer_tabs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    client_name text,
    guest_phone text,
    appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('open', 'closed', 'cancelled')) DEFAULT 'open',
    opened_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    total_amount numeric(10,2) NOT NULL DEFAULT 0.00,
    payment_method text,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_tabs_tenant_status ON customer_tabs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_tabs_appointment ON customer_tabs(appointment_id);

CREATE TABLE IF NOT EXISTS customer_tab_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tab_id uuid NOT NULL REFERENCES customer_tabs(id) ON DELETE CASCADE,
    product_id uuid REFERENCES products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price numeric(10,2) NOT NULL DEFAULT 0.00,
    total_price numeric(10,2) NOT NULL DEFAULT 0.00,
    barber_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    added_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_tab_items_tab ON customer_tab_items(tab_id);

-- 2. Assinatura Eletrônica em Tela Touch com Auditoria Jurídica
CREATE TABLE IF NOT EXISTS electronic_signatures (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_type text NOT NULL CHECK (document_type IN ('image_use_consent', 'partner_contract', 'service_waiver', 'other')),
    title text NOT NULL,
    signer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    signer_name text NOT NULL,
    signer_document text NOT NULL, -- CPF ou CNPJ
    signer_email text,
    signature_png_base64 text NOT NULL,
    sha256_hash text NOT NULL,
    contract_text_snapshot text NOT NULL,
    ip_address text,
    user_agent text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_electronic_signatures_tenant ON electronic_signatures(tenant_id);
CREATE INDEX IF NOT EXISTS idx_electronic_signatures_doc ON electronic_signatures(tenant_id, document_type);
CREATE INDEX IF NOT EXISTS idx_electronic_signatures_hash ON electronic_signatures(sha256_hash);

-- 3. Convênios Corporativos B2B & Parcerias Locais
CREATE TABLE IF NOT EXISTS corporate_agreements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name text NOT NULL,
    cnpj text NOT NULL,
    contact_name text,
    contact_email text NOT NULL,
    contact_phone text,
    coupon_code text NOT NULL,
    discount_percentage numeric(5,2) NOT NULL DEFAULT 15.00 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    billing_type text NOT NULL CHECK (billing_type IN ('direct_discount', 'postpaid_monthly')) DEFAULT 'direct_discount',
    status text NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_corporate_coupon UNIQUE (tenant_id, coupon_code)
);

CREATE INDEX IF NOT EXISTS idx_corporate_agreements_tenant ON corporate_agreements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_corporate_agreements_code ON corporate_agreements(tenant_id, coupon_code);

CREATE TABLE IF NOT EXISTS corporate_usages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agreement_id uuid NOT NULL REFERENCES corporate_agreements(id) ON DELETE CASCADE,
    appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
    employee_name text NOT NULL,
    employee_email text,
    employee_document text,
    discount_amount numeric(10,2) NOT NULL DEFAULT 0.00,
    final_amount numeric(10,2) NOT NULL DEFAULT 0.00,
    is_billed boolean NOT NULL DEFAULT false,
    billed_settlement_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_corporate_usages_agreement ON corporate_usages(agreement_id);
CREATE INDEX IF NOT EXISTS idx_corporate_usages_tenant_billed ON corporate_usages(tenant_id, is_billed);

-- 4. Histórico de Backups Criptografados Externos (S3 / Cloudflare R2)
CREATE TABLE IF NOT EXISTS backup_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_id text NOT NULL UNIQUE,
    file_name text NOT NULL,
    storage_path text NOT NULL,
    file_size_bytes bigint NOT NULL DEFAULT 0,
    sha256_checksum text NOT NULL,
    records_count integer NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('success', 'failed')) DEFAULT 'success',
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC);

-- 5. Políticas de Segurança RLS (Row Level Security)
ALTER TABLE customer_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_tab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE electronic_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for customer_tabs"
    ON customer_tabs FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for customer_tab_items"
    ON customer_tab_items FOR ALL
    USING (tab_id IN (
        SELECT id FROM customer_tabs WHERE tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    ));

CREATE POLICY "Tenant isolation for electronic_signatures"
    ON electronic_signatures FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for corporate_agreements"
    ON corporate_agreements FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Tenant isolation for corporate_usages"
    ON corporate_usages FOR ALL
    USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Super admin only for backup_history"
    ON backup_history FOR ALL
    USING (EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    ));
