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
- Status: dois lotes implementados localmente; validação tenant A/B, banco descartável e aplicação remota pendentes.
- Validar RLS por tenant.
- Validar Master Admin e permissões (fonte única preparada; teste real pendente).
- Conferir storage, RPCs, rate limiting e logs (limites e hardening de waitlist/galeria preparados).
- Testar tentativa de acesso cruzado.

## Fase 3 — Fluxos comerciais
- Agendamento: contrato atual de preço/grants mapeado; ainda faltam teste de preço manipulado em banco descartável, disponibilidade, hold, confirmação, cancelamento e concorrência completos.
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
- Status: bloqueada neste workspace até instalação reproduzível em Node 20.
- Typecheck, lint, build, scripts críticos e Playwright.
- Testes desktop/mobile.
- Evidências e plano de rollback.
- Aprovação explícita antes do deploy.
- Medir índices candidatos com volume representativo; não criar as 57 sugestões automaticamente.

## Fase 6 — Publicação
Somente após aprovação. Validar produção e atualizar este arquivo.
