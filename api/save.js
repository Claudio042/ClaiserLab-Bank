/**
 * VERCEL SERVERLESS FUNCTION: /api/save
 * Inoltro batch verso Google Apps Script Webhook con logging diagnostico rigoroso.
 */

export const config = {
  maxDuration: 60
};

function sendJson(res, statusCode, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Gemini-Key, X-Webhook-Url');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(statusCode).json(data);
  }
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch (_) { return {}; }
    }
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req, res) {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Gemini-Key, X-Webhook-Url');
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Metodo non consentito. Richiesto POST.' });
  }

  try {
    const body = await parseBody(req);
    let movimenti = [];

    if (Array.isArray(body)) {
      movimenti = body;
    } else if (body.movimenti && Array.isArray(body.movimenti)) {
      movimenti = body.movimenti;
    } else if (body.movements && Array.isArray(body.movements)) {
      movimenti = body.movements;
    } else if (body.data && body.importo !== undefined) {
      movimenti = [body];
    }

    if (movimenti.length === 0) {
      return sendJson(res, 400, {
        success: false,
        error: 'Nessun movimento da salvare specificato nella richiesta.'
      });
    }

    const webhookUrl = (process.env.WEBHOOK_URL || req.headers['x-webhook-url'] || '').trim();
    if (!webhookUrl) {
      return sendJson(res, 400, {
        success: false,
        error: 'WEBHOOK_URL non configurato. Imposta la variabile d\'ambiente su Vercel (Settings > Environment Variables) o nell\'header X-Webhook-Url.'
      });
    }

    const payloadToSend = { movimenti };
    const payloadString = JSON.stringify(payloadToSend);

    console.log('============================================================');
    console.log('📤 [VERCEL SAVE] Invio chiamata HTTP POST verso Google Apps Script');
    console.log('   URL Target:     ', webhookUrl);
    console.log('   Num Movimenti:  ', movimenti.length);
    console.log('============================================================');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 35000);

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payloadString,
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const responseText = await webhookRes.text();

    console.log('📥 [VERCEL SAVE] Risposta da Google Apps Script:');
    console.log('   HTTP Status Code:', webhookRes.status, webhookRes.statusText);
    console.log('   Response Body:', responseText);

    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch (_) {}

    if (!responseJson) {
      let diagnosi = 'Google Apps Script ha restituito HTML anziché JSON.';
      if (responseText.includes('sandboxFrame') || responseText.includes('userHtml')) {
        diagnosi = 'ATTENZIONE: Google Apps Script ha eseguito un doPost non allineato (es. Telegram bot o vecchio script che restituisce HTML). Assicurati che nel tuo doPost principale sia integrato il router verso Open_Banking_App.gs!';
      }
      console.error('❌ [ERRORE WEBHOOK]', diagnosi);
      return sendJson(res, 502, {
        success: false,
        error: diagnosi,
        raw: responseText.slice(0, 400)
      });
    }

    if (responseJson.status !== 'success') {
      console.error('❌ [ERRORE DIRETTO DA GOOGLE APPS SCRIPT]', responseJson);
      return sendJson(res, 500, {
        success: false,
        error: responseJson.message || 'Google Apps Script ha restituito uno stato di errore.',
        details: responseJson
      });
    }

    console.log(`✅ [SAVE COMPLETATO] Inseriti: ${responseJson.inserted}, Duplicati: ${responseJson.skipped}, Totale: ${responseJson.total}`);

    return sendJson(res, 200, {
      success: true,
      message: responseJson.message || 'Movimenti registrati con successo nel foglio BANK_LOG!',
      inserted: responseJson.inserted !== undefined ? responseJson.inserted : movimenti.length,
      skipped: responseJson.skipped !== undefined ? responseJson.skipped : 0,
      total: responseJson.total !== undefined ? responseJson.total : movimenti.length,
      details: responseJson.details || []
    });

  } catch (error) {
    console.error('❌ [ECCEZIONE SAVE]:', error);
    if (error.name === 'AbortError') {
      return sendJson(res, 504, {
        success: false,
        error: 'Timeout (35s) nella chiamata verso il Webhook di Google Sheets. Verifica l\'URL dello script.'
      });
    }
    return sendJson(res, 500, {
      success: false,
      error: `Errore di connessione con il Webhook: ${error.message}`
    });
  }
}
