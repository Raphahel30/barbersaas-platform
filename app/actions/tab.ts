'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Database } from '@/types/database.types'

export type CustomerTabRow = Database['public']['Tables']['customer_tabs']['Row']
export type CustomerTabItemRow = Database['public']['Tables']['customer_tab_items']['Row']

export type TabWithItems = CustomerTabRow & {
  items: CustomerTabItemRow[]
}

export type TabActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; error?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const profile = await supabase
    .from('profiles')
    .select('id, tenant_id, role, full_name')
    .eq('id', userId)
    .maybeSingle()

  return profile.data
}

/**
 * Obtém ou abre uma comanda de bar/conveniência vinculada a um agendamento na cadeira.
 */
export async function getOrCreateAppointmentTabAction(
  tenantId: string,
  appointmentId: string,
  barberId?: string
): Promise<TabActionResult<TabWithItems>> {
  try {
    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(appointmentId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Não autorizado a gerenciar comandas.' }
    }

    const supabase = createAdminClient()

    // 1. Verifica se já existe comanda aberta para este agendamento
    const { data: existingTab } = await supabase
      .from('customer_tabs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appointment_id', appointmentId)
      .eq('status', 'open')
      .maybeSingle()

    if (existingTab) {
      const { data: items } = await supabase
        .from('customer_tab_items')
        .select('*')
        .eq('tab_id', existingTab.id)
        .order('added_at', { ascending: true })

      return {
        success: true,
        data: {
          ...existingTab,
          items: items || [],
        },
      }
    }

    // 2. Busca informações do agendamento para preencher dados do cliente
    const { data: appointment } = await supabase
      .from('appointments')
      .select('client_id, guest_name, guest_phone, barber_id')
      .eq('id', appointmentId)
      .single()

    let clientName = appointment?.guest_name || 'Cliente na Cadeira'
    if (appointment?.client_id) {
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', appointment.client_id)
        .single()
      if (clientProfile?.full_name) clientName = clientProfile.full_name
    }

    // 3. Cria a nova comanda aberta
    const { data: newTab, error: createError } = await supabase
      .from('customer_tabs')
      .insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        client_id: appointment?.client_id || null,
        client_name: clientName,
        guest_phone: appointment?.guest_phone || null,
        opened_by: user.id,
        status: 'open',
        total_amount: 0.0,
      })
      .select()
      .single()

    if (createError || !newTab) {
      return { success: false, message: 'Falha ao abrir comanda.', error: createError?.message }
    }

    return {
      success: true,
      data: {
        ...newTab,
        items: [],
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao buscar comanda.', error: err?.message }
  }
}

/**
 * Cria uma comanda avulsa no bar (cliente aguardando amigo ou apenas consumindo no lounge).
 */
export async function createStandaloneTabAction(
  tenantId: string,
  clientName: string,
  phone?: string,
  notes?: string
): Promise<TabActionResult<CustomerTabRow>> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    if (!clientName || !clientName.trim()) {
      return { success: false, message: 'O nome do cliente é obrigatório para abrir comanda.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Não autorizado a abrir comandas.' }
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('customer_tabs')
      .insert({
        tenant_id: tenantId,
        client_name: clientName.trim(),
        guest_phone: phone ? phone.replace(/\D/g, '') : null,
        status: 'open',
        opened_by: user.id,
        notes: notes?.trim() || null,
        total_amount: 0.0,
      })
      .select()
      .single()

    if (error || !data) {
      return { success: false, message: 'Falha ao criar comanda avulsa.', error: error?.message }
    }

    return { success: true, data }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao criar comanda.', error: err?.message }
  }
}

/**
 * Lança um item (bebida, café, charuto, snack) na comanda do cliente.
 */
