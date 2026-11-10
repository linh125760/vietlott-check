/* Web Worker: đối chiếu vé ngoài luồng giao diện. Dùng chung engine với server. */
// Đường dẫn tương đối theo vị trí worker → chạy được cả dưới /<repo>/ trên GitHub Pages
importScripts('../../shared/products.js', '../../shared/matchingEngine.js', '../../shared/statisticsEngine.js');

let store = { key: null, draws: [] };

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'load') { store = { key: msg.key, draws: msg.draws }; return; }
  if (msg.type !== 'check') return;
  try {
    if (store.key !== msg.key) throw new Error('Dữ liệu lịch sử chưa được nạp vào bộ xử lý.');
    const product = self.VLProducts.get(msg.productId);
    const draws = store.draws;
    const total = msg.tickets.length;
    const results = [];
    let lastPost = 0;
    for (let i = 0; i < total; i++) {
      results.push(self.VLMatchingEngine.checkTicket(product, msg.tickets[i], draws, msg.options));
      const now = Date.now();
      if (now - lastPost > 30 || i === total - 1) {
        self.postMessage({ id: msg.id, type: 'progress', done: i + 1, total });
        lastPost = now;
      }
    }
    const summary = self.VLStatisticsEngine.summarize(results, draws.length, product.draw.mainCount, msg.options.threshold);
    self.postMessage({ id: msg.id, type: 'result', payload: { results, summary } });
  } catch (err) {
    self.postMessage({ id: msg.id, type: 'error', message: err.message });
  }
};
