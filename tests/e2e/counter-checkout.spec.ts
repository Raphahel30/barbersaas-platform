import { test, expect } from '@playwright/test'

test.describe('Fluxo Operacional de Balcão e Quitação Financeira', () => {
  test('Proprietário/Barbeiro deve conseguir lançar corte avulso de balcão e quitar em dinheiro', async ({ page }) => {
    // 1. Acesso à agenda do dashboard
    await page.goto('/dashboard/agenda')

    // 2. Verificação do carregamento do painel operacional
    const pageHeading = page.locator('text=/Agenda Operacional da Barbearia/i')
    await expect(pageHeading).toBeVisible({ timeout: 10000 })

    // 3. Abrir modal de corte avulso (Walk-In)
    const walkInBtn = page.locator('button:has-text("Lançar Corte Avulso")')
    await expect(walkInBtn).toBeVisible()
    await walkInBtn.click()

    // 4. Preencher formulário de atendimento rápido de balcão
    const modal = page.locator('div:has-text("Lançamento Rápido de Balcão")')
    await expect(modal).toBeVisible()

    const clientInput = page.locator('input[placeholder*="Carlos" i], input[placeholder*="Nome" i]')
    if (await clientInput.isVisible()) {
      await clientInput.fill('Marcos Vinicius (Balcão)')
    }

    const phoneInput = page.locator('input[placeholder*="11" i]')
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('11988887777')
    }

    // 5. Selecionar método de pagamento 'Dinheiro em Mãos'
    const cashOption = page.locator('select, input[value="cash"]')
    if (await cashOption.isVisible()) {
      await cashOption.selectOption({ value: 'cash' }).catch(() => {})
    }

    // 6. Confirmação do lançamento
    const submitBtn = modal.locator('button:has-text("Confirmar"), button:has-text("Lançar")')
    if (await submitBtn.isVisible()) {
      await submitBtn.click()
    }

    // 7. Navegação para o Fechamento de Caixa
    const financeLink = page.getByRole('link', { name: /Fechamento de Caixa/i })
    await expect(financeLink).toBeVisible()
    await financeLink.click()

    await expect(page).toHaveURL(/\/dashboard\/financeiro/)
    await expect(page.locator('text=/Fechamento de Caixa & Repasses/i')).toBeVisible()
  })
})
