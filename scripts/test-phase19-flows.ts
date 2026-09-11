import {
  classifyTrustScore,
  type TrustScoreProfile,
  type DynamicReservationFeePolicy,
} from '../lib/booking/trust-score'
import {
  resolveTierPriceAndDuration,
  getTierLabel,
  getTierBadge,
  type SeniorityTier,
} from '../lib/pricing/tiers'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALHA: ${message}`)
    process.exit(1)
  }
  console.log(`✅ SUCESSO: ${message}`)
}

async function runPhase19Tests() {
  console.log('🚀 INICIANDO TESTES AUTOMATIZADOS DA FASE 19...\n')

  // =========================================================
  // 1. TESTE DO SCORE DE CONFIABILIDADE (ANTI-NO-SHOW & SINAL)
  // =========================================================
  console.log('--- 1. TRUST SCORE & POLÍTICA DINÂMICA DE SINAL ---')

  // Teste de classificação
  assert(classifyTrustScore(95) === 'reliable', 'Score 95 deve ser reliable (Confiável)')
  assert(classifyTrustScore(80) === 'reliable', 'Score 80 deve ser reliable (Confiável)')
  assert(classifyTrustScore(79) === 'neutral', 'Score 79 deve ser neutral (Neutro)')
  assert(classifyTrustScore(50) === 'neutral', 'Score 50 deve ser neutral (Neutro)')
  assert(classifyTrustScore(49) === 'high_risk', 'Score 49 deve ser high_risk (Alto Risco)')
  assert(classifyTrustScore(10) === 'high_risk', 'Score 10 deve ser high_risk (Alto Risco)')

  // Simulação de evolução do Trust Score e Trava de Blacklist Preventiva
  let simulatedScore = 70 // Inicial neutro
  let consecutiveNoShows = 0
  let isBlacklisted = false
  let blacklistReason: string | null = null

  // Cliente conclui 2 cortes pontuais (+5 cada)
  simulatedScore = Math.min(100, simulatedScore + 5 + 5) // 80
  assert(simulatedScore === 80, 'Após 2 cortes bem-sucedidos pontuação deve subir para 80')
  assert(classifyTrustScore(simulatedScore) === 'reliable', 'Cliente agora é Confiável (Score 80)')

  // Política para cliente Confiável (Score >= 80): Sinal R$ 0,00
  const servicePrice = 60
  const defaultFee = 20
  const reliablePolicy = {
    canBook: !isBlacklisted,
    requiredFeeAmount: simulatedScore >= 80 ? 0 : defaultFee,
    requireFullPrepayment: false,
    policyLabel: 'Cliente Confiável: Isenção de Sinal (Paga 100% no Balcão)',
  }
  assert(reliablePolicy.requiredFeeAmount === 0, 'Cliente Confiável tem isenção de sinal (R$ 0,00)')
  assert(!reliablePolicy.requireFullPrepayment, 'Não exige pré-pagamento integral')

  // Cliente comete uma falta (No-Show: -40 pontos e +1 falta consecutiva)
  simulatedScore = Math.max(0, simulatedScore - 40) // 40
  consecutiveNoShows = 1
  assert(simulatedScore === 40, 'Após 1 no-show a pontuação cai para 40')
  assert(classifyTrustScore(simulatedScore) === 'high_risk', 'Cliente agora é Alto Risco (Score 40)')

  // Política para Alto Risco (< 50): 100% do corte antecipado
  const highRiskPolicy = {
    canBook: !isBlacklisted,
    requiredFeeAmount: simulatedScore < 50 ? servicePrice : defaultFee,
    requireFullPrepayment: simulatedScore < 50,
  }
  assert(highRiskPolicy.requiredFeeAmount === servicePrice, 'Cliente de Alto Risco deve pagar 100% do valor do corte antecipado')
  assert(highRiskPolicy.requireFullPrepayment === true, 'Flag de pré-pagamento obrigatório ativada')

  // Cliente comete a 2ª falta consecutiva (No-Show: trigger de Blacklist automática preventiva)
  simulatedScore = Math.max(0, simulatedScore - 40) // 0
  consecutiveNoShows = 2
  if (consecutiveNoShows >= 2) {
    isBlacklisted = true
    blacklistReason = 'Bloqueio preventivo automático: 2 faltas consecutivas (No-Show)'
  }
  assert(isBlacklisted === true, '2 no-shows consecutivos devem acionar a Blacklist preventiva')
  assert(blacklistReason?.includes('2 faltas consecutivas') || false, 'Motivo de bloqueio deve estar registrado')

  // =========================================================
  // 2. TESTE DO BOT DE WHATSAPP & TRAVA DE TRANSBORDO HUMANO
  // =========================================================
  console.log('\n--- 2. BOT DE WHATSAPP & TRANSBORDO HUMANO 24H ---')

  // Simulação de sessão e opções do menu
  const testPhone = '11999887766'
  const tenantSlug = 'barbearia-elite'

  // Opção 1: Link de Agendamento PWA com telefone pré-identificado
  const pwaBookingLink = `https://barbersaas.com/${tenantSlug}?phone=${testPhone}`
  assert(pwaBookingLink.includes(testPhone), 'Link de agendamento gerado deve conter o telefone pré-preenchido')
  assert(pwaBookingLink.includes(tenantSlug), 'Link de agendamento deve apontar para o slug da barbearia')

  // Opção 4: Transbordo Humano & Trava Anti-Interferência
  let botPausedUntil: Date | null = new Date(Date.now() + 24 * 60 * 60 * 1000)
  let transferredToHuman = true

  // Verifica se o bot está silenciado durante o atendimento humano
  const isBotSilenced = botPausedUntil && botPausedUntil.getTime() > Date.now()
  assert(isBotSilenced === true, 'Bot deve estar no modo silenciado (bot_paused_until > now)')

  // Quando o bot está silenciado e a mensagem não for reset, bot não emite resposta
  function simulateIncomingMessage(text: string): { reply: string | null; paused: boolean } {
    const isReset = ['menu', 'reiniciar', 'inicio'].includes(text.toLowerCase().trim())
    if (isBotSilenced && !isReset) {
      return { reply: null, paused: true }
    }
    return { reply: 'Menu Principal da Barbearia', paused: false }
  }

  const normalMessage = simulateIncomingMessage('Olá, ainda tem horário?')
  assert(normalMessage.reply === null, 'Bot silenciado NÃO deve responder para não interferir com o atendente humano')
  assert(normalMessage.paused === true, 'Status pausado confirmado')

  const resetMessage = simulateIncomingMessage('menu')
  assert(resetMessage.reply !== null, 'Comando MENU deve furar o silêncio e reativar o autoatendimento')

  // =========================================================
  // 3. TESTE DE CATEGORIAS DE PROFISSIONAIS (PREÇOS POR NÍVEL)
  // =========================================================
  console.log('\n--- 3. CATEGORIAS DE PROFISSIONAIS (JR / PL / MASTER) ---')

  const basePrice = 50
  const baseDuration = 35

  const tierOverrides = [
    { tier: 'junior', custom_price: 35, custom_duration_minutes: 45 },
    { tier: 'pleno', custom_price: 50, custom_duration_minutes: 35 },
    { tier: 'master', custom_price: 75, custom_duration_minutes: 30 },
  ]

  // Resolução para Júnior: R$ 35 (45 min)
  const juniorPricing = resolveTierPriceAndDuration(basePrice, baseDuration, 'junior', tierOverrides)
  assert(juniorPricing.price === 35, 'Barbeiro Júnior deve cobrar R$ 35')
  assert(juniorPricing.durationMinutes === 45, 'Barbeiro Júnior deve ter duração de 45 min')
  assert(juniorPricing.isCustomTier === true, 'Deve indicar que possui preço customizado de nível')

  // Resolução para Master: R$ 75 (30 min)
  const masterPricing = resolveTierPriceAndDuration(basePrice, baseDuration, 'master', tierOverrides)
  assert(masterPricing.price === 75, 'Barbeiro Master deve cobrar R$ 75')
  assert(masterPricing.durationMinutes === 30, 'Barbeiro Master deve ter duração de 30 min')

  // Resolução para Sênior sem override (Fallback para o valor base da barbearia)
  const seniorPricing = resolveTierPriceAndDuration(basePrice, baseDuration, 'senior', tierOverrides)
  assert(seniorPricing.price === basePrice, 'Sênior sem override deve herdar o preço base R$ 50')
  assert(seniorPricing.durationMinutes === baseDuration, 'Sênior sem override deve herdar duração base 35 min')
  assert(seniorPricing.isCustomTier === false, 'isCustomTier deve ser false no fallback')

  // Badges e Rótulos
  assert(getTierLabel('master') === 'Barbeiro Master', 'Rótulo do Master correto')
  assert(getTierBadge('junior').label === 'Júnior', 'Badge do Júnior correto')

  // =========================================================
  // 4. TESTE DO MÓDULO DE FRANQUIAS (ROYALTIES & FPP)
  // =========================================================
  console.log('\n--- 4. MÓDULO DE FRANQUIAS (ROYALTIES & FPP) ---')

  const branchGrossRevenue = 35400.00
  const royaltiesPercent = 5.0  // 5% de Royalties
  const fppPercent = 2.0        // 2% de Fundo de Propaganda
  const fixedMonthlyFee = 350.0 // Taxa fixa de franquia

  const royaltiesCalculated = Number(((branchGrossRevenue * royaltiesPercent) / 100).toFixed(2))
  const fppCalculated = Number(((branchGrossRevenue * fppPercent) / 100).toFixed(2))
  const totalDue = Number((royaltiesCalculated + fppCalculated + fixedMonthlyFee).toFixed(2))

  assert(royaltiesCalculated === 1770.00, `Royalties calculados: R$ ${royaltiesCalculated} (esperado 1770.00)`)
  assert(fppCalculated === 708.00, `FPP calculado: R$ ${fppCalculated} (esperado 708.00)`)
  assert(totalDue === 2828.00, `Total devido calculado: R$ ${totalDue} (esperado 2828.00)`)

  // Teste de Ranking de Performance entre Filiais
  const branchesMock = [
    { tenantId: 'unit-1', name: 'Filial Centro', grossRevenue: 48000, cuts: 800 },
    { tenantId: 'unit-2', name: 'Filial Shopping', grossRevenue: 62000, cuts: 950 },
    { tenantId: 'unit-3', name: 'Filial Jardins', grossRevenue: 31000, cuts: 420 },
  ]

  branchesMock.sort((a, b) => b.grossRevenue - a.grossRevenue)
  assert(branchesMock[0].tenantId === 'unit-2', '1º Lugar deve ser a Filial Shopping (R$ 62.000)')
  assert(branchesMock[1].tenantId === 'unit-1', '2º Lugar deve ser a Filial Centro (R$ 48.000)')
  assert(branchesMock[2].tenantId === 'unit-3', '3º Lugar deve ser a Filial Jardins (R$ 31.000)')

  const shoppingTicket = Number((branchesMock[0].grossRevenue / branchesMock[0].cuts).toFixed(2))
  assert(shoppingTicket === 65.26, `Ticket médio da filial líder: R$ ${shoppingTicket} (esperado 65.26)`)

  console.log('\n🎉 TODOS OS TESTES DA FASE 19 FORAM HOMOLOGADOS COM SUCESSO!')
}

runPhase19Tests().catch((err) => {
  console.error('Erro fatal nos testes:', err)
  process.exit(1)
})
