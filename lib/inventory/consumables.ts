import { createAdminClient } from '@/utils/supabase/admin'

export interface ConsumableDeductionItem {
  productId: string
  productName: string
  quantityDeducted: number
  previousStock: number
  newStock: number
  minStockThreshold: number
  unit: string
  isLowStock: boolean
}

export interface LowStockAlert {
  productId: string
  productName: string
  currentStock: number
  minStockThreshold: number
  suggestedPurchaseQuantity: number
  unit: string
}

export interface DeductionResult {
  success: boolean
  appointmentId: string
  deductions: ConsumableDeductionItem[]
  lowStockAlerts: LowStockAlert[]
  message?: string
}

/**
 * Calcula a quantidade de compra recomendada para restabelecer o estoque de segurança.
 * Fórmula: dobro do estoque mínimo com margem de segurança, descontando o saldo atual.
 */
export function calculateSuggestedPurchase(currentStock: number, minStockThreshold: number): number {
  const safetyStockTarget = Math.max(minStockThreshold * 2.5, minStockThreshold + 10)
  const required = Math.ceil(safetyStockTarget - currentStock)
  return Math.max(required, Math.ceil(minStockThreshold))
}

/**
 * Realiza a baixa fracionada automática dos insumos vinculados aos serviços de um agendamento concluído.
 */
export async function deductConsumablesForAppointment(
  appointmentId: string
): Promise<DeductionResult> {
  const admin = createAdminClient()

  // 1. Busca os serviços realizados no agendamento
  const { data: appointmentServices, error: apptServErr } = await admin
    .from('appointment_services')
    .select('service_id, services(id, name, tenant_id)')
    .eq('appointment_id', appointmentId)

  if (apptServErr || !appointmentServices || appointmentServices.length === 0) {
    return {
      success: true,
      appointmentId,
      deductions: [],
      lowStockAlerts: [],
      message: 'Nenhum serviço registrado neste agendamento.',
    }
  }

  const serviceIds = appointmentServices.map((as) => as.service_id)

  // 2. Busca a ficha técnica de insumos para estes serviços
  const { data: consumables, error: consErr } = await admin
    .from('service_consumables')
    .select('service_id, product_id, quantity_consumed')
    .in('service_id', serviceIds)

  if (consErr || !consumables || consumables.length === 0) {
    return {
      success: true,
      appointmentId,
      deductions: [],
      lowStockAlerts: [],
      message: 'Os serviços deste agendamento não possuem insumos configurados na ficha técnica.',
    }
  }

  // 3. Agrupa o total consumido por produto (um mesmo insumo pode ser gasto em múltiplos serviços do corte)
  const productConsumptionMap = new Map<string, number>()
  for (const item of consumables) {
    const qty = Number(item.quantity_consumed) || 0
    const currentTotal = productConsumptionMap.get(item.product_id) || 0
    productConsumptionMap.set(item.product_id, currentTotal + qty)
  }

  const productIds = Array.from(productConsumptionMap.keys())

  // 4. Busca os dados dos produtos a serem baixados
  const { data: products, error: prodErr } = await admin
    .from('products')
    .select('id, tenant_id, name, stock_quantity, min_stock_threshold, unit')
    .in('id', productIds)

  if (prodErr || !products || products.length === 0) {
    return {
      success: false,
      appointmentId,
      deductions: [],
      lowStockAlerts: [],
      message: 'Não foi possível localizar os insumos no estoque.',
    }
  }

  const deductions: ConsumableDeductionItem[] = []
  const lowStockAlerts: LowStockAlert[] = []

  // 5. Atualiza o estoque de cada insumo
  for (const product of products) {
    const qtyToDeduct = productConsumptionMap.get(product.id) || 0
    const previousStock = Number(product.stock_quantity) || 0
    const minThreshold = Number(product.min_stock_threshold) || 5
    const unit = product.unit || 'un'

    // Novo estoque com precisão decimal para ml/gramas/fracionados
    const newStock = Math.max(0, Number((previousStock - qtyToDeduct).toFixed(4)))
    const isLowStock = newStock <= minThreshold

    const { error: updateErr } = await admin
      .from('products')
      .update({
        stock_quantity: newStock,
        updated_at: new Date().toISOString(),
      })
      .eq('id', product.id)

    if (!updateErr) {
      deductions.push({
        productId: product.id,
        productName: product.name,
        quantityDeducted: qtyToDeduct,
        previousStock,
        newStock,
        minStockThreshold: minThreshold,
        unit,
        isLowStock,
      })

      if (isLowStock) {
        lowStockAlerts.push({
          productId: product.id,
          productName: product.name,
          currentStock: newStock,
          minStockThreshold: minThreshold,
          suggestedPurchaseQuantity: calculateSuggestedPurchase(newStock, minThreshold),
          unit,
        })
      }
    }
  }

  return {
    success: true,
    appointmentId,
    deductions,
    lowStockAlerts,
    message: `${deductions.length} insumos baixados com sucesso.`,
  }
}

/**
 * Consulta todos os insumos e produtos em ponto de pedido (estoque mínimo atingido) da barbearia.
 */
export async function getLowStockAlerts(tenantId: string): Promise<LowStockAlert[]> {
  const admin = createAdminClient()

  const { data: products, error } = await admin
    .from('products')
    .select('id, name, stock_quantity, min_stock_threshold, unit')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error || !products) {
    return []
  }

  const alerts: LowStockAlert[] = []

  for (const p of products) {
    const stock = Number(p.stock_quantity) || 0
    const threshold = Number(p.min_stock_threshold) || 5
    if (stock <= threshold) {
      alerts.push({
        productId: p.id,
        productName: p.name,
        currentStock: stock,
        minStockThreshold: threshold,
        suggestedPurchaseQuantity: calculateSuggestedPurchase(stock, threshold),
        unit: p.unit || 'un',
      })
    }
  }

  return alerts
}
