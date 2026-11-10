/** UI Component: trạng thái dữ liệu (bản tĩnh — dữ liệu được cập nhật tự động hằng ngày). */
import { esc, fmtDate, fmtDateTime, fmtNum } from '../utils/dom.js';

export function renderDataStatus(root, { product, meta, loading, offline, loadError }) {
  let dot = 'status-dot';
  let text;
  if (loading && !meta) {
    dot += ' status-dot--busy';
    text = 'Đang tải dữ liệu…';
  } else if (loadError && !meta) {
    dot += ' status-dot--error';
    text = `<strong>Không có dữ liệu.</strong> ${esc(loadError)}`;
  } else if (meta) {
    if (offline) dot += ' status-dot--warn';
    text = `<strong>${esc(product.name)}:</strong> ${fmtNum(meta.count)} kỳ · đến <strong>#${esc(meta.lastDraw.id)}</strong> (${fmtDate(meta.lastDraw.date)}) · cập nhật ${fmtDateTime(meta.lastSuccess)}`;
    if (offline) text += ' · <span style="color:var(--primary)">mất kết nối, đang dùng dữ liệu đã tải</span>';
  } else {
    dot += ' status-dot--busy';
    text = 'Đang tải dữ liệu…';
  }
  const title = meta ? `Dữ liệu tự động cập nhật hằng ngày sau giờ quay thưởng. Kỳ đầu: #${meta.firstDraw.id} (${fmtDate(meta.firstDraw.date)}).` : '';
  root.innerHTML = `
    <span class="${dot}" aria-hidden="true"></span>
    <span class="data-status__text" title="${esc(title)}">${text}</span>`;
}
