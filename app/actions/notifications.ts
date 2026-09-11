'use server'

import { createClient } from '@/utils/supabase/server'
import { savePushSubscription, ClientPushSubscriptionInput } from '@/lib/notifications/web-push'

export async function registerPushSubscriptionAction(
  endpoint: string,
  keys: { p256dh: string; auth: string },
  tenantId: string,
  userType: 'client' | 'barber' = 'client',
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const res = await savePushSubscription({
      endpoint,
      keys,
      tenantId,
      userId: user?.id || null,
      userType,
    })

    return res
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao registrar assinatura push',
    }
  }
}
