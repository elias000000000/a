// =====================================================
// Budget-App – Vollständige App-Logik (inkl. Monats-Reset)
// =====================================================

// Schlüssel für LocalStorage
const STORAGE_KEY = "budgetApp";

// ---------- Standardzustand ----------
const defaultState = {
  userName: "",
  totalBudget: 0,
  spentAmount: 0,
  transactions: [],    // aktueller Monat
  categories: [],
  payday: null,        // 1..28
  archive: [],         // frühere Monate (durch Payday-Archivierung)
  currentTheme: "standard",
  seenInfo: false,
  seenCatInfo: false
};

// Globale State-Variable
let state = { ...defaultState };

// Zitate
const quotes = [
  "Spare in der Zeit, dann hast du in der Not.",
  "Kleine Ausgaben summieren sich schnell.",
  "Ein Budget gibt dir Freiheit, nicht Einschränkung.",
  "Heute sparen, morgen genießen.",
  "Dein Geld arbeitet für dich, wenn du es lässt."
];

// CHF-Formatter
const fmtCHF = new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 });

// ---------- Persistenz ----------
function loadState() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    state = { ...defaultState, ...data };
  } catch {
    state = { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------- DOM-Verweise ----------
const greetingEl         = document.getElementById("greeting");
const monthTextEl        = document.getElementById("monthText");
const currentDateEl      = document.getElementById("currentDate");
const quoteEl            = document.getElementById("quote");

const spentEl            = document.getElementById("spent");
const remainingEl        = document.getElementById("remaining");

const txCategoryEl       = document.getElementById("txCategory");
const txDescEl           = document.getElementById("txDesc");
const txAmountEl         = document.getElementById("txAmount");
const addTxBtn           = document.getElementById("addTx");

const totalBudgetEl      = document.getElementById("totalBudget");
const saveBudgetBtn      = document.getElementById("saveBudget");

const historyListEl      = document.getElementById("historyList");     // Auflistung-Tab
const transactionListEl  = document.getElementById("transactionList"); // Verlauf-Tab

const categoriesListEl   = document.getElementById("categoriesList");
const newCategoryNameEl  = document.getElementById("newCategoryName");
const addCategoryBtn     = document.getElementById("addCategory");

const archiveListEl      = document.getElementById("archiveList");

const categoryChartEl    = document.getElementById("categoryChart");

// Menü / Tabs
const menuButton         = document.getElementById("menuButton");
const menuOverlay        = document.getElementById("menuOverlay");
const closeMenuBtn       = document.getElementById("closeMenu");
const menuBackdrop       = document.getElementById("menuBackdrop");
const menuItems          = document.querySelectorAll(".menu-item");

// Modals / Onboarding
const welcomeModal       = document.getElementById("welcomeModal");
const saveNameBtn        = document.getElementById("saveName");
const userNameInput      = document.getElementById("userName");

const infoModal          = document.getElementById("infoModal");
const closeInfoBtn       = document.getElementById("closeInfo");

const categoryInfoModal  = document.getElementById("categoryInfoModal");
const closeCategoryInfoBtn = document.getElementById("closeCategoryInfo");

const paydayModal        = document.getElementById("paydayModal");
const paydaySelect       = document.getElementById("paydaySelect");
const savePaydayBtn      = document.getElementById("savePayday");

// Einstellungen / Export
const themeButtons       = document.querySelectorAll("[data-theme-select]");
const exportCSVBtn       = document.getElementById("exportCSV");
const exportWordBtn      = document.getElementById("exportWord");
const exportChartBtn     = document.getElementById("exportChart");

// NEU: Monats-Reset-Button (nur aktueller Monat/Verlauf/Ausgaben)
const clearMonthBtn      = document.getElementById("clearMonthBtn");

// Chart-Instanz
let chartInstance = null;

// =====================================================
// Init
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  initDateAndQuote();
  initPaydayOptions();
  setTheme(state.currentTheme, false);

  if (state.userName) {
    greetingEl.textContent = `Hallo ${state.userName}`;
  }
  if (state.totalBudget) {
    totalBudgetEl.value = String(state.totalBudget);
  }

  renderCategories();
  renderCategorySelect();
  renderTransactions();
  renderHistory();
  renderArchive();
  updateBudgetDisplay();
  renderChart();

  // Onboarding-Sequenz
  if (!state.userName) {
    showModal(welcomeModal);
  } else if (!state.seenInfo) {
    showModal(infoModal);
  } else if (!state.seenCatInfo) {
    showModal(categoryInfoModal);
  } else if (!state.payday) {
    showModal(paydayModal);
  }

  // Payday-Überwachung
  checkPayday();
  setInterval(checkPayday, 1000 * 60 * 60); // stündlich prüfen
});

