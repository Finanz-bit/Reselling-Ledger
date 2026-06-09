const STORAGE_KEY = "piece-ledger-v3-state";
const LEGACY_STORAGE_KEYS = ["piece-ledger-v2-state", "piece-ledger-v2"];
const VISIBLE_PIECE_LIMIT = 3;

const STATUS = {
  purchased: {
    label: "Upload",
    badge: "status-purchased",
  },
  sold: {
    label: "Verkauft",
    badge: "status-sold",
  },
  completed: {
    label: "Abgeschlossen",
    badge: "status-completed",
  },
};

const state = {
  pieces: [],
  orders: [],
  filter: "all",
  search: "",
  sort: "newest",
  piecesExpanded: false,
  prefillOrderId: null,
  charts: {},
};

const moneyFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const percentFormatter = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const els = {
  form: document.querySelector("#pieceForm"),
  pieceId: document.querySelector("#pieceId"),
  formTitle: document.querySelector("#formTitle"),
  feedback: document.querySelector("#formFeedback"),
  resetFormBtn: document.querySelector("#resetFormBtn"),
  name: document.querySelector("#nameInput"),
  description: document.querySelector("#descriptionInput"),
  purchaseDate: document.querySelector("#purchaseDateInput"),
  purchasePrice: document.querySelector("#purchasePriceInput"),
  expectedSalePrice: document.querySelector("#expectedSalePriceInput"),
  actualSalePrice: document.querySelector("#actualSalePriceInput"),
  payoutAmount: document.querySelector("#payoutAmountInput"),
  status: document.querySelector("#statusInput"),
  search: document.querySelector("#searchInput"),
  sort: document.querySelector("#sortInput"),
  filterButtons: document.querySelectorAll("[data-filter]"),
  pieceList: document.querySelector("#pieceList"),
  pieceExpandBtn: document.querySelector("#pieceExpandBtn"),
  resultCount: document.querySelector("#resultCount"),
  orderForm: document.querySelector("#orderForm"),
  orderFeedback: document.querySelector("#orderFeedback"),
  orderName: document.querySelector("#orderNameInput"),
  orderSource: document.querySelector("#orderSourceInput"),
  orderDate: document.querySelector("#orderDateInput"),
  orderPrice: document.querySelector("#orderPriceInput"),
  orderNote: document.querySelector("#orderNoteInput"),
  orderList: document.querySelector("#orderList"),
  orderCount: document.querySelector("#orderCount"),
  navLinks: document.querySelectorAll("[data-nav-link]"),
  sections: document.querySelectorAll("[data-section]"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  importJsonInput: document.querySelector("#importJsonInput"),
  totalExpenses: document.querySelector("#totalExpenses"),
  totalPieceExpenses: document.querySelector("#totalPieceExpenses"),
  totalOrderExpenses: document.querySelector("#totalOrderExpenses"),
  totalIncome: document.querySelector("#totalIncome"),
  totalSaleIncome: document.querySelector("#totalSaleIncome"),
  totalPayoutIncome: document.querySelector("#totalPayoutIncome"),
  totalExcludedIncomePieces: document.querySelector("#totalExcludedIncomePieces"),
  totalBalance: document.querySelector("#totalBalance"),
  totalActivePieces: document.querySelector("#totalActivePieces"),
  totalOpenOrders: document.querySelector("#totalOpenOrders"),
};

let scrollSpyFrame = 0;
let scrollSpyPausedUntil = 0;

const statIds = {
  hypothesis: {
    profit: "hypothesisProfit",
    progress: "hypothesisProgress",
    spend: "hypothesisSpend",
    revenue: "hypothesisRevenue",
    avg: "hypothesisAvg",
    count: "hypothesisCount",
  },
  sold: {
    profit: "soldProfit",
    progress: "soldProgress",
    spend: "soldSpend",
    revenue: "soldRevenue",
    avg: "soldAvg",
    count: "soldCount",
  },
  realized: {
    profit: "realizedProfit",
    progress: "realizedProgress",
    spend: "realizedSpend",
    revenue: "realizedRevenue",
    avg: "realizedAvg",
    roi: "realizedRoi",
  },
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  const loaded = loadAppState();
  state.pieces = loaded.pieces;
  state.orders = loaded.orders;
  els.purchaseDate.value = today();
  els.orderDate.value = today();
  bindEvents();
  setupSectionObserver();
  render();
}

function bindEvents() {
  els.form.addEventListener("submit", handleFormSubmit);
  els.resetFormBtn.addEventListener("click", resetForm);
  els.search.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    state.piecesExpanded = false;
    renderList();
  });
  els.sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    state.piecesExpanded = false;
    renderList();
  });
  els.status.addEventListener("change", updateConditionalFields);
  els.pieceExpandBtn.addEventListener("click", () => {
    state.piecesExpanded = !state.piecesExpanded;
    renderList();
  });
  els.orderForm.addEventListener("submit", handleOrderSubmit);
  els.exportJsonBtn.addEventListener("click", exportJson);
  els.importJsonInput.addEventListener("change", importJson);
  els.filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      state.piecesExpanded = false;
      els.filterButtons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      renderList();
    });
  });
  els.navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const sectionId = link.dataset.navLink;
      scrollSpyPausedUntil = Date.now() + 650;
      setActiveNav(sectionId);
      scrollToSection(sectionId);
      link.blur();
    });
  });
}

