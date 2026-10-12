# Navalio — matriz de permissões por papel

Data: 2026-10-12. Estado: contrato definido; parte protegida por testes estáticos, validação integrada A/B ainda pendente.

## Contrato desejado

| Capacidade | Visitante | Cliente | Barbeiro | Recepcionista | Proprietário | Super Admin |
|---|---:|---:|---:|---:|---:|---:|
| Ver site, catálogo e disponibilidade pública | Sim | Sim | Sim | Sim | Sim | Sim |
| Criar agendamento/entrar na espera | Sim, validado | Sim | Sim | Sim | Sim | Sim |
| Ver/cancelar o próprio agendamento | Via fluxo seguro | Sim | Não por identidade de cliente | Não por identidade de cliente | Não por identidade de cliente | Suporte excepcional |
| Ver as próprias indicações | Não | Sim | Não | Não | Não | Suporte excepcional |
| Agenda, clientes e espera do tenant | Não | Não | Operação | Operação | Total | Total |
| Pagamentos operacionais do tenant | Não | Próprios | Conforme operação | Sim | Total | Total |
| Marketing e estatísticas do tenant | Não | Não | Não | Não por padrão | Sim | Sim |
| Configurar gateway, repasses e financeiro sensível | Não | Não | Não | Não por padrão | Sim | Sim |
| Publicar Builder | Não | Não | Não | Não por padrão | Rascunho → preview → confirmação | Sim |
| Administrar outros tenants/plataforma | Não | Não | Não | Não | Não | Sim |

## Regras invariantes

1. Toda Server Action que usa `createAdminClient()` deve autorizar usuário, papel e tenant antes de ler ou alterar dados.
2. O papel vem de `profiles.role`; e-mail e metadata editável não concedem privilégio.
3. Cliente só acessa seus próprios recursos, salvo fluxo público explicitamente desenhado e validado.
4. Recepcionista tem operação diária; financeiro sensível permanece negado até existir permissão granular concedida pelo proprietário.
5. Proprietário só administra o próprio tenant e suas unidades. Super Admin é o único papel transversal.
6. Nenhum módulo marcado como concluído pode ter seu contrato alterado sem teste de regressão, justificativa e atualização da memória.

## Situação comprovada nesta rodada

- CRM/confiança de clientes: protegido para equipe do tenant.
- Campanhas, filas e amostras de público: protegidas para proprietário do tenant.
- Configuração de split/repasses: leitura e escrita protegidas para proprietário.
- Indicações do tenant: protegidas para proprietário.
- Indicações do cliente: próprio cliente ou equipe do tenant.
- Waitlist e galeria: já possuem guardas tenant-scoped preparados em lote anterior.

## Pendências antes de certificar

- Executar matriz negativa com visitante, cliente, barbeiro, recepcionista, proprietário e Super Admin em banco descartável.
- Modelar a concessão granular opcional de financeiro para recepcionista; não ampliar o papel inteiro.
- Aplicar migrations somente após revisão e backup; o Supabase remoto não foi modificado nesta rodada.
- Revisar as demais Server Actions administrativas até zerar acessos com service role sem guarda explícita.

