/**
 * Cấu hình nguồn dữ liệu (đã kiểm tra thực tế ngày 2026-11-10).
 *
 * 1) Trang chính thức vietlott.vn — endpoint AjaxPro dùng bởi chính trang kết quả:
 *      POST /ajaxpro/Vietlott.PlugIn.WebParts.Game{645|655}ResultDetailWebPart,Vietlott.PlugIn.WebParts.ashx
 *      Header X-AjaxPro-Method: ServerSideDrawResult
 *      Body {"ORenderInfo":{...},"Key":"<key>","DrawId":"00944"}
 *    → trả về HTML của từng kỳ quay. Dùng để bù kỳ thiếu, sửa bản ghi lỗi, lấy kỳ mới nhất
 *      và kiểm tra chéo độ chính xác.
 *
 * 2) Repository GitHub công khai vietvudanh/vietlott-data — file JSONL lịch sử, cập nhật 2 lần/ngày.
 *      Mega 6/45: từ kỳ #00198 (2017-10-25) — thiếu kỳ 1–197 → bù từ vietlott.vn
 *      Power 6/55: từ kỳ #00001 (2017-08-01) — bản ghi #00944 sai (thiếu số Power, sai ngày/số)
 *    → dùng để tải hàng loạt lịch sử nhanh, sau đó được kiểm định.
 */
module.exports = {
  github: {
    baseUrl: 'https://raw.githubusercontent.com/vietvudanh/vietlott-data/master/data/',
    files: { mega645: 'power645.jsonl', power655: 'power655.jsonl' },
    timeoutMs: 30000
  },
  official: {
    baseUrl: 'https://vietlott.vn',
    renderInfoPath: '/ajaxpro/Vietlott.Utility.WebEnvironments,Vietlott.Utility.ashx',
    siteId: 'main.frontend.vi',
    games: {
      mega645: { webPart: 'Game645ResultDetailWebPart', key: 'f545414f', page: '/vi/trung-thuong/ket-qua-trung-thuong/645' },
      power655: { webPart: 'Game655ResultDetailWebPart', key: '2c150d4d', page: '/vi/trung-thuong/ket-qua-trung-thuong/655' }
    },
    timeoutMs: 15000,
    concurrency: 4,
    retries: 2
  },
  sync: {
    staleAfterMs: 6 * 60 * 60 * 1000, // tự cập nhật khi dữ liệu cũ hơn 6 giờ
    maxOfficialFetchPerSync: 400,      // giới hạn số request tới vietlott.vn mỗi lần đồng bộ
    probeNewDraws: 10,                 // thử lấy tối đa N kỳ mới hơn bản ghi cuối
    verifySample: 8                    // số kỳ kiểm tra chéo ngẫu nhiên với nguồn chính thức
  }
};
