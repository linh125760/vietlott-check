/**
 * Data Service (client) — đọc dữ liệu tĩnh đã kiểm định:
 *   data/index.json        tóm tắt mọi sản phẩm (số kỳ, kỳ cuối, thời điểm cập nhật)
 *   data/<product>.json    toàn bộ lịch sử của một sản phẩm
 * Đường dẫn tương đối → chạy được cả trên GitHub Pages (/<repo>/) lẫn server Express.
 * Mỗi sản phẩm chỉ tải một lần và tái sử dụng; `cache: 'no-cache'` để trình duyệt hỏi lại
 * máy chủ (ETag/304) thay vì dùng bản cũ.
 */
const DATA_BASE = new URL('../../data/', import.meta.url);
const cache = new Map(); // productId → { meta, draws }

export class ApiError extends Error {
  constructor(message, { status } = {}) { super(message); this.status = status; }
}

async function getJson(file, timeoutMs = 20000) {
  let res;
  try {
    res = await fetch(new URL(file, DATA_BASE), { cache: 'no-cache', signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    throw new ApiError(err.name === 'TimeoutError' ? 'Tải dữ liệu quá lâu, vui lòng thử lại.' : 'Không tải được dữ liệu. Vui lòng kiểm tra kết nối mạng.', { status: 0 });
  }
  let body = null;
  try { body = await res.json(); } catch { /* bỏ qua */ }
  if (!res.ok || !body) throw new ApiError((body && body.error) || `Không tải được dữ liệu (HTTP ${res.status}).`, { status: res.status });
  return body;
}

/** Tóm tắt dữ liệu của mọi sản phẩm */
export async function loadIndex() {
  return getJson('index.json');
}

/**
 * @returns {Promise<{meta:object, draws:Array<{id,drawNo,date,main,special,source}>, fromCache:boolean, offline?:boolean}>}
 */
export async function loadDraws(productId, { force = false } = {}) {
  const cached = cache.get(productId);
  if (cached && !force) return { ...cached, fromCache: true };
  let body;
  try {
    body = await getJson(`${productId}.json`);
  } catch (err) {
    if (cached) return { ...cached, fromCache: true, offline: true }; // lỗi mạng → dùng bản đã tải
    throw err;
  }
  if (!Array.isArray(body.draws) || !body.meta) throw new ApiError('Tệp dữ liệu không đúng định dạng.');
  if (cached && cached.meta.version === body.meta.version) return { ...cached, fromCache: true };
  const draws = body.draws.map(([id, date, main, special, source]) => ({
    id, drawNo: parseInt(id, 10), date, main, special, source
  }));
  const entry = { meta: body.meta, draws };
  cache.set(productId, entry);
  return { ...entry, fromCache: false };
}
