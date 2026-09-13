import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const slug = searchParams.get('slug')?.trim().toLowerCase()

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug da barbearia é obrigatório.' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // 1. Busca o tenant pelo slug ou por ID
    let query = admin.from('tenants').select('*')
    if (UUID_PATTERN.test(slug)) {
      query = query.eq('id', slug)
    } else {
      query = query.eq('slug', slug)
    }

    const { data: tenant, error: tenantError } = await query.maybeSingle()

    if (tenantError || !tenant || tenant.status === 'suspended') {
      return NextResponse.json(
        { error: 'Barbearia não encontrada ou inativa' },
        { status: 404 }
      )
    }

    // 2. Busca em paralelo serviços ativos, barbeiros/profissionais e configuração visual
    const [servicesRes, barbersRes, configRes] = await Promise.all([
      admin
        .from('services')
        .select('id, name, description, price, duration_minutes, cleanup_minutes, reservation_fee, is_active')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .order('price', { ascending: true }),

      admin
        .from('profiles')
        .select('id, full_name, email, phone, role, avatar_url, is_active')
        .eq('tenant_id', tenant.id)
        .eq('is_active', true)
        .in('role', ['barber', 'owner'])
        .order('full_name', { ascending: true }),

      admin
        .from('tenant_site_config')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle(),
    ])

    const tenantAddressObj = typeof tenant.address === 'object' && tenant.address !== null ? (tenant.address as any) : {}

    return NextResponse.json({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      phone: (tenant as any).phone || tenantAddressObj.phone || '',
      document_number: tenant.document_number || '',
      owner_name: tenant.owner_name || '',
      address: {
        street: tenant.address_street || tenantAddressObj.street || '',
        number: tenant.address_number || tenantAddressObj.number || '',
        neighborhood: tenant.address_neighborhood || tenantAddressObj.neighborhood || '',
        city: tenant.address_city || tenantAddressObj.city || '',
        state: tenant.address_state || tenantAddressObj.state || '',
        cep: tenant.address_cep || tenantAddressObj.cep || '',
      },
      visual_settings: tenant.visual_settings || {},
      siteConfig: configRes.data || null,
      services: servicesRes.data || [],
      barbers: barbersRes.data || [],
    })
  } catch (error) {
    console.error('Erro ao resolver dados públicos do tenant:', error)
    return NextResponse.json(
      { error: 'Erro interno ao consultar dados da barbearia.' },
      { status: 500 }
    )
  }
}
