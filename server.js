import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Caricatore variabili d'ambiente (.env)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
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
  if (!res.headersSent) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  }
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  if (req.body) {
    if (typeof req.body === 'object') return Promise.resolve(req.body);
    if (typeof req.body === 'string') {
      try { return Promise.resolve(JSON.parse(req.body)); } catch (_) { return Promise.resolve({}); }
    }
  }
  return new Promise((resolve, reject) => {
    let body = '';
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_SIZE) {
        reject(new Error('Payload troppo grande (max 20MB)'));
      }
    });
    req.on('end', () => {
      try {
        if (!body) {
          resolve({});
        } else {
          resolve(JSON.parse(body));
        }
      } catch (err) {
        reject(new Error('JSON non valido nel corpo della richiesta'));
      }
    });
    req.on('error', reject);
  });
}

function calcolaIdSintetico(tx) {
  const causaleStr = String(tx.causale || '');
  const causaleNormalizzata = causaleStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  const dataStr = String(tx.data || '');
  const bancaStr = String(tx.banca || 'Altro');
  const importoStr = String(tx.importo !== undefined ? tx.importo : '0');
  return `${dataStr}_${bancaStr}_${causaleNormalizzata}_${importoStr}`;
}

// Handler per l'estrazione multimodale AI con Gemini Flash
async function handleExtract(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { imageBase64, mimeType } = body;

    if (!imageBase64) {
      return sendJson(res, 400, {
        success: false,
        error: 'Nessuna immagine fornita nella richiesta.'
      });
    }

    const apiKey = (process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || '').trim();
    if (!apiKey) {
      return sendJson(res, 400, {
        success: false,
        error: 'GEMINI_API_KEY non configurata. Inserisci la tua API Key nel file .env o nelle impostazioni dell\'app.'
      });
    }

    let cleanBase64 = imageBase64;
    let detectedMime = mimeType || 'image/jpeg';
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      detectedMime = parts[0].replace('data:', '') || detectedMime;
      cleanBase64 = parts[1];
    }

    // Calcolo dinamico dell'anno corrente di sistema
    const currentYear = new Date().getFullYear();

    const systemPrompt = "Sei un revisore contabile esperto. Estrai le transazioni da questo screenshot bancario. " +
      "Ignora i saldi, l'orario e la batteria. Restituisci SOLO un array JSON puro, senza markdown. " +
      `REGOLA TASSATIVA SULL'ANNO: L'anno di riferimento corrente del sistema è obbligatoriamente il ${currentYear}. ` +
      `Se lo screenshot bancario mostra solo giorno e mese (es. "12 Ago", "31/08", "04/09"), DEVI utilizzare tassativamente il ${currentYear} come anno per comporre la data GG/MM/AAAA (es. 12/08/${currentYear}, 31/08/${currentYear}). ` +
      `NON inventare né impostare anni passati (come il 2024), a meno che l'anno non sia esplicitamente scritto con 4 cifre nello screenshot. ` +
      "Chiavi richieste: 'data' (formato GG/MM/AAAA con anno a 4 cifre), 'causale' (testo pulito), 'importo' (numero con segno), 'banca' (identifica istituto dal brand, es. 'BancoPosta', 'BBVA', 'Trade Republic', 'Revolut', 'Buoni pasto'. Se la banca non è esplicitamente indicata nel testo, individuala dalla grafica, dai colori e dal layout dello screenshot), 'interpretazione' (analizza la causale bancaria e scrivi in testo libero, conciso ed esplicativo, a cosa si riferisce l'operazione).";

    const promptPayload = {
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: detectedMime,
                data: cleanBase64
              }
            },
            {
              text: `Estrai tutte le transazioni contabili presenti in questo screenshot. ANNO DI RIFERIMENTO OBBLIGATORIO: ${currentYear}. Se le date mostrano solo giorno e mese, usa tassativamente il ${currentYear} come anno. Restituisci esclusivamente un array JSON contenente tutti i movimenti con le chiavi: data (formato GG/MM/${currentYear}), causale, importo (float con segno), banca, interpretazione.`
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              data: {
                type: "STRING",
                description: `Data della transazione nel formato GG/MM/AAAA. Se lo screenshot mostra solo giorno e mese, imposta obbligatoriamente l'anno corrente ${currentYear}.`
              },
              causale: {
                type: "STRING",
                description: "Causale originale o descrizione dell'operazione"
              },
              importo: {
                type: "NUMBER",
                description: "Importo float con segno algebrico (- per uscite/addebiti, + per entrate/accrediti)"
              },
              banca: {
                type: "STRING",
                description: "Brand dell'istituto bancario rilevato dal testo o dalla grafica (es. BancoPosta, BBVA, Trade Republic, Revolut, Buoni pasto)"
              },
              interpretazione: {
                type: "STRING",
                description: "Spiegazione concisa ed esplicativa dell'operazione contabile"
              }
            },
            required: ["data", "causale", "importo", "banca", "interpretazione"]
          }
        },
        temperature: 0.1
      },
      systemInstruction: {
        parts: [
          { text: systemPrompt }
        ]
      }
    };

    // Sanificazione rigorosa del modello: rimozione categorica di qualsiasi versione 2.5
    let envModel = (process.env.GEMINI_MODEL || '').trim();
    if (!envModel || envModel.includes('2.5')) {
      envModel = 'gemini-3.6-flash';
    }

    const candidateModels = [
      envModel,
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash'
    ].filter((v, i, a) => a.indexOf(v) === i && !v.includes('2.5'));

    let lastError = null;
    let successfulResult = null;

    console.log(`[EXTRACT] Avvio estrazione con modelli candidati: ${candidateModels.join(', ')}`);

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 28000);

        const response = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(promptPayload),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          let errJson;
          try { errJson = JSON.parse(errText); } catch (_) {}
          const errMsg = errJson?.error?.message || `Errore da Gemini API ${model} (HTTP ${response.status})`;
          lastError = { status: response.status, message: errMsg };
          console.warn(`[GEMINI WARN] Modello ${model} ha restituito ${response.status}: ${errMsg}`);
          continue;
        }

        const result = await response.json();
        const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (rawText) {
          successfulResult = { rawText, usedModel: model };
          console.log(`[EXTRACT OK] Risposta ricevuta con successo dal modello ${model}`);
          break;
        }
      } catch (callErr) {
        lastError = { status: 500, message: callErr.message };
        console.warn(`[GEMINI ERROR] Chiamata a ${model} fallita: ${callErr.message}`);
      }
    }

    if (!successfulResult) {
      return sendJson(res, lastError?.status || 500, {
        success: false,
        error: lastError?.message || 'Tutti i modelli Gemini sono temporaneamente occupati. Riprova tra pochi secondi.'
      });
    }

    let cleanedText = successfulResult.rawText.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let rawParsed;
    try {
      rawParsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      const arrayMatch = cleanedText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        try { rawParsed = JSON.parse(arrayMatch[0]); } catch (_) {}
      }
      if (!rawParsed) {
        console.error('[EXTRACT ERR] Parsing JSON fallito:', cleanedText);
        return sendJson(res, 500, {
          success: false,
          error: 'La risposta di Gemini non contiene un JSON valido.',
          raw: cleanedText
        });
      }
    }

    let rawList = [];
    if (Array.isArray(rawParsed)) {
      rawList = rawParsed;
    } else if (rawParsed && typeof rawParsed === 'object') {
      if (Array.isArray(rawParsed.transazioni)) rawList = rawParsed.transazioni;
      else if (Array.isArray(rawParsed.movimenti)) rawList = rawParsed.movimenti;
      else if (Array.isArray(rawParsed.transactions)) rawList = rawParsed.transactions;
      else if (Array.isArray(rawParsed.data)) rawList = rawParsed.data;
      else if (rawParsed.data || rawParsed.causale || rawParsed.importo !== undefined) {
        rawList = [rawParsed];
      }
    }

    if (rawList.length === 0) {
      const now = new Date();
      const d = String(now.getDate()).padStart(2, '0');
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const y = now.getFullYear();
      rawList = [{
        data: `${d}/${m}/${y}`,
        banca: 'Altro',
        causale: 'Movimento non identificato automaticamente',
        importo: 0.0,
        interpretazione: 'Inserire dettagli manualmente'
      }];
    }

    const processedTransactions = rawList.map((tx, idx) => {
      let dataStr = String(tx.data || '').trim();

      // OVERRIDE RIGIDO PROGRAMMATICO DELL'ANNO:
      // Estrae giorno e mese tranciando via qualunque anno allucinato dall'IA,
      // e forza SEMPRE e tassativamente l'anno corrente (currentYear).
      let day, month;
      const isoMatch = dataStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (isoMatch) {
        day = isoMatch[3].padStart(2, '0');
        month = isoMatch[2].padStart(2, '0');
      } else {
        const dmyMatch = dataStr.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
        if (dmyMatch) {
          day = dmyMatch[1].padStart(2, '0');
          month = dmyMatch[2].padStart(2, '0');
        }
      }

      if (day && month && parseInt(month, 10) >= 1 && parseInt(month, 10) <= 12 && parseInt(day, 10) >= 1 && parseInt(day, 10) <= 31) {
        dataStr = `${day}/${month}/${currentYear}`;
      } else {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        dataStr = `${d}/${m}/${currentYear}`;
      }

      let importoVal = parseFloat(tx.importo);
      if (isNaN(importoVal)) importoVal = 0.0;

      let bancaVal = String(tx.banca || 'Altro').trim();
      if (!bancaVal) bancaVal = 'Altro';

      let causaleVal = String(tx.causale || 'Movimento contabile').trim();
      let interpretazioneVal = String(tx.interpretazione || '').trim();

      const sanitizedTx = {
        id: `tx_${Date.now()}_${idx}`,
        enabled: true,
        data: dataStr,
        banca: bancaVal,
        causale: causaleVal,
        importo: importoVal,
        interpretazione: interpretazioneVal
      };

      sanitizedTx.idSintetico = calcolaIdSintetico(sanitizedTx);
      return sanitizedTx;
    });

    console.log(`[EXTRACT DONE] Restituisco ${processedTransactions.length} transazioni con anno forzato ${currentYear}`);

    return sendJson(res, 200, {
      success: true,
      count: processedTransactions.length,
      model: successfulResult.usedModel,
      data: processedTransactions
    });

  } catch (error) {
    console.error('Errore durante handleExtract:', error);
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Errore interno durante l\'elaborazione dell\'immagine.'
    });
  }
}

