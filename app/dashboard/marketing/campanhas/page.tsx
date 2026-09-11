'use client'

import { useState, useEffect, useTransition } from 'react'
import {
  Megaphone,
  Sparkles,
  Users,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  Shuffle,
  ShieldCheck,
  Smartphone,
  Calendar,
  Layers,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Flame,
  Check,
  Sliders,
} from 'lucide-react'
import {
  getCampaignsListAction,
  getSegmentAudienceAction,
  previewSpintaxAction,
  createMarketingCampaignAction,
  getCampaignQueueAction,
  markQueueItemSentAction,
  type CampaignSegmentType,
} from '@/app/actions/campaigns'

export default function MarketingCampaignsPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'queue'>('create')
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Form State
  const [campaignName, setCampaignName] = useState('')
  const [targetSegment, setTargetSegment] = useState<CampaignSegmentType>('vip')
  const [specificBarberId, setSpecificBarberId] = useState<string>('')
  const [barbersList, setBarbersList] = useState<Array<{ id: string; name: string }>>([])
  
  const [templateText, setTemplateText] = useState(
    '{Fala|Olá|E aí} {nome}! Tudo bem? {Aproveite|Confira|Dá uma olhada no} novo horário da {barbearia}. Notamos que faz um tempo desde o seu último corte ({ultimo_servico}). Bora renovar o visual esta semana?'
  )
  const [spintaxPreview, setSpintaxPreview] = useState<string>('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [audienceLoading, setAudienceLoading] = useState<boolean>(false)

  // Feedback State
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Campaigns List & Queue State
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [queueStats, setQueueStats] = useState<{ total: number; sent: number; pending: number; failed: number }>({
    total: 0,
    sent: 0,
    pending: 0,
    failed: 0,
  })

  // Jitter Humanizado State
  const [autoSending, setAutoSending] = useState(false)
  const [jitterCountdown, setJitterCountdown] = useState<number>(0)

  // Carregar lista de campanhas e barbeiros no mount
  useEffect(() => {
    loadData()
  }, [])

  // Atualizar audiência quando o segmento ou barbeiro mudar
  useEffect(() => {
    updateAudienceEstimate()
  }, [targetSegment, specificBarberId])

  // Gerar um preview de Spintax inicial
  useEffect(() => {
    handleSpintaxSample()
  }, [templateText])

  const loadData = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await getCampaignsListAction()
      if (!res.success) {
        setErrorMsg(res.message || 'Erro ao carregar campanhas')
      } else {
        setCampaigns(res.data)
        if (res.data.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(res.data[0].id)
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const updateAudienceEstimate = async () => {
    setAudienceLoading(true)
    try {
      const res = await getSegmentAudienceAction(targetSegment, specificBarberId || undefined)
      if (res.success && res.data) {
        setAudienceCount(res.data.total)
      }
    } catch (err) {
      console.error('Erro ao estimar audiência:', err)
    } finally {
      setAudienceLoading(false)
    }
  }

  const handleSpintaxSample = async () => {
    try {
      const res = await previewSpintaxAction(templateText, {
        nome: 'Carlos Eduardo',
        barbearia: 'Barbearia Premium',
        ultimo_servico: 'Degradê Navalhado + Barba Terapia',
      })
      if (res.success && res.data) {
        setSpintaxPreview(res.data.preview)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreateCampaign = () => {
    if (!campaignName.trim()) {
      setErrorMsg('Informe um nome para a campanha.')
      return
    }
    if (!templateText.trim()) {
      setErrorMsg('Informe o texto da mensagem com as variações Spintax.')
      return
    }

    setErrorMsg(null)
    setSuccessMsg(null)

    startTransition(async () => {
      const res = await createMarketingCampaignAction({
        name: campaignName,
        targetSegment,
        messageTemplate: templateText,
        specificBarberId: specificBarberId || undefined,
      })

      if (!res.success) {
        setErrorMsg(res.message || 'Falha ao criar campanha')
      } else {
        setSuccessMsg(`Campanha "${campaignName}" criada com sucesso! ${res.data.totalRecipients} destinatários na fila.`)
        setCampaignName('')
        setSelectedCampaignId(res.data.campaignId)
        await loadData()
        await loadQueue(res.data.campaignId)
        setActiveTab('queue')
      }
    })
  }

  const loadQueue = async (campaignId: string) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await getCampaignQueueAction(campaignId)
      if (!res.success) {
        setErrorMsg(res.message || 'Erro ao carregar fila')
      } else {
        setQueueItems(res.data)
        const total = res.data.length
        const sent = res.data.filter((i: any) => i.status === 'sent').length
        const pending = res.data.filter((i: any) => i.status === 'pending').length
        const failed = res.data.filter((i: any) => i.status === 'failed').length
        setQueueStats({ total, sent, pending, failed })
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const handleMarkSent = async (queueId: string) => {
    const res = await markQueueItemSentAction(queueId, 'sent')
    if (res.success) {
      // Atualizar lista local
      setQueueItems((prev) =>
        prev.map((item) => (item.id === queueId ? { ...item, status: 'sent', sent_at: new Date().toISOString() } : item))
      )
      setQueueStats((prev) => ({
        ...prev,
        sent: prev.sent + 1,
        pending: Math.max(0, prev.pending - 1),
      }))
    }
  }

  const handleOpenWhatsApp = (item: any) => {
    const cleanPhone = item.phone.replace(/\D/g, '')
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(item.rendered_text)}`
    window.open(url, '_blank')
    handleMarkSent(item.id)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-2">
                  Motor de Campanhas & Broadcast RFM
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    WhatsApp Anti-Ban
                  </span>
                </h1>
                <p className="text-zinc-400 text-sm mt-0.5">
                  Disparos segmentados por comportamento, Spintax humanizado e modo duplo (Custo Zero ou Automático).
                </p>
              </div>
            </div>
          </div>

          {/* Abas */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'create'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Nova Campanha
            </button>
            <button
              onClick={() => {
                setActiveTab('list')
                loadData()
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'list'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              Campanhas ({campaigns.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('queue')
                if (selectedCampaignId) loadQueue(selectedCampaignId)
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'queue'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              Fila de Disparo (1-Toque)
            </button>
          </div>
        </div>

        {/* Alertas */}
        {errorMsg && (
          <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}
      </div>

      {/* Conteúdo Principal */}
      <div className="max-w-7xl mx-auto">
        {/* ABA 1: NOVA CAMPANHA */}
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Coluna da Esquerda: Formulário e Segmentação */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm">
                <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-amber-400" />
                  1. Configuração Básica & Segmento RFM
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Nome da Campanha
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="Ex: Campanha Dia dos Pais - Clientes VIP"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Segmentação Inteligente (RFM)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        {
                          id: 'vip' as CampaignSegmentType,
                          title: 'Clientes VIP (Alta Freq.)',
                          desc: '3+ agendamentos nos últimos 90 dias',
                          badge: 'Alto LTV',
                        },
                        {
                          id: 'inactive_45d' as CampaignSegmentType,
                          title: 'Inativos (> 45 dias)',
                          desc: 'Clientes sumidos com risco de churn',
                          badge: 'Reativação',
                        },
                        {
                          id: 'beard_lovers' as CampaignSegmentType,
                          title: 'Clientes de Barba',
                          desc: 'Consomem barba ou combo regularmente',
                          badge: 'Serviço',
                        },
                        {
                          id: 'birthday_month' as CampaignSegmentType,
                          title: 'Aniversariantes do Mês',
                          desc: 'Fazem aniversário neste mês',
                          badge: 'Fidelização',
                        },
                        {
                          id: 'all_active' as CampaignSegmentType,
                          title: 'Base Completa',
                          desc: 'Todos os clientes com WhatsApp válido',
                          badge: 'Geral',
                        },
                      ].map((seg) => (
                        <div
                          key={seg.id}
                          onClick={() => setTargetSegment(seg.id)}
                          className={`cursor-pointer border rounded-xl p-3.5 transition-all ${
                            targetSegment === seg.id
                              ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-sm'
                              : 'bg-zinc-950/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-sm text-zinc-200">{seg.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-medium">
                              {seg.badge}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400">{seg.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumo da Audiência Estimada */}
                  <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-xs text-zinc-400 block">Audiência Elegível Calculada</span>
                        <span className="text-base font-bold text-white">
                          {audienceLoading ? 'Calculando...' : `${audienceCount ?? 0} clientes encontrados`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={updateAudienceEstimate}
                      disabled={audienceLoading}
                      className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${audienceLoading ? 'animate-spin' : ''}`} />
                      Recalcular
                    </button>
                  </div>
                </div>
              </div>

              {/* Editor com Spintax */}
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Shuffle className="w-5 h-5 text-amber-400" />
                    2. Mensagem com Blindagem Spintax
                  </h2>
                  <button
                    onClick={handleSpintaxSample}
                    className="text-xs font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Sortear Variação
                  </button>
                </div>

                <p className="text-xs text-zinc-400">
                  Use colchetes e barras verticais para alternar palavras e impedir o bloqueio de spam pelo WhatsApp:
                  <code className="text-amber-400 bg-zinc-950 px-1.5 py-0.5 rounded ml-1">
                    {'{Fala|Olá|E aí}'}
                  </code>
                </p>

                <div>
                  <textarea
                    rows={5}
                    value={templateText}
                    onChange={(e) => setTemplateText(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors font-mono"
                  />
                </div>

                {/* Tags de variáveis dinâmicas */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-zinc-500">Variáveis disponíveis:</span>
                  {['{nome}', '{barbearia}', '{ultimo_servico}'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTemplateText((prev) => prev + ' ' + v)}
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg transition-colors font-mono"
                    >
                      + {v}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Coluna da Direita: Preview do WhatsApp & Ações */}
            <div className="lg:col-span-5 space-y-6">
              {/* Card de Simulação do WhatsApp */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

                <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow">
                      WA
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Simulador do WhatsApp</h4>
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Preview Real do Destinatário
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-500">Agora</span>
                </div>

                {/* Balão de Mensagem Estilo WhatsApp */}
                <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl rounded-tl-sm p-4 text-sm text-emerald-100/90 space-y-2 leading-relaxed shadow-sm">
                  <p className="whitespace-pre-wrap">{spintaxPreview || 'Carregando preview...'}</p>
                  <div className="flex justify-end text-[10px] text-emerald-400/60 items-center gap-1">
                    <span>14:32</span>
                    <Check className="w-3 h-3 text-emerald-400" />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800 text-xs text-zinc-400 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Spintax Ativo: Variação única gerada por destinatário</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Clock className="w-4 h-4" />
                    <span>Jitter Anti-Ban: Intervalo aleatório de 30s a 90s</span>
                  </div>
                </div>
              </div>

              {/* Botão de Criação */}
              <div className="bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white mb-1">Pronto para iniciar?</h3>
                  <p className="text-xs text-zinc-400">
                    Ao criar a campanha, a fila de disparo será populada com as variações Spintax exclusivas para cada
                    cliente.
                  </p>
                </div>

                <button
                  onClick={handleCreateCampaign}
                  disabled={isPending || !campaignName.trim() || (audienceCount !== null && audienceCount === 0)}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-sm shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Criando Campanha e Fila...
                    </>
                  ) : (
                    <>
                      <Flame className="w-4 h-4" />
                      Criar Campanha e Gerar Fila
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ABA 2: LISTAGEM DE CAMPANHAS */}
        {activeTab === 'list' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-white">Histórico de Campanhas</h2>
              <button
                onClick={loadData}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar Lista
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-12 text-center">
                <Megaphone className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white mb-1">Nenhuma campanha criada ainda</h3>
                <p className="text-zinc-400 text-sm mb-4">
                  Crie sua primeira campanha para disparar mensagens no WhatsApp com segurança.
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-amber-500 text-zinc-950 rounded-xl text-sm font-semibold hover:bg-amber-400 transition-colors"
                >
                  Criar Nova Campanha
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {campaigns.map((c) => {
                  const progress = c.total_recipients > 0 ? Math.round((c.sent_count / c.total_recipients) * 100) : 0
                  return (
                    <div
                      key={c.id}
                      className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                            {c.target_segment.toUpperCase()}
                          </span>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              c.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : c.status === 'processing'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>

                        <h3 className="font-bold text-white text-base mb-1">{c.name}</h3>
                        <p className="text-zinc-400 text-xs line-clamp-2 mb-4 font-mono">{c.message_template}</p>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-zinc-800/80">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-zinc-400">Progresso</span>
                            <span className="font-semibold text-white">
                              {c.sent_count} / {c.total_recipients} ({progress}%)
                            </span>
                          </div>
                          <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedCampaignId(c.id)
                            loadQueue(c.id)
                            setActiveTab('queue')
                          }}
                          className="w-full py-2 px-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors"
                        >
                          Ver Fila de Envio <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ABA 3: FILA DE DISPARO INTERATIVA (1-TOQUE / WA.ME) */}
        {activeTab === 'queue' && (
          <div className="space-y-6">
            {/* Seletor de Campanha */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Fila Ativa de Disparo 1-Toque (Custo Zero)</h3>
                  <p className="text-xs text-zinc-400">
                    Clique em &quot;Enviar via WhatsApp&quot; para disparar sem risco de bloqueio e com mensagem personalizada.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedCampaignId || ''}
                  onChange={(e) => {
                    setSelectedCampaignId(e.target.value)
                    loadQueue(e.target.value)
                  }}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="" disabled>
                    Selecione uma campanha
                  </option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.sent_count}/{c.total_recipients})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => selectedCampaignId && loadQueue(selectedCampaignId)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
                <span className="text-xs text-zinc-400 block mb-1">Total na Fila</span>
                <span className="text-2xl font-bold text-white">{queueStats.total}</span>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
                <span className="text-xs text-emerald-400 block mb-1">Disparadas com Sucesso</span>
                <span className="text-2xl font-bold text-emerald-400">{queueStats.sent}</span>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
                <span className="text-xs text-amber-400 block mb-1">Aguardando Envio</span>
                <span className="text-2xl font-bold text-amber-400">{queueStats.pending}</span>
              </div>
              <div className="bg-zinc-900/60 border border-zinc-800 p-4 rounded-xl">
                <span className="text-xs text-rose-400 block mb-1">Falhas de Envio</span>
                <span className="text-2xl font-bold text-rose-400">{queueStats.failed}</span>
              </div>
            </div>

            {/* Tabela de Destinatários na Fila */}
            <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h4 className="font-semibold text-sm text-white">Destinatários Agendados</h4>
                <span className="text-xs text-zinc-400">Mostrando até 100 destinatários por bloco</span>
              </div>

              {queueItems.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 text-sm">
                  Nenhum registro na fila para esta campanha.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800/60">
                  {queueItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-zinc-900/90 transition-colors"
                    >
                      <div className="space-y-1 max-w-2xl">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-sm">
                            {item.client_name || 'Cliente'}
                          </span>
                          <span className="text-xs font-mono text-zinc-400">
                            {item.phone}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              item.status === 'sent'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-amber-500/10 text-amber-400'
                            }`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 font-mono bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800/60">
                          {item.rendered_text}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'pending' ? (
                          <button
                            onClick={() => handleOpenWhatsApp(item)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
                          >
                            <Send className="w-3.5 h-3.5" />
                            Enviar via WhatsApp
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium px-3 py-1.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                            <CheckCircle2 className="w-4 h-4" />
                            Enviado {item.sent_at ? new Date(item.sent_at).toLocaleTimeString() : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
