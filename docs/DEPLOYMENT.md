# Guia Definitivo de Deploy e Infraestrutura de Produção

Este manual descreve a arquitetura e os procedimentos operacionais para colocar o SaaS de Barbearias em produção de forma escalável, segura e com suporte a **Domínios Customizados Zero-Touch** para os proprietários das barbearias parceiras.

---

## 1. Arquitetura de Domínios Customizados (Cloudflare for SaaS)

### 1.1. Como Funciona o Fluxo
O objetivo do Cloudflare for SaaS (Custom Hostnames) é permitir que qualquer barbearia utilize seu próprio domínio (ex: `barbeariaimperial.com.br` ou `agende.barbeariadocarlos.com`) sem que você precise configurar certificados SSL ou alterar servidores manualmente.

```
[ Cliente Final ]
       │
       ▼ (Acessa: barbeariaimperial.com.br)
[ Servidor DNS do Barbeiro ] (Registro CNAME -> cname.seusaas.com.br)
       │
       ▼
[ Cloudflare for SaaS Edge ] (Terminação TLS / SSL Gratuito Automático)
       │ (Proxy seguro com header Host: barbeariaimperial.com.br preservado)
       ▼
[ Vercel / Origem da Aplicação Next.js ]
       │
       ▼
[ Middleware Next.js (middleware.ts) ]
       │ ──> Consulta Supabase: RPC resolve_tenant_by_host('barbeariaimperial.com.br')
       │ ──> Localiza tenant (id, slug, status)
       ▼
[ Renderiza PWA com visual_settings e catálogo daquela barbearia ]
```

---

### 1.2. Passo a Passo no Painel da Cloudflare

#### Passo 1: Zona Principal
1. Crie ou configure seu domínio corporativo na Cloudflare (ex: `seusaas.com.br`).
2. Garanta que os Nameservers do seu domínio apontem para a Cloudflare.

#### Passo 2: Fallback Origin (Origem Padrão)
1. No menu lateral da Cloudflare, navegue até **SSL/TLS** ➔ **Custom Hostnames** (ou **Cloudflare for SaaS**).
2. Clique em **Set up a fallback origin**.
3. Defina o subdomínio de fallback interno (ex: `app-origin.seusaas.com.br`).
4. Na aba **DNS** da sua zona, crie este registro:
   - **Tipo**: `CNAME`
   - **Nome**: `app-origin`
   - **Destino**: Seu domínio no Vercel (ex: `cname.vercel-dns.com` ou o alias do seu projeto Vercel).
   - **Proxy status**: `Proxied` (Nuvem Laranja ativada).
5. Confirme o Fallback Origin no painel. O status ficará **Active**.

#### Passo 3: Criação do Registro CNAME para os Barbeiros
Crie um registro CNAME público que será fornecido a todos os clientes:
- **Tipo**: `CNAME`
- **Nome**: `cname` (resultando em `cname.seusaas.com.br`)
- **Destino**: `app-origin.seusaas.com.br`
- **Proxy status**: `Proxied` (Nuvem Laranja ativada).

---

### 1.3. O que o Barbeiro Precisa Fazer no Registrador Dele (Registro.br, GoDaddy, Cloudflare, etc.)

Para ativar o domínio próprio, o proprietário da barbearia só precisa adicionar uma entrada na zona DNS dele:

#### Opção A: Usando Subdomínio (Recomendado - Ex: `agendamento.barbeariadocarlos.com.br`)
| Tipo | Nome / Host | Destino / Valor | TTL |
| :--- | :--- | :--- | :--- |
| **CNAME** | `agendamento` | `cname.seusaas.com.br` | Automático / 1h |

#### Opção B: Usando Domínio Raiz / Apex (Ex: `barbeariadocarlos.com.br`)
| Tipo | Nome / Host | Destino / Valor | Observação |
| :--- | :--- | :--- | :--- |
| **ALIAS / ANAME** ou **CNAME Flattening** | `@` | `cname.seusaas.com.br` | Suportado nativamente na Cloudflare, Route 53 e DNSimple |

*Nota: No Registro.br tradicional, se o cliente quiser usar a raiz sem subdomínio, ele pode criar um redirecionamento de `@` para `www` e apontar o `www` via CNAME.*

---

### 1.4. Provisionamento Automatizado via API da Cloudflare

Quando um proprietário insere o domínio customizado nas configurações da barbearia, seu backend pode registrar automaticamente o Custom Hostname na Cloudflare via API REST:

```bash
POST https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/custom_hostnames
Headers:
  Authorization: Bearer {CLOUDFLARE_API_TOKEN}
  Content-Type: application/json

Body:
{
  "hostname": "barbeariadocarlos.com.br",
  "ssl": {
    "method": "http",
    "type": "dv",
    "settings": {
      "min_tls_version": "1.2",
      "http2": "on"
    }
  }
}
```

O Cloudflare gerencia automaticamente a emissão e a renovação perpétua dos certificados SSL Let's Encrypt / Google Trust Services.

---

## 2. Configuração de Variáveis de Ambiente de Produção

