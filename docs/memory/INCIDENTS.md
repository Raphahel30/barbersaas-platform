# Memória de incidentes e correções

Este arquivo registra erros para evitar repetição e regressão.

## Formato obrigatório
Para cada incidente:
- ID e data
- Sintoma
- Causa raiz
- Impacto
- Arquivos/fluxos afetados
- Correção
- Commit/PR
- Teste de reprodução
- Evidência de passagem
- Regra preventiva
- Limitações

## ERR-2026-001 — Leitura autenticada irrestrita de tenants
- Data: 2026-10-12
- Status: mitigado no branch; aplicação e teste remoto pendentes.
- Sintoma: policy `Public Read Tenants` aplica `USING (true)` a `authenticated`.
- Causa raiz confirmada: tabela base usada como fonte pública sem projeção de colunas mínimas.
- Impacto: usuário autenticado pode potencialmente ler `gateway_credentials` e dados de outros tenants.
- Evidência: `has_column_privilege('authenticated','public.tenants','gateway_credentials','SELECT') = true`.
- Correção: migration `20261012143000_restrict_tenant_reads.sql` remove as policies públicas irrestritas, limita linhas ao tenant atual/master e remove de `authenticated` o acesso às colunas secretas.
- Teste preventivo: `npm run test:audit` confirma a presença das restrições e a ausência de colunas sensíveis no grant.
- Evidência: teste local passou em 2026-10-12; banco remoto permanece inalterado.
- Rollback: restaurar grants/policy anterior somente se houver regressão comprovada; nunca restaurar acesso a segredos sem projeção segura.
- Risco residual: falta executar tenant A/B em banco descartável e depois conferir os privilégios efetivos no remoto.
- Regra preventiva: tabelas com segredo nunca recebem SELECT público/amplo; usar RPC/view/projeção mínima.

## ERR-2026-002 — Fonte de clientes desconectada
- Data: 2026-10-12
- Status: implementado localmente; integração pendente.
- Sintoma: fluxo de aniversário consulta `public.clients`, tabela inexistente no banco.
- Causa raiz: contrato de dados divergente entre código e schema.
- Impacto: benefício de aniversário/identificação pode falhar silenciosamente.
- Correção: `app/actions/booking.ts` passou a consultar `profiles`, fonte já usada pelo módulo canônico de aniversário, sempre com `tenant_id` e papel `client`.
- Teste preventivo: `npm run test:audit` falha se o booking voltar a consultar `.from('clients')`.
- Evidência: teste local passou em 2026-10-12.
- Risco residual: falta teste de integração com perfis autenticado/visitante em banco descartável.
- Regra preventiva: Graphify/Jev e teste de integração devem verificar cada tabela referenciada pelo código.

## ERR-2026-003 — Preflight pode declarar falso verde
- Data: 2026-10-10
- Status: implementado localmente; execução completa pendente.
- Sintoma: fallback `wa.me` pode ser apresentado como Evolution online; mensagem final afirma “100% pronto” sem executar matriz crítica.
- Causa raiz: checagem de configuração misturada com homologação funcional.
- Correção: fallback `wa.me` agora é alerta separado; o resumo não declara homologação ou prontidão total.
- Teste preventivo: `npm run test:audit` rejeita as mensagens antigas de falso verde.
- Evidência: teste local passou em 2026-10-12.
- Regra preventiva: separar configurado, acessível, testado e homologado.

## ERR-2026-004 — Executor e ambiente impediram verificações completas
- Data/hora: 2026-10-12, durante o primeiro lote de correções.
- Commit/branch: `c5dca5f`, `docs/navalio-orchestration-memory`.
- Ambiente: workspace remoto, Node 24.19.0.
- Sintomas: palavra reservada no script orquestrador; caminho com parênteses sem aspas; `tsx` falhou com `listen EPERM`; `npm ci` ficou sem saída e foi interrompido.
- Esperado: carregar skills, inspecionar arquivos e executar testes TypeScript.
- Obtido: erros de sintaxe/shell/IPC e dependências não instaladas.
- Causa raiz: incompatibilidades do executor e ausência do ambiente Node 20 previsto pelo projeto; nenhuma causa no código do Navalio foi atribuída a essas falhas.
- Tentativas e resultados: variável renomeada; caminho colocado entre aspas; teste convertido para Node puro e passou; instalação interrompida após mais de dois minutos sem saída.
- Correção: `test:audit` não depende mais de `tsx`.
- Teste preventivo: `npm run test:audit` executa com Node puro.
- Risco residual: typecheck, lint, build e testes TypeScript continuam bloqueados até instalação reproduzível em Node 20.
- Status: mitigado; validação completa bloqueada pelo ambiente.

Não apagar registros antigos. Complementar quando novas evidências surgirem.
