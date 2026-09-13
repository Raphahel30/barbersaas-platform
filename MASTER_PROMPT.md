# MISSÃO: corrigir bloqueadores de produção do BarberSaaS sem introduzir regressões

Você está trabalhando em um SaaS multi-tenant white-label de barbearias, construído em Next.js App Router + Supabase + Asaas, com agendamento, hold anti-no-show, mensalistas, pagamentos, Storage, RLS e painel administrativo.

Sua tarefa é investigar, corrigir e verificar os bloqueadores abaixo. Não faça correções superficiais e não altere regras de negócio sem evidência no código/banco.

## Modo de trabalho obrigatório

Trabalhe em quatro fases:

### FASE A — AUDITORIA SOMENTE LEITURA

Antes de editar:

1. Leia os arquivos citados e encontre todas as funções, Server Actions, migrations, policies, tipos e componentes envolvidos.
2. Trace o fluxo completo:
   navegador -> Server Action/Route Handler -> RPC/SQL -> tabela -> webhook/polling -> UI final.
3. Identifique a origem real dos valores de:
   - `reservationFee`;
   - `status`;
   - `hold_expires_at`;
   - `cuts_remaining`;
   - tenant;
   - barber;
   - services;
   - appointment/payment tracking.
4. Compare migrations locais com o estado remoto do Supabase.
5. Não assuma que o remoto corresponde ao GitHub.
6. Mostre um relatório curto contendo:
   - causa raiz;
   - arquivos/objetos envolvidos;
   - risco;
   - correção proposta;
   - migrations/policies que serão tocadas.

Não faça deploy nem mutações remotas destrutivas durante a auditoria.

### FASE B — IMPLEMENTAÇÃO LOCAL SEGURA

Depois da auditoria, implemente as correções no repositório.

Regras:

- preservar multi-tenancy;
- preservar dados existentes;
- falhar fechado em caso de erro crítico;
- backend é a fonte de verdade;
- não confiar em preço/status calculado apenas no navegador;
- não usar `service_role` como justificativa para expor endpoints sem autorização;
- não adicionar policies amplas para “fazer funcionar”;
- não esconder erros de RPC com fallback não atômico;
- não alterar produção apenas para fazer testes passarem.

### FASE C — VERIFICAÇÃO

Execute usando Node 20, conforme o projeto.

Verifique:
- typecheck/lint existentes;
- `npm run build`;
- testes críticos;
- testes de concorrência;
- testes de RLS/tenant isolation;
- cenários de pagamento/hold;
- mensalistas;
- sinal zero;
- expiração;
- autorização da consulta de pagamento.

Se um teste falhar, corrija a causa. Não desabilite o teste.

### FASE D — RELATÓRIO E GATE DE PRODUÇÃO

Ao final, entregue:

1. arquivos alterados;
2. migrations criadas/ajustadas;
3. SQL relevante;
4. testes executados e resultado;
5. riscos residuais;
6. comandos necessários para reconciliar/aplicar migrations;
7. checklist de deploy;
8. rollback;
9. itens que exigem ação manual no Dashboard.

Não publique em produção automaticamente. Pare antes do deploy/mutação remota irreversível e mostre exatamente o que será aplicado.

---

# BLOQUEADOR 1 — Sinal R$ 0,00 exibido como confirmado, mas registro fica em hold

Arquivos inicialmente conhecidos:

- `app/(tenant)/[tenantSlug]/agendar/page.tsx`, região próxima da linha 309.
- função/RPC `create_appointment_hold_atomic`.
- migration `supabase/migrations/20260913010000_booking_atomic.sql`.
- `app/actions/booking.ts`.

Problema:

A UI assume que qualquer sinal zero significa confirmação, mas a função atômica somente cria `confirmed` diretamente para mensalista. Cliente comum com sinal zero recebe `hold`, a UI mostra sucesso e o agendamento expira depois de cinco minutos.

Correção obrigatória:

