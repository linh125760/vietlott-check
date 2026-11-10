const express = require('express');
const Products = require('../../shared/products');
const Validator = require('../../shared/ticketValidator');
const Engine = require('../../shared/matchingEngine');
const Stats = require('../../shared/statisticsEngine');

module.exports = function createApi({ store, sync }) {
  const router = express.Router();
  router.use(express.json({ limit: '200kb' }));

  const enabledProduct = (req, res) => {
    let p;
    try { p = Products.get(req.params.product || req.body.product); } catch (e) { res.status(404).json({ error: e.message }); return null; }
    if (!p.enabled) { res.status(400).json({ error: `${p.name} chưa được hỗ trợ đối chiếu.` }); return null; }
    return p;
  };

  router.get('/products', (req, res) => {
    res.json(Products.list().map((p) => ({ ...p, status: p.enabled ? sync.status(p.id) : null })));
  });

  router.get('/status', (req, res) => {
    res.json(Products.list().filter((p) => p.enabled).map((p) => sync.status(p.id)));
  });

  router.get('/status/:product', (req, res) => {
    const p = enabledProduct(req, res); if (!p) return;
    res.json(sync.status(p.id));
  });

  /** Toàn bộ lịch sử của một sản phẩm — client tải một lần và tái sử dụng (có ETag). */
  router.get('/draws/:product', (req, res) => {
    const p = enabledProduct(req, res); if (!p) return;
    sync.ensureFresh(p.id);
    const data = store.load(p.id);
    if (!data || !data.draws.length) {
      const st = sync.status(p.id);
      return res.status(503).json({
        error: st.sync.running ? 'Đang tải dữ liệu lần đầu, vui lòng chờ…' : (st.sync.error || 'Chưa có dữ liệu. Hãy bấm "Cập nhật dữ liệu".'),
        status: st
      });
    }
    const etag = `"${p.id}-${data.meta.version}"`;
    res.set('ETag', etag);
    res.set('Cache-Control', 'no-cache');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json({
      product: p.id,
      meta: data.meta,
      // dạng gọn: [id, date, main[], special]
      draws: data.draws.map((d) => [d.id, d.date, d.main, d.special ?? null, d.source])
    });
  });

  /** Kích hoạt cập nhật dữ liệu. Trả về ngay; client theo dõi qua /status. */
  router.post('/sync/:product', (req, res) => {
    const p = enabledProduct(req, res); if (!p) return;
    sync.sync(p.id).catch(() => { /* lỗi đã được ghi vào trạng thái */ });
    res.status(202).json(sync.status(p.id));
  });

  /** API đối chiếu phía server (cùng engine với client) — tiện cho tích hợp/kiểm thử. */
  router.post('/check', (req, res) => {
    const p = enabledProduct(req, res); if (!p) return;
    const data = store.load(p.id);
    if (!data) return res.status(503).json({ error: 'Chưa có dữ liệu lịch sử.' });
    const { tickets = [], threshold = 3, powerMode = 'main' } = req.body || {};
    if (!Array.isArray(tickets) || !tickets.length || tickets.length > 100) return res.status(400).json({ error: 'Cần 1–100 vé.' });
    const th = Number(threshold);
    if (!Number.isInteger(th) || th < 1 || th > p.draw.mainCount) return res.status(400).json({ error: 'Ngưỡng không hợp lệ.' });
    const normalized = [];
    for (let i = 0; i < tickets.length; i++) {
      const v = Validator.validate(p, tickets[i]);
      if (!v.ok) return res.status(400).json({ error: `Vé #${i + 1}: ${v.errors.join(' ')}` });
      normalized.push(v.ticket);
    }
    const results = normalized.map((t) => Engine.checkTicket(p, t, data.draws, { threshold: th, powerMode }));
    res.json({
      product: p.id,
      dataVersion: data.meta.version,
      summary: Stats.summarize(results, data.draws.length, p.draw.mainCount, th),
      tickets: results.map((r, i) => ({
        ticket: normalized[i],
        histogram: r.histogram,
        specialHits: r.specialHits,
        hits: r.hits.map(({ drawIndex, ...h }) => ({ ...h, draw: data.draws[drawIndex] }))
      }))
    });
  });

  return router;
};
