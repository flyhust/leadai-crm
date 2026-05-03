/**
 * LeadAI WhatsApp CRM — 后端服务器
 * Node.js + Express + WebSocket
 * 
 * 启动: node server.js
 * 环境变量: 见 .env.example
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ─── Middleware ────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── MongoDB 连接 ──────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/leadai')
  .then(() => console.log('✅ MongoDB 已连接'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

// ─── WebSocket 广播 ────────────────────────────────────────────
const broadcast = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

wss.on('connection', (ws) => {
  console.log('🔌 Dashboard 已连接 WebSocket');
  ws.send(JSON.stringify({ type: 'connected', message: 'LeadAI 实时连接已建立' }));
});

// ─── 路由加载 ──────────────────────────────────────────────────
app.use('/webhook',    require('./routes/webhook')(broadcast));
app.use('/api/leads',  require('./routes/leads'));
app.use('/api/conversations', require('./routes/conversations'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/knowledge', require('./routes/knowledge'));
app.use('/api/appointments', require('./routes/appointments'));

// ─── Health Check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ─── 启动 ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 LeadAI 服务器运行在 http://localhost:${PORT}`);
  console.log(`📡 WebSocket 已就绪`);
  console.log(`🔗 WhatsApp Webhook: http://localhost:${PORT}/webhook/whatsapp`);
});

module.exports = { app, broadcast };
