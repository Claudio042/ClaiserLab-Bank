# Guida al Deploy di Claiser.Lab Bank su Vercel 🚀

L'applicazione **Claiser.Lab Bank PWA** è configurata con un'**architettura consolidata su `server.js`**, fungendo da unico entry point sia per Vercel che per l'ambiente locale.

---

## 🏗️ Architettura di Produzione

1. **Unico Entry Point Serverless (`server.js`)**:
   - Vercel esegue `server.js` come Serverless Function grazie alla regola di rewrite definita in `vercel.json`.
   - Gestisce internamente sia le API contabili (`/api/extract`, `/api/save`, `/api/status`, `/api/config`) sia l'erogazione dei file statici della PWA (`public/`).
2. **Nessun File Ridondante**:
   - Tutte le logiche sono centralizzate in `server.js`, eliminando il rischio di modifiche disallineate in cartelle secondarie.
3. **Modelli AI Supportati**:
   - Modello predefinito: **`gemini-3.6-flash`** (con fallback su `gemini-3.7-flash` e `gemini-3.5-flash`).
   - Blocco automatico contro versioni deprecate (es. `gemini-2.5-flash`).

---

## 📋 Istruzioni per la Pubblicazione

1. **Carica il progetto su GitHub**.
2. Su **[vercel.com](https://vercel.com)**:
   - Importa il repository.
   - Nella sezione **Environment Variables**, imposta:
     - **`GEMINI_API_KEY`**: La tua chiave Google Gemini API (`AIzaSy...`).
     - **`WEBHOOK_URL`**: L'URL Webhook di Google Apps Script (`https://script.google.com/macros/s/.../exec`).
     - **`GEMINI_MODEL`**: `gemini-3.6-flash` (opzionale).
3. Clicca su **Deploy**.

---

## 🔍 Verifica Immediata del Deploy

Una volta terminata la build su Vercel, verifica lo stato aprendo:
```text
https://<il-tuo-progetto>.vercel.app/api/status
```

Dovrai visualizzare la risposta JSON:
```json
{
  "success": true,
  "version": "2.9.3-flash-3.6-dynamic-year",
  "model": "gemini-3.6-flash"
}
```
