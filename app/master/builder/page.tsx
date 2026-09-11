'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getLandingContent, updateLandingContent, type LandingContent } from '@/app/actions/saas'

export default function MasterBuilderPage() {
  const [content, setContent] = useState<LandingContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'hero' | 'social' | 'modules' | 'testimonials' | 'faq'>('hero')

  useEffect(() => {
    getLandingContent().then((res) => {
      setContent(res)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    if (!content) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await updateLandingContent(content)
      setMessage({ type: res.success ? 'success' : 'error', text: res.message })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Falha ao salvar alterações.',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !content) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/master/dashboard" className="text-xs text-amber-500 hover:underline">
                ← Voltar ao Dashboard Master
              </Link>
            </div>
            <h1 className="text-2xl font-extrabold text-white">SaaS Builder No-Code</h1>
            <p className="text-xs text-zinc-400">
              Edite os blocos e conteúdos da Landing Page institucional em tempo real.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-semibold text-zinc-300 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-colors"
            >
              Visualizar Site ↗
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="gold-button text-xs sm:text-sm px-6 py-2.5"
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>

        {/* Feedback Message */}
        {message && (
          <div
            className={`p-4 rounded-xl text-xs font-medium ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Tabs de Navegação */}
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-zinc-800 text-xs">
          {[
            { id: 'hero', label: '1. Seção Hero' },
            { id: 'social', label: '2. Prova Social' },
            { id: 'modules', label: '3. Módulos & Recursos' },
            { id: 'testimonials', label: '4. Depoimentos' },
            { id: 'faq', label: '5. FAQ Expansível' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-black shadow-md'
                  : 'text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: HERO */}
        {activeTab === 'hero' && (
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-base font-bold text-white mb-2">Configurações do Topo (Hero)</h2>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Badge Superior</label>
              <input
                type="text"
                value={content.hero.badgeText}
                onChange={(e) =>
                  setContent({ ...content, hero: { ...content.hero, badgeText: e.target.value } })
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Título Principal (H1)</label>
              <input
                type="text"
                value={content.hero.title}
                onChange={(e) =>
                  setContent({ ...content, hero: { ...content.hero, title: e.target.value } })
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Subtítulo / Descrição</label>
              <textarea
                rows={3}
                value={content.hero.subtitle}
                onChange={(e) =>
                  setContent({ ...content, hero: { ...content.hero, subtitle: e.target.value } })
                }
                className="input-field h-auto py-2.5"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Texto do Botão Principal (CTA)</label>
                <input
                  type="text"
                  value={content.hero.ctaText}
                  onChange={(e) =>
                    setContent({ ...content, hero: { ...content.hero, ctaText: e.target.value } })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Texto do Botão Secundário</label>
                <input
                  type="text"
                  value={content.hero.secondaryCtaText}
                  onChange={(e) =>
                    setContent({ ...content, hero: { ...content.hero, secondaryCtaText: e.target.value } })
                  }
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">URL da Imagem / Mockup</label>
              <input
                type="text"
                value={content.hero.heroImageUrl || ''}
                onChange={(e) =>
                  setContent({ ...content, hero: { ...content.hero, heroImageUrl: e.target.value } })
                }
                className="input-field"
              />
            </div>
          </div>
        )}

        {/* TAB 2: PROVA SOCIAL */}
        {activeTab === 'social' && (
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Prova Social e Estatísticas</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.socialProof.enabled}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      socialProof: { ...content.socialProof, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-xs text-zinc-300">Exibir seção</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Título da Seção</label>
              <input
                type="text"
                value={content.socialProof.heading}
                onChange={(e) =>
                  setContent({
                    ...content,
                    socialProof: { ...content.socialProof, heading: e.target.value },
                  })
                }
                className="input-field"
              />
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Métricas em Destaque</p>
              {content.socialProof.stats.map((st, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-3 p-3 bg-zinc-900 rounded-xl border border-zinc-800">
                  <input
                    type="text"
                    placeholder="Valor (ex: +250.000)"
                    value={st.value}
                    onChange={(e) => {
                      const newStats = [...content.socialProof.stats]
                      newStats[idx].value = e.target.value
                      setContent({
                        ...content,
                        socialProof: { ...content.socialProof, stats: newStats },
                      })
                    }}
                    className="input-field text-sm font-bold text-amber-400"
                  />
                  <input
                    type="text"
                    placeholder="Rótulo (ex: Cortes Agendados)"
                    value={st.label}
                    onChange={(e) => {
                      const newStats = [...content.socialProof.stats]
                      newStats[idx].label = e.target.value
                      setContent({
                        ...content,
                        socialProof: { ...content.socialProof, stats: newStats },
                      })
                    }}
                    className="input-field text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MÓDULOS */}
        {activeTab === 'modules' && (
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Módulos e Recursos</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.modules.enabled}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      modules: { ...content.modules, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-xs text-zinc-300">Exibir seção</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Título</label>
                <input
                  type="text"
                  value={content.modules.heading}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      modules: { ...content.modules, heading: e.target.value },
                    })
                  }
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Subtítulo</label>
                <input
                  type="text"
                  value={content.modules.subheading}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      modules: { ...content.modules, subheading: e.target.value },
                    })
                  }
                  className="input-field"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Cards de Recursos</p>
              {content.modules.items.map((item, idx) => (
                <div key={idx} className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
                  <input
                    type="text"
                    placeholder="Título do recurso"
                    value={item.title}
                    onChange={(e) => {
                      const newItems = [...content.modules.items]
                      newItems[idx].title = e.target.value
                      setContent({
                        ...content,
                        modules: { ...content.modules, items: newItems },
                      })
                    }}
                    className="input-field font-bold"
                  />
                  <textarea
                    rows={2}
                    placeholder="Descrição detalhada"
                    value={item.description}
                    onChange={(e) => {
                      const newItems = [...content.modules.items]
                      newItems[idx].description = e.target.value
                      setContent({
                        ...content,
                        modules: { ...content.modules, items: newItems },
                      })
                    }}
                    className="input-field text-xs h-auto py-2"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: DEPOIMENTOS */}
        {activeTab === 'testimonials' && (
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Depoimentos de Clientes</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.testimonials.enabled}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      testimonials: { ...content.testimonials, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-xs text-zinc-300">Exibir seção</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Título</label>
              <input
                type="text"
                value={content.testimonials.heading}
                onChange={(e) =>
                  setContent({
                    ...content,
                    testimonials: { ...content.testimonials, heading: e.target.value },
                  })
                }
                className="input-field"
              />
            </div>

            <div className="space-y-4 pt-2">
              {content.testimonials.items.map((t, idx) => (
                <div key={idx} className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Nome do autor"
                      value={t.author}
                      onChange={(e) => {
                        const newT = [...content.testimonials.items]
                        newT[idx].author = e.target.value
                        setContent({
                          ...content,
                          testimonials: { ...content.testimonials, items: newT },
                        })
                      }}
                      className="input-field font-semibold text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Função (ex: Proprietário)"
                      value={t.role}
                      onChange={(e) => {
                        const newT = [...content.testimonials.items]
                        newT[idx].role = e.target.value
                        setContent({
                          ...content,
                          testimonials: { ...content.testimonials, items: newT },
                        })
                      }}
                      className="input-field text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nome da barbearia"
                      value={t.shopName}
                      onChange={(e) => {
                        const newT = [...content.testimonials.items]
                        newT[idx].shopName = e.target.value
                        setContent({
                          ...content,
                          testimonials: { ...content.testimonials, items: newT },
                        })
                      }}
                      className="input-field text-xs text-amber-400"
                    />
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Depoimento / citação"
                    value={t.quote}
                    onChange={(e) => {
                      const newT = [...content.testimonials.items]
                      newT[idx].quote = e.target.value
                      setContent({
                        ...content,
                        testimonials: { ...content.testimonials, items: newT },
                      })
                    }}
                    className="input-field text-xs h-auto py-2"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: FAQ */}
        {activeTab === 'faq' && (
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Perguntas Frequentes (FAQ)</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={content.faq.enabled}
                  onChange={(e) =>
                    setContent({
                      ...content,
                      faq: { ...content.faq, enabled: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-amber-500 bg-zinc-800 border-zinc-700"
                />
                <span className="text-xs text-zinc-300">Exibir seção</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Título</label>
              <input
                type="text"
                value={content.faq.heading}
                onChange={(e) =>
                  setContent({ ...content, faq: { ...content.faq, heading: e.target.value } })
                }
                className="input-field"
              />
            </div>

            <div className="space-y-3 pt-2">
              {content.faq.items.map((item, idx) => (
                <div key={idx} className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-2">
                  <input
                    type="text"
                    placeholder="Pergunta"
                    value={item.question}
                    onChange={(e) => {
                      const newFaq = [...content.faq.items]
                      newFaq[idx].question = e.target.value
                      setContent({
                        ...content,
                        faq: { ...content.faq, items: newFaq },
                      })
                    }}
                    className="input-field font-semibold text-xs"
                  />
                  <textarea
                    rows={2}
                    placeholder="Resposta"
                    value={item.answer}
                    onChange={(e) => {
                      const newFaq = [...content.faq.items]
                      newFaq[idx].answer = e.target.value
                      setContent({
                        ...content,
                        faq: { ...content.faq, items: newFaq },
                      })
                    }}
                    className="input-field text-xs h-auto py-2"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
