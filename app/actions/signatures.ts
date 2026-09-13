'use server'

import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { requireTenantStaff } from '@/lib/auth/guards'
import {
  saveElectronicSignature,
  getStandardContractTemplate,
  verifySignatureIntegrity,
  type DocumentType,
  type ElectronicSignatureRecord,
} from '@/lib/legal/signatures'

export type SignatureActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; error?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Retorna a minuta do contrato pronta para o signatário ler antes de assinar.
 */
export async function getContractTemplateAction(
  tenantSlugOrId: string,
  documentType: DocumentType,
  signerName: string,
  signerDocument: string
): Promise<SignatureActionResult<{ title: string; bodyText: string; tenantName: string }>> {
  try {
    const supabase = createAdminClient()

    let tenantQuery = supabase.from('tenants').select('id, name')
    if (UUID_PATTERN.test(tenantSlugOrId)) {
      tenantQuery = tenantQuery.eq('id', tenantSlugOrId)
    } else {
      tenantQuery = tenantQuery.eq('slug', tenantSlugOrId)
    }

    const { data: tenant } = await tenantQuery.single()
    if (!tenant) {
      return { success: false, message: 'Barbearia não encontrada.' }
    }

    const template = getStandardContractTemplate(documentType, {
      tenantName: tenant.name,
      signerName: signerName || 'Signatário',
      signerDocument: signerDocument || '000.000.000-00',
    })

    return {
      success: true,
      data: {
        title: template.title,
        bodyText: template.bodyText,
        tenantName: tenant.name,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao gerar minuta contratual.', error: err?.message }
  }
}

/**
 * Registra a assinatura capturada no Canvas Touch com metadados do navegador e IP.
 */
export async function submitSignatureAction(input: {
  tenantSlugOrId: string
  documentType: DocumentType
  signerName: string
  signerDocument: string
  signerEmail?: string
  signaturePngBase64: string
  contractText: string
  signerId?: string
}): Promise<SignatureActionResult<{ id: string; sha256Hash: string; createdAt: string }>> {
  try {
    if (!input.signerName?.trim()) {
      return { success: false, message: 'Nome completo é obrigatório.' }
    }

    const cleanDoc = input.signerDocument.replace(/\D/g, '')
    if (cleanDoc.length < 11) {
      return { success: false, message: 'CPF ou CNPJ válido é obrigatório.' }
    }

    if (!input.signaturePngBase64 || input.signaturePngBase64.length < 100) {
      return { success: false, message: 'O traço da assinatura é obrigatório no canvas.' }
    }

    const supabase = createAdminClient()

    let tenantQuery = supabase.from('tenants').select('id, name')
    if (UUID_PATTERN.test(input.tenantSlugOrId)) {
      tenantQuery = tenantQuery.eq('id', input.tenantSlugOrId)
    } else {
      tenantQuery = tenantQuery.eq('slug', input.tenantSlugOrId)
    }

    const { data: tenant } = await tenantQuery.single()
    if (!tenant) {
      return { success: false, message: 'Barbearia não localizada.' }
    }

    // Captura metadados do cliente para auditoria jurídica
    const reqHeaders = await headers()
    const ipAddress =
      reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      reqHeaders.get('x-real-ip') ||
      '127.0.0.1'
    const userAgent = reqHeaders.get('user-agent') || 'Browser Client'

    const template = getStandardContractTemplate(input.documentType, {
      tenantName: tenant.name,
      signerName: input.signerName,
      signerDocument: input.signerDocument,
    })

    const record = await saveElectronicSignature({
      tenantId: tenant.id,
      documentType: input.documentType,
      title: template.title,
      signerId: input.signerId || null,
      signerName: input.signerName,
      signerDocument: input.signerDocument,
      signerEmail: input.signerEmail || null,
      signaturePngBase64: input.signaturePngBase64,
      contractText: input.contractText || template.bodyText,
      ipAddress,
      userAgent,
    })

    return {
      success: true,
      data: {
        id: record.id,
        sha256Hash: record.sha256_hash,
        createdAt: record.created_at,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao processar assinatura eletrônica.', error: err?.message }
  }
}

/**
 * Valida a integridade de um documento assinado pelo Hash SHA-256.
 */
export async function verifySignatureAction(
  signatureId: string
): Promise<SignatureActionResult<{ isValid: boolean; sha256Hash: string; signerName: string }>> {
  try {
    if (!UUID_PATTERN.test(signatureId)) {
      return { success: false, message: 'ID de assinatura inválido.' }
    }

    const supabase = createAdminClient()
    const { data: record } = await supabase
      .from('electronic_signatures')
      .select('*')
      .eq('id', signatureId)
      .single()

    if (!record) {
      return { success: false, message: 'Registro de assinatura não encontrado.' }
    }

    const verification = verifySignatureIntegrity(record)

    return {
      success: true,
      data: {
        isValid: verification.isValid,
        sha256Hash: record.sha256_hash,
        signerName: record.signer_name,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro na auditoria de integridade.', error: err?.message }
  }
}

/**
 * Lista as assinaturas eletrônicas emitidas para a barbearia (Exclusivo para equipe do tenant).
 */
export async function listTenantSignaturesAction(
  tenantId: string
): Promise<SignatureActionResult<any[]>> {
  try {
    await requireTenantStaff(tenantId)
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('electronic_signatures')
      .select('id, document_type, title, signer_name, signer_document, signer_email, sha256_hash, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data: data || [] }
  } catch (err: any) {
    return { success: false, message: 'Falha ao buscar histórico de assinaturas.', error: err?.message }
  }
}
