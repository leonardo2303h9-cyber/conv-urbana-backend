// api.js - BACKEND COMPLETO EM 1 ARQUIVO!
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

// ========== CONECTAR AO MONGODB ==========
const MONGODB_URI = 'mongodb+srv://leonardo2303h9_db_user:XXEjckSRbDTgHZa@cluster0.xxxxx.mongodb.net/conv-urbana';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado!'))
  .catch(err => console.error('❌ Erro:', err));

// ========== ESQUEMAS ==========
const ProdutoSchema = new mongoose.Schema({
  nome: String,
  preco: Number,
  imagem: String,
  createdAt: { type: Date, default: Date.now }
});
const Produto = mongoose.model('Produto', ProdutoSchema);

const UsuarioSchema = new mongoose.Schema({
  nome: String,
  email: { type: String, unique: true },
  telefone: String,
  endereco: String,
  numero: String,
  senha: String,
  isAdmin: { type: Boolean, default: false }
});
const Usuario = mongoose.model('Usuario', UsuarioSchema);

// ========== ROTAS ==========

// Produtos
app.get('/api/produtos', async (req, res) => {
  const produtos = await Produto.find().sort({ createdAt: -1 });
  res.json(produtos);
});

app.post('/api/produtos', async (req, res) => {
  const produto = await Produto.create(req.body);
  res.status(201).json(produto);
});

app.put('/api/produtos/:id', async (req, res) => {
  const produto = await Produto.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(produto);
});

app.delete('/api/produtos/:id', async (req, res) => {
  await Produto.findByIdAndDelete(req.params.id);
  res.json({ mensagem: 'Removido' });
});

// Usuários
app.post('/api/auth/register', async (req, res) => {
  const existe = await Usuario.findOne({ email: req.body.email });
  if (existe) {
    return res.status(400).json({ erro: 'Email já cadastrado!' });
  }
  const usuario = await Usuario.create(req.body);
  res.status(201).json({ sucesso: true, mensagem: 'Usuário cadastrado!' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  const usuario = await Usuario.findOne({ email, senha });
  if (!usuario) {
    return res.status(401).json({ erro: 'Credenciais inválidas' });
  }
  res.json({
    sucesso: true,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone,
      endereco: usuario.endereco,
      numero: usuario.numero,
      isAdmin: usuario.isAdmin || false
    }
  });
});

// Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', database: 'MongoDB' });
});

// ========== INICIAR ==========
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

module.exports = app;