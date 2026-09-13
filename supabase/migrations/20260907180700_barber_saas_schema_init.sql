-- Limpeza das tabelas legadas do WedoFeast com permissão explícita do usuário
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.listings CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

-- Extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Planos
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  min_professionals INT NOT NULL DEFAULT 1,
  max_professionals INT NOT NULL DEFAULT 3,
  price_cents INT NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  is_active BOOLEAN DEFAULT TRUE,
  annual_discount_percentage INT DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.plans (name, slug, description, min_professionals, max_professionals, price_cents, annual_discount_percentage) VALUES
('Plano 1 - Starter', 'starter', 'Ideal para barbearias individuais ou pequenas equipes (1 a 3 barbeiros)', 1, 3, 8900, 20),
('Plano 2 - Pro', 'pro', 'Para barbearias em expansão com equipe média (4 a 7 barbeiros)', 4, 7, 16900, 20),
('Plano 3 - Elite', 'elite', 'Para grandes barbearias ou redes com alto fluxo (8 a 15 barbeiros)', 8, 15, 29900, 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  min_professionals = EXCLUDED.min_professionals,
  max_professionals = EXCLUDED.max_professionals,
  price_cents = EXCLUDED.price_cents;

-- Inquilinos / Tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID,
  owner_email VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  custom_domain VARCHAR(255) UNIQUE,
  custom_domain_status VARCHAR(50) DEFAULT 'pending',
  plan_id UUID REFERENCES public.plans(id) ON DELETE RESTRICT,
  status VARCHAR(30) DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  theme_config JSONB DEFAULT '{
    "primary_color": "#D97706",
    "secondary_color": "#1F2937",
    "background_color": "#0F172A",
    "font_family": "Plus Jakarta Sans",
    "font_color": "#F8FAFC",
    "logo_url": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150&auto=format&fit=crop&q=80",
    "banner_url": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&auto=format&fit=crop&q=80"
  }'::JSONB,
  sections_config JSONB DEFAULT '{
    "show_hero": true,
    "show_services": true,
    "show_team": true,
    "show_gallery": true,
    "show_testimonials": true,
    "show_booking": true,
    "show_contact": true,
    "custom_cta_text": "Agendar Agora"
  }'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Perfis
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'barber_owner',
  is_master BOOLEAN DEFAULT FALSE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profissionais
CREATE TABLE IF NOT EXISTS public.professionals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  phone VARCHAR(50),
  specialty VARCHAR(100) DEFAULT 'Cortes Clássicos & Barba',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Serviços
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 30,
  price_cents INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  professional_id UUID NOT NULL REFERENCES public.professionals(id) ON DELETE RESTRICT,
  customer_name VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(50) NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(30) DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações Globais
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform_name VARCHAR(150) NOT NULL DEFAULT 'BarberSaaS White-label',
  platform_tagline VARCHAR(255) DEFAULT 'A plataforma definitiva para barbearias de alta performance',
  support_whatsapp VARCHAR(50) DEFAULT '(11) 99999-8888',
  support_email VARCHAR(120) DEFAULT 'suporte@barbersaas.com',
  default_trial_days INT NOT NULL DEFAULT 14,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  cloudflare_cname_target VARCHAR(200) NOT NULL DEFAULT 'cname.barbersaas.com',
  cloudflare_fallback_origin VARCHAR(200) DEFAULT 'app.barbersaas.com',
  terms_url TEXT DEFAULT '/terms',
  privacy_url TEXT DEFAULT '/privacy',
  annual_discount_percentage INT NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by VARCHAR(120) DEFAULT 'rafaelcassu@gmail.com'
);

INSERT INTO public.system_settings (id, platform_name, support_whatsapp, support_email)
VALUES ('00000000-0000-0000-0000-000000000001', 'BarberSaaS White-label', '(11) 99999-8888', 'suporte@barbersaas.com')
ON CONFLICT (id) DO NOTHING;

