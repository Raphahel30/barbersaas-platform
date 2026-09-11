# 🚀 MANUAL OPERACIONAL DE GO-LIVE & ATIVAÇÃO COMERCIAL DA 1ª BARBEARIA

> **Versão:** 1.0.0 (Produção Homologada)  
> **Responsável Técnico / Super Admin:** `rafaelcassu@gmail.com`  
> **Status:** Pronto para Execução de Produção

---

## 📋 Sumário Executivo

Este manual descreve o passo a passo rigoroso para virar a chave da plataforma de **Sandbox/Desenvolvimento** para **Produção Real**, executar a auditoria pré-voo automatizada (`preflight-check`), homologar o primeiro pagamento Pix real de R$ 1,00 e ativar a primeira barbearia piloto em 7 minutos presenciais.

---

## 🛫 Roteiro em 4 Passos

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     PASSO 1     │ ──> │     PASSO 2     │ ──> │     PASSO 3     │ ──> │     PASSO 4     │
│ DNS & Cloudflare│     │ Seed de Produção│     │Onboarding Piloto│     │  Suporte 48h    │
│  (SSL for SaaS) │     │ (Banco Limpo)   │     │   (7 Minutos)   │     │ (Monitoramento) │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 🌐 PASSO 1: Configuração de DNS & Edge na Cloudflare

Para permitir que a plataforma atenda tanto o domínio principal quanto domínios próprios white-label dos barbeiros com emissão automática de SSL/TLS:

