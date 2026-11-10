/**
 * Kiểm định một kỳ quay đã chuẩn hóa theo cấu hình sản phẩm.
 * Bản ghi không hợp lệ sẽ không được dùng để đối chiếu (và được lấy lại từ nguồn chính thức).
 */
function validateDraw(product, d) {
  const errors = [];
  if (!d || typeof d !== 'object') return ['Bản ghi rỗng'];
  if (!/^\d{5}$/.test(d.id || '')) errors.push('Mã kỳ không hợp lệ');
  if (!Number.isInteger(d.drawNo) || d.drawNo < 1) errors.push('Số kỳ không hợp lệ');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date || '') || Number.isNaN(Date.parse(d.date))) errors.push('Ngày quay không hợp lệ');
  const { mainCount, min, max, special } = product.draw;
  if (!Array.isArray(d.main) || d.main.length !== mainCount) {
    errors.push(`Cần ${mainCount} số chính`);
  } else {
    if (d.main.some((n) => !Number.isInteger(n) || n < min || n > max)) errors.push('Số chính ngoài khoảng');
    if (new Set(d.main).size !== d.main.length) errors.push('Số chính bị lặp');
  }
  if (special) {
    if (!Number.isInteger(d.special) || d.special < special.min || d.special > special.max) {
      errors.push(`Thiếu/sai số ${special.label}`);
    } else if (special.distinctFromMain && Array.isArray(d.main) && d.main.includes(d.special)) {
      errors.push(`Số ${special.label} trùng số chính`);
    }
  } else if (d.special != null) {
    errors.push('Sản phẩm không có số đặc biệt');
  }
  return errors;
}

/**
 * Phát hiện ngày quay không tăng dần theo số kỳ (dấu hiệu bản ghi sai).
 * @returns {Set<number>} drawNo nghi vấn
 */
function findDateAnomalies(sortedDraws) {
  // Đánh dấu cả hai phía của điểm lệch; bản ghi đúng sẽ được nguồn chính thức xác nhận lại.
  const suspicious = new Set();
  for (let i = 1; i < sortedDraws.length; i++) {
    const prev = sortedDraws[i - 1];
    const cur = sortedDraws[i];
    if (cur.date <= prev.date) {
      suspicious.add(prev.drawNo);
      suspicious.add(cur.drawNo);
    }
  }
  return suspicious;
}

module.exports = { validateDraw, findDateAnomalies };
