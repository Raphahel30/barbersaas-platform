'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Sparkles,
  Camera,
  Upload,
  Scan,
  CheckCircle2,
  Calendar,
  RefreshCw,
  ChevronRight,
  Clock,
  Scissors,
  User,
  Info,
  ArrowLeft,
} from 'lucide-react'
import { analyzeClientVisagism } from '@/app/actions/visagism'
import type { VisagismAnalysisResult } from '@/lib/ai/visagism'

export default function VisagismPage() {
  const params = useParams()
  const router = useRouter()
  const tenantSlug = typeof params.tenantSlug === 'string' ? params.tenantSlug : ''

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<VisagismAnalysisResult | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setErrorMessage(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setImagePreview(base64)
      processImage(base64)
    }
    reader.readAsDataURL(file)
  }

  async function processImage(base64: string) {
    setAnalyzing(true)
    setErrorMessage(null)

    try {
      // 1. Resolver tenantId
      const resTenant = await fetch(`/api/tenant/resolve?slug=${tenantSlug}`)
      const tenantData = await resTenant.json()
      const tenantId = tenantData?.id || '00000000-0000-0000-0000-000000000001'

      // 2. Chamar IA de Visagismo
      const res = await analyzeClientVisagism(tenantId, base64)

      if (res.success) {
        setAnalysisResult(res.data)
      } else {
        setErrorMessage(res.message)
      }
    } catch (err) {
      console.error('Erro na análise facial:', err)
      setErrorMessage('Não foi possível processar a imagem. Tente novamente com boa iluminação.')
    } finally {
      setAnalyzing(false)
    }
  }

  function handleReset() {
    setImagePreview(null)
    setAnalysisResult(null)
    setErrorMessage(null)
  }

  function handleBookStyle(styleName: string) {
    router.push(`/${tenantSlug}/agendar?style=${encodeURIComponent(styleName)}`)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-16">
      {/* Header Mobile-First */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <Link
          href={`/${tenantSlug}`}
          className="flex items-center gap-1 text-slate-400 hover:text-white text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Visagismo IA
        </div>
        <div className="w-12" /> {/* Spacer */}
      </header>

      <main className="max-w-xl mx-auto p-4 space-y-6">
        {/* Banner de Apresentação */}
        {!imagePreview && !analysisResult && (
          <div className="text-center space-y-3 pt-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5">
              <Scan className="w-8 h-8 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Descubra o Corte Ideal para o seu Rosto
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
              Nossa inteligência artificial analisa a geometria da sua face (mandíbula, maçãs do rosto e testa) e recomenda 3 cortes e estilos de barba que valorizam seu perfil.
            </p>

            {/* Inputs Ocultos */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Botões de Ação */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-95 text-sm"
              >
                <Camera className="w-5 h-5" />
                Tirar Selfie com a Câmera
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold py-3.5 px-4 rounded-xl transition active:scale-95 text-sm"
              >
                <Upload className="w-5 h-5 text-slate-400" />
                Enviar Foto da Galeria
              </button>
            </div>

            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 text-[11px] text-slate-400 flex items-start gap-2.5 text-left mt-6">
              <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Dica para maior precisão:</strong> Mantenha o rosto centralizado, iluminação frontal e expressão neutra sem óculos escuros ou boné.
              </span>
            </div>
          </div>
        )}

        {/* Feedback de Erro */}
        {errorMessage && (
          <div className="bg-red-950/70 border border-red-800 text-red-300 text-xs p-3.5 rounded-xl text-center space-y-2">
            <p>{errorMessage}</p>
            <button
              onClick={handleReset}
              className="text-amber-400 underline font-semibold text-xs"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Efeito de Scanner Animado durante Análise */}
        {analyzing && imagePreview && (
          <div className="text-center space-y-4 pt-4">
            <div className="relative w-64 h-80 mx-auto rounded-2xl overflow-hidden border-2 border-amber-500/50 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview}
                alt="Selfie para análise"
                className="w-full h-full object-cover filter brightness-90 contrast-110"
              />
              {/* Linha laser de escaneamento */}
              <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b] animate-bounce top-0" />
              {/* Grid cibernético overlay */}
              <div className="absolute inset-0 bg-radial from-transparent via-black/20 to-slate-950/60 pointer-events-none" />
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono text-amber-400 flex items-center gap-1.5 border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Mapeando Pontos Faciais
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Analisando Biometria Facial...</h3>
              <p className="text-xs text-slate-400 font-mono">
                Calculando proporções da mandíbula, testa e malares
              </p>
            </div>
          </div>
        )}

        {/* Resultados da Análise de Visagismo */}
        {analysisResult && !analyzing && (
          <div className="space-y-6 pt-2">
            {/* Card de Formato do Rosto Revelado */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20 border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Formato Identificado • {analysisResult.confidenceScore}% Precisão
                  </span>
                  <h2 className="text-2xl font-black text-white mt-1.5">
                    {analysisResult.faceShapeLabel}
                  </h2>
                </div>
                <button
                  onClick={handleReset}
                  className="p-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
                  title="Fazer nova análise"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                {analysisResult.faceCharacteristics}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-emerald-400 font-medium">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>Salvo na sua ficha técnica para o seu barbeiro consultar antes do corte.</span>
              </div>
            </div>

            {/* 3 Recomendações Estéticas Personalizadas */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                3 Estilos Recomendados para Valorizar seu Perfil
              </h3>

              <div className="space-y-4">
                {analysisResult.recommendations.map((rec, index) => (
                  <div
                    key={rec.id}
                    className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-amber-500/40 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">
                          {index + 1}
                        </span>
                        <h4 className="font-bold text-white text-base">{rec.title}</h4>
                      </div>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Manutenção a cada {rec.maintenanceDays} dias
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/60">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-400">Corte de Cabelo</span>
                        <p className="font-semibold text-slate-100">{rec.haircutName}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">{rec.haircutDescription}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase text-amber-400">Desenho da Barba</span>
                        <p className="font-semibold text-slate-100">{rec.beardStyle}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">{rec.beardDescription}</p>
                      </div>
                    </div>

                    <div className="text-xs text-slate-300 space-y-1">
                      <p>
                        <strong className="text-amber-300">Por que combina com você:</strong> {rec.whyItSuits}
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        <strong>Dica de finalização:</strong> {rec.stylingTip}
                      </p>
                    </div>

                    <button
                      onClick={() => handleBookStyle(rec.haircutName)}
                      className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-sm"
                    >
                      <Calendar className="w-4 h-4" />
                      Agendar este Estilo ({rec.haircutName})
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
