HƯỚNG DẪN THU ÂM CHO MÀN HÌNH BỆNH NHÂN (/patient-screen)
===========================================================

Màn hình bệnh nhân đọc số bằng cách GHÉP NỐI các file âm thanh ngắn đặt trong CHÍNH thư mục này
(public/patient-screen/audio/), theo đúng câu:

    "Mời bệnh nhân có số thứ tự, <số>, vào quầy số, <số quầy>."

Cần thu đúng 12 file, đặt TÊN FILE CHÍNH XÁC như dưới đây (chữ thường, không dấu, đuôi .mp3),
để ngay trong thư mục này (không tạo thêm thư mục con):

  Tên file              Nội dung cần đọc (đọc rõ, chậm rãi, giọng nữ)
  --------------------  ----------------------------------------------
  0.mp3                 "không"
  1.mp3                 "một"
  2.mp3                 "hai"
  3.mp3                 "ba"
  4.mp3                 "bốn"
  5.mp3                 "năm"
  6.mp3                 "sáu"
  7.mp3                 "bảy"
  8.mp3                 "tám"
  9.mp3                 "chín"
  moi-so-thu-tu.mp3     "Mời bệnh nhân có số thứ tự"
  vao-quay-so.mp3       "vào quầy số"

CÁCH HỆ THỐNG GHÉP LẠI KHI GỌI SỐ (ví dụ số 007, quầy Q01):
  moi-so-thu-tu.mp3 → 0.mp3 → 0.mp3 → 7.mp3 → vao-quay-so.mp3 → 1.mp3
  (đọc: "Mời bệnh nhân có số thứ tự, không, không, bảy, vào quầy số, một.")

--------------------------------------------------------------------------------
TÙY CHỌN THÊM: đọc CHỮ CÁI TIỀN TỐ (chỉ cần nếu có bật SEPARATE_PRIORITY_SEQUENCE trong .env)
--------------------------------------------------------------------------------
Khi bật SEPARATE_PRIORITY_SEQUENCE=true (xem .env.example), mỗi số thứ tự có thêm 1 CHỮ CÁI
đứng trước (mặc định: "T" cho vé thường, "U" cho vé ưu tiên — ví dụ "T007", "U012"). Để loa đọc
được cả chữ cái này, thu THÊM 1 file MP3 riêng cho MỖI chữ cái đang dùng, đặt tên file là CHÍNH
chữ cái đó viết THƯỜNG (không dấu):

  Tên file    Nội dung cần đọc                  Ứng với biến .env nào
  ----------  ---------------------------------  --------------------------------
  t.mp3       "tê" (hoặc đọc rõ chữ cái "T")     NORMAL_SEQ_PREFIX (mặc định T)
  u.mp3       "u" (hoặc đọc rõ chữ cái "U")      PRIORITY_SEQ_PREFIX (mặc định U)

Nếu đổi PRIORITY_SEQ_PREFIX/NORMAL_SEQ_PREFIX sang chữ cái khác trong .env (ví dụ "A", "B"), cần
thu file mp3 tên đúng chữ cái mới đó (chữ thường, ví dụ "a.mp3", "b.mp3") thay cho t.mp3/u.mp3.

File tiền tố được PHÁT NGAY SAU câu "Mời bệnh nhân có số thứ tự" và TRƯỚC 3 chữ số, ví dụ số
U007, quầy Q01:
  moi-so-thu-tu.mp3 → u.mp3 → 0.mp3 → 0.mp3 → 7.mp3 → vao-quay-so.mp3 → 1.mp3
  (đọc: "Mời bệnh nhân có số thứ tự, u, không, không, bảy, vào quầy số, một.")

Nếu KHÔNG bật SEPARATE_PRIORITY_SEQUENCE (mặc định), vé không có tiền tố nên KHÔNG cần các file
này — hệ thống tự động bỏ qua bước đọc chữ cái, chỉ đọc số như trước nay.

Nếu ĐÃ bật tính năng nhưng CHƯA kịp thu file t.mp3/u.mp3, hệ thống KHÔNG bị lỗi hay câm — tự động
rơi xuống đọc dự phòng bằng giọng máy (xem mục "DỰ PHÒNG" bên dưới) cho đúng cả câu, chờ đến khi
bạn thu xong thì copy vào là tự chuyển sang phát file thu sẵn ngay, không cần khởi động lại gì cả.

Lưu ý khi thu âm:
- Số thứ tự LUÔN đọc đủ 3 chữ số (kể cả số 0 ở đầu, ví dụ số 7 sẽ đọc "không, không, bảy") — đây
  là cách đọc số phổ biến ở bệnh viện/ngân hàng thực tế, tránh nhầm lẫn khi có nhiều số gần nhau.
- Số quầy đã tự bỏ chữ cái và số 0 ở đầu (ví dụ mã quầy "Q01" chỉ đọc số "một", không đọc "Q").
  Nếu quầy có mã 2 chữ số (ví dụ "Q12"), hệ thống sẽ đọc TỪNG CHỮ SỐ MỘT ("một, hai") vì chỉ có
  sẵn 10 file chữ số riêng lẻ — không đọc được kiểu "mười hai". Nếu muốn quầy 2 chữ số đọc tự
  nhiên hơn, có thể thu thêm rồi báo lại để chỉnh hệ thống đọc nguyên số quầy bằng 1 file riêng.
- Thu từng file NGẮN GỌN, không có khoảng lặng thừa ở đầu/cuối file (hệ thống đã tự chèn 1 khoảng
  nghỉ ngắn ~0.1s giữa các file khi ghép, không cần tự để lặng thêm).
- Định dạng: .mp3 (khuyến nghị, phát được trên mọi trình duyệt). Có thể dùng .wav nếu muốn chất
  lượng cao hơn — nếu vậy cần đổi phần mở rộng trong code (`public/patient-screen/index.html`,
  tìm chuỗi ".mp3") sang ".wav", báo lại nếu cần hỗ trợ đổi giúp.
- Chất lượng khuyến nghị: giọng nữ, tốc độ vừa/chậm, phòng thu yên tĩnh, âm lượng đồng đều giữa
  các file (nghe thử nối tiếp không bị file này to file kia nhỏ).

SAU KHI THU XONG:
1. Copy toàn bộ 12 file .mp3 vào ĐÚNG thư mục này trên máy chủ:
   queue-system-nodesqlite/public/patient-screen/audio/
2. KHÔNG cần khởi động lại server — đây là file tĩnh, server tự phục vụ ngay khi copy vào.
3. Mở trang thử âm thanh để nghe thử trước khi dùng thật:
   http://<ip-máy-chủ>:4000/audio-test
   (nhập thử vài số + số quầy khác nhau, bấm nghe — không ảnh hưởng dữ liệu thật)

DỰ PHÒNG:
Nếu thiếu bất kỳ file nào ở trên (hoặc quên chưa thu xong), màn hình bệnh nhân sẽ TỰ ĐỘNG chuyển
sang đọc bằng giọng máy có sẵn của trình duyệt (Web Speech API, như phiên bản trước) cho đúng câu
đó — không bao giờ bị câm hoàn toàn, dù bạn thu dần từng file một cũng không sao.
