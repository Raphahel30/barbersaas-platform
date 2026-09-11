'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import {
  createSmartPosPaymentIntent,
  syncSmartPosIntentStatus,
  confirmSmartPosPayment,
  cancelSmartPosPaymentIntent,
  type PosProvider,
  type PosTerminalStatus,
} from '@/lib/payments/smart-pos'

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

export type PosTerminalItem = {
  id: string
  deviceName: string
  provider: PosProvider
  deviceSerialOrId: string
  status: PosTerminalStatus
  createdAt: string
}

/**
 * Lista todos os terminais Smart POS cadastrados na barbearia
 */
export async function listPosTerminalsAction(): Promise<{
  success: boolean
  data?: PosTerminalItem[]
  error?: string
}> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado ou tenant não identificado.' }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tenant_pos_terminals')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map((d) => ({
        id: d.id,
        deviceName: d.device_name,
        provider: d.provider,
        deviceSerialOrId: d.device_serial_or_id,
        status: d.status,
        createdAt: d.created_at,
      })),
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Cadastra um novo terminal Smart POS para a barbearia
 */
export async function createPosTerminalAction(input: {
  deviceName: string
  provider: PosProvider
  deviceSerialOrId: string
}): Promise<{ success: boolean; data?: PosTerminalItem; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tenant_pos_terminals')
      .insert({
        tenant_id: user.tenant_id,
        device_name: input.deviceName,
        provider: input.provider,
        device_serial_or_id: input.deviceSerialOrId,
        status: 'online',
      })
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Erro ao cadastrar terminal' }
    }

    return {
      success: true,
      data: {
        id: data.id,
        deviceName: data.device_name,
        provider: data.provider,
        deviceSerialOrId: data.device_serial_or_id,
        status: data.status,
        createdAt: data.created_at,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Envia uma cobrança em 1 toque para o visor do terminal Smart POS
 */
export async function sendPaymentToPosAction(input: {
  terminalId: string
  appointmentId?: string
  amount: number
  paymentMethod: 'credit' | 'debit' | 'pix'
  description?: string
}): Promise<{
  success: boolean
  data?: {
    intentId: string
    providerOrderId: string
    status: string
    amount: number
    terminalName: string
  }
  error?: string
}> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const res = await createSmartPosPaymentIntent({
      tenantId: user.tenant_id,
      terminalId: input.terminalId,
      appointmentId: input.appointmentId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      description: input.description,
    })

    return res
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao enviar para terminal' }
  }
}

/**
 * Consulta o status de processamento da maquininha
 */
export async function checkPosIntentStatusAction(intentId: string): Promise<{
  success: boolean
  status?: string
  appointmentUpdated?: boolean
  error?: string
}> {
  try {
    return await syncSmartPosIntentStatus(intentId)
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao verificar status' }
  }
}

/**
 * Confirmação simulada do pagamento do terminal (Sandbox / Balcão)
 */
export async function simulatePosPaymentSuccessAction(intentId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    return await confirmSmartPosPayment(intentId, `SIMULATED_${Date.now()}`)
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao aprovar cobrança' }
  }
}

/**
 * Cancela a intenção de pagamento na maquininha
 */
export async function cancelPosIntentAction(intentId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    return await cancelSmartPosPaymentIntent(intentId)
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao cancelar ordem' }
  }
}
