'use server'

import {
  processVisagismAnalysis,
  type VisagismAnalysisResult,
  type FaceShape,
} from '@/lib/ai/visagism'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireTenantStaff } from '@/lib/auth/guards'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type VisagismActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

/**
 * Processa a selfie do cliente, identifica o formato geométrico do rosto
 * e retorna 3 recomendações estéticas de cortes e barbas.
 */
export async function analyzeClientVisagism(
  tenantId: string,
  selfieBase64OrUrl: string,
  clientId?: string,
): Promise<VisagismActionResult<VisagismAnalysisResult>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  if (!selfieBase64OrUrl || selfieBase64OrUrl.length < 50) {
    return { success: false, message: 'Envie uma selfie nítida para a análise facial.' }
  }

  try {
    const result = await processVisagismAnalysis(tenantId, selfieBase64OrUrl, clientId)
    return { success: true, data: result }
  } catch (error) {
    console.error('Erro na análise de visagismo:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao processar consultoria facial.',
    }
  }
}

/**
 * Recupera o histórico de visagismo registrado na ficha técnica do cliente.
 */
export async function getClientVisagismHistory(
  tenantId: string,
  clientId: string,
): Promise<VisagismActionResult<Array<{
  id: string
  faceShape: FaceShape
  selfieUrl: string | null
  recommendedHairStyles: string[]
  recommendedBeardStyles: string[]
  createdAt: string
}>>> {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(clientId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  try {
    await requireTenantStaff(tenantId)
  } catch (authErr: any) {
    return { success: false, message: authErr?.message || 'Acesso negado.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('client_visagism_profiles')
    .select('id, face_shape, selfie_url, recommended_hair_styles, recommended_beard_styles, created_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, message: 'Erro ao consultar ficha técnica de visagismo.' }
  }

  const formatted = (data ?? []).map((row) => ({
    id: row.id,
    faceShape: row.face_shape,
    selfieUrl: row.selfie_url,
    recommendedHairStyles: row.recommended_hair_styles,
    recommendedBeardStyles: row.recommended_beard_styles,
    createdAt: row.created_at,
  }))

  return { success: true, data: formatted }
}