// =====================================================
// UI-Helfer
// =====================================================
function initDateAndQuote() {
  const now = new Date();
  const month = now.toLocaleString("de-DE", { month: "long" });
  const year = now.getFullYear();
  monthTextEl.textContent = `${month} ${year}`;
  currentDateEl.textContent = now.toLocaleString("de-CH");
  const quoteIndex = now.getDate() % quotes.length;
  quoteEl.textContent = `„${quotes[quoteIndex]}”`;
}

function initPaydayOptions() {
  paydaySelect.innerHTML = "";
  for (let d = 1; d <= 28; d++) {
    const opt = document.createElement("option");
    opt.value = d;
    opt.textContent = d;
    paydaySelect.appendChild(opt);
  }
  if (state.payday) {
    paydaySelect.value = String(state.payday);
  }
}

function showModal(modal) {
  modal.setAttribute("aria-hidden", "false");
}
function hideModal(modal) {
  modal.setAttribute("aria-hidden", "true");
}

// =====================================================
// Event-Listener – Modals / Onboarding
// =====================================================
saveNameBtn.addEventListener("click", () => {
  const name = (userNameInput.value || "").trim();
  if (!name) return;
  state.userName = name;
  greetingEl.textContent = `Hallo ${name}`;
  saveState();
  hideModal(welcomeModal);
  if (!state.seenInfo) {
    showModal(infoModal);
  } else if (!state.seenCatInfo) {
    showModal(categoryInfoModal);
  } else if (!state.payday) {
    showModal(paydayModal);
  }
});

closeInfoBtn.addEventListener("click", () => {
  state.seenInfo = true;
  saveState();
  hideModal(infoModal);
  if (!state.seenCatInfo) {
    showModal(categoryInfoModal);
  } else if (!state.payday) {
    showModal(paydayModal);
  }
});

closeCategoryInfoBtn.addEventListener("click", () => {
  state.seenCatInfo = true;
  saveState();
  hideModal(categoryInfoModal);
  if (!state.payday) showModal(paydayModal);
});

savePaydayBtn.addEventListener("click", () => {
  const d = parseInt(paydaySelect.value, 10);
  if (!Number.isInteger(d) || d < 1 || d > 28) return;
  state.payday = d;
  saveState();
  hideModal(paydayModal);
});

// =====================================================
// Budget & Transaktionen
// =====================================================
saveBudgetBtn.addEventListener("click", () => {
  const val = parseFloat(totalBudgetEl.value);
  state.totalBudget = isNaN(val) ? 0 : Math.max(0, val);
  saveState();
  updateBudgetDisplay();
});

addTxBtn.addEventListener("click", () => {
  const category = txCategoryEl.value;
  const desc = (txDescEl.value || "").trim();
  const amount = parseFloat(txAmountEl.value);

  if (!category || !desc || isNaN(amount) || amount <= 0) return;

  const tx = { category, desc, amount, date: new Date().toISOString() };
  state.transactions.push(tx);
  saveState();

  txDescEl.value = "";
  txAmountEl.value = "";

  updateBudgetDisplay();
  renderTransactions();
  renderHistory();
  renderChart();
});

