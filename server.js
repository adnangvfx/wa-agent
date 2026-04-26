// ═══════════════════════════════════════════════════
//  WhatsApp AI Agent — Backend Server
//  Deploy on Railway.app
// ═══════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'db.json');

// ── Simple JSON Database ──────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { users: {}, conversations: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { users: {}, conversations: [] }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ── Helpers ───────────────────────────────────────
function log(msg) {
  console.log(`[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`);
}

// ── WhatsApp Message Sender ───────────────────────
async function sendWhatsAppMessage(phoneId, waToken, to, message) {
  const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
  await axios.post(url, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: message }
  }, {
    headers: {
      'Authorization': `Bearer ${waToken}`,
      'Content-Type': 'application/json'
    }
  });
}

// ── Claude AI Response Generator ─────────────────
async function generateAIResponse(claudeKey, product, payment, keywords, userMessage, welcomeMsg) {
  const lower = userMessage.toLowerCase();
  const kws = keywords.map(k => k.toLowerCase());
  const hasKeyword = kws.some(k => lower.includes(k));

  if (!hasKeyword) return null; // ignore করো

  const discountLine = product.discount && product.discount < product.price
    ? `💥 বিশেষ অফার: ~~৳${product.price}~~ → *৳${product.discount}* (${Math.round((1 - product.discount / product.price) * 100)}% ছাড়!)`
    : `💰 মূল্য: *৳${product.price}*`;

  const payMethods = { bkash: 'বিকাশ', nagad: 'নগদ', rocket: 'রকেট', bank: 'ব্যাংক ট্রান্সফার', card: 'কার্ড' };
  const payInfo = payment.number
    ? `\n\n💳 *পেমেন্ট পদ্ধতি:* ${payMethods[payment.method] || payment.method}\n📱 *নম্বর:* ${payment.number}${payment.name ? '\n👤 নাম: ' + payment.name : ''}${payment.instructions ? '\n\n📌 ' + payment.instructions : ''}`
    : '';

  const systemPrompt = `তুমি একটি বাংলা ভাষার AI বিক্রয় সহকারী। তুমি নিচের প্রডাক্টটি বিক্রি করো।

প্রডাক্ট: ${product.name}
${discountLine}
সুবিধা: ${product.benefits}
${product.desc ? 'বিবরণ: ' + product.desc : ''}
${payInfo}

নিয়ম:
- সবসময় বাংলায় কথা বলো
- মানুষের মতো করে কথা বলো, রোবটিক না
- ছোট ও আকর্ষণীয় উত্তর দাও
- কাস্টমারকে কিনতে উৎসাহিত করো
- পেমেন্ট তথ্য দিয়ে অর্ডার করতে বলো
- কখনো মিথ্যা তথ্য দেবে না`;

  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }]
  }, {
    headers: {
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });

  return response.data.content[0].text;
}

// ══════════════════════════════════════════════════
//  ROUTES — ADMIN API
// ══════════════════════════════════════════════════

// Save user config (product, payment, keywords, API keys)
app.post('/api/save-config', (req, res) => {
  const { userId, claudeKey, waToken, waPhoneId, waVerifyToken, product, payment, keywords, welcomeMsg, settings } = req.body;
  if (!userId || !claudeKey || !waPhoneId) {
    return res.status(400).json({ ok: false, error: 'userId, claudeKey, waPhoneId আবশ্যক' });
  }
  const db = readDB();
  db.users[userId] = {
    claudeKey, waToken, waPhoneId, waVerifyToken,
    product: product || {},
    payment: payment || {},
    keywords: keywords || ['প্রডাক্ট', 'দাম', 'কিনতে চাই', 'অর্ডার', 'price', 'buy', 'নিতে চাই'],
    welcomeMsg: welcomeMsg || '',
    settings: settings || { ai: true, welcome: true, ignoreOthers: true },
    createdAt: db.users[userId]?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: db.users[userId]?.stats || { total: 0, replied: 0, leads: 0 }
  };
  writeDB(db);
  log(`Config saved for user: ${userId}`);
  res.json({ ok: true, message: 'কনফিগ সেভ হয়েছে!' });
});

