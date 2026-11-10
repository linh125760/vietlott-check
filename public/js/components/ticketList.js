/** UI Component: danh sách vé đã thêm (sửa / xóa / kiểm tra riêng từng vé). */
import { ball, icons } from '../utils/dom.js';

export function renderTicketList(root, tickets, { editingId, product }) {
  if (!tickets.length) {
    root.innerHTML = '<li class="ticket-empty">Chưa có vé nào. Nhập số rồi bấm <strong>THÊM DÃY SỐ</strong>.</li>';
    return;
  }
  root.innerHTML = tickets.map((t, i) => `
    <li class="ticket-item ${t.id === editingId ? 'is-editing' : ''}" data-id="${t.id}">
      <span class="ticket-item__label">V${i + 1}</span>
      <div class="ball-row">
        ${t.numbers.map((n) => ball(n, { size: 'sm' })).join('')}
        ${product.userSpecial && t.special != null ? `<span class="ball-sep"></span>${ball(t.special, { size: 'sm', special: true })}` : ''}
      </div>
      <div class="ticket-item__actions">
        <button type="button" class="icon-btn" data-act="check" title="Kiểm tra riêng vé này" aria-label="Kiểm tra riêng vé ${i + 1}">${icons.search}</button>
        <button type="button" class="icon-btn" data-act="edit" title="Chỉnh sửa" aria-label="Chỉnh sửa vé ${i + 1}">${icons.edit}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-act="delete" title="Xóa" aria-label="Xóa vé ${i + 1}">${icons.trash}</button>
      </div>
    </li>`).join('');
}
