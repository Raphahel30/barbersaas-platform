'use client'

import { useState, useRef } from 'react'
import { addGalleryPhoto } from '@/app/actions/gallery'

export function PhotoUploadModal({
  tenantId,
  barberId,
  clients = [],
  isOpen,
  onClose,
  onSuccess,
}: {
  tenantId: string
  barberId?: string
  clients?: Array<{ id: string; full_name: string }>
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('')
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('O arquivo selecionado deve ser uma imagem válida.')
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorMsg('A imagem deve ter no máximo 8MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!imagePreview) {
      setErrorMsg('Capture ou selecione uma foto antes de salvar.')
      return
    }

    setLoading(true)
    setErrorMsg('')

    try {
      const res = await addGalleryPhoto({
        tenantId,
        storagePath: imagePreview,
        caption: caption.trim() || undefined,
        barberId: barberId || undefined,
        clientId: selectedClientId || undefined,
        isPublic,
      })

      if (!res.success) {
        setErrorMsg(res.message || 'Erro ao publicar foto.')
        setLoading(false)
        return
      }

      onSuccess()
      onClose()
      setImagePreview(null)
      setCaption('')
      setSelectedClientId('')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha no envio da foto.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1"
          aria-label="Fechar"
        >
          ✕
        </button>

        <h3 className="text-lg font-bold text-zinc-100 mb-1">Registrar Foto do Corte</h3>
        <p className="text-xs text-zinc-400 mb-4">
          Tire uma foto agora com a câmera do celular ou selecione da sua galeria.
        </p>

        {errorMsg && (
          <div className="p-3 mb-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Seletor / Preview da Imagem */}
          {imagePreview ? (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagePreview} alt="Preview do corte" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => setImagePreview(null)}
                className="absolute bottom-2 right-2 bg-red-600/90 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700"
              >
                Trocar Foto
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {/* Botão Câmera Direta */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 transition-colors text-amber-400 min-h-[100px]"
              >
                <svg className="w-8 h-8 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-bold">Abrir Câmera</span>
              </button>

              {/* Botão Galeria */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-800/40 hover:bg-zinc-800 transition-colors text-zinc-300 min-h-[100px]"
              >
                <svg className="w-8 h-8 mb-1.5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium">Galeria</span>
              </button>
            </div>
          )}

          {/* Hidden Inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Legenda */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Estilo / Descrição do Corte (opcional)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Ex: Degradê navalhado com pigmentação"
              className="input-field"
            />
          </div>

          {/* Vínculo de Cliente */}
          {clients.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">
                Vincular ao Perfil do Cliente (CRM)
              </label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="input-field"
              >
                <option value="">Nenhum (foto geral do portfólio)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Toggle Pública */}
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500/20 bg-zinc-800"
            />
            <span className="text-xs text-zinc-300">
              Exibir publicamente no site e aplicativo da barbearia
            </span>
          </label>

          {/* Botões */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-sm font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !imagePreview}
              className="flex-1 gold-button text-sm"
            >
              {loading ? 'Enviando...' : 'Publicar Foto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