-- Função is_master_admin
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS BOOLEAN AS $$
BEGIN
  IF (auth.jwt() ->> 'email') = 'rafaelcassu@gmail.com' THEN
    RETURN TRUE;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'master_admin' OR is_master = TRUE OR email = 'rafaelcassu@gmail.com')
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger de Limite de Profissionais
CREATE OR REPLACE FUNCTION check_professional_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_plan_max INT;
  v_current_count INT;
  v_tenant_name VARCHAR(255);
BEGIN
  SELECT p.max_professionals, t.name INTO v_plan_max, v_tenant_name
  FROM public.tenants t
  JOIN public.plans p ON p.id = t.plan_id
  WHERE t.id = NEW.tenant_id;

  IF v_plan_max IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado para este inquilino.';
  END IF;

  SELECT COUNT(*) INTO v_current_count
  FROM public.professionals
  WHERE tenant_id = NEW.tenant_id AND is_active = TRUE;

  IF (TG_OP = 'UPDATE') THEN
    IF (OLD.is_active = TRUE AND NEW.is_active = TRUE) THEN
      RETURN NEW;
    END IF;
  END IF;

  IF v_current_count >= v_plan_max THEN
    RAISE EXCEPTION 'Limite de profissionais do seu plano (% barbeiros) foi atingido para %! Faça upgrade do plano para adicionar mais barbeiros.', v_plan_max, v_tenant_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_professional_limit ON public.professionals;
CREATE TRIGGER trg_enforce_professional_limit
BEFORE INSERT OR UPDATE OF is_active ON public.professionals
FOR EACH ROW
WHEN (NEW.is_active = TRUE)
EXECUTE FUNCTION check_professional_limit();

-- Trigger Auto-promoção do Master Admin
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_master)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'rafaelcassu@gmail.com' THEN 'master_admin'
      ELSE 'barber_owner'
    END,
    CASE 
      WHEN NEW.email = 'rafaelcassu@gmail.com' THEN TRUE
      ELSE FALSE
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    role = CASE WHEN NEW.email = 'rafaelcassu@gmail.com' THEN 'master_admin' ELSE profiles.role END,
    is_master = CASE WHEN NEW.email = 'rafaelcassu@gmail.com' THEN TRUE ELSE profiles.is_master END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Public read active plans" ON public.plans;
CREATE POLICY "Public read active plans" ON public.plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Master admin manage plans" ON public.plans;
CREATE POLICY "Master admin manage plans" ON public.plans FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Public read system settings" ON public.system_settings;
CREATE POLICY "Public read system settings" ON public.system_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Master admin manage system settings" ON public.system_settings;
CREATE POLICY "Master admin manage system settings" ON public.system_settings FOR ALL USING (public.is_master_admin()) WITH CHECK (public.is_master_admin());

DROP POLICY IF EXISTS "Public read for tenants by slug or domain" ON public.tenants;
CREATE POLICY "Public read for tenants by slug or domain" ON public.tenants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tenant owner or master manage tenants" ON public.tenants;
CREATE POLICY "Tenant owner or master manage tenants" ON public.tenants FOR ALL USING (
  owner_id = auth.uid() OR public.is_master_admin()
) WITH CHECK (
  owner_id = auth.uid() OR public.is_master_admin()
);

DROP POLICY IF EXISTS "Public read active professionals" ON public.professionals;
CREATE POLICY "Public read active professionals" ON public.professionals FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Tenant owner or master manage professionals" ON public.professionals;
CREATE POLICY "Tenant owner or master manage professionals" ON public.professionals FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR public.is_master_admin()
) WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR public.is_master_admin()
);

DROP POLICY IF EXISTS "Public read active services" ON public.services;
CREATE POLICY "Public read active services" ON public.services FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Tenant owner or master manage services" ON public.services;
CREATE POLICY "Tenant owner or master manage services" ON public.services FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR public.is_master_admin()
) WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR public.is_master_admin()
);

DROP POLICY IF EXISTS "Public create appointment" ON public.appointments;
CREATE POLICY "Public create appointment" ON public.appointments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Tenant owner or master manage appointments" ON public.appointments;
CREATE POLICY "Tenant owner or master manage appointments" ON public.appointments FOR ALL USING (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR public.is_master_admin()
) WITH CHECK (
  tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid()) OR public.is_master_admin()
);
