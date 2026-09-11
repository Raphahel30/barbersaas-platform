'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Star,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Sparkles,
  ExternalLink,
  Scissors,
  ArrowRight,
  ShieldCheck,
  Heart,
  RotateCcw,
} from 'lucide-react'
import { getAppointmentReviewContext, submitAppointmentReview, ReviewContext } from '@/app/actions/reviews'

export default function AppointmentReviewPage() {
  const params = useParams()
  const tenantSlug = params.tenantSlug as string
  const appointmentId = params.appointmentId as string

  const [context, setContext] = useState<ReviewContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number>(0)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [submittedResult, setSubmittedResult] = useState<{
    isPositive: boolean
    googleReviewUrl?: string
    message: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const tagsOptions = [
    'Pontualidade Impecável',
    'Higiene & Assepsia',
    'Atendimento VIP',
    'Corte Perfeito',
    'Ambiente Climatizado',
    'Café / Cerveja de Cortesia',
    'Boa Música',
    'Finalização com Pomada',
  ]

  useEffect(() => {
    async function load() {
      if (!appointmentId) return
      setLoading(true)
      const res = await getAppointmentReviewContext(appointmentId)
      if (res.success && res.context) {
        setContext(res.context)
        if (res.context.alreadyReviewed && res.context.existingRating) {
          setRating(res.context.existingRating)
        }
      } else {
        // Fallback para teste visual
        setContext({
          appointmentId,
          tenantId: 'mock-tenant',
          tenantName: 'Barbearia Vintage Club',
          barberName: 'Marcos Silva',
          services: 'Corte Degradê Navalhado + Barba Terapia',
          completedAt: new Date().toISOString(),
          alreadyReviewed: false,
          googleReviewUrl: 'https://maps.google.com',
        })
      }
      setLoading(false)
    }
    load()
  }, [appointmentId])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    )
  }

  const handleSubmit = () => {
    if (!appointmentId) return
    setErrorMessage(null)

    startTransition(async () => {
      const res = await submitAppointmentReview({
        appointmentId,
        rating,
        tags: selectedTags,
        comment: comment.trim() || undefined,
      })

      if (res.success) {
        setSubmittedResult({
          isPositive: res.isPositive,
          googleReviewUrl: res.googleReviewUrl,
          message: res.message,
        })
      } else {
        setErrorMessage(res.message || 'Erro ao enviar avaliação.')
      }
    })
  }

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 5:
        return 'Excelente! Experiência de alto padrão'
      case 4:
        return 'Muito bom! Fiquei satisfeito'
      case 3:
        return 'Regular, atendeu o básico'
      case 2:
        return 'Deixou a desejar'
      case 1:
        return 'Muito insatisfeito'
      default:
        return ''
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 text-xs">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mb-2" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Header with Shop info */}
        <div className="text-center space-y-2 border-b border-neutral-800 pb-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center font-serif font-black text-lg">
            <Scissors className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-black text-white">{context?.tenantName || 'Nossa Barbearia'}</h1>
          <p className="text-xs text-neutral-400">
            Atendimento com <strong className="text-neutral-200">{context?.barberName}</strong>
          </p>
          <p className="text-[11px] text-neutral-500 italic">{context?.services}</p>
        </div>

        {/* State 1: Submitted - Positive (4-5 Stars) */}
        {submittedResult && submittedResult.isPositive && (
          <div className="text-center space-y-4 py-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-white">Muito obrigado pela avaliação!</h2>
              <p className="text-xs text-neutral-300 max-w-xs mx-auto">
                Ficamos muito felizes que você curtiu o corte com {context?.barberName}.
              </p>
            </div>

            {/* Booster Google Maps CTA */}
            <div className="p-4 bg-gradient-to-br from-amber-500/10 via-neutral-950 to-neutral-950 border border-amber-500/40 rounded-2xl text-left space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>Ajude nossa barbearia no Google Maps</span>
              </div>
              <p className="text-[11px] text-neutral-300">
                Poderia compartilhar essa mesma avaliação de 5 estrelas no nosso perfil do Google? Leva menos de 10 segundos e faz toda a diferença para o nosso time!
              </p>

              <a
                href={submittedResult.googleReviewUrl || 'https://maps.google.com'}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs rounded-xl text-center shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-1.5"
              >
                <span>Postar no Google Maps (+1 toque)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <Link
              href={`/${tenantSlug}/cliente`}
              className="inline-block text-xs text-neutral-400 hover:text-white pt-2"
            >
              Voltar para meus agendamentos
            </Link>
          </div>
        )}

        {/* State 2: Submitted - Negative/Neutral (1-3 Stars) */}
        {submittedResult && !submittedResult.isPositive && (
          <div className="text-center space-y-4 py-4 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-black text-white">Feedback Registrado com Sucesso</h2>
              <p className="text-xs text-neutral-300 max-w-xs mx-auto leading-relaxed">
                {submittedResult.message}
              </p>
            </div>

            <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-xl text-[11px] text-neutral-400 text-left">
              🔒 <strong>Compromisso de Privacidade:</strong> Sua resposta foi enviada diretamente para a gestão da barbearia de forma confidencial.
            </div>

            <Link
              href={`/${tenantSlug}/cliente`}
              className="inline-block text-xs text-amber-400 hover:underline pt-2 font-semibold"
            >
              Voltar para meus agendamentos
            </Link>
          </div>
        )}

        {/* State 3: Interactive Review Form */}
        {!submittedResult && (
          <div className="space-y-5">
            <div className="text-center space-y-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Como foi seu atendimento hoje?
              </label>

              {/* 5-Star interactive control */}
              <div className="flex items-center justify-center gap-2 pt-1">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating || rating) >= star
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(star)}
                      className="p-1 text-neutral-600 transition transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${
                          active ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>

              <p className="text-xs font-semibold text-amber-400 h-4">
                {getRatingLabel(hoverRating || rating)}
              </p>
            </div>

            {/* Quick Tags Selection */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-neutral-400 uppercase block">
                O que você mais gostou?
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tagsOptions.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-semibold'
                          : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Comment Area */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase block">
                Comentário ou Sugestão (Opcional)
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Conte com suas palavras o que achou da experiência..."
                rows={3}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={isPending}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2"
            >
              {isPending ? 'Enviando avaliação...' : 'Concluir Avaliação'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
