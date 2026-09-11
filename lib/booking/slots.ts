import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { matchYieldRuleForSlot } from '@/lib/booking/pricing'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type AvailableSlot = Readonly<{
  startsAt: string
  endsAt: string
  localTime: string
  durationMinutes: number
  isPromotional?: boolean
  promotionalBadge?: string | null
  discountAmount?: number
  finalPrice?: number
  finalReservationFee?: number
  requireFullFee?: boolean
}>

type TimeRange = { start: number; end: number }

function parseDate(date: string): { year: number; month: number; day: number; weekday: number } {
  if (!DATE_PATTERN.test(date)) throw new Error('Date must use YYYY-MM-DD format')
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('Invalid calendar date')
  }
  return { year, month, day, weekday: parsed.getUTCDay() }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) throw new Error('Invalid schedule time')
  return hours * 60 + minutes
}

function getTimeZoneOffset(timestamp: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(timestamp)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  const representedAsUtc = Date.UTC(
    Number(values.year), Number(values.month) - 1, Number(values.day),
    Number(values.hour), Number(values.minute), Number(values.second),
  )
  return representedAsUtc - timestamp.getTime()
}

export function zonedDateTimeToUtc(
  date: string,
  minutesAfterMidnight: number,
  timeZone: string,
): Date {
  const { year, month, day } = parseDate(date)
  const hours = Math.floor(minutesAfterMidnight / 60)
  const minutes = minutesAfterMidnight % 60
  const localAsUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes))
  let result = new Date(localAsUtc.getTime() - getTimeZoneOffset(localAsUtc, timeZone))
  result = new Date(localAsUtc.getTime() - getTimeZoneOffset(result, timeZone))
  return result
}

function overlaps(left: TimeRange, right: TimeRange): boolean {
  return left.start < right.end && right.start < left.end
}

function assertIdentifiers(tenantId: string, barberId: string, serviceIds: string[]): void {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(barberId)) {
    throw new Error('Invalid tenant or barber identifier')
  }
  if (serviceIds.length === 0 || serviceIds.some((id) => !UUID_PATTERN.test(id))) {
    throw new Error('At least one valid service is required')
  }
  if (new Set(serviceIds).size !== serviceIds.length) throw new Error('Duplicate services are not allowed')
}

