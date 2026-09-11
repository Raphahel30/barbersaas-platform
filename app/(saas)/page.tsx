'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getLandingContent, getPublicPlans, type LandingContent } from '@/app/actions/saas'
import { signUpOwner, type AuthActionState } from '@/app/actions/auth'

export default function SaasLandingPage() {
  const [content, setContent] = useState<LandingContent | null>(null)
  const [plans, setPlans] = useState<Array<{ id: string; name: string; max_barbers: number; monthly_price: number }>>([])
  const [loading, setLoading] = useState(true)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)

  // Onboarding Modal State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [formState, setFormState] = useState<{
    organizationName: string
    tenantName: string
    fullName: string
    email: string
    document: string
    phone: string
    password: string
    slug: string
    addressLine: string
    city: string
    state: string
    postalCode: string
  }>({
    organizationName: '',
    tenantName: '',
    fullName: '',
    email: '',
    document: '',
    phone: '',
    password: '',
    slug: '',
    addressLine: '',
    city: '',
    state: '',
    postalCode: '',
  })

  const [onboardingStatus, setOnboardingStatus] = useState<AuthActionState | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [loadedContent, loadedPlans] = await Promise.all([
          getLandingContent(),
          getPublicPlans(),
        ])
        setContent(loadedContent)
        setPlans(loadedPlans)
        if (loadedPlans.length > 0) {
          setSelectedPlanId(loadedPlans[0].id)
        }
      } catch (err) {
        console.error('Erro ao carregar dados da landing page:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Máscaras de input para CPF/CNPJ e Telefone
  const formatDocument = (value: string) => {
    const raw = value.replace(/\D/g, '')
    if (raw.length <= 11) {
      return raw
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }
    return raw
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
  }

  const formatPhone = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 11)
    if (raw.length <= 10) {
      return raw.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3')
    }
    return raw.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
  }

  const handleSlugify = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setOnboardingStatus(null)

    const formData = new FormData()
    formData.set('organizationName', formState.organizationName || formState.tenantName)
    formData.set('tenantName', formState.tenantName)
    formData.set('fullName', formState.fullName)
    formData.set('email', formState.email)
    formData.set('document', formState.document.replace(/\D/g, ''))
    formData.set('phone', formState.phone)
    formData.set('password', formState.password)
    formData.set('planId', selectedPlanId)
    formData.set('slug', formState.slug || handleSlugify(formState.tenantName))
    formData.set('addressLine', formState.addressLine)
    formData.set('city', formState.city)
    formData.set('state', formState.state)
    formData.set('postalCode', formState.postalCode)

    try {
      const res = await signUpOwner(formData)
      setOnboardingStatus(res)
      if (res.success) {
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      }
    } catch (err) {
      setOnboardingStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Falha ao registrar barbearia.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading || !content) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-500 selection:text-black w-full flex flex-col items-center">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 glass-panel border-b border-zinc-800/80 px-4 sm:px-8 py-4 w-full">
        <div className="w-full max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-9 h-9 rounded-xl gold-gradient-bg flex items-center justify-center text-black font-extrabold text-xl shadow-lg shadow-amber-500/20">
              B
            </span>
            <span className="font-extrabold text-xl tracking-tight text-white font-outfit">
              Barber<span className="text-amber-500">SaaS</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-300">
            <Link href="/demo" className="text-amber-400 hover:text-amber-300 font-semibold transition-colors flex items-center gap-1">
              ★ Testar Demo
            </Link>
            <a href="#modulos" className="hover:text-amber-400 transition-colors">Funcionalidades</a>
            <a href="#precos" className="hover:text-amber-400 transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-amber-400 transition-colors">Resultados</a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">Dúvidas</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-3 sm:px-4 py-2 rounded-lg hover:bg-zinc-800 transition-all"
            >
              Entrar
            </Link>
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="gold-button text-xs sm:text-sm px-4 py-2"
            >
              Testar Grátis
            </button>
          </div>
        </div>
      </header>

      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-32 px-4 sm:px-6 w-full max-w-7xl mx-auto overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 -z-10 flex items-center justify-center">
          <div className="w-[600px] h-[400px] bg-amber-500/10 blur-[140px] rounded-full pointer-events-none" />
        </div>

        <div className="text-center max-w-4xl mx-auto w-full flex flex-col items-center">
          {content.hero.badgeText && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs sm:text-sm font-semibold mb-6 animate-pulse">
              <span>★</span> {content.hero.badgeText}
            </div>
          )}

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            {content.hero.title}
          </h1>

          <p className="text-base sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
            {content.hero.subtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => setIsOnboardingOpen(true)}
              className="gold-button text-base px-8 py-4 w-full sm:w-auto shadow-xl shadow-amber-500/20"
            >
              {content.hero.ctaText}
            </button>
            <Link
              href="/demo"
              className="px-8 py-4 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-base font-semibold w-full sm:w-auto transition-all text-center flex items-center justify-center gap-2"
            >
              <span>⚡ Testar na Prática sem Cadastro</span>
            </Link>
            <a
              href="#modulos"
              className="px-8 py-4 rounded-xl border border-zinc-700 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200 text-base font-semibold w-full sm:w-auto transition-all text-center"
            >
              {content.hero.secondaryCtaText}
            </a>
          </div>
        </div>

        {/* Hero Image Mockup */}
        {content.hero.heroImageUrl && (
          <div className="mt-14 relative w-full max-w-5xl mx-auto rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl shadow-black/80 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={content.hero.heroImageUrl}
              alt="Plataforma BarberSaaS"
              className="w-full h-auto object-cover max-h-[480px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-80" />
          </div>
        )}
      </section>

      {/* 2. PROVA SOCIAL */}
      {content.socialProof.enabled && (
        <section className="py-12 border-y border-zinc-900 bg-zinc-900/30 w-full">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6">
            <p className="text-center text-xs sm:text-sm font-semibold text-zinc-500 uppercase tracking-widest mb-8">
              {content.socialProof.heading}
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {content.socialProof.stats.map((st, i) => (
                <div key={i} className="p-4 rounded-xl glass-card">
                  <div className="text-2xl sm:text-3xl md:text-4xl font-extrabold gold-gradient-text mb-1 font-outfit">
                    {st.value}
                  </div>
                  <div className="text-xs sm:text-sm text-zinc-400 font-medium">
                    {st.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. MÓDULOS E FUNCIONALIDADES */}
      {content.modules.enabled && (
        <section id="modulos" className="py-20 px-4 sm:px-6 w-full max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-4">
              {content.modules.heading}
            </h2>
            <p className="text-sm sm:text-base text-zinc-400 font-light">
              {content.modules.subheading}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.modules.items.map((item, idx) => (
              <div key={idx} className="glass-card p-6 sm:p-8 flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-5 text-xl font-bold">
                    {idx + 1}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-zinc-100 mb-2.5">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-light">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. TABELA DE PREÇOS */}
      <section id="precos" className="py-20 px-4 sm:px-6 w-full max-w-7xl mx-auto border-t border-zinc-900">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Sem Surpresas
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-3 mb-4">
            Planos sob medida para o tamanho da sua equipe
          </h2>
          <p className="text-sm sm:text-base text-zinc-400">
            Todos os planos incluem dias de carência grátis, agendamento ilimitado e gateway próprio.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((p, idx) => {
            const isFeatured = idx === 1
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                  isFeatured
                    ? 'bg-zinc-900 border-2 border-amber-500/80 shadow-2xl shadow-amber-500/10 scale-105'
                    : 'glass-card border-zinc-800'
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 gold-gradient-bg text-black text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
                    Mais Escolhido
                  </div>
                )}

                <div>
                  <h3 className="text-xl font-bold text-zinc-100 mb-1">{p.name}</h3>
                  <p className="text-xs text-zinc-400 mb-6">
                    Ideal para barbearias com até {p.max_barbers} {p.max_barbers === 1 ? 'barbeiro' : 'barbeiros'}
                  </p>

                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-sm text-zinc-400 font-semibold">R$</span>
                    <span className="text-4xl font-extrabold text-white font-outfit">
                      {p.monthly_price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-zinc-500">/mês</span>
                  </div>

                  <ul className="space-y-3 text-xs sm:text-sm text-zinc-300 mb-8">
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span> Até {p.max_barbers} profissionais ativos
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span> Agendamento online e link wa.me
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span> 4 Gateways de Pagamento One-Click
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span> Relatório de repasse manual líquido
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-amber-500 font-bold">✓</span> Fidelidade 30 dias e Aniversariantes
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setSelectedPlanId(p.id)
                    setIsOnboardingOpen(true)
                  }}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all ${
                    isFeatured
                      ? 'gold-button'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100'
                  }`}
                >
                  Começar Agora
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* 5. DEPOIMENTOS */}
      {content.testimonials.enabled && (
        <section id="depoimentos" className="py-20 px-4 sm:px-6 w-full border-t border-zinc-900 bg-zinc-900/20">
          <div className="w-full max-w-7xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">
                {content.testimonials.heading}
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400">
                Barbeiros reais que transformaram sua gestão e acabaram com o retrabalho.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {content.testimonials.items.map((t, idx) => (
                <div key={idx} className="glass-card p-6 sm:p-8 flex flex-col justify-between">
                  <p className="text-xs sm:text-sm text-zinc-300 italic mb-6 leading-relaxed font-light">
                    “{t.quote}”
                  </p>
                  <div className="border-t border-zinc-800/80 pt-4">
                    <p className="text-sm font-bold text-zinc-100">{t.author}</p>
                    <p className="text-xs text-amber-500">{t.role} • {t.shopName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. FAQ EXPANSÍVEL */}
      {content.faq.enabled && (
        <section id="faq" className="py-20 px-4 sm:px-6 w-full max-w-4xl mx-auto border-t border-zinc-900">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3">
              {content.faq.heading}
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400">
              Ficou com alguma dúvida? Nós respondemos aqui.
            </p>
          </div>

          <div className="space-y-3">
            {content.faq.items.map((item, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between font-bold text-sm sm:text-base text-zinc-200 hover:text-amber-400 transition-colors"
                  >
                    <span>{item.question}</span>
                    <span className="text-amber-500 text-lg ml-2">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 sm:pb-6 text-xs sm:text-sm text-zinc-400 leading-relaxed font-light border-t border-zinc-800/60 pt-3">
                      {item.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-10 px-4 sm:px-8 text-center text-xs text-zinc-500 w-full">
        <div className="w-full max-w-7xl mx-auto">
          <p>© {new Date().getFullYear()} BarberSaaS. Todos os direitos reservados.</p>
          <p className="mt-1">
            Plataforma White-Label para gestão de barbearias e agendamentos inteligentes.
          </p>
        </div>
      </footer>

      {/* MODAL DE ONBOARDING COM MÁSCARA CPF/CNPJ */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-8 shadow-2xl my-6">
            <button
              onClick={() => setIsOnboardingOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white p-2"
              aria-label="Fechar"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <span className="inline-block p-2 rounded-xl gold-gradient-bg text-black font-black text-sm mb-2">
                Comece Grátis
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Cadastre sua Barbearia
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Configure seu espaço em menos de 2 minutos e comece a receber agendamentos.
              </p>
            </div>

            {onboardingStatus && (
              <div
                className={`p-3.5 mb-5 rounded-xl text-xs ${
                  onboardingStatus.success
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {onboardingStatus.message}
              </div>
            )}

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nome da Barbearia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Barbearia do Carlos"
                    value={formState.tenantName}
                    onChange={(e) => {
                      const name = e.target.value
                      setFormState({
                        ...formState,
                        tenantName: name,
                        slug: formState.slug || handleSlugify(name),
                      })
                    }}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Endereço Web (Link) *
                  </label>
                  <div className="flex items-center">
                    <span className="text-xs text-zinc-500 px-2 py-3 bg-zinc-800 rounded-l-xl border border-r-0 border-zinc-700">
                      /
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="barbearia-do-carlos"
                      value={formState.slug}
                      onChange={(e) => setFormState({ ...formState, slug: handleSlugify(e.target.value) })}
                      className="input-field rounded-l-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Seu Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Carlos Alberto"
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    CPF ou CNPJ do Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={formState.document}
                    onChange={(e) => setFormState({ ...formState, document: formatDocument(e.target.value) })}
                    className="input-field font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    E-mail de Acesso *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@exemplo.com"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    WhatsApp com DDD *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="(11) 99999-9999"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: formatPhone(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Senha de Acesso *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres (A-z, 0-9)"
                    value={formState.password}
                    onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Plano Desejado *
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    className="input-field"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - R$ {p.monthly_price.toFixed(2)}/mês
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="São Paulo"
                    value={formState.city}
                    onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    UF
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    placeholder="SP"
                    value={formState.state}
                    onChange={(e) => setFormState({ ...formState, state: e.target.value.toUpperCase() })}
                    className="input-field uppercase text-center"
                  />
                </div>
              </div>

              <p className="text-[11px] text-zinc-500 text-center pt-1">
                Ao clicar em &quot;Criar Barbearia&quot;, você concorda com os Termos de Uso e Política de Privacidade.
              </p>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full gold-button py-3 text-base shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? 'Configurando barbearia...' : 'Criar Barbearia e Começar Grátis'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
