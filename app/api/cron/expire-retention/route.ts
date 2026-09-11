import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { checkExpiredCreditsAndStamps } from '@/lib/retention/fidelity'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId') || undefined

    const result = await checkExpiredCreditsAndStamps(tenantId)

    return NextResponse.json({
      success: true,
      message: 'Varredura de fidelidade e créditos expirados concluída.',
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Erro ao processar expiração de fidelidade e créditos.',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 },
    )
  }
}
