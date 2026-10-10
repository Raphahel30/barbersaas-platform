# Prompt mestre — Antigravity + Graphify + Jev — Navalio SaaS

Você está trabalhando EXCLUSIVAMENTE no repositório Navalio SaaS (`Raphahel30/barbersaas-platform`). Leia integralmente, nesta ordem:

1. `AGENTS.md`
2. `docs/PROJECT_STATE.md`
3. `docs/ROADMAP.md`
4. `docs/PROTECTED_MODULES.md`
5. `docs/memory/INCIDENTS.md`
6. `docs/memory/DECISIONS.md`
7. `docs/orchestration/EXECUTION_SEQUENCE.md`
8. `MASTER_PROMPT.md`
9. planos e especificações relacionados à tarefa

## Missão
Auditar, corrigir e validar uma etapa por vez, com menor alteração possível e evidência reproduzível. Não confunda presença de código com funcionamento.

## Proibições
- Não fazer deploy.
- Não alterar Supabase remoto, migrations aplicadas, secrets, DNS ou webhooks reais sem autorização explícita.
- Não executar comandos destrutivos, reset hard, force push ou apagar trabalho local.
- Não expor tokens, service role, dados pessoais ou payloads reais.
- Não desativar RLS, testes ou validações para obter resultado verde.
- Não criar fallback não atômico ou policy ampla para “fazer funcionar”.
- Não refatorar módulos protegidos fora do escopo.
- Não marcar concluído sem teste e evidência.

## Início obrigatório
Mostre antes de editar:
- branch, HEAD, remotes e `git status`;
- versão de Node, npm, Supabase CLI, Graphify e Jev;
- arquivos e fluxos que serão analisados;
- riscos e dependências;
- o que é local, teste, remoto e produção.

Se a pasta local divergir do GitHub ou houver alterações não commitadas, PARE e produza relatório de reconciliação. Não sobrescreva.

## Uso obrigatório do Graphify
1. Indexe o commit atual sem modificar código.
2. Gere o mapa: página/componente → ação/API → biblioteca → Supabase/RPC → tabela/policy → retorno.
3. Liste comunidades, dependências, ciclos, código órfão, consumidores ausentes e caminhos duplicados.
4. Para cada conclusão, cite arquivo, símbolo e aresta/caminho correspondente.
5. Marque incerteza quando a ligação for dinâmica, por variável de ambiente, webhook ou SQL remoto.
6. Salve um resumo versionado; não trate contagem de nós como prova de correção.

## Uso obrigatório do Jev
Use o Jev depois do grafo para testar hipóteses e procurar desconexões. Para cada consulta registre:
- pergunta;
- contexto/arquivos fornecidos;
- resposta;
- nível de confiança;
- evidência confirmada no código;
- contradições;
- próxima verificação.
Jev não decide sozinho. Se contradizer o Graphify, investigue a origem e não escolha a resposta mais conveniente.

## Ciclo por tarefa
1. **Auditar:** trace o fluxo completo e reproduza o problema.
2. **Explicar:** causa raiz, impacto, módulos dependentes e risco de regressão.
3. **Propor:** menor correção, testes e rollback.
4. **Esperar aprovação** quando houver mudança de regra, banco remoto, integração, deploy ou escopo protegido.
5. **Testar primeiro:** criar ou identificar teste que falha pelo motivo esperado.
6. **Implementar:** mudança mínima, backend como fonte de verdade.
7. **Verificar:** teste específico, dependentes, typecheck/lint/build quando aplicável.
8. **Registrar:** incidente, decisão, estado e evidências no mesmo PR.
9. **Revisar diff:** confirmar ausência de secrets, mudanças incidentais e regressões.
10. **Commit pequeno:** mensagem descrevendo uma única unidade lógica.

## Relatório obrigatório de erro
Sempre que um comando, teste ou implementação falhar, mostre e registre:
- ERR-ID;
- data/hora e commit;
- comando/ação;
- resultado esperado;
- resultado obtido;
- trecho mínimo do erro, sem segredo;
- hipótese;
- causa raiz confirmada ou “não confirmada”;
- tentativa realizada;
- efeito da tentativa;
- solução final;
- teste preventivo;
- risco residual.
Nunca esconda tentativa fracassada. Nunca declare causa raiz apenas por coincidência temporal.

## Formato de entrega de cada tarefa
- Status: mapeado / implementado / validado / bloqueado.
- Escopo analisado.
- Fluxo Graphify.
- Consultas Jev e confirmação.
- Causa raiz.
- Arquivos alterados.
- Testes executados com resultados.
- Erros encontrados e ERR-IDs.
- Riscos residuais.
- Atualizações de memória.
- Próximo passo.
- Gate humano necessário: sim/não e motivo.

Comece apenas pela etapa solicitada. Se nenhuma for informada, execute a Etapa 0 e a auditoria somente leitura da Etapa 1. Pare antes de implementar.
