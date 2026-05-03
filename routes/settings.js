const express = require('express');
const router = express.Router();
const { supabase } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { data } = await supabase.from('settings').select('key, value, is_encrypted');
    const result = {};
    (data || []).forEach(s => {
      result[s.key] = s.is_encrypted ? '••••••••••••' : s.value;
    });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const sensitive = ['openai_key', 'gemini_key', 'whatsapp_token'];
    const rows = Object.entries(req.body).map(([key, value]) => ({
      key, value, is_encrypted: sensitive.includes(key)
    }));
    await supabase.from('settings').upsert(rows, { onConflict: 'key' });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