// Handler per il salvataggio batch su Open_Banking Webhook con LOG DIAGNOSTICI COMPLETI
async function handleSave(req, res) {
  try {
    const body = await parseJsonBody(req);
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
        error: 'WEBHOOK_URL non configurato. Inserisci l\'URL del tuo Google Apps Script nel file .env o nelle impostazioni.'
      });
    }

    const payloadToSend = { movimenti };
    const payloadString = JSON.stringify(payloadToSend);

    console.log('============================================================');
    console.log('📤 [SAVE] Invio chiamata HTTP POST verso Google Apps Script');
    console.log('   URL Target:     ', webhookUrl);
    console.log('   Num Movimenti:  ', movimenti.length);
    console.log('   Payload Inviato:', payloadString);
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

    console.log('============================================================');
    console.log('📥 [SAVE] Risposta ricevuta da Google Apps Script:');
    console.log('   HTTP Status Code:', webhookRes.status, webhookRes.statusText);
    console.log('   Final URL (Redirect):', webhookRes.url);
    console.log('   Response Body:', responseText);
    console.log('============================================================');

    let responseJson = null;
    try {
      responseJson = JSON.parse(responseText);
    } catch (_) {}

    if (!responseJson) {
      let diagnosi = 'Google Apps Script ha restituito HTML anziché JSON.';
      if (responseText.includes('sandboxFrame') || responseText.includes('userHtml')) {
        diagnosi = 'ATTENZIONE: Google Apps Script ha eseguito un doPost non allineato (es. Telegram bot o vecchio script che restituisce HTML). Aggiorna Apps Script incollando il contenuto di Open_Banking.gs!';
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
        error: 'Timeout (35s) nella chiamata verso il Webhook di Google Sheets. Verifica la connessione o l\'URL dello script.'
      });
    }
    return sendJson(res, 500, {
      success: false,
      error: `Errore di connessione con il Webhook: ${error.message}`
    });
  }
}

