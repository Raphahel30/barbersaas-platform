-- Migration: 20260910090000_phase18_campaigns_pos_schedules.sql
-- Description: Tabelas para Campanhas de Marketing Anti-Ban, Portal do Contador, Terminais Smart POS e Escalas de Folga da Equipe

-- 1. Tabela de Campanhas de Marketing
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    target_segment text NOT NULL,
    target_barber_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    status text NOT NULL CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'paused')) DEFAULT 'draft',
    message_template text NOT NULL,
    total_recipients integer NOT NULL DEFAULT 0,
    sent_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_tenant ON marketing_campaigns(tenant_id, status);

-- 2. Tabela de Fila de Disparo de Mensagens da Campanha
CREATE TABLE IF NOT EXISTS campaign_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id uuid NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    phone text NOT NULL,
    client_name text NOT NULL,
    rendered_text text NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
    sent_at timestamptz,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_queue_campaign_status ON campaign_queue(campaign_id, status);

-- 3. Tabela de Acesso Magic Link do Contador
CREATE TABLE IF NOT EXISTS tenant_accountant_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    pin_code text,
    name text NOT NULL DEFAULT 'Escritório de Contabilidade',
    expires_at timestamptz,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accountant_access_token ON tenant_accountant_access(token);

-- 4. Tabela de Terminais Físicos Smart POS (Maquininhas de Cartão)
CREATE TABLE IF NOT EXISTS tenant_pos_terminals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_name text NOT NULL,
    provider text NOT NULL CHECK (provider IN ('mercado_pago_point', 'pagbank_smart', 'stone_terminal', 'pos_simulator')),
    device_serial_or_id text NOT NULL,
    status text NOT NULL CHECK (status IN ('online', 'offline', 'busy')) DEFAULT 'online',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_pos_terminals_tenant ON tenant_pos_terminals(tenant_id, status);

-- 5. Tabela de Intenções de Pagamento Smart POS
CREATE TABLE IF NOT EXISTS pos_payment_intents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    terminal_id uuid NOT NULL REFERENCES tenant_pos_terminals(id) ON DELETE CASCADE,
    amount numeric(10, 2) NOT NULL,
    payment_method text NOT NULL DEFAULT 'card',
    status text NOT NULL CHECK (status IN ('waiting_card', 'processing', 'approved', 'rejected', 'cancelled')) DEFAULT 'waiting_card',
    external_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pos_payment_intents_appt ON pos_payment_intents(appointment_id, status);

-- 6. Tabela de Escalas, Folgas e Atestados dos Barbeiros
CREATE TABLE IF NOT EXISTS barber_time_off (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    barber_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text NOT NULL CHECK (reason IN ('folga_semanal', 'ferias', 'atestado', 'outros')) DEFAULT 'folga_semanal',
    notes text,
    approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_barber_time_off_dates ON barber_time_off(tenant_id, barber_id, start_date, end_date);

-- 7. Habilitação de RLS
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_accountant_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_pos_terminals ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE barber_time_off ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Tenant owners manage marketing campaigns"
    ON marketing_campaigns FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );

CREATE POLICY "Tenant owners manage campaign queue"
    ON campaign_queue FOR ALL
    USING (
        campaign_id IN (
            SELECT id FROM marketing_campaigns WHERE tenant_id IN (
                SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
            )
        )
    );

CREATE POLICY "Tenant owners manage accountant access"
    ON tenant_accountant_access FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );

CREATE POLICY "Tenant staff view terminals"
    ON tenant_pos_terminals FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Tenant owners manage terminals"
    ON tenant_pos_terminals FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );

CREATE POLICY "Tenant staff manage payment intents"
    ON pos_payment_intents FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Tenant staff view time off"
    ON barber_time_off FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Tenant owners manage time off"
    ON barber_time_off FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );
