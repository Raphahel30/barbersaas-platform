'use client'

import { useState } from 'react'

export type GalleryPhotoItem = {
  id: string
  storage_path: string
  caption: string | null
  created_at: string
  barber?: { id: string; full_name: string; avatar_url: string | null } | null
  client?: { id: string; full_name: string; avatar_url: string | null } | null
}

export function GalleryGrid({
  photos,
  title = 'Galeria de Cortes',
  emptyMessage = 'Nenhuma foto publicada ainda.',
}: {
  photos: GalleryPhotoItem[]
  title?: string
  emptyMessage?: string
}) {
  const [selectedPhoto, setSelectedPhoto] = useState<GalleryPhotoItem | null>(null)

  return (
    <div className="w-full">
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-zinc-100">{title}</h2>
          <span className="text-xs text-amber-500 font-semibold px-2.5 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
            {photos.length} {photos.length === 1 ? 'corte' : 'cortes'}
          </span>
        </div>
      )}

      {photos.length === 0 ? (
        <div className="glass-card p-8 text-center text-zinc-400">
          <svg className="w-12 h-12 mx-auto mb-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 transition-all duration-300 shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.storage_path}
                alt={photo.caption || 'Foto do corte'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5 sm:p-3">
                {photo.caption && (
                  <p className="text-xs font-medium text-zinc-200 line-clamp-1">{photo.caption}</p>
                )}
                {photo.barber && (
                  <p className="text-[11px] text-amber-400 font-semibold mt-0.5">Por: {photo.barber.full_name}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 text-zinc-300 hover:text-white flex items-center justify-center transition-colors"
              aria-label="Fechar"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedPhoto.storage_path}
              alt={selectedPhoto.caption || 'Corte em destaque'}
              className="w-full max-h-[70vh] object-contain bg-black"
            />
            <div className="p-4 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  {selectedPhoto.caption || 'Corte Profissional'}
                </p>
                {selectedPhoto.barber && (
                  <p className="text-xs text-amber-500 font-medium">
                    Barbeiro: {selectedPhoto.barber.full_name}
                  </p>
                )}
              </div>
              <span className="text-[11px] text-zinc-500">
                {new Date(selectedPhoto.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
