import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'barbersaas.com.br'
  const protocol = rootDomain.startsWith('localhost') ? 'http' : 'https'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/master/',
          '/api/',
          '/auth/',
          '/tenant-suspended',
          '/tenant-not-found',
        ],
      },
    ],
    sitemap: `${protocol}://${rootDomain}/sitemap.xml`,
  }
}
