import type { Metadata } from 'next'
import { createAdminClient } from '@/utils/supabase/admin'
import { defaultVisualSettings, type TenantVisualSettings } from '@/lib/whitelabel/settings'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}): Promise<Metadata> {
  const { tenantSlug } = await params
  const admin = createAdminClient()
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, address, visual_settings')
    .eq('slug', tenantSlug)
    .maybeSingle()

  const visual = (tenant?.visual_settings && typeof tenant.visual_settings === 'object')
    ? (tenant.visual_settings as Partial<TenantVisualSettings>)
    : {}

  const addr = (tenant?.address && typeof tenant.address === 'object') ? (tenant.address as any) : {}
  const city = addr.city ? ` em ${addr.city}` : ''
  const barberName = tenant?.name || 'Barbearia'

  const title = `${barberName} - Agendamento Online & Barbearia${city}`
  const description = `Agende seu horário online na ${barberName}${city}. Cortes degradê, barba, acabamento e atendimento premium sem filas. Escolha seu barbeiro e confirme em 2 cliques.`

  const imageUrl = visual.bannerUrl || visual.logoUrl || '/icon-512.png'

  return {
    title,
    description,
    keywords: [
      barberName,
      'barbearia',
      'corte degradê',
      'barba',
      'agendamento online',
      addr.city || 'São Paulo',
      addr.neighborhood || 'bairro',
      'corte masculino',
    ],
    openGraph: {
      title,
      description,
      type: 'website',
      locale: 'pt_BR',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: barberName,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    icons: {
      icon: visual.faviconUrl || '/favicon.ico',
      apple: visual.faviconUrl || '/favicon.ico',
    },
    manifest: `/${tenantSlug}/manifest.webmanifest`,
  }
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const admin = createAdminClient()

  const [tenantRes, servicesRes] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, address, visual_settings')
      .eq('slug', tenantSlug)
      .maybeSingle(),
    admin
      .from('services')
      .select('name, price, duration_minutes')
      .eq('is_active', true)
      .limit(10),
  ])

  const tenant = tenantRes.data
  const services = servicesRes.data ?? []

  const visual: TenantVisualSettings = {
    ...defaultVisualSettings,
    ...((tenant?.visual_settings && typeof tenant.visual_settings === 'object')
      ? (tenant.visual_settings as Partial<TenantVisualSettings>)
      : {}),
  }

  const addr = (tenant?.address && typeof tenant.address === 'object') ? (tenant.address as any) : {}
  const textureClass = `texture-${visual.texture || 'vintage'}`

  // Schema.org LocalBusiness / Barbershop JSON-LD para SEO Local Google
  const schemaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Barbershop',
    name: tenant?.name || 'Barbearia',
    image: visual.bannerUrl || visual.logoUrl || undefined,
    telephone: visual.phone || undefined,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: addr.street ? `${addr.street}${addr.number ? `, ${addr.number}` : ''}` : undefined,
      addressLocality: addr.city || 'São Paulo',
      addressRegion: addr.state || 'SP',
      postalCode: addr.postalCode || undefined,
      addressCountry: 'BR',
    },
    openingHours: visual.openingHoursText || 'Mo-Sa 09:00-20:00',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Serviços de Barbearia',
      itemListElement: services.map((s, index) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.name,
        },
        price: Number(s.price).toFixed(2),
        priceCurrency: 'BRL',
        position: index + 1,
      })),
    },
  }

  return (
    <div
      className={`min-h-screen bg-zinc-950 text-zinc-100 ${textureClass}`}
      style={
        {
          '--tenant-primary': visual.primaryColor,
          '--tenant-secondary': visual.secondaryColor,
        } as React.CSSProperties
      }
    >
      {/* Schema.org Estruturado */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaJsonLd) }}
      />

      {/* Registro do Service Worker Offline-First */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').then(function(reg) {
                  console.log('[PWA] Service Worker registrado com sucesso:', reg.scope);
                }).catch(function(err) {
                  console.log('[PWA] Falha ao registrar Service Worker:', err);
                });
              });
            }
          `,
        }}
      />

      {children}
    </div>
  )
}
