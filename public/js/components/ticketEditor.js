/**
 * UI Component: Ô nhập vé + bảng chọn số dạng bóng tròn.
 * Tự thay đổi theo cấu hình sản phẩm (số lượng ô, khoảng số, số đặc biệt).
 */
import { esc, pad, icons } from '../utils/dom.js';

export class TicketEditor {
  /**
   * @param {HTMLElement} root
   * @param {{onSubmit:(ticket, editingId)=>void, onReset:()=>void, onCancelEdit:()=>void}} handlers
   */
  constructor(root, handlers) {
    this.root = root;
    this.h = handlers;
    this.product = null;
    this.editingId = null;
    this.showAllErrors = false;
    this.pickerOpen = true;
    this.root.addEventListener('click', (e) => this.onClick(e)); // gắn một lần, không lặp khi render lại
  }

  setProduct(product) {
    this.product = product;
    this.editingId = null;
    this.showAllErrors = false;
    this.render();
  }

  render() {
    const p = this.product;
    const { count, min, max } = p.pick;
    const sp = p.userSpecial;
    this.root.innerHTML = `
      <div class="editor">
        <div class="editor__inputs" role="group" aria-label="${count} số chính">
          ${Array.from({ length: count }, (_, i) => `
            <input class="num-input" data-idx="${i}" type="text" inputmode="numeric" autocomplete="off"
              placeholder="--" aria-label="Số thứ ${i + 1} (${pad(min)}–${pad(max)})">`).join('')}
        </div>
        ${sp ? `
          <div class="special-row">
            <input class="num-input num-input--special" data-special type="text" inputmode="numeric" autocomplete="off"
              maxlength="2" placeholder="P" aria-label="${esc(sp.label)} (tùy chọn)">
            <p><strong>${esc(sp.label)} riêng (tùy chọn)</strong>Dùng khi đối chiếu ở chế độ “Kèm số Power”. Bỏ trống → số Power của kỳ quay được so với 6 số trên vé, đúng thể lệ.</p>
          </div>` : ''}
        <p class="editor__errors" data-errors role="alert"></p>
        <div class="editor__actions">
          <button type="button" class="btn btn--secondary" data-act="submit">${icons.plus}<span>THÊM DÃY SỐ</span></button>
          <button type="button" class="btn" data-act="random">${icons.dice}CHỌN NGẪU NHIÊN</button>
          <button type="button" class="btn" data-act="reset">${icons.reset}LÀM MỚI</button>
        </div>
        <div class="picker">
          <button type="button" class="picker__toggle" data-act="toggle-picker" aria-expanded="${this.pickerOpen}">
            <span>Chọn nhanh bằng bảng số ${pad(min)}–${pad(max)}</span>${icons.chevron}
          </button>
          <div class="picker__grid" data-picker ${this.pickerOpen ? '' : 'hidden'}>
            ${Array.from({ length: max - min + 1 }, (_, k) => k + min).map((n) =>
              `<button type="button" class="picker__ball" data-n="${n}" aria-pressed="false" aria-label="Số ${pad(n)}">${pad(n)}</button>`).join('')}
          </div>
        </div>
      </div>`;
    this.inputs = [...this.root.querySelectorAll('.num-input[data-idx]')];
    this.specialInput = this.root.querySelector('[data-special]');
    this.errorsEl = this.root.querySelector('[data-errors]');
    this.submitBtn = this.root.querySelector('[data-act="submit"]');
    this.bind();
    this.refresh();
  }

  bind() {
    const all = [...this.inputs, this.specialInput].filter(Boolean);
    all.forEach((inp) => {
      inp.addEventListener('input', () => {
        const digits = inp.value.replace(/\D/g, '');
        const idx = this.inputs.indexOf(inp);
        if (digits.length > 2 && idx >= 0) {
          // Nhập liền nhiều số (gõ nhanh, tự điền) → chia thành từng cặp 2 chữ số cho các ô tiếp theo
          const chunks = digits.match(/\d{1,2}/g);
          let j = idx;
          for (const c of chunks) { if (j >= this.inputs.length) break; this.inputs[j++].value = c; }
          this.inputs[Math.min(j, this.inputs.length) - 1].focus();
          this.refresh();
          return;
        }
        inp.value = digits.slice(0, 2);
        if (inp.value.length === 2 && idx >= 0 && idx < this.inputs.length - 1) this.inputs[idx + 1].focus();
        this.refresh();
      });
      inp.addEventListener('blur', () => {
        const n = parseInt(inp.value, 10);
        if (inp.value !== '' && Number.isInteger(n)) inp.value = pad(n);
        this.refresh();
      });
      inp.addEventListener('keydown', (e) => {
        const idx = this.inputs.indexOf(inp);
        if (e.key === 'Backspace' && inp.value === '' && idx > 0) { this.inputs[idx - 1].focus(); e.preventDefault(); }
        else if (e.key === 'ArrowLeft' && idx > 0 && inp.selectionStart === 0) this.inputs[idx - 1].focus();
        else if (e.key === 'ArrowRight' && idx >= 0 && idx < this.inputs.length - 1 && inp.selectionStart === inp.value.length) this.inputs[idx + 1].focus();
        else if (e.key === 'Enter') { e.preventDefault(); this.submit(); }
      });
      inp.addEventListener('paste', (e) => {
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const nums = (text.match(/\d{1,2}/g) || []);
        if (nums.length > 1 && inp !== this.specialInput) {
          e.preventDefault();
          this.setNumbers(nums.slice(0, this.inputs.length).map(Number), nums[this.inputs.length] != null && this.specialInput ? Number(nums[this.inputs.length]) : undefined);
        }
      });
    });
  }

