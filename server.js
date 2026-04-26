const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.get('/', (req, res) => {
  const p1 = path.join(__dirname, 'public', 'index.html');
  const p2 = path.join(__dirname, 'index.html');
  if (fs.existsSync(p1)) return res.sendFile(p1);
  if (fs.existsSync(p2)) return res.sendFile(p2);
  res.send('<h2>Server Running!</h2>');
});

const CONFIG = {
  WA_TOKEN:     process.env.WA_TOKEN     || 'REPLACE_WA_TOKEN',
  WA_PHONE_ID:  process.env.WA_PHONE_ID  || '1147866315071395',
  CLAUDE_KEY:   process.env.CLAUDE_KEY   || 'REPLACE_CLAUDE_KEY',
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'WA_SRNMLAM3MN',
  product: {
    name: 'à¦•à§à¦¯à¦¾à¦¨à¦­à¦¾ à¦ªà§à¦°à§‹ à§§ à¦¬à¦›à¦°',
    price: '1500', discount: '999',
    benefits: 'âœ… à§§ à¦¬à¦›à¦°à§‡à¦° à¦—à§à¦¯à¦¾à¦°à¦¾à¦¨à§à¦Ÿà¦¿\nâœ… à¦¤à¦¾à§Žà¦•à§à¦·à¦£à¦¿à¦• à¦¡à§‡à¦²à¦¿à¦­à¦¾à¦°à¦¿\nâœ… à§¨à§ª/à§­ à¦¸à¦¾à¦ªà§‹à¦°à§à¦Ÿ',
    desc: 'à¦…à¦«à¦¿à¦¶à¦¿à¦¯à¦¼à¦¾à¦² à¦•à§à¦¯à¦¾à¦¨à¦­à¦¾ à¦ªà§à¦°à§‹'
  },
  payment: {
    method: 'bkash', number: '01XXXXXXXXX',
    name: 'Adnan Sami',
    instructions: 'à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ à¦•à¦°à¦¾à¦° à¦ªà¦°à§‡ à¦¸à§à¦•à§à¦°à¦¿à¦¨à¦¶à¦Ÿ à¦ªà¦¾à¦ à¦¾à¦¨à¥¤'
  },
  keywords: ['à¦ªà§à¦°à¦¡à¦¾à¦•à§à¦Ÿ','à¦¦à¦¾à¦®','à¦•à¦¿à¦¨à¦¤à§‡','à¦…à¦°à§à¦¡à¦¾à¦°','price','buy','à¦¨à¦¿à¦¤à§‡ à¦šà¦¾à¦‡','à¦ªà§à¦¯à¦¾à¦•à§‡à¦œ','à¦•à¦¤','à¦•à§à¦¯à¦¾à¦¨à¦­à¦¾','canva','à¦¬à§à¦°à§à¦¯à¦¾à¦¨à§à¦¡','design','à¦¡à¦¿à¦œà¦¾à¦‡à¦¨','à¦¹à§à¦¯à¦¾à¦²à§‹','hello','hi','à¦¹à¦¾à¦‡','à¦†à¦¸','salaam','à¦œà¦¾à¦¨à¦¤à§‡']
};

const DB_FILE = path.join(__dirname, 'db.json');
function readDB() {
  try { if (!fs.existsSync(DB_FILE)) return { conversations:[], stats:{total:0,replied:0,leads:0} }; return JSON.parse(fs.readFileSync(DB_FILE,'utf8')); }
  catch { return { conversations:[], stats:{total:0,replied:0,leads:0} }; }
}
function writeDB(d) { try { fs.writeFileSync(DB_FILE, JSON.stringify(d,null,2)); } catch(e){} }
function log(m) { console.log(`[${new Date().toLocaleTimeString()}] ${m}`); }

async function sendWA(to, message) {
  try {
    await axios.post(`https://graph.facebook.com/v19.0/${CONFIG.WA_PHONE_ID}/messages`,
      { messaging_product:'whatsapp', to, type:'text', text:{body:message} },
      { headers:{'Authorization':`Bearer ${CONFIG.WA_TOKEN}`,'Content-Type':'application/json'} }
    );
    log(`âœ… Sent to ${to}`);
  } catch(e) { log(`âŒ Send error: ${e.response?.data?.error?.message||e.message}`); }
}

