const express = require('express');
const router = express.Router();
const { supabase } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { data } = await supabase
      .from('appointments')
      .select('*, customers(name, phone)')
      .order('datetime', { ascending: true });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { phone, type, datetime, duration, location, notes } = req.body;
    const { data: customer } = await supabase.from('customers').select('id').eq('phone', phone).single();
    if (!customer) return res.status(400).json({ error: '顾客不存在' });
    const { data } = await supabase.from('appointments')
      .insert({ customer_id: customer.id, phone, type, datetime, duration: duration || 60, location, notes, status: 'scheduled' })
      .select().single();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['status', 'datetime', 'location', 'notes', 'duration'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data } = await supabase.from('appointments').update(updates).eq('id', req.params.id).select().single();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
