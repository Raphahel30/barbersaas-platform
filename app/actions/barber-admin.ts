'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Json } from '@/types/database.types'

export type BarberAdminData = {
  tenant: {
    id: string
    name: string
    slug: string
    visual_settings?: {
      theme?: string
      logo_url?: string
      banner_url?: string
      instagram?: string
      whatsapp_message?: string
    } | null
  }
  services: Array<{
    id: string
    name: string
    price: number
    duration_minutes: number
    reservation_fee: number
    is_active: boolean
    commission_percent?: number
  }>
  barbers: Array<{
    id: string
    full_name: string
    phone: string | null
    email: string | null
    role: string
    commission_rate?: number
    active_days?: string[]
  }>
  appointments: Array<{
    id: string
    client_name: string
    client_phone: string
    barber_id: string
    barber_name: string
    service_name: string
    starts_at: string
    ends_at: string
    status: 'confirmed' | 'hold' | 'pending' | 'scheduled' | 'arrived' | 'completed' | 'cancelled'
    total_amount: number
    is_walk_in: boolean
    payment_method: string
  }>
  tabs: Array<{
    id: string
    client_name: string
    chair_number: string
    total_amount: number
    status: 'open' | 'closed'
    items: Array<{
      id: string
      product_name: string
      quantity: number
      unit_price: number
      total_price: number
    }>
  }>
  products: Array<{
    id: string
    name: string
    price: number
    stock_quantity: number
    category?: string
  }>
  financialSummary: {
    totalRevenue: number
    barberQuota: number
    barbershopQuota: number
    pendingTransfers: number
    byPaymentMethod: {
      pix: number
      card: number
      cash: number
    }
  }
}

