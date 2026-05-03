const express = require('express');
const router = express.Router();
const { supabase } = require('../models');
const axios = require('axios');

router.get('/', async (req, res) => {
  try {
    const { data } = await supabase
      .from('messages')
      .select('phone, role, content, created_at, customers(name)')
      .order('created_at', { ascending: false });
    // Group by phone
    const grouped = {};
    (data || []).forEach(m => {
      if (!grouped[m.phone]) grouped[m.phone] = { phone: m.phone, name: m.customers?.name, messages: [], last: m.created_at };
      grouped[m.phone].messages.push(m);
    });
    res.json(Object.values(grouped));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:phone/messages', async (req, res) => {
  try {
    const { data } = await supabase
      .from('messages').select('*')
      .eq('phone', req.params.phone)
      .order('created_at', { ascending: true });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:phone/send', async (req, res) => {
  try {
    const { message } = req.body;
    const phone = req.params.phone;
    await supabase.from('messages').insert({ phone, role: 'human', content: message });
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneId) {
      await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`,
        { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } },
        { headers: { Authorization: `Bearer ${token}` } });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
