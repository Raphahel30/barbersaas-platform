'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Beer,
  Coffee,
  Wine,
  Utensils,
  Plus,
  Minus,
  Trash2,
  X,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Search,
  DollarSign,
  Sparkles,
} from 'lucide-react'
import {
  getOrCreateAppointmentTabAction,
  addItemToTabAction,
  removeItemFromTabAction,
  closeTabAction,
  type TabWithItems,
} from '@/app/actions/tab'

interface DigitalTabModalProps {
  tenantId: string
  appointmentId?: string
  barberId?: string
  clientName?: string
  isOpen: boolean
  onClose: () => void
  onTabUpdated?: (totalAmount: number) => void
}

interface QuickItem {
  name: string
  icon: any
  defaultPrice: number
  color: string
}

const QUICK_SHORTCUTS: QuickItem[] = [
  { name: 'Cerveja Artesanal IPA', icon: Beer, defaultPrice: 18.0, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { name: 'Refrigerante Lata', icon: Wine, defaultPrice: 7.0, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  { name: 'Café Expresso Gourmet', icon: Coffee, defaultPrice: 6.0, color: 'text-amber-600 bg-amber-600/10 border-amber-600/20' },
  { name: 'Água Mineral', icon: Wine, defaultPrice: 5.0, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { name: 'Charuto Selecionado', icon: Sparkles, defaultPrice: 45.0, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { name: 'Mix de Castanhas / Snack', icon: Utensils, defaultPrice: 12.0, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
]

export function DigitalTabModal({
  tenantId,
  appointmentId,
  barberId,
  clientName = 'Cliente',
  isOpen,
  onClose,
  onTabUpdated,
}: DigitalTabModalProps) {
  const [tab, setTab] = useState<TabWithItems | null>(null)
  const [products, setProducts] = useState<Array<{ id: string; name: string; price: number; stock_quantity: number }>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Carrega comanda e catálogo de produtos
  useEffect(() => {
    if (!isOpen || !tenantId) return

    setLoading(true)
    setErrorMsg(null)

    async function initialize() {
      try {
        // 1. Carrega produtos disponíveis no tenant
        const prodRes = await fetch(`/api/tenant/products?tenantId=${tenantId}`)
        if (prodRes.ok) {
          const prodData = await prodRes.json()
          setProducts(prodData || [])
        }

        // 2. Se houver agendamento vinculado, busca ou cria a comanda
        if (appointmentId) {
          const tabRes = await getOrCreateAppointmentTabAction(tenantId, appointmentId, barberId)
          if (tabRes.success) {
            setTab(tabRes.data)
            if (onTabUpdated) onTabUpdated(tabRes.data.total_amount)
          } else {
            setErrorMsg(tabRes.message)
          }
        }
      } catch (err: any) {
        setErrorMsg('Falha ao conectar com o serviço de comanda.')
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [isOpen, tenantId, appointmentId, barberId])

  if (!isOpen) return null

  // Lança item na comanda (procura pelo produto no banco ou cria atalho)
  async function handleAddProduct(productName: string, fallbackPrice: number = 10) {
    if (!tab) return
    setErrorMsg(null)

    // Acha se o produto existe no catálogo do banco
    let prod = products.find((p) => p.name.toLowerCase() === productName.toLowerCase())

    // Se não encontrar exato, pega o primeiro que der match ou o primeiro do catálogo
    if (!prod && products.length > 0) {
      prod = products[0]
    }

    if (!prod) {
      setErrorMsg('Nenhum produto cadastrado no catálogo do tenant. Cadastre produtos em Estoque.')
      return
    }

    startTransition(async () => {
      const res = await addItemToTabAction(tab.id, prod!.id, 1, barberId)
      if (res.success) {
        setTab(res.data)
        setSuccessMsg(`+1 ${prod!.name} adicionado à comanda!`)
        if (onTabUpdated) onTabUpdated(res.data.total_amount)
        setTimeout(() => setSuccessMsg(null), 2500)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  // Remove item da comanda
  async function handleRemoveItem(itemId: string) {
    if (!tab) return
    setErrorMsg(null)

    startTransition(async () => {
      const res = await removeItemFromTabAction(itemId)
      if (res.success) {
        const remainingItems = tab.items.filter((item) => item.id !== itemId)
        const updated = {
          ...tab,
          total_amount: res.data.newTotal,
          items: remainingItems,
        }
        setTab(updated)
        if (onTabUpdated) onTabUpdated(res.data.newTotal)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  // Encerra comanda avulsa / direta
  async function handleCloseTab(method: string = 'cash') {
    if (!tab) return
    if (!confirm(`Deseja encerrar e quitar esta comanda no valor de R$ ${tab.total_amount.toFixed(2)}?`)) return

    startTransition(async () => {
      const res = await closeTabAction(tab.id, method)
      if (res.success) {
        alert('Comanda encerrada com sucesso!')
        onClose()
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Beer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                Comanda Digital & Bar
                {appointmentId && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Cadeira Vinculada
                  </span>
                )}
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Cliente: <span className="text-neutral-200 font-medium">{clientName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* Mensagens de Alerta */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Atalhos Rápidos de Bar & Conveniência */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2.5">
              Lançamento Rápido de 1 Toque
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {QUICK_SHORTCUTS.map((item, idx) => {
                const IconComponent = item.icon
                return (
                  <button
                    key={idx}
                    onClick={() => handleAddProduct(item.name, item.defaultPrice)}
                    disabled={isPending || loading}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${item.color}`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold text-neutral-200 truncate">{item.name}</div>
                      <div className="text-[11px] opacity-75 font-mono">
                        R$ {item.defaultPrice.toFixed(2)}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Busca de Produtos do Catálogo */}
          <div>
            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar outros produtos no estoque..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {searchQuery.trim() && (
              <div className="max-h-36 overflow-y-auto divide-y divide-neutral-800/60 border border-neutral-800 rounded-xl bg-neutral-950">
                {filteredProducts.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2.5 hover:bg-neutral-900 transition-colors"
                  >
                    <div>
                      <div className="text-xs font-medium text-neutral-200">{p.name}</div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        R$ {Number(p.price).toFixed(2)} • Estoque: {p.stock_quantity ?? 'ilimitado'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddProduct(p.name, Number(p.price))}
                      disabled={isPending}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-3 text-center text-xs text-neutral-500">
                    Nenhum produto encontrado.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Itens Atuais na Comanda */}
          <div className="border border-neutral-800 rounded-xl bg-neutral-950/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Receipt className="w-3.5 h-3.5 text-amber-400" />
                Itens Consumidos ({tab?.items?.length || 0})
              </span>
              <span className="text-xs font-bold text-amber-400 font-mono">
                Total Bar: R$ {tab?.total_amount ? tab.total_amount.toFixed(2) : '0,00'}
              </span>
            </div>

            <div className="divide-y divide-neutral-800/60 max-h-48 overflow-y-auto">
              {tab?.items?.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex-1 pr-2">
                    <div className="text-neutral-200 font-medium">{item.product_name}</div>
                    <div className="text-neutral-400 text-[11px] font-mono">
                      {item.quantity}x R$ {Number(item.unit_price).toFixed(2)} = R${' '}
                      {Number(item.total_price).toFixed(2)}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={isPending}
                    className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                    title="Remover item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {(!tab?.items || tab.items.length === 0) && (
                <div className="py-6 text-center text-xs text-neutral-500">
                  Nenhum item lançado na comanda até o momento.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-neutral-500 uppercase tracking-wider">Subtotal Consumo</div>
            <div className="text-xl font-bold text-amber-400 font-mono">
              R$ {tab?.total_amount ? tab.total_amount.toFixed(2) : '0,00'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-xl font-medium transition-colors"
            >
              Fechar Janela
            </button>

            {!appointmentId && tab && tab.items.length > 0 && (
              <button
                onClick={() => handleCloseTab('cash')}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs rounded-xl font-bold transition-colors"
              >
                Cobrar no Balcão
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
