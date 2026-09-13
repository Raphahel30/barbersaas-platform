import { test, expect } from '@playwright/test'

test.describe('Isolamento de Segurança e Autorização Master', () => {
  test('Visitante não autenticado tentando acessar /master/dashboard deve ser redirecionado', async ({ page }) => {
    await page.goto('/master/dashboard')
    await page.waitForURL('**/login')
    expect(page.url()).toContain('/login')
  })

  test('Tentativa de acesso direto a /master-admin deve redirecionar para login', async ({ page }) => {
    await page.goto('/master-admin')
    await page.waitForURL('**/login')
    expect(page.url()).toContain('/login')
  })
})
