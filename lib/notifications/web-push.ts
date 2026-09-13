import 'server-only'

import webpush from 'web-push'
import { createAdminClient } from '@/utils/supabase/admin'

export interface PushSubscriptionKeys {
  p256dh: string
  auth: string
}

export interface ClientPushSubscriptionInput {
  endpoint: string
  keys: PushSubscriptionKeys
  userType: 'client' | 'barber'
  userId?: string | null
  tenantId: string
}

export interface WebPushPayload {
  title: string
  body: string
  url?: string
  icon?: string
  badge?: string
}

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:suporte@seusaas.com.br'
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
  } catch (err) {
    console.warn('Falha ao configurar VAPID details:', err)
  }
}

/**
 * Salva ou atualiza uma inscrição de WebPush no banco de dados.
 */
export async function savePushSubscription(
  input: ClientPushSubscriptionInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()

    const { error } = await admin.from('push_subscriptions').upsert(
      {
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        user_type: input.userType,
        user_id: input.userId || null,
        tenant_id: input.tenantId,
      },
      { onConflict: 'endpoint' },
    )

    if (error) {
      console.warn('Erro ao registrar push_subscription:', error.message)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao salvar inscrição push',
    }
  }
}

/**
 * Remove uma inscrição push (ex: quando o navegador cancela a permissão ou endpoint retorna 410 Gone / 404).
 */
export async function removePushSubscription(endpoint: string): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('push_subscriptions').delete().eq('endpoint', endpoint)
  } catch (err) {
    console.error('Erro ao deletar push subscription expirada:', err)
  }
}

/**
 * Envia notificação criptografada nativa usando a biblioteca oficial web-push.
 */
export async function sendWebPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: WebPushPayload,
): Promise<boolean> {
  try {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn('[WebPush] Chaves VAPID não configuradas nas variáveis de ambiente.')
      return false
    }

    const pushSub = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    }

    await webpush.sendNotification(pushSub, JSON.stringify(payload))
    return true
  } catch (error: any) {
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      // Inscrição inválida ou revogada pelo push service do navegador
      await removePushSubscription(subscription.endpoint)
    } else {
      console.error('[WebPush Error] Falha no envio da notificação:', error?.message || error)
    }
    return false
  }
}

/**
 * Dispara uma notificação push para todas as inscrições registradas de um usuário.
 */
export async function dispatchPushToUser(
  tenantId: string,
  userId: string,
  payload: WebPushPayload,
): Promise<{ sent: number; failed: number }> {
  const admin = createAdminClient()

  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('tenant_id', tenantId)
    .eq('user_id', userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  for (const sub of subscriptions) {
    const success = await sendWebPushNotification(
      {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      },
      payload,
    )

    if (success) {
      sent++
    } else {
      failed++
    }
  }

  return { sent, failed }
}

/**
 * Notifica o barbeiro na tela de bloqueio quando um novo horário for agendado.
 */
export async function notifyBarberNewBooking(
  tenantId: string,
  barberId: string,
  clientName: string,
  dateTimeStr: string,
): Promise<void> {
  await dispatchPushToUser(tenantId, barberId, {
    title: 'Novo corte agendado! 💈',
    body: `${clientName} agendou para ${dateTimeStr}.`,
    url: '/barber/agenda',
  })
}

/**
 * Notifica o cliente na tela de bloqueio com lembrete de corte.
 */
export async function notifyClientAppointmentReminder(
  tenantId: string,
  clientId: string,
  barberName: string,
  timeRemainingStr: string = '1 hora',
): Promise<void> {
  await dispatchPushToUser(tenantId, clientId, {
    title: 'Lembrete de Corte ⏰',
    body: `Falta ${timeRemainingStr} para o seu horário com ${barberName}!`,
    url: '/',
  })
}

/**
 * Notifica o cliente quando um selo de fidelidade for creditado.
 */
export async function notifyClientFidelityStamp(
  tenantId: string,
  clientId: string,
  stampsCount: number,
  targetStamps: number,
): Promise<void> {
  await dispatchPushToUser(tenantId, clientId, {
    title: 'Selo de Fidelidade Creditado! ⭐',
    body: `Você acabou de acumular um novo selo (${stampsCount}/${targetStamps}).`,
    url: '/',
  })
}

/**
 * Notifica o cliente sobre renovação de plano VIP com sucesso.
 */
export async function notifyClientVipRenewed(
  tenantId: string,
  clientId: string,
  planName: string,
): Promise<void> {
  await dispatchPushToUser(tenantId, clientId, {
    title: 'Plano VIP Renovado! 👑',
    body: `Sua assinatura do ${planName} foi renovada com sucesso.`,
    url: '/',
  })
}
