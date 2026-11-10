/** Cập nhật dữ liệu từ dòng lệnh: npm run sync [mega645|power655] */
const fs = require('fs');
const { createServices } = require('../app');
const Products = require('../../shared/products');

(async () => {
  const { sync, store } = createServices();
  const summary = ['## Đồng bộ dữ liệu Vietlott', '', '| Sản phẩm | Số kỳ | Kỳ mới nhất | Kỳ mới | vietlott.vn | Kiểm tra chéo | Ghi chú |', '|---|---|---|---|---|---|---|'];
  let changed = false;
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Products.list().filter((p) => p.enabled).map((p) => p.id);
  let failed = false;
  for (const id of ids) {
    const timer = setInterval(() => {
      const s = sync.state(id);
      if (s.running) console.log(`  [${id}] ${s.phase} ${s.done}/${s.total} – ${s.message}`);
    }, 3000);
    const before = store.load(id);
    const beforeVersion = before ? before.meta.version : null;
    const beforeLast = before && before.meta.lastDraw ? before.meta.lastDraw.id : null;
    try {
      const data = await sync.sync(id);
      const r = data.meta.report;
      console.log(`✔ ${id}: ${data.meta.count} kỳ (${data.meta.firstDraw.id} ${data.meta.firstDraw.date} → ${data.meta.lastDraw.id} ${data.meta.lastDraw.date})`);
      console.log(`  Nguồn: ${JSON.stringify(data.meta.sourcesUsed)} | sửa: ${r.totalCorrections} | thiếu: ${r.missing.length} | kiểm tra chéo: ${r.verification.mismatches}/${r.verification.checked} sai lệch`);
      for (const c of r.corrections.slice(0, 10)) console.log(`   · ${c.id}: ${c.reason}`);
      for (const w of r.warnings) console.log(`  ⚠ ${w}`);
      const isChanged = data.meta.version !== beforeVersion;
      if (isChanged) changed = true;
      const newDraws = beforeLast ? Number(data.meta.lastDraw.id) - Number(beforeLast) : data.meta.count;
      summary.push(`| ${id} | ${data.meta.count} | #${data.meta.lastDraw.id} (${data.meta.lastDraw.date}) | ${newDraws > 0 ? '+' + newDraws : (isChanged ? 'đã sửa dữ liệu' : '0')} | ${r.official.reachable ? '✅ kết nối được' : '⚠️ không kết nối được'} | ${r.verification.mismatches}/${r.verification.checked} sai lệch | ${r.warnings.join('; ') || ''} |`);
    } catch (err) {
      failed = true;
      console.error(`✖ ${id}: ${err.message}`);
      summary.push(`| ${id} | — | — | — | — | — | ❌ ${err.message} |`);
    } finally { clearInterval(timer); }
  }
  // Báo cáo cho GitHub Actions: bảng tóm tắt + cờ "changed" (chỉ commit khi dữ liệu kỳ quay thay đổi)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
  console.log(changed ? 'Dữ liệu kỳ quay đã thay đổi.' : 'Không có thay đổi về kỳ quay.');
  process.exit(failed ? 1 : 0);
})();