  onClick(e) {
    const btn = e.target.closest('button');
    if (!btn || !this.root.contains(btn) || !this.product) return;
    if (btn.dataset.n) return this.togglePick(Number(btn.dataset.n));
    const act = btn.dataset.act;
    if (act === 'submit') this.submit();
    else if (act === 'random') this.random();
    else if (act === 'reset') { this.clear(); if (this.h.onReset) this.h.onReset(); }
    else if (act === 'cancel') { this.clear(); if (this.h.onCancelEdit) this.h.onCancelEdit(); }
    else if (act === 'toggle-picker') {
      this.pickerOpen = !this.pickerOpen;
      btn.setAttribute('aria-expanded', this.pickerOpen);
      this.root.querySelector('[data-picker]').hidden = !this.pickerOpen;
    }
  }

  raw() {
    return { numbers: this.inputs.map((i) => i.value), special: this.specialInput ? this.specialInput.value : null };
  }

  validate() { return window.VLTicketValidator.validate(this.product, this.raw()); }

  /** Cập nhật trạng thái hiển thị: lỗi từng ô, bóng đã chọn. */
  refresh() {
    const v = this.validate();
    const fe = v.fieldErrors;
    this.inputs.forEach((inp, i) => {
      const err = fe[i];
      const show = err && (this.showAllErrors || err !== 'Chưa nhập');
      inp.classList.toggle('is-invalid', Boolean(show));
      inp.classList.toggle('is-filled', inp.value !== '' && !err);
      inp.title = show ? err : '';
      inp.setAttribute('aria-invalid', show ? 'true' : 'false');
    });
    if (this.specialInput) {
      this.specialInput.classList.toggle('is-invalid', Boolean(fe.special));
      this.specialInput.classList.toggle('is-filled', this.specialInput.value !== '' && !fe.special);
    }
    const msgs = v.errors.filter((m) => this.showAllErrors || !m.startsWith('Còn') && !m.startsWith('Cần'));
    this.errorsEl.textContent = msgs.join(' ');
    // picker
    const chosen = new Set(this.inputs.map((i) => parseInt(i.value, 10)).filter(Number.isInteger));
    const full = this.inputs.every((i) => i.value !== '');
    this.root.querySelectorAll('.picker__ball').forEach((b) => {
      const on = chosen.has(Number(b.dataset.n));
      b.setAttribute('aria-pressed', on);
      b.disabled = !on && full;
    });
    return v;
  }

  togglePick(n) {
    const idx = this.inputs.findIndex((i) => parseInt(i.value, 10) === n);
    if (idx >= 0) this.inputs[idx].value = '';
    else {
      const empty = this.inputs.find((i) => i.value === '');
      if (!empty) return;
      empty.value = pad(n);
    }
    this.refresh();
  }

  setNumbers(numbers, special) {
    this.inputs.forEach((inp, i) => { inp.value = numbers[i] != null && !Number.isNaN(numbers[i]) ? pad(numbers[i]) : ''; });
    if (this.specialInput && special !== undefined) this.specialInput.value = special == null || Number.isNaN(special) ? '' : pad(special);
    this.refresh();
  }

  random() {
    const { count, min, max } = this.product.pick;
    const pool = Array.from({ length: max - min + 1 }, (_, k) => k + min);
    const rnd = new Uint32Array(count);
    crypto.getRandomValues(rnd);
    const picked = [];
    for (let i = 0; i < count; i++) picked.push(pool.splice(rnd[i] % pool.length, 1)[0]);
    this.showAllErrors = false;
    this.setNumbers(picked.sort((a, b) => a - b), this.specialInput ? null : undefined);
  }

  submit() {
    this.showAllErrors = true;
    const v = this.refresh();
    if (!v.ok) {
      const first = this.inputs.find((i) => i.classList.contains('is-invalid'));
      if (first) first.focus();
      return;
    }
    this.h.onSubmit(v.ticket, this.editingId);
  }

  /** Nạp vé vào ô nhập để chỉnh sửa */
  edit(ticket) {
    this.editingId = ticket.id;
    this.setNumbers(ticket.numbers, ticket.special);
    this.submitBtn.innerHTML = `${icons.check}<span>CẬP NHẬT DÃY SỐ</span>`;
    if (!this.root.querySelector('[data-act="cancel"]')) {
      this.submitBtn.insertAdjacentHTML('afterend', '<button type="button" class="btn btn--ghost" data-act="cancel" style="grid-column:1/-1">Hủy chỉnh sửa</button>');
    }
    this.inputs[0].focus();
  }

  clear() {
    this.editingId = null;
    this.showAllErrors = false;
    this.inputs.forEach((i) => { i.value = ''; });
    if (this.specialInput) this.specialInput.value = '';
    this.submitBtn.innerHTML = `${icons.plus}<span>THÊM DÃY SỐ</span>`;
    const c = this.root.querySelector('[data-act="cancel"]');
    if (c) c.remove();
    this.refresh();
  }

  /** Vé hợp lệ hiện có trong ô nhập (không hiển thị lỗi), hoặc null */
  peekValid() {
    const v = this.validate();
    return v.ok ? v.ticket : null;
  }

  isEmpty() { return this.inputs.every((i) => i.value === ''); }
}
