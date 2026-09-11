'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import type { Database, Json } from '@/types/database.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type SupplierRow = Database['public']['Tables']['tenant_suppliers']['Row']
export type PurchaseOrderRow = Database['public']['Tables']['purchase_orders']['Row']

export type PurchaseOrderItem = {
  productId: string
  productName: string
  sku?: string | null
  currentStock: number
  minThreshold: number
  suggestedQuantity: number
  unitCost: number
}

export type SupplierInput = {
  id?: string
  tenantId: string
  name: string
  contactName?: string
  phone?: string
  whatsapp: string
  email?: string
  catalogNotes?: string
  leadTimeDays?: number
  isActive?: boolean
}

export type OrderActionResult<T> =
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
 * Lista fornecedores e distribuidores da barbearia.
 */
export async function listSuppliers(
  tenantId: string,
): Promise<OrderActionResult<SupplierRow[]>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tenant_suppliers')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name', { ascending: true })

  if (error) {
    return { success: false, message: `Erro ao buscar fornecedores: ${error.message}` }
  }

  return { success: true, data: data ?? [] }
}

/**
 * Cria ou edita cadastro de fornecedor.
 */
export async function createOrUpdateSupplier(
  input: SupplierInput,
): Promise<OrderActionResult<SupplierRow>> {
  if (!UUID_PATTERN.test(input.tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  const isAuth = await requireOwnerOrAdmin(input.tenantId)
  if (!isAuth) {
    return { success: false, message: 'Apenas proprietários podem gerenciar fornecedores.' }
  }

  if (!input.name || input.name.trim().length < 2) {
    return { success: false, message: 'Nome da distribuidora é obrigatório.' }
  }

  const cleanWa = input.whatsapp.replace(/\D/g, '')
  if (cleanWa.length < 10) {
    return { success: false, message: 'WhatsApp do fornecedor inválido (informe DDD + Número).' }
  }

  const admin = createAdminClient()

  if (input.id) {
    const { data, error } = await admin
      .from('tenant_suppliers')
      .update({
        name: input.name.trim(),
        contact_name: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        whatsapp: cleanWa,
        email: input.email?.trim() || null,
        catalog_notes: input.catalogNotes?.trim() || null,
        lead_time_days: input.leadTimeDays ?? 3,
        is_active: input.isActive ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .eq('tenant_id', input.tenantId)
      .select('*')
      .single()

    if (error) return { success: false, message: error.message }
    return { success: true, data }
  } else {
    const { data, error } = await admin
      .from('tenant_suppliers')
      .insert({
        tenant_id: input.tenantId,
        name: input.name.trim(),
        contact_name: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        whatsapp: cleanWa,
        email: input.email?.trim() || null,
        catalog_notes: input.catalogNotes?.trim() || null,
        lead_time_days: input.leadTimeDays ?? 3,
        is_active: input.isActive ?? true,
      })
      .select('*')
      .single()

    if (error) return { success: false, message: error.message }
    return { success: true, data }
  }
}

/**
 * Exclui um fornecedor.
 */
export async function deleteSupplier(
  tenantId: string,
  supplierId: string,
): Promise<OrderActionResult<{ deleted: boolean }>> {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(supplierId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  const isAuth = await requireOwnerOrAdmin(tenantId)
  if (!isAuth) {
    return { success: false, message: 'Apenas proprietários podem excluir fornecedores.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('tenant_suppliers')
    .delete()
    .eq('id', supplierId)
    .eq('tenant_id', tenantId)

  if (error) return { success: false, message: error.message }
  return { success: true, data: { deleted: true } }
}

/**
 * Gera automaticamente uma minuta de ordem de compra varrendo produtos
 * onde `stock_quantity <= min_stock_threshold`.
 */
export async function generateAutomatedRestockOrder(
  tenantId: string,
  supplierId?: string,
): Promise<OrderActionResult<PurchaseOrderRow>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  const isAuth = await requireOwnerOrAdmin(tenantId)
  if (!isAuth) {
    return { success: false, message: 'Apenas proprietários podem gerar ordens de compra.' }
  }

  const admin = createAdminClient()

  // Buscar produtos abaixo do ponto de reposição
  const productsRes = await admin
    .from('products')
    .select('id, name, sku, stock_quantity, min_stock_threshold, price')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (productsRes.error) {
    return { success: false, message: `Erro ao verificar estoque: ${productsRes.error.message}` }
  }

  const lowStockProducts = (productsRes.data ?? []).filter(
    (p) => p.stock_quantity <= p.min_stock_threshold
  )

  if (lowStockProducts.length === 0) {
    return { success: false, message: 'Nenhum insumo ou produto atingiu o ponto crítico de reposição no momento.' }
  }

  const items: PurchaseOrderItem[] = lowStockProducts.map((p) => {
    // Sugestão de lote: triplo da margem mínima menos estoque atual
    const targetStock = Math.max(p.min_stock_threshold * 3, 5)
    const suggestedQty = Math.max(1, targetStock - p.stock_quantity)
    const estimatedUnitCost = p.price > 0 ? Math.round(p.price * 0.45 * 100) / 100 : 25.0

    return {
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      currentStock: p.stock_quantity,
      minThreshold: p.min_stock_threshold,
      suggestedQuantity: suggestedQty,
      unitCost: estimatedUnitCost,
    }
  })

  const totalEstimatedCost = items.reduce((sum, item) => sum + item.suggestedQuantity * item.unitCost, 0)
  const orderNumber = `PED-${Date.now().toString().slice(-6)}`

  // Salvar minuta da ordem de compra
  const { data, error } = await admin
    .from('purchase_orders')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId || null,
      order_number: orderNumber,
      status: 'draft',
      items: items as unknown as Json,
      total_estimated_cost: totalEstimatedCost,
      notes: `Ordem de reposição automática gerada para ${items.length} itens abaixo do estoque mínimo.`,
    })
    .select('*')
    .single()

  if (error) {
    return { success: false, message: `Erro ao criar ordem de compra: ${error.message}` }
  }

  return { success: true, data }
}

/**
 * Gera link de disparo rápido do pedido via WhatsApp (`wa.me`)
 * e marca o pedido como 'sent'.
 */
export async function generateWhatsAppOrderDispatch(
  orderId: string,
): Promise<OrderActionResult<{ whatsappUrl: string; message: string }>> {
  if (!UUID_PATTERN.test(orderId)) {
    return { success: false, message: 'ID de ordem de compra inválido.' }
  }

  const admin = createAdminClient()

  // Buscar ordem e fornecedor
  const orderRes = await admin
    .from('purchase_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderRes.error || !orderRes.data) {
    return { success: false, message: 'Ordem de compra não encontrada.' }
  }

  const order = orderRes.data

  const [tenantRes, supplierRes] = await Promise.all([
    admin.from('tenants').select('name').eq('id', order.tenant_id).single(),
    order.supplier_id
      ? admin.from('tenant_suppliers').select('*').eq('id', order.supplier_id).single()
      : { data: null, error: null },
  ])

  const tenantName = tenantRes.data?.name ?? 'Nossa Barbearia'
  const supplier = supplierRes.data
  const representativeName = supplier?.contact_name || supplier?.name || 'Prezado(a)'
  const rawItems = (order.items as unknown as PurchaseOrderItem[]) || []

  const formattedItems = rawItems
    .map((item) => `• ${item.suggestedQuantity}x ${item.productName}`)
    .join('\n')

  const messageText = `Olá ${representativeName}, aqui é da *${tenantName}*!

Precisamos de reposição para os seguintes itens (Ordem ${order.order_number}):
${formattedItems}

Por favor, confirmar o recebimento do pedido e a previsão de entrega.
Obrigado!`

  const targetPhone = supplier?.whatsapp ? supplier.whatsapp.replace(/\D/g, '') : ''
  const phoneParam = targetPhone.length >= 10 ? (targetPhone.startsWith('55') ? targetPhone : `55${targetPhone}`) : ''
  const whatsappUrl = phoneParam
    ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(messageText)}`
    : `https://wa.me/?text=${encodeURIComponent(messageText)}`

  // Atualizar status para 'sent' se estiver como draft
  if (order.status === 'draft') {
    await admin
      .from('purchase_orders')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
  }

  return { success: true, data: { whatsappUrl, message: messageText } }
}

/**
 * Confirma entrega do pedido de compra e incrementa o estoque físico dos produtos automaticamente.
 */
export async function markOrderAsReceived(
  orderId: string,
): Promise<OrderActionResult<{ updatedCount: number }>> {
  if (!UUID_PATTERN.test(orderId)) {
    return { success: false, message: 'ID de ordem inválido.' }
  }

  const admin = createAdminClient()

  const orderRes = await admin
    .from('purchase_orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderRes.error || !orderRes.data) {
    return { success: false, message: 'Ordem de compra não encontrada.' }
  }

  const order = orderRes.data
  if (order.status === 'received') {
    return { success: false, message: 'Este pedido já foi recebido anteriormente.' }
  }

  const items = (order.items as unknown as PurchaseOrderItem[]) || []

  // Incrementar estoque físico de cada item
  let updatedCount = 0
  for (const item of items) {
    if (!item.productId) continue
    const currentProduct = await admin
      .from('products')
      .select('stock_quantity')
      .eq('id', item.productId)
      .single()

    if (currentProduct.data) {
      const newQty = currentProduct.data.stock_quantity + item.suggestedQuantity
      await admin
        .from('products')
        .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', item.productId)
      updatedCount += 1
    }
  }

  // Marcar ordem como 'received'
  await admin
    .from('purchase_orders')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', orderId)

  return { success: true, data: { updatedCount } }
}

/**
 * Lista todas as ordens de compra da barbearia.
 */
export async function listPurchaseOrders(
  tenantId: string,
): Promise<OrderActionResult<PurchaseOrderRow[]>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('purchase_orders')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, message: `Erro ao listar ordens de compra: ${error.message}` }
  }

  return { success: true, data: data ?? [] }
}
