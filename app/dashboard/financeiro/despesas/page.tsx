'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  DollarSign,
  Plus,
  Trash2,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  Receipt,
  ArrowLeft,
  ArrowRight,
  TrendingDown,
  Repeat,
  Sparkles,
} from 'lucide-react'
import { listExpensesAction, createExpenseAction, deleteExpenseAction, ExpenseItem } from '@/app/actions/expenses'

export default function ExpensesManagementPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [filterCategory, setFilterCategory] = useState<'all' | 'fixed' | 'variable'>('all')

  // Form states
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<'fixed' | 'variable'>('fixed')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10))
  const [isRecurring, setIsRecurring] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  const loadExpenses = async () => {
    setLoading(true)
    const res = await listExpensesAction()
    if (res.success) {
      setExpenses(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadExpenses()
  }, [])

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !amount || Number(amount) <= 0) {
      setFormError('Preencha a descrição e um valor válido.')
      return
    }

    startTransition(async () => {
      const res = await createExpenseAction('00000000-0000-0000-0000-000000000001', {
        description,
        category,
        amount: Number(amount),
        dueDate,
        isRecurring,
      })

      if (res.success) {
        setShowModal(false)
        setDescription('')
        setAmount('')
        loadExpenses()
      } else {
        setFormError(res.error || 'Erro ao lançar despesa.')
      }
    })
  }

  const handleDelete = (id: string) => {
    if (!confirm('Deseja realmente excluir este custo?')) return
    startTransition(async () => {
      await deleteExpenseAction('00000000-0000-0000-0000-000000000001', id)
      setExpenses((prev) => prev.filter((e) => e.id !== id))
    })
  }

  const filteredExpenses = expenses.filter((e) => {
    if (filterCategory === 'all') return true
    return e.category === filterCategory
  })

  const totalFixed = expenses.filter((e) => e.category === 'fixed').reduce((acc, e) => acc + e.amount, 0)
  const totalVariable = expenses.filter((e) => e.category === 'variable').reduce((acc, e) => acc + e.amount, 0)
  const totalOverall = totalFixed + totalVariable

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link
                href="/dashboard/financeiro"
                className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Financeiro
              </Link>
              <span className="text-neutral-600">•</span>
              <Link
                href="/dashboard/financeiro/dre"
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Ver DRE & Lucro Real <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Controle de Custos e Despesas Operacionais
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Registre custos fixos (aluguel, luz, SaaS) e variáveis (lâminas, café) para alimentar o DRE.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Lançar Nova Despesa
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium block">Total Custos Fixos</span>
            <div className="mt-2 text-2xl font-black text-white">
              R$ {totalFixed.toLocaleString('pt-BR')},00
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Aluguel, energia, internet, SaaS</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium block">Total Custos Variáveis</span>
            <div className="mt-2 text-2xl font-black text-amber-400">
              R$ {totalVariable.toLocaleString('pt-BR')},00
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Insumos descartáveis, café, bebidas</p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <span className="text-xs text-neutral-400 font-medium block">Total Geral de Despesas</span>
            <div className="mt-2 text-2xl font-black text-rose-400">
              R$ {totalOverall.toLocaleString('pt-BR')},00
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Impacto direto no fechamento do mês</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center bg-neutral-900 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterCategory === 'all' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todas ({expenses.length})
            </button>
            <button
              onClick={() => setFilterCategory('fixed')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterCategory === 'fixed' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Custos Fixos
            </button>
            <button
              onClick={() => setFilterCategory('variable')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterCategory === 'variable' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Custos Variáveis
            </button>
          </div>
        </div>

        {/* Table of expenses */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider bg-neutral-950/40">
                <th className="py-3 px-4">Descrição</th>
                <th className="py-3 px-4">Categoria</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Recorrência</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {filteredExpenses.map((e) => (
                <tr key={e.id} className="hover:bg-neutral-950/40 transition">
                  <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                    <Receipt className="w-3.5 h-3.5 text-neutral-500" />
                    {e.description}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        e.category === 'fixed'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {e.category === 'fixed' ? 'Custo Fixo' : 'Custo Variável'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-neutral-300 font-mono text-[11px]">
                    {e.dueDate}
                  </td>
                  <td className="py-3.5 px-4 text-neutral-400">
                    {e.isRecurring ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-[11px]">
                        <Repeat className="w-3 h-3" /> Todo mês
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-500">Única</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 font-black text-white">
                    R$ {e.amount.toLocaleString('pt-BR')},00
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleDelete(e.id)}
                      className="p-1.5 text-neutral-500 hover:text-rose-400 rounded-lg transition"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Lançar Nova Despesa */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <h3 className="font-bold text-white text-base">Lançar Custo / Despesa</h3>
                <button onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-white">
                  ✕
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-neutral-400 font-bold mb-1">Descrição do Custo</label>
                  <input
                    type="text"
                    placeholder="Ex: Aluguel da Loja, Café dos Clientes"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-neutral-400 font-bold mb-1">Categoria</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as 'fixed' | 'variable')}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="fixed">Custo Fixo (Aluguel, Luz)</option>
                      <option value="variable">Custo Variável (Lâminas, Café)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-400 font-bold mb-1">Valor (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0,00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-neutral-400 font-bold mb-1">Data de Vencimento</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="recurring"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                    className="rounded border-neutral-700 text-amber-500 focus:ring-0"
                  />
                  <label htmlFor="recurring" className="text-neutral-300 cursor-pointer">
                    Despesa recorrente mensal
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded-xl shadow-md"
                  >
                    {isPending ? 'Salvando...' : 'Salvar Despesa'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
