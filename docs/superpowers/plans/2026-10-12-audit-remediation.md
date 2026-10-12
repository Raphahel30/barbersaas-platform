# Navalio Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir os achados confirmados da auditoria sem alterar o comportamento funcional legítimo do Navalio.

**Architecture:** Cada risco será tratado por uma mudança mínima e independente, protegida por teste de regressão. Mudanças de banco serão entregues como migrations versionadas e só serão aplicadas remotamente após validação em banco descartável e autorização do gate de produção.

**Tech Stack:** Next.js, TypeScript, Supabase/PostgreSQL, scripts TSX, Playwright.

**Spec:** `docs/audits/2026-10-12-supabase-remote-audit.md`

## Global Constraints

- Preservar multi-tenant, RLS, autenticação, agendamento atômico, pagamentos e logo oficial.
- Não fazer deploy nem aplicar migration remota antes do gate humano.
- Não registrar segredos, tokens ou dados pessoais.
- Uma correção só é validada por teste reproduzível; existência de código significa apenas implementado.
- Registrar incidente, evidência, rollback e risco residual no mesmo PR.

## Review Focus

- Usuário autenticado de tenant A não pode ler dados de tenant B nem `gateway_credentials`.
- Resolução pública por host/slug continua funcionando sem SELECT público na tabela base.
- Aniversário usa `profiles` com `tenant_id` e nunca falha silenciosamente por tabela inexistente.
- Preflight diferencia integração Evolution online de fallback `wa.me` disponível.
- Funções privilegiadas e Storage falham fechados sem quebrar os fluxos legítimos.

---

### Task 1: Proteção da tabela `tenants`

**Files:**
- Create: `supabase/migrations/<timestamp>_restrict_tenant_reads.sql`
- Test: `scripts/test-audit-regressions.ts`

**Interfaces:**
- Consumes: `public.current_tenant_id()`, `public.is_super_admin()` e `public.resolve_tenant_by_host(text,text)`.
- Produces: SELECT autenticado limitado ao tenant atual/master; nenhuma leitura direta anônima da tabela base.

- [x] Escrever teste que falha enquanto a policy irrestrita existir e a migration corretiva não existir.
- [x] Executar `npm run test:audit` e confirmar falha esperada.
- [x] Criar migration que remove policies públicas irrestritas e concede apenas leitura autenticada tenant-scoped/master.
- [x] Executar o teste específico e confirmar passagem.
- [ ] Validar a migration em banco descartável antes de qualquer aplicação remota.
- [ ] Commitar a unidade.

### Task 2: Fonte canônica do aniversário

**Files:**
- Modify: `app/actions/booking.ts`
- Test: `scripts/test-audit-regressions.ts`

**Interfaces:**
- Consumes: `profiles(id, tenant_id, phone, birth_date, full_name)`.
- Produces: identificação tenant-scoped de cliente autenticado ou visitante por telefone.

- [x] Escrever teste que falha ao encontrar `.from('clients')` no fluxo de booking.
- [x] Confirmar a falha esperada.
- [x] Substituir a consulta pela fonte canônica `profiles`, tratando erro explicitamente.
- [ ] Confirmar teste específico e suíte dependente.
- [ ] Commitar a unidade.

### Task 3: Preflight sem falso verde

**Files:**
- Modify: `scripts/preflight-check.ts`
- Test: `scripts/test-audit-regressions.ts`

**Interfaces:**
- Produces: estados distintos para Evolution online, fallback disponível e homologação completa.

- [x] Escrever teste que rejeita fallback `wa.me` como prova de Evolution online ou de sistema 100% pronto.
- [x] Confirmar falha esperada.
- [x] Ajustar títulos, estados e resumo sem executar produção por padrão.
- [ ] Confirmar passagem e revisar que nenhum segredo aparece na saída.
- [ ] Commitar a unidade.

### Task 4: Funções privilegiadas, waitlist e Storage

**Files:**
- Create: migrations SQL específicas, uma por contrato aprovado.
- Modify: testes de segurança e documentação.

**Interfaces:**
- Consumes: grants remotos, policies atuais e consumidores reais do código.
- Produces: grants mínimos, insert público validado/rate-limited e policies explícitas por bucket.

- [x] Mapear corpo, grant e consumidor de cada `SECURITY DEFINER`.
- [ ] Criar testes negativos por papel antes de cada mudança.
- [x] Tratar waitlist sem remover agendamento de visitante (implementação/teste estático; integração pendente).
- [x] Tratar cada bucket separadamente, preservando uploads legítimos (limites locais; matriz real pendente).
- [ ] Validar em banco descartável e registrar riscos residuais.
- [ ] Commitar cada contrato separadamente.

### Task 5: Preço atômico e performance orientada por evidência

**Files:**
- Create: migration de contrato de preço, se compatível com todos os consumidores.
- Create: migrations de índices apenas para consultas comprovadas.
- Modify: testes críticos do booking.

**Interfaces:**
- Produces: preço recalculado/validado no banco e índices associados a consultas reais.

- [x] Enumerar todos os consumidores da RPC e congelar o contrato atual em testes.
- [ ] Criar teste de preço manipulado e concorrência.
- [x] Decidir sobre validação no banco sem duplicar desconto indevidamente (adiada: exige contrato versionado de cotação).
- [x] Triar índices do caminho de booking; medição antes/depois aguarda volume representativo.
- [ ] Executar suíte completa local, Playwright desktop/mobile e teste de migrations.
- [ ] Commitar unidades independentes.

### Task 6: Evidência final e gate remoto

**Files:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/memory/INCIDENTS.md`
- Modify: `docs/memory/DECISIONS.md`
- Modify: `docs/audits/2026-10-12-supabase-remote-audit.md`

- [ ] Registrar cada comando, falha e evidência sanitizada.
- [ ] Rodar typecheck, lint, build, testes críticos e Playwright em Node 20.
- [ ] Revisar diff por segredo, mudança incidental e regressão.
- [ ] Preparar rollback e checklist de aplicação.
- [ ] Parar para autorização antes de migration remota ou deploy.
