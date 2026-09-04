/**
 * VERCEL SERVERLESS FUNCTION: /api/status
 * Verifica lo stato di configurazione delle variabili d'ambiente su Vercel.
 */

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 5);
  const webhookConfigured = Boolean(process.env.WEBHOOK_URL && process.env.WEBHOOK_URL.trim().startsWith('http'));

  res.statusCode = 200;
  res.end(JSON.stringify({
    success: true,
    platform: 'Vercel Serverless',
    geminiConfigured,
    webhookConfigured,
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    serverTime: new Date().toISOString()
  }));
}
