# 🚀 Guia de Migração para Turso

## Pré-requisitos

- Node.js 14+ instalado
- Conta Turso ativa
- Credenciais Turso (URL e Token)

## Instalação

1. **Clone o repositório e instale dependências:**
   ```bash
   npm install
   ```

2. **Configure variáveis de ambiente:**
   ```bash
   # Crie um arquivo .env na raiz do projeto
   TURSO_CONNECTION_URL=libsql://clear-sky-salvatore24213.aws-us-east-1.turso.io
   TURSO_AUTH_TOKEN=seu_token_aqui
   JWT_SECRET=ECO_LAB_SECURE_2026
   PORT=3000
   NODE_ENV=production
   ```

3. **Inicie o servidor:**
   ```bash
   npm start
   ```

## Migração de Dados Existentes

Se você tem um banco SQLite3 local (`database.db`), execute:

```bash
node migrate-to-turso.js
```

Este script:
- Lê dados do SQLite local
- Insere no banco Turso
- Verifica integridade dos dados

## O que mudou?

### ✅ Mantido
- Todas as funcionalidades do sistema
- API endpoints são 100% compatíveis
- Interface frontend permanece igual
- Autenticação JWT funciona igual

### 🔄 Alterações
- **Banco de dados**: SQLite3 → Turso (LibSQL)
- **Dependência**: `sqlite3` → `@libsql/client`
- **Conexão**: Local → Cloud (AWS)
- **Escalabilidade**: Melhorada (cloud database)
- **Backup automático**: Turso faz isso por padrão

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `TURSO_CONNECTION_URL` | URL de conexão Turso | Obrigatória |
| `TURSO_AUTH_TOKEN` | Token de autenticação Turso | Obrigatória |
| `JWT_SECRET` | Chave para JWT | ECO_LAB_SECURE_2026 |
| `PORT` | Porta do servidor | 3000 |
| `NODE_ENV` | Ambiente | production |

## Verificação

Acesse `http://localhost:3000` e verifique:
- ✅ Login funciona
- ✅ Dados aparecem normalmente
- ✅ Operações CRUD funcionam
- ✅ Uploads de fotos funcionam

## Troubleshooting

### Erro de conexão Turso
- Verifique se URL e Token estão corretos
- Teste a conexão: `curl -H "Authorization: Bearer {token}" {url}`

### Tabelas não criadas
- Reinicie o servidor
- Verifique logs para erros de SQL

### Dados não sincronizam
- Turso tem replicação eventual (eventual consistency)
- Aguarde alguns segundos entre operações críticas

## Suporte

Documentação Turso: https://docs.turso.tech
Documentação LibSQL: https://github.com/libsql/libsql
