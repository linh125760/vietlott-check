const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Products = require('../shared/products');
const VietlottOfficialProvider = require('../server/providers/VietlottOfficialProvider');
const GithubDatasetProvider = require('../server/providers/GithubDatasetProvider');
const { validateDraw, findDateAnomalies } = require('../server/services/drawValidator');
const DataStore = require('../server/services/DataStore');
const SyncService = require('../server/services/SyncService');
const { ProviderError } = require('../server/providers/BaseProvider');

const mega = Products.get('mega645');
const power = Products.get('power655');

// Đoạn HTML thật lấy từ vietlott.vn (kỳ Power #00944)
const OFFICIAL_HTML = `<h5>Kỳ quay thưởng <b>#00944</b> ngày <b>14/10/2023</b></h5> </div></div>
  <div class="day_so_ket_qua_v2">
  <span class="bong_tron small">08</span><span class="bong_tron small">23</span><span class="bong_tron small">30</span><span class="bong_tron small">34</span><span class="bong_tron small">38</span><span class="bong_tron small">47</span><i>|</i><span class="bong_tron small no-margin-right active">10</span>
  </div>`;

test('Parser vietlott.vn tách đúng 6 số chính và số Power', () => {
  const r = new VietlottOfficialProvider().parse(power, OFFICIAL_HTML);
  assert.deepEqual(r, { id: '00944', drawNo: 944, date: '2023-10-14', main: [8, 23, 30, 34, 38, 47], special: 10, source: 'vietlott' });
  assert.deepEqual(validateDraw(power, r), []);
});

test('Chuẩn hóa GitHub: phần tử thứ 7 là số Power, không phải số chính', () => {
  const g = new GithubDatasetProvider();
  const p = g.normalize(power, { date: '2026-11-07', id: '01421', result: [5, 19, 20, 26, 44, 53, 39] });
  assert.deepEqual(p.main, [5, 19, 20, 26, 44, 53]);
  assert.equal(p.special, 39);
  const m = g.normalize(mega, { date: '2026-11-08', id: '01586', result: [1, 2, 14, 20, 23, 36] });
  assert.equal(m.special, null);
  assert.deepEqual(validateDraw(mega, m), []);
});

test('Validator phát hiện bản ghi lỗi (thiếu số Power như kỳ #00944 trên GitHub)', () => {
  const bad = { id: '00944', drawNo: 944, date: '2022-09-23', main: [1, 12, 21, 28, 30, 44], special: null };
  assert.ok(validateDraw(power, bad).length > 0);
  assert.ok(validateDraw(mega, { ...bad, main: [1, 1, 2, 3, 4, 5] }).length > 0);
  assert.ok(validateDraw(mega, { ...bad, main: [1, 2, 3, 4, 5, 46] }).length > 0);
  assert.ok(validateDraw(power, { ...bad, special: 44 }).length > 0); // Power trùng số chính
});

test('Phát hiện ngày quay bất thường', () => {
  const s = findDateAnomalies([
    { drawNo: 943, date: '2023-10-12' }, { drawNo: 944, date: '2022-09-23' }, { drawNo: 945, date: '2023-10-17' }
  ]);
  assert.ok(s.has(944));
});

function fakeProviders({ bulk, official }) {
  return {
    bulkProvider: { name: 'bulk', fetchAll: bulk },
    drawProvider: { name: 'official', fetchDraw: official }
  };
}
const quiet = { info() {}, warn() {}, error() {} };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
const rec = (no, date, main, special = null, source = 'github') => ({ id: String(no).padStart(5, '0'), drawNo: no, date, main, special, source });

test('Sync: bù kỳ thiếu, sửa bản ghi lỗi, ưu tiên nguồn chính thức', async () => {
  const store = new DataStore(tmp());
  const official = {
    1: rec(1, '2017-08-01', [1, 2, 3, 4, 5, 6], 7, 'vietlott'),
    3: rec(3, '2017-08-05', [10, 11, 12, 13, 14, 15], 16, 'vietlott')
  };
  const sync = new SyncService({
    store, logger: quiet,
    config: { staleAfterMs: 1e9, maxOfficialFetchPerSync: 100, probeNewDraws: 3, verifySample: 0 },
    ...fakeProviders({
      bulk: async () => ({ draws: [rec(2, '2017-08-03', [7, 8, 9, 10, 11, 12], 13), rec(3, '2016-01-01', [1, 2, 3, 4, 5, 6], null)], rejected: [] }),
      official: async (p, no) => official[no] || null
    })
  });
  const data = await sync.sync('power655');
  assert.deepEqual(data.draws.map((x) => x.drawNo), [1, 2, 3]);
  assert.equal(data.draws[2].special, 16);      // bản ghi lỗi đã được thay
  assert.equal(data.draws[0].source, 'vietlott'); // kỳ thiếu đã được bù
  assert.equal(data.meta.report.missing.length, 0);
});

test('Sync: mọi nguồn lỗi → giữ cache cũ, báo lỗi, không tạo dữ liệu giả', async () => {
  const store = new DataStore(tmp());
  store.save('mega645', [rec(1, '2016-07-20', [2, 17, 33, 37, 38, 45])], { lastSuccess: '2026-01-01T00:00:00Z' });
  const fail = async () => { throw new ProviderError('offline', { code: 'NETWORK' }); };
  const sync = new SyncService({
    store, logger: quiet,
    config: { staleAfterMs: 1e9, maxOfficialFetchPerSync: 10, probeNewDraws: 2, verifySample: 2 },
    ...fakeProviders({ bulk: fail, official: fail })
  });
  await assert.rejects(sync.sync('mega645'), /Mất kết nối/);
  const kept = store.load('mega645');
  assert.equal(kept.draws.length, 1);
  assert.equal(sync.status('mega645').sync.phase, 'error');
});

test('Sync: không có cache và mọi nguồn lỗi → lỗi rõ ràng', async () => {
  const fail = async () => { throw new ProviderError('offline', { code: 'NETWORK' }); };
  const sync = new SyncService({
    store: new DataStore(tmp()), logger: quiet,
    config: { staleAfterMs: 1e9, maxOfficialFetchPerSync: 10, probeNewDraws: 2, verifySample: 0 },
    ...fakeProviders({ bulk: fail, official: fail })
  });
  await assert.rejects(sync.sync('mega645'), /Không lấy được dữ liệu/);
});

test('Xuất dữ liệu tĩnh: định dạng gọn mà frontend đọc', () => {
  const { productPayload } = require('../server/services/staticExport');
  const out = productPayload('power655', {
    meta: { version: 'abc', count: 1, report: { official: { reachable: true }, verification: { checked: 1, mismatches: 0 }, missing: [], warnings: [] } },
    draws: [rec(944, '2023-10-14', [8, 23, 30, 34, 38, 47], 10, 'vietlott')]
  });
  assert.deepEqual(out.draws, [['00944', '2023-10-14', [8, 23, 30, 34, 38, 47], 10, 'vietlott']]);
  assert.equal(out.meta.officialReachable, true);
  assert.equal(out.meta.report, undefined); // không lộ báo cáo nội bộ chi tiết
});
