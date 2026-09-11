import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ServiceTaxSplit = {
  grossAmount: number
  cardFeeAmount: number
  netAmountAfterFees: number
  partnerQuotaAmount: number // Cota-Parte Profissional-Parceiro (Não tributável pelo salão - Lei 13.352/2016)
  salonQuotaAmount: number   // Cota-Parte Salão-Parceiro (Receita própria tributável no Simples Nacional / Lucro Presumido)
  partnerRatePercent: number
  cardFeePercent: number
}

export type PartnerFiscalSummary = {
  barberId: string
  barberName: string
  taxDocument: string | null
  legalName: string | null
  partnerContractSignedAt: string | null
  isRegularized: boolean
  grossServicesTotal: number
  partnerQuotaReceived: number
  salonQuotaRetained: number
  appointmentsCount: number
}

export type MonthlyFiscalReport = {
  tenantId: string
  tenantName: string
  tenantDocument: string
  periodMonth: number
  periodYear: number
  periodLabel: string
  grossRevenue: number
  servicesGrossTotal: number
  productsGrossTotal: number
  cardIntermediationFees: number
  totalPartnerQuota: number // Dedução legal nos termos do art. 1º-A, § 4º da Lei 13.352/2016
  taxableSalonBase: number  // Base de cálculo tributável da barbearia
  estimatedSimplesTaxSavings: number // Economia tributária estimada (evitando bitributação a ~8%)
  totalAppointments: number
  partnersSummary: PartnerFiscalSummary[]
}

export type PartnerRPPDocument = {
  rppNumber: string
  cashClosingId: string
  periodStart: string
  periodEnd: string
  closingPeriod: string
  salon: {
    name: string
    document: string
    address: string
  }
  partner: {
    id: string
    name: string
    legalName: string
    taxDocument: string
    contractSignedAt: string | null
    isMeiRegularized: boolean
  }
  financials: {
    grossServices: number
    grossProducts: number
    grossTotal: number
    intermediationFees: number
    partnerQuotaTotal: number
    salonQuotaTotal: number
    cashCollectedByBarber: number
    netTransferAmount: number
    direction: 'owner_pays_barber' | 'barber_pays_owner' | 'settled'
  }
  legalDeclaration: string
  issuedAt: string
}

const toCents = (val: number) => Math.round(val * 100)
const fromCents = (val: number) => val / 100

/**
 * Calcula a segregação tributária estrita da Lei 13.352/2016 para um atendimento.
 */
export function calculateServiceTaxSplit(
  grossAmount: number,
  commissionPercent: number,
  cardFeePercent = 0,
): ServiceTaxSplit {
  const grossCents = toCents(grossAmount)
  const cardFeeCents = Math.round((grossCents * cardFeePercent) / 100)
  const netCents = Math.max(0, grossCents - cardFeeCents)

  const partnerQuotaCents = Math.round((netCents * commissionPercent) / 100)
  const salonQuotaCents = grossCents - partnerQuotaCents - cardFeeCents

  return {
    grossAmount: fromCents(grossCents),
    cardFeeAmount: fromCents(cardFeeCents),
    netAmountAfterFees: fromCents(netCents),
    partnerQuotaAmount: fromCents(partnerQuotaCents),
    salonQuotaAmount: fromCents(salonQuotaCents),
    partnerRatePercent: commissionPercent,
    cardFeePercent,
  }
}

/**
 * Consolidação fiscal mensal para envio ao contador.
 * Segrega faturamento bruto, cota do parceiro (dedução legal) e base de cálculo do salão.
 */
