# Matriz de Configuração e Homologação de Webhooks

Este documento detalha todos os endpoints de Webhooks suportados pela plataforma, as estruturas de payload JSON, os requisitos de autenticação e os comandos cURL para testes locais e em ambiente de homologação/produção.

---

## 1. Visão Geral da Matriz de Webhooks

A plataforma possui duas camadas distintas de webhooks:

1. **Camada SaaS (Assinatura das Barbearias na Plataforma)**:
   - Gerenciada centralmente via **Asaas**.
   - Notifica pagamentos de planos mensais/anuais contratados pelos donos de barbearia.
   - Atualiza o status do tenant (`active`, `past_due`, `suspended`).

2. **Camada de Atendimento (Barbearia ➔ Cliente Final)**:
   - Gerenciada individualmente por tenant através de múltiplos gateways suportados (**Asaas**, **Mercado Pago**, **Efí Bank**, **InfinitePay**).
   - Notifica o pagamento de taxas de reserva de agendamentos (Pix/Cartão) e comandas de balcão.
   - Atualiza o status do agendamento de `hold`/`pending_payment` para `confirmed` e envia confirmação por WhatsApp.

---

## 2. Endpoints da Plataforma

| Rota | Provedor | Autenticação / Header | Finalidade Principal |
| :--- | :--- | :--- | :--- |
| `POST /api/webhooks/asaas-saas` | Asaas (Plataforma) | `asaas-access-token: <ASAAS_WEBHOOK_TOKEN>` | Ativação, renovação e bloqueio de assinaturas dos barbeiros na plataforma. |
| `POST /api/webhooks/gateways/asaas` | Asaas (Tenant) | `asaas-access-token: <TOKEN_TENANT>` | Confirmação de taxa de reserva e checkout de balcão do cliente final. |
| `POST /api/webhooks/gateways/mercadopago` | Mercado Pago | `x-signature: <HMAC_SIGNATURE>` | Confirmação de pagamentos Pix/Cartão via Mercado Pago. |
| `POST /api/webhooks/gateways/efi` | Efí Bank (Gerencianet) | Validação mTLS / Client Token | Pix dinâmico de reserva de horário via Efí Bank. |
| `POST /api/webhooks/gateways/infinitepay` | InfinitePay | Header de assinatura / API Secret | Recebimento de vendas de balcão via maquininha e Smart Checkout. |

---

## 3. Payloads Simulados (Mocks JSON)

