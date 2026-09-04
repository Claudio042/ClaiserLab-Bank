# 🏦 ClaiserBank - PWA per Data Entry Contabile Open Banking AI

Una **Progressive Web App (PWA)** mobile-first per l'automazione del data entry contabile tramite **Google Gemini AI (Flash)** e la sincronizzazione in batch sul foglio **`BANK_LOG`** di Google Sheets.

---

## 🏗️ Architettura del Progetto: Consolidamento su `server.js`

L'intera applicazione adotta un'**architettura unificata e monolitica** basata su **`server.js`**, che funge da unico router ed entry point sia per l'esecuzione in locale che per la distribuzione su **Vercel**:

1. **Backend & Serverless Entry Point (`server.js`)**:
   - `POST /api/extract`: Estrazione multimodale AI con Google Gemini (modello primario: `gemini-3.6-flash`), filtro anti-deprecati, calcolo dinamico dell'anno (`currentYear`) e override rigido sulle date estratte.
   - `POST /api/save`: Validazione e invio in blocco dei movimenti verso il Webhook Google Apps Script (`Open_Banking_App.gs`).
   - `GET /api/status`: Endpoint diagnostico che certifica le API configurate e la versione attiva (`2.9.3-flash-3.6-dynamic-year`).
   - `POST /api/config`: Gestione e salvataggio delle impostazioni nel file `.env`.
   - `GET /*`: Servizio ad alte prestazioni dei file statici della PWA (HTML, CSS, JS, manifest, icone) con header no-cache immediati.

2. **Frontend PWA Mobile-First (`public/`)**:
   - Interfaccia reattiva dark-mode fintech ottimizzata per smartphone (iOS e Android).
   - Acquisizione rapida tramite fotocamera, caricamento screenshot multipli e revisione interattiva multi-scheda.

3. **Infrastruttura Vercel (`vercel.json`)**:
   - Instradamento automatico di tutte le chiamate verso `server.js`.
   - Header CORS, Service Worker Allowed e policy di caching calibrate.

---

## 📱 Caratteristiche Principali

- 📸 **Acquisizione Mobile-First**: Scatta una foto direttamente con la fotocamera dello smartphone o carica screenshot bancari multipli.
- 🧠 **Estrazione Multi-Transazione con Gemini 3.6 Flash**: Analisi intelligente dello screenshot bancario per estrarre tutti i movimenti:
  - **Data** (formato `GG/MM/AAAA`, con anno di sistema forzato e garantito)
  - **Banca / Conto** (identificazione brand: *BancoPosta*, *BBVA*, *Trade Republic*, *Revolut*, *Buoni pasto*, ecc.)
  - **Causale Originale** (testo pulito)
  - **Importo** con segno algebrico (`-` per uscite/spese, `+` per entrate/accrediti)
  - **Interpretazione AI** (spiegazione esplicativa e concisa dell'operazione)
  - **ID Sintetico Tassativo**: `data_banca_causaleNormalizzata_importo`
- ✏️ **Revisione Interattiva Multi-Scheda**: Abilita/disabilita singoli record con checkbox, modifica rapida di importi (+/-), banche e causali con ricalcolo in tempo reale del tag ID.
- 💾 **Integrazione Google Sheets (`BANK_LOG`)**: Scrittura in blocco sulle 7 colonne da B a H (`Data`, `Conto`, `Causale originale`, `Importo`, `ID Sintetico`, `Spunta`, `Interpretazione`) con deduplicazione automatica su Colonna F.
- 🔒 **Secret Management Sicuro**: Chiave API di Gemini e Webhook URL protetti nel file `.env` in locale o nelle Environment Variables di Vercel.

---

## 🚀 Avvio Rapido in Locale

### 1. Avvia l'applicazione
Fai doppio clic sul file **`start.bat`** presente nella cartella del progetto.
Il server locale si avvierà su:
👉 **`http://localhost:3000`**

---

### 2. Configura le variabili d'ambiente (`.env`)
Apri il file **`.env`** (oppure usa l'icona ⚙️ nell'interfaccia dell'app):
```env
GEMINI_API_KEY=AIzaSy...
WEBHOOK_URL=https://script.google.com/macros/s/.../exec
GEMINI_MODEL=gemini-3.6-flash
PORT=3000
```

---

### 3. Integra lo script su Google Sheets (`Open_Banking_App.gs`)
1. Nel tuo foglio Google Sheets vai su **Estensioni > Apps Script**.
2. Crea un nuovo file chiamato **`Open_Banking_App.gs`** e incolla il codice del file locale `Open_Banking_App.gs`.
3. Nel tuo file principale contenente `doPost(e)` (es. per il bot Telegram), inserisci all'inizio della funzione:
   ```javascript
   function doPost(e) {
     if (e && e.postData && e.postData.contents) {
       try {
         var reqData = JSON.parse(e.postData.contents);
         if (reqData.movimenti || (Array.isArray(reqData) && reqData.length > 0 && reqData[0].causale !== undefined)) {
           return processaRichiestaClaiserBank(e);
         }
       } catch (parseErr) {}
     }
     // ... codice preesistente ...
   }
   ```
4. Clicca **Distribuisci > Gestisci distribuzioni > Modifica (✏️) > Nuova versione > Distribuisci**.

---

## 📂 Struttura del Progetto Ottimizzata

```text
Agente Claiser Bank/
├── .env                        # Variabili d'ambiente (GEMINI_API_KEY, WEBHOOK_URL, PORT)
├── .env.example                # Template variabili d'ambiente
├── .gitignore                  # File ignorati da Git
├── package.json                # Metadati Node.js (type: module, 0 dipendenze esterne)
├── server.js                   # UNICO backend, router HTTP e serverless function
├── start.bat                   # Avviatore rapido per Windows
├── vercel.json                 # Configurazione routing unico verso server.js
├── DEPLOY_VERCEL.md            # Istruzioni di deploy su Vercel
├── Open_Banking_App.gs         # Modulo isolato per Google Apps Script (BANK_LOG B:H)
├── README.md                   # Documentazione tecnica del progetto
└── public/                     # Frontend PWA Mobile-First
    ├── index.html              # Markup con interfaccia di revisione multi-scheda
    ├── style.css               # Design fintech scuro con responsive layout
    ├── app.js                  # Controller per estrazione e salvataggio batch
    ├── manifest.json           # Manifest PWA (Standalone)
    ├── sw.js                   # Service Worker (Network-First & Cache-Busting)
    └── icons/                  # Icone PWA
```
