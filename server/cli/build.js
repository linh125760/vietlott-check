/**
 * Build bản web tĩnh cho GitHub Pages: npm run build → dist/
 *   dist/index.html, css/, js/      ← public/
 *   dist/shared/                    ← shared/ (engine dùng chung)
 *   dist/data/index.json, <id>.json ← dữ liệu đã kiểm định trong data/
 * Không gọi mạng: chỉ đóng gói dữ liệu đã có (chạy `npm run sync` trước để cập nhật).
 */
const fs = require('fs');
const path = require('path');
const DataStore = require('../services/DataStore');
const Products = require('../../shared/products');
const { productPayload, indexPayload } = require('../services/staticExport');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, process.argv[2] || 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
fs.cpSync(path.join(ROOT, 'public'), OUT, { recursive: true });
fs.cpSync(path.join(ROOT, 'shared'), path.join(OUT, 'shared'), { recursive: true });
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const store = new DataStore(path.join(ROOT, 'data'));
let missing = 0;
for (const p of Products.list().filter((x) => x.enabled)) {
  const data = store.load(p.id);
  if (!data || !data.draws.length) {
    console.error(`✖ Chưa có dữ liệu ${p.name} — hãy chạy "npm run sync" trước.`);
    missing++;
    continue;
  }
  fs.writeFileSync(path.join(OUT, 'data', `${p.id}.json`), JSON.stringify(productPayload(p.id, data)));
  console.log(`✔ ${p.name}: ${data.meta.count} kỳ (đến #${data.meta.lastDraw.id} ${data.meta.lastDraw.date})`);
}
fs.writeFileSync(path.join(OUT, 'data', 'index.json'), JSON.stringify(indexPayload(store)));
console.log(`Đã build vào ${path.relative(ROOT, OUT) || '.'}/`);
process.exit(missing ? 1 : 0);
