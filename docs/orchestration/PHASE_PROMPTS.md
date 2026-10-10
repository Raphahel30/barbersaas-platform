# Prompts sequenciais para o Antigravity

Use um prompt por vez. Não avance se o gate da etapa anterior não estiver atendido.

## Prompt 0 — Reconciliação local/GitHub
Leia o Prompt Mestre. Execute somente leitura. Registre branch, HEAD, remotes, status, arquivos não rastreados, commits à frente/atrás e diferenças entre pasta local e `origin/main`. Não use reset, checkout destrutivo, clean, stash automático, rebase ou merge. Produza uma tabela: item | local | remoto | risco | ação recomendada. Pare para decisão humana se houver qualquer divergência.

## Prompt 1 — Graphify: mapa global
Leia o Prompt Mestre. No commit baseline aprovado, rode o Graphify e mapeie todos os fluxos reais. Entregue: módulos; entradas; saídas; dependências; tabelas/RPCs/policies; rotas/webhooks; testes; nós órfãos; caminhos duplicados; fronteiras de tenant; service role. Para cada achado cite arquivos/símbolos. Não altere código. Salve resumo com commit e versão da ferramenta.

## Prompt 2 — Jev: caça a desconexões
Leia o mapa do Graphify. Use o Jev para desafiar, não repetir, o mapa. Investigue frontend sem persistência, backend sem consumidor, estados não tratados, duplicidade de regra, fallback inseguro, mock tratado como real, ambiente de produção usado em teste e módulo sem teste. Confirme cada resultado no código. Classifique: confirmado, refutado, incerto ou depende do remoto. Não altere código.

## Prompt 3 — Supabase e multi-tenant
Audite migrations locais versus remoto, sem aplicar nada. Liste tabelas, RLS, policies, grants, SECURITY DEFINER, storage e service-role paths. Execute a matriz tenant A/B e papéis em ambiente descartável. Entregue migration | remoto | equivalência | ação | risco. Pare antes de qualquer repair, push ou alteração remota.

## Prompt 4 — Agendamento e mensalistas
Trace disponibilidade até UI final. Teste fee 0, fee > 0, mensalista com um corte, duas reservas simultâneas, conflito de slot, RPC falhando, expiração, polling com token e outro tenant. O backend deve ser fonte de preço/status. Sem fallback não atômico. Registre todo erro no protocolo.

## Prompt 5 — Pagamentos e webhooks
Separe cobrança do SaaS, cobrança do tenant e caixa. Audite assinatura, idempotência, replay, valor, tenant, status e logs. Use mocks/sandbox, nunca produção sem aprovação. Webhook duplicado não pode duplicar efeitos. Token inválido ou outro tenant deve falhar fechado.

## Prompt 6 — Builder e white-label
Mapeie rascunho, preview, mídia, publicação, domínio e storefront. Teste autorização, isolamento, dados vazios, falha de upload, troca de tenant e rollback de publicação. Preserve a logo oficial. Não conceda Storage amplo para corrigir upload.

## Prompt 7 — CRM, operação e Master Admin
Audite clientes, profissionais, serviços, mensalistas, caixa, comissões, estoque, campanhas, franquia e Master Admin. Para cada módulo mostre CRUD real, permissão, isolamento, estados de erro e testes. Marque como não certificado o que for somente interface ou schema.

## Prompt 8 — Testes locais sem deploy
Use Node 20 e banco descartável. Rode instalação reproduzível, typecheck, lint, build, testes críticos e Playwright desktop/mobile. Não execute preflight contra produção por padrão. Liste falhas com ERR-ID e artefatos. Corrija somente a causa da etapa aprovada.

## Prompt 9 — Candidato final
Consolide evidências: commit, migrations, testes, riscos, variáveis necessárias, procedimentos manuais e rollback. Não publique. Gere checklist de autorização humana para Supabase, secrets, webhooks, domínio e hospedagem.
