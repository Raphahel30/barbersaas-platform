import 'server-only'

import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type BirthdayMode = Database['public']['Enums']['birthday_mode']
export type RewardType = Database['public']['Enums']['reward_type']

export type BirthdayRulesConfig = {
  enabled: boolean
  mode: BirthdayMode
  reward_type: RewardType
  reward_value: number | null
  reward_reference_id: string | null
}

export type BirthdayRewardDetails = {
  rewardType: RewardType
  rewardValue: number | null
  rewardReferenceId: string | null
  description: string
}

export type BirthdayEligibilityResult = {
  eligible: boolean
  benefitYear: number
  reason?:
    | 'eligible'
    | 'feature_disabled'
    | 'no_birth_date'
    | 'not_birthday_period'
    | 'already_redeemed_this_year'
    | 'tenant_not_found'
    | 'client_not_found'
  message: string
  clientBirthDate?: string | null
  reward?: BirthdayRewardDetails
  existingRedemptionId?: string
}

export type BirthdayClaimResult = {
  success: boolean
  rewardId?: string
  benefitYear?: number
  expiresAt?: string
  reward?: BirthdayRewardDetails
  message: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function parseBirthdayRules(json: Json): BirthdayRulesConfig {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {
      enabled: false,
      mode: 'exact_day',
      reward_type: 'percentage_discount',
      reward_value: 10,
      reward_reference_id: null,
    }
  }

  const obj = json as Record<string, unknown>
  const mode = obj.mode === 'birth_month' ? 'birth_month' : 'exact_day'
  const rawRewardType = String(obj.reward_type || 'percentage_discount')
  const validRewardTypes: RewardType[] = [
    'full_discount',
    'percentage_discount',
    'fixed_discount',
    'free_product',
    'free_service',
  ]
  const reward_type = validRewardTypes.includes(rawRewardType as RewardType)
    ? (rawRewardType as RewardType)
    : 'percentage_discount'

  return {
    enabled: Boolean(obj.enabled),
    mode,
    reward_type,
    reward_value: typeof obj.reward_value === 'number' ? obj.reward_value : null,
    reward_reference_id: typeof obj.reward_reference_id === 'string' && UUID_PATTERN.test(obj.reward_reference_id)
      ? obj.reward_reference_id
      : null,
  }
}

function formatRewardDescription(rule: BirthdayRulesConfig): string {
  switch (rule.reward_type) {
    case 'full_discount':
      return '100% de desconto no atendimento de aniversário'
    case 'percentage_discount':
      return `${rule.reward_value ?? 10}% de desconto de aniversário`
    case 'fixed_discount':
      return `R$ ${(rule.reward_value ?? 0).toFixed(2)} de desconto de aniversário`
    case 'free_service':
      return 'Serviço cortesia de aniversário'
    case 'free_product':
      return 'Produto cortesia de presente de aniversário'
  }
}

/**
 * Cruza a data atual com `clients.birth_date` (profiles.birth_date) no fuso da barbearia.
 * Valida o modo ('exact_day' ou 'birth_month') e a trava de resgate único no ano em `birthday_redemptions`.
 */
