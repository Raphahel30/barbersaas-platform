import { notFound } from 'next/navigation'
import { createAdminClient } from '@/utils/supabase/admin'
import TotemClient from './totem-client'

export const dynamic = 'force-dynamic'

export default async function TotemPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>
}) {
  const { tenantSlug } = await params
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name, slug, visual_settings')
    .eq('slug', tenantSlug)
    .maybeSingle()

  if (!tenant) {
    notFound()
  }

  // Busca serviços ativos
  const { data: services } = await admin
    .from('services')
    .select('id, name, price, duration_minutes')
    .eq('tenant_id', tenant.id)
    .eq('is_active', true)
    .order('price', { ascending: true })

  // Busca barbeiros ativos
  const { data: barbers } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('tenant_id', tenant.id)
    .eq('role', 'barber')
    .eq('is_active', true)

  const visual = (tenant.visual_settings && typeof tenant.visual_settings === 'object')
    ? (tenant.visual_settings as any)
    : {}

  return (
    <TotemClient
      tenantId={tenant.id}
      tenantSlug={tenant.slug}
      tenantName={tenant.name}
      logoUrl={visual.logoUrl || null}
      services={services || []}
      barbers={barbers || []}
    />
  )
}
