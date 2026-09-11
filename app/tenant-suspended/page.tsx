import Link from 'next/link'

export default function TenantSuspendedPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 text-center border-amber-500/20 shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto text-3xl font-black font-outfit">
          ⚠️
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Acesso Temporariamente Suspenso
          </span>
          <h1 className="text-2xl font-black text-white font-outfit mt-3">
            Barbearia Indisponível
          </h1>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            O acesso a esta barbearia está temporariamente suspenso devido a pendências administrativas ou término do período de teste.
          </p>
        </div>

        <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs text-zinc-300 text-left space-y-2">
          <p className="font-semibold text-white">Você é o proprietário desta barbearia?</p>
          <p className="text-zinc-400">
            Acesse o painel financeiro para regularizar sua assinatura e reativar o agendamento imediatamente.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/login"
            className="w-full gold-button py-3 text-sm font-bold shadow-md shadow-amber-500/20"
          >
            Acessar Painel do Proprietário
          </Link>
          <Link
            href="/"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Voltar à Página Principal do SaaS
          </Link>
        </div>
      </div>
    </div>
  )
}
