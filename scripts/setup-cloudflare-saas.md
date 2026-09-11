# Cloudflare for SaaS - Configuração e Automação de Domínios Customizados

Este guia detalha a configuração operacional e fornece scripts de automação para habilitar **Domínios Próprios (White-Label)** para as barbearias parceiras utilizando o **Cloudflare for SaaS (Custom Hostnames)**.

---

## 1. Visão Geral da Arquitetura

O Cloudflare for SaaS permite que qualquer barbearia aponte seu domínio próprio (ex: `agendamento.barbeariaexemplo.com.br` ou `barbeariaexemplo.com.br`) diretamente para o SaaS, com:
1. **Emissão e Renovação Automática de SSL/TLS** (Let's Encrypt / Google Trust Services).
2. **Preservação do Cabeçalho `Host` original**: O Next.js recebe o domínio do barbeiro e o middleware (`middleware.ts`) consulta a função `resolve_tenant_by_host()` no Supabase para carregar o tenant correto.
3. **Zero intervenção manual no servidor**: Nenhuma alteração de Nginx/Vercel é necessária ao cadastrar novos clientes.

```
[ Cliente Final ]
       │
       ▼ Acessa: https://agendamento.barbeariaexemplo.com.br
[ DNS do Barbeiro ] (CNAME agendamento -> cname.plataforma.com.br)
       │
       ▼
[ Cloudflare for SaaS Edge ] (SSL emitido automaticamente pela Cloudflare)
       │ (Proxy seguro repassando host original)
       ▼
[ Fallback Origin: app-origin.plataforma.com.br ]
       │ (CNAME -> cname.vercel-dns.com)
       ▼
[ Servidor Next.js (Vercel ou Self-Hosted) ]
       │
       ▼ middleware.ts: resolve_tenant_by_host('agendamento.barbeariaexemplo.com.br')
[ PWA White-label do Barbeiro carregado dinamicamente ]
```

---

## 2. Passo a Passo Inicial no Dashboard da Cloudflare

### 2.1. Configuração da Zona Raiz
1. Cadastre o domínio principal da sua plataforma SaaS na Cloudflare (ex: `barbersaas.com.br`).
2. Garanta que o status da zona esteja **Active** com os servidores DNS delegados.

### 2.2. Configurar o Fallback Origin (Origem Padrão)
1. No painel da Cloudflare da zona `barbersaas.com.br`, vá em **SSL/TLS** ➔ **Custom Hostnames** (ou **Cloudflare for SaaS**).
2. Clique no botão **Set up a Fallback Origin**.
3. Defina o subdomínio interno de fallback, por exemplo: `app-origin.barbersaas.com.br`.
4. Em **DNS Records**, crie o registro correspondente:
   - **Tipo**: `CNAME`
   - **Nome**: `app-origin`
   - **Target**: `cname.vercel-dns.com` (ou a URL de deploy Vercel do seu projeto)
   - **Proxy status**: `Proxied` (Nuvem Laranja ativada)
5. Salve e aguarde a validação do Fallback Origin (deve exibir o badge verde **Active**).

### 2.3. Criar o CNAME Público da Plataforma
Crie o registro CNAME que os barbeiros irão utilizar nas zonas deles:
- **Tipo**: `CNAME`
- **Nome**: `cname` (resultando em `cname.barbersaas.com.br`)
- **Target**: `app-origin.barbersaas.com.br`
- **Proxy status**: `Proxied` (Nuvem Laranja)

---

## 3. Instruções que o Barbeiro Deve Seguir no Provedor Dele

Ao cadastrar um domínio no painel da barbearia (ex: `app.barbeariadosilva.com.br`), o sistema exibe os registros DNS que ele precisa criar:

### Cenário 1: Subdomínio (Recomendado)
Exemplo: `agendamento.barbeariadoze.com.br` ou `app.barbeariadoze.com.br`
- **Tipo**: `CNAME`
- **Nome / Host**: `agendamento` (ou `app`)
- **Destino / Valor**: `cname.barbersaas.com.br`
- **TTL**: Automático (ou 3600)

### Cenário 2: Domínio Apex / Raiz
Exemplo: `barbeariadoze.com.br`
- Se o provedor DNS suportar **ALIAS / ANAME** ou **CNAME Flattening** (Cloudflare, Route 53, DNSimple):
  - **Tipo**: `ALIAS` / `ANAME`
  - **Nome**: `@`
  - **Destino**: `cname.barbersaas.com.br`
- Se o provedor for Registro.br sem suporte a CNAME na raiz:
  - Criar entrada CNAME `www` apontando para `cname.barbersaas.com.br`.
  - Configurar redirecionamento HTTP da raiz (`barbeariadoze.com.br`) para `www.barbeariadoze.com.br`.

---

## 4. Script de Automação via API da Cloudflare

Você pode automatizar a criação, consulta e exclusão de Custom Hostnames diretamente no seu backend ou via script CLI.

### 4.1. Variáveis Necessárias
Adicione no seu ambiente administrativo:
```env
CLOUDFLARE_API_TOKEN="seu_token_com_permissao_zone_custom_hostnames_edit"
CLOUDFLARE_ZONE_ID="id_da_sua_zona_na_cloudflare"
```

### 4.2. Script Utilitário TypeScript (`scripts/cloudflare-manager.ts`)

```typescript
import https from 'node:https'

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID

if (!CF_API_TOKEN || !CF_ZONE_ID) {
  console.error('❌ Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ZONE_ID')
  process.exit(1)
}

interface CustomHostnameResponse {
  success: boolean
  errors: Array<{ code: number; message: string }>
  result: {
    id: string
    hostname: string
    ssl: {
      status: string
      method: string
      type: string
      validation_records?: Array<{ txt_name: string; txt_value: string }>
    }
    status: string
    ownership_verification?: {
      name: string
      value: string
      type: string
    }
  }
}

/**
 * Cria um novo Custom Hostname na Cloudflare com SSL automático
 */
export async function createCustomHostname(hostname: string) {
  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames`
  
  const payload = JSON.stringify({
    hostname: hostname.toLowerCase().trim(),
    ssl: {
      method: 'http',
      type: 'dv',
      settings: {
        min_tls_version: '1.2',
        http2: 'on',
      },
    },
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: payload,
  })

  const data = (await res.json()) as CustomHostnameResponse
  return data
}

