'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getOnboardingState, saveOnboarding, type InitialServiceInput } from '@/app/actions/onboarding'

export default function OnboardingPage() {
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [tenantId, setTenantId] = useState('')
  const [tenantSlug, setTenantSlug] = useState('')

  // Etapa 1: Identidade Básica
  const [name, setName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [phone, setPhone] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('SP')

  // Etapa 2: Equipe e Grade
  const [openingHours, setOpeningHours] = useState('Seg a Sáb: 09h às 20h')
  const [barberName, setBarberName] = useState('')

  // Etapa 3: Cardápio Inicial (Pelo menos 2 serviços)
  const [services, setServices] = useState<InitialServiceInput[]>([
    { name: 'Corte Degradê / Social', duration_minutes: 35, price: 50, reservation_fee: 15 },
    { name: 'Barboterapia Completa', duration_minutes: 30, price: 40, reservation_fee: 10 },
  ])

  // Etapa 4: Recebimento
  const [zeroReservationFee, setZeroReservationFee] = useState(true)
  const [selectedGateway, setSelectedGateway] = useState<'asaas' | 'mercado_pago' | 'infinitepay'>('asaas')

  // Etapa 5: Finalização
  const [publicUrl, setPublicUrl] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const meRes = await fetch('/api/tenant/me')
        const meData = await meRes.json()
        const id = meData?.tenantId || meData?.id

        if (!id) {
          setLoading(false)
          return
        }

        setTenantId(id)
        const state = await getOnboardingState(id)

        if (state.tenant) {
          setName(state.tenant.name || '')
          setTenantSlug(state.tenant.slug || '')
          const addr = (state.tenant.address as any) || {}
          setStreet(addr.street || '')
          setNumber(addr.number || '')
          setNeighborhood(addr.neighborhood || '')
          setCity(addr.city || '')
          setState(addr.state || 'SP')

          const visual = (state.tenant.visual_settings as any) || {}
          setLogoUrl(visual.logoUrl || '')
          setPhone(visual.phone || '')
          if (visual.openingHoursText) setOpeningHours(visual.openingHoursText)
        }

        if (state.barbers && state.barbers.length > 0) {
          setBarberName(state.barbers[0].full_name)
        }

        if (state.services && state.services.length >= 2) {
          setServices(
            state.services.map((s) => ({
              name: s.name,
              duration_minutes: s.duration_minutes,
              price: Number(s.price),
              reservation_fee: Number(s.reservation_fee),
            })),
          )
        }
      } catch (err) {
        console.error('Erro ao carregar estado de onboarding:', err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined' && tenantSlug) {
      const origin = window.location.origin
      setPublicUrl(`${origin}/${tenantSlug}`)
    }
  }, [tenantSlug])

  function handleServiceChange(index: number, field: keyof InitialServiceInput, value: any) {
    const updated = [...services]
    updated[index] = { ...updated[index], [field]: value }
    setServices(updated)
  }

  function addService() {
    setServices([
      ...services,
      { name: 'Combo Cabelo + Barba', duration_minutes: 60, price: 85, reservation_fee: 25 },
    ])
  }

  function removeService(index: number) {
    if (services.length <= 1) return
    setServices(services.filter((_, i) => i !== index))
  }

  async function handleFinalize() {
    if (!tenantId) return
    setSaving(true)

    try {
      const res = await saveOnboarding(tenantId, {
        name,
        logoUrl,
        phone,
        address: {
          street,
          number,
          neighborhood,
          city,
          state,
        },
        openingHoursText: openingHours,
        barberName,
        services,
        activeGateway: zeroReservationFee ? null : selectedGateway,
        zeroReservationFee,
      })

      if (res.success) {
        if (res.slug) setTenantSlug(res.slug)
        setStep(5)
      } else {
        alert(res.message || 'Erro ao salvar.')
      }
    } catch (err) {
      alert('Falha ao salvar onboarding.')
    } finally {
      setSaving(false)
    }
  }

  function copyToClipboard() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl)
    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2500)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-amber-500 font-semibold text-sm">
          <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          Preparando assistente de configuração...
        </div>
      </div>
    )
  }

  const progressPercent = ((step - 1) / 4) * 100

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-between p-4 sm:p-6 font-sans">
      {/* Top Header & Logo */}
      <div className="w-full max-w-2xl mx-auto space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-lg">
              ✂
            </span>
            <span className="font-extrabold text-lg text-white font-outfit">
              Configuração Rápida da Barbearia
            </span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-amber-400">
            Etapa {step} de 5
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-zinc-800">
          <div
            className="bg-amber-500 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Card Central com as Etapas */}
      <div className="w-full max-w-2xl mx-auto my-6">
        <div className="glass-card p-6 sm:p-8 border-zinc-800 space-y-6">
          {/* ETAPA 1: Identidade Básica */}
          {step === 1 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white font-outfit">
                  1. Identidade e Localização
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Como os clientes reconhecerão sua barbearia no aplicativo.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Nome Fantasia da Barbearia *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Barbearia Dom Carlos"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      WhatsApp para Notificações *
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-8888"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-semibold mb-1">
                      URL do Logo (Opcional)
                    </label>
                    <input
                      type="url"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://sua-foto.com/logo.png"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800/80 pt-4 space-y-3">
                  <p className="text-zinc-400 font-semibold">Endereço de Atendimento:</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-zinc-400 mb-1">Rua / Avenida</label>
                      <input
                        type="text"
                        value={street}
                        onChange={(e) => setStreet(e.target.value)}
                        placeholder="Rua Augusta"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Número</label>
                      <input
                        type="text"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="1500"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-zinc-400 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={neighborhood}
                        onChange={(e) => setNeighborhood(e.target.value)}
                        placeholder="Consolação"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="São Paulo"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">UF</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="SP"
                        maxLength={2}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none uppercase"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2: Equipe e Grade */}
          {step === 2 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white font-outfit">
                  2. Horários e Primeiro Barbeiro
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Defina a janela padrão de abertura e quem realizará os primeiros cortes.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Horário de Funcionamento Exibido *
                  </label>
                  <input
                    type="text"
                    value={openingHours}
                    onChange={(e) => setOpeningHours(e.target.value)}
                    placeholder="Seg a Sáb: 09h às 20h"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none text-sm"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Este texto aparece no topo do PWA para orientar os clientes.
                  </p>
                </div>

                <div>
                  <label className="block text-zinc-300 font-semibold mb-1">
                    Nome do Primeiro Barbeiro (ou Seu Nome) *
                  </label>
                  <input
                    type="text"
                    value={barberName}
                    onChange={(e) => setBarberName(e.target.value)}
                    placeholder="Ex: Carlos Mestre Navalha"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none text-sm"
                  />
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Você poderá convidar mais profissionais com comissões individuais no painel da equipe.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: Cardápio Inicial */}
          {step === 3 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white font-outfit">
                    3. Seus Serviços Iniciais
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Cadastre os principais serviços oferecidos aos clientes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addService}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                >
                  + Adicionar Serviço
                </button>
              </div>

              <div className="space-y-3">
                {services.map((srv, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-300">Serviço #{idx + 1}</span>
                      {services.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeService(idx)}
                          className="text-red-400 hover:text-red-300 text-[11px]"
                        >
                          Remover
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1">Nome do Serviço</label>
                      <input
                        type="text"
                        value={srv.name}
                        onChange={(e) => handleServiceChange(idx, 'name', e.target.value)}
                        placeholder="Ex: Corte Degradê"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white placeholder-zinc-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-zinc-400 mb-1">Duração (min)</label>
                        <input
                          type="number"
                          value={srv.duration_minutes}
                          onChange={(e) =>
                            handleServiceChange(idx, 'duration_minutes', Number(e.target.value))
                          }
                          min={10}
                          step={5}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 mb-1">Preço Total (R$)</label>
                        <input
                          type="number"
                          value={srv.price}
                          onChange={(e) =>
                            handleServiceChange(idx, 'price', Number(e.target.value))
                          }
                          min={0}
                          step={5}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none font-bold text-amber-400"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 mb-1">Taxa Sinal (R$)</label>
                        <input
                          type="number"
                          value={srv.reservation_fee}
                          onChange={(e) =>
                            handleServiceChange(idx, 'reservation_fee', Number(e.target.value))
                          }
                          min={0}
                          step={5}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ETAPA 4: Recebimento */}
          {step === 4 && (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <h2 className="text-xl font-bold text-white font-outfit">
                  4. Como Deseja Receber?
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Configure a cobrança do agendamento ou comece sem taxa de reserva.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Opção A: Balcão Puro (Zero Reserva) */}
                <label
                  onClick={() => setZeroReservationFee(true)}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    zeroReservationFee
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="gateway_mode"
                    checked={zeroReservationFee}
                    onChange={() => setZeroReservationFee(true)}
                    className="mt-0.5 text-amber-500"
                  />
                  <div>
                    <span className="font-bold text-white block text-sm">
                      Pagamento Direto no Balcão (Recomendado para início)
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Taxa de reserva zero. O cliente agenda em 2 cliques sem pagar nada adiantado e quita o valor completo no balcão via Pix, maquininha ou dinheiro.
                    </p>
                  </div>
                </label>

                {/* Opção B: Cobrar Taxa de Reserva Online */}
                <label
                  onClick={() => setZeroReservationFee(false)}
                  className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                    !zeroReservationFee
                      ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                      : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="gateway_mode"
                    checked={!zeroReservationFee}
                    onChange={() => setZeroReservationFee(false)}
                    className="mt-0.5 text-amber-500"
                  />
                  <div>
                    <span className="font-bold text-white block text-sm">
                      Cobrar Sinal Pix Online (Anti-No-Show)
                    </span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      O cliente paga um sinal (ex: R$ 15,00) via Pix imediato para garantir a vaga na agenda.
                    </p>
                  </div>
                </label>

                {!zeroReservationFee && (
                  <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 animate-fadeIn">
                    <p className="font-semibold text-zinc-300">Escolha o Gateway:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'asaas', label: 'Asaas Pix' },
                        { id: 'mercado_pago', label: 'Mercado Pago' },
                        { id: 'infinitepay', label: 'InfinitePay' },
                      ].map((gw) => (
                        <button
                          key={gw.id}
                          type="button"
                          onClick={() => setSelectedGateway(gw.id as any)}
                          className={`p-2.5 rounded-lg border text-center font-bold text-xs transition-colors ${
                            selectedGateway === gw.id
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                          }`}
                        >
                          {gw.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Você poderá inserir as chaves de API do gateway em Configurações ➔ Pagamentos a qualquer momento.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ETAPA 5: Ativação & Compartilhamento */}
          {step === 5 && (
            <div className="space-y-6 text-center animate-fadeIn py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto text-2xl">
                ✓
              </div>

              <div>
                <h2 className="text-2xl font-black text-white font-outfit">
                  Sua Barbearia Está Online!
                </h2>
                <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
                  O link público de agendamento dos seus clientes já está pronto e ativo.
                </p>
              </div>

              {/* Box com o Link Público */}
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 text-left">
                <p className="text-xs font-semibold text-zinc-400">Seu Link de Agendamento:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={publicUrl}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-amber-400 text-xs font-mono font-bold select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-bold hover:bg-zinc-700 whitespace-nowrap"
                  >
                    {copySuccess ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Agende seu horário na ${name}! Acesse: ${publicUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-colors"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                  </svg>
                  Compartilhar no WhatsApp
                </a>

                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs border border-zinc-700 transition-colors"
                >
                  Abrir PWA do Cliente
                </a>
              </div>
            </div>
          )}

          {/* Rodapé de Navegação do Wizard */}
          <div className="flex items-center justify-between border-t border-zinc-800/80 pt-5">
            {step > 1 && step < 5 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="text-xs font-semibold text-zinc-400 hover:text-white px-3 py-2"
              >
                ← Voltar
              </button>
            ) : (
              <div />
            )}

            {step < 4 && (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                className="gold-button text-xs font-bold px-6 py-2.5"
              >
                Próximo Passo →
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleFinalize}
                disabled={saving}
                className="gold-button text-xs font-bold px-6 py-2.5 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Ativar Minha Barbearia ✓'}
              </button>
            )}

            {step === 5 && (
              <Link
                href="/dashboard/agenda"
                className="w-full gold-button text-xs font-bold px-6 py-3 text-center"
              >
                Ir para o Painel da Agenda 🚀
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Footer discreto */}
      <div className="text-center text-[11px] text-zinc-600 pb-4">
        Plataforma SaaS para Barbearias • Configuração Simplificada
      </div>
    </div>
  )
}