Insira as seguintes variáveis nas configurações do **Vercel** (Environment Variables: Production):

| Variável | Descrição | Exemplo de Produção |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | URL canônica principal da plataforma | `https://seusaas.com.br` |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Domínio raiz utilizado pelo middleware multi-tenant | `seusaas.com.br` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | `https://xyzproject.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anônima do Supabase | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave privada administrativa (Bypass RLS) | `eyJhbGciOi...` |
| `CRON_SECRET` | Token secreto obrigatório para autorização das rotas Cron | `super_secret_cron_token_32_chars` |
| `ASAAS_API_KEY` | Chave de API de Produção do Asaas | `$aact_YTU5YTE...` |
| `ASAAS_WEBHOOK_SECRET` | Assinatura de validação dos webhooks do Asaas | `asaas_whsec_...` |
| `ASAAS_ENVIRONMENT` | Ambiente Asaas (`production` ou `sandbox`) | `production` |
| `MERCADO_PAGO_ACCESS_TOKEN` | Access Token de Produção do Mercado Pago | `APP_USR-837482...` |
| `MERCADO_PAGO_WEBHOOK_SECRET` | Segredo para validação do header x-signature | `whsec_...` |
| `EVOLUTION_API_GLOBAL_URL` | URL base da sua instância Evolution API (WhatsApp) | `https://api.seuzap.com` |
| `EVOLUTION_API_GLOBAL_KEY` | Chave mestra da Evolution API | `ev_global_key_...` |

---

## 3. Configuração dos Gateways e Webhooks de Pagamento

Os pagamentos de reservas (sinais anti no-show) e mensalidades de planos VIP geram notificações instantâneas enviadas via Webhook para a plataforma.

### 3.1. Endpoints dos Webhooks
Configure nos painéis dos respectivos provedores:

1. **Mercado Pago**:
   - URL: `https://seusaas.com.br/api/webhooks/mercadopago`
   - Eventos: `payment.created`, `payment.updated`
2. **Asaas**:
   - URL: `https://seusaas.com.br/api/webhooks/asaas`
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `PAYMENT_REFUNDED`
3. **PagSeguro**:
   - URL: `https://seusaas.com.br/api/webhooks/pagseguro`
   - Eventos: Notificações de transação Pix e Cartão
4. **InfinitePay**:
   - URL: `https://seusaas.com.br/api/webhooks/infinitepay`
   - Eventos: `transaction.paid`, `transaction.failed`

### 3.2. Regras de Processamento de Webhook
- **Idempotência**: Todos os webhooks registram o `event_id` ou `state_hash` para evitar processamento duplicado de créditos ou ativações de planos.
- **Assinatura Criptográfica**: Requisições com falha na verificação de HMAC são sumariamente rejeitadas com HTTP 401.

---

## 4. Agendamento dos Cron Jobs (Automações em Segundo Plano)

A plataforma conta com 4 rotas de tarefas agendadas em `app/api/cron/`. Para executá-las em produção, crie o arquivo [`vercel.json`](file:///c:/Users/PC%20NOVO/Desktop/Site%20saas%20barbeiaria/vercel.json) na raiz do projeto com o agendamento do **Vercel Cron**:

```json
{
  "crons": [
    {
      "path": "/api/cron/expire-holds",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/booking-reminders",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/expire-retention",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/check-past-due",
      "schedule": "0 6 * * *"
    }
  ]
}
```

### Detalhes das Frequências:
1. **`/api/cron/expire-holds`**: Executado **a cada 1 minuto**. Cancela agendamentos provisórios onde `hold_expires_at < NOW()` e libera os horários para outros clientes.
2. **`/api/cron/booking-reminders`**: Executado **a cada 30 minutos**. Localiza clientes com agendamento marcado para as próximas 4 horas (janela entre 3h30 e 4h00) e envia mensagem no WhatsApp.
3. **`/api/cron/expire-retention`**: Executado **diariamente às 03:00 UTC (00:00 Horário de Brasília)**. Zera cartões de fidelidade sem renovação há mais de 30 dias e invalida créditos vencidos.
4. **`/api/cron/check-past-due`**: Executado **diariamente às 06:00 UTC (03:00 Horário de Brasília)**. Identifica barbearias com mensalidade vencida há mais de 5 dias e suspende o acesso ao sistema.

---

## 5. Checklist Pré-Deploy e Validação Final

Antes de apontar o tráfego final de produção, execute este checklist:

- [x] Migrações do banco aplicadas no Supabase de Produção (`supabase db push`).
- [x] Execução do seed de homologação e validação de permissões RLS.
- [x] Teste de integridade dos 5 fluxos críticos via `npx tsx scripts/test-critical-flows.ts` (15/15 testes aprovados).
- [x] Variáveis de ambiente configuradas no painel da Vercel.
- [x] Fallback Origin da Cloudflare apontado para `cname.vercel-dns.com` com Proxy ativado.
- [x] Configuração dos Webhooks nos painéis do Mercado Pago e Asaas com segredos correspondentes.
- [x] Deploy efetuado no Vercel com checagem dos logs do Vercel Cron.
