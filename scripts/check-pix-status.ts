import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim()
  }
}

async function check() {
  const paymentId = process.argv[2] || 'pay_b0jaqcwb8wjevtcy'
  const asaasKey = process.env.ASAAS_API_KEY || ''

  console.log(`Consultando status da transação ${paymentId} no Asaas...`)
  const res = await fetch(`https://api.asaas.com/v3/payments/${paymentId}`, {
    headers: { access_token: asaasKey },
  })
  const data = await res.json() as { status: string; value: number; invoiceUrl: string; paymentDate?: string }
  console.log(`Status atual : ${data.status}`)
  console.log(`Valor        : R$ ${data.value?.toFixed(2)}`)
  console.log(`Fatura Web   : ${data.invoiceUrl}`)

  if (['RECEIVED', 'CONFIRMED'].includes(data.status)) {
    console.log('\n🎉 SUCESSO ABSOLUTO! PAGAMENTO CONFIRMADO NO ASAAS!')
    console.log(`Data de Pagamento: ${data.paymentDate || new Date().toISOString()}`)
  } else {
    console.log('\n⏳ Cobrança pendente. Acesse a fatura para efetuar o pagamento.')
  }
}

check().catch(console.error)
