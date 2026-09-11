'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getDailyAppointments,
  getBarbersList,
  quickWalkInAppointment,
  getBarberCalendarFeedUrlAction,
  type QuickWalkInInput,
} from '@/app/actions/schedule'
import { settleAppointmentBalance } from '@/app/actions/checkout'

type AppointmentItem = {
  id: string
  tenant_id: string
  barber_id: string
  client_id: string | null
  status: string
  starts_at: string
  ends_at: string
  total_amount: number
  reservation_fee_paid: number
  balance_paid_amount: number
  guest_name: string | null
  guest_phone: string | null
  barber?: { id: string; full_name: string; avatar_url: string | null } | null
  client?: { id: string; full_name: string; phone: string | null; avatar_url: string | null } | null
  appointment_services?: Array<{ service_id: string; service_name: string; unit_price: number; duration_minutes: number }>
}

export default function DashboardAgendaPage() {
  const [tenantId, setTenantId] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [barbers, setBarbers] = useState<Array<{ id: string; full_name: string }>>([])
  const [selectedBarberFilter, setSelectedBarberFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  // Modals
  const [settleModalAppt, setSettleModalAppt] = useState<AppointmentItem | null>(null)
  const [isSettleLoading, setIsSettleLoading] = useState(false)
  const [isWalkInOpen, setIsWalkInOpen] = useState(false)
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false)
  const [calendarFeedUrl, setCalendarFeedUrl] = useState('')
  const [calendarWebcalUrl, setCalendarWebcalUrl] = useState('')
  const [calendarCopied, setCalendarCopied] = useState(false)
  const [loadingFeed, setLoadingFeed] = useState(false)

  // Walk-in state
  const [walkInBarberId, setWalkInBarberId] = useState('')
  const [walkInGuestName, setWalkInGuestName] = useState('')
  const [walkInGuestPhone, setWalkInGuestPhone] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<'cash' | 'card_machine' | 'pix_tenant'>('cash')

  useEffect(() => {
    async function loadTenant() {
      try {
        const res = await fetch('/api/tenant/me')
        const data = await res.json()
        const id = data?.tenantId || data?.id
        if (id) {
          setTenantId(id)
          if (data?.slug) setTenantSlug(data.slug)
          const [barberList, appts] = await Promise.all([
            getBarbersList(id),
            getDailyAppointments(id, selectedDate),
          ])
          setBarbers(barberList)
          setAppointments(appts as AppointmentItem[])
          if (barberList.length > 0) {
            setWalkInBarberId(barberList[0].id)
          } else {
            setNeedsOnboarding(true)
          }
        }
      } catch (err) {
        console.error('Erro ao carregar agenda diária:', err)
      } finally {
        setLoading(false)
      }
    }
    loadTenant()
  }, [selectedDate])

  const openCalendarSync = async () => {
    setIsCalendarModalOpen(true)
    setLoadingFeed(true)
    setCalendarCopied(false)
    try {
      const targetBarber = selectedBarberFilter !== 'all' ? selectedBarberFilter : undefined
      const res = await getBarberCalendarFeedUrlAction(targetBarber)
      if (res.success && res.feedUrl) {
        setCalendarFeedUrl(res.feedUrl)
        setCalendarWebcalUrl(res.webcalUrl || res.feedUrl)
      }
    } catch (e) {
      console.error('Falha ao obter feed do calendário:', e)
    } finally {
      setLoadingFeed(false)
    }
  }

  const reloadAppointments = async () => {
    if (!tenantId) return
    const appts = await getDailyAppointments(
      tenantId,
      selectedDate,
      selectedBarberFilter === 'all' ? undefined : selectedBarberFilter,
    )
    setAppointments(appts as AppointmentItem[])
  }

  // Quitação Rápida de Balcão
  const handleSettleBalance = async (method: 'cash' | 'card_machine' | 'pix_tenant') => {
    if (!settleModalAppt) return
    setIsSettleLoading(true)

    try {
      const res = await settleAppointmentBalance(settleModalAppt.id, method)
      if (res.success) {
        alert('Atendimento concluído e quitado com sucesso! Selo de fidelidade e comissões registrados.')
        setSettleModalAppt(null)
        await reloadAppointments()
      } else {
        alert(res.message)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao quitar atendimento.')
    } finally {
      setIsSettleLoading(false)
    }
  }

  // Lançamento de Corte Rápido / Walk-In
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tenantId || !walkInBarberId) return

    try {
      // Pega primeiro serviço como demo
      const servRes = await fetch(`/api/tenant/services?tenantId=${tenantId}`)
      const servData = await servRes.json()
      const serviceId = servData?.[0]?.id

      if (!serviceId) {
        alert('Nenhum serviço cadastrado para lançar o corte avulso.')
        return
      }

      const input: QuickWalkInInput = {
        tenantId,
        barberId: walkInBarberId,
        serviceIds: [serviceId],
        paymentMethod: walkInPaymentMethod,
        guestName: walkInGuestName || 'Cliente Balcão',
        guestPhone: walkInGuestPhone || undefined,
      }

      const res = await quickWalkInAppointment(input)
      if (res.success) {
        alert('Corte avulso lançado diretamente no caixa e na comissão!')
        setIsWalkInOpen(false)
        setWalkInGuestName('')
        setWalkInGuestPhone('')
        await reloadAppointments()
      } else {
        alert(res.message)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao lançar atendimento avulso.')
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const filteredAppointments = appointments.filter((a) => {
    if (selectedBarberFilter === 'all') return true
    return a.barber_id === selectedBarberFilter
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Banner de Onboarding Pendente */}
        {needsOnboarding && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✂️</span>
              <div>
                <p className="font-bold text-amber-300 text-sm">
                  Configuração inicial pendente!
                </p>
                <p className="text-xs text-amber-400/80">
                  Cadastre seus serviços iniciais e horários para ativar o link de agendamento online dos clientes.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/onboarding"
              className="gold-button text-xs font-bold px-4 py-2 whitespace-nowrap shadow-md"
            >
              Completar Onboarding (5 min) →
            </Link>
          </div>
        )}

        {/* Header da Agenda */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Agenda Operacional da Barbearia</h1>
            <p className="text-xs text-zinc-400">
              Visão consolidada da equipe, baixas rápidas no balcão e WhatsApp em 1 toque.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/ajuda"
              className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 font-semibold hover:text-white hover:bg-zinc-800"
            >
              ❓ Ajuda & Tutoriais
            </Link>
            <Link
              href="/dashboard/onboarding"
              className="px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs text-zinc-300 font-semibold hover:text-white hover:bg-zinc-800"
            >
              ⚙ Assistente de Loja
            </Link>
            <button
              onClick={() => setIsWalkInOpen(true)}
              className="gold-button text-xs sm:text-sm px-4 py-2.5 shadow-md shadow-amber-500/20"
            >
              + Lançar Corte Avulso (Balcão)
            </button>
            <Link
              href="/dashboard/financeiro"
              className="px-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 text-xs sm:text-sm font-semibold hover:bg-zinc-800"
            >
              Fechamento de Caixa ➔
            </Link>
          </div>
        </div>

        {/* Barra de Acesso Rápido da Loja Física (Totem, TV, Sincronização de Calendário) */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pr-1">
              Operação de Loja:
            </span>
            <Link
              href={`/${tenantSlug || 'barbearia'}/totem`}
              target="_blank"
              className="px-3 py-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-300 transition flex items-center gap-1.5"
            >
              <span>📱 Modo Totem (Tablet Balcão)</span>
            </Link>
            <Link
              href={`/${tenantSlug || 'barbearia'}/tv`}
              target="_blank"
              className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-300 transition flex items-center gap-1.5"
            >
              <span>📺 Painel TV (Sala de Espera)</span>
            </Link>
            <Link
              href="/dashboard/estoque/insumos"
              className="px-3 py-1.5 rounded-xl border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-xs font-bold text-purple-300 transition flex items-center gap-1.5"
            >
              <span>🧪 Ficha Técnica (Insumos)</span>
            </Link>
          </div>

          <button
            onClick={openCalendarSync}
            className="px-3.5 py-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-xs font-bold text-sky-300 transition flex items-center gap-1.5"
          >
            <span>📅 Sincronizar Google / Apple Calendar</span>
          </button>
        </div>

        {/* Barra de Filtros: Data & Barbeiro */}
        <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <label className="text-xs font-semibold text-zinc-400">Data:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field text-xs py-2 w-auto"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedBarberFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                selectedBarberFilter === 'all'
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              Toda a Equipe ({appointments.length})
            </button>
            {barbers.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBarberFilter(b.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  selectedBarberFilter === b.id
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                }`}
              >
                {b.full_name}
              </button>
            ))}
          </div>
        </div>

        {/* Lista / Cards de Atendimentos */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Carregando atendimentos do dia...</p>
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="glass-card p-12 text-center text-zinc-500">
            Nenhum agendamento encontrado para este filtro na data selecionada.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAppointments.map((appt) => {
              const clientName = appt.client?.full_name || appt.guest_name || 'Cliente'
              const clientPhone = appt.client?.phone || appt.guest_phone || ''
              const servicesNames = appt.appointment_services?.map((s) => s.service_name).join(', ') || 'Corte'
              const remainingBalance = Math.max(0, appt.total_amount - (appt.reservation_fee_paid || 0))

              return (
                <div
                  key={appt.id}
                  className="glass-card p-4 sm:p-5 flex flex-col justify-between border-zinc-800 space-y-4"
                >
                  <div>
                    {/* Horário & Status */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-base font-black text-amber-400 font-outfit">
                        {formatTime(appt.starts_at)} - {formatTime(appt.ends_at)}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          appt.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : appt.status === 'confirmed' || appt.status === 'scheduled'
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                              : appt.status === 'hold'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {appt.status}
                      </span>
                    </div>

                    {/* Cliente & Barbeiro */}
                    <p className="text-sm font-bold text-zinc-100">{clientName}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{servicesNames}</p>
                    {appt.barber && (
                      <p className="text-[11px] text-zinc-500 mt-1">
                        Profissional: <span className="text-zinc-300 font-medium">{appt.barber.full_name}</span>
                      </p>
                    )}

                    {/* Valores */}
                    <div className="mt-3 p-2 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs flex justify-between items-center">
                      <div>
                        <span className="text-zinc-500 text-[10px] block">Total</span>
                        <span className="font-extrabold text-zinc-200">R$ {appt.total_amount.toFixed(2)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-zinc-500 text-[10px] block">Saldo a Pagar</span>
                        <span className="font-extrabold text-amber-400">
                          {appt.status === 'completed' ? 'QUITADO' : `R$ ${remainingBalance.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* AÇÕES RÁPIDAS EM 1 TOQUE */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800/80">
                    {/* Botão WhatsApp 1-Toque */}
                    {clientPhone ? (
                      <a
                        href={`https://wa.me/55${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${clientName}! Confirmando seu horário hoje às ${formatTime(appt.starts_at)} na barbearia. Te aguardamos!`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>💬</span> WhatsApp
                      </a>
                    ) : (
                      <button disabled className="py-2 px-3 rounded-lg bg-zinc-800/40 text-zinc-600 text-xs font-bold">
                        Sem Whats
                      </button>
                    )}

                    {/* Botão Concluir Atendimento */}
                    {appt.status !== 'completed' && appt.status !== 'cancelled' ? (
                      <button
                        onClick={() => setSettleModalAppt(appt)}
                        className="py-2 px-3 rounded-lg gold-gradient-bg text-black text-xs font-bold shadow-md hover:opacity-90 transition-opacity"
                      >
                        ✓ Concluir
                      </button>
                    ) : (
                      <span className="py-2 px-3 rounded-lg bg-zinc-900 text-zinc-500 text-xs font-semibold text-center border border-zinc-800">
                        Finalizado
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* MODAL: BAIXA RÁPIDA DE SALDO RESTANTE */}
        {settleModalAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <button
                onClick={() => setSettleModalAppt(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                ✕
              </button>

              <h3 className="text-base font-bold text-white mb-1">Quitação no Balcão</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Selecione a forma como o cliente pagou o saldo restante:
              </p>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center mb-5">
                <span className="text-xs text-zinc-500">Saldo a Pagar</span>
                <p className="text-2xl font-black text-amber-400 font-outfit">
                  R$ {Math.max(0, settleModalAppt.total_amount - (settleModalAppt.reservation_fee_paid || 0)).toFixed(2)}
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  disabled={isSettleLoading}
                  onClick={() => handleSettleBalance('cash')}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-between border border-zinc-700"
                >
                  <span>💵 Dinheiro em Mãos</span>
                  <span className="text-[10px] text-zinc-400">Computa no Caixa</span>
                </button>

                <button
                  disabled={isSettleLoading}
                  onClick={() => handleSettleBalance('card_machine')}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-between border border-zinc-700"
                >
                  <span>💳 Cartão na Maquininha</span>
                  <span className="text-[10px] text-zinc-400">Débito / Crédito</span>
                </button>

                <button
                  disabled={isSettleLoading}
                  onClick={() => handleSettleBalance('pix_tenant')}
                  className="w-full py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-between border border-zinc-700"
                >
                  <span>💠 Pix da Barbearia</span>
                  <span className="text-[10px] text-zinc-400">Chave Própria</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: LANÇAR CORTE AVULSO / WALK-IN */}
        {isWalkInOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <button
                onClick={() => setIsWalkInOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                ✕
              </button>

              <h3 className="text-base font-bold text-white mb-1">Lançar Corte Rápido / Avulso</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Cliente sem agendamento prévio que acabou de ser atendido no balcão.
              </p>

              <form onSubmit={handleWalkInSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Barbeiro que Atendeu</label>
                  <select
                    value={walkInBarberId}
                    onChange={(e) => setWalkInBarberId(e.target.value)}
                    className="input-field"
                  >
                    {barbers.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome do Cliente (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: João Silva"
                    value={walkInGuestName}
                    onChange={(e) => setWalkInGuestName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">WhatsApp (opcional)</label>
                  <input
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={walkInGuestPhone}
                    onChange={(e) => setWalkInGuestPhone(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Forma de Pagamento</label>
                  <select
                    value={walkInPaymentMethod}
                    onChange={(e) =>
                      setWalkInPaymentMethod(e.target.value as typeof walkInPaymentMethod)
                    }
                    className="input-field"
                  >
                    <option value="cash">Dinheiro em Mãos</option>
                    <option value="card_machine">Cartão na Maquininha</option>
                    <option value="pix_tenant">Pix da Barbearia</option>
                  </select>
                </div>

                <button type="submit" className="w-full gold-button py-3 text-sm font-bold mt-2">
                  Concluir e Creditar Comissão
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal de Sincronização de Calendário Externo (iCal / Google / Apple Calendar) */}
        {isCalendarModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-lg w-full p-6 border-zinc-700 bg-zinc-900/95 space-y-5">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">📅</span>
                  <h3 className="text-lg font-bold text-white">Sincronizar Agenda no Celular</h3>
                </div>
                <button
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="text-zinc-400 hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs text-zinc-300">
                <p>
                  Visualize seus cortes e agendamentos atualizados em tempo real no app nativo de calendário do seu iPhone, Android ou Outlook, com custo zero de API.
                </p>

                {loadingFeed ? (
                  <div className="p-8 text-center text-zinc-500">
                    <p>Gerando feed de calendário seguro...</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Botão 1-Clique Apple Calendar */}
                    <a
                      href={calendarWebcalUrl}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-zinc-800 to-zinc-700 hover:from-zinc-700 hover:to-zinc-600 border border-zinc-600 text-white font-bold flex items-center justify-center gap-2 text-xs transition shadow"
                    >
                      <span> Assinar no iPhone / Apple Calendar (1 Toque)</span>
                    </a>

                    {/* Link para Copiar no Google Agenda / Outlook */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-zinc-400 block">
                        URL do Feed iCal / Webcal (para Google Agenda ou Outlook):
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={calendarFeedUrl}
                          className="input-field text-xs font-mono select-all bg-zinc-950"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (calendarFeedUrl) {
                              navigator.clipboard.writeText(calendarFeedUrl)
                              setCalendarCopied(true)
                              setTimeout(() => setCalendarCopied(false), 3000)
                            }
                          }}
                          className="px-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-xs shrink-0 transition"
                        >
                          {calendarCopied ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-xl space-y-1.5 text-[11px] text-zinc-400">
                      <p className="font-bold text-zinc-300">Como adicionar no Google Agenda:</p>
                      <ol className="list-decimal pl-4 space-y-0.5">
                        <li>Acesse o Google Agenda no computador ou navegador.</li>
                        <li>Na lateral esquerda, clique no símbolo <strong>+</strong> ao lado de <em>Outras agendas</em>.</li>
                        <li>Selecione <strong>Do URL</strong> e cole o link copiado acima.</li>
                      </ol>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsCalendarModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
