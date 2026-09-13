'use client'

import { useState, useEffect } from 'react'
import {
  getTenantSiteConfig,
  saveTenantSiteConfig,
} from '@/app/actions/tenant-builder'
import {
  DEFAULT_SITE_CONFIG,
  type TenantSiteConfigData,
} from '@/lib/builder/defaults'

const PRESET_TEXTURES = [
  { id: 'clean_dark', name: 'Preto Minimalista', bg: 'bg-zinc-950', border: 'border-zinc-800' },
  { id: 'carbon', name: 'Fibra de Carbono', bg: 'bg-zinc-900', border: 'border-zinc-700' },
  { id: 'dark_wood', name: 'Madeira Nobre', bg: 'bg-[#120d09]', border: 'border-amber-950' },
  { id: 'dark_brick', name: 'Tijolo Rústico', bg: 'bg-[#141010]', border: 'border-red-950' },
  { id: 'noise_grain', name: 'Granulado Vintage', bg: 'bg-zinc-900/90', border: 'border-zinc-700' },
]

const PRESET_FONTS = [
  { id: 'font-sans', name: 'Moderna (Inter / Sans)', sample: 'Estilo Contemporâneo' },
  { id: 'font-serif', name: 'Clássica (Playfair / Serif)', sample: 'Elegância e Tradição' },
  { id: 'font-cinzel', name: 'Premium (Cinzel / Imperial)', sample: 'DISTINÇÃO E LUXO' },
  { id: 'font-bebas', name: 'Urbana (Bebas / Impact)', sample: 'FORÇA E ATITUDE' },
]

const PRESET_PALETTES = [
  { name: 'Ouro & Âmbar Imperial', primary: '#D97706', bg: '#09090b', card: '#18181b' },
  { name: 'Esmeralda & Couro Escuro', primary: '#059669', bg: '#06130d', card: '#0f241a' },
  { name: 'Rubi & Rústico Vintage', primary: '#DC2626', bg: '#100707', card: '#1e1111' },
  { name: 'Safira & Modern Navy', primary: '#2563EB', bg: '#070b14', card: '#0f172a' },
  { name: 'Platina & Monocromático', primary: '#E4E4E7', bg: '#09090b', card: '#18181b' },
]

const PRESET_AMENITIES = [
  'Cerveja Gelada',
  'Wi-Fi Grátis',
  'Ar-Condicionado',
  'Mesa de Sinuca',
  'Café Expresso Cortesia',
  'Playstation 5',
  'Estacionamento Exclusivo',
  'Toalha Quente & Barboterapia',
]

