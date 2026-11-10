/**
 * Kiểm tra hợp lệ của một vé theo cấu hình sản phẩm.
 * Vé chuẩn hóa: { numbers: number[] (đã sắp xếp tăng dần), special: number|null }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VLTicketValidator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseNumber(value) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (s === '') return null;
    if (!/^\d{1,2}$/.test(s)) return NaN;
    return parseInt(s, 10);
  }

  /**
   * @param {object} product cấu hình sản phẩm (family 'lotto')
   * @param {{numbers: Array, special?: any}} raw
   * @returns {{ok: boolean, errors: string[], fieldErrors: object, ticket: object|null}}
   */
  function validate(product, raw) {
    const errors = [];
    const fieldErrors = {};
    if (!product || product.family !== 'lotto') {
      return { ok: false, errors: ['Sản phẩm này chưa hỗ trợ đối chiếu.'], fieldErrors, ticket: null };
    }
    const { count, min, max } = product.pick;
    const values = Array.isArray(raw && raw.numbers) ? raw.numbers : [];
    if (values.length !== count) errors.push(`Cần đúng ${count} số.`);

    const parsed = [];
    const seen = new Map();
    for (let i = 0; i < count; i++) {
      const n = parseNumber(values[i]);
      if (n === null) { fieldErrors[i] = 'Chưa nhập'; continue; }
      if (Number.isNaN(n) || !Number.isInteger(n)) { fieldErrors[i] = 'Không phải số nguyên'; continue; }
      if (n < min || n > max) { fieldErrors[i] = `Ngoài khoảng ${pad(min)}–${pad(max)}`; continue; }
      if (seen.has(n)) {
        fieldErrors[i] = 'Bị trùng';
        fieldErrors[seen.get(n)] = 'Bị trùng';
        continue;
      }
      seen.set(n, i);
      parsed.push(n);
    }
    const missing = Object.values(fieldErrors).filter((e) => e === 'Chưa nhập').length;
    if (missing) errors.push(`Còn ${missing} ô chưa nhập.`);
    if (Object.values(fieldErrors).some((e) => e === 'Bị trùng')) errors.push('Không được nhập trùng số trong cùng một vé.');
    if (Object.values(fieldErrors).some((e) => e.startsWith('Ngoài'))) errors.push(`Mỗi số phải nằm trong khoảng ${pad(min)}–${pad(max)}.`);
    if (Object.values(fieldErrors).some((e) => e === 'Không phải số nguyên')) errors.push('Chỉ được nhập số nguyên.');

    let special = null;
    if (product.userSpecial) {
      const s = parseNumber(raw && raw.special);
      if (s !== null) {
        if (Number.isNaN(s) || s < product.userSpecial.min || s > product.userSpecial.max) {
          fieldErrors.special = 'Không hợp lệ';
          errors.push(`${product.userSpecial.label} phải trong khoảng ${pad(product.userSpecial.min)}–${pad(product.userSpecial.max)}.`);
        } else {
          special = s;
        }
      }
    }

    const ok = errors.length === 0 && parsed.length === count;
    return {
      ok,
      errors: [...new Set(errors)],
      fieldErrors,
      ticket: ok ? { numbers: parsed.slice().sort((a, b) => a - b), special } : null
    };
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  return { validate, parseNumber };
});
