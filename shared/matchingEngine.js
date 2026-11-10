/**
 * Result Matching Engine — đối chiếu vé với lịch sử kết quả.
 *
 * Mỗi thể lệ có một matcher riêng (đăng ký trong MATCHERS). Không dùng chung thuật toán
 * cho các sản phẩm có thể lệ khác nhau.
 *
 * Kỳ quay chuẩn hóa: { id: '01421', drawNo: 1421, date: 'YYYY-MM-DD', main: number[], special: number|null }
 * Vé chuẩn hóa:      { numbers: number[], special: number|null }
 *
 * Quy tắc chung:
 *  - Chỉ đếm số chính trùng (mỗi số trong vé tối đa 1 lần — vé và kết quả đều không có số lặp).
 *  - Số đặc biệt (Power) KHÔNG bao giờ được cộng vào số lượng số chính trùng.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VLMatchingEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const POWER_MODES = {
    MAIN_ONLY: 'main',  // chỉ đối chiếu 6 số chính
    RULES: 'rules'      // đối chiếu thêm số Power đặc biệt theo thể lệ
  };

  function buildLookup(numbers, max) {
    const lookup = new Uint8Array(max + 2);
    for (const n of numbers) lookup[n] = 1;
    return lookup;
  }

  /** Đếm số chính trùng giữa vé và kết quả (dùng chung cho các matcher dạng lotto). */
  function countMain(lookup, drawMain) {
    const matched = [];
    for (let i = 0; i < drawMain.length; i++) {
      const n = drawMain[i];
      if (lookup[n] === 1) matched.push(n);
    }
    return matched;
  }

  const MATCHERS = {
    /** Mega 6/45: chỉ có 6 số chính. */
    'lotto-main': {
      prepare(product, ticket) {
        return { lookup: buildLookup(ticket.numbers, product.draw.max) };
      },
      match(ctx, draw) {
        const matched = countMain(ctx.lookup, draw.main);
        return { mainCount: matched.length, matched, special: null };
      }
    },

    /**
     * Power 6/55: 6 số chính + 1 số Power đặc biệt.
     *  - mode 'main' : bỏ qua số Power.
     *  - mode 'rules': theo thể lệ, số Power được so với các số của vé. Nếu người dùng nhập
     *    riêng "Số Power" (ô thứ 7) thì số đặc biệt được so với ô đó thay cho 6 số của vé.
     *    Kết quả Power được báo cáo riêng, không cộng vào số lượng số chính trùng.
     */
    'lotto-power': {
      prepare(product, ticket, options) {
        return {
          lookup: buildLookup(ticket.numbers, product.draw.max),
          mode: options.powerMode === POWER_MODES.RULES ? POWER_MODES.RULES : POWER_MODES.MAIN_ONLY,
          userSpecial: ticket.special == null ? null : ticket.special
        };
      },
      match(ctx, draw) {
        const matched = countMain(ctx.lookup, draw.main);
        let special = null;
        if (ctx.mode === POWER_MODES.RULES && draw.special != null) {
          const source = ctx.userSpecial != null ? 'userSpecial' : 'ticket';
          const hit = source === 'userSpecial' ? ctx.userSpecial === draw.special : ctx.lookup[draw.special] === 1;
          special = { number: draw.special, matched: hit, source };
        }
        return { mainCount: matched.length, matched, special };
      }
    }
    // 'keno-spots', 'digits-exact', 'digits-pair', 'dice-sum' — sẽ được bổ sung theo thể lệ riêng.
  };

  function getMatcher(product) {
    const m = MATCHERS[product.matcher];
    if (!m || !product.enabled) throw new Error(`Chưa hỗ trợ đối chiếu cho ${product.name}.`);
    return m;
  }

  /**
   * Đối chiếu một vé với toàn bộ lịch sử.
   * @returns {{histogram:number[], hits:object[], specialHits:number, totalDraws:number}}
   *   hits: các kỳ có mainCount >= threshold (chưa sắp xếp)
   */
  function checkTicket(product, ticket, draws, options) {
    const opts = Object.assign({ threshold: 3, powerMode: POWER_MODES.MAIN_ONLY }, options);
    const matcher = getMatcher(product);
    const ctx = matcher.prepare(product, ticket, opts);
    const histogram = new Array(product.draw.mainCount + 1).fill(0);
    const hits = [];
    let specialHits = 0;
    for (let i = 0; i < draws.length; i++) {
      const draw = draws[i];
      const r = matcher.match(ctx, draw);
      histogram[r.mainCount]++;
      if (r.special && r.special.matched) specialHits++;
      if (r.mainCount >= opts.threshold) {
        hits.push({
          drawIndex: i,
          drawId: draw.id,
          drawNo: draw.drawNo,
          date: draw.date,
          mainCount: r.mainCount,
          matched: r.matched.slice().sort((a, b) => a - b),
          special: r.special
        });
      }
    }
    return { histogram, hits: sortHits(hits, 'matches-desc'), specialHits, totalDraws: draws.length };
  }

  /**
   * Sắp xếp kết quả.
   *  - 'matches-desc' (mặc định): nhiều số trùng trước; bằng nhau → ngày quay mới nhất trước.
   *  - 'matches-asc' : ít số trùng trước; bằng nhau → ngày quay mới nhất trước.
   *  - 'date-desc' / 'date-asc': theo ngày; cùng ngày → nhiều số trùng trước.
   */
  function sortHits(hits, order) {
    const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.drawNo - a.drawNo);
    const cmp = {
      'matches-desc': (a, b) => b.mainCount - a.mainCount || byDateDesc(a, b),
      'matches-asc': (a, b) => a.mainCount - b.mainCount || byDateDesc(a, b),
      'date-desc': (a, b) => byDateDesc(a, b) || b.mainCount - a.mainCount,
      'date-asc': (a, b) => -byDateDesc(a, b) || b.mainCount - a.mainCount
    }[order || 'matches-desc'];
    if (!cmp) throw new Error('Kiểu sắp xếp không hợp lệ: ' + order);
    return hits.slice().sort(cmp);
  }

  return { POWER_MODES, MATCHERS, checkTicket, sortHits };
});
