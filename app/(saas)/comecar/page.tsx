'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Scissors,
  User,
  Building2,
  MapPin,
  Lock,
  Mail,
  Smartphone,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
  Check,
} from 'lucide-react'
import { processQuickOnboarding, type QuickOnboardingInput } from '@/app/actions/onboarding'

export default function ComecarCadastroPage() {
  const router = useRouter()

  // Bloco 1: Dono da Barbearia
  const [ownerName, setOwnerName] = useState('')
  const [document, setDocument] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Bloco 2: A Barbearia
  const [barbershopName, setBarbershopName] = useState('')
  const [slug, setSlug] = useState('')
  const [isSlugManual, setIsSlugManual] = useState(false)

  // Bloco 3: Localização
  const [cep, setCep] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('SP')
  const [loadingCep, setLoadingCep] = useState(false)

  // Estado de Envio
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Auto-slug a partir do nome
  const handleBarbershopNameChange = (name: string) => {
    setBarbershopName(name)
    if (!isSlugManual) {
      const generated = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
      setSlug(generated)
    }
  }

  // Formatação de Documento (CPF ou CNPJ)
  const handleDocumentChange = (val: string) => {
    const raw = val.replace(/\D/g, '')
    if (raw.length <= 11) {
      // CPF: 000.000.000-00
      const formatted = raw
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      setDocument(formatted)
    } else {
      // CNPJ: 00.000.000/0000-00
      const formatted = raw
        .slice(0, 14)
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
      setDocument(formatted)
    }
  }

  // Formatação de WhatsApp (11) 99999-9999
  const handleWhatsappChange = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 11)
    if (raw.length <= 10) {
      const formatted = raw
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2')
      setWhatsapp(formatted)
    } else {
      const formatted = raw
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2')
      setWhatsapp(formatted)
    }
  }

  // Busca de CEP via ViaCEP
  const handleCepChange = async (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 8)
    const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw
    setCep(formatted)

    if (raw.length === 8) {
      setLoadingCep(true)
      try {
        const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
        const data = await res.json()
        if (!data.erro) {
          setStreet(data.logradouro || '')
          setNeighborhood(data.bairro || '')
          setCity(data.localidade || '')
          setState(data.uf || 'SP')
        }
      } catch (err) {
        console.error('Erro ao consultar ViaCEP:', err)
      } finally {
        setLoadingCep(false)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!ownerName.trim()) {
      setErrorMsg('Preencha seu nome completo.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Informe um e-mail válido.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.')
      return
    }
    if (!barbershopName.trim()) {
      setErrorMsg('Informe o nome da sua barbearia.')
      return
    }
    if (!slug.trim()) {
      setErrorMsg('Defina o endereço/slug do link da sua barbearia.')
      return
    }
    if (!city.trim()) {
      setErrorMsg('Informe a cidade da sua barbearia.')
      return
    }

    setSubmitting(true)

    const payload: QuickOnboardingInput = {
      ownerName: ownerName.trim(),
      document: document.trim(),
      whatsapp: whatsapp.trim(),
      email: email.trim().toLowerCase(),
      password,
      barbershopName: barbershopName.trim(),
      slug: slug.trim(),
      cep: cep.trim(),
      street: street.trim(),
      number: number.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
    }

    try {
      const result = await processQuickOnboarding(payload)
      if (result.success && result.redirectUrl) {
        setSuccessMsg(result.message || 'Cadastro realizado com sucesso!')
        setTimeout(() => {
          router.push(result.redirectUrl!)
        }, 1000)
      } else {
        setErrorMsg(result.message || 'Falha ao processar cadastro.')
        setSubmitting(false)
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado no cadastro.')
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between selection:bg-amber-500 selection:text-zinc-950">
      {/* Top Header */}
      <header className="h-20 border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur sticky top-0 z-50 px-6 sm:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 group-hover:scale-105 transition-transform">
            <Scissors className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1">
              NAVALIO <span className="text-amber-500 text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">SAAS</span>
            </span>
            <p className="text-[10px] text-zinc-500">A plataforma completa para barbearias de elite</p>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-400 hidden sm:inline">Já tem uma conta?</span>
          <Link
            href="/login"
            className="text-xs font-semibold text-zinc-300 hover:text-white px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 transition-colors"
          >
            Fazer Login
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        {/* Hero Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Cadastro Simplificado & Acesso Imediato
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Coloque sua Barbearia no Ar em Menos de 2 Minutos
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Preencha seus dados cadastrais e seja direcionado instantaneamente para personalizar a identidade visual do seu site.
          </p>
        </div>

        {/* Feedback Alert */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs sm:text-sm font-medium flex items-center gap-3 animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-medium flex items-center gap-3 animate-pulse">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* BLOCO 1: DONO DA BARBEARIA */}
          <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">1. Dados do Responsável / Dono</h2>
                <p className="text-xs text-zinc-400">Suas credenciais de acesso como proprietário do sistema</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Nome Completo *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Rafael Santos"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">CPF ou CNPJ</label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="000.000.000-00"
                    value={document}
                    onChange={(e) => handleDocumentChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">WhatsApp / Celular com DDD *</label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    placeholder="(11) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => handleWhatsappChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">E-mail de Acesso *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="seuemail@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Senha de Acesso (Mínimo 6 dígitos) *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* BLOCO 2: A BARBEARIA */}
          <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">2. Dados do Seu Negócio & Link Oficial</h2>
                <p className="text-xs text-zinc-400">Nome comercial e o endereço web exclusivo onde seus clientes agendarão</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300">Nome da Barbearia *</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Barbearia Dom Corleone"
                    value={barbershopName}
                    onChange={(e) => handleBarbershopNameChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Link / Slug da Barbearia *</label>
                  <span className="text-[11px] text-zinc-500">Gerado automaticamente (editável)</span>
                </div>
                <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden focus-within:border-amber-500 transition-colors">
                  <span className="px-3.5 py-3 text-xs sm:text-sm text-zinc-500 bg-zinc-800/40 border-r border-zinc-800 font-mono select-none">
                    navalio.com/
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="dom-corleone"
                    value={slug}
                    onChange={(e) => {
                      setIsSlugManual(true)
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }}
                    className="w-full bg-transparent px-3.5 py-3 text-xs sm:text-sm text-amber-400 font-mono focus:outline-none"
                  />
                </div>

                {slug && (
                  <p className="text-[11px] text-emerald-400/90 font-mono flex items-center gap-1 pt-1">
                    <Check className="w-3 h-3 text-emerald-400" />
                    Seu link público será: <span className="underline">navalio.com/{slug}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* BLOCO 3: LOCALIZAÇÃO */}
          <div className="p-6 sm:p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">3. Localização & Endereço</h2>
                <p className="text-xs text-zinc-400">Digite seu CEP para preenchimento automático das informações</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-semibold text-zinc-300">CEP (Busca Automática)</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={cep}
                    onChange={(e) => handleCepChange(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                  />
                  {loadingCep && (
                    <div className="absolute right-3.5 top-3.5">
                      <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-300">Rua / Avenida</label>
                <input
                  type="text"
                  placeholder="Ex: Rua Augusta"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-semibold text-zinc-300">Número</label>
                <input
                  type="text"
                  placeholder="1500"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <label className="text-xs font-semibold text-zinc-300">Bairro</label>
                <input
                  type="text"
                  placeholder="Ex: Consolação"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-1">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">Cidade *</label>
                    <input
                      type="text"
                      required
                      placeholder="São Paulo"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div className="col-span-1 space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      placeholder="SP"
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase())}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-xs sm:text-sm text-zinc-100 uppercase text-center font-mono focus:border-amber-500 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-zinc-950 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  <span>Criando Barbearia & Configurando Site...</span>
                </>
              ) : (
                <>
                  <span>Criar Barbearia & Personalizar Meu Site</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-zinc-500 mt-3">
              Ao criar sua conta, você concorda com os Termos de Uso e Política de Privacidade da plataforma.
            </p>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} Navalio Barbershop SaaS. Todos os direitos reservados.
      </footer>
    </div>
  )
}
