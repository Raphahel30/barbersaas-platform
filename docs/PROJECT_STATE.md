# Navalio SaaS — Estado do projeto

Atualizado em 12/10/2026, por auditoria remota e dois lotes locais de correções.

## Baseline remoto
- Repositório: `Raphahel30/barbersaas-platform`
- Branch auditada: `main`
- HEAD auditado: `60dcdc70d1867975d3ba2dfcfd6a4d11fc4488d9`
- Último commit identificado: 13/09/2026
- Branches remotas identificadas: somente `main`
- Pull Requests identificados: nenhum
- Deploy oficial: não certificado nesta auditoria
- Testes: arquivos existentes; execução atual não certificada

## O que foi comprovado no código
- Aplicação Next.js/React com Supabase.
- Estrutura multi-tenant, middleware e módulos de autenticação.
- Builder/white-label.
- Agendamento, pagamentos, CRM, mensalistas, inventário, retenção, franquia, notificações e PWA.
- Playwright com projetos desktop e mobile.
- Scripts de preflight, fluxos críticos e integridade de tenant.
- Migrations extensas de schema, RLS, storage, reserva atômica e rate limiting.

## O que ainda não está certificado
- Conteúdo da pasta local e commits não enviados.
- Sincronização das migrations com o Supabase remoto.
- Execução bem-sucedida dos testes.
- Fluxos reais de pagamentos, webhooks e WhatsApp.
- Builder ponta a ponta.
- Isolamento entre dois tenants em execução real.
- Correspondência entre a versão publicada e este commit.

## Correções preparadas no branch de auditoria
- Migration local restringe leitura de `tenants` por linha e por coluna; ainda não aplicada remotamente.
- Booking usa `profiles` como fonte canônica do aniversário.
- Preflight não apresenta fallback `wa.me` como Evolution homologada nem declara prontidão total.
- Waitlist exige autorização vinculada ao tenant nas operações de equipe, valida a entrada pública e limita tentativas.
- Galeria exige staff do tenant, valida arquivo/vínculos e grava mídia no Storage em vez de Base64 no banco.
- Super Admin usa o papel do perfil ativo como fonte única; migration substitui policies com e-mail hardcoded.
- Buckets recebem limites de tamanho e MIME específicos sem mudança de visibilidade.
- `npm run test:audit` passou para oito contratos em 12/10/2026.
- Typecheck/build permanecem bloqueados neste workspace porque `npm ci` não concluiu e o ambiente usa Node 24 em vez de Node 20.
- Nenhuma migration deste branch foi aplicada ao Supabase remoto.

## Regra de evidência
Nenhum item deve ser marcado como validado apenas por existir código, documentação ou commit. Exigir teste, resultado e referência.
