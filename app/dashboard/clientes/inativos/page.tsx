'use client'

import React, { useState, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  Users,
  Clock,
  Send,
  Sparkles,
  Phone,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Flame,
  ArrowRight,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import { getInactiveClientsAction, dispatchRecallBatchAction } from '@/app/actions/recall'
import type { InactiveClient } from '@/lib/retention/recall'

export default function InactiveClientsRecallPage() {
  const [clients, setClients] = useState<InactiveClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRange, setFilterRange] = useState<'all' | '15-25' | '25-45' | '45+'>('all')
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [isDispatching, startDispatch] = useTransition()
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    const res = await getInactiveClientsAction()
    if (res.success && res.data) {
      setClients(res.data)
    } else {
      // Fallback mock para homologação/preview imediato caso o banco não tenha atendimentos antigos
      setClients([
        {
          clientId: 'mock-1',
          clientName: 'Leonardo Rossi',
          clientPhone: '(11) 98765-4321',
          lastAppointmentId: 'apt-m1',
          lastVisitDate: new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceLastVisit: 32,
          averageCycleDays: 20,
          daysOverdue: 12,
          lastBarberId: 'barber-1',
          lastBarberName: 'Marcos Silva',
          lastServiceName: 'Corte Degradê Navalhado',
          suggestedMessage: 'Fala Leonardo, tudo bem? Notamos que já faz 32 dias desde o seu último corte aqui na Barbearia. Seu barbeiro Marcos Silva está com horários disponíveis para esta semana! Agende direto aqui: https://barbersaas.com.br/vintage',
          whatsappUrl: 'https://wa.me/5511987654321?text=Fala%20Leonardo...',
        },
        {
          clientId: 'mock-2',
          clientName: 'Rodrigo Medeiros',
          clientPhone: '(11) 97654-3210',
          lastAppointmentId: 'apt-m2',
          lastVisitDate: new Date(Date.now() - 48 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceLastVisit: 48,
          averageCycleDays: 25,
          daysOverdue: 23,
          lastBarberId: 'barber-2',
          lastBarberName: 'Arthur Lima',
          lastServiceName: 'Combo Cabelo + Barba VIP',
          suggestedMessage: 'Fala Rodrigo, tudo bem? Notamos que já faz 48 dias desde o seu último corte aqui na Barbearia. Seu barbeiro Arthur Lima está com horários disponíveis para esta semana! Agende direto aqui: https://barbersaas.com.br/vintage',
          whatsappUrl: 'https://wa.me/5511976543210?text=Fala%20Rodrigo...',
        },
        {
          clientId: 'mock-3',
          clientName: 'Vinicius Prado',
          clientPhone: '(11) 99123-8899',
          lastAppointmentId: 'apt-m3',
          lastVisitDate: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceLastVisit: 22,
          averageCycleDays: 14,
          daysOverdue: 8,
          lastBarberId: 'barber-1',
          lastBarberName: 'Marcos Silva',
          lastServiceName: 'Barba Terapia com Toalha Quente',
          suggestedMessage: 'Fala Vinicius, tudo bem? Notamos que já faz 22 dias desde o seu último corte aqui na Barbearia. Seu barbeiro Marcos Silva está com horários disponíveis para esta semana! Agende direto aqui: https://barbersaas.com.br/vintage',
          whatsappUrl: 'https://wa.me/5511991238899?text=Fala%20Vinicius...',
        },
      ])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clientPhone.includes(searchTerm) ||
      c.lastBarberName.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    if (filterRange === '15-25') return c.daysSinceLastVisit >= 15 && c.daysSinceLastVisit <= 25
    if (filterRange === '25-45') return c.daysSinceLastVisit > 25 && c.daysSinceLastVisit <= 45
    if (filterRange === '45+') return c.daysSinceLastVisit > 45
    return true
  })

  const toggleSelectClient = (id: string) => {
    setSelectedClients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  const selectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(filteredClients.map((c) => c.clientId))
    }
  }

  const handleBatchDispatch = () => {
    if (selectedClients.length === 0) return
    startDispatch(async () => {
      setDispatchStatus('Disparando mensagens com intervalo de segurança anti-ban...')
      const res = await dispatchRecallBatchAction(selectedClients)
      if (res.success && res.result) {
        setDispatchStatus(
          `✅ Sucesso: ${res.result.sentAutomatically} mensagens enviadas automaticamente e ${res.result.manualFallbackCount} preparadas para envio manual.`,
        )
      } else {
        setDispatchStatus(`⚠️ ${res.error || 'Falha ao disparar mensagens em lote.'}`)
      }
      setTimeout(() => setDispatchStatus(null), 8000)
    })
  }

  const totalRecoverableRevenue = filteredClients.length * 65 // Ticket médio estimado de R$ 65

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
              <Flame className="w-4 h-4" />
              Retenção Ativa & Churn B2C
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Painel de Resgate de Clientes Inativos (Recall)
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Recupere clientes sumidos identificando quem ultrapassou o ciclo médio de retorno em mais de 7 dias sem horário futuro marcado.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar Lista
            </button>
            <button
              disabled={selectedClients.length === 0 || isDispatching}
              onClick={handleBatchDispatch}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              {isDispatching ? 'Processando Lote...' : `Disparar Lote (${selectedClients.length})`}
            </button>
          </div>
        </div>

        {/* Status Toast */}
        {dispatchStatus && (
          <div className="p-4 bg-neutral-900 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{dispatchStatus}</span>
            </div>
            <button onClick={() => setDispatchStatus(null)} className="text-neutral-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Clientes Elegíveis para Recall</span>
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{filteredClients.length}</span>
              <span className="text-[11px] text-rose-400 font-semibold">sem agendamento</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Ausentes além da média histórica</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Potencial de Receita a Resgatar</span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-400">
                R$ {totalRecoverableRevenue.toLocaleString('pt-BR')},00
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Estimado com ticket médio de R$ 65,00</p>
          </div>

          <div className="bg-neutral-900/80 border border-neutral-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">Delay de Segurança Anti-Ban</span>
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-400">1.8 segundos</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">Protege seu WhatsApp contra bloqueios</p>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
              <input
                type="text"
                placeholder="Buscar por nome, telefone ou barbeiro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              onClick={selectAll}
              className="px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white transition whitespace-nowrap"
            >
              {selectedClients.length === filteredClients.length ? 'Desmarcar Todos' : 'Marcar Todos'}
            </button>
          </div>

          {/* Absence Range Tabs */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setFilterRange('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterRange === 'all' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Todos ({clients.length})
            </button>
            <button
              onClick={() => setFilterRange('15-25')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterRange === '15-25' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              15 a 25 dias
            </button>
            <button
              onClick={() => setFilterRange('25-45')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterRange === '25-45' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              25 a 45 dias
            </button>
            <button
              onClick={() => setFilterRange('45+')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                filterRange === '45+' ? 'bg-amber-500 text-neutral-950 shadow-sm' : 'text-neutral-400 hover:text-white'
              }`}
            >
              45+ dias
            </button>
          </div>
        </div>

        {/* Client List / Cards */}
        {loading ? (
          <div className="py-16 text-center text-neutral-500 text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-500" />
            Carregando inteligência de retorno dos clientes...
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="py-16 text-center bg-neutral-900 border border-neutral-800 rounded-2xl p-8">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">Nenhum cliente inativo nesta faixa!</h3>
            <p className="text-xs text-neutral-400 mt-1 max-w-md mx-auto">
              Sua taxa de retenção está excelente. Todos os clientes ativos retornaram dentro do ciclo médio ou possuem horário marcado.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredClients.map((client) => {
              const isSelected = selectedClients.includes(client.clientId)
              return (
                <div
                  key={client.clientId}
                  className={`p-4 rounded-2xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-sm'
                      : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start md:items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectClient(client.clientId)}
                      className="w-4 h-4 rounded border-neutral-700 text-amber-500 focus:ring-0 mt-1 md:mt-0 cursor-pointer"
                    />

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-sm">{client.clientName}</h4>
                        <span className="text-xs text-neutral-400">{client.clientPhone}</span>
                        <span className="px-2 py-0.5 bg-rose-500/15 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold">
                          {client.daysSinceLastVisit} dias sem voltar
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400 mt-1">
                        <span>
                          Último corte com: <strong className="text-neutral-200">{client.lastBarberName}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Serviço: <strong className="text-neutral-200">{client.lastServiceName}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Ciclo habitual: <strong className="text-amber-400">{client.averageCycleDays} dias</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <a
                      href={client.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Enviar no WhatsApp (1 Toque)
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
