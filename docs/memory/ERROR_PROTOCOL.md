# Protocolo permanente de erros e regressões

## Objetivo
Transformar cada falha em conhecimento verificável e em proteção automática quando possível.

## Registro
Adicionar em `INCIDENTS.md`:

### ERR-AAAA-NNN — título
- Data/hora:
- Commit/branch:
- Ambiente:
- Sintoma:
- Ação/comando:
- Esperado:
- Obtido:
- Erro mínimo sanitizado:
- Impacto:
- Hipóteses:
- Causa raiz:
- Tentativas e resultados:
- Correção:
- Arquivos/objetos:
- Teste preventivo:
- Evidência:
- Rollback:
- Risco residual:
- Status: aberto / mitigado / validado / encerrado.

## Regras
1. Nunca registrar segredo ou PII.
2. Hipótese não é causa raiz.
3. Falha intermitente continua aberta até haver explicação ou mitigação comprovada.
4. Correção sem teste fica “mitigada”, não “validada”.
5. Regressão deve referenciar o incidente anterior e explicar por que a proteção falhou.
6. Um teste removido exige decisão registrada.
7. Erros de ferramenta, ambiente e produto recebem categorias separadas.
8. Atualizar o incidente no mesmo PR da correção.

## Retorno para futuras modificações
Antes de alterar um fluxo:
- pesquisar incidentes pelos módulos/arquivos;
- reler testes preventivos;
- listar contratos protegidos;
- rodar o teste que cobre o incidente;
- depois da mudança, rodá-lo novamente.
