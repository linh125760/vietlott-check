const test = require('node:test');
const assert = require('node:assert/strict');
const Products = require('../shared/products');
const Engine = require('../shared/matchingEngine');
const Stats = require('../shared/statisticsEngine');
const Validator = require('../shared/ticketValidator');

const mega = Products.get('mega645');
const power = Products.get('power655');
const d = (no, date, main, special = null) => ({ id: String(no).padStart(5, '0'), drawNo: no, date, main, special });

test('Ví dụ trong đặc tả: đếm đúng và sắp xếp theo số trùng giảm dần', () => {
  const draws = [
    d(1, '2026-01-01', [1, 2, 3, 10, 11, 12]),
    d(2, '2026-01-03', [1, 2, 4, 5, 20, 30]),
    d(3, '2026-01-05', [10, 11, 12, 13, 14, 15]),
    d(4, '2026-01-07', [1, 2, 3, 4, 5, 6])
  ];
  const r = Engine.checkTicket(mega, { numbers: [1, 2, 3, 4, 5, 6], special: null }, draws, { threshold: 3 });
  assert.deepEqual(r.hits.map((h) => [h.drawId, h.mainCount]), [['00004', 6], ['00002', 4], ['00001', 3]]);
  assert.deepEqual(r.hits.find((h) => h.drawId === '00001').matched, [1, 2, 3]);
  assert.deepEqual(r.hits.find((h) => h.drawId === '00002').matched, [1, 2, 4, 5]);
  assert.equal(r.histogram[0], 1); // kỳ 003 trùng 0 số, không hiển thị
  assert.equal(r.histogram.reduce((a, b) => a + b, 0), 4);
});

test('Bằng số trùng → kỳ mới nhất trước; ngưỡng có thể thay đổi', () => {
  const draws = [d(1, '2025-01-01', [1, 2, 3, 40, 41, 42]), d(2, '2025-06-01', [1, 2, 3, 30, 31, 32]), d(3, '2025-07-01', [1, 2, 33, 34, 35, 36])];
  const t = { numbers: [1, 2, 3, 4, 5, 6] };
  assert.deepEqual(Engine.checkTicket(mega, t, draws, { threshold: 3 }).hits.map((h) => h.drawId), ['00002', '00001']);
  assert.equal(Engine.checkTicket(mega, t, draws, { threshold: 2 }).hits.length, 3);
  assert.equal(Engine.checkTicket(mega, t, draws, { threshold: 4 }).hits.length, 0);
});

test('Sắp xếp tăng/giảm theo số trùng và ngày', () => {
  const hits = [
    { drawNo: 1, date: '2020-01-01', mainCount: 3 },
    { drawNo: 2, date: '2021-01-01', mainCount: 5 },
    { drawNo: 3, date: '2022-01-01', mainCount: 3 }
  ];
  assert.deepEqual(Engine.sortHits(hits, 'matches-desc').map((h) => h.drawNo), [2, 3, 1]);
  assert.deepEqual(Engine.sortHits(hits, 'matches-asc').map((h) => h.drawNo), [3, 1, 2]);
  assert.deepEqual(Engine.sortHits(hits, 'date-desc').map((h) => h.drawNo), [3, 2, 1]);
  assert.deepEqual(Engine.sortHits(hits, 'date-asc').map((h) => h.drawNo), [1, 2, 3]);
});

test('Power 6/55: số Power không bao giờ được tính là số chính', () => {
  const draws = [d(1, '2026-01-01', [1, 2, 3, 4, 5, 50], 6)];
  const t = { numbers: [1, 2, 3, 4, 5, 6], special: null };
  const main = Engine.checkTicket(power, t, draws, { threshold: 3, powerMode: 'main' }).hits[0];
  assert.equal(main.mainCount, 5);
  assert.equal(main.special, null);
  const rules = Engine.checkTicket(power, t, draws, { threshold: 3, powerMode: 'rules' }).hits[0];
  assert.equal(rules.mainCount, 5);           // vẫn 5, không phải 6
  assert.deepEqual(rules.matched, [1, 2, 3, 4, 5]);
  assert.equal(rules.special.matched, true);  // số 06 của vé trùng số Power
  assert.equal(rules.special.source, 'ticket');
});

