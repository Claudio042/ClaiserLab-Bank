/**
 * CLAISER.LAB BANK - FRONTEND APPLICATION CONTROLLER (PWA v2.8.0)
 * Gestione estrazione multipla Gemini AI, Banca Predefinita e Switch Dark/Light Mode.
 */

const KNOWN_BANKS = ['BancoPosta', 'BBVA', 'Trade Republic', 'Revolut', 'Intesa Sanpaolo', 'UniCredit', 'Fineco', 'Buoni pasto', 'Altro'];

const state = {
  currentStep: 'acquire',
  selectedImageBase64: null,
  selectedMimeType: 'image/jpeg',
  defaultBank: localStorage.getItem('claiser_default_bank') || 'auto',
  theme: localStorage.getItem('claiser_theme') || 'dark',
  masterBank: 'BancoPosta',
  transactions: [],
  resetTimerInterval: null,
  resetTimeRemaining: 3
};

const elements = {
  sectionAcquire: document.getElementById('section-acquire'),
  sectionPreview: document.getElementById('section-preview'),
  sectionProcessing: document.getElementById('section-processing'),
  sectionValidate: document.getElementById('section-validate'),
  sectionFeedback: document.getElementById('section-feedback'),

  dropzone: document.getElementById('dropzone'),
  inputCamera: document.getElementById('input-camera'),
  inputFile: document.getElementById('input-file'),
  btnCamera: document.getElementById('btn-camera'),
  btnGallery: document.getElementById('btn-gallery'),

  imagePreview: document.getElementById('image-preview'),
  previewInfo: document.getElementById('preview-info'),
  btnCancelPreview: document.getElementById('btn-cancel-preview'),
  btnStartExtract: document.getElementById('btn-start-extract'),

  masterBankSelect: document.getElementById('master-bank-select'),
  selectedCountBadge: document.getElementById('selected-count-badge'),
  totalAmountSum: document.getElementById('total-amount-sum'),
  btnSelectAll: document.getElementById('btn-select-all'),
  btnDeselectAll: document.getElementById('btn-deselect-all'),
  btnAddManualTx: document.getElementById('btn-add-manual-tx'),
  transactionsContainer: document.getElementById('transactions-container'),
  btnSaveBatch: document.getElementById('btn-save-batch'),
  btnSaveBatchText: document.getElementById('btn-save-batch-text'),
  btnDiscardAll: document.getElementById('btn-discard-all'),

  statInserted: document.getElementById('stat-inserted'),
  statSkipped: document.getElementById('stat-skipped'),
  statTotal: document.getElementById('stat-total'),
  feedbackSubtitle: document.getElementById('feedback-subtitle'),
  resetCounter: document.getElementById('reset-counter'),
  resetBarFill: document.getElementById('reset-bar-fill'),
  btnImmediateReset: document.getElementById('btn-immediate-reset'),

  errorModal: document.getElementById('error-modal'),
  errModalTitle: document.getElementById('err-modal-title'),
  errModalMessage: document.getElementById('err-modal-message'),
  errModalRaw: document.getElementById('err-modal-raw'),
  btnCloseErrorModal: document.getElementById('btn-close-error-modal'),
  btnErrorModalOk: document.getElementById('btn-error-modal-ok'),

  btnOpenSettings: document.getElementById('btn-open-settings'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  settingsModal: document.getElementById('settings-modal'),
  cfgDefaultBank: document.getElementById('cfg-default-bank'),
  btnThemeDark: document.getElementById('btn-theme-dark'),
  btnThemeLight: document.getElementById('btn-theme-light'),
  btnSaveSettings: document.getElementById('btn-save-settings'),

  toastContainer: document.getElementById('toast-container')
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('🏦 Claiser.Lab Bank App v2.8.0 Inizializzata');
  initTheme();
  initDefaultBank();
  initEventListeners();
  registerServiceWorker();
});

function initTheme() {
  applyTheme(state.theme);
}

