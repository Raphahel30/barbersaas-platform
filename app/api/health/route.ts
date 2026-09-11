import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

type CheckStatus = 'healthy' | 'degraded' | 'unhealthy'

interface EnvVarStatus {
  present: boolean
  required: boolean
}

export async function GET() {
  const startTime = Date.now()

  // 1. Verificação de Variáveis de Ambiente
  const envChecks: Record<string, EnvVarStatus> = {
    NEXT_PUBLIC_SUPABASE_URL: {
      present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      required: true,
    },
    NEXT_PUBLIC_SUPABASE_ANON_KEY: {
      present: Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
      required: true,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      required: true,
    },
    NEXT_PUBLIC_ROOT_DOMAIN: {
      present: Boolean(process.env.NEXT_PUBLIC_ROOT_DOMAIN),
      required: false, // Possui fallback 'localhost:3000'
    },
    ASAAS_API_KEY: {
      present: Boolean(process.env.ASAAS_API_KEY),
      required: true,
    },
    ASAAS_WEBHOOK_TOKEN: {
      present: Boolean(process.env.ASAAS_WEBHOOK_TOKEN),
      required: true,
    },
    CRON_SECRET: {
      present: Boolean(process.env.CRON_SECRET),
      required: true,
    },
  }

  const missingRequiredEnv = Object.entries(envChecks)
    .filter(([, status]) => status.required && !status.present)
    .map(([key]) => key)

  // 2. Teste de Conectividade com o Banco de Dados (Supabase)
  let dbStatus: 'connected' | 'disconnected' = 'disconnected'
  let dbLatencyMs = 0
  let dbError: string | null = null

  try {
    const dbStart = Date.now()
    const admin = createAdminClient()
    const { error } = await admin
      .from('system_settings')
      .select('id')
      .limit(1)
      .maybeSingle()

    dbLatencyMs = Date.now() - dbStart

    if (error) {
      dbStatus = 'disconnected'
      dbError = error.message
    } else {
      dbStatus = 'connected'
    }
  } catch (err) {
    dbStatus = 'disconnected'
    dbError = err instanceof Error ? err.message : 'Falha na conexão com Supabase'
  }

  // 3. Avaliação Geral do Sistema
  let overallStatus: CheckStatus = 'healthy'
  if (dbStatus === 'disconnected') {
    overallStatus = 'unhealthy'
  } else if (missingRequiredEnv.length > 0) {
    overallStatus = 'degraded'
  }

  const totalDurationMs = Date.now() - startTime

  const responsePayload = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV ?? 'development',
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
        ...(dbError ? { error: dbError } : {}),
      },
      environmentVariables: {
        allRequiredPresent: missingRequiredEnv.length === 0,
        missing: missingRequiredEnv,
        checked: Object.fromEntries(
          Object.entries(envChecks).map(([key, val]) => [key, val.present]),
        ),
      },
    },
    latencyMs: totalDurationMs,
  }

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200

  return NextResponse.json(responsePayload, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  })
}
