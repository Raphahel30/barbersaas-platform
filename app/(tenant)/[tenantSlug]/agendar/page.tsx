'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  createAppointmentHold,
  fetchAvailableSlots,
  checkAppointmentPaymentStatus,
  type CreateAppointmentHoldInput,
} from '@/app/actions/booking'
import { generateReservationFeePix } from '@/app/actions/checkout'
import { joinWaitlistAction } from '@/app/actions/waitlist'
import { checkSubscriberStatus, type PublicMonthlySubscriber } from '@/app/actions/monthly-club'
import { createClient } from '@/utils/supabase/client'
import { Crown, Sparkles, Gift, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'

type ServiceItem = {
  id: string
  name: string
  price: number
  reservation_fee: number
  duration_minutes: number
  description: string | null
}

type BarberItem = {
  id: string
  full_name: string
  avatar_url: string | null
}

type SlotItem = {
  startsAt: string
  endsAt: string
  localTime?: string
  barberId?: string
  barberName?: string
  isPromotional?: boolean
  promotionalBadge?: string | null
  discountAmount?: number
  finalPrice?: number
  finalReservationFee?: number
  requireFullFee?: boolean
}

export default function BookingFunnelPage() {
  const params = useParams()
  const tenantSlug = typeof params.tenantSlug === 'string' ? params.tenantSlug : ''

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [tenantId, setTenantId] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loadingInit, setLoadingInit] = useState(true)

  // Data Sources
  const [services, setServices] = useState<ServiceItem[]>([])
  const [barbers, setBarbers] = useState<BarberItem[]>([])

  // Selections
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState<string>('any')
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  )
  const [availableSlots, setAvailableSlots] = useState<SlotItem[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<SlotItem | null>(null)

  // Guest Details & Subscriber Recognition
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [subscriberInfo, setSubscriberInfo] = useState<PublicMonthlySubscriber | null>(null)
  const [checkingSubscriber, setCheckingSubscriber] = useState(false)
  const [isBirthday, setIsBirthday] = useState(false)


  // Hold / Checkout State
  const [holdAppointmentId, setHoldAppointmentId] = useState<string | null>(null)
  const [trackingToken, setTrackingToken] = useState<string>('')
  const [countdownSeconds, setCountdownSeconds] = useState<number>(300)
  const [reservationFee, setReservationFee] = useState<number>(0)
  const [pixData, setPixData] = useState<{
    qrCode: string | null
    qrCodeImage: string | null
    checkoutUrl?: string | null
  } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [checkingPayment, setCheckingPayment] = useState(false)
  const [paymentStatusMessage, setPaymentStatusMessage] = useState<string | null>(null)

  // Lista de Espera State
  const [waitlistShift, setWaitlistShift] = useState<'morning' | 'afternoon' | 'night' | 'any'>('any')
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null)
  const [waitlistSuccess, setWaitlistSuccess] = useState(false)

  // 1. Inicializa carregando dados do tenant
  useEffect(() => {
    async function init() {
      if (!tenantSlug) return
      try {
        const res = await fetch(`/api/tenant/resolve?slug=${tenantSlug}`)
        if (!res.ok) {
          throw new Error('Barbearia não encontrada ou inativa')
        }
        const data = await res.json()
        if (data.id) {
          setTenantId(data.id)
          setTenantName(data.name || 'Barbearia')
          setServices(data.services || [])
          setBarbers(data.barbers || [])
        } else {
          throw new Error('Dados da barbearia incompletos')
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Barbearia indisponível no momento.')
      } finally {
        setLoadingInit(false)
      }
    }
    init()
  }, [tenantSlug])

  // 2. Busca slots quando muda data ou barbeiro (Passo 3)
  useEffect(() => {
    async function loadSlots() {
      if (!tenantId || selectedServiceIds.length === 0 || step !== 3) return
      setLoadingSlots(true)
      setAvailableSlots([])
      setSelectedSlot(null)

      try {
        const targetBarber = selectedBarberId // 'any' ou id específico
        if (!targetBarber) return

        const slots = await fetchAvailableSlots(
          tenantId,
          targetBarber,
          selectedDate,
          selectedServiceIds,
        )
        setAvailableSlots(slots)
      } catch (err) {
        console.error('Erro ao buscar slots:', err)
      } finally {
        setLoadingSlots(false)
      }
    }
    loadSlots()
  }, [step, tenantId, selectedBarberId, selectedDate, selectedServiceIds])

  // 3. Cronômetro regressivo de 5 minutos do Hold Pix (Passo 4)
  useEffect(() => {
    if (step !== 4 || countdownSeconds <= 0) return
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => Math.max(0, prev - 1))
    }, 1000)
    return () => clearInterval(timer)
  }, [step, countdownSeconds])

  // 4. Polling e Supabase Realtime para confirmação real do Pix
  // Polling seguro autorizado por tracking token a cada 2.5 segundos
  useEffect(() => {
    if (step !== 4 || !holdAppointmentId) return

    let isSubscribed = true

    const interval = setInterval(async () => {
      try {
        const res = await checkAppointmentPaymentStatus(holdAppointmentId, trackingToken)
        if (!isSubscribed) return
        if (res.isConfirmed) {
          setStep(5)
        }
      } catch (err) {
        console.error('Erro no polling do Pix:', err)
      }
    }, 2500)

    return () => {
      isSubscribed = false
      clearInterval(interval)
    }
  }, [step, holdAppointmentId, trackingToken])

  // Verificação automática de Mensalista VIP ao digitar telefone
  useEffect(() => {
    const clean = guestPhone.replace(/\D/g, '')
    if (clean.length >= 10 && tenantSlug) {
      setCheckingSubscriber(true)
      checkSubscriberStatus(tenantSlug, clean)
        .then((res) => {
          if (res.isSubscriber && res.subscription) {
            setSubscriberInfo(res.subscription)
          } else {
            setSubscriberInfo(null)
          }
        })
        .catch(() => setSubscriberInfo(null))
        .finally(() => setCheckingSubscriber(false))
    } else {
      setSubscriberInfo(null)
    }
  }, [guestPhone, tenantSlug])

  // Cálculo acumulado de valor e duração com motor de benefícios
  const selectedServices = services.filter((s) => selectedServiceIds.includes(s.id))
  const basePrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0)
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_minutes, 0)
  const baseReservationFee = selectedServices.reduce((sum, s) => sum + Number(s.reservation_fee), 0)

  // Descontos aplicados
  const isSubscriberCovered = Boolean(subscriberInfo && subscriberInfo.cuts_remaining > 0)
  let discountAmount = 0
  let discountLabel = ''

  if (isSubscriberCovered && subscriberInfo) {
    discountAmount = basePrice // 100% coberto pelo clube
    discountLabel = `Clube VIP (${subscriberInfo.plan_name})`
  } else if (isBirthday) {
    discountAmount = Math.round(basePrice * 0.2) // 20% Aniversariante
    discountLabel = 'Bônus Aniversariante (20% OFF)'
  }

  const totalPrice = Math.max(0, basePrice - discountAmount)
  const totalReservationFee = isSubscriberCovered ? 0 : baseReservationFee

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  // Criação do Hold Provisório com Transação Atômica no Backend
  const handleProceedToCheckout = async () => {
    setErrorMessage('')
    if (!guestName.trim() || !guestPhone.trim()) {
      setErrorMessage('Por favor, informe seu nome e WhatsApp para contato.')
      return
    }

    if (!selectedSlot) {
      setErrorMessage('Selecione um horário disponível.')
      return
    }

    setIsProcessing(true)

    const effectiveBarberId =
      selectedSlot.barberId || (selectedBarberId === 'any' ? barbers[0]?.id : selectedBarberId)
    if (!effectiveBarberId) {
      setErrorMessage('Nenhum profissional disponível para este horário.')
      setIsProcessing(false)
      return
    }

    try {
      const holdInput: CreateAppointmentHoldInput = {
        tenantId,
        barberId: effectiveBarberId,
        serviceIds: selectedServiceIds,
        startsAt: selectedSlot.startsAt,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        notes: notes.trim()
          ? `${notes.trim()}${isSubscriberCovered ? ' [MENSALISTA VIP]' : ''}${isBirthday ? ' [ANIVERSARIANTE]' : ''}`
          : isSubscriberCovered
          ? '[MENSALISTA VIP]'
          : isBirthday
          ? '[ANIVERSARIANTE]'
          : undefined,
      }

      const holdRes = await createAppointmentHold(holdInput)
      if (!holdRes.success) {
        setErrorMessage(holdRes.message || 'Horário indisponível ou já reservado.')
        setIsProcessing(false)
        return
      }

      setHoldAppointmentId(holdRes.data.appointmentId)
      setTrackingToken(holdRes.data.trackingToken || '')
      setReservationFee(holdRes.data.reservationFee)
      setCountdownSeconds(holdRes.data.remainingSeconds || 300)

      // Se o backend confirmou diretamente (mensalista, cortesia ou sinal zero), avança para a tela de confirmação
      if (
        holdRes.data.status === 'confirmed' ||
        !holdRes.data.requiresPayment ||
        holdRes.data.reservationFee <= 0
      ) {
        setStep(5)
        return
      }

      // Se há sinal de reserva com Pix, gera a cobrança com bloqueio em caso de falha
      const pixRes = await generateReservationFeePix(holdRes.data.appointmentId)
      if (!pixRes.success || !pixRes.data?.qrCode) {
        setErrorMessage(
          pixRes.message ||
            'Não foi possível gerar a chave Pix do sinal no momento. Por favor, tente novamente.',
        )
        setIsProcessing(false)
        return
      }

      setPixData({
        qrCode: pixRes.data.qrCode,
        qrCodeImage: pixRes.data.qrCodeImage,
        checkoutUrl: pixRes.data.checkoutUrl,
      })

      setStep(4)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Falha ao processar reserva.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Verificação manual com validação real no banco de dados
  const handleManualPaymentCheck = async () => {
    if (!holdAppointmentId) return
    setCheckingPayment(true)
    setPaymentStatusMessage('Verificando compensação do Pix no banco...')
    try {
      const res = await checkAppointmentPaymentStatus(holdAppointmentId, trackingToken)
      if (res.isConfirmed) {
        setStep(5)
      } else if (res.status === 'expired') {
        setErrorMessage('O tempo limite de 5 minutos para pagamento do Pix expirou. Por favor, escolha um novo horário.')
      } else {
        setPaymentStatusMessage('Pagamento ainda não detectado. Aguarde alguns segundos após confirmar no seu aplicativo bancário.')
        setTimeout(() => setPaymentStatusMessage(null), 5000)
      }
    } catch {
      setPaymentStatusMessage('Erro ao verificar status. Tente novamente em instantes.')
    } finally {
      setCheckingPayment(false)
    }
  }

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const minutesRemaining = Math.floor(countdownSeconds / 60)
  const secondsRemaining = countdownSeconds % 60


  const handleJoinWaitlist = async () => {
    if (!guestPhone.trim() || guestPhone.replace(/\D/g, '').length < 8) {
      setWaitlistMessage('Por favor, informe seu WhatsApp abaixo para receber o aviso de vaga.')
      setWaitlistSuccess(false)
      return
    }
    setJoiningWaitlist(true)
    setWaitlistMessage(null)
    try {
      const res = await joinWaitlistAction({
        tenantId,
        barberId: selectedBarberId === 'any' ? null : selectedBarberId,
        requestedDate: selectedDate,
        preferredShift: waitlistShift,
        serviceIds: selectedServiceIds,
        guestName,
        guestPhone,
      })
      setWaitlistMessage(res.message)
      setWaitlistSuccess(res.success)
    } catch {
      setWaitlistMessage('Falha ao entrar na lista de espera. Tente novamente.')
      setWaitlistSuccess(false)
    } finally {
      setJoiningWaitlist(false)
    }
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen max-w-lg mx-auto bg-zinc-950/90 border-x border-zinc-900 shadow-2xl flex flex-col justify-center items-center p-6 text-zinc-100">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-zinc-400">Carregando serviços e horários...</p>
      </div>
    )
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen max-w-lg mx-auto bg-zinc-950/90 border-x border-zinc-900 shadow-2xl flex flex-col justify-center items-center p-6 text-center text-zinc-100">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl mb-4">
          ⚠️
        </div>
        <h1 className="text-lg font-bold text-white mb-2">Barbearia Não Encontrada</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Não conseguimos localizar este estabelecimento ou a página está temporariamente indisponível.
        </p>
        <Link
          href={`/${tenantSlug}`}
          className="px-5 py-2.5 rounded-xl gold-gradient-bg text-black font-semibold text-xs transition-transform active:scale-95"
        >
          Voltar ao Início
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-zinc-950/90 border-x border-zinc-900 shadow-2xl flex flex-col justify-between p-4 sm:p-6 text-zinc-100">
      {/* Topo do Funil */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-6">
          <Link
            href={`/${tenantSlug}`}
            className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
          >
            ← Voltar
          </Link>
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
            Etapa {step} de 5
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full bg-zinc-800 h-1.5 rounded-full mb-6 overflow-hidden">
          <div
            className="h-full gold-gradient-bg transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {errorMessage && (
          <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {errorMessage}
          </div>
        )}

        {/* PASSO 1: SELEÇÃO DE SERVIÇOS */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">Escolha os Serviços</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Você pode selecionar mais de um serviço para o mesmo agendamento.
              </p>
            </div>

            <div className="space-y-2.5">
              {services.map((s) => {
                const isSelected = selectedServiceIds.includes(s.id)
                return (
                  <div
                    key={s.id}
                    onClick={() => toggleService(s.id)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-md'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">{s.name}</h3>
                      {s.description && (
                        <p className="text-xs text-zinc-400 line-clamp-1">{s.description}</p>
                      )}
                      <span className="text-[11px] text-zinc-500">⏱ {s.duration_minutes} minutos</span>
                    </div>

                    <div className="text-right">
                      <p className="text-sm font-extrabold text-amber-400 font-outfit">
                        R$ {Number(s.price).toFixed(2).replace('.', ',')}
                      </p>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ml-auto mt-1 text-xs font-bold ${
                          isSelected ? 'bg-amber-500 text-black border-amber-500' : 'border-zinc-700'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 2: ESCOLHA DO BARBEIRO */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">Quem vai te atender?</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Escolha seu barbeiro favorito ou deixe o sistema escolher o primeiro livre.
              </p>
            </div>

            <div className="space-y-2.5">
              <div
                onClick={() => setSelectedBarberId('any')}
                className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                  selectedBarberId === 'any'
                    ? 'bg-amber-500/10 border-amber-500'
                    : 'bg-zinc-900/60 border-zinc-800'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 font-extrabold flex items-center justify-center text-lg">
                  ⚡
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Qualquer Profissional</h3>
                  <p className="text-xs text-zinc-400">Primeiro horário disponível com qualquer barbeiro</p>
                </div>
              </div>

              {barbers.map((b) => {
                const isSelected = selectedBarberId === b.id
                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBarberId(b.id)}
                    className={`p-4 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500'
                        : 'bg-zinc-900/60 border-zinc-800'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-zinc-300">
                      {b.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.avatar_url} alt={b.full_name} className="w-full h-full object-cover" />
                      ) : (
                        b.full_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100">{b.full_name}</h3>
                      <p className="text-xs text-amber-500 font-medium">Barbeiro Especialista</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PASSO 3: GRADE DE HORÁRIOS DISPONÍVEIS */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-xl font-bold text-white">Escolha o Horário</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Filtrando almoço, feriados e intervalos de higienização.
              </p>
            </div>

            {/* Seletor de Data */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Dia do Atendimento</label>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field font-semibold"
              />
            </div>

            {/* Grid de Horários */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">Horários Livres</label>

              {loadingSlots ? (
                <div className="p-8 text-center text-zinc-500">
                  <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs">Verificando agenda em tempo real...</p>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="p-6 text-center bg-zinc-900/90 rounded-2xl border-2 border-amber-500/30 space-y-4">
                  <div>
                    <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                      Agenda Lotada
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">
                      Todos os horários deste dia estão preenchidos
                    </h3>
                    <p className="text-xs text-zinc-400 mt-1">
                      Não se preocupe! Entre na nossa Lista de Espera Inteligente. Se houver qualquer cancelamento, avisamos você com prioridade exclusiva de 10 minutos.
                    </p>
                  </div>

                  <div className="space-y-2 text-left">
                    <label className="text-[11px] font-semibold text-zinc-400 block">
                      Turno de Preferência:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'any', label: 'Qualquer' },
                        { id: 'morning', label: 'Manhã' },
                        { id: 'afternoon', label: 'Tarde' },
                        { id: 'night', label: 'Noite' },
                      ].map((shift) => (
                        <button
                          key={shift.id}
                          type="button"
                          onClick={() => setWaitlistShift(shift.id as any)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition ${
                            waitlistShift === shift.id
                              ? 'bg-amber-500 text-black border-amber-500 font-bold'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                          }`}
                        >
                          {shift.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {waitlistMessage && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium text-left ${
                        waitlistSuccess
                          ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                          : 'bg-red-950/60 border border-red-800/80 text-red-300'
                      }`}
                    >
                      {waitlistMessage}
                    </div>
                  )}

                  {!waitlistSuccess ? (
                    <button
                      type="button"
                      onClick={handleJoinWaitlist}
                      disabled={joiningWaitlist}
                      className="w-full py-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-extrabold text-xs rounded-xl transition shadow-lg shadow-amber-500/20"
                    >
                      {joiningWaitlist ? 'Registrando na fila...' : 'Entrar na Lista de Espera deste dia'}
                    </button>
                  ) : (
                    <div className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5 py-1">
                      <span>✓ Você está na Lista de Espera deste dia!</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto pr-1">
                  {availableSlots.map((slot) => {
                    const isSelected = selectedSlot?.startsAt === slot.startsAt
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                          isSelected
                            ? 'bg-amber-500 text-black border-amber-500 shadow-md font-extrabold'
                            : slot.isPromotional
                            ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 hover:border-amber-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:border-zinc-600'
                        }`}
                      >
                        <span>{formatTime(slot.startsAt)}</span>
                        {slot.isPromotional && (
                          <span
                            className={`text-[9px] font-black uppercase px-1 rounded tracking-tighter ${
                              isSelected ? 'bg-black text-amber-400' : 'bg-amber-500 text-slate-950'
                            }`}
                          >
                            ⚡ Promo
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Dados do Cliente Visitante */}
            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-amber-500">Seus Dados de Contato</h2>
              <div className="grid grid-cols-1 gap-2.5">
                <input
                  type="text"
                  placeholder="Seu Nome Completo *"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="input-field text-sm"
                />
                <input
                  type="text"
                  placeholder="WhatsApp com DDD *"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="input-field text-sm"
                />
                <input
                  type="text"
                  placeholder="Observação para o barbeiro (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input-field text-sm"
                />
              </div>

              {/* VIP Subscriber Card Banner */}
              {subscriberInfo && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#1c1813] to-[#2a2217] border border-[#d4af37]/50 shadow-lg space-y-1">
                  <div className="flex items-center gap-2 text-[#d4af37] text-xs font-bold font-cinzel">
                    <Crown className="w-4 h-4 text-[#d4af37]" />
                    <span>Membro VIP Reconhecido!</span>
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    Plano: <strong>{subscriberInfo.plan_name}</strong> • Saldo:{' '}
                    <strong className="text-emerald-400 font-bold">
                      {subscriberInfo.cuts_remaining} cortes restantes
                    </strong>
                  </p>
                  <p className="text-[10px] text-amber-300">
                    ✨ Este agendamento será 100% coberto pelo seu plano (Sem cobrança de sinal!).
                  </p>
                </div>
              )}

              {/* Aniversariante Toggle */}
              {!subscriberInfo && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-zinc-800 cursor-pointer hover:border-amber-500/40 transition">
                  <input
                    type="checkbox"
                    checked={isBirthday}
                    onChange={(e) => setIsBirthday(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <Gift className="w-3.5 h-3.5 text-amber-400" />
                      É meu aniversário este mês!
                    </span>
                    <span className="text-[10px] text-zinc-400 block">
                      Receba 20% de desconto especial na comemoração do seu dia.
                    </span>
                  </div>
                </label>
              )}
            </div>
          </div>
        )}


        {/* PASSO 4: CHECKOUT DO SINAL (HOLD PIX 5 MINUTOS) */}
        {step === 4 && (
          <div className="space-y-5 text-center">
            {countdownSeconds <= 0 ? (
              <div className="p-6 rounded-2xl bg-red-950/40 border border-red-500/40 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-xl mx-auto font-bold">
                  !
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Tempo de Reserva Expirado</h3>
                  <p className="text-xs text-zinc-300 mt-1">
                    O prazo de 5 minutos para confirmação do sinal expirou e o horário foi liberado.
                    Por favor, selecione seu horário novamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setHoldAppointmentId(null)
                    setCountdownSeconds(300)
                    setSelectedSlot(null)
                    setStep(3)
                  }}
                  className="w-full gold-button py-2.5 text-xs font-bold"
                >
                  Selecionar Novo Horário
                </button>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">
                    Horário Pré-Reservado
                  </p>
                  <div className="text-3xl font-black text-white font-outfit">
                    {String(minutesRemaining).padStart(2, '0')}:{String(secondsRemaining).padStart(2, '0')}
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Seu horário está bloqueado e seguro por 5 minutos enquanto conclui a confirmação.
                  </p>
                </div>

                {reservationFee > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-white">Sinal de Reserva: R$ {reservationFee.toFixed(2)}</h3>
                      <p className="text-xs text-zinc-400">
                        O restante será pago diretamente no balcão da barbearia após o corte.
                      </p>
                    </div>

                    {pixData?.qrCodeImage && (
                      <div className="max-w-[220px] mx-auto p-3 bg-white rounded-2xl shadow-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={pixData.qrCodeImage} alt="QR Code Pix" className="w-full h-auto" />
                      </div>
                    )}

                    {pixData?.qrCode && (
                      <div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(pixData.qrCode || '')
                            alert('Código Pix Copia e Cola copiado com sucesso!')
                          }}
                          className="w-full py-2.5 px-4 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-200 hover:bg-zinc-800"
                        >
                          Copiar Código Pix Copia e Cola
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-6 bg-zinc-900/60 rounded-xl border border-zinc-800">
                    <p className="text-emerald-400 font-bold text-sm">Reserva sem Taxa de Sinal!</p>
                    <p className="text-xs text-zinc-400 mt-1">
                      O valor total de R$ {totalPrice.toFixed(2)} será pago no balcão da barbearia.
                    </p>
                  </div>
                )}

                {/* Status de Polling & Feedback */}
                <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>Aguardando identificação do pagamento pelo banco...</span>
                </div>

                {paymentStatusMessage && (
                  <p className="text-xs text-amber-300 font-medium bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl">
                    {paymentStatusMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleManualPaymentCheck}
                  disabled={checkingPayment}
                  className="w-full gold-button py-3 text-sm font-bold flex items-center justify-center gap-2"
                >
                  {checkingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span>Verificando compensação do Pix...</span>
                    </>
                  ) : (
                    <span>Já Realizei o Pagamento / Confirmar</span>
                  )}
                </button>
              </>
            )}
          </div>
        )}

        {/* PASSO 5: TELA FINAL DE CONFIRMAÇÃO & WHATSAPP 1-TOQUE */}
        {step === 5 && (
          <div className="space-y-6 text-center py-6">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-3xl mx-auto">
              ✓
            </div>

            <div>
              <h1 className="text-2xl font-black text-white">Agendamento Confirmado!</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Esperamos por você na <span className="text-amber-400 font-bold">{tenantName}</span>.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-500">Cliente:</span>
                <span className="font-bold text-zinc-200">{guestName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Data e Horário:</span>
                <span className="font-bold text-amber-400">
                  {new Date(selectedDate).toLocaleDateString('pt-BR')} às {selectedSlot ? formatTime(selectedSlot.startsAt) : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Serviços:</span>
                <span className="font-bold text-zinc-200">{selectedServices.map((s) => s.name).join(', ')}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-500">Valor Total:</span>
                <span className="font-extrabold text-white">R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* BOTÃO 1-TOQUE WHATSAPP (wa.me) */}
            <div>
              <a
                href={`https://wa.me/55${guestPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Olá ${guestName}! Seu agendamento na ${tenantName} para o dia ${new Date(selectedDate).toLocaleDateString('pt-BR')} às ${selectedSlot ? formatTime(selectedSlot.startsAt) : ''} foi confirmado com sucesso!`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                <span>💬</span> Enviar Confirmação no WhatsApp
              </a>
            </div>

            <Link
              href={`/${tenantSlug}`}
              className="inline-block text-xs text-zinc-400 hover:text-white underline pt-2"
            >
              Voltar para a página inicial
            </Link>
          </div>
        )}
      </div>

      {/* Barra Inferior com Totalizador e Botão de Avanço (Passos 1 a 3) */}
      {step <= 3 && (
        <div className="border-t border-zinc-800 pt-4 mt-6">
          <div className="flex items-center justify-between mb-3 text-xs">
            <span className="text-zinc-400">
              {selectedServices.length} {selectedServices.length === 1 ? 'serviço' : 'serviços'} (⏱ {totalDuration} min)
            </span>
            <span className="font-extrabold text-amber-400 text-base font-outfit">
              Total: R$ {totalPrice.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((prev) => (prev - 1) as typeof step)}
                className="py-3 px-4 rounded-xl border border-zinc-700 text-zinc-300 font-bold text-xs"
              >
                Voltar
              </button>
            )}

            <button
              type="button"
              disabled={
                (step === 1 && selectedServiceIds.length === 0) ||
                (step === 3 && (!selectedSlot || !guestName.trim() || !guestPhone.trim())) ||
                isProcessing
              }
              onClick={() => {
                if (step === 1) setStep(2)
                else if (step === 2) setStep(3)
                else if (step === 3) handleProceedToCheckout()
              }}
              className="flex-1 gold-button py-3.5 text-xs sm:text-sm font-bold"
            >
              {isProcessing
                ? 'Reservando...'
                : step === 3
                  ? totalReservationFee > 0
                    ? `Pagar Sinal (R$ ${totalReservationFee.toFixed(2)})`
                    : 'Confirmar Agendamento'
                  : 'Continuar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
