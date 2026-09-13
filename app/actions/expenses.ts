'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireTenantOwner, requireTenantStaff } from '@/lib/auth/guards'

export interface ExpenseItem {
  id: string
  tenantId: string
  category: 'fixed' | 'variable'
  description: string
  amount: number
  dueDate: string
  paidAt: string | null
  isRecurring: boolean
}

export interface CreateExpenseInput {
  category: 'fixed' | 'variable'
  description: string
  amount: number
  dueDate: string
  isRecurring?: boolean
  paidAt?: string | null
}

export interface DREStatementResult {
  periodLabel: string
  grossRevenue: number
  servicesRevenue: number
  productsRevenue: number
  commissionExpense: number
  productCosts: number
  fixedExpenses: number
  variableExpenses: number
  totalOperationalExpenses: number
  netProfit: number
  netMarginPercent: number
  totalCuts: number
  averageTicket: number
  breakEvenCuts: number
  isProfitable: boolean
  fixedExpenseList: Array<{ description: string; amount: number }>
  variableExpenseList: Array<{ description: string; amount: number }>
}

export async function listExpensesAction(
  explicitTenantId?: string,
): Promise<{ success: boolean; data: ExpenseItem[] }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let tenantId = explicitTenantId
    if (!tenantId && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      tenantId = profile?.tenant_id || undefined
    }

    if (!tenantId) return { success: true, data: [] }

    await requireTenantStaff(tenantId)

    const admin = createAdminClient()

    const { data: expenses, error } = await admin
      .from('tenant_expenses')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('due_date', { ascending: false })

    if (error || !expenses) {
      return {
        success: true,
        data: [],
      }
    }

    return {
      success: true,
      data: expenses.map((e) => ({
        id: e.id,
        tenantId: e.tenant_id,
        category: e.category,
        description: e.description,
        amount: e.amount,
        dueDate: e.due_date,
        paidAt: e.paid_at,
        isRecurring: e.is_recurring,
      })),
    }
  } catch (err) {
    return { success: false, data: [] }
  }
}

export async function createExpenseAction(
  tenantId: string,
  input: CreateExpenseInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireTenantOwner(tenantId)
    const admin = createAdminClient()

    const { error } = await admin.from('tenant_expenses').insert({
      tenant_id: tenantId,
      category: input.category,
      description: input.description,
      amount: input.amount,
      due_date: input.dueDate,
      paid_at: input.paidAt || null,
      is_recurring: Boolean(input.isRecurring),
    })

    if (error) throw error
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao lançar despesa.',
    }
  }
}

export async function deleteExpenseAction(
  tenantId: string,
  expenseId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireTenantOwner(tenantId)
    const admin = createAdminClient()

    const { error } = await admin
      .from('tenant_expenses')
      .delete()
      .eq('id', expenseId)
      .eq('tenant_id', tenantId)

    if (error) throw error
    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao excluir despesa.',
    }
  }
}

/**
 * Apura o Demonstrativo de Resultados do Exercício (DRE) Operacional e Ponto de Equilíbrio (Break-Even).
 */
export async function getDREStatementAction(
  explicitTenantId?: string,
): Promise<{ success: boolean; data?: DREStatementResult; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let tenantId = explicitTenantId
    if (!tenantId && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()
      tenantId = profile?.tenant_id || undefined
    }

    if (!tenantId) {
      return { success: false, error: 'Tenant não encontrado.' }
    }

    await requireTenantOwner(tenantId)

    const admin = createAdminClient()

    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

    // 1. Receita de atendimentos
    const { data: appointments } = await admin
      .from('appointments')
      .select('total_amount, status')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('starts_at', startOfMonth)

    // 2. Receita de produtos
    const { data: productSales } = await admin
      .from('product_sales')
      .select('total_amount')
      .eq('tenant_id', tenantId)
      .gte('sold_at', startOfMonth)

    // 3. Comissões repassadas
    const { data: commissions } = await admin
      .from('commissions')
      .select('commission_amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', startOfMonth)

    // 4. Despesas cadastradas
    const { data: expenses } = await admin
      .from('tenant_expenses')
      .select('category, description, amount')
      .eq('tenant_id', tenantId)

    const servicesRevenue = appointments?.reduce((acc, a) => acc + Number(a.total_amount || 0), 0) || 0
    const productsRevenue = productSales?.reduce((acc, p) => acc + Number(p.total_amount || 0), 0) || 0
    const grossRevenue = servicesRevenue + productsRevenue

    const commissionExpense = commissions?.reduce((acc, c) => acc + Number(c.commission_amount || 0), 0) || 0
    const productCosts = Math.round(productsRevenue * 0.45) // Custo médio estimado de aquisição dos produtos (45%)

    const fixedExpenseList = expenses?.filter((e) => e.category === 'fixed').map((e) => ({ description: e.description, amount: e.amount })) || []
    const variableExpenseList = expenses?.filter((e) => e.category === 'variable').map((e) => ({ description: e.description, amount: e.amount })) || []

    const fixedExpenses = fixedExpenseList.reduce((acc, curr) => acc + curr.amount, 0)
    const variableExpenses = variableExpenseList.reduce((acc, curr) => acc + curr.amount, 0)
    const totalOperationalExpenses = fixedExpenses + variableExpenses

    // Lucro Líquido Real = Bruto - Comissões - Custos Insumos - Despesas
    const netProfit = grossRevenue - commissionExpense - productCosts - totalOperationalExpenses
    const netMarginPercent = grossRevenue > 0 ? Number(((netProfit / grossRevenue) * 100).toFixed(1)) : 0

    const totalCuts = appointments?.length || 0
    const averageTicket = totalCuts > 0 ? Number((servicesRevenue / totalCuts).toFixed(2)) : 0

    // Ponto de Equilíbrio (Break-Even):
    // Margem de Contribuição por corte = Ticket Médio - (Comissão Média + Insumos Variáveis Médios por corte)
    const variableCostPerCut = totalCuts > 0 ? (commissionExpense + variableExpenses) / totalCuts : 0
    const contributionMarginPerCut = averageTicket > variableCostPerCut ? averageTicket - variableCostPerCut : 0
    const breakEvenCuts = contributionMarginPerCut > 0 ? Math.ceil(fixedExpenses / contributionMarginPerCut) : 0

    return {
      success: true,
      data: {
        periodLabel: 'Mês Vigente',
        grossRevenue,
        servicesRevenue,
        productsRevenue,
        commissionExpense,
        productCosts,
        fixedExpenses,
        variableExpenses,
        totalOperationalExpenses,
        netProfit,
        netMarginPercent,
        totalCuts,
        averageTicket,
        breakEvenCuts,
        isProfitable: netProfit > 0,
        fixedExpenseList,
        variableExpenseList,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao apurar DRE.',
    }
  }
}