1. O backend deve retornar explicitamente o estado definitivo da reserva:
   - `status`;
   - `requiresPayment`;
   - `reservationFee`;
   - `holdExpiresAt`, quando aplicável;
   - identificador/token de acompanhamento, quando aplicável.
2. Se a taxa DEFINITIVA calculada/validada pelo backend for `<= 0`, o agendamento deve ser criado/convertido para `confirmed`, sem depender de pagamento.
3. Não confie em `p_reservation_fee` se esse valor puder ser controlado pelo browser. Rastreie sua origem e recompute ou valide no servidor.
4. A UI deve decidir a próxima tela pelo retorno do backend, não por `totalReservationFee` local.
5. Se backend retornar `hold`, a UI nunca pode exibir “Agendamento confirmado”.
6. Um agendamento `confirmed` sem cobrança não deve possuir lógica de expiração que o cancele cinco minutos depois.

Critérios de aceite:

- cliente comum + fee 0 => `confirmed`, sem expiração;
- mensalista válido + corte disponível => `confirmed`, corte debitado uma vez;
- fee > 0 => `hold` + fluxo Pix;
- UI sempre reflete status/fee retornados pelo servidor.

---

# BLOQUEADOR 2 — Corrida pode deixar `cuts_remaining` negativo

Migration inicialmente conhecida:

- `supabase/migrations/20260913010000_booking_atomic.sql`, região próxima da linha 45.

Problema:

A função lê assinatura com `cuts_remaining > 0`, mas não bloqueia a linha. Duas transações podem observar saldo 1 e ambas decrementar.

Correção obrigatória:

1. Toda decisão “mensalista possui corte” e o débito devem ocorrer NA MESMA transação da RPC.
2. Bloqueie a assinatura selecionada com locking apropriado (`FOR UPDATE`) antes de consumir o saldo.
3. O `UPDATE` também deve conter condição defensiva `cuts_remaining > 0`.
4. Use `RETURNING` ou verificação de row count para comprovar que exatamente uma linha foi debitada.
5. Se nenhuma linha for atualizada, não permita saldo negativo e não finja que o benefício foi consumido.
6. Defina comportamento determinístico para a segunda reserva concorrente:
   - seguir como cliente comum/pagante, se isso estiver de acordo com a regra atual;
   - ou retornar erro de saldo esgotado.
   Não invente a regra: determine-a no código existente.
7. O débito do corte e a criação/confirmação do appointment devem ser atomicamente consistentes.

Teste obrigatório:

Criar teste de concorrência com saldo inicial `cuts_remaining = 1` e duas tentativas simultâneas.

Aceite:

- no máximo uma consome o corte;
- saldo final nunca < 0;
- nenhuma reserva fica em estado impossível;
- resultado é repetível.

---

# BLOQUEADOR 3 — Drift entre migrations locais e histórico remoto

Migrations locais conhecidas:

- `20260912000000_tenant_customization_and_address`
- `20260913000000_security_hardening`
- `20260913000001_strict_tenant_rls`
- `20260913000002_storage_setup`
- `20260913010000_booking_atomic`

Problema:

Objetos de algumas migrations existem no remoto, mas o histórico remoto não registra essas migrations.

Procedimento obrigatório:

1. Descubra a versão real do Supabase CLI.
2. Consulte `supabase --help` e `supabase migration --help` antes de usar comandos de repair/pull.
3. Capture:
   - lista de migrations locais;
   - lista de migrations remotas;
   - definição remota da função atômica;
   - policies relevantes;
   - bucket;
   - schema/colunas/constraints envolvidos.
4. Compare cada migration ausente com o estado remoto.
5. Classifique cada uma como:
   - não aplicada;
   - totalmente aplicada manualmente;
   - parcialmente aplicada;
   - aplicada com divergência.
6. Só use mecanismo de “repair/mark applied” quando o estado remoto for comprovadamente equivalente ao conteúdo da migration.
7. Se a migration estiver parcialmente aplicada ou divergente, NÃO a marque como aplicada. Crie estratégia de reconciliação segura e uma migration canônica que leve o estado atual ao estado desejado.
8. Não apague dados de produção.
9. Não reexecute cegamente DDL que já existe.
10. Ao final, `migration list` deve refletir um histórico coerente e reproduzível em ambiente novo.

