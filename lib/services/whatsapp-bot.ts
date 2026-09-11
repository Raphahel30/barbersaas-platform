import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type WhatsAppBotSessionRow = Database['public']['Tables']['whatsapp_bot_sessions']['Row']

export type BotProcessResult = {
  handled: boolean
  replyText: string | null
  transferredToHuman: boolean
  botPaused: boolean
  session: WhatsAppBotSessionRow
}

export interface IncomingBotMessage {
  instance: string
  phone: string
  messageText: string
  senderName?: string
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

function validateEvolutionUrl(value: string): URL {
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase()
  const isPrivateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  if (url.protocol !== 'https:' || hostname === 'localhost' || hostname === '::1' || isPrivateIpv4) {
    throw new Error('Evolution API URL não permitida por segurança.')
  }
  return url
}

/**
 * Envia uma mensagem de texto pelo WhatsApp utilizando a Evolution API da barbearia.
 */
export async function sendEvolutionBotMessage(
  apiUrl: string,
  apiKey: string,
  instance: string,
  phone: string,
  message: string
): Promise<boolean> {
  try {
    const baseUrl = validateEvolutionUrl(apiUrl)
    const endpoint = new URL(`/message/sendText/${encodeURIComponent(instance)}`, baseUrl)
    const cleanPhone = normalizePhone(phone)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: cleanPhone,
        text: message,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })

    return response.ok
  } catch (err) {
    console.error('Falha ao enviar mensagem do Bot WhatsApp via Evolution API:', err)
    return false
  }
}

/**
 * Obtém ou inicializa a sessão do bot para o número de telefone no tenant.
 */
export async function getOrCreateBotSession(
  tenantId: string,
  phone: string,
  clientName?: string
): Promise<WhatsAppBotSessionRow> {
  const supabase = createAdminClient()
  const cleanPhone = normalizePhone(phone)

  const { data: existing } = await supabase
    .from('whatsapp_bot_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone', cleanPhone)
    .maybeSingle()

  if (existing) {
    if (clientName && !existing.client_name) {
      await supabase
        .from('whatsapp_bot_sessions')
        .update({ client_name: clientName })
        .eq('id', existing.id)
    }
    return existing
  }

  const { data: created, error } = await supabase
    .from('whatsapp_bot_sessions')
    .insert({
      tenant_id: tenantId,
      phone: cleanPhone,
      client_name: clientName || null,
      last_interaction_at: new Date().toISOString(),
      current_step: 'main_menu',
      transferred_to_human: false,
      metadata: {},
    })
    .select()
    .single()

  if (error || !created) {
    throw new Error(`Falha ao criar sessão do bot: ${error?.message}`)
  }

  return created
}

/**
 * Processa a mensagem de texto recebida e determina a resposta inteligente do bot,
 * respeitando o transbordo humano e travas anti-interferência.
 */