function handleFormSubmit(event) {
  event.preventDefault();
  const piece = readForm();
  const error = validatePiece(piece);

  if (error) {
    els.feedback.textContent = error;
    return;
  }

  const now = new Date().toISOString();
  const existingIndex = state.pieces.findIndex((item) => item.id === piece.id);

  if (existingIndex >= 0) {
    state.pieces[existingIndex] = {
      ...state.pieces[existingIndex],
      ...piece,
      updatedAt: now,
    };
  } else {
    state.pieces.unshift({
      ...piece,
      id: createId(),
      createdAt: now,
      updatedAt: now,
    });

    if (state.prefillOrderId) {
      state.orders = state.orders.filter((item) => item.id !== state.prefillOrderId);
      state.prefillOrderId = null;
    }
  }

  state.piecesExpanded = false;
  saveAppState();
  resetForm();
  render();
}

function readForm() {
  return {
    id: els.pieceId.value,
    name: els.name.value.trim(),
    description: els.description.value.trim(),
    purchaseDate: els.purchaseDate.value || today(),
    purchasePrice: toNumber(els.purchasePrice.value),
    expectedSalePrice: toNumber(els.expectedSalePrice.value),
    actualSalePrice: optionalNumber(els.actualSalePrice.value),
    payoutAmount: optionalNumber(els.payoutAmount.value),
    status: els.status.value,
  };
}

function validatePiece(piece) {
  if (!piece.name) return "Produktname fehlt.";
  if (!piece.description) return "Beschreibung fehlt.";
  if (!hasMoneyInput(els.purchasePrice)) return "Einkaufspreis fehlt.";
  if (!hasMoneyInput(els.expectedSalePrice)) return "Hypothese Verkaufspreis fehlt.";
  if (piece.status === "sold" && !isValidMoney(piece.actualSalePrice)) {
    return "Für Verkauft wird der tatsächliche Verkaufspreis benötigt.";
  }
  if (piece.status === "completed" && !isValidMoney(piece.actualSalePrice)) {
    return "Für Abgeschlossen wird der tatsächliche Verkaufspreis benötigt.";
  }
  if (piece.status === "completed" && !isValidMoney(piece.payoutAmount)) {
    return "Für Abgeschlossen wird der tatsächlich ausgezahlte Betrag benötigt.";
  }
  return "";
}

function updateConditionalFields() {
  const isSold = els.status.value === "sold";
  const isCompleted = els.status.value === "completed";
  els.actualSalePrice.required = isSold || isCompleted;
  els.payoutAmount.required = isCompleted;
}

function resetForm() {
  els.form.reset();
  els.pieceId.value = "";
  state.prefillOrderId = null;
  els.formTitle.textContent = "Piece anlegen";
  els.feedback.textContent = "";
  els.purchaseDate.value = today();
  updateConditionalFields();
}

function editPiece(id) {
  const piece = state.pieces.find((item) => item.id === id);
  if (!piece) return;

  state.prefillOrderId = null;
  els.pieceId.value = piece.id;
  els.name.value = piece.name;
  els.description.value = piece.description;
  els.purchaseDate.value = piece.purchaseDate || today();
  els.purchasePrice.value = piece.purchasePrice;
  els.expectedSalePrice.value = piece.expectedSalePrice;
  els.actualSalePrice.value = piece.actualSalePrice ?? "";
  els.payoutAmount.value = piece.payoutAmount ?? "";
  els.status.value = piece.status;
  els.formTitle.textContent = "Piece bearbeiten";
  els.feedback.textContent = "";
  updateConditionalFields();
  scrollToSection("produktverwaltung");
}