Entregue antes da aplicação remota uma tabela:

`migration | remoto | equivalência | ação proposta | risco`

---

# BLOQUEADOR 4 — Storage bucket e policies

Bucket:

`barbershop-media`

Problemas:

- bucket existe;
- policies esperadas não estão confirmadas no remoto;
- upload local só verifica bucket;
- usuário autenticado pode potencialmente gravar na pasta de outro tenant;
- faltam UPDATE/DELETE;
- upsert/substituição precisa das permissões necessárias.

Correção:

1. Descubra o padrão real de paths usado pelo upload.
2. Estabeleça uma convenção tenant-scoped, preferencialmente com `tenant_id` ou slug imutavelmente associado ao tenant autenticado.
3. Policies de INSERT/UPDATE/DELETE devem verificar:
   - bucket correto;
   - usuário autenticado;
   - propriedade/membership do tenant;
   - path pertencente ao mesmo tenant.
4. UPDATE deve usar `USING` e `WITH CHECK`.
5. Garanta SELECT quando necessário para upsert/substituição.
6. DELETE somente para owner/admin autorizado daquele tenant.
7. Não confie apenas em `authenticated`.
8. Teste:
   - tenant A faz upload na própria pasta => permitido;
   - tenant A tenta pasta do tenant B => negado;
   - A tenta update/delete de B => negado;
   - usuário anônimo tenta mutação => negado.
9. O fato de o bucket ser público para leitura de mídia não deve conceder escrita pública.

Não invente a relação usuário->tenant: derive-a de `profiles`, `tenants` e policies existentes.

---

# BLOQUEADOR 5 — Consulta de pagamento sem autorização

Função conhecida:

`checkAppointmentPaymentStatus` em `app/actions/booking.ts`, região próxima da linha 548.

Problema:

Usa cliente administrativo e aceita apenas UUID. Isso cria IDOR/BOLA: quem obtiver um appointment ID pode consultar status/valores.

Correção preferida:

Implemente um segredo público específico de acompanhamento da reserva.

Requisitos:

1. Gere token aleatório criptograficamente forte no servidor.
2. Não use UUID do appointment como segredo.
3. Prefira armazenar hash do token e devolver o token bruto apenas ao cliente que criou a reserva; se a arquitetura atual tornar isso impraticável, documente a alternativa e seu risco.
4. `checkAppointmentPaymentStatus` deve exigir appointment ID + token, ou outro mecanismo de autorização equivalente.
5. Funcionários autenticados do tenant podem consultar por um caminho autorizado separado.
6. Nunca aceite apenas tenantSlug + appointmentId como prova.
7. Use comparação segura e responda de modo que não facilite enumeração.
8. Atualize o frontend para conservar o token somente durante o fluxo necessário.
9. Não logue token bruto.

Teste:

- ID correto + token correto => permitido;
- ID correto + token errado => negado;
- ID de outro tenant => negado;
- somente UUID => negado;
- funcionário do tenant correto => permitido conforme papel;
- funcionário de outro tenant => negado.

---

# BLOQUEADOR 6 — RPC atômica falha e código cai no fluxo antigo

Arquivo:

`app/actions/booking.ts`, região próxima da linha 311.

Correção obrigatória:

1. Remova o fallback para insert não atômico em produção.
2. Erro da RPC => reserva falha fechada.
3. Retorne erro estruturado e amigável ao frontend.
4. Registre diagnóstico no servidor sem expor segredo/PII desnecessário.
5. Diferencie conflito de horário, validação, indisponibilidade e erro interno se o backend já permitir isso.
6. Não crie appointment por outro caminho “temporário”.

Aceite:

Simular falha da RPC e confirmar que nenhuma reserva órfã/não atômica é criada.

---

