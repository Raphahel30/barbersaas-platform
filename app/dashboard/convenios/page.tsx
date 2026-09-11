'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Building2,
  Tag,
  Users,
  DollarSign,
  Plus,
  Copy,
  Check,
  Receipt,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Briefcase,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import {
  listCorporateAgreementsAction,
  upsertCorporateAgreementAction,
  generateCorporateMonthlyInvoiceAction,
  type AgreementWithStats,
} from '@/app/actions/corporate-perks'

export default function CorporateAgreementsPage() {
  const [agreements, setAgreements] = useState<AgreementWithStats[]>([])
  const [tenantId, setTenantId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modal de Cadastro/Edição
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAgreement, setEditingAgreement] = useState<{
    id?: string
    companyName: string
    cnpj: string
    contactName: string
    contactEmail: string
    contactPhone: string
    couponCode: string
    discountPercentage: number
    billingType: 'direct_discount' | 'postpaid_monthly'
    notes: string
  }>({
    companyName: '',
    cnpj: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    couponCode: '',
    discountPercentage: 15,
    billingType: 'direct_discount',
    notes: '',
  })

  // Carrega tenantId da sessão e lista convênios
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/tenant/me')
        if (res.ok) {
          const data = await res.json()
          setTenantId(data.id)
          loadAgreements(data.id)
        }
      } catch {
        setErrorMsg('Falha ao autenticar sessão da barbearia.')
        setLoading(false)
      }
    }
    init()
  }, [])

  function loadAgreements(tid: string) {
    setLoading(true)
    startTransition(async () => {
      const res = await listCorporateAgreementsAction(tid)
      if (res.success) {
        setAgreements(res.data)
      } else {
        setErrorMsg(res.message)
      }
      setLoading(false)
    })
  }

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCoupon(code)
    setTimeout(() => setCopiedCoupon(null), 2000)
  }

  const handleSaveAgreement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId) return

    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await upsertCorporateAgreementAction({
        tenantId,
        agreementId: editingAgreement.id,
        companyName: editingAgreement.companyName,
        cnpj: editingAgreement.cnpj,
        contactName: editingAgreement.contactName,
        contactEmail: editingAgreement.contactEmail,
        contactPhone: editingAgreement.contactPhone,
        couponCode: editingAgreement.couponCode,
        discountPercentage: Number(editingAgreement.discountPercentage),
        billingType: editingAgreement.billingType,
        notes: editingAgreement.notes,
      })

      if (res.success) {
        setSuccessMsg('Convênio corporativo salvo com sucesso!')
        setIsModalOpen(false)
        loadAgreements(tenantId)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  const handleGenerateInvoice = async (agreementId: string, companyName: string) => {
    if (!confirm(`Deseja fechar a fatura mensal consolidada de cortes para ${companyName}?`)) return

    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await generateCorporateMonthlyInvoiceAction(agreementId)
      if (res.success) {
        setSuccessMsg(
          `Fatura Asaas B2B emitida com sucesso! Valor total: R$ ${res.data.totalBilled.toFixed(2)} (${res.data.billedUsagesCount} cortes faturados).`
        )
        if (tenantId) loadAgreements(tenantId)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  // Totais para os KPIs
  const totalAgreements = agreements.length
  const totalCorporateCuts = agreements.reduce((acc, curr) => acc + curr.usagesCount, 0)
  const totalUnbilled = agreements
    .filter((a) => a.billing_type === 'postpaid_monthly')
    .reduce((acc, curr) => acc + curr.unbilledAmount, 0)

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-neutral-800 pb-6 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Convênios B2B & Parcerias</h1>
              <p className="text-neutral-400 text-sm mt-0.5">
                Acordos corporativos com empresas locais, cupons de desconto para colaboradores e faturamento pós-pago.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditingAgreement({
              companyName: '',
              cnpj: '',
              contactName: '',
              contactEmail: '',
              contactPhone: '',
              couponCode: '',
              discountPercentage: 15,
              billingType: 'direct_discount',
              notes: '',
            })
            setIsModalOpen(true)
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/10"
        >
          <Plus className="w-4 h-4" /> Novo Convênio Corporativo
        </button>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Alertas */}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Cards de Métricas B2B */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Empresas Conveniadas</span>
              <Briefcase className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-100">{totalAgreements}</div>
            <div className="text-xs text-neutral-500 mt-1">Parcerias ativas na base</div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Cortes Corporativos</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-neutral-100">{totalCorporateCuts}</div>
            <div className="text-xs text-neutral-500 mt-1">Colaboradores atendidos</div>
          </div>

          <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">A Faturar (Pós-Pago B2B)</span>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-purple-400">
              R$ {totalUnbilled.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-neutral-500 mt-1">Saldo acumulado para emissão de fatura</div>
          </div>
        </div>

        {/* Tabela de Convênios */}
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-neutral-800 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-400" />
                Empresas & Entidades Conveniadas
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Gerencie cupons, percentuais de benefício e modelos de faturamento corporativo.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-950/60 text-neutral-400 text-xs uppercase border-b border-neutral-800">
                <tr>
                  <th className="py-3.5 px-4">Empresa / CNPJ</th>
                  <th className="py-3.5 px-4 text-center">Cupom Corporativo</th>
                  <th className="py-3.5 px-4 text-center">Desconto</th>
                  <th className="py-3.5 px-4">Modalidade de Cobrança</th>
                  <th className="py-3.5 px-4 text-center">Utilizações</th>
                  <th className="py-3.5 px-4 text-right">Saldo Pendente</th>
                  <th className="py-3.5 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60 text-neutral-200">
                {agreements.map((agreement) => (
                  <tr key={agreement.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-neutral-100">{agreement.company_name}</div>
                      <div className="text-xs text-neutral-400 font-mono">{agreement.cnpj}</div>
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleCopyCoupon(agreement.coupon_code)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-bold text-amber-400 border border-neutral-700 transition-colors"
                        title="Copiar cupom"
                      >
                        {copiedCoupon === agreement.coupon_code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{agreement.coupon_code}</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-4 px-4 text-center font-bold text-emerald-400 whitespace-nowrap">
                      {agreement.discount_percentage}%
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      {agreement.billing_type === 'direct_discount' ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                          Desconto Direto (PWA)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                          Faturamento Pós-Pago B2B
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <span className="font-semibold">{agreement.usagesCount}</span> colaboradores
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold whitespace-nowrap">
                      {agreement.billing_type === 'postpaid_monthly' ? (
                        <span className={agreement.unbilledAmount > 0 ? 'text-amber-400' : 'text-neutral-500'}>
                          R$ {agreement.unbilledAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {agreement.billing_type === 'postpaid_monthly' && agreement.unbilledAmount > 0 && (
                          <button
                            onClick={() => handleGenerateInvoice(agreement.id, agreement.company_name)}
                            disabled={isPending}
                            className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            title="Emitir fatura consolidada Asaas"
                          >
                            <Receipt className="w-3.5 h-3.5" /> Faturar
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditingAgreement({
                              id: agreement.id,
                              companyName: agreement.company_name,
                              cnpj: agreement.cnpj,
                              contactName: agreement.contact_name || '',
                              contactEmail: agreement.contact_email,
                              contactPhone: agreement.contact_phone || '',
                              couponCode: agreement.coupon_code,
                              discountPercentage: Number(agreement.discount_percentage),
                              billingType: agreement.billing_type,
                              notes: agreement.notes || '',
                            })
                            setIsModalOpen(true)
                          }}
                          className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-lg font-medium transition-colors"
                        >
                          Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {agreements.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-500">
                      Nenhum convênio corporativo cadastrado ainda. Clique em &quot;Novo Convênio Corporativo&quot; acima para começar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Cadastro/Edição de Convênio */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-400" />
                {editingAgreement.id ? 'Editar Convênio Corporativo' : 'Novo Convênio Corporativo B2B'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-neutral-200 text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAgreement} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Razão Social / Nome da Empresa *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Google Brasil Internet Ltda"
                    value={editingAgreement.companyName}
                    onChange={(e) => setEditingAgreement({ ...editingAgreement, companyName: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">CNPJ *</label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0000-00"
                    value={editingAgreement.cnpj}
                    onChange={(e) => setEditingAgreement({ ...editingAgreement, cnpj: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Código do Cupom *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: GOOGLE15"
                    value={editingAgreement.couponCode}
                    onChange={(e) =>
                      setEditingAgreement({
                        ...editingAgreement,
                        couponCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''),
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-blue-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">E-mail de Contato / RH *</label>
                  <input
                    type="email"
                    required
                    placeholder="rh@empresa.com.br"
                    value={editingAgreement.contactEmail}
                    onChange={(e) => setEditingAgreement({ ...editingAgreement, contactEmail: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">% de Desconto</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={editingAgreement.discountPercentage}
                    onChange={(e) =>
                      setEditingAgreement({ ...editingAgreement, discountPercentage: Number(e.target.value) })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">Modalidade de Faturamento *</label>
                  <select
                    value={editingAgreement.billingType}
                    onChange={(e) =>
                      setEditingAgreement({
                        ...editingAgreement,
                        billingType: e.target.value as 'direct_discount' | 'postpaid_monthly',
                      })
                    }
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="direct_discount">
                      Desconto Direto no PWA (Colaborador paga com desconto no balcão/app)
                    </option>
                    <option value="postpaid_monthly">
                      Faturamento Pós-Pago Mensal (Empresa paga fatura consolidada no final do mês)
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs text-neutral-300 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs text-white font-bold transition-colors"
                >
                  Salvar Convênio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