async function getAIReply(userMsg) {
  const lower = userMsg.toLowerCase();
  const hasKw = CONFIG.keywords.some(k => lower.includes(k.toLowerCase()));
  if (!hasKw) return null;
  const p = CONFIG.product; const pay = CONFIG.payment;
  const disc = p.discount && Number(p.discount) < Number(p.price)
    ? `à¦¬à¦¿à¦¶à§‡à¦· à¦…à¦«à¦¾à¦°: ~~à§³${p.price}~~ â†’ à¦à¦–à¦¨ à¦®à¦¾à¦¤à§à¦° *à§³${p.discount}* (${Math.round((1-p.discount/p.price)*100)}% à¦›à¦¾à¦¡à¦¼!)`
    : `à¦®à§‚à¦²à§à¦¯: *à§³${p.price}*`;
  const methods = {bkash:'à¦¬à¦¿à¦•à¦¾à¦¶',nagad:'à¦¨à¦—à¦¦',rocket:'à¦°à¦•à§‡à¦Ÿ',bank:'à¦¬à§à¦¯à¦¾à¦‚à¦•',card:'à¦•à¦¾à¦°à§à¦¡'};
  const payTxt = pay.number ? `\n\nðŸ’³ à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ: *${methods[pay.method]||pay.method}*\nðŸ“± à¦¨à¦®à§à¦¬à¦°: *${pay.number}*\nðŸ‘¤ à¦¨à¦¾à¦®: ${pay.name}\n\nðŸ“Œ ${pay.instructions}` : '';
  const sys = `à¦¤à§à¦®à¦¿ à¦à¦•à¦œà¦¨ à¦¬à¦¾à¦‚à¦²à¦¾à¦¦à§‡à¦¶à§€ à¦…à¦¨à¦²à¦¾à¦‡à¦¨ à¦¶à¦ªà§‡à¦° AI à¦¸à§‡à¦²à¦¸ à¦à¦œà§‡à¦¨à§à¦Ÿà¥¤\n\nà¦ªà§à¦°à¦¡à¦¾à¦•à§à¦Ÿ: ${p.name}\nðŸ’° ${disc}\nâœ¨ à¦¸à§à¦¬à¦¿à¦§à¦¾:\n${p.benefits}\n${p.desc?'ðŸ“ '+p.desc:''}${payTxt}\n\nà¦¨à¦¿à¦¯à¦¼à¦®:\n- à¦¬à¦¾à¦‚à¦²à¦¾à¦¯à¦¼ à¦¬à¦¨à§à¦§à§à¦° à¦®à¦¤à§‹ à¦•à¦¥à¦¾ à¦¬à¦²à§‹\n- à¦›à§‹à¦Ÿ à¦“ à¦†à¦•à¦°à§à¦·à¦£à§€à¦¯à¦¼ à¦‰à¦¤à§à¦¤à¦° à¦¦à¦¾à¦“ (à§©-à§« à¦²à¦¾à¦‡à¦¨)\n- à¦•à¦¾à¦¸à§à¦Ÿà¦®à¦¾à¦°à¦•à§‡ à¦•à¦¿à¦¨à¦¤à§‡ à¦‰à§Žà¦¸à¦¾à¦¹à§€ à¦•à¦°à§‹\n- à¦‡à¦®à§‹à¦œà¦¿ à¦¬à§à¦¯à¦¬à¦¹à¦¾à¦° à¦•à¦°à§‹\n- à¦•à¦–à¦¨à§‹ à¦®à¦¿à¦¥à§à¦¯à¦¾ à¦¬à¦²à¦¬à§‡ à¦¨à¦¾`;
  const resp = await axios.post('https://api.anthropic.com/v1/messages',
    { model:'claude-sonnet-4-20250514', max_tokens:400, system:sys, messages:[{role:'user',content:userMsg}] },
    { headers:{'x-api-key':CONFIG.CLAUDE_KEY,'anthropic-version':'2023-06-01','Content-Type':'application/json'} }
  );
  return resp.data.content[0].text;
}

async function handleIncoming(body) {
  try {
    if (body.object !== 'whatsapp_business_account') return;
    const messages = body.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages?.length) return;
    const msg = messages[0];
    if (msg.type !== 'text') return;
    const from = msg.from; const text = msg.text.body;
    log(`ðŸ“© From ${from}: "${text}"`);
    const db = readDB();
    db.stats.total++;
    db.conversations.push({from,text,type:'incoming',time:new Date().toISOString()});
    const reply = await getAIReply(text);
    if (reply) {
      await sendWA(from, reply);
      db.stats.replied++;
      if (reply.includes('à¦¬à¦¿à¦•à¦¾à¦¶')||reply.includes('à¦¨à¦—à¦¦')||reply.includes('à¦ªà§‡à¦®à§‡à¦¨à§à¦Ÿ')) db.stats.leads++;
      db.conversations.push({from:'AI',text:reply,type:'outgoing',time:new Date().toISOString()});
    } else { log('â­ï¸ Ignored - no keyword'); }
    if (db.conversations.length > 200) db.conversations = db.conversations.slice(-200);
    writeDB(db);
  } catch(e) { log(`âŒ Error: ${e.message}`); }
}

// Webhook verify
app.get('/webhook', (req,res) => {
  if (req.query['hub.mode']==='subscribe' && req.query['hub.verify_token']===CONFIG.VERIFY_TOKEN) {
    log('âœ… Webhook verified!'); return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});
app.get('/webhook/:id', (req,res) => {
  if (req.query['hub.mode']==='subscribe' && req.query['hub.verify_token']===CONFIG.VERIFY_TOKEN) {
    log('âœ… Webhook verified!'); return res.send(req.query['hub.challenge']);
  }
  res.sendStatus(403);
});

// Webhook incoming
app.post('/webhook', async (req,res) => { res.sendStatus(200); await handleIncoming(req.body); });
app.post('/webhook/:id', async (req,res) => { res.sendStatus(200); await handleIncoming(req.body); });

// Admin APIs
app.get('/api/stats', (req,res) => res.json({ok:true,stats:readDB().stats}));
app.get('/api/conversations', (req,res) => res.json({ok:true,conversations:readDB().conversations.slice(-50)}));
app.post('/api/product', (req,res) => { Object.assign(CONFIG.product,req.body); res.json({ok:true}); });
app.post('/api/payment', (req,res) => { Object.assign(CONFIG.payment,req.body); res.json({ok:true}); });
app.post('/api/keywords', (req,res) => { if(req.body.keywords) CONFIG.keywords=req.body.keywords; res.json({ok:true}); });
app.post('/api/test', async (req,res) => {
  try { const r = await getAIReply(req.body.message||''); res.json({ok:true,reply:r||'(à¦•à§€à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦¨à§‡à¦‡)'}); }
  catch(e) { res.status(500).json({ok:false,error:e.message}); }
});
app.get('/health', (req,res) => res.json({ok:true,time:new Date().toISOString()}));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => { log(`ðŸš€ Server on port ${PORT}`); });
