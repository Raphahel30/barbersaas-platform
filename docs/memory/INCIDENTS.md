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
- Ocorrência adicional: a primeira chamada do orquestrador de skills em 12/10 usou `package` como nome de variável JavaScript e falhou por palavra reservada; a chamada foi refeita com `pkg` e concluiu. Regra preventiva: evitar identificadores reservados em scripts de orquestração.

## ERR-2026-005 — Waitlist expunha dados e mutações entre tenants
- Data: 2026-10-12
- Status: implementado localmente; integração e aplicação remota pendentes.
- Sintoma: leitura e cancelamento usavam o cliente administrativo após apenas confirmar que existia alguma sessão; o insert público aceitava qualquer payload e uma disputa podia reivindicar a mesma oferta.
- Causa raiz: autorização não era vinculada ao tenant e o uso legítimo por visitante foi confundido com acesso irrestrito ao banco.
- Impacto: equipe autenticada de um tenant poderia consultar ou cancelar entradas de outro tenant; endpoint público ficava exposto a spam e referências inválidas.
- Correção: leitura/cancelamento exigem equipe do tenant; entrada pública passa pela Server Action com rate limit e valida tenant, serviços e barbeiro; grant/policy público de insert é removido; reivindicação exige transição atômica de `notified` para `claimed`.
- Teste preventivo: `npm run test:audit` verifica autorização tenant-scoped, rate limit, remoção do insert público e proteção da transição.
- Evidência: teste estático local passou em 2026-10-12.
- Regra preventiva: acesso administrativo nunca substitui autorização de domínio; toda operação privilegiada deve vincular usuário, papel e tenant antes da consulta/mutação.
- Risco residual: falta validar visitante, staff de tenant A/B, cancelamento e concorrência em banco descartável.

## ERR-2026-006 — Galeria aceitava escrita sem autorização e Base64 no banco
- Data: 2026-10-12
- Status: implementado localmente; integração pendente.
- Sintoma: Server Actions de criação/exclusão usavam service role sem validar equipe do tenant, e a imagem era persistida como Data URL na tabela.
- Causa raiz: confiança no chamador da action e ausência de contrato explícito de upload.
- Impacto: escrita indevida entre tenants, crescimento descontrolado do banco e payloads fora do tipo/tamanho esperado.
- Correção: exigir equipe do tenant, validar vínculos de cliente/barbeiro, MIME e limite de 8 MB, armazenar objeto em `barbershop-media` e persistir apenas a URL; excluir o objeto associado quando aplicável.
- Teste preventivo: `npm run test:audit` verifica guard de tenant, limites e uso do Storage.
- Evidência: teste estático local passou em 2026-10-12.
- Regra preventiva: Server Action exportada é fronteira pública; validar autorização e conteúdo mesmo quando a interface atual só a chama pelo painel.
- Risco residual: falta testar upload/exclusão real por papel e comportamento de rollback no Storage.

## ERR-2026-007 — Super Admin possuía fontes de autorização conflitantes
- Data: 2026-10-12
- Status: implementado localmente; migration e testes por papel pendentes.
- Sintoma: código, metadata do usuário e 20 policies reconheciam Super Admin por e-mail hardcoded, enquanto o banco já possuía o papel `super_admin`.
- Causa raiz: regra temporária de identidade virou mecanismo permanente em múltiplas camadas.
- Impacto: alteração de e-mail ou metadata poderia produzir perda ou concessão divergente de privilégio.
- Correção: código e policies passam a consultar perfil ativo com papel `super_admin` por meio de `public.is_super_admin()`; grants da função são reduzidos aos papéis necessários.
- Teste preventivo: `npm run test:audit` rejeita o e-mail hardcoded e autorização por `user_metadata.role`.
- Evidência: teste estático local passou em 2026-10-12.
- Regra preventiva: autorização deve ter uma única fonte controlada pelo servidor; metadata editável e identificador pessoal não definem privilégio.
- Risco residual: validar acesso do Super Admin existente e negação para owner/staff em banco descartável antes de aplicar.

## ERR-2026-008 — Buckets sem limites de tamanho e MIME
- Data: 2026-10-12
- Status: migration local preparada; aplicação remota pendente.
- Sintoma: os cinco buckets não possuíam `file_size_limit` nem `allowed_mime_types`.
- Causa raiz: buckets foram criados sem limites operacionais explícitos.
- Impacto: uploads excessivos ou de tipos inesperados poderiam consumir armazenamento e ampliar a superfície de abuso.
- Correção: migration define limites específicos por finalidade sem alterar a visibilidade atual dos buckets.
- Teste preventivo: `npm run test:audit` verifica limites e MIME dos cinco buckets.
- Evidência: teste estático local passou em 2026-10-12.
- Regra preventiva: todo bucket deve nascer com visibilidade, tamanho máximo, MIME e matriz de papéis documentados.
- Risco residual: policies de upload/leitura ainda precisam de testes reais por bucket e papel.

## ERR-2026-009 — Server Actions administrativas ignoravam papel e tenant
- Data: 2026-10-12
- Status: corrigido no branch; integração por papel pendente.
- Sintoma: ações exportadas de CRM, campanhas, repasses e indicações usavam `createAdminClient()` com autorização ausente ou limitada à existência de sessão/vínculo de tenant.
- Causa raiz: o service role foi tratado como autorização, embora ele apenas forneça acesso técnico e ignore RLS.
- Impacto: cliente do tenant poderia alcançar dados operacionais de confiança; ações de campanha e filas aceitavam identificadores sem validar o proprietário; configuração de split e estatísticas de indicação podiam ser consultadas sem o papel exigido.
- Correção: CRM exige equipe do tenant; campanhas, split e indicação do tenant exigem proprietário; indicação do cliente permite somente o próprio cliente ou equipe do mesmo tenant.
- Teste de reprodução: o novo contrato de regressão foi escrito antes da correção e falhou em `growth.ts` por ausência de `requireTenantOwner`.
- Evidência de passagem: `npm run test:audit` passou 11/11 contratos após as correções.
- Regra preventiva: toda action com cliente administrativo deve ter guarda explícita antes da primeira consulta, mesmo que a interface atual esconda o botão.
- Limitações: teste estático não substitui execução A/B por papel; a permissão financeira opcional da recepção ainda precisa de modelo granular.

Não apagar registros antigos. Complementar quando novas evidências surgirem.