function deletePiece(id) {
  const piece = state.pieces.find((item) => item.id === id);
  if (!piece) return;

  if (!window.confirm(`"${piece.name}" wirklich löschen?`)) return;

  state.pieces = state.pieces.filter((item) => item.id !== id);
  saveAppState();
  render();
}

function handleOrderSubmit(event) {
  event.preventDefault();
  const order = readOrderForm();

  if (!order.name) {
    els.orderFeedback.textContent = "Produktname der Bestellung fehlt.";
    return;
  }

  state.orders.unshift({
    ...order,
    id: createId(),
    createdAt: new Date().toISOString(),
  });

  saveAppState();
  resetOrderForm();
  render();
}

function readOrderForm() {
  return {
    name: els.orderName.value.trim(),
    source: els.orderSource.value.trim(),
    orderDate: els.orderDate.value || today(),
    price: optionalNumber(els.orderPrice.value),
    note: els.orderNote.value.trim(),
  };
}

function resetOrderForm() {
  els.orderForm.reset();
  els.orderDate.value = today();
  els.orderFeedback.textContent = "";
}

function deleteOrder(id) {
  const order = state.orders.find((item) => item.id === id);
  if (!order) return;

  if (!window.confirm(`Bestellung "${order.name}" löschen?`)) return;

  state.orders = state.orders.filter((item) => item.id !== id);
  saveAppState();
  render();
}

function createPieceFromOrder(id) {
  const order = state.orders.find((item) => item.id === id);
  if (!order) return;

  resetForm();
  state.prefillOrderId = id;
  els.name.value = order.name;
  els.description.value = [order.note, order.source ? `Quelle: ${order.source}` : ""].filter(Boolean).join("\n");
  els.purchaseDate.value = order.orderDate || today();
  els.purchasePrice.value = order.price ?? "";
  els.expectedSalePrice.value = "";
  els.status.value = "purchased";
  els.formTitle.textContent = "Piece aus Bestellung anlegen";
  els.feedback.textContent = "Bestellung übernommen. Ergänze die Verkaufshypothese und speichere das Piece.";
  updateConditionalFields();
  scrollToSection("produktverwaltung");
  window.setTimeout(() => els.expectedSalePrice.focus(), 260);
}

function render() {
  renderTotalOverview();
  renderStats();
  renderList();
  renderOrders();
  renderCharts();
}

function renderTotalOverview() {
  const pieceExpenses = sum(state.pieces, (piece) => piece.purchasePrice);
  const orderExpenses = sum(state.orders, (order) => order.price);
  const openSaleIncome = sum(
    state.pieces.filter((piece) => piece.status === "sold"),
    (piece) => piece.actualSalePrice,
  );
  const payoutIncome = sum(
    state.pieces.filter((piece) => piece.status === "completed"),
    (piece) => piece.payoutAmount,
  );
  const totalExpenses = pieceExpenses + orderExpenses;
  const totalIncome = openSaleIncome + payoutIncome;
  const balance = totalIncome - totalExpenses;
  const activePieces = state.pieces.filter((piece) => piece.status !== "completed").length;
  const excludedIncomePieces = state.pieces.filter((piece) => piece.status === "purchased").length;

  els.totalExpenses.textContent = formatMoney(totalExpenses);
  els.totalPieceExpenses.textContent = formatMoney(pieceExpenses);
  els.totalOrderExpenses.textContent = formatMoney(orderExpenses);
  els.totalIncome.textContent = formatMoney(totalIncome);
  els.totalSaleIncome.textContent = formatMoney(openSaleIncome);
  els.totalPayoutIncome.textContent = formatMoney(payoutIncome);
  els.totalExcludedIncomePieces.textContent = `${excludedIncomePieces} ${excludedIncomePieces === 1 ? "Piece" : "Pieces"}`;
  els.totalBalance.textContent = formatMoney(balance);
  els.totalBalance.classList.remove("positive", "negative", "neutral");
  els.totalBalance.classList.add(valueClass(balance));
  els.totalActivePieces.textContent = activePieces;
  els.totalOpenOrders.textContent = state.orders.length;
}

function renderStats() {
  const purchased = state.pieces.filter((piece) => piece.status === "purchased");
  const sold = state.pieces.filter((piece) => piece.status === "sold");
  const completed = state.pieces.filter((piece) => piece.status === "completed");

  const hypothesisStats = createStats(purchased, "expected");
  const soldStats = createStats(sold, "actual");
  const realizedStats = createStats(completed, "payout");

  updateStatCard("hypothesis", hypothesisStats, {
    countLabel: hypothesisStats.count,
  });
  updateStatCard("sold", soldStats, {
    countLabel: soldStats.count,
  });
  updateStatCard("realized", realizedStats, {
    roiLabel: `${percentFormatter.format(realizedStats.roi)}%`,
  });
}

