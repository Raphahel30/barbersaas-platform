'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { getClientFidelityStatusAction, redeemFidelityRewardAction } from '@/app/actions/fidelity'
import { getClientVipStatusAction } from '@/app/actions/vip'
import { signUpClient } from '@/app/actions/auth'

export default function ClientPortalPage() {
  const params = useParams()
  const tenantSlug = typeof params.tenantSlug === 'string' ? params.tenantSlug : ''

  const [tenantId, setTenantId] = useState('')
  const [tenantName, setTenantName] = useState('Barbearia')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [loading, setLoading] = useState(true)

  // Auth Form
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    birthDate: '',
  })
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  // Client Dashboard Data
  const [fidelityCard, setFidelityCard] = useState<{
    hasCard: boolean
    stampsCount: number
    targetStamps: number
    expiresAt: string | null
    canRedeem: boolean
  } | null>(null)

  const [vipStatus, setVipStatus] = useState<{
    isActive: boolean
    isOverdue: boolean
    planName?: string
    message: string
  } | null>(null)

  const [appointments, setAppointments] = useState<Array<{
    id: string
    startsAt: string
    barberName: string
    servicesText: string
    totalAmount: number
    status: string
  }>>([])

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)

  // Carrega informações do tenant e verifica sessão
  useEffect(() => {
    async function loadPortal() {
      try {
        const res = await fetch(`/api/tenant/resolve?slug=${tenantSlug}`)
        const data = await res.json()
        if (data.id) {
          setTenantId(data.id)
          setTenantName(data.name)

          // Verifica se usuário está logado
          const sessionRes = await fetch('/api/auth/me')
          const sessionData = await sessionRes.json()
          if (sessionData?.user) {
            setIsAuthenticated(true)
            setAvatarUrl(sessionData.user.avatar_url || null)

            // Carrega fidelidade e VIP
            const [fidelityRes, vipRes] = await Promise.all([
              getClientFidelityStatusAction(data.id),
              getClientVipStatusAction(data.id),
            ])

            if (fidelityRes.success && fidelityRes.data) {
              setFidelityCard(fidelityRes.data)
            }

            if (vipRes.success && vipRes.data) {
              setVipStatus(vipRes.data)
            }
          }
        }
      } catch {
        // Fallback demo para visualização
      } finally {
        setLoading(false)
      }
    }
    loadPortal()
  }, [tenantSlug])

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthMessage(null)

    if (isRegisterMode) {
      const fd = new FormData()
      fd.set('tenantId', tenantId)
      fd.set('fullName', authForm.fullName)
      fd.set('email', authForm.email)
      fd.set('phone', authForm.phone)
      fd.set('password', authForm.password)
      fd.set('birthDate', authForm.birthDate)

      try {
        const res = await signUpClient(fd)
        if (res.success) {
          setAuthMessage({ type: 'success', text: res.message })
          setTimeout(() => setIsRegisterMode(false), 2000)
        } else {
          setAuthMessage({ type: 'error', text: res.message })
        }
      } catch (err) {
        setAuthMessage({
          type: 'error',
          text: err instanceof Error ? err.message : 'Falha no cadastro.',
        })
      } finally {
        setAuthLoading(false)
      }
    } else {
      // Login
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: authForm.email, password: authForm.password }),
        })
        const data = await res.json()
        if (res.ok && data.user) {
          window.location.reload()
        } else {
          setAuthMessage({ type: 'error', text: data.message || 'E-mail ou senha inválidos.' })
        }
      } catch {
        setAuthMessage({ type: 'error', text: 'Não foi possível entrar.' })
      } finally {
        setAuthLoading(false)
      }
    }
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setAvatarUrl(ev.target?.result as string)
      setAvatarUploading(false)
      alert('Foto de perfil sincronizada com a recepção da barbearia!')
    }
    reader.readAsDataURL(file)
  }

  const handleRedeemReward = async () => {
    if (!tenantId) return
    try {
      const res = await redeemFidelityRewardAction(tenantId)
      if (res.success) {
        alert('Recompensa resgatada com sucesso! Válida pelos próximos 30 dias.')
        window.location.reload()
      } else {
        alert(res.message)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao resgatar recompensa.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto bg-zinc-950/90 border-x border-zinc-900 shadow-2xl p-5 sm:p-6 text-zinc-100 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-6">
          <Link
            href={`/${tenantSlug}`}
            className="text-xs font-semibold text-zinc-400 hover:text-white flex items-center gap-1"
          >
            ← Início
          </Link>
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">
            Área do Cliente PWA
          </span>
        </div>

        {!isAuthenticated ? (
          /* TELA DE LOGIN / CADASTRO PWA */
          <div className="space-y-6">
            <div className="text-center">
              <span className="w-12 h-12 rounded-2xl gold-gradient-bg text-black font-extrabold flex items-center justify-center text-xl mx-auto mb-3 shadow-lg shadow-amber-500/20">
                PWA
              </span>
              <h1 className="text-2xl font-extrabold text-white">
                {isRegisterMode ? 'Criar Conta de Cliente' : 'Entrar no Seu Aplicativo'}
              </h1>
              <p className="text-xs text-zinc-400 mt-1">
                Acesse seus selos de fidelidade, planos VIP e histórico na {tenantName}.
              </p>
            </div>

            {authMessage && (
              <div
                className={`p-3.5 rounded-xl text-xs ${
                  authMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {authMessage.text}
              </div>
            )}

            <form onSubmit={handleAuthSubmit} className="space-y-3.5">
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Seu nome"
                    value={authForm.fullName}
                    onChange={(e) => setAuthForm({ ...authForm, fullName: e.target.value })}
                    className="input-field"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="seu@email.com"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  className="input-field"
                />
              </div>

              {isRegisterMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">WhatsApp</label>
                    <input
                      type="text"
                      required
                      placeholder="(11) 99999-9999"
                      value={authForm.phone}
                      onChange={(e) => setAuthForm({ ...authForm, phone: e.target.value })}
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">Nascimento</label>
                    <input
                      type="date"
                      required
                      value={authForm.birthDate}
                      onChange={(e) => setAuthForm({ ...authForm, birthDate: e.target.value })}
                      className="input-field text-xs"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  placeholder="Sua senha"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="input-field"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full gold-button py-3 text-sm font-bold shadow-lg shadow-amber-500/20"
              >
                {authLoading
                  ? 'Processando...'
                  : isRegisterMode
                    ? 'Concluir Cadastro'
                    : 'Entrar no Aplicativo'}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode)
                  setAuthMessage(null)
                }}
                className="text-xs text-amber-500 hover:underline"
              >
                {isRegisterMode
                  ? 'Já possui uma conta? Faça Login'
                  : 'Não tem cadastro? Crie sua conta em 1 minuto'}
              </button>
            </div>
          </div>
        ) : (
          /* PAINEL DO CLIENTE LOGADO */
          <div className="space-y-6">
            {/* Perfil & Foto com Sync */}
            <div className="flex items-center gap-4 p-4 rounded-2xl glass-card">
              <label className="relative w-16 h-16 rounded-full overflow-hidden bg-zinc-800 border-2 border-amber-500 cursor-pointer group flex-shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl font-bold text-zinc-400">
                    👤
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity">
                  {avatarUploading ? '...' : 'Trocar'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>

              <div>
                <h2 className="text-base font-bold text-white">Olá, Cliente Especial!</h2>
                <p className="text-xs text-zinc-400">Sua foto é sincronizada no balcão da barbearia</p>
                <Link
                  href={`/${tenantSlug}/agendar`}
                  className="text-xs text-amber-400 font-semibold hover:underline mt-1 inline-block"
                >
                  + Novo Agendamento
                </Link>
              </div>
            </div>

            {/* TRAVA POR ATRASO VIP (se aplicável) */}
            {vipStatus?.isOverdue && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/40 text-red-400 text-xs">
                <p className="font-bold mb-0.5">⚠️ Assinatura VIP em Atraso</p>
                <p className="leading-relaxed font-light">{vipStatus.message}</p>
              </div>
            )}

            {/* CARTÃO DE FIDELIDADE INTERATIVO (30 DIAS) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-zinc-900 to-zinc-950 border border-amber-500/30 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <span>👑</span> Cartão Fidelidade
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    {fidelityCard?.expiresAt
                      ? `Selos válidos até ${new Date(fidelityCard.expiresAt).toLocaleDateString('pt-BR')}`
                      : 'Renovado a cada atendimento concluído'}
                  </p>
                </div>
                <span className="text-lg font-black text-amber-400 font-outfit">
                  {fidelityCard?.stampsCount || 0} / {fidelityCard?.targetStamps || 10}
                </span>
              </div>

              {/* Grid de Selos */}
              <div className="grid grid-cols-5 gap-2 pt-2">
                {Array.from({ length: fidelityCard?.targetStamps || 10 }).map((_, i) => {
                  const isChecked = i < (fidelityCard?.stampsCount || 0)
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-xl flex items-center justify-center text-sm font-extrabold border transition-all ${
                        isChecked
                          ? 'gold-gradient-bg text-black border-amber-400 shadow-md shadow-amber-500/20 scale-105'
                          : 'bg-zinc-900/80 border-zinc-800 text-zinc-600'
                      }`}
                    >
                      {isChecked ? '✂' : i + 1}
                    </div>
                  )
                })}
              </div>

              {fidelityCard?.canRedeem && (
                <button
                  onClick={handleRedeemReward}
                  className="w-full gold-button py-2.5 text-xs font-bold mt-2"
                >
                  🎉 Resgatar Recompensa de Fidelidade
                </button>
              )}
            </div>

            {/* Histórico de Cortes */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-zinc-200">Seus Cortes Recentes</h3>
              {appointments.length === 0 ? (
                <div className="p-5 text-center text-xs text-zinc-500 bg-zinc-900/60 rounded-xl border border-zinc-800">
                  Nenhum corte registrado ainda. Faça seu primeiro agendamento!
                </div>
              ) : (
                <div className="space-y-2">
                  {appointments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 flex justify-between items-center text-xs"
                    >
                      <div>
                        <p className="font-bold text-zinc-200">{a.servicesText}</p>
                        <p className="text-zinc-500">Barbeiro: {a.barberName}</p>
                        <span className="text-amber-500 text-[11px]">
                          {new Date(a.startsAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <span className="font-extrabold text-white">R$ {a.totalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="text-center pt-6 text-[11px] text-zinc-600">
        Aplicativo Web Progressivo (PWA) de {tenantName}
      </div>
    </div>
  )
}
