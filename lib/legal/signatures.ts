import 'server-only'

import { createHash } from 'node:crypto'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type DocumentType = 'image_use_consent' | 'partner_contract' | 'service_waiver' | 'other'

export type ElectronicSignatureRecord = Database['public']['Tables']['electronic_signatures']['Row']

export interface CreateSignatureInput {
  tenantId: string
  documentType: DocumentType
  title: string
  signerId?: string | null
  signerName: string
  signerDocument: string
  signerEmail?: string | null
  signaturePngBase64: string
  contractText: string
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, any>
}

/**
 * Gera o Hash criptográfico inviolável SHA-256 que une o conteúdo contratual,
 * dados do signatário, carimbo temporal milimétrico e a assinatura vetorial.
 */
export function generateDocumentSha256Hash(
  contractText: string,
  signerName: string,
  signerDocument: string,
  timestampIso: string,
  signatureBase64: string,
  ipAddress?: string | null,
  userAgent?: string | null
): string {
  const normalizedDoc = signerDocument.replace(/\D/g, '')
  const cleanSignature = signatureBase64.replace(/^data:image\/[a-z]+;base64,/, '')

  const payloadToHash = [
    `TEXT_CONTENT:${contractText.trim()}`,
    `SIGNER_NAME:${signerName.trim().toUpperCase()}`,
    `SIGNER_DOC:${normalizedDoc}`,
    `TIMESTAMP:${timestampIso}`,
    `IP:${ipAddress || 'UNKNOWN'}`,
    `USER_AGENT:${userAgent || 'UNKNOWN'}`,
    `SIGNATURE_DATA:${cleanSignature}`,
  ].join('||')

  return createHash('sha256').update(payloadToHash, 'utf8').digest('hex')
}

/**
 * Retorna minutas contratuais padronizadas e juridicamente fundamentadas.
 */
export function getStandardContractTemplate(
  documentType: DocumentType,
  params: {
    tenantName: string
    signerName: string
    signerDocument: string
    todayFormatted?: string
    commissionPercent?: number
  }
): { title: string; bodyText: string } {
  const dateStr = params.todayFormatted || new Date().toLocaleDateString('pt-BR')

  switch (documentType) {
    case 'image_use_consent':
      return {
        title: 'Termo de Autorização de Uso de Imagem e Voz',
        bodyText:
          `TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM E VOZ\n\n` +
          `Eu, ${params.signerName.toUpperCase()}, portador(a) do CPF/Documento nº ${params.signerDocument}, ` +
          `por meio deste instrumento, autorizo a empresa ${params.tenantName.toUpperCase()} a utilizar, ` +
          `reproduzir e publicar minha imagem, fotografia e voz captadas durante a realização de serviços ` +
          `na barbearia.\n\n` +
          `A presente autorização abrange a veiculação nas redes sociais oficiais da barbearia (Instagram, Facebook, ` +
          `TikTok), galeria de estilos do aplicativo móvel/PWA e materiais promocionais impressos ou digitais.\n\n` +
          `Declaro que esta autorização é concedida a título gratuito, em conformidade com o Código Civil Brasileiro ` +
          `e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), tendo plena ciência dos termos aqui expostos.\n\n` +
          `Data: ${dateStr}.`,
      }

    case 'partner_contract':
      return {
        title: 'Contrato de Parceria Profissional (Lei nº 13.352/2016)',
        bodyText:
          `CONTRATO DE SALÃO-PARCEIRO E PROFISSIONAL-PARCEIRO\n` +
          `(Conforme preceitua a Lei Federal nº 13.352/2016 - "Lei do Salão-Parceiro")\n\n` +
          `SALÃO-PARCEIRO: ${params.tenantName.toUpperCase()}.\n` +
          `PROFISSIONAL-PARCEIRO: ${params.signerName.toUpperCase()}, inscrito(a) sob o CPF/CNPJ nº ${params.signerDocument}.\n\n` +
          `CLÁUSULA PRIMEIRA - DO OBJETO E AUTONOMIA:\n` +
          `O presente contrato tem por objeto a atuação coordenada do PROFISSIONAL-PARCEIRO no atendimento ` +
          `aos clientes nas dependências do SALÃO-PARCEIRO, mediante livre exercício profissional, inexistindo qualquer ` +
          `vínculo de emprego, subordinação jurídica, exclusividade ou controle de jornada de trabalho.\n\n` +
          `CLÁUSULA SEGUNDA - DA PARTILHA DE RECEITAS (COTA-PARTE):\n` +
          `O SALÃO-PARCEIRO reterá sua cota-parte destinada ao custeio da infraestrutura, fornecimento de lavatórios, ` +
          `energia, agendamento digital e marca. Ao PROFISSIONAL-PARCEIRO caberá a sua cota-parte comissional ajustada ` +
          `de ${params.commissionPercent || 50}%, paga mediante fechamento periódico.\n\n` +
          `CLÁUSULA TERCEIRA - DAS OBRIGAÇÕES FISCAIS:\n` +
          `O Profissional-Parceiro declara sua condição de prestador autônomo / Microempreendedor Individual (MEI) ` +
          `devidamente regularizado, responsabilizando-se pelo recolhimento de seus tributos municipais e previdenciários.\n\n` +
          `Firmado em comum acordo em ${dateStr}.`,
      }

    case 'service_waiver':
      return {
        title: 'Termo de Ciência e Cuidados Pós-Procedimento Químico',
        bodyText:
          `TERMO DE CIÊNCIA E PROCEDIMENTO ESTÉTICO / QUÍMICO\n\n` +
          `Eu, ${params.signerName.toUpperCase()}, documento nº ${params.signerDocument}, ` +
          `declaro que fui plenamente instruído(a) pela equipe da ${params.tenantName} sobre os procedimentos ` +
          `de descoloração capilar, pigmentação ou alisamento, bem como os cuidados diários de hidratação necessários.\n\n` +
          `Declaro não possuir histórico conhecido de alergia severa aos cosméticos homologados utilizados.\n\n` +
          `Data: ${dateStr}.`,
      }

    default:
      return {
        title: 'Termo de Aceite e Compromisso',
        bodyText:
          `TERMO DE ACEITE\n\n` +
          `Signatário: ${params.signerName.toUpperCase()} - Doc: ${params.signerDocument}\n` +
          `Barbearia: ${params.tenantName}\n\n` +
          `Declaro ciência e concordância irrestrita com os termos operacionais pactuados em ${dateStr}.`,
      }
  }
}

