const { BaseProvider, ProviderError, toDrawId } = require('./BaseProvider');
const sources = require('../config/sources');

/**
 * Nguồn chính thức: vietlott.vn (endpoint AjaxPro mà trang kết quả sử dụng).
 * Trả về HTML từng kỳ, ví dụ:
 *   <h5>Kỳ quay thưởng <b>#00944</b> ngày <b>14/10/2023</b></h5>
 *   <div class="day_so_ket_qua_v2"><span class="bong_tron small">08</span>…<i>|</i>
 *        <span class="bong_tron small no-margin-right active">10</span></div>
 * Kỳ không tồn tại → {"value":{"Error":true,...}}
 */
class VietlottOfficialProvider extends BaseProvider {
  constructor(cfg = sources.official) {
    super('vietlott.vn');
    this.cfg = cfg;
    this.renderInfo = null;
    this.renderInfoAt = 0;
  }

  supports(productId) { return Boolean(this.cfg.games[productId]); }

  async ajax(path, method, body) {
    const res = await this.request(this.cfg.baseUrl + path, {
      method: 'POST',
      headers: {
        'X-AjaxPro-Method': method,
        'Content-Type': 'text/plain; charset=utf-8',
        'User-Agent': 'Mozilla/5.0 (compatible; VietlottChecker/1.0)'
      },
      body: JSON.stringify(body)
    }, this.cfg.timeoutMs);
    const text = await res.text();
    try { return JSON.parse(text); } catch {
      throw new ProviderError(`${this.name}: phản hồi không phải JSON`, { code: 'BAD_DATA' });
    }
  }

  async getRenderInfo() {
    if (this.renderInfo && Date.now() - this.renderInfoAt < 30 * 60 * 1000) return this.renderInfo;
    const json = await this.ajax(this.cfg.renderInfoPath, 'ServerSideFrontEndCreateRenderInfo', { SiteId: this.cfg.siteId });
    if (!json || !json.value) throw new ProviderError(`${this.name}: không lấy được RenderInfo`, { code: 'BAD_DATA' });
    this.renderInfo = json.value;
    this.renderInfoAt = Date.now();
    return this.renderInfo;
  }

  async fetchDraw(product, drawNo) {
    const game = this.cfg.games[product.id];
    if (!game) throw new ProviderError(`${this.name} không hỗ trợ ${product.name}`, { code: 'UNSUPPORTED' });
    const id = toDrawId(drawNo);
    // Đã bị từ chối truy cập (403/401) → không gửi thêm request trong một khoảng thời gian.
    // Tôn trọng việc chặn: không giả danh trình duyệt để vượt qua.
    if (this.blockedUntil && Date.now() < this.blockedUntil) {
      throw new ProviderError(`${this.name}: đã từ chối truy cập (${this.blockedReason}), tạm dừng gọi nguồn này`, { code: 'BLOCKED' });
    }
    let lastErr;
    for (let attempt = 0; attempt <= this.cfg.retries; attempt++) {
      try {
        const renderInfo = await this.getRenderInfo();
        const json = await this.ajax(
          `/ajaxpro/Vietlott.PlugIn.WebParts.${game.webPart},Vietlott.PlugIn.WebParts.ashx`,
          'ServerSideDrawResult',
          { ORenderInfo: renderInfo, Key: game.key, DrawId: id }
        );
        const v = json && json.value;
        if (!v) throw new ProviderError(`${this.name}: phản hồi rỗng`, { code: 'BAD_DATA' });
        if (v.Error) return null; // kỳ chưa/không tồn tại
        const parsed = this.parse(product, v.RetExtraParam1 || '');
        if (!parsed) throw new ProviderError(`${this.name}: không đọc được kết quả kỳ ${id}`, { code: 'PARSE' });
        if (parsed.drawNo !== drawNo) throw new ProviderError(`${this.name}: trả về kỳ ${parsed.id} thay vì ${id}`, { code: 'MISMATCH' });
        return parsed;
      } catch (err) {
        lastErr = err;
        if (err.code === 'HTTP_403' || err.code === 'HTTP_401') {
          this.blockedUntil = Date.now() + 30 * 60 * 1000;
          this.blockedReason = err.code.replace('HTTP_', 'HTTP ');
          break;
        }
        if (err.code === 'PARSE' || err.code === 'MISMATCH') break;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    throw lastErr;
  }

  parse(product, html) {
    const head = html.match(/#(\d{1,6})<\/b>\s*ngày\s*<b>(\d{2})\/(\d{2})\/(\d{4})/);
    if (!head) return null;
    const blockStart = html.indexOf('day_so_ket_qua_v2');
    if (blockStart < 0) return null;
    const block = html.slice(blockStart, html.indexOf('</div>', blockStart));
    const [mainPart, specialPart] = block.split(/<i>\s*\|\s*<\/i>/);
    const nums = (s) => [...(s || '').matchAll(/<span[^>]*bong_tron[^>]*>\s*(\d{1,2})\s*<\/span>/g)].map((m) => parseInt(m[1], 10));
    const main = nums(mainPart).sort((a, b) => a - b);
    const specials = nums(specialPart);
    const drawNo = parseInt(head[1], 10);
    return {
      id: toDrawId(drawNo),
      drawNo,
      date: `${head[4]}-${head[3]}-${head[2]}`,
      main,
      special: product.draw.special ? (specials.length === 1 ? specials[0] : null) : (specials.length ? NaN : null),
      source: 'vietlott'
    };
  }
}

module.exports = VietlottOfficialProvider;
