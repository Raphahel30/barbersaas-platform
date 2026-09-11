import fs from 'node:fs'
import path from 'node:path'

// Função auxiliar para carregar .env.local ou .env caso não estejam no process.env
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const equalsIndex = trimmed.indexOf('=')
    if (equalsIndex === -1) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    let val = trimmed.slice(equalsIndex + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = val
    }
  }
}

// Carrega arquivos locais se existirem
loadEnvFile(path.resolve(process.cwd(), '.env.local'))
loadEnvFile(path.resolve(process.cwd(), '.env'))

interface ValidationRule {
  name: string
  required: boolean
  description: string
  validator?: (val: string) => boolean | string
}

const EXPECTED_MASTER_EMAIL = 'rafaelcassu@gmail.com'

const rules: ValidationRule[] = [
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'URL do projeto Supabase',
    validator: (val) => {
      try {
        const parsed = new URL(val)
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? true
          : 'A URL do Supabase deve iniciar com http:// ou https://'
      } catch {
        return 'URL inválida.'
      }
    },
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Chave anônima pública do Supabase',
    validator: (val) => val.length >= 20 || 'Chave anônima excessivamente curta.',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Chave administrativa secreta (Service Role) do Supabase',
    validator: (val) => val.length >= 20 || 'Service role key excessivamente curta.',
  },
  {
    name: 'ASAAS_API_KEY',
    required: true,
    description: 'Chave de API do Asaas para cobrança de assinaturas do SaaS',
    validator: (val) => val.length >= 10 || 'Chave de API do Asaas inválida.',
  },
  {
    name: 'ASAAS_WEBHOOK_TOKEN',
    required: true,
    description: 'Token de autenticação de Webhook do Asaas',
    validator: (val) => val.length >= 8 || 'Token de webhook do Asaas inválido.',
  },
  {
    name: 'CRON_SECRET',
    required: true,
    description: 'Segredo de autenticação para as rotas /api/cron/*',
    validator: (val) => val.length >= 12 || 'CRON_SECRET deve ter ao menos 12 caracteres.',
  },
  {
    name: 'MASTER_ADMIN_EMAIL',
    required: false,
    description: 'E-mail do administrador master da plataforma SaaS',
    validator: (val) => {
      if (val.trim().toLowerCase() !== EXPECTED_MASTER_EMAIL) {
        return `O e-mail master deve ser obrigatoriamente '${EXPECTED_MASTER_EMAIL}'.`
      }
      return true
    },
  },
]

function runValidation() {
  console.log('=================================================================')
  console.log('🔍 VALIDANDO VARIÁVEIS DE AMBIENTE PARA PRODUÇÃO')
  console.log('=================================================================\n')

  let hasErrors = false
  const errors: string[] = []
  const warnings: string[] = []

  for (const rule of rules) {
    // Fallback para anon key
    let value = process.env[rule.name]
    if (rule.name === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && !value) {
      value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    }

    if (!value || value.trim().length === 0) {
      if (rule.required) {
        hasErrors = true
        errors.push(`❌ [FALTA OBRIGATÓRIA] ${rule.name}: ${rule.description}`)
      } else {
        warnings.push(`⚠️  [OPCIONAL AUSENTE] ${rule.name}: ${rule.description}`)
      }
      continue
    }

    if (rule.validator) {
      const validationResult = rule.validator(value)
      if (validationResult !== true) {
        hasErrors = true
        errors.push(
          `❌ [FORMATO INVÁLIDO] ${rule.name}: ${typeof validationResult === 'string' ? validationResult : 'Falha na validação'}`,
        )
        continue
      }
    }

    const masked = value.length > 8
      ? `${value.slice(0, 4)}...${value.slice(-4)}`
      : '********'
    console.log(`✅ ${rule.name.padEnd(30)} Configurada com sucesso (${masked})`)
  }

  if (warnings.length > 0) {
    console.log('\n--- AVISOS ---')
    warnings.forEach((w) => console.log(w))
  }

  if (hasErrors) {
    console.error('\n=================================================================')
    console.error('🚫 ERROS CRÍTICOS DETECTADOS NAS VARIÁVEIS DE AMBIENTE')
    console.error('=================================================================')
    errors.forEach((e) => console.error(e))
    console.error('\nO build ou deploy foi interrompido. Configure as variáveis no painel (Vercel/Hosting) ou no arquivo .env.local.')
    process.exit(1)
  }

  console.log('\n=================================================================')
  console.log('🎉 TODAS AS VARIÁVEIS CRÍTICAS FORAM VALIDADAS COM SUCESSO!')
  console.log('=================================================================\n')
}

runValidation()