function createStats(pieces, mode) {
  const spend = sum(pieces, (piece) => piece.purchasePrice);
  const revenue = sum(pieces, (piece) => getRevenue(piece, mode));
  const profit = revenue - spend;
  const count = pieces.length;
  const avg = count > 0 ? profit / count : 0;
  const roi = spend > 0 ? (profit / spend) * 100 : 0;

  return { spend, revenue, profit, count, avg, roi };
}

function updateStatCard(type, stats, options = {}) {
  const ids = statIds[type];
  setMoney(ids.profit, stats.profit, true);
  setMoney(ids.spend, stats.spend);
  setMoney(ids.revenue, stats.revenue);
  setMoney(ids.avg, stats.avg, true);

  if (ids.count) document.querySelector(`#${ids.count}`).textContent = options.countLabel ?? stats.count;
  if (ids.roi) document.querySelector(`#${ids.roi}`).textContent = options.roiLabel ?? `${percentFormatter.format(stats.roi)}%`;

  const progress = revenueProgress(stats.profit, stats.revenue);
  document.querySelector(`#${ids.progress}`).style.width = `${progress}%`;
}

function renderList() {
  const pieces = filteredPieces();
  const visiblePieces = state.piecesExpanded ? pieces : pieces.slice(0, VISIBLE_PIECE_LIMIT);
  els.resultCount.textContent = `${pieces.length} ${pieces.length === 1 ? "Piece" : "Pieces"}`;

  if (pieces.length === 0) {
    els.pieceList.innerHTML = `
      <article class="glass-card empty-state">
        <h3>Keine Pieces gefunden</h3>
        <p>Lege ein Produkt an oder passe Suche, Filter und Sortierung an.</p>
      </article>
    `;
    els.pieceExpandBtn.hidden = true;
    return;
  }

  els.pieceList.innerHTML = visiblePieces.map(createPieceCard).join("");
  els.pieceList.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => editPiece(button.dataset.edit));
  });
  els.pieceList.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deletePiece(button.dataset.delete));
  });

  els.pieceExpandBtn.hidden = pieces.length <= VISIBLE_PIECE_LIMIT;
  els.pieceExpandBtn.textContent = state.piecesExpanded
    ? "Weniger Pieces anzeigen"
    : `Alle ${pieces.length} Pieces anzeigen`;
}

function filteredPieces() {
  return [...state.pieces]
    .filter((piece) => state.filter === "all" || piece.status === state.filter)
    .filter((piece) => {
      if (!state.search) return true;
      return `${piece.name} ${piece.description}`.toLowerCase().includes(state.search);
    })
    .sort((a, b) => {
      if (state.sort === "oldest") return sortDate(a) - sortDate(b);
      if (state.sort === "profitDesc") return outcome(b).profit - outcome(a).profit;
      if (state.sort === "profitAsc") return outcome(a).profit - outcome(b).profit;
      return sortDate(b) - sortDate(a);
    });
}

function createPieceCard(piece) {
  const status = STATUS[piece.status] ?? STATUS.purchased;
  const pieceOutcome = outcome(piece);
  const profitClass = valueClass(pieceOutcome.profit);
  const roiClass = valueClass(pieceOutcome.roi);

  return `
    <article class="piece-card">
      <div class="piece-head">
        <div class="piece-title-wrap">
          <span class="status-chip ${status.badge}">${status.label}</span>
          <h3 class="piece-title">${escapeHtml(piece.name)}</h3>
          <p class="piece-note">${escapeHtml(piece.description)}</p>
        </div>
        <div class="piece-profit">
          <span>${pieceOutcome.label}</span>
          <strong class="${profitClass}">${formatMoney(pieceOutcome.profit)}</strong>
        </div>
      </div>

      <p class="piece-meta">Einkauf: ${formatDate(piece.purchaseDate)}</p>

      <div class="piece-metrics">
        <div class="piece-metric"><span>Einkaufspreis</span><strong>${formatMoney(piece.purchasePrice)}</strong></div>
        <div class="piece-metric"><span>Hypothese Verkauf</span><strong>${formatMoney(piece.expectedSalePrice)}</strong></div>
        <div class="piece-metric"><span>Tatsächlicher Verkauf</span><strong>${formatOptionalMoneyHtml(piece.actualSalePrice)}</strong></div>
        <div class="piece-metric"><span>Tatsächlich ausgezahlt</span><strong>${formatOptionalMoneyHtml(piece.payoutAmount)}</strong></div>
      </div>

      <div class="piece-footer">
        <span class="roi-pill ${roiClass}">ROI ${percentFormatter.format(pieceOutcome.roi)}%</span>
        <div class="card-actions">
          <button class="btn subtle" type="button" data-edit="${escapeHtml(piece.id)}">Bearbeiten</button>
          <button class="btn subtle danger" type="button" data-delete="${escapeHtml(piece.id)}">Löschen</button>
        </div>
      </div>
    </article>
  `;
}

