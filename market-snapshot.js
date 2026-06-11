/* ============================================================
   netlify/functions/macro.js
   Fetches macro indicators from FRED API (free, requires key)
   or returns simulated demo data if FRED_API_KEY is not set.
   Indicators: FEDFUNDS, CPIAUCSL, UNRATE, DGS10
   ============================================================ */

const FRED_SERIES = {
  FEDFUNDS: { name: 'Fed Funds Rate',     weight: 0.3, direction: -1 }, // high rate = bearish
  CPIAUCSL: { name: 'CPI Inflation',      weight: 0.3, direction: -1 }, // high inflation = bearish
  UNRATE:   { name: 'Unemployment Rate',  weight: 0.2, direction: -1 }, // high unemployment = bearish
  DGS10:    { name: '10Y Treasury Yield', weight: 0.2, direction: -1 }, // high yield = somewhat bearish for stocks
};

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const fredKey = process.env.FRED_API_KEY || '';

  if (!fredKey) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ...generateDemoMacro(), _demo: true }),
    };
  }

  try {
    const results = {};
    await Promise.allSettled(
      Object.keys(FRED_SERIES).map(async (series) => {
        const val = await fetchFRED(series, fredKey);
        results[series] = { value: val, ...FRED_SERIES[series] };
      })
    );

    const macroRiskScore = calcMacroRisk(results);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ series: results, macroRiskScore, _demo: false }),
    };
  } catch (e) {
    console.error('macro error:', e.message);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ ...generateDemoMacro(), _demo: true, _error: e.message }),
    };
  }
};

async function fetchFRED(seriesId, apiKey) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=1`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(7000) });
  if (!resp.ok) throw new Error(`FRED HTTP ${resp.status}`);
  const json = await resp.json();
  const obs  = json.observations?.[0];
  return obs ? parseFloat(obs.value) : null;
}

function calcMacroRisk(results) {
  // Returns 0–100: 0 = very bullish macro, 100 = very bearish macro
  const thresholds = {
    FEDFUNDS: { lo: 1, hi: 5 },
    CPIAUCSL: { lo: 200, hi: 320 },
    UNRATE:   { lo: 3, hi: 6 },
    DGS10:    { lo: 1, hi: 5 },
  };
  let score = 50;
  for (const [key, cfg] of Object.entries(thresholds)) {
    const val = results[key]?.value;
    if (val == null) continue;
    const norm = (val - cfg.lo) / (cfg.hi - cfg.lo);
    const contribution = (FRED_SERIES[key].weight * norm * 100) * FRED_SERIES[key].direction * -1;
    score += contribution;
  }
  return Math.max(0, Math.min(100, score));
}

function generateDemoMacro() {
  return {
    series: {
      FEDFUNDS: { name: 'Fed Funds Rate',     value: 5.33,  weight: 0.3 },
      CPIAUCSL: { name: 'CPI',                value: 314.2, weight: 0.3 },
      UNRATE:   { name: 'Unemployment Rate',  value: 3.9,   weight: 0.2 },
      DGS10:    { name: '10Y Treasury Yield', value: 4.35,  weight: 0.2 },
    },
    macroRiskScore: 58,
  };
}
