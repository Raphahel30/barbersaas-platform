'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  Calendar,
  Zap,
  DollarSign,
  Heart,
  Crown,
  Smartphone,
  Check,
  ArrowRight,
  Star,
  Shield,
  Clock,
  Scissors,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { getLandingContent, getPublicPlans, type LandingContent } from '@/app/actions/saas'
import { signUpOwner, type AuthActionState } from '@/app/actions/auth'

export default function SaasLandingPage() {
  const [content, setContent] = useState<LandingContent | null>(null)
  const [plans, setPlans] = useState<Array<{ id: string; name: string; max_barbers: number; monthly_price: number }>>([])
  const [loading, setLoading] = useState(true)
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)

  // Onboarding Modal State
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState('')
  const [formState, setFormState] = useState({
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

  // Efeito de rolagem global (barra de progresso e detecção de scroll)
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight
      if (totalHeight > 0) {
        const currentProgress = (window.scrollY / totalHeight) * 100
        setScrollProgress(Math.min(100, Math.max(0, currentProgress)))
      }
      setIsScrolled(window.scrollY > 40)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Efeito de revelação em cascata (Scroll Reveal via Intersection Observer)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    )

    const revealElements = document.querySelectorAll('.scroll-reveal')
    revealElements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [loading, content])

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
    formData.set('postalCode', formState.postalCode.replace(/\D/g, ''))

    try {
      const result = await signUpOwner(formData)
      setOnboardingStatus(result)
      if (result.success) {
        window.location.href = `/dashboard/onboarding`
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
      <div className="min-h-screen bg-[#080706] flex flex-col items-center justify-center gap-4">
        <div className="relative w-16 h-16">
          <Image
            src="/images/branding/navalio-icon-n.jpg"
            alt="Navalio Carregando"
            width={64}
            height={64}
            priority
            className="rounded-full animate-pulse border border-[#d4af37]/40 shadow-xl shadow-[#d4af37]/20"
          />
        </div>
        <div className="w-8 h-8 border-3 border-[#d4af37] border-t-transparent rounded-full animate-spin" />
        <span className="font-cinzel text-xs text-[#d4af37] tracking-widest uppercase">Carregando Navalio...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#080706] text-[#fbf8f1] selection:bg-[#d4af37] selection:text-black w-full flex flex-col items-center relative overflow-x-hidden">
      {/* 0. Barra de Progresso de Rolagem */}
      <div className="scroll-progress-container">
        <div className="scroll-progress-bar" style={{ width: `${scrollProgress}%` }} />
      </div>

      {/* 1. HEADER FIXO VINTAGE & DINÂMICO */}
      <header
        className={`sticky top-0 z-40 px-4 sm:px-8 py-3 w-full transition-all duration-300 ${
          isScrolled ? 'glass-panel glass-panel-scrolled' : 'bg-[#080706]/80 backdrop-blur-md border-b border-[#d4af37]/15'
        }`}
      >
        <div className="w-full max-w-6xl mx-auto px-4 flex items-center justify-between">
          {/* Logo & Marca Navalio */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#d4af37]/70 shadow-lg shadow-[#d4af37]/20 group-hover:border-[#d4af37] transition-all transform group-hover:scale-105">
              <Image
                src="/images/branding/navalio-icon-n.jpg"
                alt="Navalio Monograma"
                width={40}
                height={40}
                className="object-cover"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="font-cinzel font-black text-xl tracking-wider gold-gradient-text leading-tight">
                NAVALIO
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#a89e90] font-sans font-semibold">
                Sovereign Barbershop OS
              </span>
            </div>
          </Link>

          {/* Navegação Desktop */}
          <nav className="hidden lg:flex items-center gap-7 text-xs tracking-wider uppercase font-semibold text-[#a89e90]">
            <Link
              href="/demo"
              className="text-[#f7e599] hover:text-[#d4af37] transition-colors flex items-center gap-1.5 font-cinzel font-bold tracking-normal"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
              Testar Demo
            </Link>
            <a href="#confraria" className="hover:text-[#d4af37] transition-colors">A Tríade</a>
            <a href="#modulos" className="hover:text-[#d4af37] transition-colors">Módulos</a>
            <a href="#precos" className="hover:text-[#d4af37] transition-colors">Planos</a>
            <a href="#depoimentos" className="hover:text-[#d4af37] transition-colors">Confraria</a>
            <a href="#faq" className="hover:text-[#d4af37] transition-colors">Dúvidas</a>
          </nav>

          {/* Ações de Topo */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-cinzel font-semibold text-[#e8decb] hover:text-[#d4af37] px-3 sm:px-4 py-2 rounded-lg hover:bg-[#1a1510] transition-all"
            >
              Entrar
            </Link>
            <Link
              href="/comecar"
              className="gold-button text-xs sm:text-sm px-4 sm:px-5 py-2.5 min-h-[42px] flex items-center"
            >
              Começar Grátis
            </Link>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION COM O MEDALHÃO CIRCULAR ILUMINADO */}
      <section className="relative pt-10 pb-20 sm:pt-16 sm:pb-28 px-4 sm:px-6 w-full max-w-6xl mx-auto flex flex-col items-center text-center">
        {/* Efeitos de Luz Atmosférica em Ouro e Carmesim */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 pointer-events-none">
          <div className="w-[500px] sm:w-[750px] h-[500px] bg-gradient-to-tr from-[#9b1b1b]/15 via-[#d4af37]/20 to-transparent blur-[150px] rounded-full gold-halo-pulse" />
        </div>

        {/* Badge Vitoriano Superior */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#181410] border border-[#d4af37]/40 text-[#f7e599] text-xs sm:text-sm font-cinzel font-bold mb-8 shadow-lg shadow-black/60 scroll-reveal">
          <span className="text-[#d4af37]">⚔</span>
          <span>Aceleração de Retenção & Repasse para Barbearias de Elite</span>
          <span className="text-[#d4af37]">⚔</span>
        </div>

        {/* Emblema Principal / Brasão Horizontal em Destaque */}
        <div className="w-full max-w-md sm:max-w-xl mb-6 relative flex justify-center scroll-reveal">
          <div className="relative group">
            <Image
              src="/images/branding/navalio-logo-horizontal.png"
              alt="Brasão Oficial Navalio"
              width={560}
              height={320}
              className="w-full h-auto drop-shadow-[0_15px_35px_rgba(212,175,55,0.25)] filter contrast-105"
              priority
            />
          </div>
        </div>

        {/* Título de Impacto Old-School */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-cinzel font-black tracking-tight text-white mb-6 max-w-4xl leading-[1.15] scroll-reveal">
          A Precisão da <span className="gold-gradient-text">Navalha Clássica</span>.<br className="hidden sm:block" />
          A Potência da <span className="crimson-gradient-text">Gestão Moderna</span>.
        </h1>

        {/* Subtítulo */}
        <p className="text-sm sm:text-lg text-[#a89e90] max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-normal scroll-reveal">
          Agendamento sem atrito via WhatsApp, controle de no-show com holds Pix, 
          comissões com repasse manual líquido transparente e clube de assinaturas VIP.
        </p>

        {/* Ações Primárias (CTAs) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-16 scroll-reveal">
          <Link
            href="/comecar"
            className="gold-button text-sm sm:text-base px-8 py-4 w-full sm:w-auto shadow-2xl shadow-[#d4af37]/25 flex items-center justify-center gap-2"
          >
            <span>Cadastrar Barbearia Grátis</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/demo"
            className="crimson-button text-sm sm:text-base px-8 py-4 w-full sm:w-auto text-center flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-[#d4af37]" />
            <span>Testar Demo Sem Cadastro</span>
          </Link>
          <a
            href="#modulos"
            className="px-7 py-4 rounded-xl border border-[#d4af37]/30 bg-[#14100c] hover:bg-[#1e1913] text-[#e8decb] text-sm sm:text-base font-cinzel font-semibold w-full sm:w-auto transition-all text-center"
          >
            Ver Módulos
          </a>
        </div>

        {/* O Medalhão de Destaque com Parallax Flutuante */}
        <div className="relative w-full max-w-4xl mx-auto pt-6 flex flex-col items-center scroll-reveal">
          <div className="relative group">
            {/* Halo de Luz Dourada */}
            <div className="absolute inset-0 bg-[#d4af37]/20 blur-3xl rounded-full scale-110 pointer-events-none" />

            <div className="relative p-2 rounded-full border-2 border-dashed border-[#d4af37]/50 shadow-2xl shadow-black animate-medallion">
              <div className="w-44 h-44 sm:w-60 sm:h-60 rounded-full overflow-hidden border-4 border-[#d4af37] shadow-inner bg-[#120f0c] flex items-center justify-center">
                <Image
                  src="/images/branding/navalio-badge-round.jpg"
                  alt="Medalhão Circular Navalio"
                  width={240}
                  height={240}
                  className="object-cover w-full h-full transform transition-transform duration-700 group-hover:scale-105"
                  priority
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 text-xs font-cinzel text-[#d4af37] tracking-widest uppercase">
            <span className="h-px w-8 bg-[#d4af37]/40" />
            <span>Selo Oficial de Qualidade & Retenção Navalio</span>
            <span className="h-px w-8 bg-[#d4af37]/40" />
          </div>
        </div>
      </section>

      {/* 3. PROVA SOCIAL & NÚMEROS DA CONFRARIA */}
      <section className="py-14 border-y border-[#d4af37]/20 bg-[#100d0a]/70 w-full relative">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-[0.25em] mb-8">
            Autoridade Comprovada em Centenas de Barbearias no Brasil
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { label: 'Cortes & Barboterapias', value: '+250.000' },
              { label: 'Redução de No-Show', value: '-87%' },
              { label: 'Aumento na Retenção (30d)', value: '+42%' },
              { label: 'Repasses Calculados', value: 'R$ 4.8M+' },
            ].map((st, i) => (
              <div key={i} className="vintage-card p-6 scroll-reveal">
                <div className="text-2xl sm:text-3xl md:text-4xl font-black gold-gradient-text mb-1 font-cinzel">
                  {st.value}
                </div>
                <div className="text-xs sm:text-sm text-[#a89e90] font-sans font-medium">
                  {st.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. SEÇÃO: A TRÍADE DA IDENTIDADE NAVALIO (VITRINE DAS 3 LOGOS) */}
      <section id="confraria" className="py-24 px-4 sm:px-6 w-full max-w-6xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16 scroll-reveal">
          <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest px-3.5 py-1.5 rounded-full bg-[#1c1813] border border-[#d4af37]/30">
            A Identidade da Marca
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white mt-4 mb-4">
            Construído na Navalha. <span className="gold-gradient-text">Escalado pela Tecnologia.</span>
          </h2>
          <p className="text-sm sm:text-base text-[#a89e90]">
            Cada detalhe do Navalio foi desenhado para honrar a cultura da barbearia artesanal 
            enquanto automatiza os gargalos financeiros, operacionais e de agendamento.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Brasão Horizontal */}
          <div className="vintage-card p-8 flex flex-col items-center text-center justify-between group scroll-reveal">
            <div>
              <div className="w-full h-40 relative mb-6 flex items-center justify-center p-3 rounded-xl bg-[#0c0a08] border border-[#d4af37]/20 group-hover:border-[#d4af37]/50 transition-colors">
                <Image
                  src="/images/branding/navalio-logo-horizontal.png"
                  alt="Brasão Navalio"
                  width={240}
                  height={120}
                  className="object-contain max-h-32"
                />
              </div>
              <h3 className="text-xl font-cinzel font-bold text-white mb-2">
                Tradição Inegociável
              </h3>
              <p className="text-xs sm:text-sm text-[#a89e90] leading-relaxed font-sans">
                A navalha clássica em primeiro plano representa o respeito inabalável à arte da barbearia, 
                à experiência sensorial do cliente e ao toque de mestria que nenhuma máquina substitui.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#d4af37]/15 w-full text-xs font-cinzel text-[#d4af37]">
              Soberania no Atendimento
            </div>
          </div>

          {/* Card 2: Medalhão Circular */}
          <div className="vintage-card p-8 flex flex-col items-center text-center justify-between border-2 border-[#d4af37]/40 shadow-xl shadow-[#d4af37]/10 group scroll-reveal">
            <div>
              <div className="w-full h-40 relative mb-6 flex items-center justify-center p-3 rounded-xl bg-[#0c0a08] border border-[#d4af37]/30 group-hover:border-[#d4af37] transition-colors">
                <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-lg">
                  <Image
                    src="/images/branding/navalio-badge-round.jpg"
                    alt="Medalhão Circular Navalio"
                    width={112}
                    height={112}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
              <h3 className="text-xl font-cinzel font-bold gold-gradient-text mb-2">
                Retenção & Clube VIP
              </h3>
              <p className="text-xs sm:text-sm text-[#a89e90] leading-relaxed font-sans">
                O medalhão dourado representa o selo de fidelidade de 30 dias, as recompensas de aniversário 
                e as assinaturas recorrentes que transformam o cliente casual em mensalista fiel.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#d4af37]/20 w-full text-xs font-cinzel text-[#f7e599] font-bold">
              Receita Recorrente Previsível
            </div>
          </div>

          {/* Card 3: Monograma N */}
          <div className="vintage-card p-8 flex flex-col items-center text-center justify-between group scroll-reveal">
            <div>
              <div className="w-full h-40 relative mb-6 flex items-center justify-center p-3 rounded-xl bg-[#0c0a08] border border-[#d4af37]/20 group-hover:border-[#d4af37]/50 transition-colors">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border border-[#d4af37]/50 shadow-md">
                  <Image
                    src="/images/branding/navalio-icon-n.jpg"
                    alt="Monograma N Navalio"
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
              </div>
              <h3 className="text-xl font-cinzel font-bold text-white mb-2">
                A Tríade Tecnológica
              </h3>
              <p className="text-xs sm:text-sm text-[#a89e90] leading-relaxed font-sans">
                O emblema central dos três nós simboliza a harmonia perfeita entre o Barbeiro, o Cliente e o Gestor, 
                unificados por automação via WhatsApp, inteligência de agenda e split Pix líquido.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-[#d4af37]/15 w-full text-xs font-cinzel text-[#d4af37]">
              Engenharia Multi-Tenant
            </div>
          </div>
        </div>
      </section>

      {/* 5. MÓDULOS DE GESTÃO OLD-SCHOOL DE ALTA PERFORMANCE */}
      <section id="modulos" className="py-24 px-4 sm:px-6 w-full max-w-6xl mx-auto border-t border-[#d4af37]/15">
        <div className="text-center max-w-3xl mx-auto mb-16 scroll-reveal">
          <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest px-3 py-1 rounded-full bg-[#1c1813] border border-[#d4af37]/25">
            Engenharia de Ponta
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white mt-3 mb-4">
            Tudo o que sua barbearia precisa em um único sistema
          </h2>
          <p className="text-sm sm:text-base text-[#a89e90]">
            Funcionalidades desenhadas sob medida para o fluxo real de trabalho de uma barbearia de alta performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: <Calendar className="w-6 h-6 text-[#d4af37]" />,
              title: 'Motor de Agendamento Inteligente',
              desc: 'Bloqueio de horários duplicados, cálculo de buffers pós-corte para higienização e holds de 5 minutos com trava Pix.',
              badge: 'Zero Conflito',
            },
            {
              icon: <Zap className="w-6 h-6 text-[#d4af37]" />,
              title: 'Multi-Gateways One-Click',
              desc: 'Conecte Mercado Pago, Asaas, PagSeguro ou InfinitePay em 1 clique. Receba pagamentos e sinais direto na sua conta.',
              badge: 'Autônomo',
            },
            {
              icon: <DollarSign className="w-6 h-6 text-[#d4af37]" />,
              title: 'Fechamento de Caixa e Repasse Líquido',
              desc: 'Cálculo de comissão descontando o dinheiro em mãos recebido no balcão para transferência líquida via Pix.',
              badge: 'Transparência',
            },
            {
              icon: <Heart className="w-6 h-6 text-[#d4af37]" />,
              title: 'Fidelidade e Aniversariantes',
              desc: 'Cartão de selos interativo com validade de 30 dias e recompensas automáticas de aniversário para acelerar o retorno.',
              badge: '+42% Retorno',
            },
            {
              icon: <Crown className="w-6 h-6 text-[#d4af37]" />,
              title: 'Clube de Assinatura VIP',
              desc: 'Planos mensais e quinzenais com bloqueio imediato por inadimplência e isenção de sinal de reserva para membros.',
              badge: 'Previsibilidade',
            },
            {
              icon: <Smartphone className="w-6 h-6 text-[#d4af37]" />,
              title: 'PWA White-Label & Galeria',
              desc: 'Aplicativo instalado na tela do celular do cliente com suas cores, sua marca e galeria de fotos de cortes reais.',
              badge: 'Sua Marca',
            },
          ].map((m, idx) => (
            <div key={idx} className="vintage-card p-7 sm:p-8 flex flex-col justify-between scroll-reveal">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-12 h-12 rounded-xl bg-[#1f1913] border border-[#d4af37]/30 flex items-center justify-center shadow-inner">
                    {m.icon}
                  </div>
                  <span className="text-[10px] font-cinzel font-bold text-[#d4af37] px-2.5 py-1 rounded-full bg-[#181410] border border-[#d4af37]/30">
                    {m.badge}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-cinzel font-bold text-white mb-2.5">
                  {m.title}
                </h3>
                <p className="text-xs sm:text-sm text-[#a89e90] leading-relaxed font-sans font-light">
                  {m.desc}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[#d4af37]/10 flex items-center justify-between text-xs text-[#d4af37]/80">
                <span className="font-cinzel">Módulo 0{idx + 1}</span>
                <Check className="w-4 h-4 text-[#d4af37]" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 6. TABELA DE PLANOS DE ASSINATURA */}
      <section id="precos" className="py-24 px-4 sm:px-6 w-full max-w-6xl mx-auto border-t border-[#d4af37]/15">
        <div className="text-center max-w-2xl mx-auto mb-16 scroll-reveal">
          <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest bg-[#1c1813] px-3.5 py-1.5 rounded-full border border-[#d4af37]/30">
            Valores Transparentes
          </span>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white mt-3 mb-4">
            Planos Sob Medida para sua Equipe
          </h2>
          <p className="text-sm sm:text-base text-[#a89e90]">
            Todos os planos incluem dias de carência gratuitos, agendamentos ilimitados e conexão direta aos seus gateways.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((p, idx) => {
            const isFeatured = idx === 1
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl p-6 sm:p-8 flex flex-col justify-between transition-all scroll-reveal ${
                  isFeatured
                    ? 'vintage-card border-2 border-[#d4af37] shadow-2xl shadow-[#d4af37]/20 scale-105 z-10'
                    : 'vintage-card border-[#d4af37]/25'
                }`}
              >
                {isFeatured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#d4af37] via-[#f7e599] to-[#d4af37] text-black text-[10px] font-cinzel font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-md">
                    Mais Escolhido pelas Barbearias
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xl font-cinzel font-bold text-white">{p.name}</h3>
                    {isFeatured && <Crown className="w-5 h-5 text-[#d4af37]" />}
                  </div>
                  <p className="text-xs text-[#a89e90] mb-6">
                    Ideal para espaços com até {p.max_barbers} {p.max_barbers === 1 ? 'barbeiro' : 'barbeiros'}
                  </p>

                  <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-[#d4af37]/15">
                    <span className="text-sm text-[#a89e90] font-semibold">R$</span>
                    <span className="text-4xl font-extrabold text-white font-cinzel">
                      {p.monthly_price.toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-xs text-[#a89e90]">/mês</span>
                  </div>

                  <ul className="space-y-3.5 text-xs sm:text-sm text-[#e8decb] mb-8">
                    <li className="flex items-center gap-2.5">
                      <span className="text-[#d4af37] font-bold">✓</span> Até {p.max_barbers} profissionais ativos
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="text-[#d4af37] font-bold">✓</span> Agendamento online e link wa.me
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="text-[#d4af37] font-bold">✓</span> 4 Gateways de Pagamento One-Click
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="text-[#d4af37] font-bold">✓</span> Relatório de repasse manual líquido
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="text-[#d4af37] font-bold">✓</span> Fidelidade 30 dias e Aniversariantes
                    </li>
                    <li className="flex items-center gap-2.5">
                      <span className="text-[#d4af37] font-bold">✓</span> Suporte humanizado no WhatsApp
                    </li>
                  </ul>
                </div>

                <Link
                  href="/comecar"
                  className={`w-full py-3.5 px-4 rounded-xl text-sm font-cinzel font-bold transition-all text-center block ${
                    isFeatured
                      ? 'gold-button shadow-lg shadow-[#d4af37]/30'
                      : 'bg-[#1e1913] hover:bg-[#28221a] text-[#fbf8f1] border border-[#d4af37]/30'
                  }`}
                >
                  Iniciar Teste Gratuito
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* 7. DEPOIMENTOS DA CONFRARIA */}
      {content.testimonials.enabled && (
        <section id="depoimentos" className="py-24 px-4 sm:px-6 w-full border-t border-[#d4af37]/15 bg-[#100d0a]/60">
          <div className="w-full max-w-6xl mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16 scroll-reveal">
              <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest bg-[#1c1813] px-3.5 py-1.5 rounded-full border border-[#d4af37]/30">
                A Voz dos Mestres Barbeiros
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white mt-3 mb-3">
                Quem Usa e Confia no Navalio
              </h2>
              <p className="text-xs sm:text-sm text-[#a89e90]">
                Proprietários e mestres navalhistas que profissionalizaram a gestão e acabaram com o estresse do sábado à noite.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {content.testimonials.items.map((t, idx) => (
                <div key={idx} className="vintage-card p-8 flex flex-col justify-between scroll-reveal">
                  <div className="mb-6">
                    <div className="flex items-center gap-1 mb-4 text-[#d4af37]">
                      {[...Array(5)].map((_, starIdx) => (
                        <Star key={starIdx} className="w-4 h-4 fill-[#d4af37]" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-[#e8decb] italic leading-relaxed font-sans font-light">
                      “{t.quote}”
                    </p>
                  </div>
                  <div className="border-t border-[#d4af37]/15 pt-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-cinzel font-bold text-white">{t.author}</p>
                      <p className="text-xs text-[#d4af37]">{t.role} • {t.shopName}</p>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-[#1e1913] border border-[#d4af37]/40 flex items-center justify-center">
                      <Scissors className="w-3.5 h-3.5 text-[#d4af37]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. PERGUNTAS FREQUENTES (FAQ) */}
      {content.faq.enabled && (
        <section id="faq" className="py-24 px-4 sm:px-6 w-full max-w-4xl mx-auto border-t border-[#d4af37]/15">
          <div className="text-center mb-14 scroll-reveal">
            <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-widest bg-[#1c1813] px-3.5 py-1.5 rounded-full border border-[#d4af37]/30">
              Esclarecimentos
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-cinzel font-bold text-white mt-3 mb-3">
              Perguntas Frequentes
            </h2>
            <p className="text-xs sm:text-sm text-[#a89e90]">
              Tudo o que você precisa saber antes de levar sua barbearia para o Navalio.
            </p>
          </div>

          <div className="space-y-3.5">
            {content.faq.items.map((item, idx) => {
              const isOpen = openFaqIndex === idx
              return (
                <div
                  key={idx}
                  className="vintage-card overflow-hidden transition-all scroll-reveal"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between font-cinzel font-bold text-sm sm:text-base text-[#fbf8f1] hover:text-[#d4af37] transition-colors"
                  >
                    <span>{item.question}</span>
                    <span className="text-[#d4af37] text-xl ml-3">{isOpen ? '−' : '+'}</span>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-6 text-xs sm:text-sm text-[#a89e90] leading-relaxed font-sans border-t border-[#d4af37]/15 pt-4">
                      {item.answer}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* 9. RODAPÉ SOBERANO NAVALIO */}
      <footer className="border-t border-[#d4af37]/20 py-16 px-4 sm:px-8 text-center text-xs text-[#a89e90] w-full bg-[#070605]">
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
          {/* Logo Horizontal de Fechamento */}
          <div className="w-56 sm:w-72 mb-6">
            <Image
              src="/images/branding/navalio-logo-horizontal.png"
              alt="Navalio Assinatura"
              width={300}
              height={140}
              className="w-full h-auto drop-shadow-md opacity-90 hover:opacity-100 transition-opacity"
            />
          </div>

          <div className="ornament-divider max-w-xs mb-6">
            <span className="text-[#d4af37] text-xs">⚔</span>
          </div>

          <p className="font-cinzel text-sm text-[#d4af37] font-bold mb-2">
            NAVALIO • O SISTEMA OPERACIONAL DA BARBEARIA MODERNA
          </p>
          <p className="max-w-md text-[#786e62] leading-relaxed mb-6">
            Plataforma White-Label para gestão de barbearias, repasses automáticos de comissão, 
            estorno inteligente e agendamentos de alta conversão.
          </p>

          <p className="text-[11px] text-[#554e45]">
            © {new Date().getFullYear()} Navalio Inc. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* 10. MODAL DE ONBOARDING COM TEMA NAVALIO */}
      {isOnboardingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in overflow-y-auto">
          <div className="relative w-full max-w-xl vintage-card border-2 border-[#d4af37]/50 p-6 sm:p-8 shadow-2xl my-6 bg-[#120f0c]">
            <button
              onClick={() => setIsOnboardingOpen(false)}
              className="absolute top-4 right-4 text-[#a89e90] hover:text-[#d4af37] p-2 text-lg font-bold"
              aria-label="Fechar"
            >
              ✕
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full border-2 border-[#d4af37] p-1 mx-auto mb-3 shadow-lg shadow-[#d4af37]/20">
                <Image
                  src="/images/branding/navalio-icon-n.jpg"
                  alt="Navalio Monograma"
                  width={56}
                  height={56}
                  className="rounded-full object-cover"
                />
              </div>
              <h3 className="text-2xl font-cinzel font-bold text-white">
                Cadastre sua Barbearia
              </h3>
              <p className="text-xs text-[#a89e90] mt-1 font-sans">
                Configure sua barbearia em menos de 2 minutos e comece seu teste grátis no Navalio.
              </p>
            </div>

            {onboardingStatus && (
              <div
                className={`p-3.5 mb-5 rounded-xl text-xs font-sans ${
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
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    Nome da Barbearia *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Barbearia Dom Pedro"
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
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    Link Exclusivo (URL) *
                  </label>
                  <div className="flex items-center">
                    <span className="text-xs text-[#d4af37] px-2.5 py-3 bg-[#1c1813] rounded-l-xl border border-r-0 border-[#d4af37]/25">
                      /
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="barbearia-dom-pedro"
                      value={formState.slug}
                      onChange={(e) => setFormState({ ...formState, slug: handleSlugify(e.target.value) })}
                      className="input-field rounded-l-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    Seu Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Alberto Silva"
                    value={formState.fullName}
                    onChange={(e) => setFormState({ ...formState, fullName: e.target.value })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    E-mail Profissional *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="carlos@barbearia.com"
                    value={formState.email}
                    onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    CPF ou CNPJ *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={18}
                    placeholder="000.000.000-00"
                    value={formState.document}
                    onChange={(e) => setFormState({ ...formState, document: formatDocument(e.target.value) })}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    WhatsApp / Celular *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={15}
                    placeholder="(11) 99999-9999"
                    value={formState.phone}
                    onChange={(e) => setFormState({ ...formState, phone: formatPhone(e.target.value) })}
                    className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                  Senha de Acesso ao Painel *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  value={formState.password}
                  onChange={(e) => setFormState({ ...formState, password: e.target.value })}
                  className="input-field"
                />
              </div>

              {/* Endereço */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    Rua / Número
                  </label>
                  <input
                    type="text"
                    placeholder="Rua Oscar Freire, 1280"
                    value={formState.addressLine}
                    onChange={(e) => setFormState({ ...formState, addressLine: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                    Cidade / UF
                  </label>
                  <input
                    type="text"
                    placeholder="São Paulo/SP"
                    value={formState.city}
                    onChange={(e) => setFormState({ ...formState, city: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Seleção do Plano no Modal */}
              <div>
                <label className="block text-xs font-cinzel font-bold text-[#d4af37] mb-1">
                  Plano Escolhido
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {plans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-2.5 rounded-xl border text-xs text-center transition-all ${
                        selectedPlanId === p.id
                          ? 'border-[#d4af37] bg-[#d4af37]/15 text-[#fbf8f1] font-bold'
                          : 'border-[#d4af37]/20 bg-[#14100c] text-[#a89e90]'
                      }`}
                    >
                      <div className="font-cinzel truncate">{p.name.replace('Plano ', '')}</div>
                      <div className="text-[11px] text-[#d4af37] font-bold">R$ {p.monthly_price.toFixed(2)}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="gold-button w-full py-4 text-base font-cinzel font-bold mt-3 shadow-xl shadow-[#d4af37]/25"
              >
                {isSubmitting ? 'Registrando Barbearia...' : 'Concluir Cadastro & Acessar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
