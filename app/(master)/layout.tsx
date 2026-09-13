import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import {
  LayoutDashboard,
  Store,
  CreditCard,
  ArrowUpDown,
  Sliders,
  LogOut,
  ShieldCheck,
  Zap,
  ExternalLink,
} from 'lucide-react'
import { requireSuperAdmin } from '@/lib/auth/guards'

export default async function MasterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Trava estrita de segurança do Master Admin
  let isAuthorized = false
  try {
    await requireSuperAdmin()
    isAuthorized = true
  } catch {
    isAuthorized = false
  }

  if (!isAuthorized) {
    redirect('/login')
  }

  const navItems = [
    { label: 'Visão Geral', href: '/master-admin', icon: LayoutDashboard },
    { label: 'Barbearias Cadastradas', href: '/master-admin#barbearias', icon: Store },
    { label: 'Assinaturas & MRR', href: '/master-admin#assinaturas', icon: CreditCard },
    { label: 'Transações Globais', href: '/master-admin#transacoes', icon: ArrowUpDown },
    { label: 'Configurações Globais', href: '/master/builder', icon: Sliders },
  ]

  return (
    <div className="min-h-screen bg-[#080706] text-[#fbf8f1] flex flex-col md:flex-row antialiased selection:bg-[#d4af37] selection:text-black">
      {/* Sidebar Fixa do Dono do SaaS */}
      <aside className="w-full md:w-64 lg:w-72 bg-[#100d0a] border-r border-[#d4af37]/20 flex flex-col shrink-0">
        {/* Topo da Sidebar / Identidade Master */}
        <div className="p-6 border-b border-[#d4af37]/15 flex items-center justify-between">
          <Link href="/master-admin" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-lg shadow-[#d4af37]/20 group-hover:scale-105 transition-transform">
              <Image
                src="/images/branding/navalio-icon-n.jpg"
                alt="Navalio Master"
                width={40}
                height={40}
                className="object-cover"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-cinzel font-black text-lg tracking-wider gold-gradient-text">
                  NAVALIO
                </span>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#9b1b1b] text-white uppercase tracking-wider">
                  MASTER
                </span>
              </div>
              <p className="text-[10px] text-[#a89e90] font-sans font-medium uppercase tracking-widest">
                Painel do Proprietário
              </p>
            </div>
          </Link>
        </div>

        {/* Informações de Autenticação / Super Admin */}
        <div className="px-6 py-4 bg-[#16120d] border-b border-[#d4af37]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-xs truncate">
              <p className="font-semibold text-white">Super Admin</p>
              <p className="text-[10px] text-[#a89e90] font-mono truncate">rafaelcassu@gmail.com</p>
            </div>
          </div>
          <ShieldCheck className="w-4 h-4 text-[#d4af37] shrink-0" />
        </div>

        {/* Navegação Principal */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-cinzel font-semibold text-[#e8decb] hover:text-[#d4af37] hover:bg-[#1c1712] transition-colors group"
              >
                <Icon className="w-4 h-4 text-[#d4af37] group-hover:scale-110 transition-transform" />
                <span>{item.label}</span>
              </Link>
            )
          })}

          <div className="pt-6 mt-6 border-t border-[#d4af37]/10">
            <p className="px-3.5 text-[10px] font-cinzel font-bold text-[#a89e90] uppercase tracking-wider mb-2">
              Acesso Rápido
            </p>
            <Link
              href="/"
              target="_blank"
              className="flex items-center justify-between px-3.5 py-2 rounded-lg text-xs text-[#a89e90] hover:text-[#d4af37] hover:bg-[#1c1712] transition-colors"
            >
              <span>Site Institucional</span>
              <ExternalLink className="w-3 h-3 text-[#d4af37]" />
            </Link>
            <Link
              href="/demo"
              target="_blank"
              className="flex items-center justify-between px-3.5 py-2 rounded-lg text-xs text-[#a89e90] hover:text-[#d4af37] hover:bg-[#1c1712] transition-colors"
            >
              <span>Sandbox / Demo</span>
              <ExternalLink className="w-3 h-3 text-[#d4af37]" />
            </Link>
          </div>
        </nav>

        {/* Rodapé da Sidebar com Status de Conexão e Logout */}
        <div className="p-4 border-t border-[#d4af37]/15 bg-[#0e0b08] space-y-3">
          <div className="flex items-center justify-between text-[11px] px-2 text-[#a89e90]">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-emerald-400" />
              Asaas & Supabase
            </span>
            <span className="text-emerald-400 font-semibold">Online</span>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white bg-[#1a140e] hover:bg-[#251d15] border border-[#d4af37]/20 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Encerrar Sessão Master</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Área Central de Conteúdo */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#080706] overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
