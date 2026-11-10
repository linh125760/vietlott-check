/**
 * Vietlott Checker — điều phối giao diện.
 * Kết nối: Product Configuration → Ticket Management → Data Service → Checker (Matching Engine)
 *          → Statistics Engine → UI Components.
 */
import { $, pad, toast, storage, fmtNum } from './utils/dom.js';
import * as Data from './core/dataService.js';
import { TicketManager } from './core/ticketManager.js';
import { runCheck } from './core/checker.js';
import { TicketEditor } from './components/ticketEditor.js';
import { renderTicketList } from './components/ticketList.js';
import { renderProductTabs } from './components/productTabs.js';
import { renderDataStatus } from './components/dataStatus.js';
import { renderSummary } from './components/summaryPanel.js';
import { renderCharts, bindChartTooltip } from './components/charts.js';
import { renderResults } from './components/resultsView.js';
import { openDrawModal, bindDrawModal } from './components/drawModal.js';

const Products = window.VLProducts;

const state = {
  products: Products.list(),
  product: null,
  meta: {},             // productId → tóm tắt dữ liệu (data/index.json)
  loading: false,
  data: {},             // productId → { meta, draws, offline }
  loadError: {},
  threshold: storage.get('vc.threshold', 3),
  powerMode: storage.get('vc.powerMode', 'main'),
  check: null,          // kết quả đối chiếu gần nhất
  checking: false
};

const tickets = new TicketManager();
const el = {
  tabs: $('#productTabs'), status: $('#dataStatus'), list: $('#ticketList'), count: $('#ticketCount'),
  range: $('#editorRange'), title: $('#editorTitle'), checkBtn: $('#checkBtn'), checkError: $('#checkError'),
  clearAll: $('#clearAllBtn'), thresholdOut: $('#thresholdValue'), stepper: $('#thresholdStepper'),
  powerField: $('#powerModeField'), powerHint: $('#powerModeHint'),
  empty: $('#emptyState'), progress: $('#progressCard'), progressText: $('#progressText'), progressBar: $('#progressBar'),
  content: $('#resultsContent'), summary: $('#summary'), charts: $('#charts'), results: $('#resultsView')
};

const editor = new TicketEditor($('#ticketEditor'), {
  onSubmit(ticket, editingId) {
    const pid = state.product.id;
    try {
      if (editingId) { tickets.update(pid, editingId, ticket); toast('Đã cập nhật dãy số.'); }
      else { tickets.add(pid, ticket); toast(`Đã thêm dãy số ${ticket.numbers.map(pad).join(' - ')}.`); }
      editor.clear();
      el.checkError.textContent = '';
    } catch (err) { toast(err.message, 'warn'); }
  },
  onReset() { clearResults(); el.checkError.textContent = ''; renderList(); },
  onCancelEdit() { renderList(); }
});

/* ===================== Product ===================== */
function selectProduct(id) {
  const p = Products.get(id);
  if (!p.enabled) return;
  state.product = p;
  storage.set('vc.product', id);
  renderProductTabs(el.tabs, state.products.map((x) => ({ ...x, meta: state.meta[x.id] })), id);
  document.documentElement.style.setProperty('--accent', p.accent);
  el.title.textContent = `Nhập dãy số ${p.name}`;
  el.range.textContent = `${p.pick.count} số · ${pad(p.pick.min)}–${pad(p.pick.max)}`;
  el.powerField.hidden = !p.draw.special;
  editor.setProduct(p);
  clampThreshold();
  renderList();
  clearResults();
  el.checkError.textContent = '';
  loadData(id);
}

/* ===================== Data ===================== */
// Bản tĩnh: dữ liệu do GitHub Actions cập nhật hằng ngày. Khi người dùng quay lại tab sau một lúc,
// kiểm tra index.json xem có kỳ mới không (rất nhẹ) rồi mới tải lại lịch sử.
const RECHECK_MS = 10 * 60 * 1000;
let lastIndexCheck = 0;

