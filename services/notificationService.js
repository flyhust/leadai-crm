const axios = require('axios');

async function notifyHotLead({ customer, lead, lastMessage }) {
  const phone = process.env.NOTIFY_PHONE;
  if (!phone) return;
  const msg = `🔥 *LeadAI — Hot Lead!*\n\n👤 ${customer.name}\n📱 ${customer.phone}\n⭐ 评分: ${lead.score}/100\n💬 "${lastMessage}"\n📝 ${lead.scoreReason}\n\n👉 请立即在 Dashboard 接管对话！`;
  await sendWhatsApp(phone, msg);
}

async function sendWhatsApp(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return;
  try {
    await axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`,
      { messaging_product: 'whatsapp', to: to.replace(/[^0-9]/g, ''), type: 'text', text: { body: text } },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  } catch (err) { console.error('通知失败:', err.response?.data || err.message); }
}

module.exports = { notifyHotLead, sendWhatsApp };
