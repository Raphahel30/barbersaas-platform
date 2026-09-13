'use server'

import { createAdminClient } from '@/utils/supabase/admin'

import { getMonthlySubscribers } from '@/app/actions/monthly-club'

export type CRMClient = {
  id: string
  name: string
  phone: string
  normalizedPhone: string
  email: string | null
  totalVisits: number
  totalSpent: number
  averageTicket: number
  lastVisitAt: string | null
  lastVisit: string
  isInactiveOver30Days: boolean
  isInactive: boolean
  isVipSubscriber: boolean
  planName: string | null
  fidelityPoints: number
  notes: string | null
  whatsappUrl: string
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if ((p.length === 12 || p.length === 13) && p.startsWith('55')) {
    p = p.slice(2)
  }
  return p
}

async function resolveTenantId(slugOrId: string): Promise<string> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)) {
    return slugOrId
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slugOrId)
    .maybeSingle()
  return data?.id || slugOrId
}

export async function getCRMClientList(tenantSlugOrId: string): Promise<CRMClient[]> {
  const admin = createAdminClient()
  const tenantId = await resolveTenantId(tenantSlugOrId)

  // Buscar agendamentos concluídos ou com presença
  const [appointmentsRes, subscribers] = await Promise.all([
    admin
      .from('appointments')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false }),
    getMonthlySubscribers(tenantId),
  ])

  const appointments = appointmentsRes.data || []


  // Agrupar por telefone do cliente
  const clientMap = new Map<
    string,
    {
      name: string
      phone: string
      email: string | null
      totalVisits: number
      totalSpent: number
      lastVisitAt: string | null
      notes: string | null
    }
  >()

  const now = new Date().getTime()
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

  appointments.forEach((apt) => {
    const rawPhone = apt.guest_phone || apt.client_id || ''
    const cleanPhone = normalizePhone(rawPhone)
    if (!cleanPhone) return

    const clientName = apt.guest_name || 'Cliente'
    const amount = Number(apt.total_amount || 0)
    const aptDate = apt.starts_at || apt.created_at

    const existing = clientMap.get(cleanPhone) || {
      name: clientName,
      phone: cleanPhone,
      email: null,
      totalVisits: 0,
      totalSpent: 0,
      lastVisitAt: null,
      notes: apt.notes || null,
    }

    if (apt.status === 'completed' || apt.status === 'arrived') {
      existing.totalVisits += 1
      existing.totalSpent += amount
    }

    if (!existing.lastVisitAt || new Date(aptDate).getTime() > new Date(existing.lastVisitAt).getTime()) {
      existing.lastVisitAt = aptDate
    }

    if (!existing.name || existing.name === 'Cliente') {
      existing.name = clientName
    }

    clientMap.set(cleanPhone, existing)
  })

  // Integrar dados de mensalistas aos clientes
  subscribers.forEach((sub) => {
    const cleanPhone = normalizePhone(sub.client_phone)
    if (!cleanPhone) return

    const existing = clientMap.get(cleanPhone) || {
      name: sub.client_name,
      phone: cleanPhone,
      email: null,
      totalVisits: 0,
      totalSpent: 0,
      lastVisitAt: sub.created_at,
      notes: `Assinante do ${sub.plan_name}`,
    }

    if (!clientMap.has(cleanPhone)) {
      clientMap.set(cleanPhone, existing)
    }
  })

  // Se não houver dados, fornecer base demonstrativa rica
  if (clientMap.size === 0) {
    const demoClients = [
      {
        name: 'Guilherme Siqueira',
        phone: '11987654321',
        totalVisits: 8,
        totalSpent: 480,
        lastVisitAt: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Gosta de degradê navalhado baixo e barba desenhada com navalha.',
        isVip: true,
        planName: 'Plano Navalio VIP (4 Cortes)',
      },
      {
        name: 'Mateus Oliveira',
        phone: '11971112233',
        totalVisits: 14,
        totalSpent: 840,
        lastVisitAt: new Date(now - 38 * 24 * 60 * 60 * 1000).toISOString(), // > 30 dias (Alerta Sumido!)
        notes: 'Cliente antigo. Costuma cortar aos sábados pela manhã.',
        isVip: false,
        planName: null,
      },
      {
        name: 'Rodrigo Guimarães',
        phone: '11993334455',
        totalVisits: 4,
        totalSpent: 260,
        lastVisitAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        notes: 'Usa pomada efeito matte.',
        isVip: true,
        planName: 'Clube Cabelo & Barba',
      },
      {
        name: 'Felipe Albuquerque',
        phone: '11999993333',
        totalVisits: 6,
        totalSpent: 390,
        lastVisitAt: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(), // > 30 dias
        notes: 'Corte tesoura clássico.',
        isVip: false,
        planName: null,
      },
    ]

    return demoClients.map((c, idx) => {
      const isInactive = c.lastVisitAt ? now - new Date(c.lastVisitAt).getTime() > thirtyDaysMs : false
      const avgTicket = c.totalVisits > 0 ? Math.round(c.totalSpent / c.totalVisits) : 0
      const msg = isInactive
        ? `Olá ${c.name}, tudo bem? Sentimos sua falta aqui na barbearia! Que tal renovar seu corte esta semana? Agende seu horário com a gente!`
        : `Olá ${c.name}, passando para confirmar seu próximo horário ou saber como ficou seu corte!`

      return {
        id: `crm-demo-${idx + 1}`,
        name: c.name,
        phone: c.phone,
        normalizedPhone: c.phone,
        email: `${c.name.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
        totalVisits: c.totalVisits,
        totalSpent: c.totalSpent,
        averageTicket: avgTicket,
        lastVisitAt: c.lastVisitAt,
        lastVisit: c.lastVisitAt || new Date().toISOString(),
        isInactiveOver30Days: isInactive,
        isInactive,
        isVipSubscriber: c.isVip,
        planName: c.planName,
        fidelityPoints: c.totalVisits,
        notes: c.notes,
        whatsappUrl: `https://wa.me/55${c.phone}?text=${encodeURIComponent(msg)}`,
      }
    })
  }

  const result: CRMClient[] = []

  clientMap.forEach((c, phone) => {
    const isInactive = c.lastVisitAt ? now - new Date(c.lastVisitAt).getTime() > thirtyDaysMs : false
    const avgTicket = c.totalVisits > 0 ? Math.round(c.totalSpent / c.totalVisits) : 0
    const sub = subscribers.find((s) => normalizePhone(s.client_phone) === phone && s.status === 'active')

    const msg = isInactive
      ? `Olá ${c.name}, tudo bem? Sentimos sua falta aqui na barbearia! Que tal garantir seu horário para renovar o visual esta semana?`
      : `Olá ${c.name}, tudo bem? Passando para te desejar um excelente dia e agradecer a preferência na barbearia!`

    result.push({
      id: `crm-${phone}`,
      name: c.name,
      phone,
      normalizedPhone: phone,
      email: c.email,
      totalVisits: c.totalVisits,
      totalSpent: c.totalSpent,
      averageTicket: avgTicket,
      lastVisitAt: c.lastVisitAt,
      lastVisit: c.lastVisitAt || new Date().toISOString(),
      isInactiveOver30Days: isInactive,
      isInactive,
      isVipSubscriber: Boolean(sub),
      planName: sub?.plan_name || null,
      fidelityPoints: c.totalVisits,
      notes: c.notes,
      whatsappUrl: `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`,
    })
  })


  return result.sort((a, b) => b.totalSpent - a.totalSpent)
}
