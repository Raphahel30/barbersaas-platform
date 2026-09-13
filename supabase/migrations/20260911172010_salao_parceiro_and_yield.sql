ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tax_document text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS legal_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS partner_contract_signed_at timestamptz;

CREATE TABLE IF NOT EXISTS tenant_yield_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
    starts_at text NOT NULL,
    ends_at text NOT NULL,
    discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
    discount_value numeric(10, 2) NOT NULL DEFAULT 0,
    require_full_reservation_fee boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_yield_rules_tenant ON tenant_yield_rules(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS tenant_suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    contact_name text,
    phone text,
    whatsapp text NOT NULL,
    email text,
    catalog_notes text,
    lead_time_days integer NOT NULL DEFAULT 3,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_suppliers_tenant ON tenant_suppliers(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    supplier_id uuid REFERENCES tenant_suppliers(id) ON DELETE SET NULL,
    order_number text NOT NULL,
    status text NOT NULL CHECK (status IN ('draft', 'sent', 'received', 'cancelled')) DEFAULT 'draft',
    items jsonb NOT NULL DEFAULT '[]'::jsonb,
    total_estimated_cost numeric(10, 2) NOT NULL DEFAULT 0,
    notes text,
    sent_at timestamptz,
    received_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant ON purchase_orders(tenant_id, status);

CREATE TABLE IF NOT EXISTS client_visagism_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    face_shape text NOT NULL CHECK (face_shape IN ('oval', 'square', 'round', 'diamond', 'heart')),
    selfie_url text,
    recommended_hair_styles text[] NOT NULL DEFAULT '{}',
    recommended_beard_styles text[] NOT NULL DEFAULT '{}',
    recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
    notes text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visagism_profiles_tenant_client ON client_visagism_profiles(tenant_id, client_id);

ALTER TABLE tenant_yield_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_visagism_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant staff can view yield rules" ON tenant_yield_rules;
CREATE POLICY "Tenant staff can view yield rules"
    ON tenant_yield_rules FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant owners can manage yield rules" ON tenant_yield_rules;
CREATE POLICY "Tenant owners can manage yield rules"
    ON tenant_yield_rules FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant staff can view suppliers" ON tenant_suppliers;
CREATE POLICY "Tenant staff can view suppliers"
    ON tenant_suppliers FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant owners can manage suppliers" ON tenant_suppliers;
CREATE POLICY "Tenant owners can manage suppliers"
    ON tenant_suppliers FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant staff can view purchase orders" ON purchase_orders;
CREATE POLICY "Tenant staff can view purchase orders"
    ON purchase_orders FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Tenant owners can manage purchase orders" ON purchase_orders;
CREATE POLICY "Tenant owners can manage purchase orders"
    ON purchase_orders FOR ALL
    USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Clients can view own visagism profile" ON client_visagism_profiles;
CREATE POLICY "Clients can view own visagism profile"
    ON client_visagism_profiles FOR SELECT
    USING (
        client_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'barber', 'receptionist', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Tenant clients and staff can insert visagism profile" ON client_visagism_profiles;
CREATE POLICY "Tenant clients and staff can insert visagism profile"
    ON client_visagism_profiles FOR INSERT
    WITH CHECK (
        client_id = auth.uid() OR
        tenant_id IN (
            SELECT tenant_id FROM profiles WHERE id = auth.uid()
        )
    );
