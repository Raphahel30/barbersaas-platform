import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

export async function checkPastDueTenants(now = new Date()): Promise<{ checkedAt: string; suspended: number }> {
  const admin = createAdminClient()
  const settings = await admin.from('system_settings').select('grace_period_days').eq('id', true).single()
  if (settings.error) throw new Error('Unable to read SaaS grace period')
  const cutoff = new Date(now.getTime() - settings.data.grace_period_days * 24 * 60 * 60 * 1000).toISOString()
  const result = await admin.from('tenants').update({ status: 'suspended' }).not('past_due_since', 'is', null).lt('past_due_since', cutoff).eq('status', 'past_due').select('id')
  if (result.error) throw new Error('Unable to suspend past-due tenants')
  return { checkedAt: now.toISOString(), suspended: result.data.length }
}
