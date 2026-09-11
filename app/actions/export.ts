'use server'

import { requireOwner } from '@/lib/auth/guards'
import { createAdminClient } from '@/utils/supabase/admin'
import { recordAuditLog } from '@/lib/logs/audit'

export interface ExportTenantDataResult {
  success: boolean
  message: string
  format?: 'json' | 'csv'
  data?: string
  filename?: string
  recordCounts?: {
    clients: number
    services: number
    appointments: number
    closings: number
    sales: number
  }
}

/**
 * Converte um array de objetos simples em formato CSV seguro com escape de delimitadores.
 */
function convertToCSV(rows: Array<Record<string, any>>): string {
  if (rows.length === 0) return ''

  const headers = Object.keys(rows[0])
  const csvLines = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map((header) => {
      let val = row[header]
      if (val === null || val === undefined) return '""'
      if (typeof val === 'object') val = JSON.stringify(val)
      const strVal = String(val).replace(/"/g, '""')
      return `"${strVal}"`
    })
    csvLines.push(values.join(','))
  }

  return csvLines.join('\n')
}

/**
 * Exporta todos os dados operacionais do tenant em conformidade com a LGPD e soberania de dados do barbeiro.
 */
export async function exportTenantData(
  tenantId: string,
  format: 'json' | 'csv' = 'json',
): Promise<ExportTenantDataResult> {
  // 1. Verificação de permissão de acesso (exclusivo para o proprietário da barbearia)
  const user = await requireOwner(tenantId)
  const admin = createAdminClient()

  try {
    // 2. Extração consolidada de dados
    const [
      tenantRes,
      clientsRes,
      servicesRes,
      apptsRes,
      closingsRes,
      productSalesRes,
      counterSalesRes,
    ] = await Promise.all([
      admin
        .from('tenants')
        .select('id, name, slug, address, created_at')
        .eq('id', tenantId)
        .maybeSingle(),
      admin
        .from('profiles')
        .select('id, full_name, email, phone, birth_date, created_at')
        .eq('tenant_id', tenantId)
        .eq('role', 'client'),
      admin
        .from('services')
        .select('id, name, duration_minutes, price, reservation_fee, is_active')
        .eq('tenant_id', tenantId),
      admin
        .from('appointments')
        .select('id, starts_at, ends_at, status, total_amount, reservation_fee_paid, balance_paid_amount, payment_method, payment_status, guest_name, guest_phone, created_at')
        .eq('tenant_id', tenantId)
        .order('starts_at', { ascending: false }),
      admin
        .from('cash_closings')
        .select('id, period, period_start, period_end, gross_amount, commission_amount, cash_in_hand, net_transfer_amount, closed_at')
        .eq('tenant_id', tenantId)
        .order('period_start', { ascending: false }),
      admin
        .from('product_sales')
        .select('id, product_id, quantity, unit_price, total_amount, payment_method, sold_at')
        .eq('tenant_id', tenantId),
      admin
        .from('counter_sales')
        .select('id, total_amount, payment_method, sold_at')
        .eq('tenant_id', tenantId),
    ])

    const tenant = tenantRes.data
    const clients = clientsRes.data ?? []
    const services = servicesRes.data ?? []
    const appointments = apptsRes.data ?? []
    const closings = closingsRes.data ?? []
    const sales = [...(productSalesRes.data ?? []), ...(counterSalesRes.data ?? [])]

    const recordCounts = {
      clients: clients.length,
      services: services.length,
      appointments: appointments.length,
      closings: closings.length,
      sales: sales.length,
    }

    const timestamp = new Date().toISOString().slice(0, 10)
    const slug = tenant?.slug || 'barbearia'

    let exportedContent = ''
    let filename = ''

    if (format === 'json') {
      const sanitizedPayload = {
        meta: {
          platform: 'Barbearia SaaS',
          exportDate: new Date().toISOString(),
          tenantId,
          tenantName: tenant?.name,
          lgpdCompliance: 'Direito à Portabilidade de Dados (Art. 18, V, LGPD)',
        },
        tenant,
        clients,
        services,
        appointments,
        cashClosings: closings,
        sales,
      }

      exportedContent = JSON.stringify(sanitizedPayload, null, 2)
      filename = `backup_${slug}_${timestamp}.json`
    } else {
      // Geração de bundle CSV com seções separadas
      const clientsCsv = convertToCSV(clients)
      const servicesCsv = convertToCSV(services)
      const apptsCsv = convertToCSV(appointments)
      const closingsCsv = convertToCSV(closings)

      exportedContent = [
        '=== 1. CLIENTES CADASTRADOS ===',
        clientsCsv,
        '\n=== 2. CATÁLOGO DE SERVIÇOS ===',
        servicesCsv,
        '\n=== 3. HISTÓRICO DE AGENDAMENTOS ===',
        apptsCsv,
        '\n=== 4. FECHAMENTOS DE CAIXA ===',
        closingsCsv,
      ].join('\n')

      filename = `export_${slug}_${timestamp}.csv`
    }

    // 3. Registrar auditoria de exportação
    await recordAuditLog({
      tenantId,
      actorId: user.userId,
      actorEmail: user.email,
      actorRole: 'owner',
      action: 'tenant_data_exported',
      category: 'security',
      targetId: tenantId,
      details: {
        format,
        recordCounts,
      },
    })

    return {
      success: true,
      message: 'Exportação gerada com sucesso!',
      format,
      data: exportedContent,
      filename,
      recordCounts,
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha ao processar a exportação de dados.',
    }
  }
}