export async function checkBirthdayEligibility(
  clientId: string,
  tenantId: string,
): Promise<BirthdayEligibilityResult> {
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(tenantId)) {
    return {
      eligible: false,
      benefitYear: new Date().getFullYear(),
      reason: 'client_not_found',
      message: 'Identificadores inválidos.',
    }
  }

  const admin = createAdminClient()

  const [profileResult, settingsResult] = await Promise.all([
    admin.from('profiles').select('id, birth_date, full_name').eq('id', clientId).single(),
    admin.from('tenant_settings').select('birthday_rules, timezone').eq('tenant_id', tenantId).single(),
  ])

  if (profileResult.error || !profileResult.data) {
    return {
      eligible: false,
      benefitYear: new Date().getFullYear(),
      reason: 'client_not_found',
      message: 'Cadastro do cliente não encontrado.',
    }
  }

  if (settingsResult.error || !settingsResult.data) {
    return {
      eligible: false,
      benefitYear: new Date().getFullYear(),
      reason: 'tenant_not_found',
      message: 'Configurações da barbearia não encontradas.',
    }
  }

  const rules = parseBirthdayRules(settingsResult.data.birthday_rules)
  if (!rules.enabled) {
    return {
      eligible: false,
      benefitYear: new Date().getFullYear(),
      reason: 'feature_disabled',
      message: 'O programa de aniversariantes não está ativo nesta barbearia.',
    }
  }

  const birthDateStr = profileResult.data.birth_date
  if (!birthDateStr) {
    return {
      eligible: false,
      benefitYear: new Date().getFullYear(),
      reason: 'no_birth_date',
      message: 'Data de aniversário não informada no perfil do cliente.',
    }
  }

  // Obter data atual no timezone da barbearia
  const timezone = settingsResult.data.timezone || 'America/Sao_Paulo'
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)

  const findPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10)
  const currentYear = findPart('year')
  const currentMonth = findPart('month') // 1 a 12
  const currentDay = findPart('day') // 1 a 31

  // Parse da data de nascimento (esperado formato 'YYYY-MM-DD')
  const dateSegments = birthDateStr.split('-')
  if (dateSegments.length < 3) {
    return {
      eligible: false,
      benefitYear: currentYear,
      reason: 'no_birth_date',
      message: 'Data de nascimento em formato inválido.',
    }
  }

  const birthMonth = parseInt(dateSegments[1], 10)
  const birthDay = parseInt(dateSegments[2], 10)

  // 1. Verificação de correspondência de calendário conforme o modo
  let matchesPeriod = false

  if (rules.mode === 'birth_month') {
    matchesPeriod = currentMonth === birthMonth
  } else {
    // Modo 'exact_day'
    if (currentMonth === birthMonth && currentDay === birthDay) {
      matchesPeriod = true
    } else if (
      birthMonth === 2 &&
      birthDay === 29 &&
      !isLeapYear(currentYear) &&
      currentMonth === 2 &&
      currentDay === 28
    ) {
      // Ajuste para quem nasceu em 29 de fevereiro em anos comuns
      matchesPeriod = true
    }
  }

  if (!matchesPeriod) {
    return {
      eligible: false,
      benefitYear: currentYear,
      clientBirthDate: birthDateStr,
      reason: 'not_birthday_period',
      message:
        rules.mode === 'exact_day'
          ? 'O benefício de aniversário só é liberado no dia exato do seu aniversário.'
          : 'O benefício de aniversário é liberado durante o seu mês de aniversário.',
    }
  }

  // 2. Trava estrita de resgate único por ano civil (birthday_redemptions)
  const existingRedemption = await admin
    .from('birthday_redemptions')
    .select('id, claimed_at, reward_id')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .eq('benefit_year', currentYear)
    .maybeSingle()

  if (existingRedemption.data) {
    return {
      eligible: false,
      benefitYear: currentYear,
      clientBirthDate: birthDateStr,
      reason: 'already_redeemed_this_year',
      existingRedemptionId: existingRedemption.data.id,
      message: `Você já resgatou seu presente de aniversário do ano de ${currentYear}.`,
    }
  }

  return {
    eligible: true,
    benefitYear: currentYear,
    clientBirthDate: birthDateStr,
    reason: 'eligible',
    message: 'Parabéns! Você tem direito ao benefício especial de aniversário.',
    reward: {
      rewardType: rules.reward_type,
      rewardValue: rules.reward_value,
      rewardReferenceId: rules.reward_reference_id,
      description: formatRewardDescription(rules),
    },
  }
}

/**
 * Concede e bloqueia o resgate do benefício de aniversário para o cliente no ano corrente.
 * Cria a recompensa em retention_rewards (validade 30 dias) e insere a trava em birthday_redemptions.
 */
export async function claimBirthdayReward(
  clientId: string,
  tenantId: string,
): Promise<BirthdayClaimResult> {
  const eligibility = await checkBirthdayEligibility(clientId, tenantId)
  if (!eligibility.eligible || !eligibility.reward) {
    return {
      success: false,
      message: eligibility.message,
    }
  }

  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Cria a recompensa em retention_rewards
  const rewardInsert = await admin
    .from('retention_rewards')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      source: 'birthday',
      reward_type: eligibility.reward.rewardType,
      reward_value: eligibility.reward.rewardValue,
      reward_reference_id: eligibility.reward.rewardReferenceId,
      status: 'available',
      expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (rewardInsert.error || !rewardInsert.data) {
    return {
      success: false,
      message: 'Não foi possível gerar a recompensa de aniversário.',
    }
  }

  const rewardId = rewardInsert.data.id

  // Registra a trava anual em birthday_redemptions
  const redemptionInsert = await admin.from('birthday_redemptions').insert({
    tenant_id: tenantId,
    client_id: clientId,
    benefit_year: eligibility.benefitYear,
    reward_id: rewardId,
  })

  if (redemptionInsert.error) {
    // Se a trava violar a constraint única (concorrência), cancela a recompensa criada
    await admin.from('retention_rewards').delete().eq('id', rewardId)
    return {
      success: false,
      message: 'O benefício de aniversário deste ano já foi resgatado anteriormente.',
    }
  }

  return {
    success: true,
    rewardId,
    benefitYear: eligibility.benefitYear,
    expiresAt,
    reward: eligibility.reward,
    message: 'Presente de aniversário resgatado com sucesso! Válido por 30 dias.',
  }
}

/**
 * Calcula o abatimento financeiro de aniversário sobre um total em centavos.
 */
export function calculateBirthdayDiscount(
  baseAmountCents: number,
  reward: BirthdayRewardDetails,
): { discountCents: number; payableCents: number } {
  if (baseAmountCents <= 0) {
    return { discountCents: 0, payableCents: 0 }
  }

  let discountCents = 0

  switch (reward.rewardType) {
    case 'full_discount':
    case 'free_service':
    case 'free_product':
      discountCents = baseAmountCents
      break
    case 'percentage_discount': {
      const pct = Math.min(100, Math.max(0, Number(reward.rewardValue ?? 0)))
      discountCents = Math.round((baseAmountCents * pct) / 100)
      break
    }
    case 'fixed_discount': {
      const fixedCents = Math.round(Number(reward.rewardValue ?? 0) * 100)
      discountCents = Math.min(baseAmountCents, Math.max(0, fixedCents))
      break
    }
  }

  const payableCents = Math.max(0, baseAmountCents - discountCents)
  return { discountCents, payableCents }
}
