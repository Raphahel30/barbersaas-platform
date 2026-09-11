-- ============================================================================
-- SEED DATA DE HOMOLOGAÇÃO E AMBIENTE DE TESTES 100% COMPLETO
-- Sistema SaaS White-Label para Redes e Barbearias de Alta Performance
-- ============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
create extension if not exists pgcrypto with schema extensions;

-- 2. CONFIGURAÇÕES GLOBAIS DO SAAS (system_settings)
insert into public.system_settings (id, grace_period_days, landing_content, created_at, updated_at)
values (
  true,
  5,
  '{
    "hero": {
      "badgeText": "Acelerador de Faturamento para Barbearias",
      "title": "Transforme sua Barbearia em uma Máquina de Retenção e Lucro",
      "subtitle": "Agendamento sem atritos via WhatsApp, pagamentos multi-gateway, fechamento de caixa com repasse manual líquido e programa de fidelidade completo.",
      "ctaText": "Criar Minha Barbearia Grátis",
      "secondaryCtaText": "Ver Demonstração ao Vivo",
      "heroImageUrl": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80"
    },
    "socialProof": {
      "enabled": true,
      "heading": "Utilizado por mais de 500 barbearias em todo o Brasil",
      "stats": [
        { "label": "Cortes Agendados", "value": "+250.000" },
        { "label": "Redução de No-Show", "value": "-87%" },
        { "label": "Retenção de Clientes", "value": "+42%" },
        { "label": "Repasses Calculados", "value": "R$ 4.8M+" }
      ],
      "logos": [
        { "name": "Barbearia Vintage Club" },
        { "name": "El Patron Barber" },
        { "name": "Classic Beard Co." },
        { "name": "Black Skull Barber" }
      ]
    },
    "modules": {
      "enabled": true,
      "heading": "Tudo o que sua barbearia precisa em um único sistema",
      "subheading": "Funcionalidades desenhadas sob medida para o fluxo real de trabalho de uma barbearia de alta performance.",
      "items": [
        { "icon": "calendar", "title": "Motor de Agendamento Inteligente", "description": "Bloqueio de horários duplicados, cálculo de buffers pós-corte e holds provisórios de 5 minutos com trava Pix." },
        { "icon": "zap", "title": "Multi-Gateways One-Click", "description": "Conecte Mercado Pago, Asaas, PagSeguro ou InfinitePay com 1 clique direto na conta de recebimento." },
        { "icon": "dollar-sign", "title": "Fechamento de Caixa e Repasse Líquido", "description": "Cálculo de comissão descontando o dinheiro em mãos recebido no balcão para transferência líquida via Pix." },
        { "icon": "heart", "title": "Fidelidade e Aniversariantes", "description": "Cartão de selos interativo com validade de 30 dias e recompensas exclusivas automáticas de aniversário." },
        { "icon": "crown", "title": "Clube de Assinatura VIP", "description": "Planos mensais por frequência com bloqueio imediato por inadimplência e isenção de sinal de reserva." },
        { "icon": "smartphone", "title": "PWA White-Label & Galeria", "description": "Aplicativo instalado na tela do celular do cliente com suas cores, sua marca e fotos de cortes reais." }
      ]
    },
    "testimonials": {
      "enabled": true,
      "heading": "Quem usa e confia",
      "items": [
        { "author": "Carlos Eduardo", "role": "Proprietário", "shopName": "Barbearia D’Ouro", "quote": "Acabou o estresse no sábado à noite para fechar a comissão da equipe. O sistema calcula o valor líquido e eu só faço o Pix com o comprovante." },
        { "author": "Marcos Vinícius", "role": "Mestre Barbeiro", "shopName": "Navalha de Ouro", "quote": "Nossos clientes adoram o cartão de fidelidade no celular. A taxa de retorno em menos de 30 dias aumentou visivelmente." }
      ]
    },
    "faq": {
      "enabled": true,
      "heading": "Perguntas Frequentes",
      "items": [
        { "question": "Preciso pagar mensalidade durante o período de teste?", "answer": "Não! Você tem dias de teste gratuito sem precisar cadastrar cartão de crédito." },
        { "question": "Como funciona o recebimento dos sinais de reserva?", "answer": "O valor do sinal vai direto para a sua conta do gateway conectado, sem intermediação." }
      ]
    }
  }'::jsonb,
  now(),
  now()
)
on conflict (id) do update set
  grace_period_days = excluded.grace_period_days,
  landing_content = excluded.landing_content,
  updated_at = now();

