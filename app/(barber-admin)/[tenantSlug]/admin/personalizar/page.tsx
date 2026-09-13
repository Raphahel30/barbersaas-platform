'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  Scissors,
  Palette,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Globe,
  Smartphone,
  Eye,
  Save,
  Plus,
  Trash2,
  Layers,
  Image as ImageIcon,
  Type,
  Layout,
  Star,
  Check,
  Building,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  Flame,
  Info,
} from 'lucide-react'
import { getSiteConfig, saveSiteConfig, type TenantSiteConfigData } from '@/app/actions/site-builder'
import { DEFAULT_SITE_CONFIG } from '@/lib/builder/defaults'

// Presets de Cores em 1 Clique
const COLOR_PRESETS = [
  {
    id: 'ouro_imperial',
    name: 'Ouro Imperial',
    desc: 'Dourado nobre & Preto profundo',
    primary: '#D97706',
    bg: '#09090b',
    card: '#18181b',
    previewBadge: 'bg-amber-500',
  },
  {
    id: 'vintage_tavern',
    name: 'Vintage Tavern',
    desc: 'Cobre artesanal & Madeira escura',
    primary: '#B45309',
    bg: '#140d07',
    card: '#23170e',
    previewBadge: 'bg-amber-700',
  },
  {
    id: 'black_diamond',
    name: 'Black Diamond',
    desc: 'Prata acetinada & Chumbo escovado',
    primary: '#E4E4E7',
    bg: '#09090b',
    card: '#18181b',
    previewBadge: 'bg-zinc-200',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    desc: 'Preto puro & Branco contemporâneo',
    primary: '#F4F4F5',
    bg: '#000000',
    card: '#111111',
    previewBadge: 'bg-white',
  },
]

// Presets de Tipografia
const FONT_PRESETS = [
  {
    id: 'font-sans',
    name: 'Moderna (Inter)',
    badge: 'Clean & Tech',
    sample: 'Agendamento rápido e moderno para o seu cliente.',
    className: 'font-sans',
  },
  {
    id: 'font-serif',
    name: 'Clássica (Playfair)',
    badge: 'Tradição & Elegância',
    sample: 'Arte, maestria e o rigor dos cavalheiros.',
    className: 'font-serif',
  },
  {
    id: 'font-cinzel',
    name: 'Imperial (Cinzel)',
    badge: 'Luxo & Nobreza',
    sample: 'HONRA, DISTINÇÃO E EXCELÊNCIA TRADICIONAL.',
    className: 'font-serif tracking-wider uppercase',
  },
  {
    id: 'font-bebas',
    name: 'Urbana (Bebas Neue)',
    badge: 'Streetwear & Atitude',
    sample: 'FORÇA, PRESENÇA E ESTILO SEM LIMITES.',
    className: 'font-sans font-black tracking-wide uppercase',
  },
]

// Presets de Textura de Fundo
const TEXTURE_PRESETS = [
  {
    id: 'clean_dark',
    name: 'Preto Minimalista',
    desc: 'Preto liso fosco ultra moderno',
    bgStyle: 'bg-zinc-950',
    patternOverlay: 'none',
  },
  {
    id: 'carbon',
    name: 'Fibra de Carbono',
    desc: 'Textura geométrica de fibra suave',
    bgStyle: 'bg-zinc-900',
    patternOverlay: 'radial-gradient(#27272a 1px, transparent 1px)',
  },
  {
    id: 'dark_wood',
    name: 'Madeira Nobre',
    desc: 'Ripas de madeira escura escovada',
    bgStyle: 'bg-[#120d09]',
    patternOverlay: 'linear-gradient(to bottom, #17100b, #0d0906)',
  },
  {
    id: 'dark_brick',
    name: 'Tijolo Industrial',
    desc: 'Tijolos rústicos nova-iorquinos escuros',
    bgStyle: 'bg-[#141010]',
    patternOverlay: 'radial-gradient(#261717 1px, transparent 1px)',
  },
  {
    id: 'noise_grain',
    name: 'Granulação Vintage',
    desc: 'Granulado analógico clássico',
    bgStyle: 'bg-zinc-900/95',
    patternOverlay: 'radial-gradient(#3f3f46 0.75px, transparent 0.75px)',
  },
]

