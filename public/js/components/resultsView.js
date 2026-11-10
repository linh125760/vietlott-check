/**
 * UI Component: bộ lọc + danh sách card kết quả + phân trang.
 */
import { esc, pad, fmtNum, fmtDate, levelColor, ball } from '../utils/dom.js';

export const PAGE_SIZE = 10;

/** Áp dụng bộ lọc, trả về danh sách đã lọc + sắp xếp */
export function applyFilters(allHits, f) {
  let list = allHits;
  if (f.ticket !== 'all') list = list.filter((h) => h.ticketIndex === f.ticket);
  if (f.counts.size) list = list.filter((h) => f.counts.has(h.mainCount));
  if (f.dateFrom) list = list.filter((h) => h.date >= f.dateFrom);
  if (f.dateTo) list = list.filter((h) => h.date <= f.dateTo);
  if (f.specialOnly) list = list.filter((h) => h.special && h.special.matched);
  return window.VLMatchingEngine.sortHits(list, f.sort);
}

/** HTML hai dãy bóng: kết quả & vé, tô sáng số trùng */
export function comparisonRows(draw, ticket, hit, product, { size = 'sm' } = {}) {
  const matchedSet = new Set(hit.matched);
  const sp = hit.special;
  const drawBalls = draw.main.map((n) => ball(n, { hit: matchedSet.has(n), size })).join('');
  const drawSpecial = draw.special != null
    ? `<span class="ball-sep" aria-hidden="true"></span>${ball(draw.special, { special: true, hit: Boolean(sp && sp.matched), size })}` : '';
  const ticketBalls = ticket.numbers.map((n) => {
    const isMain = matchedSet.has(n);
    const isSpecial = sp && sp.matched && sp.source === 'ticket' && n === sp.number;
    if (isSpecial) return ball(n, { special: true, hit: true, size });
    return ball(n, { hit: isMain, miss: !isMain, size });
  }).join('');
  const userSp = product.userSpecial && ticket.special != null
    ? `<span class="ball-sep" aria-hidden="true"></span>${ball(ticket.special, { special: true, hit: Boolean(sp && sp.matched && sp.source === 'userSpecial'), miss: !(sp && sp.matched), size })}` : '';
  return `
    <div class="result-row"><span class="result-row__label">Kết quả</span><div class="ball-row">${drawBalls}${drawSpecial}</div></div>
    <div class="result-row"><span class="result-row__label">Vé của tôi</span><div class="ball-row">${ticketBalls}${userSp}</div></div>`;
}

