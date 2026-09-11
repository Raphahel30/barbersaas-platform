'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Package,
  AlertTriangle,
  Scissors,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  Layers,
  ArrowLeft,
  ShoppingBag,
  TrendingDown,
} from 'lucide-react'
import {
  saveServiceConsumablesAction,
  getServiceConsumablesAction,
  getLowStockAlertsAction,
  adjustProductStockAction,
  type ServiceConsumableDetail,
} from '@/app/actions/consumables'
import type { LowStockAlert } from '@/lib/inventory/consumables'

interface ServiceItem {
  id: string
  name: string
  price: number
}

interface ProductItem {
  id: string
  name: string
  stock_quantity: number
  min_stock_threshold: number
  unit: string | null
}

export default function FichaTecnicaEstoquePage() {
  const [tenantId, setTenantId] = useState<string>('')
  const [services, setServices] = useState<ServiceItem[]>([])
  const [products, setProducts] = useState<ProductItem[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [consumablesList, setConsumablesList] = useState<
    { productId: string; quantityConsumed: number }[]
  >([])

  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const [restockModalProduct, setRestockModalProduct] = useState<ProductItem | null>(null)
  const [restockAmount, setRestockAmount] = useState<number>(10)

  // 1. Carrega dados iniciais do tenant, serviços e produtos
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/tenant/me')
        const data = await res.json()
        const id = data?.tenantId || data?.id
        if (!id) return

        setTenantId(id)

        // Busca serviços e insumos/produtos
        const [servRes, prodRes, alertRes] = await Promise.all([
          fetch(`/api/tenant/services?tenantId=${id}`),
          fetch(`/api/tenant/products?tenantId=${id}`).catch(() => ({ json: async () => [] })),
          getLowStockAlertsAction(id),
        ])

        const servData = await servRes.json().catch(() => [])
        const prodData = await prodRes.json().catch(() => [])

        const cleanServices = Array.isArray(servData) ? servData : []
        const cleanProducts = Array.isArray(prodData) ? prodData : []

        setServices(cleanServices)
        setProducts(cleanProducts)
        if (cleanServices.length > 0) {
          setSelectedServiceId(cleanServices[0].id)
        }

        if (alertRes.success && alertRes.alerts) {
          setLowStockAlerts(alertRes.alerts)
        }
      } catch (err) {
        console.error('Falha ao inicializar ficha técnica:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // 2. Carrega ficha técnica quando o serviço selecionado mudar
  useEffect(() => {
    if (!selectedServiceId) return
    async function loadConsumables() {
      try {
        const res = await getServiceConsumablesAction(selectedServiceId)
        if (res.success && res.items) {
          setConsumablesList(
            res.items.map((it) => ({
              productId: it.productId,
              quantityConsumed: it.quantityConsumed,
            }))
          )
        } else {
          setConsumablesList([])
        }
      } catch {
        setConsumablesList([])
      }
    }
    loadConsumables()
  }, [selectedServiceId])

  const handleAddConsumableRow = () => {
    const availableProduct = products.find(
      (p) => !consumablesList.some((c) => c.productId === p.id)
    )
    if (availableProduct) {
      setConsumablesList((prev) => [
        ...prev,
        { productId: availableProduct.id, quantityConsumed: 1 },
      ])
    } else if (products.length > 0) {
      setConsumablesList((prev) => [
        ...prev,
        { productId: products[0].id, quantityConsumed: 1 },
      ])
    }
  }

  const handleRemoveConsumableRow = (index: number) => {
    setConsumablesList((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpdateRow = (
    index: number,
    field: 'productId' | 'quantityConsumed',
    value: any
  ) => {
    setConsumablesList((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSaveFichaTecnica = async () => {
    if (!selectedServiceId || !tenantId) return
    setSaving(true)
    setFeedbackMessage(null)
    try {
      const res = await saveServiceConsumablesAction(
        tenantId,
        selectedServiceId,
        consumablesList
      )
      setFeedbackMessage(res.message)
      setTimeout(() => setFeedbackMessage(null), 4000)
    } catch {
      setFeedbackMessage('Falha ao salvar ficha técnica.')
    } finally {
      setSaving(false)
    }
  }

  const handleRestockProduct = async () => {
    if (!restockModalProduct || !tenantId) return
    try {
      const newTotal = Number(restockModalProduct.stock_quantity || 0) + Number(restockAmount)
      const res = await adjustProductStockAction(tenantId, restockModalProduct.id, newTotal)
      if (res.success) {
        // Atualiza localmente
        setProducts((prev) =>
          prev.map((p) => (p.id === restockModalProduct.id ? { ...p, stock_quantity: newTotal } : p))
        )
        // Recarrega alertas
        const alertRes = await getLowStockAlertsAction(tenantId)
        if (alertRes.success) {
          setLowStockAlerts(alertRes.alerts)
        }
        setRestockModalProduct(null)
      }
    } catch (e) {
      console.error('Falha ao reabastecer:', e)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard/agenda"
                className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Agenda
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold text-white mt-2 flex items-center gap-2.5">
              <Package className="w-7 h-7 text-amber-500" />
              Ficha Técnica de Serviços & Consumo de Insumos
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Configure o que cada corte consome (lâminas, golas, pós-barba) para baixa automática de estoque a cada atendimento concluído.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              Baixa Automática Ativa
            </span>
          </div>
        </div>

        {/* ALERTA DE PONTO DE PEDIDO / ESTOQUE MÍNIMO */}
        {lowStockAlerts.length > 0 && (
          <div className="p-5 rounded-2xl bg-rose-950/40 border-2 border-rose-800/80 space-y-3">
            <div className="flex items-center gap-2.5 text-rose-300 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>Insumos em Ponto Crítico de Reposição (Estoque Mínimo Atingido)</span>
            </div>
            <p className="text-xs text-rose-200/80">
              Os seguintes itens atingiram ou estão abaixo do estoque de segurança. Providencie a compra recomendada para não interromper a operação:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {lowStockAlerts.map((alert) => (
                <div
                  key={alert.productId}
                  className="p-3.5 rounded-xl bg-zinc-900 border border-rose-800/60 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-xs text-white">{alert.productName}</h4>
                    <div className="flex items-center gap-2 mt-1 text-[11px]">
                      <span className="text-rose-400 font-bold">
                        Saldo: {alert.currentStock} {alert.unit}
                      </span>
                      <span className="text-zinc-500">• Mín: {alert.minStockThreshold}</span>
                    </div>
                    <p className="text-[10px] text-amber-400 font-semibold mt-0.5">
                      Sugestão de Compra: +{alert.suggestedPurchaseQuantity} {alert.unit}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      const prod = products.find((p) => p.id === alert.productId)
                      if (prod) {
                        setRestockModalProduct(prod)
                        setRestockAmount(alert.suggestedPurchaseQuantity)
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-500 hover:bg-rose-400 text-black text-xs font-bold rounded-lg transition"
                  >
                    Repor
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* GRADE PRINCIPAL: SELETOR DE SERVIÇO & FICHA TÉCNICA */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Esquerda: Lista de Serviços */}
          <div className="lg:col-span-1 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Scissors className="w-4 h-4 text-amber-500" />
                Catálogo de Serviços
              </h3>
              <span className="text-xs text-zinc-500">{services.length} serviços</span>
            </div>

            <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
              {services.map((svc) => {
                const isSelected = selectedServiceId === svc.id
                return (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedServiceId(svc.id)}
                    className={`w-full p-3 rounded-xl text-left transition flex items-center justify-between text-xs ${
                      isSelected
                        ? 'bg-amber-500/15 border border-amber-500 text-white font-bold'
                        : 'bg-zinc-950 border border-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                    }`}
                  >
                    <span className="truncate">{svc.name}</span>
                    <span className="font-mono text-amber-400/90 font-bold shrink-0 ml-2">
                      R$ {Number(svc.price).toFixed(2)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Coluna Direita: Editor de Ficha Técnica do Serviço Selecionado */}
          <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Ficha Técnica Operacional
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {services.find((s) => s.id === selectedServiceId)?.name || 'Selecione um serviço'}
                </h2>
              </div>

              <button
                onClick={handleAddConsumableRow}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Adicionar Insumo</span>
              </button>
            </div>

            {feedbackMessage && (
              <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            {consumablesList.length === 0 ? (
              <div className="p-10 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500 space-y-2">
                <Layers className="w-8 h-8 opacity-40 mx-auto" />
                <p className="text-xs">
                  Nenhum insumo associado a este serviço ainda. Clique em "Adicionar Insumo" acima para cadastrar (ex: 1 Lâmina descartável, 1 Gola higiênica, 10ml Loção).
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-12 gap-3 text-[11px] font-bold text-zinc-400 px-2 uppercase tracking-wider">
                  <span className="col-span-7">Insumo / Produto</span>
                  <span className="col-span-3">Qtd Consumida</span>
                  <span className="col-span-2 text-center">Ações</span>
                </div>

                {consumablesList.map((item, idx) => {
                  const productInfo = products.find((p) => p.id === item.productId)
                  return (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-3 items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800"
                    >
                      <div className="col-span-7">
                        <select
                          value={item.productId}
                          onChange={(e) => handleUpdateRow(idx, 'productId', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-500"
                        >
                          {products.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name} (Saldo: {prod.stock_quantity} {prod.unit || 'un'})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3 flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={item.quantityConsumed}
                          onChange={(e) =>
                            handleUpdateRow(idx, 'quantityConsumed', parseFloat(e.target.value) || 0)
                          }
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono text-center outline-none focus:border-amber-500"
                        />
                        <span className="text-xs text-zinc-400 shrink-0 font-medium">
                          {productInfo?.unit || 'un'}
                        </span>
                      </div>

                      <div className="col-span-2 flex justify-center">
                        <button
                          onClick={() => handleRemoveConsumableRow(idx)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                          title="Remover insumo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="pt-4 border-t border-zinc-800 flex justify-end">
              <button
                onClick={handleSaveFichaTecnica}
                disabled={saving}
                className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Salvando...' : 'Salvar Ficha Técnica'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Reabastecimento Rápido */}
      {restockModalProduct && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <h4 className="font-bold text-white text-base">Reabastecer Insumo</h4>
            <p className="text-xs text-zinc-400">
              Produto: <strong className="text-zinc-200">{restockModalProduct.name}</strong>
              <br />
              Saldo atual: {restockModalProduct.stock_quantity} {restockModalProduct.unit || 'un'}
            </p>

            <div>
              <label className="text-xs font-semibold text-zinc-400 block mb-1">
                Quantidade a Adicionar ({restockModalProduct.unit || 'un'}):
              </label>
              <input
                type="number"
                min="1"
                value={restockAmount}
                onChange={(e) => setRestockAmount(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-white font-mono text-center text-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setRestockModalProduct(null)}
                className="py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300"
              >
                Cancelar
              </button>
              <button
                onClick={handleRestockProduct}
                className="py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs"
              >
                Confirmar Entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
