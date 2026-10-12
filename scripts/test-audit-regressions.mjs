import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

function testTenantReadHardeningMigration() {
  const migrationDirectory = path.join(root, 'supabase/migrations')
  const migrationName = fs
    .readdirSync(migrationDirectory)
    .find((name) => name.endsWith('_restrict_tenant_reads.sql'))

  assert.ok(migrationName, 'missing restrict_tenant_reads migration')
  const sql = read(`supabase/migrations/${migrationName}`)

  assert.match(sql, /DROP POLICY IF EXISTS "Public Read Tenants" ON public\.tenants/i)
  assert.match(sql, /DROP POLICY IF EXISTS "Public read for tenants by slug or domain" ON public\.tenants/i)
  assert.match(sql, /TO authenticated/i)
  assert.match(sql, /current_tenant_id\(\)|is_super_admin\(\)/i)
  assert.match(sql, /REVOKE SELECT ON TABLE public\.tenants FROM anon, authenticated/i)
  assert.match(sql, /GRANT SELECT \([\s\S]*?\) ON public\.tenants TO authenticated/i)
  assert.doesNotMatch(
    sql.match(/GRANT SELECT \(([\s\S]*?)\) ON public\.tenants TO authenticated/i)?.[1] ?? '',
    /gateway_credentials|asaas_customer_id|asaas_subscription_id|document_number|owner_name/i,
  )
  assert.doesNotMatch(sql, /TO\s+(?:anon\s*,\s*)?authenticated[\s\S]{0,120}USING\s*\(\s*true\s*\)/i)
}

function testBookingUsesCanonicalProfilesTable() {
  const source = read('app/actions/booking.ts')
  assert.doesNotMatch(source, /\.from\(['"]clients['"]\)/)
  assert.match(source, /\.from\(['"]profiles['"]\)/)
}

function testPreflightDoesNotClaimFalseGreen() {
  const source = read('scripts/preflight-check.ts')
  assert.doesNotMatch(source, /Fallback wa\.me sempre ativo e pronto/i)
  assert.doesNotMatch(source, /100% PRONTO PARA PRODUÇÃO/i)
}

const tests = [
  ['tenant reads are hardened by migration', testTenantReadHardeningMigration],
  ['booking uses profiles as the canonical client source', testBookingUsesCanonicalProfilesTable],
  ['preflight does not report fallback as full readiness', testPreflightDoesNotClaimFalseGreen],
]

let failed = 0
for (const [name, test] of tests) {
  try {
    test()
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error instanceof Error ? error.message : String(error))
  }
}

if (failed > 0) process.exit(1)