/**
 * Salva a assinatura eletrônica no banco de dados com auditoria jurídica completa.
 */
export async function saveElectronicSignature(
  input: CreateSignatureInput
): Promise<ElectronicSignatureRecord> {
  const supabase = createAdminClient()
  const timestampIso = new Date().toISOString()

  // 1. Gera o Hash SHA-256 inviolável
  const sha256Hash = generateDocumentSha256Hash(
    input.contractText,
    input.signerName,
    input.signerDocument,
    timestampIso,
    input.signaturePngBase64,
    input.ipAddress,
    input.userAgent
  )

  // 2. Grava o registro de assinatura na tabela electronic_signatures
  const { data: record, error } = await supabase
    .from('electronic_signatures')
    .insert({
      tenant_id: input.tenantId,
      document_type: input.documentType,
      title: input.title,
      signer_id: input.signerId || null,
      signer_name: input.signerName.trim(),
      signer_document: input.signerDocument.trim(),
      signer_email: input.signerEmail?.trim() || null,
      signature_png_base64: input.signaturePngBase64,
      sha256_hash: sha256Hash,
      contract_text_snapshot: input.contractText,
      ip_address: input.ipAddress || null,
      user_agent: input.userAgent || null,
      metadata: input.metadata || {},
      created_at: timestampIso,
    })
    .select()
    .single()

  if (error || !record) {
    throw new Error(`Falha ao salvar assinatura eletrônica: ${error?.message}`)
  }

  // 3. Se for contrato de salão-parceiro, formaliza em profiles.partner_contract_signed_at
  if (input.documentType === 'partner_contract' && input.signerId) {
    await supabase
      .from('profiles')
      .update({
        partner_contract_signed_at: timestampIso,
        tax_document: input.signerDocument.trim(),
      })
      .eq('id', input.signerId)
  }

  return record
}

/**
 * Verifica se um registro de assinatura armazenado não sofreu adulteração (validação do hash SHA-256).
 */
export function verifySignatureIntegrity(record: ElectronicSignatureRecord): {
  isValid: boolean
  expectedHash: string
  recordedHash: string
} {
  const expectedHash = generateDocumentSha256Hash(
    record.contract_text_snapshot,
    record.signer_name,
    record.signer_document,
    record.created_at,
    record.signature_png_base64,
    record.ip_address,
    record.user_agent
  )

  return {
    isValid: expectedHash === record.sha256_hash,
    expectedHash,
    recordedHash: record.sha256_hash,
  }
}