export async function getAvailableSlots(
  tenantId: string,
  barberId: string,
  date: string,
  selectedServiceIds: string[],
): Promise<AvailableSlot[]> {
  assertIdentifiers(tenantId, barberId, selectedServiceIds)
  const parsedDate = parseDate(date)
  const admin = createAdminClient()

  const expiryResult = await admin
    .from('appointments')
    .update({ status: 'expired' })
    .eq('tenant_id', tenantId)
    .eq('barber_id', barberId)
    .eq('status', 'hold')
    .lte('hold_expires_at', new Date().toISOString())
  if (expiryResult.error) throw new Error(`Unable to expire old holds: ${expiryResult.error.message}`)

  const [settingsResult, scheduleResult, holidayResult, servicesResult, yieldRulesResult, timeOffResult] = await Promise.all([
    admin.from('tenant_settings').select('closing_buffer_minutes,timezone').eq('tenant_id', tenantId).single(),
    admin.from('barber_schedules').select('*').eq('tenant_id', tenantId).eq('barber_id', barberId).eq('weekday', parsedDate.weekday).eq('is_active', true).maybeSingle(),
    admin.from('tenant_holidays').select('id').eq('tenant_id', tenantId).eq('holiday_date', date).limit(1),
    admin.from('services').select('id,duration_minutes,cleanup_minutes,price,reservation_fee').eq('tenant_id', tenantId).eq('is_active', true).in('id', selectedServiceIds),
    admin.from('tenant_yield_rules').select('*').eq('tenant_id', tenantId).eq('is_active', true),
    admin.from('barber_time_off').select('id').eq('tenant_id', tenantId).eq('barber_id', barberId).lte('start_date', date).gte('end_date', date).limit(1),
  ])

  const firstError = [settingsResult.error, scheduleResult.error, holidayResult.error, servicesResult.error].find(Boolean)
  if (firstError) throw new Error(`Unable to calculate availability: ${firstError.message}`)
  if (!settingsResult.data) throw new Error('Tenant booking settings were not found')
  if (
    !scheduleResult.data ||
    scheduleResult.data.is_day_off ||
    (holidayResult.data?.length ?? 0) > 0 ||
    (timeOffResult.data?.length ?? 0) > 0
  ) {
    return []
  }
  if ((servicesResult.data?.length ?? 0) !== selectedServiceIds.length) {
    throw new Error('One or more services are unavailable for this tenant')
  }

  const durationMinutes = servicesResult.data!.reduce(
    (total, service) => total + service.duration_minutes + service.cleanup_minutes,
    0,
  )
  const basePriceTotal = servicesResult.data!.reduce((total, service) => total + service.price, 0)
  const baseFeeTotal = servicesResult.data!.reduce((total, service) => total + service.reservation_fee, 0)
  const yieldRules = yieldRulesResult.data ?? []

  const schedule = scheduleResult.data
  const openingMinute = timeToMinutes(schedule.starts_at)
  const lastAllowedEnd = timeToMinutes(schedule.ends_at) - settingsResult.data.closing_buffer_minutes
  if (lastAllowedEnd - openingMinute < durationMinutes) return []

  const dayStart = zonedDateTimeToUtc(date, 0, settingsResult.data.timezone)
  const dayEnd = zonedDateTimeToUtc(date, 24 * 60 - 1, settingsResult.data.timezone)
  dayEnd.setMinutes(dayEnd.getMinutes() + 1)

  const [blockedResult, appointmentsResult] = await Promise.all([
    admin.from('barber_blocked_slots').select('starts_at,ends_at').eq('tenant_id', tenantId).eq('barber_id', barberId).lt('starts_at', dayEnd.toISOString()).gt('ends_at', dayStart.toISOString()),
    admin.from('appointments').select('starts_at,ends_at,status,hold_expires_at').eq('tenant_id', tenantId).eq('barber_id', barberId).in('status', ['scheduled', 'confirmed', 'hold']).lt('starts_at', dayEnd.toISOString()).gt('ends_at', dayStart.toISOString()),
  ])
  if (blockedResult.error || appointmentsResult.error) {
    throw new Error(`Unable to load occupied times: ${(blockedResult.error ?? appointmentsResult.error)!.message}`)
  }

  const now = Date.now()
  const occupied: TimeRange[] = [
    ...(blockedResult.data ?? []).map((item) => ({ start: Date.parse(item.starts_at), end: Date.parse(item.ends_at) })),
    ...(appointmentsResult.data ?? [])
      .filter((item) => item.status !== 'hold' || (item.hold_expires_at !== null && Date.parse(item.hold_expires_at) > now))
      .map((item) => ({ start: Date.parse(item.starts_at), end: Date.parse(item.ends_at) })),
  ]
  const lunch = schedule.break_starts_at && schedule.break_ends_at
    ? { start: timeToMinutes(schedule.break_starts_at), end: timeToMinutes(schedule.break_ends_at) }
    : null
  const slots: AvailableSlot[] = []

  for (let minute = openingMinute; minute + durationMinutes <= lastAllowedEnd; minute += schedule.slot_interval_minutes) {
    const localRange = { start: minute, end: minute + durationMinutes }
    if (lunch && overlaps(localRange, lunch)) continue

    const startsAt = zonedDateTimeToUtc(date, localRange.start, settingsResult.data.timezone)
    const endsAt = zonedDateTimeToUtc(date, localRange.end, settingsResult.data.timezone)
    const utcRange = { start: startsAt.getTime(), end: endsAt.getTime() }
    if (utcRange.start <= now || occupied.some((range) => overlaps(utcRange, range))) continue

    const pricing = matchYieldRuleForSlot(
      yieldRules,
      parsedDate.weekday,
      localRange.start,
      basePriceTotal,
      baseFeeTotal,
    )

    slots.push(Object.freeze({
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      localTime: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      durationMinutes,
      isPromotional: pricing.isPromotional,
      promotionalBadge: pricing.promotionalBadge,
      discountAmount: pricing.discountAmount,
      finalPrice: pricing.finalPrice,
      finalReservationFee: pricing.finalReservationFee,
      requireFullFee: pricing.requireFullFee,
    }))
  }

  return slots
}