// Get config
app.get('/api/config/:userId', (req, res) => {
  const db = readDB();
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ ok: false, error: 'ইউজার পাওয়া যায়নি' });
  // Hide sensitive keys partially
  const safe = { ...user, claudeKey: user.claudeKey ? '***' + user.claudeKey.slice(-6) : '', waToken: user.waToken ? '***' + user.waToken.slice(-6) : '' };
  res.json({ ok: true, config: safe });
});

// Get conversations
app.get('/api/conversations/:userId', (req, res) => {
  const db = readDB();
  const convos = (db.conversations || []).filter(c => c.userId === req.params.userId);
  res.json({ ok: true, conversations: convos.slice(-50) }); // last 50
});

// Stats
app.get('/api/stats/:userId', (req, res) => {
  const db = readDB();
  const user = db.users[req.params.userId];
  if (!user) return res.status(404).json({ ok: false });
  res.json({ ok: true, stats: user.stats || {} });
});

// Test agent (without WhatsApp)
app.post('/api/test-agent', async (req, res) => {
  const { userId, message } = req.body;
  const db = readDB();
  const user = db.users[userId];
  if (!user) return res.status(404).json({ ok: false, error: 'ইউজার পাওয়া যায়নি' });
  try {
    const reply = await generateAIResponse(
      user.claudeKey, user.product, user.payment,
      user.keywords, message, user.welcomeMsg
    );
    res.json({ ok: true, reply: reply || '(এই মেসেজে কোনো কীওয়ার্ড নেই — উপেক্ষা করা হয়েছে)' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ══════════════════════════════════════════════════
//  WEBHOOK — WhatsApp incoming messages
// ══════════════════════════════════════════════════

// Verification (GET)
app.get('/webhook/:userId', (req, res) => {
  const { userId } = req.params;
  const db = readDB();
  const user = db.users[userId];
  if (!user) return res.sendStatus(404);

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === user.waVerifyToken) {
    log(`Webhook verified for user: ${userId}`);
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Incoming message (POST)
app.post('/webhook/:userId', async (req, res) => {
  const { userId } = req.params;
  res.sendStatus(200); // Always respond 200 quickly to WhatsApp

  try {
    const db = readDB();
    const user = db.users[userId];
    if (!user || !user.settings?.ai) return;

    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) return;

    const msg = messages[0];
    if (msg.type !== 'text') return;

    const from = msg.from;
    const text = msg.text.body;
    const timestamp = new Date().toISOString();

    log(`Message from ${from}: "${text}"`);

    // Update stats
    user.stats = user.stats || { total: 0, replied: 0, leads: 0 };
    user.stats.total++;

    // Save conversation
    db.conversations = db.conversations || [];
    db.conversations.push({ userId, from, text, type: 'incoming', timestamp });

    // Generate AI response
    const reply = await generateAIResponse(
      user.claudeKey, user.product, user.payment,
      user.keywords, text, user.welcomeMsg
    );

    if (reply) {
      await sendWhatsAppMessage(user.waPhoneId, user.waToken, from, reply);
      user.stats.replied++;
      if (reply.includes('পেমেন্ট') || reply.includes('বিকাশ') || reply.includes('নগদ')) {
        user.stats.leads++;
      }
      db.conversations.push({ userId, from: 'AI Agent', text: reply, type: 'outgoing', timestamp: new Date().toISOString() });
      log(`Reply sent to ${from}`);
    } else {
      log(`Ignored message from ${from} (no keyword match)`);
    }

    db.users[userId] = user;
    writeDB(db);

  } catch (err) {
    log(`Error: ${err.message}`);
  }
});

// Health check
app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🚀 Server চালু হয়েছে: port ${PORT}`);
  log(`📱 Webhook URL: https://YOUR-APP.railway.app/webhook/YOUR-USER-ID`);
});
