import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Navalio - Gestão de Elite e Retenção para Barbearias de Alta Performance',
  description: 'Sistema completo para barbearias tradicionais e modernas: agendamentos sem atrito, pagamentos multi-gateways, fechamento com repasse líquido e cartão de fidelidade interativo.',
  keywords: ['Navalio', 'barbearia', 'saas barbearia', 'sistema para barbearia', 'gestão barbearia', 'agendamento online', 'barbearia oldschool'],
  authors: [{ name: 'Navalio' }],
  icons: {
    icon: '/images/branding/navalio-icon-n.jpg',
    shortcut: '/images/branding/navalio-icon-n.jpg',
    apple: '/images/branding/navalio-icon-n.jpg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080706',
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
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700;800;900&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#080706] text-[#fbf8f1] antialiased selection:bg-[#d4af37] selection:text-black">
        {children}
      </body>
    </html>
  )
}
