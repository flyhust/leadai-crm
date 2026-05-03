const express = require('express');
const router = express.Router();
const { supabase } = require('../models');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', async (req, res) => {
  try {
    const { data } = await supabase.from('knowledge').select('id, title, type, filename, created_at').eq('is_active', true).order('created_at', { ascending: false });
    res.json(data || []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/text', async (req, res) => {
  try {
    const { title, content } = req.body;
    const { data } = await supabase.from('knowledge').insert({ title, type: 'text', content, is_active: true }).select().single();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '请上传文件' });
    let content = '';
    if (req.file.mimetype === 'application/pdf') {
      const parsed = await pdfParse(req.file.buffer);
      content = parsed.text;
    } else {
      content = req.file.buffer.toString('utf-8');
    }
    const { data } = await supabase.from('knowledge').insert({
      title: req.body.title || req.file.originalname,
      type: req.file.mimetype === 'application/pdf' ? 'pdf' : 'text',
      content, filename: req.file.originalname, is_active: true
    }).select().single();
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await supabase.from('knowledge').update({ is_active: false }).eq('id', req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
