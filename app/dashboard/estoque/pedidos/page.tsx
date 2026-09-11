'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Truck,
  Plus,
  Send,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  Printer,
  Package,
  Phone,
  Trash2,
  ExternalLink,
  Info,
} from 'lucide-react'
import {
  listSuppliers,
  createOrUpdateSupplier,
  deleteSupplier,
  generateAutomatedRestockOrder,
  generateWhatsAppOrderDispatch,
  markOrderAsReceived,
  listPurchaseOrders,
  type SupplierRow,
  type PurchaseOrderRow,
  type PurchaseOrderItem,
} from '@/app/actions/purchase-orders'

export default function PurchaseOrdersPage() {
  const [tenantId, setTenantId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'orders' | 'suppliers'>('orders')

  const [orders, setOrders] = useState<PurchaseOrderRow[]>([])
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Modal Novo Fornecedor
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    contactName: '',
    phone: '',
    whatsapp: '',
    email: '',
    catalogNotes: '',
    leadTimeDays: 3,
  })

  // Modal Visualizar / Imprimir Pedido
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrderRow | null>(null)

  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const res = await fetch('/api/health')
        const data = await res.json()
        const defaultTenant = data?.tenantId || '00000000-0000-0000-0000-000000000001'
        setTenantId(defaultTenant)
        loadData(defaultTenant)
      } catch {
        const fallback = '00000000-0000-0000-0000-000000000001'
        setTenantId(fallback)
        loadData(fallback)
      }
    }
    init()
  }, [])

  function loadData(tId: string) {
    startTransition(async () => {
      const [ordersRes, suppliersRes] = await Promise.all([
        listPurchaseOrders(tId),
        listSuppliers(tId),
      ])
      if (ordersRes.success) setOrders(ordersRes.data)
      if (suppliersRes.success) setSuppliers(suppliersRes.data)
      setLoading(false)
    })
  }

  async function handleGenerateAutomatedRestock() {
    if (!tenantId) return
    setFeedbackMsg(null)

    const res = await generateAutomatedRestockOrder(tenantId)
    if (res.success) {
      setFeedbackMsg({
        type: 'success',
        text: `Ordem de reposição ${res.data.order_number} gerada com sucesso!`,
      })
      loadData(tenantId)
    } else {
      setFeedbackMsg({ type: 'error', text: res.message })
    }
  }

  async function handleSendWhatsApp(orderId: string) {
    const res = await generateWhatsAppOrderDispatch(orderId)
    if (res.success) {
      window.open(res.data.whatsappUrl, '_blank')
      if (tenantId) loadData(tenantId)
    } else {
      setFeedbackMsg({ type: 'error', text: res.message })
    }
  }

  async function handleConfirmDelivery(orderId: string) {
    if (!confirm('Deseja confirmar o recebimento desta entrega? O estoque físico dos itens será incrementado automaticamente.')) {
      return
    }

    const res = await markOrderAsReceived(orderId)
    if (res.success) {
      setFeedbackMsg({
        type: 'success',
        text: `Entrega confirmada! ${res.data.updatedCount} itens tiveram o estoque físico atualizado.`,
      })
      if (tenantId) loadData(tenantId)
    } else {
      setFeedbackMsg({ type: 'error', text: res.message })
    }
  }

  async function handleSaveSupplier(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return

    const res = await createOrUpdateSupplier({
      tenantId,
      name: supplierForm.name,
      contactName: supplierForm.contactName,
      phone: supplierForm.phone,
      whatsapp: supplierForm.whatsapp,
      email: supplierForm.email,
      catalogNotes: supplierForm.catalogNotes,
      leadTimeDays: Number(supplierForm.leadTimeDays) || 3,
    })

    if (res.success) {
      setFeedbackMsg({ type: 'success', text: `Fornecedor ${res.data.name} cadastrado com sucesso!` })
      setIsSupplierModalOpen(false)
      setSupplierForm({
        name: '',
        contactName: '',
        phone: '',
        whatsapp: '',
        email: '',
        catalogNotes: '',
        leadTimeDays: 3,
      })
      loadData(tenantId)
    } else {
      setFeedbackMsg({ type: 'error', text: res.message })
    }
  }

  async function handleDeleteSupplier(supplierId: string) {
    if (!confirm('Excluir este fornecedor?')) return
    const res = await deleteSupplier(tenantId, supplierId)
    if (res.success) {
      loadData(tenantId)
    } else {
      setFeedbackMsg({ type: 'error', text: res.message })
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2 text-amber-500 text-sm font-semibold uppercase tracking-wider mb-1">
              <Truck className="w-5 h-5" />
              Gestão de Fornecedores & Ordens de Compra
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Reposição Automatizada de Insumos
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Geração de pedidos com base no ponto de reposição crítico e disparo rápido via WhatsApp para representantes.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleGenerateAutomatedRestock}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs md:text-sm transition shadow-sm"
            >
              <Package className="w-4 h-4" />
              ⚡ Gerar Pedido por Ponto de Reposição
            </button>

            <button
              onClick={() => setIsSupplierModalOpen(true)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-3.5 py-2 rounded-lg text-xs md:text-sm transition"
            >
              <Plus className="w-4 h-4" />
              Novo Fornecedor
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {feedbackMsg && (
          <div
            className={`p-4 rounded-lg text-sm flex items-center gap-3 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-950/70 border border-emerald-800 text-emerald-300'
                : 'bg-red-950/70 border border-red-800 text-red-300'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        {/* Abas */}
        <div className="border-b border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('orders')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Ordens de Compra ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('suppliers')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
              activeTab === 'suppliers'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            Distribuidores Cadastrados ({suppliers.length})
          </button>
        </div>

        {/* Aba 1: Ordens de Compra */}
        {activeTab === 'orders' && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Nº Pedido</th>
                    <th className="py-3 px-4">Itens Solicitados</th>
                    <th className="py-3 px-4 text-right">Custo Estimado</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Data de Emissão</th>
                    <th className="py-3 px-4 text-center">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {orders.map((order) => {
                    const items = (order.items as unknown as PurchaseOrderItem[]) || []
                    return (
                      <tr key={order.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          {order.order_number}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-200">{items.length} itens</span>
                          <p className="text-[11px] text-slate-400 truncate max-w-xs">
                            {items.map((i) => `${i.suggestedQuantity}x ${i.productName}`).join(', ')}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-slate-100">
                          R$ {order.total_estimated_cost.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {order.status === 'draft' && (
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
                              Rascunho
                            </span>
                          )}
                          {order.status === 'sent' && (
                            <span className="bg-blue-950 border border-blue-800 text-blue-300 px-2 py-0.5 rounded text-[11px]">
                              Enviado ao Distribuidor
                            </span>
                          )}
                          {order.status === 'received' && (
                            <span className="bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-bold">
                              Recebido & Baixado
                            </span>
                          )}
                          {order.status === 'cancelled' && (
                            <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded text-[11px]">
                              Cancelado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">
                          {new Date(order.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-center space-x-2">
                          <button
                            onClick={() => handleSendWhatsApp(order.id)}
                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-600/40 px-2.5 py-1 rounded text-xs transition inline-flex items-center gap-1"
                            title="Disparar pedido pronto para o representante via WhatsApp"
                          >
                            <Send className="w-3 h-3" />
                            WhatsApp
                          </button>

                          {order.status !== 'received' && (
                            <button
                              onClick={() => handleConfirmDelivery(order.id)}
                              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 px-2.5 py-1 rounded text-xs transition inline-flex items-center gap-1"
                              title="Dar entrada dos itens no estoque físico"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Confirmar Entrada
                            </button>
                          )}

                          <button
                            onClick={() => setViewingOrder(order)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded text-xs transition inline-flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" />
                            PDF / Imprimir
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhuma ordem de compra registrada. Clique no botão acima para gerar a reposição dos itens críticos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Aba 2: Distribuidores */}
        {activeTab === 'suppliers' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((s) => (
              <div
                key={s.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 relative group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-base">{s.name}</h3>
                    <p className="text-xs text-amber-400 font-medium">
                      Representante: {s.contact_name || 'Geral'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSupplier(s.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                    title="Excluir distribuidor"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="text-xs text-slate-300 space-y-1 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>WhatsApp: {s.whatsapp}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Prazo médio de entrega: {s.lead_time_days} dias</span>
                  </div>
                  {s.catalog_notes && (
                    <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800 mt-1">
                      Catálogo: {s.catalog_notes}
                    </p>
                  )}
                </div>

                <a
                  href={`https://wa.me/55${s.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-600/30 font-semibold py-2 px-3 rounded-lg text-xs transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  Conversar no WhatsApp
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </a>
              </div>
            ))}
            {suppliers.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                Nenhum distribuidor cadastrado. Clique em "Novo Fornecedor" para cadastrar sua rede de suprimentos.
              </div>
            )}
          </div>
        )}

        {/* Modal Cadastrar Fornecedor */}
        {isSupplierModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="font-bold text-white text-base">Cadastrar Distribuidor / Fornecedor</h3>
                <button
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="text-slate-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Nome da Distribuidora / Empresa *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Distribuidora Barber Premium"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Representante Comercial
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Marcos Souza"
                      value={supplierForm.contactName}
                      onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      WhatsApp (com DDD) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="11999998888"
                      value={supplierForm.whatsapp}
                      onChange={(e) => setSupplierForm({ ...supplierForm, whatsapp: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Prazo de Entrega (dias)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={supplierForm.leadTimeDays}
                      onChange={(e) => setSupplierForm({ ...supplierForm, leadTimeDays: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      E-mail (opcional)
                    </label>
                    <input
                      type="email"
                      placeholder="pedidos@distribuidora.com"
                      value={supplierForm.email}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Produtos Fornecidos / Notas de Catálogo
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Pomadas, lâminas, golas higiênicas, pós-barba..."
                    value={supplierForm.catalogNotes}
                    onChange={(e) => setSupplierForm({ ...supplierForm, catalogNotes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition"
                  >
                    Salvar Fornecedor
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Impressão / PDF da Ordem de Compra */}
        {viewingOrder && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white text-slate-900 rounded-xl max-w-2xl w-full p-8 shadow-2xl space-y-6 my-8 print:m-0 print:p-0">
              <div className="flex justify-between items-start border-b border-slate-300 pb-4">
                <div>
                  <span className="text-xs uppercase tracking-widest text-slate-500 font-semibold">
                    Documento de Fornecimento
                  </span>
                  <h2 className="text-2xl font-black text-slate-900">
                    ORDEM DE COMPRA E REPOSIÇÃO
                  </h2>
                  <p className="text-xs text-slate-600 font-mono mt-0.5">
                    Nº {viewingOrder.order_number} • Emitido em {new Date(viewingOrder.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-slate-800"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir / PDF
                  </button>
                  <button
                    onClick={() => setViewingOrder(null)}
                    className="text-slate-500 hover:text-slate-900 p-1.5"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p><strong>Observações da Ordem:</strong> {viewingOrder.notes || 'Reposição periódica de insumos.'}</p>
                <p><strong>Status Atual:</strong> {viewingOrder.status.toUpperCase()}</p>
              </div>

              <div className="space-y-2">
                <div className="font-bold text-xs uppercase text-slate-700 tracking-wider">
                  Itens Solicitados
                </div>
                <table className="w-full text-xs text-left border border-slate-200">
                  <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                    <tr>
                      <th className="py-2 px-3">Item / Insumo</th>
                      <th className="py-2 px-3 text-center">Qtd Solicitada</th>
                      <th className="py-2 px-3 text-right">Custo Unit. Estimado</th>
                      <th className="py-2 px-3 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono">
                    {((viewingOrder.items as unknown as PurchaseOrderItem[]) || []).map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-sans font-medium text-slate-800">{item.productName}</td>
                        <td className="py-2 px-3 text-center font-bold">{item.suggestedQuantity} un</td>
                        <td className="py-2 px-3 text-right">R$ {item.unitCost.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right font-bold">
                          R$ {(item.suggestedQuantity * item.unitCost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-bold">
                      <td colSpan={3} className="py-2.5 px-3 text-right font-sans uppercase">Total Estimado do Pedido:</td>
                      <td className="py-2.5 px-3 text-right text-emerald-800">
                        R$ {viewingOrder.total_estimated_cost.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-bold text-slate-800">Responsável pelo Pedido</div>
                  <div className="text-slate-500">Barbearia / Comprador</div>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-bold text-slate-800">Aceite da Distribuidora</div>
                  <div className="text-slate-500">Representante Comercial</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
