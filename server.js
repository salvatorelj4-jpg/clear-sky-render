const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

if (!fs.existsSync('./uploads')) { fs.mkdirSync('./uploads'); }

const app = express();
const SECRET = "ECO_LAB_SECURE_2026";
const db = new sqlite3.Database('./database.db');

app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, usuario TEXT UNIQUE, senha TEXT, role TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS stalkers (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, codinome TEXT, faccao TEXT, foto TEXT, reputacao INTEGER DEFAULT 0, vendas_seguidas INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS historico (id INTEGER PRIMARY KEY AUTOINCREMENT, stalker_id INTEGER, alteracao INTEGER, motivo TEXT, data DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS itens (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT, preco_base REAL, nivel_piaget INTEGER DEFAULT 1)`);
    db.run(`CREATE TABLE IF NOT EXISTS missoes (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT, descricao TEXT, recompensa_rep INTEGER, recompensa_ru REAL, recompensa_item TEXT, status TEXT DEFAULT 'ATIVA', stalker_id INTEGER, dificuldade TEXT DEFAULT 'Fácil', temporaria INTEGER DEFAULT 0)`);
    db.run(`CREATE TABLE IF NOT EXISTS relatorios (id INTEGER PRIMARY KEY AUTOINCREMENT, numero TEXT, autor TEXT, membros TEXT, objetivo TEXT, col1 TEXT, col2 TEXT, col3 TEXT, editado_por TEXT, data DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS pesquisas (id INTEGER PRIMARY KEY AUTOINCREMENT, titulo TEXT, classificacao TEXT, descricao TEXT, autor TEXT, data DATETIME DEFAULT CURRENT_TIMESTAMP, foto TEXT DEFAULT 'default.jpg')`);
    db.run(`CREATE TABLE IF NOT EXISTS configuracoes (chave TEXT PRIMARY KEY, valor TEXT)`);
    
    db.run(`ALTER TABLE itens ADD COLUMN nivel_piaget INTEGER DEFAULT 1`, (err) => {});
    db.run(`ALTER TABLE itens ADD COLUMN categoria TEXT DEFAULT 'Equipamentos'`, (err) => {}); 
    db.run(`ALTER TABLE itens ADD COLUMN foto TEXT DEFAULT 'default.jpg'`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN vendas_seguidas INTEGER DEFAULT 0`, (err) => {});
    db.run(`ALTER TABLE stalkers ADD COLUMN presencas INTEGER DEFAULT 0`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN rumores TEXT`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN ultimo_checkin TEXT`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN area_atuacao TEXT`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN aliados TEXT`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN inimigos TEXT`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN relacoes_faccoes TEXT`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN status_lista_negra INTEGER DEFAULT 0`, (err) => {}); 
    db.run(`ALTER TABLE stalkers ADD COLUMN motivo_lista_negra TEXT`, (err) => {}); 
    db.run(`ALTER TABLE missoes ADD COLUMN stalker_id INTEGER`, (err) => {});
    db.run(`ALTER TABLE missoes ADD COLUMN stalkers_ids TEXT DEFAULT '[]'`, (err) => {}); 
    db.run(`ALTER TABLE missoes ADD COLUMN concluidos_ids TEXT DEFAULT '[]'`, (err) => {}); 
    db.run(`ALTER TABLE missoes ADD COLUMN recompensa_ru REAL`, (err) => {});
    db.run(`ALTER TABLE missoes ADD COLUMN recompensa_item TEXT`, (err) => {});
    db.run(`ALTER TABLE missoes ADD COLUMN dificuldade TEXT DEFAULT 'Fácil'`, (err) => {}); 
    db.run(`ALTER TABLE missoes ADD COLUMN temporaria INTEGER DEFAULT 0`, (err) => {}); 
    db.run(`ALTER TABLE relatorios ADD COLUMN editado_por TEXT`, (err) => {});
    db.run(`ALTER TABLE pesquisas ADD COLUMN foto TEXT DEFAULT 'default.jpg'`, (err) => {});

    const pass = bcrypt.hashSync('25072507', 10);
    db.run(`INSERT OR IGNORE INTO usuarios (nome, usuario, senha, role) VALUES ('Administrador', 'admin', ?, 'admin')`, [pass]);
});

const auth = (req, res, next) => { const token = req.headers['authorization']; if (!token) return res.status(401).send("Acesso Negado"); jwt.verify(token, SECRET, (err, user) => { if (err) return res.status(403).send("Token Inválido"); req.user = user; next(); }); };

app.get('/', (req, res) => res.redirect('/dashboard.html'));

app.post('/api/login', (req, res) => { 
    const { usuario, senha } = req.body; 
    db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => { 
        if (user && bcrypt.compareSync(senha, user.senha)) { 
            const roleCorreto = String(user.role).toLowerCase();
            const token = jwt.sign({ id: user.id, role: roleCorreto, nome: user.nome }, SECRET); 
            res.json({ token, role: roleCorreto, nome: user.nome }); 
        } else { res.status(401).send("Erro"); } 
    }); 
});

app.get('/api/estatisticas', auth, (req, res) => { db.get("SELECT COUNT(*) as total FROM stalkers WHERE status_lista_negra = 0", (err, r1) => { db.get("SELECT codinome, reputacao FROM stalkers WHERE status_lista_negra = 0 ORDER BY reputacao DESC LIMIT 1", (err, r2) => { db.get("SELECT COUNT(*) as ativas FROM missoes WHERE status = 'ATIVA'", (err, r3) => { db.get("SELECT COUNT(*) as itens FROM itens", (err, r4) => { res.json({ totalStalkers: r1 ? r1.total : 0, topStalker: r2 ? `${r2.codinome} (${r2.reputacao} pts)` : 'Nenhum', missoesAtivas: r3 ? r3.ativas : 0, totalItens: r4 ? r4.itens : 0 }); }); }); }); }); });

app.post('/api/presenca', auth, (req, res) => { const { stalker_id } = req.body; const now = new Date(); const dataHoje = now.getDate() + '/' + (now.getMonth() + 1) + '/' + now.getFullYear(); db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { db.get("SELECT reputacao, presencas, ultimo_checkin FROM stalkers WHERE id = ?", [stalker_id], (err, row) => { if (!row) return res.status(404).send("Erro"); if (row.ultimo_checkin === dataHoje) return res.status(400).send("Já feito."); let novaRep = Math.min(5000, (row.reputacao || 0) + 10); let novasPresencas = (row.presencas || 0) + 1; db.run("UPDATE stalkers SET reputacao = ?, presencas = ?, ultimo_checkin = ? WHERE id = ?", [novaRep, novasPresencas, dataHoje, stalker_id], (err) => { db.run("INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)", [stalker_id, 10, `📍 Check-in Diário no Bunker (Por: ${admin ? admin.nome : "Sistema"})`], () => res.send("Ok")); }); }); }); });

app.post('/api/pesquisas', auth, upload.single('foto'), (req, res) => { 
    const { titulo, classificacao, descricao } = req.body; 
    const foto = req.file ? req.file.filename : 'default.jpg'; 
    db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { 
        db.run("INSERT INTO pesquisas (titulo, classificacao, descricao, autor, foto) VALUES (?, ?, ?, ?, ?)", [titulo, classificacao, descricao, admin ? admin.nome : "Sistema", foto], () => {
            if (classificacao === 'artefato' || classificacao === 'mutante') {
                const catItem = classificacao === 'artefato' ? 'Artefatos (Pesquisa)' : 'Mutantes (Pesquisa)';
                db.get("SELECT id FROM itens WHERE nome = ?", [titulo], (err, row) => {
                    if (!row) { db.run("INSERT INTO itens (categoria, nome, preco_base, nivel_piaget, foto) VALUES (?, ?, 0, 1, ?)", [catItem, titulo, foto]); }
                });
            }
            res.send("Ok"); 
        }); 
    }); 
});
app.get('/api/pesquisas', auth, (req, res) => { db.all("SELECT * FROM pesquisas ORDER BY id DESC", (err, rows) => res.json(rows)); });
app.put('/api/pesquisas/:id', auth, upload.single('foto'), (req, res) => { const { titulo, classificacao, descricao } = req.body; if (req.file) { db.run("UPDATE pesquisas SET titulo=?, classificacao=?, descricao=?, foto=? WHERE id=?", [titulo, classificacao, descricao, req.file.filename, req.params.id], () => res.send("Ok")); } else { db.run("UPDATE pesquisas SET titulo=?, classificacao=?, descricao=? WHERE id=?", [titulo, classificacao, descricao, req.params.id], () => res.send("Ok")); } });
app.delete('/api/pesquisas/:id', auth, (req, res) => { db.run("DELETE FROM pesquisas WHERE id = ?", [req.params.id], () => res.send("Ok")); });

app.post('/api/stalkers', auth, upload.single('foto'), (req, res) => { const { nome, codinome, faccao, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes } = req.body; const foto = req.file ? req.file.filename : 'default.jpg'; db.run("INSERT INTO stalkers (nome, codinome, faccao, foto, reputacao, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)", [nome, codinome, faccao, foto, rumores || "", area_atuacao || "", aliados || "", inimigos || "", relacoes_faccoes || ""], () => res.send("Ok")); });
app.get('/api/stalkers', auth, (req, res) => { db.all("SELECT * FROM stalkers", (err, rows) => res.json(rows)); });
app.put('/api/stalkers/:id', auth, upload.single('foto'), (req, res) => { const { nome, codinome, faccao, rumores, area_atuacao, aliados, inimigos, relacoes_faccoes } = req.body; if (req.file) { db.run("UPDATE stalkers SET nome=?, codinome=?, faccao=?, foto=?, rumores=?, area_atuacao=?, aliados=?, inimigos=?, relacoes_faccoes=? WHERE id=?", [nome, codinome, faccao, req.file.filename, rumores || "", area_atuacao || "", aliados || "", inimigos || "", relacoes_faccoes || "", req.params.id], () => res.send("Ok")); } else { db.run("UPDATE stalkers SET nome=?, codinome=?, faccao=?, rumores=?, area_atuacao=?, aliados=?, inimigos=?, relacoes_faccoes=? WHERE id=?", [nome, codinome, faccao, rumores || "", area_atuacao || "", aliados || "", inimigos || "", relacoes_faccoes || "", req.params.id], () => res.send("Ok")); } });
app.delete('/api/stalkers/:id', auth, (req, res) => { db.run("DELETE FROM stalkers WHERE id = ?", [req.params.id], () => { db.run("DELETE FROM historico WHERE stalker_id = ?", [req.params.id], () => res.send("Ok")); }); });
app.post('/api/stalkers/:id/banir', auth, (req, res) => { db.run("UPDATE stalkers SET status_lista_negra = 1, motivo_lista_negra = ? WHERE id = ?", [req.body.motivo, req.params.id], () => res.send("Ok")); });
app.post('/api/stalkers/:id/perdoar', auth, (req, res) => { db.run("UPDATE stalkers SET status_lista_negra = 0, motivo_lista_negra = '' WHERE id = ?", [req.params.id], () => res.send("Ok")); });

app.post('/api/reputacao', auth, (req, res) => { const { stalker_id, valor, motivo } = req.body; db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { db.get("SELECT reputacao FROM stalkers WHERE id = ?", [stalker_id], (err, row) => { let novaRep = Math.min(5000, Math.max(0, (row.reputacao || 0) + parseInt(valor))); db.run("UPDATE stalkers SET reputacao = ? WHERE id = ?", [novaRep, stalker_id]); db.run("INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)", [stalker_id, valor, `${motivo} (Por: ${admin ? admin.nome : "Sistema"})`], () => res.send("Ok")); }); }); });
app.post('/api/transacao', auth, (req, res) => { const { stalker_id, motivo, tipo, reputacao_extra } = req.body; db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { db.get("SELECT reputacao FROM stalkers WHERE id = ?", [stalker_id], (err, row) => { let alteracaoManual = parseInt(reputacao_extra) || 0; let novaRep = Math.min(5000, Math.max(0, row.reputacao + alteracaoManual)); db.run("UPDATE stalkers SET reputacao = ? WHERE id = ?", [novaRep, stalker_id]); db.run("INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)", [stalker_id, alteracaoManual, `${motivo} (Por: ${admin ? admin.nome : "Sistema"})`], () => res.send("Ok")); }); }); });
app.get('/api/historico/:id', auth, (req, res) => { db.all("SELECT * FROM historico WHERE stalker_id = ? ORDER BY data DESC", [req.params.id], (err, rows) => res.json(rows)); });

app.post('/api/itens', auth, upload.single('foto'), (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado."); const { nome, preco_base, nivel_minimo, categoria } = req.body; const foto = req.file ? req.file.filename : 'default.jpg'; db.run("INSERT INTO itens (nome, preco_base, nivel_piaget, categoria, foto) VALUES (?, ?, ?, ?, ?)", [nome, preco_base, nivel_minimo || 1, categoria || "Geral", foto], () => res.send("Ok")); });
app.get('/api/itens', auth, (req, res) => { db.all("SELECT * FROM itens ORDER BY categoria", (err, rows) => res.json(rows)); });
app.put('/api/itens/:id', auth, upload.single('foto'), (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado."); const { nome, preco_base, nivel_minimo, categoria } = req.body; if(req.file) { db.run("UPDATE itens SET nome=?, preco_base=?, nivel_piaget=?, categoria=?, foto=? WHERE id=?", [nome, preco_base, nivel_minimo, categoria, req.file.filename, req.params.id], () => res.send("Ok")); } else { db.run("UPDATE itens SET nome=?, preco_base=?, nivel_piaget=?, categoria=? WHERE id=?", [nome, preco_base, nivel_minimo, categoria, req.params.id], () => res.send("Ok")); } });
app.delete('/api/itens/:id', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado."); db.run("DELETE FROM itens WHERE id = ?", [req.params.id], () => res.send("Ok")); });

// =======================================================
// O NOVO BOTÃO DE IMPORTAR CARGA OFICIAL
// =======================================================
app.post('/api/itens/importar', auth, (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).send("Apenas a Diretoria pode solicitar Suprimentos.");

    const itensIniciais = [
        ['FILTROS', 'Filtro de 3ª Geração', 450], ['FILTROS', 'Filtro de 4ª Geração', 600], ['FILTROS', 'Filtro de 5ª Geração', 780], ['FILTROS', 'Filtro de 6ª Geração', 950], ['FILTROS', 'Cilindro de Filtragem P-7A', 3150],
        ['MÁSCARAS DE GÁS', 'Máscara PPM-88', 2970], ['MÁSCARAS DE GÁS', 'Máscara GP-21', 5544], ['MÁSCARAS DE GÁS', 'Máscara SHMS-L3', 5544], ['MÁSCARAS DE GÁS', 'Máscara CN-3a', 6831], ['MÁSCARAS DE GÁS', 'Máscara M50', 9405], ['MÁSCARAS DE GÁS', 'Máscara Bulat', 10692], ['MÁSCARAS DE GÁS', 'Máscara Farejador', 10692], ['MÁSCARAS DE GÁS', 'Máscara EXO', 27045], ['MÁSCARAS DE GÁS', 'Máscara GP-10M', 27045], ['MÁSCARAS DE GÁS', 'Máscara VB', 27045], ['MÁSCARAS DE GÁS', 'Máscara GP-10', 27045], ['MÁSCARAS DE GÁS', 'Máscara XM-40', 32160],
        ['MUNIÇÕES', 'Munição 7.62x39mm', 150], ['MUNIÇÕES', 'Munição 5.45x39mm', 130], ['MUNIÇÕES', 'Chumbo 12ga', 100], ['MUNIÇÕES', 'Munição 9x18mm', 90], ['MUNIÇÕES', '5x18 Makarov', 60], ['MUNIÇÕES', 'Cartucho 12ga', 130], ['MUNIÇÕES', '5.7x28', 200],
        ['ARMAMENTOS', 'SK 59/66', 9000],
        ['ITENS MÉDICOS', 'Kit de Primeiros Socorros Individual AI-2 (CI)', 1500],
        ['DETECTORES DE ARTEFATOS', 'Echo', 5000], ['DETECTORES DE ARTEFATOS', 'Bear', 15000], ['DETECTORES DE ARTEFATOS', 'Veles', 70000], ['DETECTORES DE ARTEFATOS', 'Gilka', 60000], ['DETECTORES DE ARTEFATOS', 'Svarog', 150000],
        ['VESTUÁRIO E ACESSÓRIOS', 'Cinto de Couro SSP', 100], ['VESTUÁRIO E ACESSÓRIOS', 'Bainha', 100], ['VESTUÁRIO E ACESSÓRIOS', 'Bainha de Couro', 100], ['VESTUÁRIO E ACESSÓRIOS', 'Coldre', 100], ['VESTUÁRIO E ACESSÓRIOS', 'Coldre de Pernas Táticas', 200],
        ['KITS DE REPARO', 'Kit de Reparos Tipo C', 30000], ['KITS DE REPARO', 'Kit de Reparos Tipo D', 50000],
        ['EQUIPAMENTOS ESPECIAIS', 'Comprimidos P', 5000], ['EQUIPAMENTOS ESPECIAIS', 'Capacete P', 30000]
    ];

    db.serialize(() => {
        itensIniciais.forEach(item => {
            db.get("SELECT id FROM itens WHERE nome = ?", [item[1]], (err, row) => {
                if (!row) { db.run("INSERT INTO itens (categoria, nome, preco_base, nivel_piaget, foto) VALUES (?, ?, ?, 1, 'default.jpg')", [item[0], item[1], item[2]]); }
            });
        });

        db.all("SELECT titulo, classificacao, foto FROM pesquisas WHERE classificacao IN ('artefato', 'mutante')", (err, rows) => {
            if(rows) {
                rows.forEach(p => {
                    const catItem = p.classificacao === 'artefato' ? 'Artefatos (Pesquisa)' : 'Mutantes (Pesquisa)';
                    db.get("SELECT id FROM itens WHERE nome = ?", [p.titulo], (err, row) => {
                        if (!row) { db.run("INSERT INTO itens (categoria, nome, preco_base, nivel_piaget, foto) VALUES (?, ?, 0, 1, ?)", [catItem, p.titulo, p.foto]); }
                    });
                });
            }
        });
    });

    setTimeout(() => res.send("Ok"), 1500); // Espera 1.5s para garantir que o banco guardou tudo
});


app.post('/api/missoes', auth, (req, res) => { const { titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria } = req.body; db.run("INSERT INTO missoes (titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, stalkers_ids, concluidos_ids, dificuldade, temporaria) VALUES (?, ?, ?, ?, ?, '[]', '[]', ?, ?)", [titulo, descricao, recompensa_rep || 0, recompensa_ru || 0, recompensa_item || "", dificuldade || 'Fácil', temporaria ? 1 : 0], () => res.send("Ok")); });
app.get('/api/missoes', auth, (req, res) => { db.all("SELECT * FROM missoes WHERE status = 'ATIVA'", (err, rows) => res.json(rows)); });
app.put('/api/missoes/:id', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado."); const { titulo, descricao, recompensa_rep, recompensa_ru, recompensa_item, dificuldade, temporaria } = req.body; db.run("UPDATE missoes SET titulo=?, descricao=?, recompensa_rep=?, recompensa_ru=?, recompensa_item=?, dificuldade=?, temporaria=? WHERE id=?", [titulo, descricao, recompensa_rep || 0, recompensa_ru || 0, recompensa_item || "", dificuldade || 'Fácil', temporaria ? 1 : 0, req.params.id], () => res.send("Ok")); });
app.put('/api/missoes/:id/atribuir', auth, (req, res) => { const novoStalkerId = Number(req.body.stalker_id); db.get("SELECT stalkers_ids, concluidos_ids FROM missoes WHERE id = ?", [req.params.id], (err, row) => { let ativos = []; let concluidos = []; try { if(row && row.stalkers_ids) ativos = JSON.parse(row.stalkers_ids).map(Number); } catch(e){} try { if(row && row.concluidos_ids) concluidos = JSON.parse(row.concluidos_ids).map(Number); } catch(e){} if(!ativos.includes(novoStalkerId) && !concluidos.includes(novoStalkerId)) ativos.push(novoStalkerId); db.run("UPDATE missoes SET stalkers_ids = ? WHERE id = ?", [JSON.stringify(ativos), req.params.id], () => res.send("Ok")); }); });
app.post('/api/missoes/:id/concluir_individual/:stalker_id', auth, (req, res) => { const missaoId = req.params.id; const stalkerId = Number(req.params.stalker_id); db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { db.get("SELECT * FROM missoes WHERE id = ?", [missaoId], (err, missao) => { if(!missao) return res.status(404).send("Erro"); let ativos = []; let concluidos = []; try { if(missao.stalkers_ids) ativos = JSON.parse(missao.stalkers_ids).map(Number); } catch(e){} try { if(missao.concluidos_ids) concluidos = JSON.parse(missao.concluidos_ids).map(Number); } catch(e){} if (missao.stalker_id && !ativos.includes(Number(missao.stalker_id)) && !concluidos.includes(Number(missao.stalker_id))) { ativos.push(Number(missao.stalker_id)); } ativos = ativos.filter(id => id !== stalkerId); if(!concluidos.includes(stalkerId)) concluidos.push(stalkerId); db.run("UPDATE missoes SET stalkers_ids = ?, concluidos_ids = ?, stalker_id = NULL WHERE id = ?", [JSON.stringify(ativos), JSON.stringify(concluidos), missaoId], function(err) { db.get("SELECT reputacao FROM stalkers WHERE id = ?", [stalkerId], (err, stalker) => { if (stalker) { let novaRep = Math.min(5000, stalker.reputacao + (missao.recompensa_rep || 0)); db.run("UPDATE stalkers SET reputacao = ? WHERE id = ?", [novaRep, stalkerId]); let detalhes = `+${missao.recompensa_rep || 0} REP`; if (missao.recompensa_ru) detalhes += `, ${missao.recompensa_ru} RU`; if (missao.recompensa_item) detalhes += `, Item: ${missao.recompensa_item}`; db.run("INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)", [stalkerId, missao.recompensa_rep || 0, `OPERAÇÃO CONCLUÍDA: ${missao.titulo} | Recebeu: ${detalhes}`]); } }); res.send("Ok"); }); }); }); });
app.post('/api/missoes/:id/abortar/:stalker_id', auth, (req, res) => { const missaoId = req.params.id; const stalkerId = Number(req.params.stalker_id); db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { db.get("SELECT * FROM missoes WHERE id = ?", [missaoId], (err, missao) => { if(!missao) return res.status(404).send("Erro"); let ativos = []; try { if(missao.stalkers_ids) ativos = JSON.parse(missao.stalkers_ids).map(Number); } catch(e){} if (missao.stalker_id && !ativos.includes(Number(missao.stalker_id))) ativos.push(Number(missao.stalker_id)); ativos = ativos.filter(id => id !== stalkerId); db.run("UPDATE missoes SET stalkers_ids = ?, stalker_id = NULL WHERE id = ?", [JSON.stringify(ativos), missaoId], function(err) { db.run("INSERT INTO historico (stalker_id, alteracao, motivo) VALUES (?, ?, ?)", [stalkerId, 0, `OPERAÇÃO ABORTADA: ${missao.titulo}`]); res.send("Ok"); }); }); }); });
app.post('/api/missoes/:id/encerrar_mural', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado."); db.run("UPDATE missoes SET status = 'CONCLUIDA' WHERE id = ?", [req.params.id], () => res.send("Ok")); });
app.delete('/api/missoes/:id', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado."); db.run("DELETE FROM missoes WHERE id = ?", [req.params.id], () => res.send("Ok")); });

app.post('/api/relatorios', auth, (req, res) => { db.run("INSERT INTO relatorios (numero, autor, membros, objetivo, col1, col2, col3) VALUES (?, ?, ?, ?, ?, ?, ?)", [req.body.numero, req.body.autor, req.body.membros, req.body.objetivo, req.body.col1, req.body.col2, req.body.col3], () => res.send("Ok")); });
app.get('/api/relatorios', auth, (req, res) => { db.all("SELECT * FROM relatorios ORDER BY id DESC", (err, rows) => res.json(rows)); });
app.put('/api/relatorios/:id', auth, (req, res) => { db.get("SELECT nome FROM usuarios WHERE id = ?", [req.user.id], (err, admin) => { db.run("UPDATE relatorios SET numero=?, autor=?, membros=?, objetivo=?, col1=?, col2=?, col3=?, editado_por=? WHERE id=?", [req.body.numero, req.body.autor, req.body.membros, req.body.objetivo, req.body.col1, req.body.col2, req.body.col3, admin ? admin.nome : "Sistema", req.params.id], () => res.send("Ok")); }); });
app.delete('/api/relatorios/:id', auth, (req, res) => { db.run("DELETE FROM relatorios WHERE id = ?", [req.params.id], () => res.send("Ok")); });

app.post('/api/membros', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado"); const hash = bcrypt.hashSync(req.body.senha, 10); const roleCerto = String(req.body.role).toLowerCase(); db.run("INSERT INTO usuarios (nome, usuario, senha, role) VALUES (?, ?, ?, ?)", [req.body.nome, req.body.usuario, hash, roleCerto], () => res.send("Ok")); });
app.get('/api/membros', auth, (req, res) => { db.all("SELECT id, nome, usuario, role FROM usuarios", (err, rows) => res.json(rows)); });
app.put('/api/membros/:id', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Negado"); const { nome, usuario, role, senha } = req.body; const roleCerto = String(role).toLowerCase(); if (senha) { const hash = bcrypt.hashSync(senha, 10); db.run("UPDATE usuarios SET nome=?, usuario=?, role=?, senha=? WHERE id=?", [nome, usuario, roleCerto, hash, req.params.id], () => res.send("Ok")); } else { db.run("UPDATE usuarios SET nome=?, usuario=?, role=? WHERE id=?", [nome, usuario, roleCerto, req.params.id], () => res.send("Ok")); } });
app.delete('/api/membros/:id', auth, (req, res) => { db.run("DELETE FROM usuarios WHERE id = ?", [req.params.id], () => res.send("Ok")); });

app.get('/api/config/taxas', auth, (req, res) => { db.get("SELECT valor FROM configuracoes WHERE chave = 'taxas_comercio'", (err, row) => { if (row) res.json(JSON.parse(row.valor)); else res.json([]); }); });
app.put('/api/config/taxas', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).send("Acesso Negado."); db.run("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('taxas_comercio', ?)", [JSON.stringify(req.body)], (err) => { if(err) console.error(err); res.send("Ok"); }); });

app.listen(3000, "0.0.0.0", () => console.log("Servidor online em http://localhost:3000"));