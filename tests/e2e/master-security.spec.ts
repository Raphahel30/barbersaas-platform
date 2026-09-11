import { test, expect } from '@playwright/test'

test.describe('Isolamento de Segurança e Autorização Master', () => {
  test('Visitante não autenticado tentando acessar /master/dashboard deve ser bloqueado', async ({ page }) => {
    // 1. Tenta acessar diretamente a rota do Super Admin sem autenticação
    const response = await page.goto('/master/dashboard')

    // 2. Deve ser redirecionado para /login ou retornar 404/403
    const currentUrl = page.url()
    const isProtected =
      currentUrl.includes('/login') ||
      response?.status() === 404 ||
      response?.status() === 403 ||
      (await page.locator('text=/Entrar|Login|Não encontrada/i').count()) > 0

    expect(isProtected).toBeTruthy()
  })

  test('Tentativa de acesso direto a /master/analytics deve exigir autenticação de rafaelcassu@gmail.com', async ({ page }) => {
    const response = await page.goto('/master/analytics')

    const currentUrl = page.url()
    const isProtected =
      currentUrl.includes('/login') ||
      response?.status() === 404 ||
      response?.status() === 403 ||
      (await page.locator('text=/Entrar|Login|Não encontrada/i').count()) > 0

    expect(isProtected).toBeTruthy()
  })
})
