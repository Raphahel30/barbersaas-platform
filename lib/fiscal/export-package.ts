import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { getMonthlyFiscalConsolidation, type MonthlyFiscalReport } from '@/lib/fiscal/salao-parceiro'

// CRC32 Table for standard zip generation
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[i] = c
}

function calculateCrc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Cria um arquivo .ZIP padrão (PKZIP 2.0 / STORE) sem dependências externas.
 * Compatível com Windows Explorer, WinRAR, macOS e Linux.
 */
export function createZipBuffer(files: Array<{ filename: string; content: Buffer | string }>): Buffer {
  const fileEntries: Array<{
    filenameBuf: Buffer
    dataBuf: Buffer
    crc: number
    offset: number
    modTime: number
    modDate: number
  }> = []

  const now = new Date()
  const modTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const modDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  const localChunks: Buffer[] = []
  let currentOffset = 0

  for (const file of files) {
    const dataBuf = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, 'utf-8')
    const filenameBuf = Buffer.from(file.filename, 'utf-8')
    const crc = calculateCrc32(dataBuf)

    const localHeader = Buffer.alloc(30)
    localHeader.writeUInt32LE(0x04034b50, 0) // Local file header signature
    localHeader.writeUInt16LE(20, 4) // Version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6) // General purpose bit flag (UTF-8 filename)
    localHeader.writeUInt16LE(0, 8) // Compression method: 0 = Store (No compression)
    localHeader.writeUInt16LE(modTime, 10)
    localHeader.writeUInt16LE(modDate, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(dataBuf.length, 18) // Compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22) // Uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26) // File name length
    localHeader.writeUInt16LE(0, 28) // Extra field length

    fileEntries.push({
      filenameBuf,
      dataBuf,
      crc,
      offset: currentOffset,
      modTime,
      modDate,
    })

    localChunks.push(localHeader, filenameBuf, dataBuf)
    currentOffset += localHeader.length + filenameBuf.length + dataBuf.length
  }

  const centralDirStart = currentOffset
  const centralChunks: Buffer[] = []

  for (const entry of fileEntries) {
    const cdHeader = Buffer.alloc(46)
    cdHeader.writeUInt32LE(0x02014b50, 0) // Central directory header signature
    cdHeader.writeUInt16LE(20, 4) // Version made by
    cdHeader.writeUInt16LE(20, 6) // Version needed to extract
    cdHeader.writeUInt16LE(0x0800, 8) // Bit flag (UTF-8)
    cdHeader.writeUInt16LE(0, 10) // Store
    cdHeader.writeUInt16LE(entry.modTime, 12)
    cdHeader.writeUInt16LE(entry.modDate, 14)
    cdHeader.writeUInt32LE(entry.crc, 16)
    cdHeader.writeUInt32LE(entry.dataBuf.length, 20)
    cdHeader.writeUInt32LE(entry.dataBuf.length, 24)
    cdHeader.writeUInt16LE(entry.filenameBuf.length, 28)
    cdHeader.writeUInt16LE(0, 30) // Extra field length
    cdHeader.writeUInt16LE(0, 32) // Comment length
    cdHeader.writeUInt16LE(0, 34) // Disk number start
    cdHeader.writeUInt16LE(0, 36) // Internal file attributes
    cdHeader.writeUInt32LE(0, 38) // External file attributes
    cdHeader.writeUInt32LE(entry.offset, 42) // Relative offset of local header

    centralChunks.push(cdHeader, entry.filenameBuf)
  }

  const centralDirSize = centralChunks.reduce((acc, b) => acc + b.length, 0)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0) // End of central dir signature
  eocd.writeUInt16LE(0, 4) // Number of this disk
  eocd.writeUInt16LE(0, 6) // Disk where central directory starts
  eocd.writeUInt16LE(fileEntries.length, 8) // Number of central directory records on this disk
  eocd.writeUInt16LE(fileEntries.length, 10) // Total number of central directory records
  eocd.writeUInt32LE(centralDirSize, 12) // Size of central directory
  eocd.writeUInt32LE(centralDirStart, 16) // Offset of start of central directory
  eocd.writeUInt16LE(0, 20) // Comment length

  return Buffer.concat([...localChunks, ...centralChunks, eocd])
}

/**
 * Gera o XML de NFS-e padrão nacional ABRASF correspondente à Cota-Parte Salão
 */
