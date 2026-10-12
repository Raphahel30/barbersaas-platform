# Matriz inicial de necessidades do Navalio

Auditoria documental/remota em 10/10/2026. “Existe” significa presença no GitHub, não validação.

| Área | Existe | Necessidade para conclusão | Evidência exigida |
|---|---:|---|---|
| Baseline Git | Parcial | Comparar pasta local, commits e arquivos não enviados | relatório local/remoto |
| CI | Documento apenas | Confirmar/criar workflow real em `.github/workflows` | run verde no commit |
| Node | Parcial | Fixar Node 20 e confirmar scripts | versões + comandos |
| Typecheck/lint | Incompleto | Confirmar comandos funcionais; `next lint` pode não cobrir o esperado | execução reproduzível |
| Build | Sim como script | Executar no baseline | log e commit |
| E2E | 3 specs | Executar desktop/mobile; ampliar matriz crítica | relatório Playwright |
| Preflight | Sim | Remover falsos verdes e separar teste/produção | testes do preflight |
| Supabase | Muitas migrations | Comparar histórico/objetos remotos sem repair cego | matriz de equivalência |
| Multi-tenant/RLS | Código/migrations | Testar tenant A/B e papéis | testes negativos |
| Booking atômico | Código/migration | Confirmar fee/status, concorrência e falha fechada | testes transacionais |
| Mensalistas | Existe | Garantir débito único e saldo não negativo | teste concorrente |
| Pagamento | Parcial | Gateway por tenant (Asaas/PagSeguro/Mercado Pago), cobrança Navalio separada, polling autorizado e idempotência | mocks/sandbox por provedor |
| Webhooks | Docs/código | Confirmar assinatura, replay e isolamento | testes duplicados/inválidos |
| Storage | Existe | Confirmar paths e policies tenant-scoped | matriz A/B |
| Builder | Existe | Validar rascunho→preview→confirmação→publicação→storefront | E2E e rollback |
| CRM/operação | Existe | Verificar CRUD, vínculos e estados vazios | testes por papel |
| Master Admin | Existe | Confirmar isolamento e ações privilegiadas | testes negativos |
| Mensalistas | Estruturas duplicadas | Unificar VIP/mensalista preservando dados; benefícios por serviço, quantidade e frequência | migration + consumo concorrente |
| Recepção | Parcial | Permissão operacional padrão e financeiro opcional concedido pelo proprietário | matriz por papel/tenant |
| Filiais/franquias | Existe | Levar ao lançamento com testes progressivos de isolamento/consolidação | E2E multiunidade |
| WhatsApp | Parcial | Separar Evolution online de fallback wa.me | health real/sandbox |
| Web Push | Parcial | Validar VAPID e entrega sem expor chaves | teste controlado |
| Domínios/Cloudflare | Docs/scripts | Validar configuração sem mudança prematura | checklist e DNS |
| PWA/mobile | Existe | Instalação, offline limitado e responsividade | dispositivos/emulação |
| Observabilidade | Parcial | Logs sanitizados, correlação e alertas | cenário de falha |
| Backup/rollback | Schema/docs | Testar restauração em ambiente descartável | relatório de restore |
| Deploy | Suspenso | Definir alternativa de teste local/túnel; publicar só com autorização | checklist final |

## Achados já confirmados na documentação
- A branch `main` remota auditada estava no commit `60dcdc70...`.
- Não havia workflow ativo em `.github` na consulta; havia somente um YAML documentado em `docs/`.
- O preflight considera fallback `wa.me` como “pronto”, mesmo sem provar Evolution online.
- O preflight pode emitir “100% pronto” baseado em checagens de configuração, sem executar a matriz crítica.
- Há e-mail de Master Admin fixo no script de preflight; deve ser tratado como configuração/decisão, não regra universal silenciosa.
- Buscas remotas por TODO/FIXME retornaram índice incompleto; ausência de resultado não prova ausência de pendências.
