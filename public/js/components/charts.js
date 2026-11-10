/**
 * UI Component: biểu đồ thống kê (SVG thuần, không phụ thuộc thư viện).
 *  - Phân bố số kỳ theo số lượng số trùng (0–6)
 *  - Tần suất xuất hiện các số trong vé
 *  - Những kỳ quay có nhiều số trùng nhất
 */
import { esc, pad, fmtNum, fmtDate, levelColor } from '../utils/dom.js';

const W = 600;

function barPath(x, y, w, h, r = 4) {
  // Bar bo góc phía trên (đầu dữ liệu), đáy vuông nằm trên trục
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function niceMax(v) {
  if (v <= 5) return 5;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

/** Biểu đồ phân bố theo số lượng số trùng */
export function histogramChart(histogram, threshold, unit) {
  const H = 230, padL = 44, padB = 30, padT = 22, padR = 8;
  const n = histogram.length;
  const max = niceMax(Math.max(...histogram, 1));
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / n, bw = Math.min(46, slot * 0.6);
  const ticks = [0, max / 2, max];
  const y = (v) => padT + plotH - (v / max) * plotH;
  const bars = histogram.map((v, k) => {
    const x = padL + slot * k + (slot - bw) / 2;
    const h = v > 0 ? Math.max(2, (v / max) * plotH) : 0;
    const on = k >= threshold;
    const color = on ? levelColor(Math.max(k, 3)) : 'rgba(137,147,167,.45)';
    const tip = `<strong>Trùng ${k} số</strong><span>${fmtNum(v)} ${unit}${on ? '' : ' · dưới ngưỡng'}</span>`;
    return `<g class="hit" tabindex="0" data-tip="${esc(tip)}">
        <rect x="${padL + slot * k}" y="${padT}" width="${slot}" height="${plotH}" fill="transparent"/>
        <path class="bar" d="${barPath(x, padT + plotH - h, bw, h)}" fill="${color}"/>
        <text class="val" x="${x + bw / 2}" y="${padT + plotH - h - 6}" text-anchor="middle">${fmtNum(v)}</text>
        <text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">${k} số</text>
      </g>`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Phân bố số kỳ theo số lượng số trùng">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${fmtNum(t)}</text>`).join('')}
    <line class="baseline" x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}"/>
    ${bars}
  </svg>`;
}

/** Biểu đồ tần suất các số trong vé */
export function frequencyChart(freq, totalDraws, product) {
  const H = 230, padL = 44, padB = 30, padT = 22, padR = 8;
  const expected = totalDraws * product.draw.mainCount / (product.draw.max - product.draw.min + 1);
  const max = niceMax(Math.max(expected, ...freq.map((f) => f.mainCount), 1));
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const slot = plotW / Math.max(freq.length, 1), bw = Math.min(40, slot * 0.55);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const bars = freq.map((f, i) => {
    const x = padL + slot * i + (slot - bw) / 2;
    const h = f.mainCount > 0 ? Math.max(2, (f.mainCount / max) * plotH) : 0;
    const tip = `<strong>Số ${pad(f.number)}</strong><span>Xuất hiện ${fmtNum(f.mainCount)}/${fmtNum(totalDraws)} kỳ (${(f.rate * 100).toFixed(1)}%)${product.draw.special ? ` · là số Power ${fmtNum(f.specialCount)} lần` : ''}</span>`;
    return `<g class="hit" tabindex="0" data-tip="${esc(tip)}">
      <rect x="${padL + slot * i}" y="${padT}" width="${slot}" height="${plotH}" fill="transparent"/>
      <path class="bar" d="${barPath(x, padT + plotH - h, bw, h)}" fill="var(--primary)"/>
      <text class="val" x="${x + bw / 2}" y="${padT + plotH - h - 6}" text-anchor="middle">${fmtNum(f.mainCount)}</text>
      <text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle">${pad(f.number)}</text>
    </g>`;
  }).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tần suất xuất hiện các số trong vé">
    ${ticks.map((t) => `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}"/><text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end">${fmtNum(Math.round(t))}</text>`).join('')}
    <line class="baseline" x1="${padL}" x2="${W - padR}" y1="${padT + plotH}" y2="${padT + plotH}"/>
    ${bars}
    <line class="avg" x1="${padL}" x2="${W - padR}" y1="${y(expected)}" y2="${y(expected)}"/>
  </svg>`;
}

export function renderCharts(root, { results, tickets, product, draws, threshold, freqTicket, allHits, unit }) {
  const histogram = new Array(product.draw.mainCount + 1).fill(0);
  results.forEach((r) => r.histogram.forEach((v, k) => { histogram[k] += v; }));
  const ft = tickets[freqTicket] || tickets[0];
  const freq = window.VLStatisticsEngine.numberFrequency(ft.numbers, draws);
  const expected = draws.length * product.draw.mainCount / (product.draw.max - product.draw.min + 1);
  const top = window.VLStatisticsEngine.topDraws(allHits, 5);

  root.innerHTML = `
    <div class="chart-card">
      <div class="chart-card__head">
        <div><h3>Phân bố theo số lượng số trùng</h3><p class="chart-card__sub">Số ${unit} theo mức trùng số chính</p></div>
        <button class="btn btn--ghost btn--xs chart-table-toggle" type="button" data-toggle-table="hist">Xem bảng</button>
      </div>
      ${histogramChart(histogram, threshold, unit)}
      <div class="chart-legend"><span><i style="--c:var(--lv4)"></i>Đạt ngưỡng (≥ ${threshold})</span><span><i style="--c:rgba(137,147,167,.45)"></i>Dưới ngưỡng</span></div>
      <table class="chart-table" data-table="hist" hidden>
        <thead><tr><th>Mức trùng</th><th>Số ${unit}</th><th>Tỷ lệ</th></tr></thead>
        <tbody>${histogram.map((v, k) => `<tr><td>${k} số</td><td>${fmtNum(v)}</td><td>${(v / Math.max(1, histogram.reduce((a, b) => a + b, 0)) * 100).toFixed(2)}%</td></tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="chart-card">
      <div class="chart-card__head">
        <div><h3>Tần suất các số trong vé</h3><p class="chart-card__sub">Số kỳ mỗi số xuất hiện trong ${fmtNum(draws.length)} kỳ quay</p></div>
        <div style="display:flex;gap:6px;align-items:center">
          ${tickets.length > 1 ? `<select class="select-sm" data-freq-ticket aria-label="Chọn vé">${tickets.map((t, i) => `<option value="${i}" ${i === freqTicket ? 'selected' : ''}>Vé ${i + 1}</option>`).join('')}</select>` : ''}
          <button class="btn btn--ghost btn--xs chart-table-toggle" type="button" data-toggle-table="freq">Xem bảng</button>
        </div>
      </div>
      ${frequencyChart(freq, draws.length, product)}
      <div class="chart-legend"><span><i style="--c:var(--primary)"></i>Số lần xuất hiện (số chính)</span><span><i class="line"></i>Trung bình lý thuyết ≈ ${expected.toFixed(1)} kỳ/số</span></div>
      <table class="chart-table" data-table="freq" hidden>
        <thead><tr><th>Số</th><th>Là số chính</th><th>Tỷ lệ</th>${product.draw.special ? '<th>Là số Power</th>' : ''}</tr></thead>
        <tbody>${freq.map((f) => `<tr><td>${pad(f.number)}</td><td>${fmtNum(f.mainCount)}</td><td>${(f.rate * 100).toFixed(2)}%</td>${product.draw.special ? `<td>${fmtNum(f.specialCount)}</td>` : ''}</tr>`).join('')}</tbody>
      </table>
    </div>
    <div class="chart-card chart-card--wide">
      <div class="chart-card__head"><div><h3>Những kỳ quay trùng nhiều số nhất</h3><p class="chart-card__sub">Xếp theo số lượng số trùng, bằng nhau thì kỳ mới nhất trước</p></div></div>
      ${top.length ? `<ol class="top-list">${top.map((h, i) => `
        <li tabindex="0" role="button" data-open-hit="${h.key}" aria-label="Xem chi tiết kỳ ${h.drawId}">
          <span class="top-list__rank">${i + 1}</span>
          <div class="top-list__info">
            <strong>Kỳ #${esc(h.drawId)} <span class="ticket-tag">Vé ${h.ticketIndex + 1}</span></strong>
            <span>${fmtDate(h.date, true)} · trùng ${h.matched.map(pad).join(', ')}</span>
          </div>
          <span class="badge" style="--c:${levelColor(h.mainCount)}">${h.mainCount}/${product.draw.mainCount}</span>
        </li>`).join('')}</ol>` : `<p class="chart-card__sub">Không có kỳ quay nào đạt ngưỡng ${threshold} số trùng.</p>`}
    </div>`;
}

/** Tooltip dùng chung cho mọi biểu đồ */
export function bindChartTooltip(root, tipEl) {
  const show = (g, x, y) => {
    tipEl.innerHTML = g.dataset.tip;
    tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 10;
    if (left + r.width > window.innerWidth - 8) left = x - r.width - 14;
    if (top < 8) top = y + 16;
    tipEl.style.left = `${Math.max(8, left)}px`;
    tipEl.style.top = `${top}px`;
  };
  root.addEventListener('mousemove', (e) => {
    const g = e.target.closest('.hit');
    if (g && root.contains(g)) show(g, e.clientX, e.clientY); else tipEl.hidden = true;
  });
  root.addEventListener('mouseleave', () => { tipEl.hidden = true; });
  root.addEventListener('focusin', (e) => {
    const g = e.target.closest('.hit');
    if (!g) return;
    const r = g.getBoundingClientRect();
    show(g, r.left + r.width / 2, r.top + 20);
  });
  root.addEventListener('focusout', () => { tipEl.hidden = true; });
}