function applyTheme(themeName) {
  state.theme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('claiser_theme', themeName);

  if (elements.btnThemeDark && elements.btnThemeLight) {
    if (themeName === 'dark') {
      elements.btnThemeDark.classList.add('active');
      elements.btnThemeLight.classList.remove('active');
    } else {
      elements.btnThemeLight.classList.add('active');
      elements.btnThemeDark.classList.remove('active');
    }
  }
}

function initDefaultBank() {
  if (state.defaultBank && state.defaultBank !== 'auto') {
    state.masterBank = state.defaultBank;
    if (elements.masterBankSelect) {
      elements.masterBankSelect.value = state.defaultBank;
    }
  }
  if (elements.cfgDefaultBank) {
    elements.cfgDefaultBank.value = state.defaultBank;
  }
}

function initEventListeners() {
  elements.btnCamera.addEventListener('click', () => elements.inputCamera.click());
  elements.btnGallery.addEventListener('click', () => elements.inputFile.click());

  elements.inputCamera.addEventListener('change', handleFileInput);
  elements.inputFile.addEventListener('change', handleFileInput);

  elements.dropzone.addEventListener('click', () => elements.inputFile.click());
  elements.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropzone.classList.add('drag-over');
  });
  elements.dropzone.addEventListener('dragleave', () => elements.dropzone.classList.remove('drag-over'));
  elements.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropzone.classList.remove('dropzone.drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  elements.btnCancelPreview.addEventListener('click', () => switchStep('acquire'));
  elements.btnStartExtract.addEventListener('click', performAiExtraction);

  // Master Bank Change Handler
  if (elements.masterBankSelect) {
    elements.masterBankSelect.addEventListener('change', handleMasterBankChange);
  }

  elements.btnSelectAll.addEventListener('click', () => setAllTransactionsSelection(true));
  elements.btnDeselectAll.addEventListener('click', () => setAllTransactionsSelection(false));
  if (elements.btnAddManualTx) {
    elements.btnAddManualTx.addEventListener('click', addManualTransaction);
  }

  elements.btnSaveBatch.addEventListener('click', saveBatchToOpenBanking);
  elements.btnDiscardAll.addEventListener('click', () => {
    resetState();
    switchStep('acquire');
  });

  elements.btnImmediateReset.addEventListener('click', () => {
    clearInterval(state.resetTimerInterval);
    resetState();
    switchStep('acquire');
  });

  elements.btnCloseErrorModal.addEventListener('click', closeErrorModal);
  elements.btnErrorModalOk.addEventListener('click', closeErrorModal);
  elements.errorModal.addEventListener('click', (e) => {
    if (e.target === elements.errorModal) closeErrorModal();
  });

  // Settings & Preferences
  elements.btnOpenSettings.addEventListener('click', openSettingsModal);
  elements.btnCloseSettings.addEventListener('click', closeSettingsModal);
  elements.btnSaveSettings.addEventListener('click', savePreferences);
  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) closeSettingsModal();
  });

  if (elements.btnThemeDark) {
    elements.btnThemeDark.addEventListener('click', () => applyTheme('dark'));
  }
  if (elements.btnThemeLight) {
    elements.btnThemeLight.addEventListener('click', () => applyTheme('light'));
  }
}

function handleMasterBankChange(e) {
  const newBank = e.target.value;
  state.masterBank = newBank;
  
  state.transactions.forEach((tx, idx) => {
    tx.banca = newBank;
    tx.idSintetico = calcolaIdSinteticoTx(tx);
    const tag = document.getElementById(`id-tag-${idx}`);
    if (tag) tag.textContent = `ID: ${tx.idSintetico}`;
  });

  showToast(`Banca impostata su "${newBank}" per tutti i movimenti`, 'info');
}

