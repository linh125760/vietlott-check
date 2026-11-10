/**
 * Statistics Engine — tổng hợp thống kê từ kết quả đối chiếu.
 * Tách biệt khỏi Matching Engine: chỉ đọc kết quả, không đối chiếu lại.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VLStatisticsEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * @param {Array<{histogram:number[], hits:object[], specialHits:number}>} ticketResults
   * @param {number} totalDraws số kỳ quay đã kiểm tra
   * @param {number} mainCount số lượng số chính của một kỳ (6)
   * @param {number} threshold ngưỡng hiển thị
   */
  function summarize(ticketResults, totalDraws, mainCount, threshold) {
    const histogram = new Array(mainCount + 1).fill(0);
    let totalHits = 0;
    let specialHits = 0;
    let fivePlusSpecial = 0;
    const drawsWithHit = new Set();
    for (const r of ticketResults) {
      r.histogram.forEach((v, k) => { histogram[k] += v; });
      totalHits += r.hits.length;
      specialHits += r.specialHits || 0;
      for (const h of r.hits) {
        drawsWithHit.add(h.drawId);
        if (h.mainCount === mainCount - 1 && h.special && h.special.matched) fivePlusSpecial++;
      }
    }
    const byCount = {};
    for (let k = 3; k <= mainCount; k++) byCount[k] = histogram[k];
    return {
      totalDraws,
      ticketCount: ticketResults.length,
      comparisons: totalDraws * ticketResults.length,
      threshold,
      totalHits,                       // số cặp (vé × kỳ) đạt ngưỡng
      distinctDrawsWithHit: drawsWithHit.size,
      atLeast3: histogram.slice(3).reduce((a, b) => a + b, 0),
      byCount,                          // số lượt trùng đúng k số (k = 3..6)
      fullMatch: histogram[mainCount],  // trùng hoàn toàn 6/6 số chính
      fivePlusSpecial,                  // Power: 5 số chính + số Power (chỉ ở chế độ theo thể lệ)
      specialHits,
      histogram
    };
  }

  /** Tần suất xuất hiện của từng số trong vé ở lịch sử quay (số chính / số đặc biệt). */
  function numberFrequency(numbers, draws) {
    const uniq = [...new Set(numbers)];
    const main = new Map(uniq.map((n) => [n, 0]));
    const special = new Map(uniq.map((n) => [n, 0]));
    for (const d of draws) {
      for (const n of d.main) if (main.has(n)) main.set(n, main.get(n) + 1);
      if (d.special != null && special.has(d.special)) special.set(d.special, special.get(d.special) + 1);
    }
    return uniq.sort((a, b) => a - b).map((n) => ({
      number: n,
      mainCount: main.get(n),
      specialCount: special.get(n),
      rate: draws.length ? main.get(n) / draws.length : 0
    }));
  }

  /** Những kỳ quay có nhiều số trùng nhất (hits đã có ticketIndex). */
  function topDraws(allHits, limit) {
    return allHits
      .slice()
      .sort((a, b) => b.mainCount - a.mainCount || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, limit || 5);
  }

  return { summarize, numberFrequency, topDraws };
});
