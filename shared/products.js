/**
 * Product Configuration — cấu hình riêng cho từng sản phẩm Vietlott.
 * Dùng chung cho server (Node) và trình duyệt (window.VLProducts / Web Worker).
 *
 * Mỗi sản phẩm khai báo:
 *  - pick: số lượng số người chơi chọn + khoảng số hợp lệ
 *  - draw: cấu trúc kết quả quay (số chính, số đặc biệt)
 *  - matcher: tên thuật toán đối chiếu trong MatchingEngine (không dùng chung cho thể lệ khác nhau)
 *  - enabled: sản phẩm đã triển khai đầy đủ hay mới chỉ có kiến trúc
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.VLProducts = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PRODUCTS = {
    mega645: {
      id: 'mega645',
      name: 'Mega 6/45',
      tagline: 'Chọn 6 số từ 01 đến 45',
      enabled: true,
      family: 'lotto',
      matcher: 'lotto-main',
      accent: '#E8364F',
      schedule: 'Thứ 4, Thứ 6, Chủ nhật',
      pick: { count: 6, min: 1, max: 45, unique: true, pad: 2 },
      draw: { mainCount: 6, min: 1, max: 45, special: null },
      firstDrawDate: '2016-07-20',
      officialUrl: 'https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/645'
    },
    power655: {
      id: 'power655',
      name: 'Power 6/55',
      tagline: 'Chọn 6 số từ 01 đến 55 + số Power đặc biệt',
      enabled: true,
      family: 'lotto',
      matcher: 'lotto-power',
      accent: '#F5C542',
      schedule: 'Thứ 3, Thứ 5, Thứ 7',
      pick: { count: 6, min: 1, max: 55, unique: true, pad: 2 },
      draw: {
        mainCount: 6, min: 1, max: 55,
        special: { label: 'Power', min: 1, max: 55, distinctFromMain: true }
      },
      // Người dùng có thể nhập thêm một số Power riêng (tùy chọn) để đối chiếu với số đặc biệt.
      userSpecial: { optional: true, label: 'Số Power', min: 1, max: 55 },
      firstDrawDate: '2017-08-01',
      officialUrl: 'https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/655'
    },

    // ----- Các sản phẩm dưới đây đã có cấu hình kiến trúc, chưa bật đối chiếu -----
    keno: {
      id: 'keno', name: 'Keno', tagline: 'Chọn 1–10 số từ 01 đến 80', enabled: false,
      family: 'keno', matcher: 'keno-spots', accent: '#00A3FF',
      pick: { countMin: 1, countMax: 10, min: 1, max: 80, unique: true, pad: 2 },
      draw: { mainCount: 20, min: 1, max: 80, special: null }
    },
    max3d: {
      id: 'max3d', name: 'Max 3D', tagline: 'Chọn 1 bộ 3 chữ số 000–999', enabled: false,
      family: 'digits', matcher: 'digits-exact', accent: '#9B5CFF',
      pick: { sets: 1, digits: 3 },
      draw: { prizes: ['Giải Đặc biệt', 'Giải Nhất', 'Giải Nhì', 'Giải ba'] }
    },
    max3dpro: {
      id: 'max3dpro', name: 'Max 3D Pro', tagline: 'Chọn 2 bộ 3 chữ số', enabled: false,
      family: 'digits', matcher: 'digits-pair', accent: '#FF7A45',
      pick: { sets: 2, digits: 3 },
      draw: { prizes: ['Giải Đặc biệt', 'Giải Nhất', 'Giải Nhì', 'Giải ba'] }
    },
    max3dplus: {
      id: 'max3dplus', name: 'Max 3D+', tagline: 'Chọn 2 bộ 3 chữ số', enabled: false,
      family: 'digits', matcher: 'digits-pair', accent: '#FF4FA3',
      pick: { sets: 2, digits: 3 },
      draw: { prizes: ['Giải Đặc biệt', 'Giải Nhất', 'Giải Nhì', 'Giải ba'] }
    },
    bingo18: {
      id: 'bingo18', name: 'Bingo18', tagline: '3 viên xúc xắc, tổng 3–18', enabled: false,
      family: 'dice', matcher: 'dice-sum', accent: '#00C896',
      pick: { dice: 3, faceMin: 1, faceMax: 6 },
      draw: { dice: 3 }
    }
  };

  const ORDER = ['mega645', 'power655', 'keno', 'max3d', 'max3dpro', 'max3dplus', 'bingo18'];

  function get(id) {
    const p = PRODUCTS[id];
    if (!p) throw new Error('Sản phẩm không tồn tại: ' + id);
    return p;
  }

  function list() { return ORDER.map((id) => PRODUCTS[id]); }

  function pad(n, width) { return String(n).padStart(width || 2, '0'); }

  return { PRODUCTS, ORDER, get, list, pad };
});
