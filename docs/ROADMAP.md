# Navalio SaaS — Roadmap de finalização

## Fase 0 — Reconciliar fontes
Status: pendente da pasta local.
- Comparar branch, HEAD, status e alterações locais com `main`.
- Preservar cópia local antes de sincronizar.
- Definir commit baseline.

## Fase 1 — Auditoria estrutural
Status: parcialmente mapeada remotamente.
- Mapear requisito, código, migration, teste e evidência.
- Identificar lacunas e contratos duplicados.

## Fase 2 — Segurança e isolamento
- Validar RLS por tenant.
- Validar Master Admin e permissões.
- Conferir storage, RPCs, rate limiting e logs.
- Testar tentativa de acesso cruzado.

## Fase 3 — Fluxos comerciais
- Agendamento: disponibilidade, hold, confirmação, cancelamento e concorrência.
- CRM e histórico.
- Mensalistas e consumo de cortes.
- Caixa, pagamentos e fechamentos.
- Builder, publicação e white-label.

## Fase 4 — Integrações
- Webhooks de pagamento.
- WhatsApp/notificações.
- Domínio/Cloudflare.
- PWA e comportamento mobile.

## Fase 5 — Validação candidata
- Typecheck, lint, build, scripts críticos e Playwright.
- Testes desktop/mobile.
- Evidências e plano de rollback.
- Aprovação explícita antes do deploy.

## Fase 6 — Publicação
Somente após aprovação. Validar produção e atualizar este arquivo.
