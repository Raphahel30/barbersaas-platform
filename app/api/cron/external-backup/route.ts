import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { executeExternalColdBackup } from '@/lib/backup/external-storage'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado. CRON_SECRET inválido.' }, { status: 401 })
  }

  try {
    const result = await executeExternalColdBackup()

    if (result.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          message: 'Falha na execução do backup externo.',
          error: result.error,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Backup criptografado executado e transmitido com sucesso.',
      data: result,
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno na rotina de backup.',
        details: err?.message,
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  return GET(req)
}
