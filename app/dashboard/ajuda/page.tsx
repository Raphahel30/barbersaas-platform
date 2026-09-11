'use client'

import { useState } from 'react'
import Link from 'next/link'

interface FaqItem {
  id: string
  category: 'dominio' | 'financeiro' | 'agenda' | 'equipe' | 'geral'
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    id: 'dns',
    category: 'dominio',
    question: 'Como apontar meu domínio próprio (ex: barbeariadocarlos.com.br)?',
    answer:
      'Acesse o painel do seu registrador (Registro.br, Cloudflare ou GoDaddy). Crie um registro do tipo CNAME com nome "agendamento" (ou "www") apontando para "cname.barbersaas.com.br". O certificado de segurança SSL/TLS é emitido e renovado automaticamente de forma gratuita pela nossa infraestrutura.',
  },
  {
    id: 'balcao',
    category: 'financeiro',
    question: 'Como funciona a baixa de atendimentos e cortes no balcão?',
    answer:
      'Na tela da Agenda, clique no agendamento e selecione "Quitar Saldo". Escolha se o cliente pagou em Dinheiro, Cartão na Maquininha ou Pix Direto. O sistema abate o sinal (caso tenha sido pago), credita a comissão do barbeiro e registra o dinheiro em mãos para o fechamento de caixa.',
  },
  {
    id: 'gateway',
    category: 'financeiro',
    question: 'Como recebo o valor da taxa de reserva Pix na minha conta bancária?',
    answer:
      'Você conecta sua própria conta do Asaas, Mercado Pago ou InfinitePay nas configurações. Quando o cliente final paga o sinal Pix pelo PWA, o valor cai diretamente na sua conta cadastrada no gateway, sem passar por intermediários.',
  },
  {
    id: 'carencia',
    category: 'financeiro',
    question: 'Como funciona a tolerância e carência de 5 dias do plano?',
    answer:
      'Caso ocorra algum atraso na renovação da sua assinatura da plataforma, o sistema ativa uma tolerância de 5 dias corridos. Durante esse período, seus clientes continuam agendando normalmente e sua loja permanece online enquanto você regulariza a fatura.',
  },
  {
    id: 'equipe',
    category: 'equipe',
    question: 'Como convidar barbeiros parceiros e definir comissões individuais?',
    answer:
      'No menu da barbearia, acesse Equipe. Você pode cadastrar cada barbeiro informando nome, horário de atendimento e percentual de comissão (ex: 50% em serviços e 10% em produtos). Cada barbeiro tem seu acesso restrito à própria agenda no celular.',
  },
  {
    id: 'qrcode',
    category: 'geral',
    question: 'Como gerar e imprimir o QR Code para colocar no espelho ou balcão?',
    answer:
      'Acesse o Assistente de Loja (/dashboard/onboarding) na Etapa 5 ou o menu Identidade Visual. Copie o seu link público ou clique em "Imprimir QR Code". O QR Code direciona o cliente direto para o catálogo da sua barbearia em 1 toque de câmera.',
  },
  {
    id: 'noshow',
    category: 'agenda',
    question: 'O que acontece quando o cliente não comparece (No-Show)?',
    answer:
      'Clique no horário marcado e selecione "Marcar No-Show". Se você configurou taxa de reserva Pix antecipada, o valor retido do sinal é repassado ao barbeiro conforme a política da sua loja para compensar o tempo perdido, e o slot é liberado.',
  },
  {
    id: 'sem-app',
    category: 'geral',
    question: 'Por que o cliente agenda sem precisar baixar aplicativo na loja?',
    answer:
      'Nosso sistema utiliza a tecnologia PWA (Progressive Web App). O cliente clica no link pelo Instagram ou WhatsApp e a página abre instantaneamente no navegador com visual de aplicativo nativo, sem senha e sem consumir memória do celular.',
  },
  {
    id: 'exportacao',
    category: 'geral',
    question: 'Como exportar os dados dos meus clientes e atendimentos (LGPD)?',
    answer:
      'Você é dono absoluto da sua carteira de clientes. Em Configurações ➔ Exportação de Dados, você pode baixar o arquivo completo em JSON ou CSV contendo cadastro de clientes, histórico de cortes e faturamentos com 1 clique.',
  },
  {
    id: 'produtos',
    category: 'financeiro',
    question: 'Como cadastrar e vender pomadas e óleos de barba na comanda?',
    answer:
      'No fechamento do atendimento ou através do corte avulso, você adiciona produtos comercializados. O estoque é atualizado em tempo real e a comissão do profissional que indicou o produto é calculada separadamente dos serviços.',
  },
]