export async function getMonthlyFiscalConsolidation(
  tenantId: string,
  month: number,
  year: number,
): Promise<MonthlyFiscalReport> {
  if (!UUID_REGEX.test(tenantId)) throw new Error('ID de tenant inválido')
  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    throw new Error('Mês ou ano de competência inválido')
  }

  const admin = createAdminClient()

  // Buscar dados cadastrais do salão
  const tenantRes = await admin
    .from('tenants')
    .select('name, address')
    .eq('id', tenantId)
    .single()

  const orgRes = await admin
    .from('organizations')
    .select('document')
    .limit(1)
    .maybeSingle()

  const tenantName = tenantRes.data?.name ?? 'Barbearia Salão-Parceiro'
  const tenantDocument = orgRes.data?.document ?? 'CNPJ Não Cadastrado'

  // Delimitar início e fim do mês UTC
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
  const nextMonthDate = new Date(Date.UTC(year, month, 1, 0, 0, 0))
  const startIso = startDate.toISOString()
  const endIso = nextMonthDate.toISOString()

  // Buscar atendimentos concluídos no mês
  const [appointmentsRes, salesRes, barbersRes] = await Promise.all([
    admin
      .from('appointments')
      .select('id, barber_id, total_amount, payment_method, status, completed_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_at', startIso)
      .lt('completed_at', endIso),
    admin
      .from('product_sales')
      .select('barber_id, total_amount, sold_at')
      .eq('tenant_id', tenantId)
      .gte('sold_at', startIso)
      .lt('sold_at', endIso),
    admin
      .from('profiles')
      .select('id, full_name, commission_percent, tax_document, legal_name, partner_contract_signed_at')
      .eq('tenant_id', tenantId)
      .eq('role', 'barber'),
  ])

  if (appointmentsRes.error) throw new Error(`Erro ao buscar atendimentos: ${appointmentsRes.error.message}`)
  if (salesRes.error) throw new Error(`Erro ao buscar vendas: ${salesRes.error.message}`)
  if (barbersRes.error) throw new Error(`Erro ao buscar profissionais: ${barbersRes.error.message}`)

  const appointments = appointmentsRes.data ?? []
  const sales = salesRes.data ?? []
  const barbers = barbersRes.data ?? []

  // Mapa de barbeiros
  const barberMap = new Map<string, typeof barbers[0]>()
  for (const b of barbers) {
    barberMap.set(b.id, b)
  }

  // Agrupamento por barbeiro
  const partnerMap = new Map<string, {
    grossServicesCents: number
    partnerQuotaCents: number
    salonQuotaCents: number
    count: number
  }>()

  let totalServicesCents = 0
  let totalPartnerQuotaCents = 0
  let totalIntermediationFeesCents = 0

  for (const appt of appointments) {
    const grossCents = toCents(appt.total_amount)
    totalServicesCents += grossCents

    const barber = barberMap.get(appt.barber_id)
    const rate = barber?.commission_percent ?? 50

    // Estimativa de taxa de intermediação de cartão (2.5% para cartão/online)
    const feeRate = ['card_machine', 'online_gateway'].includes(appt.payment_method ?? '') ? 2.5 : 0
    const split = calculateServiceTaxSplit(fromCents(grossCents), rate, feeRate)

    const partnerQuotaCents = toCents(split.partnerQuotaAmount)
    const cardFeeCents = toCents(split.cardFeeAmount)
    const salonQuotaCents = toCents(split.salonQuotaAmount)

    totalPartnerQuotaCents += partnerQuotaCents
    totalIntermediationFeesCents += cardFeeCents

    const curr = partnerMap.get(appt.barber_id) ?? {
      grossServicesCents: 0,
      partnerQuotaCents: 0,
      salonQuotaCents: 0,
      count: 0,
    }
    curr.grossServicesCents += grossCents
    curr.partnerQuotaCents += partnerQuotaCents
    curr.salonQuotaCents += salonQuotaCents
    curr.count += 1
    partnerMap.set(appt.barber_id, curr)
  }

  const totalProductsCents = sales.reduce((sum, s) => sum + toCents(s.total_amount), 0)
  const grossRevenueCents = totalServicesCents + totalProductsCents
  const taxableSalonBaseCents = grossRevenueCents - totalPartnerQuotaCents - totalIntermediationFeesCents

  // Economia tributária estimada: Salão pagaria ~8% sobre o total se houvesse bitributação.
  // Graças à Lei do Salão-Parceiro, a cota do parceiro não é tributada na pessoa jurídica da barbearia.
  const estimatedTaxSavingsCents = Math.round(totalPartnerQuotaCents * 0.08)

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ]
  const periodLabel = `${monthNames[month - 1]} de ${year}`

  const partnersSummary: PartnerFiscalSummary[] = barbers.map((barber) => {
    const data = partnerMap.get(barber.id) ?? {
      grossServicesCents: 0,
      partnerQuotaCents: 0,
      salonQuotaCents: 0,
      count: 0,
    }

    const hasTaxDoc = Boolean(barber.tax_document && barber.tax_document.trim().length >= 11)
    const hasContract = Boolean(barber.partner_contract_signed_at)

    return {
      barberId: barber.id,
      barberName: barber.full_name,
      taxDocument: barber.tax_document,
      legalName: barber.legal_name,
      partnerContractSignedAt: barber.partner_contract_signed_at,
      isRegularized: hasTaxDoc && hasContract,
      grossServicesTotal: fromCents(data.grossServicesCents),
      partnerQuotaReceived: fromCents(data.partnerQuotaCents),
      salonQuotaRetained: fromCents(data.salonQuotaCents),
      appointmentsCount: data.count,
    }
  })

  return {
    tenantId,
    tenantName,
    tenantDocument,
    periodMonth: month,
    periodYear: year,
    periodLabel,
    grossRevenue: fromCents(grossRevenueCents),
    servicesGrossTotal: fromCents(totalServicesCents),
    productsGrossTotal: fromCents(totalProductsCents),
    cardIntermediationFees: fromCents(totalIntermediationFeesCents),
    totalPartnerQuota: fromCents(totalPartnerQuotaCents),
    taxableSalonBase: fromCents(taxableSalonBaseCents),
    estimatedSimplesTaxSavings: fromCents(estimatedTaxSavingsCents),
    totalAppointments: appointments.length,
    partnersSummary,
  }
}

