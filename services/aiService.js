const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { supabase } = require('../models');

async function generateReply({ messages, customerName, phone, leadScore }) {
  const { data: settings } = await supabase.from('settings').select('key, value');
  const cfg = {};
  (settings || []).forEach(s => cfg[s.key] = s.value);

  const model = cfg.ai_model || 'gpt-4o';
  const systemPrompt = cfg.system_prompt || defaultPrompt(customerName);

  const { data: knowledge } = await supabase.from('knowledge')
    .select('title, content').eq('is_active', true).limit(3);
  const kb = (knowledge || []).map(k => `[${k.title}]\n${k.content?.slice(0, 400)}`).join('\n\n');
  const fullSystem = systemPrompt + (kb ? `\n\n[知识库]\n${kb}` : '');

  let reply;
  if (model.startsWith('gemini')) {
    reply = await geminiReply(model, fullSystem, messages);
  } else {
    reply = await openaiReply(model, fullSystem, messages);
  }

  const scored = await scoreLead(messages, leadScore);
  return { reply, newScore: scored.score, scoreReason: scored.reason };
}

async function openaiReply(model, system, messages) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model, max_tokens: 400, temperature: 0.7,
    messages: [{ role: 'system', content: system }, ...messages]
  });
  return res.choices[0].message.content;
}

async function geminiReply(model, system, messages) {
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const gm = client.getGenerativeModel({ model, systemInstruction: system });
  const history = messages.slice(0, -1).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
  const chat = gm.startChat({ history });
  const result = await chat.sendMessage(messages.at(-1).content);
  return result.response.text();
}

async function scoreLead(messages, current) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const recent = messages.slice(-4).map(m => `${m.role === 'user' ? '客户' : 'AI'}: ${m.content}`).join('\n');
    const res = await client.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 150, temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: '评估购买意向 0-100，返回 JSON: {"score":0-100,"reason":"一句话"}\n80+热门，50-79温热，<50冷淡' },
        { role: 'user', content: `当前分:${current}\n${recent}` }
      ]
    });
    const r = JSON.parse(res.choices[0].message.content);
    const max = 20;
    return { score: Math.max(0, Math.min(100, Math.max(current - max, Math.min(current + max, r.score)))), reason: r.reason };
  } catch { return { score: current, reason: '评分暂时不可用' }; }
}

function defaultPrompt(name) {
  return `你是专业的房产销售AI助理。用友善中英双语回复${name || '顾客'}。收集需求（房型/预算/地区/时间），推介项目，引导预约看房。回复简洁不超过120字。`;
}

module.exports = { generateReply };
