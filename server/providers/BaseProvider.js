/**
 * Data Provider — giao diện chung cho mọi nguồn dữ liệu.
 * Thay đổi/bổ sung nguồn chỉ cần viết provider mới, không phải sửa thuật toán đối chiếu.
 *
 * Mọi provider trả về kỳ quay đã chuẩn hóa:
 *   { id: '00944', drawNo: 944, date: 'YYYY-MM-DD', main: number[] (tăng dần), special: number|null, source }
 */
class ProviderError extends Error {
  constructor(message, { code = 'PROVIDER_ERROR', cause } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.code = code;
    if (cause) this.cause = cause;
  }
}

class BaseProvider {
  constructor(name) { this.name = name; }

  /** @returns {boolean} provider có hỗ trợ sản phẩm này không */
  supports(/* productId */) { return false; }

  /** Tải toàn bộ lịch sử (nếu nguồn hỗ trợ). @returns {Promise<{draws:object[], rejected:object[]}>} */
  async fetchAll(/* product */) { throw new ProviderError(`${this.name} không hỗ trợ tải toàn bộ`, { code: 'UNSUPPORTED' }); }

  /** Tải một kỳ quay. @returns {Promise<object|null>} null nếu kỳ không tồn tại */
  async fetchDraw(/* product, drawNo */) { throw new ProviderError(`${this.name} không hỗ trợ tải từng kỳ`, { code: 'UNSUPPORTED' }); }

  /** fetch có timeout, chuẩn hóa lỗi mạng */
  async request(url, init = {}, timeoutMs = 15000) {
    let res;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      const timeout = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
      throw new ProviderError(timeout ? `${this.name}: hết thời gian chờ (${timeoutMs}ms)` : `${this.name}: không kết nối được (${err.message})`,
        { code: timeout ? 'TIMEOUT' : 'NETWORK', cause: err });
    }
    if (!res.ok) throw new ProviderError(`${this.name}: HTTP ${res.status}`, { code: 'HTTP_' + res.status });
    return res;
  }
}

function toDrawId(n) { return String(n).padStart(5, '0'); }

module.exports = { BaseProvider, ProviderError, toDrawId };