export default function TenantSiteBuilderPage() {
  const [tenantId, setTenantId] = useState<string>('')
  const [tenantSlug, setTenantSlug] = useState<string>('')
  const [tenantName, setTenantName] = useState<string>('')
  const [config, setConfig] = useState<TenantSiteConfigData>({
    ...DEFAULT_SITE_CONFIG,
    tenant_id: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [activeTab, setActiveTab] = useState<'visual' | 'content' | 'gallery' | 'sections'>('visual')
  const [newAmenity, setNewAmenity] = useState('')
  const [newPhotoUrl, setNewPhotoUrl] = useState('')

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/tenant/me')
        const tenantMe = await res.json()
        const id = tenantMe?.tenantId || tenantMe?.id

        if (id) {
          setTenantId(id)
          const result = await getTenantSiteConfig(id)
          if (result.success && result.config) {
            setConfig(result.config)
            if (result.tenant) {
              setTenantSlug(result.tenant.slug)
              setTenantName(result.tenant.name)
            }
          }
        }
      } catch (err) {
        console.error('Falha ao carregar dados do tenant:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleSave = async () => {
    if (!tenantId) {
      setFeedback({ type: 'error', text: 'Barbearia não identificada.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const result = await saveTenantSiteConfig(tenantId, config)
      if (result.success) {
        setFeedback({ type: 'success', text: result.message })
      } else {
        setFeedback({ type: 'error', text: result.message })
      }
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao salvar personalizações.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (section: keyof TenantSiteConfigData['sections_visibility']) => {
    setConfig((prev) => ({
      ...prev,
      sections_visibility: {
        ...prev.sections_visibility,
        [section]: !prev.sections_visibility[section],
      },
    }))
  }

  const toggleAmenity = (item: string) => {
    setConfig((prev) => {
      const exists = prev.amenities.includes(item)
      return {
        ...prev,
        amenities: exists ? prev.amenities.filter((a) => a !== item) : [...prev.amenities, item],
      }
    })
  }

  const addCustomAmenity = () => {
    if (!newAmenity.trim()) return
    if (!config.amenities.includes(newAmenity.trim())) {
      setConfig((prev) => ({
        ...prev,
        amenities: [...prev.amenities, newAmenity.trim()],
      }))
    }
    setNewAmenity('')
  }

  const addGalleryPhoto = () => {
    if (!newPhotoUrl.trim()) return
    setConfig((prev) => ({
      ...prev,
      gallery_photos: [...prev.gallery_photos, newPhotoUrl.trim()],
    }))
    setNewPhotoUrl('')
  }

  const removeGalleryPhoto = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      gallery_photos: prev.gallery_photos.filter((_, i) => i !== index),
    }))
  }

  const applyPalette = (palette: (typeof PRESET_PALETTES)[0]) => {
    setConfig((prev) => ({
      ...prev,
      primary_color: palette.primary,
      background_color: palette.bg,
      card_color: palette.card,
    }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm font-medium">Carregando Construtor Visual...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="h-16 border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-2">
              Construtor de Site & Identidade Visual
              {tenantName && <span className="text-xs font-normal text-zinc-400">({tenantName})</span>}
            </h1>
            <p className="text-[11px] text-zinc-400">Personalize o site da sua barbearia com Live Preview em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Device Preview Switcher */}
          <div className="flex bg-zinc-800 p-1 rounded-xl border border-zinc-700">
            <button
              onClick={() => setPreviewDevice('desktop')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                previewDevice === 'desktop' ? 'bg-amber-500 text-zinc-950 shadow-md font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              💻 Desktop
            </button>
            <button
              onClick={() => setPreviewDevice('mobile')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                previewDevice === 'mobile' ? 'bg-amber-500 text-zinc-950 shadow-md font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              📱 Mobile
            </button>
          </div>

          {tenantSlug && (
            <a
              href={`/${tenantSlug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 text-xs font-semibold text-zinc-300 border border-zinc-700 bg-zinc-800/80 rounded-xl hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
            >
              Ver Site Ao Vivo ↗
            </a>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar & Publicar'
            )}
          </button>
        </div>
      </header>

      {feedback && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Main Workspace: Left Controls (40%) + Right Live Preview (60%) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: Controls Panel */}
        <div className="lg:col-span-5 border-r border-zinc-800 bg-zinc-900/30 flex flex-col h-[calc(100vh-64px)] overflow-y-auto">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/80 sticky top-0 z-10 px-4 pt-3">
            {[
              { id: 'visual', label: '🎨 Cores & Estilo' },
              { id: 'content', label: '✍️ Textos & Hero' },
              { id: 'gallery', label: '📸 Galeria' },
              { id: 'sections', label: '⚙️ Seções & Extras' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 pb-3 text-xs font-semibold border-b-2 transition-all ${
                  activeTab === tab.id
                    ? 'border-amber-500 text-amber-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-6">
            {/* TAB 1: CORES & ESTILO */}
            {activeTab === 'visual' && (
              <div className="space-y-6">
                {/* Paletas Rápidas */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Paletas de Cores Prontas
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PRESET_PALETTES.map((p) => (
                      <button
                        key={p.name}
                        onClick={() => applyPalette(p)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center justify-between group ${
                          config.primary_color === p.primary && config.background_color === p.bg
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-xs font-medium text-zinc-200 group-hover:text-white">{p.name}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 rounded-full border border-black/40" style={{ backgroundColor: p.primary }} />
                          <span className="w-3.5 h-3.5 rounded-full border border-zinc-700" style={{ backgroundColor: p.bg }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cores Customizadas */}
                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Cores Customizadas</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400">Cor de Destaque</span>
                      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2">
                        <input
                          type="color"
                          value={config.primary_color}
                          onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                          className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.primary_color}
                          onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                          className="w-full text-xs bg-transparent text-zinc-200 uppercase font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400">Fundo da Página</span>
                      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2">
                        <input
                          type="color"
                          value={config.background_color}
                          onChange={(e) => setConfig({ ...config, background_color: e.target.value })}
                          className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.background_color}
                          onChange={(e) => setConfig({ ...config, background_color: e.target.value })}
                          className="w-full text-xs bg-transparent text-zinc-200 uppercase font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[11px] text-zinc-400">Fundo dos Cards</span>
                      <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl p-2">
                        <input
                          type="color"
                          value={config.card_color}
                          onChange={(e) => setConfig({ ...config, card_color: e.target.value })}
                          className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.card_color}
                          onChange={(e) => setConfig({ ...config, card_color: e.target.value })}
                          className="w-full text-xs bg-transparent text-zinc-200 uppercase font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tipografia */}
                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Tipografia & Fonte</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PRESET_FONTS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setConfig({ ...config, font_family: font.id })}
                        className={`p-3.5 rounded-xl border text-left transition-all ${
                          config.font_family === font.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <p className="text-xs font-semibold text-zinc-200">{font.name}</p>
                        <p className="text-[11px] text-zinc-400 mt-1 italic">{font.sample}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Textura de Fundo */}
                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Textura de Fundo</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {PRESET_TEXTURES.map((tex) => (
                      <button
                        key={tex.id}
                        onClick={() => setConfig({ ...config, bg_texture: tex.id })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          config.bg_texture === tex.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <span className="text-xs font-medium text-zinc-200">{tex.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TEXTOS & HERO */}
            {activeTab === 'content' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">URL do Logotipo</label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/logo.png"
                    value={config.logo_url || ''}
                    onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-500">Deixe em branco para usar o nome da barbearia em texto.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">URL da Imagem de Capa (Banner)</label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={config.banner_url || ''}
                    onChange={(e) => setConfig({ ...config, banner_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Título Principal (Headline)</label>
                  <input
                    type="text"
                    placeholder="Ex: Tradição, Estilo e Atendimento de Primeira"
                    value={config.headline_title || ''}
                    onChange={(e) => setConfig({ ...config, headline_title: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Subtítulo do Hero</label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Agende seu horário online em menos de 1 minuto sem complicação."
                    value={config.headline_subtitle || ''}
                    onChange={(e) => setConfig({ ...config, headline_subtitle: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sobre a Barbearia (História / Valores)</label>
                  <textarea
                    rows={4}
                    placeholder="Conte sobre sua barbearia, anos de mercado, estrutura e experiência dos profissionais..."
                    value={config.about_text || ''}
                    onChange={(e) => setConfig({ ...config, about_text: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: GALERIA */}
            {activeTab === 'gallery' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Adicionar Foto à Galeria</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/foto-corte.jpg"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={addGalleryPhoto}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl transition-all"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Fotos Atuais ({config.gallery_photos.length})</label>
                  <div className="grid grid-cols-2 gap-3">
                    {config.gallery_photos.map((photo, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-zinc-800 group h-28 bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt={`Galeria ${idx}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeGalleryPhoto(idx)}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: SEÇÕES & COMODIDADES */}
            {activeTab === 'sections' && (
              <div className="space-y-6">
                {/* Visibilidade de Seções */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Visibilidade de Seções</label>
                  <div className="space-y-2">
                    {[
                      { key: 'hero', label: 'Capa / Hero' },
                      { key: 'services', label: 'Catálogo de Serviços & Preços' },
                      { key: 'barbers', label: 'Equipe de Barbeiros' },
                      { key: 'gallery', label: 'Galeria de Fotos' },
                      { key: 'about', label: 'Seção Sobre a Barbearia' },
                      { key: 'amenities', label: 'Comodidades & Diferenciais' },
                      { key: 'location', label: 'Mapa & Localização' },
                    ].map((sec) => (
                      <label
                        key={sec.key}
                        className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer transition-colors"
                      >
                        <span className="text-xs font-medium text-zinc-200">{sec.label}</span>
                        <input
                          type="checkbox"
                          checked={config.sections_visibility[sec.key as keyof TenantSiteConfigData['sections_visibility']]}
                          onChange={() => toggleSection(sec.key as any)}
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                {/* Comodidades */}
                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Comodidades & Diferenciais</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_AMENITIES.map((item) => {
                      const selected = config.amenities.includes(item)
                      return (
                        <button
                          key={item}
                          onClick={() => toggleAmenity(item)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            selected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '} {item}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Outra comodidade personalizada..."
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={addCustomAmenity}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Real-Time Live Preview Frame (60%) */}
        <div className="lg:col-span-7 bg-zinc-950 p-6 flex flex-col items-center justify-center overflow-y-auto">
          <div
            className={`w-full transition-all duration-300 shadow-2xl rounded-2xl overflow-hidden border border-zinc-800 flex flex-col ${
              previewDevice === 'mobile'
                ? 'max-w-[390px] h-[780px] border-4 border-zinc-700 ring-8 ring-zinc-900'
                : 'max-w-4xl h-[780px]'
            }`}
            style={{ backgroundColor: config.background_color }}
          >
            {/* Mock Browser/App Bar */}
            <div className="h-9 bg-zinc-900/90 border-b border-zinc-800 px-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                navalio.com/{tenantSlug || 'sua-barbearia'}
              </span>
              <span className="text-[10px] text-amber-500 font-bold">PREVIEW</span>
            </div>

            {/* Scrollable Live Content */}
            <div className="flex-1 overflow-y-auto" style={{ backgroundColor: config.background_color }}>
              {/* HERO SECTION */}
              {config.sections_visibility.hero && (
                <div className="relative min-h-[340px] flex items-center justify-center text-center p-6 overflow-hidden">
                  {config.banner_url && (
                    <div
                      className="absolute inset-0 bg-cover bg-center opacity-30 scale-105"
                      style={{ backgroundImage: `url(${config.banner_url})` }}
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />

                  <div className="relative z-10 max-w-lg space-y-4">
                    {config.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={config.logo_url} alt="Logo" className="h-12 mx-auto object-contain" />
                    ) : (
                      <span
                        className="inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-amber-500/30 text-amber-400 bg-amber-500/10"
                      >
                        {tenantName || 'Barbearia Oficial'}
                      </span>
                    )}

                    <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
                      {config.headline_title || DEFAULT_SITE_CONFIG.headline_title}
                    </h2>

                    <p className="text-xs text-zinc-300 leading-relaxed max-w-md mx-auto">
                      {config.headline_subtitle || DEFAULT_SITE_CONFIG.headline_subtitle}
                    </p>

                    <div className="pt-2 flex justify-center gap-2">
                      <button
                        style={{ backgroundColor: config.primary_color }}
                        className="px-5 py-2.5 rounded-xl font-extrabold text-xs text-zinc-950 shadow-lg hover:brightness-110 transition-all"
                      >
                        Agendar Horário Online
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* COMODIDADES */}
              {config.sections_visibility.amenities && config.amenities.length > 0 && (
                <div className="px-6 py-4 border-y border-zinc-800/60 bg-zinc-900/30">
                  <div className="flex flex-wrap justify-center gap-2">
                    {config.amenities.map((item, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-300 flex items-center gap-1"
                      >
                        <span style={{ color: config.primary_color }}>★</span> {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* SERVIÇOS DEMO */}
              {config.sections_visibility.services && (
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Serviços Populares</h3>
                    <span className="text-[10px] text-amber-500 font-semibold">Ver Todos</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { name: 'Corte Degradê & Barba', price: 'R$ 75,00', time: '50 min' },
                      { name: 'Corte Cabelo Tradicional', price: 'R$ 45,00', time: '35 min' },
                      { name: 'Barboterapia com Toalha', price: 'R$ 40,00', time: '30 min' },
                      { name: 'Combo Completo VIP', price: 'R$ 110,00', time: '75 min' },
                    ].map((serv, idx) => (
                      <div
                        key={idx}
                        style={{ backgroundColor: config.card_color }}
                        className="p-3.5 rounded-xl border border-zinc-800 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-zinc-100">{serv.name}</p>
                          <span className="text-[10px] text-zinc-400">⏱ {serv.time}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold" style={{ color: config.primary_color }}>
                            {serv.price}
                          </p>
                          <button className="text-[10px] font-semibold text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded hover:bg-zinc-700 mt-1">
                            Agendar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* GALERIA */}
              {config.sections_visibility.gallery && config.gallery_photos.length > 0 && (
                <div className="p-6 space-y-3 border-t border-zinc-800/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Galeria de Cortes</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {config.gallery_photos.slice(0, 4).map((photo, idx) => (
                      <div key={idx} className="h-24 rounded-xl overflow-hidden border border-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo} alt="Foto" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SOBRE */}
              {config.sections_visibility.about && config.about_text && (
                <div className="p-6 space-y-2 border-t border-zinc-800/60">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sobre Nós</h3>
                  <div
                    style={{ backgroundColor: config.card_color }}
                    className="p-4 rounded-xl border border-zinc-800 text-xs text-zinc-300 leading-relaxed"
                  >
                    {config.about_text}
                  </div>
                </div>
              )}

              {/* FOOTER */}
              <div className="p-6 text-center border-t border-zinc-800 text-[10px] text-zinc-500">
                © {new Date().getFullYear()} {tenantName || 'Barbearia'}. Powered by Navalio SaaS.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
