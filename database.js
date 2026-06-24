const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Criar/abrir o banco de dados (arquivo .db)
const db = new sqlite3.Database('./conv-urbana.db');

// Criar as tabelas
db.serialize(() => {
  // Tabela de produtos
  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      preco REAL NOT NULL,
      imagem TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de usuários
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
  `);

  // Tabela de pedidos
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
  `);

  console.log('✅ Banco de dados SQLite criado/aberto!');
});

module.exports = db;