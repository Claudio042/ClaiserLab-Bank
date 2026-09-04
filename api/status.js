/**
 * VERCEL SERVERLESS FUNCTION: /api/status
 * Verifica lo stato di configurazione delle variabili d'ambiente e la versione su Vercel.
 */

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  let envModel = (process.env.GEMINI_MODEL || '').trim();
  if (!envModel || envModel.includes('2.5')) {
    envModel = 'gemini-3.6-flash';
  }

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5);
  const webhookConfigured = Boolean(process.env.WEBHOOK_URL && process.env.WEBHOOK_URL.trim().startsWith('http'));

  res.statusCode = 200;
  res.end(JSON.stringify({
    success: true,
    version: '2.9.3-flash-3.6-dynamic-year',
    platform: 'Vercel Serverless',
    geminiConfigured,
    webhookConfigured,
    model: envModel,
    serverTime: new Date().toISOString()
  }));
}
