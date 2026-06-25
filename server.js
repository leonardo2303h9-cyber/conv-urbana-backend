require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

// ========== CONFIGURAÇÃO CORS ==========
app.use(cors({
  origin: '*', // Permite qualquer origem (para testes)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ========== BANCO DE DADOS ==========
// Usar caminho persistente se disponível (Render.com)
const dbPath = process.env.RENDER ? '/data/conv-urbana.db' : './conv-urbana.db';
console.log(`📁 Banco de dados em: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro ao abrir banco de dados:', err.message);
  } else {
    console.log('✅ Banco de dados conectado!');
  }
});

// Forçar modo WAL para melhor performance
db.run('PRAGMA journal_mode = WAL;');

// ========== CRIAR TABELAS E ADMIN ==========
db.serialize(() => {
  // 1. Criar tabela de produtos
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      imagem TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ Erro ao criar tabela produtos:', err);
  });

  // 2. Criar tabela de usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      telefone TEXT NOT NULL,
      endereco TEXT NOT NULL,
      numero TEXT NOT NULL,
      cep TEXT,
      senha TEXT NOT NULL,
      isAdmin INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('❌ Erro ao criar tabela usuarios:', err);
  });

  // 3. Criar tabela de pedidos
  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      produtos TEXT NOT NULL,
      total REAL NOT NULL,
      enderecoEntrega TEXT NOT NULL,
      status TEXT DEFAULT 'pendente',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `, (err) => {
    if (err) console.error('❌ Erro ao criar tabela pedidos:', err);
  });

  // 4. CRIAR ADMIN PADRÃO (se não existir)
  const adminEmail = 'admin@convurbana.com';
  const adminSenha = '1234';
  
  db.get('SELECT id FROM usuarios WHERE email = ?', [adminEmail], (err, row) => {
    if (err) {
      console.error('❌ Erro ao verificar admin:', err);
      return;
    }
    
    if (!row) {
      db.run(
        `INSERT INTO usuarios (nome, email, telefone, endereco, numero, cep, senha, isAdmin) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'Administrador',
          adminEmail,
          '(00) 00000-0000',
          'Rua do Admin',
          '0',
          '00000-000',
          adminSenha,
          1
        ],
        function(err) {
          if (err) {
            console.error('❌ Erro ao criar admin:', err);
          } else {
            console.log('✅ Admin criado com sucesso!');
            console.log(`📧 Email: ${adminEmail}`);
            console.log(`🔑 Senha: ${adminSenha}`);
          }
        }
      );
    } else {
      console.log('✅ Admin já existe no banco de dados');
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Senha: ${adminSenha}`);
    }
  });

  console.log('✅ Banco de dados SQLite pronto!');
});

// ========== ROTAS ==========

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online', 
    database: 'SQLite', 
    versao: '1.0.0',
    environment: process.env.RENDER ? 'render' : 'local'
  });
});

// ========== PRODUTOS ==========

app.get('/api/produtos', (req, res) => {
  db.all('SELECT * FROM produtos ORDER BY createdAt DESC', (err, rows) => {
    if (err) {
      console.error('❌ Erro ao buscar produtos:', err);
      res.status(500).json({ erro: err.message });
      return;
    }
    res.json(rows || []);
  });
});

app.post('/api/produtos', (req, res) => {
  const { nome, preco, imagem } = req.body;
  db.run(
    'INSERT INTO produtos (nome, preco, imagem) VALUES (?, ?, ?)',
    [nome, preco, imagem || ''],
    function(err) {
      if (err) {
        console.error('❌ Erro ao adicionar produto:', err);
        res.status(500).json({ erro: err.message });
        return;
      }
      res.status(201).json({ id: this.lastID, nome, preco, imagem });
    }
  );
});

app.put('/api/produtos/:id', (req, res) => {
  const { nome, preco, imagem } = req.body;
  db.run(
    'UPDATE produtos SET nome = ?, preco = ?, imagem = ? WHERE id = ?',
    [nome, preco, imagem || '', req.params.id],
    function(err) {
      if (err) {
        console.error('❌ Erro ao editar produto:', err);
        res.status(500).json({ erro: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ erro: 'Produto não encontrado' });
        return;
      }
      res.json({ mensagem: 'Produto atualizado' });
    }
  );
});

app.delete('/api/produtos/:id', (req, res) => {
  db.run('DELETE FROM produtos WHERE id = ?', req.params.id, function(err) {
    if (err) {
      console.error('❌ Erro ao remover produto:', err);
      res.status(500).json({ erro: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ erro: 'Produto não encontrado' });
      return;
    }
    res.json({ mensagem: 'Produto removido' });
  });
});

// ========== USUÁRIOS ==========

// CADASTRO
app.post('/api/auth/register', (req, res) => {
  const { nome, email, telefone, endereco, numero, cep, senha } = req.body;
  
  console.log('📝 Tentando cadastrar:', email);
  
  db.get('SELECT id FROM usuarios WHERE email = ?', [email], (err, row) => {
    if (err) {
      console.error('❌ Erro na verificação:', err);
      res.status(500).json({ erro: 'Erro interno ao verificar email' });
      return;
    }
    
    if (row) {
      console.log('❌ Email já cadastrado:', email);
      res.status(400).json({ erro: 'Email já cadastrado!' });
      return;
    }
    
    console.log('✅ Email disponível, cadastrando...');
    
    db.run(
      `INSERT INTO usuarios (nome, email, telefone, endereco, numero, cep, senha, isAdmin) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, email, telefone, endereco, numero, cep || '', senha, 0],
      function(err) {
        if (err) {
          console.error('❌ Erro ao inserir:', err);
          if (err.message.includes('UNIQUE')) {
            res.status(400).json({ erro: 'Email já cadastrado!' });
            return;
          }
          res.status(500).json({ erro: 'Erro ao cadastrar: ' + err.message });
          return;
        }
        console.log('✅ Usuário cadastrado! ID:', this.lastID);
        res.status(201).json({ 
          sucesso: true,
          mensagem: 'Usuário cadastrado com sucesso!',
          id: this.lastID
        });
      }
    );
  });
});

// LOGIN
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  
  console.log('🔑 Tentando login:', email);
  
  db.get(
    'SELECT * FROM usuarios WHERE email = ? AND senha = ?',
    [email, senha],
    (err, usuario) => {
      if (err) {
        console.error('❌ Erro no login:', err);
        res.status(500).json({ erro: err.message });
        return;
      }
      if (!usuario) {
        console.log('❌ Credenciais inválidas:', email);
        res.status(401).json({ erro: 'Credenciais inválidas' });
        return;
      }
      console.log('✅ Login realizado:', usuario.nome);
      console.log(`👑 Admin: ${usuario.isAdmin === 1 ? 'Sim' : 'Não'}`);
      
      res.json({
        sucesso: true,
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          telefone: usuario.telefone,
          endereco: usuario.endereco,
          numero: usuario.numero,
          isAdmin: usuario.isAdmin === 1
        }
      });
    }
  );
});

// LISTAR USUÁRIOS
app.get('/api/usuarios', (req, res) => {
  db.all('SELECT id, nome, email, telefone, endereco, numero, isAdmin FROM usuarios', (err, rows) => {
    if (err) {
      console.error('❌ Erro ao listar usuários:', err);
      res.status(500).json({ erro: err.message });
      return;
    }
    res.json(rows || []);
  });
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🔗 http://localhost:${PORT}`);
});

// Fechar banco ao finalizar
process.on('SIGINT', () => {
  db.close(() => {
    console.log('📁 Banco de dados fechado');
    process.exit(0);
  });
});
