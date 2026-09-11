import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId')

    if (!tenantId || !UUID_PATTERN.test(tenantId)) {
      return NextResponse.json({ error: 'Tenant ID inválido.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: services, error } = await admin
      .from('services')
      .select('id, name, description, price, duration_minutes, cleanup_minutes, reservation_fee, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('price', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(services ?? [])
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno ao consultar serviços.' }, { status: 500 })
  }
}
