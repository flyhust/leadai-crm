const express = require('express');
const axios = require('axios');
const { supabase } = require('../models');
const aiService = require('../services/aiService');
const notificationService = require('../services/notificationService');

module.exports = (broadcast) => {
  const router = express.Router();

  router.get('/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  router.post('/whatsapp', async (req, res) => {
    res.sendStatus(200);
    try {
      const body = req.body;
      if (body.object !== 'whatsapp_business_account') return;
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;
          const messages = change.value.messages;
          if (!messages?.length) continue;
          for (const msg of messages) {
            await processMessage(msg, change.value.contacts?.[0], broadcast);
          }
        }
      }
    } catch (err) {
      console.error('Webhook error:', err);
    }
  });

  return router;
};

async function processMessage(msg, contact, broadcast) {
  if (msg.type !== 'text') return;
  const phone = msg.from;
  const name = contact?.profile?.name || 'Unknown';
  const text = msg.text.body;

  // Upsert customer
  const { data: customer } = await supabase
    .from('customers')
    .upsert({ phone, name }, { onConflict: 'phone' })
    .select().single();

  // Get or create lead
  let { data: lead } = await supabase
    .from('leads').select('*').eq('phone', phone).single();
  if (!lead) {
    const { data } = await supabase
      .from('leads')
      .insert({ customer_id: customer.id, phone, score: 0, tier: 'cold' })
      .select().single();
    lead = data;
  }

  if (lead.is_ai_paused) {
    broadcast({ type: 'new_message', phone, name, message: text, aiPaused: true });
    return;
  }

  // Get conversation history
  const { data: history } = await supabase
    .from('messages')
    .select('role, content')
    .eq('phone', phone)
    .order('created_at', { ascending: true })
    .limit(20);

  const messages = (history || []).map(m => ({
    role: m.role === 'customer' ? 'user' : 'assistant',
    content: m.content
  }));
  messages.push({ role: 'user', content: text });

  // Save customer message
  await supabase.from('messages').insert({ phone, role: 'customer', content: text });

  // AI reply
  const { reply, newScore, scoreReason } = await aiService.generateReply({
    messages, customerName: name, phone, leadScore: lead.score
  });

  // Save AI message
  await supabase.from('messages').insert({ phone, role: 'ai', content: reply });

  // Update lead score
  const tier = newScore >= 80 ? 'hot' : newScore >= 50 ? 'warm' : 'cold';
  await supabase.from('leads').update({
    score: newScore, tier, score_reason: scoreReason, last_activity: new Date()
  }).eq('id', lead.id);

  // Send WhatsApp reply
  await sendWhatsApp(phone, reply);

  // Hot lead notification
  if (tier === 'hot' && !lead.hot_notified) {
    await supabase.from('leads').update({ hot_notified: true }).eq('id', lead.id);
    await notificationService.notifyHotLead({ customer: { name, phone }, lead: { ...lead, score: newScore, scoreReason }, lastMessage: text });
  }

  broadcast({ type: 'new_message', phone, name, message: text, aiReply: reply, lead: { tier, score: newScore } });
}

async function sendWhatsApp(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  try {
    await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      messaging_product: 'whatsapp', to, type: 'text', text: { body: text }
    }, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    console.error('WhatsApp send error:', err.response?.data || err.message);
  }
}
