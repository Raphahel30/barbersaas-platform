import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/types/database.types'
import { updateSession } from '@/utils/supabase/middleware'
import { checkDistributedRateLimit } from '@/lib/security/rate-limit'

type TenantStatus = Database['public']['Enums']['tenant_status']

type ResolvedTenant = {
  id: string
  slug: string
  status: TenantStatus
}

const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'www'])

function normalizeHostname(host: string): string {
  const normalized = host.trim().toLowerCase().replace(/\.$/, '')

  if (normalized.startsWith('[')) {
    const closingBracket = normalized.indexOf(']')
    return closingBracket === -1 ? normalized : normalized.slice(1, closingBracket)
  }

  return normalized.split(':')[0]
}

function getRootHostname(): string {
  const configuredDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000'
  return normalizeHostname(configuredDomain)
}

function getPublicSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase public environment variables')
  }

  return { key, url }
}

function getSubdomain(hostname: string, rootHostname: string): string | null {
  const suffix = `.${rootHostname}`

  if (!hostname.endsWith(suffix)) return null

  const subdomain = hostname.slice(0, -suffix.length)
  if (!subdomain || subdomain.includes('.') || RESERVED_SUBDOMAINS.has(subdomain)) {
    return null
  }

  return subdomain
}

async function resolveTenant(
  hostname: string,
  slug: string | null,
): Promise<ResolvedTenant | null> {
  const { key, url } = getPublicSupabaseConfig()
  const response = await fetch(`${url}/rest/v1/rpc/resolve_tenant_by_host`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ requested_host: hostname, requested_slug: slug }),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Tenant resolution failed with status ${response.status}`)
  }

  const tenants = (await response.json()) as ResolvedTenant[]
  return tenants[0] ?? null
}

function copySessionCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie))
  return target
}

function createRequestHeaders(request: NextRequest): Headers {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.delete('x-tenant-id')
  requestHeaders.delete('x-tenant-slug')
  return requestHeaders
}

export async function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('x-forwarded-host') || request.headers.get('host')

  if (!hostHeader) {
    return NextResponse.json({ error: 'Host header is required' }, { status: 400 })
  }

  // 1. Verificação de Blindagem Anti-Abuso (Rate Limiting)
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1'
  const pathname = request.nextUrl.pathname

  // Proteção de Força Bruta em Autenticação
  if (pathname.startsWith('/api/auth')) {
    const authLimit = await checkDistributedRateLimit(`auth:${clientIp}`, 5, 15 * 60 * 1000)
    if (!authLimit.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas de autenticação. Aguarde alguns minutos antes de tentar novamente.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(authLimit.resetTimeMs / 1000)),
            'Content-Type': 'application/json',
          },
        },
      )
    }
  }

  // Proteção Anti-Spam de Holds de Agendamento (bloqueio de grade proposital)
  if (request.method === 'POST' && (pathname.includes('/agendar') || pathname.endsWith('/hold'))) {
    const holdLimit = await checkDistributedRateLimit(`hold:${clientIp}`, 3, 15 * 60 * 1000)
    if (!holdLimit.success) {
      return NextResponse.json(
        { error: 'Muitas tentativas de reserva. Aguarde alguns minutos para liberar a grade.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(holdLimit.resetTimeMs / 1000)),
            'Content-Type': 'application/json',
          },
        },
      )
    }
  }

  let sessionResponse: NextResponse

  try {
    sessionResponse = await updateSession(request)
  } catch {
    return NextResponse.json(
      { error: 'Authentication service is temporarily unavailable' },
      { status: 503 },
    )
  }

  const hostname = normalizeHostname(hostHeader)
  let rootHostname: string
  try {
    rootHostname = getRootHostname()
  } catch {
    return copySessionCookies(
      sessionResponse,
      NextResponse.json({ error: 'Application domain is not configured' }, { status: 503 }),
    )
  }
  const requestHeaders = createRequestHeaders(request)
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isPlatformDomain =
    hostname.endsWith('.netlify.app') ||
    hostname.endsWith('.vercel.app') ||
    hostname.endsWith('.pages.dev')
  const rootSuffix = `.${rootHostname}`
  const rootSubdomain = hostname.endsWith(rootSuffix)
    ? hostname.slice(0, -rootSuffix.length)
    : null
  const isMainDomain =
    isLocalhost ||
    isPlatformDomain ||
    hostname === rootHostname ||
    (rootSubdomain !== null && RESERVED_SUBDOMAINS.has(rootSubdomain))

  if (isMainDomain) {
    return copySessionCookies(
      sessionResponse,
      NextResponse.next({ request: { headers: requestHeaders } }),
    )
  }

  const subdomain = getSubdomain(hostname, rootHostname)

  let tenant: ResolvedTenant | null
  try {
    tenant = await resolveTenant(hostname, subdomain)
  } catch {
    return copySessionCookies(
      sessionResponse,
      NextResponse.json(
        { error: 'Tenant resolution is temporarily unavailable' },
        { status: 503 },
      ),
    )
  }

  if (!tenant) {
    const notFoundUrl = request.nextUrl.clone()
    notFoundUrl.pathname = '/tenant-not-found'
    return copySessionCookies(
      sessionResponse,
      NextResponse.rewrite(notFoundUrl, { request: { headers: requestHeaders } }),
    )
  }

  requestHeaders.set('x-tenant-id', tenant.id)
  requestHeaders.set('x-tenant-slug', tenant.slug)

  if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
    const suspendedUrl = request.nextUrl.clone()
    suspendedUrl.pathname = '/tenant-suspended'
    return copySessionCookies(
      sessionResponse,
      NextResponse.rewrite(suspendedUrl, { request: { headers: requestHeaders } }),
    )
  }

  const tenantUrl = request.nextUrl.clone()
  const tenantPath = request.nextUrl.pathname === '/' ? '' : request.nextUrl.pathname
  tenantUrl.pathname = `/${tenant.slug}${tenantPath}`

  const response = copySessionCookies(
    sessionResponse,
    NextResponse.rewrite(tenantUrl, { request: { headers: requestHeaders } }),
  )

  if (!pathname.startsWith('/api') && !pathname.startsWith('/dashboard') && !pathname.startsWith('/master')) {
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300')
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|woff|woff2)$).*)',
  ],
}