# BLOQUEADOR 7 — Hardening SQL da função atômica

Função:

`create_appointment_hold_atomic`

Obrigatório:

1. `SET search_path = ''`.
2. Use nomes totalmente qualificados, por exemplo `public.appointments`.
3. Verifique se `SECURITY DEFINER` é realmente necessário.
4. Revogue EXECUTE de `PUBLIC`, `anon` e `authenticated`, salvo evidência explícita de necessidade.
5. Se a função deve ser somente server-side, conceda EXECUTE apenas ao papel necessário, tipicamente `service_role`.
6. Valide dentro da função:
   - tenant existe/ativo;
   - barber pertence ao tenant e está apto;
   - todos os service IDs existem;
   - todos os services pertencem ao tenant e estão ativos;
   - número de serviços encontrado = número solicitado;
   - appointment não está no passado;
   - nome/telefone têm limites razoáveis;
   - duração/preço/fee não usam dados não confiáveis do browser;
   - horário não conflita segundo a regra de negócio;
   - mensalista pertence ao mesmo tenant.
7. Qualifique tabelas/funções usadas na função.
8. Documente grants/revokes na migration.
9. Rode Advisors depois.

Nunca “conserte” permissão acrescentando `SECURITY DEFINER` sem análise.

---

# BLOQUEADOR 8 — Realtime de appointments

Problema:

O navegador aparentemente assina UPDATE em `appointments`, mas anon não possui leitura da reserva. O polling funciona via Server Action/service role.

Regra de segurança:

NÃO crie uma policy ampla de SELECT anônimo em `appointments` apenas para habilitar Realtime.

Faça uma decisão arquitetural explícita:

Opção A — recomendada para a correção mínima:
- polling autenticado pelo token de acompanhamento é a fonte de verdade;
- remova/desative a assinatura Realtime que nunca pode receber evento;
- mantenha UX funcional.

Opção B:
- implemente um canal Realtime que tenha autorização efetiva e isolamento por reserva/tenant, sem expor appointments de terceiros.

Escolha B somente se conseguir demonstrar autorização real.

Aceite:

Um cliente nunca pode observar status/dados de appointment de outro cliente/tenant.

---

# BLOQUEADOR 9 — Frontend usa valor local em vez do backend

Arquivo:

`app/(tenant)/[tenantSlug]/agendar/page.tsx`, região próxima da linha 305.

Correção:

Depois da criação da reserva, use os valores retornados pelo backend como definitivos.

Contrato sugerido:

```ts
type CreateAppointmentResult = {
  appointmentId: string
  status: 'hold' | 'confirmed'
  requiresPayment: boolean
  reservationFee: number
  holdExpiresAt: string | null
  trackingToken?: string
}
```

Adapte aos tipos reais do projeto.

Não derive “paga ou não paga” apenas de `totalReservationFee`.

Aceite:

Promoção, mensalista, aniversário, yield pricing ou qualquer regra futura não pode fazer UI e banco discordarem.

---

# ALERTAS DO SUPABASE

Advisor conhecido:

- função com `search_path` mutável;
- 7 `SECURITY DEFINER` acessíveis anonimamente;
- 7 `SECURITY DEFINER` acessíveis por authenticated;
- leaked password protection desativada;
- 64 FKs sem índice de cobertura;
- policies permissivas duplicadas.

Ação:

1. Liste TODAS as funções `SECURITY DEFINER` e respectivos grants.
2. Classifique:
   - pública por design;
   - autenticada por design;
   - interna;
   - trigger/helper.
3. `resolve_tenant_by_host` pode ser pública se a implementação justificar; não assuma.
4. Para função interna:
   - revoke PUBLIC/anon/authenticated;
   - grant mínimo;
   - `search_path` seguro;
   - nomes qualificados.
5. Não crie 64 índices cegamente.
   - identifique FKs em joins/delete/update/hot paths;
   - priorize por uso e plano de consulta;
   - evite custo de escrita desnecessário.