function switchStep(stepName) {
  state.currentStep = stepName;
  const sections = [
    elements.sectionAcquire,
    elements.sectionPreview,
    elements.sectionProcessing,
    elements.sectionValidate,
    elements.sectionFeedback
  ];

  sections.forEach(sec => sec.classList.remove('active'));

  switch (stepName) {
    case 'acquire': elements.sectionAcquire.classList.add('active'); break;
    case 'preview': elements.sectionPreview.classList.add('active'); break;
    case 'processing': elements.sectionProcessing.classList.add('active'); break;
    case 'validate': elements.sectionValidate.classList.add('active'); break;
    case 'feedback': elements.sectionFeedback.classList.add('active'); break;
  }
}

function handleFileInput(e) {
  const file = e.target.files && e.target.files[0];
  if (file) processFile(file);
  e.target.value = '';
}

function processFile(file) {
  if (!file.type.startsWith('image/')) {
    showToast('Carica un file immagine valido (JPEG, PNG o WEBP)', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const originalDataUrl = event.target.result;
    compressImage(originalDataUrl, 1600, 0.85, (compressedDataUrl, mimeType, sizeKb) => {
      state.selectedImageBase64 = compressedDataUrl;
      state.selectedMimeType = mimeType;
      
      elements.imagePreview.src = compressedDataUrl;
      elements.previewInfo.textContent = `${mimeType.replace('image/', '').toUpperCase()} • ${sizeKb} KB`;
      
      switchStep('preview');
    });
  };
  reader.readAsDataURL(file);
}

function compressImage(dataUrl, maxDimension, quality, callback) {
  const img = new Image();
  img.onload = () => {
    let width = img.width;
    let height = img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const mimeType = 'image/jpeg';
    const compressedDataUrl = canvas.toDataURL(mimeType, quality);
    const sizeKb = Math.round((compressedDataUrl.length * 3 / 4) / 1024);

    callback(compressedDataUrl, mimeType, sizeKb);
  };
  img.src = dataUrl;
}

function calcolaIdSinteticoTx(tx) {
  const causaleStr = String(tx.causale || '');
  const causaleNormalizzata = causaleStr.toLowerCase().replace(/[^a-z0-9]/g, '');
  const dataStr = String(tx.data || '');
  const bancaStr = String(tx.banca || state.masterBank || 'Altro');
  const importoStr = String(tx.importo !== undefined ? tx.importo : '0');
  return `${dataStr}_${bancaStr}_${causaleNormalizzata}_${importoStr}`;
}

async function performAiExtraction() {
  if (!state.selectedImageBase64) {
    showToast('Nessuna immagine selezionata', 'error');
    return;
  }

  switchStep('processing');

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: state.selectedImageBase64,
        mimeType: state.selectedMimeType
      })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Impossibile estrarre i dati contabili dallo screenshot.');
    }

    let txArray = [];
    if (Array.isArray(result.data)) {
      txArray = result.data;
    } else if (result.data && typeof result.data === 'object') {
      txArray = [result.data];
    }

    // Gestione assegnazione banca: se c'è una preferenza preimpostata, usala; altrimenti usa quella dedotta da Gemini
    if (state.defaultBank && state.defaultBank !== 'auto') {
      state.masterBank = state.defaultBank;
    } else if (txArray.length > 0 && txArray[0].banca) {
      state.masterBank = txArray[0].banca;
    }

    if (elements.masterBankSelect) {
      let exists = false;
      for (let opt of elements.masterBankSelect.options) {
        if (opt.value === state.masterBank) { exists = true; break; }
      }
      if (!exists) {
        const newOpt = document.createElement('option');
        newOpt.value = state.masterBank;
        newOpt.textContent = state.masterBank;
        elements.masterBankSelect.appendChild(newOpt);
      }
      elements.masterBankSelect.value = state.masterBank;
    }

    state.transactions = txArray.map(tx => ({
      ...tx,
      banca: state.masterBank,
      enabled: true,
      idSintetico: calcolaIdSinteticoTx({ ...tx, banca: state.masterBank })
    }));

    renderCompactTransactionsList();
    switchStep('validate');

    if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
    showToast(`Estratti ${state.transactions.length} movimenti con Gemini AI!`, 'success');

  } catch (err) {
    console.error('Errore estrazione:', err);
    switchStep('preview');
    showToast(err.message, 'error');
  }
}

