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

function findMigration(suffix) {
  const migrationDirectory = path.join(root, 'supabase/migrations')
  const migrationName = fs.readdirSync(migrationDirectory).find((name) => name.endsWith(suffix))
  assert.ok(migrationName, `missing ${suffix} migration`)
  return read(`supabase/migrations/${migrationName}`)
}

function testWaitlistCannotBypassServerValidation() {
  const sql = findMigration('_secure_waitlist_access.sql')
  const source = read('app/actions/waitlist.ts')

  assert.match(sql, /DROP POLICY IF EXISTS "waitlist public insert" ON public\.waitlist/i)
  assert.match(sql, /REVOKE INSERT ON TABLE public\.waitlist FROM anon, authenticated/i)
  assert.match(source, /requireTenantStaff/)
  assert.match(source, /checkDistributedRateLimit/)
  assert.match(source, /\.update\(\{ status: 'claimed' \}\)[\s\S]*?\.select\('id'\)[\s\S]*?\.maybeSingle\(\)/)
}

function testSuperAdminUsesDatabaseRole() {
  const sql = findMigration('_centralize_super_admin_role.sql')

  assert.match(sql, /p\.role\s*=\s*'super_admin'/i)
  assert.doesNotMatch(sql, /rafaelcassu@gmail\.com/i)
  assert.match(sql, /CREATE POLICY "super admin full access"/i)
  assert.match(sql, /public\.is_super_admin\(\)/i)
}

function testGalleryUploadsAreAuthorizedAndBounded() {
  const source = read('app/actions/gallery.ts')

  assert.match(source, /requireTenantStaff\(input\.tenantId\)/)
  assert.match(source, /GALLERY_DATA_URL_PATTERN/)
  assert.match(source, /png\|jpeg\|webp/)
  assert.match(source, /MAX_GALLERY_IMAGE_BYTES/)
  assert.match(source, /storage[\s\S]*?\.from\('barbershop-media'\)[\s\S]*?\.upload\(/)
  assert.match(source, /requireTenantStaff\(tenantId\)/)
}

function testStorageBucketsHaveServerSideLimits() {
  const sql = findMigration('_bound_storage_buckets.sql')

  for (const bucket of ['avatars', 'barbershop-media', 'gallery', 'receipts', 'signatures']) {
    assert.match(sql, new RegExp(`id\\s*=\\s*'${bucket}'`, 'i'))
  }
  assert.match(sql, /file_size_limit/i)
  assert.match(sql, /allowed_mime_types/i)
  assert.doesNotMatch(sql, /SET\s+public\s*=\s*true/i)
}

function testApplicationAuthorizationUsesProfileRole() {
  const guards = read('lib/auth/guards.ts')
  const auth = read('app/actions/auth.ts')
  const schedule = read('app/actions/schedule.ts')

  assert.doesNotMatch(guards, /SUPER_ADMIN_EMAIL|rafaelcassu@gmail\.com/)
  assert.doesNotMatch(auth, /user_metadata\?\.role|SUPER_ADMIN_EMAIL|rafaelcassu@gmail\.com/)
  assert.doesNotMatch(schedule, /rafaelcassu@gmail\.com/)
  assert.match(guards, /profile\.role\s*!==\s*'super_admin'/)
}

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(fullPath)
    return /\.(?:ts|tsx|js|mjs)$/.test(entry.name) ? [fullPath] : []
  })
}

function testBookingPriceBoundaryIsServerControlled() {
  const booking = read('app/actions/booking.ts')
  const inputContract = booking.match(/export type CreateAppointmentHoldInput = \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const appCallers = listSourceFiles(path.join(root, 'app'))
    .filter((file) => fs.readFileSync(file, 'utf8').includes("rpc('create_appointment_hold_atomic'"))
    .map((file) => path.relative(root, file))
  const rpcMigration = read('supabase/migrations/20260913020000_reconcile_and_harden.sql')

  assert.deepEqual(appCallers, ['app/actions/booking.ts'])
  assert.doesNotMatch(inputContract, /totalAmount|reservationFee|price/)
  assert.match(booking, /\.from\('services'\)\.select\('\*'\)/)
  assert.match(booking, /payableCents\s*=\s*servicesResult\.data\.reduce/)
  assert.match(booking, /reservationFeeCents\s*=\s*servicesResult\.data\.reduce/)
  assert.match(rpcMigration, /REVOKE EXECUTE ON FUNCTION public\.create_appointment_hold_atomic\([\s\S]*?FROM PUBLIC, anon, authenticated/i)
  assert.match(rpcMigration, /GRANT EXECUTE ON FUNCTION public\.create_appointment_hold_atomic\([\s\S]*?TO service_role/i)
}

function testPrivilegedOperationalActionsEnforceTenantRoles() {
  const clients = read('app/actions/clients.ts')
  const campaigns = read('app/actions/campaigns.ts')
  const gatewaySplit = read('app/actions/gateways-split.ts')

  assert.match(clients, /requireTenantStaff/)
  assert.equal((clients.match(/await requireTenantStaff\(tenantId\)/g) ?? []).length, 4)
  assert.match(campaigns, /requireTenantOwner/)
  assert.match(campaigns, /await requireTenantOwner\(resolvedTenantId\)/)
  assert.match(campaigns, /await requireCampaignOwnerByQueueId\(queueId\)/)
  assert.match(campaigns, /await requireCampaignOwnerByCampaignId\(campaignId\)/)
  assert.match(gatewaySplit, /getTenantSplitConfigAction[\s\S]*?await requireOwner\(tenantId\)/)
}

function testReferralSummariesEnforceOwnerOrSelfAccess() {
  const growth = read('app/actions/growth.ts')

  assert.match(growth, /getTenantReferralInfo[\s\S]*?await requireTenantOwner\(tenantId\)/)
  assert.match(growth, /getClientReferralInfo[\s\S]*?await requireClientReferralAccess\(tenantId, clientId\)/)
  assert.match(growth, /profile\.role === 'client'[\s\S]*?userId === clientId/)
  assert.match(growth, /requireTenantStaff\(tenantId\)/)
}

const tests = [
  ['tenant reads are hardened by migration', testTenantReadHardeningMigration],
  ['booking uses profiles as the canonical client source', testBookingUsesCanonicalProfilesTable],
  ['preflight does not report fallback as full readiness', testPreflightDoesNotClaimFalseGreen],
  ['waitlist writes cannot bypass server validation', testWaitlistCannotBypassServerValidation],
  ['super admin authorization uses the database role', testSuperAdminUsesDatabaseRole],
  ['gallery uploads are authorized and bounded', testGalleryUploadsAreAuthorizedAndBounded],
  ['storage buckets have server-side size and MIME limits', testStorageBucketsHaveServerSideLimits],
  ['application authorization uses the profile role', testApplicationAuthorizationUsesProfileRole],
  ['booking price boundary is server-controlled', testBookingPriceBoundaryIsServerControlled],
  ['privileged operational actions enforce tenant roles', testPrivilegedOperationalActionsEnforceTenantRoles],
  ['referral summaries enforce owner or self access', testReferralSummariesEnforceOwnerOrSelfAccess],
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
