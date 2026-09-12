import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'navalio.com.br'
  const protocol = rootDomain.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${protocol}://${rootDomain}`

  const admin = createAdminClient()
  const { data: tenants } = await admin
    .from('tenants')
    .select('slug, updated_at')
    .eq('status', 'active')

  const tenantUrls: MetadataRoute.Sitemap = (tenants ?? []).flatMap((t) => [
    {
      url: `${baseUrl}/${t.slug}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/${t.slug}/agendar`,
      lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    },
  ])

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1.0,
    },
    ...tenantUrls,
  ]
}
