'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Scissors,
  Check,
  ArrowRight,
  ArrowLeft,
  Building2,
  Clock,
  QrCode,
  Lock,
  Mail,
  Smartphone,
  MapPin,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
} from 'lucide-react'
import { createQuickBarbershop, type OnboardingWizardInput } from '@/app/actions/onboarding-wizard'

export default function ComecarWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isCompleted, setIsCompleted] = useState(false)

  // Passo 1: Identidade
  const [barbershopName, setBarbershopName] = useState('')
  const [slug, setSlug] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('SP')
  const [whatsapp, setWhatsapp] = useState('')

  // Passo 2: Operação Rápida (Serviços e Horário)
  const [services, setServices] = useState([
    { id: '1', name: 'Corte Masculino Degradê', price: 45, durationMinutes: 35, selected: true },
    { id: '2', name: 'Barboterapia com Toalha Quente', price: 35, durationMinutes: 30, selected: true },
    { id: '3', name: 'Combo Cabelo + Barba VIP', price: 75, durationMinutes: 60, selected: true },
    { id: '4', name: 'Design de Sobrancelha na Navalha', price: 15, durationMinutes: 15, selected: true },
  ])
  const [openingTime, setOpeningTime] = useState('09:00')
  const [closingTime, setClosingTime] = useState('20:00')

  // Passo 3: Recebimento & Credenciais
  const [pixKeyType, setPixKeyType] = useState('cpf')
  const [pixKey, setPixKey] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // Auto-gerar slug a partir do nome
  const handleNameChange = (name: string) => {
    setBarbershopName(name)
    const generatedSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setSlug(generatedSlug)
  }

  // Alternar seleção de serviço
  const toggleService = (id: string) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s))
    )
  }

  // Alterar preço do serviço
  const handlePriceChange = (id: string, newPrice: number) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: Math.max(0, newPrice) } : s))
    )
  }

  // Validação do Passo 1
  const handleNextFromStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    if (!barbershopName.trim()) {
      setErrorMsg('Informe o nome da sua barbearia.')
      return
    }
    if (!slug.trim()) {
      setErrorMsg('Defina o endereço/slug da sua barbearia.')
      return
    }
    if (!whatsapp.trim()) {
      setErrorMsg('Informe seu número de WhatsApp com DDD.')
      return
    }
    setCurrentStep(2)
  }

  // Validação do Passo 2
  const handleNextFromStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    const activeCount = services.filter((s) => s.selected).length
    if (activeCount === 0) {
      setErrorMsg('Selecione ao menos um serviço para inaugurar sua agenda.')
      return
    }
    setCurrentStep(3)
  }

  // Submissão Final (Passo 3)
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!pixKey.trim()) {
      setErrorMsg('Informe sua chave Pix para receber sinais de agendamento.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Informe um e-mail válido para acessar o painel.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('A senha de acesso deve ter pelo menos 6 caracteres.')
      return
    }

    setLoading(true)

    const payload: OnboardingWizardInput = {
      barbershopName,
      slug,
      city: city || 'São Paulo',
      state: state || 'SP',
      whatsapp,
      services,
      openingTime,
      closingTime,
      pixKeyType,
      pixKey,
      ownerName: ownerName || barbershopName,
      email,
      password,
    }

    try {
      const result = await createQuickBarbershop(payload)
      if (result.success && result.tenantSlug) {
        setIsCompleted(true)
        setTimeout(() => {
          router.push(`/${result.tenantSlug}/admin?tour=true`)
        }, 2200)
      } else {
        setErrorMsg(result.message || 'Falha ao concluir o cadastro.')
      }
    } catch {
      setErrorMsg('Ocorreu um erro na comunicação. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080706] text-[#fbf8f1] flex flex-col justify-between selection:bg-[#d4af37] selection:text-black">
      {/* Top Header */}
      <header className="py-4 px-6 border-b border-[#d4af37]/15 bg-[#100d0a]/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-md shadow-[#d4af37]/20">
              <Image
                src="/images/branding/navalio-icon-n.jpg"
                alt="Navalio"
                width={36}
                height={36}
                className="object-cover"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-cinzel font-black text-lg tracking-wider gold-gradient-text">
                NAVALIO
              </span>
              <span className="text-[9px] uppercase tracking-widest text-[#a89e90]">
                Onboarding Expresso
              </span>
            </div>
          </Link>

          <div className="text-xs text-[#a89e90] hidden sm:block">
            Já tem conta?{' '}
            <Link href="/login" className="text-[#d4af37] hover:underline font-semibold font-cinzel">
              Fazer Login
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 text-xs font-cinzel font-bold text-[#a89e90]">
            <span className={currentStep >= 1 ? 'text-[#d4af37]' : ''}>1. Identidade</span>
            <span className={currentStep >= 2 ? 'text-[#d4af37]' : ''}>2. Serviços & Horários</span>
            <span className={currentStep >= 3 ? 'text-[#d4af37]' : ''}>3. Chave Pix & Acesso</span>
          </div>
          <div className="h-2 w-full bg-[#1e1812] rounded-full overflow-hidden border border-[#d4af37]/20">
            <div
              className="h-full bg-gradient-to-r from-[#9b1b1b] via-[#d4af37] to-[#f7e599] transition-all duration-500 rounded-full"
              style={{ width: `${(currentStep / 3) * 100}%` }}
            />
          </div>
        </div>

        {/* Feedback de Erro */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Card do Wizard */}
        <div className="vintage-card p-6 sm:p-10 border border-[#d4af37]/30 shadow-2xl relative overflow-hidden">
          {/* Tela de Sucesso / Celebração */}
          {isCompleted ? (
            <div className="py-12 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center animate-bounce">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-cinzel font-bold text-white">
                Sua Barbearia Está Pronta!
              </h2>
              <p className="text-xs sm:text-sm text-[#a89e90] max-w-md">
                Criamos seu ambiente soberano no endereço <strong className="text-[#d4af37]">navalio.com.br/{slug}</strong>. Redirecionando para seu painel administrativo...
              </p>
              <div className="flex items-center gap-2 text-xs font-cinzel text-[#d4af37] pt-4">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span>Carregando Dashboard da Barbearia...</span>
              </div>
            </div>
          ) : (
            <>
              {/* PASSO 1: IDENTIDADE */}
              {currentStep === 1 && (
                <form onSubmit={handleNextFromStep1} className="space-y-6">
                  <div>
                    <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider">
                      Passo 1 de 3
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-cinzel font-bold text-white mt-1">
                      Qual é o nome da sua Barbearia?
                    </h2>
                    <p className="text-xs sm:text-sm text-[#a89e90] mt-1">
                      Configure em menos de 1 minuto o endereço exclusivo que seus clientes usarão para agendar.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Nome Comercial da Barbearia *
                      </label>
                      <div className="relative">
                        <Building2 className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a89e90]" />
                        <input
                          type="text"
                          required
                          value={barbershopName}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="Ex: Barbearia Dom Pedro"
                          className="w-full bg-[#120f0c] border border-[#d4af37]/25 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                        Link Exclusivo de Agendamento (URL) *
                      </label>
                      <div className="flex items-center bg-[#120f0c] border border-[#d4af37]/25 rounded-xl px-3.5 py-3 text-sm">
                        <span className="text-xs text-[#a89e90] shrink-0">navalio.com.br/</span>
                        <input
                          type="text"
                          required
                          value={slug}
                          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          placeholder="minha-barbearia"
                          className="w-full bg-transparent text-white font-semibold focus:outline-none pl-1"
                        />
                      </div>
                      <p className="text-[11px] text-[#a89e90] mt-1">
                        Este será o link oficial enviado no WhatsApp para seus clientes agendarem.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                          Cidade *
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a89e90]" />
                          <input
                            type="text"
                            required
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="São Paulo"
                            className="w-full bg-[#120f0c] border border-[#d4af37]/25 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                          WhatsApp de Contato da Barbearia *
                        </label>
                        <div className="relative">
                          <Smartphone className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a89e90]" />
                          <input
                            type="tel"
                            required
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            placeholder="(11) 99999-9999"
                            className="w-full bg-[#120f0c] border border-[#d4af37]/25 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button type="submit" className="gold-button text-xs sm:text-sm px-6 py-3 flex items-center gap-2">
                      <span>Avançar para Serviços</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* PASSO 2: OPERAÇÃO RÁPIDA (SERVIÇOS & HORÁRIOS) */}
              {currentStep === 2 && (
                <form onSubmit={handleNextFromStep2} className="space-y-6">
                  <div>
                    <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider">
                      Passo 2 de 3
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-cinzel font-bold text-white mt-1">
                      Serviços e Horário de Atendimento
                    </h2>
                    <p className="text-xs sm:text-sm text-[#a89e90] mt-1">
                      Selecione os serviços que você já oferece e ajuste os preços padrão da sua região.
                    </p>
                  </div>

                  {/* Lista de Serviços Pré-Configurados */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-zinc-300">
                      Serviços Iniciais (marque os que deseja ativar):
                    </label>
                    <div className="space-y-2.5">
                      {services.map((svc) => (
                        <div
                          key={svc.id}
                          className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            svc.selected
                              ? 'bg-[#181410] border-[#d4af37]/50 shadow-md'
                              : 'bg-[#100d0a] border-zinc-800 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={svc.selected}
                              onChange={() => toggleService(svc.id)}
                              className="w-4 h-4 rounded text-[#d4af37] bg-zinc-900 border-zinc-700 focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <p className="font-cinzel font-bold text-white text-sm">
                                {svc.name}
                              </p>
                              <p className="text-[11px] text-[#a89e90]">
                                Duração estimada: {svc.durationMinutes} minutos
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className="text-xs text-[#a89e90]">Preço R$</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              disabled={!svc.selected}
                              value={svc.price}
                              onChange={(e) => handlePriceChange(svc.id, Number(e.target.value))}
                              className="w-24 bg-[#120f0c] border border-[#d4af37]/30 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold text-right focus:outline-none focus:border-[#d4af37] disabled:opacity-40"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Horário de Funcionamento */}
                  <div className="p-4 rounded-xl bg-[#120f0c] border border-[#d4af37]/20 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-cinzel font-bold text-[#d4af37]">
                      <Clock className="w-4 h-4" />
                      <span>Horário Padrão de Funcionamento</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] text-[#a89e90] block mb-1">Abertura:</label>
                        <input
                          type="time"
                          value={openingTime}
                          onChange={(e) => setOpeningTime(e.target.value)}
                          className="w-full bg-[#181410] border border-zinc-800 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[#a89e90] block mb-1">Fechamento:</label>
                        <input
                          type="time"
                          value={closingTime}
                          onChange={(e) => setClosingTime(e.target.value)}
                          className="w-full bg-[#181410] border border-zinc-800 rounded-lg p-2 text-xs text-white"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-[#a89e90] hover:text-white flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <button type="submit" className="gold-button text-xs sm:text-sm px-6 py-3 flex items-center gap-2">
                      <span>Avançar para Chave Pix</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* PASSO 3: RECEBIMENTO & CREDENCIAIS */}
              {currentStep === 3 && (
                <form onSubmit={handleFinalSubmit} className="space-y-6">
                  <div>
                    <span className="text-xs font-cinzel font-bold text-[#d4af37] uppercase tracking-wider">
                      Passo 3 de 3
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-cinzel font-bold text-white mt-1">
                      Onde você deseja receber seus pagamentos?
                    </h2>
                    <p className="text-xs sm:text-sm text-[#a89e90] mt-1">
                      Configure a chave Pix para recebimento direto de sinais e crie sua senha de administrador.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Chave Pix */}
                    <div className="p-4 rounded-xl bg-[#120f0c] border border-[#d4af37]/30 space-y-3">
                      <div className="flex items-center gap-2 text-xs font-cinzel font-bold text-[#d4af37]">
                        <QrCode className="w-4 h-4" />
                        <span>Chave Pix da Barbearia</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] text-[#a89e90] block mb-1">Tipo de Chave:</label>
                          <select
                            value={pixKeyType}
                            onChange={(e) => setPixKeyType(e.target.value)}
                            className="w-full bg-[#181410] border border-[#d4af37]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          >
                            <option value="cpf">CPF</option>
                            <option value="cnpj">CNPJ</option>
                            <option value="telefone">Celular / WhatsApp</option>
                            <option value="email">E-mail</option>
                            <option value="aleatoria">Chave Aleatória</option>
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[11px] text-[#a89e90] block mb-1">Chave Pix para Recebimento: *</label>
                          <input
                            type="text"
                            required
                            value={pixKey}
                            onChange={(e) => setPixKey(e.target.value)}
                            placeholder="Insira sua chave Pix..."
                            className="w-full bg-[#181410] border border-[#d4af37]/20 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-[#a89e90]">
                        🛡️ Seus clientes pagarão o sinal de reserva diretamente via Pix nesta chave.
                      </p>
                    </div>

                    {/* Acesso do Dono */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-xs font-cinzel font-bold text-white uppercase tracking-wider">
                        Criar Credenciais de Administrador
                      </h3>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Nome do Responsável / Mestre Barbeiro *
                        </label>
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="Ex: Carlos Eduardo"
                          className="w-full bg-[#120f0c] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          E-mail de Login *
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a89e90]" />
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seuemail@barbearia.com"
                            className="w-full bg-[#120f0c] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Senha de Acesso ao Painel *
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#a89e90]" />
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full bg-[#120f0c] border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37]"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2.5 rounded-xl border border-zinc-800 text-xs font-semibold text-[#a89e90] hover:text-white flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Voltar</span>
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="gold-button text-xs sm:text-sm px-8 py-3.5 flex items-center gap-2 shadow-xl shadow-[#d4af37]/20"
                    >
                      {loading ? (
                        <>
                          <Sparkles className="w-4 h-4 animate-spin text-black" />
                          <span>Inaugurando Barbearia...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Concluir e Abrir Minha Barbearia</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-[#d4af37]/10 text-center text-[11px] text-[#a89e90]">
        Navalio OS • Plataforma de Gestão Soberana para Barbearias de Elite
      </footer>
    </div>
  )
}