export async function processBotMessage(
  tenantId: string,
  phone: string,
  rawText: string,
  senderName?: string
): Promise<BotProcessResult> {
  const supabase = createAdminClient()
  const cleanPhone = normalizePhone(phone)
  const text = (rawText || '').trim().toLowerCase()

  // 1. Carrega dados do tenant (nome, slug, endereço) e configurações
  const [tenantRes, settingsRes] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, address, custom_domain').eq('id', tenantId).single(),
    supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).single(),
  ])

  if (!tenantRes.data) {
    throw new Error('Tenant não encontrado para o bot.')
  }

  const tenant = tenantRes.data
  const tenantName = tenant.name || 'Nossa Barbearia'
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://barbersaas.com'

  let session = await getOrCreateBotSession(tenantId, cleanPhone, senderName)

  // 2. Verifica trava anti-interferência de Transbordo Humano
  // Se o bot estiver pausado para atendimento humano e o usuário NÃO solicitou reiniciar ("menu" ou "reiniciar")
  const isPaused = session.bot_paused_until && new Date(session.bot_paused_until) > new Date()
  const userWantsReset = text === 'menu' || text === 'reiniciar' || text === 'inicio' || text === 'voltar'

  if (isPaused && !userWantsReset) {
    // Modo Silêncio Ativo: não interfere na conversa entre atendente humano e cliente
    return {
      handled: true,
      replyText: null,
      transferredToHuman: true,
      botPaused: true,
      session,
    }
  }

  // Se o usuário quis resetar ou o prazo de 24h já expirou, reativa o bot
  if (session.transferred_to_human && userWantsReset) {
    const { data: reactivated } = await supabase
      .from('whatsapp_bot_sessions')
      .update({
        transferred_to_human: false,
        bot_paused_until: null,
        current_step: 'main_menu',
        last_interaction_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .select()
      .single()

    if (reactivated) session = reactivated
  }

  // 3. Interpretação do Menu
  let replyText = ''
  let shouldTransferToHuman = false

  // Opção 1: Quero agendar um horário
  if (
    text === '1' ||
    text.includes('agendar') ||
    text.includes('marcar') ||
    text.includes('corte') ||
    text.includes('horario')
  ) {
    const bookingUrl = `${appBaseUrl}/${tenant.slug}?phone=${cleanPhone}${
      senderName ? `&name=${encodeURIComponent(senderName)}` : ''
    }`

    replyText =
      `💈 *Agendamento Online - ${tenantName}*\n\n` +
      `Para escolher o profissional da sua preferência, consultar a grade de horários disponíveis em tempo real e garantir seu corte com facilidade, acesse nosso link direto:\n\n` +
      `👉 ${bookingUrl}\n\n` +
      `⚡ *Dica:* Seu telefone já está pré-identificado para agilizar seu agendamento!\n\n` +
      `_Digite *MENU* a qualquer momento para voltar ao início._`
  }
  // Opção 2: Ver meus agendamentos / Reagendar
  else if (
    text === '2' ||
    text.includes('meus agendamentos') ||
    text.includes('reagendar') ||
    text.includes('meu corte') ||
    text.includes('meu horario')
  ) {
    const nowIso = new Date().toISOString()
    const { data: upcoming } = await supabase
      .from('appointments')
      .select(`
        id,
        starts_at,
        status,
        total_amount,
        barber:profiles!appointments_barber_id_fkey(full_name)
      `)
      .eq('tenant_id', tenantId)
      .eq('guest_phone', cleanPhone)
      .gte('starts_at', nowIso)
      .in('status', ['scheduled', 'confirmed', 'hold'])
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (upcoming) {
      const startsDate = new Date(upcoming.starts_at)
      const formattedDate = startsDate.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      const formattedTime = startsDate.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const barberName = (upcoming.barber as any)?.full_name || 'Profissional da casa'

      // Verifica se está dentro do prazo de 3h para reagendamento online
      const diffMs = startsDate.getTime() - Date.now()
      const diffHours = diffMs / (1000 * 60 * 60)
      const rescheduleUrl = `${appBaseUrl}/cancelar/${upcoming.id}`

      if (diffHours >= 3) {
        replyText =
          `📅 *Seu Próximo Agendamento*\n\n` +
          `✂️ *Profissional:* ${barberName}\n` +
          `🗓️ *Data:* ${formattedDate}\n` +
          `⏰ *Horário:* ${formattedTime}\n\n` +
          `Caso precise reagendar ou cancelar, você pode fazer isso de forma autônoma até 3 horas antes pelo link abaixo:\n` +
          `👉 ${rescheduleUrl}\n\n` +
          `_Digite *MENU* para ver mais opções._`
      } else {
        replyText =
          `📅 *Seu Próximo Agendamento*\n\n` +
          `✂️ *Profissional:* ${barberName}\n` +
          `🗓️ *Data:* ${formattedDate}\n` +
          `⏰ *Horário:* ${formattedTime}\n\n` +
          `⚠️ *Atenção:* Seu corte está previsto para menos de 3 horas. Para alterações imediatas, digite *4* para falar diretamente com a recepção.\n\n` +
          `_Digite *MENU* para voltar._`
      }
    } else {
      replyText =
        `🔍 *Nenhum agendamento futuro encontrado*\n\n` +
        `Não localizamos agendamentos ativos para o número ${cleanPhone}.\n\n` +
        `Gostaria de marcar um horário agora? Digite *1* para receber o link de agendamento!\n\n` +
        `_Digite *MENU* para ver as opções._`
    }
  }
  // Opção 3: Onde fica a barbearia?
  else if (
    text === '3' ||
    text.includes('onde fica') ||
    text.includes('endereco') ||
    text.includes('localizacao') ||
    text.includes('maps') ||
    text.includes('waze')
  ) {
    let addressText = 'Consulte nossa recepção para detalhes de localização.'
    let mapsQuery = encodeURIComponent(tenantName)

    if (tenant.address && typeof tenant.address === 'object') {
      const addr = tenant.address as any
      const street = addr.street || addr.logradouro || ''
      const number = addr.number || addr.numero || ''
      const neighborhood = addr.neighborhood || addr.bairro || ''
      const city = addr.city || addr.cidade || ''
      const state = addr.state || addr.estado || ''
      const reference = addr.reference || addr.complement || ''

      const addressLines = [
        street ? `${street}${number ? `, ${number}` : ''}` : '',
        neighborhood,
        city ? `${city}${state ? ` - ${state}` : ''}` : '',
        reference ? `(Ponto de ref: ${reference})` : '',
      ]
        .filter(Boolean)
        .join(', ')

      if (addressLines.trim()) {
        addressText = addressLines
        mapsQuery = encodeURIComponent(`${addressLines}, ${tenantName}`)
      }
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`
    const wazeUrl = `https://waze.com/ul?q=${mapsQuery}`

    replyText =
      `📍 *Localização da ${tenantName}*\n\n` +
      `🏢 *Endereço:*\n${addressText}\n\n` +
      `🗺️ *Google Maps:* ${mapsUrl}\n` +
      `🚗 *Waze:* ${wazeUrl}\n\n` +
      `Te esperamos com cerveja gelada e o melhor atendimento da região!\n\n` +
      `_Digite *MENU* para voltar._`
  }
  // Opção 4: Falar com a recepção (Transbordo Humano)
  else if (
    text === '4' ||
    text.includes('recepcao') ||
    text.includes('humano') ||
    text.includes('atendente') ||
    text.includes('falar com') ||
    text.includes('ajuda')
  ) {
    shouldTransferToHuman = true
    const pauseUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Pausa por 24 horas

    await supabase
      .from('whatsapp_bot_sessions')
      .update({
        transferred_to_human: true,
        transferred_at: new Date().toISOString(),
        bot_paused_until: pauseUntil,
        current_step: 'human_handover',
        last_interaction_at: new Date().toISOString(),
      })
      .eq('id', session.id)

    replyText =
      `🔔 *Atendimento Humano Solicitado!*\n\n` +
      `Um chamado prioritário foi gerado no painel da recepção da *${tenantName}*.\n` +
      `Nossa equipe continuará a conversa com você por aqui em instantes.\n\n` +
      `🔇 *Aviso:* O robô de autoatendimento foi silenciado por 24h para não atrapalhar seu diálogo com o atendente.\n\n` +
      `_(Para reativar o menu do robô a qualquer momento, basta digitar *MENU*)._`
  }
  // Menu Padrão de Saudação / Opção não reconhecida
  else {
    const greetingName = senderName ? `, ${senderName}` : ''
    replyText =
      `Olá${greetingName}! 👋 Bem-vindo(a) à *${tenantName}*!\n\n` +
      `Como posso te ajudar hoje? Digite o *número* da opção desejada:\n\n` +
      `1️⃣ *Quero agendar um horário*\n` +
      `2️⃣ *Ver meus agendamentos / Reagendar*\n` +
      `3️⃣ *Onde fica a barbearia?*\n` +
      `4️⃣ *Falar com a recepção (Atendente Humano)*\n\n` +
      `_Envie apenas o número correspondente à sua opção._`
  }

  // Atualiza última interação da sessão
  await supabase
    .from('whatsapp_bot_sessions')
    .update({
      last_interaction_at: new Date().toISOString(),
      current_step: shouldTransferToHuman ? 'human_handover' : 'main_menu',
    })
    .eq('id', session.id)

  return {
    handled: true,
    replyText,
    transferredToHuman: shouldTransferToHuman,
    botPaused: shouldTransferToHuman,
    session,
  }
}