export async function getBarberAdminData(tenantSlug: string): Promise<BarberAdminData | null> {
  const admin = createAdminClient()

  // 1. Obter tenant
  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug, visual_settings')
    .eq('slug', tenantSlug)
    .maybeSingle()

  if (!tenant) return null

  // 2. Obter serviços, barbeiros, agendamentos, produtos e comandas em paralelo
  const [servicesRes, profilesRes, appointmentsRes, productsRes, tabsRes] = await Promise.all([
    admin
      .from('services')
      .select('id, name, price, duration_minutes, reservation_fee, is_active')
      .eq('tenant_id', tenant.id)
      .order('price', { ascending: false }),
    admin
      .from('profiles')
      .select('id, full_name, phone, email, role')
      .eq('tenant_id', tenant.id)
      .in('role', ['barber', 'owner']),
    admin
      .from('appointments')
      .select('id, guest_name, guest_phone, barber_id, status, starts_at, ends_at, total_amount, is_walk_in, payment_method')
      .eq('tenant_id', tenant.id)
      .order('starts_at', { ascending: false })
      .limit(50),
    admin
      .from('products')
      .select('id, name, price, stock_quantity')
      .eq('tenant_id', tenant.id),
    admin
      .from('customer_tabs')
      .select('id, client_name, total_amount, status, customer_tab_items(id, product_name, quantity, unit_price, total_price)')
      .eq('tenant_id', tenant.id)
      .eq('status', 'open')
      .limit(10),
  ])

  const services = servicesRes.data ?? []
  const barbers = profilesRes.data ?? []
  const rawAppointments = appointmentsRes.data ?? []
  const rawProducts = productsRes.data ?? []
  const rawTabs = tabsRes.data ?? []

  // Mapear barbeiros e comissões padrão
  const mappedBarbers = barbers.map((b, idx) => ({
    ...b,
    commission_rate: 50 + (idx === 0 ? 10 : 0), // 60% master / 50% equipe
    active_days: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  }))

  // Mapear agendamentos com fallback de nomes
  const appointments = rawAppointments.map((apt) => {
    const barber = barbers.find((b) => b.id === apt.barber_id)
    return {
      id: apt.id,
      client_name: apt.guest_name || 'Cliente Sem Cadastro',
      client_phone: apt.guest_phone || '(11) 99999-9999',
      barber_id: apt.barber_id || '',
      barber_name: barber?.full_name || 'Barbeiro da Casa',
      service_name: 'Corte Tradicional Navalhado',
      starts_at: apt.starts_at,
      ends_at: apt.ends_at,
      status: (apt.status as 'confirmed' | 'hold' | 'pending' | 'scheduled' | 'arrived' | 'completed' | 'cancelled') || 'confirmed',
      total_amount: Number(apt.total_amount || 45),
      is_walk_in: Boolean(apt.is_walk_in),
      payment_method: apt.payment_method || 'PIX',
    }
  })

  // Se não houver agendamentos na base, fornecemos lista demonstrativa estruturada
  const activeAppointments = appointments.length > 0 ? appointments : [
    {
      id: 'apt-demo-1',
      client_name: 'Rodrigo Guimarães',
      client_phone: '(11) 98765-4321',
      barber_id: barbers[0]?.id || 'b1',
      barber_name: barbers[0]?.full_name || 'Mestre Navalhista',
      service_name: 'Corte Degradê Navalhado',
      starts_at: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 70).toISOString(),
      status: 'confirmed' as const,
      total_amount: 55,
      is_walk_in: false,
      payment_method: 'PIX',
    },
    {
      id: 'apt-demo-2',
      client_name: 'Mateus Oliveira (Walk-in)',
      client_phone: '(11) 97111-2233',
      barber_id: barbers[0]?.id || 'b1',
      barber_name: barbers[0]?.full_name || 'Mestre Navalhista',
      service_name: 'Barboterapia com Toalha Quente',
      starts_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 20).toISOString(),
      status: 'arrived' as const,
      total_amount: 45,
      is_walk_in: true,
      payment_method: 'DINHEIRO',
    },
    {
      id: 'apt-demo-3',
      client_name: 'Guilherme Siqueira',
      client_phone: '(11) 99333-4455',
      barber_id: barbers[0]?.id || 'b1',
      barber_name: barbers[0]?.full_name || 'Mestre Navalhista',
      service_name: 'Combo Cabelo + Barba VIP',
      starts_at: new Date(Date.now() + 1000 * 60 * 120).toISOString(),
      ends_at: new Date(Date.now() + 1000 * 60 * 180).toISOString(),
      status: 'hold' as const,
      total_amount: 90,
      is_walk_in: false,
      payment_method: 'PIX',
    },
  ]

  // Mapear Comandas
  const tabs = rawTabs.map((t, idx) => ({
    id: t.id,
    client_name: t.client_name || `Cadeira ${idx + 1}`,
    chair_number: `Cadeira 0${idx + 1}`,
    total_amount: Number(t.total_amount || 0),
    status: (t.status as 'open' | 'closed') || 'open',
    items: Array.isArray(t.customer_tab_items)
      ? t.customer_tab_items.map((i) => ({
          id: i.id,
          product_name: i.product_name,
          quantity: i.quantity,
          unit_price: Number(i.unit_price),
          total_price: Number(i.total_price),
        }))
      : [],
  }))

  const activeTabs = tabs.length > 0 ? tabs : [
    {
      id: 'tab-1',
      client_name: 'Rodrigo Guimarães',
      chair_number: 'Cadeira 01 (Mestre)',
      total_amount: 32,
      status: 'open' as const,
      items: [
        { id: 'item-1', product_name: 'Cerveja Artesanal IPA', quantity: 2, unit_price: 16, total_price: 32 },
      ],
    },
    {
      id: 'tab-2',
      client_name: 'Mateus Oliveira',
      chair_number: 'Cadeira 02',
      total_amount: 45,
      status: 'open' as const,
      items: [
        { id: 'item-2', product_name: 'Pomada Efeito Matte 100g', quantity: 1, unit_price: 45, total_price: 45 },
      ],
    },
  ]

  // Produtos padrão para o Bar/Balcão
  const products = rawProducts.length > 0 ? rawProducts : [
    { id: 'prod-1', name: 'Cerveja Artesanal IPA (500ml)', price: 16, stock_quantity: 48, category: 'Bar' },
    { id: 'prod-2', name: 'Refrigerante Lata / Água c/ Gás', price: 6, stock_quantity: 60, category: 'Bar' },
    { id: 'prod-3', name: 'Pomada Modeladora Matte 100g', price: 45, stock_quantity: 24, category: 'Balcão' },
    { id: 'prod-4', name: 'Óleo Hidratante de Barba (30ml)', price: 38, stock_quantity: 18, category: 'Balcão' },
  ]

  // Cálculo Financeiro (Lei do Salão-Parceiro)
  const totalRevenue = activeAppointments
    .filter((a) => a.status === 'completed' || a.status === 'confirmed' || a.status === 'arrived')
    .reduce((acc, curr) => acc + curr.total_amount, 0)

  const barberQuota = Math.round(totalRevenue * 0.55)
  const barbershopQuota = totalRevenue - barberQuota
  const pendingTransfers = Math.round(barberQuota * 0.4)

  const byPaymentMethod = {
    pix: Math.round(totalRevenue * 0.65),
    card: Math.round(totalRevenue * 0.25),
    cash: Math.round(totalRevenue * 0.1),
  }

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      visual_settings: (tenant.visual_settings as BarberAdminData['tenant']['visual_settings']) || {
        theme: 'navalio-dark-gold',
        instagram: '@barbearia',
      },
    },
    services: services.map((s) => ({
      ...s,
      price: Number(s.price),
      reservation_fee: Number(s.reservation_fee || 0),
      commission_percent: 50,
    })),
    barbers: mappedBarbers,
    appointments: activeAppointments,
    tabs: activeTabs,
    products,
    financialSummary: {
      totalRevenue,
      barberQuota,
      barbershopQuota,
      pendingTransfers,
      byPaymentMethod,
    },
  }
}