// Sugestões de Comodidades
const DEFAULT_AMENITIES_SUGGESTIONS = [
  'Cerveja Gelada',
  'Wi-Fi Grátis',
  'Ar-Condicionado',
  'Mesa de Sinuca',
  'Café Expresso Cortesia',
  'Playstation 5',
  'Estacionamento Exclusivo',
  'Toalha Quente & Barboterapia',
]

export default function SiteBuilderCustomizerPage() {
  const params = useParams()
  const router = useRouter()
  const tenantSlug = typeof params.tenantSlug === 'string' ? params.tenantSlug : ''

  const [tenantId, setTenantId] = useState<string>('')
  const [tenantName, setTenantName] = useState<string>('')
  const [tenantAddress, setTenantAddress] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  )

  // Aba ativa do editor
  const [activeTab, setActiveTab] = useState<
    'identity' | 'colors' | 'typography' | 'textures' | 'gallery' | 'sections'
  >('identity')

  // Estado da Configuração
  const [config, setConfig] = useState<TenantSiteConfigData>({
    ...DEFAULT_SITE_CONFIG,
    tenant_id: '',
  })

  // Inputs temporários para novos itens
  const [newPhotoUrl, setNewPhotoUrl] = useState('')
  const [newAmenity, setNewAmenity] = useState('')

  useEffect(() => {
    async function loadData() {
      if (!tenantSlug) return
      try {
        const result = await getSiteConfig(tenantSlug)
        if (result.success && result.config && result.tenant) {
          setConfig(result.config)
          setTenantId(result.tenant.id)
          setTenantName(result.tenant.name)

          const formattedAddr = [
            result.tenant.address_street
              ? `${result.tenant.address_street}${
                  result.tenant.address_number ? `, ${result.tenant.address_number}` : ''
                }`
              : '',
            result.tenant.address_neighborhood,
            result.tenant.address_city && result.tenant.address_state
              ? `${result.tenant.address_city} - ${result.tenant.address_state}`
              : result.tenant.address_city,
          ]
            .filter(Boolean)
            .join(', ')

          setTenantAddress(formattedAddr)
        }
      } catch (err) {
        console.error('Falha ao carregar configuração do construtor de site:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [tenantSlug])

  const handleSave = async () => {
    if (!tenantId) {
      setFeedback({ type: 'error', message: 'Barbearia não identificada.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const result = await saveSiteConfig(tenantId, config, tenantSlug)
      if (result.success) {
        setFeedback({ type: 'success', message: result.message })
      } else {
        setFeedback({ type: 'error', message: result.message })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Erro inesperado ao salvar personalizações.',
      })
    } finally {
      setSaving(false)
    }
  }

  // Helper de paletas rápidas
  const applyPalette = (palette: (typeof COLOR_PRESETS)[0]) => {
    setConfig((prev) => ({
      ...prev,
      primary_color: palette.primary,
      background_color: palette.bg,
      card_color: palette.card,
    }))
  }

  // Adicionar foto na galeria (limite de 8)
  const addGalleryPhoto = () => {
    if (!newPhotoUrl.trim()) return
    if (config.gallery_photos.length >= 8) {
      setFeedback({ type: 'error', message: 'Limite máximo de 8 fotos na galeria atingido.' })
      return
    }
    setConfig((prev) => ({
      ...prev,
      gallery_photos: [...prev.gallery_photos, newPhotoUrl.trim()],
    }))
    setNewPhotoUrl('')
  }

  const removeGalleryPhoto = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      gallery_photos: prev.gallery_photos.filter((_, idx) => idx !== index),
    }))
  }

  // Toggles de Visibilidade
  const toggleSection = (sectionKey: keyof TenantSiteConfigData['sections_visibility']) => {
    setConfig((prev) => ({
      ...prev,
      sections_visibility: {
        ...prev.sections_visibility,
        [sectionKey]: !prev.sections_visibility[sectionKey],
      },
    }))
  }

  // Toggle de Comodidades
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

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400 text-sm font-medium">Carregando Construtor Visual de Site...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-zinc-950">
      {/* TOPBAR */}
      <header className="h-16 border-b border-zinc-800/90 bg-zinc-900/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href={`/${tenantSlug}/admin`}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar ao Admin
          </Link>

          <div>
            <h1 className="text-sm font-black text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Construtor Visual de Site
              <span className="text-xs font-normal text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                {tenantName || tenantSlug}
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">
              Personalize o site da sua barbearia com visualização em tempo real (Live Preview Mobile)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/${tenantSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 text-xs font-semibold text-zinc-300 border border-zinc-700 bg-zinc-800/80 rounded-xl hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            Abrir Site Oficial ↗
          </a>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-extrabold bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                Salvar e Publicar Site
              </>
            )}
          </button>
        </div>
      </header>

      {/* FEEDBACK TOAST BANNER */}
      {feedback && (
        <div
          className={`px-6 py-2.5 text-xs font-semibold flex items-center justify-between border-b ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Info className="w-4 h-4 text-red-400" />
            )}
            {feedback.message}
          </span>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* ============================================================ */}
        {/* COLUNA DA ESQUERDA: PAINEL DO EDITOR (5 COLUNAS) */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 border-r border-zinc-800 bg-zinc-900/30 flex flex-col h-[calc(100vh-64px)] overflow-y-auto">
          {/* Navegação de Abas do Editor */}
          <div className="flex border-b border-zinc-800 bg-zinc-900/90 sticky top-0 z-20 px-4 pt-3 overflow-x-auto gap-1">
            {[
              { id: 'identity', label: 'Identidade & Textos', icon: Type },
              { id: 'colors', label: 'Cores & Paletas', icon: Palette },
              { id: 'typography', label: 'Tipografia', icon: Layers },
              { id: 'textures', label: 'Textura de Fundo', icon: Sparkles },
              { id: 'gallery', label: 'Galeria', icon: ImageIcon },
              { id: 'sections', label: 'Seções Ativas', icon: Layout },
            ].map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 pb-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6 space-y-6 pb-28">
            {/* ABA 1: IDENTIDADE & TEXTOS */}
            {activeTab === 'identity' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    URL do Logotipo da Barbearia
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/minha-logo.png"
                    value={config.logo_url || ''}
                    onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Insira o link de uma imagem transparente (.PNG ou .WEBP). Se vazio, exibiremos o monograma inicial.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    URL da Imagem de Capa (Banner Hero)
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={config.banner_url || ''}
                    onChange={(e) => setConfig({ ...config, banner_url: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-zinc-500">
                    Foto de fundo do topo da página. Recomendado: imagem de alta resolução em proporção 16:9.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Título de Boas-Vindas (Headline Principal)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Tradição, Estilo e Atendimento de Primeira"
                    value={config.headline_title || ''}
                    onChange={(e) => setConfig({ ...config, headline_title: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 focus:border-amber-500 focus:outline-none font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Subtítulo do Hero
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Ex: Agende seu horário online em menos de 1 minuto sem complicação."
                    value={config.headline_subtitle || ''}
                    onChange={(e) => setConfig({ ...config, headline_subtitle: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 focus:border-amber-500 focus:outline-none resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    História da Barbearia ("Sobre Nós")
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Conte a história, anos no mercado, técnicas tradicionais e conforto da sua barbearia..."
                    value={config.about_text || ''}
                    onChange={(e) => setConfig({ ...config, about_text: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-zinc-100 focus:border-amber-500 focus:outline-none resize-none leading-relaxed"
                  />
                </div>
              </div>
            )}

            {/* ABA 2: CORES & PALETAS */}
            {activeTab === 'colors' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Presets de Cores em 1 Clique
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {COLOR_PRESETS.map((p) => {
                      const isActive =
                        config.primary_color.toLowerCase() === p.primary.toLowerCase() &&
                        config.background_color.toLowerCase() === p.bg.toLowerCase()
                      return (
                        <button
                          key={p.id}
                          onClick={() => applyPalette(p)}
                          className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between gap-3 group relative overflow-hidden ${
                            isActive
                              ? 'border-amber-500 bg-amber-500/10 shadow-lg'
                              : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-zinc-100 group-hover:text-white">
                              {p.name}
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full">
                                Ativo ✓
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400">{p.desc}</p>
                          <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                            <span className="text-[10px] text-zinc-500">Amostra:</span>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="w-4 h-4 rounded-full border border-black/40 shadow-sm"
                                style={{ backgroundColor: p.primary }}
                                title="Cor Primária"
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-zinc-700 shadow-sm"
                                style={{ backgroundColor: p.bg }}
                                title="Fundo Página"
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-zinc-700 shadow-sm"
                                style={{ backgroundColor: p.card }}
                                title="Fundo Card"
                              />
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-zinc-800/80">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Ajuste Fino de Cores Personalizadas
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <span className="text-[11px] font-medium text-zinc-300">Cor Primária (Botões)</span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={config.primary_color}
                          onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.primary_color}
                          onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                          className="w-full text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-zinc-200 uppercase font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <span className="text-[11px] font-medium text-zinc-300">Fundo da Página</span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={config.background_color}
                          onChange={(e) => setConfig({ ...config, background_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.background_color}
                          onChange={(e) => setConfig({ ...config, background_color: e.target.value })}
                          className="w-full text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-zinc-200 uppercase font-mono outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                      <span className="text-[11px] font-medium text-zinc-300">Fundo dos Cards</span>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="color"
                          value={config.card_color}
                          onChange={(e) => setConfig({ ...config, card_color: e.target.value })}
                          className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                        />
                        <input
                          type="text"
                          value={config.card_color}
                          onChange={(e) => setConfig({ ...config, card_color: e.target.value })}
                          className="w-full text-xs bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-zinc-200 uppercase font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: TIPOGRAFIA & FONTES */}
            {activeTab === 'typography' && (
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Selecione a Tipografia da Barbearia
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {FONT_PRESETS.map((f) => {
                    const isSelected = config.font_family === f.id
                    return (
                      <button
                        key={f.id}
                        onClick={() => setConfig({ ...config, font_family: f.id })}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 shadow-md'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-zinc-100">{f.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                            {f.badge}
                          </span>
                        </div>
                        <p className={`text-xs text-zinc-300 ${f.className}`}>{f.sample}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ABA 4: TEXTURA DE FUNDO */}
            {activeTab === 'textures' && (
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Estilo de Textura do Fundo
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TEXTURE_PRESETS.map((t) => {
                    const isSelected = config.bg_texture === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setConfig({ ...config, bg_texture: t.id })}
                        className={`p-4 rounded-xl border text-left transition-all relative overflow-hidden ${
                          isSelected
                            ? 'border-amber-500 bg-amber-500/10 shadow-md'
                            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-bold text-zinc-100">{t.name}</span>
                          {isSelected && <span className="text-amber-400 text-xs">✓</span>}
                        </div>
                        <p className="text-[11px] text-zinc-400">{t.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ABA 5: GALERIA DE FOTOS */}
            {activeTab === 'gallery' && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Adicionar Foto à Galeria ({config.gallery_photos.length}/8)
                    </label>
                    <span className="text-[11px] text-zinc-500">Máximo 8 imagens</span>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://exemplo.com/corte-degrade.jpg"
                      value={newPhotoUrl}
                      onChange={(e) => setNewPhotoUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addGalleryPhoto())}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={addGalleryPhoto}
                      disabled={config.gallery_photos.length >= 8}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {config.gallery_photos.map((photo, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-zinc-800 group h-32 bg-zinc-900 shadow-md"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo}
                        alt={`Galeria ${idx + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <button
                        onClick={() => removeGalleryPhoto(idx)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600/90 hover:bg-red-600 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        title="Remover Foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="absolute bottom-1 left-2 text-[10px] font-mono text-white/80 bg-black/60 px-1.5 rounded">
                        #{idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ABA 6: SEÇÕES ATIVAS & COMODIDADES */}
            {activeTab === 'sections' && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Ligar / Desligar Seções do Site
                  </label>
                  <div className="space-y-2">
                    {[
                      { key: 'hero', label: 'Capa / Banner Principal' },
                      { key: 'services', label: 'Catálogo de Serviços & Preços' },
                      { key: 'barbers', label: 'Equipe de Barbeiros' },
                      { key: 'gallery', label: 'Galeria de Fotos' },
                      { key: 'about', label: 'Sobre a Barbearia ("Sobre Nós")' },
                      { key: 'amenities', label: 'Comodidades & Diferenciais' },
                      { key: 'location', label: 'Mapa & Localização' },
                    ].map((sec) => {
                      const isChecked =
                        config.sections_visibility[
                          sec.key as keyof TenantSiteConfigData['sections_visibility']
                        ]
                      return (
                        <label
                          key={sec.key}
                          className="flex items-center justify-between p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 cursor-pointer transition-colors"
                        >
                          <span className="text-xs font-bold text-zinc-200">{sec.label}</span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSection(sec.key as any)}
                            className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-zinc-800/80">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Comodidades da Barbearia
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DEFAULT_AMENITIES_SUGGESTIONS.map((item) => {
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
                      placeholder="Outro diferencial da barbearia..."
                      value={newAmenity}
                      onChange={(e) => setNewAmenity(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAmenity())}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      onClick={addCustomAmenity}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded-xl"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* BOTÃO FIXO FLUTUANTE INFERIOR */}
          <div className="fixed bottom-0 left-0 w-full lg:w-1/2 p-4 bg-zinc-950/90 backdrop-blur border-t border-zinc-800 z-30 flex items-center justify-between gap-4">
            <div className="hidden sm:block">
              <span className="text-[11px] text-zinc-400 block">Alterações em tempo real no mockup ao lado</span>
              <span className="text-xs font-bold text-amber-400">Clique em Salvar para publicar</span>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs sm:text-sm rounded-xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  Publicando no Servidor...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar e Publicar Site
                </>
              )}
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* COLUNA DA DIREITA: MOCKUP MOBILE / LIVE PREVIEW EM TEMPO REAL */}
        {/* ============================================================ */}
        <div className="lg:col-span-6 bg-zinc-950 p-6 flex flex-col items-center justify-center overflow-y-auto">
          {/* IPHONE MOCKUP FRAME */}
          <div className="relative w-[375px] h-[760px] rounded-[50px] border-[10px] border-zinc-800 bg-black shadow-2xl overflow-hidden ring-1 ring-zinc-700/50 flex flex-col">
            {/* Dynamic Island / Notch */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-5 bg-zinc-900 rounded-full z-40 flex items-center justify-between px-3 border border-zinc-800/80">
              <span className="w-2 h-2 rounded-full bg-zinc-950" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-950 border border-zinc-800" />
            </div>

            {/* Mockup Status Bar */}
            <div className="h-10 px-6 pt-2 flex items-center justify-between text-[10px] font-bold text-zinc-400 z-30 shrink-0 bg-transparent select-none">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Scrollable Smartphone Viewport with Live State */}
            <div
              className={`flex-1 overflow-y-auto ${config.font_family}`}
              style={{
                backgroundColor: config.background_color,
              }}
            >
              {/* HERO SECTION */}
              {config.sections_visibility?.hero && (
                <div className="relative h-48 w-full overflow-hidden bg-zinc-900">
                  {config.banner_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={config.banner_url}
                      alt="Banner Hero"
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-transparent" />

                  {/* Logo sobreposto */}
                  <div className="absolute -bottom-2 left-5 flex items-end gap-3 z-10">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-xl shadow-2xl overflow-hidden border-2 border-zinc-800 bg-zinc-900 text-white">
                      {config.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={config.logo_url}
                          alt={tenantName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span style={{ color: config.primary_color }}>
                          {(tenantName || 'B').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CONTEÚDO PRINCIPAL DO MOCKUP */}
              <div className="px-5 pt-4 pb-20 space-y-5">
                {/* Nome e Headline */}
                <div>
                  <h2 className="text-xl font-black text-white leading-tight">
                    {tenantName || 'Sua Barbearia'}
                  </h2>
                  <p className="text-xs font-bold mt-1" style={{ color: config.primary_color }}>
                    {config.headline_title || DEFAULT_SITE_CONFIG.headline_title}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    {config.headline_subtitle || DEFAULT_SITE_CONFIG.headline_subtitle}
                  </p>
                  {tenantAddress && (
                    <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-zinc-400 shrink-0" />
                      {tenantAddress}
                    </p>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO NO MOCKUP */}
                <div className="space-y-2">
                  <button
                    style={{ backgroundColor: config.primary_color }}
                    className="w-full py-3 px-4 rounded-xl font-black text-xs text-zinc-950 shadow-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
                  >
                    <Scissors className="w-4 h-4" />
                    Agendar Horário Online
                  </button>
                  <button
                    style={{ backgroundColor: config.card_color }}
                    className="w-full py-2.5 px-4 rounded-xl font-semibold text-[11px] text-zinc-300 border border-zinc-800/80 flex items-center justify-center gap-2"
                  >
                    <Star className="w-3.5 h-3.5 text-amber-500" />
                    Área do Cliente (Fidelidade & VIP)
                  </button>
                </div>

                {/* COMODIDADES */}
                {config.sections_visibility?.amenities && config.amenities.length > 0 && (
                  <div
                    style={{ backgroundColor: config.card_color }}
                    className="p-3.5 rounded-xl border border-zinc-800/80 space-y-2"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                      Diferenciais da Casa
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {config.amenities.map((amenity, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-zinc-700/60 bg-zinc-900/60 text-zinc-300 flex items-center gap-1"
                        >
                          <span style={{ color: config.primary_color }}>★</span> {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* SERVIÇOS & CATÁLOGO */}
                {config.sections_visibility?.services && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-zinc-200">Serviços Populares</span>
                      <span className="text-[10px] font-semibold" style={{ color: config.primary_color }}>
                        Catálogo Completo
                      </span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { name: 'Corte Masculino Degradê', time: '35 min', price: 'R$ 45,00' },
                        { name: 'Barboterapia com Toalha Quente', time: '30 min', price: 'R$ 35,00' },
                        { name: 'Combo Cabelo + Barba VIP', time: '60 min', price: 'R$ 75,00' },
                      ].map((serv, idx) => (
                        <div
                          key={idx}
                          style={{ backgroundColor: config.card_color }}
                          className="p-3 rounded-xl border border-zinc-800/80 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-xs font-bold text-zinc-100">{serv.name}</p>
                            <span className="text-[10px] text-zinc-500">⏱ {serv.time}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-black font-mono" style={{ color: config.primary_color }}>
                              {serv.price}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* GALERIA */}
                {config.sections_visibility?.gallery && config.gallery_photos.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-zinc-200 block">Nossos Trabalhos</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {config.gallery_photos.slice(0, 4).map((photo, idx) => (
                        <div
                          key={idx}
                          className="h-20 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo}
                            alt={`Foto ${idx}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* SOBRE NÓS */}
                {config.sections_visibility?.about && config.about_text && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-zinc-200 block">Sobre Nós</span>
                    <div
                      style={{ backgroundColor: config.card_color }}
                      className="p-3 rounded-xl border border-zinc-800/80 text-[11px] text-zinc-300 leading-relaxed"
                    >
                      {config.about_text}
                    </div>
                  </div>
                )}

                {/* FOOTER */}
                <div className="text-center text-[9px] text-zinc-500 pt-3 border-t border-zinc-800/60">
                  © {new Date().getFullYear()} {tenantName || 'Barbearia'}. Powered by Navalio SaaS.
                </div>
              </div>
            </div>

            {/* iPhone Home Indicator */}
            <div className="h-4 bg-transparent flex justify-center items-center shrink-0 z-40 select-none pb-1">
              <span className="w-28 h-1 rounded-full bg-zinc-600/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
