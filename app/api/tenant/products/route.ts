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
    const { data: products, error } = await admin
      .from('products')
      .select('id, name, sku, price, stock_quantity, min_stock_threshold, unit, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(products ?? [])
  } catch (error) {
    return NextResponse.json({ error: 'Erro interno ao consultar produtos.' }, { status: 500 })
  }
}
