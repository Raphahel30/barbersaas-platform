'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Building,
  Trophy,
  DollarSign,
  TrendingUp,
  Percent,
  Calendar,
  FileCheck2,
  Receipt,
  Users,
  Award,
  ExternalLink,
  RefreshCw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Flame,
} from 'lucide-react'
import {
  getFranchiseDashboardAction,
  runFranchiseSettlementAction,
  issueFranchiseInvoiceAction,
  upsertFranchiseContractAction,
} from '@/app/actions/franchise'
import type {
  NetworkDashboardData,
  BranchPerformanceMetrics,
  FranchiseContractRow,
  FranchiseSettlementRow,
} from '@/lib/franchise/royalties'

export default function FranchiseDashboardPage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [activeTab, setActiveTab] = useState<'ranking' | 'settlements' | 'contracts'>('ranking')

  const [dashboard, setDashboard] = useState<NetworkDashboardData | null>(null)
  const [contracts, setContracts] = useState<FranchiseContractRow[]>([])
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([])

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modal para editar contrato
  const [editingContract, setEditingContract] = useState<{
    tenantId: string
    tenantName: string
    royaltiesPercentage: number
    marketingFundPercentage: number
    fixedMonthlyFee: number
    dueDay: number
  } | null>(null)

  function loadData() {
    setLoading(true)
    setErrorMsg(null)
    startTransition(async () => {
      const res = await getFranchiseDashboardAction(selectedMonth, selectedYear)
      if (res.success) {
        setDashboard(res.data.dashboard)
        setContracts(res.data.contracts)
        setBranches(res.data.branches)
      } else {
        setErrorMsg(res.message)
      }
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [selectedMonth, selectedYear])

  async function handleRunSettlement() {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await runFranchiseSettlementAction(selectedMonth, selectedYear)
      if (res.success) {
        setSuccessMsg(`Apuração da competência ${selectedMonth}/${selectedYear} finalizada com sucesso!`)
        loadData()
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  async function handleIssueInvoice(settlementId: string) {
    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await issueFranchiseInvoiceAction(settlementId)
      if (res.success) {
        setSuccessMsg('Fatura Asaas gerada com sucesso! Link pronto para pagamento.')
        loadData()
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  async function handleSaveContract(e: React.FormEvent) {
    e.preventDefault()
    if (!editingContract) return

    setErrorMsg(null)
    setSuccessMsg(null)
    startTransition(async () => {
      const res = await upsertFranchiseContractAction(
        editingContract.tenantId,
        editingContract.royaltiesPercentage,
        editingContract.marketingFundPercentage,
        editingContract.fixedMonthlyFee,
        editingContract.dueDay
      )
      if (res.success) {
        setSuccessMsg('Termos do contrato de franquia atualizados!')
        setEditingContract(null)
        loadData()
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Portal do Franqueador</h1>
              <p className="text-neutral-400 text-sm mt-0.5">
                Inteligência de rede, ranking comparativo de filiais, apuração de Royalties & FPP.
              </p>
            </div>
          </div>
        </div>

        {/* Filtro de Competência & Ações */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm px-2 py-1.5 rounded text-neutral-200 focus:outline-none"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m} className="bg-neutral-900">
                  {new Date(2026, m - 1).toLocaleString('pt-BR', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm px-2 py-1.5 rounded text-neutral-200 focus:outline-none border-l border-neutral-800"
            >
              {[2025, 2026, 2027].map((y) => (
                <option key={y} value={y} className="bg-neutral-900">
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadData}
            disabled={isPending || loading}
            className="p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-neutral-300 transition-colors"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleRunSettlement}
            disabled={isPending}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold px-4 py-2 rounded-lg text-sm transition-colors shadow-lg shadow-amber-500/10"
          >
            <Receipt className="w-4 h-4" />
            Apurar Fechamento Mensal
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alertas */}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Métricas Globais da Rede */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Faturamento da Rede</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-100">
              R$ {dashboard?.totalNetworkRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {dashboard?.totalNetworkAppointments || 0} cortes concluídos
            </div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Ticket Médio da Rede</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-100">
              R$ {dashboard?.averageNetworkTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Média consolidada por cliente</div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Royalties Devidos</span>
              <Percent className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">
              R$ {dashboard?.totalRoyaltiesAccrued.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Percentual apurado das filiais</div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Fundo de Propaganda (FPP)</span>
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400">
              R$ {dashboard?.totalMarketingFundAccrued.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Verba de marketing centralizado</div>
          </div>
        </div>

        {/* Navegação por Abas */}
        <div className="flex border-b border-neutral-800 space-x-6 text-sm">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'ranking' ? 'text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Trophy className="w-4 h-4" />
            Ranking de Filiais
            {activeTab === 'ranking' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('settlements')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'settlements' ? 'text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Apurações & Faturas ({dashboard?.settlements.length || 0})
            {activeTab === 'settlements' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`pb-3 font-medium transition-colors relative flex items-center gap-2 ${
              activeTab === 'contracts' ? 'text-amber-400' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Contratos de Franquia ({contracts.length})
            {activeTab === 'contracts' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
            )}
          </button>
        </div>

        {/* Conteúdo da Aba 1: Ranking Comparativo */}
        {activeTab === 'ranking' && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Performance Comparativa da Rede
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Ordenado por volume total faturado no mês selecionado.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-950/60 text-neutral-400 text-xs uppercase border-b border-neutral-800">
                  <tr>
                    <th className="py-3.5 px-4">Posição</th>
                    <th className="py-3.5 px-4">Unidade / Filial</th>
                    <th className="py-3.5 px-4 text-right">Faturamento</th>
                    <th className="py-3.5 px-4 text-center">Atendimentos</th>
                    <th className="py-3.5 px-4 text-right">Ticket Médio</th>
                    <th className="py-3.5 px-4 text-center">Ocupação de Cadeiras</th>
                    <th className="py-3.5 px-4 text-center">Profissionais</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {dashboard?.branchesRanking.map((branch) => {
                    const isTop1 = branch.rank === 1
                    const isTop2 = branch.rank === 2
                    const isTop3 = branch.rank === 3

                    return (
                      <tr key={branch.tenantId} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {isTop1 ? (
                              <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-xs">
                                🥇 1º
                              </span>
                            ) : isTop2 ? (
                              <span className="w-7 h-7 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40 flex items-center justify-center font-bold text-xs">
                                🥈 2º
                              </span>
                            ) : isTop3 ? (
                              <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 flex items-center justify-center font-bold text-xs">
                                🥉 3º
                              </span>
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center font-semibold text-xs">
                                #{branch.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-medium text-neutral-100 whitespace-nowrap">
                          {branch.tenantName}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold text-emerald-400 whitespace-nowrap">
                          R$ {branch.grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {branch.completedAppointments} cortes
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          R$ {branch.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-800 text-xs">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                branch.chairOccupancyRatePercent >= 70
                                  ? 'bg-emerald-400'
                                  : branch.chairOccupancyRatePercent >= 40
                                  ? 'bg-amber-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                            {branch.chairOccupancyRatePercent}%
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-neutral-400 whitespace-nowrap">
                          {branch.activeBarbersCount} barbeiros
                        </td>
                      </tr>
                    )
                  })}
                  {(!dashboard?.branchesRanking || dashboard.branchesRanking.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        Nenhuma filial encontrada para esta organização.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 2: Apurações de Royalties & Faturas Asaas */}
        {activeTab === 'settlements' && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-purple-400" />
                  Fechamentos & Cobrança de Royalties
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Valores apurados com base no faturamento bruto homologado da competência.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-950/60 text-neutral-400 text-xs uppercase border-b border-neutral-800">
                  <tr>
                    <th className="py-3.5 px-4">Filial</th>
                    <th className="py-3.5 px-4 text-right">Faturamento Bruto</th>
                    <th className="py-3.5 px-4 text-right">Royalties</th>
                    <th className="py-3.5 px-4 text-right">FPP</th>
                    <th className="py-3.5 px-4 text-right">Total Devido</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {dashboard?.settlements.map((settlement) => {
                    const branchName =
                      branches.find((b) => b.id === settlement.tenant_id)?.name || 'Filial'

                    return (
                      <tr key={settlement.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-4 px-4 font-medium whitespace-nowrap">{branchName}</td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          R$ {Number(settlement.gross_revenue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right text-purple-400 whitespace-nowrap">
                          R$ {Number(settlement.royalties_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right text-orange-400 whitespace-nowrap">
                          R$ {Number(settlement.marketing_fund_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-right font-bold text-neutral-100 whitespace-nowrap">
                          R$ {Number(settlement.total_due).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                              settlement.status === 'paid'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : settlement.status === 'invoiced'
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {settlement.status === 'paid'
                              ? 'Pago'
                              : settlement.status === 'invoiced'
                              ? 'Faturado (Asaas)'
                              : 'Pendente'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          {settlement.asaas_invoice_url ? (
                            <a
                              href={settlement.asaas_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline"
                            >
                              Ver Fatura <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <button
                              onClick={() => handleIssueInvoice(settlement.id)}
                              disabled={isPending}
                              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg font-medium transition-colors"
                            >
                              Gerar Cobrança Asaas
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {(!dashboard?.settlements || dashboard.settlements.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500">
                        Nenhuma apuração gerada para {selectedMonth}/{selectedYear}. Clique no botão &quot;Apurar
                        Fechamento Mensal&quot; acima para processar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 3: Contratos de Franquia */}
        {activeTab === 'contracts' && (
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-4 md:p-6 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  Contratos & Percentuais por Unidade
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configure as alíquotas de Royalties, FPP e mensalidades fixas para cada filial franqueada.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-950/60 text-neutral-400 text-xs uppercase border-b border-neutral-800">
                  <tr>
                    <th className="py-3.5 px-4">Filial</th>
                    <th className="py-3.5 px-4 text-center">% Royalties</th>
                    <th className="py-3.5 px-4 text-center">% Fundo de Propaganda (FPP)</th>
                    <th className="py-3.5 px-4 text-right">Taxa Fixa Mensal</th>
                    <th className="py-3.5 px-4 text-center">Dia do Vencimento</th>
                    <th className="py-3.5 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                  {branches.map((branch) => {
                    const contract = contracts.find((c) => c.tenant_id === branch.id)

                    return (
                      <tr key={branch.id} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-4 px-4 font-medium whitespace-nowrap">{branch.name}</td>
                        <td className="py-4 px-4 text-center text-purple-400 whitespace-nowrap">
                          {contract?.royalties_percentage || '5.00'}%
                        </td>
                        <td className="py-4 px-4 text-center text-orange-400 whitespace-nowrap">
                          {contract?.marketing_fund_percentage || '2.00'}%
                        </td>
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          R$ {Number(contract?.fixed_monthly_fee || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          Dia {contract?.due_day || 10}
                        </td>
                        <td className="py-4 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() =>
                              setEditingContract({
                                tenantId: branch.id,
                                tenantName: branch.name,
                                royaltiesPercentage: Number(contract?.royalties_percentage || 5),
                                marketingFundPercentage: Number(contract?.marketing_fund_percentage || 2),
                                fixedMonthlyFee: Number(contract?.fixed_monthly_fee || 0),
                                dueDay: contract?.due_day || 10,
                              })
                            }
                            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg font-medium transition-colors"
                          >
                            Editar Termos
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {branches.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-neutral-500">
                        Nenhuma filial encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Edição de Contrato */}
      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-400" />
                Contrato: {editingContract.tenantName}
              </h3>
              <button
                onClick={() => setEditingContract(null)}
                className="text-neutral-400 hover:text-neutral-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContract} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  % Royalties sobre Faturamento Bruto
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editingContract.royaltiesPercentage}
                  onChange={(e) =>
                    setEditingContract({
                      ...editingContract,
                      royaltiesPercentage: Number(e.target.value),
                    })
                  }
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  % Fundo de Propaganda e Marketing (FPP)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={editingContract.marketingFundPercentage}
                  onChange={(e) =>
                    setEditingContract({
                      ...editingContract,
                      marketingFundPercentage: Number(e.target.value),
                    })
                  }
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  Taxa Fixa Mensal (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingContract.fixedMonthlyFee}
                  onChange={(e) =>
                    setEditingContract({
                      ...editingContract,
                      fixedMonthlyFee: Number(e.target.value),
                    })
                  }
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase mb-1">
                  Dia de Vencimento da Fatura
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={editingContract.dueDay}
                  onChange={(e) =>
                    setEditingContract({
                      ...editingContract,
                      dueDay: Number(e.target.value),
                    })
                  }
                  required
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingContract(null)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 rounded-lg text-sm text-neutral-950 font-semibold transition-colors"
                >
                  Salvar Termos
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
