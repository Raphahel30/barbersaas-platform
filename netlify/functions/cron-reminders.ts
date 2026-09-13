import type { Config } from '@netlify/functions'

export default async function handler() {
  const baseUrl = process.env.URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET || ''

  try {
    const response = await fetch(`${baseUrl}/api/cron/booking-reminders`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    })
    const data = await response.json()
    console.log('[Cron Reminders Netlify] Success:', data)
    return new Response(JSON.stringify(data), { status: response.status })
  } catch (error) {
    console.error('[Cron Reminders Netlify] Failed:', error)
    return new Response(JSON.stringify({ error: 'Cron execution failed' }), { status: 500 })
  }
}

export const config: Config = {
  schedule: '*/15 * * * *',
}