async function loadData(id, { force = false } = {}) {
  state.loading = true;
  renderStatus();
  try {
    const res = await Data.loadDraws(id, { force });
    const prev = state.data[id];
    state.data[id] = { meta: res.meta, draws: res.draws, offline: Boolean(res.offline) };
    state.meta[id] = res.meta;
    state.loadError[id] = null;
    if (prev && prev.meta.version !== res.meta.version) {
      toast(`Đã có dữ liệu mới ${Products.get(id).name}: đến kỳ #${res.meta.lastDraw.id}.`);
      if (state.check && state.check.productId === id) toast('Bấm KIỂM TRA KẾT QUẢ để đối chiếu lại với dữ liệu mới.', 'warn', 6000);
    }
  } catch (err) {
    state.loadError[id] = err.message;
    if (!state.data[id]) toast(err.message, 'error', 6000);
  } finally {
    state.loading = false;
    if (state.product && state.product.id === id) renderStatus();
  }
}

async function refreshIndex() {
  lastIndexCheck = Date.now();
  try {
    const idx = await Data.loadIndex();
    Object.assign(state.meta, idx.products || {});
    const id = state.product && state.product.id;
    const cur = id && state.data[id];
    if (cur && state.meta[id] && state.meta[id].version !== cur.meta.version) await loadData(id, { force: true });
    else if (state.product) renderStatus();
  } catch { /* index chỉ dùng để hiển thị và phát hiện kỳ mới; lỗi không ảnh hưởng đối chiếu */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - lastIndexCheck > RECHECK_MS) refreshIndex();
});

function renderStatus() {
  const id = state.product.id;
  const d = state.data[id];
  renderDataStatus(el.status, {
    product: state.product,
    meta: d ? d.meta : null,
    loading: state.loading,
    offline: d && d.offline,
    loadError: state.loadError[id]
  });
  renderProductTabs(el.tabs, state.products.map((x) => ({ ...x, meta: state.meta[x.id] })), id);
}

/* ===================== Tickets ===================== */
function renderList() {
  const list = tickets.list(state.product.id);
  renderTicketList(el.list, list, { editingId: editor.editingId, product: state.product });
  el.count.textContent = list.length;
  el.clearAll.disabled = !list.length;
}
tickets.addEventListener('change', renderList);

el.list.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('[data-id]').dataset.id;
  const pid = state.product.id;
  const t = tickets.get(pid, id);
  if (!t) return;
  if (btn.dataset.act === 'delete') {
    if (editor.editingId === id) editor.clear();
    tickets.remove(pid, id);
  } else if (btn.dataset.act === 'edit') {
    editor.edit(t);
    renderList();
  } else if (btn.dataset.act === 'check') {
    check([t]);
  }
});

el.clearAll.addEventListener('click', () => {
  const pid = state.product.id;
  const n = tickets.list(pid).length;
  if (!n) return;
  if (!confirm(`Xóa toàn bộ ${n} vé ${state.product.name} trong danh sách?`)) return;
  editor.clear();
  tickets.clear(pid);
  toast('Đã xóa toàn bộ danh sách vé.');
});

/* ===================== Options ===================== */
function clampThreshold() {
  const max = state.product.draw.mainCount;
  state.threshold = Math.min(Math.max(1, state.threshold), max);
  el.thresholdOut.textContent = state.threshold;
  el.stepper.querySelector('[data-step="-1"]').disabled = state.threshold <= 1;
  el.stepper.querySelector('[data-step="1"]').disabled = state.threshold >= max;
  document.querySelectorAll('[data-threshold-text]').forEach((n) => { n.textContent = state.threshold; });
}

el.stepper.addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  state.threshold += Number(b.dataset.step);
  clampThreshold();
  storage.set('vc.threshold', state.threshold);
  if (state.check) check(state.check.tickets, { keepFilters: true });
});

function syncPowerModeUI() {
  document.querySelectorAll('input[name="powerMode"]').forEach((r) => { r.checked = r.value === state.powerMode; });
  el.powerHint.textContent = state.powerMode === 'rules'
    ? 'Số lượng trùng vẫn chỉ tính 6 số chính. Số Power được báo riêng: so với ô Số Power nếu bạn nhập, nếu không thì so với 6 số trên vé (đúng thể lệ).'
    : 'Chỉ so 6 số chính của vé với 6 số chính của kỳ quay. Số Power đặc biệt không được tính.';
}
document.querySelectorAll('input[name="powerMode"]').forEach((r) => r.addEventListener('change', () => {
  state.powerMode = r.value;
  storage.set('vc.powerMode', state.powerMode);
  syncPowerModeUI();
  if (state.check && state.product.draw.special) check(state.check.tickets, { keepFilters: true });
}));