export default function AjudaDashboardPage() {
  const [openFaq, setOpenFaq] = useState<string | null>('dns')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filteredFaqs = FAQS.filter((f) => {
    const matchesCategory = categoryFilter === 'all' || f.category === categoryFilter
    const matchesSearch =
      f.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header da Central de Ajuda */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                Suporte & Operação
              </span>
              <span className="text-xs text-zinc-500">Base de Conhecimento</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
              Central de Ajuda do Barbeiro
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Tire dúvidas operacionais rápidas, consulte tutoriais de configuração e fale com o suporte.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/agenda"
              className="text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 transition-colors"
            >
              ← Voltar à Agenda
            </Link>
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1,%20preciso%20de%20ajuda%20com%20a%20minha%20barbearia%20no%20SaaS"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
              </svg>
              Suporte WhatsApp Direto
            </a>
          </div>
        </div>

        {/* Cards de Tutoriais Rápidos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 border-zinc-800 space-y-3">
            <span className="text-2xl">⚡</span>
            <h3 className="font-bold text-white text-sm">Configuração em 5 Minutos</h3>
            <p className="text-xs text-zinc-400">
              Passo a passo rápido para cadastrar serviços, horários e ativar seu link no Instagram.
            </p>
            <Link
              href="/dashboard/onboarding"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 block"
            >
              Abrir Assistente →
            </Link>
          </div>

          <div className="glass-card p-5 border-zinc-800 space-y-3">
            <span className="text-2xl">💰</span>
            <h3 className="font-bold text-white text-sm">Fechamento & Comissões</h3>
            <p className="text-xs text-zinc-400">
              Aprenda como calcular repasses líquidos sem calculadora e sem conflitos na equipe.
            </p>
            <Link
              href="/dashboard/financeiro"
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 block"
            >
              Ver Fechamentos →
            </Link>
          </div>

          <div className="glass-card p-5 border-zinc-800 space-y-3">
            <span className="text-2xl">🌐</span>
            <h3 className="font-bold text-white text-sm">Domínio Próprio (.com.br)</h3>
            <p className="text-xs text-zinc-400">
              Como apontar seu endereço próprio com SSL automático via Cloudflare for SaaS.
            </p>
            <button
              onClick={() => {
                setOpenFaq('dns')
                document.getElementById('faq-dns')?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 block text-left"
            >
              Ver Instruções DNS →
            </button>
          </div>
        </div>

        {/* Campo de Busca & Filtros */}
        <div className="glass-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-zinc-800">
          <div className="w-full sm:w-1/2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar dúvida (ex: maquininha, sinal pix, comissão)..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'financeiro', label: 'Financeiro' },
              { id: 'dominio', label: 'Domínio/DNS' },
              { id: 'equipe', label: 'Equipe' },
              { id: 'geral', label: 'Geral/PWA' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border whitespace-nowrap transition-colors ${
                  categoryFilter === cat.id
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion de Dúvidas Frequentes */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-white">Dúvidas Frequentes (FAQ)</h2>

          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              Nenhuma resposta encontrada para sua pesquisa. Fale com nosso suporte no WhatsApp!
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openFaq === faq.id

              return (
                <div
                  key={faq.id}
                  id={`faq-${faq.id}`}
                  className="glass-card border-zinc-800 overflow-hidden transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : faq.id)}
                    className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors"
                  >
                    <span className="font-bold text-xs sm:text-sm text-zinc-100">
                      {faq.question}
                    </span>
                    <span className="text-amber-500 font-bold text-lg transition-transform duration-200">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-5 sm:px-5 text-xs text-zinc-300 leading-relaxed border-t border-zinc-800/60 pt-3 animate-fadeIn">
                      {faq.answer}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Banner de Suporte Humanizado */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <h3 className="font-bold text-white text-base">Não encontrou o que precisava?</h3>
            <p className="text-xs text-zinc-400">
              Nosso time técnico está disponível de segunda a sábado das 08h às 20h para auxiliar sua barbearia.
            </p>
          </div>

          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1,%20gostaria%20de%20falar%20com%20o%20suporte%20t%C3%A9cnico%20da%20plataforma"
            target="_blank"
            rel="noreferrer"
            className="gold-button text-xs font-bold px-6 py-3 whitespace-nowrap shadow-md"
          >
            Falar com Especialista WhatsApp →
          </a>
        </div>
      </div>
    </div>
  )
}
