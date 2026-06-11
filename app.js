/* ============================================================
   netlify/functions/market-snapshot.js
   Fetches OHLCV data from Yahoo Finance (fallback, free) or
   Polygon.io (if POLYGON_API_KEY is set) and computes:
   RSI14, SMA20, SMA50, momentum, volatility
   ============================================================ */

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const symbolsParam = event.queryStringParameters?.symbols || 'AAPL';
  const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 6);
  const polygonKey = process.env.POLYGON_API_KEY || '';
  const isDemo = !polygonKey;

  const result = { _demo: isDemo };

  await Promise.allSettled(symbols.map(async sym => {
    try {
      let data;
      if (polygonKey) {
        data = await fetchPolygon(sym, polygonKey);
      } else {
        data = await fetchYahoo(sym);
      }
      if (data) {
        result[sym] = {
          ...data,
          _isDemo: isDemo,
        };
      }
    } catch (e) {
      console.error(`Error fetching ${sym}:`, e.message);
      result[sym] = generateFallback(sym);
    }
  }));

  return { statusCode: 200, headers, body: JSON.stringify(result) };
};

// ── YAHOO FINANCE ─────────────────────────────────────────
async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!resp.ok) throw new Error(`Yahoo HTTP ${resp.status}`);
  const json = await resp.json();
  return parseYahoo(json, symbol);
}

function parseYahoo(json, symbol) {
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('No Yahoo data');

  const meta   = result.meta || {};
  const quotes = result.indicators?.quote?.[0] || {};
  const closes = (quotes.close || []).filter(c => c != null);
  if (closes.length < 10) throw new Error('Insufficient data');

  const price    = meta.regularMarketPrice || closes[closes.length - 1];
  const prevClose = meta.chartPreviousClose || closes[closes.length - 2] || price;
  const change   = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  const volume   = (quotes.volume || []).filter(v => v != null).slice(-1)[0] || 0;

  return {
    price,
    change,
    volume,
    rsi:        calcRSI(closes, 14),
    sma20:      calcSMA(closes, 20),
    sma50:      calcSMA(closes, 50),
    momentum:   calcMomentum(closes, 10),
    volatility: calcVolatility(closes, 14),
  };
}

// ── POLYGON.IO ────────────────────────────────────────────
async function fetchPolygon(symbol, apiKey) {
  const polySymbol = toPolygonSymbol(symbol);
  const to   = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
  const url  = `https://api.polygon.io/v2/aggs/ticker/${polySymbol}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=100&apiKey=${apiKey}`;

  const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!resp.ok) throw new Error(`Polygon HTTP ${resp.status}`);
  const json = await resp.json();
  if (!json.results?.length) throw new Error('No Polygon data');

  const closes = json.results.map(r => r.c);
  const last   = json.results[json.results.length - 1];
  const prev   = json.results[json.results.length - 2];

  return {
    price:      last.c,
    change:     prev ? ((last.c - prev.c) / prev.c) * 100 : 0,
    volume:     last.v,
    rsi:        calcRSI(closes, 14),
    sma20:      calcSMA(closes, 20),
    sma50:      calcSMA(closes, 50),
    momentum:   calcMomentum(closes, 10),
    volatility: calcVolatility(closes, 14),
  };
}

function toPolygonSymbol(sym) {
  const map = { 'BTC-USD': 'X:BTCUSD', 'ETH-USD': 'X:ETHUSD', 'GC=F': 'C:XAUUSD', 'CL=F': 'NYMEX:CL' };
  return map[sym] || sym;
}

// ── INDICATORS ────────────────────────────────────────────
function calcSMA(closes, period) {
  if (closes.length < period) return closes[closes.length - 1] || null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  const diffs = closes.slice(-(period + 1)).map((c, i, a) => i > 0 ? c - a[i - 1] : null).filter(v => v !== null);
  const gains = diffs.map(d => d > 0 ? d : 0);
  const losses = diffs.map(d => d < 0 ? -d : 0);
  const avgGain = gains.reduce((a, b) => a + b, 0) / period;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMomentum(closes, period = 10) {
  if (closes.length < period) return 0;
  const old = closes[closes.length - period - 1];
  const cur = closes[closes.length - 1];
  return old ? ((cur - old) / old) * 100 : 0;
}

function calcVolatility(closes, period = 14) {
  if (closes.length < period + 1) return 0;
  const returns = closes.slice(-(period + 1)).map((c, i, a) => i > 0 ? Math.log(c / a[i - 1]) : null).filter(v => v !== null);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance);
}

// ── DEMO FALLBACK ─────────────────────────────────────────
function generateFallback(sym) {
  const seed  = [...sym].reduce((a, c) => a + c.charCodeAt(0), 0);
  const prices = { AAPL: 189, NVDA: 850, TSLA: 175, 'BTC-USD': 68000, 'GC=F': 2350, 'CL=F': 79 };
  const base  = (prices[sym] || 100 + seed % 200) * (1 + (seed % 10 - 5) * 0.01);
  return {
    price:       base,
    change:      -3 + (seed % 60) * 0.1,
    volume:      1000000 + seed * 10000,
    rsi:         40 + seed % 40,
    sma20:       base * (0.97 + (seed % 6) * 0.01),
    sma50:       base * (0.94 + (seed % 8) * 0.01),
    momentum:    -3 + (seed % 60) * 0.1,
    volatility:  0.01 + (seed % 6) * 0.005,
    _isDemo: true,
    _error: 'Data unavailable – fallback to demo',
  };
}