/**
 * Consulta o status de um Custom Hostname existente
 */
export async function getCustomHostnameStatus(hostnameId: string) {
  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${hostnameId}`
  
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  return await res.json()
}

/**
 * Remove um Custom Hostname ao desativar o plano ou excluir o tenant
 */
export async function deleteCustomHostname(hostnameId: string) {
  const url = `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/custom_hostnames/${hostnameId}`
  
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
  })

  return await res.json()
}
```

---

## 5. Exemplos de Comandos cURL Prontos para Teste

### 5.1. Registrar Novo Domínio Customizado
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/custom_hostnames" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "hostname": "agendamento.barbeariaexemplo.com.br",
    "ssl": {
      "method": "http",
      "type": "dv",
      "settings": {
        "min_tls_version": "1.2",
        "http2": "on"
      }
    }
  }'
```

### 5.2. Checar Status de Validação do Domínio e SSL
```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/custom_hostnames?hostname=agendamento.barbeariaexemplo.com.br" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json"
```

### 5.3. Deletar Custom Hostname
```bash
curl -X DELETE "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/custom_hostnames/CUSTOM_HOSTNAME_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 6. Solução de Problemas Comuns (Troubleshooting)

| Sintoma / Erro | Causa Mais Frequente | Solução Recomendada |
| :--- | :--- | :--- |
| **Status `pending_validation`** | O barbeiro ainda não criou o registro CNAME no DNS dele. | Solicite que o barbeiro adicione o registro CNAME apontando para `cname.barbersaas.com.br`. Após propagar, a Cloudflare valida automaticamente via HTTP token. |
| **Erro Cloudflare 1014 (CNAME Cross-User Ban)** | O barbeiro também usa Cloudflare na zona dele e tentou criar CNAME apontando para outra zona Cloudflare sem autorização. | O Cloudflare for SaaS resolve o erro 1014 nativamente desde que o domínio esteja cadastrado em **Custom Hostnames** da zona SaaS. |
| **Certificado SSL não emite** | Validação HTTP falhou porque o domínio ainda não aponta para o Cloudflare for SaaS. | Alternativamente, forneça os registros TXT de validação DCV (`_acme-challenge`) retornados pelo payload da API para o barbeiro inserir no DNS. |
| **Tenant Incorreto / 404** | O domínio cadastrado no Supabase (`tenants.custom_domain`) não coincide exatamente com o host acessado. | Certifique-se de salvar o domínio normalizado em minúsculas e sem protocolo (`https://` ou barras `/`). |
