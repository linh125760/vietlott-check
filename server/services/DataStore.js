const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Bộ nhớ đệm kết quả trên đĩa (data/<product>.json) + trong RAM.
 * Ghi file nguyên tử (tmp → rename) để không hỏng cache khi tiến trình bị dừng giữa chừng.
 */
class DataStore {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
    fs.mkdirSync(dir, { recursive: true });
  }

  file(productId) { return path.join(this.dir, `${productId}.json`); }

  load(productId) {
    if (this.cache.has(productId)) return this.cache.get(productId);
    const f = this.file(productId);
    if (!fs.existsSync(f)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!Array.isArray(data.draws)) throw new Error('Thiếu draws');
      this.cache.set(productId, data);
      return data;
    } catch (err) {
      console.error(`[DataStore] Cache ${productId} hỏng, bỏ qua:`, err.message);
      return null;
    }
  }

  save(productId, draws, meta) {
    const sorted = draws.slice().sort((a, b) => a.drawNo - b.drawNo);
    const version = crypto.createHash('sha1')
      .update(sorted.map((d) => `${d.id}|${d.date}|${d.main.join(',')}|${d.special}`).join('\n'))
      .digest('hex').slice(0, 12);
    const data = {
      product: productId,
      meta: {
        ...meta,
        version,
        count: sorted.length,
        firstDraw: sorted[0] ? { id: sorted[0].id, date: sorted[0].date } : null,
        lastDraw: sorted.length ? { id: sorted[sorted.length - 1].id, date: sorted[sorted.length - 1].date } : null
      },
      draws: sorted
    };
    const f = this.file(productId);
    const tmp = f + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, f);
    this.cache.set(productId, data);
    return data;
  }
}

module.exports = DataStore;
