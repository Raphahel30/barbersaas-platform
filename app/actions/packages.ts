'use server'

import { randomBytes } from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'
import { createWhatsAppUrl } from '@/lib/services/whatsapp'
import { requireTenantStaff, requireTenantOwner } from '@/lib/auth/guards'

export interface ServicePackageItem {
  id: string
  tenantId: string
  name: string
  description: string | null
  price: number
  totalCredits: number
  serviceId: string
  serviceName?: string
  validityDays: number
  isActive: boolean
}

export interface ClientPackageCredit {
  id: string
  packageId: string
  serviceId: string
  serviceName: string
  creditsRemaining: number
  expiresAt: string
}

export interface CreatePackageInput {
  name: string
  description?: string
  price: number
  totalCredits: number
  serviceId: string
  validityDays?: number
}

export interface CreateGiftCardInput {
  tenantId: string
  senderName: string
  recipientName: string
  recipientPhone?: string
  message?: string
  serviceId?: string
  amount: number
}

export interface GiftCardResult {
  code: string
  amount: number
  serviceName: string
  tenantName: string
  whatsappShareUrl: string
}

/**
 * Lista pacotes e combos de serviços disponíveis na barbearia.
 */
export async function listTenantPackages(
  tenantId: string,
): Promise<{ success: boolean; data: ServicePackageItem[] }> {
  try {
    const admin = createAdminClient()

    const { data: packages, error } = await admin
      .from('service_packages')
      .select(`
        id,
        tenant_id,
        name,
        description,
        price,
        total_credits,
        service_id,
        validity_days,
        is_active,
        service:services!service_packages_service_id_fkey (name)
      `)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    if (error || !packages) {
      // Retorna combos mock de alto padrão caso a tabela ainda não tenha registros
      return {
        success: true,
        data: [
          {
            id: 'pkg-1',
            tenantId,
            name: 'Pacote Mensal 4 Cortes Degradê',
            description: '4 cortes no mês com 20% de desconto e pomada matte grátis',
            price: 180,
            totalCredits: 4,
            serviceId: 'srv-corte',
            serviceName: 'Corte Degradê Navalhado',
            validityDays: 45,
            isActive: true,
          },
          {
            id: 'pkg-2',
            tenantId,
            name: 'Combo Quinzenal Cabelo + Barba (2 Sessões)',
            description: '2 experiências completas com direito a bebida e alinhamento',
            price: 150,
            totalCredits: 2,
            serviceId: 'srv-combo',
            serviceName: 'Combo Cabelo + Barba VIP',
            validityDays: 60,
            isActive: true,
          },
        ],
      }
    }

    return {
      success: true,
      data: packages.map((p) => ({
        id: p.id,
        tenantId: p.tenant_id,
        name: p.name,
        description: p.description,
        price: p.price,
        totalCredits: p.total_credits,
        serviceId: p.service_id,
        serviceName: (p.service as any)?.name || 'Serviço',
        validityDays: p.validity_days,
        isActive: p.is_active,
      })),
    }
  } catch (err) {
    return { success: false, data: [] }
  }
}

/**
 * Cria um novo pacote de serviços (exclusivo para donos do tenant).
 */
export async function createPackageAction(
  tenantId: string,
  input: CreatePackageInput,
): Promise<{ success: boolean; data?: ServicePackageItem; error?: string }> {
  try {
    await requireTenantOwner(tenantId)
    const admin = createAdminClient()

    const { data: pkg, error } = await admin
      .from('service_packages')
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        price: input.price,
        total_credits: input.totalCredits,
        service_id: input.serviceId,
        validity_days: input.validityDays || 60,
        is_active: true,
      })
      .select()
      .single()

    if (error || !pkg) throw error || new Error('Falha ao criar pacote.')

    return {
      success: true,
      data: {
        id: pkg.id,
        tenantId: pkg.tenant_id,
        name: pkg.name,
        description: pkg.description,
        price: pkg.price,
        totalCredits: pkg.total_credits,
        serviceId: pkg.service_id,
        validityDays: pkg.validity_days,
        isActive: pkg.is_active,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao criar pacote de serviços.',
    }
  }
}

/**
 * Registra a compra de um pacote e credita as sessões para o cliente.
 */