// **NEU**: Monats-Reset (nur aktueller Verlauf/Ausgaben)
if (clearMonthBtn) {
  clearMonthBtn.addEventListener("click", () => {
    const ok = window.confirm(
      "Willst du wirklich den kompletten Verlauf und alle Ausgaben dieses Monats löschen?\n" +
      "Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!ok) return;

    // Nur Transaktionen und berechnete Ausgaben dieses Monats entfernen
    state.transactions = [];
    state.spentAmount = 0;

    // Speichern & UI aktualisieren
    saveState();
    updateBudgetDisplay();
    renderTransactions();
    renderHistory();
    renderChart();

    // Optional: kleines Feedback
    alert("Der Verlauf und alle Ausgaben dieses Monats wurden gelöscht.");
  });
}

// Anzeige-Update
function updateBudgetDisplay() {
  const spent = state.transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  state.spentAmount = spent;
  spentEl.textContent = fmtCHF.format(spent);

  const remaining = (state.totalBudget || 0) - spent;
  remainingEl.textContent = fmtCHF.format(remaining);
  if (remaining < 200) {
    remainingEl.classList.add("red-alert");
  } else {
    remainingEl.classList.remove("red-alert");
  }
}

// =====================================================
// Render – Listen & Diagramm
// =====================================================
function renderTransactions() {
  historyListEl.innerHTML = "";
  state.transactions.forEach(tx => {
    const item = document.createElement("div");
    item.className = "list-item";
    const date = (tx.date || "").split("T")[0] || "";
    item.textContent = `${date} | ${tx.category} - ${tx.desc}: ${fmtCHF.format(tx.amount)}`;
    historyListEl.appendChild(item);
  });
}

function renderHistory() {
  transactionListEl.innerHTML = "";
  state.transactions.forEach(tx => {
    const item = document.createElement("div");
    item.className = "list-item";
    const date = (tx.date || "").split("T")[0] || "";
    item.textContent = `${date} | ${tx.category} - ${tx.desc} : ${fmtCHF.format(tx.amount)}`;
    transactionListEl.appendChild(item);
  });
}

function renderChart() {
  if (!categoryChartEl) return;

  const totals = {};
  state.transactions.forEach(tx => {
    if (!totals[tx.category]) totals[tx.category] = 0;
    totals[tx.category] += tx.amount;
  });

  const labels = Object.keys(totals);
  const data = Object.values(totals);

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (labels.length === 0) return;

  // einfache, aber unterschiedliche Farben
  const colors = labels.map((_, i) => `hsl(${(i * 57) % 360} 70% 60%)`);

  // eslint-disable-next-line no-undef
  chartInstance = new Chart(categoryChartEl, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

// =====================================================
// Kategorien
// =====================================================
addCategoryBtn.addEventListener("click", () => {
  const name = (newCategoryNameEl.value || "").trim();
  if (!name) return;
  if (!state.categories.includes(name)) {
    state.categories.push(name);
    saveState();
    renderCategories();
    renderCategorySelect();
  }
  newCategoryNameEl.value = "";
});

function renderCategories() {
  categoriesListEl.innerHTML = "";
  state.categories.forEach(cat => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.textContent = cat;
    categoriesListEl.appendChild(chip);
  });
}

function renderCategorySelect() {
  txCategoryEl.innerHTML = "";
  const cats = state.categories.length ? state.categories : ["Allgemein"];
  cats.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    txCategoryEl.appendChild(opt);
  });
}

// =====================================================
// Hamburger-Menü & Tabs
// =====================================================
menuButton.addEventListener("click", () => {
  menuOverlay.setAttribute("aria-hidden", "false");
});
closeMenuBtn.addEventListener("click", () => {
  menuOverlay.setAttribute("aria-hidden", "true");
});
menuBackdrop.addEventListener("click", () => {
  menuOverlay.setAttribute("aria-hidden", "true");
});
menuItems.forEach(item => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    const target = item.getAttribute("data-tab");
    const el = document.getElementById(`tab-${target}`);
    if (el) el.classList.add("active");
    menuOverlay.setAttribute("aria-hidden", "true");
  });
});

