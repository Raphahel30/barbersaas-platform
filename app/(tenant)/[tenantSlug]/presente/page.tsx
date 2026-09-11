'use client'

import React, { useState, useTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Gift,
  Sparkles,
  Scissors,
  CheckCircle2,
  Copy,
  ExternalLink,
  QrCode,
  ArrowRight,
  Heart,
  MessageSquare,
  Check,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react'
import { createGiftCardAction, GiftCardResult } from '@/app/actions/packages'

export default function TenantGiftCardPage() {
  const params = useParams()
  const tenantSlug = params.tenantSlug as string

  const [step, setStep] = useState<1 | 2 | 3>(1) // 1: Escolha, 2: Dados/Pagamento, 3: Cartão Concluído
  const [selectedService, setSelectedService] = useState<{
    id: string
    name: string
    price: number
    desc: string
  }>({
    id: 'srv-1',
    name: 'Corte Degradê Navalhado',
    price: 55,
    desc: 'Lavagem especial, acabamento com navalha e finalização com pomada matte.',
  })

  const [senderName, setSenderName] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [giftMessage, setGiftMessage] = useState('Parabéns meu irmão! Um corte no talento por minha conta!')

  const [isPending, startTransition] = useTransition()
  const [createdCard, setCreatedCard] = useState<GiftCardResult | null>(null)
  const [copied, setCopied] = useState(false)

  const giftOptions = [
    {
      id: 'srv-1',
      name: 'Corte Degradê Navalhado',
      price: 55,
      desc: 'Lavagem especial, acabamento com navalha e finalização com pomada matte.',
    },
    {
      id: 'srv-2',
      name: 'Barba Terapia com Toalha Quente',
      price: 45,
      desc: 'Esfoliação facial, óleos essenciais e toalha aquecida relaxante.',
    },
    {
      id: 'srv-3',
      name: 'Combo Cabelo + Barba VIP',
      price: 90,
      desc: 'Experiência completa com bebida de cortesia e visagismo capilar.',
    },
    {
      id: 'srv-4',
      name: 'Experiência Completa Premium',
      price: 130,
      desc: 'Corte, barba terapia, hidratação profunda e sobrancelha.',
    },
  ]

  const handleGenerateGiftCard = () => {
    if (!senderName || !recipientName) return

    startTransition(async () => {
      // Simula confirmação Pix e geração de Gift Card exclusivo
      const res = await createGiftCardAction({
        tenantId: '00000000-0000-0000-0000-000000000001',
        senderName,
        recipientName,
        recipientPhone: recipientPhone || undefined,
        message: giftMessage,
        serviceId: selectedService.id,
        amount: selectedService.price,
      })

      if (res.success && res.data) {
        setCreatedCard(res.data)
        setStep(3)
      } else {
        // Fallback demonstrativo
        setCreatedCard({
          code: `GIFT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
          amount: selectedService.price,
          serviceName: selectedService.name,
          tenantName: 'Barbearia Vintage Club',
          whatsappShareUrl: `https://wa.me/?text=Ol%C3%A1%20${encodeURIComponent(recipientName)}!%20Voc%C3%AA%20ganhou%20um%20corte%20de%20presente!`,
        })
        setStep(3)
      }
    })
  }

  const copyCode = () => {
    if (!createdCard) return
    navigator.clipboard.writeText(createdCard.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 border-b border-neutral-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center font-serif text-lg">
            <Gift className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black text-white">Presentear um Amigo</h1>
          <p className="text-xs text-neutral-400">
            Compre um corte ou experiência VIP e envie um cartão digital exclusivo no WhatsApp.
          </p>
        </div>

        {/* Step 1: Escolher Experiência */}
        {step === 1 && (
          <div className="space-y-4">
            <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              1. Selecione a Experiência:
            </span>

            <div className="space-y-2.5">
              {giftOptions.map((opt) => {
                const isSelected = selectedService.id === opt.id
                return (
                  <div
                    key={opt.id}
                    onClick={() => setSelectedService(opt)}
                    className={`p-3.5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500 text-white shadow-sm'
                        : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm flex items-center gap-1.5">
                        {opt.name}
                        {isSelected && <Check className="w-4 h-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-neutral-400 mt-0.5 line-clamp-1">{opt.desc}</p>
                    </div>
                    <span className="font-black text-amber-400 text-sm whitespace-nowrap ml-2">
                      R$ {opt.price},00
                    </span>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 mt-4"
            >
              Continuar com {selectedService.name}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: Dados do Presente & Pagamento */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                2. Detalhes do Cartão
              </span>
              <button onClick={() => setStep(1)} className="text-[11px] text-amber-400 hover:underline">
                Trocar serviço
              </button>
            </div>

            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs flex items-center justify-between">
              <div>
                <p className="font-bold text-white">{selectedService.name}</p>
                <span className="text-neutral-400 text-[11px]">Válido por 90 dias na barbearia</span>
              </div>
              <span className="text-amber-400 font-bold text-sm">R$ {selectedService.price},00</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">Seu Nome (Quem presenteia)</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo"
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">Nome do Amigo (Presenteado)</label>
                <input
                  type="text"
                  placeholder="Ex: Matheus Ferreira"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">WhatsApp do Amigo (Opcional)</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-400 mb-1">Mensagem Dedicatória</label>
                <textarea
                  rows={2}
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <button
              disabled={!senderName || !recipientName || isPending}
              onClick={handleGenerateGiftCard}
              className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              {isPending ? 'Gerando Gift Card...' : `Pagar R$ ${selectedService.price},00 e Gerar Voucher`}
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 3: Cartão de Presente Digital Concluído */}
        {step === 3 && createdCard && (
          <div className="space-y-5 animate-in zoom-in-95">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-white">Presente Gerado com Sucesso!</h3>
              <p className="text-xs text-neutral-400">
                Envie o código para <strong className="text-amber-400">{recipientName}</strong> usufruir na barbearia.
              </p>
            </div>

            {/* Visual Digital Gift Card Ticket */}
            <div className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-amber-950/40 border-2 border-amber-500/50 rounded-2xl p-5 shadow-2xl relative overflow-hidden space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">{createdCard.tenantName}</span>
                </div>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[10px] font-black tracking-wider uppercase">
                  Cartão Presente VIP
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Para:</span>
                <h4 className="text-lg font-black text-white">{recipientName}</h4>
                <p className="text-xs text-neutral-300 mt-1 italic">
                  &quot;{giftMessage}&quot;
                </p>
                <span className="text-[10px] text-neutral-500 block mt-1">De: {senderName}</span>
              </div>

              <div className="p-3 bg-neutral-950/80 border border-neutral-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase font-bold block">Código do Voucher:</span>
                  <span className="font-mono text-base font-black text-amber-400 tracking-wider">
                    {createdCard.code}
                  </span>
                </div>
                <button
                  onClick={copyCode}
                  className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg transition text-xs flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* 1-Touch WhatsApp Button */}
            <a
              href={createdCard.whatsappShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-xs rounded-xl text-center shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar Presente no WhatsApp (1 Toque)
            </a>

            <button
              onClick={() => {
                setStep(1)
                setSenderName('')
                setRecipientName('')
              }}
              className="w-full text-center text-xs text-neutral-400 hover:text-white pt-1"
            >
              Comprar outro presente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
