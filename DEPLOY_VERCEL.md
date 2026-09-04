# Guida al Deploy di Claiser.Lab Bank su Vercel 🚀

L'applicazione **Claiser.Lab Bank PWA** è ora configurata nativamente per essere distribuita su **Vercel** con architettura Serverless.

---

## 🏗️ Architettura Vercel Implementata

1. **Frontend Statico PWA (Zero-Config)**:
   - I file in `public/` (`index.html`, `app.js`, `style.css`, `manifest.json`, `sw.js`, `icons/`) vengono serviti automaticamente da Vercel Edge CDN alla radice (`/`).
2. **Serverless Functions (`/api` directory)**:
   - `api/extract.js`: Gestisce l'analisi dello screenshot con **Gemini AI** (fino a 10MB di payload e 60s di timeout).
   - `api/save.js`: Gestisce l'invio batch verso il **Webhook Google Apps Script** per il foglio `BANK_LOG`.
   - `api/status.js`: Verifica lo stato delle chiavi e delle configurazioni.
3. **`vercel.json`**:
   - Header CORS, Service Worker Allowed e no-cache configurati a livello di edge.

---

## 📋 Istruzioni per la Pubblicazione (3 Minuti)

### Metodo 1: Tramite GitHub e Vercel Dashboard (Consigliato)

1. **Carica il progetto su un repository GitHub** (pubblico o privato).
2. Vai su **[vercel.com](https://vercel.com)** ed esegui il login.
3. Clicca su **"Add New..." > "Project"** e importa il repository di ClaiserBank.
4. Nella sezione **Environment Variables**, aggiungi le seguenti variabili:
   - **`GEMINI_API_KEY`**: La tua chiave Google Gemini API (`AIzaSy...`).
   - **`WEBHOOK_URL`**: L'URL di distribuzione del tuo Google Apps Script (`https://script.google.com/macros/s/.../exec`).
   - **`GEMINI_MODEL`**: `gemini-3.7-flash` (opzionale, predefinito).
5. Clicca su **"Deploy"**.
6. In meno di 30 secondi riceverai il tuo dominio HTTPS ufficiale (es. `https://claiser-bank.vercel.app`).

---

### Metodo 2: Tramite Vercel CLI

Se hai installato la CLI di Vercel (`npm i -g vercel`):
1. Apri il terminale nella cartella del progetto:
   ```bash
   cd "C:\Users\ISERNIAC\OneDrive - Poste Italiane S.p.A\Desktop\Agente Claiser Bank"
   ```
2. Esegui:
   ```bash
   vercel
   ```
3. Segui le istruzioni a schermo. Per la produzione:
   ```bash
   vercel --prod
   ```
4. Configura le variabili d'ambiente nella dashboard del progetto su Vercel.

---

## 📱 Installazione come PWA su Smartphone

Una volta aperto l'URL Vercel su smartphone:
- **iOS (Safari)**: Tocca il pulsante Condividi e seleziona **"Aggiungi alla schermata Home"**.
- **Android (Chrome)**: Tocca i 3 puntini e seleziona **"Installa applicazione"** o **"Aggiungi a schermata Home"**.

L'app si avvierà a schermo intero come un'app nativa con il logo ufficiale Claiser.Lab!
