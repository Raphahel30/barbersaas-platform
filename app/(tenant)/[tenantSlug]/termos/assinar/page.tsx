'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useParams } from 'next/navigation'
import {
  FileCheck2,
  PenTool,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Building,
  Lock,
  Camera,
  Users,
} from 'lucide-react'
import {
  getContractTemplateAction,
  submitSignatureAction,
} from '@/app/actions/signatures'
import type { DocumentType } from '@/lib/legal/signatures'

export default function ElectronicSignaturePage() {
  const params = useParams()
  const tenantSlug = (params?.tenantSlug as string) || ''

  const [documentType, setDocumentType] = useState<DocumentType>('image_use_consent')
  const [signerName, setSignerName] = useState('')
  const [signerDocument, setSignerDocument] = useState('')
  const [signerEmail, setSignerEmail] = useState('')
  const [agreed, setAgreed] = useState(false)

  const [contractTitle, setContractTitle] = useState('Termo de Autorização')
  const [contractBody, setContractBody] = useState('')
  const [tenantName, setTenantName] = useState('Barbearia')

  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [signedResult, setSignedResult] = useState<{
    id: string
    sha256Hash: string
    createdAt: string
  } | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  // Carrega minuta contratual ao mudar o tipo ou o documento
  useEffect(() => {
    if (!tenantSlug) return

    async function loadTemplate() {
      const res = await getContractTemplateAction(
        tenantSlug,
        documentType,
        signerName || 'Signatário',
        signerDocument || '000.000.000-00'
      )
      if (res.success) {
        setContractTitle(res.data.title)
        setContractBody(res.data.bodyText)
        setTenantName(res.data.tenantName)
      }
    }

    loadTemplate()
  }, [tenantSlug, documentType, signerName, signerDocument])

  // Ajusta dimensões do canvas para retina/alta densidade de pixels
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#10b981' // Verde esmeralda de assinatura digital
    ctx.lineWidth = 2.5
  }, [])

  // Funções do Canvas Touch / Mouse
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    } else if ('clientX' in e) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
    return { x: 0, y: 0 }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCoordinates(e)
    ctx.beginPath()
    ctx.moveTo(coords.x, coords.y)
    setIsDrawing(true)
    setHasDrawn(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCoordinates(e)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.closePath()
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  // Submissão da assinatura
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!signerName.trim()) {
      setErrorMsg('Por favor, informe seu nome completo.')
      return
    }

    if (signerDocument.replace(/\D/g, '').length < 11) {
      setErrorMsg('Por favor, informe um CPF ou CNPJ válido.')
      return
    }

    if (!agreed) {
      setErrorMsg('É necessário declarar ciência e concordância com os termos.')
      return
    }

    if (!hasDrawn || !canvasRef.current) {
      setErrorMsg('Por favor, assine no campo indicado na tela.')
      return
    }

    const signatureDataUrl = canvasRef.current.toDataURL('image/png')

    startTransition(async () => {
      const res = await submitSignatureAction({
        tenantSlugOrId: tenantSlug,
        documentType,
        signerName,
        signerDocument,
        signerEmail,
        signaturePngBase64: signatureDataUrl,
        contractText: contractBody,
      })

      if (res.success) {
        setSignedResult(res.data)
      } else {
        setErrorMsg(res.message)
      }
    })
  }

  const copyHashToClipboard = () => {
    if (!signedResult?.sha256Hash) return
    navigator.clipboard.writeText(signedResult.sha256Hash)
    setCopiedHash(true)
    setTimeout(() => setCopiedHash(false), 2000)
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header com Identidade da Barbearia */}
        <div className="text-center space-y-2 border-b border-neutral-800 pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Plataforma de Assinatura Eletrônica Segura
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-100">
            {tenantName}
          </h1>
          <p className="text-sm text-neutral-400">
            Formalização jurídica em conformidade com a MP nº 2.200-2/2001 e Lei Federal nº 14.063/2020.
          </p>
        </div>

        {/* Tela de Sucesso após Assinatura */}
        {signedResult ? (
          <div className="bg-neutral-900 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-6 text-center shadow-2xl backdrop-blur-sm">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-neutral-100">Assinatura Digital Registrada com Sucesso!</h2>
              <p className="text-sm text-neutral-400">
                Seu termo foi autenticado e arquivado com carimbo de tempo auditável.
              </p>
            </div>

            {/* Certificado de Auditoria */}
            <div className="bg-neutral-950/80 border border-neutral-800 rounded-xl p-4 text-left space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
                <span className="text-neutral-400 uppercase font-sans font-semibold text-[11px] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Hash SHA-256 Inviolável
                </span>
                <button
                  onClick={copyHashToClipboard}
                  className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-sans text-xs transition-colors"
                >
                  {copiedHash ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copiar Hash
                    </>
                  )}
                </button>
              </div>

              <div className="p-2.5 bg-neutral-900 rounded-lg text-emerald-400 break-all leading-relaxed">
                {signedResult.sha256Hash}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-neutral-400 pt-1 font-sans">
                <div>
                  <span className="text-neutral-500 font-medium">Signatário:</span> {signerName.toUpperCase()}
                </div>
                <div>
                  <span className="text-neutral-500 font-medium">Documento:</span> {signerDocument}
                </div>
                <div>
                  <span className="text-neutral-500 font-medium">Registro ID:</span> {signedResult.id}
                </div>
                <div>
                  <span className="text-neutral-500 font-medium">Data/Hora UTC:</span>{' '}
                  {new Date(signedResult.createdAt).toLocaleString('pt-BR')}
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setSignedResult(null)
                  clearCanvas()
                  setAgreed(false)
                }}
                className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-sm font-semibold rounded-xl transition-colors"
              >
                Assinar Outro Termo
              </button>
            </div>
          </div>
        ) : (
          /* Formulário de Assinatura */
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Seleção do Tipo de Documento */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-3">
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Selecione o Documento / Finalidade
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setDocumentType('image_use_consent')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center gap-2.5 ${
                    documentType === 'image_use_consent'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Uso de Imagem & Voz</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDocumentType('partner_contract')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center gap-2.5 ${
                    documentType === 'partner_contract'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Building className="w-4 h-4 shrink-0" />
                  <span>Salão-Parceiro (Lei 13.352)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDocumentType('service_waiver')}
                  className={`p-3 rounded-xl border text-left text-xs transition-all flex items-center gap-2.5 ${
                    documentType === 'service_waiver'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <Users className="w-4 h-4 shrink-0" />
                  <span>Procedimento Químico</span>
                </button>
              </div>
            </div>

            {/* Dados do Signatário */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-200">Identificação do Signatário</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-neutral-400 mb-1">Nome Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo de Oliveira"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1">CPF ou CNPJ *</label>
                  <input
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={signerDocument}
                    onChange={(e) => setSignerDocument(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-neutral-400 mb-1">E-mail (para recebimento de cópia)</label>
                  <input
                    type="email"
                    placeholder="seuemail@exemplo.com"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Visualização da Minuta do Termo */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  {contractTitle}
                </h3>
              </div>
              <div className="p-4 bg-neutral-950 rounded-xl text-xs text-neutral-300 font-sans leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto border border-neutral-800/80">
                {contractBody || 'Carregando minuta contratual...'}
              </div>
            </div>

            {/* Campo Touch de Assinatura */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <PenTool className="w-4 h-4 text-emerald-400" /> Assine no Campo Abaixo (com o dedo ou caneta touch) *
                </label>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-rose-400 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Limpar Traço
                </button>
              </div>

              <div className="relative border-2 border-dashed border-neutral-700 rounded-xl bg-neutral-950 overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-neutral-600">
                    ✍️ Assine aqui com o dedo ou stylus
                  </div>
                )}
              </div>
            </div>

            {/* Checkbox de Aceite Legal */}
            <label className="flex items-start gap-3 cursor-pointer p-2">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-neutral-700 bg-neutral-950 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-xs text-neutral-300 leading-relaxed">
                Declaro que li, compreendi e concordo integralmente com todas as cláusulas deste instrumento,
                autorizando o registro eletrônico da minha assinatura com carimbo temporal e hash criptográfico de
                auditoria.
              </span>
            </label>

            {/* Botão de Envio */}
            <button
              type="submit"
              disabled={isPending || !agreed || !hasDrawn}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 disabled:hover:bg-emerald-500 text-neutral-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              {isPending ? 'Validando e Criptografando...' : 'Confirmar e Assinar Eletronicamente'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
