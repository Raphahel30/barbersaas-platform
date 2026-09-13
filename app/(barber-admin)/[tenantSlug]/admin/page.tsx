'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams, useSearchParams } from 'next/navigation'
import {
  Calendar as CalendarIcon,
  Scissors,
  Users,
  DollarSign,
  Beer,
  Palette,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  QrCode,
  ExternalLink,
  Shield,
  Star,
  Settings,
  X,
  Sparkles,
  RefreshCw,
  LogOut,
  ChevronRight,
  Filter,
  Crown,
  UserCheck,
  Phone,
  MessageCircle,
  Gift,
  Tag,
  Trash2,
  Lock,
  Percent,
} from 'lucide-react'
import {
  getBarberAdminData,
  createWalkInAppointment,
  updateAppointmentStatus,
  saveService,
  deleteService,
  addItemToTab,
  closeTab,
  saveProduct,
  deleteProduct,
  blockScheduleSlot,
  updateStoreSettings,
  type BarberAdminData,
} from '@/app/actions/barber-admin'
import {
  getMonthlySubscribers,
  createMonthlySubscriber,
  renewMonthlyCycle,
  pauseOrCancelSubscription,
  consumeSubscriberCut,
  type MonthlySubscriber,
} from '@/app/actions/monthly-club'
import {
  getCRMClientList,
  type CRMClient,
} from '@/app/actions/crm'

type ActiveModule =
  | 'agenda'
  | 'mensalistas'
  | 'crm'
  | 'servicos'
  | 'comanda'
  | 'fidelidade'
  | 'financeiro'
  | 'equipe'
  | 'personalizacao'

