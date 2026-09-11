'use client'

import { useState, useEffect } from 'react'
import {
  getTenantVisualSettings,
  updateTenantVisualSettings,
  getTenantBranches,
  type TenantVisualSettings,
} from '@/app/actions/whitelabel'

export default function BarbershopPageBuilder() {
  const [tenantId, setTenantId] = useState('')
  const [tenantInfo, setTenantInfo] = useState<{
    name: string
    slug: string
    isMultiBranch: boolean
  } | null>(null)
  const [settings, setSettings] = useState<TenantVisualSettings | null>(null)
  const [branches, setBranches] = useState<Array<{ id: string; name: string; slug: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    // Busca tenant da sessão / headers via API ou perfil do usuário
    async function load() {
      try {
        const res = await fetch('/api/tenant/me')
        const data = await res.json()
        const id = data?.tenantId || data?.id
        if (id) {
          setTenantId(id)
          const [visual, branchList] = await Promise.all([
            getTenantVisualSettings(id),
            getTenantBranches(id),
          ])
          setTenantInfo(visual.tenant)
          setSettings(visual.visualSettings)
          setBranches(branchList)
        }
      } catch {
        // Fallback gracioso para teste
        setTenantInfo({ name: 'Barbearia Exemplo', slug: 'exemplo', isMultiBranch: true })
        setSettings({
          logoUrl: '',
          faviconUrl: '',
          bannerUrl: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80',
          primaryColor: '#f59e0b',
          secondaryColor: '#d97706',
          fontFamily: 'sans',
          texture: 'vintage',
          instagram: '@barbeariaexemplo',
          whatsapp: '11999999999',
          phone: '1133334444',
          addressText: 'Rua Augusta, 1500 - Consolação, São Paulo - SP',
          openingHoursText: 'Seg a Sáb: 09h às 20h',
        })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async () => {
    if (!tenantId || !settings) return
    setSaving(true)
    setFeedback(null)

    try {
      const res = await updateTenantVisualSettings(tenantId, settings)
      setFeedback({ type: res.success ? 'success' : 'error', text: res.message })
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar configurações visuais.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <h1 className="text-2xl font-extrabold text-white">Construtor White-Label da Barbearia</h1>
            <p className="text-xs text-zinc-400">
              Personalize cores, logotipos, banners e texturas do seu site e aplicativo PWA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {tenantInfo?.slug && (
              <a
                href={`/${tenantInfo.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-xs font-semibold text-zinc-300 border border-zinc-800 rounded-xl hover:bg-zinc-900"
              >
                Abrir Meu Site ↗
              </a>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="gold-button text-xs sm:text-sm px-6 py-2.5"
            >
              {saving ? 'Salvando...' : 'Salvar Identidade Visual'}
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs font-medium ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Grid Principal: Formulário à Esquerda, Mockup Mobile à Direita */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* PAINEL DE CONTROLE (COLUNA 1: 7 colunas) */}
          <div className="lg:col-span-7 space-y-6">
            {/* 1. Logotipo e Imagens */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-500">
                1. Logotipo, Ícone & Banner
              </h2>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  URL do Logotipo da Barbearia (PNG transparente)
                </label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/logo.png"
                  value={settings.logoUrl}
                  onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  URL do Favicon / Ícone PWA (Quadrado 512x512)
                </label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/icon.png"
                  value={settings.faviconUrl}
                  onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  URL da Foto de Destaque / Banner de Capa
                </label>
                <input
                  type="text"
                  value={settings.bannerUrl}
                  onChange={(e) => setSettings({ ...settings, bannerUrl: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>

            {/* 2. Paleta de Cores */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-500">
                2. Paleta de Cores
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Cor Primária (Botões e Destaques)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={settings.primaryColor}
                      onChange={(e) => setSettings({ ...settings, primaryColor: e.target.value })}
                      className="input-field font-mono uppercase"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Cor Secundária / Gradiente
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={settings.secondaryColor}
                      onChange={(e) => setSettings({ ...settings, secondaryColor: e.target.value })}
                      className="input-field font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Tipografia e Texturas */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-500">
                3. Tipografia e Textura de Fundo
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Estilo de Tipografia
                  </label>
                  <select
                    value={settings.fontFamily}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        fontFamily: e.target.value as TenantVisualSettings['fontFamily'],
                      })
                    }
                    className="input-field"
                  >
                    <option value="sans">Moderna Sans-Serif (Inter/Outfit)</option>
                    <option value="serif">Clássica Sofisticada (Playfair)</option>
                    <option value="vintage">Vintage Barber (Bebas / Oswald)</option>
                    <option value="mono">Técnica Minimalista (Mono)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Textura de Fundo
                  </label>
                  <select
                    value={settings.texture}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        texture: e.target.value as TenantVisualSettings['texture'],
                      })
                    }
                    className="input-field"
                  >
                    <option value="vintage">Barbearia Vintage (Pontilhada Dark)</option>
                    <option value="wood">Madeira Rústica Escura</option>
                    <option value="minimal">Minimalista Grid Suave</option>
                    <option value="geometric">Padrões Geométricos</option>
                    <option value="none">Sólido Preto Puro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. Endereço e Contato */}
            <div className="glass-card p-6 space-y-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider text-amber-500">
                4. Endereço, Horários e Redes
              </h2>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Endereço Completo exibido na Home
                </label>
                <input
                  type="text"
                  placeholder="Rua Exemplo, 123 - Centro"
                  value={settings.addressText || ''}
                  onChange={(e) => setSettings({ ...settings, addressText: e.target.value })}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Horário de Funcionamento
                </label>
                <input
                  type="text"
                  placeholder="Seg a Sáb: 09h às 20h"
                  value={settings.openingHoursText || ''}
                  onChange={(e) => setSettings({ ...settings, openingHoursText: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Instagram da Barbearia
                  </label>
                  <input
                    type="text"
                    placeholder="@barbearia"
                    value={settings.instagram || ''}
                    onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    WhatsApp para Dúvidas
                  </label>
                  <input
                    type="text"
                    placeholder="11999999999"
                    value={settings.whatsapp || ''}
                    onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                    className="input-field"
                  />
                </div>
              </div>

              {tenantInfo?.isMultiBranch && branches.length > 1 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-400">
                  <p className="font-bold mb-1">Organização com {branches.length} filiais ativas:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-300">
                    {branches.map((b) => (
                      <li key={b.id}>
                        {b.name} (<span className="text-amber-400">/{b.slug}</span>)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* PREVIEW INTERATIVO MOBILE (COLUNA 2: 5 colunas) */}
          <div className="lg:col-span-5 sticky top-6">
            <div className="text-center mb-3">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Preview em Tempo Real (Smartphone)
              </span>
            </div>

            {/* Smartphone Frame */}
            <div className="mx-auto w-full max-w-[340px] rounded-[2.5rem] p-3 bg-zinc-800 shadow-2xl border-4 border-zinc-700">
              <div
                className={`w-full rounded-[2rem] overflow-hidden bg-zinc-950 text-white min-h-[580px] flex flex-col justify-between texture-${settings.texture}`}
                style={{
                  fontFamily:
                    settings.fontFamily === 'serif'
                      ? 'serif'
                      : settings.fontFamily === 'mono'
                        ? 'monospace'
                        : 'var(--font-inter)',
                }}
              >
                {/* Top Notch */}
                <div className="w-full pt-3 pb-1 flex justify-center">
                  <div className="w-24 h-4 bg-zinc-800 rounded-full" />
                </div>

                {/* Banner Mockup */}
                <div className="relative h-32 w-full overflow-hidden bg-zinc-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.bannerUrl}
                    alt="Banner Preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                </div>

                {/* Content Mockup */}
                <div className="px-5 py-2 flex-1 text-center -mt-6 relative z-10">
                  {/* Logo or Initial */}
                  <div
                    className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg mb-2 overflow-hidden border-2 border-zinc-800"
                    style={{
                      background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`,
                      color: '#000',
                    }}
                  >
                    {settings.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      tenantInfo?.name ? tenantInfo.name.charAt(0).toUpperCase() : 'B'
                    )}
                  </div>

                  <h3 className="font-extrabold text-base text-white">
                    {tenantInfo?.name || 'Sua Barbearia'}
                  </h3>
                  <p className="text-[10px] text-zinc-400 line-clamp-1 mb-4">
                    {settings.addressText || 'Endereço da sua barbearia'}
                  </p>

                  {/* Actions Mockup */}
                  <div className="space-y-2 mb-4">
                    <div
                      className="w-full py-2.5 rounded-xl font-bold text-xs text-black shadow-md flex items-center justify-center gap-1"
                      style={{
                        background: `linear-gradient(135deg, ${settings.primaryColor} 0%, ${settings.secondaryColor} 100%)`,
                      }}
                    >
                      Agendar sem Cadastro
                    </div>

                    <div className="w-full py-2.5 rounded-xl font-semibold text-xs text-zinc-200 bg-zinc-900 border border-zinc-800">
                      Área do Cliente (PWA)
                    </div>
                  </div>

                  {/* Services Snapshot Mockup */}
                  <div className="bg-zinc-900/80 rounded-xl p-2.5 border border-zinc-800/80 text-left space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-zinc-200">Corte Masculino</span>
                      <span style={{ color: settings.primaryColor }} className="font-extrabold">
                        R$ 45,00
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-zinc-200">Barba Completa</span>
                      <span style={{ color: settings.primaryColor }} className="font-extrabold">
                        R$ 35,00
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Mockup */}
                <div className="p-3 border-t border-zinc-900 text-center text-[9px] text-zinc-600">
                  {settings.openingHoursText || 'Seg a Sáb: 09h às 20h'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