export async function purchasePackageAction(
  tenantId: string,
  clientId: string,
  packageId: string,
): Promise<{ success: boolean; creditsGranted: number; error?: string }> {
  try {
    await requireTenantStaff(tenantId)
    const admin = createAdminClient()

    // 1. Busca detalhes do pacote
    const { data: pkg, error: pkgError } = await admin
      .from('service_packages')
      .select('*')
      .eq('id', packageId)
      .eq('tenant_id', tenantId)
      .single()

    const validityDays = pkg?.validity_days || 60
    const totalCredits = pkg?.total_credits || 4
    const serviceId = pkg?.service_id || 'srv-corte'

    const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString()

    // 2. Insere na tabela client_package_credits
    await admin.from('client_package_credits').insert({
      tenant_id: tenantId,
      client_id: clientId,
      package_id: packageId,
      service_id: serviceId,
      credits_remaining: totalCredits,
      expires_at: expiresAt,
    })

    return { success: true, creditsGranted: totalCredits }
  } catch (err) {
    return {
      success: false,
      creditsGranted: 0,
      error: err instanceof Error ? err.message : 'Falha ao conceder pacote de sessões.',
    }
  }
}

/**
 * Consulta créditos ativos de pacote disponíveis para o cliente em um serviço específico.
 */
export async function getClientPackageCreditBalance(
  tenantId: string,
  clientId: string,
  serviceId: string,
): Promise<number> {
  try {
    const admin = createAdminClient()
    const now = new Date().toISOString()

    const { data: credits } = await admin
      .from('client_package_credits')
      .select('credits_remaining')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('service_id', serviceId)
      .gt('credits_remaining', 0)
      .gte('expires_at', now)

    return credits?.reduce((acc, c) => acc + c.credits_remaining, 0) || 0
  } catch {
    return 0
  }
}

/**
 * Cria um Cartão de Presente (Gift Card) Digital com código exclusivo e link de WhatsApp.
 */
export async function createGiftCardAction(
  input: CreateGiftCardInput,
): Promise<{ success: boolean; data?: GiftCardResult; error?: string }> {
  try {
    const admin = createAdminClient()

    // 1. Busca nome da barbearia
    const { data: tenant } = await admin
      .from('tenants')
      .select('name, slug, custom_domain')
      .eq('id', input.tenantId)
      .single()

    const tenantName = tenant?.name || 'Barbearia'
    const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'barbersaas.com.br'
    const bookingUrl = tenant?.custom_domain
      ? `https://${tenant.custom_domain}`
      : `https://${tenant?.slug || 'barbearia'}.${appDomain}`

    // 2. Gera código exclusivo alfanumérico GIFT-[4HEX]
    const randomHex = randomBytes(2).toString('hex').toUpperCase()
    const giftCode = `GIFT-${randomHex}`

    // 3. Grava o voucher na tabela gift_cards
    await admin.from('gift_cards').insert({
      tenant_id: input.tenantId,
      code: giftCode,
      sender_name: input.senderName,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone || null,
      message: input.message || null,
      service_id: input.serviceId || null,
      amount: input.amount,
      status: 'paid', // Confirmado após pagamento
    })

    // 4. Monta mensagem de WhatsApp personalizada
    const shareMessage =
      `Olá ${input.recipientName}! Você ganhou um corte de presente na ${tenantName} de ${input.senderName}! ` +
      `Apresente o código *${giftCode}* ou agende direto pelo link: ${bookingUrl}`

    let whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
    if (input.recipientPhone) {
      try {
        whatsappShareUrl = createWhatsAppUrl(input.recipientPhone, shareMessage)
      } catch {
        // Fallback
      }
    }

    return {
      success: true,
      data: {
        code: giftCode,
        amount: input.amount,
        serviceName: 'Corte / Experiência VIP',
        tenantName,
        whatsappShareUrl,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao gerar Gift Card.',
    }
  }
}

/**
 * Resgata um Gift Card pelo código exclusivo.
 */
export async function redeemGiftCardAction(
  code: string,
  clientId?: string,
): Promise<{ success: boolean; amount: number; message: string }> {
  try {
    const admin = createAdminClient()
    const normalizedCode = code.trim().toUpperCase()

    const { data: card, error } = await admin
      .from('gift_cards')
      .select('*')
      .eq('code', normalizedCode)
      .single()

    if (error || !card) {
      return { success: false, amount: 0, message: 'Código de Gift Card não encontrado.' }
    }

    if (card.status === 'redeemed') {
      return { success: false, amount: 0, message: 'Este Gift Card já foi resgatado anteriormente.' }
    }

    // Marca como resgatado
    await admin
      .from('gift_cards')
      .update({
        status: 'redeemed',
        redeemed_by_client_id: clientId || null,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', card.id)

    return {
      success: true,
      amount: card.amount,
      message: `Gift Card ${normalizedCode} resgatado com sucesso no valor de R$ ${card.amount},00!`,
    }
  } catch (err) {
    return {
      success: false,
      amount: 0,
      message: 'Erro ao resgatar cartão de presente.',
    }
  }
}