test('Power 6/55: ô Số Power riêng được ưu tiên khi đối chiếu số đặc biệt', () => {
  const draws = [d(1, '2026-01-01', [10, 20, 30, 40, 50, 55], 7)];
  const withUser = Engine.checkTicket(power, { numbers: [10, 20, 30, 1, 2, 7], special: 9 }, draws, { threshold: 3, powerMode: 'rules' }).hits[0];
  assert.equal(withUser.special.matched, false); // so với 09, không so với số 07 trong vé
  assert.equal(withUser.special.source, 'userSpecial');
  const hit = Engine.checkTicket(power, { numbers: [10, 20, 30, 1, 2, 3], special: 7 }, draws, { threshold: 3, powerMode: 'rules' }).hits[0];
  assert.equal(hit.special.matched, true);
  assert.equal(hit.mainCount, 3);
});

test('Không đối chiếu sản phẩm chưa hỗ trợ', () => {
  assert.throws(() => Engine.checkTicket(Products.get('keno'), { numbers: [1] }, [], {}));
});

test('Thống kê tổng hợp nhiều vé', () => {
  const draws = [d(1, '2026-01-01', [1, 2, 3, 4, 5, 6]), d(2, '2026-01-03', [1, 2, 3, 40, 41, 42])];
  const r1 = Engine.checkTicket(mega, { numbers: [1, 2, 3, 4, 5, 6] }, draws, { threshold: 3 });
  const r2 = Engine.checkTicket(mega, { numbers: [1, 2, 3, 7, 8, 9] }, draws, { threshold: 3 });
  const s = Stats.summarize([r1, r2], draws.length, 6, 3);
  assert.equal(s.totalDraws, 2);
  assert.equal(s.totalHits, 4);
  assert.equal(s.distinctDrawsWithHit, 2);
  assert.deepEqual(s.byCount, { 3: 3, 4: 0, 5: 0, 6: 1 });
  assert.equal(s.fullMatch, 1);
  const f = Stats.numberFrequency([1, 4], draws);
  assert.deepEqual(f.map((x) => [x.number, x.mainCount]), [[1, 2], [4, 1]]);
});

test('Kiểm tra vé: khoảng số, trùng số, định dạng', () => {
  assert.equal(Validator.validate(mega, { numbers: ['01', '2', '03', '04', '05', '45'] }).ok, true);
  assert.deepEqual(Validator.validate(mega, { numbers: ['6', '5', '4', '3', '2', '1'] }).ticket.numbers, [1, 2, 3, 4, 5, 6]);
  assert.equal(Validator.validate(mega, { numbers: [1, 2, 3, 4, 5, 46] }).ok, false);
  assert.equal(Validator.validate(mega, { numbers: [1, 2, 3, 4, 5, 5] }).ok, false);
  assert.equal(Validator.validate(mega, { numbers: [0, 2, 3, 4, 5, 6] }).ok, false);
  assert.equal(Validator.validate(mega, { numbers: [1, 2, 3, 4, 5] }).ok, false);
  assert.equal(Validator.validate(mega, { numbers: ['a', 2, 3, 4, 5, 6] }).ok, false);
  assert.equal(Validator.validate(power, { numbers: [1, 2, 3, 4, 5, 55] }).ok, true);
  assert.equal(Validator.validate(power, { numbers: [1, 2, 3, 4, 5, 55], special: 56 }).ok, false);
  assert.equal(Validator.validate(power, { numbers: [1, 2, 3, 4, 5, 55], special: '' }).ticket.special, null);
});
