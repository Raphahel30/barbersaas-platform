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
} from 'lucide-react'
import {
  getBarberAdminData,
  createWalkInAppointment,
  updateAppointmentStatus,
  saveService,
  addItemToTab,
  updateStoreSettings,
  type BarberAdminData,
} from '@/app/actions/barber-admin'

type ActiveModule = 'agenda' | 'servicos' | 'equipe' | 'financeiro' | 'comanda' | 'personalizacao'

export default function BarberAdminPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const tenantSlug = (params.tenantSlug as string) || 'barbearia'

  const [activeTab, setActiveTab] = useState<ActiveModule>('agenda')
  const [data, setData] = useState<BarberAdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modais
  const [isWalkInModalOpen, setIsWalkInModalOpen] = useState(false)
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false)
  const [isBarberModalOpen, setIsBarberModalOpen] = useState(false)

  // Formulário Walk-In
  const [walkInClientName, setWalkInClientName] = useState('')
  const [walkInClientPhone, setWalkInClientPhone] = useState('')
  const [walkInServicePrice, setWalkInServicePrice] = useState(45)
  const [walkInBarberId, setWalkInBarberId] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState('PIX')

  // Formulário Serviço
  const [serviceName, setServiceName] = useState('')
  const [servicePrice, setServicePrice] = useState(50)
  const [serviceDuration, setServiceDuration] = useState(35)
  const [serviceFee, setServiceFee] = useState(15)

  // Formulário Personalização
  const [theme, setTheme] = useState('navalio-dark-gold')
  const [instagram, setInstagram] = useState('@navaliobarber')
  const [whatsappMsg, setWhatsappMsg] = useState('Olá! Seu corte está confirmado no Navalio.')

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await getBarberAdminData(tenantSlug)
      if (res) {
        setData(res)
        if (res.barbers.length > 0) {
          setWalkInBarberId(res.barbers[0].id)
        }
      }
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

  // Adicionar Item à Comanda
  const handleAddItemToTab = async (tabId: string, productName: string, price: number) => {
    if (!data) return
    const res = await addItemToTab(data.tenant.id, tenantSlug, tabId, productName, price)
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
    { id: 'servicos', label: 'Serviços & Catálogo', icon: Scissors },
    { id: 'equipe', label: 'Equipe & Barbeiros', icon: Users },
    { id: 'financeiro', label: 'Financeiro & Caixa', icon: DollarSign },
    { id: 'comanda', label: 'Comanda & Bar', icon: Beer },
    { id: 'personalizacao', label: 'Personalização da Loja', icon: Palette },
  ] as const

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
              <button
                onClick={() => setIsWalkInModalOpen(true)}
                className="gold-button text-xs px-4 py-2 flex items-center gap-1.5 shadow-lg shadow-[#d4af37]/20"
              >
                <Plus className="w-3.5 h-3.5 text-black font-bold" />
                <span>Novo Agendamento (Walk-in)</span>
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
                  {data?.appointments.filter((a) => a.status === 'hold').length || 0}
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
                    {data?.appointments.map((apt) => (
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
                          <div className="text-[10px] text-[#a89e90]">{apt.client_phone}</div>
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
                          {apt.status === 'hold' && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                              Hold Pix
                            </span>
                          )}
                          {apt.status === 'completed' && (
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px]">
                              Concluído
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {apt.status !== 'completed' && (
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 2. MÓDULO: SERVIÇOS & CATÁLOGO */}
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
                      <th className="py-3 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#d4af37]/10">
                    {data?.services.map((s) => (
                      <tr key={s.id} className="hover:bg-[#181410]/50 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-white">
                          {s.name}
                        </td>
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
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                            Ativo
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. MÓDULO: EQUIPE & PROFISSIONAIS */}
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

        {/* 4. MÓDULO: FINANCEIRO & FECHAMENTO (LEI DO SALÃO-PARCEIRO) */}
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

                      {/* Ações de Lançamento Rápido */}
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
                    </div>
                  ))}
                </div>
              </div>

              {/* Catálogo Rápido do Bar */}
              <div className="vintage-card p-5 border border-[#d4af37]/20 h-fit space-y-4">
                <h4 className="font-cinzel font-bold text-white text-sm">
                  Estoque de Bebidas & Balcão
                </h4>
                <div className="space-y-2.5 text-xs">
                  {data?.products.map((p) => (
                    <div key={p.id} className="p-3 rounded-xl bg-[#120f0c] border border-zinc-800 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-[10px] text-[#a89e90]">Estoque: {p.stock_quantity} un</p>
                      </div>
                      <strong className="text-[#d4af37]">R$ {p.price.toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. MÓDULO: PERSONALIZAÇÃO DA LOJA */}
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
