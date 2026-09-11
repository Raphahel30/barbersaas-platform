import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'BarberSaaS - Plataforma Completa de Gestão para Barbearias',
  description: 'Sistema completo para barbearias: agendamentos inteligentes, multi-gateways de pagamento, comissões automáticas, retenção e fidelidade.',
  keywords: ['barbearia', 'saas barbearia', 'agendamento online', 'gestao barbearia', 'sistema barbearia'],
  authors: [{ name: 'BarberSaaS' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased selection:bg-amber-500 selection:text-black">
        {children}
      </body>
    </html>
  )
}
