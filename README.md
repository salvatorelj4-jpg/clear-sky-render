# 🚀 Clear Sky Render - Sistema de Gerenciamento Stalkers (Turso Cloud DB)

Sistema desenvolvido em **Express.js** com **Turso (LibSQL)** como banco de dados cloud.

## 📋 Requisitos

- Node.js 18.x+
- Turso Database Account (libsql)
- Express.js 4.18+

## ⚙️ Variáveis de Ambiente

Configure as seguintes variáveis no Render:

```
TURSO_CONNECTION_URL=libsql://clear-sky-salvatore24213.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=seu_token_aqui
JWT_SECRET=ECO_LAB_SECURE_2026
PORT=3000
NODE_ENV=production
```

## 🔧 Configuração no Render

### 1. Criar novo Web Service
1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em "New +" → "Web Service"
3. Conecte seu repositório GitHub: `salvatorelj4-jpg/clear-sky-render`

### 2. Configurar o serviço
- **Name**: clear-sky-render
- **Environment**: Node
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free ou Paid (conforme preferência)

### 3. Adicionar Environment Variables
No Render, em "Environment":
```
TURSO_CONNECTION_URL=libsql://clear-sky-salvatore24213.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9...
JWT_SECRET=ECO_LAB_SECURE_2026
NODE_ENV=production
PORT=3000
```

### 4. Deploy
Salve as configurações e o Render fará deploy automaticamente.

## 📡 Endpoints da API

### 🔐 Autenticação
- `POST /api/login` - Login de usuário

### 👥 Stalkers
- `GET /api/stalkers` - Listar stalkers
- `POST /api/stalkers` - Criar stalker
- `PUT /api/stalkers/:id` - Atualizar stalker
- `DELETE /api/stalkers/:id` - Deletar stalker
- `POST /api/stalkers/:id/banir` - Banir stalker
- `POST /api/stalkers/:id/perdoar` - Perdoar stalker

### 📊 Estatísticas
- `GET /api/estatisticas` - Dados do dashboard

### 🎓 Pesquisas
- `GET /api/pesquisas` - Listar pesquisas
- `POST /api/pesquisas` - Criar pesquisa
- `PUT /api/pesquisas/:id` - Atualizar pesquisa
- `DELETE /api/pesquisas/:id` - Deletar pesquisa

### 🗂️ Itens
- `GET /api/itens` - Listar itens
- `POST /api/itens` - Criar item
- `PUT /api/itens/:id` - Atualizar item
- `DELETE /api/itens/:id` - Deletar item
- `POST /api/itens/importar` - Importar carga oficial

### 🎯 Missões
- `GET /api/missoes` - Listar missões ativas
- `POST /api/missoes` - Criar missão
- `PUT /api/missoes/:id` - Atualizar missão
- `PUT /api/missoes/:id/atribuir` - Atribuir stalker
- `POST /api/missoes/:id/concluir_individual/:stalker_id` - Concluir para stalker
- `DELETE /api/missoes/:id` - Deletar missão

### 📋 Relatórios
- `GET /api/relatorios` - Listar relatórios
- `POST /api/relatorios` - Criar relatório
- `PUT /api/relatorios/:id` - Atualizar relatório
- `DELETE /api/relatorios/:id` - Deletar relatório

### 👨‍💼 Membros
- `GET /api/membros` - Listar membros
- `POST /api/membros` - Criar membro
- `PUT /api/membros/:id` - Atualizar membro
- `DELETE /api/membros/:id` - Deletar membro

### ⚙️ Configurações
- `GET /api/config/taxas` - Obter taxas de comércio
- `PUT /api/config/taxas` - Atualizar taxas

## 🗄️ Banco de Dados Turso

### Tabelas
- **usuarios** - Usuários do sistema
- **stalkers** - Agentes rastreados
- **historico** - Histórico de ações
- **itens** - Inventário
- **missoes** - Missões do sistema
- **pesquisas** - Pesquisas científicas
- **relatorios** - Relatórios oficiais
- **configuracoes** - Configurações do sistema

## 🔑 Credenciais Padrão
- **Usuário**: admin
- **Senha**: 25072507

## 📦 Upload de Arquivos
- Diretório: `/uploads/`
- Tipos: PNG, JPG, JPEG, GIF
- Limite: Configurável via multer

## 🚨 Troubleshooting

### "Cannot find module '@libsql/client'"
```bash
npm install @libsql/client
```

### "Erro de conexão Turso"
- Verifique `TURSO_CONNECTION_URL`
- Verifique `TURSO_AUTH_TOKEN`
- Teste no [Turso Console](https://console.turso.tech)

### "Tabelas não criadas"
- Restart do app no Render
- Verifique logs: Menu → Logs

### Port já em uso (local)
```bash
PORT=3001 npm start
```

## 📚 Documentação
- [Turso Docs](https://docs.turso.tech)
- [LibSQL](https://github.com/libsql/libsql)
- [Express.js](https://expressjs.com)

## 🔄 Deploy com GitHub Actions (Opcional)

Criar `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Render
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: curl https://api.render.com/deploy/${{ secrets.RENDER_DEPLOY_HOOK }}
```

## 📞 Suporte

Para problemas, verifique:
1. Render Logs (Menu → Logs)
2. Status Turso (https://status.turso.tech)
3. GitHub Issues

---

**Status**: ✅ Em Produção | **Banco**: Turso (Cloud) | **Host**: Render.com
