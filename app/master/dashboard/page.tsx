import { requireSuperAdmin } from '@/lib/auth/guards'
import { getMasterCrmStats } from '@/app/actions/saas'
import Link from 'next/link'

export default async function MasterDashboardPage() {
  await requireSuperAdmin()
  const { metrics, tenants, plans } = await getMasterCrmStats()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Topo / Header do Master */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
                Acesso Master Isolado
              </span>
              <span className="text-xs text-zinc-500">rafaelcassu@gmail.com</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
              Painel Geral de Controle do SaaS
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/master/analytics"
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-xs sm:text-sm font-semibold hover:bg-zinc-800 text-zinc-200"
            >
              📊 Métricas & Analytics
            </Link>
            <Link
              href="/master/builder"
              className="gold-button text-xs sm:text-sm px-4 py-2.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              SaaS Builder No-Code
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs sm:text-sm font-semibold text-zinc-400 hover:text-white px-3 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-900"
              >
                Sair
              </button>
            </form>
          </div>
        </div>

        {/* Métricas / KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div className="glass-card p-5 border-zinc-800">
            <p className="text-xs text-zinc-400 font-medium">Total de Barbearias</p>
            <p className="text-3xl font-extrabold text-white mt-1 font-outfit">
              {metrics.totalTenants}
            </p>
            <p className="text-[11px] text-zinc-500 mt-1">
              {metrics.multiBranchCount} com multi-filiais ativas
            </p>
          </div>

          <div className="glass-card p-5 border-emerald-500/20 bg-emerald-950/10">
            <p className="text-xs text-emerald-400 font-medium">Assinaturas Ativas</p>
            <p className="text-3xl font-extrabold text-emerald-300 mt-1 font-outfit">
              {metrics.activeTenants}
            </p>
            <p className="text-[11px] text-emerald-500/80 mt-1">Adimplência confirmada</p>
          </div>

          <div className="glass-card p-5 border-amber-500/20 bg-amber-950/10">
            <p className="text-xs text-amber-400 font-medium">Em Carência / Trial</p>
            <p className="text-3xl font-extrabold text-amber-300 mt-1 font-outfit">
              {metrics.trialTenants + metrics.pastDueTenants}
            </p>
            <p className="text-[11px] text-amber-500/80 mt-1">
              {metrics.pastDueTenants} aguardando regularização
            </p>
          </div>

          <div className="glass-card p-5 border-blue-500/20 bg-blue-950/10">
            <p className="text-xs text-blue-400 font-medium">Clientes Cadastrados</p>
            <p className="text-3xl font-extrabold text-blue-300 mt-1 font-outfit">
              {metrics.totalClients}
            </p>
            <p className="text-[11px] text-blue-500/80 mt-1">Na base consolidada</p>
          </div>
        </div>

        {/* Tabela de Barbearias Cadastradas */}
        <div className="glass-card overflow-hidden border-zinc-800">
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Barbearias na Plataforma</h2>
              <p className="text-xs text-zinc-400">Listagem de clientes corporativos e status de funcionamento</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-zinc-400 uppercase tracking-wider font-semibold border-b border-zinc-800">
                <tr>
                  <th className="p-4">Barbearia / Slug</th>
                  <th className="p-4">Domínio Personalizado</th>
                  <th className="p-4">Plano</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Criado em</th>
                  <th className="p-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-zinc-500">
                      Nenhuma barbearia cadastrada no momento.
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const planName = (t.plans as { name: string } | null)?.name || 'Sem plano'
                    return (
                      <tr key={t.id} className="hover:bg-zinc-900/40 transition-colors">
                        <td className="p-4">
                          <p className="font-bold text-zinc-100">{t.name}</p>
                          <p className="text-zinc-500 text-[11px]">/{t.slug}</p>
                        </td>
                        <td className="p-4">
                          {t.custom_domain ? (
                            <span className="font-mono text-amber-400 text-[11px]">{t.custom_domain}</span>
                          ) : (
                            <span className="text-zinc-600">—</span>
                          )}
                        </td>
                        <td className="p-4 font-medium">{planName}</td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              t.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : t.status === 'trial'
                                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                  : t.status === 'past_due'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>
                        <td className="p-4 text-zinc-400">
                          {new Date(t.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="p-4 text-right">
                          <a
                            href={`/${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-amber-400 hover:text-amber-300 font-semibold text-xs inline-flex items-center gap-1"
                          >
                            Abrir Site ↗
                          </a>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
