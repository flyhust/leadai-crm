require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const broadcast = (data) => {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'connected' }));
});

app.use('/webhook',          require('./routes/webhook')(broadcast));
app.use('/api/leads',        require('./routes/leads'));
app.use('/api/conversations',require('./routes/conversations'));
app.use('/api/settings',     require('./routes/settings'));
app.use('/api/knowledge',    require('./routes/knowledge'));
app.use('/api/appointments', require('./routes/appointments'));

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`LeadAI running on port ${PORT}`);
});
