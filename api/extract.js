/**
 * VERCEL SERVERLESS FUNCTION: /api/extract
 * Estrazione multimodale AI delle transazioni da screenshot tramite Google Gemini Flash.
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  },
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

function calcolaIdSintetico(tx) {
  const causaleStr = String(tx.causale || '');
  const causaleNormalizzata = causaleStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  const dataStr = String(tx.data || '');
  const bancaStr = String(tx.banca || 'Altro');
  const importoStr = String(tx.importo !== undefined ? tx.importo : '0');
  return `${dataStr}_${bancaStr}_${causaleNormalizzata}_${importoStr}`;
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
        error: 'GEMINI_API_KEY non configurata. Imposta la variabile d\'ambiente su Vercel (Settings > Environment Variables) o nell\'header X-Gemini-Key.'
      });
    }

    let cleanBase64 = imageBase64;
    let detectedMime = mimeType || 'image/jpeg';
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      detectedMime = parts[0].replace('data:', '') || detectedMime;
      cleanBase64 = parts[1];
    }

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

    const candidateModels = [
      (process.env.GEMINI_MODEL || 'gemini-3.6-flash').trim(),
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash'
    ].filter((v, i, a) => a.indexOf(v) === i);

    let lastError = null;
    let successfulResult = null;

    console.log(`[VERCEL EXTRACT] Avvio estrazione con candidati: ${candidateModels.join(', ')}`);

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
          console.log(`[EXTRACT OK] Risposta ricevuta dal modello ${model}`);
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        const parts = dataStr.split('-');
        dataStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      } else if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dataStr)) {
        const now = new Date();
        const d = String(now.getDate()).padStart(2, '0');
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const y = now.getFullYear();
        dataStr = `${d}/${m}/${y}`;
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

    console.log(`[VERCEL EXTRACT DONE] Restituisco ${processedTransactions.length} transazioni.`);

    return sendJson(res, 200, {
      success: true,
      count: processedTransactions.length,
      model: successfulResult.usedModel,
      data: processedTransactions
    });

  } catch (error) {
    console.error('[VERCEL EXTRACT ERROR]:', error);
    return sendJson(res, 500, {
      success: false,
      error: error.message || 'Errore interno durante l\'elaborazione dell\'immagine.'
    });
  }
}
