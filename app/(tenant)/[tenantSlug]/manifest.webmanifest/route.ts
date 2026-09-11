import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { defaultVisualSettings, type TenantVisualSettings } from '@/lib/whitelabel/settings'

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantSlug: string }> },
) {
  const { tenantSlug } = await context.params
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, visual_settings')
    .eq('slug', tenantSlug)
    .maybeSingle()

  const name = tenant?.name || 'Barbearia'
  const visual: TenantVisualSettings = {
    ...defaultVisualSettings,
    ...((tenant?.visual_settings && typeof tenant.visual_settings === 'object')
      ? (tenant.visual_settings as Partial<TenantVisualSettings>)
      : {}),
  }

  const manifest = {
    name,
    short_name: name.slice(0, 15),
    description: `Agendamento e Clube VIP - ${name}`,
    start_url: `/${tenantSlug}`,
    display: 'standalone',
    background_color: '#09090b',
    theme_color: visual.primaryColor || '#f59e0b',
    icons: [
      {
        src: visual.faviconUrl || '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: visual.faviconUrl || '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'content-type': 'application/manifest+json; charset=utf-8',
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
