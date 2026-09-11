'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireOwner } from '@/lib/auth/guards'

export interface SplitConfigData {
  enableSplit: boolean
  feeMode: 'tenant' | 'split'
  barbers: Array<{
    id: string
    name: string
    commissionPercent: number
    gatewayRecipientId: string | null
  }>
}

export async function getTenantSplitConfigAction(
  tenantId: string,
): Promise<{ success: boolean; data?: SplitConfigData; error?: string }> {
  try {
    const admin = createAdminClient()

    const { data: settings } = await admin
      .from('tenant_settings')
      .select('fidelity_rules')
      .eq('tenant_id', tenantId)
      .single()

    const rules = (settings?.fidelity_rules as Record<string, any>) || {}
    const enableSplit = Boolean(rules.enable_gateway_split)
    const feeMode = rules.gateway_split_fee_mode === 'split' ? 'split' : 'tenant'

    const { data: barbers } = await admin
      .from('profiles')
      .select('id, full_name, commission_percent, avatar_url')
      .eq('tenant_id', tenantId)
      .eq('role', 'barber')
      .eq('is_active', true)

    return {
      success: true,
      data: {
        enableSplit,
        feeMode,
        barbers:
          barbers?.map((b) => ({
            id: b.id,
            name: b.full_name,
            commissionPercent: b.commission_percent,
            gatewayRecipientId: (b as any).gateway_recipient_id || null,
          })) || [],
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao buscar configurações de split.',
    }
  }
}

export async function toggleGatewaySplitAction(
  tenantId: string,
  enable: boolean,
  feeMode: 'tenant' | 'split' = 'tenant',
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireOwner(tenantId)
    const admin = createAdminClient()

    const { data: currentSettings } = await admin
      .from('tenant_settings')
      .select('fidelity_rules')
      .eq('tenant_id', tenantId)
      .single()

    const currentRules = (currentSettings?.fidelity_rules as Record<string, any>) || {}
    const updatedRules = {
      ...currentRules,
      enable_gateway_split: enable,
      gateway_split_fee_mode: feeMode,
    }

    const { error } = await admin
      .from('tenant_settings')
      .update({ fidelity_rules: updatedRules })
      .eq('tenant_id', tenantId)

    if (error) throw error

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao atualizar split no gateway.',
    }
  }
}

export async function updateBarberSplitRecipientAction(
  tenantId: string,
  barberId: string,
  recipientId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireOwner(tenantId)
    const admin = createAdminClient()

    // Atualiza o identificador da subconta ou wallet do barbeiro
    const { error } = await admin
      .from('profiles')
      .update({ avatar_url: recipientId }) // utiliza campo flexível ou coluna personalizada
      .eq('id', barberId)
      .eq('tenant_id', tenantId)

    if (error) throw error

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao vincular subconta do barbeiro.',
    }
  }
}
