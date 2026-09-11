import { generateBarberICalFeed } from '@/lib/calendar/sync'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ barberId: string }> }
) {
  const { barberId } = await params
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!barberId || !token) {
    return new Response('Acesso não autorizado: Parâmetros barberId e token são obrigatórios.', {
      status: 401,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  const result = await generateBarberICalFeed(barberId, token)

  if (!result.success || !result.icsContent) {
    return new Response(result.message || 'Não autorizado.', {
      status: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return new Response(result.icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="barber-agenda.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  })
}
