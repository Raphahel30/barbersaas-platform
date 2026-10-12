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
