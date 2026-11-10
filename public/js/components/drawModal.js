/** UI Component: chi tiết một kỳ quay — so sánh với mọi vé trong danh sách. */
import { esc, pad, fmtDate, levelColor, ball, icons } from '../utils/dom.js';
import { comparisonRows } from './resultsView.js';

let lastFocus = null;

export function openDrawModal({ hit, product, draws, tickets, powerMode }) {
  const modal = document.getElementById('drawModal');
  const body = document.getElementById('drawModalBody');
  const draw = draws[hit.drawIndex];
  const ticket = tickets[hit.ticketIndex];
  const total = product.draw.mainCount;
  const missed = ticket.numbers.filter((n) => !hit.matched.includes(n));
  const sp = hit.special;

  // Đối chiếu kỳ này với tất cả các vé (dùng lại engine, không tính lại toàn bộ lịch sử)
  const others = tickets.map((t, i) => {
    const r = window.VLMatchingEngine.checkTicket(product, t, [draw], { threshold: 0, powerMode });
    return { i, t, hit: r.hits[0] };
  });
  const prevDraw = draws[hit.drawIndex - 1];
  const nextDraw = draws[hit.drawIndex + 1];

  body.innerHTML = `
    <div class="detail">
      <div class="detail__eyebrow">${esc(product.name)} · Chi tiết kỳ quay</div>
      <h2 id="drawModalTitle">Kỳ quay #${esc(draw.id)}</h2>
      <p class="detail__date">${fmtDate(draw.date, true)}</p>

      <div class="detail__draw">
        <div class="ball-row">
          ${draw.main.map((n) => ball(n, { hit: hit.matched.includes(n) })).join('')}
          ${draw.special != null ? `<span class="ball-sep"></span>${ball(draw.special, { special: true, hit: Boolean(sp && sp.matched) })}` : ''}
        </div>
      </div>

      <div class="detail__grid">
        <div class="detail__kv"><span>Số trùng (Vé ${hit.ticketIndex + 1})</span><strong style="color:${levelColor(hit.mainCount)}">${hit.mainCount}/${total}</strong></div>
        <div class="detail__kv"><span>Các số trùng</span><strong>${hit.matched.map(pad).join(' · ') || '—'}</strong></div>
        <div class="detail__kv"><span>Số không trùng trên vé</span><strong>${missed.map(pad).join(' · ') || '—'}</strong></div>
        ${draw.special != null ? `<div class="detail__kv"><span>Số Power của kỳ</span><strong>${pad(draw.special)} ${sp ? (sp.matched ? '· trùng' : '· không trùng') : '· không đối chiếu'}</strong></div>` : ''}
      </div>

      <div class="detail__section">
        <h3>So sánh với Vé ${hit.ticketIndex + 1}</h3>
        ${comparisonRows(draw, ticket, hit, product, { size: '' })}
      </div>

      ${tickets.length > 1 ? `
      <div class="detail__section">
        <h3>Tất cả vé so với kỳ này</h3>
        <div class="detail__tickets">
          ${others.map(({ i, t, hit: h }) => `
            <div class="detail__ticket">
              <span class="ticket-tag">Vé ${i + 1}</span>
              <div class="ball-row">${t.numbers.map((n) => ball(n, { size: 'sm', hit: h.matched.includes(n), miss: !h.matched.includes(n) })).join('')}</div>
              <span class="badge" style="--c:${levelColor(h.mainCount)}">${h.mainCount}/${total}${h.special && h.special.matched ? ' + P' : ''}</span>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <div class="detail__section">
        <h3>Thông tin dữ liệu</h3>
        <div class="detail__grid">
          <div class="detail__kv"><span>Nguồn bản ghi</span><strong>${draw.source === 'vietlott' ? 'vietlott.vn (chính thức)' : 'vietlott-data (GitHub)'}</strong></div>
          <div class="detail__kv"><span>Kỳ trước</span><strong>${prevDraw ? `#${esc(prevDraw.id)} · ${fmtDate(prevDraw.date)}` : '—'}</strong></div>
          <div class="detail__kv"><span>Kỳ sau</span><strong>${nextDraw ? `#${esc(nextDraw.id)} · ${fmtDate(nextDraw.date)}` : '—'}</strong></div>
        </div>
        <p style="margin-top:12px"><a class="btn btn--xs" href="${esc(product.officialUrl)}" target="_blank" rel="noopener">${icons.external}Xem kết quả chính thức trên vietlott.vn</a></p>
      </div>

      <p class="detail__note">Đây là đối chiếu với kết quả của một kỳ quay đã diễn ra. Mức trùng số này không đồng nghĩa với việc vé hiện tại đã trúng thưởng.</p>
    </div>`;
  lastFocus = document.activeElement;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  modal.querySelector('.modal__close').focus();
}

export function closeDrawModal() {
  const modal = document.getElementById('drawModal');
  if (modal.hidden) return;
  modal.hidden = true;
  document.body.style.overflow = '';
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

export function bindDrawModal() {
  const modal = document.getElementById('drawModal');
  modal.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawModal(); });
}
