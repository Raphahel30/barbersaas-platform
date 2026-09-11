'use client'

import { useState, useEffect, useRef, use } from 'react'
import {
  Clock,
  Scissors,
  Users,
  Volume2,
  VolumeX,
  Maximize2,
  Sparkles,
  CheckCircle2,
  UserCheck,
} from 'lucide-react'
import { getTodayQueueDisplayAction, type QueueDisplayData } from '@/app/actions/totem'

interface TvPageProps {
  params: Promise<{ tenantSlug: string }>
}

export default function TvQueuePage({ params }: TvPageProps) {
  const { tenantSlug } = use(params)

  const [queueData, setQueueData] = useState<QueueDisplayData>({
    inService: [],
    nextUp: [],
    waitingReception: [],
  })
  const [tenantName, setTenantName] = useState<string>('Barbearia')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [currentDate, setCurrentDate] = useState<string>('')
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false)
  const [callingClientName, setCallingClientName] = useState<string | null>(null)

  const lastInServiceIdsRef = useRef<Set<string>>(new Set())
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Inicializa relógio da TV
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

  // Síntese de som do sino/gongo elegante via Web Audio API (Custo zero, sem MP3 externo)
  const playChimeSound = () => {
    if (!audioEnabled) return
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
        audioCtxRef.current = new AudioContextClass()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      // Tom 1: Ré 5 (587.33 Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, now)
      gain1.gain.setValueAtTime(0, now)
      gain1.gain.linearRampToValueAtTime(0.3, now + 0.05)
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 1.2)

      // Tom 2: Lá 5 (880 Hz) com ligeiro delay para o efeito de chamada de aeroporto/sala VIP
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880, now + 0.18)
      gain2.gain.setValueAtTime(0, now + 0.18)
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.22)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.18)
      osc2.stop(now + 1.5)
    } catch (e) {
      console.error('[TV Audio] Falha ao sintetizar gongo sonoro:', e)
    }
  }

  // Carrega fila e detecta novos chamados
  const fetchQueue = async () => {
    try {
      const res = await getTodayQueueDisplayAction(tenantSlug)
      if (res.success && res.data) {
        if (res.tenantName) setTenantName(res.tenantName)

        // Verifica se algum cliente novo entrou "Em Atendimento" ou foi promovido
        const currentInServiceIds = new Set(res.data.inService.map((item) => item.id))
        const hasNewInService = res.data.inService.some((item) => !lastInServiceIdsRef.current.has(item.id))

        if (hasNewInService && lastInServiceIdsRef.current.size > 0) {
          const newlyCalled = res.data.inService.find((item) => !lastInServiceIdsRef.current.has(item.id))
          if (newlyCalled) {
            setCallingClientName(`${newlyCalled.clientName} com ${newlyCalled.barberName}`)
            playChimeSound()
            setTimeout(() => setCallingClientName(null), 8000)
          }
        }

        lastInServiceIdsRef.current = currentInServiceIds
        setQueueData(res.data)
      }
    } catch (err) {
      console.error('[TV Display] Falha ao atualizar fila:', err)
    }
  }

  // Polling a cada 10 segundos
  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 10000)
    return () => clearInterval(interval)
  }, [tenantSlug, audioEnabled])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const toggleAudio = () => {
    setAudioEnabled((prev) => {
      const next = !prev
      if (next) {
        // Inicializa AudioContext no gesto do usuário
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
          audioCtxRef.current = new AudioContextClass()
          audioCtxRef.current.resume()
          playChimeSound()
        } catch {}
      }
      return next
    })
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col justify-between overflow-hidden select-none font-sans">
      {/* Barra de Topo da TV */}
      <header className="px-10 py-6 border-b border-zinc-900 bg-zinc-950/90 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-6">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-400">
            <Scissors className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-widest text-amber-400 uppercase">{tenantName}</h1>
            <p className="text-sm text-zinc-400 capitalize tracking-wide mt-0.5">{currentDate}</p>
          </div>
        </div>

        {/* Notificação Pop-up de Chamada na TV */}
        {callingClientName && (
          <div className="animate-bounce px-8 py-3 bg-amber-500 text-black font-extrabold text-xl rounded-2xl shadow-2xl flex items-center gap-3">
            <Sparkles className="w-6 h-6 animate-spin" />
            <span>CHAMANDO AGORA: {callingClientName}</span>
          </div>
        )}

        <div className="flex items-center space-x-8">
          <div className="text-right">
            <span className="text-4xl font-mono font-black text-zinc-100 tracking-widest">{currentTime}</span>
            <div className="flex items-center justify-end space-x-1.5 text-xs text-emerald-400 font-semibold mt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>PAINEL AO VIVO</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 pl-6 border-l border-zinc-800">
            <button
              onClick={toggleAudio}
              className={`p-3.5 rounded-xl transition ${
                audioEnabled ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
              title={audioEnabled ? 'Áudio de Chamada Ativado' : 'Ativar Áudio de Chamada'}
            >
              {audioEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-3.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-zinc-200 transition"
              title="Alternar Tela Cheia"
            >
              <Maximize2 className="w-6 h-6" />
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal: Grade em 3 Colunas Estratégicas */}
      <main className="flex-1 p-8 grid grid-cols-12 gap-8 items-start max-w-[1920px] mx-auto w-full">
        {/* COLUNA 1: EM ATENDIMENTO (Cadeiras Ocupadas) - 5 Colunas */}
        <section className="col-span-5 bg-zinc-950/80 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center space-x-3">
              <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-xl font-bold tracking-wider text-emerald-400 uppercase">
                Em Atendimento
              </h2>
            </div>
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/20">
              {queueData.inService.length} na cadeira
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
            {queueData.inService.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                <Scissors className="w-12 h-12 opacity-40" />
                <p className="text-base">Nenhum barbeiro em atendimento no momento.</p>
              </div>
            ) : (
              queueData.inService.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-zinc-900/90 border-2 border-emerald-500/40 hover:border-emerald-500 transition shadow-lg space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-white">{item.clientName}</h3>
                      <p className="text-sm font-semibold text-emerald-400 mt-0.5">
                        Barbeiro: <span className="text-zinc-200">{item.barberName}</span>
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-xs font-mono font-bold">
                      Cortando
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {item.serviceNames.map((svc, sIdx) => (
                      <span key={sIdx} className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-xs text-zinc-300">
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUNA 2: PRÓXIMO DA FILA (Destaque Dourado VIP) - 4 Colunas */}
        <section className="col-span-4 bg-gradient-to-b from-amber-950/20 via-zinc-950/80 to-zinc-950 border-2 border-amber-500/60 rounded-3xl p-6 shadow-2xl flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-4 border-b border-amber-500/30">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-5 h-5 text-amber-400 animate-spin" />
              <h2 className="text-xl font-bold tracking-wider text-amber-400 uppercase">
                Próximo
              </h2>
            </div>
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/30">
              Prepare-se
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pt-4 pr-1">
            {queueData.nextUp.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                <CheckCircle2 className="w-12 h-12 opacity-40" />
                <p className="text-base text-center">Nenhum cliente na escala imediata.</p>
              </div>
            ) : (
              queueData.nextUp.map((item, idx) => (
                <div
                  key={item.id}
                  className={`p-6 rounded-2xl transition space-y-3 ${
                    idx === 0
                      ? 'bg-amber-500/15 border-2 border-amber-500 shadow-2xl shadow-amber-500/10 ring-2 ring-amber-500/30'
                      : 'bg-zinc-900/80 border border-zinc-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      {idx === 0 && (
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                          CHAMADA IMINENTE
                        </span>
                      )}
                      <h3 className="text-2xl font-black text-white mt-1">{item.clientName}</h3>
                      <p className="text-sm text-zinc-300 font-medium">
                        Com: <strong className="text-amber-400">{item.barberName}</strong>
                      </p>
                    </div>
                    <span className="text-xl font-mono font-bold text-amber-300">
                      {new Date(item.startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.serviceNames.map((svc, sIdx) => (
                      <span key={sIdx} className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-xs text-zinc-300">
                        {svc}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* COLUNA 3: AGUARDANDO NA RECEPÇÃO (Totem Check-in / Fila) - 3 Colunas */}
        <section className="col-span-3 bg-zinc-950/80 border border-zinc-800/80 rounded-3xl p-6 shadow-2xl flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
            <div className="flex items-center space-x-2.5">
              <UserCheck className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold tracking-wider text-sky-400 uppercase">
                Na Recepção
              </h2>
            </div>
            <span className="px-2.5 py-1 bg-sky-500/10 text-sky-400 text-xs font-bold rounded-lg border border-sky-500/20">
              {queueData.waitingReception.length} presentes
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pt-4 pr-1">
            {queueData.waitingReception.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2 text-center">
                <Users className="w-10 h-10 opacity-30" />
                <p className="text-xs text-zinc-500">
                  Nenhum cliente aguardando no sofá da recepção.
                </p>
              </div>
            ) : (
              queueData.waitingReception.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between space-x-3"
                >
                  <div className="flex items-center space-x-3 truncate">
                    <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div className="truncate">
                      <h4 className="font-bold text-sm text-zinc-100 truncate">{item.clientName}</h4>
                      <p className="text-[11px] text-zinc-400 truncate">{item.barberName}</p>
                    </div>
                  </div>
                  <span className="text-xs text-sky-400/90 font-mono font-medium shrink-0">
                    Chegou
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Rodapé Dinâmico da TV com Mensagem Institucional & Orientações */}
      <footer className="px-10 py-4 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between text-zinc-400 text-sm">
        <div className="flex items-center space-x-3">
          <span className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-bold text-amber-400">
            DICA
          </span>
          <span>
            Chegou na barbearia? Faça seu check-in no tablet do balcão para confirmar sua presença.
          </span>
        </div>
        <div className="text-xs text-zinc-600 font-mono">
          ATUALIZAÇÃO AUTOMÁTICA EM TEMPO REAL • SISTEMA BARBERSAAS
        </div>
      </footer>
    </div>
  )
}
