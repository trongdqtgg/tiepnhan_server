const path = require('path');

/**
 * Thư mục GỐC của ứng dụng - nơi chứa (hoặc sẽ chứa) thư mục public/, file .env, và thư mục data/.
 * Dùng THAY CHO __dirname/process.cwd() rải rác khắp nơi, vì 2 cách đó cho kết quả KHÁC NHAU tuỳ
 * vào đang chạy kiểu gì:
 *
 *  - Chạy bình thường bằng "node src/server.js" (hoặc "npm start") trong lúc phát triển, hoặc khi
 *    cài qua trình cài đặt Inno Setup (xem packaging/windows-installer/) - lúc này __dirname là
 *    .../src, gốc dự án là 1 cấp trên, và cwd (thư mục làm việc) cũng chính là gốc dự án nếu chạy
 *    đúng cách (start-server.bat đã tự "cd /d %~dp0" trước khi chạy).
 *
 *  - Đóng gói thành 1 file .exe DUY NHẤT bằng Node.js SEA (Single Executable Application - xem
 *    packaging/exe-build/) để ẨN MÃ NGUỒN phần server (thư mục src/, kèm toàn bộ node_modules)
 *    khỏi người dùng cuối/đối tác triển khai: lúc này KHÔNG CÒN __dirname/file .js thật nào trên
 *    đĩa nữa (toàn bộ đã được gộp + làm rối mã + nhúng vào bên trong file .exe) - phải lấy thư mục
 *    CHỨA FILE .exe ĐANG CHẠY (process.execPath) làm gốc, vì public/ (giao diện), .env (cấu hình),
 *    và data/ (dữ liệu SQLite) vẫn là FILE/THƯ MỤC RIÊNG nằm CẠNH file .exe (CỐ Ý không đóng gói
 *    theo, xem đợt 16 trong README) để quản trị viên vẫn tự do sửa giao diện/cấu hình mà không cần
 *    build lại .exe.
 */
function getAppRoot() {
  let isSea = false;
  try {
    // "node:sea" chỉ có từ Node 20+ và chỉ báo true khi ĐANG chạy bên trong 1 file .exe được đóng
    // gói bằng cơ chế Single Executable Application - require() có thể ném lỗi trên bản Node quá
    // cũ, bắt lại và coi như KHÔNG PHẢI SEA (dùng cách tính __dirname như cũ) cho an toàn.
    isSea = require('node:sea').isSea();
  } catch {
    isSea = false;
  }
  if (isSea) return path.dirname(process.execPath);
  return path.join(__dirname, '..', '..'); // src/config/ -> src/ -> gốc dự án
}

module.exports = { getAppRoot };