export async function addItemToTabAction(
  tabId: string,
  productId: string,
  quantity: number = 1,
  barberId?: string
): Promise<TabActionResult<TabWithItems>> {
  try {
    if (!UUID_PATTERN.test(tabId) || !UUID_PATTERN.test(productId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    if (quantity <= 0) {
      return { success: false, message: 'A quantidade deve ser maior que zero.' }
    }

    const supabase = createAdminClient()

    // 1. Busca a comanda
    const { data: tab } = await supabase
      .from('customer_tabs')
      .select('*')
      .eq('id', tabId)
      .single()

    if (!tab || tab.status !== 'open') {
      return { success: false, message: 'A comanda não existe ou já está encerrada.' }
    }

    // 2. Busca o produto
    const { data: product } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity')
      .eq('id', productId)
      .eq('tenant_id', tab.tenant_id)
      .single()

    if (!product) {
      return { success: false, message: 'Produto não localizado no estoque.' }
    }

    const unitPrice = Number(product.price)
    const totalPrice = Number((unitPrice * quantity).toFixed(2))

    // 3. Insere o item na comanda
    const { error: itemError } = await supabase.from('customer_tab_items').insert({
      tab_id: tabId,
      product_id: product.id,
      product_name: product.name,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      barber_id: barberId || null,
    })

    if (itemError) {
      return { success: false, message: 'Falha ao lançar item na comanda.', error: itemError.message }
    }

    // 4. Baixa estoque do produto se aplicável
    if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
      await supabase
        .from('products')
        .update({
          stock_quantity: Math.max(0, product.stock_quantity - quantity),
        })
        .eq('id', product.id)
    }

    // 5. Recalcula o valor total da comanda
    const { data: allItems } = await supabase
      .from('customer_tab_items')
      .select('*')
      .eq('tab_id', tabId)
      .order('added_at', { ascending: true })

    const newTotal = Number(
      (allItems || []).reduce((acc, curr) => acc + Number(curr.total_price), 0).toFixed(2)
    )

    const { data: updatedTab, error: updateError } = await supabase
      .from('customer_tabs')
      .update({ total_amount: newTotal })
      .eq('id', tabId)
      .select()
      .single()

    if (updateError || !updatedTab) {
      return { success: false, message: 'Erro ao atualizar total da comanda.', error: updateError?.message }
    }

    return {
      success: true,
      data: {
        ...updatedTab,
        items: allItems || [],
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao adicionar item.', error: err?.message }
  }
}

/**
 * Remove um item lançado na comanda e estorna o estoque.
 */
export async function removeItemFromTabAction(
  tabItemId: string
): Promise<TabActionResult<{ tabId: string; newTotal: number }>> {
  try {
    if (!UUID_PATTERN.test(tabItemId)) {
      return { success: false, message: 'ID do item inválido.' }
    }

    const supabase = createAdminClient()

    // 1. Busca o item
    const { data: item } = await supabase
      .from('customer_tab_items')
      .select('id, tab_id, product_id, quantity')
      .eq('id', tabItemId)
      .single()

    if (!item) {
      return { success: false, message: 'Item não encontrado.' }
    }

    const tabId = item.tab_id

    // 2. Estorna estoque do produto
    if (item.product_id) {
      const { data: prod } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', item.product_id)
        .single()

      if (prod) {
        await supabase
          .from('products')
          .update({ stock_quantity: (prod.stock_quantity || 0) + item.quantity })
          .eq('id', item.product_id)
      }
    }

    // 3. Exclui o item
    await supabase.from('customer_tab_items').delete().eq('id', tabItemId)

    // 4. Recalcula o total
    const { data: remainingItems } = await supabase
      .from('customer_tab_items')
      .select('total_price')
      .eq('tab_id', tabId)

    const newTotal = Number(
      (remainingItems || []).reduce((acc, curr) => acc + Number(curr.total_price), 0).toFixed(2)
    )

    await supabase.from('customer_tabs').update({ total_amount: newTotal }).eq('id', tabId)

    return {
      success: true,
      data: {
        tabId,
        newTotal,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao remover item da comanda.', error: err?.message }
  }
}

/**
 * Encerra e quita uma comanda de bar/conveniência.
 */
export async function closeTabAction(
  tabId: string,
  paymentMethod: string = 'cash'
): Promise<TabActionResult<CustomerTabRow>> {
  try {
    if (!UUID_PATTERN.test(tabId)) {
      return { success: false, message: 'ID da comanda inválido.' }
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('customer_tabs')
      .update({
        status: 'closed',
        payment_method: paymentMethod,
        closed_at: new Date().toISOString(),
      })
      .eq('id', tabId)
      .select()
      .single()

    if (error || !data) {
      return { success: false, message: 'Falha ao encerrar comanda.', error: error?.message }
    }

    return { success: true, data }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao fechar comanda.', error: err?.message }
  }
}

/**
 * Lista todas as comandas ativas (abertas) do tenant.
 */
export async function listActiveTabsAction(
  tenantId: string
): Promise<TabActionResult<Array<CustomerTabRow & { itemCount: number }>>> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    const supabase = createAdminClient()

    const { data: tabs, error } = await supabase
      .from('customer_tabs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, message: 'Erro ao listar comandas abertas.', error: error.message }
    }

    const tabsWithCounts = await Promise.all(
      (tabs || []).map(async (tab) => {
        const { count } = await supabase
          .from('customer_tab_items')
          .select('id', { count: 'exact', head: true })
          .eq('tab_id', tab.id)

        return {
          ...tab,
          itemCount: count || 0,
        }
      })
    )

    return { success: true, data: tabsWithCounts }
  } catch (err: any) {
    return { success: false, message: 'Erro ao consultar comandas ativas.', error: err?.message }
  }
}

/**
 * Busca detalhes completos de uma comanda pelo ID.
 */
export async function getTabDetailsAction(
  tabId: string
): Promise<TabActionResult<TabWithItems>> {
  try {
    if (!UUID_PATTERN.test(tabId)) {
      return { success: false, message: 'ID de comanda inválido.' }
    }

    const supabase = createAdminClient()

    const [tabRes, itemsRes] = await Promise.all([
      supabase.from('customer_tabs').select('*').eq('id', tabId).single(),
      supabase.from('customer_tab_items').select('*').eq('tab_id', tabId).order('added_at', { ascending: true }),
    ])

    if (!tabRes.data) {
      return { success: false, message: 'Comanda não encontrada.' }
    }

    return {
      success: true,
      data: {
        ...tabRes.data,
        items: itemsRes.data || [],
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao buscar detalhes da comanda.', error: err?.message }
  }
}
