const express = require('express');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const dotenv = require('dotenv');

// Carregar variáveis de ambiente
dotenv.config();

if (!fs.existsSync('./uploads')) { fs.mkdirSync('./uploads'); }

const app = express();
const SECRET = process.env.JWT_SECRET || "ECO_LAB_SECURE_2026";

// ===================================================
// INICIALIZAR CLIENTE TURSO
// ===================================================
const db = createClient({
    url: process.env.TURSO_CONNECTION_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ===================================================
// INICIALIZAR SCHEMA DO BANCO DE DADOS
// ===================================================
async function inicializarBD() {
    try {
        // Criar tabelas se não existirem
        await db.execute(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                usuario TEXT UNIQUE,
                senha TEXT,
                role TEXT
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS stalkers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                codinome TEXT,
                faccao TEXT,
                foto TEXT,
                reputacao INTEGER DEFAULT 0,
                vendas_seguidas INTEGER DEFAULT 0,
                presencas INTEGER DEFAULT 0,
                rumores TEXT,
                ultimo_checkin TEXT,
                area_atuacao TEXT,
                aliados TEXT,
                inimigos TEXT,
                relacoes_faccoes TEXT,
                status_lista_negra INTEGER DEFAULT 0,
                motivo_lista_negra TEXT
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                stalker_id INTEGER,
                alteracao INTEGER,
                motivo TEXT,
                data DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (stalker_id) REFERENCES stalkers(id)
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS itens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT,
                preco_base REAL,
                nivel_piaget INTEGER DEFAULT 1,
                categoria TEXT DEFAULT 'Equipamentos',
                foto TEXT DEFAULT 'default.jpg'
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS missoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT,
                descricao TEXT,
                recompensa_rep INTEGER,
                recompensa_ru REAL,
                recompensa_item TEXT,
                status TEXT DEFAULT 'ATIVA',
                stalker_id INTEGER,
                stalkers_ids TEXT DEFAULT '[]',
                concluidos_ids TEXT DEFAULT '[]',
                dificuldade TEXT DEFAULT 'Fácil',
                temporaria INTEGER DEFAULT 0,
                FOREIGN KEY (stalker_id) REFERENCES stalkers(id)
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS relatorios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                numero TEXT,
                autor TEXT,
                membros TEXT,
                objetivo TEXT,
                col1 TEXT,
                col2 TEXT,
                col3 TEXT,
                editado_por TEXT,
                data DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS pesquisas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT,
                classificacao TEXT,
                descricao TEXT,
                autor TEXT,
                data DATETIME DEFAULT CURRENT_TIMESTAMP,
                foto TEXT DEFAULT 'default.jpg'
            )
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS configuracoes (
                chave TEXT PRIMARY KEY,
                valor TEXT
            )
        `);

        // Inserir admin padrão
        const pass = bcrypt.hashSync('25072507', 10);
        await db.execute(
            `INSERT OR IGNORE INTO usuarios (nome, usuario, senha, role) VALUES (?, ?, ?, ?)`,
            ['Administrador', 'admin', pass, 'admin']
        );

        console.log('✅ Banco de dados Turso inicializado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao inicializar banco de dados:', error);
    }
}

// Middleware de autenticação
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).send("Acesso Negado");
    jwt.verify(token, SECRET, (err, user) => {
        if (err) return res.status(401).send("Token inválido");
        req.user = user;
        next();
    });
};

app.get('/', (req, res) => res.redirect('/dashboard.html'));

// ===================================================
// AUTENTICAÇÃO
// ===================================================
app.post('/api/login', async (req, res) => {
    try {
        const { usuario, senha } = req.body;
        const result = await db.execute('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
        const user = result.rows[0];

        if (user && bcrypt.compareSync(senha, user.senha)) {
            const roleCorreto = String(user.role).toLowerCase();
            const token = jwt.sign({ id: user.id, role: roleCorreto, nome: user.nome }, SECRET);
            res.json({ token, role: roleCorreto, nome: user.nome });
        } else {
            res.status(401).send("Erro");
        }
    } catch (error) {
        console.error('Erro login:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// ESTATÍSTICAS
// ===================================================
app.get('/api/estatisticas', auth, async (req, res) => {
    try {
        const r1 = await db.execute('SELECT COUNT(*) as total FROM stalkers WHERE status_lista_negra = 0');
        const r2 = await db.execute('SELECT codinome, reputacao FROM stalkers WHERE status_lista_negra = 0 ORDER BY reputacao DESC LIMIT 1');
        const r3 = await db.execute('SELECT COUNT(*) as total FROM missoes WHERE status = "ATIVA"');
        const r4 = await db.execute('SELECT COUNT(*) as total FROM itens');

        res.json({
            totalStalkers: r1.rows[0]?.total || 0,
            topStalker: r2.rows[0]?.codinome || 'N/A',
            missoesAtivas: r3.rows[0]?.total || 0,
            totalItens: r4.rows[0]?.total || 0
        });
    } catch (error) {
        console.error('Erro estatísticas:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// PRESENÇA
// ===================================================
app.post('/api/presenca', auth, async (req, res) => {
    try {
        const { stalker_id } = req.body;
        const now = new Date();
        const dataHoje = now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear();

        await db.execute('SELECT ultimo_checkin FROM stalkers WHERE id = ?', [stalker_id]);
        const result = await db.execute('UPDATE stalkers SET presencas = presencas + 1, ultimo_checkin = ? WHERE id = ?', [dataHoje, stalker_id]);
        await db.execute('INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, 10, ?)', [stalker_id, 'Check-in do dia']);
        await db.execute('UPDATE stalkers SET reputacao = reputacao + 10 WHERE id = ?', [stalker_id]);

        res.send('Ok');
    } catch (error) {
        console.error('Erro presença:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// PESQUISAS
// ===================================================
app.post('/api/pesquisas', auth, upload.single('foto'), async (req, res) => {
    try {
        const { titulo, classificacao, descricao } = req.body;
        const foto = req.file ? req.file.filename : 'default.jpg';
        const adminResult = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [req.user.id]);
        const admin = adminResult.rows[0];

        await db.execute(
            'INSERT INTO pesquisas (titulo, classificacao, descricao, autor, foto) VALUES (?, ?, ?, ?, ?)',
            [titulo, classificacao, descricao, admin?.nome || 'Sistema', foto]
        );

        if (classificacao === 'artefato' || classificacao === 'mutante') {
            const catItem = classificacao === 'artefato' ? 'Artefatos (Pesquisa)' : 'Mutantes (Pesquisa)';
            const itemResult = await db.execute('SELECT id FROM itens WHERE nome = ?', [titulo]);
            if (!itemResult.rows[0]) {
                await db.execute(
                    'INSERT INTO itens (categoria, nome, preco_base, nivel_piaget, foto) VALUES (?, ?, 0, 1, ?)',
                    [catItem, titulo, foto]
                );
            }
        }
        res.send('Ok');
    } catch (error) {
        console.error('Erro pesquisas:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/pesquisas', auth, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM pesquisas ORDER BY id DESC');
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar pesquisas:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/pesquisas/:id', auth, upload.single('foto'), async (req, res) => {
    try {
        const { titulo, classificacao, descricao } = req.body;
        const id = req.params.id;
        let foto = 'default.jpg';

        if (req.file) {
            foto = req.file.filename;
        }

        await db.execute(
            'UPDATE pesquisas SET titulo = ?, classificacao = ?, descricao = ?, foto = ? WHERE id = ?',
            [titulo, classificacao, descricao, foto, id]
        );

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar pesquisa:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.delete('/api/pesquisas/:id', auth, async (req, res) => {
    try {
        await db.execute('DELETE FROM pesquisas WHERE id = ?', [req.params.id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao deletar pesquisa:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// STALKERS
// ===================================================
app.post('/api/stalkers', auth, upload.single('foto'), async (req, res) => {
    try {
        const { nome, codinome, faccao, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes } = req.body;
        const foto = req.file ? req.file.filename : 'default.jpg';

        await db.execute(
            'INSERT INTO stalkers (nome, codinome, faccao, foto, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [nome, codinome, faccao, foto, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes]
        );

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao criar stalker:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/stalkers', auth, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM stalkers');
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar stalkers:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/stalkers/:id', auth, upload.single('foto'), async (req, res) => {
    try {
        const { nome, codinome, faccao, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes } = req.body;
        const id = req.params.id;
        let foto = 'default.jpg';

        if (req.file) {
            foto = req.file.filename;
        }

        await db.execute(
            'UPDATE stalkers SET nome = ?, codinome = ?, faccao = ?, foto = ?, rumores = ?, area_atuacao = ?, aliados = ?, inimigos = ?, relacoes_faccoes = ? WHERE id = ?',
            [nome, codinome, faccao, foto, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes, id]
        );

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar stalker:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.delete('/api/stalkers/:id', auth, async (req, res) => {
    try {
        const id = req.params.id;
        await db.execute('DELETE FROM historico WHERE stalker_id = ?', [id]);
        await db.execute('DELETE FROM stalkers WHERE id = ?', [id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao deletar stalker:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/stalkers/:id/banir', auth, async (req, res) => {
    try {
        const { motivo } = req.body;
        const id = req.params.id;
        await db.execute('UPDATE stalkers SET status_lista_negra = 1, motivo_lista_negra = ? WHERE id = ?', [motivo, id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao banir stalker:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/stalkers/:id/perdoar', auth, async (req, res) => {
    try {
        const id = req.params.id;
        await db.execute('UPDATE stalkers SET status_lista_negra = 0, motivo_lista_negra = ? WHERE id = ?', ['', id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao perdoar stalker:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// REPUTAÇÃO E HISTÓRICO
// ===================================================
app.post('/api/reputacao', auth, async (req, res) => {
    try {
        const { stalker_id, valor, motivo } = req.body;
        const adminResult = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [req.user.id]);
        const admin = adminResult.rows[0];

        const stalkerResult = await db.execute('SELECT reputacao FROM stalkers WHERE id = ?', [stalker_id]);
        const stalker = stalkerResult.rows[0];
        const novaRep = (stalker?.reputacao || 0) + valor;

        await db.execute('UPDATE stalkers SET reputacao = ? WHERE id = ?', [novaRep, stalker_id]);
        await db.execute('INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)', [stalker_id, valor, motivo]);

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar reputação:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/transacao', auth, async (req, res) => {
    try {
        const { stalker_id, motivo, tipo, reputacao_extra } = req.body;
        const adminResult = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [req.user.id]);
        const admin = adminResult.rows[0];

        const motivos = [motivo, `Tipo: ${tipo}`];
        if (reputacao_extra) motivos.push(`Rep Extra: ${reputacao_extra}`);

        await db.execute('INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, 0, ?)',
            [stalker_id, motivos.join(' | ')]
        );

        res.send('Ok');
    } catch (error) {
        console.error('Erro na transação:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/historico/:id', auth, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM historico WHERE stalker_id = ? ORDER BY data DESC', [req.params.id]);
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// ITENS
// ===================================================
app.post('/api/itens', auth, upload.single('foto'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado.");
        const { nome, preco_base, nivel_minimo, categoria } = req.body;
        const foto = req.file ? req.file.filename : 'default.jpg';

        await db.execute(
            'INSERT INTO itens (nome, preco_base, nivel_piaget, categoria, foto) VALUES (?, ?, ?, ?, ?)',
            [nome, preco_base, nivel_minimo, categoria, foto]
        );

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao criar item:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/itens', auth, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM itens ORDER BY categoria');
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar itens:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/itens/:id', auth, upload.single('foto'), async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado.");
        const { nome, preco_base, nivel_minimo, categoria } = req.body;
        const id = req.params.id;
        let foto = 'default.jpg';

        if (req.file) {
            foto = req.file.filename;
        }

        await db.execute(
            'UPDATE itens SET nome = ?, preco_base = ?, nivel_piaget = ?, categoria = ?, foto = ? WHERE id = ?',
            [nome, preco_base, nivel_minimo, categoria, foto, id]
        );

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar item:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.delete('/api/itens/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado.");
        await db.execute('DELETE FROM itens WHERE id = ?', [req.params.id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao deletar item:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// IMPORTAR CARGA OFICIAL
// ===================================================
app.post('/api/itens/importar', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Apenas a Diretoria pode solicitar Suprimentos.");

        const itensIniciais = [
            ['FILTROS', 'Filtro de 3ª Geração', 450], ['FILTROS', 'Filtro de 4ª Geração', 600],
            ['FILTROS', 'Filtro de 5ª Geração', 780], ['FILTROS', 'Filtro de 6ª Geração', 950],
            ['MÁSCARAS DE GÁS', 'Máscara PPM-88', 2970], ['MÁSCARAS DE GÁS', 'Máscara GP-21', 5544],
            ['MÁSCARAS DE GÁS', 'Máscara SHMS-L3', 5544], ['MÁSCARAS DE GÁS', 'Máscara CN-3a', 683],
            ['MUNIÇÕES', 'Munição 7.62x39mm', 150], ['MUNIÇÕES', 'Munição 5.45x39mm', 130],
            ['MUNIÇÕES', 'Chumbo 12ga', 100], ['MUNIÇÕES', 'Munição 9x18mm', 90],
            ['ARMAMENTOS', 'SK 59/66', 9000],
            ['ITENS MÉDICOS', 'Kit de Primeiros Socorros Individual AI-2 (CI)', 1500],
            ['DETECTORES DE ARTEFATOS', 'Echo', 5000], ['DETECTORES DE ARTEFATOS', 'Bear', 15000],
            ['DETECTORES DE ARTEFATOS', 'Veles', 70000], ['DETECTORES DE ARTEFATOS', 'Gilka', 60000],
            ['VESTUÁRIO E ACESSÓRIOS', 'Cinto de Couro SSP', 100], ['VESTUÁRIO E ACESSÓRIOS', 'Bainha', 100],
            ['VESTUÁRIO E ACESSÓRIOS', 'Bainha de Couro', 100],
            ['KITS DE REPARO', 'Kit de Reparos Tipo C', 30000], ['KITS DE REPARO', 'Kit de Reparos Tipo D', 50000],
            ['EQUIPAMENTOS ESPECIAIS', 'Comprimidos P', 5000], ['EQUIPAMENTOS ESPECIAIS', 'Capacete P', 30000]
        ];

        for (let item of itensIniciais) {
            const checkResult = await db.execute('SELECT id FROM itens WHERE nome = ?', [item[1]]);
            if (!checkResult.rows[0]) {
                await db.execute(
                    'INSERT INTO itens (categoria, nome, preco_base, nivel_piaget, foto) VALUES (?, ?, ?, 1, ?)',
                    [item[0], item[1], item[2], 'default.jpg']
                );
            }
        }

        const pesquisasResult = await db.execute("SELECT titulo, classificacao, foto FROM pesquisas WHERE classificacao IN ('artefato', 'mutante')");
        for (let p of pesquisasResult.rows) {
            const catItem = p.classificacao === 'artefato' ? 'Artefatos (Pesquisa)' : 'Mutantes (Pesquisa)';
            const checkResult = await db.execute('SELECT id FROM itens WHERE nome = ?', [p.titulo]);
            if (!checkResult.rows[0]) {
                await db.execute(
                    'INSERT INTO itens (categoria, nome, preco_base, nivel_piaget, foto) VALUES (?, ?, 0, 1, ?)',
                    [catItem, p.titulo, p.foto]
                );
            }
        }

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao importar carga:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// MISSÕES
// ===================================================
app.post('/api/missoes', auth, async (req, res) => {
    try {
        const { titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria } = req.body;
        await db.execute(
            'INSERT INTO missoes (titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria]
        );
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao criar missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/missoes', auth, async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM missoes WHERE status = 'ATIVA'");
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar missões:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/missoes/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado.");
        const { titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria } = req.body;
        const id = req.params.id;
        await db.execute(
            'UPDATE missoes SET titulo = ?, descricao = ?, recompensa_rep = ?, recompensa_ru = ?, recompensa_item = ?, dificuldade = ?, temporaria = ? WHERE id = ?',
            [titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria, id]
        );
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/missoes/:id/atribuir', auth, async (req, res) => {
    try {
        const novoStalkerId = Number(req.body.stalker_id);
        const id = req.params.id;
        const missaoResult = await db.execute('SELECT stalkers_ids FROM missoes WHERE id = ?', [id]);
        const missao = missaoResult.rows[0];
        let stalkers_ids = [];

        try {
            stalkers_ids = JSON.parse(missao?.stalkers_ids || '[]');
        } catch (e) {
            stalkers_ids = [];
        }

        if (!stalkers_ids.includes(novoStalkerId)) {
            stalkers_ids.push(novoStalkerId);
            await db.execute('UPDATE missoes SET stalkers_ids = ? WHERE id = ?', [JSON.stringify(stalkers_ids), id]);
        }

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atribuir missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/missoes/:id/concluir_individual/:stalker_id', auth, async (req, res) => {
    try {
        const missaoId = req.params.id;
        const stalkerId = Number(req.params.stalker_id);
        const adminResult = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [req.user.id]);
        const admin = adminResult.rows[0];
        const missaoResult = await db.execute('SELECT concluidos_ids, recompensa_rep, recompensa_ru FROM missoes WHERE id = ?', [missaoId]);
        const missao = missaoResult.rows[0];

        let concluidos_ids = [];
        try {
            concluidos_ids = JSON.parse(missao?.concluidos_ids || '[]');
        } catch (e) {
            concluidos_ids = [];
        }

        if (!concluidos_ids.includes(stalkerId)) {
            concluidos_ids.push(stalkerId);
            await db.execute('UPDATE missoes SET concluidos_ids = ? WHERE id = ?', [JSON.stringify(concluidos_ids), missaoId]);
            await db.execute('UPDATE stalkers SET reputacao = reputacao + ? WHERE id = ?', [missao?.recompensa_rep || 0, stalkerId]);
            await db.execute('INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)',
                [stalkerId, missao?.recompensa_rep || 0, `Missão concluída: ${missaoId}`]
            );
        }

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao concluir missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/missoes/:id/abortar/:stalker_id', auth, async (req, res) => {
    try {
        const missaoId = req.params.id;
        const stalkerId = Number(req.params.stalker_id);
        const missaoResult = await db.execute('SELECT stalkers_ids FROM missoes WHERE id = ?', [missaoId]);
        const missao = missaoResult.rows[0];

        let stalkers_ids = [];
        try {
            stalkers_ids = JSON.parse(missao?.stalkers_ids || '[]');
        } catch (e) {
            stalkers_ids = [];
        }

        stalkers_ids = stalkers_ids.filter(id => id !== stalkerId);
        await db.execute('UPDATE missoes SET stalkers_ids = ? WHERE id = ?', [JSON.stringify(stalkers_ids), missaoId]);

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao abortar missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.post('/api/missoes/:id/encerrar_mural', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado.");
        const id = req.params.id;
        await db.execute("UPDATE missoes SET status = 'CONCLUIDA' WHERE id = ?", [id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao encerrar missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.delete('/api/missoes/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado.");
        await db.execute('DELETE FROM missoes WHERE id = ?', [req.params.id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao deletar missão:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// RELATÓRIOS
// ===================================================
app.post('/api/relatorios', auth, async (req, res) => {
    try {
        await db.execute(
            'INSERT INTO relatorios (numero, autor, membros, objetivo, col1, col2, col3) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [req.body.numero, req.body.autor, req.body.membros, req.body.objetivo, req.body.col1, req.body.col2, req.body.col3]
        );
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao criar relatório:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/relatorios', auth, async (req, res) => {
    try {
        const result = await db.execute('SELECT * FROM relatorios ORDER BY id DESC');
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar relatórios:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/relatorios/:id', auth, async (req, res) => {
    try {
        const adminResult = await db.execute('SELECT nome FROM usuarios WHERE id = ?', [req.user.id]);
        const admin = adminResult.rows[0];
        const id = req.params.id;
        await db.execute(
            'UPDATE relatorios SET numero = ?, autor = ?, membros = ?, objetivo = ?, col1 = ?, col2 = ?, col3 = ?, editado_por = ? WHERE id = ?',
            [req.body.numero, req.body.autor, req.body.membros, req.body.objetivo, req.body.col1, req.body.col2, req.body.col3, admin?.nome, id]
        );
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar relatório:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.delete('/api/relatorios/:id', auth, async (req, res) => {
    try {
        await db.execute('DELETE FROM relatorios WHERE id = ?', [req.params.id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao deletar relatório:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// MEMBROS
// ===================================================
app.post('/api/membros', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado");
        const hash = bcrypt.hashSync(req.body.senha, 10);
        const roleCerto = String(req.body.role).toLowerCase();
        await db.execute(
            'INSERT INTO usuarios (nome, usuario, senha, role) VALUES (?, ?, ?, ?)',
            [req.body.nome, req.body.usuario, hash, roleCerto]
        );
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao criar membro:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/api/membros', auth, async (req, res) => {
    try {
        const result = await db.execute('SELECT id, nome, usuario, role FROM usuarios');
        res.json(result.rows || []);
    } catch (error) {
        console.error('Erro ao buscar membros:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/membros/:id', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Negado");
        const { nome, usuario, role, senha } = req.body;
        const roleCerto = String(role).toLowerCase();
        const id = req.params.id;

        if (senha) {
            const hash = bcrypt.hashSync(senha, 10);
            await db.execute(
                'UPDATE usuarios SET nome = ?, usuario = ?, role = ?, senha = ? WHERE id = ?',
                [nome, usuario, roleCerto, hash, id]
            );
        } else {
            await db.execute(
                'UPDATE usuarios SET nome = ?, usuario = ?, role = ? WHERE id = ?',
                [nome, usuario, roleCerto, id]
            );
        }

        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar membro:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.delete('/api/membros/:id', auth, async (req, res) => {
    try {
        await db.execute('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao deletar membro:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// CONFIGURAÇÕES (TAXAS DE COMÉRCIO)
// ===================================================
app.get('/api/config/taxas', auth, async (req, res) => {
    try {
        const result = await db.execute("SELECT valor FROM configuracoes WHERE chave = 'taxas_comercio'");
        if (result.rows[0]) {
            res.json(JSON.parse(result.rows[0].valor));
        } else {
            res.json([
                { min: 0, max: 100, label: "Desconhecido", cor: "#7f8c8d", acesso: "Itens Básicos", compra: 1.75, venda: 0.50, nivel: 1 },
                { min: 101, max: 500, label: "Baixo", cor: "#e74c3c", acesso: "Itens Básicos", compra: 1.60, venda: 0.65, nivel: 1 },
                { min: 501, max: 3000, label: "Médio", cor: "#f1c40f", acesso: "Artefatos/Trajes", compra: 1.50, venda: 0.75, nivel: 2 },
                { min: 3001, max: 5000, label: "Alto", cor: "#2ecc71", acesso: "Tecnologia Experimental", compra: 1.25, venda: 0.85, nivel: 3 },
                { min: 5001, max: 9999, label: "Total", cor: "#00b4d8", acesso: "Acesso Irrestrito", compra: 1.0, venda: 1.0, nivel: 3 }
            ]);
        }
    } catch (error) {
        console.error('Erro ao buscar taxas:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/api/config/taxas', auth, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).send("Acesso Negado.");
        await db.execute("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('taxas_comercio', ?)", [JSON.stringify(req.body)]);
        res.send('Ok');
    } catch (error) {
        console.error('Erro ao atualizar taxas:', error);
        res.status(500).send('Erro no servidor');
    }
});

// ===================================================
// INICIAR SERVIDOR
// ===================================================
const PORT = process.env.PORT || 3000;

(async () => {
    await inicializarBD();
    app.listen(PORT, "0.0.0.0", () => {
        console.log(`✅ Servidor Clear Sky online em http://localhost:${PORT}`);
        console.log(`🔗 Banco de dados: Turso`);
        console.log(`📡 URL: ${process.env.TURSO_CONNECTION_URL}`);
    });
})();
