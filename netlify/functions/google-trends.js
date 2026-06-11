/* ============================================================
   netlify/functions/news-sentiment.js
   Fetches news from GDELT (free, no key) for a given symbol.
   If OPENAI_API_KEY is set, runs GPT sentiment analysis.
   Otherwise uses simple keyword scoring.
   ============================================================ */

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const symbol  = (event.queryStringParameters?.symbol || 'AAPL').toUpperCase();
  const company = COMPANY_NAMES[symbol] || symbol;
  const openaiKey = process.env.OPENAI_API_KEY || '';

  try {
    const articles = await fetchGDELT(company);
    let sentimentScore = 0;
    let method = 'keyword';

    if (openaiKey && articles.length > 0) {
      sentimentScore = await openAISentiment(articles, openaiKey);
      method = 'openai';
    } else {
      sentimentScore = keywordSentiment(articles);
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        symbol, articles: articles.slice(0, 8),
        sentimentScore,  // -1 to 1
        method,
        _demo: !openaiKey,
      }),
    };
  } catch (e) {
    console.error('news-sentiment error:', e.message);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ symbol, articles: demoArticles(symbol), sentimentScore: 0.1, method: 'demo', _demo: true }),
    };
  }
};

// ── GDELT ─────────────────────────────────────────────────
async function fetchGDELT(company) {
  const query = encodeURIComponent(`"${company}"`);
  const url   = `https://api.gdeltproject.org/api/v2/doc/doc?query=${query}&mode=artlist&maxrecords=20&format=json&timespan=1d`;
  const resp  = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!resp.ok) return [];
  const json = await resp.json();
  return (json.articles || []).map(a => ({
    title:   a.title || '',
    url:     a.url || '',
    source:  a.domain || '',
    seenAt:  a.seendate || '',
  }));
}

// ── OPENAI SENTIMENT ──────────────────────────────────────
async function openAISentiment(articles, apiKey) {
  const titles = articles.map(a => a.title).join('\n');
  const prompt = `Analyze sentiment of these news headlines about a financial asset. Return a single number between -1 (very negative) and 1 (very positive). Only return the number, nothing else.\n\n${titles}`;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10000),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature: 0,
    }),
  });
  if (!resp.ok) throw new Error('OpenAI HTTP ' + resp.status);
  const json = await resp.json();
  const text = json.choices?.[0]?.message?.content?.trim() || '0';
  const val  = parseFloat(text);
  return isNaN(val) ? 0 : Math.max(-1, Math.min(1, val));
}

// ── KEYWORD SENTIMENT ─────────────────────────────────────
const POS_WORDS = ['surge','rally','beat','record','profit','gain','growth','upgrade','buy','strong','positive','bullish','breakthrough','innovative','partnership','deal','revenue','exceed'];
const NEG_WORDS = ['crash','fall','drop','loss','decline','downgrade','sell','weak','negative','bearish','lawsuit','fine','fraud','recall','miss','cut','layoff','warning','risk'];

function keywordSentiment(articles) {
  if (!articles.length) return 0;
  let score = 0;
  for (const a of articles) {
    const text = (a.title || '').toLowerCase();
    for (const w of POS_WORDS) if (text.includes(w)) score++;
    for (const w of NEG_WORDS) if (text.includes(w)) score--;
  }
  return Math.max(-1, Math.min(1, score / (articles.length * 3)));
}

// ── DEMO ARTICLES ─────────────────────────────────────────
function demoArticles(sym) {
  return [
    { title: `${sym}: Analytici zvyšujú cieľovú cenu`, source: 'Reuters (DEMO)', seenAt: new Date().toISOString(), sentiment: 'positive' },
    { title: `Trhy čakajú na rozhodnutie FED – ${sym} v pohybe`, source: 'Bloomberg (DEMO)', seenAt: new Date().toISOString(), sentiment: 'neutral' },
    { title: `${sym} oznamuje nové partnerstvo v AI sektore`, source: 'CNBC (DEMO)', seenAt: new Date().toISOString(), sentiment: 'positive' },
  ];
}

// ── COMPANY NAME MAP ──────────────────────────────────────
const COMPANY_NAMES = {
  AAPL: 'Apple',  NVDA: 'NVIDIA',  TSLA: 'Tesla',
  MSFT: 'Microsoft',  GOOGL: 'Google',  AMZN: 'Amazon',
  META: 'Meta',   NFLX: 'Netflix',  'BTC-USD': 'Bitcoin',
  'ETH-USD': 'Ethereum',  'GC=F': 'Gold',  'CL=F': 'Oil crude',
};
