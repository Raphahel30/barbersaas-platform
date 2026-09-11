'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getFinancialOverview,
  createCashClosing,
  closeCashForAllBarbers,
  type FinancialOverviewData,
  type BarberFinancialSummary,
} from '@/app/actions/financial'

type PeriodType = 'daily' | 'weekly' | 'monthly'

export default function DashboardFinanceiroPage() {
  const [tenantId, setTenantId] = useState('')
  const [period, setPeriod] = useState<PeriodType>('daily')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [closingInProgress, setClosingInProgress] = useState(false)
  const [overview, setOverview] = useState<FinancialOverviewData | null>(null)
  const [activePixModal, setActivePixModal] = useState<BarberFinancialSummary | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  // Ajusta datas ao mudar o tipo de período
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod)
    const now = new Date()

    if (newPeriod === 'daily') {
      const today = now.toISOString().slice(0, 10)
      setStartDate(today)
      setEndDate(today)
    } else if (newPeriod === 'weekly') {
      // Início da semana (Segunda-feira)
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(now.setDate(diff))
      const sunday = new Date(monday)
      sunday.setDate(monday.getDate() + 6)
      setStartDate(monday.toISOString().slice(0, 10))
      setEndDate(sunday.toISOString().slice(0, 10))
    } else if (newPeriod === 'monthly') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      setStartDate(firstDay.toISOString().slice(0, 10))
      setEndDate(lastDay.toISOString().slice(0, 10))
    }
  }

  // Carrega tenant
  useEffect(() => {
    async function loadTenant() {
      try {
        const res = await fetch('/api/tenant/me')
        const data = await res.json()
        const id = data?.tenantId || data?.id
        if (id) {
          setTenantId(id)
        }
      } catch (err) {
        console.error('Erro ao identificar tenant:', err)
      }
    }
    loadTenant()
  }, [])

  // Carrega dados financeiros
  const loadFinancialData = async () => {
    if (!tenantId) return
    setLoading(true)
    try {
      const res = await getFinancialOverview(tenantId, period, startDate, endDate)
      if (res.success && res.data) {
        setOverview(res.data)
      } else {
        console.warn(res.message)
      }
    } catch (err) {
      console.error('Erro ao carregar visão financeira:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tenantId) {
      loadFinancialData()
    }
  }, [tenantId, period, startDate, endDate])

  // Fechamento de um barbeiro individual
  const handleCloseBarber = async (barber: BarberFinancialSummary) => {
    if (!confirm(`Deseja fechar o caixa de ${barber.fullName} para o período de ${startDate} até ${endDate}?`)) {
      return
    }

    setClosingInProgress(true)
    try {
      const res = await createCashClosing(tenantId, barber.barberId, period, startDate, endDate)
      if (res.success) {
        alert(`Caixa de ${barber.fullName} fechado com sucesso!`)
        await loadFinancialData()
        setActivePixModal(barber)
      } else {
        alert(res.message)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao processar fechamento.')
    } finally {
      setClosingInProgress(false)
    }
  }

  // Fechamento global de toda a equipe
  const handleCloseAll = async () => {
    if (!confirm(`Deseja fechar o caixa de TODA a equipe para o período de ${startDate} a ${endDate}?`)) {
      return
    }

    setClosingInProgress(true)
    try {
      const res = await closeCashForAllBarbers(tenantId, period, startDate, endDate)
      if (res.success) {
        alert('Fechamento de caixa concluído com sucesso para toda a equipe!')
        await loadFinancialData()
      } else {
        alert('Ocorreram erros no fechamento: ' + (res.errors?.join('\n') || 'Falha ao processar.'))
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao processar fechamento geral.')
    } finally {
      setClosingInProgress(false)
    }
  }

  const copyPixKey = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 3000)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header com Navegação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Financeiro & Comissões
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
              Fechamento de Caixa & Repasse Pix
            </h1>
            <p className="text-xs text-zinc-400">
              Cálculo automatizado de comissões, dedução de dinheiro retido em mãos e comprovantes de repasse.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/agenda"
              className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs sm:text-sm font-semibold hover:bg-zinc-800 transition-colors"
            >
              ← Voltar à Agenda
            </Link>
            <button
              onClick={handleCloseAll}
              disabled={closingInProgress || loading || !overview || overview.barbers.length === 0}
              className="gold-button text-xs sm:text-sm px-4 py-2.5 shadow-lg shadow-amber-500/15 disabled:opacity-50"
            >
              {closingInProgress ? 'Fechando...' : '⚡ Fechar Caixa da Equipe'}
            </button>
          </div>
        </div>

        {/* Barra de Filtros de Período */}
        <div className="glass-card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Seletor de Período (Diário / Semanal / Mensal) */}
          <div className="flex items-center p-1 bg-zinc-900 rounded-xl border border-zinc-800 w-full md:w-auto">
            <button
              onClick={() => handlePeriodChange('daily')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                period === 'daily' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Hoje (Diário)
            </button>
            <button
              onClick={() => handlePeriodChange('weekly')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                period === 'weekly' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Semanal
            </button>
            <button
              onClick={() => handlePeriodChange('monthly')}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                period === 'monthly' ? 'bg-amber-500 text-black shadow' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Mensal
            </button>
          </div>

          {/* Seletores de Data */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400 font-semibold">De:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field text-xs py-1.5 w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400 font-semibold">Até:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input-field text-xs py-1.5 w-auto"
              />
            </div>
          </div>
        </div>

        {/* CARDS DE RESUMO FINANCEIRO (KPIs) */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Consolidando números do caixa...</p>
          </div>
        ) : overview ? (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Faturamento Bruto */}
              <div className="glass-card p-4 sm:p-5 border-zinc-800">
                <span className="text-zinc-400 text-xs font-medium block mb-1">Faturamento Bruto</span>
                <p className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
                  R$ {overview.totals.grossRevenue.toFixed(2)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800">
                  <span>Serviços: R$ {overview.totals.servicesGross.toFixed(2)}</span>
                  <span>Produtos: R$ {overview.totals.productsGross.toFixed(2)}</span>
                </div>
              </div>

              {/* Total em Comissões */}
              <div className="glass-card p-4 sm:p-5 border-zinc-800">
                <span className="text-zinc-400 text-xs font-medium block mb-1">Comissões da Equipe</span>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-outfit">
                  R$ {overview.totals.commissionsDue.toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800">
                  Valor total devido aos profissionais
                </p>
              </div>

              {/* Dinheiro Retido em Mãos */}
              <div className="glass-card p-4 sm:p-5 border-zinc-800">
                <span className="text-zinc-400 text-xs font-medium block mb-1">Dinheiro em Mãos</span>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-outfit">
                  R$ {overview.totals.cashInHand.toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800">
                  Recebido em espécie pelos barbeiros
                </p>
              </div>

              {/* Repasse Líquido Manual */}
              <div className="glass-card p-4 sm:p-5 border-zinc-800">
                <span className="text-zinc-400 text-xs font-medium block mb-1">Repasse Líquido (Pix)</span>
                <p
                  className={`text-2xl sm:text-3xl font-extrabold font-outfit ${
                    overview.totals.netTransferTotal >= 0 ? 'text-amber-400' : 'text-blue-400'
                  }`}
                >
                  R$ {Math.abs(overview.totals.netTransferTotal).toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2 pt-2 border-t border-zinc-800">
                  {overview.totals.netTransferTotal >= 0
                    ? 'A pagar pela barbearia via Pix'
                    : 'A recolher dos barbeiros (excedente em dinheiro)'}
                </p>
              </div>
            </div>

            {/* LISTA / CARDS POR BARBEIRO */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Detalhamento por Profissional</h2>
                <span className="text-xs text-zinc-400">{overview.barbers.length} cadastrados</span>
              </div>

              {overview.barbers.length === 0 ? (
                <div className="glass-card p-8 text-center text-zinc-500">
                  Nenhum barbeiro ativo cadastrado nesta barbearia.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {overview.barbers.map((b) => (
                    <div
                      key={b.barberId}
                      className="glass-card p-5 border-zinc-800 flex flex-col justify-between space-y-4"
                    >
                      <div>
                        {/* Topo: Barbeiro & Status do Caixa */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-amber-400 overflow-hidden">
                              {b.avatarUrl ? (
                                <img
                                  src={b.avatarUrl}
                                  alt={b.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                b.fullName.slice(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <h3 className="text-base font-bold text-white leading-tight">
                                {b.fullName}
                              </h3>
                              <p className="text-xs text-zinc-400">
                                Comissão Base: <span className="text-zinc-200 font-semibold">{b.commissionPercent}%</span> • {b.appointmentsCount} atendimentos
                              </p>
                            </div>
                          </div>

                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              b.isClosed
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {b.isClosed ? '✓ Caixa Fechado' : '● Caixa Aberto'}
                          </span>
                        </div>

                        {/* Detalhes de Faturamento e Dedução */}
                        <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-900/90 rounded-xl border border-zinc-800/80 text-xs">
                          <div>
                            <span className="text-zinc-500 text-[10px] block">Faturado</span>
                            <span className="font-bold text-zinc-200">
                              R$ {b.totalGross.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[10px] block">Comissão</span>
                            <span className="font-bold text-amber-400">
                              R$ {b.commissionEarned.toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[10px] block">Dinheiro em Mãos</span>
                            <span className="font-bold text-emerald-400">
                              - R$ {b.cashInHand.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Resultado do Repasse Líquido */}
                        <div className="mt-3 p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                          <div>
                            <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">
                              {b.direction === 'owner_pays_barber'
                                ? 'Barbearia transfere ao Barbeiro'
                                : b.direction === 'barber_pays_owner'
                                  ? 'Barbeiro devolve à Barbearia'
                                  : 'Contas Quitadas'}
                            </span>
                            <span className="text-xs text-zinc-400">
                              Chave Pix: <strong className="text-zinc-200">{b.pixKey || 'Não informada'}</strong>
                            </span>
                          </div>

                          <div className="text-right">
                            <span
                              className={`text-lg font-black font-outfit ${
                                b.direction === 'owner_pays_barber'
                                  ? 'text-amber-400'
                                  : b.direction === 'barber_pays_owner'
                                    ? 'text-blue-400'
                                    : 'text-zinc-400'
                              }`}
                            >
                              R$ {Math.abs(b.netTransferAmount).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                        {/* Botão Copiar Pix / Comprovante */}
                        <button
                          onClick={() => setActivePixModal(b)}
                          className="py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <span>📋</span> Ver Comprovante Pix
                        </button>

                        {/* Botão Fechar Caixa deste Barbeiro */}
                        <button
                          onClick={() => handleCloseBarber(b)}
                          disabled={closingInProgress}
                          className="py-2.5 px-3 rounded-xl gold-gradient-bg text-black text-xs font-bold shadow-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {b.isClosed ? 'Atualizar Fechamento' : 'Realizar Fechamento'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* TABELA: HISTÓRICO DE FECHAMENTOS RECENTES */}
            <div className="glass-card p-5 border-zinc-800 space-y-4">
              <h2 className="text-base font-bold text-white">Histórico de Fechamentos Salvos</h2>

              {overview.recentClosings.length === 0 ? (
                <p className="text-xs text-zinc-500">Nenhum fechamento registrado ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] tracking-wider">
                        <th className="pb-2.5 font-bold">Data/Hora</th>
                        <th className="pb-2.5 font-bold">Barbeiro</th>
                        <th className="pb-2.5 font-bold">Período</th>
                        <th className="pb-2.5 font-bold">Faturamento</th>
                        <th className="pb-2.5 font-bold">Comissão</th>
                        <th className="pb-2.5 font-bold">Dinheiro</th>
                        <th className="pb-2.5 font-bold text-right">Repasse Líquido</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {overview.recentClosings.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-900/50">
                          <td className="py-3 text-zinc-400">
                            {new Date(c.closedAt).toLocaleString('pt-BR', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="py-3 font-semibold text-white">{c.barberName}</td>
                          <td className="py-3 text-zinc-400 uppercase text-[10px]">
                            {c.period} ({c.periodStart} a {c.periodEnd})
                          </td>
                          <td className="py-3 text-zinc-200">R$ {c.grossAmount.toFixed(2)}</td>
                          <td className="py-3 text-amber-400">R$ {c.commissionAmount.toFixed(2)}</td>
                          <td className="py-3 text-emerald-400">R$ {c.cashInHand.toFixed(2)}</td>
                          <td className="py-3 text-right font-bold text-white">
                            R$ {c.netTransferAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : null}

        {/* MODAL: COMPROVANTE & REPASSE PIX */}
        {activePixModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <button
                onClick={() => setActivePixModal(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                ✕
              </button>

              <div className="text-center mb-5">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  Comprovante de Fechamento
                </span>
                <h3 className="text-xl font-black text-white font-outfit mt-1">
                  Repasse - {activePixModal.fullName}
                </h3>
                <p className="text-xs text-zinc-400">
                  Período: {startDate} a {endDate} ({period.toUpperCase()})
                </p>
              </div>

              {/* Resumo Financeiro */}
              <div className="space-y-2 p-4 bg-zinc-950 rounded-xl border border-zinc-800 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Faturamento Bruto Gerado:</span>
                  <span className="font-bold text-zinc-200">
                    R$ {activePixModal.totalGross.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Comissão Devida ({activePixModal.commissionPercent}%):</span>
                  <span className="font-bold text-amber-400">
                    R$ {activePixModal.commissionEarned.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">(-) Dinheiro em Mãos Recebido:</span>
                  <span className="font-bold text-emerald-400">
                    - R$ {activePixModal.cashInHand.toFixed(2)}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between items-center">
                  <span className="font-bold text-white">Valor Líquido via Pix:</span>
                  <span className="text-lg font-black text-amber-400 font-outfit">
                    R$ {Math.abs(activePixModal.netTransferAmount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Chave Pix para Cópia */}
              <div className="space-y-2 mb-5">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Chave Pix do Barbeiro ({activePixModal.pixKeyType}):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activePixModal.pixKey || 'Chave não cadastrada'}
                    className="input-field text-xs py-2 bg-zinc-950"
                  />
                  <button
                    onClick={() => copyPixKey(activePixModal.pixKey)}
                    disabled={!activePixModal.pixKey}
                    className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl whitespace-nowrap"
                  >
                    {copiedKey ? '✓ Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Botão de Envio no WhatsApp em 1 Toque */}
              {activePixModal.pixKey ? (
                <a
                  href={`https://wa.me/55${activePixModal.pixKey.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `*Fechamento de Caixa - ${activePixModal.fullName}*\n\n` +
                      `📅 Período: ${startDate} a ${endDate}\n` +
                      `💈 Faturamento Total: R$ ${activePixModal.totalGross.toFixed(2)}\n` +
                      `💰 Comissão: R$ ${activePixModal.commissionEarned.toFixed(2)}\n` +
                      `💵 Dinheiro em mãos retido: R$ ${activePixModal.cashInHand.toFixed(2)}\n\n` +
                      `*👉 Valor Líquido do Repasse Pix: R$ ${Math.abs(activePixModal.netTransferAmount).toFixed(2)}*\n\n` +
                      `Comprovante gerado pelo sistema. Obrigado pelo trabalho!`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <span>💬</span> Enviar Demonstrativo no WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
