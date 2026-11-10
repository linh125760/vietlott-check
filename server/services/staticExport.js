/**
 * Định dạng dữ liệu công khai cho frontend (dùng chung cho bản build tĩnh GitHub Pages
 * và route /data/*.json của server Express khi chạy trên máy).
 *
 *  data/index.json       → { generatedAt, products: { <id>: metaLite } }
 *  data/<product>.json   → { product, meta, draws: [[id, date, main[], special, source], ...] }
 */
const Products = require('../../shared/products');

function publicMeta(meta) {
  if (!meta) return null;
  const r = meta.report || {};
  return {
    version: meta.version,
    count: meta.count,
    firstDraw: meta.firstDraw,
    lastDraw: meta.lastDraw,
    lastSuccess: meta.lastSuccess,
    sourcesUsed: meta.sourcesUsed,
    officialReachable: r.official ? Boolean(r.official.reachable) : null,
    verification: r.verification || null,
    missing: r.missing || [],
    warnings: r.warnings || []
  };
}

function productPayload(productId, data) {
  return {
    product: productId,
    meta: publicMeta(data.meta),
    draws: data.draws.map((d) => [d.id, d.date, d.main, d.special ?? null, d.source])
  };
}

function indexPayload(store) {
  const products = {};
  for (const p of Products.list().filter((x) => x.enabled)) {
    const data = store.load(p.id);
    products[p.id] = data ? publicMeta(data.meta) : null;
  }
  return { generatedAt: new Date().toISOString(), products };
}

module.exports = { publicMeta, productPayload, indexPayload };
