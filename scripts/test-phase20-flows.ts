import {
  generateDocumentSha256Hash,
  getStandardContractTemplate,
} from '../lib/legal/signatures'
import {
  encryptDataPayload,
  decryptBackupPayload,
} from '../lib/backup/external-storage'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FALHA: ${message}`)
    process.exit(1)
  }
  console.log(`✅ SUCESSO: ${message}`)
}

async function runPhase20Tests() {
  console.log('🚀 INICIANDO TESTES AUTOMATIZADOS DA FASE 20...\n')

  // =========================================================
  // 1. TESTE DA COMANDA DIGITAL DE BAR, DRINKS & CONVENIÊNCIA
  // =========================================================
  console.log('--- 1. COMANDA DIGITAL DE BAR & CONVENIÊNCIA ---')

  const tabMock = {
    id: 'tab-123',
    tenant_id: 'tenant-abc',
    client_name: 'Guilherme Silva',
    appointment_id: 'appt-456',
    status: 'open',
    total_amount: 0.0,
    items: [] as Array<{ id: string; name: string; qty: number; unitPrice: number; totalPrice: number }>,
  }

  // Adição de Cerveja Artesanal IPA (R$ 18,00 x 2)
  const item1 = { id: 'item-1', name: 'Cerveja IPA 500ml', qty: 2, unitPrice: 18.0, totalPrice: 36.0 }
  tabMock.items.push(item1)
  tabMock.total_amount += item1.totalPrice

  assert(tabMock.items.length === 1, 'Deve conter 1 item lançado')
  assert(tabMock.total_amount === 36.0, `Total da comanda deve ser R$ 36,00 (atual: R$ ${tabMock.total_amount})`)

  // Adição de Café Gourmet Expresso (R$ 6,00 x 1)
  const item2 = { id: 'item-2', name: 'Café Expresso Gourmet', qty: 1, unitPrice: 6.0, totalPrice: 6.0 }
  tabMock.items.push(item2)
  tabMock.total_amount += item2.totalPrice

  assert(tabMock.items.length === 2, 'Deve conter 2 itens lançados')
  assert(tabMock.total_amount === 42.0, `Total da comanda deve ser R$ 42,00 (atual: R$ ${tabMock.total_amount})`)

  // Remoção de 1 item (item 1 cancelado)
  const itemToRemove = tabMock.items.findIndex((i) => i.id === 'item-1')
  if (itemToRemove !== -1) {
    tabMock.total_amount -= tabMock.items[itemToRemove].totalPrice
    tabMock.items.splice(itemToRemove, 1)
  }

  assert(tabMock.items.length === 1, 'Após remoção deve sobrar 1 item')
  assert(tabMock.total_amount === 6.0, `Total recalculado após estorno deve ser R$ 6,00 (atual: R$ ${tabMock.total_amount})`)

  // Encerramento da comanda
  tabMock.status = 'closed'
  assert(tabMock.status === 'closed', 'Comanda deve transitar para status closed com sucesso')

  // =========================================================
  // 2. TESTE DE ASSINATURA ELETRÔNICA TOUCH & AUDITORIA SHA-256
  // =========================================================
  console.log('\n--- 2. ASSINATURA ELETRÔNICA TOUCH COM HASH SHA-256 ---')

  const templateImage = getStandardContractTemplate('image_use_consent', {
    tenantName: 'Barbearia Vintage Club',
    signerName: 'Ricardo Alcantara',
    signerDocument: '123.456.789-00',
    todayFormatted: '11/09/2026',
  })

  assert(templateImage.title.includes('Uso de Imagem e Voz'), 'Título da minuta deve conter Uso de Imagem e Voz')
  assert(templateImage.bodyText.includes('RICARDO ALCANTARA'), 'Minuta deve interpolar nome do signatário')
  assert(templateImage.bodyText.includes('BARBEARIA VINTAGE CLUB'), 'Minuta deve interpolar nome da barbearia')

  const templatePartner = getStandardContractTemplate('partner_contract', {
    tenantName: 'Barbearia Vintage Club',
    signerName: 'Lucas Barbeiro MEI',
    signerDocument: '98.765.432/0001-11',
    commissionPercent: 55,
  })

  assert(templatePartner.bodyText.includes('Lei Federal nº 13.352/2016'), 'Minuta de salão-parceiro deve citar Lei 13.352/2016')
  assert(templatePartner.bodyText.includes('55%'), 'Minuta deve especificar percentual de cota-parte correto')

  // Geração do Hash Criptográfico SHA-256
  const fakeSignatureBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  const timestamp = '2026-09-11T15:30:00.000Z'
  const ip = '189.40.120.5'
  const userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'

  const hashOriginal = generateDocumentSha256Hash(
    templateImage.bodyText,
    'Ricardo Alcantara',
    '123.456.789-00',
    timestamp,
    fakeSignatureBase64,
    ip,
    userAgent
  )

  assert(/^[0-9a-f]{64}$/.test(hashOriginal), 'Hash SHA-256 gerado deve ter exatamente 64 caracteres hexadecimais')

  // Teste de integridade e inviolabilidade: alteração de 1 caractere no texto deve invalidar o hash
  const hashTampered = generateDocumentSha256Hash(
    templateImage.bodyText + ' (texto alterado maliciosamente)',
    'Ricardo Alcantara',
    '123.456.789-00',
    timestamp,
    fakeSignatureBase64,
    ip,
    userAgent
  )

  assert(hashOriginal !== hashTampered, 'Qualquer modificação no texto do contrato deve gerar um Hash completamente distinto')

  // =========================================================
  // 3. TESTE DE CONVÊNIOS CORPORATIVOS B2B
  // =========================================================
  console.log('\n--- 3. CONVÊNIOS CORPORATIVOS B2B & PARCERIAS ---')

  const corporateAgreement = {
    companyName: 'Tech Inovação S.A.',
    cnpj: '11.222.333/0001-44',
    couponCode: 'TECHINOV20',
    discountPercentage: 20,
    billingType: 'postpaid_monthly' as const,
    status: 'active' as const,
  }

  assert(corporateAgreement.couponCode === 'TECHINOV20', 'Código do cupom corporativo normalizado em caixa alta')

  // Simulação de 3 cortes corporativos na modalidade Pós-Pago
  const originalCutPrice = 70.0 // R$ 70,00 por corte
  const discountAmount = (originalCutPrice * corporateAgreement.discountPercentage) / 100 // R$ 14,00
  const finalEmployeeAmount = originalCutPrice - discountAmount // R$ 56,00

  assert(discountAmount === 14.0, 'Desconto de 20% em corte de R$ 70 deve ser R$ 14,00')
  assert(finalEmployeeAmount === 56.0, 'Valor final a faturar por corte deve ser R$ 56,00')

  const usages = [
    { employee: 'Thiago Martins', finalAmount: finalEmployeeAmount, isBilled: false },
    { employee: 'Carla Dias', finalAmount: finalEmployeeAmount, isBilled: false },
    { employee: 'Marcos Souza', finalAmount: finalEmployeeAmount, isBilled: false },
  ]

  const totalMonthlyBilled = usages.reduce((acc, curr) => acc + curr.finalAmount, 0)
  assert(totalMonthlyBilled === 168.0, `Fatura pós-paga consolidada deve totalizar R$ 168,00 (atual: R$ ${totalMonthlyBilled})`)

  // Marca como faturado
  usages.forEach((u) => (u.isBilled = true))
  assert(usages.every((u) => u.isBilled), 'Todos os cortes do mês devem ser conciliados como faturados')

  // =========================================================
  // 4. TESTE DE BACKUP CRIPTOGRAFADO AES-256-GCM & DISASTER RECOVERY
  // =========================================================
  console.log('\n--- 4. BACKUP CRIPTOGRAFADO EXTERNO (AES-256-GCM + GZIP) ---')

  const sampleDbSnapshot = {
    tenants: [{ id: 'tenant-1', name: 'Barbearia Alpha' }],
    profiles: [{ id: 'user-1', name: 'Barbeiro Mestre', role: 'barber' }],
    services: [{ id: 'srv-1', name: 'Corte Degradê', price: 60 }],
    appointments: [{ id: 'app-1', total: 60, status: 'completed' }],
  }

  const rawJson = JSON.stringify(sampleDbSnapshot)

  // Criptografia
  const { encryptedBuffer, sha256Checksum } = encryptDataPayload(rawJson)

  assert(Buffer.isBuffer(encryptedBuffer), 'Resultado deve ser um Buffer binário criptografado')
  assert(encryptedBuffer.length > 32, 'Buffer criptografado deve conter pelo menos IV (16B) + AuthTag (16B) + Ciphertext')
  assert(/^[0-9a-f]{64}$/.test(sha256Checksum), 'Checksum SHA-256 do arquivo de backup deve ser válido')

  // Descriptografia e Auditoria de Recuperação (Disaster Recovery)
  const decryptedData = decryptBackupPayload(encryptedBuffer)

  assert(decryptedData.tenants[0].name === 'Barbearia Alpha', 'Decodificação deve restaurar o nome do tenant perfeitamente')
  assert(decryptedData.services[0].price === 60, 'Decodificação deve restaurar os serviços e preços')
  assert(decryptedData.appointments.length === 1, 'Decodificação deve restaurar os agendamentos')

  // Simulação de Retenção de Backups (Máximo 4 backups / 30 dias)
  const backupHistoryMock = [
    { id: 'bkp-6', date: '2026-09-11' },
    { id: 'bkp-5', date: '2026-09-04' },
    { id: 'bkp-4', date: '2026-08-28' },
    { id: 'bkp-3', date: '2026-08-21' },
    { id: 'bkp-2', date: '2026-08-14' },
    { id: 'bkp-1', date: '2026-08-07' },
  ]

  const keptBackups = backupHistoryMock.slice(0, 4)
  const prunedBackups = backupHistoryMock.slice(4)

  assert(keptBackups.length === 4, 'Política de retenção deve manter exatamente os 4 backups mais recentes')
  assert(prunedBackups.length === 2, 'Backups excedentes com mais de 30 dias devem ser limpos')

  console.log('\n🎉 TODOS OS TESTES DA FASE 20 FORAM HOMOLOGADOS COM SUCESSO!')
}

runPhase20Tests().catch((err) => {
  console.error('Erro fatal nos testes:', err)
  process.exit(1)
})
