# Playbook de Lançamento Comercial e Operação em Campo

Este manual operacional foi elaborado para acelerar a aquisição, ativação e retenção das primeiras barbearias parceiras na plataforma SaaS, garantindo um processo de onboarding presencial ágil (menos de 10 minutos), um script comercial validado contra objeções reais e rotinas de contingência para suporte diário.

---

## 1. Checklist de Onboarding Presencial (Piloto em 10 Minutos)

O objetivo é sair da barbearia com o sistema **100% configurado, testado e com o QR Code no balcão**.

### Pré-requisitos
- 1 smartphone com conexão à internet (o celular do dono ou do barbeiro principal).
- Tabela básica de preços e horários da barbearia.

### Cronograma Minuto a Minuto

| Tempo | Ação Operacional | Tela / Recurso | Detalhes |
| :--- | :--- | :--- | :--- |
| **Min 0 - 2** | **Cadastro Inicial** | `/` ➔ Form Onboarding | Insira o nome da barbearia, WhatsApp e e-mail. Defina a senha do proprietário. |
| **Min 2 - 4** | **Identidade & Endereço** | `/dashboard/onboarding` (Etapa 1) | Confirme o nome fantasia, endereço com número e bairro. Adicione o WhatsApp comercial. |
| **Min 4 - 6** | **Equipe & Serviços** | `/dashboard/onboarding` (Etapas 2 e 3) | Cadastre o primeiro barbeiro e os 2 serviços mais comuns (ex: Corte R$ 50 - 35min, Barba R$ 35 - 30min). |
| **Min 6 - 7** | **Modo de Recebimento** | `/dashboard/onboarding` (Etapa 4) | Selecione **"Pagamento no Balcão"** (Taxa zero inicial) para eliminar qualquer atrito no primeiro dia. |
| **Min 7 - 8** | **Teste do Fluxo ao Vivo** | PWA do Cliente (`/[tenantSlug]`) | Faça você mesmo um agendamento teste pelo celular: escolha o barbeiro, selecione o horário e conclua em 2 cliques. |
| **Min 8 - 9** | **Baixa no Balcão** | `/dashboard/agenda` | Mostre ao barbeiro o horário recém-agendado na tela e simule o clique em **"Receber no Balcão"** (R$ 50 em dinheiro ou cartão). |
| **Min 9 - 10** | **Ativação dos Clientes** | WhatsApp & QR Code | Compartilhe o link do PWA no WhatsApp do dono e gere o QR Code para impressão no balcão de atendimento. |

---

## 2. Script de Abordagem Comercial (Pitch & Fechamento)

### 2.1. O Gancho Inicial (Foco na Dor Principal)
> *"Fala, [Nome do Barbeiro]! Deixa eu te fazer uma pergunta rápida: quantas vezes você já perdeu cliente porque estava cortando cabelo, o cliente mandou mensagem no WhatsApp querendo saber se tinha horário para agora, você demorou 1 hora para responder e ele já tinha cortado em outro lugar?"*

### 2.2. A Apresentação da Solução (O Contraste)
> *"A maioria dos aplicativos exige que o seu cliente baixe um app pesado na loja, crie conta com senha e confirme e-mail. Mais da metade dos clientes desiste no caminho.*
> 
> *Com a nossa plataforma, você coloca um link no seu Instagram e no WhatsApp. O cliente clica, o app abre direto no navegador sem senha, ele escolhe você, escolhe o horário das 16:30 e confirma em 2 toques. Pronto. Você não gasta 1 segundo digitando mensagem."*

### 2.3. O Fechamento com o Fechamento de Caixa Sem Papel
> *"E tem mais: sábado no final da tarde, em vez de você ficar com caderno e calculadora somando corte por corte para ver quanto tem que pagar para cada barbeiro da equipe, o sistema calcula sozinho comissão, dinheiro retido na mão de cada um e o Pix líquido exato que você precisa transferir. Zero discussão e zero erro."*

---

## 3. Matriz de Objeções Comuns e Respostas Práticas

### Objeção 1: *"Meus clientes são mais velhos ou acostumados com papel/WhatsApp"*
- **Resposta**: *"Exatamente por isso o sistema foi feito assim! Ele não é um app chato que pede para criar login e senha. É um link leve que parece uma conversa rápida. E se o cliente mais antigo chegar sem marcar, você clica em '+ Lançar Corte Avulso' no seu celular em 3 segundos e lança o corte dele normalmente."*

### Objeção 2: *"Tenho medo da internet cair e eu não conseguir ver minha agenda"*
- **Resposta**: *"O sistema foi construído como PWA com cache offline. A sua agenda do dia fica salva no navegador do celular. Mesmo que o sinal oscile por alguns minutos, você consegue consultar quem está marcado para a próxima hora sem desespero."*

### Objeção 3: *"Já uso outro sistema / planilha / caderninho"*
- **Resposta**: *"Vamos fazer um teste prático sem compromisso: eu configuro a sua barbearia agora em 5 minutos. Você usa por 7 dias em paralelo. Se você não economizar pelo menos 1 hora de mensagens por dia e não evitar horários ociosos, você continua no caderno sem gastar 1 real."*

---

## 4. Protocolo de Contingência e Suporte Operacional

### Cenário A: Falha Temporária de Conexão na Barbearia
1. Orientar o barbeiro a utilizar os dados móveis (4G/5G) do próprio celular (o PWA consome menos de 2MB por dia).
2. Atendimentos realizados durante a oscilação podem ser lançados via botão **"+ Lançar Corte Avulso"** assim que a rede restabelecer.
3. O histórico financeiro e o comissionamento são recalculados automaticamente na quitação.

### Cenário B: Troca de Maquininha de Cartão ou Conta Bancária do Barbeiro
1. Como o recebimento inicial ocorre via balcão físico, a troca de adquirente (Cielo, Stone, PagBank, Mercado Pago) **não afeta** a operação da plataforma.
2. O proprietário apenas seleciona a forma de pagamento `card_machine` ou `pix_tenant` no momento da quitação.
3. Se a barbearia utilizar cobrança de sinal Pix online, as credenciais podem ser atualizadas a qualquer momento em **Configurações ➔ Gateways**, com auditoria automática registrada em `audit_logs`.

### Cenário C: No-Show (Cliente não compareceu)
1. O barbeiro clica no agendamento e marca como **"Não Compareceu (No-Show)"**.
2. Se houve cobrança de sinal Pix antecipado:
   - Conforme configurado nas regras do tenant, o sinal é repassado integralmente ou dividido com o barbeiro como compensação pelo horário bloqueado.
   - O slot é liberado para novos clientes ou corte avulso de balcão.

### Cenário D: Tolerância e Carência de Fatura do SaaS
1. O SaaS possui uma política de carência de **5 dias** (`grace_period_days = 5`).
2. Se o barbeiro atrasar o pagamento da mensalidade Asaas, ele entra em status `past_due` com aviso amigável, sem bloqueio imediato dos agendamentos.
3. O bloqueio com redirecionamento para `/tenant-suspended` só é acionado pelo cron job se a tolerância de 5 dias expirar sem regularização.