function addManualTransaction() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();

  const newTx = {
    id: `tx_manual_${Date.now()}`,
    enabled: true,
    data: `${d}/${m}/${y}`,
    banca: state.masterBank,
    causale: 'Nuovo movimento contabile',
    importo: -10.0,
    interpretazione: 'Inserimento manuale'
  };

  newTx.idSintetico = calcolaIdSinteticoTx(newTx);
  state.transactions.unshift(newTx);
  renderCompactTransactionsList();
  showToast('Nuova riga aggiunta in cima', 'info');
}

function deleteTransactionRow(index) {
  state.transactions.splice(index, 1);
  renderCompactTransactionsList();
  showToast('Riga rimossa dalla lista', 'info');
}

// Rendering orizzontale compatto a riga singola (Spreadsheet Style)
function renderCompactTransactionsList() {
  elements.transactionsContainer.innerHTML = '';

  if (state.transactions.length === 0) {
    elements.transactionsContainer.innerHTML = '<div class="no-tx-msg">Nessun movimento presente. Clicca su "+ Riga" per aggiungerne uno manualmente.</div>';
    updateSelectionSummary();
    return;
  }

  state.transactions.forEach((tx, index) => {
    const row = document.createElement('div');
    row.className = `tx-row ${tx.enabled ? 'enabled' : 'disabled'}`;
    row.id = `tx-row-${tx.id}`;

    const isExpense = tx.importo < 0;
    const absAmount = Math.abs(tx.importo).toFixed(2);
    const idSintetico = calcolaIdSinteticoTx(tx);

    row.innerHTML = `
      <div class="tx-row-main">
        <!-- Col 1: Checkbox -->
        <div class="tx-col-check">
          <input type="checkbox" class="tx-checkbox" data-index="${index}" ${tx.enabled ? 'checked' : ''} title="Includi riga">
        </div>

        <!-- Col 2: Data compatto -->
        <div class="tx-col-date">
          <input type="text" class="tx-date-input" data-index="${index}" value="${tx.data}" placeholder="GG/MM/AAAA" title="Data (GG/MM/AAAA)">
        </div>

        <!-- Col 3: Importo con tasto +/- -->
        <div class="tx-col-amount">
          <button type="button" class="tx-sign-btn ${isExpense ? 'expense' : 'income'}" data-index="${index}" title="Inverti segno">
            ${isExpense ? '-' : '+'}
          </button>
          <input type="number" step="0.01" class="tx-amount-input" data-index="${index}" value="${absAmount}" placeholder="0.00">
        </div>

        <!-- Col 4: Causale & Interpretazione orizzontali compatte -->
        <div class="tx-col-text">
          <input type="text" class="tx-causale-input" data-index="${index}" value="${escapeHtml(tx.causale)}" placeholder="Causale originale (Colonna D)" title="Causale originale">
          <div class="tx-interpretazione-inline">
            <span class="ai-sparkle" title="Interpretazione AI">✦</span>
            <input type="text" class="tx-interpretazione-input" data-index="${index}" value="${escapeHtml(tx.interpretazione || '')}" placeholder="Interpretazione AI (Colonna H)" title="Interpretazione AI">
          </div>
        </div>

        <!-- Col 5: Rimuovi riga -->
        <div class="tx-col-delete">
          <button type="button" class="btn-delete-row" data-index="${index}" title="Elimina questo movimento">×</button>
        </div>
      </div>

      <!-- Riga di dettaglio: ID Sintetico compatto -->
      <div class="tx-row-sub">
        <span class="id-sintetico-mini" id="id-tag-${index}" title="ID Sintetico Colonna F">
          ID: ${idSintetico}
        </span>
      </div>
    `;

    elements.transactionsContainer.appendChild(row);
  });

  attachCompactRowEventListeners();
  updateSelectionSummary();
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attachCompactRowEventListeners() {
  document.querySelectorAll('.tx-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      state.transactions[idx].enabled = e.target.checked;
      const row = document.getElementById(`tx-row-${state.transactions[idx].id}`);
      if (row) {
        row.className = `tx-row ${e.target.checked ? 'enabled' : 'disabled'}`;
      }
      updateSelectionSummary();
    });
  });

  document.querySelectorAll('.tx-date-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      state.transactions[idx].data = e.target.value;
      refreshIdTag(idx);
    });
  });

  document.querySelectorAll('.tx-sign-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      state.transactions[idx].importo = -state.transactions[idx].importo;
      const isExpense = state.transactions[idx].importo < 0;
      btn.className = `tx-sign-btn ${isExpense ? 'expense' : 'income'}`;
      btn.textContent = isExpense ? '-' : '+';
      refreshIdTag(idx);
      updateSelectionSummary();
    });
  });

  document.querySelectorAll('.tx-amount-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      const raw = parseFloat(e.target.value) || 0.0;
      const isExpense = state.transactions[idx].importo < 0;
      state.transactions[idx].importo = isExpense ? -Math.abs(raw) : Math.abs(raw);
      refreshIdTag(idx);
      updateSelectionSummary();
    });
  });

  document.querySelectorAll('.tx-causale-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      state.transactions[idx].causale = e.target.value;
      refreshIdTag(idx);
    });
  });

  document.querySelectorAll('.tx-interpretazione-input').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      state.transactions[idx].interpretazione = e.target.value;
    });
  });

  document.querySelectorAll('.btn-delete-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index, 10);
      deleteTransactionRow(idx);
    });
  });
}

