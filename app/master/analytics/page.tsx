import { requireSuperAdmin } from '@/lib/auth/guards'
import { getMasterAnalytics } from '@/app/actions/master-analytics'
import { AuditLogsViewer } from '@/components/audit/AuditLogsViewer'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function MasterAnalyticsPage() {
  await requireSuperAdmin()
  const data = await getMasterAnalytics()

  const { financial, tenantsDistribution, operations, planDistribution, recentAuditLogs } = data

  const statusTotal = tenantsDistribution.total || 1
  const activePercent = Math.round((tenantsDistribution.active / statusTotal) * 100)
  const trialPercent = Math.round((tenantsDistribution.trial / statusTotal) * 100)
  const pastDuePercent = Math.round((tenantsDistribution.pastDue / statusTotal) * 100)
  const suspendedPercent = Math.round((tenantsDistribution.suspended / statusTotal) * 100)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header do Master Analytics */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
                Inteligência de Negócios SaaS
              </span>
              <span className="text-xs text-zinc-500">rafaelcassu@gmail.com</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
              Métricas Financeiras & Observabilidade
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              MRR recorrente, volume transacionado (GMV), saúde da carteira e auditoria do ecossistema.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/master/dashboard"
              className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              ← Painel Geral
            </Link>
            <Link
              href="/master/builder"
              className="gold-button text-xs sm:text-sm px-4 py-2.5 shadow-md shadow-amber-500/20"
            >
              SaaS Builder No-Code
            </Link>
          </div>
        </div>

        {/* Bloco 1: KPIs Financeiros Principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* MRR Consolidado */}
          <div className="glass-card p-5 border-amber-500/30 bg-amber-950/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
              MRR Consolidado
            </p>
            <p className="text-3xl sm:text-4xl font-black text-amber-300 mt-2 font-outfit">
              R$ {financial.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Receita Mensal Recorrente em carteira
            </p>
          </div>

          {/* GMV Global */}
          <div className="glass-card p-5 border-emerald-500/30 bg-emerald-950/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              GMV Global Transacionado
            </p>
            <p className="text-3xl sm:text-4xl font-black text-emerald-300 mt-2 font-outfit">
              R$ {financial.gmvTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-emerald-500/80 mt-1">
              R$ {financial.gmvThisMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} neste mês
            </p>
          </div>

          {/* Ticket Médio */}
          <div className="glass-card p-5 border-blue-500/30 bg-blue-950/10">
            <p className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
              Ticket Médio por Atendimento
            </p>
            <p className="text-3xl sm:text-4xl font-black text-blue-300 mt-2 font-outfit">
              R$ {financial.averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[11px] text-zinc-400 mt-1">
              Média ponderada de serviços concluídos
            </p>
          </div>

          {/* Taxa Global de No-Show */}
          <div className="glass-card p-5 border-zinc-800">
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">
              Taxa Global de No-Show
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <p className={`text-3xl sm:text-4xl font-black font-outfit ${
                operations.noShowRatePercent > 10 ? 'text-red-400' : operations.noShowRatePercent > 5 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {operations.noShowRatePercent}%
              </p>
              <span className="text-xs text-zinc-500">
                ({operations.noShowCountMonth} faltas no mês)
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Mitigada por cobrança de sinal Pix
            </p>
          </div>
        </div>

        {/* Bloco 2: Gráficos e Distribuições */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card: Distribuição de Barbearias por Status */}
          <div className="glass-card p-6 border-zinc-800 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Status da Carteira de Tenants</h3>
                <p className="text-xs text-zinc-400">Total de {tenantsDistribution.total} barbearias registradas</p>
              </div>
            </div>

            {/* Barra Visual Segmentada */}
            <div className="w-full h-3 rounded-full bg-zinc-900 overflow-hidden flex">
              <div style={{ width: `${activePercent}%` }} className="bg-emerald-500 h-full transition-all" title="Ativas" />
              <div style={{ width: `${trialPercent}%` }} className="bg-blue-500 h-full transition-all" title="Trial" />
              <div style={{ width: `${pastDuePercent}%` }} className="bg-amber-500 h-full transition-all" title="Em Carência" />
              <div style={{ width: `${suspendedPercent}%` }} className="bg-red-500 h-full transition-all" title="Suspensas" />
            </div>

            {/* Detalhamento por Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-emerald-400 font-semibold block">Ativas</span>
                <span className="text-xl font-bold text-white">{tenantsDistribution.active}</span>
                <span className="text-[10px] text-zinc-500 block">{activePercent}% da base</span>
              </div>

              <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/20">
                <span className="text-blue-400 font-semibold block">Em Trial</span>
                <span className="text-xl font-bold text-white">{tenantsDistribution.trial}</span>
                <span className="text-[10px] text-zinc-500 block">{trialPercent}% da base</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
                <span className="text-amber-400 font-semibold block">Carência</span>
                <span className="text-xl font-bold text-white">{tenantsDistribution.pastDue}</span>
                <span className="text-[10px] text-zinc-500 block">{pastDuePercent}% da base</span>
              </div>

              <div className="p-3 rounded-xl bg-red-950/20 border border-red-500/20">
                <span className="text-red-400 font-semibold block">Suspensas</span>
                <span className="text-xl font-bold text-white">{tenantsDistribution.suspended}</span>
                <span className="text-[10px] text-zinc-500 block">{suspendedPercent}% da base</span>
              </div>
            </div>
          </div>

          {/* Card: Planos e Distribuição de Assinaturas */}
          <div className="glass-card p-6 border-zinc-800 space-y-6">
            <div className="border-b border-zinc-800/80 pb-3">
              <h3 className="font-bold text-white text-base">Planos & Concentração de MRR</h3>
              <p className="text-xs text-zinc-400">Distribuição comercial entre os planos cadastrados</p>
            </div>

            <div className="space-y-4">
              {planDistribution.map((plan, idx) => {
                const percentOfMrr = financial.mrr > 0
                  ? Math.round((plan.totalMrr / financial.mrr) * 100)
                  : 0

                return (
                  <div key={idx} className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-white">{plan.planName}</span>
                        <span className="text-zinc-500 ml-2">
                          (R$ {plan.monthlyPrice.toFixed(2)}/mês)
                        </span>
                      </div>
                      <span className="font-bold text-amber-400 font-mono">
                        R$ {plan.totalMrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-400">
                      <span>{plan.tenantsCount} barbearia(s) assinante(s)</span>
                      <span>{percentOfMrr}% do MRR total</span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        style={{ width: `${percentOfMrr}%` }}
                        className="bg-amber-500 h-full rounded-full transition-all"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Bloco 3: Indicadores Operacionais Agregados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card p-4 border-zinc-800 text-center">
            <p className="text-xs text-zinc-400">Agendamentos no Mês</p>
            <p className="text-2xl font-black text-white mt-1 font-outfit">
              {operations.totalAppointmentsMonth}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{operations.completedMonth} finalizados com sucesso</p>
          </div>

          <div className="glass-card p-4 border-zinc-800 text-center">
            <p className="text-xs text-zinc-400">Barbeiros Ativos na Base</p>
            <p className="text-2xl font-black text-white mt-1 font-outfit">
              {operations.totalActiveBarbers}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Profissionais parceiros</p>
          </div>

          <div className="glass-card p-4 border-zinc-800 text-center">
            <p className="text-xs text-zinc-400">Clientes Finais na Base</p>
            <p className="text-2xl font-black text-white mt-1 font-outfit">
              {operations.totalClients}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Cadastros unificados</p>
          </div>

          <div className="glass-card p-4 border-zinc-800 text-center">
            <p className="text-xs text-zinc-400">Tolerância de Carência</p>
            <p className="text-2xl font-black text-amber-400 mt-1 font-outfit">
              5 dias
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Antes da suspensão automática</p>
          </div>
        </div>

        {/* Bloco 4: Trilha de Auditoria & Observabilidade do Master */}
        <div className="pt-2">
          <AuditLogsViewer
            logs={recentAuditLogs}
            title="Trilha de Auditoria e Observabilidade Global"
            subtitle="Monitoramento em tempo real de operações críticas (gateways, fechamentos, estornos e equipe)"
          />
        </div>
      </div>
    </div>
  )
}