// Endpoint diagnostico /api/status aggiornato
function handleStatus(req, res) {
  let envModel = (process.env.GEMINI_MODEL || '').trim();
  if (!envModel || envModel.includes('2.5')) {
    envModel = 'gemini-3.6-flash';
  }

  sendJson(res, 200, {
    success: true,
    version: '2.9.3-flash-3.6-dynamic-year',
    platform: process.env.VERCEL ? 'Vercel Serverless' : 'Node.js Local Server',
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5),
    webhookConfigured: Boolean(process.env.WEBHOOK_URL && process.env.WEBHOOK_URL.trim().startsWith('http')),
    model: envModel,
    port: PORT,
    serverTime: new Date().toISOString()
  });
}

// Salvataggio runtime della configurazione
async function handleConfig(req, res) {
  try {
    const body = await parseJsonBody(req);
    const { geminiApiKey, webhookUrl, geminiModel } = body;

    const envPath = path.join(__dirname, '.env');
    if (geminiApiKey !== undefined) process.env.GEMINI_API_KEY = geminiApiKey.trim();
    if (webhookUrl !== undefined) process.env.WEBHOOK_URL = webhookUrl.trim();
    if (geminiModel !== undefined) {
      let m = geminiModel.trim();
      if (m.includes('2.5')) m = 'gemini-3.6-flash';
      process.env.GEMINI_MODEL = m;
    }

    const newContent = [
      '# ClaiserBank Environment Variables',
      `GEMINI_API_KEY=${process.env.GEMINI_API_KEY || ''}`,
      `WEBHOOK_URL=${process.env.WEBHOOK_URL || ''}`,
      `GEMINI_MODEL=${process.env.GEMINI_MODEL || 'gemini-3.6-flash'}`,
      `PORT=${PORT}`,
      ''
    ].join('\n');

    fs.writeFileSync(envPath, newContent, 'utf8');

    return sendJson(res, 200, {
      success: true,
      message: 'Configurazione salvata con successo nel file .env!',
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5),
      webhookConfigured: Boolean(process.env.WEBHOOK_URL && process.env.WEBHOOK_URL.trim().startsWith('http'))
    });
  } catch (error) {
    return sendJson(res, 500, {
      success: false,
      error: `Impossibile aggiornare .env: ${error.message}`
    });
  }
}