/**
 * Emite o Recibo de Pagamento a Profissional Parceiro (RPP) formalizado
 * referente a um fechamento de caixa (`cash_closings`).
 */
export async function generateCashClosingRPP(cashClosingId: string): Promise<PartnerRPPDocument> {
  if (!UUID_REGEX.test(cashClosingId)) throw new Error('ID de fechamento de caixa inválido')

  const admin = createAdminClient()

  // Buscar fechamento de caixa
  const closingRes = await admin
    .from('cash_closings')
    .select('*')
    .eq('id', cashClosingId)
    .single()

  if (closingRes.error || !closingRes.data) {
    throw new Error('Fechamento de caixa não encontrado.')
  }
  const closing = closingRes.data

  // Buscar barbearia e barbeiro
  const [tenantRes, orgRes, barberRes] = await Promise.all([
    admin.from('tenants').select('name, address').eq('id', closing.tenant_id).single(),
    admin.from('organizations').select('document').limit(1).maybeSingle(),
    admin.from('profiles').select('*').eq('id', closing.barber_id).single(),
  ])

  if (barberRes.error || !barberRes.data) {
    throw new Error('Profissional parceiro não encontrado.')
  }

  const barber = barberRes.data
  const tenantName = tenantRes.data?.name ?? 'Salão-Parceiro'
  const tenantDoc = orgRes.data?.document ?? 'CNPJ Não Cadastrado'
  const rawAddr = tenantRes.data?.address as Record<string, unknown> | null
  const addressStr = rawAddr && typeof rawAddr === 'object'
    ? `${rawAddr.street ?? ''}, ${rawAddr.number ?? ''} - ${rawAddr.neighborhood ?? ''}, ${rawAddr.city ?? ''}/${rawAddr.state ?? ''}`
    : 'Endereço Comercial'

  const grossServices = closing.services_gross_amount ?? 0
  const grossProducts = closing.products_gross_amount ?? 0
  const grossTotal = closing.gross_amount ?? (grossServices + grossProducts)
  const partnerQuota = closing.commission_amount ?? 0
  const cashInHand = closing.cash_in_hand ?? 0
  const netTransfer = closing.net_transfer_amount ?? (partnerQuota - cashInHand)
  const salonQuota = Math.max(0, grossTotal - partnerQuota)

  const direction: 'owner_pays_barber' | 'barber_pays_owner' | 'settled' =
    netTransfer > 0 ? 'owner_pays_barber' : netTransfer < 0 ? 'barber_pays_owner' : 'settled'

  const rppNumber = `RPP-${closing.id.slice(0, 8).toUpperCase()}`
  const issuedAt = new Date().toISOString()

  const legalDeclaration = `
DECLARAÇÃO DE NATUREZA CIVIL E SEGREGABILIDADE TRIBUTÁRIA (LEI Nº 13.352/2016):
O Salão-Parceiro e o Profissional-Parceiro declaram, para todos os efeitos fiscais, contábeis e jurídicos:
1. A cota-parte destinada ao Profissional-Parceiro no valor de R$ ${partnerQuota.toFixed(2)} possui natureza civil de partilha de receita, não constituindo receita bruta do Salão-Parceiro e não integrando a base de cálculo tributária da barbearia no Simples Nacional ou Lucro Presumido, nos exatos termos do Art. 1º-A, § 4º da Lei nº 12.592/2012 com redação dada pela Lei nº 13.352/2016.
2. Inexistência de qualquer vínculo empregatício, subordinação jurídica ou habitualidade trabalhista entre as partes, atuando o Profissional-Parceiro com autonomia na gestão de seus serviços e sendo o único responsável pelo recolhimento de suas obrigações tributárias e previdenciárias inerentes à sua qualidade de Microempreendedor Individual (MEI/SIMEI) ou Pessoa Jurídica.
`.trim()

  return {
    rppNumber,
    cashClosingId: closing.id,
    periodStart: closing.period_start,
    periodEnd: closing.period_end,
    closingPeriod: closing.period,
    salon: {
      name: tenantName,
      document: tenantDoc,
      address: addressStr,
    },
    partner: {
      id: barber.id,
      name: barber.full_name,
      legalName: barber.legal_name || barber.full_name,
      taxDocument: barber.tax_document || 'Não Informado',
      contractSignedAt: barber.partner_contract_signed_at,
      isMeiRegularized: Boolean(barber.tax_document && barber.tax_document.length >= 11),
    },
    financials: {
      grossServices,
      grossProducts,
      grossTotal,
      intermediationFees: 0,
      partnerQuotaTotal: partnerQuota,
      salonQuotaTotal: salonQuota,
      cashCollectedByBarber: cashInHand,
      netTransferAmount: Math.abs(netTransfer),
      direction,
    },
    legalDeclaration,
    issuedAt,
  }
}

