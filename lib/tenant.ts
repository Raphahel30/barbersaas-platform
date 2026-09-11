import 'server-only'

import { headers } from 'next/headers'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type TenantContext = Readonly<{
  id: string
  slug: string
}>

export class TenantContextError extends Error {
  constructor(message = 'Tenant context is unavailable') {
    super(message)
    this.name = 'TenantContextError'
  }
}

export async function getCurrentTenant(): Promise<TenantContext | null> {
  const requestHeaders = await headers()
  const id = requestHeaders.get('x-tenant-id')
  const slug = requestHeaders.get('x-tenant-slug')

  if (!id && !slug) return null
  if (!id || !slug || !UUID_PATTERN.test(id) || !SLUG_PATTERN.test(slug)) {
    throw new TenantContextError('Tenant context is malformed')
  }

  return Object.freeze({ id, slug })
}

export async function requireCurrentTenant(): Promise<TenantContext> {
  const tenant = await getCurrentTenant()
  if (!tenant) throw new TenantContextError()
  return tenant
}
