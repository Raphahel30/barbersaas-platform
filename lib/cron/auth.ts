export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET

  // Em desenvolvimento, permite se não houver segredo configurado
  if (!secret && process.env.NODE_ENV === 'development') {
    return true
  }

  if (!secret) {
    return false
  }

  // 1. Header Authorization: Bearer <secret>
  const authHeader = req.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) {
    return true
  }

  // 2. Header customizado x-cron-secret
  const xCronSecret = req.headers.get('x-cron-secret')
  if (xCronSecret === secret) {
    return true
  }

  // 3. Query param ?token=<secret>
  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')
    if (token === secret) {
      return true
    }
  } catch {
    // Ignora erro de parse de URL
  }

  return false
}
