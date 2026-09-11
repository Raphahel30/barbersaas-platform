import fs from 'node:fs'
import path from 'node:path'

// Carrega .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let val = trimmed.slice(idx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

async function runLivePix() {
  console.log('='.repeat(70))
  console.log('💳 GERANDO COBRANÇA PIX REAL DE R$ 1,00 NO ASAAS (PRODUÇÃO)')
  console.log('='.repeat(70) + '\n')

  const asaasKey = process.env.ASAAS_API_KEY
  const asaasUrl = (process.env.ASAAS_API_URL || 'https://api.asaas.com/v3').replace(/\/$/, '')

  if (!asaasKey) {
    console.error('ASAAS_API_KEY ausente.')
    process.exit(1)
  }

  // 1. Obter ou criar customer
  console.log('1. Verificando cliente de teste de homologação no Asaas...')
  const customerEmail = 'rafaelcassu@gmail.com'
  let customerId = ''

  const searchRes = await fetch(`${asaasUrl}/customers?email=${encodeURIComponent(customerEmail)}`, {
    headers: { access_token: asaasKey },
  })

  if (searchRes.ok) {
    const searchData = await searchRes.json() as { data?: Array<{ id: string }> }
    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id
      console.log(`   ↳ Cliente existente encontrado: ${customerId}`)
    }
  }

  if (customerId) {
    // Atualiza com o CPF
    await fetch(`${asaasUrl}/customers/${customerId}`, {
      method: 'POST',
      headers: {
        access_token: asaasKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cpfCnpj: '44793455824',
      }),
    })
  }

  if (!customerId) {
    console.log('   ↳ Criando cliente de teste para Rafael Cassu no Asaas...')
    const createRes = await fetch(`${asaasUrl}/customers`, {
      method: 'POST',
      headers: {
        access_token: asaasKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Rafael Cassu',
        email: customerEmail,
        cpfCnpj: '44793455824',
        notificationDisabled: true,
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      console.error(`Falha ao criar cliente no Asaas: ${errText}`)
      process.exit(1)
    }

    const createData = await createRes.json() as { id: string }
    customerId = createData.id
    console.log(`   ↳ Cliente criado com ID: ${customerId}`)
  }

  // 2. Criar cobrança Pix R$ 5,00 (valor mínimo permitido pela conta Asaas)
  console.log('\n2. Emitindo cobrança Pix de R$ 5,00 (mínimo Asaas)...')
  const todayStr = new Date().toISOString().split('T')[0]
  const extRef = `golive-test-${Date.now()}`

  const paymentRes = await fetch(`${asaasUrl}/payments`, {
    method: 'POST',
    headers: {
      access_token: asaasKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: 'PIX',
      value: 5.00,
      dueDate: todayStr,
      description: 'Homologação BarberSaaS - Micro-Transação Pix R$ 5,00',
      externalReference: extRef,
    }),
  })

  if (!paymentRes.ok) {
    const errText = await paymentRes.text()
    console.error(`Falha ao criar cobrança no Asaas: ${errText}`)
    process.exit(1)
  }

  const paymentData = await paymentRes.json() as { id: string; status: string; value: number }
  console.log(`   ↳ Cobrança criada! ID: ${paymentData.id} (Status: ${paymentData.status})`)

  // 3. Obter QR Code e Payload Copia-e-Cola
  console.log('\n3. Obtendo QR Code e chave Pix Copia-e-Cola...')
  const qrRes = await fetch(`${asaasUrl}/payments/${paymentData.id}/pixQrCode`, {
    headers: { access_token: asaasKey },
  })

  if (!qrRes.ok) {
    const errText = await qrRes.text()
    console.error(`Falha ao obter QR Code do Asaas: ${errText}`)
    process.exit(1)
  }

  const qrData = await qrRes.json() as { payload: string; expirationDate: string; encodedImage: string }

  console.log('\n' + '='.repeat(70))
  console.log('🎉 COBRANÇA PIX R$ 1,00 PRONTA PARA PAGAMENTO!')
  console.log('='.repeat(70))
  console.log(`ID da Transação : ${paymentData.id}`)
  console.log(`Valor           : R$ 1,00`)
  console.log(`Vencimento      : ${todayStr}`)
  console.log(`Expiração Pix   : ${qrData.expirationDate}`)
  console.log('-'.repeat(70))
  console.log('📋 CHAVE PIX COPIA-E-COLA (Cole no app do seu banco no celular):')
  console.log('\n' + qrData.payload + '\n')
  console.log('-'.repeat(70))
  console.log('Para verificar a confirmação do pagamento após pagar, rode:')
  console.log(`npx tsx scripts/check-pix-status.ts ${paymentData.id}`)
  console.log('='.repeat(70) + '\n')

  // Salva script de checagem com o paymentId predefinido
  fs.writeFileSync(
    path.resolve(process.cwd(), 'scripts/check-pix-status.ts'),
    `import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
}

async function check() {
  const paymentId = process.argv[2] || '${paymentData.id}';
  const res = await fetch(\`https://api.asaas.com/v3/payments/\${paymentId}\`, {
    headers: { access_token: process.env.ASAAS_API_KEY || '' },
  });
  const data = await res.json();
  console.log('Status da Cobrança:', data.status);
  if (['RECEIVED', 'CONFIRMED'].includes(data.status)) {
    console.log('✅ PAGAMENTO CONFIRMADO COM SUCESSO! HOMOLOGAÇÃO PIX CONCLUÍDA!');
  } else {
    console.log('⏳ Aguardando confirmação no app bancário...');
  }
}
check();
`
  )
}

runLivePix().catch(console.error)
