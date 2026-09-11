'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Filter,
  Users,
  Calendar,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Sparkles,
  HelpCircle,
  Download,
  CheckCircle2,
  XCircle,
  UserPlus,
  Zap,
  BarChart3,
  CalendarCheck,
  Percent,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

interface FunnelStep {
  step: number;
  label: string;
  description: string;
  count: number;
  pctOfTotal: number;
  dropoffPct: number;
}

interface BlockedSlotDemand {
  id: string;
  dayOfWeek: string;
  timeSlot: string;
  unfulfilledSearches: number;
  potentialRevenueLoss: number;
  occupancyRate: number;
  recommendedAction: string;
}

export default function FunnelAnalyticsPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('todos');

  // Dynamic funnel metrics based on period
  const metrics = period === '7d' ? {
    visits: 620,
    servicesChosen: 440,
    timeChosen: 260,
    completed: 104,
    abandonedHolds: 28,
    abandonedHoldRevenue: 1540,
    conversionRate: 16.8,
    abandonmentRate: 21.2,
  } : period === '90d' ? {
    visits: 7850,
    servicesChosen: 5420,
    timeChosen: 3310,
    completed: 1390,
    abandonedHolds: 285,
    abandonedHoldRevenue: 15675,
    conversionRate: 17.7,
    abandonmentRate: 17.0,
  } : {
    // 30 days default
    visits: 2540,
    servicesChosen: 1780,
    timeChosen: 1090,
    completed: 462,
    abandonedHolds: 98,
    abandonedHoldRevenue: 5390,
    conversionRate: 18.2,
    abandonmentRate: 17.5,
  };

  const funnelSteps: FunnelStep[] = [
    {
      step: 1,
      label: '1. Acessos na Vitrine',
      description: 'Visitantes que abriram o link da barbearia (Instagram, Google, QR Code)',
      count: metrics.visits,
      pctOfTotal: 100,
      dropoffPct: Number((((metrics.visits - metrics.servicesChosen) / metrics.visits) * 100).toFixed(1)),
    },
    {
      step: 2,
      label: '2. Seleção de Serviços',
      description: 'Clientes que adicionaram pelo menos um corte ou barba ao carrinho',
      count: metrics.servicesChosen,
      pctOfTotal: Number(((metrics.servicesChosen / metrics.visits) * 100).toFixed(1)),
      dropoffPct: Number((((metrics.servicesChosen - metrics.timeChosen) / metrics.servicesChosen) * 100).toFixed(1)),
    },
    {
      step: 3,
      label: '3. Escolha de Horário / Profissional',
      description: 'Clientes que definiram um barbeiro e geraram um hold de horário',
      count: metrics.timeChosen,
      pctOfTotal: Number(((metrics.timeChosen / metrics.visits) * 100).toFixed(1)),
      dropoffPct: Number((((metrics.timeChosen - metrics.completed) / metrics.timeChosen) * 100).toFixed(1)),
    },
    {
      step: 4,
      label: '4. Agendamento & Quitação Concluída',
      description: 'Horários pagos via Pix / sinal ou confirmados com sucesso na grade',
      count: metrics.completed,
      pctOfTotal: Number(((metrics.completed / metrics.visits) * 100).toFixed(1)),
      dropoffPct: 0,
    },
  ];

  const suppressedDemandData: BlockedSlotDemand[] = [
    {
      id: 'sd-1',
      dayOfWeek: 'Sexta-feira',
      timeSlot: '17:30 - 20:00',
      unfulfilledSearches: 64,
      potentialRevenueLoss: 3520,
      occupancyRate: 100,
      recommendedAction: 'Alocar 1 barbeiro extra ou abrir horários estendidos até 21h',
    },
    {
      id: 'sd-2',
      dayOfWeek: 'Sábado',
      timeSlot: '10:00 - 16:30',
      unfulfilledSearches: 92,
      potentialRevenueLoss: 5060,
      occupancyRate: 100,
      recommendedAction: 'Grade saturada. Priorizar agendamentos combinados (Cabelo + Barba)',
    },
    {
      id: 'sd-3',
      dayOfWeek: 'Quinta-feira',
      timeSlot: '18:00 - 19:30',
      unfulfilledSearches: 38,
      potentialRevenueLoss: 2090,
      occupancyRate: 98,
      recommendedAction: 'Adicionar segundo profissional para absorver o fluxo pós-expediente',
    },
    {
      id: 'sd-4',
      dayOfWeek: 'Domingo',
      timeSlot: '09:30 - 13:00',
      unfulfilledSearches: 29,
      potentialRevenueLoss: 1595,
      occupancyRate: 0,
      recommendedAction: 'Barbearia fechada no domingo. Avaliar abertura quinzenal com comissão especial',
    },
  ];

  const filteredDemand = selectedDayFilter === 'todos'
    ? suppressedDemandData
    : suppressedDemandData.filter(d => d.dayOfWeek.toLowerCase().includes(selectedDayFilter.toLowerCase()));

  const totalRevenueLoss = suppressedDemandData.reduce((acc, curr) => acc + curr.potentialRevenueLoss, 0);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header with Navigation and Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <BarChart3 className="w-4 h-4" />
              Analytics Operacional & Performance
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Funil de Conversão & Demanda Reprimida
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Identifique onde clientes abandonam a reserva e descubra dias/horários com falta de vagas para expandir seu faturamento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Period Toggles */}
            <div className="bg-neutral-900 border border-neutral-800 p-1 rounded-xl flex items-center text-xs">
              <button
                onClick={() => setPeriod('7d')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  period === '7d' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                7 Dias
              </button>
              <button
                onClick={() => setPeriod('30d')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  period === '30d' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                30 Dias
              </button>
              <button
                onClick={() => setPeriod('90d')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  period === '90d' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                90 Dias
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Relatório
            </button>
          </div>
        </div>

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Acessos à Vitrine</span>
              <div className="p-2 bg-neutral-800 rounded-xl text-neutral-300">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{metrics.visits.toLocaleString('pt-BR')}</span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center">
                +14.5% vs anterior
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Visitantes únicos no período</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Agendamentos Fechados</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">{metrics.completed}</span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center">
                +{metrics.conversionRate}% conversão
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Vagas confirmadas e realizadas</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Abandono de Checkout</span>
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-rose-400">{metrics.abandonmentRate}%</span>
              <span className="text-[11px] text-neutral-400 font-medium">
                ({metrics.abandonedHolds} holds)
              </span>
            </div>
            <p className="text-[11px] text-rose-400/80 mt-1">
              Perda estimada: R$ {metrics.abandonedHoldRevenue.toLocaleString('pt-BR')},00
            </p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Demanda Reprimida Estimada</span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-400">R$ {totalRevenueLoss.toLocaleString('pt-BR')},00</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Potencial em slots 100% saturados</p>
          </div>
        </div>

        {/* Section 1: Visual Conversion Funnel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-amber-400" />
                Etapas do Funil de Agendamento
              </h2>
              <p className="text-xs text-neutral-400">
                Acompanhe o caminho percorrido pelo cliente desde a primeira visualização até a quitação.
              </p>
            </div>
            <div className="text-xs text-neutral-400 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              Conversão Geral:{' '}
              <strong className="text-white">{metrics.conversionRate}%</strong>
            </div>
          </div>

          {/* Funnel Visual Stack */}
          <div className="space-y-4">
            {funnelSteps.map((s, idx) => {
              const isLast = idx === funnelSteps.length - 1;
              return (
                <div key={s.step} className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{s.label}</span>
                      <span className="text-neutral-500 hidden md:inline">• {s.description}</span>
                    </div>
                    <div className="flex items-center gap-3 font-semibold">
                      <span className="text-white">{s.count.toLocaleString('pt-BR')} pessoas</span>
                      <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                        {s.pctOfTotal}% do topo
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar */}
                  <div className="w-full bg-neutral-950 rounded-xl h-6 p-1 border border-neutral-800 flex items-center relative overflow-hidden">
                    <div
                      className={`h-full rounded-lg transition-all duration-500 ${
                        isLast
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'bg-gradient-to-r from-amber-500 to-amber-600'
                      }`}
                      style={{ width: `${Math.max(s.pctOfTotal, 5)}%` }}
                    />
                  </div>

                  {/* Drop-off Indicator between steps */}
                  {!isLast && (
                    <div className="flex items-center gap-2 pl-4 py-1 text-[11px] text-rose-400">
                      <TrendingDown className="w-3.5 h-3.5" />
                      <span>{s.dropoffPct}% de desistência antes da próxima etapa</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Abandonment Optimization Notice */}
          <div className="p-4 bg-neutral-950/80 border border-neutral-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">Como reduzir o abandono de checkout?</h4>
                <p className="text-[11px] text-neutral-400">
                  {metrics.abandonedHolds} clientes deixaram o hold expirar sem pagar o sinal Pix. Ativar lembretes no WhatsApp 5 min antes do término do hold recupera até 34% dessas desistências.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/agenda"
              className="px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold shrink-0 transition"
            >
              Configurar Lembretes
            </Link>
          </div>
        </div>

        {/* Section 2: Suppressed Demand Module (Demanda Reprimida) */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-purple-400" />
                  Módulo de Demanda Reprimida (Falta de Vagas)
                </h2>
                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-full text-[10px] font-bold uppercase">
                  IA Recomendações
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Registros de momentos em que clientes pesquisaram horários no PWA, mas não havia vagas livres na barbearia.
              </p>
            </div>

            {/* Day Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-400">Filtrar dia:</span>
              <select
                value={selectedDayFilter}
                onChange={e => setSelectedDayFilter(e.target.value)}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              >
                <option value="todos">Todos os Dias</option>
                <option value="quinta">Quinta-feira</option>
                <option value="sexta">Sexta-feira</option>
                <option value="sábado">Sábado</option>
                <option value="domingo">Domingo</option>
              </select>
            </div>
          </div>

          {/* AI Optimization Insight Box */}
          <div className="p-4 bg-gradient-to-r from-purple-950/40 via-neutral-950 to-neutral-950 border border-purple-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-xl shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Oportunidade Detectada: +R$ {totalRevenueLoss.toLocaleString('pt-BR')},00 / mês
                </h3>
                <p className="text-xs text-neutral-300 mt-0.5 max-w-2xl">
                  Sua grade de atendimento atinge <strong>100% de ocupação</strong> nas sextas a partir das 17h e aos sábados o dia todo. Pelo menos <strong>156 potenciais clientes</strong> não conseguiram marcar horário este mês.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/builder"
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition shrink-0 flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
            >
              <UserPlus className="w-4 h-4" />
              Adicionar Novo Barbeiro
            </Link>
          </div>

          {/* Table of Saturated Time Slots */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Dia da Semana</th>
                  <th className="py-3 px-4">Faixa de Horário</th>
                  <th className="py-3 px-4 text-center">Buscas Frustradas</th>
                  <th className="py-3 px-4 text-center">Ocupação Atual</th>
                  <th className="py-3 px-4">Faturamento Perdido</th>
                  <th className="py-3 px-4">Ação Sugerida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredDemand.map(item => (
                  <tr key={item.id} className="hover:bg-neutral-950/40 transition">
                    <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-400" />
                      {item.dayOfWeek}
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      <span className="px-2 py-0.5 bg-neutral-800 rounded font-mono text-[11px]">
                        {item.timeSlot}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                        {item.unfulfilledSearches} tentativas
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        item.occupancyRate >= 98
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {item.occupancyRate}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-purple-400">
                      R$ {item.potentialRevenueLoss.toLocaleString('pt-BR')},00
                    </td>
                    <td className="py-3.5 px-4 text-neutral-300">
                      <p className="text-[11px] leading-tight">{item.recommendedAction}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