6. Revise policies duplicadas para eliminar sobreposição insegura sem quebrar acesso legítimo.
7. Proteção de senha vazada é configuração de Auth: se exigir Dashboard/ação externa, documente como passo manual em vez de fingir que foi corrigida no código.

---

# NODE E TESTES

O projeto declara Node 20.

Os comandos `test:critical` e `check-env` falharam em Node 24 com erro relacionado a `tsx`/`uv_os_get_passwd`.

Obrigatório:

1. Rode `node -v`.
2. Use Node 20.
3. Respeite `package.json engines` e lockfile.
4. Se não houver arquivo de pin, proponha `.nvmrc`/`.node-version` somente se consistente com o projeto.
5. Rode:
   - `npm ci` ou equivalente compatível;
   - `npm run build`;
   - `npm run test:critical`;
   - `npm run check-env`;
   - demais testes existentes relevantes.
6. Não altere testes apenas para esconder falhas.

---

# MATRIZ MÍNIMA DE TESTES DE REGRESSÃO

Cubra, no mínimo:

1. cliente comum, fee > 0:
   - cria hold;
   - slot fica bloqueado;
   - pagamento confirma;
   - hold não expira depois de confirmado.

2. cliente comum, fee = 0:
   - cria confirmed;
   - não cria cobrança;
   - não expira.

3. mensalista com 1 corte:
   - confirmed;
   - decrementa para 0 exatamente uma vez.

4. duas reservas simultâneas com 1 corte:
   - no máximo uma usa o benefício;
   - nunca negativo.

5. hold sem pagamento:
   - expira após regra de 5 minutos;
   - slot volta.

6. conflito simultâneo de mesmo horário:
   - no máximo uma reserva válida para o mesmo recurso/slot conforme as constraints/regras.

7. pagamento:
   - polling autorizado;
   - token errado negado;
   - appointment de outro tenant negado.

8. multi-tenant:
   - tenant A não lê/escreve mídia, appointments, mensalistas ou dados operacionais de B.

9. storage:
   - upload/update/delete cross-tenant bloqueados.

10. erro da RPC:
   - nenhuma queda para insert legado.

---

# ORQUESTRAÇÃO DE AGENTS

Se os custom agents deste workspace estiverem disponíveis, delegue:

- `booking-concurrency-auditor`: função atômica, mensalistas, holds, concorrência;
- `supabase-security-auditor`: RLS, Storage, grants, SECURITY DEFINER;
- `migration-reconciler`: drift local/remoto;
- `frontend-server-contract-reviewer`: contrato Server Action/UI e status/fees;
- `critical-flow-qa`: testes e regressões.

Use subagents para investigação paralela, mas a decisão final deve ser consolidada pelo agente principal.

Se subagents não estiverem disponíveis, execute os mesmos papéis sequencialmente.

---

# RESTRIÇÕES IMPORTANTES

- Não faça deploy automático.
- Não aplique migration remota destrutiva sem mostrar antes.
- Não apague migrations históricas só para “alinhar”.
- Não use `--force` sem justificar.
- Não desative RLS.
- Não exponha `service_role`.
- Não conceda SELECT anônimo geral em `appointments`.
- Não coloque secrets/tokens em logs.
- Não modifique `.env` real com valores inventados.
- Não silencie erro de RPC.
- Não confie no browser para preço, desconto, saldo ou tenant.
- Não considere build verde suficiente.
- Não declare “corrigido” sem evidência de testes.

# DEFINIÇÃO DE PRONTO

Só considere os bloqueadores resolvidos quando:

- código e banco possuem uma única regra coerente para fee/status;
- sinal zero não expira;
- saldo mensal nunca fica negativo;
- RPC não possui fallback inseguro;
- payment polling possui autorização;
- storage é tenant-scoped;
- função atômica está hardened;
- migrations possuem plano de reconciliação reproduzível;
- frontend usa valores do backend;
- Node 20 executa a suíte crítica;
- tenant isolation foi testado;
- relatório final mostra evidências, não apenas afirmações.
