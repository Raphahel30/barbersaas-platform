# BarberSaaS — Antigravity Production Blocker Fix Pack

Pacote de correção para o SaaS multi-tenant white-label de barbearias.

## Objetivo

Corrigir e validar os bloqueadores de produção relacionados a:

1. agendamento sem sinal que fica em `hold`;
2. corrida no débito de cortes de mensalistas;
3. drift entre migrations locais e Supabase remoto;
4. policies inseguras/incompletas do bucket `barbershop-media`;
5. consulta de pagamento sem autorização;
6. fallback silencioso da RPC atômica para fluxo não atômico;
7. hardening SQL da função `create_appointment_hold_atomic`;
8. Realtime de `appointments` incompatível com o modelo de autorização;
9. divergência entre valores calculados no frontend e backend;
10. alertas de segurança do Supabase;
11. ausência de testes críticos válidos em Node 20.

## Como instalar no workspace

Copie a pasta `.agents` deste pacote para a raiz do repositório.

Estrutura esperada:

```text
<repo>/
├─ .agents/
│  ├─ agents/
│  ├─ rules/
│  └─ skills/
├─ app/
├─ supabase/
└─ ...
```

Depois, abra um novo Agent no Antigravity para forçar a redescoberta das customizações.

Use o conteúdo de `MASTER_PROMPT.md` como prompt principal.

## Ordem recomendada

1. Auditoria somente leitura.
2. Snapshot do estado local/remoto.
3. Correção da função atômica e contrato backend/frontend.
4. Correção da corrida de mensalistas.
5. Reconciliação de migrations.
6. Storage/RLS/authorization hardening.
7. Remoção do fallback inseguro.
8. Revisão de funções `SECURITY DEFINER`.
9. Node 20 + testes automatizados.
10. Testes de integração dos fluxos críticos.
11. Somente depois: proposta de deploy.

## Regra de ouro

Nunca marcar uma migration como aplicada somente porque “parece” já existir no remoto.
Primeiro compare o SQL/objetos reais com o conteúdo da migration.

Nunca abrir `SELECT` anônimo amplo em `appointments` apenas para fazer Realtime funcionar.

Nunca voltar para um fluxo de reserva menos seguro quando a RPC atômica falhar.

Nunca considerar `npm run build` como prova de correção dos fluxos críticos.
