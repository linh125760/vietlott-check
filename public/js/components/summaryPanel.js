/** UI Component: thống kê tổng quan sau khi đối chiếu. */
import { fmtNum, fmtDate, levelColor, esc } from '../utils/dom.js';

export function renderSummary(root, { summary, product, draws, powerMode, scopeLabel, activeCounts }) {
  const multi = summary.ticketCount > 1;
  const unit = multi ? 'lượt' : 'kỳ';
  const unitHint = multi ? `Tính theo lượt (vé × kỳ quay) trên ${summary.ticketCount} vé` : '';
  const from = draws.length ? fmtDate(draws[0].date) : '';
  const to = draws.length ? fmtDate(draws[draws.length - 1].date) : '';
  const t = summary.threshold;
  const levelStat = (k) => {
    const below = k < t;
    const active = activeCounts && activeCounts.has(k);
    return `
    <div class="stat stat--lv ${below ? '' : 'stat--clickable'} ${active ? 'is-active' : ''}" style="--c:${levelColor(k)}"
      ${below ? '' : `data-filter-count="${k}" role="button" tabindex="0" aria-pressed="${active}" title="Lọc các kỳ trùng ${k} số"`}>
      <div class="stat__label"><span class="stat__swatch"></span>Trùng ${k} số</div>
      <div class="stat__value">${fmtNum(summary.byCount[k])}</div>
      <div class="stat__sub">${below ? 'dưới ngưỡng hiển thị' : `${unit} · bấm để lọc`}</div>
    </div>`;
  };
  root.innerHTML = `
    <div class="summary-head">
      <div>
        <h2>Kết quả đối chiếu</h2>
        <p>${esc(product.name)} · ${esc(scopeLabel)}${product.id === 'power655' ? ` · ${powerMode === 'rules' ? 'kèm số Power' : 'chỉ 6 số chính'}` : ''}${unitHint ? ` · ${unitHint}` : ''}</p>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stat stat--hero">
        <div class="stat__label">Số kỳ quay có ≥ ${t} số trùng</div>
        <div class="stat__value">${fmtNum(summary.distinctDrawsWithHit)}</div>
        <div class="stat__sub">${multi ? `${fmtNum(summary.totalHits)} lượt trùng đạt ngưỡng · ` : ''}trên ${fmtNum(summary.totalDraws)} kỳ đã kiểm tra</div>
      </div>
      <div class="stat">
        <div class="stat__label">Tổng số kỳ đã kiểm tra</div>
        <div class="stat__value">${fmtNum(summary.totalDraws)}</div>
        <div class="stat__sub">${from} → ${to}</div>
      </div>
      <div class="stat" style="--c:var(--lv6)">
        <div class="stat__label">Trùng hoàn toàn (6/6)</div>
        <div class="stat__value" style="color:${summary.fullMatch ? 'var(--lv6)' : 'inherit'}">${fmtNum(summary.fullMatch)}</div>
        <div class="stat__sub">${summary.fullMatch ? `${unit} trùng toàn bộ 6 số chính` : 'chưa từng trùng cả 6 số'}</div>
      </div>
      ${[3, 4, 5, 6].map(levelStat).join('')}
      ${product.id === 'power655' && powerMode === 'rules' ? `
      <div class="stat" style="--c:var(--secondary)">
        <div class="stat__label">5 số chính + số Power</div>
        <div class="stat__value">${fmtNum(summary.fivePlusSpecial)}</div>
        <div class="stat__sub">${unit} trùng 5 số chính và số Power</div>
      </div>
      <div class="stat" style="--c:var(--secondary)">
        <div class="stat__label">Trùng số Power</div>
        <div class="stat__value">${fmtNum(summary.specialHits)}</div>
        <div class="stat__sub">${unit} có số Power trùng (mọi mức)</div>
      </div>` : ''}
    </div>`;
}
