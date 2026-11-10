# Vietlott Checker

Web app tra cứu & đối chiếu vé Vietlott với **toàn bộ lịch sử kết quả quay thưởng**, liệt kê các kỳ có từ N số trùng trở lên (mặc định 3).

> Đây là công cụ **thống kê lịch sử**. Trùng 3/4/5/6 số với một kỳ trong quá khứ **không** có nghĩa vé hiện tại trúng thưởng, và không dự đoán kết quả tương lai.

## Deploy lên GitHub Pages (web tĩnh, miễn phí)

Bản chính thức là **web tĩnh**: trình duyệt tự đối chiếu, dữ liệu là file JSON do GitHub Actions cập nhật hằng ngày.

1. Tạo repo **public** trên GitHub (ví dụ `vietlott-checker`) và push toàn bộ thư mục này lên nhánh `main`
   (gồm cả `data/*.json` — đây là dữ liệu đã kiểm định, giúp lần chạy đầu không phải tải lại từ đầu).
2. Vào **Settings → Pages → Build and deployment → Source**, chọn **GitHub Actions**.
3. Vào tab **Actions → “Cập nhật dữ liệu & deploy GitHub Pages” → Run workflow** để deploy lần đầu
   (hoặc chỉ cần push lên `main`).
4. Web có địa chỉ `https://<tên-tài-khoản>.github.io/<tên-repo>/`.

Workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

- Chạy lúc **19:35, 21:20 và 07:35 giờ VN** mỗi ngày (sau các mốc vietlott-data cập nhật ~19:01 và ~07:01), khi push lên `main`, hoặc bấm chạy tay.
- `npm test` → `npm run sync` → commit `data/*.json` **chỉ khi có kỳ mới / bản ghi được sửa** → `npm run build` → deploy.
- Nếu đồng bộ lỗi (mất mạng, nguồn bị chặn), vẫn deploy dữ liệu đã có — không bao giờ đăng dữ liệu giả.
- Mỗi lần chạy có bảng tóm tắt (số kỳ, kỳ mới, vietlott.vn có kết nối được không, kết quả kiểm tra chéo) trong trang chi tiết của lần chạy đó.

Lưu ý: GitHub có thể chạy lịch trễ vài chục phút; lịch tự động bị tắt nếu repo không có hoạt động 60 ngày (thường không xảy ra vì có commit dữ liệu mới) — khi đó vào tab Actions bật lại.

## Chạy trên máy

```bash
npm install
npm start               # bản có server: http://localhost:3000 (tự đồng bộ khi dữ liệu cũ hơn 6 giờ)
npm run sync            # cập nhật dữ liệu (tùy chọn: npm run sync mega645)
npm run build           # đóng gói web tĩnh vào dist/
npm run preview:static  # xem bản tĩnh giống GitHub Pages: http://localhost:4173/vietlott-checker/
npm test                # 16 test: thuật toán đối chiếu, kiểm tra vé, parser, đồng bộ & mất kết nối
```

Yêu cầu Node.js ≥ 18.17. Frontend chỉ đọc `data/index.json` và `data/<sản phẩm>.json` bằng đường dẫn tương đối, nên cùng một mã chạy được trên GitHub Pages lẫn server Express.

## Nguồn dữ liệu (đã kiểm tra thực tế 10/11/2026)

| Nguồn | Vai trò | Ghi chú |
|---|---|---|
| **vietlott.vn** – endpoint AjaxPro `Game645/655ResultDetailWebPart.ServerSideDrawResult` (chính trang kết quả dùng) | Nguồn chính thức: bù kỳ thiếu, sửa bản ghi lỗi, lấy kỳ mới nhất, kiểm tra chéo | Trả về từng kỳ dạng HTML; kỳ không tồn tại → `Error: true` |
| **github.com/vietvudanh/vietlott-data** – `data/power645.jsonl`, `power655.jsonl` | Tải hàng loạt lịch sử nhanh | Cập nhật 2 lần/ngày. Mega thiếu kỳ 1–197; Power kỳ #00944 bị sai (chép nhầm từ Mega) |

