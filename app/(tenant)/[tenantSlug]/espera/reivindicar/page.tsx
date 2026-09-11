'use client'

import { useState, useEffect, use } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  Clock,
  Sparkles,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react'
import { claimWaitlistSlotAction } from '@/app/actions/waitlist'

interface ClaimPageProps {
  params: Promise<{ tenantSlug: string }>
}

export default function ClaimWaitlistPage({ params }: ClaimPageProps) {
  const { tenantSlug } = use(params)
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [claimed, setClaimed] = useState(false)
  const [waitlistData, setWaitlistData] = useState<any>(null)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600) // 10 min padrão

  // Validação inicial do token
  useEffect(() => {
    if (!token) {
      setError('Token de reivindicação não fornecido ou link incompleto.')
    }
  }, [token])

  // Timer decrescente de 10 minutos
  useEffect(() => {
    if (claimed) return
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          setError('O tempo de 10 minutos para garantir esta vaga expirou.')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [claimed])

  const handleClaim = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const res = await claimWaitlistSlotAction(token)
      if (res.success) {
        setClaimed(true)
        setWaitlistData(res.waitlistEntry)
      } else {
        setError(res.message)
      }
    } catch {
      setError('Erro ao reivindicar a vaga. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const formatCountdown = (totalSec: number) => {
    const min = Math.floor(totalSec / 60)
    const sec = totalSec % 60
    return `${min}:${sec < 10 ? '0' : ''}${sec}`
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-zinc-900/90 border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>

        <div>
          <span className="px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider">
            Vaga Exclusiva Liberada
          </span>
          <h2 className="text-2xl font-black text-white mt-3">Sua vaga está te esperando!</h2>
          <p className="text-sm text-zinc-400 mt-1.5">
            Um horário acabou de abrir na barbearia e você é o próximo da Lista de Espera.
          </p>
        </div>

        {!claimed && !error && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-mono text-3xl font-black">
              <Clock className="w-6 h-6 animate-spin" />
              <span>{formatCountdown(secondsRemaining)}</span>
            </div>
            <p className="text-xs text-zinc-400">
              Você tem este tempo exclusivo para confirmar antes que a vaga passe para o próximo cliente.
            </p>
          </div>
        )}

        {error ? (
          <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-2xl text-sm text-red-300 space-y-3 text-left">
            <div className="flex items-center gap-2 font-bold text-red-200">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Atenção</span>
            </div>
            <p className="text-xs">{error}</p>
            <button
              onClick={() => router.push(`/${tenantSlug}/agendar`)}
              className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl transition"
            >
              Ver Grade Geral de Horários
            </button>
          </div>
        ) : claimed ? (
          <div className="p-6 bg-emerald-950/50 border border-emerald-500/50 rounded-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-lg text-white">Vaga Garantida com Sucesso!</h4>
              <p className="text-xs text-zinc-300 mt-1">
                Seu lugar foi reservado na agenda do barbeiro. Te esperamos no salão!
              </p>
            </div>
            <button
              onClick={() => router.push(`/${tenantSlug}/cliente`)}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
            >
              <span>Ver Meus Agendamentos</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={loading || !token}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-lg rounded-2xl transition shadow-xl shadow-amber-500/20 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-6 h-6" />
            <span>{loading ? 'Confirmando vaga...' : 'Garantir Esta Vaga Agora'}</span>
          </button>
        )}

        <div className="pt-2 text-[11px] text-zinc-500 border-t border-zinc-800/80">
          Garantia inteligente de vaga prioritária • BarberSaaS
        </div>
      </div>
    </div>
  )
}
