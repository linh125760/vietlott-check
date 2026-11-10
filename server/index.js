const { createApp, createServices } = require('./app');
const Products = require('../shared/products');

const PORT = Number(process.env.PORT) || 3000;
const services = createServices();
const app = createApp(services);

app.listen(PORT, () => {
  console.log(`Vietlott Checker đang chạy tại http://localhost:${PORT}`);
  // Cập nhật nền khi khởi động nếu dữ liệu chưa có hoặc đã cũ
  for (const p of Products.list().filter((x) => x.enabled)) services.sync.ensureFresh(p.id);
  // Kiểm tra định kỳ mỗi giờ
  setInterval(() => {
    for (const p of Products.list().filter((x) => x.enabled)) services.sync.ensureFresh(p.id);
  }, 60 * 60 * 1000).unref();
});