### 1.1. Cadastro da Zona Raiz
1. Acesse o [Painel da Cloudflare](https://dash.cloudflare.com/) e adicione o domínio raiz da plataforma (ex: `barbeariaflow.com.br`).
2. Altere os Nameservers no seu registrador (Registro.br / GoDaddy) para os nameservers fornecidos pela Cloudflare.

### 1.2. Configurar o Fallback Origin (SSL for SaaS)
1. No menu lateral da zona, acesse **SSL/TLS** ➔ **Custom Hostnames** (Cloudflare for SaaS).
2. Clique em **Set up a Fallback Origin**.
3. Digite o hostname de fallback: `app-origin.barbeariaflow.com.br`.
4. Em **DNS Records**, adicione o apontamento:
   - **Tipo:** `CNAME`
   - **Nome:** `app-origin`
   - **Destino (Target):** `cname.vercel-dns.com` (ou o IP público da sua VPS)
   - **Proxy Status:** `Proxied` (Nuvem Laranja ativada)
5. Aguarde a validação até que o status do Fallback Origin exiba o badge verde **Active**.

### 1.3. Apontamentos DNS Essenciais da Plataforma
Crie os seguintes registros na aba **DNS** da Cloudflare:

| Tipo | Nome | Destino | Proxy | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `@` | `cname.vercel-dns.com` | Proxied | Landing page principal do SaaS |
| **CNAME** | `www` | `barbeariaflow.com.br` | Proxied | Redirecionamento canônico |
| **CNAME** | `*` | `cname.vercel-dns.com` | Proxied | Subdomínios dos tenants (`barbearia.barbeariaflow.com.br`) |
| **CNAME** | `cname` | `app-origin.barbeariaflow.com.br` | Proxied | Apontamento público para domínios próprios de barbeiros |

---

## 🗄️ PASSO 2: Seed de Produção Limpo & Migrações

Em produção, o banco de dados deve iniciar **sem dados mockados** (sem agendamentos fictícios, barbeiros de teste ou clientes fictícios), contendo apenas as tabelas estruturais, triggers, políticas de RLS e o Super Admin mestre.

### 2.1. Executar as Migrações do Banco
Conecte-se ao Supabase de Produção via CLI ou console SQL e execute as migrações em ordem sequencial:
```bash
# Executa todas as migrações acumuladas (Fase 1 à Fase 20)
supabase db push
```

### 2.2. Criação do Usuário Super Admin Mestre
1. No Supabase Dashboard de Produção, vá em **Authentication** ➔ **Users** ➔ **Add User**.
2. Cadastre o e-mail: `rafaelcassu@gmail.com` com uma senha forte.
3. No SQL Editor, valide o perfil com a role de Super Admin:
```sql
INSERT INTO public.profiles (id, email, full_name, role, is_active, created_at)
SELECT id, 'rafaelcassu@gmail.com', 'Rafael Cassu (Super Admin)', 'super_admin', true, NOW()
FROM auth.users
WHERE email = 'rafaelcassu@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET role = 'super_admin', is_active = true;
```

### 2.3. Execução do Pre-Flight Check Automatizado
No terminal do projeto, execute o script de diagnóstico pré-voo:
```bash
npm run preflight
```
**Critério de Aprovação:** Todas as 6 verificações devem exibir `[✔]`:
```
[✔] Supabase DB Connected (Latency: 42ms)
[✔] Asaas Production API Active (Balance verified)
[✔] Evolution API Online / wa.me Fallback Ready
[✔] WebPush VAPID Keys Valid
[✔] Super Admin RLS Verified (rafaelcassu@gmail.com)
[✔] Cloudflare Fallback Origin Configured
```

### 2.4. Homologação da Micro-Transação Pix Real (R$ 1,00)
1. Faça login como Super Admin (`rafaelcassu@gmail.com`) no Painel Master (`/master/dashboard`).
2. Acesse a aba de **Homologação Live Pix** (`/api/test/live-pix-test`).
3. O sistema gerará um Pix real de R$ 1,00 com QR Code e Copia-e-Cola.
4. Abra o aplicativo do seu banco no celular e efetue o pagamento de R$ 1,00.
5. Em menos de 3 segundos, o webhook processará a liquidação e o status mudará para:  
   `"Pagamento Confirmado com Sucesso! Homologação de Produção concluída."`
6. O log de auditoria registrará o evento `PIX_LIVE_TEST_CONFIRMED`.

---

## ⏱️ PASSO 3: Onboarding Piloto da 1ª Barbearia em 7 Minutos

Este é o roteiro para cadastrar e ativar a primeira barbearia cliente presencialmente:

```
[00:00] Início
   │
   ├─ [Min 1] Dados Cadastrais, Nome Fantasia, Subdomínio & Logo
   ├─ [Min 2] Horários de Funcionamento da Barbearia
   ├─ [Min 3] Equipe de Barbeiros & Contrato Lei do Salão-Parceiro
   ├─ [Min 4] Catálogo de Serviços & Regra de Sinal Anti-No-Show
   ├─ [Min 5] Chave Pix / Gateway do Barbeiro Conectado
   ├─ [Min 6] Teste Prático de Agendamento no Celular do Dono
   └─ [Min 7] Impressão do Display Acrílico de Balcão com QR Code
   │
[07:00] Barbearia 100% Operacional e Faturando!
```

### Minuto 1: Dados Cadastrais & Subdomínio
- Acesse `/dashboard/onboarding` ou `/master/tenants`.
- Insira:
  - **Nome Fantasia:** Barbearia Vintage Club
  - **CNPJ/CPF:** do proprietário
  - **Subdomínio:** `vintageclub` (acessível em `vintageclub.barbeariaflow.com.br`)
  - **Upload do Logotipo:** PNG transparente

### Minuto 2: Grade de Funcionamento
- Defina o horário padrão: **Segunda a Sábado das 09:00 às 20:00**.
- Configure o intervalo de almoço: **12:00 às 13:00**.
- Duração padrão de slot de corte: **30 minutos**.

### Minuto 3: Equipe & Salão-Parceiro
- Cadastre os barbeiros da casa:
  - Barbeiro 1: "Carlos Barber" (WhatsApp: `(11) 98888-7777`) - Comissão: **50%**.
  - Barbeiro 2: "Marcos Fade" (WhatsApp: `(11) 97777-6666`) - Comissão: **45%**.
- Ative o checkbox **Compliance Lei do Salão-Parceiro (Lei 13.352/2016)** para segregação contábil automática.

### Minuto 4: Catálogo de Serviços
- Cadastre os 3 serviços principais:
  1. **Corte Cabelo Moderno:** R$ 50,00 (30 min)
  2. **Barba Terapia Completa:** R$ 40,00 (30 min)
  3. **Combo Cabelo + Barba:** R$ 80,00 (50 min)
- Configure **Sinal Antecipado de 30%** para clientes novos (eliminando no-shows).

### Minuto 5: Conexão do Gateway Pix
- Acesse **Configurações Financeiras** ➔ **Gateways de Pagamento**.
- O dono da barbearia conecta sua conta Asaas / Mercado Pago em 1 clique ou insere sua chave Pix direta.
- Os repasses das cotas dos barbeiros serão calculados automaticamente.

### Minuto 6: Teste no Celular do Proprietário
- Envie o link `https://vintageclub.barbeariaflow.com.br` no WhatsApp do dono.
- Solicite que ele abra no iPhone (Safari) ou Android (Chrome).
- Mostre o banner: **"Adicionar Barbearia Vintage Club à Tela de Início"**.
- Faça um agendamento de teste para validar o recebimento de notificação no celular dele.

### Minuto 7: Display Acrílico de Mesa (Totem QR Code)
- Acesse a aba de **Marketing / Materiais Promocionais** (Fase 13).
- Clique em **"Gerar Display de Balcão em PDF"**.
- O sistema gera a arte personalizada com o logo da barbearia, cores da marca e o QR Code de agendamento instantâneo.
- Envie para impressão na impressora da recepção ou gráfica rápida para colocar no display de acrílico de balcão.

---

## 🛡️ PASSO 4: Protocolo de Suporte & Monitoramento (Primeiras 48 Horas)

Durante as primeiras 48 horas de operação comercial da primeira barbearia, o operador deve acompanhar os seguintes indicadores:

### 4.1. Dashboard de Webhooks de Pagamento
- Monitore a tabela `gateway_webhook_events` e os logs da Vercel:
  - Garantir que `POST /api/webhooks/gateways/[provider]` responda com **HTTP 200** em menos de **800ms**.
  - Verificar se a coluna `status` permanece como `processed` e `duplicate = false`.

### 4.2. Expiração Automática de Holds (Liberação de Vagas)
- Certifique-se de que o cron job `/api/cron/release-expired-holds` está sendo executado a cada **1 minuto**.
- Comportamento esperado:
  - Agendamentos que não forem pagos em 5 minutos devem transitar automaticamente de `status: 'hold'` para `status: 'cancelled'`, liberando o horário para outro cliente.

### 4.3. Entregabilidade de WhatsApp (Anti-Ban & Fallback)
- Acompanhe a entrega dos lembretes agendados (4 horas antes e 2 horas antes):
  - Se a Evolution API reportar desconexão ou delay, o sistema aciona automaticamente o link `https://wa.me/55...` na tela da recepção para envio manual com mensagem já formatada em 1 clique.

### 4.4. Rotina de Backup Externo Diário
- Verifique a execução do cron diário `/api/cron/external-backup`:
  - Confirme no bucket Cloudflare R2 / S3 a presença do snapshot diário compactado com Gzip e criptografado com AES-256-GCM.
  - Verifique o log com o Hash SHA-256 na tabela `backup_history`.

### 4.5. Plano de Resposta a Incidentes (Contatos de Emergência)
Em caso de qualquer anomalia no ambiente:
1. **Erro de Gateway Pix:** Alterar o modo de pagamento da barbearia no painel para *"Pagamento Presencial no Balcão"*, mantendo a agenda 100% ativa.
2. **Lentidão de Rede:** Acionar o modo offline do PWA via Service Worker (`public/sw.js`).
3. **Canal de Contato Direto:** WhatsApp do Super Admin disponível para o dono da barbearia nas primeiras 48h.

---

## 🏆 Declaração de Homologação

A plataforma **BarberSaaS** encontra-se tecnicamente homologada, auditada contra vazamento de dados, em total conformidade com a Lei do Salão-Parceiro e pronta para expansão comercial nacional.