function card(hit, ctx) {
  const { product, draws, tickets, multi } = ctx;
  const draw = draws[hit.drawIndex];
  const ticket = tickets[hit.ticketIndex];
  const k = hit.mainCount;
  const total = product.draw.mainCount;
  const c = levelColor(k);
  const sp = hit.special;
  return `
  <article class="result-card" style="--c:${c}">
    <header class="result-card__head">
      <div>
        <h3 class="result-card__title">Kỳ quay #${esc(draw.id)} <small>– ${esc(product.name)}</small>${multi ? `<span class="ticket-tag">Vé ${hit.ticketIndex + 1}</span>` : ''}</h3>
        <div class="result-card__date">Ngày quay: ${fmtDate(draw.date, true)}</div>
      </div>
      <div class="result-card__badges">
        <span class="badge" style="--c:${c}">Trùng ${k} số</span>
        ${sp && sp.matched ? `<span class="badge badge--special">+ Trùng số Power</span>` : ''}
      </div>
    </header>
    ${comparisonRows(draw, ticket, hit, product)}
    <footer class="result-card__foot">
      <div class="meter" aria-label="Số trùng ${k}/${total}">
        <span>Số trùng</span>
        <strong>${k}/${total}</strong>
        <span class="meter__dots" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < k ? 'on' : ''}"></i>`).join('')}</span>
      </div>
      <button type="button" class="btn btn--xs" data-open-hit="${hit.key}">Xem chi tiết</button>
    </footer>
  </article>`;
}

function pagination(page, pages) {
  if (pages <= 1) return '';
  const items = [];
  const add = (p) => items.push(`<button type="button" class="page-btn" data-page="${p}" ${p === page ? 'aria-current="page"' : ''}>${p}</button>`);
  const win = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  let prev = 0;
  [...win].sort((a, b) => a - b).forEach((p) => {
    if (p - prev > 1) items.push('<span class="page-gap">…</span>');
    add(p);
    prev = p;
  });
  return `<nav class="pagination" aria-label="Phân trang">
    <button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Trang trước">‹</button>
    ${items.join('')}
    <button type="button" class="page-btn" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Trang sau">›</button>
  </nav>`;
}

export function renderResults(root, { allHits, filters, product, draws, tickets, threshold, powerMode }) {
  const filtered = applyFilters(allHits, filters);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, filters.page), pages);
  filters.page = page;
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const multi = tickets.length > 1;
  const countsAvail = [];
  for (let k = product.draw.mainCount; k >= threshold; k--) countsAvail.push(k);
  const countOf = (k) => allHits.filter((h) => h.mainCount === k && (filters.ticket === 'all' || h.ticketIndex === filters.ticket)).length;
  const minDate = draws.length ? draws[0].date : '';
  const maxDate = draws.length ? draws[draws.length - 1].date : '';
  const isFiltered = filters.counts.size || filters.dateFrom || filters.dateTo || filters.specialOnly || filters.ticket !== 'all';

  root.innerHTML = `
    <div class="toolbar">
      <div class="toolbar__row toolbar__row--split">
        <h3 class="toolbar__title">Danh sách kỳ quay trùng số <span class="count-pill">${fmtNum(filtered.length)}</span></h3>
        <div class="filter-chips" role="group" aria-label="Lọc theo số lượng số trùng">
          ${countsAvail.map((k) => `<button type="button" class="filter-chip" style="--c:${levelColor(k)}" data-count="${k}" aria-pressed="${filters.counts.has(k)}"><i></i>${k} số <small>${fmtNum(countOf(k))}</small></button>`).join('')}
          ${product.id === 'power655' && powerMode === 'rules' ? `<button type="button" class="filter-chip" style="--c:var(--secondary)" data-special-only aria-pressed="${filters.specialOnly}"><i></i>Trùng Power</button>` : ''}
        </div>
      </div>
      <div class="filter-controls">
        ${multi ? `<label class="control"><span>Vé</span>
          <select data-f="ticket"><option value="all">Tất cả ${tickets.length} vé</option>${tickets.map((t, i) => `<option value="${i}" ${filters.ticket === i ? 'selected' : ''}>Vé ${i + 1}: ${t.numbers.map(pad).join(' ')}</option>`).join('')}</select></label>` : ''}
        <label class="control"><span>Từ ngày</span><input type="date" data-f="dateFrom" value="${filters.dateFrom}" min="${minDate}" max="${maxDate}"></label>
        <label class="control"><span>Đến ngày</span><input type="date" data-f="dateTo" value="${filters.dateTo}" min="${minDate}" max="${maxDate}"></label>
        <label class="control"><span>Sắp xếp</span>
          <select data-f="sort">
            <option value="matches-desc" ${filters.sort === 'matches-desc' ? 'selected' : ''}>Số trùng: cao → thấp</option>
            <option value="matches-asc" ${filters.sort === 'matches-asc' ? 'selected' : ''}>Số trùng: thấp → cao</option>
            <option value="date-desc" ${filters.sort === 'date-desc' ? 'selected' : ''}>Ngày quay: mới → cũ</option>
            <option value="date-asc" ${filters.sort === 'date-asc' ? 'selected' : ''}>Ngày quay: cũ → mới</option>
          </select></label>
        <button type="button" class="btn btn--ghost btn--xs" data-reset-filters ${isFiltered ? '' : 'disabled'}>Xóa bộ lọc</button>
      </div>
    </div>
    ${slice.length ? `<div class="result-grid">${slice.map((h) => card(h, { product, draws, tickets, multi })).join('')}</div>`
      : `<div class="no-results"><strong>${allHits.length ? 'Không có kết quả phù hợp bộ lọc' : `Không có kỳ quay nào trùng từ ${threshold} số trở lên`}</strong>${allHits.length ? 'Hãy thay đổi hoặc xóa bộ lọc.' : 'Bạn có thể giảm ngưỡng tối thiểu để xem thêm kết quả.'}</div>`}
    ${pagination(page, pages)}
    ${filtered.length ? `<p class="page-info">Hiển thị ${fmtNum((page - 1) * PAGE_SIZE + 1)}–${fmtNum((page - 1) * PAGE_SIZE + slice.length)} trên ${fmtNum(filtered.length)} kết quả</p>` : ''}`;
}