export default function BarberAdminPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const tenantSlug = (params.tenantSlug as string) || 'barbearia'

  const [activeTab, setActiveTab] = useState<ActiveModule>('agenda')
  const [data, setData] = useState<BarberAdminData | null>(null)
  const [subscribers, setSubscribers] = useState<MonthlySubscriber[]>([])
  const [crmClients, setCrmClients] = useState<CRMClient[]>([])
  const [crmSearch, setCrmSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modais
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false)
  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [isProductModalOpen, setIsProductModalOpen] = useState(false)
  const [isSubscriberModalOpen, setIsSubscriberModalOpen] = useState(false)

  // Formulário Walk-In
  const [walkInClientName, setWalkInClientName] = useState('')
  const [walkInClientPhone, setWalkInClientPhone] = useState('')
  const [walkInServicePrice, setWalkInServicePrice] = useState(45)
  const [walkInBarberId, setWalkInBarberId] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('PIX')

  // Formulário Bloqueio de Horário
  const [blockBarberId, setBlockBarberId] = useState('')
  const [blockDate, setBlockDate] = useState(new Date().toISOString().split('T')[0])
  const [blockStartTime, setBlockStartTime] = useState('12:00')
  const [blockEndTime, setBlockEndTime] = useState('13:00')
  const [blockReason, setBlockReason] = useState('Almoço / Intervalo')

  // Formulário Serviço
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState(50)
  const [serviceDuration, setServiceDuration] = useState(35)
  const [serviceFee, setServiceFee] = useState(15)

  // Formulário Produto
  const [productName, setProductName] = useState('')
  const [productPrice, setProductPrice] = useState(15)
  const [productStock, setProductStock] = useState(20)

  // Formulário Mensalista
  const [subClientName, setSubClientName] = useState('')
  const [subClientPhone, setSubClientPhone] = useState('')
  const [subPlanName, setSubPlanName] = useState('Plano VIP 4 Cortes')
  const [subCutsIncluded, setSubCutsIncluded] = useState(4)
  const [subPriceMonthly, setSubPriceMonthly] = useState(120)

  // Formulário Personalização
  const [theme, setTheme] = useState('navalio-dark-gold')
  const [instagram, setInstagram] = useState('@navaliobarber')
  const [whatsappMsg, setWhatsappMsg] = useState('Olá! Seu corte está confirmado no Navalio.')

  // Carregar todos os dados
  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [adminRes, subRes, crmRes] = await Promise.all([
        getBarberAdminData(tenantSlug),
        getMonthlySubscribers(tenantSlug),
        getCRMClientList(tenantSlug),
      ])

      if (adminRes) {
        setData(adminRes)
        if (adminRes.barbers.length > 0) {
          setWalkInBarberId(adminRes.barbers[0].id)
          setBlockBarberId(adminRes.barbers[0].id)
        }
      }
      setSubscribers(subRes)
      setCrmClients(crmRes)
    } catch (err) {
      console.error('Erro ao carregar dados do barbeiro:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
    const tabParam = searchParams.get('tab') as ActiveModule
    if (tabParam) setActiveTab(tabParam)
  }, [tenantSlug])

  // Submissão Agendamento Walk-in
  const handleCreateWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const res = await createWalkInAppointment(data.tenant.id, tenantSlug, {
      clientName: walkInClientName || 'Cliente Presencial (Walk-in)',
      clientPhone: walkInClientPhone || '(11) 99999-9999',
      serviceName: 'Corte Presencial',
      servicePrice: Number(walkInServicePrice),
      barberId: walkInBarberId,
      paymentMethod: walkInPaymentMethod,
    })

    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      setIsWalkInModalOpen(false)
      setWalkInClientName('')
      setWalkInClientPhone('')
      await loadDashboard()
    } else {
      setFeedback({ type: 'error', message: res.message })
    }
  }

  // Submissão Bloqueio de Horário
  const handleBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const res = await blockScheduleSlot(data.tenant.id, tenantSlug, {
      barberId: blockBarberId,
      date: blockDate,
      startTime: blockStartTime,
      endTime: blockEndTime,
      reason: blockReason,
    })

    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      setIsBlockModalOpen(false)
      await loadDashboard()
    } else {
      setFeedback({ type: 'error', message: res.message })
    }
  }

  // Alterar Status do Agendamento
  const handleStatusChange = async (aptId: string, newStatus: any) => {
    const res = await updateAppointmentStatus(aptId, newStatus, tenantSlug)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Submissão Novo Serviço
  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const res = await saveService(data.tenant.id, tenantSlug, {
      name: serviceName,
      price: Number(servicePrice),
      durationMinutes: Number(serviceDuration),
      reservationFee: Number(serviceFee),
    })

    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      setIsServiceModalOpen(false)
      setServiceName('')
      await loadDashboard()
    }
  }

  // Excluir Serviço
  const handleDeleteService = async (serviceId: string) => {
    if (!data || !confirm('Deseja realmente remover este serviço?')) return
    const res = await deleteService(data.tenant.id, tenantSlug, serviceId)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Salvar Produto
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const res = await saveProduct(data.tenant.id, tenantSlug, {
      name: productName,
      price: Number(productPrice),
      stockQuantity: Number(productStock),
    })

    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      setIsProductModalOpen(false)
      setProductName('')
      await loadDashboard()
    }
  }

  // Excluir Produto
  const handleDeleteProduct = async (productId: string) => {
    if (!data || !confirm('Deseja remover este produto?')) return
    const res = await deleteProduct(data.tenant.id, tenantSlug, productId)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Adicionar Item à Comanda
  const handleAddItemToTab = async (tabId: string, itemProdName: string, price: number) => {
    if (!data) return
    const res = await addItemToTab(data.tenant.id, tenantSlug, tabId, itemProdName, price)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Fechar Comanda
  const handleCloseTab = async (tabId: string, payMethod: string) => {
    if (!data) return
    const res = await closeTab(data.tenant.id, tenantSlug, tabId, payMethod)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Criar Mensalista
  const handleCreateSubscriber = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await createMonthlySubscriber(tenantSlug, {
      clientName: subClientName,
      clientPhone: subClientPhone,
      planName: subPlanName,
      cutsIncluded: Number(subCutsIncluded),
      priceMonthly: Number(subPriceMonthly),
    })

    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      setIsSubscriberModalOpen(false)
      setSubClientName('')
      setSubClientPhone('')
      await loadDashboard()
    } else {
      setFeedback({ type: 'error', message: res.message })
    }
  }

  // Consumir Corte de Mensalista
  const handleConsumeCut = async (subId: string) => {
    const res = await consumeSubscriberCut(subId, tenantSlug)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    } else {
      setFeedback({ type: 'error', message: res.message })
    }
  }

  // Renovar Ciclo de Mensalista
  const handleRenewCycle = async (subId: string, cuts: number) => {
    const res = await renewMonthlyCycle(subId, cuts, tenantSlug)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Pausar/Cancelar Mensalista
  const handleStatusSubscriber = async (subId: string, newStatus: 'active' | 'overdue' | 'cancelled') => {
    const res = await pauseOrCancelSubscription(subId, newStatus, tenantSlug)
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
      await loadDashboard()
    }
  }

  // Salvar Personalização
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data) return
    const res = await updateStoreSettings(data.tenant.id, tenantSlug, {
      theme,
      instagram,
      whatsappMessage: whatsappMsg,
    })
    if (res.success) {
      setFeedback({ type: 'success', message: res.message })
    }
  }

  const navItems = [
    { id: 'agenda', label: 'Agenda & Grade', icon: CalendarIcon },
    { id: 'mensalistas', label: 'Clube de Mensalistas', icon: Crown },
    { id: 'crm', label: 'CRM & Clientes', icon: UserCheck },
    { id: 'servicos', label: 'Serviços & Catálogo', icon: Scissors },
    { id: 'comanda', label: 'Comanda & Bar', icon: Beer },
    { id: 'fidelidade', label: 'Fidelidade & Promoções', icon: Tag },
    { id: 'financeiro', label: 'Financeiro & Caixa', icon: DollarSign },
    { id: 'equipe', label: 'Equipe & Barbeiros', icon: Users },
    { id: 'personalizacao', label: 'Personalização da Loja', icon: Palette },
  ] as const

  // Filtragem de CRM
  const filteredCRM = crmClients.filter((c) =>
    c.name.toLowerCase().includes(crmSearch.toLowerCase()) || c.phone.includes(crmSearch)
  )

  // Estatísticas de Mensalistas
  const activeSubs = subscribers.filter((s) => s.status === 'active')
  const totalSubMRR = activeSubs.reduce((acc, curr) => acc + curr.price_monthly, 0)
  const totalSubCutsRemaining = activeSubs.reduce((acc, curr) => acc + curr.cuts_remaining, 0)

  return (
    <div className="min-h-screen bg-[#080706] text-[#fbf8f1] flex flex-col md:flex-row antialiased selection:bg-[#d4af37] selection:text-black">
      {/* Sidebar Fixa do Barbeiro */}
      <aside className="w-full md:w-64 lg:w-72 bg-[#100d0a] border-r border-[#d4af37]/20 flex flex-col shrink-0">
        {/* Identidade da Barbearia */}
        <div className="p-5 border-b border-[#d4af37]/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-[#d4af37]/50 shadow-md shadow-[#d4af37]/20 shrink-0">
              <Image
                src="/images/branding/navalio-icon-n.jpg"
                alt="Navalio"
                width={40}
                height={40}
                className="object-cover"
              />
            </div>
            <div className="truncate">
              <h2 className="font-cinzel font-bold text-white text-sm truncate">
                {data ? data.tenant.name : 'Carregando Barbearia...'}
              </h2>
              <div className="flex items-center gap-1.5 text-[10px] text-[#d4af37]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>/{tenantSlug}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Módulos do Sistema */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-cinzel font-semibold transition-all text-left ${
                  isActive
                    ? 'bg-gradient-to-r from-[#1c1813] to-[#251e16] text-[#d4af37] border border-[#d4af37]/40 shadow-lg shadow-black/40'
                    : 'text-[#a89e90] hover:text-white hover:bg-[#14100c]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#d4af37]' : 'text-[#a89e90]'}`} />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-[#d4af37]" />}
              </button>
            )
          })}
        </nav>

        {/* Botão de Atalho para o PWA do Cliente & Logout */}
        <div className="p-4 border-t border-[#d4af37]/15 bg-[#0c0a08] space-y-2.5">
          <Link
            href={`/${tenantSlug}`}
            target="_blank"
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#1e1913] hover:bg-[#282118] border border-[#d4af37]/30 text-xs font-cinzel font-bold text-[#f7e599] transition-all"
          >
            <span>Ver Loja do Cliente (PWA)</span>
            <ExternalLink className="w-3.5 h-3.5 text-[#d4af37]" />
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-zinc-400 hover:text-white transition-colors"
            >
              <LogOut className="w-3 h-3" />
              <span>Sair do Painel</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Área Principal dos Módulos */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#080706] p-4 sm:p-8 overflow-y-auto">
        {/* Top bar de Ações */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#d4af37]/15 pb-5 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider">
                Backoffice Operacional
              </span>
              <span className="text-xs text-[#a89e90]">• Barbearia Conectada</span>
            </div>
            <h1 className="text-2xl font-cinzel font-black text-white capitalize">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'agenda' && (
              <>
                <button
                  onClick={() => setIsBlockModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-[#1e1913] hover:bg-[#282118] border border-amber-500/30 text-xs font-bold text-amber-300 flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Bloquear Horário</span>
                </button>
                <button
                  onClick={() => setIsWalkInModalOpen(true)}
                  className="gold-button text-xs px-4 py-2 flex items-center gap-1.5 shadow-lg shadow-[#d4af37]/20"
                >
                  <Plus className="w-3.5 h-3.5 text-black font-bold" />
                  <span>Novo Agendamento (Walk-in)</span>
                </button>
              </>
            )}

            {activeTab === 'mensalistas' && (
              <button
                onClick={() => setIsSubscriberModalOpen(true)}
                className="gold-button text-xs px-4 py-2 flex items-center gap-1.5 shadow-lg shadow-[#d4af37]/20"
              >
                <Plus className="w-3.5 h-3.5 text-black font-bold" />
                <span>Novo Mensalista VIP</span>
              </button>
            )}

            {activeTab === 'servicos' && (
              <button
                onClick={() => setIsServiceModalOpen(true)}
                className="gold-button text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Serviço</span>
              </button>
            )}

            {activeTab === 'comanda' && (
              <button
                onClick={() => setIsProductModalOpen(true)}
                className="gold-button text-xs px-4 py-2 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Produto / Bebida</span>
              </button>
            )}

            <button
              onClick={loadDashboard}
              className="p-2 rounded-xl bg-[#14100c] border border-[#d4af37]/20 text-[#a89e90] hover:text-white"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#d4af37]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl text-xs font-semibold mb-6 flex items-center justify-between border ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}
          >
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="text-sm ml-4 font-bold">
              ✕
            </button>
          </div>
        )}

        {/* 1. MÓDULO: AGENDA / GRADE DE HORÁRIOS */}
        {activeTab === 'agenda' && (
          <div className="space-y-6">
            {/* Resumo da Grade do Dia */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="vintage-card p-4 border-l-4 border-l-emerald-500">
                <p className="text-[11px] text-[#a89e90]">Confirmados Hoje</p>
                <p className="text-xl font-bold font-cinzel text-white mt-1">
                  {data?.appointments.filter((a) => a.status === 'confirmed').length || 0}
                </p>
              </div>
              <div className="vintage-card p-4 border-l-4 border-l-amber-500">
                <p className="text-[11px] text-[#a89e90]">Holds Pix Pendentes</p>
                <p className="text-xl font-bold font-cinzel text-amber-400 mt-1">
                  {data?.appointments.filter((a) => a.status === 'hold' || a.status === 'pending').length || 0}
                </p>
              </div>
              <div className="vintage-card p-4 border-l-4 border-l-blue-500">
                <p className="text-[11px] text-[#a89e90]">Em Atendimento</p>
                <p className="text-xl font-bold font-cinzel text-blue-400 mt-1">
                  {data?.appointments.filter((a) => a.status === 'arrived').length || 0}
                </p>
              </div>
              <div className="vintage-card p-4 border-l-4 border-l-zinc-500">
                <p className="text-[11px] text-[#a89e90]">Finalizados</p>
                <p className="text-xl font-bold font-cinzel text-zinc-300 mt-1">
                  {data?.appointments.filter((a) => a.status === 'completed').length || 0}
                </p>
              </div>
            </div>

            {/* Tabela Interativa de Atendimentos */}
            <div className="vintage-card overflow-hidden border border-[#d4af37]/25">
              <div className="p-4 border-b border-[#d4af37]/15 flex items-center justify-between">
                <h3 className="font-cinzel font-bold text-white text-sm">
                  Atendimentos do Dia na Cadeira
                </h3>
                <span className="text-xs text-[#a89e90]">Visualização Diária</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14100c] text-[#a89e90] font-cinzel uppercase tracking-wider border-b border-[#d4af37]/15">
                    <tr>
                      <th className="py-3 px-4">Horário & Tipo</th>
                      <th className="py-3 px-4">Cliente & Contato</th>
                      <th className="py-3 px-4">Serviço</th>
                      <th className="py-3 px-4">Barbeiro</th>
                      <th className="py-3 px-4">Valor</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {data?.appointments.map((apt) => {
                      const cleanPhone = apt.client_phone.replace(/\D/g, '')
                      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                        `Fala ${apt.client_name}, tudo bem? Confirmando seu horário às ${new Date(
                          apt.starts_at
                        ).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} no Navalio!`
                      )}`

                      return (
                        <tr key={apt.id} className="hover:bg-[#181410]/50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
                              <span>
                                {new Date(apt.starts_at).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            {apt.is_walk_in && (
                              <span className="text-[10px] text-amber-400 font-bold">● Walk-in</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-white font-medium">{apt.client_name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-[#a89e90]">
                              <span>{apt.client_phone}</span>
                              {cleanPhone.length >= 10 && (
                                <a
                                  href={whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 ml-1"
                                  title="Enviar WhatsApp"
                                >
                                  <MessageCircle className="w-3 h-3 inline" />
                                </a>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#e8decb]">{apt.service_name}</td>
                          <td className="py-3.5 px-4 text-zinc-300">{apt.barber_name}</td>
                          <td className="py-3.5 px-4 font-bold text-[#d4af37]">
                            R$ {apt.total_amount.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4">
                            {apt.status === 'confirmed' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                                Confirmado
                              </span>
                            )}
                            {apt.status === 'arrived' && (
                              <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] animate-pulse">
                                Na Cadeira
                              </span>
                            )}
                            {(apt.status === 'hold' || apt.status === 'pending') && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                                Hold Pix
                              </span>
                            )}
                            {apt.status === 'completed' && (
                              <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px]">
                                Concluído
                              </span>
                            )}
                            {apt.status === 'cancelled' && (
                              <span className="px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-500/20 text-[10px]">
                                Bloqueado / Cancelado
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {apt.status !== 'completed' && apt.status !== 'cancelled' && (
                                <button
                                  onClick={() => handleStatusChange(apt.id, 'completed')}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold"
                                >
                                  Finalizar
                                </button>
                              )}
                              {apt.status === 'confirmed' && (
                                <button
                                  onClick={() => handleStatusChange(apt.id, 'arrived')}
                                  className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-[10px] font-bold"
                                >
                                  Chamar
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. MÓDULO: CLUBE DE MENSALISTAS VIP */}
        {activeTab === 'mensalistas' && (
          <div className="space-y-6">
            {/* Indicadores do Clube */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="vintage-card p-5 border border-[#d4af37]/30">
                <p className="text-xs text-[#a89e90]">Assinantes VIP Ativos</p>
                <p className="text-2xl font-black font-cinzel text-white mt-1">
                  {activeSubs.length}
                </p>
                <p className="text-[11px] text-emerald-400 mt-1">Recorrência mensal garantida</p>
              </div>

              <div className="vintage-card p-5 border border-emerald-500/30">
                <p className="text-xs text-[#a89e90]">MRR do Clube (Recorrente)</p>
                <p className="text-2xl font-black font-cinzel text-emerald-400 mt-1">
                  R$ {totalSubMRR.toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">Faturamento previsível / mês</p>
              </div>

              <div className="vintage-card p-5 border border-amber-500/30">
                <p className="text-xs text-[#a89e90]">Cortes Restantes no Ciclo</p>
                <p className="text-2xl font-black font-cinzel text-amber-400 mt-1">
                  {totalSubCutsRemaining} cortes
                </p>
                <p className="text-[11px] text-zinc-400 mt-1">Saldo total dos membros ativos</p>
              </div>
            </div>

            {/* Tabela de Mensalistas */}
            <div className="vintage-card overflow-hidden border border-[#d4af37]/25">
              <div className="p-4 border-b border-[#d4af37]/15 flex items-center justify-between">
                <h3 className="font-cinzel font-bold text-white text-sm flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#d4af37]" />
                  Membros do Clube de Assinaturas
                </h3>
                <span className="text-xs text-[#a89e90]">{subscribers.length} cadastrados</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14100c] text-[#a89e90] font-cinzel uppercase tracking-wider border-b border-[#d4af37]/15">
                    <tr>
                      <th className="py-3 px-4">Cliente & WhatsApp</th>
                      <th className="py-3 px-4">Plano & Valor</th>
                      <th className="py-3 px-4">Saldo de Cortes</th>
                      <th className="py-3 px-4">Validade do Ciclo (30d)</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações Rápidas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {subscribers.map((sub) => {
                      const cleanPhone = sub.client_phone.replace(/\D/g, '')
                      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                        `Olá ${sub.client_name}! Seu plano VIP Navalio tem ${sub.cuts_remaining} cortes disponíveis até ${new Date(
                          sub.cycle_end_date
                        ).toLocaleDateString('pt-BR')}. Bora agendar?`
                      )}`

                      return (
                        <tr key={sub.id} className="hover:bg-[#181410]/50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div>{sub.client_name}</div>
                            <div className="flex items-center gap-1 text-[10px] text-[#a89e90]">
                              <span>{sub.client_phone}</span>
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                <MessageCircle className="w-3 h-3 inline" />
                              </a>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-white font-medium">{sub.plan_name}</div>
                            <div className="text-[#d4af37] font-bold">
                              R$ {sub.price_monthly.toFixed(2)}/mês
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">
                                {sub.cuts_remaining} / {sub.cuts_included}
                              </span>
                              <div className="w-20 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-500 to-[#d4af37]"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      (sub.cuts_remaining / (sub.cuts_included || 1)) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-[#e8decb]">
                            {new Date(sub.cycle_end_date).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3.5 px-4">
                            {sub.status === 'active' && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                                Ativo
                              </span>
                            )}
                            {sub.status === 'overdue' && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                                Em Atraso
                              </span>
                            )}
                            {sub.status === 'cancelled' && (
                              <span className="px-2 py-0.5 rounded-full bg-red-950/40 text-red-400 border border-red-500/20 text-[10px]">
                                Cancelado
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {sub.status === 'active' && sub.cuts_remaining > 0 && (
                                <button
                                  onClick={() => handleConsumeCut(sub.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold"
                                  title="Deduzir 1 corte após atendimento"
                                >
                                  -1 Corte
                                </button>
                              )}
                              <button
                                onClick={() => handleRenewCycle(sub.id, sub.cuts_included)}
                                className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[10px] font-bold"
                                title="Renovar Ciclo de 30 dias"
                              >
                                Renovar +30d
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. MÓDULO: CRM & CLIENTES */}
        {activeTab === 'crm' && (
          <div className="space-y-6">
            {/* Topo com Busca */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-[#a89e90] absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Buscar cliente por nome ou WhatsApp..."
                  value={crmSearch}
                  onChange={(e) => setCrmSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-[#120f0c] border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-[#a89e90]">
                <span>Total de Clientes no CRM:</span>
                <strong className="text-white">{crmClients.length}</strong>
              </div>
            </div>

            {/* Tabela de CRM */}
            <div className="vintage-card overflow-hidden border border-[#d4af37]/25">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14100c] text-[#a89e90] font-cinzel uppercase tracking-wider border-b border-[#d4af37]/15">
                    <tr>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">WhatsApp</th>
                      <th className="py-3 px-4">Total Visitas</th>
                      <th className="py-3 px-4">Total Gasto (LTV)</th>
                      <th className="py-3 px-4">Ticket Médio</th>
                      <th className="py-3 px-4">Última Visita</th>
                      <th className="py-3 px-4 text-right">Ação Rápida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {filteredCRM.map((c, idx) => {
                      const cleanPhone = c.phone.replace(/\D/g, '')
                      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(
                        `Fala ${c.name}, beleza? Faz um tempinho que você não vem dar aquele talento no visual aqui no Navalio. Bora agendar essa semana?`
                      )}`

                      return (
                        <tr key={idx} className="hover:bg-[#181410]/50 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              <span>{c.name}</span>
                              {c.isInactive && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] border border-amber-500/30">
                                  +30 dias sem vir
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-zinc-300">{c.phone}</td>
                          <td className="py-3.5 px-4 font-bold text-white">{c.totalVisits}x</td>
                          <td className="py-3.5 px-4 font-bold text-[#d4af37]">
                            R$ {c.totalSpent.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-zinc-300">
                            R$ {c.averageTicket.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-[#a89e90]">
                            {new Date(c.lastVisit).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>Chamar no Whats</span>
                            </a>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. MÓDULO: SERVIÇOS & CATÁLOGO */}
        {activeTab === 'servicos' && (
          <div className="space-y-6">
            <div className="vintage-card overflow-hidden border border-[#d4af37]/25">
              <div className="p-4 border-b border-[#d4af37]/15 flex items-center justify-between">
                <h3 className="font-cinzel font-bold text-white text-sm">
                  Catálogo de Serviços da Barbearia
                </h3>
                <span className="text-xs text-[#a89e90]">
                  {data?.services.length || 0} serviços configurados
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#14100c] text-[#a89e90] font-cinzel uppercase tracking-wider border-b border-[#d4af37]/15">
                    <tr>
                      <th className="py-3 px-4">Nome do Serviço</th>
                      <th className="py-3 px-4">Duração</th>
                      <th className="py-3 px-4">Preço Balcão</th>
                      <th className="py-3 px-4">Sinal Pix (Hold)</th>
                      <th className="py-3 px-4">Comissão Barbeiro</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {data?.services.map((s) => (
                      <tr key={s.id} className="hover:bg-[#181410]/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">{s.name}</td>
                        <td className="py-3.5 px-4 text-[#a89e90]">{s.duration_minutes} min</td>
                        <td className="py-3.5 px-4 font-bold text-[#d4af37]">
                          R$ {s.price.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-zinc-300">
                          R$ {s.reservation_fee.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-400 font-semibold">
                          {s.commission_percent}%
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDeleteService(s.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400"
                            title="Remover Serviço"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. MÓDULO: COMANDA & BAR */}
        {activeTab === 'comanda' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Comandas Abertas */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-cinzel font-bold text-white text-sm flex items-center gap-2">
                  <Beer className="w-4 h-4 text-[#d4af37]" />
                  Comandas Abertas na Cadeira
                </h3>

                <div className="space-y-3">
                  {data?.tabs.map((tab) => (
                    <div key={tab.id} className="vintage-card p-5 border border-[#d4af37]/25 space-y-3">
                      <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-2">
                        <div>
                          <h4 className="font-cinzel font-bold text-white text-sm">{tab.client_name}</h4>
                          <p className="text-[10px] text-[#d4af37]">{tab.chair_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-[#a89e90]">Subtotal</p>
                          <p className="font-cinzel font-black text-lg gold-gradient-text">
                            R$ {tab.total_amount.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Itens na Comanda */}
                      <div className="space-y-1.5 text-xs">
                        {tab.items.length === 0 ? (
                          <p className="text-[11px] text-[#a89e90] italic">Nenhum consumo registrado ainda.</p>
                        ) : (
                          tab.items.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-zinc-300">
                              <span>
                                {item.quantity}x {item.product_name}
                              </span>
                              <strong>R$ {item.total_price.toFixed(2)}</strong>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Lançamento Rápido */}
                      <div className="pt-2 border-t border-[#d4af37]/10 flex flex-wrap gap-2">
                        {data.products.map((prod) => (
                          <button
                            key={prod.id}
                            onClick={() => handleAddItemToTab(tab.id, prod.name, prod.price)}
                            className="px-2.5 py-1 rounded-lg bg-[#181410] hover:bg-[#221c17] border border-[#d4af37]/25 text-[11px] text-[#f7e599] transition-colors flex items-center gap-1"
                          >
                            <span>+ {prod.name}</span>
                            <span className="text-zinc-400">(R${prod.price})</span>
                          </button>
                        ))}
                      </div>

                      {/* Fechar Comanda */}
                      <div className="pt-2 border-t border-[#d4af37]/10 flex items-center justify-between">
                        <span className="text-[11px] text-[#a89e90]">Encerrar Conta:</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleCloseTab(tab.id, 'PIX')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold"
                          >
                            Pago via PIX
                          </button>
                          <button
                            onClick={() => handleCloseTab(tab.id, 'CARTAO')}
                            className="px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[10px] font-bold"
                          >
                            Cartão
                          </button>
                          <button
                            onClick={() => handleCloseTab(tab.id, 'DINHEIRO')}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold"
                          >
                            Dinheiro
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catálogo Rápido do Bar */}
              <div className="vintage-card p-5 border border-[#d4af37]/20 h-fit space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-cinzel font-bold text-white text-sm">
                    Estoque de Bebidas & Balcão
                  </h4>
                  <button
                    onClick={() => setIsProductModalOpen(true)}
                    className="p-1 rounded bg-[#1e1913] hover:bg-[#282118] text-[#d4af37]"
                    title="Adicionar Produto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="space-y-2.5 text-xs">
                  {data?.products.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-[#120f0c] border border-zinc-800 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-[10px] text-[#a89e90]">Estoque: {p.stock_quantity} un</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <strong className="text-[#d4af37]">R$ {p.price.toFixed(2)}</strong>
                        <button
                          onClick={() => handleDeleteProduct(p.id)}
                          className="p-1 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. MÓDULO: FIDELIDADE & PROMOÇÕES */}
        {activeTab === 'fidelidade' && (
          <div className="space-y-6 max-w-3xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Promoção Dias da Semana */}
              <div className="vintage-card p-6 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-cinzel font-bold text-sm">
                  <Percent className="w-4 h-4" />
                  <span>Promoção Terça & Quarta</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Desconto automático de <strong>15% OFF</strong> em todos os cortes agendados nas terças e quartas-feiras para movimentar dias calmos.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-emerald-400 font-bold">Ativado no Motor de Preços</span>
                </div>
              </div>

              {/* Aniversariante do Mês */}
              <div className="vintage-card p-6 border border-[#d4af37]/30 space-y-3">
                <div className="flex items-center gap-2 text-[#d4af37] font-cinzel font-bold text-sm">
                  <Gift className="w-4 h-4" />
                  <span>Bônus Aniversariante</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Benefício especial de <strong>20% de desconto</strong> para o cliente celebrar o aniversário com corte ou barboterapia na estica.
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[11px] text-emerald-400 font-bold">Ativado no Checkout</span>
                </div>
              </div>
            </div>

            {/* Cartão Fidelidade Virtual */}
            <div className="vintage-card p-6 border border-[#d4af37]/20 space-y-4">
              <h3 className="font-cinzel font-bold text-white text-sm flex items-center gap-2">
                <Star className="w-4 h-4 text-[#d4af37]" />
                Regras do Cartão Fidelidade (Selos Virtuais)
              </h3>
              <p className="text-xs text-[#a89e90]">
                A cada 10 cortes ou barboterapia realizados e pagos no Navalio, o cliente ganha 1 corte 100% gratuito como recompensa de lealdade.
              </p>
              <div className="p-4 rounded-xl bg-[#120f0c] border border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-zinc-300">Meta para resgate de corte gratuito:</span>
                <strong className="text-emerald-400 font-bold">10 Selos Acumulados</strong>
              </div>
            </div>
          </div>
        )}

        {/* 7. MÓDULO: FINANCEIRO & FECHAMENTO (LEI DO SALÃO-PARCEIRO) */}
        {activeTab === 'financeiro' && (
          <div className="space-y-6">
            {/* Resumo do Caixa Diário */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="vintage-card p-6 border border-[#d4af37]/30">
                <p className="text-xs text-[#a89e90]">Faturamento Bruto (Dia)</p>
                <p className="text-2xl font-black font-cinzel gold-gradient-text mt-1">
                  R$ {data?.financialSummary.totalRevenue.toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2">Cortes, barboterapia e bar</p>
              </div>

              <div className="vintage-card p-6 border border-emerald-500/30">
                <p className="text-xs text-[#a89e90]">Cota Barbeiros (Salão-Parceiro)</p>
                <p className="text-2xl font-black font-cinzel text-emerald-400 mt-1">
                  R$ {data?.financialSummary.barberQuota.toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2">Repasses brutos calculados</p>
              </div>

              <div className="vintage-card p-6 border border-[#9b1b1b]/40">
                <p className="text-xs text-[#a89e90]">Cota Barbearia (Líquido Loja)</p>
                <p className="text-2xl font-black font-cinzel text-white mt-1">
                  R$ {data?.financialSummary.barbershopQuota.toFixed(2)}
                </p>
                <p className="text-[11px] text-zinc-400 mt-2">Após repasse aos profissionais</p>
              </div>
            </div>

            {/* Faturamento por Forma de Pagamento */}
            <div className="vintage-card p-6 border border-[#d4af37]/20 space-y-4">
              <h3 className="font-cinzel font-bold text-white text-sm">
                Divisão por Forma de Pagamento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#120f0c] border border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <QrCode className="w-4 h-4" />
                    <span>Pix Direto</span>
                  </div>
                  <strong className="text-white">
                    R$ {data?.financialSummary.byPaymentMethod.pix.toFixed(2)}
                  </strong>
                </div>

                <div className="p-4 rounded-xl bg-[#120f0c] border border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400">
                    <CreditCard className="w-4 h-4" />
                    <span>Cartão Máquina</span>
                  </div>
                  <strong className="text-white">
                    R$ {data?.financialSummary.byPaymentMethod.card.toFixed(2)}
                  </strong>
                </div>

                <div className="p-4 rounded-xl bg-[#120f0c] border border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <DollarSign className="w-4 h-4" />
                    <span>Dinheiro Balcão</span>
                  </div>
                  <strong className="text-white">
                    R$ {data?.financialSummary.byPaymentMethod.cash.toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 8. MÓDULO: EQUIPE & PROFISSIONAIS */}
        {activeTab === 'equipe' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data?.barbers.map((b) => (
                <div key={b.id} className="vintage-card p-6 border border-[#d4af37]/25 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#9b1b1b] to-[#d4af37] text-black font-black flex items-center justify-center font-cinzel text-lg shadow-md">
                      {b.full_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-cinzel font-bold text-white text-base">{b.full_name}</h4>
                      <p className="text-[11px] text-[#d4af37] capitalize">{b.role}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-[#a89e90] border-t border-[#d4af37]/15 pt-3">
                    <div className="flex justify-between">
                      <span>Comissão Acordada:</span>
                      <strong className="text-emerald-400">{b.commission_rate}%</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Contato:</span>
                      <span className="text-zinc-200">{b.phone || 'Sem telefone'}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#d4af37]/10 flex flex-wrap gap-1">
                    {b.active_days?.map((d) => (
                      <span key={d} className="px-2 py-0.5 rounded bg-[#1e1913] text-[10px] text-[#a89e90]">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 9. MÓDULO: PERSONALIZAÇÃO DA LOJA */}
        {activeTab === 'personalizacao' && (
          <div className="space-y-6 max-w-2xl">
            <form onSubmit={handleSaveSettings} className="vintage-card p-6 sm:p-8 border border-[#d4af37]/30 space-y-5">
              <div>
                <h3 className="font-cinzel font-bold text-white text-base">
                  Personalização Visual da Barbearia
                </h3>
                <p className="text-xs text-[#a89e90]">
                  Escolha o tema, configure seu Instagram e a mensagem de boas-vindas do WhatsApp.
                </p>
              </div>

              {/* Paleta de Cores */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">Tema Visual do PWA:</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'navalio-dark-gold', name: 'Navalio Dark/Gold' },
                    { id: 'black-carbon', name: 'Preto Fosco Carbono' },
                    { id: 'vintage-wood', name: 'Madeira Vintage' },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.id}
                      onClick={() => setTheme(t.id)}
                      className={`p-3 rounded-xl border text-xs font-cinzel font-bold transition-all ${
                        theme === t.id
                          ? 'bg-[#181410] border-[#d4af37] text-[#d4af37] shadow-lg'
                          : 'bg-[#100d0a] border-zinc-800 text-[#a89e90]'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Redes Sociais */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">Instagram da Barbearia:</label>
                <input
                  type="text"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@barbearia"
                  className="w-full bg-[#120f0c] border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              {/* Mensagem WhatsApp */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300 block">Mensagem Padrão de Confirmação no WhatsApp:</label>
                <textarea
                  rows={3}
                  value={whatsappMsg}
                  onChange={(e) => setWhatsappMsg(e.target.value)}
                  className="w-full bg-[#120f0c] border border-zinc-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div className="pt-3">
                <button type="submit" className="gold-button text-xs px-6 py-2.5">
                  Salvar Personalização
                </button>
              </div>
            </form>
          </div>
        )}

        {/* MODAL: NOVO AGENDAMENTO WALK-IN */}
        {isWalkInModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#14100c] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
                <h3 className="font-cinzel font-bold text-white text-base">
                  Novo Agendamento Presencial (Walk-in)
                </h3>
                <button onClick={() => setIsWalkInModalOpen(false)} className="text-[#a89e90] hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateWalkIn} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1">Nome do Cliente:</label>
                  <input
                    type="text"
                    required
                    value={walkInClientName}
                    onChange={(e) => setWalkInClientName(e.target.value)}
                    placeholder="Ex: Carlos Santana"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">WhatsApp (para recibo):</label>
                  <input
                    type="tel"
                    value={walkInClientPhone}
                    onChange={(e) => setWalkInClientPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1">Valor do Corte (R$):</label>
                    <input
                      type="number"
                      required
                      value={walkInServicePrice}
                      onChange={(e) => setWalkInServicePrice(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1">Barbeiro na Cadeira:</label>
                    <select
                      value={walkInBarberId}
                      onChange={(e) => setWalkInBarberId(e.target.value)}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    >
                      {data?.barbers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">Forma de Pagamento:</label>
                  <select
                    value={walkInPaymentMethod}
                    onChange={(e) => setWalkInPaymentMethod(e.target.value)}
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  >
                    <option value="PIX">Pix Direto</option>
                    <option value="CREDIT_CARD">Cartão de Crédito</option>
                    <option value="DEBIT_CARD">Cartão de Débito</option>
                    <option value="CASH">Dinheiro em Mãos</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsWalkInModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="gold-button px-5 py-2">
                    Iniciar Atendimento
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: BLOQUEAR HORÁRIO NA GRADE */}
        {isBlockModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#14100c] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
                <h3 className="font-cinzel font-bold text-white text-base flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" />
                  Bloquear Horário na Grade
                </h3>
                <button onClick={() => setIsBlockModalOpen(false)} className="text-[#a89e90] hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleBlockSlot} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1">Barbeiro:</label>
                  <select
                    value={blockBarberId}
                    onChange={(e) => setBlockBarberId(e.target.value)}
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  >
                    {data?.barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">Data:</label>
                  <input
                    type="date"
                    required
                    value={blockDate}
                    onChange={(e) => setBlockDate(e.target.value)}
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1">Início:</label>
                    <input
                      type="time"
                      required
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1">Fim:</label>
                    <input
                      type="time"
                      required
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">Motivo do Bloqueio:</label>
                  <input
                    type="text"
                    required
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="Ex: Almoço, Reunião, Folga"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBlockModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="gold-button px-5 py-2">
                    Confirmar Bloqueio
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NOVO ASSINANTE MENSALISTA */}
        {isSubscriberModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#14100c] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
                <h3 className="font-cinzel font-bold text-white text-base flex items-center gap-2">
                  <Crown className="w-4 h-4 text-[#d4af37]" />
                  Cadastrar Novo Mensalista VIP
                </h3>
                <button onClick={() => setIsSubscriberModalOpen(false)} className="text-[#a89e90] hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateSubscriber} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1">Nome do Cliente:</label>
                  <input
                    type="text"
                    required
                    value={subClientName}
                    onChange={(e) => setSubClientName(e.target.value)}
                    placeholder="Ex: Lucas Gabriel"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">WhatsApp:</label>
                  <input
                    type="tel"
                    required
                    value={subClientPhone}
                    onChange={(e) => setSubClientPhone(e.target.value)}
                    placeholder="(11) 98765-4321"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div>
                  <label className="block text-zinc-300 mb-1">Nome do Plano:</label>
                  <input
                    type="text"
                    required
                    value={subPlanName}
                    onChange={(e) => setSubPlanName(e.target.value)}
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1">Cortes por Ciclo (30d):</label>
                    <input
                      type="number"
                      required
                      value={subCutsIncluded}
                      onChange={(e) => setSubCutsIncluded(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1">Mensalidade (R$):</label>
                    <input
                      type="number"
                      required
                      value={subPriceMonthly}
                      onChange={(e) => setSubPriceMonthly(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSubscriberModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="gold-button px-5 py-2">
                    Cadastrar Assinatura
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NOVO PRODUTO */}
        {isProductModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#14100c] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
                <h3 className="font-cinzel font-bold text-white text-base">
                  Adicionar Produto / Bebida ao Estoque
                </h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-[#a89e90] hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1">Nome do Produto:</label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Ex: Cerveja IPA 500ml / Pomada Matte"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-zinc-300 mb-1">Preço de Venda (R$):</label>
                    <input
                      type="number"
                      required
                      value={productPrice}
                      onChange={(e) => setProductPrice(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1">Quantidade em Estoque:</label>
                    <input
                      type="number"
                      required
                      value={productStock}
                      onChange={(e) => setProductStock(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsProductModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="gold-button px-5 py-2">
                    Salvar no Estoque
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: NOVO SERVIÇO */}
        {isServiceModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#14100c] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/15 pb-3">
                <h3 className="font-cinzel font-bold text-white text-base">
                  Adicionar Novo Serviço
                </h3>
                <button onClick={() => setIsServiceModalOpen(false)} className="text-[#a89e90] hover:text-white">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveService} className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 mb-1">Nome do Serviço:</label>
                  <input
                    type="text"
                    required
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    placeholder="Ex: Barboterapia Especial"
                    className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-zinc-300 mb-1">Preço (R$):</label>
                    <input
                      type="number"
                      required
                      value={servicePrice}
                      onChange={(e) => setServicePrice(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1">Duração (min):</label>
                    <input
                      type="number"
                      required
                      value={serviceDuration}
                      onChange={(e) => setServiceDuration(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 mb-1">Sinal Pix (R$):</label>
                    <input
                      type="number"
                      required
                      value={serviceFee}
                      onChange={(e) => setServiceFee(Number(e.target.value))}
                      className="w-full bg-[#1c1712] border border-zinc-800 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsServiceModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="gold-button px-5 py-2">
                    Salvar Serviço
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
