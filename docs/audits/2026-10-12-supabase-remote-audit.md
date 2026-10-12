# Auditoria remota Supabase — Navalio — 2026-10-12

## Escopo e limites
Auditoria somente leitura no projeto `phplumiphnneggadghoz`, comparada ao commit remoto `60dcdc70d1867975d3ba2dfcfd6a4d11fc4488d9`. Nenhuma linha de cliente foi lida; somente metadados e contagens. Nenhuma mudança foi aplicada.

## Inventário
- PostgreSQL 17; projeto `ACTIVE_HEALTHY`.
- 57 tabelas públicas; RLS habilitado em 57/57.
- 93 policies públicas.
- 13 funções públicas; 10 `SECURITY DEFINER`.
- 5 buckets: `avatars`, `barbershop-media`, `gallery`, `receipts`, `signatures`.
- Nenhuma Edge Function implantada.
- Nenhuma view pública.
- 26 migrations remotas. Nomes/versões coincidem com as 26 migrations listadas no GitHub auditado.
- Contagens: 9 usuários Auth, 3 tenants, 8 profiles, 6 serviços, 1 appointment e 3 planos.

## Achados

### P0 — Usuário autenticado pode potencialmente ler credenciais de todos os tenants
**Evidência:** `tenants` possui policy `Public Read Tenants` para `anon,authenticated` com `USING (true)`. O papel `authenticated` possui `SELECT` na coluna `gateway_credentials`. A tabela também contém documentos, nome do proprietário, endereço e identificadores Asaas.

**Impacto:** qualquer usuário autenticado pode, em tese, consultar dados sensíveis de outras barbearias pela Data API. Não foram lidos valores reais durante a auditoria.

**Ação proposta:** criar uma projeção pública mínima para resolução/landing, remover leitura irrestrita da tabela base e testar tenant A/B. Não corrigir remotamente sem migration revisada, teste e rollback.

### P1 — Código consulta tabela `clients` inexistente
**Evidência:** `app/actions/booking.ts` consulta `admin.from('clients')` para aniversário; o banco possui 57 tabelas públicas e não possui `clients`.

**Impacto:** desconto de aniversário e identificação do cliente podem falhar silenciosamente. O código ignora o erro dessa consulta.

**Ação proposta:** determinar a fonte canônica de clientes (`profiles` ou nova tabela prevista), criar teste de reprodução e alinhar código/schema.

### P1 — Funções privilegiadas expostas
- 10 funções `SECURITY DEFINER`.
- 1 executável por `anon`: `resolve_tenant_by_host`.
- 6 executáveis por `authenticated`.
- O advisor exige revisão explícita de necessidade e grants.
- Todas as funções listadas usam `search_path=''`, o que reduz risco de hijacking.

### P1 — Proteção contra senhas vazadas desativada
Advisor de segurança confirmou `auth_leaked_password_protection` desabilitada. Exige configuração de Auth/Dashboard.

### P1 — RPC atômica não é fonte autossuficiente de preço
`create_appointment_hold_atomic` recebe `p_total_amount` e `p_reservation_fee` e os grava. A Server Action atual recalcula valores a partir de serviços no servidor, reduzindo o risco no fluxo atual, mas a RPC não valida/recalcula o contrato no banco. Novo consumidor privilegiado incorreto pode introduzir cobrança manipulada.

### P1 — Waitlist aceita INSERT público irrestrito
Policy `waitlist public insert` usa `WITH CHECK (true)`. Pode ser requisito funcional, mas precisa validação de tenant/data/campos e rate limiting para evitar spam/abuso.

### P1/P2 — Storage exige revisão por bucket
- `avatars`, `barbershop-media` e `gallery` são públicos.
- `receipts` e `signatures` são privados.
- Policies tenant-scoped encontradas para `barbershop-media`.
- Não foram encontradas na listagem policies específicas equivalentes para os demais buckets.
Revisar se ausência bloqueia escrita legitimamente ou se rotas privilegiadas contornam RLS. Definir limites de tamanho e MIME.

### P2 — Performance
Advisor identificou 57 foreign keys sem índice de cobertura. Não criar todos cegamente; priorizar caminhos de agendamento, tenant, pagamentos e operações frequentes usando consultas reais.

### P2 — Policies duplicadas/sobrepostas
Há múltiplas policies permissivas por papel/ação em diversas tabelas. Parte é intencional (cliente, staff, owner, master), mas o advisor aponta sobreposição. Consolidar apenas após testes por papel.