function refreshIdTag(idx) {
  const tx = state.transactions[idx];
  const tag = document.getElementById(`id-tag-${idx}`);
  if (tag && tx) {
    const idSintetico = calcolaIdSinteticoTx(tx);
    tx.idSintetico = idSintetico;
    tag.textContent = `ID: ${idSintetico}`;
  }
}

function setAllTransactionsSelection(enabled) {
  state.transactions.forEach((tx, idx) => {
    tx.enabled = enabled;
    const row = document.getElementById(`tx-row-${tx.id}`);
    if (row) row.className = `tx-row ${enabled ? 'enabled' : 'disabled'}`;
  });
  document.querySelectorAll('.tx-checkbox').forEach(cb => cb.checked = enabled);
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const enabledTxs = state.transactions.filter(t => t.enabled);
  const totalAmount = enabledTxs.reduce((sum, t) => sum + (t.importo || 0), 0);

  elements.selectedCountBadge.textContent = `${enabledTxs.length}/${state.transactions.length} Sel.`;
  elements.totalAmountSum.textContent = `Tot: ${totalAmount < 0 ? '-' : '+'} € ${Math.abs(totalAmount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  elements.totalAmountSum.style.color = totalAmount < 0 ? '#fb7185' : '#34d399';

  elements.btnSaveBatchText.textContent = `Registra ${enabledTxs.length} Moviment${enabledTxs.length === 1 ? 'o' : 'i'} su BANK_LOG`;
  elements.btnSaveBatch.disabled = enabledTxs.length === 0;
}

// Salvataggio batch su Google Sheets via Webhook
async function saveBatchToOpenBanking() {
  const enabledTxs = state.transactions.filter(t => t.enabled);

  if (enabledTxs.length === 0) {
    showToast('Seleziona almeno una riga da salvare', 'warning');
    return;
  }

  const currentBank = state.masterBank || 'Altro';

  const payloadMovements = enabledTxs.map(tx => ({
    data: String(tx.data).trim(),
    banca: String(tx.banca || currentBank).trim(),
    causale: String(tx.causale || '').trim(),
    importo: parseFloat(tx.importo) || 0.0,
    interpretazione: String(tx.interpretazione || '').trim()
  }));

  elements.btnSaveBatch.disabled = true;
  elements.btnSaveBatchText.textContent = 'Scrittura su foglio BANK_LOG in corso...';

  try {
    const response = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movimenti: payloadMovements })
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      const errMsg = result.error || 'Errore durante la registrazione su Google Sheets.';
      console.error('[CLIENT ERROR SAVE]', errMsg, result);
      showErrorModal('Salvataggio Fallito su Google Sheets', errMsg, result.raw || JSON.stringify(result, null, 2));
      throw new Error(errMsg);
    }

    if (result.inserted === 0 && result.skipped === 0 && enabledTxs.length > 0) {
      const warnMsg = 'Nessuna riga è stata inserita nel foglio BANK_LOG. Verifica la distribuzione dello script Open_Banking_App.gs.';
      showErrorModal('Nessun Movimento Registrato', warnMsg, JSON.stringify(result, null, 2));
      throw new Error(warnMsg);
    }

    elements.statInserted.textContent = result.inserted !== undefined ? result.inserted : enabledTxs.length;
    elements.statSkipped.textContent = result.skipped !== undefined ? result.skipped : 0;
    elements.statTotal.textContent = enabledTxs.length;
    elements.feedbackSubtitle.textContent = `${result.inserted} righe scritte con successo nelle colonne B:H di BANK_LOG`;

    if (navigator.vibrate) navigator.vibrate([60, 80, 100]);

    switchStep('feedback');
    startAutoResetTimer();

  } catch (err) {
    console.error('Errore salvataggio:', err);
    showToast(err.message, 'error');
  } finally {
    elements.btnSaveBatch.disabled = false;
    elements.btnSaveBatchText.textContent = 'Registra Movimenti Selezionati';
  }
}

function showErrorModal(title, message, rawDetails) {
  elements.errModalTitle.textContent = title;
  elements.errModalMessage.textContent = message;
  elements.errModalRaw.textContent = rawDetails || 'Nessun dettaglio aggiuntivo fornito dal server.';
  elements.errorModal.classList.add('open');
}

function closeErrorModal() {
  elements.errorModal.classList.remove('open');
}

function startAutoResetTimer() {
  state.resetTimeRemaining = 3;
  elements.resetCounter.textContent = '3';
  elements.resetBarFill.style.width = '100%';

  clearInterval(state.resetTimerInterval);

  const startTime = Date.now();
  const duration = 3000;

  state.resetTimerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, duration - elapsed);
    const progressPercent = (remaining / duration) * 100;
    
    elements.resetBarFill.style.width = `${progressPercent}%`;
    elements.resetCounter.textContent = Math.ceil(remaining / 1000);

    if (remaining <= 0) {
      clearInterval(state.resetTimerInterval);
      resetState();
      switchStep('acquire');
    }
  }, 50);
}

function resetState() {
  state.selectedImageBase64 = null;
  state.selectedMimeType = 'image/jpeg';
  state.transactions = [];
  elements.imagePreview.src = '';
  elements.transactionsContainer.innerHTML = '';
}

function openSettingsModal() {
  if (elements.cfgDefaultBank) {
    elements.cfgDefaultBank.value = state.defaultBank;
  }
  elements.settingsModal.classList.add('open');
}

function closeSettingsModal() {
  elements.settingsModal.classList.remove('open');
}

function savePreferences() {
  const chosenDefaultBank = elements.cfgDefaultBank.value;
  state.defaultBank = chosenDefaultBank;
  localStorage.setItem('claiser_default_bank', chosenDefaultBank);

  if (chosenDefaultBank !== 'auto') {
    state.masterBank = chosenDefaultBank;
    if (elements.masterBankSelect) {
      elements.masterBankSelect.value = chosenDefaultBank;
    }
  }

  showToast('Preferenze salvate con successo!', 'success');
  closeSettingsModal();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'error') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else if (type === 'success') {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  } else {
    iconSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `<div class="toast-icon">${iconSvg}</div><div class="toast-message">${message}</div>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.update();
      }
    });

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js?v=2.6.0')
        .then(reg => {
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Nuova versione PWA disponibile. Ricaricamento...');
                window.location.reload();
              }
            };
          };
        })
        .catch(err => console.log('Registrazione SW:', err));
    });
  }
}
