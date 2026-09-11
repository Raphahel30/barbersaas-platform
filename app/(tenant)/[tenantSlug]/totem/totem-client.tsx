'use client'

import { useState, useEffect } from 'react'
import {
  Smartphone,
  UserCheck,
  Clock,
  Scissors,
  CheckCircle2,
  Lock,
  Unlock,
  Maximize2,
  ArrowLeft,
  Calendar,
  AlertCircle,
  Users,
  Sparkles,
} from 'lucide-react'
import {
  searchTodayAppointmentsByPhoneAction,
  checkInAppointmentAction,
  createWalkInQueueTicketAction,
  type TodayAppointmentMatch,
} from '@/app/actions/totem'

interface TotemClientProps {
  tenantId: string
  tenantSlug: string
  tenantName: string
  logoUrl: string | null
  services: { id: string; name: string; price: number; duration_minutes: number }[]
  barbers: { id: string; full_name: string; avatar_url: string | null }[]
}

type ScreenMode = 'home' | 'checkin_keypad' | 'checkin_results' | 'walkin_form' | 'success'

export default function TotemClient({
  tenantId,
  tenantSlug,
  tenantName,
  logoUrl,
  services,
  barbers,
}: TotemClientProps) {
  const [mode, setMode] = useState<ScreenMode>('home')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')

  // Check-in state
  const [phoneInput, setPhoneInput] = useState<string>('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<TodayAppointmentMatch[]>([])
  const [selectedAppointment, setSelectedAppointment] = useState<TodayAppointmentMatch | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Walk-in state
  const [walkInName, setWalkInName] = useState<string>('')
  const [walkInPhone, setWalkInPhone] = useState<string>('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null)
  const [submittingWalkIn, setSubmittingWalkIn] = useState(false)

  // Success screen state
  const [successMessage, setSuccessMessage] = useState<string>('')
  const [countdown, setCountdown] = useState<number>(6)

  // Kiosk PIN lock state
  const [isLocked, setIsLocked] = useState<boolean>(true)
  const [showPinModal, setShowPinModal] = useState<boolean>(false)
  const [enteredPin, setEnteredPin] = useState<string>('')
  const [pinError, setPinError] = useState<boolean>(false)
  const KIOSK_PIN = '1234'

  // Relógio em tempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setCurrentDate(
        now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      )
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-reset na tela de sucesso
  useEffect(() => {
    if (mode === 'success') {
      setCountdown(6)
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            resetAll()
            return 6
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [mode])

  const resetAll = () => {
    setMode('home')
    setPhoneInput('')
    setSearchResults([])
    setSelectedAppointment(null)
    setErrorMessage(null)
    setWalkInName('')
    setWalkInPhone('')
    setSelectedServiceIds([])
    setSelectedBarberId(null)
  }

  // Teclado numérico virtual para o tablet
  const handleKeypadPress = (digit: string) => {
    if (phoneInput.length < 11) {
      setPhoneInput((prev) => prev + digit)
    }
  }

  const handleKeypadBackspace = () => {
    setPhoneInput((prev) => prev.slice(0, -1))
  }

  const formatPhone = (val: string) => {
    const clean = val.replace(/\D/g, '')
    if (clean.length <= 2) return clean
    if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`
  }

  const handleSearchCheckIn = async () => {
    if (phoneInput.length < 8) {
      setErrorMessage('Digite seu telefone completo com DDD.')
      return
    }
    setSearching(true)
    setErrorMessage(null)
    try {
      const res = await searchTodayAppointmentsByPhoneAction(tenantId, phoneInput)
      if (!res.success || res.appointments.length === 0) {
        setErrorMessage(
          'Nenhum agendamento encontrado para hoje com este número. Deseja entrar na fila como novo cliente?'
        )
      } else {
        setSearchResults(res.appointments)
        setMode('checkin_results')
      }
    } catch {
      setErrorMessage('Erro ao consultar agendamento. Tente novamente.')
    } finally {
      setSearching(false)
    }
  }

  const handleConfirmArrival = async (appt: TodayAppointmentMatch) => {
    setSearching(true)
    try {
      const res = await checkInAppointmentAction(appt.id)
      if (res.success) {
        setSuccessMessage(
          `Presença confirmada! O barbeiro ${res.barberName || appt.barberName} foi avisado da sua chegada. Sente-se e fique à vontade!`
        )
        setMode('success')
      } else {
        setErrorMessage(res.message)
      }
    } catch {
      setErrorMessage('Falha ao registrar check-in.')
    } finally {
      setSearching(false)
    }
  }

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    )
  }

  const handleCreateWalkIn = async () => {
    if (!walkInName.trim()) {
      setErrorMessage('Por favor, informe seu nome.')
      return
    }
    if (walkInPhone.replace(/\D/g, '').length < 8) {
      setErrorMessage('Informe seu telefone de contato.')
      return
    }
    if (selectedServiceIds.length === 0) {
      setErrorMessage('Selecione pelo menos um serviço desejado.')
      return
    }

    setSubmittingWalkIn(true)
    setErrorMessage(null)
    try {
      const res = await createWalkInQueueTicketAction({
        tenantSlugOrId: tenantId,
        clientName: walkInName,
        clientPhone: walkInPhone,
        barberId: selectedBarberId,
        serviceIds: selectedServiceIds,
      })
      if (res.success) {
        setSuccessMessage(
          `Tudo pronto, ${walkInName.split(' ')[0]}! Você entrou na fila de atendimento. Acompanhe a chamada na tela da TV!`
        )
        setMode('success')
      } else {
        setErrorMessage(res.message)
      }
    } catch {
      setErrorMessage('Falha ao gerar sua senha. Peça ajuda na recepção.')
    } finally {
      setSubmittingWalkIn(false)
    }
  }

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const handlePinSubmit = () => {
    if (enteredPin === KIOSK_PIN) {
      setIsLocked(false)
      setShowPinModal(false)
      setEnteredPin('')
      setPinError(false)
    } else {
      setPinError(true)
      setEnteredPin('')
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-black">
      {/* Barra de Topo do Totem */}
      <header className="p-6 border-b border-zinc-800/80 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {logoUrl ? (
            <img src={logoUrl} alt={tenantName} className="h-12 w-12 rounded-xl object-cover border border-amber-500/30" />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Scissors className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-wider text-amber-400 uppercase">{tenantName}</h1>
            <p className="text-xs text-zinc-400 capitalize">{currentDate}</p>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="text-right">
            <span className="text-2xl font-mono font-black text-zinc-100 tracking-wider">{currentTime}</span>
            <div className="flex items-center justify-end space-x-1 text-[10px] text-emerald-400 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>TOTEM ONLINE</span>
            </div>
          </div>

          <div className="flex items-center space-x-2 pl-4 border-l border-zinc-800">
            <button
              onClick={handleToggleFullscreen}
              title="Tela Cheia"
              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition text-zinc-300 active:scale-95"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                if (isLocked) setShowPinModal(true)
                else setIsLocked(true)
              }}
              title={isLocked ? 'Modo Quiosque Travado' : 'Destravar Configurações'}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition text-zinc-300 active:scale-95"
            >
              {isLocked ? <Lock className="w-5 h-5 text-amber-500" /> : <Unlock className="w-5 h-5 text-emerald-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Central Interativo */}
      <main className="flex-1 flex flex-col justify-center items-center p-8 max-w-5xl mx-auto w-full">
        {/* TELA 1: HOME (ESCOLHA PRINCIPAL) */}
        {mode === 'home' && (
          <div className="w-full flex flex-col items-center text-center space-y-10 animate-fade-in">
            <div className="space-y-3">
              <span className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-widest inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Autoatendimento Presencial
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                Seja bem-vindo à nossa barbearia!
              </h2>
              <p className="text-lg text-zinc-400 max-w-xl mx-auto">
                Toque na tela abaixo para confirmar sua chegada ou entrar na fila de espera agora mesmo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl">
              {/* Botão Check-in */}
              <button
                onClick={() => {
                  setErrorMessage(null)
                  setPhoneInput('')
                  setMode('checkin_keypad')
                }}
                className="group p-8 rounded-3xl bg-gradient-to-b from-zinc-800/80 to-zinc-900 border-2 border-zinc-700 hover:border-amber-500 transition-all duration-300 shadow-2xl flex flex-col items-center text-center space-y-5 active:scale-[0.98]"
              >
                <div className="w-20 h-20 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <UserCheck className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors">
                    Já tenho Agendamento
                  </h3>
                  <p className="text-sm text-zinc-400 mt-2">
                    Faça seu check-in digitando seu celular e avise seu barbeiro que você chegou.
                  </p>
                </div>
                <span className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-base tracking-wide transition shadow-lg shadow-amber-500/20">
                  Fazer Check-in
                </span>
              </button>

              {/* Botão Walk-in (Sem horário marcado) */}
              <button
                onClick={() => {
                  setErrorMessage(null)
                  setMode('walkin_form')
                }}
                className="group p-8 rounded-3xl bg-gradient-to-b from-zinc-800/80 to-zinc-900 border-2 border-zinc-700 hover:border-emerald-500 transition-all duration-300 shadow-2xl flex flex-col items-center text-center space-y-5 active:scale-[0.98]"
              >
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                  <Users className="w-10 h-10" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">
                    Não tenho Horário Marcado
                  </h3>
                  <p className="text-sm text-zinc-400 mt-2">
                    Escolha os serviços desejados e entre na fila de atendimento para a próxima vaga livre.
                  </p>
                </div>
                <span className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-base tracking-wide transition shadow-lg shadow-emerald-500/20">
                  Entrar na Fila
                </span>
              </button>
            </div>
          </div>
        )}

        {/* TELA 2: CHECK-IN COM TECLADO NUMÉRICO */}
        {mode === 'checkin_keypad' && (
          <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode('home')}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition flex items-center gap-1.5 text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <h3 className="text-lg font-bold text-amber-400">Check-in de Chegada</h3>
            </div>

            <div className="text-center space-y-2">
              <p className="text-sm text-zinc-400">Digite seu número de telefone com DDD:</p>
              <div className="h-14 bg-zinc-950 border border-zinc-700 rounded-2xl flex items-center justify-center px-4 text-2xl font-mono font-bold tracking-widest text-amber-300">
                {phoneInput ? formatPhone(phoneInput) : '(00) 00000-0000'}
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Teclado Numérico Touch-Screen */}
            <div className="grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Limpar', '0', '⌫'].map((key) => {
                const isClear = key === 'Limpar'
                const isBack = key === '⌫'
                return (
                  <button
                    key={key}
                    onClick={() => {
                      if (isClear) setPhoneInput('')
                      else if (isBack) handleKeypadBackspace()
                      else handleKeypadPress(key)
                    }}
                    className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 flex items-center justify-center ${
                      isClear || isBack
                        ? 'bg-zinc-800 text-zinc-400 text-sm hover:bg-zinc-700'
                        : 'bg-zinc-800/90 hover:bg-zinc-700 text-white shadow'
                    }`}
                  >
                    {key}
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleSearchCheckIn}
              disabled={searching || phoneInput.length < 8}
              className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold rounded-2xl text-lg transition shadow-xl shadow-amber-500/20"
            >
              {searching ? 'Localizando agendamento...' : 'Buscar Meu Agendamento'}
            </button>
          </div>
        )}

        {/* TELA 3: RESULTADOS DO AGENDAMENTO PARA CHECK-IN */}
        {mode === 'checkin_results' && (
          <div className="w-full max-w-xl bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setMode('checkin_keypad')}
                className="p-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition flex items-center gap-1.5 text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Digitar outro número
              </button>
              <h3 className="text-lg font-bold text-amber-400">Confirmar Presença</h3>
            </div>

            <div className="space-y-4">
              {searchResults.map((appt) => {
                const isArrived = appt.status === 'arrived'
                return (
                  <div
                    key={appt.id}
                    className="p-6 rounded-2xl bg-zinc-950 border-2 border-zinc-800 hover:border-amber-500/60 transition space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                          Agendado para Hoje
                        </span>
                        <h4 className="text-xl font-bold text-white mt-1">{appt.clientName}</h4>
                        <p className="text-sm text-zinc-400">
                          Barbeiro: <strong className="text-zinc-200">{appt.barberName}</strong>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-mono font-bold text-amber-400">
                          {new Date(appt.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {appt.serviceNames.map((s, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-300 font-medium">
                          {s}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => handleConfirmArrival(appt)}
                      disabled={searching}
                      className={`w-full py-4 rounded-xl font-bold text-base transition flex items-center justify-center gap-2 ${
                        isArrived
                          ? 'bg-zinc-800 text-emerald-400 border border-emerald-500/30'
                          : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      {isArrived ? 'Chegada já confirmada (Aguardando)' : 'Cheguei! Confirmar Presença'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* TELA 4: FORMULÁRIO DE ENTRADA NA FILA (WALK-IN) */}
        {mode === 'walkin_form' && (
          <div className="w-full max-w-2xl bg-zinc-900/95 border border-zinc-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <button
                onClick={() => setMode('home')}
                className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition flex items-center gap-1.5 text-sm"
              >
                <ArrowLeft className="w-4 h-4" /> Cancelar
              </button>
              <h3 className="text-xl font-bold text-emerald-400">Entrar na Fila Imediata</h3>
            </div>

            {errorMessage && (
              <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Seu Nome
                </label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-zinc-700 rounded-xl px-4 text-white text-base focus:border-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Seu Celular (WhatsApp)
                </label>
                <input
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-zinc-700 rounded-xl px-4 text-white text-base focus:border-emerald-500 outline-none font-mono"
                />
              </div>
            </div>

            {/* Seleção de Serviços */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Escolha o(s) Serviço(s)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
                {services.map((svc) => {
                  const isSelected = selectedServiceIds.includes(svc.id)
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => toggleServiceSelection(svc.id)}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-white'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      <div className="font-semibold text-sm line-clamp-1">{svc.name}</div>
                      <div className="flex items-center justify-between mt-2 text-xs">
                        <span className="text-emerald-400 font-bold">R$ {Number(svc.price).toFixed(2)}</span>
                        <span className="text-zinc-500">{svc.duration_minutes}m</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Seleção de Barbeiro Opcional */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block">
                Preferência de Barbeiro
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedBarberId(null)}
                  className={`p-2.5 rounded-xl border text-center transition ${
                    selectedBarberId === null
                      ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <span className="text-xs">Primeiro Disponível</span>
                </button>
                {barbers.map((b) => {
                  const isSelected = selectedBarberId === b.id
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBarberId(b.id)}
                      className={`p-2.5 rounded-xl border text-center transition truncate ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <span className="text-xs block truncate">{b.full_name.split(' ')[0]}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={handleCreateWalkIn}
              disabled={submittingWalkIn}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl text-lg transition shadow-xl shadow-emerald-500/20 active:scale-[0.99]"
            >
              {submittingWalkIn ? 'Gerando sua senha...' : 'Confirmar e Entrar na Fila'}
            </button>
          </div>
        )}

        {/* TELA 5: SUCESSO / CONFIRMAÇÃO */}
        {mode === 'success' && (
          <div className="w-full max-w-lg bg-zinc-900 border border-emerald-500/40 rounded-3xl p-10 shadow-2xl text-center space-y-6 animate-scale-up">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
              <CheckCircle2 className="w-14 h-14" />
            </div>

            <div className="space-y-3">
              <h3 className="text-3xl font-extrabold text-white">Presença Registrada!</h3>
              <p className="text-zinc-300 text-base leading-relaxed">{successMessage}</p>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-500">
              <span>Voltando para o início em {countdown}s...</span>
              <button
                onClick={resetAll}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition"
              >
                Concluir Agora
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé institucional com aviso de privacidade */}
      <footer className="p-4 border-t border-zinc-900 text-center text-xs text-zinc-500">
        Totem de Autoatendimento Seguro • {tenantName} • Desenvolvido com tecnologia BarberSaaS
      </footer>

      {/* Modal de Desbloqueio por PIN do Kiosk */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-white text-base">Modo Quiosque</h4>
              <p className="text-xs text-zinc-400 mt-1">Digite o PIN do administrador (padrão: 1234):</p>
            </div>

            <input
              type="password"
              maxLength={6}
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              className="w-full h-12 text-center text-2xl tracking-widest font-mono bg-zinc-950 border border-zinc-700 rounded-xl text-white outline-none focus:border-amber-500"
              placeholder="••••"
            />

            {pinError && <p className="text-xs text-red-400">PIN incorreto. Tente novamente.</p>}

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => {
                  setShowPinModal(false)
                  setEnteredPin('')
                  setPinError(false)
                }}
                className="py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-300"
              >
                Cancelar
              </button>
              <button
                onClick={handlePinSubmit}
                className="py-2.5 bg-amber-500 hover:bg-amber-400 rounded-xl text-xs font-bold text-black"
              >
                Destravar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