### P2 — Identidade de Master Admin hardcoded
20 policies contêm o e-mail `rafaelcassu@gmail.com`. O sistema também possui função/role de super admin, gerando duas fontes de autorização. Centralizar a decisão sem remover acesso antes de testes.

## Pontos positivos confirmados
- RLS habilitado em todas as tabelas públicas.
- Histórico remoto de migrations coincide nominalmente com o GitHub auditado.
- RPC de agendamento usa `search_path=''`, valida tenant/profissional/serviços, usa `FOR UPDATE` para mensalista e não é executável por anon/authenticated.
- Tracking público utiliza hash/token e comparação timing-safe na Server Action.
- Buckets sensíveis `receipts` e `signatures` não são públicos.
- Não existe fallback não atômico no trecho atual de criação de reserva.

## Próximos gates
1. Corrigir P0 em migration local revisada, nunca diretamente em produção.
2. Executar testes reais de RLS com tenant A/B antes e depois.
3. Resolver fonte canônica de clientes.
4. Auditar bodies/grants das 10 funções privilegiadas.
5. Testar Storage por bucket e papel.
6. Rodar Graphify + Jev sobre código local para ligar achados do banco aos consumidores.
7. Executar suíte Node 20/Playwright sem deploy.

## Status
Auditoria estrutural iniciada. O primeiro lote foi implementado localmente com testes de regressão: restrição de `tenants`, fonte canônica de aniversário e preflight sem falso verde. Nenhuma migration foi aplicada ao remoto. Testes tenant A/B, typecheck, build e validação de banco descartável ainda são obrigatórios antes do gate de produção.

## Complemento — segundo lote local
- As 10 funções `SECURITY DEFINER` foram classificadas: duas são internas para `service_role`, duas são triggers sem execução direta, cinco são helpers de RLS autenticados e `resolve_tenant_by_host` é o resolvedor público de retorno mínimo. Todas mantêm `search_path=''`. Os grants não foram alterados remotamente.
- A identidade de Super Admin foi centralizada no perfil ativo com papel `super_admin`; migration local substitui as 20 policies baseadas em e-mail por `public.is_super_admin()`.
- A waitlist preserva entrada de visitante pela Server Action, mas remove o insert direto para `anon/authenticated`, valida referências e aplica rate limit. Leitura e cancelamento agora exigem staff do tenant; claim verifica a transição concorrente.
- A galeria passa a exigir staff do tenant e armazena arquivos validados no Storage em vez de Data URL na tabela.
- Migration local define limites de tamanho e MIME em `avatars`, `barbershop-media`, `gallery`, `receipts` e `signatures`, sem mudar a visibilidade existente.
- O advisor também reportou `rate_limit_buckets` com RLS sem policy. A ausência é intencional no contrato atual: acesso direto de usuário permanece bloqueado e o consumo ocorre por função/service role. Deve ser confirmado em teste de integração.
- Proteção contra senhas vazadas continua sendo ação manual pendente no painel de Auth.
- As 57 foreign keys sem índice e policies permissivas sobrepostas permanecem em análise; nenhuma alteração em massa será feita sem consultas e testes por papel.

O teste estático `npm run test:audit` passou 9/9 após o complemento de preço. Isso não substitui typecheck, build, testes tenant A/B nem aplicação em banco descartável. O projeto remoto segue inalterado.

## Complemento — contrato de preço e índices
- A RPC `create_appointment_hold_atomic` instalada é `SECURITY INVOKER` e executável somente por `service_role`; `anon` e `authenticated` não podem chamá-la.
- O único consumidor encontrado no aplicativo é `app/actions/booking.ts`. O contrato público da action não recebe preço ou sinal; ambos são calculados no servidor a partir de serviços ativos do tenant, yield, aniversário, VIP e fidelidade.
- A RPC ainda aceita os valores finais como parâmetros. Isso permanece como risco de defesa em profundidade para um futuro consumidor privilegiado incorreto, não como exploração direta confirmada pelo navegador no contrato atual.
- Não foi criada migration de preço: uma validação parcial no banco quebraria descontos legítimos ou continuaria aceitando desconto arbitrário. A alternativa correta exige contrato versionado de cotação/decomposição e teste em banco descartável.
- Entre as foreign keys sem índice, foram revisados os caminhos de booking. `appointments` já possui índice parcial para conflito e índices por tenant/barbeiro/cliente; `barber_time_off` já cobre tenant, barbeiro e datas. `barber_blocked_slots` e `client_subscriptions` são candidatos futuros, mas as tabelas remotas ainda não têm volume estimado suficiente para justificar criação sem medição.
- Nenhum índice foi criado e nenhuma consulta remota foi modificada.
