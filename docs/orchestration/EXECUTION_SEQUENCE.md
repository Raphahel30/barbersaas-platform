# Navalio SaaS — Sequência de auditoria e finalização

> Documento de execução. Nenhuma etapa autoriza deploy, alteração remota ou migration em produção.

## Estados permitidos
- **Não analisado:** ainda não inspecionado.
- **Mapeado:** arquivos e dependências identificados.
- **Implementado:** código existe, mas ainda não foi comprovado em execução.
- **Validado:** teste pertinente executado, com evidência.
- **Estabilizado:** validado, dependências testadas e aprovado para proteção.
- **Publicado:** aplicado no ambiente autorizado e verificado após publicação.
- **Bloqueado:** depende de acesso, credencial, decisão ou ambiente.

Nunca transformar “implementado” em “validado” por interpretação.

## Etapa 0 — Congelamento e reconciliação
**Objetivo:** impedir perda de trabalho local.
**Entrada:** pasta local e GitHub.
**Ações:** registrar branch, HEAD, remotes, status, stash list e diff; comparar local/remoto; identificar commits exclusivos.
**Saída:** baseline escolhido e backup recuperável.
**Parar se:** houver arquivos locais não rastreados, conflitos ou dúvida sobre a versão mais nova.
**Não fazer:** reset, checkout destrutivo, force push ou merge automático.

## Etapa 1 — Inventário com Graphify
**Objetivo:** mapear componentes e ligações reais.
**Escopo:** rotas, Server Actions, APIs, Supabase clients, RPCs, migrations, tabelas, policies, webhooks, jobs, UI e testes.
**Entregáveis:**
- grafo atualizado com versão/data/commit;
- módulos sem entrada, consumidores ou testes;
- caminhos duplicados para a mesma regra;
- chamadas privilegiadas com service role;
- matriz rota → ação → RPC/tabela → retorno → UI;
- relatório de incertezas.
**Gate:** nenhuma correção antes de consolidar o mapa.

## Etapa 2 — Verificação orientada por Jev
**Objetivo:** desafiar conclusões do grafo e encontrar desconexões.
**Perguntas mínimas:**
1. Há frontend sem backend correspondente?
2. Há tabela/RPC sem consumidor real?
3. Há regra calculada no browser e repetida no servidor?
4. Há fallback que contorna atomicidade ou autorização?
5. Há status possíveis no banco que a UI não trata?
6. Há migration sem evidência no remoto?
7. Há fluxo marcado pronto sem teste que prove o resultado?
**Regra:** Jev auxilia a investigação; suas respostas não são prova. Confirmar no código, banco ou teste.

## Etapa 3 — Segurança e multi-tenancy
Ordem:
1. identidade do tenant;
2. autenticação e papéis;
3. RLS;
4. service role;
5. Storage;
6. RPCs SECURITY DEFINER;
7. Master Admin;
8. logs sem PII/segredos.
**Testes obrigatórios:** tenant A/B, anônimo, funcionário, administrador, master e token inválido.
**Gate:** acesso cruzado deve falhar fechado.

## Etapa 4 — Agendamento e concorrência
Fluxo: disponibilidade → seleção → cálculo servidor → RPC atômica → hold/confirmed → pagamento → webhook/polling → expiração/cancelamento → UI.
**Cenários:** fee zero, fee positiva, mensalista, duas reservas simultâneas, mesmo slot, RPC indisponível, token errado, expiração e webhook duplicado.
**Gate:** banco e UI exibem o mesmo estado; nenhuma reserva órfã; saldo nunca negativo.

## Etapa 5 — Financeiro e integrações
- Asaas do SaaS e gateway do tenant separados.
- Idempotência por evento/transação.
- Assinatura/autorização dos webhooks.
- Caixa, comissão, mensalistas e fechamento.
- Evolution/WhatsApp e fallback declarados separadamente.
- Web Push, cron e retentativas.
**Gate:** mocks, sandbox e produção recebem status distintos. Um fallback não pode ser apresentado como integração online.

## Etapa 6 — Produto e operação
- onboarding;
- CRM;
- Builder/preview/publicação;
- serviços e profissionais;
- loja/estoque/consumíveis;
- retenção/campanhas;
- franquia;
- PWA/mobile;
- Master Admin.
**Gate:** cada módulo deve ter fluxo principal, permissão, estado vazio, erro e teste mínimo.

## Etapa 7 — Qualidade local sem deploy
Usar Node 20 e ambiente de teste.
Executar, conforme scripts disponíveis:
- instalação reproduzível;
- typecheck explícito;
- lint funcional;
- build;
- testes críticos;
- validação de ambiente sem consultar produção por padrão;
- Playwright desktop e mobile;
- teste de migrations em banco descartável.
**Gate:** anexar comandos, versões, saída resumida e artefatos de falha.

## Etapa 8 — Candidato e publicação
Criar checklist, rollback e relatório de riscos. Parar para aprovação humana antes de:
- aplicar migration remota;
- alterar secrets;
- configurar webhook real;
- apontar domínio;
- realizar deploy.
Após autorização, validar a produção e registrar o commit publicado.

## Prioridade
P0: vazamento de tenant, perda de dados, cobrança errada, saldo negativo, reserva duplicada.
P1: fluxo comercial quebrado, webhook não idempotente, autorização incompleta.
P2: módulo incompleto, observabilidade e UX de erro.
P3: acabamento visual e otimizações sem impacto funcional.
