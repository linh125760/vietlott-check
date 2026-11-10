const Products = require('../../shared/products');
const { validateDraw, findDateAnomalies } = require('./drawValidator');
const sources = require('../config/sources');

/**
 * Điều phối đồng bộ dữ liệu từ nhiều provider:
 *  1. Tải lịch sử hàng loạt (bulk provider – GitHub).
 *  2. Kiểm định từng bản ghi; bản ghi lỗi / ngày bất thường / kỳ bị thiếu → lấy lại từ nguồn chính thức.
 *  3. Thăm dò các kỳ mới hơn bản ghi cuối từ nguồn chính thức.
 *  4. Kiểm tra chéo ngẫu nhiên một số kỳ với nguồn chính thức.
 *  5. Lưu cache. Nếu mọi nguồn lỗi → giữ nguyên cache cũ, báo lỗi rõ ràng (không tạo dữ liệu giả).
 */
class SyncService {
  constructor({ store, bulkProvider, drawProvider, config = sources.sync, logger = console }) {
    this.store = store;
    this.bulk = bulkProvider;
    this.official = drawProvider;
    this.cfg = config;
    this.log = logger;
    this.states = new Map();
    this.running = new Map();
  }

  state(productId) {
    if (!this.states.has(productId)) this.states.set(productId, { running: false, phase: 'idle', done: 0, total: 0, message: '', error: null });
    return this.states.get(productId);
  }

  status(productId) {
    const s = this.state(productId);
    const data = this.store.load(productId);
    return { product: productId, sync: { ...s }, meta: data ? data.meta : null, hasData: Boolean(data && data.draws.length) };
  }

  isStale(productId) {
    const data = this.store.load(productId);
    if (!data || !data.draws.length) return true;
    const last = Date.parse(data.meta && data.meta.lastSuccess);
    return !last || Date.now() - last > this.cfg.staleAfterMs;
  }

  /** Bắt đầu đồng bộ nếu dữ liệu cũ; không chặn. */
  ensureFresh(productId) {
    if (this.isStale(productId) && !this.running.has(productId)) {
      this.sync(productId).catch((err) => this.log.error(`[sync:${productId}]`, err.message));
    }
  }

  sync(productId) {
    if (this.running.has(productId)) return this.running.get(productId);
    const p = this._sync(productId).finally(() => this.running.delete(productId));
    this.running.set(productId, p);
    return p;
  }

