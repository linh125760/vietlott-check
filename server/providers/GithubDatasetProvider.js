const { BaseProvider, ProviderError, toDrawId } = require('./BaseProvider');
const sources = require('../config/sources');

/**
 * Nguồn lịch sử hàng loạt: github.com/vietvudanh/vietlott-data (JSONL).
 * Định dạng dòng thực tế:
 *   Mega:  {"date":"2026-11-08","id":"01586","result":[1,2,14,20,23,36],...}
 *   Power: {"date":"2026-11-07","id":"01421","result":[5,19,20,26,44,53,39],...}  ← phần tử thứ 7 là số Power
 */
class GithubDatasetProvider extends BaseProvider {
  constructor(cfg = sources.github) {
    super('GitHub vietlott-data');
    this.cfg = cfg;
  }

  supports(productId) { return Boolean(this.cfg.files[productId]); }

  async fetchAll(product) {
    const file = this.cfg.files[product.id];
    if (!file) throw new ProviderError(`Không có dữ liệu GitHub cho ${product.name}`, { code: 'UNSUPPORTED' });
    const res = await this.request(this.cfg.baseUrl + file, {}, this.cfg.timeoutMs);
    const text = await res.text();
    const draws = [];
    const rejected = [];
    text.split(/\r?\n/).forEach((line, idx) => {
      if (!line.trim()) return;
      let row;
      try { row = JSON.parse(line); } catch { rejected.push({ line: idx + 1, reason: 'JSON lỗi' }); return; }
      const d = this.normalize(product, row);
      if (d) draws.push(d); else rejected.push({ line: idx + 1, id: row && row.id, reason: 'Sai cấu trúc' });
    });
    if (!draws.length) throw new ProviderError(`${this.name}: dữ liệu rỗng hoặc sai định dạng`, { code: 'BAD_DATA' });
    return { draws, rejected };
  }

  normalize(product, row) {
    if (!row || !Array.isArray(row.result) || !row.id) return null;
    const drawNo = parseInt(row.id, 10);
    if (!Number.isInteger(drawNo)) return null;
    const nums = row.result.map(Number);
    const mainCount = product.draw.mainCount;
    const main = nums.slice(0, mainCount).sort((a, b) => a - b);
    // Chỉ coi phần tử thứ 7 là số đặc biệt nếu sản phẩm có số đặc biệt. Không bao giờ gộp vào số chính.
    const special = product.draw.special ? (nums.length > mainCount ? nums[mainCount] : null) : (nums.length > mainCount ? NaN : null);
    return { id: toDrawId(drawNo), drawNo, date: String(row.date || ''), main, special, source: 'github' };
  }
}

module.exports = GithubDatasetProvider;