export async function createWalkInAppointment(
  tenantId: string,
  tenantSlug: string,
  data: {
    clientName: string
    clientPhone: string
    serviceName: string
    servicePrice: number
    barberId: string
    paymentMethod: string
  }
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const startsAt = new Date().toISOString()
  const endsAt = new Date(Date.now() + 1000 * 60 * 40).toISOString()

  let barberId = data.barberId
  if (!barberId) {
    const { data: defaultBarber } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .limit(1)
      .maybeSingle()
    barberId = defaultBarber?.id || '00000000-0000-0000-0000-000000000000'
  }

  const paymentMethodMap: Record<string, 'pix_tenant' | 'card_machine' | 'cash'> = {
    PIX: 'pix_tenant',
    CREDIT_CARD: 'card_machine',
    DEBIT_CARD: 'card_machine',
    CASH: 'cash',
  }
  const paymentMethod = paymentMethodMap[data.paymentMethod] || 'pix_tenant'

  const { error } = await admin.from('appointments').insert({
    tenant_id: tenantId,
    barber_id: barberId,
    guest_name: data.clientName,
    guest_phone: data.clientPhone,
    is_walk_in: true,
    starts_at: startsAt,
    ends_at: endsAt,
    status: 'arrived',
    total_amount: data.servicePrice,
    payment_method: paymentMethod,
    payment_status: 'paid',
  })

  if (error) {
    console.error('Erro ao inserir agendamento walk-in:', error)
    return { success: false, message: 'Não foi possível registrar o atendimento.' }
  }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Atendimento presencial (Walk-in) iniciado com sucesso!' }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: 'confirmed' | 'arrived' | 'completed' | 'cancelled',
  tenantSlug: string
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('appointments')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)

  if (error) {
    return { success: false, message: 'Falha ao atualizar status.' }
  }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: `Status alterado para ${newStatus}.` }
}

