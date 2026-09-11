'use server'

import {
  querySegmentRecipients,
  renderCampaignMessage,
  parseSpintax,
  type CampaignSegment,
  type SegmentedRecipient,
} from '@/lib/marketing/broadcast'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/types/database.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CampaignSegmentType = CampaignSegment
export type CampaignRow = Database['public']['Tables']['marketing_campaigns']['Row']
export type QueueItemRow = Database['public']['Tables']['campaign_queue']['Row']

export type CampaignActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; error?: string }

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const profile = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', userId)
    .maybeSingle()

  return profile.data
}

async function getTenantIdFromSession(): Promise<string | null> {
  const user = await getAuthenticatedUser()
  return user?.tenant_id || null
}

async function requireOwner(tenantId: string) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return false

  const profile = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userId)
    .maybeSingle()

  return Boolean(
    profile.data &&
    profile.data.tenant_id === tenantId &&
    ['owner', 'super_admin'].includes(profile.data.role)
  )
}

/**
 * Consulta a quantidade e a lista prévia de clientes de um segmento.
 */
export async function getSegmentAudienceCount(
  tenantId: string,
  segment: CampaignSegment,
  barberId?: string,
): Promise<CampaignActionResult<{ count: number; sample: SegmentedRecipient[] }>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID da barbearia inválido.' }
  }

  try {
    const recipients = await querySegmentRecipients(tenantId, segment, barberId)
    return {
      success: true,
      data: {
        count: recipients.length,
        sample: recipients.slice(0, 5),
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao calcular audiência.',
    }
  }
}

/**
 * Gera uma variação randômica de teste do texto Spintax para pré-visualização.
 */
export async function previewSpintaxMessageAction(
  template: string,
  sampleName = 'João Silva',
  sampleTenant = 'Barbearia Imperial',
): Promise<CampaignActionResult<{ rendered: string }>> {
  const rendered = renderCampaignMessage(template, {
    clientName: sampleName,
    tenantName: sampleTenant,
    bookingUrl: 'https://barbersaas.com.br/agendar',
    barberName: 'Marcos Barbeiro',
  })

  return { success: true, data: { rendered } }
}

/**
 * Cria a campanha e popula a fila `campaign_queue` com textos renderizados por Spintax.
 */
export async function createMarketingCampaignAction(input: {
  tenantId?: string
  name: string
  segment?: CampaignSegment
  targetSegment?: CampaignSegment
  barberId?: string
  specificBarberId?: string
  messageTemplate: string
}): Promise<CampaignActionResult<CampaignRow & { campaignId: string; totalRecipients: number }>> {
  const resolvedTenantId = input.tenantId || (await getTenantIdFromSession())
  if (!resolvedTenantId || !UUID_PATTERN.test(resolvedTenantId)) {
    return { success: false, message: 'ID de barbearia inválido ou não autenticado.', error: 'Tenant inválido' }
  }

  const segment = (input.targetSegment || input.segment || 'vip') as CampaignSegment
  const barberId = input.specificBarberId || input.barberId

  const isOwner = await requireOwner(resolvedTenantId)
  if (!isOwner) {
    return { success: false, message: 'Apenas proprietários podem criar campanhas.', error: 'Não autorizado' }
  }

  if (!input.name || input.name.trim().length < 3) {
    return { success: false, message: 'Informe um nome descritivo para a campanha.' }
  }

  if (!input.messageTemplate || input.messageTemplate.trim().length < 10) {
    return { success: false, message: 'Mensagem deve ter no mínimo 10 caracteres.' }
  }

  const admin = createAdminClient()

  // 1. Obter destinatários do segmento
  const recipients = await querySegmentRecipients(resolvedTenantId, segment, barberId)
  if (recipients.length === 0) {
    return { success: false, message: 'Nenhum cliente com WhatsApp encontrado para este segmento.', error: 'Sem destinatários' }
  }

  // 2. Buscar dados da barbearia
  const tenantRes = await admin.from('tenants').select('name, slug').eq('id', resolvedTenantId).single()
  const tenantName = tenantRes.data?.name || 'Nossa Barbearia'
  const bookingUrl = `https://barbersaas.com.br/${tenantRes.data?.slug || 'agendar'}`

  // 3. Inserir campanha
  const campaignRes = await admin
    .from('marketing_campaigns')
    .insert({
      tenant_id: resolvedTenantId,
      name: input.name.trim(),
      target_segment: segment,
      target_barber_id: barberId || null,
      message_template: input.messageTemplate,
      total_recipients: recipients.length,
      sent_count: 0,
      status: 'scheduled',
    })
    .select('*')
    .single()

  if (campaignRes.error || !campaignRes.data) {
    return { success: false, message: `Erro ao criar campanha: ${campaignRes.error?.message}`, error: campaignRes.error?.message }
  }

  const campaign = campaignRes.data

  // 4. Popular a fila `campaign_queue` com textos Spintax únicos
  const queueItems = recipients.map((r) => {
    const rendered = renderCampaignMessage(input.messageTemplate, {
      clientName: r.name,
      tenantName,
      bookingUrl,
    })

    return {
      campaign_id: campaign.id,
      client_id: r.clientId,
      phone: r.phone,
      client_name: r.name,
      rendered_text: rendered,
      status: 'pending' as const,
    }
  })

  const queueRes = await admin.from('campaign_queue').insert(queueItems)
  if (queueRes.error) {
    return { success: false, message: `Erro ao enfileirar mensagens: ${queueRes.error.message}`, error: queueRes.error.message }
  }

  return {
    success: true,
    data: {
      ...campaign,
      campaignId: campaign.id,
      totalRecipients: campaign.total_recipients,
    },
  }
}