// Servizio file statici PWA con cache busting
function serveStaticFile(req, res, pathname) {
  let safePath = path.normalize(pathname).replace(/^[\/\\]+/, '');
  if (!safePath || safePath === '.') safePath = 'index.html';

  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    if (typeof res.status === 'function') return res.status(403).send('Accesso non autorizzato');
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Accesso non autorizzato');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (indexErr, data) => {
        if (indexErr) {
          if (typeof res.status === 'function') return res.status(404).send('File non trovato');
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('File non trovato');
        } else {
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.end(data);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImage = ext === '.svg' || ext === '.png' || ext === '.ico';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': isImage ? 'public, max-age=86400' : 'no-cache, no-store, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

// Router principale compatibile sia con Vercel Serverless Function che con Node.js Standalone
export default async function handler(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    if (!res.headersSent) {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Gemini-Key, X-Webhook-Url'
      });
    }
    res.end();
    return;
  }

  if (pathname === '/api/extract' && req.method === 'POST') return handleExtract(req, res);
  if (pathname === '/api/save' && req.method === 'POST') return handleSave(req, res);
  if (pathname === '/api/status' && req.method === 'GET') return handleStatus(req, res);
  if (pathname === '/api/config' && req.method === 'POST') return handleConfig(req, res);

  if (req.method === 'GET' || req.method === 'HEAD') return serveStaticFile(req, res, pathname);

  if (!res.headersSent) {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  res.end('Metodo HTTP non supportato');
}

// Server HTTP per l'esecuzione in locale (start.bat / node server.js)
const server = http.createServer(handler);

if (!process.env.VERCEL) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('============================================================');
    console.log('🏦 CLAISERBANK PWA - OPEN BANKING AI DATA ENTRY');
    console.log('============================================================');
    console.log(`🚀 Server attivo su: http://localhost:${PORT}`);
    console.log(`📱 Accessibile da mobile tramite l'IP locale sulla porta ${PORT}`);
    console.log(`🔑 Stato Gemini API Key: ${process.env.GEMINI_API_KEY ? '✅ Configurato' : '⚠️ Non configurato'}`);
    console.log(`📊 Stato Webhook URL:    ${process.env.WEBHOOK_URL ? '✅ Configurato' : '⚠️ Non configurato'}`);
    console.log(`📋 Target Foglio Sheets: BANK_LOG (Colonne B:H)`);
    console.log('============================================================\n');
  });
}
