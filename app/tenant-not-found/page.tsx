import Link from 'next/link'

export default function TenantNotFoundPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full glass-card p-8 text-center border-zinc-800 shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 flex items-center justify-center mx-auto text-3xl font-black font-outfit">
          🔍
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            Endereço Não Encontrado
          </span>
          <h1 className="text-2xl font-black text-white font-outfit mt-3">
            Barbearia Não Localizada
          </h1>
          <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
            Não encontramos nenhuma barbearia ativa vinculada a este endereço web ou subdomínio.
          </p>
        </div>

        <div className="p-4 bg-zinc-900/90 rounded-xl border border-zinc-800 text-xs text-zinc-400 text-left space-y-1">
          <p className="font-semibold text-zinc-200">Possíveis motivos:</p>
          <ul className="list-disc list-inside space-y-1 mt-1 text-zinc-400">
            <li>O link digitado pode conter algum erro de digitação.</li>
            <li>O apontamento DNS do domínio customizado ainda está propagando.</li>
            <li>A barbearia alterou o endereço ou foi desativada.</li>
          </ul>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full gold-button py-3 text-sm font-bold shadow-md shadow-amber-500/20"
          >
            Ir para a Página Principal
          </Link>
          <Link
            href="/login"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Já tem uma conta? Fazer Login
          </Link>
        </div>
      </div>
    </div>
  )
}