  async _sync(productId) {
    const product = Products.get(productId);
    if (!product.enabled) throw new Error(`${product.name} chưa được hỗ trợ.`);
    const st = this.state(productId);
    Object.assign(st, { running: true, phase: 'bulk', done: 0, total: 0, message: 'Đang tải lịch sử…', error: null, startedAt: new Date().toISOString() });

    const prev = this.store.load(productId);
    const map = new Map();
    if (prev) for (const d of prev.draws) if (!validateDraw(product, d).length) map.set(d.drawNo, d);

    const report = {
      bulk: { provider: this.bulk.name, ok: false, received: 0, rejected: 0, error: null },
      official: { provider: this.official.name, reachable: false, fetched: 0, notFound: 0, failed: 0, errors: [] },
      corrections: [],
      verification: { checked: 0, mismatches: 0 },
      missing: [],
      warnings: []
    };
    const toFetch = new Map(); // drawNo → lý do

    try {
      // ---------- 1. Bulk ----------
      try {
        const { draws, rejected } = await this.bulk.fetchAll(product);
        report.bulk.ok = true;
        report.bulk.received = draws.length;
        report.bulk.rejected = rejected.length;
        for (const d of draws) {
          const existing = map.get(d.drawNo);
          if (existing && existing.source === 'vietlott') continue; // bản ghi chính thức luôn được ưu tiên
          const errs = validateDraw(product, d);
          if (errs.length) {
            toFetch.set(d.drawNo, `Bản ghi ${d.id} từ ${this.bulk.name} lỗi: ${errs.join(', ')}`);
            if (!existing) map.delete(d.drawNo);
            continue;
          }
          map.set(d.drawNo, d);
        }
      } catch (err) {
        report.bulk.error = err.message;
        report.warnings.push(`Không tải được ${this.bulk.name}: ${err.message}`);
        this.log.warn(`[sync:${productId}] bulk lỗi:`, err.message);
      }

      // ---------- 2. Ngày bất thường & kỳ thiếu ----------
      const sorted = [...map.values()].sort((a, b) => a.drawNo - b.drawNo);
      for (const no of findDateAnomalies(sorted)) {
        const d = map.get(no);
        if (d && d.source !== 'vietlott') toFetch.set(no, `Ngày quay kỳ ${d.id} bất thường (${d.date})`);
      }
      const maxNo = sorted.length ? sorted[sorted.length - 1].drawNo : 0;
      for (let n = 1; n <= maxNo; n++) if (!map.has(n) && !toFetch.has(n)) toFetch.set(n, `Thiếu kỳ ${String(n).padStart(5, '0')}`);

      // ---------- 3. Lấy lại từ nguồn chính thức ----------
      const queue = [...toFetch.keys()].sort((a, b) => b - a).slice(0, this.cfg.maxOfficialFetchPerSync);
      if (toFetch.size > queue.length) report.warnings.push(`Còn ${toFetch.size - queue.length} kỳ sẽ được bổ sung ở lần cập nhật sau.`);
      Object.assign(st, { phase: 'official', done: 0, total: queue.length, message: `Đang bổ sung/kiểm định ${queue.length} kỳ từ ${this.official.name}…` });
      await this.pool(queue, sources.official.concurrency, async (no) => {
        try {
          const d = await this.official.fetchDraw(product, no);
          report.official.reachable = true;
          if (!d) { report.official.notFound++; if (!map.has(no)) report.missing.push(no); return; }
          const errs = validateDraw(product, d);
          if (errs.length) throw new Error(`kỳ ${d.id} không hợp lệ: ${errs.join(', ')}`);
          const old = map.get(no);
          if (old && !sameDraw(old, d)) report.corrections.push({ id: d.id, reason: toFetch.get(no), before: brief(old), after: brief(d) });
          else if (!old) report.corrections.push({ id: d.id, reason: toFetch.get(no), before: null, after: brief(d) });
          map.set(no, d);
          report.official.fetched++;
        } catch (err) {
          report.official.failed++;
          if (report.official.errors.length < 5) report.official.errors.push(err.message);
          if (!map.has(no)) report.missing.push(no);
        } finally { st.done++; }
      });

      // ---------- 4. Thăm dò kỳ mới ----------
      Object.assign(st, { phase: 'latest', message: 'Đang kiểm tra kỳ quay mới nhất…' });
      let next = Math.max(0, ...map.keys()) + 1;
      for (let i = 0; i < this.cfg.probeNewDraws; i++, next++) {
        try {
          const d = await this.official.fetchDraw(product, next);
          report.official.reachable = true;
          if (!d || validateDraw(product, d).length) break;
          map.set(next, d);
          report.official.fetched++;
        } catch (err) {
          report.warnings.push(`Không kiểm tra được kỳ mới từ ${this.official.name}: ${err.message}`);
          break;
        }
      }

      // ---------- 5. Kiểm tra chéo ngẫu nhiên ----------
      Object.assign(st, { phase: 'verify', message: 'Đang kiểm tra chéo với nguồn chính thức…' });
      const candidates = [...map.values()].filter((d) => d.source !== 'vietlott');
      const sample = pickSample(candidates, this.cfg.verifySample);
      await this.pool(sample, 3, async (d) => {
        try {
          const o = await this.official.fetchDraw(product, d.drawNo);
          report.official.reachable = true;
          if (!o || validateDraw(product, o).length) return;
          report.verification.checked++;
          if (!sameDraw(d, o)) {
            report.verification.mismatches++;
            report.corrections.push({ id: o.id, reason: 'Kiểm tra chéo phát hiện sai lệch', before: brief(d), after: brief(o) });
          }
          map.set(o.drawNo, o);
        } catch { /* bỏ qua: kiểm tra chéo không bắt buộc */ }
      });
      if (report.verification.mismatches) report.warnings.push(`Kiểm tra chéo phát hiện ${report.verification.mismatches}/${report.verification.checked} kỳ sai lệch ở ${this.bulk.name} (đã sửa theo nguồn chính thức).`);

      // ---------- 6. Lưu ----------
      const finalDraws = [...map.values()].filter((d) => !validateDraw(product, d).length);
      if (!finalDraws.length) {
        throw new Error('Không lấy được dữ liệu từ bất kỳ nguồn nào. Vui lòng kiểm tra kết nối mạng và thử lại.');
      }
      if (!report.bulk.ok && !report.official.reachable && prev) {
        throw new Error(`Mất kết nối tới các nguồn dữ liệu. Đang dùng dữ liệu đã lưu (cập nhật ${prev.meta.lastSuccess}).`);
      }
      report.missing = [...new Set(report.missing)].sort((a, b) => a - b).map((n) => String(n).padStart(5, '0'));
      const now = new Date().toISOString();
      const saved = this.store.save(productId, finalDraws, {
        lastSync: now,
        lastSuccess: now,
        sourcesUsed: summarizeSources(finalDraws),
        report: {
          ...report,
          corrections: report.corrections.slice(-50),
          totalCorrections: report.corrections.length
        }
      });
      Object.assign(st, { running: false, phase: 'done', message: `Đã cập nhật ${saved.meta.count} kỳ quay.`, finishedAt: now });
      this.log.info(`[sync:${productId}] ${saved.meta.count} kỳ, sửa ${report.corrections.length}, thiếu ${report.missing.length}`);
      return saved;
    } catch (err) {
      Object.assign(st, { running: false, phase: 'error', message: err.message, error: err.message, finishedAt: new Date().toISOString() });
      throw err;
    }
  }

  async pool(items, size, worker) {
    let i = 0;
    const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) { const item = items[i++]; await worker(item); }
    });
    await Promise.all(runners);
  }
}

function sameDraw(a, b) {
  return a.date === b.date && a.main.join(',') === b.main.join(',') && (a.special ?? null) === (b.special ?? null);
}
function brief(d) { return { date: d.date, main: d.main, special: d.special }; }
function pickSample(arr, n) {
  if (!arr.length || n <= 0) return [];
  const sorted = arr.slice().sort((a, b) => b.drawNo - a.drawNo);
  const out = sorted.slice(0, 2); // luôn kiểm tra 2 kỳ mới nhất
  const rest = sorted.slice(2);
  while (out.length < n && rest.length) out.push(rest.splice(Math.floor(Math.random() * rest.length), 1)[0]);
  return out;
}
function summarizeSources(draws) {
  const s = {};
  for (const d of draws) s[d.source] = (s[d.source] || 0) + 1;
  return s;
}

module.exports = SyncService;