export function generateAbrafsNfseXml(report: MonthlyFiscalReport, tenantDetails: any): string {
  const rpsNumber = `${report.periodYear}${String(report.periodMonth).padStart(2, '0')}01`
  const issueDate = `${report.periodYear}-${String(report.periodMonth).padStart(2, '0')}-28T23:59:59`
  
  const cleanCnpj = (tenantDetails?.document_number || '00000000000100').replace(/\D/g, '')
  const municipalReg = tenantDetails?.municipal_registration || 'ISENTO'
  const salonName = tenantDetails?.name || report.tenantName || 'Barbearia Parceira'

  const serviceValue = report.taxableSalonBase.toFixed(2)
  const deductionsValue = report.totalPartnerQuota.toFixed(2)
  const issRate = 0.035
  const issValue = (report.taxableSalonBase * issRate).toFixed(2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<EnviarLoteRpsEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">
  <LoteRps Id="lote_${rpsNumber}" versao="2.04">
    <NumeroLote>${rpsNumber}</NumeroLote>
    <CpfCnpj>
      <Cnpj>${cleanCnpj}</Cnpj>
    </CpfCnpj>
    <InscricaoMunicipal>${municipalReg}</InscricaoMunicipal>
    <QuantidadeRps>1</QuantidadeRps>
    <ListaRps>
      <Rps>
        <InfDeclaracaoPrestacaoServico Id="rps_${rpsNumber}">
          <Rps>
            <IdentificacaoRps>
              <Numero>${rpsNumber}</Numero>
              <Serie>1</Serie>
              <Tipo>1</Tipo>
            </IdentificacaoRps>
            <DataEmissao>${issueDate}</DataEmissao>
            <Status>1</Status>
          </Rps>
          <Competencia>${report.periodYear}-${String(report.periodMonth).padStart(2, '0')}-01</Competencia>
          <Servico>
            <Valores>
              <ValorServicos>${serviceValue}</ValorServicos>
              <ValorDeducoes>${deductionsValue}</ValorDeducoes>
              <ValorPis>0.00</ValorPis>
              <ValorCofins>0.00</ValorCofins>
              <ValorInss>0.00</ValorInss>
              <ValorIr>0.00</ValorIr>
              <ValorCsll>0.00</ValorCsll>
              <OutrasRetencoes>0.00</OutrasRetencoes>
              <ValorIss>${issValue}</ValorIss>
              <Aliquota>${(issRate * 100).toFixed(2)}</Aliquota>
              <DescontoIncondicionado>0.00</DescontoIncondicionado>
              <DescontoCondicionado>0.00</DescontoCondicionado>
            </Valores>
            <IssRetido>2</IssRetido>
            <ItemListaServico>06.01</ItemListaServico>
            <CodigoCnae>9602501</CodigoCnae>
            <CodigoTributacaoMunicipio>960250100</CodigoTributacaoMunicipio>
            <Discriminacao>NOTA FISCAL DE SERVIÇOS - COTA-PARTE INFRAESTRUTURA E LOCAÇÃO (LEI 13.352/2016 - SALÃO-PARCEIRO)
Competência: ${report.periodLabel}
Receita Bruta do Período: R$ ${report.grossRevenue.toFixed(2)}
Dedução Legal - Cota dos Profissionais-Parceiros: R$ ${report.totalPartnerQuota.toFixed(2)}
Base de Cálculo Tributável Salão: R$ ${report.taxableSalonBase.toFixed(2)}
Repasses efetuados aos respectivos MEIs conforme demonstrativos contábeis anexos.</Discriminacao>
            <CodigoMunicipio>3550308</CodigoMunicipio>
            <ExigibilidadeISS>1</ExigibilidadeISS>
            <MunicipioIncidencia>3550308</MunicipioIncidencia>
          </Servico>
          <Prestador>
            <CpfCnpj>
              <Cnpj>${cleanCnpj}</Cnpj>
            </CpfCnpj>
            <InscricaoMunicipal>${municipalReg}</InscricaoMunicipal>
            <RazaoSocial>${salonName}</RazaoSocial>
          </Prestador>
          <Tomador>
            <IdentificacaoTomador>
              <CpfCnpj>
                <Cnpj>99999999999999</Cnpj>
              </CpfCnpj>
            </IdentificacaoTomador>
            <RazaoSocial>CONSUMIDOR FINAL CONSOLIDADO</RazaoSocial>
          </Tomador>
          <OptanteSimplesNacional>1</OptanteSimplesNacional>
          <IncentivoFiscal>2</IncentivoFiscal>
        </InfDeclaracaoPrestacaoServico>
      </Rps>
    </ListaRps>
  </LoteRps>
</EnviarLoteRpsEnvio>`
}

/**
 * Compila o pacote contábil completo do mês em um arquivo .ZIP pronto para download
 */
export async function generateAccountantMonthlyPackage(
  tenantId: string,
  month: number,
  year: number
): Promise<{ zipBuffer: Buffer; filename: string; report: MonthlyFiscalReport }> {
  const supabase = createAdminClient()

  // 1. Relatório Geral da Lei do Salão-Parceiro
  const report = await getMonthlyFiscalConsolidation(tenantId, month, year)

  // 2. Dados cadastrais do Tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, address, slug')
    .eq('id', tenantId)
    .single()

  // 3. Extrato detalhado de Vendas Brutas e Métodos de Recebimento
  const periodStart = `${year}-${String(month).padStart(2, '0')}-01T00:00:00`
  const lastDay = new Date(year, month, 0).getDate()
  const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59`

  const { data: appointments } = await supabase
    .from('appointments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('starts_at', periodStart)
    .lte('starts_at', periodEnd)
    .order('starts_at', { ascending: true })

  // 4. Fechamentos de caixa / RPPs
  const { data: closings } = await supabase
    .from('cash_closings')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)

  // 5. Despesas e DRE (produtos comprados de fornecedores)
  const { data: purchaseOrders } = await supabase
    .from('purchase_orders')
    .select(`
      id,
      order_number,
      total_cost,
      status,
      created_at,
      supplier:suppliers(corporate_name, tax_document)
    `)
    .eq('tenant_id', tenantId)
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)

  // CSV 1: Extrato de Vendas e Faturamento
  const csvVendasHeader = '\uFEFFID;Data;Hora;Cliente;Telefone;Barbeiro ID;Valor Bruto (R$);Taxa Reserva (R$);Status Pagamento\r\n'
  const csvVendasRows = (appointments || []).map((a: any) => {
    return [
      a.id,
      a.starts_at ? a.starts_at.substring(0, 10) : '',
      a.starts_at ? a.starts_at.substring(11, 16) : '',
      `"${a.guest_name || 'Cliente'}"`,
      a.guest_phone || '',
      `"${a.barber_id}"`,
      Number(a.total_amount || 0).toFixed(2).replace('.', ','),
      Number(a.reservation_fee_paid || a.reservation_fee || 0).toFixed(2).replace('.', ','),
      a.payment_status || 'completed',
    ].join(';')
  }).join('\r\n')
  const csvVendas = csvVendasHeader + csvVendasRows

  // CSV 2: Relatório Discriminado da Lei do Salão-Parceiro (Cotas)
  const csvSalaoHeader = '\uFEFFBarbeiro;CNPJ/CPF MEI;Contrato Assinado;Atendimentos;Faturamento Bruto (R$);Cota Profissional - Repasse MEI (R$);Cota Salão - Infraestrutura (R$)\r\n'
  const csvSalaoRows = report.partnersSummary.map((p: any) => {
    return [
      `"${p.barberName}"`,
      p.taxDocument || 'PENDENTE_MEI',
      p.isRegularized ? 'SIM (REGULAR)' : 'NÃO (PENDENTE)',
      p.appointmentsCount,
      p.grossServicesTotal.toFixed(2).replace('.', ','),
      p.partnerQuotaReceived.toFixed(2).replace('.', ','),
      p.salonQuotaRetained.toFixed(2).replace('.', ','),
    ].join(';')
  }).join('\r\n')
  const csvSalao = csvSalaoHeader + csvSalaoRows

  // CSV 3: Recibos RPP & Fechamentos de Caixa
  const csvRppHeader = '\uFEFFID Fechamento;Período;Data Fechamento;Barbeiro ID;Bruto Gerado (R$);Comissão/Cota (R$);Líquido Repassado (R$)\r\n'
  const csvRppRows = (closings || []).map((c: any) => {
    return [
      c.id,
      c.period || `${c.period_start?.substring(0, 10)} a ${c.period_end?.substring(0, 10)}`,
      c.closed_at ? new Date(c.closed_at).toLocaleDateString('pt-BR') : '',
      `"${c.barber_id}"`,
      Number(c.gross_amount || 0).toFixed(2).replace('.', ','),
      Number(c.commission_amount || 0).toFixed(2).replace('.', ','),
      Number(c.net_transfer_amount || 0).toFixed(2).replace('.', ','),
    ].join(';')
  }).join('\r\n')
  const csvRpp = csvRppHeader + csvRppRows

  // CSV 4: DRE e Despesas com Insumos
  const csvDreHeader = '\uFEFFData;Pedido Compra;Fornecedor;CNPJ Fornecedor;Valor Compra (R$);Status\r\n'
  const csvDreRows = (purchaseOrders || []).map((po: any) => {
    return [
      new Date(po.created_at).toLocaleDateString('pt-BR'),
      po.order_number,
      `"${po.supplier?.corporate_name || 'Fornecedor'}"`,
      po.supplier?.tax_document || '',
      Number(po.total_cost || 0).toFixed(2).replace('.', ','),
      po.status || 'received',
    ].join(';')
  }).join('\r\n')
  const csvDre = csvDreHeader + csvDreRows

  // XML 5: Nota Fiscal de Serviços ABRASF
  const xmlNfse = generateAbrafsNfseXml(report, tenant)

  // Montar Arquivos para o ZIP
  const prefix = `pacote_fiscal_${report.periodYear}_${String(report.periodMonth).padStart(2, '0')}`
  const files = [
    { filename: `${prefix}/01_extrato_vendas_e_recebimentos.csv`, content: csvVendas },
    { filename: `${prefix}/02_demonstrativo_lei_salao_parceiro.csv`, content: csvSalao },
    { filename: `${prefix}/03_recibos_rpp_e_fechamentos_caixa.csv`, content: csvRpp },
    { filename: `${prefix}/04_compras_insumos_e_fornecedores.csv`, content: csvDre },
    { filename: `${prefix}/05_nfse_abrasf_cota_salao.xml`, content: xmlNfse },
  ]

  const zipBuffer = createZipBuffer(files)
  const tenantName = (tenant as any)?.name ? (tenant as any).name.toLowerCase().replace(/\s+/g, '_') : 'barbearia'
  const filename = `${prefix}_${tenantName}.zip`

  return {
    zipBuffer,
    filename,
    report,
  }
}
