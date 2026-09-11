import { createAdminClient } from '@/utils/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/guards'
import type { Database, Json } from '@/types/database.types'

export type AuditCategory = 'security' | 'financial' | 'team' | 'system'

export interface RecordAuditLogParams {
  tenantId?: string | null
  actorId?: string | null
  actorEmail: string
  actorRole: Database['public']['Enums']['user_role']
  action: string
  category: AuditCategory
  targetId?: string | null
  details?: Record<string, any>
  ipAddress?: string | null
}

export type AuditLogItem = {
  id: string
  tenant_id: string | null
  actor_id: string | null
  actor_email: string
  actor_role: Database['public']['Enums']['user_role']
  action: string
  category: string
  target_id: string | null
  details: Json
  ip_address: string | null
  created_at: string
}

/**
 * Registra um evento de auditoria de alta sensibilidade de forma segura e não bloqueante.
 */
export async function recordAuditLog(params: RecordAuditLogParams): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { error } = await admin.from('audit_logs').insert({
      tenant_id: params.tenantId || null,
      actor_id: params.actorId || null,
      actor_email: params.actorEmail,
      actor_role: params.actorRole,
      action: params.action,
      category: params.category,
      target_id: params.targetId || null,
      details: (params.details || {}) as Json,
      ip_address: params.ipAddress || null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error('[AUDIT_LOG_ERROR] Falha ao registrar log:', error.message)
      return false
    }

    return true
  } catch (err) {
    console.error('[AUDIT_LOG_EXCEPTION] Exceção ao gravar auditoria:', err)
    return false
  }
}

/**
 * Resgata os logs de auditoria do tenant atual (para o proprietário ou super admin).
 */
export async function getTenantAuditLogs(tenantId: string, limit = 50): Promise<AuditLogItem[]> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('audit_logs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as AuditLogItem[]
  } catch {
    return []
  }
}

/**
 * Resgata todos os logs de auditoria do sistema para o Super Admin.
 */
export async function getMasterAuditLogs(limit = 100): Promise<AuditLogItem[]> {
  await requireSuperAdmin()

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []
    return data as AuditLogItem[]
  } catch {
    return []
  }
}
