import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

export interface SplitCalculationResult {
  splitEnabled: boolean
  totalAmount: number
  barberAmount: number
  tenantAmount: number
  barberRecipientId: string | null
  absorbFee: 'tenant' | 'split'
  asaasSplitPayload?: Array<{
    walletId: string
    fixedValue?: number
    percentualValue?: number
  }>
  mercadoPagoSplitPayload?: Array<{
    collector_id: string
    amount: number
  }>
}

/**
 * Calcula a divisão direta de pagamento (Split) entre a barbearia e o profissional.
 * Se enable_gateway_split for false (padrão), o split é ignorado e o repasse é mantido via Pix manual no caixa.
 */
export async function calculateGatewaySplit(
  tenantId: string,
  barberId: string,
  totalAmount: number, // em reais (ex: 60.00)
): Promise<SplitCalculationResult> {
  const admin = createAdminClient()

  // 1. Busca configuração do tenant
  const { data: settings } = await admin
    .from('tenant_settings')
    .select('fidelity_rules')
    .eq('tenant_id', tenantId)
    .single()

  // Lê a flag enable_gateway_split e modo de taxa (ou padrão false)
  const rules = (settings?.fidelity_rules as Record<string, any>) || {}
  const splitEnabled = Boolean(rules.enable_gateway_split)
  const absorbFee: 'tenant' | 'split' = rules.gateway_split_fee_mode === 'split' ? 'split' : 'tenant'

  if (!splitEnabled) {
    return {
      splitEnabled: false,
      totalAmount,
      barberAmount: 0,
      tenantAmount: totalAmount,
      barberRecipientId: null,
      absorbFee,
    }
  }

  // 2. Busca perfil e chave de subconta/wallet do barbeiro
  const { data: barberProfile, error: barberError } = await admin
    .from('profiles')
    .select('id, commission_percent, avatar_url')
    .eq('id', barberId)
    .single()

  if (barberError || !barberProfile) {
    return {
      splitEnabled: false,
      totalAmount,
      barberAmount: 0,
      tenantAmount: totalAmount,
      barberRecipientId: null,
      absorbFee,
    }
  }

  // Identificador da subconta/wallet do barbeiro
  const barberRecipientId = (barberProfile as any).gateway_recipient_id || null

  if (!barberRecipientId) {
    // Se o barbeiro não possui subconta cadastrada, cai no repasse manual padrão
    return {
      splitEnabled: false,
      totalAmount,
      barberAmount: 0,
      tenantAmount: totalAmount,
      barberRecipientId: null,
      absorbFee,
    }
  }

  // 3. Cálculo de comissão líquida
  const commissionRate = barberProfile.commission_percent || 50
  const totalCents = Math.round(totalAmount * 100)
  const barberCents = Math.round((totalCents * commissionRate) / 100)
  const tenantCents = totalCents - barberCents

  const barberAmount = barberCents / 100
  const tenantAmount = tenantCents / 100

  // 4. Monta payloads padronizados para gateways
  const asaasSplitPayload = [
    {
      walletId: barberRecipientId,
      fixedValue: barberAmount,
    },
  ]

  const mercadoPagoSplitPayload = [
    {
      collector_id: barberRecipientId,
      amount: barberAmount,
    },
  ]

  return {
    splitEnabled: true,
    totalAmount,
    barberAmount,
    tenantAmount,
    barberRecipientId,
    absorbFee,
    asaasSplitPayload,
    mercadoPagoSplitPayload,
  }
}
