const path = require('path');
const express = require('express');
const DataStore = require('./services/DataStore');
const SyncService = require('./services/SyncService');
const GithubDatasetProvider = require('./providers/GithubDatasetProvider');
const VietlottOfficialProvider = require('./providers/VietlottOfficialProvider');
const createApi = require('./routes/api');
const Products = require('../shared/products');
const { productPayload, indexPayload } = require('./services/staticExport');

const ROOT = path.join(__dirname, '..');

function createServices({ dataDir = path.join(ROOT, 'data'), bulkProvider, drawProvider, logger } = {}) {
  const store = new DataStore(dataDir);
  const sync = new SyncService({
    store,
    bulkProvider: bulkProvider || new GithubDatasetProvider(),
    drawProvider: drawProvider || new VietlottOfficialProvider(),
    logger
  });
  return { store, sync };
}

function createApp(services) {
  const app = express();
  app.disable('x-powered-by');
  app.use('/api', createApi(services));
  // Cùng định dạng với bản build tĩnh (dist/data/*.json) để frontend chỉ có một luồng đọc dữ liệu
  app.get('/data/index.json', (req, res) => res.set('Cache-Control', 'no-cache').json(indexPayload(services.store)));
  app.get('/data/:product.json', (req, res) => {
    const p = Products.PRODUCTS[req.params.product];
    if (!p || !p.enabled) return res.status(404).json({ error: 'Không có dữ liệu cho sản phẩm này.' });
    services.sync.ensureFresh(p.id);
    const data = services.store.load(p.id);
    if (!data || !data.draws.length) return res.status(503).json({ error: 'Dữ liệu đang được tải lần đầu, vui lòng thử lại sau ít phút.' });
    res.set('Cache-Control', 'no-cache');
    res.json(productPayload(p.id, data));
  });
  app.use('/shared', express.static(path.join(ROOT, 'shared'), { maxAge: 0 }));
  app.use(express.static(path.join(ROOT, 'public'), { maxAge: 0 }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy API' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Lỗi máy chủ' });
  });
  return app;
}

module.exports = { createApp, createServices };
