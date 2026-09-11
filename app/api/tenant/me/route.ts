import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null

    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, tenant_id, role, full_name, avatar_url, phone, email')
        .eq('id', userId)
        .maybeSingle()

      if (profile?.tenant_id) {
        const admin = createAdminClient()
        const { data: tenant } = await admin
          .from('tenants')
          .select('slug, name')
          .eq('id', profile.tenant_id)
          .maybeSingle()

        return NextResponse.json({
          userId: profile.id,
          tenantId: profile.tenant_id,
          id: profile.tenant_id,
          slug: tenant?.slug || '',
          name: tenant?.name || '',
          role: profile.role,
          fullName: profile.full_name,
          avatarUrl: profile.avatar_url,
        })
      }
    }

    const admin = createAdminClient()
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, name, slug')
      .limit(1)
      .maybeSingle()

    return NextResponse.json({
      userId: null,
      tenantId: tenant?.id || null,
      id: tenant?.id || null,
      slug: tenant?.slug || '',
      name: tenant?.name || '',
      role: null,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to resolve tenant' }, { status: 500 })
  }
}