/* ===================== Check ===================== */
el.checkBtn.addEventListener('click', () => {
  const list = tickets.list(state.product.id);
  if (list.length) {
    // Nếu ô nhập đang có một vé hợp lệ chưa thêm, nhắc người dùng
    if (!editor.isEmpty() && !editor.editingId && editor.peekValid()) toast('Dãy số trong ô nhập chưa được thêm vào danh sách nên không được kiểm tra.', 'warn', 5000);
    return check(list);
  }
  if (editor.isEmpty()) { el.checkError.textContent = 'Hãy nhập ít nhất một dãy số.'; return; }
  const v = editor.validate();
  if (!v.ok) { editor.submit(); el.checkError.textContent = 'Dãy số chưa hợp lệ, vui lòng kiểm tra lại.'; return; }
  check([{ id: 'editor', ...v.ticket }]);
});

async function check(ticketList, { keepFilters = false } = {}) {
  if (state.checking) return;
  const p = state.product;
  const data = state.data[p.id];
  el.checkError.textContent = '';
  if (!data || !data.draws.length) {
    el.checkError.textContent = state.loadError[p.id] || 'Dữ liệu lịch sử chưa tải xong, vui lòng chờ trong giây lát.';
    return;
  }
  // Kiểm tra lại từng vé trước khi đối chiếu
  for (let i = 0; i < ticketList.length; i++) {
    const v = window.VLTicketValidator.validate(p, ticketList[i]);
    if (!v.ok) { el.checkError.textContent = `Vé ${i + 1} không hợp lệ: ${v.errors.join(' ')}`; return; }
  }
  const norm = ticketList.map((t) => ({ id: t.id, numbers: t.numbers.slice().sort((a, b) => a - b), special: t.special ?? null }));
  const options = { threshold: state.threshold, powerMode: p.draw.special ? state.powerMode : 'main' };

  state.checking = true;
  el.checkBtn.disabled = true;
  el.empty.hidden = true;
  el.progress.hidden = false;
  el.progressBar.style.width = '0%';
  el.progressText.textContent = `Đang đối chiếu ${norm.length} vé với ${fmtNum(data.draws.length)} kỳ quay…`;
  const started = performance.now();
  try {
    const { results, summary } = await runCheck({
      product: p, version: data.meta.version, draws: data.draws, tickets: norm, options,
      onProgress: (done, total) => {
        el.progressBar.style.width = `${Math.round((done / total) * 100)}%`;
        el.progressText.textContent = `Đang đối chiếu vé ${done}/${total} với ${fmtNum(data.draws.length)} kỳ quay…`;
      }
    });
    const elapsed = performance.now() - started;
    if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed)); // để hiệu ứng tải không nhấp nháy
    const allHits = [];
    results.forEach((r, ti) => r.hits.forEach((h) => allHits.push({ ...h, ticketIndex: ti, key: `${ti}:${h.drawIndex}` })));
    const prevFilters = keepFilters && state.check ? state.check.filters : null;
    state.check = {
      productId: p.id, tickets: norm, results, summary, allHits, options,
      draws: data.draws, version: data.meta.version,
      freqTicket: 0,
      filters: prevFilters ? { ...prevFilters, counts: new Set([...prevFilters.counts].filter((k) => k >= options.threshold)), page: 1 }
        : { ticket: 'all', counts: new Set(), dateFrom: '', dateTo: '', sort: 'matches-desc', page: 1, specialOnly: false }
    };
    if (state.check.filters.ticket !== 'all' && state.check.filters.ticket >= norm.length) state.check.filters.ticket = 'all';
    renderCheck();
    if (!keepFilters) el.content.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    el.checkError.textContent = `Lỗi khi đối chiếu: ${err.message}`;
    el.empty.hidden = Boolean(state.check);
  } finally {
    state.checking = false;
    el.checkBtn.disabled = false;
    el.progress.hidden = true;
  }
}