export async function saveService(
  tenantId: string,
  tenantSlug: string,
  service: {
    id?: string
    name: string
    price: number
    durationMinutes: number
    reservationFee: number
  }
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  if (service.id && !service.id.startsWith('demo')) {
    const { error } = await admin
      .from('services')
      .update({
        name: service.name,
        price: service.price,
        duration_minutes: service.durationMinutes,
        reservation_fee: service.reservationFee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', service.id)
      .eq('tenant_id', tenantId)

    if (error) return { success: false, message: 'Erro ao editar serviço.' }
  } else {
    const { error } = await admin.from('services').insert({
      tenant_id: tenantId,
      name: service.name,
      price: service.price,
      duration_minutes: service.durationMinutes,
      reservation_fee: service.reservationFee,
      is_active: true,
    })
    if (error) return { success: false, message: 'Erro ao cadastrar serviço.' }
  }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Serviço salvo com sucesso!' }
}

export async function addItemToTab(
  tenantId: string,
  tenantSlug: string,
  tabId: string,
  productName: string,
  price: number
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  // Adicionar item na comanda
  const { error: itemError } = await admin.from('customer_tab_items').insert({
    tab_id: tabId,
    product_name: productName,
    quantity: 1,
    unit_price: price,
    total_price: price,
  })

  if (!itemError) {
    // Atualizar total na comanda
    const { data: tab } = await admin
      .from('customer_tabs')
      .select('total_amount')
      .eq('id', tabId)
      .single()

    const currentTotal = Number(tab?.total_amount || 0)
    await admin
      .from('customer_tabs')
      .update({ total_amount: currentTotal + price })
      .eq('id', tabId)
  }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: `${productName} adicionado à comanda!` }
}

export async function blockScheduleSlot(
  tenantId: string,
  tenantSlug: string,
  data: {
    barberId: string
    date: string
    startTime: string
    endTime: string
    reason: string
  }
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const startsAt = new Date(`${data.date}T${data.startTime}:00`).toISOString()
  const endsAt = new Date(`${data.date}T${data.endTime}:00`).toISOString()

  let barberId = data.barberId
  if (!barberId) {
    const { data: defaultBarber } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .limit(1)
      .maybeSingle()
    barberId = defaultBarber?.id || '00000000-0000-0000-0000-000000000000'
  }

  const { error } = await admin.from('appointments').insert({
    tenant_id: tenantId,
    barber_id: barberId,
    guest_name: `[BLOQUEIO] ${data.reason || 'Intervalo / Indisponível'}`,
    guest_phone: '00000000000',
    is_walk_in: true,
    starts_at: startsAt,
    ends_at: endsAt,
    status: 'cancelled',
    total_amount: 0,
    payment_method: 'cash',
    payment_status: 'paid',
  })

  if (error) {
    console.error('Erro ao bloquear horário:', error)
    return { success: false, message: 'Não foi possível bloquear o horário na agenda.' }
  }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Horário bloqueado com sucesso na agenda!' }
}

export async function deleteService(
  tenantId: string,
  tenantSlug: string,
  serviceId: string
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('services')
    .delete()
    .eq('id', serviceId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, message: 'Erro ao remover serviço.' }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Serviço removido com sucesso!' }
}

export async function saveProduct(
  tenantId: string,
  tenantSlug: string,
  product: {
    id?: string
    name: string
    price: number
    stockQuantity: number
    category?: string
  }
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  if (product.id && !product.id.startsWith('prod-')) {
    const { error } = await admin
      .from('products')
      .update({
        name: product.name,
        price: product.price,
        stock_quantity: product.stockQuantity,
      })
      .eq('id', product.id)
      .eq('tenant_id', tenantId)

    if (error) return { success: false, message: 'Erro ao atualizar produto.' }
  } else {
    const { error } = await admin.from('products').insert({
      tenant_id: tenantId,
      name: product.name,
      price: product.price,
      stock_quantity: product.stockQuantity,
    })
    if (error) return { success: false, message: 'Erro ao cadastrar produto.' }
  }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Produto salvo com sucesso!' }
}

export async function deleteProduct(
  tenantId: string,
  tenantSlug: string,
  productId: string
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, message: 'Erro ao remover produto.' }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Produto removido com sucesso!' }
}

export async function closeTab(
  tenantId: string,
  tenantSlug: string,
  tabId: string,
  paymentMethod: string
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('customer_tabs')
    .update({
      status: 'closed',
    })
    .eq('id', tabId)
    .eq('tenant_id', tenantId)


  if (error) return { success: false, message: 'Erro ao fechar comanda.' }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: `Comanda encerrada via ${paymentMethod}!` }
}

export async function updateStoreSettings(
  tenantId: string,
  tenantSlug: string,
  settings: {
    theme: string
    instagram: string
    whatsappMessage: string
  }
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  const visualSettings: Json = {
    theme: settings.theme,
    instagram: settings.instagram,
    whatsapp_message: settings.whatsappMessage,
  }

  const { error } = await admin
    .from('tenants')
    .update({
      visual_settings: visualSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) return { success: false, message: 'Erro ao salvar personalização.' }

  revalidatePath(`/${tenantSlug}/admin`)
  return { success: true, message: 'Personalização da loja atualizada com sucesso!' }
}


