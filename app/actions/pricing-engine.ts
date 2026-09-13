'use server'

export type PricingInput = {
  serviceName: string
  basePrice: number
  date: string // YYYY-MM-DD
  extras?: Array<{ name: string; price: number }>
  products?: Array<{ id: string; name: string; price: number; quantity: number }>
  isFidelityRedemption?: boolean
  isBirthdayBenefit?: boolean
  isMonthlySubscriber?: boolean
}

export type PricingResult = {
  serviceBasePrice: number
  subtotalExtras: number
  subtotalProducts: number
  grossTotal: number
  discountPromotion: number
  discountFidelity: number
  discountBirthday: number
  discountSubscriber: number
  totalDiscount: number
  finalPrice: number
  appliedPromotionTitle?: string
  appliedFidelityTitle?: string
  appliedBirthdayTitle?: string
  breakdownSummary: string
}

export async function calculateBookingPrice(input: PricingInput): Promise<PricingResult> {
  const serviceBasePrice = Number(input.basePrice || 0)
  const extrasList = input.extras || []
  const subtotalExtras = extrasList.reduce((acc, e) => acc + Number(e.price || 0), 0)

  const productsList = input.products || []
  const subtotalProducts = productsList.reduce(
    (acc, p) => acc + Number(p.price || 0) * Number(p.quantity || 1),
    0,
  )

  const grossTotal = serviceBasePrice + subtotalExtras + subtotalProducts

  // 1. Promoção por Dia da Semana (Ex: Terça e Quarta com 15% de desconto no serviço)
  let discountPromotion = 0
  let appliedPromotionTitle = ''

  if (input.date) {
    const dayOfWeek = new Date(`${input.date}T12:00:00Z`).getUTCDay()
    // 2 = Terça, 3 = Quarta
    if (dayOfWeek === 2 || dayOfWeek === 3) {
      discountPromotion = Math.round(serviceBasePrice * 0.15)
      appliedPromotionTitle = 'Promoção Terça & Quarta Clássica (15% OFF no serviço)'
    }
  }

  // 2. Benefício de Fidelidade (10 selos = R$ 15 OFF ou corte bonificado)
  let discountFidelity = 0
  let appliedFidelityTitle = ''
  if (input.isFidelityRedemption) {
    discountFidelity = Math.min(serviceBasePrice, 20)
    appliedFidelityTitle = 'Resgate Cartão Fidelidade Navalio (R$ 20 OFF)'
  }

  // 3. Benefício de Aniversariante (Mês do Aniversário = 20% OFF)
  let discountBirthday = 0
  let appliedBirthdayTitle = ''
  if (input.isBirthdayBenefit) {
    discountBirthday = Math.round(serviceBasePrice * 0.2)
    appliedBirthdayTitle = 'Presente de Aniversário (20% OFF)'
  }

  // 4. Benefício de Mensalista / Clube VIP (Corte 100% Coberto pelo Plano)
  let discountSubscriber = 0
  if (input.isMonthlySubscriber) {
    discountSubscriber = serviceBasePrice
  }

  const totalDiscount = Math.min(
    grossTotal,
    discountPromotion + discountFidelity + discountBirthday + discountSubscriber,
  )

  const finalPrice = Math.max(0, grossTotal - totalDiscount)

  const summaryParts: string[] = [
    `Serviço: R$ ${serviceBasePrice.toFixed(2)}`,
  ]
  if (subtotalExtras > 0) summaryParts.push(`Adicionais: +R$ ${subtotalExtras.toFixed(2)}`)
  if (subtotalProducts > 0) summaryParts.push(`Produtos: +R$ ${subtotalProducts.toFixed(2)}`)
  if (totalDiscount > 0) summaryParts.push(`Descontos: -R$ ${totalDiscount.toFixed(2)}`)

  return {
    serviceBasePrice,
    subtotalExtras,
    subtotalProducts,
    grossTotal,
    discountPromotion,
    discountFidelity,
    discountBirthday,
    discountSubscriber,
    totalDiscount,
    finalPrice,
    appliedPromotionTitle,
    appliedFidelityTitle,
    appliedBirthdayTitle,
    breakdownSummary: summaryParts.join(' | '),
  }
}
