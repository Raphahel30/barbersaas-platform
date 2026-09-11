import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import {
  processBotMessage,
  sendEvolutionBotMessage,
} from '@/lib/services/whatsapp-bot'

export async function POST(request: Request) {
  try {
    const url = new URL(request.url)
    const queryTenantId = url.searchParams.get('tenant_id')

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 })
    }

    // 1. Extração flexível de dados da Evolution API ou chamada direta
    let instanceName: string = body.instance || ''
    let remoteJid: string = ''
    let fromMe: boolean = false
    let pushName: string | undefined = body.pushName || body.sender_name
    let messageText: string = ''

    // Se for formato padrão de evento Evolution API (messages.upsert)
    if (body.data) {
      const data = body.data
      const key = data.key || {}
      remoteJid = key.remoteJid || ''
      fromMe = Boolean(key.fromMe)
      pushName = pushName || data.pushName

      const messageObj = data.message || {}
      messageText =
        messageObj.conversation ||
        messageObj.extendedTextMessage?.text ||
        messageObj.buttonsResponseMessage?.selectedButtonId ||
        messageObj.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    } else {
      // Formato direto simplificado
      remoteJid = body.phone || body.remoteJid || ''
      fromMe = Boolean(body.fromMe)
      messageText = body.text || body.message || ''
    }

    // Ignora mensagens enviadas pela própria barbearia (fromMe) para evitar loops infinitos
    if (fromMe) {
      return NextResponse.json({ received: true, ignored: 'from_me' })
    }

    // Ignora mensagens de grupos do WhatsApp (@g.us)
    if (remoteJid.endsWith('@g.us')) {
      return NextResponse.json({ received: true, ignored: 'group_message' })
    }

    const cleanPhone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')
    if (!cleanPhone || cleanPhone.length < 8) {
      return NextResponse.json({ received: true, ignored: 'invalid_phone' })
    }

    // Se a mensagem de texto for vazia (ex: áudio, figurinha sem legenda), envia menu
    if (!messageText.trim()) {
      messageText = 'menu'
    }

    const supabase = createAdminClient()

    // 2. Identificação do Tenant responsável
    let tenantId = queryTenantId

    if (!tenantId && instanceName) {
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('tenant_id')
        .eq('evolution_instance', instanceName)
        .maybeSingle()

      if (settings) {
        tenantId = settings.tenant_id
      }
    }

    // Se não encontrou por instanceName nem por query param, busca o primeiro tenant ativo com Evolution configurada
    if (!tenantId) {
      const { data: fallback } = await supabase
        .from('tenant_settings')
        .select('tenant_id, evolution_instance')
        .eq('evolution_api_enabled', true)
        .not('evolution_instance', 'is', null)
        .limit(1)
        .maybeSingle()

      if (fallback) {
        tenantId = fallback.tenant_id
        instanceName = fallback.evolution_instance || instanceName
      }
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant não localizado para esta instância da Evolution API.' },
        { status: 404 }
      )
    }

    // 3. Processa a mensagem pelo motor do Bot
    const botResult = await processBotMessage(tenantId, cleanPhone, messageText, pushName)

    // 4. Se houver resposta textual (ou seja, bot não está pausado para transbordo humano)
    if (botResult.replyText) {
      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('evolution_api_enabled, evolution_api_url, evolution_api_key, evolution_instance')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (
        settings?.evolution_api_enabled &&
        settings.evolution_api_url &&
        settings.evolution_api_key &&
        settings.evolution_instance
      ) {
        await sendEvolutionBotMessage(
          settings.evolution_api_url,
          settings.evolution_api_key,
          settings.evolution_instance,
          cleanPhone,
          botResult.replyText
        )
      }
    }

    return NextResponse.json({
      received: true,
      handled: botResult.handled,
      transferredToHuman: botResult.transferredToHuman,
      botPaused: botResult.botPaused,
      replySent: Boolean(botResult.replyText),
    })
  } catch (err: any) {
    console.error('Erro no webhook do bot de WhatsApp:', err)
    return NextResponse.json(
      { error: 'Erro interno ao processar webhook do bot WhatsApp.', details: err?.message },
      { status: 500 }
    )
  }
}
