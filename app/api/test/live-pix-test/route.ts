import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { recordAuditLog } from '@/lib/logs/audit'
import { createAdminClient } from '@/utils/supabase/admin'

interface AsaasPaymentResponse {
  id: string
  status: string
  value: number
  netValue?: number
  billingType: string
  externalReference?: string
  confirmedDate?: string
  paymentDate?: string
  clientPaymentDate?: string
}

interface AsaasPixQrCodeResponse {
  encodedImage: string
  payload: string
  expirationDate: string
}

/**
 * Helper para obter ou criar um cliente de teste no Asaas
 */
async function getOrCreateAsaasCustomer(
  baseUrl: string,
  apiKey: string,
): Promise<string> {
  const customerEmail = 'homologacao.golive@barbeariaflow.com.br'

  try {
    // 1. Busca se cliente de homologação já existe
    const searchRes = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(customerEmail)}`,
      {
        headers: { access_token: apiKey },
      },
    )

    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        data?: Array<{ id: string }>
      }
      if (searchData.data && searchData.data.length > 0) {
        return searchData.data[0].id
      }
    }

    // 2. Se não existir, cria o cliente de teste
    const createRes = await fetch(`${baseUrl}/customers`, {
      method: 'POST',
      headers: {
        access_token: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Homologacao Go-Live SuperAdmin',
        email: customerEmail,
        cpfCnpj: '00000000191', // CPF/CNPJ de teste aceito pela autorregulamentação
        mobilePhone: '11999999999',
        notificationDisabled: true,
      }),
    })

    if (createRes.ok) {
      const createData = (await createRes.json()) as { id: string }
      return createData.id
    }
  } catch (err) {
    console.warn('[ASAAS_CUSTOMER_WARN] Erro ao buscar/criar cliente:', err)
  }

  return 'cus_live_test_default'
}

/**
 * POST /api/test/live-pix-test
 * Cria uma cobrança Pix real de R$ 1,00 para teste de ponta a ponta.
 * Exclusivo para o Super Admin (rafaelcassu@gmail.com).
 */
export async function POST(request: Request) {
  try {
    // 1. Validação estrita de autorização Super Admin
    const adminAuth = await requireSuperAdmin()

    const asaasKey = process.env.ASAAS_API_KEY || process.env.ASAAS_API_TOKEN
    const asaasUrl = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '')

    const testReference = `live-test-${Date.now()}`
    const todayStr = new Date().toISOString().split('T')[0]

    // Se chave Asaas estiver presente, executa chamada real de produção
    if (asaasKey && !asaasKey.toLowerCase().includes('mock')) {
      const customerId = await getOrCreateAsaasCustomer(asaasUrl, asaasKey)

      // Cria a cobrança Pix de R$ 1,00
      const paymentRes = await fetch(`${asaasUrl}/payments`, {
        method: 'POST',
        headers: {
          access_token: asaasKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer: customerId,
          billingType: 'PIX',
          value: 1.0,
          dueDate: todayStr,
          description: 'Homologação Go-Live - Micro-Transação Pix R$ 1,00',
          externalReference: testReference,
        }),
      })

      if (!paymentRes.ok) {
        const errText = await paymentRes.text()
        return NextResponse.json(
          {
            error: `Falha na API do Asaas ao criar cobrança Pix: ${paymentRes.status}`,
            details: errText,
          },
          { status: 502 },
        )
      }

      const payment = (await paymentRes.json()) as AsaasPaymentResponse

      // Busca o QR Code e Payload Copia-e-Cola
      const qrRes = await fetch(`${asaasUrl}/payments/${payment.id}/pixQrCode`, {
        headers: { access_token: asaasKey },
      })

      let qrData: AsaasPixQrCodeResponse = {
        encodedImage: '',
        payload: '',
        expirationDate: '',
      }

      if (qrRes.ok) {
        qrData = (await qrRes.json()) as AsaasPixQrCodeResponse
      }

      // Registra evento na auditoria de segurança
      await recordAuditLog({
        actorEmail: adminAuth.email,
        actorId: adminAuth.userId,
        actorRole: 'super_admin',
        action: 'PIX_LIVE_TEST_CREATED',
        category: 'financial',
        targetId: payment.id,
        details: {
          amount: 1.0,
          reference: testReference,
          provider: 'asaas',
          dueDate: todayStr,
        },
      })

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        amount: 1.0,
        description: 'Homologação Go-Live - Micro-Transação Pix R$ 1,00',
        status: payment.status || 'PENDING',
        qrCodeBase64: qrData.encodedImage
          ? `data:image/png;base64,${qrData.encodedImage}`
          : null,
        qrCodePayload: qrData.payload || null,
        expiresAt: qrData.expirationDate || null,
        externalReference: testReference,
        liveMode: true,
      })
    }

    // Fallback gracioso para ambiente de homologação local / sem chave real plugada
    const mockPaymentId = `pay_mock_${Date.now()}`
    const mockQrPayload = `00020126580014BR.GOV.BCB.PIX0136homologacao-golive@barbeariaflow.com.br52040000530398654041.005802BR5925BARBEARIAFLOW PRODUCAO6009SAO PAULO62070503***6304`

    await recordAuditLog({
      actorEmail: adminAuth.email,
      actorId: adminAuth.userId,
      actorRole: 'super_admin',
      action: 'PIX_LIVE_TEST_SIMULATED',
      category: 'financial',
      targetId: mockPaymentId,
      details: { amount: 1.0, reference: testReference, simulated: true },
    })

    return NextResponse.json({
      success: true,
      paymentId: mockPaymentId,
      amount: 1.0,
      description: 'Homologação Go-Live - Micro-Transação Pix R$ 1,00 (Ambiente Local/Simulado)',
      status: 'PENDING',
      qrCodeBase64: null,
      qrCodePayload: mockQrPayload,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      externalReference: testReference,
      liveMode: false,
      notice: 'Chave ASAAS_API_KEY de produção não detectada. Exibindo payload simulado para homologação de tela.',
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Acesso restrito ao Super Admin ou falha interna na homologação Pix.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 403 },
    )
  }
}

/**
 * GET /api/test/live-pix-test?paymentId=...
 * Consulta o status em tempo real da micro-transação Pix.
 */
export async function GET(request: Request) {
  try {
    const adminAuth = await requireSuperAdmin()

    const { searchParams } = new URL(request.url)
    const paymentId = searchParams.get('paymentId')

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Parâmetro paymentId é obrigatório.' },
        { status: 400 },
      )
    }

    const asaasKey = process.env.ASAAS_API_KEY || process.env.ASAAS_API_TOKEN
    const asaasUrl = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '')

    // Se for chamada real na API Asaas
    if (asaasKey && !paymentId.startsWith('pay_mock_')) {
      const res = await fetch(`${asaasUrl}/payments/${encodeURIComponent(paymentId)}`, {
        headers: { access_token: asaasKey },
      })

      if (!res.ok) {
        return NextResponse.json(
          { error: `Cobrança não encontrada no Asaas (HTTP ${res.status})` },
          { status: 404 },
        )
      }

      const payment = (await res.json()) as AsaasPaymentResponse
      const isConfirmed = ['RECEIVED', 'CONFIRMED'].includes(payment.status)

      if (isConfirmed) {
        // Registra auditoria de sucesso da homologação
        await recordAuditLog({
          actorEmail: adminAuth.email,
          actorId: adminAuth.userId,
          actorRole: 'super_admin',
          action: 'PIX_LIVE_TEST_CONFIRMED',
          category: 'financial',
          targetId: payment.id,
          details: {
            amount: payment.value,
            status: payment.status,
            paymentDate: payment.paymentDate || payment.confirmedDate,
          },
        })
      }

      return NextResponse.json({
        success: true,
        paymentId: payment.id,
        status: payment.status,
        isConfirmed,
        message: isConfirmed
          ? 'Pagamento Confirmado com Sucesso! Homologação de Produção concluída.'
          : 'Aguardando confirmação do pagamento pelo app bancário...',
        amount: payment.value,
        paidAt: payment.clientPaymentDate || payment.paymentDate || null,
      })
    }

    // Retorno para ID simulado em ambiente local
    return NextResponse.json({
      success: true,
      paymentId,
      status: 'PENDING',
      isConfirmed: false,
      message: 'Aguardando confirmação do pagamento pelo app bancário (Ambiente Simulado)...',
      amount: 1.0,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Acesso restrito ao Super Admin ou falha interna.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 403 },
    )
  }
}
