// Mock server-only para execução de testes via TSX fora do bundle Next.js
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Module = require('module')
const origRequire = Module.prototype.require
// eslint-disable-next-line @typescript-eslint/no-explicit-any
Module.prototype.require = function (id: string, ...args: any[]) {
  if (id === 'server-only') return {}
  return origRequire.call(this, id, ...args)
}

import { calculateServiceTaxSplit, exportFiscalReportCsv, type MonthlyFiscalReport } from '../lib/fiscal/salao-parceiro'
import { matchYieldRuleForSlot } from '../lib/booking/pricing'
import { processVisagismAnalysis } from '../lib/ai/visagism'
import type { Database } from '../types/database.types'

type YieldRuleRow = Database['public']['Tables']['tenant_yield_rules']['Row']

async function runPhase17Tests() {
  console.log('=================================================================')
  console.log('TESTES AUTOMATIZADOS - FASE 17: COMPLIANCE FISCAL, YIELD & IA')
  console.log('=================================================================\n')

  let passed = 0
  let total = 0

  function assert(condition: boolean, description: string) {
    total++
    if (condition) {
      console.log(`✅ [APROVADO] ${description}`)
      passed++
    } else {
      console.error(`❌ [FALHA] ${description}`)
      process.exitCode = 1
    }
  }

  // 1. TESTES LEI DO SALÃO-PARCEIRO (LEI 13.352/2016)
  console.log('--- TESTANDO COMPLIANCE LEI DO SALÃO-PARCEIRO ---')
  const splitNoFee = calculateServiceTaxSplit(100.0, 50, 0)
  assert(
    splitNoFee.grossAmount === 100 &&
    splitNoFee.partnerQuotaAmount === 50 &&
    splitNoFee.salonQuotaAmount === 50 &&
    splitNoFee.cardFeeAmount === 0,
    'Divisão 50/50 sem taxas: Cota Parceiro = R$ 50, Cota Salão = R$ 50'
  )

  const splitWithCardFee = calculateServiceTaxSplit(100.0, 60, 2.5)
  // Bruto: 100. Taxa cartão (2.5%): 2.50. Líquido: 97.50.
  // Parceiro (60% de 97.50): 58.50.
  // Salão: 100 - 58.50 - 2.50 = 39.00
  assert(
    splitWithCardFee.cardFeeAmount === 2.5 &&
    splitWithCardFee.partnerQuotaAmount === 58.5 &&
    splitWithCardFee.salonQuotaAmount === 39.0,
    'Segregação com taxa de maquininha de 2.5%: Salão é tributado apenas sobre R$ 39,00 evitando bitributação'
  )

  const mockReport: MonthlyFiscalReport = {
    tenantId: '00000000-0000-0000-0000-000000000001',
    tenantName: 'Barbearia Imperial',
    tenantDocument: '12.345.678/0001-90',
    periodMonth: 9,
    periodYear: 2026,
    periodLabel: 'Setembro de 2026',
    grossRevenue: 25000,
    servicesGrossTotal: 22000,
    productsGrossTotal: 3000,
    cardIntermediationFees: 625,
    totalPartnerQuota: 11000,
    taxableSalonBase: 13375,
    estimatedSimplesTaxSavings: 880,
    totalAppointments: 320,
    partnersSummary: [
      {
        barberId: 'barber-1',
        barberName: 'Carlos Barbeiro MEI',
        taxDocument: '11222333000144',
        legalName: 'CARLOS SILVA MEI',
        partnerContractSignedAt: '2026-01-15T10:00:00Z',
        isRegularized: true,
        grossServicesTotal: 12000,
        partnerQuotaReceived: 6000,
        salonQuotaRetained: 6000,
        appointmentsCount: 160,
      },
    ],
  }

  const csv = exportFiscalReportCsv(mockReport)
  assert(
    csv.startsWith('\uFEFF') &&
    csv.includes('LEI 13.352/2016') &&
    csv.includes('11000.00') &&
    csv.includes('CARLOS SILVA MEI'),
    'Exportação de planilha CSV com UTF-8 BOM e dados segregados para o contador gerada com sucesso'
  )

  // 2. TESTES YIELD PRICING & GESTÃO DE OCIOSIDADE
  console.log('\n--- TESTANDO YIELD MANAGEMENT & PRECIFICAÇÃO DINÂMICA ---')
  const testRules: YieldRuleRow[] = [
    {
      id: 'rule-happy-hour',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      name: 'Happy Hour Quarta-Feira',
      weekdays: [3], // Quarta
      starts_at: '10:00',
      ends_at: '15:00',
      discount_type: 'percent',
      discount_value: 20, // 20% off
      require_full_reservation_fee: false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'rule-peak-saturday',
      tenant_id: '00000000-0000-0000-0000-000000000001',
      name: 'Tarifa de Pico Sábado',
      weekdays: [6], // Sábado
      starts_at: '16:00',
      ends_at: '20:00',
      discount_type: 'percent',
      discount_value: 0,
      require_full_reservation_fee: true, // 100% de sinal
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  // Quarta-feira às 11:30 (minuto 690)
  const wednesdayPromo = matchYieldRuleForSlot(testRules, 3, 690, 80.0, 20.0)
  assert(
    wednesdayPromo.isPromotional === true &&
    wednesdayPromo.discountAmount === 16.0 &&
    wednesdayPromo.finalPrice === 64.0 &&
    wednesdayPromo.promotionalBadge?.includes('-20%') === true,
    'Horário de ociosidade na quarta-feira aplica automaticamente desconto de 20% (R$ 80 -> R$ 64)'
  )

  // Sábado às 17:00 (minuto 1020)
  const saturdayPeak = matchYieldRuleForSlot(testRules, 6, 1020, 80.0, 20.0)
  assert(
    saturdayPeak.isPromotional === false &&
    saturdayPeak.requireFullFee === true &&
    saturdayPeak.finalReservationFee === 80.0,
    'Horário de pico no sábado exige taxa de reserva integral (100% de sinal = R$ 80,00)'
  )

  // 3. TESTES CONSULTORIA DE VISAGISMO COM IA
  console.log('\n--- TESTANDO VISAGISMO FACIAL COM IA ---')
  const dummySelfie = 'data:image/jpeg;base64,' + 'A'.repeat(600)
  const visagismResult = await processVisagismAnalysis(
    '00000000-0000-0000-0000-000000000001',
    dummySelfie
  )

  assert(
    ['oval', 'square', 'round', 'diamond', 'heart'].includes(visagismResult.faceShape),
    `Formato facial identificado com sucesso: ${visagismResult.faceShapeLabel}`
  )

  assert(
    visagismResult.recommendations.length === 3 &&
    visagismResult.recommendations.every((r) => r.haircutName && r.beardStyle && r.whyItSuits),
    'IA gerou 3 recomendações estéticas completas com corte, desenho de barba e justificativa'
  )

  console.log('\n=================================================================')
  console.log(`TOTAL DE TESTES DA FASE 17: ${passed}/${total} APROVADOS`)
  console.log('=================================================================')
}

runPhase17Tests()
