'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Target,
  ArrowDownRight,
  ArrowUpRight,
  Receipt,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Download,
  Calendar,
  Sparkles,
  Percent,
} from 'lucide-react'
import { getDREStatementAction, DREStatementResult } from '@/app/actions/expenses'

export default function DREStatementPage() {
  const [data, setData] = useState<DREStatementResult | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDRE = async () => {
    setLoading(true)
    const res = await getDREStatementAction()
    if (res.success && res.data) {
      setData(res.data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadDRE()
  }, [])

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-xs text-neutral-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    )
  }

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
                href="/dashboard/financeiro/despesas"
                className="text-xs text-amber-400 hover:underline flex items-center gap-1 font-semibold"
              >
                Gerenciar Custos & Despesas <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Demonstrativo de Resultado do Exercício (DRE)
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              {data.periodLabel} • Apuração da margem líquida real descontando comissões, produtos e custos fixos.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Imprimir DRE
            </button>
          </div>
        </div>

        {/* Top Highlight: Lucro Líquido Real & Ponto de Equilíbrio */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Lucro Líquido Real */}
          <div className={`p-6 rounded-3xl border shadow-xl ${
            data.isProfitable
              ? 'bg-gradient-to-br from-emerald-950/40 via-neutral-900 to-neutral-900 border-emerald-500/40'
              : 'bg-gradient-to-br from-rose-950/40 via-neutral-900 to-neutral-900 border-rose-500/40'
          }`}>
            <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider block">
              Lucro Líquido Real do Dono
            </span>
            <div className="mt-2 text-3xl font-black text-white flex items-baseline gap-2">
              <span className={data.isProfitable ? 'text-emerald-400' : 'text-rose-400'}>
                R$ {data.netProfit.toLocaleString('pt-BR')},00
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-md font-bold ${
                data.isProfitable ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                Margem Líquida: {data.netMarginPercent}%
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-2">
              Dinheiro limpo no bolso após todos os pagamentos
            </p>
          </div>

          {/* Ponto de Equilíbrio (Break-Even) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider block">
                Ponto de Equilíbrio (Break-Even)
              </span>
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-3xl font-black text-white flex items-baseline gap-2">
              <span>{data.breakEvenCuts} cortes</span>
            </div>
            <p className="text-xs text-neutral-300 mt-2">
              Você precisa de <strong>{data.breakEvenCuts} atendimentos</strong> no mês a um ticket médio de{' '}
              <strong>R$ {data.averageTicket.toFixed(2)}</strong> apenas para zerar os custos fixos.
            </p>
            <div className="mt-3 w-full bg-neutral-950 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${Math.min(100, Math.round((data.totalCuts / data.breakEvenCuts) * 100))}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-500 mt-1 block">
              Atendimentos realizados: {data.totalCuts} ({Math.round((data.totalCuts / data.breakEvenCuts) * 100)}% da meta de custo zero)
            </span>
          </div>

          {/* Ticket Médio & Despesas Operacionais */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-3">
            <div>
              <span className="text-xs uppercase font-bold text-neutral-400 tracking-wider block">
                Custos Operacionais Totais
              </span>
              <div className="text-2xl font-black text-white mt-1">
                R$ {data.totalOperationalExpenses.toLocaleString('pt-BR')},00
              </div>
              <span className="text-[11px] text-neutral-500">
                Fixas: R$ {data.fixedExpenses} • Variáveis: R$ {data.variableExpenses}
              </span>
            </div>

            <div className="pt-2 border-t border-neutral-800">
              <span className="text-[11px] text-neutral-400 block">Ticket Médio por Cliente:</span>
              <span className="text-lg font-bold text-purple-400">R$ {data.averageTicket.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Visual Waterfall Financial Statement (DRE em Cascata) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-400" />
                Estrutura de Demonstração em Cascata
              </h2>
              <p className="text-xs text-neutral-400">
                Detalhamento linha a linha da formação do lucro líquido da barbearia.
              </p>
            </div>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-xs font-bold">
              {data.periodLabel}
            </span>
          </div>

          {/* Waterfall items list */}
          <div className="space-y-3 text-xs">
            {/* 1. Faturamento Bruto */}
            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center justify-between">
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  (+) RECEITA BRUTA TOTAL
                </div>
                <p className="text-neutral-400 text-[11px] mt-0.5">
                  Serviços executados (R$ {data.servicesRevenue.toLocaleString('pt-BR')}) + Produtos vendidos (R$ {data.productsRevenue.toLocaleString('pt-BR')})
                </p>
              </div>
              <span className="font-black text-emerald-400 text-base">
                R$ {data.grossRevenue.toLocaleString('pt-BR')},00
              </span>
            </div>

            {/* 2. Dedução Comissões */}
            <div className="p-4 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 flex items-center justify-between pl-8">
              <div>
                <div className="font-semibold text-neutral-300 text-xs flex items-center gap-2">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  (-) Comissões Pagas à Equipe de Barbeiros
                </div>
                <p className="text-neutral-500 text-[11px]">Repasse percentual sobre serviços e vendas de balcão</p>
              </div>
              <span className="font-bold text-rose-400">
                - R$ {data.commissionExpense.toLocaleString('pt-BR')},00
              </span>
            </div>

            {/* 3. Dedução Insumos e Produtos */}
            <div className="p-4 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 flex items-center justify-between pl-8">
              <div>
                <div className="font-semibold text-neutral-300 text-xs flex items-center gap-2">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  (-) Custo de Aquisição de Produtos / Estoque (CMV)
                </div>
                <p className="text-neutral-500 text-[11px]">Reposição de pomadas, óleos e tônicos vendidos</p>
              </div>
              <span className="font-bold text-rose-400">
                - R$ {data.productCosts.toLocaleString('pt-BR')},00
              </span>
            </div>

            {/* 4. Custos Fixos Operacionais */}
            <div className="p-4 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 flex items-center justify-between pl-8">
              <div>
                <div className="font-semibold text-neutral-300 text-xs flex items-center gap-2">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  (-) Despesas Fixas da Barbearia
                </div>
                <p className="text-neutral-500 text-[11px]">
                  Aluguel, energia, internet fibra, assinatura da plataforma
                </p>
              </div>
              <span className="font-bold text-rose-400">
                - R$ {data.fixedExpenses.toLocaleString('pt-BR')},00
              </span>
            </div>

            {/* 5. Custos Variáveis */}
            <div className="p-4 bg-neutral-950/60 rounded-2xl border border-neutral-800/80 flex items-center justify-between pl-8">
              <div>
                <div className="font-semibold text-neutral-300 text-xs flex items-center gap-2">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />
                  (-) Insumos Descartáveis & Despesas Variáveis
                </div>
                <p className="text-neutral-500 text-[11px]">
                  Lâminas descartáveis, golas higiênicas, café expresso, limpeza
                </p>
              </div>
              <span className="font-bold text-rose-400">
                - R$ {data.variableExpenses.toLocaleString('pt-BR')},00
              </span>
            </div>

            {/* 6. Resultado Final */}
            <div className="p-5 bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 rounded-2xl border-2 border-emerald-500/40 flex items-center justify-between mt-2">
              <div>
                <div className="font-black text-white text-base flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  (=) LUCRO LÍQUIDO OPERACIONAL REAL
                </div>
                <span className="text-xs text-emerald-400 font-semibold">
                  Margem de Rentabilidade: {data.netMarginPercent}% sobre a receita
                </span>
              </div>
              <span className="font-black text-2xl text-emerald-400">
                R$ {data.netProfit.toLocaleString('pt-BR')},00
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Expense Lists */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Fixed Expense List */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              Detalhamento de Custos Fixos (R$ {data.fixedExpenses})
            </h3>
            <div className="space-y-2 text-xs">
              {data.fixedExpenseList.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-300">{item.description}</span>
                  <span className="font-bold text-white">R$ {item.amount},00</span>
                </div>
              ))}
            </div>
          </div>

          {/* Variable Expense List */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 space-y-3">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Detalhamento de Insumos e Variáveis (R$ {data.variableExpenses})
            </h3>
            <div className="space-y-2 text-xs">
              {data.variableExpenseList.map((item, idx) => (
                <div key={idx} className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                  <span className="text-neutral-300">{item.description}</span>
                  <span className="font-bold text-amber-400">R$ {item.amount},00</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
