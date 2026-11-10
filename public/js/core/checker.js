/**
 * Checker — chạy Matching Engine trong Web Worker (không chặn giao diện, báo tiến trình).
 * Lịch sử được gửi vào worker một lần cho mỗi phiên bản dữ liệu; các lần kiểm tra sau tái sử dụng.
 * Nếu trình duyệt không hỗ trợ Worker → chạy trực tiếp bằng cùng engine.
 */
let worker = null;
let loadedKey = null;
let seq = 0;

function getWorker() {
  if (worker || typeof Worker === 'undefined') return worker;
  try { worker = new Worker(new URL('../worker/match.worker.js', import.meta.url)); } catch { worker = null; }
  return worker;
}

export function runCheck({ product, version, draws, tickets, options, onProgress }) {
  const w = getWorker();
  if (!w) return Promise.resolve(runInline({ product, draws, tickets, options, onProgress }));
  const id = ++seq;
  const key = `${product.id}@${version}`;
  return new Promise((resolve, reject) => {
    const cleanup = () => { w.removeEventListener('message', onMessage); w.removeEventListener('error', onError); };
    const onMessage = (e) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === 'progress') { if (onProgress) onProgress(msg.done, msg.total); }
      else if (msg.type === 'result') { cleanup(); resolve(msg.payload); }
      else if (msg.type === 'error') { cleanup(); reject(new Error(msg.message)); }
    };
    const onError = (e) => {
      cleanup(); w.terminate(); worker = null; loadedKey = null;
      // Lỗi worker → chạy trực tiếp
      try { resolve(runInline({ product, draws, tickets, options, onProgress })); } catch (err) { reject(err); }
      e.preventDefault && e.preventDefault();
    };
    w.addEventListener('message', onMessage);
    w.addEventListener('error', onError);
    if (loadedKey !== key) { w.postMessage({ type: 'load', key, draws }); loadedKey = key; }
    w.postMessage({ type: 'check', id, key, productId: product.id, tickets, options });
  });
}

function runInline({ product, draws, tickets, options, onProgress }) {
  const results = tickets.map((t, i) => {
    const r = window.VLMatchingEngine.checkTicket(product, t, draws, options);
    if (onProgress) onProgress(i + 1, tickets.length);
    return r;
  });
  return { results, summary: window.VLStatisticsEngine.summarize(results, draws.length, product.draw.mainCount, options.threshold) };
}
