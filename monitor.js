/* ============================================================
   netlify/functions/send-push.js
   Sends a OneSignal push notification.
   Requires ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY env vars.
   If not set, logs the notification and returns 200 (silent fail).
   ============================================================ */

exports.handler = async (event) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: 'Method Not Allowed' };

  const appId  = process.env.ONESIGNAL_APP_ID      || '';
  const apiKey = process.env.ONESIGNAL_REST_API_KEY || '';

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch {}

  const { symbol, action, confidence, reasons = [] } = body;
  const emoji  = action === 'BUY' ? '📈' : action === 'SELL' ? '📉' : '⚡';
  const title  = `${emoji} SynTrade: ${symbol} – ${action}`;
  const message = `Istota ${confidence}% | ${reasons.slice(0, 2).join(', ') || 'Technický signál'}`;

  // Log for debugging even without OneSignal
  console.log('[send-push]', title, '|', message);

  if (!appId || !apiKey) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ sent: false, reason: 'OneSignal not configured – add ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY env vars.' }),
    };
  }

  try {
    const resp = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id:             appId,
        included_segments:  ['All'],
        headings:           { en: title },
        contents:           { en: message },
        url:                '/',
        web_push_topic:     `syntrade-${symbol}`,
        // Custom data (accessible in service worker)
        data: { symbol, action, confidence, reasons },
      }),
      signal: AbortSignal.timeout(8000),
    });

    const result = await resp.json();
    if (!resp.ok) throw new Error(JSON.stringify(result));

    return { statusCode: 200, headers, body: JSON.stringify({ sent: true, id: result.id }) };
  } catch (e) {
    console.error('[send-push] OneSignal error:', e.message);
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ sent: false, error: e.message }),
    };
  }
};
