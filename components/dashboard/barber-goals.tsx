'use client'

import React, { useState, useEffect } from 'react'
import {
  Trophy,
  Flame,
  TrendingUp,
  Target,
  Sparkles,
  Scissors,
  CheckCircle2,
  ChevronRight,
  Zap,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react'
import { getBarberGoalProgressAction, BarberGoalProgress } from '@/app/actions/gamification'

interface BarberGoalsWidgetProps {
  barberId?: string
  tenantId?: string
}

export function BarberGoalsWidget({ barberId, tenantId }: BarberGoalsWidgetProps) {
  const [data, setData] = useState<BarberGoalProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchGoal() {
      setLoading(true)
      const res = await getBarberGoalProgressAction(barberId, tenantId)
      if (res.success && res.data) {
        setData(res.data)
      } else {
        // Mock demonstrativo rico para prévia
        setData({
          barberId: 'barber-demo',
          barberName: 'Marcos Silva',
          currentMonthName: 'Setembro',
          completedCuts: 67,
          currentGrossRevenue: 3820,
          currentCommissionPercent: 50,
          currentCommissionEarned: 1910,
          currentTier: {
            id: 'tier-bronze',
            name: 'Faixa Base',
            minCuts: 0,
            maxCuts: 70,
            commissionPercent: 50,
            badge: '🥉 Bronze',
          },
          nextTier: {
            id: 'tier-silver',
            name: 'Faixa Performance',
            minCuts: 71,
            maxCuts: 120,
            commissionPercent: 55,
            badge: '🥈 Prata',
          },
          cutsRemainingForNextTier: 4,
          progressPercentToNextTier: 95,
          projectedExtraEarningsNextTier: 191.0,
          allTiers: [
            { id: 'tier-bronze', name: 'Faixa Base', minCuts: 0, maxCuts: 70, commissionPercent: 50, badge: '🥉 Bronze' },
            { id: 'tier-silver', name: 'Faixa Performance', minCuts: 71, maxCuts: 120, commissionPercent: 55, badge: '🥈 Prata' },
            { id: 'tier-gold', name: 'Faixa Master', minCuts: 121, maxCuts: null, commissionPercent: 60, badge: '🥇 Ouro VIP' },
          ],
        })
      }
      setLoading(false)
    }
    fetchGoal()
  }, [barberId, tenantId])

  if (loading) {
    return (
      <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl animate-pulse text-xs text-neutral-500 text-center">
        Carregando metas do profissional...
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider mb-0.5">
            <Trophy className="w-4 h-4" />
            Metas de Faturamento & Comissões Progressivas
          </div>
          <h3 className="text-lg font-black text-white">
            Termômetro de Performance • {data.currentMonthName}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Nível Atual: {data.currentTier.badge} ({data.currentCommissionPercent}%)
          </span>
        </div>
      </div>

      {/* Motivational Callout Banner */}
      {data.nextTier ? (
        <div className="p-4 bg-gradient-to-r from-amber-500/15 via-neutral-900 to-neutral-900 border border-amber-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0">
              <Flame className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Faltam apenas <span className="text-amber-400 font-extrabold">{data.cutsRemainingForNextTier} cortes</span> para você desbloquear {data.nextTier.commissionPercent}% de comissão!
              </h4>
              <p className="text-xs text-neutral-300 mt-0.5">
                Você realizou <strong>{data.completedCuts} cortes</strong> em {data.currentMonthName}. Suba para a {data.nextTier.name} ({data.nextTier.badge}) para aumentar seu repasse em todas as próximas comandas.
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">Bônus Projetado</span>
            <span className="text-emerald-400 font-black text-sm">
              +R$ {data.projectedExtraEarningsNextTier.toFixed(2)}
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <h4 className="text-sm font-bold text-white">Parabéns! Nível Master Atingido!</h4>
            <p className="text-xs text-neutral-300">
              Você alcançou o topo da escala com <strong>{data.completedCuts} cortes</strong> e está recebendo a comissão máxima de {data.currentCommissionPercent}%.
            </p>
          </div>
        </div>
      )}

      {/* Visual Thermometer Progression Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-semibold text-neutral-400">
          <span>Progresso para o Próximo Nível</span>
          <span className="text-amber-400 font-bold">{data.progressPercentToNextTier}%</span>
        </div>

        <div className="w-full bg-neutral-950 h-4 rounded-full p-0.5 border border-neutral-800 overflow-hidden relative">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-400 transition-all duration-700 shadow-md"
            style={{ width: `${Math.max(data.progressPercentToNextTier, 5)}%` }}
          />
        </div>
      </div>

      {/* Tier Milestones Grid */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {data.allTiers.map((tier) => {
          const isAchieved = data.completedCuts >= tier.minCuts
          const isCurrent = data.currentTier.id === tier.id

          return (
            <div
              key={tier.id}
              className={`p-3.5 rounded-2xl border transition text-center space-y-1 ${
                isCurrent
                  ? 'bg-amber-500/15 border-amber-500 text-white shadow-md'
                  : isAchieved
                  ? 'bg-neutral-950 border-emerald-500/30 text-neutral-300'
                  : 'bg-neutral-950/60 border-neutral-800 text-neutral-500 opacity-60'
              }`}
            >
              <div className="text-xs font-bold text-amber-400 flex items-center justify-center gap-1">
                {tier.badge}
              </div>
              <div className="text-lg font-black text-white">{tier.commissionPercent}%</div>
              <div className="text-[10px] text-neutral-400 font-medium">
                {tier.maxCuts ? `${tier.minCuts} a ${tier.maxCuts} cortes` : `Acima de ${tier.minCuts} cortes`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Current Month Financial Stats */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-800/80">
        <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800">
          <span className="text-[11px] text-neutral-500 block">Faturamento Produzido</span>
          <span className="text-lg font-bold text-white">
            R$ {data.currentGrossRevenue.toLocaleString('pt-BR')},00
          </span>
        </div>
        <div className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800">
          <span className="text-[11px] text-neutral-500 block">Comissão Acumulada</span>
          <span className="text-lg font-bold text-emerald-400">
            R$ {data.currentCommissionEarned.toLocaleString('pt-BR')},00
          </span>
        </div>
      </div>
    </div>
  )
}
