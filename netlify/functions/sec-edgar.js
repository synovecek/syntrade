/* ============================================================
   netlify/functions/shared/signal.js
   Shared signal calculation – used by monitor.js (server-side)
   Mirrors the logic in app.js (client-side)
   ============================================================ */

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function calculateSignal(d) {
  const reasons = [];
  const risks   = [];
  let score = 0;

  // Technical Analysis (35%)
  let techScore = 0;
  if (d.rsi != null) {
    if (d.rsi >= 45 && d.rsi <= 65)  techScore += 30, reasons.push(`RSI ${d.rsi.toFixed(1)} – zdravá zóna`);
    else if (d.rsi < 35)             techScore += 20, reasons.push(`RSI ${d.rsi.toFixed(1)} – prepredané`);
    else if (d.rsi > 75)             techScore -= 25, risks.push(`RSI ${d.rsi.toFixed(1)} – prekúpené`);
  }
  if (d.price != null && d.sma20 != null) {
    if (d.price > d.sma20) techScore += 20, reasons.push('Cena nad SMA20');
    else techScore -= 20, risks.push('Cena pod SMA20');
  }
  if (d.price != null && d.sma50 != null) {
    if (d.price > d.sma50) techScore += 15, reasons.push('Cena nad SMA50');
    else techScore -= 15, risks.push('Cena pod SMA50');
  }
  if (d.momentum != null) {
    if (d.momentum > 2)       techScore += 20, reasons.push(`Silný momentum +${d.momentum.toFixed(1)}%`);
    else if (d.momentum > 0)  techScore += 10;
    else if (d.momentum < -2) techScore -= 20, risks.push(`Negatívny momentum ${d.momentum.toFixed(1)}%`);
    else techScore -= 10;
  }
  if (d.volatility != null && d.volatility > 0.06) techScore -= 10, risks.push('Vysoká volatilita');
  score += clamp(techScore, -100, 100) * 0.35;

  // News Sentiment (25%)
  if (d.newsSentiment != null) {
    if (d.newsSentiment > 0.3)       reasons.push('Pozitívny mediálny sentiment');
    else if (d.newsSentiment < -0.3) risks.push('Negatívny mediálny sentiment');
    score += clamp(d.newsSentiment * 100, -100, 100) * 0.25;
  }

  // Macro (15%)
  if (d.macroRisk != null) {
    if (d.macroRisk > 70)      risks.push('Zvýšené makro riziko');
    else if (d.macroRisk < 30) reasons.push('Priaznivé makro prostredie');
    score += clamp(-(d.macroRisk - 50) * 2, -100, 100) * 0.15;
  }

  // Insider (15%)
  if (d.insiderActivity != null) {
    if (d.insiderActivity > 0.3)       reasons.push('Insider nákupy');
    else if (d.insiderActivity < -0.3) risks.push('Insider predaje');
    score += clamp(d.insiderActivity * 100, -100, 100) * 0.15;
  }

  // Google Trends (10%)
  if (d.trendScore != null) {
    if (d.trendScore > 70) reasons.push('Google Trends spike');
    score += clamp((d.trendScore - 50) * 2, -100, 100) * 0.10;
  }

  const confidence = Math.round(clamp(50 + score * 0.5, 30, 99));
  const action     = score > 20 ? 'BUY' : score < -15 ? 'SELL' : 'HOLD';

  return { action, confidence, reasons: reasons.slice(0, 5), risks: risks.slice(0, 4) };
}

module.exports = { calculateSignal };
