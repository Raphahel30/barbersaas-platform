# Memória de decisões

## D-001 — 10/10/2026
- Decisão: usar o GitHub como ponto de organização enquanto a pasta local não está acessível.
- Motivo: preservar contexto, plano e histórico sem deploy.
- Escopo: documentação e auditoria somente.
- Não autoriza: alterações em produção, Supabase ou deploy.

## D-002 — 10/10/2026
- Decisão: distinguir implementado, validado, estabilizado e publicado.
- Motivo: existência de código não comprova funcionamento.
- Regra: só promover status com evidência correspondente.

## D-003 — 10/10/2026
- Decisão: trabalhar exclusivamente no Navalio SaaS.
- Motivo: evitar mistura com Barbearia Emaús, Quiropraxia ou outros projetos.

## D-004 — 12/10/2026
- Decisão: não alterar ainda a assinatura nem o cálculo de preço da RPC `create_appointment_hold_atomic`.
- Evidência: no remoto, somente `service_role` executa a RPC; `anon` e `authenticated` não possuem grant. No aplicativo, o único consumidor é `app/actions/booking.ts`, a entrada pública não aceita preço/sinal e ambos são recalculados a partir de serviços e benefícios consultados pelo servidor.
- Motivo: o preço final combina yield, aniversário, VIP, fidelidade e mensalista. Recalcular apenas o preço-base no banco invalidaria descontos legítimos; aceitar um desconto total arbitrário apenas deslocaria a mesma confiança.
- Regra: qualquer novo consumidor da RPC deve usar o mesmo motor canônico ou introduzir um contrato de cotação verificável no banco, com teste de preço manipulado em banco descartável.
- Risco residual: `service_role` ainda consegue fornecer valores arbitrários; credencial comprometida ou consumidor privilegiado incorreto pode gerar preço divergente.
- Custo se a decisão estiver errada: será necessário versionar uma nova RPC com decomposição verificável de todos os descontos e migrar consumidores em conjunto.

## D-005 — 12/10/2026 — Gateways por barbearia
- Decisão: cada proprietário escolhe um gateway ativo entre Asaas, PagSeguro e Mercado Pago para cobrar seus clientes.
- Separação: a assinatura da barbearia junto ao Navalio usa um gateway central da plataforma, independente do gateway escolhido pelo tenant.
- Regra: credenciais, webhooks, idempotência e pagamentos dos clientes devem permanecer tenant-scoped; credenciais da plataforma nunca podem ser reutilizadas pelo tenant.
- Estado: requisito definido; Asaas possui estrutura existente, PagSeguro e Mercado Pago ainda precisam de auditoria/implementação.

## D-006 — 12/10/2026 — Plano mensal único
- Decisão: VIP e mensalista representam um único produto comercial, chamado **Mensalista**.
- Configuração: o proprietário cria os planos mensais e define serviços incluídos, quantidades e frequência/intervalo de uso.
- Exemplos: quatro cortes mensais, um corte por semana, um corte a cada duas semanas, ou pacote com corte, barba e sobrancelha.
- Regra: cada utilização deve consumir o benefício correto de forma atômica; o sistema não deve manter dois cadastros comerciais concorrentes para o mesmo conceito.
- Estado: requisito definido; o banco atual possui estruturas separadas que devem ser reconciliadas por migration segura, sem apagar assinaturas existentes.

## D-007 — 12/10/2026 — Cancelamentos e lista de espera
- Decisão: o cliente pode cancelar o próprio agendamento conforme as regras de cancelamento já implementadas.
- Lista de espera: o cliente não remove diretamente sua entrada; a equipe autorizada do tenant executa essa operação.
- Regra: não confundir cancelamento de appointment com remoção de waitlist.

## D-008 — 12/10/2026 — Prioridades de produto
- Decisão: Totem, TV, Presente e Estilo/Visagismo ficam fora do caminho crítico de lançamento e podem ser concluídos posteriormente.
- Decisão: filiais e franquias fazem parte do produto esperado antes do lançamento, com liberação para testes progressivos.
- Regra: funcionalidades adiadas não devem bloquear os fluxos centrais nem receber refatorações incidentais.

## D-009 — 12/10/2026 — Permissão configurável da recepção
- Decisão: recepcionistas administram agenda, clientes, lista de espera e pagamentos operacionais.
- Financeiro: dados e configurações sensíveis do proprietário ficam bloqueados por padrão; o proprietário pode conceder explicitamente permissão adicional para visualização.
- Regra: a permissão deve ser server-side, tenant-scoped, auditável e negar por padrão; esconder componentes na interface não é autorização.

## D-010 — 12/10/2026 — Publicação do Builder
- Decisão: alterações seguem o fluxo rascunho → preview → confirmação → publicação.
- Regra: editar rascunho não pode alterar imediatamente o site público; deve existir referência à última versão publicada e possibilidade de rollback.

## D-011 — 12/10/2026 — Bucket canônico de galeria pendente
- Decisão provisória: não remover nem migrar o bucket `gallery` até mapear todos os consumidores e objetos existentes.
- Estado atual: a Server Action corrigida grava novas mídias em `barbershop-media`; a finalidade residual de `gallery` ainda não foi confirmada.
- Regra: nenhuma exclusão ou consolidação de bucket sem inventário, estratégia de migração e teste de URLs existentes.