Vietlott không có API công khai chính thức có tài liệu; endpoint trên là endpoint nội bộ của website nên có thể thay đổi — khi đó chỉ cần sửa `server/providers/VietlottOfficialProvider.js`.

Quy trình đồng bộ (`server/services/SyncService.js`):

1. Tải JSONL từ GitHub → chuẩn hóa → kiểm định từng bản ghi (`drawValidator.js`).
2. Bản ghi lỗi, ngày quay bất thường, kỳ bị thiếu → lấy lại từ vietlott.vn.
3. Thăm dò các kỳ mới hơn bản ghi cuối trên vietlott.vn.
4. Kiểm tra chéo ngẫu nhiên 8 kỳ với vietlott.vn mỗi lần đồng bộ.
5. Lưu cache `data/<product>.json` (ghi nguyên tử). Nếu mọi nguồn lỗi → giữ cache cũ và báo lỗi; **không bao giờ tạo dữ liệu giả**.

Kết quả lần đồng bộ đầu: Mega 6/45 đủ **1.586 kỳ** (#00001 20/07/2016 → #01586), Power 6/55 đủ **1.421 kỳ** (#00001 01/08/2017 → #01421). Kiểm tra chéo 80 kỳ ngẫu nhiên: 0 sai lệch.

## Kiến trúc

```
shared/                       # dùng chung server + trình duyệt + Web Worker
  products.js                 # Product Configuration – cấu hình riêng từng sản phẩm
  ticketValidator.js          # kiểm tra vé (khoảng số, trùng số, định dạng)
  matchingEngine.js           # Result Matching Engine – matcher riêng theo thể lệ
  statisticsEngine.js         # Statistics Engine
server/
  providers/                  # Data Provider – BaseProvider, GitHub, vietlott.vn
  services/                   # DataStore (cache), SyncService, drawValidator, staticExport
  routes/api.js               # REST API (chế độ server)
  cli/                        # sync.js, build.js (→ dist/), preview-static.js
.github/workflows/deploy.yml  # cập nhật dữ liệu hằng ngày + deploy GitHub Pages
public/js/
  core/                       # dataService (ETag cache), ticketManager, checker (Web Worker)
  components/                 # UI Components: editor, list, tabs, summary, charts, results, modal
  worker/match.worker.js
```

### Thuật toán đối chiếu

- Vé và kết quả đều là tập số không lặp → đếm bằng bảng tra `Uint8Array`, mỗi số chỉ đếm 1 lần, O(kỳ × 6).
- Chỉ trả về kỳ có `số trùng ≥ ngưỡng`; sắp xếp số trùng giảm dần, bằng nhau thì kỳ mới nhất trước.
- **Power 6/55**: số Power (số thứ 7) **không bao giờ** được cộng vào số lượng số chính trùng.
  - *Chỉ 6 số chính*: bỏ qua số Power.
  - *Kèm số Power*: số Power của kỳ được so với 6 số trên vé (đúng thể lệ), hoặc với ô “Số Power riêng” nếu người dùng nhập. Kết quả báo riêng (vd. “Trùng 5 số + Trùng số Power”).
- Keno, Max 3D, Max 3D Pro, Max 3D+, Bingo18 đã có cấu hình thể lệ trong `products.js`; cần thêm matcher riêng trong `MATCHERS` và provider dữ liệu để bật.

## API (chỉ có khi chạy server Express — `npm start`)

| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/data/index.json`, `/data/:product.json` | Cùng định dạng file tĩnh trên GitHub Pages (frontend dùng) |
| GET | `/api/products` | Danh sách sản phẩm + trạng thái dữ liệu |
| GET | `/api/draws/:product` | Toàn bộ lịch sử (dạng gọn, có ETag/304) |
| GET | `/api/status/:product` | Trạng thái đồng bộ, báo cáo kiểm định |
| POST | `/api/sync/:product` | Bắt đầu cập nhật dữ liệu (202) |
| POST | `/api/check` | Đối chiếu phía server: `{product, tickets:[{numbers, special?}], threshold, powerMode}` |
