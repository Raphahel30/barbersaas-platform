'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  TrendingUp,
  Users,
  DollarSign,
  Percent,
  RefreshCw,
  Plus,
  MapPin,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Award,
  Scissors,
  CheckCircle2,
  ChevronRight,
  UserCheck,
} from 'lucide-react'
import { getBranchNetworkAction } from '@/app/actions/branch'
import type { ConsolidatedNetworkResult } from '@/lib/branch/consolidation'

export default function BranchesConsolidationPage() {
  const [data, setData] = useState<ConsolidatedNetworkResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  const loadData = async () => {
    setLoading(true)
    const res = await getBranchNetworkAction()
    if (res.success && res.data) {
      setData(res.data)
    } else {
      // Mock de homologação para visualização rica
      setData({
        isMultiBranch: true,
        organizationName: 'Rede Barbearia Imperial Club',
        branchesCount: 3,
        totalGrossRevenue: 78940,
        totalAppointmentsCount: 1240,
        networkAverageTicket: 63.66,
        networkOccupancyRate: 84.5,
        totalCommissionExpense: 39470,
        topPerformingBranch: 'Imperial Jardins (Matriz)',
        branches: [
          {
            tenantId: 'b-1',
            name: 'Imperial Jardins (Matriz)',
            slug: 'imperial-jardins',
            status: 'active',
            city: 'São Paulo - Jardins',
            grossRevenue: 38400,
            appointmentsCount: 560,
            averageTicket: 68.57,
            occupancyRate: 89.2,
            commissionExpense: 19200,
            activeBarbersCount: 4,
          },
          {
            tenantId: 'b-2',
            name: 'Imperial Moema',
            slug: 'imperial-moema',
            status: 'active',
            city: 'São Paulo - Moema',
            grossRevenue: 24800,
            appointmentsCount: 410,
            averageTicket: 60.48,
            occupancyRate: 82.0,
            commissionExpense: 12400,
            activeBarbersCount: 3,
          },
          {
            tenantId: 'b-3',
            name: 'Imperial Itaim Bibi',
            slug: 'imperial-itaim',
            status: 'active',
            city: 'São Paulo - Itaim Bibi',
            grossRevenue: 15740,
            appointmentsCount: 270,
            averageTicket: 58.29,
            occupancyRate: 78.4,
            commissionExpense: 7870,
            activeBarbersCount: 2,
          },
        ],
        roamingBarbers: [
          {
            barberId: 'rb-1',
            name: 'Arthur Lima (Mestre Navalha)',
            email: 'arthur.lima@imperial.com',
            phone: '(11) 98765-1122',
            branches: [
              {
                tenantId: 'b-1',
                tenantName: 'Imperial Jardins (Matriz)',
                scheduledDays: [1, 2, 3], // Seg, Ter, Qua
              },
              {
                tenantId: 'b-3',
                tenantName: 'Imperial Itaim Bibi',
                scheduledDays: [4, 5, 6], // Qui, Sex, Sáb
              },
            ],
          },
          {
            barberId: 'rb-2',
            name: 'Bruno Castro (Visagista)',
            email: 'bruno.castro@imperial.com',
            phone: '(11) 97654-9988',
            branches: [
              {
                tenantId: 'b-2',
                tenantName: 'Imperial Moema',
                scheduledDays: [2, 3, 4], // Ter, Qua, Qui
              },
              {
                tenantId: 'b-1',
                tenantName: 'Imperial Jardins (Matriz)',
                scheduledDays: [5, 6], // Sex, Sáb
              },
            ],
          },
        ],
      })
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const formatDays = (days: number[]) => {
    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return days.map((d) => dayNames[d] || d).join(', ')
  }

  const selectedBranchData =
    selectedBranchId === 'all'
      ? null
      : data?.branches.find((b) => b.tenantId === selectedBranchId)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header with Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Building2 className="w-4 h-4" />
              Gestão de Rede & Franquias
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Painel Consolidado Multi-Filiais
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              {data?.organizationName || 'Sua Rede'} • Acompanhe o desempenho unificado de todas as unidades da sua rede.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Branch Selector Dropdown */}
            <div className="bg-neutral-900 border border-neutral-800 p-1 rounded-xl flex items-center text-xs">
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs text-white font-semibold px-3 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-neutral-900 text-white">
                  🌐 Visão Consolidada da Rede
                </option>
                {data?.branches.map((b) => (
                  <option key={b.tenantId} value={b.tenantId} className="bg-neutral-900 text-white">
                    📍 {b.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Top KPI Cards (Consolidated or Branch-specific) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">
                {selectedBranchData ? 'Faturamento da Unidade' : 'Faturamento Global da Rede'}
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                R${' '}
                {(selectedBranchData
                  ? selectedBranchData.grossRevenue
                  : data?.totalGrossRevenue || 0
                ).toLocaleString('pt-BR')}
                ,00
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Últimos 30 dias apurados</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Atendimentos Concluídos</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <Scissors className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {(selectedBranchData
                  ? selectedBranchData.appointmentsCount
                  : data?.totalAppointmentsCount || 0
                ).toLocaleString('pt-BR')}
              </span>
              <span className="text-[11px] text-amber-400 font-semibold">cortes</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Volume total executado</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Ticket Médio</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-400">
                R${' '}
                {(selectedBranchData
                  ? selectedBranchData.averageTicket
                  : data?.networkAverageTicket || 0
                ).toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Por cliente atendido</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Ocupação da Grade</span>
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-400">
                {selectedBranchData
                  ? selectedBranchData.occupancyRate
                  : data?.networkOccupancyRate || 0}
                %
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Eficiência da capacidade instalada</p>
          </div>
        </div>

        {/* Comparative Ranking Table */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Desempenho Comparativo por Filial
              </h2>
              <p className="text-xs text-neutral-400">
                Ranking de produtividade, receita bruta e comissões repassadas por unidade.
              </p>
            </div>
            <div className="text-xs text-neutral-400">
              Unidade líder:{' '}
              <strong className="text-emerald-400">{data?.topPerformingBranch}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Filial / Unidade</th>
                  <th className="py-3 px-4">Localização</th>
                  <th className="py-3 px-4 text-center">Barbeiros</th>
                  <th className="py-3 px-4 text-center">Atendimentos</th>
                  <th className="py-3 px-4">Ticket Médio</th>
                  <th className="py-3 px-4 text-center">Ocupação</th>
                  <th className="py-3 px-4">Faturamento Bruto</th>
                  <th className="py-3 px-4">Repasses / Comissões</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {data?.branches.map((b, idx) => (
                  <tr
                    key={b.tenantId}
                    className={`hover:bg-neutral-950/40 transition ${
                      selectedBranchId === b.tenantId ? 'bg-amber-500/10' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-neutral-800 flex items-center justify-center text-[10px] text-amber-400 font-bold">
                        {idx + 1}
                      </span>
                      {b.name}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                      {b.city}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-neutral-300">
                      {b.activeBarbersCount}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-white">
                      {b.appointmentsCount}
                    </td>
                    <td className="py-3.5 px-4 text-purple-400 font-bold">
                      R$ {b.averageTicket.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold ${
                          b.occupancyRate >= 85
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {b.occupancyRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-emerald-400">
                      R$ {b.grossRevenue.toLocaleString('pt-BR')},00
                    </td>
                    <td className="py-3.5 px-4 text-neutral-400 font-semibold">
                      R$ {b.commissionExpense.toLocaleString('pt-BR')},00
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Roaming Staff Module (Profissionais Volantes / Grade Compartilhada) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-amber-400" />
                  Profissionais com Grade Compartilhada (Móveis)
                </h2>
                <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full text-[10px] font-bold uppercase">
                  Multi-Unidade
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Barbeiros e visagistas parceiros que atendem em diferentes unidades da rede em dias alternados da semana.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.roamingBarbers.map((rb) => (
              <div
                key={rb.barberId}
                className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{rb.name}</h4>
                    <p className="text-[11px] text-neutral-400">{rb.email} • {rb.phone}</p>
                  </div>
                  <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                    <Scissors className="w-4 h-4" />
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-neutral-800/80">
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                    Escala Semanal por Unidade:
                  </span>
                  {rb.branches.map((branch) => (
                    <div
                      key={branch.tenantId}
                      className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-neutral-200">{branch.tenantName}</span>
                      <span className="px-2 py-0.5 bg-neutral-800 text-amber-400 font-mono text-[11px] rounded">
                        {formatDays(branch.scheduledDays)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