### 3.1. Asaas SaaS: Pagamento Recebido (`PAYMENT_RECEIVED`)
Disparado quando a mensalidade de um barbeiro é liquidada via Pix, Boleto ou Cartão de Crédito.

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "object": "payment",
    "id": "pay_987654321098",
    "customer": "cus_0000054321",
    "subscription": "sub_1122334455",
    "installment": null,
    "paymentDate": "2026-09-10",
    "clientPaymentDate": "2026-09-10",
    "installmentNumber": null,
    "invoiceUrl": "https://www.asaas.com/i/987654321098",
    "invoiceNumber": "0098765",
    "externalReference": "tenant_sub_9c13f631-01f6-4ef3-99b8-b80894080a8f",
    "value": 149.90,
    "netValue": 147.91,
    "billingType": "PIX",
    "status": "RECEIVED",
    "description": "Assinatura Plano Pro - SaaS Barbearia",
    "confirmedDate": "2026-09-10",
    "canBePaidAfterDueDate": true
  }
}
```

### 3.2. Asaas SaaS: Mensalidade Vencida (`PAYMENT_OVERDUE`)
Disparado quando a fatura ultrapassa a data de vencimento sem liquidação.

```json
{
  "event": "PAYMENT_OVERDUE",
  "payment": {
    "object": "payment",
    "id": "pay_987654321098",
    "customer": "cus_0000054321",
    "subscription": "sub_1122334455",
    "dueDate": "2026-09-05",
    "externalReference": "tenant_sub_9c13f631-01f6-4ef3-99b8-b80894080a8f",
    "value": 149.90,
    "billingType": "BOLETO",
    "status": "OVERDUE",
    "description": "Assinatura Plano Pro - SaaS Barbearia"
  }
}
```

### 3.3. Gateway do Tenant: Taxa de Reserva Pix Paga (`PAYMENT_RECEIVED`)
Disparado pelo gateway do barbeiro quando o cliente final paga o Pix para garantir o horário na agenda.

```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_pix_reserva_443322",
    "customer": "cus_cliente_final_99",
    "value": 30.00,
    "netValue": 29.50,
    "billingType": "PIX",
    "status": "RECEIVED",
    "externalReference": "appt_e5a2b1c4-9876-4321-b1a2-3c4d5e6f7a8b",
    "description": "Taxa de Reserva - Corte Degrade e Barba",
    "confirmedDate": "2026-09-10T21:30:00Z"
  }
}
```

---

## 4. Comandos cURL para Teste e Validação

### 4.1. Teste de Pagamento da Assinatura do SaaS (Localhost)
Simula a ativação de um tenant com o token definido em `process.env.ASAAS_WEBHOOK_TOKEN`:

```bash
curl -X POST "http://localhost:3000/api/webhooks/asaas-saas" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: sua_chave_secreta_webhook_aqui" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_test_local_001",
      "subscription": "sub_test_local_001",
      "externalReference": "tenant_sub_9c13f631-01f6-4ef3-99b8-b80894080a8f",
      "value": 99.00,
      "billingType": "PIX",
      "status": "RECEIVED"
    }
  }'
```

### 4.2. Teste de Inadimplência do SaaS (Localhost)
Simula a notificação de atraso para transicionar o tenant para `past_due`:

```bash
curl -X POST "http://localhost:3000/api/webhooks/asaas-saas" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: sua_chave_secreta_webhook_aqui" \
  -d '{
    "event": "PAYMENT_OVERDUE",
    "payment": {
      "id": "pay_test_local_001",
      "externalReference": "tenant_sub_9c13f631-01f6-4ef3-99b8-b80894080a8f",
      "value": 99.00,
      "status": "OVERDUE"
    }
  }'
```

### 4.3. Teste de Confirmação de Taxa de Reserva Pix (Localhost)
Simula a confirmação de agendamento no gateway do tenant:

```bash
curl -X POST "http://localhost:3000/api/webhooks/gateways/asaas" \
  -H "Content-Type: application/json" \
  -H "asaas-access-token: token_configurado_no_tenant" \
  -d '{
    "event": "PAYMENT_RECEIVED",
    "payment": {
      "id": "pay_booking_fee_888",
      "externalReference": "appt_e5a2b1c4-9876-4321-b1a2-3c4d5e6f7a8b",
      "value": 25.00,
      "billingType": "PIX",
      "status": "RECEIVED"
    }
  }'
```

---

## 5. Diretrizes de Segurança e Boas Práticas em Produção

1. **Idempotência**:
   - Todo processamento de webhook verifica se o identificador externo (`payment.id`) já foi registrado na tabela `payment_transactions`.
   - Se a transação já constar com status `'completed'` ou `'received'`, o processador retorna HTTP 200 imediatamente sem duplicar saldos ou acúmulo de fidelidade.

2. **Tempo de Resposta Rápido (HTTP 200)**:
   - Os gateways exigem resposta em até 5 segundos. Qualquer falha de timeout provoca retentativas automáticas em loop.
   - O processamento secundário (como envio de WhatsApp) é executado de forma não bloqueante ou via fila em background.

3. **Validação Estrita de Headers**:
   - Requisições sem o header `asaas-access-token` ou com valor discrepante do configurado são rejeitadas com `HTTP 401 Unauthorized`.

4. **Registro de Auditoria**:
   - Todas as requisições recebidas gravam payload e status na tabela de auditoria financeira (`financial_audit_logs`) para resolução de eventuais divergências contábeis.
