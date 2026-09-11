'use client'

import { useState, useEffect, useTransition, use } from 'react'
import {
  FileSpreadsheet,
  Download,
  Lock,
  Unlock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Building2,
  FileCode,
  FolderArchive,
  RefreshCw,
  Info,
  Scale,
} from 'lucide-react'
import {
  verifyAccountantPublicAccessAction,
  downloadAccountantMonthlyPackageAction,
} from '@/app/actions/accountant-portal'

interface AccountantPortalPageProps {
  params: Promise<{ token: string }>
}

export default function AccountantPortalPage({ params }: AccountantPortalPageProps) {
  const resolvedParams = use(params)
  const token = resolvedParams.token

  const [loading, setLoading] = useState(true)
  const [accessData, setAccessData] = useState<{
    tenantName: string
    tenantDocument: string
    accountantName: string
    hasPin: boolean
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // PIN de Segurança
  const [pinInput, setPinInput] = useState('')
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [pinError, setPinError] = useState<string | null>(null)

  // Seleção de Competência
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // Download State
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null)

  useEffect(() => {
    checkAccess()
  }, [token])

  const checkAccess = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await verifyAccountantPublicAccessAction(token)
      if (res.success && res.data) {
        setAccessData(res.data)
        if (!res.data.hasPin) {
          setIsUnlocked(true)
        }
      } else {
        setErrorMsg(res.error || 'Acesso contábil inválido ou expirado')
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar portal contábil')
    } finally {
      setLoading(false)
    }
  }

  const handleUnlockWithPin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinInput.trim()) {
      setPinError('Digite o PIN de segurança fornecido pela barbearia.')
      return
    }
    // Testamos o PIN chamando um pré-download simulado ou permitindo o fluxo
    setPinError(null)
    setIsUnlocked(true)
  }

  const handleDownloadZip = async () => {
    setIsDownloading(true)
    setDownloadSuccess(null)
    setErrorMsg(null)
    setPinError(null)

    try {
      const res = await downloadAccountantMonthlyPackageAction({
        tokenUuid: token,
        pin: pinInput || undefined,
        month: selectedMonth,
        year: selectedYear,
      })

      if (res.success && res.data) {
        // Disparar download no navegador
        const byteCharacters = atob(res.data.zipBase64)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/zip' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = res.data.filename
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        setDownloadSuccess(
          `Pacote fiscal "${res.data.filename}" baixado com sucesso! (Competência ${res.data.reportSummary.periodLabel})`
        )
      } else {
        if (res.error?.includes('PIN')) {
          setPinError(res.error)
          setIsUnlocked(false)
        } else {
          setErrorMsg(res.error || 'Falha ao gerar o pacote')
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar download')
    } finally {
      setIsDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-zinc-400 text-sm">Verificando credenciais contábeis...</p>
        </div>
      </div>
    )
  }

  if (errorMsg && !accessData) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Acesso Não Autorizado</h2>
          <p className="text-sm text-zinc-400">{errorMsg}</p>
          <div className="pt-2 text-xs text-zinc-500">
            Se você é o contador responsável, solicite um novo link seguro ao proprietário da barbearia.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <FolderArchive className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white">Portal Fiscal da Contabilidade</h1>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Lei 13.352/2016
                </span>
              </div>
              <p className="text-zinc-400 text-sm mt-0.5">
                Barbearia: <strong className="text-white">{accessData?.tenantName}</strong>
                {accessData?.tenantDocument && ` (CNPJ: ${accessData.tenantDocument})`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950/60 px-3 py-2 rounded-xl border border-zinc-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Contador: <strong>{accessData?.accountantName}</strong></span>
          </div>
        </div>

        {/* FEEDBACK */}
        {downloadSuccess && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{downloadSuccess}</span>
          </div>
        )}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {/* SE REQUER PIN E ESTÁ BLOQUEADO */}
        {accessData?.hasPin && !isUnlocked ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md mx-auto text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Autenticação por PIN de Segurança</h2>
              <p className="text-xs text-zinc-400 mt-1">
                Este link possui proteção por senha. Digite o PIN fornecido pela barbearia para desbloquear o download.
              </p>
            </div>

            <form onSubmit={handleUnlockWithPin} className="space-y-4">
              <input
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="PIN de Segurança (ex: 1234)"
                className="w-full text-center text-lg tracking-widest bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 font-mono"
              />

              {pinError && <p className="text-xs text-rose-400 font-medium">{pinError}</p>}

              <button
                type="submit"
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" /> Desbloquear Acesso Fiscal
              </button>
            </form>
          </div>
        ) : (
          /* PAINEL DE DOWNLOAD DESBLOQUEADO */
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            {/* Seletor e Botão de Download */}
            <div className="md:col-span-7 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-400" />
                  Selecione a Competência Mensal
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Selecione o mês desejado para compilar o pacote contábil completo em formato .ZIP.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase">Mês</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {[
                      { m: 1, label: 'Janeiro' },
                      { m: 2, label: 'Fevereiro' },
                      { m: 3, label: 'Março' },
                      { m: 4, label: 'Abril' },
                      { m: 5, label: 'Maio' },
                      { m: 6, label: 'Junho' },
                      { m: 7, label: 'Julho' },
                      { m: 8, label: 'Agosto' },
                      { m: 9, label: 'Setembro' },
                      { m: 10, label: 'Outubro' },
                      { m: 11, label: 'Novembro' },
                      { m: 12, label: 'Dezembro' },
                    ].map((item) => (
                      <option key={item.m} value={item.m}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase">Ano</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {[2026, 2025, 2024].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  {isDownloading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Compilando Pacote Contábil (.ZIP)...
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      Baixar Pacote Fiscal Completo (.ZIP em 1 Clique)
                    </>
                  )}
                </button>
              </div>

              {/* Arquivos Contidos no Pacote */}
              <div className="border-t border-zinc-800 pt-4 space-y-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                  Arquivos inclusos no arquivo .ZIP:
                </span>
                <ul className="text-xs text-zinc-300 space-y-1.5 font-mono">
                  <li className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    01_extrato_vendas_e_recebimentos.csv
                  </li>
                  <li className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    02_demonstrativo_lei_salao_parceiro.csv
                  </li>
                  <li className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    03_recibos_rpp_e_fechamentos_caixa.csv
                  </li>
                  <li className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    04_compras_insumos_e_fornecedores.csv
                  </li>
                  <li className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-amber-400" />
                    05_nfse_abrasf_cota_salao.xml (Padrão Nacional)
                  </li>
                </ul>
              </div>
            </div>

            {/* Explicação Jurídico-Tributária para a Contabilidade */}
            <div className="md:col-span-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-400">
                <Scale className="w-5 h-5" />
                <h4 className="font-bold text-white text-sm">Normas Fiscais Aplicadas</h4>
              </div>

              <div className="text-xs text-zinc-400 space-y-3 leading-relaxed">
                <p>
                  <strong>Segregação Tributária Obrigatória:</strong> De acordo com o art. 1º-A, § 4º da Lei nº 13.352/2016,
                  a cota-parte destinada aos profissionais-parceiros (MEI) <strong>não integra</strong> a receita bruta do
                  salão de beleza.
                </p>
                <p>
                  <strong>NFS-e Exclusiva:</strong> O arquivo XML ABRASF anexo já deduz as cotas dos barbeiros e calcula
                  a escrituração da Nota Fiscal referente apenas à cota de infraestrutura retida pela empresa, impedindo
                  a bitributação e reduzindo drasticamente o imposto do Simples Nacional / Anexo III.
                </p>
                <p>
                  <strong>Recibos RPP:</strong> Os termos de Recibo a Profissional Parceiro foram consolidados com os
                  respectivos CNPJs de MEI cadastrados na plataforma.
                </p>
              </div>

              <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-500">
                Solução de Consulta Cosit nº 208/2021 | Parecer Normativo Cosit nº 01/2018 | Lei Federal nº 13.352/2016.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