function renderOrders() {
  els.orderCount.textContent = `${state.orders.length} ${state.orders.length === 1 ? "Bestellung" : "Bestellungen"}`;

  if (state.orders.length === 0) {
    els.orderList.innerHTML = `
      <article class="empty-state">
        <h3>Keine laufenden Bestellungen</h3>
        <p>Füge neue Einkäufe hinzu, die noch nicht als Piece im Bestand sind.</p>
      </article>
    `;
    return;
  }

  els.orderList.innerHTML = state.orders.map(createOrderCard).join("");
  els.orderList.querySelectorAll("[data-create-piece-order]").forEach((button) => {
    button.addEventListener("click", () => createPieceFromOrder(button.dataset.createPieceOrder));
  });
  els.orderList.querySelectorAll("[data-delete-order]").forEach((button) => {
    button.addEventListener("click", () => deleteOrder(button.dataset.deleteOrder));
  });
}

function createOrderCard(order) {
  return `
    <article class="order-card">
      <div class="order-head">
        <div class="order-title-wrap">
          <span class="status-chip status-ordered">Bestellt</span>
          <h3 class="order-title">${escapeHtml(order.name)}</h3>
          ${order.note ? `<p class="order-note">${escapeHtml(order.note)}</p>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn subtle" type="button" data-create-piece-order="${escapeHtml(order.id)}">Als Piece eintragen</button>
          <button class="btn subtle danger" type="button" data-delete-order="${escapeHtml(order.id)}">Löschen</button>
        </div>
      </div>

      <div class="order-metrics">
        <div class="order-metric"><span>Quelle</span><strong>${order.source ? escapeHtml(order.source) : openValueHtml()}</strong></div>
        <div class="order-metric"><span>Bestelldatum</span><strong>${formatDate(order.orderDate)}</strong></div>
        <div class="order-metric"><span>Preis</span><strong>${formatOptionalMoneyHtml(order.price)}</strong></div>
      </div>
    </article>
  `;
}

function outcome(piece) {
  if (piece.status === "completed") {
    const revenue = piece.payoutAmount ?? 0;
    return createOutcome(revenue, piece.purchasePrice, "Realer Gewinn");
  }

  if (piece.status === "sold") {
    const revenue = piece.actualSalePrice ?? 0;
    return createOutcome(revenue, piece.purchasePrice, "Offener Gewinn");
  }

  return createOutcome(piece.expectedSalePrice, piece.purchasePrice, "Erwarteter Gewinn");
}

function createOutcome(revenue, spend, label) {
  const profit = revenue - spend;
  const roi = spend > 0 ? (profit / spend) * 100 : 0;
  return { revenue, profit, roi, label };
}

function renderCharts() {
  const timeline = [...state.pieces].sort((a, b) => sortDate(a) - sortDate(b));
  const labels = timeline.map((piece) => shortLabel(piece));
  const profitData = cumulative(timeline.map((piece) => outcome(piece).profit));
  const revenueData = cumulative(timeline.map((piece) => outcome(piece).revenue));
  const roiData = timeline.map((piece) => outcome(piece).roi);
  const statusLabels = Object.values(STATUS).map((status) => status.label);
  const statusData = Object.keys(STATUS).map(
    (key) => state.pieces.filter((piece) => piece.status === key).length,
  );

  if (window.Chart) {
    window.Chart.defaults.animation = false;
    renderChartJs("profitChart", "line", labels, [
      dataset("Gewinn", profitData, "#32d583", "rgba(50, 213, 131, 0.12)"),
    ]);
    renderChartJs("revenueChart", "bar", labels, [
      dataset("Umsatz", revenueData, "#4da3ff", "rgba(77, 163, 255, 0.25)"),
    ]);
    renderChartJs("statusChart", "doughnut", statusLabels, [
      {
        data: statusData,
        backgroundColor: ["#4da3ff", "#ffb058", "#32d583"],
        borderColor: "rgba(255, 255, 255, 0.16)",
        borderWidth: 1,
      },
    ]);
    renderChartJs("roiChart", "line", labels, [
      dataset("ROI", roiData, "#a78bfa", "rgba(167, 139, 250, 0.12)"),
    ]);
    return;
  }

  drawFallbackChart("profitChart", labels, profitData, "#32d583", "line");
  drawFallbackChart("revenueChart", labels, revenueData, "#4da3ff", "bar");
  drawFallbackDoughnut("statusChart", statusLabels, statusData);
  drawFallbackChart("roiChart", labels, roiData, "#a78bfa", "line", "%");
}

function renderChartJs(canvasId, type, labels, datasets) {
  const canvas = document.querySelector(`#${canvasId}`);
  lockCanvasSize(canvas);
  const config = {
    type,
    data: { labels, datasets },
    options: chartOptions(type),
  };

  if (state.charts[canvasId]) {
    state.charts[canvasId].data.labels = labels;
    state.charts[canvasId].data.datasets = datasets;
    state.charts[canvasId].update("none");
    return;
  }

  state.charts[canvasId] = new Chart(canvas, config);
}