// =====================================================
// Themes (mit Klick-Highlight)
// =====================================================
function setTheme(theme, persist = true) {
  document.body.className = `theme-${theme}`;
  themeButtons.forEach(btn => {
    const isSelected = btn.dataset.themeSelect === theme;
    btn.setAttribute("data-selected", isSelected ? "true" : "false");
  });
  if (persist) {
    state.currentTheme = theme;
    saveState();
  }
}

themeButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const theme = btn.dataset.themeSelect;
    btn.classList.add("is-pressed");
    setTimeout(() => btn.classList.remove("is-pressed"), 180);
    setTheme(theme, true);
  });
});

// =====================================================
// Exporte
// =====================================================
exportCSVBtn.addEventListener("click", () => {
  let csv = "Datum,Kategorie,Beschreibung,Betrag\n";
  state.transactions.forEach(tx => {
    const date = (tx.date || "").split("T")[0] || "";
    csv += `${date},${escapeCSV(tx.category)},${escapeCSV(tx.desc)},${tx.amount.toFixed(2)}\n`;
  });
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "auflistung.csv");
});

exportWordBtn.addEventListener("click", () => {
  if (!window.docx) return;
  const { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType } = window.docx;

  const rows = [];
  rows.push(new TableRow({
    children: [
      new TableCell({ children: [new Paragraph("Datum")],      width: { size: 25, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Kategorie")],  width: { size: 25, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Beschreibung")], width: { size: 30, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Betrag")],     width: { size: 20, type: WidthType.PERCENTAGE } }),
    ]
  }));

  state.transactions.forEach(tx => {
    const date = (tx.date || "").split("T")[0] || "";
    rows.push(new TableRow({
      children: [
        new TableCell({ children: [new Paragraph(date)] }),
        new TableCell({ children: [new Paragraph(tx.category)] }),
        new TableCell({ children: [new Paragraph(tx.desc)] }),
        new TableCell({ children: [new Paragraph(tx.amount.toFixed(2))] }),
      ]
    }));
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: "Auflistung", alignment: AlignmentType.CENTER }),
        new Table({ rows })
      ]
    }]
  });

  Packer.toBlob(doc).then(blob => downloadBlob(blob, "auflistung.docx"));
});

exportChartBtn.addEventListener("click", () => {
  if (!categoryChartEl) return;
  if (!chartInstance) renderChart();
  const url = categoryChartEl.toDataURL("image/png");
  downloadURL(url, "diagramm.png");
});

// Hilfen für Export
function escapeCSV(s) {
  if (s == null) return "";
  const str = String(s);
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadURL(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadURL(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// =====================================================
// Archivierung (Payday)
// =====================================================
function checkPayday() {
  const today = new Date().getDate();
  if (state.payday && today === Number(state.payday)) {
    if (state.transactions.length > 0) {
      state.archive.push({
        date: new Date().toISOString(),
        transactions: [...state.transactions],
        totalBudget: state.totalBudget,
        spentAmount: state.spentAmount
      });
      state.transactions = [];
      state.spentAmount = 0;
      saveState();
      updateBudgetDisplay();
      renderTransactions();
      renderHistory();
      renderChart();
      renderArchive();
    }
  }
}

function renderArchive() {
  archiveListEl.innerHTML = "";
  state.archive.forEach(entry => {
    const item = document.createElement("div");
    item.className = "list-item";
    const date = (entry.date || "").split("T")[0] || "";
    item.textContent = `${date} - ${entry.transactions.length} Transaktionen`;
    archiveListEl.appendChild(item);
  });
}

