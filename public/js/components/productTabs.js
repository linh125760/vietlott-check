/** UI Component: chọn sản phẩm Vietlott (dạng card). */
import { esc, fmtNum } from '../utils/dom.js';

export function renderProductTabs(root, products, activeId) {
  root.innerHTML = products.map((p) => {
    const count = p.meta ? p.meta.count : null;
    return `
    <button type="button" role="tab" class="product-card" data-product="${p.id}" style="--pc:${p.accent}"
      aria-selected="${p.id === activeId}" ${p.enabled ? '' : 'disabled aria-disabled="true"'}>
      <span class="product-card__badge ${p.enabled ? 'product-card__badge--live' : ''}">${p.enabled ? 'Đã hỗ trợ' : 'Sắp ra mắt'}</span>
      <span class="product-card__name">${esc(p.name)}</span>
      <span class="product-card__tag">${esc(p.tagline)}</span>
      <span class="product-card__meta">${p.enabled ? (count ? `${fmtNum(count)} kỳ quay · ${esc(p.schedule)}` : esc(p.schedule)) : 'Đã có cấu hình thể lệ'}</span>
    </button>`;
  }).join('');
}