function chartOptions(type) {
  const base = {
    responsive: false,
    maintainAspectRatio: false,
    animation: false,
    events: [],
    devicePixelRatio: 1,
    plugins: {
      legend: {
        labels: {
          color: "#c8d2e1",
          boxWidth: 12,
          boxHeight: 12,
          useBorderRadius: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(7, 10, 15, 0.95)",
        borderColor: "rgba(255, 255, 255, 0.14)",
        borderWidth: 1,
        titleColor: "#f7fbff",
        bodyColor: "#c8d2e1",
      },
    },
  };

  if (type === "doughnut") {
    return {
      ...base,
      cutout: "66%",
    };
  }

  return {
    ...base,
    scales: {
      x: {
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        ticks: { color: "#97a3b6", maxRotation: 0, autoSkip: true },
      },
      y: {
        grid: { color: "rgba(255, 255, 255, 0.07)" },
        ticks: { color: "#97a3b6" },
      },
    },
    elements: {
      line: { tension: 0.28 },
      point: { radius: 2, hoverRadius: 4 },
    },
  };
}

function dataset(label, data, borderColor, backgroundColor) {
  return {
    label,
    data,
    borderColor,
    backgroundColor,
    fill: true,
    borderWidth: 2,
  };
}

function drawFallbackChart(canvasId, labels, values, color, type, suffix = "") {
  const canvas = document.querySelector(`#${canvasId}`);
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  drawPanelGrid(ctx, width, height);

  if (values.length === 0) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const padding = 28;
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  const span = max - min || 1;
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const toX = (index) => padding + (plotWidth * index) / Math.max(values.length - 1, 1);
  const toY = (value) => height - padding - ((value - min) / span) * plotHeight;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  if (type === "bar") {
    const barWidth = Math.max(10, plotWidth / values.length - 10);
    values.forEach((value, index) => {
      const x = toX(index) - barWidth / 2;
      const y = toY(value);
      ctx.globalAlpha = 0.72;
      ctx.fillRect(x, y, barWidth, height - padding - y);
    });
    ctx.globalAlpha = 1;
  } else {
    ctx.beginPath();
    values.forEach((value, index) => {
      const x = toX(index);
      const y = toY(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.fillStyle = "#c8d2e1";
  ctx.font = "700 12px system-ui";
  ctx.fillText(`${formatCompact(values[values.length - 1])}${suffix}`, padding, 18);
  if (labels.length > 0) {
    ctx.fillStyle = "#97a3b6";
    ctx.fillText(labels[labels.length - 1], padding, height - 8);
  }
}

function drawFallbackDoughnut(canvasId, labels, values) {
  const canvas = document.querySelector(`#${canvasId}`);
  const ctx = prepareCanvas(canvas);
  const { width, height } = canvas;
  const colors = ["#4da3ff", "#ffb058", "#32d583"];
  const total = values.reduce((acc, value) => acc + value, 0);
  ctx.clearRect(0, 0, width, height);

  if (total === 0) {
    drawEmptyChart(ctx, width, height);
    return;
  }

  const centerX = width / 2;
  const centerY = height / 2 - 8;
  const radius = Math.min(width, height) * 0.32;
  let start = -Math.PI / 2;

  values.forEach((value, index) => {
    const angle = (value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[index];
    ctx.fill();
    start += angle;
  });

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.62, 0, Math.PI * 2);
  ctx.fillStyle = "#101722";
  ctx.fill();
  ctx.fillStyle = "#f7fbff";
  ctx.font = "900 24px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(total, centerX, centerY + 8);
  ctx.textAlign = "left";

  labels.forEach((label, index) => {
    const y = height - 46 + index * 16;
    ctx.fillStyle = colors[index];
    ctx.fillRect(18, y - 9, 9, 9);
    ctx.fillStyle = "#c8d2e1";
    ctx.font = "700 11px system-ui";
    ctx.fillText(`${label}: ${values[index]}`, 34, y);
  });
}

function prepareCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
  return canvas.getContext("2d");
}

function lockCanvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const styles = window.getComputedStyle(canvas);
  const width = Math.max(260, Math.floor(rect.width));
  const height = Math.max(140, Number.parseInt(styles.height, 10) || 160);
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = "100%";
  canvas.style.height = `${height}px`;
}

function drawPanelGrid(ctx, width, height) {
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  for (let y = 28; y < height - 18; y += 34) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(width - 20, y);
    ctx.stroke();
  }
}

function drawEmptyChart(ctx, width, height) {
  ctx.fillStyle = "#97a3b6";
  ctx.font = "700 13px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("Keine Daten", width / 2, height / 2);
  ctx.textAlign = "left";
}

function setupSectionObserver() {
  window.addEventListener("scroll", scheduleScrollSpy, { passive: true });
  window.addEventListener("resize", scheduleScrollSpy);
  updateActiveNavFromScroll();
}

function scheduleScrollSpy() {
  if (scrollSpyFrame) return;
  scrollSpyFrame = window.requestAnimationFrame(() => {
    scrollSpyFrame = 0;
    updateActiveNavFromScroll();
  });
}

function updateActiveNavFromScroll() {
  if (Date.now() < scrollSpyPausedUntil) return;

  if (window.scrollY <= 4) {
    setActiveNav("dashboard");
    return;
  }

  const documentHeight = document.documentElement.scrollHeight;
  const isAtPageEnd = window.innerHeight + window.scrollY >= documentHeight - 4;
  if (isAtPageEnd) {
    const lastSection = els.sections[els.sections.length - 1];
    if (lastSection) setActiveNav(lastSection.dataset.section);
    return;
  }

  const marker = window.scrollY + getScrollOffset() + 24;
  const sections = [...els.sections];
  const candidates = sections
    .map((section) => ({
      section,
      top: section.getBoundingClientRect().top + window.scrollY,
    }))
    .filter((item) => item.top <= marker);
  const maxTop = Math.max(...candidates.map((item) => item.top));
  const tiedCandidates = candidates.filter((item) => Math.abs(item.top - maxTop) < 2);
  const activeSectionId = document.querySelector("[data-nav-link].active")?.dataset.navLink;
  const current =
    tiedCandidates.find((item) => item.section.dataset.section === activeSectionId)?.section
    || tiedCandidates[0]?.section
    || sections[0];

  if (current) setActiveNav(current.dataset.section);
}

function scrollToSection(sectionId) {
  if (sectionId === "dashboard") {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const section = document.querySelector(`#${sectionId}`);
  if (!section) return;

  const top = section.getBoundingClientRect().top + window.scrollY - getScrollOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function getScrollOffset() {
  if (window.matchMedia("(max-width: 720px)").matches) return 12;
  if (window.matchMedia("(max-width: 1280px)").matches) {
    const nav = document.querySelector(".side-nav");
    return (nav?.offsetHeight || 0) + 12;
  }
  return 24;
}

function setActiveNav(sectionId) {
  els.navLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.navLink === sectionId);
  });
}

function exportJson() {
  const payload = {
    app: "Piece Ledger",
    version: 3,
    exportedAt: new Date().toISOString(),
    pieces: state.pieces,
    orders: state.orders,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `piece-ledger-v3-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const importedPieces = Array.isArray(parsed) ? parsed : parsed.pieces;
      const importedOrders = Array.isArray(parsed?.orders) ? parsed.orders : [];

      if (!Array.isArray(importedPieces)) {
        throw new Error("JSON enthält keine Piece-Liste.");
      }

      const normalizedPieces = importedPieces.map(normalizePiece).filter(Boolean);
      const normalizedOrders = importedOrders.map(normalizeOrder).filter(Boolean);
      const message = `${normalizedPieces.length} Pieces und ${normalizedOrders.length} Bestellungen importieren und aktuelle Daten ersetzen?`;

      if (!window.confirm(message)) return;

      state.pieces = normalizedPieces;
      state.orders = normalizedOrders;
      state.piecesExpanded = false;
      saveAppState();
      resetForm();
      resetOrderForm();
      render();
    } catch (error) {
      window.alert(`Import fehlgeschlagen: ${error.message}`);
    } finally {
      els.importJsonInput.value = "";
    }
  });
  reader.readAsText(file);
}

function normalizePiece(piece) {
  if (!piece || typeof piece !== "object") return null;
  const status = STATUS[piece.status] ? piece.status : "purchased";
  return {
    id: String(piece.id || createId()),
    name: String(piece.name || "").trim(),
    description: String(piece.description || "").trim(),
    purchaseDate: piece.purchaseDate || today(),
    purchasePrice: toNumber(piece.purchasePrice),
    expectedSalePrice: toNumber(piece.expectedSalePrice),
    actualSalePrice: piece.actualSalePrice === null || piece.actualSalePrice === undefined ? null : toNumber(piece.actualSalePrice),
    payoutAmount: piece.payoutAmount === null || piece.payoutAmount === undefined ? null : toNumber(piece.payoutAmount),
    status,
    createdAt: piece.createdAt || new Date().toISOString(),
    updatedAt: piece.updatedAt || new Date().toISOString(),
  };
}

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;
  return {
    id: String(order.id || createId()),
    name: String(order.name || "").trim(),
    source: String(order.source || "").trim(),
    orderDate: order.orderDate || today(),
    price: order.price === null || order.price === undefined ? null : toNumber(order.price),
    note: String(order.note || "").trim(),
    createdAt: order.createdAt || new Date().toISOString(),
  };
}

function loadAppState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return normalizeStoredState(JSON.parse(raw));
    }

    for (const key of LEGACY_STORAGE_KEYS) {
      const legacyRaw = localStorage.getItem(key);
      if (legacyRaw) {
        return normalizeStoredState(JSON.parse(legacyRaw));
      }
    }
  } catch {
    return { pieces: [], orders: [] };
  }

  return { pieces: [], orders: [] };
}

function normalizeStoredState(parsed) {
  return {
    pieces: Array.isArray(parsed)
      ? parsed.map(normalizePiece).filter(Boolean)
      : Array.isArray(parsed?.pieces)
        ? parsed.pieces.map(normalizePiece).filter(Boolean)
        : [],
    orders: Array.isArray(parsed?.orders) ? parsed.orders.map(normalizeOrder).filter(Boolean) : [],
  };
}

function saveAppState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      pieces: state.pieces,
      orders: state.orders,
    }),
  );
}

function getRevenue(piece, mode) {
  if (mode === "payout") return piece.payoutAmount ?? 0;
  if (mode === "actual") return piece.actualSalePrice ?? 0;
  return piece.expectedSalePrice ?? 0;
}

function cumulative(values) {
  let total = 0;
  return values.map((value) => {
    total += value;
    return Number(total.toFixed(2));
  });
}

function sum(items, selector) {
  return items.reduce((acc, item) => acc + (selector(item) || 0), 0);
}

function sortDate(piece) {
  return new Date(piece.purchaseDate || piece.createdAt || 0).getTime();
}

function shortLabel(piece) {
  const date = piece.purchaseDate ? new Date(piece.purchaseDate) : null;
  if (date && !Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }
  return piece.name.slice(0, 12);
}

function revenueProgress(profit, revenue) {
  if (revenue <= 0 || profit <= 0) return 0;
  return Math.min(100, Math.round((profit / revenue) * 100));
}

function setMoney(id, value, signed = false) {
  const element = document.querySelector(`#${id}`);
  element.textContent = formatMoney(value);
  if (signed) {
    element.classList.remove("positive", "negative", "neutral");
    element.classList.add(valueClass(value));
  }
}

function valueClass(value) {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function isValidMoney(value) {
  return Number.isFinite(value) && value >= 0;
}

function hasMoneyInput(input) {
  return input.value.trim() !== "" && isValidMoney(toNumber(input.value));
}

function toNumber(value) {
  const normalized = String(value ?? "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
}

function optionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  return toNumber(value);
}

function formatMoney(value) {
  return moneyFormatter.format(value || 0);
}

function openValueHtml() {
  return `<span class="open-value">Offen</span>`;
}

function formatOptionalMoneyHtml(value) {
  return value === null || value === undefined ? openValueHtml() : formatMoney(value);
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "Offen";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCompact(value) {
  return new Intl.NumberFormat("de-DE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.addEventListener("chartjs-ready", renderCharts);
