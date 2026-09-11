'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  FileSpreadsheet,
  Printer,
  ShieldCheck,
  AlertCircle,
  TrendingDown,
  Building2,
  Users,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  DollarSign,
  Download,
  Info,
  Edit3,
} from 'lucide-react'
import {
  getMonthlyFiscalReport,
  generatePartnerRPP,
  updatePartnerFiscalProfile,
  exportMonthlyFiscalReportCsv,
  listCashClosingsForRPP,
} from '@/app/actions/fiscal'
import type { MonthlyFiscalReport, PartnerRPPDocument } from '@/lib/fiscal/salao-parceiro'

export default function FiscalCompliancePage() {
  const currentDate = new Date()
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [activeTab, setActiveTab] = useState<'overview' | 'rpp' | 'guidelines'>('overview')

  const [tenantId, setTenantId] = useState<string>('')
  const [report, setReport] = useState<MonthlyFiscalReport | null>(null)
  const [closings, setClosings] = useState<Array<{
    id: string
    barberId: string
    barberName: string
    period: string
    periodStart: string
    periodEnd: string
    grossAmount: number
    commissionAmount: number
    netTransferAmount: number
    closedAt: string | null
  }>>([])

  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modal de Edição Fiscal do Barbeiro
  const [editingBarber, setEditingBarber] = useState<{
    id: string
    name: string
    taxDocument: string
    legalName: string
    contractSignedAt: string
  } | null>(null)

  // Modal de Visualização de RPP
  const [viewingRPP, setViewingRPP] = useState<PartnerRPPDocument | null>(null)
  const [rppLoading, setRppLoading] = useState(false)

  // Carregar tenant id a partir de endpoint rápido ou auth
  useEffect(() => {
    async function loadTenantAndData() {
      setLoading(true)
      try {
        const res = await fetch('/api/health')
        const data = await res.json()
        const defaultTenant = data?.tenantId || '00000000-0000-0000-0000-000000000001'
        setTenantId(defaultTenant)
        fetchReport(defaultTenant, selectedMonth, selectedYear)
        fetchClosings(defaultTenant)
      } catch {
        const fallback = '00000000-0000-0000-0000-000000000001'
        setTenantId(fallback)
        fetchReport(fallback, selectedMonth, selectedYear)
        fetchClosings(fallback)
      }
    }
    loadTenantAndData()
  }, [])

  function fetchReport(tId: string, month: number, year: number) {
    startTransition(async () => {
      setErrorMsg(null)
      const res = await getMonthlyFiscalReport(tId, month, year)
      if (res.success) {
        setReport(res.data)
      } else {
        setErrorMsg(res.message)
      }
      setLoading(false)
    })
  }

  function fetchClosings(tId: string) {
    startTransition(async () => {
      const res = await listCashClosingsForRPP(tId)
      if (res.success) {
        setClosings(res.data)
      }
    })
  }

  function handleMonthChange(newMonth: number) {
    setSelectedMonth(newMonth)
    if (tenantId) fetchReport(tenantId, newMonth, selectedYear)
  }

  function handleYearChange(newYear: number) {
    setSelectedYear(newYear)
    if (tenantId) fetchReport(tenantId, selectedMonth, newYear)
  }

  async function handleExportCsv() {
    if (!tenantId) return
    const res = await exportMonthlyFiscalReportCsv(tenantId, selectedMonth, selectedYear)
    if (res.success) {
      const blob = new Blob([res.data.csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', res.data.filename)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      setErrorMsg(res.message)
    }
  }

  async function handleViewRPP(closingId: string) {
    setRppLoading(true)
    const res = await generatePartnerRPP(closingId)
    setRppLoading(false)
    if (res.success) {
      setViewingRPP(res.data)
    } else {
      setErrorMsg(res.message)
    }
  }

  async function handleSaveFiscalProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!editingBarber) return
    setErrorMsg(null)

    const res = await updatePartnerFiscalProfile(editingBarber.id, {
      taxDocument: editingBarber.taxDocument,
      legalName: editingBarber.legalName,
      contractSignedAt: editingBarber.contractSignedAt || null,
    })

    if (res.success) {
      setSuccessMsg(`Dados fiscais de ${editingBarber.name} atualizados com sucesso!`)
      setEditingBarber(null)
      if (tenantId) fetchReport(tenantId, selectedMonth, selectedYear)
      setTimeout(() => setSuccessMsg(null), 4000)
    } else {
      setErrorMsg(res.message)
    }
  }

  const months = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-5 h-5" />
              Compliance Fiscal & Tributário
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Lei do Salão-Parceiro (Lei 13.352/2016)
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Blindagem contra bitributação no Simples Nacional e comprovação de autonomia dos profissionais parceiros.
            </p>
          </div>

          {/* Seletor de Competência & Exportações */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
              <Calendar className="w-4 h-4 text-slate-400 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(Number(e.target.value))}
                className="bg-transparent text-sm text-slate-200 px-2 py-1.5 focus:outline-none"
              >
                {months.map((m) => (
                  <option key={m.value} value={m.value} className="bg-slate-900 text-slate-200">
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className="bg-transparent text-sm text-slate-200 px-2 py-1.5 border-l border-slate-800 focus:outline-none"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y} className="bg-slate-900 text-slate-200">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleExportCsv}
              disabled={loading || !report}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-3.5 py-2 rounded-lg transition shadow-sm disabled:opacity-50"
              title="Baixar planilha formatada com UTF-8 para o contador"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Planilha Contador (.CSV)</span>
            </button>

            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-3 py-2 rounded-lg transition border border-slate-700"
              title="Imprimir ou salvar este relatório em PDF"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="bg-red-950/60 border border-red-800 text-red-300 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-950/60 border border-emerald-800 text-emerald-300 px-4 py-3 rounded-lg flex items-center gap-3 text-sm">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 4 Cards de Destaque Fiscal */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Faturamento Bruto Total</span>
              <DollarSign className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-2xl font-bold text-white">
              R$ {report?.grossRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {report?.totalAppointments ?? 0} atendimentos realizados no período
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-amber-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>(-) Cota Profissionais (Lei 13.352)</span>
              <Users className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-400">
              R$ {report?.totalPartnerQuota.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dedução legal permitida pelo Art. 1º-A, § 4º
            </p>
          </div>

          <div className="bg-slate-900/90 border border-blue-900/60 rounded-xl p-5 shadow-sm bg-gradient-to-br from-slate-900 to-blue-950/20">
            <div className="flex items-center justify-between text-blue-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>(=) Base Tributável Salão</span>
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-300">
              R$ {report?.taxableSalonBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Valor sobre o qual incide o Simples / DAS
            </p>
          </div>

          <div className="bg-slate-900/90 border border-emerald-900/60 rounded-xl p-5 shadow-sm bg-gradient-to-br from-slate-900 to-emerald-950/20">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
              <span>Economia Anti-Bitributação</span>
              <TrendingDown className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              R$ {report?.estimatedSimplesTaxSavings.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) ?? '0,00'}
            </div>
            <p className="text-xs text-emerald-500/80 mt-1">
              Economia estimada ao evitar tributação total
            </p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="border-b border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Demonstrativo por Barbeiro Parceiro
          </button>
          <button
            onClick={() => setActiveTab('rpp')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'rpp'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Recibos de Profissionais (RPP)
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'guidelines'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info className="w-4 h-4" />
            Enquadramento Legal & Orientações
          </button>
        </div>

        {/* Conteúdo Aba 1: Demonstrativo dos Parceiros */}
        {activeTab === 'overview' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <h2 className="text-base font-semibold text-white">
                Partilha e Regularização dos Barbeiros Parceiros ({report?.periodLabel})
              </h2>
              <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                {report?.partnersSummary.length ?? 0} profissionais cadastrados
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Profissional</th>
                    <th className="py-3 px-4">CNPJ MEI / CPF</th>
                    <th className="py-3 px-4">Razão Social</th>
                    <th className="py-3 px-4 text-center">Contrato</th>
                    <th className="py-3 px-4 text-right">Atendimentos</th>
                    <th className="py-3 px-4 text-right">Faturamento Bruto</th>
                    <th className="py-3 px-4 text-right text-amber-400">Cota Parceiro</th>
                    <th className="py-3 px-4 text-right text-blue-400">Cota Salão</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {report?.partnersSummary.map((partner) => (
                    <tr key={partner.barberId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-sans font-medium text-white text-sm">
                        {partner.barberName}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {partner.taxDocument ? (
                          partner.taxDocument.length === 14
                            ? partner.taxDocument.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
                            : partner.taxDocument.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
                        ) : (
                          <span className="text-red-400 font-sans italic">Não cadastrado</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-sans text-slate-300">
                        {partner.legalName || <span className="text-slate-500 italic">Pessoa Física</span>}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {partner.partnerContractSignedAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-sans text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {new Date(partner.partnerContractSignedAt).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-400 font-sans text-xs">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        {partner.appointmentsCount}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        R$ {partner.grossServicesTotal.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400 font-bold">
                        R$ {partner.partnerQuotaReceived.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-400">
                        R$ {partner.salonQuotaRetained.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {partner.isRegularized ? (
                          <span className="inline-block bg-emerald-950/70 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-sans">
                            Regularizado
                          </span>
                        ) : (
                          <span className="inline-block bg-amber-950/70 border border-amber-800 text-amber-300 px-2 py-0.5 rounded text-[11px] font-sans">
                            Ajuste Pendente
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-sans">
                        <button
                          onClick={() =>
                            setEditingBarber({
                              id: partner.barberId,
                              name: partner.barberName,
                              taxDocument: partner.taxDocument || '',
                              legalName: partner.legalName || '',
                              contractSignedAt: partner.partnerContractSignedAt || new Date().toISOString().slice(0, 10),
                            })
                          }
                          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-amber-400 transition"
                          title="Editar CNPJ e dados do contrato"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!report || report.partnersSummary.length === 0) && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                        Nenhum profissional com atendimentos registrados no mês selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conteúdo Aba 2: Emissão de RPPs */}
        {activeTab === 'rpp' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Recibos de Pagamento a Profissional Parceiro (RPP)
                </h2>
                <p className="text-xs text-slate-400">
                  Formalize a quitação de comissões por fechamento de caixa sem caracterizar vínculo empregatício.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Nº Fechamento</th>
                    <th className="py-3 px-4">Profissional</th>
                    <th className="py-3 px-4">Período</th>
                    <th className="py-3 px-4 text-right">Faturamento Bruto</th>
                    <th className="py-3 px-4 text-right text-amber-400">Cota Parceiro</th>
                    <th className="py-3 px-4 text-right">Repasse Líquido</th>
                    <th className="py-3 px-4 text-center">Data Fechamento</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {closings.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-slate-300">
                        RPP-{c.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{c.barberName}</td>
                      <td className="py-3 px-4 text-slate-400">
                        {c.periodStart} até {c.periodEnd}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        R$ {c.grossAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        R$ {c.commissionAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-400">
                        R$ {c.netTransferAmount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-400">
                        {c.closedAt ? new Date(c.closedAt).toLocaleDateString('pt-BR') : 'Aberto'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleViewRPP(c.id)}
                          className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 px-3 py-1 rounded text-xs transition"
                        >
                          Emitir / Visualizar RPP
                        </button>
                      </td>
                    </tr>
                  ))}
                  {closings.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-500">
                        Nenhum fechamento de caixa encontrado para emitir recibo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Conteúdo Aba 3: Orientações Legais da Lei 13.352 */}
        {activeTab === 'guidelines' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                Regras Essenciais da Lei do Salão-Parceiro (Lei nº 13.352/2016)
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                Orientações práticas para manter a barbearia 100% protegida contra passivos trabalhistas e autuações da Receita Federal.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
                  <FileText className="w-4 h-4" />
                  1. Contrato Escrito Homologado
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  A relação entre Salão-Parceiro e Profissional-Parceiro exige celebração de contrato de parceria por escrito, homologado pelo sindicato da categoria profissional ou na Superintendência Regional do Trabalho.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                  <Building2 className="w-4 h-4" />
                  2. Segregação no Simples Nacional
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Conforme o Art. 1º-A, § 4º, a receita auferida pelo profissional parceiro não compõe a receita bruta do salão parceiro. O imposto incide exclusivamente sobre a cota do salão (evitando bitributação).
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  3. Inexistência de Vínculo (CLT)
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  O profissional parceiro não pode estar subordinado a horários rígidos e deve emitir nota ou recolher seu próprio DAS-MEI mensal. O RPP emitido formaliza a prestação de contas civil.
                </p>
              </div>
            </div>

            <div className="bg-amber-950/30 border border-amber-800/60 p-4 rounded-lg flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
              <Info className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                <strong>Atenção Contador:</strong> A emissão da nota fiscal de serviço para o cliente final deve corresponder ao valor integral, mas para o preenchimento do PGDAS-D, o salão deve informar a segregação de receitas indicando as parcelas do profissional parceiro conforme demonstrativo desta página.
              </div>
            </div>
          </div>
        )}

        {/* Modal de Edição Fiscal do Barbeiro */}
        {editingBarber && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-semibold text-white text-base">
                  Cadastro Fiscal: {editingBarber.name}
                </h3>
                <button
                  onClick={() => setEditingBarber(null)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveFiscalProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    CNPJ do MEI ou CPF
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0001-00 ou CPF"
                    value={editingBarber.taxDocument}
                    onChange={(e) =>
                      setEditingBarber({ ...editingBarber, taxDocument: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Razão Social do MEI / Nome Empresarial
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SILVA BARBEARIA MEI"
                    value={editingBarber.legalName}
                    onChange={(e) =>
                      setEditingBarber({ ...editingBarber, legalName: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Data da Assinatura do Contrato de Parceria
                  </label>
                  <input
                    type="date"
                    value={editingBarber.contractSignedAt ? editingBarber.contractSignedAt.slice(0, 10) : ''}
                    onChange={(e) =>
                      setEditingBarber({ ...editingBarber, contractSignedAt: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingBarber(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition"
                  >
                    Salvar Dados Fiscais
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Impressão / Visualização do RPP */}
        {viewingRPP && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white text-slate-900 rounded-xl max-w-3xl w-full p-8 shadow-2xl space-y-6 my-8 print:m-0 print:p-0">
              {/* Header do RPP */}
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                    Documento Fiscal de Quitação
                  </span>
                  <h2 className="text-2xl font-black text-slate-900">
                    RECIBO DE PAGAMENTO A PROFISSIONAL-PARCEIRO (RPP)
                  </h2>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    Nº {viewingRPP.rppNumber} • Emitido em {new Date(viewingRPP.issuedAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </button>
                  <button
                    onClick={() => setViewingRPP(null)}
                    className="text-slate-500 hover:text-slate-900 p-1.5"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Qualificação das Partes */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <div className="font-bold text-slate-800 uppercase mb-1">SALÃO-PARCEIRO</div>
                  <div><strong>Razão Social:</strong> {viewingRPP.salon.name}</div>
                  <div><strong>CNPJ:</strong> {viewingRPP.salon.document}</div>
                  <div><strong>Endereço:</strong> {viewingRPP.salon.address}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-800 uppercase mb-1">PROFISSIONAL-PARCEIRO</div>
                  <div><strong>Nome:</strong> {viewingRPP.partner.name}</div>
                  <div><strong>Razão Social MEI:</strong> {viewingRPP.partner.legalName}</div>
                  <div><strong>CNPJ / CPF:</strong> {viewingRPP.partner.taxDocument}</div>
                  <div>
                    <strong>Contrato:</strong>{' '}
                    {viewingRPP.partner.contractSignedAt
                      ? `Assinado em ${new Date(viewingRPP.partner.contractSignedAt).toLocaleDateString('pt-BR')}`
                      : 'Pendente'}
                  </div>
                </div>
              </div>

              {/* Demonstrativo Financeiro */}
              <div className="space-y-2">
                <div className="font-bold text-xs uppercase text-slate-700 tracking-wider">
                  Demonstrativo da Cota-Parte do Período ({viewingRPP.periodStart} a {viewingRPP.periodEnd})
                </div>
                <table className="w-full text-xs text-left border border-slate-200">
                  <tbody className="divide-y divide-slate-200 font-mono">
                    <tr>
                      <td className="py-2 px-3 text-slate-600 font-sans">Faturamento Bruto de Serviços Realizados</td>
                      <td className="py-2 px-3 text-right font-bold">R$ {viewingRPP.financials.grossServices.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-600 font-sans">Venda de Produtos pelo Profissional</td>
                      <td className="py-2 px-3 text-right">R$ {viewingRPP.financials.grossProducts.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-slate-50">
                      <td className="py-2 px-3 text-slate-700 font-bold font-sans">Cota-Parte do Profissional-Parceiro (Lei 13.352/2016)</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-700">R$ {viewingRPP.financials.partnerQuotaTotal.toFixed(2)}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-slate-600 font-sans">(-) Dinheiro em espécie já retido diretamente na cadeira pelo profissional</td>
                      <td className="py-2 px-3 text-right text-red-600 font-bold">R$ {viewingRPP.financials.cashCollectedByBarber.toFixed(2)}</td>
                    </tr>
                    <tr className="bg-amber-50 font-bold">
                      <td className="py-2 px-3 text-amber-900 font-sans">Valor Líquido Transferido / Quitado neste Fechamento</td>
                      <td className="py-2 px-3 text-right text-amber-900">R$ {viewingRPP.financials.netTransferAmount.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Termo Legal de Ausência de Vínculo */}
              <div className="text-[11px] leading-relaxed text-slate-600 bg-slate-100 p-3.5 rounded border border-slate-200">
                <pre className="whitespace-pre-wrap font-sans">{viewingRPP.legalDeclaration}</pre>
              </div>

              {/* Assinaturas */}
              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-bold text-slate-800">{viewingRPP.salon.name}</div>
                  <div className="text-slate-500">Salão-Parceiro (CNPJ: {viewingRPP.salon.document})</div>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-bold text-slate-800">{viewingRPP.partner.name}</div>
                  <div className="text-slate-500">Profissional-Parceiro ({viewingRPP.partner.taxDocument})</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