/**
 * Exporta os dados da consolidação contábil mensal em formato CSV compatível com Excel (com UTF-8 BOM).
 */
export function exportFiscalReportCsv(report: MonthlyFiscalReport): string {
  const BOM = '\uFEFF'
  const lines: string[] = []

  lines.push(`RELATÓRIO CONTÁBIL FISCAL - LEI DO SALÃO-PARCEIRO (LEI 13.352/2016)`)
  lines.push(`Empresa: ${report.tenantName};CNPJ: ${report.tenantDocument}`)
  lines.push(`Competência: ${report.periodLabel}`)
  lines.push(``)
  lines.push(`RESUMO CONSOLIDADO DA COMPETÊNCIA`)
  lines.push(`Faturamento Bruto Total (Serviços + Produtos);R$ ${report.grossRevenue.toFixed(2)}`)
  lines.push(`(-) Dedução Legal Cota-Parte Profissionais Parceiros (Art. 1-A Lei 13.352);R$ ${report.totalPartnerQuota.toFixed(2)}`)
  lines.push(`(-) Taxas de Intermediação de Cartões / Gateway;R$ ${report.cardIntermediationFees.toFixed(2)}`)
  lines.push(`(=) Receita Própria Tributável Salão-Parceiro (Base Simples/Presumido);R$ ${report.taxableSalonBase.toFixed(2)}`)
  lines.push(`Economia Tributária Estimada da Barbearia (Anti-Bitributação);R$ ${report.estimatedSimplesTaxSavings.toFixed(2)}`)
  lines.push(`Total de Atendimentos Realizados;${report.totalAppointments}`)
  lines.push(``)
  lines.push(`DETALHAMENTO POR PROFISSIONAL-PARCEIRO`)
  lines.push(`Nome do Profissional;CNPJ / CPF;Razão Social MEI;Contrato Assinado;Atendimentos;Faturamento Bruto;Cota do Parceiro (R$);Cota do Salão (R$);Status`)

  for (const p of report.partnersSummary) {
    const status = p.isRegularized ? 'Regularizado' : 'Pendente Documentação'
    const contract = p.partnerContractSignedAt ? new Date(p.partnerContractSignedAt).toLocaleDateString('pt-BR') : 'Não assinado'
    lines.push(
      `"${p.barberName}";"${p.taxDocument || 'Não informado'}";"${p.legalName || p.barberName}";"${contract}";${p.appointmentsCount};R$ ${p.grossServicesTotal.toFixed(2)};R$ ${p.partnerQuotaReceived.toFixed(2)};R$ ${p.salonQuotaRetained.toFixed(2)};"${status}"`
    )
  }

  return BOM + lines.join('\r\n')
}