/**
 * Dispara uma mensagem da fila via link wa.me ou API e atualiza status.
 */
export async function dispatchQueueItemAction(
  queueId: string,
): Promise<CampaignActionResult<{ whatsappUrl: string; nextPendingCount: number }>> {
  if (!UUID_PATTERN.test(queueId)) {
    return { success: false, message: 'ID de item inválido.' }
  }

  const admin = createAdminClient()
  const itemRes = await admin.from('campaign_queue').select('*').eq('id', queueId).single()

  if (itemRes.error || !itemRes.data) {
    return { success: false, message: 'Item da fila não encontrado.' }
  }

  const item = itemRes.data
  const cleanPhone = item.phone.replace(/\D/g, '')
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(item.rendered_text)}`

  // Atualizar para enviado
  await admin
    .from('campaign_queue')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', queueId)

  // Incrementar sent_count na campanha
  const campaignRes = await admin
    .from('marketing_campaigns')
    .select('id, sent_count, total_recipients')
    .eq('id', item.campaign_id)
    .single()

  if (campaignRes.data) {
    const newCount = campaignRes.data.sent_count + 1
    const newStatus = newCount >= campaignRes.data.total_recipients ? 'completed' : 'processing'
    await admin
      .from('marketing_campaigns')
      .update({ sent_count: newCount, status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.campaign_id)
  }

  // Contar pendentes restantes
  const countRes = await admin
    .from('campaign_queue')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', item.campaign_id)
    .eq('status', 'pending')

  return {
    success: true,
    data: {
      whatsappUrl,
      nextPendingCount: countRes.count ?? 0,
    },
  }
}

/**
 * Lista as campanhas da barbearia.
 */
export async function listCampaignsAction(
  tenantId: string,
): Promise<CampaignActionResult<CampaignRow[]>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID da barbearia inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('marketing_campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) return { success: false, message: error.message }
  return { success: true, data: data ?? [] }
}

/**
 * Recupera os itens da fila de disparo de uma campanha.
 */
export async function getCampaignQueueAction(
  campaignId: string,
): Promise<CampaignActionResult<QueueItemRow[]>> {
  if (!UUID_PATTERN.test(campaignId)) {
    return { success: false, message: 'ID de campanha inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('campaign_queue')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })

  if (error) return { success: false, message: error.message }
  return { success: true, data: data ?? [] }
}

/**
 * Aliases para a UI do painel
 */
export async function getCampaignsListAction(tenantId?: string): Promise<CampaignActionResult<CampaignRow[]>> {
  const resolved = tenantId || (await getTenantIdFromSession())
  if (!resolved) return { success: false, message: 'Não autenticado', error: 'Não autenticado' }
  return listCampaignsAction(resolved)
}

export async function getSegmentAudienceAction(
  segment: CampaignSegment,
  barberId?: string
): Promise<CampaignActionResult<{ total: number; sample: SegmentedRecipient[] }>> {
  const resolved = await getTenantIdFromSession()
  if (!resolved) return { success: false, message: 'Não autenticado', error: 'Não autenticado' }
  const res = await getSegmentAudienceCount(resolved, segment, barberId)
  if (!res.success) return { success: false, message: res.message, error: res.message }
  return { success: true, data: { total: res.data.count, sample: res.data.sample } }
}

export async function previewSpintaxAction(
  template: string,
  data?: { nome?: string; barbearia?: string; ultimo_servico?: string }
): Promise<CampaignActionResult<{ preview: string }>> {
  const res = await previewSpintaxMessageAction(template, data?.nome, data?.barbearia)
  if (!res.success) return { success: false, message: res.message, error: res.message }
  return { success: true, data: { preview: res.data.rendered } }
}

export async function markQueueItemSentAction(
  queueId: string,
  status: 'sent' | 'failed' = 'sent'
): Promise<CampaignActionResult<{ success: boolean }>> {
  const admin = createAdminClient()
  const { error } = await admin
    .from('campaign_queue')
    .update({ status, sent_at: new Date().toISOString() })
    .eq('id', queueId)

  if (error) return { success: false, message: error.message, error: error.message }
  return { success: true, data: { success: true } }
}

