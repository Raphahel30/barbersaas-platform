# Regras obrigatórias do Navalio SaaS

Antes de qualquer alteração, leia este arquivo e os documentos canônicos na ordem indicada.

## Regras
1. Trabalhar exclusivamente no Navalio SaaS.
2. Nunca alterar produção, Supabase remoto ou deploy sem autorização explícita.
3. Antes de editar, registrar branch, commit, status e arquivos afetados.
4. Preservar multi-tenant, RLS, autenticação, agendamento atômico, pagamentos e logo oficial.
5. Não refatorar incidentalmente módulos funcionais.
6. Cada correção deve incluir teste pertinente ou justificar por que o teste não é possível.
7. Atualizar a memória de incidentes e o estado do projeto no mesmo PR.
8. Status válidos: planejado, implementado, validado, estabilizado e publicado.
9. “Implementado” não significa “validado”.
10. Nunca registrar segredos, tokens ou dados pessoais.
11. Graphify e Jev produzem hipóteses e mapas; a prova final vem do código, banco ou teste reproduzível.
12. Toda falha deve ser mostrada e registrada conforme o protocolo permanente de erros.

## Ordem obrigatória de leitura
1. `docs/PROJECT_STATE.md`
2. `docs/ROADMAP.md`
3. `docs/PROTECTED_MODULES.md`
4. `docs/memory/INCIDENTS.md`
5. `docs/memory/DECISIONS.md`
6. `docs/memory/ERROR_PROTOCOL.md`
7. `docs/orchestration/EXECUTION_SEQUENCE.md`
8. `docs/orchestration/AUDIT_MATRIX.md`
9. `docs/orchestration/ANTIGRAVITY_MASTER_PROMPT.md`
10. `docs/orchestration/PHASE_PROMPTS.md`
