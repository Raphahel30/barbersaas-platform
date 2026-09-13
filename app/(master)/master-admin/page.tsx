'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Store,
  DollarSign,
  TrendingUp,
  CreditCard,
  Search,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Building2,
  Calendar,
  Layers,
  ArrowUpRight,
} from 'lucide-react'
import {
  getMasterAdminData,
  toggleTenantStatus,
  updateTenantPlan,
  impersonateTenantAction,
  type MasterTenant,
  type MasterMetrics,
} from '@/app/actions/master'

export default function MasterAdminPage() {
  const [metrics, setMetrics] = useState<MasterMetrics | null>(null)
  const [tenants, setTenants] = useState<MasterTenant[]>([])
  const [plans, setPlans] = useState<Array<{ id: string; name: string; monthly_price: number }>>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trial' | 'suspended'>('all')
  const [selectedTenantForPlan, setSelectedTenantForPlan] = useState<MasterTenant | null>(null)
  const [newPlanId, setNewPlanId] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getMasterAdminData()
      setMetrics(data.metrics)
      setTenants(data.tenants)
      setPlans(data.plans)
    } catch (err) {
      console.error('Falha ao carregar dados do master:', err)
      setFeedback({ type: 'error', message: 'Erro ao carregar dados do painel.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleToggleStatus = async (tenant: MasterTenant) => {
    const nextStatus = tenant.status === 'active' ? 'suspended' : 'active'
    if (
      !confirm(
        `Tem certeza que deseja ${nextStatus === 'active' ? 'reativar' : 'suspender'} o acesso da barbearia "${tenant.name}"?`
      )
    ) {
      return
    }

    setActionLoadingId(tenant.id)
    try {
      const res = await toggleTenantStatus(tenant.id, nextStatus)
      if (res.success) {
        setFeedback({ type: 'success', message: res.message })
        await loadData()
      } else {
        setFeedback({ type: 'error', message: res.message })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao alterar status da barbearia.' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleUpdatePlan = async () => {
    if (!selectedTenantForPlan || !newPlanId) return
    setActionLoadingId(selectedTenantForPlan.id)

    try {
      const res = await updateTenantPlan(selectedTenantForPlan.id, newPlanId)
      if (res.success) {
        setFeedback({ type: 'success', message: res.message })
        setSelectedTenantForPlan(null)
        await loadData()
      } else {
        setFeedback({ type: 'error', message: res.message })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao alterar plano da barbearia.' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleImpersonate = async (tenant: MasterTenant) => {
    setActionLoadingId(tenant.id)
    try {
      const res = await impersonateTenantAction(tenant.id)
      if (res.success && res.redirectUrl) {
        window.open(res.redirectUrl, '_blank')
      } else {
        setFeedback({ type: 'error', message: res.message || 'Falha ao iniciar impersonação.' })
      }
    } catch {
      setFeedback({ type: 'error', message: 'Erro ao conectar à sessão da barbearia.' })
    } finally {
      setActionLoadingId(null)
    }
  }

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase()) ||
      t.owner_email.toLowerCase().includes(search.toLowerCase()) ||
      t.owner_name.toLowerCase().includes(search.toLowerCase())

    if (statusFilter === 'all') return matchesSearch
    return matchesSearch && t.status === statusFilter
  })

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d4af37]/15 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-[#9b1b1b]/20 border border-[#9b1b1b]/40 text-[#f7e599] text-xs font-cinzel font-bold tracking-wider uppercase">
              Centro de Comando Soberano
            </span>
            <span className="text-xs text-[#a89e90]">• Atualizado em tempo real</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-cinzel font-black text-white">
            Painel Geral do Dono do SaaS
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#d4af37]/30 bg-[#16120d] hover:bg-[#201a13] text-xs font-semibold text-[#fbf8f1] transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#d4af37] ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>
          <Link
            href="/comecar"
            target="_blank"
            className="gold-button text-xs px-4 py-2 flex items-center gap-1.5"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Nova Barbearia (Wizard)</span>
          </Link>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-sm ml-4 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* 4 Cards de Métricas no Topo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* 1. MRR */}
        <div className="vintage-card p-6 border border-[#d4af37]/30 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between text-[#a89e90] text-xs mb-2 font-sans font-medium">
            <span>MRR (Receita Recorrente)</span>
            <DollarSign className="w-4 h-4 text-[#d4af37]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-cinzel gold-gradient-text">
            R$ {metrics ? metrics.mrr.toLocaleString('pt-BR') : '...'}
          </div>
          <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Recorrência ativa calculada
          </p>
        </div>

        {/* 2. Barbearias Ativas */}
        <div className="vintage-card p-6 border border-[#d4af37]/20 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between text-[#a89e90] text-xs mb-2 font-sans font-medium">
            <span>Barbearias Ativas</span>
            <Store className="w-4 h-4 text-[#d4af37]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-cinzel text-white">
            {metrics ? metrics.activeTenants : '...'}
            <span className="text-sm text-[#a89e90] font-normal ml-2 font-sans">
              / {metrics ? metrics.totalTenants : '...'} cadastradas
            </span>
          </div>
          <p className="text-[11px] text-[#a89e90] mt-2">
            {metrics ? metrics.trialTenants : 0} em período de teste gratuito
          </p>
        </div>

        {/* 3. GMV Mensal */}
        <div className="vintage-card p-6 border border-[#d4af37]/20 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between text-[#a89e90] text-xs mb-2 font-sans font-medium">
            <span>GMV Mensal (Cortes & Barba)</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-cinzel text-white">
            R$ {metrics ? metrics.monthlyGmv.toLocaleString('pt-BR') : '...'}
          </div>
          <p className="text-[11px] text-[#a89e90] mt-2">
            Volume transacionado no mês corrente
          </p>
        </div>

        {/* 4. Saldo em Conta Asaas */}
        <div className="vintage-card p-6 border border-[#d4af37]/20 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between text-[#a89e90] text-xs mb-2 font-sans font-medium">
            <span>Saldo em Conta Asaas</span>
            <CreditCard className="w-4 h-4 text-[#d4af37]" />
          </div>
          <div className="text-2xl sm:text-3xl font-black font-cinzel gold-gradient-text">
            R$ {metrics ? metrics.asaasBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '...'}
          </div>
          <p className="text-[11px] text-emerald-400 mt-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            Gateway conectado e sincronizado
          </p>
        </div>
      </div>

      {/* Tabela Completa de Barbearias */}
      <section id="barbearias" className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-cinzel font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#d4af37]" />
              Barbearias Cadastradas no Sistema
            </h2>
            <p className="text-xs text-[#a89e90]">
              Gerencie acessos, altere planos, visualize dados de contato e acesse diretamente como barbeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Input de Busca */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#a89e90]" />
              <input
                type="text"
                placeholder="Buscar barbearia, dono ou slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#120f0c] border border-[#d4af37]/20 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-[#a89e90]/60 focus:outline-none focus:border-[#d4af37] w-64"
              />
            </div>

            {/* Filtros de Status */}
            <div className="flex items-center bg-[#120f0c] p-1 rounded-xl border border-[#d4af37]/20 text-xs">
              {(['all', 'active', 'trial', 'suspended'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg font-medium capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-[#d4af37] text-black font-bold'
                      : 'text-[#a89e90] hover:text-white'
                  }`}
                >
                  {st === 'all'
                    ? 'Todas'
                    : st === 'active'
                    ? 'Ativas'
                    : st === 'trial'
                    ? 'Trial'
                    : 'Suspensas'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Tabela de Dados */}
        <div className="vintage-card overflow-hidden border border-[#d4af37]/20">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181410] border-b border-[#d4af37]/15 text-[#a89e90] font-cinzel uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Barbearia & Slug</th>
                  <th className="py-3.5 px-4 font-bold">Proprietário & Contato</th>
                  <th className="py-3.5 px-4 font-bold">Plano Ativo</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d4af37]/10">
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#a89e90]">
                      Nenhuma barbearia encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((tenant) => {
                    const isActionLoading = actionLoadingId === tenant.id
                    return (
                      <tr
                        key={tenant.id}
                        className="hover:bg-[#181410]/50 transition-colors"
                      >
                        {/* Barbearia */}
                        <td className="py-4 px-4">
                          <div className="font-semibold text-white text-sm">
                            {tenant.name}
                          </div>
                          <div className="text-[11px] text-[#d4af37] flex items-center gap-1 mt-0.5">
                            <span>/{tenant.slug}</span>
                            {tenant.custom_domain && (
                              <span className="text-[#a89e90]">({tenant.custom_domain})</span>
                            )}
                          </div>
                        </td>

                        {/* Proprietário */}
                        <td className="py-4 px-4">
                          <div className="text-zinc-200 font-medium">{tenant.owner_name}</div>
                          <div className="text-[11px] text-[#a89e90]">{tenant.owner_email}</div>
                          <div className="text-[10px] text-[#a89e90]">{tenant.owner_phone}</div>
                        </td>

                        {/* Plano */}
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#201a13] border border-[#d4af37]/30 text-[#f7e599] font-cinzel font-semibold">
                            <Layers className="w-3 h-3 text-[#d4af37]" />
                            {tenant.plan_name}
                          </span>
                          <div className="text-[10px] text-[#a89e90] mt-1">
                            R$ {tenant.monthly_price.toFixed(2)}/mês
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-4">
                          {tenant.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-medium text-[11px]">
                              <ShieldCheck className="w-3 h-3" />
                              Ativa
                            </span>
                          ) : tenant.status === 'trial' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium text-[11px]">
                              <AlertTriangle className="w-3 h-3" />
                              Período Trial
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-medium text-[11px]">
                              <ShieldAlert className="w-3 h-3" />
                              Suspensa
                            </span>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Impersonate / Acessar como Barbeiro */}
                            <button
                              type="button"
                              onClick={() => handleImpersonate(tenant)}
                              disabled={isActionLoading}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#201a13] hover:bg-[#2c241a] border border-[#d4af37]/30 text-[#d4af37] font-semibold text-[11px] transition-colors"
                              title="Acessar o Painel Administrativo com auditoria"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Acessar Loja</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>

                            {/* Alterar Plano */}
                            <button
                              onClick={() => {
                                setSelectedTenantForPlan(tenant)
                                setNewPlanId(tenant.plan_id || (plans[0]?.id ?? ''))
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-[11px] font-medium transition-colors"
                            >
                              Alterar Plano
                            </button>

                            {/* Suspender ou Ativar */}
                            <button
                              onClick={() => handleToggleStatus(tenant)}
                              disabled={isActionLoading}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                                tenant.status === 'active'
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {tenant.status === 'active' ? 'Suspender' : 'Reativar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modal: Alterar Plano da Barbearia */}
      {selectedTenantForPlan && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14100c] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
              <h3 className="font-cinzel font-bold text-white text-base">
                Alterar Plano da Barbearia
              </h3>
              <button
                onClick={() => setSelectedTenantForPlan(null)}
                className="text-[#a89e90] hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#a89e90]">
              Barbearia selecionada: <strong className="text-white">{selectedTenantForPlan.name}</strong>
            </p>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-zinc-300">Escolha o Novo Plano:</label>
              <select
                value={newPlanId}
                onChange={(e) => setNewPlanId(e.target.value)}
                className="w-full bg-[#1e1812] border border-[#d4af37]/30 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — R$ {p.monthly_price.toFixed(2)}/mês
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setSelectedTenantForPlan(null)}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpdatePlan}
                disabled={actionLoadingId === selectedTenantForPlan.id}
                className="gold-button text-xs px-5 py-2"
              >
                {actionLoadingId === selectedTenantForPlan.id ? 'Salvando...' : 'Confirmar Alteração'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
