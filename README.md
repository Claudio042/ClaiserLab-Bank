# 🏦 ClaiserBank - PWA per Data Entry Contabile Open Banking AI

Una **Progressive Web App (PWA)** mobile-first per l'automazione del data entry contabile tramite **Google Gemini AI (Flash)** e la sincronizzazione in batch sul foglio **`BANK_LOG`** di Google Sheets.

---

## 📱 Caratteristiche Principali

- 📸 **Acquisizione Mobile-First**: Scatta una foto direttamente con la fotocamera dello smartphone, carica screenshot multipli dalla galleria o trascina file da computer desktop.
- 🧠 **Estrazione Multi-Transazione con Gemini Flash**: Analisi intelligente dello screenshot bancario per estrarre tutti i movimenti:
  - **Data** (formato `GG/MM/AAAA`)
  - **Banca / Conto** (identificazione brand: *BancoPosta*, *BBVA*, *Trade Republic*, *Revolut*, ecc.)
  - **Causale Originale** (testo pulito)
  - **Importo** con segno algebrico (`-` per uscite/spese, `+` per entrate/accrediti)
  - **Interpretazione AI** (spiegazione esplicativa e concisa dell'operazione)
  - **ID Sintetico Tassativo**: `data_banca_causaleNormalizzata_importo`
- ✏️ **Revisione Interattiva Multi-Scheda**: Abilita/disabilita singoli record con checkbox, modifica rapida di importi (+/-), banche e causali con ricalcolo in tempo reale del tag ID.
- 💾 **Integrazione Google Sheets (`BANK_LOG`)**: Scrittura in blocco sulle 7 colonne da B a H (`Data`, `Conto`, `Causale originale`, `Importo`, `ID Sintetico`, `Spunta`, `Interpretazione`) con deduplicazione automatica su Colonna F.
- 🤖 **Compatibilità Ecosistema Google Apps Script**: Architettura modulare con `Open_Banking_App.gs` e router integrabile nel `doPost(e)` per convivere con bot Telegram nello stesso progetto Apps Script.
- 🔒 **Secret Management Sicuro**: Chiave API di Gemini e Webhook URL sono protetti nel file `.env` locale.

---

## 🚀 Avvio Rapido

### 1. Avvia l'applicazione
Fai doppio clic sul file **`start.bat`** presente nella cartella del progetto.
Il server locale si avvierà su:
👉 **`http://localhost:3000`**

---

### 2. Configura le variabili d'ambiente (`.env`)
Apri il file **`.env`** (oppure usa l'icona ⚙️ nell'interfaccia):
```env
GEMINI_API_KEY=AIzaSy...
WEBHOOK_URL=https://script.google.com/macros/s/.../exec
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
     // ... codice originale Telegram ...
   }
   ```
4. Clicca **Distribuisci > Gestisci distribuzioni > Modifica (✏️) > Nuova versione > Distribuisci**.

---

## 📂 Struttura del Progetto

```text
Agente Claiser Bank/
├── .env                        # Variabili d'ambiente (GEMINI_API_KEY, WEBHOOK_URL, PORT)
├── .env.example                # Template variabili d'ambiente
├── .gitignore                  # File ignorati da Git
├── package.json                # Metadati Node.js
├── server.js                   # Backend proxy Node.js e validatore Webhook
├── start.bat                   # Avviatore rapido Windows
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
