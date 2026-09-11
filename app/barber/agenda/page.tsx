'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  getCurrentBarberProfile,
  getDailyAppointments,
  getBarberDailySummary,
  updateAppointmentStatus,
  quickWalkInAppointment,
  type QuickWalkInInput,
} from '@/app/actions/schedule'
import { settleAppointmentBalance } from '@/app/actions/checkout'
import { BarberGoalsWidget } from '@/components/dashboard/barber-goals'

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
  notes: string | null
  client?: { id: string; full_name: string; phone: string | null; avatar_url: string | null } | null
  appointment_services?: Array<{
    service_id: string
    service_name: string
    unit_price: number
    duration_minutes: number
  }>
}

type BarberProfile = {
  barberId: string
  tenantId: string
  fullName: string
  avatarUrl: string | null
  role: string
  commissionPercent: number
}

export default function BarberAgendaPage() {
  const [profile, setProfile] = useState<BarberProfile | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10))
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [dailySummary, setDailySummary] = useState({
    completedCount: 0,
    totalGross: 0,
    commissionTotal: 0,
    cashReceived: 0,
  })
  const [loading, setLoading] = useState(true)

  // Modals
  const [settleModalAppt, setSettleModalAppt] = useState<AppointmentItem | null>(null)
  const [isSettleLoading, setIsSettleLoading] = useState(false)
  const [isWalkInOpen, setIsWalkInOpen] = useState(false)

  // Walk-in form state
  const [walkInGuestName, setWalkInGuestName] = useState('')
  const [walkInGuestPhone, setWalkInGuestPhone] = useState('')
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<'cash' | 'card_machine' | 'pix_tenant'>('cash')
  const [isSubmittingWalkIn, setIsSubmittingWalkIn] = useState(false)

  // Carrega perfil do barbeiro
  useEffect(() => {
    async function loadBarber() {
      try {
        const b = await getCurrentBarberProfile()
        if (b) {
          setProfile(b)
        }
      } catch (err) {
        console.error('Erro ao carregar perfil do barbeiro:', err)
      }
    }
    loadBarber()
  }, [])

  // Carrega agenda e resumo do dia
  const loadAgenda = async () => {
    if (!profile) return
    setLoading(true)
    try {
      const [appts, summary] = await Promise.all([
        getDailyAppointments(profile.tenantId, selectedDate, profile.barberId),
        getBarberDailySummary(profile.tenantId, profile.barberId, selectedDate),
      ])
      setAppointments(appts as AppointmentItem[])
      setDailySummary(summary)
    } catch (err) {
      console.error('Erro ao carregar agenda:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      loadAgenda()
    }
  }, [profile, selectedDate])

  // Atalhos de Data (Hoje / Amanhã)
  const setQuickDate = (offsetDays: number) => {
    const target = new Date()
    target.setDate(target.getDate() + offsetDays)
    setSelectedDate(target.toISOString().slice(0, 10))
  }

  // Quitação no balcão
  const handleSettleBalance = async (method: 'cash' | 'card_machine' | 'pix_tenant') => {
    if (!settleModalAppt) return
    setIsSettleLoading(true)

    try {
      const res = await settleAppointmentBalance(settleModalAppt.id, method)
      if (res.success) {
        alert('Atendimento concluído e quitado! Sua comissão e selo de fidelidade foram registrados.')
        setSettleModalAppt(null)
        await loadAgenda()
      } else {
        alert(res.message)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao quitar atendimento.')
    } finally {
      setIsSettleLoading(false)
    }
  }

  // Lançamento de Corte Avulso diretamente na cadeira dele
  const handleWalkInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setIsSubmittingWalkIn(true)

    try {
      // Busca serviços do tenant
      const servRes = await fetch(`/api/tenant/services?tenantId=${profile.tenantId}`)
      const servData = await servRes.json()
      const serviceId = servData?.[0]?.id

      if (!serviceId) {
        alert('Nenhum serviço cadastrado na barbearia para lançar o corte avulso.')
        return
      }

      const input: QuickWalkInInput = {
        tenantId: profile.tenantId,
        barberId: profile.barberId,
        serviceIds: [serviceId],
        paymentMethod: walkInPaymentMethod,
        guestName: walkInGuestName || 'Cliente Balcão',
        guestPhone: walkInGuestPhone || undefined,
      }

      const res = await quickWalkInAppointment(input)
      if (res.success) {
        alert('Corte avulso finalizado! Sua comissão foi creditada com sucesso.')
        setIsWalkInOpen(false)
        setWalkInGuestName('')
        setWalkInGuestPhone('')
        await loadAgenda()
      } else {
        alert(res.message)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Falha ao lançar atendimento avulso.')
    } finally {
      setIsSubmittingWalkIn(false)
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 pb-24">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Topo do Barbeiro */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 font-outfit text-lg overflow-hidden">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile?.fullName.slice(0, 2).toUpperCase() || 'BB'
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  Minha Cadeira
                </span>
                <span className="text-[10px] text-zinc-500">•</span>
                <span className="text-[10px] text-zinc-400">
                  Comissão: {profile?.commissionPercent ?? 50}%
                </span>
              </div>
              <h1 className="text-xl font-black text-white font-outfit">
                {profile?.fullName || 'Barbeiro'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsWalkInOpen(true)}
              className="gold-button text-xs font-bold px-3 py-2 shadow-md"
            >
              + Corte Avulso
            </button>
          </div>
        </div>

        {/* Termômetro de Metas e Gamificação de Comissões */}
        <BarberGoalsWidget barberId={profile?.barberId} tenantId={profile?.tenantId} />

        {/* Barra de Filtro de Data */}
        <div className="glass-card p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQuickDate(0)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedDate === new Date().toISOString().slice(0, 10)
                  ? 'bg-amber-500 text-black shadow'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setQuickDate(1)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white transition-colors"
            >
              Amanhã
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Data:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="input-field text-xs py-1 px-2 w-auto bg-zinc-900"
            />
          </div>
        </div>

        {/* RESUMO DO DIA PARA O BARBEIRO (KPIs) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Atendimentos</span>
            <span className="text-lg font-black text-white font-outfit">
              {dailySummary.completedCount} / {appointments.length}
            </span>
          </div>

          <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Total Faturado</span>
            <span className="text-lg font-black text-zinc-200 font-outfit">
              R$ {dailySummary.totalGross.toFixed(2)}
            </span>
          </div>

          <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-amber-500 uppercase tracking-wider font-bold block">
              Minha Comissão
            </span>
            <span className="text-lg font-black text-amber-400 font-outfit">
              R$ {dailySummary.commissionTotal.toFixed(2)}
            </span>
          </div>

          <div className="p-3 bg-zinc-900/90 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-emerald-500 uppercase tracking-wider font-bold block">
              Dinheiro em Mãos
            </span>
            <span className="text-lg font-black text-emerald-400 font-outfit">
              R$ {dailySummary.cashReceived.toFixed(2)}
            </span>
          </div>
        </div>

        {/* LISTA DE AGENDAMENTOS */}
        {loading ? (
          <div className="p-12 text-center text-zinc-500">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs">Atualizando seus horários...</p>
          </div>
        ) : appointments.length === 0 ? (
          <div className="glass-card p-12 text-center text-zinc-500 space-y-3">
            <span className="text-3xl block">✂️</span>
            <p className="text-sm font-semibold text-zinc-300">Nenhum atendimento para este dia.</p>
            <p className="text-xs text-zinc-500">
              Você pode lançar um corte avulso de balcão a qualquer momento usando o botão acima.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => {
              const clientName = appt.client?.full_name || appt.guest_name || 'Cliente'
              const clientPhone = appt.client?.phone || appt.guest_phone || ''
              const servicesNames =
                appt.appointment_services?.map((s) => s.service_name).join(', ') || 'Corte de Cabelo'
              const remainingBalance = Math.max(0, appt.total_amount - (appt.reservation_fee_paid || 0))

              return (
                <div
                  key={appt.id}
                  className="glass-card p-4 border-zinc-800 flex flex-col justify-between gap-3 shadow-lg"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-black text-amber-400 font-outfit">
                          {formatTime(appt.starts_at)} - {formatTime(appt.ends_at)}
                        </span>
                        <span
                          className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${
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

                      <h3 className="text-sm font-extrabold text-white">{clientName}</h3>
                      <p className="text-xs text-zinc-400">{servicesNames}</p>
                      {appt.notes && (
                        <p className="text-[11px] text-amber-300/80 bg-amber-500/5 px-2 py-1 rounded mt-1 border border-amber-500/10">
                          Obs: {appt.notes}
                        </p>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 block">Total</span>
                      <span className="text-sm font-extrabold text-zinc-200">
                        R$ {appt.total_amount.toFixed(2)}
                      </span>
                      <div className="mt-1">
                        <span className="text-[10px] text-zinc-500 block">Saldo a Pagar</span>
                        <span
                          className={`text-xs font-bold ${
                            appt.status === 'completed' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {appt.status === 'completed' ? 'QUITADO' : `R$ ${remainingBalance.toFixed(2)}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações em 1 Toque com Targets >= 44px */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                    {/* Botão WhatsApp */}
                    {clientPhone ? (
                      <a
                        href={`https://wa.me/55${clientPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Olá ${clientName}! Aqui é o ${profile?.fullName || 'seu barbeiro'}. Confirmando seu horário hoje às ${formatTime(
                            appt.starts_at,
                          )}. Já estou preparando a cadeira para você!`,
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-11 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>💬</span> Chamar no Whats
                      </a>
                    ) : (
                      <div className="h-11 px-3 rounded-xl bg-zinc-900 text-zinc-600 text-xs font-bold flex items-center justify-center border border-zinc-800/80">
                        Sem Whats
                      </div>
                    )}

                    {/* Botão Concluir & Quitar */}
                    {appt.status !== 'completed' && appt.status !== 'cancelled' ? (
                      <button
                        onClick={() => setSettleModalAppt(appt)}
                        className="h-11 px-3 rounded-xl gold-gradient-bg text-black text-xs font-bold shadow-md hover:opacity-90 flex items-center justify-center gap-1 transition-opacity"
                      >
                        <span>✓</span> Concluir & Quitar
                      </button>
                    ) : (
                      <div className="h-11 px-3 rounded-xl bg-zinc-900 text-zinc-400 text-xs font-semibold flex items-center justify-center border border-zinc-800">
                        Atendimento Finalizado
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* MODAL: QUITAÇÃO DE BALCÃO PELO BARBEIRO */}
        {settleModalAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <button
                onClick={() => setSettleModalAppt(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                ✕
              </button>

              <h3 className="text-base font-bold text-white mb-1">Finalizar Atendimento</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Como o cliente pagou o valor restante do serviço?
              </p>

              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 text-center mb-5">
                <span className="text-xs text-zinc-500">Saldo Restante</span>
                <p className="text-2xl font-black text-amber-400 font-outfit">
                  R${' '}
                  {Math.max(
                    0,
                    settleModalAppt.total_amount - (settleModalAppt.reservation_fee_paid || 0),
                  ).toFixed(2)}
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  disabled={isSettleLoading}
                  onClick={() => handleSettleBalance('cash')}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-between border border-zinc-700"
                >
                  <span>💵 Dinheiro em Mãos</span>
                  <span className="text-[10px] text-zinc-400">Fica com você</span>
                </button>

                <button
                  disabled={isSettleLoading}
                  onClick={() => handleSettleBalance('card_machine')}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-between border border-zinc-700"
                >
                  <span>💳 Maquininha de Cartão</span>
                  <span className="text-[10px] text-zinc-400">Débito / Crédito</span>
                </button>

                <button
                  disabled={isSettleLoading}
                  onClick={() => handleSettleBalance('pix_tenant')}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold text-xs flex items-center justify-between border border-zinc-700"
                >
                  <span>💠 Pix da Barbearia</span>
                  <span className="text-[10px] text-zinc-400">Direto na conta</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: LANÇAR CORTE AVULSO NA CADEIRA DELE */}
        {isWalkInOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl">
              <button
                onClick={() => setIsWalkInOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white"
              >
                ✕
              </button>

              <h3 className="text-base font-bold text-white mb-1">Lançar Corte Avulso</h3>
              <p className="text-xs text-zinc-400 mb-4">
                Atendimento rápido para cliente sem agendamento prévio.
              </p>

              <form onSubmit={handleWalkInSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome do Cliente</label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos Andrade"
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

                <button
                  type="submit"
                  disabled={isSubmittingWalkIn}
                  className="w-full min-h-[48px] gold-button py-3 text-sm font-bold mt-2 disabled:opacity-50"
                >
                  {isSubmittingWalkIn ? 'Registrando...' : 'Concluir e Lançar Minha Comissão'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
