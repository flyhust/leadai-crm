const express = require('express');
const router = express.Router();
const { supabase } = require('../models');

router.get('/', async (req, res) => {
  try {
    const { tier } = req.query;
    let query = supabase.from('leads').select('*, customers(name, phone, email)').order('score', { ascending: false });
    if (tier) query = query.eq('tier', tier);
    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stats', async (req, res) => {
  try {
    const { data } = await supabase.from('leads').select('tier');
    const stats = { hot: 0, warm: 0, cold: 0, total: data.length };
    data.forEach(l => stats[l.tier]++);
    res.json(stats);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['is_ai_paused', 'assigned_to', 'notes', 'tags', 'tier', 'score'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const { data, error } = await supabase.from('leads').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/:id/takeover', async (req, res) => {
  try {
    const { data } = await supabase.from('leads')
      .update({ is_ai_paused: true, assigned_to: req.body.assignedTo || '销售' })
      .eq('id', req.params.id).select().single();
    res.json({ success: true, lead: data });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
