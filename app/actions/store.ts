'use server'

import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

export type CounterPaymentMethod = Extract<
  Database['public']['Enums']['payment_method'],
  'cash' | 'card_machine' | 'pix_tenant'
>

export type CounterSaleItemInput = {
  productId: string
  quantity: number
}

export type CounterSaleResult = {
  saleId: string
  totalAmount: number
  commissionAmount: number
  cashReceivedByBarber: number
  paymentMethod: CounterPaymentMethod
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getActor() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || !profile.is_active) return null
  return profile
}

/**
 * Registra venda direta no balcão de produtos físicos.
 * Dá baixa instantânea de estoque com verificação de quantidade disponível.
 * Se a comissão de produtos estiver habilitada, credita a comissão do barbeiro vendedor.
 */
export async function registerCounterSale(
  tenantId: string,
  barberId: string,
  items: CounterSaleItemInput[],
  paymentMethod: CounterPaymentMethod,
): Promise<ActionResult<CounterSaleResult>> {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(barberId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  const validMethods: CounterPaymentMethod[] = ['cash', 'card_machine', 'pix_tenant']
  if (!validMethods.includes(paymentMethod)) {
    return { success: false, message: 'Forma de pagamento de balcão inválida.' }
  }

  if (!Array.isArray(items) || items.length === 0) {
    return { success: false, message: 'A venda deve conter ao menos um produto.' }
  }

  const seenProducts = new Set<string>()
  for (const item of items) {
    if (!UUID_PATTERN.test(item.productId)) {
      return { success: false, message: `ID de produto inválido: ${item.productId}` }
    }
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return { success: false, message: 'A quantidade de cada produto deve ser um número inteiro positivo.' }
    }
    if (seenProducts.has(item.productId)) {
      return { success: false, message: 'Produtos duplicados na mesma venda não são permitidos.' }
    }
    seenProducts.add(item.productId)
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  if (actor.role !== 'super_admin' && actor.tenant_id !== tenantId) {
    return { success: false, message: 'Operação não autorizada nesta barbearia.' }
  }

  if (
    actor.role === 'barber' &&
    actor.id !== barberId
  ) {
    return { success: false, message: 'Você só pode registrar vendas de balcão em seu próprio nome.' }
  }

  if (!['owner', 'receptionist', 'barber', 'super_admin'].includes(actor.role)) {
    return { success: false, message: 'Perfil não autorizado para vendas de balcão.' }
  }

  const admin = createAdminClient()

  // Serializa itens para a RPC atômica do PostgreSQL
  const payloadItems: Json = items.map((i) => ({
    product_id: i.productId,
    quantity: i.quantity,
  }))

  const { data, error } = await admin.rpc('register_counter_sale_internal', {
    requested_tenant_id: tenantId,
    requested_barber_id: barberId,
    requested_created_by: actor.id,
    requested_items: payloadItems,
    requested_payment_method: paymentMethod,
  })

  if (error) {
    let errorMsg = 'Falha ao registrar venda no balcão.'
    if (error.message.includes('insufficient stock')) {
      errorMsg = error.message.replace(/^.*?insufficient stock for product:\s*/i, 'Estoque insuficiente para o produto: ')
    } else if (error.message.includes('product unavailable')) {
      errorMsg = 'Um ou mais produtos selecionados estão indisponíveis.'
    } else if (error.message.includes('invalid barber')) {
      errorMsg = 'Barbeiro vendedor inválido ou inativo.'
    }

    return { success: false, message: errorMsg }
  }

  const result = data as {
    sale_id: string
    total_amount: number
    commission_amount: number
    cash_received_by_barber: number
  }

  return {
    success: true,
    data: {
      saleId: result.sale_id,
      totalAmount: Number(result.total_amount),
      commissionAmount: Number(result.commission_amount),
      cashReceivedByBarber: Number(result.cash_received_by_barber),
      paymentMethod,
    },
  }
}

/**
 * Consulta a lista de produtos ativos e quantidades em estoque para o PDV.
 */
export async function getProducts(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false as const, message: 'Barbearia inválida.' }
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false as const, message: 'Autenticação necessária.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('id, name, sku, description, price, stock_quantity, commission_percent, commission_fixed, is_active')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return { success: false as const, message: 'Falha ao carregar produtos.' }
  }

  return { success: true as const, data }
}

/**
 * Ajuste manual de estoque de um produto (exclusivo para proprietários/gerentes).
 */
export async function updateProductStock(
  tenantId: string,
  productId: string,
  newStock: number,
): Promise<ActionResult<{ productId: string; newStock: number }>> {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(productId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  if (!Number.isInteger(newStock) || newStock < 0) {
    return { success: false, message: 'A quantidade em estoque deve ser um número inteiro não-negativo.' }
  }

  const actor = await getActor()
  if (!actor || (actor.role !== 'owner' && actor.role !== 'super_admin')) {
    return { success: false, message: 'Apenas proprietários podem ajustar estoques.' }
  }

  if (actor.role === 'owner' && actor.tenant_id !== tenantId) {
    return { success: false, message: 'Operação não autorizada nesta barbearia.' }
  }

  const admin = createAdminClient()
  const updateResult = await admin
    .from('products')
    .update({
      stock_quantity: newStock,
      updated_at: new Date().toISOString(),
    })
    .eq('id', productId)
    .eq('tenant_id', tenantId)
    .select('id, stock_quantity')
    .single()

  if (updateResult.error || !updateResult.data) {
    return { success: false, message: 'Não foi possível atualizar o estoque do produto.' }
  }

  return {
    success: true,
    data: {
      productId: updateResult.data.id,
      newStock: updateResult.data.stock_quantity,
    },
  }
}

/**
 * Histórico de vendas de balcão para conciliação e conferência.
 */
export async function getCounterSalesHistory(
  tenantId: string,
  barberId?: string,
) {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false as const, message: 'Barbearia inválida.' }
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false as const, message: 'Autenticação necessária.' }
  }

  const admin = createAdminClient()
  let query = admin
    .from('counter_sales')
    .select(`
      id,
      barber_id,
      payment_method,
      total_amount,
      cash_received_by_barber,
      sold_at,
      profiles!counter_sales_barber_id_fkey(full_name),
      product_sales(id, product_id, quantity, unit_price, total_amount, products(name))
    `)
    .eq('tenant_id', tenantId)
    .order('sold_at', { ascending: false })
    .limit(50)

  if (barberId) {
    if (!UUID_PATTERN.test(barberId)) {
      return { success: false as const, message: 'Barbeiro inválido.' }
    }
    query = query.eq('barber_id', barberId)
  }

  const { data, error } = await query

  if (error) {
    return { success: false as const, message: 'Erro ao carregar histórico de vendas.' }
  }

  return { success: true as const, data }
}
