'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { getLowStockAlerts, type LowStockAlert } from '@/lib/inventory/consumables'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ConsumableItemInput {
  productId: string
  quantityConsumed: number
}

export interface ServiceConsumableDetail {
  id: string
  serviceId: string
  productId: string
  productName: string
  quantityConsumed: number
  stockQuantity: number
  minStockThreshold: number
  unit: string
}

export interface ConsumableActionResult {
  success: boolean
  message: string
}

/**
 * Salva a ficha técnica de insumos consumidos por um serviço específico.
 * Exemplo: 1 Barba consome 1 lâmina descartável, 1 gola higiênica e 10ml de loção pós-barba.
 */
export async function saveServiceConsumablesAction(
  tenantId: string,
  serviceId: string,
  consumables: ConsumableItemInput[]
): Promise<ConsumableActionResult> {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(serviceId)) {
    return { success: false, message: 'Parâmetros inválidos.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = typeof authData?.claims?.sub === 'string' ? authData.claims.sub : null

  if (!userId) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('role, tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || profile.tenant_id !== tenantId || !['owner', 'receptionist'].includes(profile.role)) {
    return { success: false, message: 'Apenas proprietários e recepcionistas podem gerenciar a ficha técnica de insumos.' }
  }

  // 1. Remove vínculos anteriores deste serviço
  await admin
    .from('service_consumables')
    .delete()
    .eq('service_id', serviceId)
    .eq('tenant_id', tenantId)

  if (consumables.length === 0) {
    return { success: true, message: 'Ficha técnica atualizada com sucesso (sem insumos vinculados).' }
  }

  // 2. Insere a nova lista de insumos
  const rowsToInsert = consumables
    .filter((c) => UUID_PATTERN.test(c.productId) && Number(c.quantityConsumed) > 0)
    .map((c) => ({
      tenant_id: tenantId,
      service_id: serviceId,
      product_id: c.productId,
      quantity_consumed: Number(c.quantityConsumed),
    }))

  if (rowsToInsert.length > 0) {
    const { error: insertErr } = await admin
      .from('service_consumables')
      .insert(rowsToInsert)

    if (insertErr) {
      return { success: false, message: 'Falha ao salvar itens da ficha técnica.' }
    }
  }

  return { success: true, message: 'Ficha técnica de insumos salva com sucesso!' }
}

/**
 * Consulta a ficha técnica de insumos configurada para um serviço.
 */
export async function getServiceConsumablesAction(
  serviceId: string
): Promise<{ success: boolean; items: ServiceConsumableDetail[]; message?: string }> {
  if (!UUID_PATTERN.test(serviceId)) {
    return { success: false, items: [], message: 'Identificador do serviço inválido.' }
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('service_consumables')
    .select(`
      id,
      service_id,
      product_id,
      quantity_consumed,
      products (
        id,
        name,
        stock_quantity,
        min_stock_threshold,
        unit
      )
    `)
    .eq('service_id', serviceId)

  if (error || !data) {
    return { success: false, items: [], message: 'Erro ao carregar insumos do serviço.' }
  }

  const items: ServiceConsumableDetail[] = data.map((row: any) => ({
    id: row.id,
    serviceId: row.service_id,
    productId: row.product_id,
    productName: row.products?.name || 'Insumo',
    quantityConsumed: Number(row.quantity_consumed),
    stockQuantity: Number(row.products?.stock_quantity) || 0,
    minStockThreshold: Number(row.products?.min_stock_threshold) || 5,
    unit: row.products?.unit || 'un',
  }))

  return { success: true, items }
}

/**
 * Lista todos os alertas de estoque mínimo / ponto de pedido para o painel do proprietário.
 */
export async function getLowStockAlertsAction(
  tenantId: string
): Promise<{ success: boolean; alerts: LowStockAlert[]; message?: string }> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, alerts: [], message: 'Barbearia inválida.' }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = typeof authData?.claims?.sub === 'string' ? authData.claims.sub : null

  if (!userId) {
    return { success: false, alerts: [], message: 'Não autorizado.' }
  }

  try {
    const alerts = await getLowStockAlerts(tenantId)
    return { success: true, alerts }
  } catch (err) {
    return { success: false, alerts: [], message: 'Erro ao calcular alertas de estoque.' }
  }
}

/**
 * Atualiza o saldo de estoque e limite de segurança de um insumo/produto.
 */
export async function adjustProductStockAction(
  tenantId: string,
  productId: string,
  newStock: number,
  minStockThreshold?: number
): Promise<ConsumableActionResult> {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(productId)) {
    return { success: false, message: 'Parâmetros inválidos.' }
  }

  const admin = createAdminClient()

  const payload: any = {
    stock_quantity: Math.max(0, Number(newStock)),
    updated_at: new Date().toISOString(),
  }

  if (minStockThreshold !== undefined) {
    payload.min_stock_threshold = Math.max(0, Number(minStockThreshold))
  }

  const { error } = await admin
    .from('products')
    .update(payload)
    .eq('id', productId)
    .eq('tenant_id', tenantId)

  if (error) {
    return { success: false, message: 'Falha ao ajustar estoque do produto.' }
  }

  return { success: true, message: 'Estoque atualizado com sucesso!' }
}
