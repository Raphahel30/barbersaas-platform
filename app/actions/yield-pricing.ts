'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import type { Database } from '@/types/database.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type YieldRule = Database['public']['Tables']['tenant_yield_rules']['Row']

export type YieldRuleInput = {
  id?: string
  tenantId: string
  name: string
  weekdays: number[]
  startsAt: string
  endsAt: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  requireFullReservationFee: boolean
  isActive?: boolean
}

export type YieldActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function requireOwnerOrAdmin(tenantId: string) {
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
 * Lista todas as regras de precificação dinâmica da barbearia.
 */
export async function listYieldRules(
  tenantId: string,
): Promise<YieldActionResult<YieldRule[]>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID da barbearia inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenant_yield_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, message: `Erro ao listar regras: ${error.message}` }
  }

  return { success: true, data: data ?? [] }
}

/**
 * Cria ou atualiza uma regra de yield management.
 */
export async function saveYieldRule(
  input: YieldRuleInput,
): Promise<YieldActionResult<YieldRule>> {
  if (!UUID_PATTERN.test(input.tenantId)) {
    return { success: false, message: 'ID da barbearia inválido.' }
  }

  const isAuth = await requireOwnerOrAdmin(input.tenantId)
  if (!isAuth) {
    return { success: false, message: 'Apenas proprietários podem gerenciar regras de precificação.' }
  }

  if (!input.name || input.name.trim().length < 3) {
    return { success: false, message: 'Nome da regra deve ter no mínimo 3 caracteres.' }
  }

  if (!Array.isArray(input.weekdays) || input.weekdays.length === 0) {
    return { success: false, message: 'Selecione ao menos um dia da semana.' }
  }

  if (!input.startsAt || !input.endsAt || input.startsAt >= input.endsAt) {
    return { success: false, message: 'Horário de término deve ser posterior ao horário de início.' }
  }

  if (input.discountValue < 0) {
    return { success: false, message: 'Valor do desconto não pode ser negativo.' }
  }

  if (input.discountType === 'percent' && input.discountValue > 80) {
    return { success: false, message: 'Desconto percentual não pode ultrapassar 80%.' }
  }

  const admin = createAdminClient()

  if (input.id) {
    // Update
    const { data, error } = await admin
      .from('tenant_yield_rules')
      .update({
        name: input.name.trim(),
        weekdays: input.weekdays,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        discount_type: input.discountType,
        discount_value: input.discountValue,
        require_full_reservation_fee: input.requireFullReservationFee,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('tenant_id', input.tenantId)
      .select('*')
      .single()

    if (error) {
      return { success: false, message: `Erro ao atualizar regra: ${error.message}` }
    }
    return { success: true, data }
  } else {
    // Insert
    const { data, error } = await admin
      .from('tenant_yield_rules')
      .insert({
        tenant_id: input.tenantId,
        name: input.name.trim(),
        weekdays: input.weekdays,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        discount_type: input.discountType,
        discount_value: input.discountValue,
        require_full_reservation_fee: input.requireFullReservationFee,
        is_active: input.isActive ?? true,
      })
      .select('*')
      .single()

    if (error) {
      return { success: false, message: `Erro ao criar regra: ${error.message}` }
    }
    return { success: true, data }
  }
}

/**
 * Ativa ou desativa uma regra de precificação.
 */
export async function toggleYieldRule(
  ruleId: string,
  isActive: boolean,
): Promise<YieldActionResult<{ id: string; is_active: boolean }>> {
  if (!UUID_PATTERN.test(ruleId)) {
    return { success: false, message: 'ID de regra inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenant_yield_rules')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', ruleId)
    .select('id, is_active')
    .single()

  if (error) {
    return { success: false, message: `Erro ao alterar status: ${error.message}` }
  }

  return { success: true, data }
}

/**
 * Exclui permanentemente uma regra de yield.
 */
export async function deleteYieldRule(
  ruleId: string,
): Promise<YieldActionResult<{ deleted: boolean }>> {
  if (!UUID_PATTERN.test(ruleId)) {
    return { success: false, message: 'ID de regra inválido.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenant_yield_rules')
    .delete()
    .eq('id', ruleId)

  if (error) {
    return { success: false, message: `Erro ao excluir regra: ${error.message}` }
  }

  return { success: true, data: { deleted: true } }
}
