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
- Status: aberto, não corrigido.
- Sintoma: policy `Public Read Tenants` aplica `USING (true)` a `authenticated`.
- Causa raiz confirmada: tabela base usada como fonte pública sem projeção de colunas mínimas.
- Impacto: usuário autenticado pode potencialmente ler `gateway_credentials` e dados de outros tenants.
- Evidência: `has_column_privilege('authenticated','public.tenants','gateway_credentials','SELECT') = true`.
- Correção: pendente de migration local, teste tenant A/B e aprovação.
- Regra preventiva: tabelas com segredo nunca recebem SELECT público/amplo; usar RPC/view/projeção mínima.

## ERR-2026-002 — Fonte de clientes desconectada
- Data: 2026-10-12
- Status: aberto, não corrigido.
- Sintoma: fluxo de aniversário consulta `public.clients`, tabela inexistente no banco.
- Causa raiz: contrato de dados divergente entre código e schema.
- Impacto: benefício de aniversário/identificação pode falhar silenciosamente.
- Correção: pendente de decisão da fonte canônica e teste.
- Regra preventiva: Graphify/Jev e teste de integração devem verificar cada tabela referenciada pelo código.

## ERR-2026-003 — Preflight pode declarar falso verde
- Data: 2026-10-10
- Status: aberto, documentado.
- Sintoma: fallback `wa.me` pode ser apresentado como Evolution online; mensagem final afirma “100% pronto” sem executar matriz crítica.
- Causa raiz: checagem de configuração misturada com homologação funcional.
- Correção: pendente.
- Regra preventiva: separar configurado, acessível, testado e homologado.

Não apagar registros antigos. Complementar quando novas evidências surgirem.
