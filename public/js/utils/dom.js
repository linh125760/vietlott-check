/** Tiện ích DOM nhỏ gọn — tránh innerHTML với dữ liệu chưa escape. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const pad = (n) => String(n).padStart(2, '0');

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
/** 'YYYY-MM-DD' → 'dd/mm/yyyy' */
export function fmtDate(iso, withWeekday = false) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  const base = `${d}/${m}/${y}`;
  if (!withWeekday) return base;
  const wd = new Date(Date.UTC(+y, +m - 1, +d)).getUTCDay();
  return `${WEEKDAYS[wd]}, ${base}`;
}
export function fmtDateTime(isoTs) {
  if (!isoTs) return '—';
  const d = new Date(isoTs);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
}
export const fmtNum = (n) => Number(n || 0).toLocaleString('vi-VN');

/** Màu theo số lượng số trùng */
export function levelColor(k) {
  return k >= 6 ? 'var(--lv6)' : k === 5 ? 'var(--lv5)' : k === 4 ? 'var(--lv4)' : k === 3 ? 'var(--lv3)' : 'var(--muted)';
}

/** Một quả bóng số */
export function ball(n, { hit = false, miss = false, special = false, size = '' } = {}) {
  const cls = ['ball', size && `ball--${size}`, hit && 'ball--hit', miss && 'ball--miss', special && 'ball--special'].filter(Boolean).join(' ');
  const label = `${special ? 'Số Power ' : 'Số '}${pad(n)}${hit ? ' – trùng' : ''}`;
  return `<span class="${cls}" title="${label}" aria-label="${label}">${pad(n)}</span>`;
}

export const icons = {
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m14.1 5.9 4 4L8 20H4v-4L14.1 5.9Zm1.4-1.4 2-2 4 4-2 2-4-4Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-3 6h12l-1 12H7L6 9Z"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"/></svg>',
  dice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm9 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-4.5-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7V4Z"/></svg>',
  reset: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 4a8 8 0 1 1-7.7 10h2.1A6 6 0 1 0 8 7.5L10.5 10H3V2.5l3.6 3.6A8 8 0 0 1 12 4Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m6 9 6 6 6-6-1.4-1.4L12 12.2 7.4 7.6 6 9Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h7V4l-2.3 2.3Z"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></svg>'
};

export function toast(message, type = 'info', ms = 4200) {
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, ms);
}

/** localStorage an toàn (có thể bị chặn trong chế độ riêng tư) */
export const storage = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* bỏ qua */ } }
};
