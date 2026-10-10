# Regras obrigatórias do Navalio SaaS

Antes de qualquer alteração, leia este arquivo e os documentos em `docs/`.

## Regras
1. Trabalhar exclusivamente no Navalio SaaS.
2. Nunca alterar produção, Supabase remoto ou deploy sem autorização explícita.
3. Antes de editar, registrar branch, commit, status e arquivos afetados.
4. Preservar multi-tenant, RLS, autenticação, agendamento atômico, pagamentos e logo oficial.
5. Não refatorar incidentalmente módulos funcionais.
6. Cada correção deve incluir teste pertinente ou justificar por que o teste não é possível.
7. Atualizar a memória de incidentes e o estado do projeto no mesmo PR.
8. Status válidos: planejado, implementado, validado, estabilizado, publicado.
9. “Implementado” não significa “validado”.
10. Nunca registrar segredos, tokens ou dados pessoais.

## Documentos canônicos
- `docs/PROJECT_STATE.md`
- `docs/ROADMAP.md`
- `docs/memory/INCIDENTS.md`
- `docs/memory/DECISIONS.md`
- `docs/PROTECTED_MODULES.md`