-- 3. PLANOS DO SAAS (plans)
insert into public.plans (id, name, monthly_price, max_barbers, is_active, created_at, updated_at)
values
  ('11111111-1111-4000-8000-000000000001', 'Plano Solo', 49.90, 3, true, now(), now()),
  ('11111111-1111-4000-8000-000000000002', 'Plano Prime', 99.90, 7, true, now(), now()),
  ('11111111-1111-4000-8000-000000000003', 'Plano Elite Multi-Filiais', 199.90, 15, true, now(), now())
on conflict (id) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  max_barbers = excluded.max_barbers,
  is_active = excluded.is_active,
  updated_at = now();

-- 4. USUÁRIOS NO AUTH (auth.users)
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  -- Super Admin da Plataforma
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rafaelcassu@gmail.com', extensions.crypt('SenhaMestra123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rafael Cassu"}', now(), now()),
  -- Dono da Barbearia
  ('00000000-0000-4000-a000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carlos@imperialbarber.com.br', extensions.crypt('Senha123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Carlos Alberto Silva"}', now(), now()),
  -- Barbeiro 1
  ('00000000-0000-4000-a000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'diego@imperialbarber.com.br', extensions.crypt('Senha123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Diego Mestre da Navalha"}', now(), now()),
  -- Barbeiro 2
  ('00000000-0000-4000-a000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'lucas@imperialbarber.com.br', extensions.crypt('Senha123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Lucas Barber Fade"}', now(), now()),
  -- Cliente 1 (Comum)
  ('00000000-0000-4000-a000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bruno.cliente@gmail.com', extensions.crypt('Senha123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Bruno Santos"}', now(), now()),
  -- Cliente 2 (Fidelidade quase completa)
  ('00000000-0000-4000-a000-000000000020', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rodrigo.fidelidade@gmail.com', extensions.crypt('Senha123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Rodrigo Lima"}', now(), now()),
  -- Cliente 3 (Assinante VIP)
  ('00000000-0000-4000-a000-000000000030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'felipe.vip@gmail.com', extensions.crypt('Senha123!', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Felipe Albuquerque"}', now(), now())
on conflict (id) do nothing;

-- 5. ORGANIZAÇÃO REDE MULTI-FILIAIS (organizations)
insert into public.organizations (id, name, owner_user_id, is_multi_branch, created_at)
values (
  '22222222-2222-4000-8000-000000000001',
  'Rede Barbearia Imperial',
  '00000000-0000-4000-a000-000000000002',
  true,
  now()
)
on conflict (id) do update set
  name = excluded.name,
  is_multi_branch = excluded.is_multi_branch;

-- 6. DUAS FILIAIS / TENANTS (tenants)
insert into public.tenants (
  id, organization_id, plan_id, name, slug, custom_domain, status, trial_ends_at, address, visual_settings, created_at, updated_at
) values
  -- Filial 1: Matriz Jardins (com domínio customizado configurado)
  (
    '33333333-3333-4000-8000-000000000001',
    '22222222-2222-4000-8000-000000000001',
    '11111111-1111-4000-8000-000000000003',
    'Barbearia Imperial - Matriz Jardins',
    'imperial-matriz',
    'barbeariaimperial.com.br',
    'active',
    now() + interval '30 days',
    '{"line1":"Rua Oscar Freire, 1280","city":"São Paulo","state":"SP","postal_code":"01426-001"}'::jsonb,
    '{
      "logoUrl": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=200&q=80",
      "faviconUrl": "",
      "bannerUrl": "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80",
      "primaryColor": "#f59e0b",
      "secondaryColor": "#d97706",
      "fontFamily": "outfit",
      "texture": "vintage",
      "instagram": "@barbeariaimperial",
      "whatsapp": "11988887777",
      "phone": "(11) 3088-9900",
      "openingHoursText": "Seg a Sáb: 09h às 21h",
      "addressText": "Rua Oscar Freire, 1280 - Jardins, São Paulo/SP"
    }'::jsonb,
    now(),
    now()
  ),
  -- Filial 2: Shopping Iguatemi (slug próprio)
  (
    '33333333-3333-4000-8000-000000000002',
    '22222222-2222-4000-8000-000000000001',
    '11111111-1111-4000-8000-000000000003',
    'Barbearia Imperial - Shopping Iguatemi',
    'imperial-iguatemi',
    null,
    'active',
    now() + interval '30 days',
    '{"line1":"Av. Brigadeiro Faria Lima, 2232 - Piso Térreo","city":"São Paulo","state":"SP","postal_code":"01451-000"}'::jsonb,
    '{
      "logoUrl": "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=200&q=80",
      "faviconUrl": "",
      "bannerUrl": "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
      "primaryColor": "#10b981",
      "secondaryColor": "#059669",
      "fontFamily": "sans",
      "texture": "minimal",
      "instagram": "@imperial.iguatemi",
      "whatsapp": "11977776666",
      "phone": "(11) 3815-5544",
      "openingHoursText": "Seg a Sáb: 10h às 22h | Dom: 14h às 20h",
      "addressText": "Av. Brig. Faria Lima, 2232 - Piso Térreo, São Paulo/SP"
    }'::jsonb,
    now(),
    now()
  )
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  custom_domain = excluded.custom_domain,
  status = excluded.status,
  visual_settings = excluded.visual_settings,
  updated_at = now();

-- 7. CONFIGURAÇÕES DAS BARBEARIAS (tenant_settings)
insert into public.tenant_settings (
  tenant_id, timezone, allow_vip_members, credits_validity_days, hold_timeout_minutes,
  enable_product_commission, notify_barber_on_booking, closing_buffer_minutes,
  cancellation_notice_hours, no_show_commission_enabled, no_show_commission_percent,
  no_show_policy, vip_payment_mode, fidelity_rules, birthday_rules, created_at, updated_at
) values
  (
    '33333333-3333-4000-8000-000000000001',
    'America/Sao_Paulo',
    true,
    30,
    5,
    true,
    true,
    5,
    3,
    true,
    100.00,
    'gateway_refund',
    'recurrent_card',
    '{"target_stamps":10,"validity_days":30,"reward_type":"full_discount"}'::jsonb,
    '{"mode":"birth_month","reward_type":"percentage_discount","percentage":20,"validity_days":30}'::jsonb,
    now(),
    now()
  ),
  (
    '33333333-3333-4000-8000-000000000002',
    'America/Sao_Paulo',
    true,
    30,
    5,
    true,
    true,
    5,
    3,
    true,
    100.00,
    'gateway_refund',
    'recurrent_card',
    '{"target_stamps":10,"validity_days":30,"reward_type":"full_discount"}'::jsonb,
    '{"mode":"birth_month","reward_type":"percentage_discount","percentage":20,"validity_days":30}'::jsonb,
    now(),
    now()
  )
on conflict (tenant_id) do update set
  timezone = excluded.timezone,
  allow_vip_members = excluded.allow_vip_members,
  fidelity_rules = excluded.fidelity_rules,
  updated_at = now();

-- 8. PERFIS (profiles)
insert into public.profiles (
  id, tenant_id, role, full_name, email, phone, birth_date, commission_percent, is_active, created_at, updated_at
) values
  -- Super Admin
  ('00000000-0000-4000-a000-000000000001', null, 'super_admin', 'Rafael Cassu', 'rafaelcassu@gmail.com', '11999990000', '1990-05-15', 0, true, now(), now()),
  -- Dono
  ('00000000-0000-4000-a000-000000000002', '33333333-3333-4000-8000-000000000001', 'owner', 'Carlos Alberto Silva', 'carlos@imperialbarber.com.br', '11988880000', '1985-10-20', 0, true, now(), now()),
  -- Barbeiro 1 (Diego - 50% de comissão)
  ('00000000-0000-4000-a000-000000000003', '33333333-3333-4000-8000-000000000001', 'barber', 'Diego Mestre da Navalha', 'diego@imperialbarber.com.br', '11988887777', '1992-03-12', 50.00, true, now(), now()),
  -- Barbeiro 2 (Lucas - 45% de comissão)
  ('00000000-0000-4000-a000-000000000004', '33333333-3333-4000-8000-000000000001', 'barber', 'Lucas Barber Fade', 'lucas@imperialbarber.com.br', '11977776666', '1996-08-25', 45.00, true, now(), now()),
  -- Cliente 1 (Bruno - Cliente Comum)
  ('00000000-0000-4000-a000-000000000010', '33333333-3333-4000-8000-000000000001', 'client', 'Bruno Santos', 'bruno.cliente@gmail.com', '11999991111', '1994-07-08', 0, true, now(), now()),
  -- Cliente 2 (Rodrigo - 9 Selos de Fidelidade)
  ('00000000-0000-4000-a000-000000000020', '33333333-3333-4000-8000-000000000001', 'client', 'Rodrigo Lima', 'rodrigo.fidelidade@gmail.com', '11999992222', '1989-11-30', 0, true, now(), now()),
  -- Cliente 3 (Felipe - Assinante VIP)
  ('00000000-0000-4000-a000-000000000030', '33333333-3333-4000-8000-000000000001', 'client', 'Felipe Albuquerque', 'felipe.vip@gmail.com', '11999993333', '1991-04-14', 0, true, now(), now())
on conflict (id) do update set
  full_name = excluded.full_name,
  commission_percent = excluded.commission_percent,
  is_active = excluded.is_active,
  updated_at = now();

-- 9. HORÁRIOS DA EQUIPE (barber_schedules)
-- Configura de Segunda (1) a Sábado (6) para ambos os barbeiros
insert into public.barber_schedules (
  tenant_id, barber_id, weekday, starts_at, ends_at, break_starts_at, break_ends_at, slot_interval_minutes, is_active, is_day_off
)
select
  '33333333-3333-4000-8000-000000000001'::uuid,
  b.id,
  w.day,
  '09:00:00'::time,
  '20:00:00'::time,
  '12:30:00'::time,
  '13:30:00'::time,
  30,
  true,
  false
from (values
  ('00000000-0000-4000-a000-000000000003'::uuid),
  ('00000000-0000-4000-a000-000000000004'::uuid)
) as b(id)
cross join (values (1), (2), (3), (4), (5), (6)) as w(day)
on conflict (tenant_id, barber_id, weekday) do nothing;

-- Domingo folga
insert into public.barber_schedules (
  tenant_id, barber_id, weekday, starts_at, ends_at, slot_interval_minutes, is_active, is_day_off
)
values
  ('33333333-3333-4000-8000-000000000001', '00000000-0000-4000-a000-000000000003', 0, '09:00:00', '14:00:00', 30, true, true),
  ('33333333-3333-4000-8000-000000000001', '00000000-0000-4000-a000-000000000004', 0, '09:00:00', '14:00:00', 30, true, true)
on conflict (tenant_id, barber_id, weekday) do nothing;

-- 10. CATÁLOGO DE SERVIÇOS (services)
insert into public.services (
  id, tenant_id, name, description, duration_minutes, cleanup_minutes, price, reservation_fee, is_active, created_at, updated_at
) values
  ('44444444-4444-4000-8000-000000000001', '33333333-3333-4000-8000-000000000001', 'Corte Degradê / Fade', 'Corte moderno na tesoura e máquina com acabamento de navalha e alinhamento.', 30, 5, 55.00, 15.00, true, now(), now()),
  ('44444444-4444-4000-8000-000000000002', '33333333-3333-4000-8000-000000000001', 'Barboterapia com Toalha Quente', 'Tratamento completo para barba com toalha aquecida, óleos essenciais, massagem e navalha afiada.', 30, 5, 45.00, 15.00, true, now(), now()),
  ('44444444-4444-4000-8000-000000000003', '33333333-3333-4000-8000-000000000001', 'Combo Cabelo + Barba', 'Experiência completa com corte de cabelo personalizado e barboterapia relaxante.', 55, 5, 90.00, 25.00, true, now(), now()),
  ('44444444-4444-4000-8000-000000000004', '33333333-3333-4000-8000-000000000001', 'Design de Sobrancelha', 'Alinhamento e limpeza do contorno da sobrancelha na lâmina descartável.', 15, 0, 25.00, 10.00, true, now(), now())
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  reservation_fee = excluded.reservation_fee,
  duration_minutes = excluded.duration_minutes,
  cleanup_minutes = excluded.cleanup_minutes,
  updated_at = now();

-- 11. PRODUTOS DO PDV (products)
insert into public.products (
  id, tenant_id, name, sku, description, price, stock_quantity, commission_percent, commission_fixed, is_active, created_at, updated_at
) values
  ('55555555-5555-4000-8000-000000000001', '33333333-3333-4000-8000-000000000001', 'Pomada Matte Modeladora Efeito Seco', 'POM-MATTE-150G', 'Fixação forte e duradoura sem brilho para todos os tipos de cabelo.', 48.00, 35, 15.00, 0.00, true, now(), now()),
  ('55555555-5555-4000-8000-000000000002', '33333333-3333-4000-8000-000000000001', 'Óleo Hidratante de Barba Amadeirado', 'OLEO-BARBA-30ML', 'Hidratação profunda com aroma nobre de cedro e bergamota.', 39.00, 20, 15.00, 0.00, true, now(), now())
on conflict (id) do update set
  name = excluded.name,
  price = excluded.price,
  stock_quantity = excluded.stock_quantity,
  commission_percent = excluded.commission_percent,
  updated_at = now();

-- 12. PLANO VIP QUINZENAL (vip_plans)
insert into public.vip_plans (
  id, tenant_id, name, description, monthly_price, included_services, allow_fidelity_stamps, frequency, usage_interval_days, is_active, created_at, updated_at
) values (
  '66666666-6666-4000-8000-000000000001',
  '33333333-3333-4000-8000-000000000001',
  'Clube VIP Imperial Quinzenal',
  'Cortes ilimitados respeitando intervalo mínimo de 15 dias entre atendimentos + Barba inclusa.',
  119.90,
  '["44444444-4444-4000-8000-000000000001", "44444444-4444-4000-8000-000000000002"]'::jsonb,
  false,
  'biweekly',
  15,
  true,
  now(),
  now()
)
on conflict (id) do update set
  name = excluded.name,
  monthly_price = excluded.monthly_price,
  included_services = excluded.included_services,
  updated_at = now();

-- 13. ASSINATURA VIP DO CLIENTE 3 (client_subscriptions)
insert into public.client_subscriptions (
  id, tenant_id, client_id, vip_plan_id, status, current_period_start, current_period_end, created_at, updated_at
) values (
  '77777777-7777-4000-8000-000000000001',
  '33333333-3333-4000-8000-000000000001',
  '00000000-0000-4000-a000-000000000030',
  '66666666-6666-4000-8000-000000000001',
  'active',
  current_date - interval '10 days',
  current_date + interval '20 days',
  now(),
  now()
)
on conflict (id) do update set
  status = excluded.status,
  current_period_start = excluded.current_period_start,
  current_period_end = excluded.current_period_end,
  updated_at = now();

-- 14. CARTÃO DE FIDELIDADE COM 9 SELOS DO CLIENTE 2 (fidelity_cards)
insert into public.fidelity_cards (
  id, tenant_id, client_id, stamps_count, target_stamps, expires_at, reward_type, created_at, updated_at
) values (
  '88888888-8888-4000-8000-000000000001',
  '33333333-3333-4000-8000-000000000001',
  '00000000-0000-4000-a000-000000000020',
  9,
  10,
  now() + interval '25 days',
  'full_discount',
  now(),
  now()
)
on conflict (tenant_id, client_id) do update set
  stamps_count = 9,
  expires_at = now() + interval '25 days',
  updated_at = now();

-- 15. AGENDAMENTOS HISTÓRICOS E ATENDIMENTOS DO DIA (appointments)
-- Agendamento 1: Concluído e Quitado no Balcão para o Cliente 1 (com comissão gerada)
insert into public.appointments (
  id, tenant_id, barber_id, client_id, status, starts_at, ends_at,
  is_walk_in, is_quick_sale, total_amount, reservation_fee, reservation_fee_paid,
  balance_paid_amount, cash_received_by_barber, payment_method, payment_status,
  completed_at, settled_at, created_at, updated_at
) values (
  '99999999-9999-4000-8000-000000000001',
  '33333333-3333-4000-8000-000000000001',
  '00000000-0000-4000-a000-000000000003',
  '00000000-0000-4000-a000-000000000010',
  'completed',
  now() - interval '2 hours',
  now() - interval '1 hour 30 minutes',
  false,
  false,
  55.00,
  15.00,
  15.00,
  40.00,
  40.00, -- Dinheiro em mãos recebido pelo barbeiro
  'cash',
  'paid',
  now() - interval '1 hour 30 minutes',
  now() - interval '1 hour 30 minutes',
  now() - interval '1 day',
  now()
)
on conflict (id) do nothing;

-- Serviços do agendamento 1
insert into public.appointment_services (
  appointment_id, service_id, service_name, duration_minutes, unit_price
) values (
  '99999999-9999-4000-8000-000000000001',
  '44444444-4444-4000-8000-000000000001',
  'Corte Degradê / Fade',
  35,
  55.00
)
on conflict do nothing;

-- Comissão correspondente de 50% = R$ 27,50
insert into public.commissions (
  tenant_id, barber_id, appointment_id, base_amount, rate_percent, fixed_amount, commission_amount, status, is_no_show, created_at
) values (
  '33333333-3333-4000-8000-000000000001',
  '00000000-0000-4000-a000-000000000003',
  '99999999-9999-4000-8000-000000000001',
  55.00,
  50.00,
  0.00,
  27.50,
  'payable',
  false,
  now() - interval '1 hour 30 minutes'
)
on conflict do nothing;

-- 16. GALERIA DE CORTES (gallery_photos)
insert into public.gallery_photos (
  id, tenant_id, barber_id, client_id, storage_path, caption, is_public, created_at
) values
  (
    'aaaaaaaa-aaaa-4000-8000-000000000001',
    '33333333-3333-4000-8000-000000000001',
    '00000000-0000-4000-a000-000000000003',
    '00000000-0000-4000-a000-000000000010',
    'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=600&q=80',
    'Fade Americano impecável com acabamento na navalha afiada.',
    true,
    now() - interval '2 days'
  ),
  (
    'aaaaaaaa-aaaa-4000-8000-000000000002',
    '33333333-3333-4000-8000-000000000001',
    '00000000-0000-4000-a000-000000000004',
    null,
    'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=600&q=80',
    'Barboterapia completa com alinhamento de contornos.',
    true,
    now() - interval '1 day'
  )
on conflict (id) do nothing;
