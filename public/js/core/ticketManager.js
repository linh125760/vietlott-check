/**
 * Ticket Management — danh sách vé theo từng sản phẩm, lưu trên trình duyệt.
 * Vé lưu dạng chuẩn hóa { id, numbers: number[], special: number|null }.
 */
import { storage } from '../utils/dom.js';

const KEY = 'vc.tickets.v1';
const MAX_TICKETS = 50;

export class TicketManager extends EventTarget {
  constructor() {
    super();
    const saved = storage.get(KEY, {});
    this.byProduct = saved && typeof saved === 'object' ? saved : {};
  }

  list(productId) { return (this.byProduct[productId] || []).slice(); }
  get(productId, id) { return this.list(productId).find((t) => t.id === id) || null; }

  isDuplicate(productId, ticket, exceptId) {
    const key = sig(ticket);
    return this.list(productId).some((t) => t.id !== exceptId && sig(t) === key);
  }

  add(productId, ticket) {
    const arr = this.byProduct[productId] || (this.byProduct[productId] = []);
    if (arr.length >= MAX_TICKETS) throw new Error(`Tối đa ${MAX_TICKETS} vé cho mỗi sản phẩm.`);
    if (this.isDuplicate(productId, ticket)) throw new Error('Dãy số này đã có trong danh sách.');
    const t = { id: uid(), numbers: ticket.numbers.slice(), special: ticket.special ?? null };
    arr.push(t);
    this.persist();
    return t;
  }

  update(productId, id, ticket) {
    const arr = this.byProduct[productId] || [];
    const i = arr.findIndex((t) => t.id === id);
    if (i < 0) throw new Error('Không tìm thấy vé cần sửa.');
    if (this.isDuplicate(productId, ticket, id)) throw new Error('Dãy số này đã có trong danh sách.');
    arr[i] = { id, numbers: ticket.numbers.slice(), special: ticket.special ?? null };
    this.persist();
    return arr[i];
  }

  remove(productId, id) {
    this.byProduct[productId] = (this.byProduct[productId] || []).filter((t) => t.id !== id);
    this.persist();
  }

  clear(productId) {
    this.byProduct[productId] = [];
    this.persist();
  }

  persist() {
    storage.set(KEY, this.byProduct);
    this.dispatchEvent(new Event('change'));
  }
}

function sig(t) { return `${t.numbers.slice().sort((a, b) => a - b).join(',')}|${t.special ?? ''}`; }
function uid() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3); }