function renderCheck() {
  const c = state.check;
  if (!c) return;
  const p = Products.get(c.productId);
  const f = c.filters;
  const scoped = f.ticket === 'all' ? c.results : [c.results[f.ticket]];
  const summary = window.VLStatisticsEngine.summarize(scoped, c.draws.length, p.draw.mainCount, c.options.threshold);
  const scopeLabel = f.ticket === 'all' ? (c.tickets.length > 1 ? `${c.tickets.length} vé` : '1 vé') : `Vé ${f.ticket + 1}`;
  const unit = scoped.length > 1 ? 'lượt' : 'kỳ';
  el.empty.hidden = true;
  el.content.hidden = false;
  renderSummary(el.summary, { summary, product: p, draws: c.draws, powerMode: c.options.powerMode, scopeLabel, activeCounts: f.counts });
  const scopedHits = f.ticket === 'all' ? c.allHits : c.allHits.filter((h) => h.ticketIndex === f.ticket);
  renderCharts(el.charts, {
    results: scoped, tickets: c.tickets, product: p, draws: c.draws, threshold: c.options.threshold,
    freqTicket: f.ticket === 'all' ? c.freqTicket : f.ticket, allHits: scopedHits, unit
  });
  renderResults(el.results, { allHits: c.allHits, filters: f, product: p, draws: c.draws, tickets: c.tickets, threshold: c.options.threshold, powerMode: c.options.powerMode });
}

function clearResults() {
  state.check = null;
  el.content.hidden = true;
  el.empty.hidden = false;
}

/* ----- Tương tác trong khu vực kết quả (event delegation) ----- */
function openHit(key) {
  const c = state.check;
  const hit = c && c.allHits.find((h) => h.key === key);
  if (!hit) return;
  openDrawModal({ hit, product: Products.get(c.productId), draws: c.draws, tickets: c.tickets, powerMode: c.options.powerMode });
}

$('#resultsContent').addEventListener('click', (e) => {
  const c = state.check;
  if (!c) return;
  const f = c.filters;
  const t = e.target;
  const open = t.closest('[data-open-hit]');
  if (open) return openHit(open.dataset.openHit);
  const chip = t.closest('[data-count]');
  const stat = t.closest('[data-filter-count]');
  if (chip || stat) {
    const k = Number((chip || stat).dataset.count || (chip || stat).dataset.filterCount);
    if (f.counts.has(k)) f.counts.delete(k); else f.counts.add(k);
    f.page = 1;
    renderCheck();
    if (stat) $('#resultsView').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (t.closest('[data-special-only]')) { f.specialOnly = !f.specialOnly; f.page = 1; return renderCheck(); }
  if (t.closest('[data-reset-filters]')) {
    Object.assign(f, { ticket: 'all', counts: new Set(), dateFrom: '', dateTo: '', page: 1, specialOnly: false });
    return renderCheck();
  }
  const pageBtn = t.closest('[data-page]');
  if (pageBtn && !pageBtn.disabled) {
    f.page = Number(pageBtn.dataset.page);
    renderCheck();
    $('#resultsView').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const tbl = t.closest('[data-toggle-table]');
  if (tbl) {
    const table = el.charts.querySelector(`[data-table="${tbl.dataset.toggleTable}"]`);
    table.hidden = !table.hidden;
    tbl.textContent = table.hidden ? 'Xem bảng' : 'Ẩn bảng';
  }
});

$('#resultsContent').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[data-open-hit], [data-filter-count]');
  if (target && target.tagName !== 'BUTTON') { e.preventDefault(); target.click(); }
});

$('#resultsContent').addEventListener('change', (e) => {
  const c = state.check;
  if (!c) return;
  const f = c.filters;
  const t = e.target;
  if (t.matches('[data-freq-ticket]')) { c.freqTicket = Number(t.value); return renderCheck(); }
  const key = t.dataset.f;
  if (!key) return;
  if (key === 'ticket') f.ticket = t.value === 'all' ? 'all' : Number(t.value);
  else f[key] = t.value;
  if (f.dateFrom && f.dateTo && f.dateFrom > f.dateTo) { toast('“Từ ngày” phải trước “Đến ngày”.', 'warn'); }
  f.page = 1;
  renderCheck();
});

el.tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-product]');
  if (!b || b.disabled || (state.product && b.dataset.product === state.product.id)) return;
  selectProduct(b.dataset.product);
});

/* ===================== Init ===================== */
bindDrawModal();
bindChartTooltip(el.charts, $('#chartTooltip'));
syncPowerModeUI();
const saved = storage.get('vc.product', 'mega645');
selectProduct(Products.PRODUCTS[saved] && Products.PRODUCTS[saved].enabled ? saved : 'mega645');
// Tóm tắt dữ liệu mọi sản phẩm (số kỳ trên card, phát hiện kỳ mới)
refreshIndex();
