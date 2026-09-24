# Hệ thống bắt số tự động (bản KHÔNG cần MongoDB, KHÔNG cần build native module)

Node.js + Express + **`node:sqlite`** (SQLite có sẵn bên trong Node.js) + Socket.io. Đây là bản
thay thế của project gốc dùng MongoDB — **không cần cài đặt hay chạy bất kỳ server database nào
cả**, và cũng **không cần trình biên dịch (Python/Visual Studio Build Tools) như bản dùng
`better-sqlite3`**, vì `node:sqlite` đã có sẵn trong chính Node.js, không phải biên dịch gì thêm.
Toàn bộ dữ liệu nằm trong 1 file `.db` ngay trong thư mục `data/` của project.

Đầy đủ tính năng như bản MongoDB: kiosk bốc số 2 vai trò (bệnh nhân tự quét QR CCCD/BHYT — bắt
buộc, chống spam; nhân viên cấp số không cần QR, kể cả mức Cấp cứu ưu tiên cao nhất), màn hình quầy tiếp nhận, màn
hình bệnh nhân riêng từng quầy (có **đọc số bằng giọng nói** — xem mục 4), màn hình chờ chung, in
phiếu qua máy in nhiệt (ESC/POS), tự động xoá dữ liệu vé sau 3 ngày, ứng dụng widget desktop luôn
nổi bên trên (mục 4e, có thể tự mở màn hình bệnh nhân toàn màn hình ở màn hình phụ), và **tuyệt đối
không gọi trùng số** dù nhiều quầy cùng bấm "gọi số tiếp theo" một lúc.

## Vì sao chọn `node:sqlite` thay vì MongoDB (hay `better-sqlite3`)?

- Không cần cài đặt, không cần khởi động service database riêng — chỉ `npm install` là chạy được
  ngay.
- Không cần biên dịch native module: các bản dùng `better-sqlite3` đôi khi lỗi trên Windows do máy
  chưa cài Python/Visual Studio Build Tools (đúng lỗi bạn vừa gặp). `node:sqlite` có sẵn trong
  chính Node.js nên không có bước biên dịch nào cả, cài xong dùng ngay.
- Toàn bộ dữ liệu là 1 file `data/queue.db` — backup chỉ cần copy file này, khôi phục chỉ cần dán
  đè lại.
- Vẫn đảm bảo an toàn tuyệt đối khi nhiều quầy gọi số cùng lúc: `node:sqlite` chạy đồng bộ
  (synchronous) trong cùng 1 tiến trình Node.js, nên thao tác "chọn + khoá vé" được bọc trong 1
  transaction (`BEGIN...COMMIT` thủ công) không bao giờ bị xen ngang bởi request khác — tương
  đương với cơ chế atomic của MongoDB ở bản đầu tiên, chỉ khác cách hiện thực.
- Phù hợp nhất khi hệ thống chạy trên **1 máy chủ duy nhất** tại phòng khám/bệnh viện (mô hình phổ
  biến nhất với quy mô vừa và nhỏ). Nếu sau này cần nhiều máy chủ backend cùng ghi vào 1 nơi dữ
  liệu (scale ngang), lúc đó mới cần quay lại một database dạng client-server như MongoDB/PostgreSQL.

## 1. Yêu cầu trước khi cài đặt

- **Node.js bản 22.5.0 trở lên** (khuyến nghị dùng bản LTS mới nhất) — đây là điều kiện bắt buộc
  vì `node:sqlite` chỉ có từ bản này trở đi. Kiểm tra phiên bản đang cài: `node -v`. Nếu máy đang
  cài bản cũ hơn, tải bản mới tại https://nodejs.org (chọn bản LTS).
- KHÔNG cần cài MongoDB, KHÔNG cần cài Python/Visual Studio Build Tools, KHÔNG cần bất kỳ database
  hay trình biên dịch nào khác.
- (Tuỳ chọn) máy in nhiệt hỗ trợ ESC/POS nếu muốn in phiếu thật.

## 2. Cài đặt

```bash
# Giải nén xong, vào thư mục project
cd queue-system-nodesqlite

# Cài dependency (không có native module nào cần biên dịch, cài rất nhanh)
npm install

# Tạo file cấu hình từ mẫu
cp .env.example .env
```

Mở file `.env` vừa tạo, chỉnh lại nếu cần (ví dụ đổi cổng `PORT`, hoặc bật máy in thật).

## 3. Tạo danh sách quầy tiếp nhận

Trước khi dùng lần đầu, tạo sẵn vài quầy mẫu (Q01, Q02, Q03 — sửa danh sách trong
`scripts/seedCounters.js` nếu số quầy thực tế khác):

```bash
npm run seed:counters
```

Lệnh này cũng tự tạo file database `data/queue.db` nếu chưa có. Script sẽ in ra `id` của từng quầy
— **lưu lại các id này** để mở đúng màn hình bệnh nhân cho từng quầy ở bước sau.

## 4. Chạy hệ thống

```bash
npm start
```

Thấy dòng `[OK] Hệ thống bắt số đang chạy tại http://localhost:4000` là server đã sẵn sàng. Mở các
đường link sau trên từng máy/màn hình tương ứng (đổi `localhost` thành địa chỉ IP máy chủ nếu mở từ
máy khác trong cùng mạng LAN, ví dụ `http://192.168.1.10:4000/kiosk`):

| Màn hình | Đường link | Dùng cho |
|---|---|---|
| **Trang chủ** | `http://<ip-máy-chủ>:4000/` | Màn hình chọn "Bệnh nhân" (vào thẳng kiosk) hoặc "Nhân viên" (yêu cầu mật khẩu) |
| Kiosk bốc số (**bệnh nhân**) | `http://<ip-máy-chủ>:4000/kiosk` | Máy có gắn máy quét QR + máy in nhiệt, đặt ở khu vực bệnh nhân **tự** bốc số — **không cần đăng nhập**, nhưng **bắt buộc quét CCCD/BHYT** |
| Kiosk cấp số (**nhân viên**) | `http://<ip-máy-chủ>:4000/staff-kiosk` | Máy do nhân viên vận hành để cấp số thay bệnh nhân — **yêu cầu mật khẩu**, cấp được **mọi** đối tượng ưu tiên (kể cả Cấp cứu) mà **không cần quét QR**, xem mục 4a/4b |
| Màn hình quầy (nhân viên) | `http://<ip-máy-chủ>:4000/counter` | Màn hình nhỏ của nhân viên tiếp nhận tại mỗi quầy — **yêu cầu mật khẩu**, xem mục 4a |
| Màn hình bệnh nhân từng quầy | `http://<ip-máy-chủ>:4000/patient-screen?counter=<ID_QUẦY>` | Màn hình lớn bệnh nhân nhìn thấy, đặt phía trên mỗi quầy |
| Màn hình chờ chung | `http://<ip-máy-chủ>:4000/waiting-screen` | Màn hình lớn ở sảnh chờ, tổng hợp tất cả các quầy |

`<ID_QUẦY>` lấy từ kết quả chạy `npm run seed:counters` ở bước 3, hoặc gọi
`http://<ip-máy-chủ>:4000/api/counters` để xem lại danh sách quầy và id.

**4a. Mật khẩu khu vực nhân viên.** Vào trang chủ (`/`), chọn "Nhân viên" sẽ hiện ô nhập mật khẩu
— mặc định là `His4@123` (khai báo ở biến `STAFF_PASSWORD` trong file `.env`). Đăng nhập đúng mới
vào được `/counter` và `/staff-kiosk` — sau khi đăng nhập thành công sẽ hiện các lựa chọn "Màn
hình quầy" và "Kiosk cấp số (NV)" để vào đúng chức năng cần dùng; còn nếu gõ thẳng địa chỉ
`/counter` hay `/staff-kiosk` mà
chưa đăng nhập thì tự động bị đưa về trang chủ để nhập mật khẩu, đăng nhập xong vào thẳng đúng
trang đó luôn (không thể lách qua bằng cách gõ URL trực tiếp). Phiên đăng nhập có hiệu lực 12 giờ
hoặc đến khi bấm "Đăng xuất".

**Đổi mật khẩu:** mở file `.env`, sửa dòng `STAFF_PASSWORD=...` thành mật khẩu mới, rồi **khởi động
lại server** (`npm start`) để áp dụng — mật khẩu mới có hiệu lực ngay, không cần sửa code.

**4b. Kiosk bốc số có 2 vai trò tách biệt:**

- **Kiosk bệnh nhân (`/kiosk`) — không cần đăng nhập, tự thao tác:**
  - **Bắt buộc phải quét CCCD hoặc thẻ BHYT** mới lấy được số — nút "Không có giấy tờ – Lấy số
    thường" đã được **bỏ hẳn**; server cũng từ chối (400) nếu client cố gọi thẳng API mà không có
    `id_number` (không thể lách qua giao diện).
  - Chỉ được chọn trong các đối tượng ưu tiên mà hệ thống **tự xác định được qua QR** vừa quét
    (≥75 tuổi, trẻ em, phụ nữ có thai, khuyết tật, người có công...) hoặc "Không thuộc diện ưu
    tiên – Lấy số thường"; **không** thấy được lựa chọn "Cấp cứu" (mục này chỉ nhân viên mới
    cấp được, xem bên dưới).
  - **Chống spam/lấy số trùng:** số CCCD/mã thẻ BHYT vừa quét được lưu lại cùng vé để đối chiếu.
    Ngay sau khi quét (chưa cần bấm "Tiếp tục"), hệ thống luôn hiển thị 1 dòng cảnh báo màu vàng
    báo cho biết lượt quét đang được đối chiếu; nếu đúng số giấy tờ này vừa lấy số trong vòng
    **`KIOSK_COOLDOWN_MINUTES`** phút gần nhất (mặc định **5 phút**, đổi được trong `.env`) thì
    cảnh báo chuyển sang màu đỏ, khoá nút "Tiếp tục" và nêu rõ còn phải đợi bao nhiêu phút — kiểm
    tra này cũng được **lặp lại ở phía server** khi tạo vé (trả về lỗi 429) để không thể lách qua
    bằng cách sửa giao diện.
  - Đổi thời gian "nghỉ": sửa `KIOSK_COOLDOWN_MINUTES=5` trong `.env` rồi khởi động lại server.
  - **Không dùng bàn phím/chuột — mọi bước "xác nhận" đều TỰ ĐỘNG sau vài giây:** vì bệnh nhân
    tại kiosk công khai chỉ được thao tác qua **máy quét mã vạch/QR**, hệ thống không được bắt
    buộc bấm nút mới đi tiếp được. Cụ thể:
    - Sau khi quét thành công (và không bị khoá do đang "nghỉ"), màn hình hiện dòng đếm ngược
      "Tự động tiếp tục sau N giây..." — hết giờ sẽ **tự động chuyển sang bước chọn đối tượng ưu
      tiên** (giống như bấm "Tiếp tục →"). Quét thêm giấy tờ khác trong lúc đang đếm sẽ khởi động
      lại bộ đếm.
    - Ở bước chọn đối tượng ưu tiên, màn hình cũng đếm ngược và **tự động chọn "Không thuộc diện
      ưu tiên – Lấy số thường"** nếu hết giờ mà bệnh nhân chưa chọn gì — đây là lựa chọn an toàn/
      công bằng mặc định, không tự cấp ưu tiên khi chưa có xác nhận.
    - Nếu lượt quét đang bị khoá bởi "nghỉ chống spam" (mục ở trên), hệ thống **không** tự động
      chuyển bước — bắt buộc phải quay lại sau, tránh vô tình tạo vé khi đang bị chặn.
    - Các nút bấm thủ công ("Tiếp tục →", các nút chọn đối tượng ưu tiên, "Không thuộc diện ưu
      tiên"...) **vẫn còn trên giao diện** làm phương án dự phòng (ví dụ nhân viên cần can thiệp),
      bấm vào sẽ hủy ngay bộ đếm tương ứng và xử lý ngay lập tức — không bắt buộc bệnh nhân phải
      bấm.
    - Đổi thời gian đếm ngược: sửa `KIOSK_AUTO_CONFIRM_SECONDS=5` trong `.env` (đơn vị giây) rồi
      khởi động lại server. Đặt `0` sẽ tắt hẳn việc tự động chuyển bước (quay lại yêu cầu bấm nút
      thủ công).

- **Kiosk nhân viên (`/staff-kiosk`) — yêu cầu đăng nhập mật khẩu, nhiều quyền hơn:**
  - Cấp số cho **bất kỳ đối tượng ưu tiên nào** chỉ bằng 1 cú bấm, **không cần quét QR/xác minh
    giấy tờ gì** — kể cả các mục vốn phải tự khai ở kiosk bệnh nhân.
  - Có thêm mục **"Cấp cứu"** — mức ưu tiên **cao nhất hệ thống** (trên cả "≥75 tuổi"), màu đỏ
    riêng biệt, chỉ cấp được từ kiosk nhân viên. Vé cấp cứu sẽ luôn được gọi trước tất cả các vé
    khác đang chờ khi quầy bấm "Gọi số tiếp theo".
  - **Không áp dụng** giới hạn "nghỉ 5 phút" chống spam khi cấp tự do — vì đây là nhân viên chủ
    động cấp số, không phải bệnh nhân tự bấm liên tục.
  - Có thể nhập tên bệnh nhân (không bắt buộc) trước khi chọn đối tượng để cấp số.
  - **Xác minh trước khi cấp (tuỳ chọn):** bấm 1 nút đối tượng sẽ **luôn** chuyển thẳng sang màn
    hình "Sẵn sàng quét" (không còn hộp thoại xác nhận hỏi trước như trước đây), tại đó nhân
    viên có 2 lựa chọn:
    - **Quét CCCD/BHYT** của bệnh nhân → hệ thống đối chiếu số CCCD/mã thẻ BHYT vừa quét với các
      vé đã lấy gần đây (dùng chung cơ chế chống spam với kiosk bệnh nhân, cùng cấu hình
      `KIOSK_COOLDOWN_MINUTES`): nếu người này **chưa** lấy số gần đây, hệ thống tự động cấp số
      ngay với đúng thông tin vừa quét; nếu **đã có** vé lấy trong khoảng thời gian đó rồi (kể
      cả tự lấy ở `/kiosk`), hệ thống cảnh báo đỏ và cho nhân viên chọn "Vẫn cấp số mới" (ghi
      đè, dùng khi thật sự cần) hoặc "Huỷ, không cấp" (tránh cấp trùng). Mục đích: tránh trường
      hợp bệnh nhân đã tự lấy số ở kiosk (`/kiosk`) rồi lại chạy sang quầy nhờ nhân viên lấy
      thêm số nữa.
    - Bấm **"🚀 Cấp số ngay"** → bỏ qua xác minh hoàn toàn, cấp số tự do ngay lập tức, không cần
      quét giấy tờ gì (dùng khi cấp cứu gấp hoặc không cần đối chiếu).
  - **📷 Chụp ảnh quét QR (điện thoại/máy tính bảng/iPad, không cần máy quét USB):** ở màn hình
    "Sẵn sàng quét" có thêm nút **"📷 Chụp ảnh quét QR"** — dùng khi nhân viên cầm điện thoại/máy
    tính bảng đi cấp số lưu động, không có máy quét mã vạch/QR USB cắm kèm. Bấm vào sẽ mở **app
    Camera gốc** của máy (ưu tiên camera **sau**), nhân viên bấm chụp **1 tấm ảnh** chứa mã QR
    CCCD/BHYT, hệ thống tự đọc mã QR từ tấm ảnh đó và xử lý y hệt như quét bằng máy USB.
    - Chạy được ngay trên địa chỉ `http://` thường (địa chỉ IP LAN bình thường của máy chủ) —
      **không cần cấu hình HTTPS/chứng chỉ gì cả**, vì đây là chuyển giao sang app Camera có sẵn
      của hệ điều hành (không phải xem video trực tiếp trong trang), nên không bị ràng buộc bởi
      quy định bảo mật "chỉ dùng camera khi có HTTPS" như cách xem camera trực tiếp thông thường.
    - Khác với xem camera trực tiếp: mỗi lần quét cần **bấm chụp 1 lần**, không tự động dò liên
      tục — đơn giản, ổn định và dùng được ngay trên mọi thiết bị mà không cần cấu hình gì thêm.
      Nếu chụp không đọc được mã (mờ, thiếu sáng, lệch góc), hệ thống báo rõ và cho chụp lại.
**📱 PWA (Progressive Web App) trên MỌI màn hình:** không riêng `/staff-kiosk`, tất cả các màn
hình của hệ thống (`/`, `/kiosk`, `/staff-kiosk`, `/counter`, `/patient-screen`, `/waiting-screen`)
đều được cấu hình như 1 PWA: giao diện cố định không bị pinch-zoom/double-tap-zoom khi dùng trên
di động/máy tính bảng, và có thể **"Thêm vào Màn hình chính"** để mở nhanh như 1 app riêng (Android:
menu trình duyệt → "Cài đặt ứng dụng"/"Thêm vào Màn hình chính"; iOS/iPadOS Safari: nút Chia sẻ →
"Thêm vào MH chính"). Riêng `/staff-kiosk` có thêm nút bấm **"📲 Cài đặt ứng dụng"** ngay trên giao
diện (chỉ hiện trên điện thoại/máy tính bảng) để không cần tự tìm trong menu trình duyệt.
  - `/patient-screen` cần tham số `?counter=ID` mới hoạt động đúng, nên khi "cài vào màn hình
    chính" từ 1 quầy cụ thể, icon tạo ra sẽ mở LẠI ĐÚNG quầy đó (không bị mất tham số).
  - **Lưu ý về HTTPS:** giống tính năng camera, "cài đặt tự động" (hộp thoại cài đặt gốc của
    Android/Chrome) chỉ hoạt động khi trang chạy qua HTTPS hoặc `localhost`. Nếu bạn đang mở qua
    địa chỉ IP LAN bằng `http://` thường (mặc định của hệ thống), Android sẽ không hiện hộp thoại
    cài đặt tự động — khi đó bấm nút vẫn dùng được, chỉ chuyển sang hiện hướng dẫn thao tác tay
    (mở menu trình duyệt → "Thêm vào Màn hình chính"). Trên iOS/iPadOS Safari thì luôn là thao tác
    tay như vậy, không bị ảnh hưởng bởi HTTPS.

Kiosk bệnh nhân (`/kiosk`), màn hình bệnh nhân (`/patient-screen`) và màn hình chờ chung
(`/waiting-screen`) là các màn hình công khai, không yêu cầu mật khẩu. Riêng `/kiosk` yêu cầu quét
giấy tờ như mô tả ở mục 4b.

**🎨 Bố cục kiosk bốc số (`/kiosk`) và thông tin đơn vị (`.env`):** màn hình này hiện có bố cục
đầy đủ header (logo + tên đơn vị, **căn giữa chính giữa header**, không lệch dù có/không có nút ⛶
bên phải) - nội dung (căn giữa cả chiều ngang lẫn chiều dọc màn hình, chữ cỡ lớn phù hợp màn hình
cảm ứng đứng) - footer (1-2 dòng chữ, dòng 1 cỡ nhỏ như trước, **dòng 2 (nếu có) cỡ chữ TO ngang
tên đơn vị và tô màu xanh dương nhận diện**, dùng khi cần nhấn mạnh 1 thông báo quan trọng hơn),
thay vì chỉ có 1 khối nội dung nhỏ nằm góc trên-trái như trước. Cấu hình trong `.env`:
  - `CLINIC_NAME` — tên đơn vị, hiện ở header.
  - `CLINIC_FOOTER_TEXT` — dòng chữ nhỏ thứ 1 ở footer (để trống nếu không cần).
  - `CLINIC_FOOTER_TEXT_2` — dòng chữ thứ 2 ở footer (cỡ chữ to, màu xanh dương — xem mô tả trên),
    hiện thêm ngay dưới dòng trên (để trống nếu chỉ cần 1 dòng). **Cả 2 dòng chân trang này cũng
    được in trên phiếu số thứ tự** (footer của phiếu giấy), không chỉ hiện trên màn hình.
  - `KIOSK_BACKGROUND_IMAGE` — ảnh nền cho toàn màn hình kiosk (để trống = dùng nền màu tối mặc
    định).
  - `KIOSK_LOGO_IMAGE` — ảnh logo của đơn vị, hiện ở giữa header màn hình kiosk, cạnh tên đơn vị
    (thay cho icon "chữ thập y tế" mặc định). Đường dẫn tính từ thư mục `public/` (ví dụ đặt file
    vào `public/kiosk/assets/logo.png` rồi khai `KIOSK_LOGO_IMAGE=/kiosk/assets/logo.png` — **quên
    dấu "/" đầu dòng cũng không sao, hệ thống tự thêm vào**). Để trống = dùng icon mặc định.
  - `PRINT_LOGO_IMAGE` — ảnh logo in ở **đầu phiếu số thứ tự** (phía trên tên đơn vị) — độc lập với
    `KIOSK_LOGO_IMAGE` ở trên (có thể dùng ảnh khác, ví dụ bản đen-trắng/ít chi tiết để hợp với máy
    in nhiệt). Cùng quy tắc đường dẫn như trên. Để trống = phiếu in không có logo.

  **Lưu ý khi cấu hình `KIOSK_LOGO_IMAGE`/`PRINT_LOGO_IMAGE`/`KIOSK_BACKGROUND_IMAGE`:** nếu gõ sai
  đường dẫn hoặc quên bỏ file ảnh vào đúng chỗ trong `public/`, ảnh sẽ ÂM THẦM không hiện ra (không
  báo lỗi trên màn hình) — hệ thống có in CẢNH BÁO ra **cửa sổ dòng lệnh đang chạy server** (nơi
  chạy `npm start`) mỗi khi phát hiện đường dẫn cấu hình nhưng không tìm thấy file tương ứng, kèm
  theo đường dẫn ĐẦY ĐỦ mà hệ thống đang tìm — kiểm tra ở đó nếu logo/ảnh nền không hiện như mong
  đợi.

  Sửa xong các dòng trên rồi khởi động lại server (`npm start`) để áp dụng; không cần khởi động lại
  trình duyệt, màn hình kiosk và phiếu in sẽ tự lấy giá trị mới khi tải lại trang/in lần sau.

  Nút **"Tiếp tục"**/**"Làm lại"** ở bước quét giấy tờ **đã được ẩn đi** vì bước này vốn đã tự động
  chuyển tiếp sau vài giây (`KIOSK_AUTO_CONFIRM_SECONDS`, xem mục cấu hình trong `.env.example`),
  bệnh nhân không cần bấm gì cả. 2 nút này chỉ tự hiện lại làm phương án dự phòng nếu bạn **tắt
  hẳn** tính năng tự động (đặt `KIOSK_AUTO_CONFIRM_SECONDS=0`) — khi đó bắt buộc phải có cách thao
  tác tay để chuyển bước, nếu không màn hình sẽ bị "kẹt" mãi không tự chuyển.

**Ghi chú đối tượng ưu tiên trên màn hình bệnh nhân:** `/patient-screen` giờ hiện thêm 1 dòng chữ
nhỏ ngay phía dưới số đang mời, ghi rõ tên đối tượng ưu tiên của số đó (ví dụ "Cấp cứu", "≥ 75
tuổi", "Đối tượng thường"...) — giúp bệnh nhân/người nhà dễ hiểu vì sao có số được mời trước, đặc
biệt hữu ích khi thấy 1 số cấp cứu (màu đỏ) được gọi vượt lên trước.

**🔊 Đọc số bằng giọng nói thu sẵn trên màn hình bệnh nhân:** mỗi khi có số mới được gọi (hoặc bấm
"Gọi lại"), `/patient-screen` tự đọc to câu **"Mời bệnh nhân có số thứ tự, xx, vào quầy số,
xx."** — nhưng **không dùng giọng máy có sẵn của trình duyệt** (Web Speech API) làm giọng chính
nữa, vì nhiều máy không cài sẵn gói tiếng Việt nên tự động đọc bằng giọng **tiếng Anh**, nghe sai
hoàn toàn. Thay vào đó, hệ thống **ghép nối các file âm thanh do chính đơn vị tự thu âm** (giọng
người thật, đọc đúng, chuẩn) đặt trong thư mục `public/patient-screen/audio/`:
  - Cần thu đúng **12 file .mp3 ngắn**: 10 file đọc từng chữ số riêng lẻ (`0.mp3` → "không" đến
    `9.mp3` → "chín") và 2 file câu (`moi-so-thu-tu.mp3` → "Mời bệnh nhân có số thứ tự",
    `vao-quay-so.mp3` → "vào quầy số"). Hướng dẫn chi tiết tên file, nội dung cần đọc, và cách
    ghép nằm sẵn trong file `public/patient-screen/audio/README.txt` đi kèm.
  - Số thứ tự được đọc **đủ 3 chữ số** kiểu bệnh viện/ngân hàng thực tế (ví dụ số 7 đọc "không,
    không, bảy"); số quầy tự bỏ chữ cái + số 0 ở đầu (mã "Q01" chỉ đọc "một").
  - Sau khi copy đủ 12 file .mp3 vào đúng thư mục trên, **không cần khởi động lại server** — có
    ngay lập tức vì đây là file tĩnh. Dùng trang **`/audio-test`** (xem mục dưới) để nghe thử ghép
    nối trước khi lắp đặt thật.
  - **Dự phòng:** nếu thiếu bất kỳ file nào trong 12 file trên (kể cả trong lúc đang thu âm dần),
    màn hình sẽ **tự động chuyển sang đọc bằng giọng máy** (Web Speech API, đọc chậm, ưu tiên
    giọng nữ tiếng Việt nếu máy có cài) cho đúng câu đó — không bao giờ bị câm hoàn toàn.
  - Nút **🔊/🔇** ở góc trên bên phải màn hình để bật/tắt giọng đọc — trạng thái được nhớ lại cho
    lần mở sau (lưu trong trình duyệt của máy đó). Một số trình duyệt yêu cầu người dùng phải
    tương tác (bấm) ít nhất 1 lần trước khi cho phép tự phát âm thanh (chính sách autoplay) — bấm
    nút này 1 lần lúc thiết lập màn hình sẽ vừa "mở khoá" âm thanh cho cả phiên, vừa phát thử luôn
    1 câu ví dụ (số 001, quầy 1) để nghe được ngay các file vừa thu đã ghép ổn chưa.
  - Không cần cấu hình gì thêm trong `.env` — tính năng luôn bật sẵn (mặc định 🔊 bật), chỉ tắt khi
    nhân viên chủ động bấm nút tắt trên chính màn hình đó.

**🧪 Trang nghe thử âm thanh (`/audio-test`):** trang riêng, công khai, không ảnh hưởng dữ liệu
thật — nhập thử 1 số thứ tự + 1 số quầy bất kỳ rồi bấm "Nghe thử" để kiểm tra các file .mp3 vừa
thu đã đặt đúng tên/ghép nối nghe ổn chưa, đồng thời liệt kê rõ **tên file nào còn thiếu** (nếu
có) để biết cần thu bổ sung file gì trước khi lắp đặt cho màn hình bệnh nhân thật.

**Quy trình dùng màn hình quầy (`/counter`):**

0. Danh sách quầy trong ô chọn có nút "🔄 Làm mới" để tải lại — dùng khi quản trị viên vừa thêm
   quầy mới bằng `npm run seed:counters` trong lúc trang đang mở sẵn, không cần tải lại (F5) cả
   trang.
1. Nhân viên chọn quầy mình trực rồi bấm "Bắt đầu ca trực" — màn hình bệnh nhân của đúng quầy đó
   (`/patient-screen?counter=<id>`) sẽ **tự động mở trong 1 cửa sổ mới**. Kéo cửa sổ này sang màn
   hình phụ (extend) rồi bật toàn màn hình (F11) để bệnh nhân xem.
   - Nếu đã lỡ đóng cửa sổ đó, bấm nút "Mở màn hình bệnh nhân của quầy này" để mở lại — cửa sổ
     mới sẽ tái sử dụng đúng cửa sổ cũ (không mở chồng nhiều cửa sổ). Lưu ý: trình duyệt chỉ cho
     tự mở cửa sổ mới trong lúc đang bấm nút; khi tải lại trang `/counter` mà không bấm gì, màn
     hình bệnh nhân sẽ **không** tự mở lại được — nhân viên cần bấm nút này 1 lần.
2. Nút **"Gọi số tiếp theo"** đồng thời được hiểu là **đã hoàn tất số đang phục vụ** (nếu có) —
   không cần bấm thêm nút "Hoàn tất" nào khác. Khi bệnh nhân vắng mặt, bấm **"Bỏ qua"** — hệ
   thống sẽ **tự động gọi luôn số tiếp theo ngay sau đó**, không cần bấm thêm 1 lần "Gọi số tiếp
   theo" nữa (áp dụng cả trên `/counter` lẫn widget desktop ở mục 4e).
   Nút **"Gọi lại"** dùng khi bệnh nhân chưa nghe/để ý số đang mời — không lấy số mới, không
   đổi trạng thái gì, chỉ làm số trên màn hình bệnh nhân **nhấp nháy lại** để thu hút chú ý.
   Ngay bên dưới, dòng "Đang có N số đang chờ trong hàng đợi" giờ có thêm **chi tiết theo từng
   đối tượng ưu tiên** (ví dụ: Cấp cứu: 1, ≥ 75 tuổi: 2, Đối tượng thường: 5...), xếp theo
   đúng thứ hạng ưu tiên và chỉ hiện đối tượng nào đang thực sự có số chờ — giúp nhân viên biết
   ngay đang tồn đọng loại nào mà không cần đoán hay mở màn hình khác.
3. Màn hình bệnh nhân (`/patient-screen`) hiển thị số đang mời của đúng quầy đó, kèm theo danh
   sách các số **quầy đó** đã gọi nhưng bệnh nhân vắng mặt (bỏ qua) — chỉ hiện số của quầy mình,
   không lẫn số bị bỏ qua của quầy khác. Số hiển thị được **tô màu theo đối tượng ưu tiên**
   (cấp cứu, ≥75 tuổi, trẻ em, phụ nữ có thai, khuyết tật, người có công, đối tượng thường —
   mỗi loại 1 màu riêng), kèm bảng chú thích màu ngay bên dưới để bệnh nhân/nhân viên đối chiếu. Bảng màu
   này cũng hiện trên màn hình quầy (`/counter`) và màn hình chờ chung (`/waiting-screen`), lấy
   từ 1 nguồn cấu hình duy nhất (`src/config/priorityRules.js`) nên luôn đồng bộ.
4. Nút **"👁️ Xem DS bỏ qua (vắng mặt)"** trên màn hình quầy mở ra danh sách **toàn bộ** số đang
   bị bỏ qua trong ngày — của **tất cả các quầy**, không riêng quầy mình (mỗi dòng ghi rõ "Bị bỏ
   qua bởi Q0x" để biết số đó bị quầy nào bỏ qua). Bấm **"Gọi lại"** ở 1 dòng bất kỳ sẽ **gọi
   ngay số đó về quầy mình** — giống hệt "Gọi số tiếp theo" nhưng chọn đúng số này thay vì số
   đầu hàng chờ theo ưu tiên: số hiện lên và nhấp nháy ngay trên màn hình bệnh nhân
   (`/patient-screen`) của quầy mình, lập tức biến mất khỏi danh sách bỏ qua. Nếu quầy đang phục
   vụ 1 số khác thì số đó được tự động xem là **đã hoàn tất** trước khi gọi số vừa chọn (đúng
   nguyên tắc "gọi số mới = đã xong số cũ" áp dụng chung toàn hệ thống). Nếu số vừa chọn vừa bị
   quầy khác gọi mất trước đó 1 bước, hệ thống báo lỗi và tự làm mới lại danh sách. Danh sách
   trong modal cũng tự cập nhật theo thời gian thực nếu quầy khác vừa bỏ qua/gọi lại 1 số trong
   lúc modal đang mở.
5. **🔀 Thứ tự ưu tiên gọi số riêng cho quầy (kéo-thả):** cuối màn hình làm việc có khối "Thứ tự
   ưu tiên gọi số" liệt kê toàn bộ đối tượng (Cấp cứu, ≥75 tuổi, trẻ em... đến Đối tượng
   thường) theo đúng thứ tự sẽ được gọi. Nhân viên có thể **kéo-thả** (chuột hoặc chạm trên máy
   tính bảng, dùng tay cầm "⠿") để sắp xếp lại thứ tự này theo ý muốn, rồi bấm **"💾 Lưu thứ tự
   cho phiên này"** — từ lúc đó, mỗi lần quầy này bấm "Gọi số tiếp theo" sẽ ưu tiên gọi đúng theo
   thứ tự vừa sắp xếp thay vì thứ tự mặc định của hệ thống. Thay đổi này:
   - **Chỉ áp dụng cho quầy đang thao tác**, không ảnh hưởng tới cách các quầy khác gọi số.
   - **Chỉ tồn tại trong phiên làm việc hiện tại** — hệ thống tự động đưa thứ tự về lại mặc định
     ngay khi quầy **thoát phiên** (kể cả thoát bình thường lẫn "force-exit-session" khi gặp sự
     cố), đúng yêu cầu nghiệp vụ. Có thể chủ động bấm **"🔄 Về mặc định hệ thống"** để đưa về mặc
     định ngay mà không cần thoát phiên.
   - Vẫn giữ nguyên nếu chỉ tải lại trang (F5) trong lúc phiên còn hiệu lực, vì thứ tự được lưu ở
     server gắn với quầy, không phải chỉ lưu tạm trên trình duyệt.
6. **Mỗi quầy chỉ 1 người dùng tại 1 thời điểm.** Nếu quầy đang có người trực (đã "vào phiên"),
   nhân viên khác chọn đúng quầy đó sẽ bị từ chối kèm cảnh báo "Quầy này đang có người sử dụng,
   vui lòng chọn quầy khác" — không vào được cho đến khi người đang trực bấm
   "🚪 Thoát phiên / Đổi quầy khác". Trong danh sách chọn quầy, quầy đang bận sẽ được ghi chú
   "(đang có người dùng)".
   - Nếu chính người đang trực tải lại trang (F5) trên cùng máy/trình duyệt đó, hệ thống nhận ra
     đó là cùng 1 thiết bị nên vẫn cho vào lại bình thường, không bị coi là xung đột.
   - Hệ thống cũng cố gắng tự giải phóng quầy khi đóng tab/trình duyệt, nhưng đây chỉ là biện
     pháp hỗ trợ thêm (best-effort) — không đảm bảo 100% nếu máy tắt đột ngột/mất điện. Trường
     hợp quầy bị "kẹt" do máy nhân viên gặp sự cố (không bấm thoát phiên được), có 2 cách gỡ:
     - Nếu vẫn dùng đúng máy/trình duyệt cũ để mở lại trang `/counter`, hệ thống sẽ tự nhận ra và
       cho vào lại như bình thường (không cần làm gì thêm).
     - Nếu cần vào từ máy khác gấp, gọi API xử lý sự cố (không có nút trên giao diện, chỉ dùng khi
       thật sự cần) — thay `<id-quầy>` bằng id quầy bị kẹt, lấy từ `/api/counters`:
       ```bash
       curl -X POST http://localhost:4000/api/counters/<id-quầy>/force-exit-session
       ```

Muốn server tự khởi động lại mỗi khi máy tính khởi động, dùng thêm công cụ như `pm2`:

```bash
npm install -g pm2
pm2 start src/server.js --name queue-system
pm2 save
pm2 startup
```

**4c. Truy cập từ máy khác trong mạng LAN + Chế độ Kiosk cho máy bệnh nhân.**

Hệ thống chạy trên **1 máy chủ duy nhất**; các quầy tiếp nhận, kiosk bệnh nhân, màn hình chờ...
đều là các máy/màn hình KHÁC truy cập vào máy chủ đó qua mạng LAN/Wi-Fi nội bộ — nên chúng cần
biết **địa chỉ IP** của máy chủ (`localhost` chỉ hoạt động trên đúng máy đang chạy `npm start`).

- Trên trang chủ (`/`), bấm dòng chữ nhỏ **"Địa chỉ mạng"** ở cuối trang (mặc định ẩn,
  không hiện sẵn để đỡ rối giao diện bệnh nhân) để xem:
  - **Địa chỉ IP LAN của máy chủ** (ví dụ `http://192.168.1.23:4000`) dưới dạng chữ to, có nút
    "📋 Sao chép" — gõ (hoặc dán) địa chỉ này vào trình duyệt trên các máy quầy tiếp nhận/kiosk
    khác thay vì `localhost`.
  - **Mã QR** ứng với địa chỉ đó — nhân viên đứng cạnh máy chủ có thể quét bằng camera điện
    thoại cá nhân để mở nhanh trên điện thoại, không cần gõ tay.
  - Nếu máy chủ có nhiều card mạng (cả Wi-Fi lẫn dây mạng), tất cả địa chỉ IP tìm được đều được
    liệt kê — chọn đúng địa chỉ cùng mạng với các máy quầy khác.
  - Chỉ hoạt động khi các máy cùng chung 1 mạng LAN/Wi-Fi với máy chủ; không hoạt động qua
    Internet (không có ai truy cập từ bên ngoài mạng nội bộ trừ khi tự cấu hình thêm).

- Trên kiosk bệnh nhân (`/kiosk`), góc trên bên phải có 1 nút nhỏ mờ **"⛶"** — đây là **Chế độ
  Kiosk**, dành cho **nhân viên bấm 1 lần lúc thiết lập máy** cho bệnh nhân dùng (không phải
  thao tác bệnh nhân cần quan tâm). Bấm vào sẽ đưa trình duyệt vào **toàn màn hình**, ẩn thanh
  địa chỉ (URL bar) — nhờ đó bệnh nhân đứng trước máy kiosk **không nhìn thấy được địa chỉ
  IP/localhost của máy chủ** hiển thị trên thanh địa chỉ trình duyệt. Bấm lại nút (hiện thành
  "⤢") hoặc phím **Esc** để thoát toàn màn hình.

  ⚠️ **Giới hạn cần biết:** phím Esc để thoát toàn màn hình là quy định bảo mật chuẩn của mọi
  trình duyệt, **không thể chặn bằng JavaScript** — nút này chỉ ẩn thanh địa chỉ, không khoá
  cứng máy (bệnh nhân tò mò vẫn có thể bấm Esc, Alt+Tab, đóng trình duyệt...). Nếu cần khoá kiosk
  chắc chắn hơn ở mức hệ điều hành/trình duyệt (không cho thoát, ẩn cả thanh taskbar), nên chạy
  trình duyệt ở **chế độ kiosk thật sự** khi khởi động máy, ví dụ với Chrome/Edge:

  ```bash
  # Windows (Command Prompt hoặc trong shortcut khởi động):
  chrome.exe --kiosk http://<ip-máy-chủ>:4000/kiosk

  # macOS:
  open -a "Google Chrome" --args --kiosk http://<ip-máy-chủ>:4000/kiosk

  # Linux:
  google-chrome --kiosk http://<ip-máy-chủ>:4000/kiosk
  ```

  Cách này do hệ điều hành/trình duyệt đảm nhiệm việc khoá màn hình, mạnh hơn nhiều so với nút
  toàn màn hình trong trang — phù hợp khi triển khai thật cho nhiều máy kiosk cố định.

  💡 Muốn kiosk **tự động in phiếu, không hiện hộp thoại in** mỗi lần bốc số — thêm cờ
  `--kiosk-printing` vào lệnh trên (hoặc dùng sẵn file `.bat` trong `scripts/kiosk-launchers/`) —
  xem chi tiết ở **mục 5b**.

**4d. Màn hình quầy (`/counter`) dạng "widget" nhỏ gọn, tự mở khi khởi động máy (Windows).**

> 💡 Mục này dùng **trình duyệt** (nhẹ, không cần cài gì thêm) nhưng có 1 giới hạn: không thể tự
> ghim cửa sổ nổi bên trên thật sự (phải nhờ tiện ích ngoài như PowerToys). Nếu muốn 1 ứng dụng
> **luôn nổi bên trên thật sự**, khởi động cùng Windows, khung siêu nhỏ chỉ gồm icon — xem mục
> **4e** ngay bên dưới (ứng dụng desktop riêng, cần cài đặt 1 lần).

Màn hình `/counter` được thiết kế để có thể mở như 1 **cửa sổ nhỏ đặt 1 góc màn hình** (kiểu
tiện ích/extension hỗ trợ), thay vì chiếm cả màn hình trình duyệt — hữu ích khi nhân viên tiếp
nhận cần vừa dùng phần mềm khác (HIS, Excel...) vừa nhìn thấy số đang gọi.

- **Giao diện đã tự rút gọn theo kích thước cửa sổ:** khi cửa sổ hẹp (dưới khoảng 420px), tiêu
  đề trang và các đoạn chú thích dài tự ẩn đi, 3 nút chính ("Gọi tiếp theo", "Gọi lại", "Bỏ qua")
  chỉ còn hiện icon (vẫn có tooltip khi rê chuột vào để biết chức năng). Phần "Chú thích màu" và
  "Thứ tự ưu tiên" được gom vào 1 popup riêng, mở bằng icon bánh răng ở góc trên — không
  còn chiếm chỗ thường trực trên màn hình nhỏ.
- **Mở `/counter` thành cửa sổ ứng dụng nhỏ, không thanh địa chỉ (Windows):** dùng file có sẵn
  `scripts/windows-widget/mo-quay-tiep-nhan-widget.bat` — mở file này bằng Notepad, sửa 2 mục
  đầu file (`QUEUE_URL` là địa chỉ máy chủ, và kích thước/vị trí cửa sổ `WIN_WIDTH`/`WIN_HEIGHT`/
  `WIN_LEFT`/`WIN_TOP`) cho đúng máy của bạn rồi lưu lại. Bấm đúp file để mở thử — nó sẽ tự tìm
  Chrome, nếu không có thì dùng Edge, mở `/counter` thành 1 cửa sổ nhỏ không có thanh địa chỉ/
  thanh công cụ trình duyệt (chế độ `--app`).
- **Tự mở cùng lúc khởi động máy tính:** bấm chuột phải vào file `.bat` đó → **"Create shortcut"**
  (Tạo lối tắt) → bấm **Windows + R**, gõ `shell:startup` rồi Enter để mở thư mục khởi động của
  Windows → kéo/thả lối tắt vừa tạo vào đó. Khởi động lại máy để kiểm tra — chi tiết đầy đủ nằm
  ngay trong chú thích cuối file `.bat`.
- **Ghim cửa sổ luôn nổi bên trên các cửa sổ khác:** đây là giới hạn bảo mật chuẩn của mọi trình
  duyệt — không có cách nào để 1 trang web tự ghim cửa sổ của chính nó lên trên cùng bằng
  JavaScript. Cách khắc phục: cài **PowerToys** (tiện ích miễn phí chính thức của Microsoft, tải
  tại microsoft.com/powertoys hoặc qua Microsoft Store), bật tính năng **"Always on Top"**, sau đó
  bấm vào cửa sổ widget rồi bấm **Windows + Ctrl + T** để ghim/bỏ ghim nổi bên trên.

**4e. Ứng dụng Widget Desktop (Electron) — khung siêu nhỏ, luôn nổi bên trên thật sự.**

Đây là 1 **ứng dụng desktop riêng** (thư mục `electron-widget/` trong gói tải về), cài đặt 1 lần
trên máy quầy tiếp nhận — khắc phục hoàn toàn giới hạn "không tự ghim nổi được" của cách dùng
trình duyệt ở mục 4d, vì ứng dụng desktop có toàn quyền ghim cửa sổ của chính nó lên trên cùng.

- **Giao diện:** 1 khung nhỏ không viền, luôn nổi bên trên mọi cửa sổ khác, gồm: mã quầy, số thứ
  tự (STT) đang phục vụ, 3 icon **Gọi tiếp theo / Gọi lại / Bỏ qua** (bấm "Bỏ qua" sẽ
  **tự động gọi luôn số tiếp theo**, không cần bấm thêm "Gọi tiếp theo" riêng), icon **màn hình để
  mở màn hình bệnh nhân**, dòng số lượng hàng chờ theo từng đối tượng ưu tiên (phân tách bằng dấu
  `/`, mỗi số 1 màu trùng với màu số trên màn hình bệnh nhân — rê chuột vào để xem chú thích từng
  đối tượng), và icon **bánh răng** để mở màn hình quản lý đầy đủ (`/counter`) khi cần chọn quầy/
  bắt đầu ca/đổi thứ tự ưu tiên... Có thể kéo để đổi vị trí và kéo góc để đổi kích thước — ứng
  dụng tự nhớ lại lần mở sau.
- **Mở màn hình bệnh nhân — tự động toàn màn hình ở màn hình phụ:** bấm icon màn hình trên widget sẽ
  mở `/patient-screen` của đúng quầy đang chọn trong **1 cửa sổ riêng do chính ứng dụng desktop
  quản lý** — nếu máy đang cắm **từ 2 màn hình trở lên**, cửa sổ này **tự động chuyển sang màn
  hình phụ** (không phải màn hình chính đang có widget/màn hình quản lý) và **tự động vào toàn màn
  hình ngay lập tức** — không cần nhân viên tự kéo cửa sổ sang màn hình phụ rồi bấm F11 như cách
  dùng trình duyệt thường (mục 4d). Nếu máy chỉ có 1 màn hình, cửa sổ vẫn mở toàn màn hình bình
  thường trên màn hình đó. Bấm lại icon màn hình khi cửa sổ đã mở sẵn sẽ chỉ đưa cửa sổ đó ra trước (không
  mở chồng cửa sổ mới); nếu đổi sang quầy khác rồi bấm lại, cửa sổ cũ sẽ tự đóng và mở lại đúng
  quầy mới.
- **Dùng chung dữ liệu đăng nhập/chọn quầy với màn hình quản lý:** chỉ cần đăng nhập và bắt đầu ca
  trực 1 lần ở cửa sổ mở từ icon bánh răng, widget sẽ **tự động nhận biết ngay** (không cần khởi động lại).
- **Cài đặt & chạy (máy có Node.js, xem mục 2):**
  ```bash
  cd electron-widget
  npm install
  npm start
  ```
- **Đóng gói thành file cài đặt Windows (.exe) để cài lên các máy quầy khác** (không cần cài
  Node.js/Electron trên máy đó nữa):
  ```bash
  cd electron-widget
  npm install
  npm run build:win        # tạo bộ cài .exe (NSIS) + bản portable trong electron-widget/dist/
  ```
  Chạy lệnh trên trên máy Windows (electron-builder đóng gói theo đúng hệ điều hành đang chạy lệnh).
  Sau khi cài, ứng dụng nằm trong Start Menu với tên **"Widget Quầy Tiếp Nhận"**.
- **Khởi động cùng Windows:** bật/tắt ngay trong menu chuột phải vào **icon khay hệ thống** (system
  tray, góc dưới-phải màn hình) → **"Khởi động cùng Windows"** — dùng thẳng API chính thức của
  Windows/Electron, không cần tự tạo shortcut trong thư mục Startup như cách thủ công ở mục 4d.
- **Luôn nổi bên trên:** cũng bật/tắt trong menu tray → **"Luôn nổi bên trên"** (mặc định bật) —
  đây là tính năng **thật sự** của ứng dụng desktop, không cần thêm PowerToys hay tiện ích nào khác.
- **Mở kiosk bốc số – Bệnh nhân (`/kiosk`) — tự ẩn widget:** menu tray → **"Mở kiosk bốc số – Bệnh
  nhân (/kiosk)"** sẽ mở màn hình bốc số cho bệnh nhân (`/kiosk`) trong 1 cửa sổ riêng, **tự
  động vào toàn màn hình ngay** (bệnh nhân thao tác hoàn toàn qua máy quét QR, không cần chuột/bàn
  phím, nên không cần thấy thanh địa chỉ hay khung trình duyệt). Vì đây là màn hình dành cho
  **bệnh nhân**, không phải nhân viên, nên lúc mở lên, **widget sẽ tự động ẩn đi** (đỡ gây rối/khiến
  bệnh nhân tưởng nhầm có thể bấm vào) — đóng cửa sổ kiosk lại (**Alt+F4**) sẽ **tự động hiện lại
  widget** cho nhân viên như cũ. Dùng khi máy cài ứng dụng widget này cũng được dùng làm máy kiosk
  cho bệnh nhân tự bốc số.
- **Mở kiosk cấp số – Nhân viên (`/staff-kiosk`):** menu tray → **"Mở kiosk cấp số – Nhân viên
  (/staff-kiosk)"** mở màn hình cấp số cho nhân viên trong 1 cửa sổ bình thường (không ép toàn màn
  hình, vì nhân viên cần thao tác nhiều hơn bệnh nhân).
- **In phiếu tự động, không hiện hộp thoại in — khi chạy `/kiosk` hoặc `/staff-kiosk` qua chính ứng
  dụng widget này** (2 mục ngay phía trên): phiếu số thứ tự sẽ **tự in thẳng ra máy in nhiệt ngay
  khi cấp số xong**, không hiện bất kỳ hộp thoại/bản xem trước nào — ứng dụng dùng thẳng API in của
  Electron thay vì hộp thoại in chuẩn của trình duyệt. Mặc định in vào **máy in mặc định của
  Windows** (chỉ cần đặt đúng máy in nhiệt làm máy in mặc định); nếu máy có nhiều máy in và muốn
  chỉ định rõ máy nào, chọn trong menu tray → **"Máy in nhiệt: ..."**, hệ thống sẽ liệt kê các máy
  in đang nhận biết được để chọn.
  ⚠️ **Bắt buộc mở `/kiosk`/`/staff-kiosk` qua đúng 2 mục menu tray này** (không phải qua
  Chrome/Edge hay link tắt riêng) thì mới có tính năng in lặng lẽ — mở bằng trình duyệt thường vẫn
  chỉ có `window.print()` với hộp thoại in chuẩn (mục 5 bên dưới).

  Nếu đã mở đúng qua tray mà **vẫn hiện hộp thoại in đầy đủ (có danh sách máy in, số bản in, nút
  Print/Cancel...)**, dùng menu tray → **"Mở file nhật ký in (chẩn đoán lỗi)"** để xem chính xác vì
  sao (file `in-phieu-debug.log` cũng nằm sẵn trên Desktop, ghi lại từng bước xử lý mỗi lần in).
  Nguyên nhân đã xác nhận thực tế trên máy in Epson TM-T82III (Chromium báo lỗi nội bộ
  `"Invalid printer settings ... content size is empty; page size is empty; printable area is
  empty"`): Chromium/Electron **không tự đọc được khổ giấy** của máy in cuộn giấy liên tục (roll
  paper) như máy in nhiệt, nên tự rơi về mở hộp thoại in đầy đủ thay vì báo lỗi rõ ràng. Bản cập
  nhật đã sửa bằng cách **truyền thẳng khổ giấy (58mm, khớp `@page` trong `public/common.css`)**
  cho lệnh in thay vì để Electron tự dò — không cần chỉnh gì thêm phía máy in/driver.

  Nếu sau bản sửa này vẫn còn hộp thoại, khả năng còn lại là **tính năng riêng của driver máy in**
  (một số driver máy in nhiệt trên Windows có tuỳ chọn "xác nhận trước khi in"/"print preview" nằm
  trong chính cài đặt máy in — Control Panel/Settings → Printers & scanners → chọn máy in →
  Printing preferences/Advanced) — cần tắt tuỳ chọn đó trực tiếp trong driver, việc này nằm ngoài
  phạm vi mà ứng dụng có thể tự tắt được. Trong mọi trường hợp, nội dung file
  `in-phieu-debug.log` (đặc biệt dòng `errorType`) là căn cứ chính xác nhất để chẩn đoán tiếp.

  **Khổ giấy in tự động khớp độ dài phiếu:** trước đây khổ giấy in bị đặt cố định khá dài (thừa
  giấy trắng phía dưới mỗi phiếu) — nguyên nhân thật sự là phần tử phiếu in trong trang bị ẩn bằng
  `display:none` nên lúc đo chiều cao (trước khi in) luôn đo ra 0, khiến ứng dụng luôn rơi về khổ
  giấy dự phòng cố định. Đã sửa bằng cách đổi cách ẩn phiếu (đưa ra ngoài vùng nhìn thấy bằng
  `position:fixed` thay vì `display:none`, người dùng vẫn không thấy gì khác trên màn hình) để đo
  được đúng chiều cao thật.

  Sau khi đo đúng, khổ giấy tính được rất nhỏ (đúng bằng nội dung) nhưng thực tế lại **in ra hao
  giấy hơn cả trước đó** — đã thử sửa `html`/`body` bị ép cao theo bố cục màn hình (`height: 100%`
  của `/kiosk`/`/staff-kiosk` không tự huỷ lúc in) nhưng vẫn không đổi gì cả, dù log xác nhận khổ
  giấy tính đúng và `webContents.print()` báo in thành công. **Kết luận sau khi kiểm chứng thực
  tế:** driver máy in Epson trên Windows **bỏ qua hoàn toàn khổ giấy tuỳ chỉnh** mà Chromium/
  Electron gửi xuống qua `webContents.print()`, tự dùng khổ giấy mặc định riêng của nó (dài hơn
  nhiều) — đây là giới hạn của chính driver/Windows GDI, không phải lỗi tính toán của ứng dụng.

  **Đã đổi hẳn sang cơ chế in khác:** xuất phiếu ra 1 file PDF đúng khổ (qua
  `webContents.printToPDF()`) rồi dùng thư viện `pdf-to-printer` (chạy kèm SumatraPDF, không cần
  cài thêm gì) để gửi thẳng file PDF đó tới máy in — cách này không cần driver "hợp tác" với khổ
  giấy tuỳ chỉnh nữa, vì kích thước trang đã nằm sẵn trong chính file PDF. Đây là cách làm phổ biến
  và đã được kiểm chứng rộng rãi cho đúng tình huống "Electron in lặng lẽ ra máy in nhiệt/POS trên
  Windows bị driver bỏ qua khổ giấy tuỳ chỉnh".

  ⚠️ **Cần chạy lại `npm install` trong `electron-widget/`** sau khi cập nhật bản này (có thêm 1
  thư viện mới). Nếu quên, ứng dụng KHÔNG bị treo — tự động quay về cách in cũ (`webContents.print`)
  kèm cảnh báo rõ trong `in-phieu-debug.log`, nhưng sẽ không có tác dụng sửa lỗi hao giấy.

  **Sự cố tiếp theo đã gặp và sửa:** sau khi đổi sang cách in bằng PDF, có lúc in ra **giấy trắng
  hoàn toàn** dù log báo thành công — đã kiểm chứng riêng phần xuất PDF (nội dung, khổ giấy đều
  đúng), nên nguyên nhân nằm ở bước sau: ứng dụng xoá file PDF tạm ngay khi lệnh gửi in vừa trả về
  xong, nhưng Windows Print Spooler/driver có thể vẫn đang đọc file đó thêm một chút nữa để thực sự
  in xong — xoá quá sớm cắt mất nội dung giữa chừng. Đã sửa bằng cách đợi 15 giây an toàn rồi mới
  xoá file tạm (đủ dư cho 1 phiếu ngắn), kèm dọn dẹp các file tạm cũ (hơn 1 giờ) mỗi lần khởi động
  widget, phòng trường hợp ứng dụng bị tắt trước khi kịp tự xoá.

  Nhưng sau đó vẫn gặp **khổ giấy đã đúng (nhỏ, khớp nội dung) nhưng vẫn trắng, không có chữ gì**
  — để tách bạch xem lỗi nằm ở bước XUẤT PDF (file PDF cũng sai/trống) hay ở bước GỬI TỚI MÁY IN
  (file PDF đúng nhưng in ra vẫn trắng), ứng dụng giờ lưu thêm 1 bản sao PDF của lần in gần nhất
  ra Desktop (`in-phieu-debug-cuoi.pdf`, tự ghi đè mỗi lần in — mở qua menu tray → **"Mở file PDF
  phiếu vừa in (chẩn đoán lỗi)"**) để tự mở bằng trình xem PDF bình thường và kiểm tra ngay nội
  dung có đúng không, không cần đợi in ra giấy mới biết.

  **Đã tìm ra và sửa nguyên nhân thật sự nhờ file PDF chẩn đoán này:** đo được trang PDF xuất ra
  rộng tới khoảng **1.473.200 × 1.725.041 mm** — tức là số micron dùng để tính khổ giấy (ví dụ
  `58000`) đã bị `webContents.printToPDF()` hiểu nhầm thành **58000 inch** thay vì 58000 micron.
  Lý do: hàm `printToPDF()` của Electron dùng ĐƠN VỊ KHÁC với hàm `webContents.print()` (hàm cũ đã
  dùng đúng micron từ trước) — đây là điểm không nhất quán giữa 2 API của chính Electron. Nội dung
  phiếu (chỉ ~58×68mm) vì vậy bị đặt lọt thỏm vào một góc của trang khổng lồ, nằm ngoài vùng in
  được nên ra giấy trắng. Đã sửa bằng cách đổi đơn vị sang inch (chia cho 25400) chỉ riêng cho lệnh
  gọi `printToPDF()` — đã tính toán và đối chiếu khớp chính xác với số đo thực tế từ file PDF
  anh gửi.

- **In lặng lẽ ngay cả khi mở `/kiosk`/`/staff-kiosk` bằng trình duyệt thường (không qua tray):**
  ứng dụng widget còn mở sẵn 1 "cầu nối in" cục bộ (chỉ nhận kết nối từ chính máy đang chạy widget,
  không lộ ra mạng LAN) — nhờ vậy, nếu máy đó **đang chạy widget** (dù widget đang ẩn trong khay hệ
  thống, không cần mở cửa sổ kiosk nào của widget), thì ngay cả khi nhân viên mở `/kiosk` hay
  `/staff-kiosk` bằng Chrome/Edge bình thường (gõ địa chỉ trực tiếp, không qua menu tray) phiếu vẫn
  tự in lặng lẽ được như thường, không cần bắt buộc mở qua đúng ứng dụng widget nữa. Nếu máy đang
  in **không** cài/chạy widget (ví dụ đang mở từ điện thoại, hoặc máy chưa cài widget), hệ thống tự
  động quay về hộp thoại in chuẩn của trình duyệt như trước — không có gì thay đổi, không lỗi gì cả.
  ⚠️ Lưu ý: địa chỉ máy chủ nhập trên trình duyệt (thanh địa chỉ) cần **khớp đúng** với địa chỉ máy
  chủ đã cấu hình trong widget (menu tray → "Đổi địa chỉ máy chủ...") thì cầu nối này mới nhận diện
  được yêu cầu in (đây là biện pháp an toàn, tránh trang web lạ âm thầm gọi in).
- **Họ tên và ngày sinh của bệnh nhân trên phiếu in:** nếu bệnh nhân đã quét CCCD hoặc thẻ BHYT
  khi lấy số (`/kiosk`, hoặc nhân viên xác minh giấy tờ ở `/staff-kiosk`), họ tên và ngày sinh
  (lấy từ nội dung CCCD/BHYT đã quét) được in rõ ngay trên phiếu để đối chiếu. Nếu cấp số không
  kèm giấy tờ (nhân viên cấp thủ công ở `/staff-kiosk`), 2 dòng này tự động để trống. (Lưu ý:
  phiếu in **không còn** in kèm mã QR của CCCD/BHYT như một số bản trước — đã bỏ tính năng này
  theo yêu cầu, phiếu chỉ còn số thứ tự, đối tượng ưu tiên, họ tên/ngày sinh và thời gian.)
- **Khổ giấy in đúng 80mm (khổ thật của dòng máy TM-T82III):** trước có lúc đặt nhầm khổ 58mm
  (khổ của dòng máy in nhiệt nhỏ hơn) khiến nội dung chỉ chiếm phần bên trái, lề phải thừa rất
  nhiều — đã sửa về đúng 80mm, nội dung đã kiểm tra lại và canh giữa đúng theo chiều
  ngang tờ giấy. Nếu máy in thực tế dùng khổ khác 80mm, đổi giá trị `"80mm"` trong
  `public/common.css` (2 chỗ: `#printReceipt` và `@page`) và hằng số `PAGE_WIDTH_MICRONS` trong
  `electron-widget/main.js` cho khớp.
- **Sửa lỗi phiếu in bị xoay ngang (landscape) sau khi bỏ mã QR:** sau khi bỏ mã QR khỏi phiếu
  (mục ngay trên), nội dung phiếu ngắn lại đáng kể — có lúc chỉ còn cao khoảng 45-58mm, **thấp
  hơn** khổ giấy rộng 80mm. Trang PDF lúc đó trở thành 1 hình chữ nhật **nằm ngang** (rộng hơn
  cao), khiến driver máy in nhiệt hiểu nhầm là hướng "landscape" và tự xoay ngang nội dung khi in
  (dù mã đã truyền `orientation: 'portrait'` cho SumatraPDF — cờ này chỉ ép hướng lúc gửi lệnh in,
  không sửa được kích thước trang vốn đã sai ngay trong file PDF). Đã sửa bằng cách nâng chiều cao
  tối thiểu của trang (`MIN_HEIGHT_MICRONS` trong `electron-widget/main.js`) từ 35mm lên **90mm**
  — luôn lớn hơn khổ rộng 80mm, đảm bảo trang luôn cao hơn rộng nên không còn bị hiểu nhầm là
  landscape trong mọi trường hợp, kể cả phiếu ngắn nhất (không có dòng ưu tiên, không có họ
  tên/ngày sinh). Nếu sau này khổ giấy (`PAGE_WIDTH_MICRONS`) được đổi sang giá trị khác 80mm, nhớ
  chỉnh `MIN_HEIGHT_MICRONS` cho luôn lớn hơn giá trị đó.
- **Đổi địa chỉ máy chủ** (khi widget và máy chủ Node.js không nằm cùng 1 máy): menu tray →
  **"Đổi địa chỉ máy chủ..."**, nhập địa chỉ IP LAN của máy chủ (xem mục 4c để lấy địa chỉ này),
  ứng dụng tự tải lại. Cấu hình được lưu trong 1 file JSON riêng của từng máy (không ảnh hưởng máy
  khác).
- **Ẩn/hiện, thoát ứng dụng:** cũng trong menu tray (bấm đúp icon tray để ẩn/hiện nhanh). Ứng dụng
  chạy thường trú trong khay hệ thống — đóng widget bằng icon bánh răng/kéo ra ngoài màn hình không làm
  thoát hẳn ứng dụng, phải bấm **"Thoát"** trong menu tray mới tắt hẳn.
- Icon mặc định đi kèm là icon đơn giản tự sinh (`electron-widget/assets/icon.png`) — có thể thay
  bằng logo riêng của đơn vị trước khi đóng gói (`npm run build:win`).

## 5. Cấu hình máy in nhiệt

💡 **Nếu máy kiosk/quầy đã cài ứng dụng widget desktop (mục 4e):** mở `/kiosk` và `/staff-kiosk`
qua **chính ứng dụng đó** (menu tray → "Mở kiosk...") thay vì qua trình duyệt thường — ứng dụng sẽ
**tự in lặng lẽ, không hộp thoại nào cả**, không cần cấu hình cờ trình duyệt gì thêm (bỏ qua mục
5b/5c bên dưới). Các mục 5a-5c dưới đây dành cho trường hợp mở `/kiosk`/`/staff-kiosk` bằng
Chrome/Edge thường (không qua ứng dụng widget).

**5a. Cách in mặc định: in ngay tại trình duyệt của từng máy (kiosk/quầy).**

Hệ thống in phiếu **tại chính trình duyệt của máy đang bốc số** (`window.print()`, khổ giấy 58mm)
thay vì in tập trung từ máy chủ — nhờ vậy máy in gắn vào máy nào (USB) hoặc ghép đôi với máy nào
(Bluetooth) thì đúng máy đó in được, không phụ thuộc máy nào đang chạy `npm start`. Cách này chạy
được ngay, không cần cấu hình gì thêm — nhưng theo mặc định trình duyệt sẽ **hiện hộp thoại in**
mỗi lần (đây là quy định bảo mật chuẩn của mọi trình duyệt, không có cách nào bỏ qua bằng
JavaScript thông thường).

**5b. Bỏ hộp thoại in trên máy tính/PC (khuyến nghị cho máy kiosk/quầy cố định).**

Chrome/Edge có cờ khởi động `--kiosk-printing`: khi bật, `window.print()` sẽ **in thẳng vào máy in
mặc định của Windows, không hiện hộp thoại/bản xem trước nào cả**. Đây là cách chuẩn, ổn định nhất
để máy kiosk/quầy tự động in không cần ai bấm gì.

Điều kiện để dùng được:
1. Máy in nhiệt (USB) đã được **cài driver và hiện trong danh sách máy in của Windows**
   (Settings → Bluetooth & devices → Printers & scanners) — máy in Epson thường cần cài driver
   riêng của hãng (tìm "Advanced Printer Driver" hoặc driver theo đúng dòng máy trên trang hỗ trợ
   Epson) nếu chưa tự nhận là máy in thường.
2. Máy in đó được đặt làm **máy in mặc định** (Set as default printer) — `--kiosk-printing` luôn
   in vào máy in mặc định, không cho chọn máy in khác (đúng ý đồ: không hiện hộp thoại nào).

Có sẵn 2 file khởi chạy trong `scripts/kiosk-launchers/` để mở kiosk kèm cờ này, không cần gõ lệnh
tay mỗi lần:
- `mo-kiosk-boc-so.bat` — mở `/kiosk` (kiosk bốc số cho bệnh nhân) ở chế độ toàn màn hình + tắt
  hộp thoại in.
- `mo-kiosk-nhan-vien.bat` — mở `/staff-kiosk` (kiosk cấp số cho nhân viên) + tắt hộp thoại in.

Mở file `.bat` tương ứng bằng Notepad, sửa dòng `QUEUE_URL` cho đúng địa chỉ máy chủ của bạn (xem
mục 4c), lưu lại rồi bấm đúp để chạy thử — có thể đặt vào thư mục `shell:startup` của Windows để
tự mở cùng lúc khởi động máy (xem chú thích cuối mỗi file `.bat`).

Trên macOS/Linux, thêm cờ `--kiosk-printing` vào lệnh mở Chrome ở mục 4c:

```bash
# macOS:
open -a "Google Chrome" --args --kiosk --kiosk-printing http://<ip-máy-chủ>:4000/kiosk

# Linux:
google-chrome --kiosk --kiosk-printing http://<ip-máy-chủ>:4000/kiosk
```

**5c. Trên điện thoại/máy tính bảng (máy in Bluetooth):** hộp thoại in của hệ điều hành **vẫn sẽ
hiện ra** — trình duyệt di động (Chrome/Safari) không có cờ tương đương `--kiosk-printing`, và hầu
hết máy in nhiệt Bluetooth giá phổ thông cũng không hỗ trợ giao thức để 1 trang web gửi lệnh in
thẳng mà bỏ qua hộp thoại hệ thống. Nhân viên vẫn thao tác được bình thường: bấm cấp số → hộp thoại
in hiện ra → chọn máy in Bluetooth đã ghép đôi → in — chỉ là có thêm 1-2 thao tác chạm so với máy
tính bàn dùng `--kiosk-printing`.

**5d. Chế độ nâng cao (tuỳ chọn): in trực tiếp từ máy chủ.**

Ngoài cách in ở trình duyệt (mặc định, khuyến nghị), hệ thống vẫn còn cách in cũ **từ phía máy chủ**
(dùng cho trường hợp máy in gắn trực tiếp vào máy đang chạy `npm start`, ví dụ máy chủ đặt ngay tại
quầy tiếp nhận). Mặc định `.env` có `PRINTER_ENABLED=false` (tắt) — không ảnh hưởng gì đến cách in
ở mục 5a/5b. Muốn bật thêm:

1. Đặt `PRINTER_ENABLED=true` trong `.env`.
2. Chọn `PRINTER_TYPE` đúng hãng máy in (`epson` hoặc `star`).
3. Chọn `PRINTER_INTERFACE` theo cách máy in kết nối:
   - Máy in USB đã cài làm máy in mặc định của hệ điều hành: `PRINTER_INTERFACE=printer:auto`
   - Máy in mạng LAN: `PRINTER_INTERFACE=tcp://<ip-máy-in>:9100`
   - Máy in qua cổng serial trên Linux: `PRINTER_INTERFACE=/dev/usb/lp0`
4. Khởi động lại `npm start`.

## 6. Máy quét mã QR (CCCD / BHYT)

Kiosk được thiết kế để dùng máy quét mã vạch/QR loại **USB hoạt động như bàn phím** (keyboard
wedge) — cắm USB là dùng được ngay, không cần cài driver. Khi quét, máy tự "gõ" nội dung QR vào ô
đang được focus trên trình duyệt rồi gửi phím Enter, kiosk tự nhận diện đó là QR của CCCD hay BHYT.

## 7. Tự động xoá dữ liệu cũ sau 3 ngày

Vì SQLite không có tính năng TTL tự động như MongoDB, hệ thống tự chạy một tác vụ dọn dẹp
(`src/services/cleanupService.js`) — chạy 1 lần lúc khởi động server, sau đó lặp lại **mỗi giờ** —
xoá toàn bộ vé và bộ đếm số của những ngày cũ hơn `DATA_RETENTION_DAYS` (mặc định 3 ngày, chỉnh
trong `.env`). Không cần cron job cài thêm ở hệ điều hành, mọi thứ đã nằm sẵn trong server.

## 8. Backup dữ liệu

Vì mọi thứ nằm trong 1 file duy nhất, backup cực đơn giản — chỉ cần copy file `data/queue.db` (nên
tắt server hoặc backup ngoài giờ cao điểm để tránh copy dở transaction). Ví dụ cron backup mỗi đêm
trên Linux/macOS:

```bash
0 2 * * * cp /duong-dan-den/queue-system-nodesqlite/data/queue.db /duong-dan-luu-backup/queue-$(date +\%F).db
```

## 9. Cấu trúc project

```
queue-system-nodesqlite/
  data/
    queue.db              # File database SQLite duy nhat (tu tao khi chay lan dau)
  src/
    config/
      db.js               # Mo file SQLite, tao bang du lieu
      priorityRules.js    # Danh sach doi tuong uu tien + thu hang goi so (de chinh sua nhat)
    services/
      qrParser.js         # Doc noi dung QR CCCD / BHYT
      sequenceService.js  # Sinh so thu tu tang lien tuc, an toan khi nhieu kiosk cung boc so
      ticketService.js    # Logic goi so, bo qua, hoan tat - dam bao KHONG goi trung giua cac quay
      printerService.js   # In phieu qua may in nhiet (co che do gia lap)
      cleanupService.js   # Tu dong xoa du lieu cu hon 3 ngay (thay the cho TTL cua Mongo)
    routes/                # Cac API endpoint
    server.js              # Khoi dong Express + Socket.io + lich don dep dinh ky
  public/
    kiosk/                 # Giao dien kiosk boc so
    counter/                # Giao dien man hinh nhan vien quay
    patient-screen/         # Giao dien man hinh benh nhan tung quay
    waiting-screen/          # Giao dien man hinh cho chung
  scripts/
    seedCounters.js          # Tao du lieu quay tiep nhan mau
```

## 10. Một số điểm thiết kế cần lưu ý khi vận hành thật

- **Không trùng số giữa các quầy**: đảm bảo bằng transaction đồng bộ (BEGIN...COMMIT thủ công) của `node:sqlite` khi
  "gọi số tiếp theo" (`src/services/ticketService.js`, hàm `callNextTicket`).
- **Chỉ chạy 1 tiến trình Node.js duy nhất** truy cập file `data/queue.db` cùng lúc. Đây là mô
  hình phù hợp với 1 máy chủ tại chỗ; không chạy nhiều instance server cùng ghi vào 1 file (SQLite
  hỗ trợ nhiều tiến trình đọc/ghi ở mức độ giới hạn qua WAL mode đã bật sẵn, nhưng không phù hợp
  để scale ngang nhiều server như MongoDB).
- **Đối tượng "Người có công với cách mạng"**: chỉ tự động xác nhận được nếu quét thẻ BHYT loại có
  tiền tố 2 chữ cái (`CC`, `CK`, `CB`, `KC`, `TC`, `TD`...). Nếu bệnh nhân chỉ có thẻ BHYT dạng mã
  số 10 số (không tiền tố), hệ thống vẫn cho chọn nhưng đánh dấu "tự khai" để nhân viên quầy đối
  chiếu giấy tờ thực tế khi phục vụ.
- **Chống bỏ đói hàng thường**: thiết kế hiện tại ưu tiên tuyệt đối (đối tượng ưu tiên luôn được
  gọi trước). Nếu số lượng bệnh nhân ưu tiên quá đông khiến hàng thường chờ quá lâu, có thể bổ
  sung thêm cơ chế xen kẽ theo tỷ lệ trong `callNextTicket()` — hỏi lại nếu cần mình bổ sung phần
  này.

## 11. Cập nhật gần đây (màn hình xem, widget, kiosk tự động hoá)

- **`/waiting-screen` và `/patient-screen` không cần đăng nhập**: đây là 2 màn hình CHỈ XEM (không
  có thao tác nhạy cảm nào), nên đã bỏ ra khỏi danh sách yêu cầu đăng nhập
  (`GATED_PATH_PREFIXES` trong `src/server.js`) — mở nhanh trên TV/màn hình phụ mà không cần quét
  mật khẩu nhân viên trước. `/kiosk` và `/counter` vẫn yêu cầu đăng nhập như cũ.
- **Giao diện gọn, không cần cuộn** cho `/waiting-screen` và `/patient-screen`: bổ sung header hiển
  thị `KIOSK_LOGO_IMAGE` + `CLINIC_NAME`, và footer hiển thị `CLINIC_FOOTER_TEXT_2` (chữ to, màu
  xanh, giống kiểu ở `/kiosk`), đồng thời chuyển toàn bộ cỡ chữ/khoảng cách sang đơn vị co giãn
  theo chiều cao màn hình (`clamp(...vh...)`) để nội dung luôn vừa đúng 1 màn hình. Script dùng
  chung để lấy dữ liệu thương hiệu: `public/branding-header.js` (gọi API `/api/branding`).
- **Bỏ dòng chữ "Bạn là ai?"** ở màn hình chọn vai trò (`public/index.html`).
- **Widget quầy (ứng dụng Electron) có thêm 2 nút**: "Thứ tự ưu tiên gọi số" và "Danh sách vắng
  mặt" — bấm vào sẽ mở thẳng đúng cửa sổ/khung tương ứng trên trang `/counter` đầy đủ (dùng dấu `#`
  trên URL để trang `/counter` tự bấm mở đúng khung khi tải xong, xem `openAutoTargetFromHash()`
  trong `public/counter/counter.js`).
- **`/kiosk`: bắt buộc nhập mật khẩu nhân viên khi bấm Back hoặc thoát trang** (bản mới nhất — xem
  thêm mục 12 bên dưới về việc đổi từ "chặn cứng" sang "xin mật khẩu"):
  - Bấm nút Back của trình duyệt vẫn bị chặn không cho lùi trang thật sự (kỹ thuật
    `history.pushState` + lắng nghe `popstate`), nhưng đồng thời mở ra hộp thoại xin mật khẩu nhân
    viên — nhập đúng mới thực sự điều hướng về "/".
  - Khi trang `/kiosk` bị đóng/điều hướng đi nơi khác (sự kiện `pagehide` — bao gồm cả khi vừa rời
    kiosk thành công qua hộp thoại mật khẩu ở trên), tự động gọi API `/api/auth/staff-logout` (qua
    `navigator.sendBeacon` để đảm bảo gửi được ngay cả khi trang đã đóng) để huỷ phiên đăng nhập
    trên máy chủ — lần sau muốn vào các trang nhân viên khác (`/counter`, `/kiosk`...) đều phải
    nhập mật khẩu lại từ đầu.
- **`/kiosk`: tự động xác định đối tượng ưu tiên, bỏ hẳn bước chọn thủ công**: sau khi bệnh nhân
  quét CCCD hoặc thẻ BHYT, hệ thống CHỈ tự động xét 2 diện — "≥ 75 tuổi" và "trẻ em dưới 6 tuổi"
  (suy ra từ tuổi trên CCCD) — nếu không thuộc 1 trong 2 diện này thì mặc định lấy số "Đối tượng
  thường", không hiển thị màn hình chọn diện ưu tiên (bao gồm các mục tự khai như mang thai/khuyết
  tật) nữa. Bệnh nhân không cần thao tác gì thêm sau khi quét giấy tờ. Xem `goToPriorityStep()`
  trong `public/kiosk/kiosk.js`.

## 12. Cập nhật gần đây (đợt 2): mở cửa sổ mới, sửa lỗi hiển thị, nút Home ở Kiosk

- **"Màn hình chờ chung" và "Màn hình bệnh nhân" mở bằng cửa sổ mới**: trước đây bấm thẻ "Màn hình
  chờ chung" ở trang chọn vai trò (`/`) điều hướng NGAY TRÊN TAB HIỆN TẠI (mất luôn màn hình quản
  lý nhân viên đang xem) — nay đổi sang `window.open()` với 1 TÊN CỬA SỔ CỐ ĐỊNH
  (`openWaitingScreen()`, `openPatientScreenFromMenu()` trong `public/index.html`), trình duyệt sẽ
  tự đưa cửa sổ đã mở sẵn ra trước (không mở thêm cửa sổ mới) nếu bấm lại — áp dụng luôn cho thẻ
  mới "Màn hình bệnh nhân" (dùng quầy đã chọn gần nhất lưu trong `localStorage`, chọn quầy trước
  tại "Màn hình quầy" nếu chưa từng chọn).
- **Sửa lỗi `CLINIC_FOOTER_TEXT_2` hiển thị nhỏ/màu đen** ở `/waiting-screen` và `/patient-screen`:
  thiếu class CSS `app-footer-2` (đã có sẵn trong `common.css` nhưng chưa gắn vào thẻ HTML) — nay đã
  gắn đúng, dòng chân trang thứ 2 hiển thị chữ TO bằng đúng cỡ chữ tên đơn vị (`CLINIC_NAME`) và tô
  màu xanh dương, đúng như dòng chân trang thứ 2 ở `/kiosk`.
- **`/patient-screen`: nhãn tên quầy (ví dụ "Q02 - Quầy tiếp nhận 2") to lên bằng cỡ chữ
  `CLINIC_NAME`** (trước đó nhỏ hơn một chút).
- **Trang chọn vai trò (`/`) dùng logo + tên đơn vị thật** (`KIOSK_LOGO_IMAGE`, `CLINIC_NAME` qua
  `/api/branding`) thay cho icon "chữ thập y tế" chung chung và chữ "Hệ thống bắt số" cố định — đồng
  bộ giao diện với các màn hình khác, vì đây cũng là nơi nút Home ở `/kiosk` (bên dưới) đưa nhân
  viên về.
- **`/kiosk` có thêm nút Home 🏠** cạnh nút "Chế độ Kiosk ⛶" — đưa về trang chọn vai trò ("/"), NHƯNG
  bắt buộc xác nhận nhân viên trước (hộp thoại `#staffExitModal`) mới thực sự điều hướng, tránh việc
  ai đó rảnh tay bấm nút này rời khỏi kiosk công khai bất kỳ lúc nào (xem thêm mục 13 bên dưới — bản
  mới nhất hộp thoại này CHỈ quét mã QR, không còn ô nhập mật khẩu tay).
- **Đổi cách chặn nút Back của trình duyệt ở `/kiosk`**: bản trước chặn CỨNG hoàn toàn (không cho đi
  đâu cả, không có lối thoát nào ngoài đóng hẳn trang) — nay ROLLBACK LẠI cách này, thay bằng: bấm
  Back vẫn bị chặn không cho lùi trang thật sự, nhưng đồng thời mở ra CÙNG hộp thoại xác nhận như
  nút Home ở trên. Xem `requestStaffExit()`, `submitStaffExit()` trong `public/kiosk/kiosk.js`.

## 13. Cập nhật gần đây (đợt 3): bỏ nút bấm tay ở Kiosk, hộp thoại thoát chỉ quét QR

- **Bỏ nút "Xong – Bốc số cho người khác"** ở màn hình "Số thứ tự của bạn" — kiosk công khai không
  cần bệnh nhân thao tác tay. Thay bằng bộ đếm ngược HIỂN THỊ RÕ (`#doneCountdown`), dùng CHUNG cấu
  hình `KIOSK_AUTO_CONFIRM_SECONDS` (thay vì mốc 8 giây cố định riêng trước đó) — hết giờ tự động
  quay lại màn hình quét. Xem `startDoneCountdown()` trong `public/kiosk/kiosk.js`.
- **Hộp thoại xác nhận rời Kiosk (nút Home 🏠 / bấm Back) đổi thành CHỈ quét mã QR**, bỏ hẳn ô nhập
  mật khẩu bằng tay (kiosk công khai vốn không dùng bàn phím/chuột) — quét đúng mã QR đăng nhập
  nhanh (cùng mã dùng ở trang "/", xem `/api/auth/login-qr`) mới thực sự rời khỏi kiosk. Nếu KHÔNG
  có lệnh quét nào trong vòng `KIOSK_AUTO_CONFIRM_SECONDS` giây kể từ lúc mở hộp thoại, hộp thoại tự
  động đóng lại và ở NGUYÊN tại màn hình Kiosk (không rời đi). Xem `requestStaffExit()`,
  `submitStaffExit()`, `focusScanner()` trong `public/kiosk/kiosk.js`.

## 14. Cập nhật gần đây (đợt 4): `/staff-kiosk` — bỏ nút bấm tay, bỏ ô tên bệnh nhân, thêm QR cấp nhanh

- **Bỏ nút "Xong – Cấp số cho người khác"** ở màn hình "Số thứ tự vừa cấp", thay bằng bộ đếm ngược
  hiển thị rõ (`#doneCountdown`), dùng CHUNG cấu hình `KIOSK_AUTO_CONFIRM_SECONDS` với kiosk công
  khai (`/kiosk`) — hết giờ tự động quay lại màn hình chọn đối tượng, giúp nhân viên cấp số liên
  tục nhanh hơn mà không cần bấm tay. Xem `startDoneCountdown()` trong
  `public/staff-kiosk/staff-kiosk.js`.
- **Bỏ hẳn ô "Thông tin bệnh nhân (không bắt buộc)"** (nhập họ tên tay) — trước đây không bắt buộc
  và ít dùng; giờ khi quét CCCD/BHYT hệ thống tự lấy họ tên từ giấy tờ, còn cấp số không xác minh
  (qua "Cấp số ngay" hoặc QR cấp nhanh — xem bên dưới) thì phiếu để trống tên.
- **Thêm tính năng "QR cấp nhanh"**: mỗi đối tượng (7 mức ưu tiên + "Đối tượng thường" — tổng 8) có
  1 mã bí mật riêng cấu hình qua `QUICK_QR_CODE_<mã đối tượng>` trong `.env` (ví dụ
  `QUICK_QR_CODE_EMERGENCY`, `QUICK_QR_CODE_NORMAL`...; để trống = tắt tính năng cho đối tượng đó).
  Ở `/staff-kiosk`, đối tượng nào đã cấu hình mã sẽ có thêm nút nhỏ **"📱 QR"** cạnh nút chọn đối
  tượng — bấm vào để tạo và xem/in 1 ảnh QR encode sẵn mã đó. Sau đó, quét LẠI đúng ảnh QR này bất
  kỳ lúc nào (kể cả đang ở màn hình chính, chưa chọn đối tượng gì) sẽ **cấp số ngay lập tức**,
  không cần chọn đối tượng, không cần xác minh CCCD/BHYT, không cần nhập thông tin gì thêm. Máy chủ
  luôn đối chiếu lại đúng mã bí mật hiện tại trong `.env` trước khi cấp — mã cũ/sai/đoán mò sẽ bị từ
  chối (401). Xem `GET /api/tickets/quick-qr-image/:code`, `POST /api/tickets/quick` trong
  `src/routes/tickets.js`; `getQuickQrSecret()` trong `src/config/priorityRules.js`; và
  `showQuickQr()`, `processQuickQrScan()`, `handleScannedText()` trong
  `public/staff-kiosk/staff-kiosk.js`.

## 15. Cập nhật gần đây (đợt 5): thêm 8 nút "gọi tiếp theo" riêng cho từng đối tượng ưu tiên

- **Giữ nguyên hoàn toàn** nút "Gọi tiếp theo" gốc ở `/counter/` (và ở widget) — hành vi gọi theo
  đúng thứ tự ưu tiên/thứ tự tuỳ chỉnh của quầy như cũ, không đổi gì cả.
- **Thêm mới ở `/counter/`**: 1 hàng 8 nút "Gọi tiếp theo theo từng đối tượng" (7 mức ưu tiên +
  "Đối tượng thường" — đủ 8), đặt ngay dưới cụm nút chính. Mỗi nút 1 màu trùng với màu đối tượng đó
  trên các màn hình khác (màn hình chờ, màn hình bệnh nhân...). Bấm vào 1 nút sẽ gọi số **đang chờ
  nhỏ nhất CỦA RIÊNG đối tượng đó**, bỏ qua thứ tự ưu tiên/thứ tự tuỳ chỉnh mặc định của quầy — hữu
  ích khi nhân viên muốn chủ động gọi đúng 1 loại (ví dụ ưu tiên gọi hết "Cấp cứu" đang chờ trước).
  Vẫn tự động hoàn tất số đang phục vụ hiện tại (nếu có) giống hệt nút gọi gốc. Nếu đối tượng đó
  không còn ai chờ, hiện thông báo rõ ràng và không ảnh hưởng gì đến các số khác đang chờ.
- **Thêm mới ở widget** (`electron-widget`): cụm số lượng đang chờ theo từng đối tượng
  (`#queueCounts`) giờ **CŨNG LÀ nút bấm luôn** — bấm vào 1 số = gọi tiếp theo của riêng đối tượng
  đó, làm y hệt việc gọi riêng từng đối tượng như ở `/counter/`, không cần mở màn hình quản lý đầy
  đủ. (Bản đầu tiên của tính năng này thêm hẳn 1 dòng thứ 2 riêng gồm 8 nút icon — sau đó theo yêu
  cầu đã **gộp lại làm 1 với cụm số lượng đang chờ** để cả widget quay về đúng 1 dòng ngang duy
  nhất như thiết kế ban đầu, xem mục 17 bên dưới.)
- **Backend (dùng chung cho cả 2 nơi trên)**: route mới `POST /api/counters/:id/call-next-priority`
  (body `{ priorityCode }`) và hàm `callNextTicketByPriority()` trong `src/services/ticketService.js`
  — viết tương tự `callNextTicket()`/route `call-next` gốc (vốn giữ nguyên không đổi), chỉ khác ở
  chỗ lọc đúng 1 `priority_code` do nhân viên chỉ định, sắp theo số thứ tự tăng dần trong nhóm đó.
  Xem `renderPriorityCallButtons()`/`callNextByPriority()` trong `public/counter/counter.js` và
  `callNextByPriority()` trong `public/counter/widget/widget.js`.

## 16. Cập nhật gần đây (đợt 6): bỏ tên từ QR BHYT, icon Home, đổi màu "Đối tượng thường", nhẹ widget, kiểm tra điều kiện ưu tiên

- **Không còn lấy họ tên từ QR thẻ BHYT** ở cả `/kiosk` lẫn `/staff-kiosk` (kể cả khi in phiếu) —
  field họ tên trong QR BHYT là chuỗi mã hoá/định dạng riêng của hệ thống BHXH, giải mã sai sẽ ra
  tên sai/lỗi mà không có cách nào tự phát hiện được. Từ nay phiếu/ticket lấy CCCD làm ưu tiên tuyệt
  đối cho họ tên (văn bản rõ, đáng tin cậy) — nếu bệnh nhân chỉ quét thẻ BHYT (không có CCCD) thì để
  trống tên. Xem `parseBHYT()` trong `src/services/qrParser.js`, `patientInfoForReceipt()` trong
  `public/print-receipt.js`.
- **Thêm icon 🏠 Home** ở góc trên-trái của `/waiting-screen/` và `/patient-screen/` (2 màn hình này
  không yêu cầu đăng nhập nhân viên nên bấm là về thẳng "/", không cần mật khẩu — khác với nút Home
  ở `/kiosk` vốn bắt buộc xác minh mật khẩu vì đó là kiosk công khai). Xem class dùng chung
  `.app-home-btn` trong `public/common.css`.
- **Đổi màu "Đối tượng thường"** từ trắng xám (`#e2e8f0`) sang đen nhạt/xám đậm (`#4b5563`) — cập
  nhật ở `NORMAL_RULE` trong `src/config/priorityRules.js`; các nơi hiển thị nút theo màu đối tượng
  (8 nút gọi riêng ở `/counter/`, widget, và danh sách nút ở `/staff-kiosk/`) đã đổi màu chữ sang
  trắng cho đối tượng này để đủ tương phản, giống cách xử lý sẵn có với "Cấp cứu".
- **Widget không còn ghi log ra file** (`in-phieu-debug.log`/`in-phieu-debug-cuoi.pdf` trên Desktop)
  để đỡ tốn I/O đĩa chạy nền liên tục — bỏ luôn 2 mục menu khay hệ thống "Mở file nhật ký in" và "Mở
  file PDF phiếu vừa in". Xem `debugLog()` (nay là no-op) trong `electron-widget/main.js`.
- **`/staff-kiosk/`: kiểm tra điều kiện khách quan khi nhân viên CÓ quét CCCD/BHYT để xác minh** —
  với 3 đối tượng có thể xác minh được qua giấy tờ (`≥ 75 tuổi`, `Trẻ em dưới 06 tuổi`, `Phụ nữ có
  thai` — xét giới tính Nữ), nếu giấy tờ vừa quét KHÔNG khớp đối tượng đã chọn, hệ thống cảnh báo rõ
  và chặn cấp số, nhân viên có thể "Vẫn cấp số" (tự xác nhận đúng) hoặc huỷ chọn lại. Các đối tượng
  còn lại (khuyết tật, công cách mạng, cấp cứu...) vẫn tự khai/nhân viên tự đối chiếu như cũ, không
  chặn. Tính tuổi vẫn dùng `dayjs().diff(dob, 'year')` (đã kiểm tra lại bằng nhiều mốc ngày/tháng
  sinh khác nhau, kể cả sát ngày sinh nhật) — chính xác đến từng ngày chứ không chỉ trừ năm, nên
  "Trẻ em dưới 06 tuổi" tính đúng cả trường hợp trẻ sắp/vừa tròn 6 tuổi. Xem
  `NEEDS_CONDITION_CHECK`/`conditionHintForCode()` trong `public/staff-kiosk/staff-kiosk.js` (dùng
  lại `getEligibleOptions()` từ server qua `/api/tickets/parse-qr` làm 1 nguồn sự thật duy nhất,
  không tự tính lại ở client).

## 17. Cập nhật gần đây (đợt 7): gộp widget lại về đúng 1 dòng ngang

- **Gộp cụm "số lượng đang chờ theo đối tượng" (`#queueCounts`) và dòng 8 nút icon "gọi tiếp theo
  theo từng đối tượng" (thêm ở đợt 5) làm MỘT** — bỏ hẳn dòng thứ 2 riêng, đưa hành vi "gọi tiếp
  theo của riêng 1 đối tượng" thẳng vào chính các con số đang hiển thị: mỗi số trong cụm
  `#queueCounts` giờ là 1 `<button>`, giữ đúng màu/vị trí như số cũ (không đổi bố cục nhìn tổng
  thể), nhưng bấm vào sẽ gọi ngay số tiếp theo của riêng đối tượng đó (gọi
  `POST /api/counters/:id/call-next-priority`, giống hệt hành vi cũ của dòng nút icon đã bỏ).
  Tooltip (rê chuột) mỗi số hiện đủ: tên đối tượng, số lượng đang chờ, và gợi ý "bấm để gọi".
- Nhờ vậy widget **quay lại đúng 1 dòng ngang duy nhất** như thiết kế ban đầu — cửa sổ widget trở
  lại chiều cao mặc định/tối thiểu cũ (40px/36px thay vì 76px/66px lúc có 2 dòng), chiều rộng mặc
  định tăng nhẹ (430 → 480px) để 8 nút số vẫn đủ chỗ hiện hết trên 1 dòng mà không phải cuộn ngang
  (`#queueCounts` vẫn có thể cuộn ngang nếu nhân viên tự thu nhỏ cửa sổ hơn nữa).
  Xem `renderQueueCounts()`/`callNextByPriority()` trong `public/counter/widget/widget.js`,
  `#queueCounts` trong `public/counter/widget/index.html`, và
  `WIDGET_DEFAULT_SIZE`/`WIDGET_MIN_SIZE` trong `electron-widget/main.js`.
- Không đổi gì ở `/counter/` (8 nút "gọi tiếp theo theo từng đối tượng" ở đó vẫn giữ nguyên dạng
  hàng nút riêng như đợt 5) — yêu cầu gộp dòng lần này chỉ áp dụng cho widget.

## 18. Cập nhật gần đây (đợt 8): chi tiết số lượng đang chờ theo từng đối tượng ở màn hình chờ/bệnh nhân

- **`/waiting-screen/`**: thêm 1 khối ngay dưới dòng "Số đang chờ trong hàng đợi", liệt kê số
  lượng đang chờ của TỪNG đối tượng (7 mức ưu tiên + "Đối tượng thường" — đủ 8), mỗi đối tượng 1
  chấm màu trùng với màu số/legend sẵn có, kèm số lượng in đậm. Zero-fill đủ cả 8 loại (kể cả đối
  tượng đang có 0 người chờ) để nhân viên/bệnh nhân nhìn thấy đầy đủ bức tranh, không chỉ những
  loại đang có người chờ.
- **`/patient-screen`**: thêm y hệt khối trên (nhãn "Số đang chờ trong hàng đợi"), đặt giữa khối
  "số đã gọi nhưng chưa vào (bỏ qua)" và bảng chú thích màu — đây là số liệu của TOÀN hệ thống
  (không riêng quầy đang xem), giúp bệnh nhân biết đang có bao nhiêu người thuộc từng đối tượng chờ
  phía trước.
- Dữ liệu lấy từ `summary.waitingByPriority` đã có sẵn trong `/api/display/summary` (không cần
  route mới) — chỉ thêm phần hiển thị. Xem class dùng chung `.priority-count-box`/
  `.priority-count-chip` trong `public/common.css`, và `renderPriorityCountBox()` trong
  `public/waiting-screen/index.html` / `public/patient-screen/index.html`.

## 19. Cập nhật gần đây (đợt 9): chi tiết số lượng ở kiosk, nút mở kiosk cấp số trên widget

- **`/kiosk/`** và **`/staff-kiosk/`**: thêm y hệt khối "chi tiết số lượng đang chờ theo từng đối
  tượng" (đợt 8, `.priority-count-box`) như ở `/waiting-screen/`/`/patient-screen` — LUÔN hiển thị
  dù đang ở bước nào (quét/xác minh/đã cấp số xong), cập nhật realtime qua socket.io. Hai trang này
  trước đây chưa nạp `socket.io.js` nên phải thêm thẻ `<script>` tương ứng; dùng riêng 1 kết nối
  socket cho việc này (không đụng đến logic quét/cấp số hiện có). Xem `renderPriorityCountBox()`
  trong `public/kiosk/kiosk.js` và `public/staff-kiosk/staff-kiosk.js`.
- **Widget**: thêm 1 nút mới (biểu tượng thẻ nhân viên, cạnh nút mở màn hình bệnh nhân) để mở
  THẲNG kiosk cấp số – Nhân viên (`/staff-kiosk`) mà không cần vào menu khay hệ thống hay mở trang
  quản lý đầy đủ trước. Nút này KHÔNG phụ thuộc quầy đang chọn (khác 2 nút bên cạnh) vì nhân viên
  có thể cấp số bất kỳ lúc nào dù chưa chọn quầy để gọi số. Trong ứng dụng Electron, nút mở đúng 1
  cửa sổ NGAY TRONG ứng dụng (dùng chung hàm với mục tray cũ) để tính năng in lặng lẽ qua máy in
  nhiệt hoạt động được — mở bằng tab trình duyệt thường (ví dụ khi test ngoài Electron) vẫn hoạt
  động nhưng sẽ in qua hộp thoại in thông thường. Xem `openStaffKiosk()` trong
  `public/counter/widget/widget.js`, `openStaffKiosk` trong `electron-widget/preload.js`, và IPC
  `open-staff-kiosk` trong `electron-widget/main.js`.

## 20. Cập nhật gần đây (đợt 10): chống nhiễu Enter giữa chừng khi quét QR (bảo vệ đối chiếu trùng)

- **Vấn đề thực tế**: một số máy quét QR/mã vạch USB kiểu bàn phím (keyboard wedge) có tỷ lệ gửi
  NHẦM 1 phím Enter ngay GIỮA chuỗi đang quét (do lỗi cấu hình/firmware/đứt quãng), chứ không chỉ 1
  lần Enter thật ở cuối. Code cũ chỉ lắng nghe "có Enter là xử lý ngay giá trị hiện có của ô input",
  nên gặp Enter nhiễu giữa chừng sẽ xử lý luôn 1 chuỗi BỊ CẮT CỤT. Với QR CCCD/BHYT, nếu bị cắt đúng
  vào đoạn chứa số CCCD/mã thẻ BHYT (trường dùng để **đối chiếu trùng — chống cấp trùng số cho cùng
  1 người**), số bị cắt ngắn sẽ không còn khớp với lịch sử thật, khiến cơ chế chống trùng mất tác
  dụng mà không báo lỗi gì — sai âm thầm, rất nguy hiểm.
- **Cách khắc phục** (không cần đổi phần cứng máy quét, chỉ sửa cách diễn giải dữ liệu ở phần mềm):
  thêm tiện ích dùng chung mới `public/vendor/scanner-buffer.js` (`window.ScannerBuffer.attach(...)`)
  thay cho việc lắng nghe `keydown`/Enter trực tiếp như trước, với 3 lớp bảo vệ:
  1. Khi nhận Enter, chỉ coi là **kết thúc thật sự** nếu nội dung hiện có đã "hợp lệ tối thiểu" (do
     hàm `isComplete(text)` truyền vào quyết định — ví dụ đủ số phần tử ngăn bởi `|` và đoạn số CCCD
     đủ 12 chữ số). Nếu chưa đủ, Enter đó bị coi là nhiễu và bỏ qua — KHÔNG xử lý, KHÔNG xoá ô input
     — máy quét sẽ tự gõ tiếp phần còn lại ngay sau đó vào đúng ô này.
  2. Dự phòng bằng thời gian: nếu không có ký tự mới nào trong 150ms kể từ ký tự/Enter cuối và ô
     input đang có nội dung, tự động coi như đã quét xong (cứu cả trường hợp máy quét không gửi
     Enter cuối, lẫn trường hợp Enter cuối cũng bị mất/nhiễu).
  3. Dọn rác: nếu ô input "đứng im" quá 3 giây mà vẫn chưa đủ điều kiện hợp lệ, tự xoá sạch — tránh
     phần còn sót lại của 1 lần quét lỗi bị nối nhầm vào lần quét kế tiếp của người khác.
- **Áp dụng cho toàn bộ 4 ô quét kiểu bàn phím** trong hệ thống: `scanInput` chính và
  `staffExitScanInput` (nhân viên quét CCCD/BHYT để "ra khỏi" trạng thái xác thực) ở
  `public/kiosk/kiosk.js`; `scanInput` chính ở `public/staff-kiosk/staff-kiosk.js` (áp dụng cho cả
  luồng quét CCCD/BHYT xác minh lẫn luồng quét mã QR "cấp nhanh" `QUICKQR|...`); `scanLoginInput` ở
  `public/index.html` (đăng nhập nhân viên bằng cách quét QR). Mỗi nơi có hàm kiểm tra "đã đủ dữ
  liệu chưa" riêng phù hợp định dạng (`looksLikeCompleteQr()` trong `kiosk.js`,
  `looksLikeCompleteScan()` trong `staff-kiosk.js`), ưu tiên chặt nhất ở đúng đoạn số CCCD (12 chữ
  số) vì đó là phần quyết định đối chiếu trùng. Mỗi nơi đều giữ lại phương án dự phòng bằng cách
  quay về hành vi Enter trực tiếp như cũ nếu vì lý do nào đó `window.ScannerBuffer` không tải được.
  Toàn bộ logic xử lý dữ liệu sau khi quét xong (gọi `/api/tickets/parse-qr`, kiểm tra cooldown,
  xử lý QUICKQR...) giữ nguyên không đổi — chỉ thay cách xác định "khi nào coi là quét xong".
- **Đã kiểm chứng** bằng kịch bản mô phỏng thật trong trình duyệt (Playwright, gõ ký tự + bấm Enter
  y như máy quét): (1) Enter nhiễu giữa chừng ngay trong đoạn số CCCD bị bỏ qua đúng như kỳ vọng,
  bộ đệm giữ nguyên phần đã gõ và ghép tiếp phần còn lại thành chuỗi đầy đủ chính xác khi có Enter
  thật; (2) máy quét không gửi Enter cuối vẫn tự hoàn tất đúng dữ liệu sau 150ms nhờ dự phòng thời
  gian; (3) trường hợp quét bình thường (1 Enter thật ở cuối) hoạt động giống hệt như trước, không
  hồi quy; (4) bộ đệm dở dang tự xoá sau 3 giây đứng im, không lẫn sang lần quét sau.

## 21. Cập nhật gần đây (đợt 11): sửa tiếp lỗi đối chiếu trùng với thẻ BHYT quét bằng máy còn bị Enter nhiễu

- **Người dùng phản hồi thực tế**: gửi kèm 1 mẫu nội dung QR thẻ BHYT thật (định dạng **nhiều
  trường hơn hẳn dự đoán ban đầu** — 16 trường ngăn bởi `|`, không chỉ 4 trường như code đợt 10
  giả định) và cho biết máy quét của họ (chưa chỉnh được ở tầng phần cứng) vẫn khiến hệ thống đối
  chiếu trùng sai.
- **Lỗi gốc phát hiện thêm ở đợt 10**: hàm `isComplete()` cho thẻ BHYT (không phải CCCD) chỉ yêu
  cầu "đủ tối thiểu 4 phần tử ngăn bởi `|`" — với thẻ thật có tới 16 trường, mốc 4 trường đạt được
  RẤT SỚM, từ lúc máy quét mới gõ được hơn 1/4 nội dung. Khi 1 Enter nhiễu rơi đúng vào lúc đó, code
  đợt 10 coi `isComplete()==true` là **lập tức xử lý VÀ xoá sạch ô input** — cắt đôi dữ liệu thật
  làm 2 mảnh: mảnh đầu (thiếu) được xử lý như 1 lượt quét xong, còn 12 trường còn lại bị máy quét gõ
  tiếp vào 1 ô đã bị xoá trống, trở thành **1 lượt "quét" thứ hai, riêng biệt, với dữ liệu rác** (vì
  bắt đầu giữa chừng 1 trường nào đó, không phải từ đầu mã thẻ) — mảnh rác này khi đủ 4 phần tử lại
  tiếp tục bị coi là "quét xong" và gửi lên server với `parts[0]` (dùng làm `id_number` để đối chiếu
  trùng) là **rác, không phải mã thẻ BHYT thật** → sai đối chiếu trùng, đúng như phản ánh.
- **Sửa tận gốc trong `public/vendor/scanner-buffer.js`**: bỏ hẳn việc Enter kích hoạt xử lý+xoá
  **đồng bộ, ngay lập tức** — dù `isComplete()` trả về true hay false, Enter giờ chỉ đặt lịch "chờ
  xác nhận im lặng" (không có ký tự mới nào nữa) rồi mới thực sự xử lý: `confirmMs` (mặc định 80ms,
  ngắn hơn) nếu nội dung đã "có vẻ đủ", hoặc `idleMs` (mặc định 150ms, đầy đủ) nếu chưa. Nếu máy
  quét gõ tiếp ngay sau Enter nhiễu (đúng đặc trưng máy quét — dưới ~20ms/ký tự), ký tự mới đó sẽ TỰ
  ĐỘNG huỷ lịch xử lý đang chờ và nối tiếp vào đúng 1 ô input hiện có — không còn bị cắt đôi dữ liệu
  nữa dù không biết trước chính xác thẻ có bao nhiêu trường. Cách này không phụ thuộc vào việc đoán
  đúng số trường thật của từng loại thẻ/định dạng — chỉ dựa vào đặc trưng thời gian gõ của máy quét,
  nên an toàn cho mọi định dạng QR khác nhau giữa các loại thẻ BHYT (giấy, VNeID, VssID...).
- Độ trễ tăng thêm cho 1 lượt quét hợp lệ bình thường là rất nhỏ (80-150ms sau khi máy quét dừng
  gõ) — không nhận biết được bằng mắt thường, đổi lại loại bỏ hẳn nguy cơ dữ liệu bị cắt đôi.
- **Đã kiểm chứng lại bằng đúng mẫu thẻ BHYT thật do người dùng cung cấp** (mô phỏng trong trình
  duyệt: gõ 4 trường đầu, bắn 1 Enter nhiễu đúng như báo cáo, rồi gõ tiếp 12 trường còn lại + Enter
  thật ở cuối) — xác nhận: chỉ có ĐÚNG 1 lượt xử lý duy nhất (không phát sinh lượt rác thứ hai), nội
  dung khớp 100% với chuỗi gốc, và mã thẻ trích ra (`8221864421`, dùng làm khoá đối chiếu trùng) qua
  đúng `parseBHYT()` ở `src/services/qrParser.js` là chính xác. Chạy lại đầy đủ 4 kịch bản đã kiểm
  chứng ở đợt 10 (Enter nhiễu giữa số CCCD, thiếu Enter cuối, quét bình thường, dọn bộ đệm dở dang
  sau 3 giây) — đều vẫn đúng, không hồi quy.

## 22. Sửa lỗi: reload lại trang http://localhost:4000/kiosk/ bị lỗi (mất đăng nhập oan)

- **Hiện tượng người dùng báo**: bấm reload (F5) trang `/kiosk/` (đang dùng bình thường, đã đăng
  nhập) thì trang bị lỗi — màn hình kẹt ở "Đang tải...", không vào lại được đúng giao diện kiosk.
- **Nguyên nhân tìm ra** (tái hiện được bằng Playwright — mô phỏng đăng nhập rồi reload nhiều lần):
  `/kiosk` nằm trong danh sách đường dẫn yêu cầu đăng nhập nhân viên (`GATED_PATH_PREFIXES` trong
  `src/server.js`). Trang có gắn sự kiện `pagehide` để **tự động đăng xuất** khi rời hẳn khỏi kiosk
  (đóng tab, điều hướng sang trang khác...) — mục đích là buộc phải đăng nhập lại từ đầu, tránh để
  lộ phiên đăng nhập cũ trên máy kiosk dùng chung. Vấn đề là **`pagehide` cũng tự chạy khi trang chỉ
  đơn giản được TẢI LẠI (F5/reload)**, không chỉ khi rời hẳn — nên trước đây mỗi lần F5, phiên đăng
  nhập bị xoá NGAY LẬP TỨC đúng lúc trang mới (cùng địa chỉ) đang tải các file con (`kiosk.js`, ảnh
  nền...). Các request đó vì mất phiên nên bị máy chủ chuyển hướng về trang đăng nhập thay vì trả
  đúng nội dung — trình duyệt nhận nhầm HTML trang đăng nhập là file `.js`, báo lỗi cú pháp
  ("Unexpected token '<'"), khiến toàn bộ `kiosk.js` không chạy được và trang kẹt mãi ở "Đang tải...".
- **Cách sửa** (trong `src/services/authService.js`, `src/routes/auth.js`,
  `public/kiosk/kiosk.js`): thêm khái niệm "đăng xuất mềm" — thay vì `pagehide` xoá phiên NGAY, gọi
  `POST /api/auth/staff-logout?soft=1` chỉ **lên lịch** xoá sau một khoảng "ân hạn" ngắn (mặc định
  2 giây, `scheduleSoftLogout()`), và KHÔNG xoá cookie ngay (quan trọng — nếu xoá cookie ngay thì dù
  có hoãn xoá phiên phía server cũng vô ích, vì trình duyệt đã không còn gửi cookie kèm request nào
  nữa). Nếu đây thực sự là 1 lần F5: trang mới (cùng tab, cùng địa chỉ) tải lại gần như ngay lập
  tức, và **bất kỳ request nào đi qua được cổng đăng nhập** (`isValidSession()`) đều được coi là
  bằng chứng "phiên vẫn đang sống" — tự động huỷ lệnh xoá đang chờ, phiên giữ nguyên, trang vào lại
  bình thường. Nếu là đóng tab/rời hẳn thật sự: không còn request nào dùng phiên đó nữa, hết thời
  gian ân hạn phiên vẫn bị xoá thật như thiết kế ban đầu — hành vi bảo mật cũ (đăng xuất khi rời
  kiosk) không đổi, chỉ khác là có độ trễ ~2 giây thay vì tức thì (không ảnh hưởng thực tế). Thêm 1
  lệnh gọi `fetch('/api/auth/staff-status')` ngay đầu `kiosk.js` làm lưới an toàn bổ sung, đảm bảo
  huỷ lệnh xoá đang chờ càng sớm càng tốt, không phụ thuộc thứ tự tải các tài nguyên khác của trang.
- **Đã kiểm chứng**: F5 liên tục 5 lần vào trang đang đăng nhập — không còn lỗi, không còn kẹt "Đang
  tải...", đúng giao diện kiosk mỗi lần. Đồng thời xác nhận đóng tab/rời hẳn (điều hướng sang trang
  khác) vẫn đăng xuất đúng như cũ (kiểm tra trạng thái phiên ~2.5 giây sau khi rời — đã bị vô hiệu).
  Cơ chế `pagehide`/`exit-session` tương tự ở `public/counter/counter.js` (giải phóng quầy đang
  chiếm dụng, không phải xoá phiên đăng nhập) dùng cơ chế khác, có sẵn lưới an toàn riêng bằng
  heartbeat định kỳ, và không gây ra đúng triệu chứng "mất đăng nhập" này nên chưa cần sửa — chỉ sửa
  đúng phần liên quan đến `/kiosk/` theo đúng phản ánh.

## 23. Cập nhật gần đây (đợt 12): quét mã QR đăng nhập nhân viên để chuyển thẳng qua lại kiosk ↔ kiosk NV; widget chờ kết nối máy chủ thay vì lỗi

- **Chuyển màn hình bằng cách quét mã QR đăng nhập nhân viên** (mã QR do `GET /api/auth/login-qr`
  tạo ra — chỉ encode nguyên văn mật khẩu nhân viên, không có dấu `|`, khác hẳn QR CCCD/BHYT hay QR
  "cấp nhanh"):
  - Đứng ở `/kiosk/` (kiosk bốc số cho bệnh nhân), quét đúng mã QR này sẽ **tự động chuyển thẳng
    sang `/staff-kiosk/`** (kiosk cấp số nhân viên) — không cần vào modal "rời kiosk" trước.
  - Đứng ở `/staff-kiosk/`, quét đúng mã QR này sẽ **tự động chuyển thẳng sang `/kiosk/`** (chiều
    ngược lại) — tiện cho nhân viên đứng máy chuyển đổi qua lại 2 màn hình nhanh mà không cần thao
    tác tay.
  - Cả 2 chiều đều xác thực THẬT SỰ ở server (gọi lại `POST /api/auth/staff-login` với nội dung vừa
    quét) trước khi điều hướng — chỉ mã QR chứa ĐÚNG mật khẩu nhân viên mới được chấp nhận, tránh
    trường hợp quét nhầm 1 mã vạch/QR khác (không có dấu `|`) bị hiểu nhầm thành lệnh chuyển màn
    hình. Xem `tryStaffQrShortcut()` trong `public/kiosk/kiosk.js` và
    `public/staff-kiosk/staff-kiosk.js`; cả 2 nơi đều nhận diện QR này qua đặc điểm không có dấu
    `|` (khác CCCD/BHYT luôn có nhiều trường ngăn bởi `|`, và khác QR "cấp nhanh" luôn có tiền tố
    `QUICKQR|`) — đã kiểm chứng bằng Playwright: quét đúng mã ở mỗi chiều chuyển đúng trang, quét
    sai nội dung thì báo lỗi và ở lại đúng trang, và quét CCCD/BHYT/QUICKQR bình thường ở cả 2 màn
    hình vẫn hoạt động như cũ (không hồi quy).
- **Sửa lỗi widget báo `ERR_CONNECTION_REFUSED` rồi "kẹt" hoàn toàn** khi mở widget (hoặc màn hình
  quản lý/kiosk/kiosk NV/màn hình bệnh nhân do widget mở) lúc máy chủ Node.js CHƯA kịp chạy (ví dụ
  widget khởi động cùng Windows nhưng máy chủ chưa lên kịp, hoặc đang khởi động lại máy chủ riêng):
  trước đây Electron hiện nguyên trang lỗi mặc định của Chromium ("Không thể truy cập trang này")
  rồi đứng yên ở đó mãi, không có cách nào thao tác tiếp ngoài đóng ứng dụng và tự mở lại thủ công.
  Nay thêm `attachReconnectOnFail()` trong `electron-widget/main.js`, gắn cho TẤT CẢ cửa sổ tải nội
  dung từ máy chủ (widget, màn hình quản lý, kiosk, kiosk NV, màn hình bệnh nhân): khi tải thất bại
  vì không kết nối được máy chủ (không phải lỗi HTTP như 404/500 — những lỗi đó nghĩa là máy chủ ĐÃ
  chạy, không cần xử lý), cửa sổ vẫn **mở ra bình thường** với 1 trang "Đang chờ kết nối tới máy
  chủ..." tối giản (không phải trang lỗi của Chromium), và **tự động thử kết nối lại mỗi 3 giây**
  cho tới khi vào được — không cần đóng/mở lại ứng dụng thủ công, không cần bấm gì cả. Đã kiểm
  chứng bằng Electron chạy thật (Xvfb, `--no-sandbox`): mở widget lúc máy chủ chưa chạy → thấy đúng
  log tự thử lại đều đặn mỗi 3 giây, không crash; bật máy chủ giữa chừng → lần thử lại kế tiếp vào
  được ngay, không còn lỗi nào nữa; chụp lại màn hình xác nhận trường hợp máy chủ có sẵn từ đầu vẫn
  hiện đúng nội dung widget thật như trước (không hồi quy).

## 24. Cập nhật gần đây (đợt 13): dọn bớt chữ thừa/trùng lặp trên các màn hình

- **`/waiting-screen/` và `/patient-screen`**: bỏ khối "chú thích" (`#legendBox` — chỉ liệt kê tên
  + chấm màu từng đối tượng ưu tiên, KHÔNG có số lượng) vì nó **trùng lặp hoàn toàn** với khối "chi
  tiết số lượng đang chờ" (`#priorityCountBox`, thêm ở đợt 8/9) — cả 2 đều liệt kê đủ 8 loại đối
  tượng kèm chấm màu, chỉ khác là khối sau có THÊM số lượng đang chờ nên luôn là bản đầy đủ hơn.
  Trước đây cả 2 khối cùng hiện trên 1 màn hình gây trùng lặp, rối mắt — nay chỉ còn lại đúng 1 khối
  duy nhất (`#priorityCountBox`), không mất thông tin gì.
- **`/staff-kiosk/`**: bỏ đoạn văn bản tĩnh hướng dẫn dài ("Dành riêng cho nhân viên: cấp số cho...
  Đối tượng nào có nút "📱 QR" là đã cấu hình được mã QR cấp nhanh...") — nội dung này không cần
  thiết để nhân viên thao tác hàng ngày (giao diện nút bấm đã đủ trực quan), chỉ khiến màn hình dài
  dòng hơn cần thiết.
- **`/patient-screen`**: đổi nhãn "Số đã gọi nhưng chưa vào (bỏ qua) của quầy này" thành **"Các số
  đã gọi nhưng bệnh nhân vắng mặt của quầy này"** — diễn đạt tự nhiên, rõ nghĩa hơn cho người xem
  không rành thuật ngữ nội bộ ("bỏ qua").
- **Trang đăng nhập (`/`)**: bỏ nhãn "Nhập mật khẩu nhân viên:" phía trên ô nhập mật khẩu (ô nhập
  đã có sẵn placeholder "Mật khẩu", nhãn riêng là thừa).
- **Trang chọn màn hình sau khi đăng nhập nhân viên (`/`)**: đổi tên các nút và **bỏ hết dòng ghi
  chú/mô tả phụ** bên dưới mỗi nút (`.muted`) cho gọn gàng, hành vi bấm (điều hướng) của từng nút
  giữ nguyên không đổi:
  - "Màn hình quầy" → **"Tiếp nhận gọi số"**
  - "Kiosk cấp số (NV)" → **"Nhân viên hỗ trợ cấp số"**
  - "Kiosk bốc số" → **"Bệnh nhân tự cấp số"**
  - "Màn hình chờ chung" → **"Xem tất cả quầy đang phục vụ"**
  - "Màn hình bệnh nhân" → **"Xem quầy đang phục vụ"**
  - "Mã QR đăng nhập nhanh" → **"QR đăng nhập"**
  - "Địa chỉ mạng" → **"QR máy chủ"**
- Đã kiểm chứng bằng Playwright: đọc đúng danh sách 7 tên nút mới trên trang chủ, xác nhận 0 dòng
  ghi chú `.muted` còn sót và không còn nhãn "Nhập mật khẩu nhân viên:"; xác nhận đoạn văn bản
  hướng dẫn dài trên `/staff-kiosk/` không còn xuất hiện; xác nhận `#legendBox` không còn tồn tại
  trên cả `/waiting-screen/` và `/patient-screen` trong khi `#priorityCountBox` vẫn hiển thị đủ dữ
  liệu bình thường; không phát sinh lỗi console/trang trên cả 4 màn hình sau khi sửa.

## 25. Cập nhật gần đây (đợt 14): mở màn hình chờ chung ở cửa sổ mới đáng tin cậy hơn, đổi thêm 1 số text

- **`/` — nút "Xem tất cả quầy đang phục vụ"**: trước đây mở cửa sổ mới bằng cách gọi
  `window.open()` trong `onclick` của 1 thẻ `<div>`; nay đổi hẳn sang dùng thẻ `<a>` thật với
  `target="waiting-screen"` (giữ nguyên tên cửa sổ cố định như cũ — bấm lại sẽ đưa cửa sổ đã mở ra
  trước thay vì mở thêm cái mới) và `rel="noopener"`. Lý do đổi: cách dùng thẻ `<a target="_blank">`
  thật được trình duyệt tin tưởng là 1 điều hướng do người dùng chủ động bấm, gần như không bao giờ
  bị trình chặn popup can thiệp — đáng tin cậy hơn hẳn so với gọi `window.open()` bằng JavaScript
  (một số trình duyệt/tiện ích mở rộng có thể chặn tuỳ tình huống). Hàm JS `openWaitingScreen()` cũ
  không còn dùng nữa nên đã bỏ hẳn. Nút "Xem quầy đang phục vụ" (số ít, xem 1 quầy cụ thể) VẪN giữ
  nguyên cách cũ (`window.open()` gọi từ JS) vì cần kiểm tra điều kiện đã chọn quầy chưa (hiện cảnh
  báo nếu chưa chọn) trước khi biết được đường dẫn thật sự cần mở — không đưa thẳng vào `href` cố
  định của 1 thẻ `<a>` được. Đã kiểm chứng bằng Playwright: bấm nút mở đúng 1 cửa sổ mới tại
  `/waiting-screen/`, cửa sổ gốc (trang chủ) không bị điều hướng theo.
- **`/waiting-screen/` và `/patient-screen`**: đổi nhãn "Các số đã gọi nhưng chưa đến lượt vào lại
  (bỏ qua)" / "Các số đã gọi nhưng bệnh nhân vắng mặt của quầy này" (đợt trước) — nay THỐNG NHẤT về
  đúng 1 câu chữ duy nhất trên cả 2 màn hình: **"Các số đã gọi của quầy này nhưng bệnh nhân vắng
  mặt"**.
- **`/staff-kiosk/`**: đổi tiêu đề hiển thị trên trang (thẻ `<h1>`) và tiêu đề tab trình duyệt (thẻ
  `<title>`) từ "Kiosk cấp số – Nhân viên" thành **"Nhân viên hỗ trợ cấp số"**, khớp đúng tên nút đã
  đổi ở trang chủ (đợt 13). Đồng bộ luôn tiêu đề cửa sổ Electron (`electron-widget/main.js`, cửa sổ
  mở qua widget) sang cùng tên mới, tránh lệch tên giữa nội dung trang và thanh tiêu đề cửa sổ.
- Tiện thể sửa 2 chỗ text tĩnh còn tham chiếu tên nút CŨ (sót lại từ đợt 13 đổi tên nút trang chủ,
  chưa được cập nhật theo): thông báo "Chưa chọn quầy nào. Vui lòng vào 'Màn hình quầy'..." →
  "...vào 'Tiếp nhận gọi số'..."; và 1 dòng chú thích code nội bộ tham chiếu "Địa chỉ mạng" →
  "QR máy chủ" (không ảnh hưởng người dùng, chỉ để code khớp với tên hiện tại).

## 26. Cập nhật gần đây (đợt 15): tách riêng câu chữ "vắng mặt" cho từng màn hình, phóng to số thứ tự và trang trí sidebar theo dịp lễ ở `/patient-screen`

- **`/waiting-screen/` — câu chữ "vắng mặt"**: TÁCH RIÊNG khỏi `/patient-screen` (đợt 14 đã thống
  nhất chung 1 câu "Các số đã gọi của quầy này nhưng bệnh nhân vắng mặt" cho cả 2 màn hình, nhưng
  thực ra không hợp lý cho `/waiting-screen` — màn hình này gộp danh sách số bị bỏ qua từ TẤT CẢ các
  quầy đang phục vụ (`summary.skippedNumbers`), không phải chỉ riêng 1 quầy). Nay đổi lại thành
  **"Các số đã gọi nhưng bệnh nhân vắng mặt"** (bỏ "của quầy này") cho đúng thực tế hiển thị. Màn
  hình `/patient-screen` (chỉ hiển thị số bị bỏ qua của ĐÚNG quầy đang xem, có `?counter=` trên URL)
  vẫn giữ nguyên câu cũ **"Các số đã gọi của quầy này nhưng bệnh nhân vắng mặt"** — không đổi gì
  thêm ở màn hình này.
- **`/patient-screen` — phóng to chữ số thứ tự**: thêm biến `.env` mới
  `PATIENT_SCREEN_NUMBER_FONT_SCALE` (đơn vị %, mặc định `100` = giữ nguyên kích thước cũ, ví dụ
  `130` = to hơn 30%). Server đọc và kiểm tra giá trị hợp lệ (số từ 50 đến 300) trong
  `src/routes/branding.js`, trả về qua `/api/branding`; trang `/patient-screen` nhận giá trị này rồi
  gán vào biến CSS `--number-font-scale`, dùng trong công thức `clamp()` của chữ số `.big-number` —
  chữ số vẫn tự co giãn theo kích thước màn hình như cũ, chỉ là toàn bộ khoảng `clamp()` được nhân
  thêm theo tỉ lệ % cấu hình. Giá trị sai (không phải số, hoặc ngoài khoảng 50–300) sẽ TỰ ĐỘNG dùng
  lại 100% kèm cảnh báo trong log server, không làm vỡ giao diện.
- **`/patient-screen` — trang trí sidebar 2 bên theo dịp lễ**: màn hình này trước giờ có 2 khoảng
  trống lớn 2 bên chữ số thứ tự (chỉ dùng khi màn hình rộng). Nay thêm biến `.env` mới
  `PATIENT_SCREEN_THEME` để chọn 1 trong 6 mẫu trang trí (mỗi mẫu gồm màu nền gradient, 1 hoạ tiết vẽ
  bằng SVG lặp lại theo chiều dọc, và 1 dòng chữ chú thích ghim đáy sidebar — TOÀN BỘ vẽ bằng SVG/CSS
  thuần trong code, không cần file ảnh rời nên luôn hiển thị được kể cả khi máy không có mạng):
  - `default` (mặc định, hoặc để trống biến `.env`) — không trang trí gì, 2 sidebar ẩn hoàn toàn,
    giao diện gọn giống như trước khi có tính năng này.
  - `tet` — mẫu Chúc mừng năm mới: nền đỏ-đô, hoạ tiết hoa mai vàng.
  - `doctors_day` — mẫu Ngày Thầy thuốc Việt Nam (27/2): nền xanh nhạt, hoạ tiết chữ thập y tế đỏ.
  - `national_day` — mẫu Quốc khánh Việt Nam (2/9): nền đỏ cờ, hoạ tiết ngôi sao vàng 5 cánh.
  - `apr30_may1` — mẫu 30/4 - 1/5: nền đỏ, hoạ tiết ngôi sao vàng kèm chim bồ câu trắng.
  - `hung_king` — mẫu Giỗ Tổ Hùng Vương: nền nâu trầm, hoạ tiết mái đền/chùa cách điệu nhiều tầng.

  Server kiểm tra giá trị hợp lệ trong `src/routes/branding.js` (giá trị sai sẽ TỰ ĐỘNG dùng lại
  `default` kèm cảnh báo trong log, không làm vỡ trang), trả về qua `/api/branding`. Layout dùng CSS
  Grid 3 cột với 2 cột sidebar là ĐỘ RỘNG CỐ ĐỊNH (không phải `1fr`) để chữ số thứ tự ở giữa luôn
  giữ đúng vị trí căn giữa bất kể sidebar có hiển thị hay không (ẩn/hiện sidebar bằng `display`
  không làm thay đổi độ rộng cột do khung Grid cha đã khai báo cố định) — tránh lỗi số thứ tự bị lệch
  qua trái/phải tuỳ theo có trang trí hay không. Ở màn hình hẹp (dưới 900px, ví dụ điện thoại) sidebar
  tự ẩn hoàn toàn để không chiếm chỗ.
  - **Sửa kèm 1 lỗi tiềm ẩn ("hên xui" theo tốc độ máy/mạng) khi làm tính năng này**: script dùng
    chung `public/branding-header.js` (gọi API `/api/branding` rồi phát sự kiện tuỳ chỉnh
    `branding:loaded`) được nạp TRƯỚC script riêng của `/patient-screen` trong trang HTML — nếu máy
    đủ nhanh, `fetch()` có thể trả về VÀ phát xong sự kiện đó TRƯỚC KHI trang kịp chạy tới dòng đăng
    ký lắng nghe sự kiện, khiến trang bỏ lỡ hoàn toàn (sidebar/cỡ chữ không áp dụng, y hệt như đang
    ở `default`/100% dù `.env` đã cấu hình khác) — lỗi này xảy ra ngẫu nhiên tùy tốc độ tải trang nên
    rất khó phát hiện khi thử thủ công. Đã sửa bằng cách lưu tạm kết quả vào
    `window.__brandingData` ngay khi có, để trang nào đăng ký lắng nghe trễ hơn vẫn tự kiểm tra và áp
    dụng được dữ liệu đã có sẵn thay vì chờ 1 sự kiện sẽ không bao giờ đến nữa.

  Đã kiểm chứng bằng Playwright cho cả 6 giá trị mẫu (kể cả `default`) và giá trị `.env` sai: hiển
  thị đúng, không lỗi console, cỡ chữ số thứ tự thay đổi đúng tỉ lệ theo `PATIENT_SCREEN_NUMBER_FONT_SCALE`,
  và chạy lặp lại nhiều lần để xác nhận lỗi "hên xui" nêu trên đã hết hẳn.

## 27. Cập nhật gần đây (đợt 16): ẩn dòng chữ chú thích trên sidebar, thêm hướng dẫn đóng gói trình cài đặt Windows bằng Inno Setup

- **`/patient-screen` — ẩn `.sidebar-caption`**: dòng chữ chú thích ghim đáy sidebar (ví dụ "CHÚC
  MỪNG NĂM MỚI", "GIỖ TỔ HÙNG VƯƠNG"...) nay ĐÃ ẨN (đặt `display: none` trong CSS) — sidebar chỉ còn
  hiển thị hoạ tiết SVG trang trí, không còn dòng chữ. Toàn bộ HTML/JS tạo ra dòng chữ này
  (`renderSidebarSvg()`) vẫn được giữ nguyên trong code, chỉ cần xoá dòng `display: none` trong
  `.sidebar-caption` (file `public/patient-screen/index.html`) nếu sau này muốn bật lại.
- **Hướng dẫn đóng gói trình cài đặt Windows bằng Inno Setup**: thêm thư mục
  `packaging/windows-installer/` gồm kịch bản Inno Setup mẫu (`HeThongBatSo.iss`), script khởi động
  server sau khi cài (`start-server.bat`), và hướng dẫn từng bước
  (`HUONG-DAN-DONG-GOI.md`). Điểm quan trọng nhất: trình cài đặt được cấu hình để **KHÔNG ghi đè**
  lên file `.env` và thư mục `public/` nếu đã tồn tại sẵn trong thư mục cài đặt (dùng cờ
  `onlyifdoesntexist` của Inno Setup) — nhờ vậy mỗi lần đóng gói/cài lại bản cập nhật mới (chỉ thay
  code trong `src/`), các tuỳ chỉnh riêng của từng đơn vị trên `.env`/`public/` (tên đơn vị, mật
  khẩu, logo, giao diện màn hình...) không bị mất. Xem chi tiết từng bước (cài Inno Setup, chuẩn bị
  `node_modules` trên máy Windows, sửa đường dẫn, biên dịch...) trong
  `packaging/windows-installer/HUONG-DAN-DONG-GOI.md`.

## 28. Cập nhật gần đây (đợt 17): thêm màn hình nhân viên quản lý danh mục quầy tiếp nhận

- **Màn hình mới `/counter-admin`** (cần đăng nhập mật khẩu nhân viên — đã thêm vào
  `GATED_PATH_PREFIXES` trong `src/server.js`) — quản lý DANH MỤC quầy tiếp nhận, khác với màn hình
  `/counter` (nơi nhân viên trực quay vào/thoát ca làm việc hằng ngày). Truy cập qua nút "Quản lý
  quầy tiếp nhận" mới thêm ở trang chủ (mục Nhân viên). Gồm 4 chức năng theo đúng yêu cầu:
  - **Thêm quầy mới**: nhập mã quầy + tên quầy.
  - **Sửa mã/tên quầy**: sửa được cả mã lẫn tên của quầy đã có (sửa được ngay cả khi quầy đang có
    người dùng — chỉ đổi chữ hiển thị, không ảnh hưởng phiên làm việc đang chạy).
  - **Tạm ngưng quầy** / **Kích hoạt lại**: quầy tạm ngưng sẽ biến mất khỏi màn hình chờ chung
    (`/waiting-screen`) và bị disable (không chọn được, hiện rõ "(đang tạm ngưng)") trong danh sách
    chọn quầy ở `/counter` — nếu quầy đang có người dùng lúc tạm ngưng, hệ thống TỰ ĐỘNG đăng xuất
    phiên đó ngay lập tức (báo qua Socket.io sự kiện `counter:paused`, `/counter` đang mở sẵn sẽ
    hiện cảnh báo và quay về màn hình chọn quầy, không cần tải lại trang thủ công).
  - **Kiểm tra trùng thông tin**: khi thêm mới hoặc sửa, hệ thống kiểm tra trùng CẢ mã quầy LẪN tên
    quầy (không phân biệt hoa/thường, bỏ khoảng trắng đầu-cuối khi so sánh — ví dụ "Q01" và " q01 "
    bị coi là trùng) — báo lỗi rõ ràng ngay trong form (quầy nào đang dùng mã/tên đó) thay vì lỗi
    kỹ thuật khó hiểu từ SQLite.
- Không có chức năng XOÁ hẳn quầy (theo thiết kế) — vì các vé đã cấp trong ngày còn tham chiếu tới
  `counter_id`, xoá hẳn sẽ làm mất dữ liệu lịch sử. "Tạm ngưng" đóng vai trò "xoá mềm" đáp ứng đủ
  nhu cầu thực tế (ẩn quầy không dùng nữa khỏi lựa chọn) mà vẫn giữ nguyên dữ liệu cũ.
- Phần code mới: `src/services/ticketService.js` (hàm `createCounter`, `updateCounter`,
  `setCounterActive`, `findDuplicateCounter`; đồng thời `enterCounterSession` được thêm kiểm tra
  chặn quầy đang tạm ngưng, trả lỗi `INACTIVE`), `src/routes/counters.js` (route mới
  `POST /api/counters`, `PUT /api/counters/:id`, `POST /api/counters/:id/pause`,
  `POST /api/counters/:id/resume`), `public/counter-admin/index.html` +
  `public/counter-admin/counter-admin.js` (giao diện mới), và `public/counter/counter.js` (cập nhật
  danh sách chọn quầy để disable quầy tạm ngưng + tự động thoát khi bị tạm ngưng giữa lúc đang
  dùng).
- Đã kiểm chứng đầy đủ bằng curl + Playwright: đăng nhập/chặn truy cập khi chưa đăng nhập, thêm
  quầy, báo lỗi trùng mã/trùng tên (cả qua API lẫn qua giao diện), sửa tên/mã, tạm ngưng (kể cả khi
  đang có người dùng — xác nhận phiên bị xoá ngay), kích hoạt lại, danh sách chọn quầy ở `/counter`
  hiện đúng trạng thái disable/nhãn "(đang tạm ngưng)", không có lỗi console/trang khi thao tác.

## 29. Cập nhật gần đây (đợt 18): đóng gói ẩn mã nguồn phần server thành 1 file .exe duy nhất

- **Vấn đề**: cách đóng gói bằng Inno Setup ở đợt 16 copy nguyên thư mục `src/` (toàn bộ logic
  nghiệp vụ: tính số thứ tự, quy tắc ưu tiên, xác thực, in phiếu...) — ai có bản cài đặt đều mở đọc
  được bằng Notepad. Nay bổ sung `packaging/exe-build/` — công cụ đóng gói `src/` (kèm toàn bộ thư
  viện nó dùng) thành **1 file `HeThongBatSo.exe` duy nhất, đã làm rối mã (obfuscate)**, dùng đúng
  cơ chế **Single Executable Application (SEA)** chính thức của Node.js (không phải thư viện ngoài
  không chính thống) kết hợp `esbuild` (gộp code) + `javascript-obfuscator` (đổi tên biến, mã hoá
  chuỗi ký tự) + `postject` (nhúng vào bản sao `node.exe`).
- **Giới hạn cần biết rõ** (đã nói thẳng trong `HUONG-DAN-DONG-GOI-EXE.md`): (1) thư mục `public/`
  (giao diện chạy trên trình duyệt) **không thể ẩn được** — giới hạn kỹ thuật chung của mọi ứng
  dụng web, ai mở DevTools trình duyệt cũng đọc được, cách này chỉ ẩn được phần **server**; (2) đây
  là làm rối mã, không phải mã hoá/DRM tuyệt đối — ngăn việc đọc/sao chép code THÔNG THƯỜNG, không
  chống được phân tích ngược chuyên sâu.
- **Thay đổi code cần thiết để hỗ trợ đóng gói**: thêm `src/config/appRoot.js` (hàm `getAppRoot()`)
  — trước đây các đường dẫn tới `public/`, `.env`, file SQLite được tính dựa trên `__dirname`/
  `process.cwd()`, nhưng khi chạy bên trong 1 file `.exe` SEA thì KHÔNG CÒN `__dirname`/file `.js`
  thật nào trên đĩa nữa. `getAppRoot()` tự phát hiện đang chạy dạng SEA hay không (qua
  `require('node:sea').isSea()`) để chọn đúng thư mục gốc: bình thường vẫn là thư mục dự án như cũ,
  còn khi là SEA thì lấy thư mục CHỨA file `.exe` đang chạy (`process.execPath`) — nhờ vậy `public/`
  và `.env` vẫn là file/thư mục RIÊNG nằm cạnh `.exe` (giữ đúng nguyên tắc "không đóng gói
  `.env`/`public/`" của đợt 16), không bị nhúng vào bên trong. Áp dụng tại `src/server.js` (đọc
  `.env`, phục vụ `public/` tĩnh), `src/routes/branding.js` (đọc file ảnh logo/nền), và
  `src/config/db.js` (đường dẫn file SQLite).
- **Đã kiểm chứng toàn bộ quy trình chạy thật** (dựng thử trên môi trường Linux, dùng đúng cơ chế
  Node SEA mà Windows cũng dùng — không phải chỉ đọc tài liệu): build ra file thực thi chạy được,
  đặt `public/` + `.env` cạnh file thực thi, khởi động đúng cổng, phục vụ đúng giao diện tĩnh, đăng
  nhập/API/tính năng quản lý quầy (đợt 17) hoạt động đúng như chạy bằng `npm start` bình thường; và
  xác nhận bằng công cụ `strings` rằng tên hàm/chuỗi thông báo nghiệp vụ (`createCounter`, "Mã quầy
  ... đã được dùng cho...") không còn xuất hiện dạng chữ đọc được trong file thực thi.
- Thêm biến thể `packaging/windows-installer/HeThongBatSo-Protected.iss` — đóng gói file `.exe` đã
  ẩn mã nguồn qua Inno Setup thay vì `src/`/`node_modules/`, vẫn giữ nguyên cơ chế không ghi đè
  `.env`/`public/` khi cập nhật. Xem hướng dẫn đầy đủ trong
  `packaging/exe-build/HUONG-DAN-DONG-GOI-EXE.md` (kể cả khắc phục cảnh báo Windows SmartScreen và
  vấn đề chữ ký số của `node.exe`).

## 30. Cập nhật gần đây (đợt 19): sửa lỗi file .exe đóng gói (đợt 18) chạy lên chỉ ra REPL Node.js, không chạy ứng dụng

- **Lỗi thực tế gặp phải**: build xong `HeThongBatSo.exe` (đợt 18) theo đúng hướng dẫn, `postject`
  báo "Injection done!" (thành công), nhưng khi mở file `.exe` lên chỉ thấy dòng chữ "Welcome to
  Node.js vXX.X.X" rồi dấu nhắc lệnh trống — tức là file đang chạy y hệt 1 bản `node.exe` bình
  thường (chế độ gõ lệnh tương tác), KHÔNG hề nhận ra được phần ứng dụng đã nhúng vào bên trong.
- **Nguyên nhân**: file `node.exe` gốc tải từ nodejs.org đã được ký số sẵn (code-signed). Máy build
  không có sẵn `signtool` (công cụ nằm trong Windows SDK, không phải máy Windows nào cũng có cài
  sẵn) nên bước xoá chữ ký số cũ trước khi nhúng dữ liệu bị bỏ qua — khiến phần dữ liệu vừa nhúng
  không được nhận diện đúng khi chạy, dù công cụ `postject` vẫn báo "thành công" (postject chỉ đảm
  bảo ghi dữ liệu vào file đúng kỹ thuật, không đảm bảo Windows sẽ chạy đúng phần đó).
- **Đã sửa `packaging/exe-build/build-windows.bat`**:
  - Khi không tìm thấy `signtool`, script nay CẢNH BÁO RÕ RÀNG (không còn âm thầm bỏ qua như trước)
    và hỏi xác nhận trước khi tiếp tục, giải thích đúng hậu quả có thể xảy ra.
  - Thêm hẳn bước **[8/8] Tự kiểm tra** — sau khi build xong, script tự đặt file `.exe` vừa tạo vào
    1 thư mục tạm cùng bản sao `public/` và 1 file `.env` thử, tự chạy file đó, rồi gọi thật API
    `/api/health` để xác nhận nó THỰC SỰ chạy đúng ứng dụng (không chỉ tin vào thông báo "thành
    công" của `postject`) — báo rõ "TỰ KIỂM TRA THÀNH CÔNG" hoặc "TỰ KIỂM TRA THẤT BẠI" ở cuối, và
    GIỮ LẠI log lỗi để xem nếu thất bại.
- **Đã cập nhật `packaging/exe-build/HUONG-DAN-DONG-GOI-EXE.md`**: thêm mục khắc phục sự cố mô tả
  ĐÚNG triệu chứng đã gặp ("Welcome to Node.js..." thay vì chạy app) làm mục đầu tiên/nổi bật nhất
  trong phần "Khắc phục sự cố", kèm các bước cụ thể cài `signtool` (qua Visual Studio Installer hoặc
  tải riêng Windows SDK) và build lại.
- Chưa thể tự kiểm chứng lại việc build thật trên Windows (môi trường hiện tại là Linux, không có
  máy Windows để build/test trực tiếp) — thay đổi lần này dựa trên phân tích đúng theo tài liệu
  chính thức của Node.js về Single Executable Applications (yêu cầu xoá chữ ký số trước khi nhúng
  trên Windows) và triệu chứng thực tế người dùng báo lại. Đã thêm bước tự kiểm tra [8/8] chính là
  để việc build lần sau tự xác nhận được kết quả thay vì phải đoán.

## 31. Tự động khởi động cùng Windows + xử lý cổng (PORT) bị chiếm dụng trước khi mở app

Đợt này giải quyết 2 yêu cầu: (1) bản cài đặt có tự động khởi động cùng máy tính chưa, và (2)
xử lý trường hợp cổng đã bị chương trình khác chiếm trước khi mở app.

- **Không dùng pm2**: pm2 là công cụ quản lý tiến trình của Node.js, đòi hỏi máy phải cài sẵn
  Node.js/npm để chạy được — điều này đi ngược lại đúng mục tiêu của bản đóng gói `.exe` ẩn mã
  nguồn (đợt 18, xem mục 29) là để máy chạy server **không cần cài Node.js** nữa. Thay vào đó,
  dùng **Task Scheduler** — tính năng có sẵn 100% trong mọi bản Windows, không cần cài thêm gì,
  dùng chung được cho cả 2 biến thể đóng gói (có và không ẩn mã nguồn).
- **File mới** `packaging/windows-installer/install-autostart.bat` và
  `packaging/windows-installer/uninstall-autostart.bat`: tự phát hiện nên chạy `start-server.bat`
  hay `HeThongBatSo.exe` (tuỳ file nào có sẵn trong cùng thư mục), đăng ký/huỷ đăng ký 1 tác vụ
  Task Scheduler tên `HeThongBatSo_AutoStart` chạy khi đăng nhập Windows (`schtasks /create ...
  /sc onlogon /rl highest`). Có thể chạy tay bất kỳ lúc nào sau khi cài đặt để bật/tắt, không cần
  cài lại phần mềm.
- **Cả 2 file `.iss`** (`HeThongBatSo.iss` và `HeThongBatSo-Protected.iss`) đã thêm 1 mục tick
  chọn khi cài đặt: "Tự động khởi động He Thống Bắt Số mỗi khi đăng nhập Windows" (mặc định
  KHÔNG tick) — nếu tick, trình cài đặt tự chạy `install-autostart.bat /silent` sau khi cài xong;
  khi gỡ cài đặt, trình gỡ cài đặt tự chạy `uninstall-autostart.bat /silent` để dọn tác vụ đã đăng
  ký (chạy an toàn kể cả khi chưa từng bật tính năng này).
- **Xử lý cổng bị chiếm dụng** — sửa `src/server.js`: trước đây `server.listen(port, ...)` không
  có xử lý lỗi, nếu cổng trong `.env` (`PORT=`) đã bị chương trình khác chiếm thì server crash với
  lỗi kỹ thuật khó hiểu (`EADDRINUSE`) ngay khi khởi động. Nay nếu gặp `EADDRINUSE`, server tự
  động thử lần lượt các cổng kế tiếp (`PORT+1`, `PORT+2`... tối đa 10 cổng) cho tới khi tìm được
  cổng trống, rồi in rõ trong cửa sổ dòng lệnh: cổng thật sự đang chạy là cổng nào, kèm hướng dẫn
  2 cách xử lý lâu dài (tắt chương trình đang chiếm cổng cũ, hoặc sửa lại `PORT=` trong `.env` cho
  khớp cổng mới rồi cập nhật lại các link/mã QR đã phát cho quầy/màn hình bệnh nhân). Nếu thử hết
  10 cổng vẫn không tìm được cổng trống, server dừng lại và in lỗi tiếng Việt rõ ràng thay vì crash
  im lặng.
- **Đã kiểm chứng** cơ chế xử lý cổng bị chiếm: khởi động 1 server thật ở cổng X (chiếm cổng
  trước), sau đó khởi động 1 server thứ 2 cấu hình `.env` cùng cổng X — xác nhận server thứ 2 tự in
  cảnh báo, tự chuyển sang chạy ở cổng X+1, và gọi `GET /api/health` vào đúng cổng X+1 nhận về phản
  hồi hợp lệ (`{"ok":true,"time":"..."}`). Cơ chế tự động khởi động cùng Windows (Task Scheduler)
  và các file `.bat`/`.iss` liên quan **chưa thể tự kiểm chứng chạy thật** trên Windows (môi trường
  hiện tại là Linux, không có máy Windows để build/test trực tiếp) — cú pháp `schtasks` dùng đúng
  theo tài liệu chính thức của Microsoft, nhưng khuyến nghị người dùng tick thử mục "Tự động khởi
  động" khi cài đặt và khởi động lại máy 1 lần để tự xác nhận trước khi triển khai chính thức cho
  nhiều máy.

## 32. Sửa lỗi "bấm đúp file .exe lên rồi tự đóng ngay, không đọc kịp thông báo gì"

- **Vấn đề thực tế người dùng báo lại**: build xong `HeThongBatSo.exe` (đợt 18-19) rồi bấm đúp
  chạy thử, cửa sổ hiện lên rồi **tự đóng ngay lập tức**, không kịp đọc bất kỳ dòng chữ nào — khác
  với sự cố "Welcome to Node.js..." của đợt 19 (sự cố đó cửa sổ ở lại, chỉ là chạy sai chế độ).
- **Nguyên nhân**: đây là hành vi mặc định của Windows với MỌI chương trình chạy trên dòng lệnh —
  khi bấm đúp trực tiếp vào 1 file `.exe` console, Windows tự đóng cửa sổ ngay khi tiến trình bên
  trong kết thúc, bất kể kết thúc vì lý do gì (kể cả bị lỗi/crash ngay dòng đầu tiên khi khởi
  động). Trước đợt này, hướng dẫn triển khai chỉ nói "chạy `HeThongBatSo.exe`", không có gì giữ cửa
  sổ lại để đọc lỗi nếu server crash sớm — đúng là thiếu sót khiến người dùng không có cách nào
  chẩn đoán được nguyên nhân crash thật sự.
- **Đã thêm file mới** `packaging/exe-build/run-server.bat`: chạy giúp `HeThongBatSo.exe`, và
  **giữ cửa sổ lại** (hiện dòng "Nhấn phím bất kỳ để đóng...") ngay khi tiến trình đó kết thúc vì
  bất kỳ lý do gì (bình thường hay lỗi) — nhờ vậy luôn đọc được thông báo lỗi thật nếu có.
- **`build-windows.bat`** (bước [7/8]) nay tự copy sẵn `run-server.bat` vào cùng thư mục
  `Output\` với `HeThongBatSo.exe`, và thông báo kết thúc build đã nhắc rõ: triển khai cần copy CẢ
  HAI file, và **luôn khởi động bằng `run-server.bat`, không bấm đúp thẳng vào `.exe`**.
- **`HeThongBatSo-Protected.iss`** (trình cài đặt Inno Setup bản ẩn mã nguồn) nay đóng gói kèm
  `run-server.bat` và đổi toàn bộ shortcut (Start Menu, Desktop, nút "Khởi động ngay sau khi cài",
  mục tự động khởi động cùng Windows ở đợt 31) sang trỏ tới `run-server.bat` thay vì thẳng tới
  `HeThongBatSo.exe` như trước — người dùng bình thường (không tự tay chạy Command Prompt) giờ
  cũng luôn được bảo vệ, không còn gặp lại đúng sự cố "tự đóng ngay không đọc kịp gì" nữa.
- **Đã cập nhật `packaging/exe-build/HUONG-DAN-DONG-GOI-EXE.md`**: thêm hẳn mục khắc phục sự cố
  mới đứng đầu danh sách, giải thích đúng hiện tượng, 2 cách đọc được lỗi thật (dùng
  `run-server.bat`, hoặc chạy tay qua Command Prompt), và liệt kê các nguyên nhân THƯỜNG GẶP nên
  kiểm tra theo thứ tự sau khi đã đọc được lỗi (thiếu `.env`/`public\` cạnh `.exe`, phần mềm diệt
  virus làm hỏng file `.exe` sau khi build, file `.exe` bị Windows chặn do tải/copy từ nơi khác).
- Chưa thể tự kiểm chứng lại bằng máy Windows thật (môi trường hiện tại là Linux) — thay đổi lần
  này giải quyết đúng cơ chế Windows tự đóng cửa sổ console khi tiến trình kết thúc (hành vi chuẩn,
  không phải suy đoán), nhưng cần người dùng xác nhận lại: chạy `run-server.bat` (thay vì bấm đúp
  `.exe`) và cho biết dòng chữ/thông báo lỗi thật sự hiện ra là gì để chẩn đoán tiếp nếu vẫn còn
  lỗi khác đứng sau đó.

## 33. Xoá chữ ký số của node.exe mà KHÔNG cần cài `signtool`/Windows SDK

- **Yêu cầu thực tế của người dùng**: "tôi k cài sdk đâu nhé" — không muốn cài thêm bất kỳ phần
  mềm gì (kể cả chỉ để lấy `signtool`) chỉ để build được file `.exe`.
- **Giải pháp**: viết mới `packaging/exe-build/strip-signature.js` — 1 script Node.js thuần (không
  phụ thuộc gói ngoài nào), tự đọc/ghi trực tiếp vào header PE (định dạng file thực thi Windows)
  của bản sao `node.exe`, xoá đúng phần chữ ký số Authenticode theo đúng đặc tả định dạng PE/COFF
  chính thức của Microsoft (đọc mục Data Directory chỉ số 4 — Security Directory — trong Optional
  Header để tìm vị trí + kích thước bảng chứng chỉ nằm ở cuối file, rồi cắt bỏ phần đó và xoá mục
  Data Directory tương ứng) — làm ĐÚNG việc `signtool remove /s` làm, nhưng không cần cài đặt gì.
- **Đã kiểm chứng thật** (không chỉ suy đoán): tìm được nhiều file `.exe` PE32+ (64-bit) đã ký số
  thật có sẵn trong môi trường (`signtool.exe`, `makecat.exe` — bản 64-bit đi kèm bộ công cụ
  `winCodeSign` dùng cho `electron-builder`), copy ra chạy thử `strip-signature.js` — xác nhận bằng
  thư viện phân tích PE độc lập (`pefile`, Python) và lệnh `file`: chữ ký số bị xoá sạch (kích
  thước Security Directory về 0), checksum về 0, file vẫn còn là PE32+ hợp lệ, giữ nguyên Entry
  Point/Machine type/số section — đúng như 1 file `.exe` đã được `signtool remove` xử lý thật.
- **Đã cập nhật `packaging/exe-build/build-windows.bat`** (bước [7/8]): bỏ hẳn màn hình cảnh báo +
  hỏi Y/N khi thiếu `signtool` của đợt trước — nay tự động gọi `strip-signature.js` mỗi lần build,
  không cần người dùng làm gì thêm. Nếu máy tình cờ đã có sẵn `signtool` (ví dụ do cài Visual
  Studio từ trước) thì vẫn ưu tiên dùng cách đó trước (không xung đột, cùng 1 kết quả).
- **Đã cập nhật `packaging/exe-build/HUONG-DAN-DONG-GOI-EXE.md`**: sửa lại mục khắc phục sự cố
  "Welcome to Node.js" — không còn hướng dẫn cài Windows SDK làm bước chính nữa, chỉ còn là lựa
  chọn dự phòng nếu `strip-signature.js` báo lỗi với 1 bản `node.exe` có định dạng khác thường.

## 34. Sửa lỗi cú pháp batch khiến `build-windows.bat` dừng ngay ở bước [7/8] với lỗi "... was unexpected at this time."

- **Lỗi thực tế**: sau khi thêm bước tự động xoá chữ ký số bằng `strip-signature.js` (mục 33),
  script `build-windows.bat` chạy tới đúng bước `[7/8] Nhung blob vao 1 ban sao cua node.exe...`
  thì dừng lại với lỗi `... was unexpected at this time.` — lỗi cú pháp kinh điển của `cmd.exe`.
- **Nguyên nhân**: 2 dòng `echo` mới thêm nằm BÊN TRONG 1 khối lệnh `if ( ) else ( )` nhiều dòng lại
  chứa dấu ngoặc tròn `(` `)` chưa được thoát ký tự (ví dụ `echo ... (dung signtool co san)...`) —
  `cmd.exe` phân tích cú pháp cả khối `if/else` nhiều dòng như 1 khối thống nhất bằng cách đếm dấu
  ngoặc tròn để tìm điểm bắt đầu/kết thúc khối; dấu ngoặc "thường" (chưa thoát) xuất hiện trong
  phần văn bản `echo` làm lệch bộ đếm này, khiến `cmd.exe` hiểu sai cấu trúc khối và báo lỗi ngay
  khi bắt đầu thực thi khối đó — đúng y hệt vị trí lỗi người dùng gặp phải.
- **Đã sửa**: thêm dấu mũ `^` trước mọi dấu ngoặc tròn dùng làm văn bản thường bên trong khối lệnh
  (`^(`, `^)`), đúng quy ước đã áp dụng cho các đoạn `echo` khác trong cùng file. Nhân tiện rà soát
  lại toàn bộ khối liên quan, phát hiện thêm 1 chuỗi dấu nháy kép (`"`) rải rác không cân bằng có
  nguy cơ gây lỗi tương tự (cách `cmd.exe` xử lý dấu nháy kép trong 1 khối nhiều dòng cũng dễ gây
  lỗi khó lường) — đã bỏ hết dấu nháy kép không cần thiết trong các dòng `echo` liên quan, và 1 chỗ
  dùng dấu `>=` chưa thoát ký tự (`>` là ký tự điều hướng luồng dữ liệu của `cmd.exe`, cần thoát nếu
  muốn in ra màn hình đúng nghĩa đen) ở bước [6/8], đổi thành chữ "tu ban 20 tro len" cho an toàn.
- **Đã kiểm chứng bằng công cụ** (không chỉ đọc bằng mắt): viết 1 script Python đếm số dấu ngoặc
  tròn CHƯA thoát ký tự và số dấu nháy kép trong toàn bộ 2 khối lệnh liên quan — xác nhận cả 2 đều
  cân bằng (bằng 0 / chẵn) sau khi sửa, tức về mặt cấu trúc không còn khả năng gây lỗi parse tương
  tự. Chưa thể tự chạy thật `build-windows.bat` trên Windows (môi trường hiện tại là Linux) — cần
  người dùng xác nhận lại bằng cách chạy `.\build-windows.bat` (trong PowerShell, nhớ có `.\` phía
  trước) hoặc `build-windows.bat` (trong Command Prompt) từ bản zip mới nhất này.

## 35. Sửa lỗi gốc: `run-server.bat`/`install-autostart.bat`/`start-server.bat` báo "... was unexpected at this time." khi cài vào `Program Files (x86)`

- **Lỗi thực tế người dùng gặp**: cài đặt xong (đúng bản mới, đã xác nhận `run-server.bat` có mặt
  trong thư mục cài đặt), chạy `run-server.bat` trực tiếp bằng `.\run-server.bat` trong PowerShell
  — báo lỗi `\HeThongBatSo\ was unexpected at this time.` ngay lập tức, không chạy được gì.
- **Nguyên nhân gốc (khác hẳn 2 lỗi cú pháp đã sửa ở mục 34)**: thư mục cài đặt mặc định là
  `C:\Program Files (x86)\HeThongBatSo\` — có dấu ngoặc đơn THẬT trong tên `(x86)`. Cả 3 file
  `run-server.bat`, `install-autostart.bat`, `start-server.bat` đều dùng `%~dp0` (hoặc `%cd%`) —
  kiểu tham chiếu biến "không trễ" — BÊN TRONG 1 khối lệnh `if (...)`. Đây là lỗi kinh điển, được
  ghi nhận rộng rãi của `cmd.exe`: khi phân tích 1 khối lệnh nhiều dòng bọc trong dấu ngoặc, biến
  kiểu `%TEN%` được thay giá trị NGAY LÚC PHÂN TÍCH CẢ KHỐI (trước khi thực thi) — nếu giá trị đó
  chứa dấu ngoặc (như `(x86)`), bộ đếm ngoặc dùng để xác định ranh giới khối bị lệch, gây đúng lỗi
  "... was unexpected at this time.". Lỗi CHỈ xảy ra khi cài vào đường dẫn có dấu ngoặc (như
  `Program Files (x86)` — mặc định trên Windows 64-bit vì trình cài đặt hiện đang build ở chế độ
  32-bit) — đây là lý do lỗi không xuất hiện khi build/tự kiểm tra trên máy phát triển (đường dẫn
  dự án không có dấu ngoặc) nhưng lại xuất hiện ngay khi người dùng thật cài vào vị trí mặc định.
- **Đã sửa cả 3 file** (`packaging/exe-build/run-server.bat`,
  `packaging/windows-installer/install-autostart.bat`,
  `packaging/windows-installer/start-server.bat`) và rà soát lại `build-windows.bat`: thêm
  `setlocal enabledelayedexpansion`, gán `%~dp0` vào 1 biến NGOÀI mọi khối lệnh (an toàn), rồi bên
  trong khối lệnh chỉ dùng `!bien!` (tham chiếu trễ — delayed expansion) thay vì `%bien%` — cách
  tham chiếu trễ chỉ thay giá trị LÚC THỰC THI từng dòng, sau khi khối lệnh đã được phân tích xong,
  nên không còn bị ảnh hưởng bởi dấu ngoặc trong giá trị đường dẫn.
- **Đã kiểm chứng bằng công cụ**: viết script Python quét TOÀN BỘ các file `.bat` liên quan, dò mọi
  tham chiếu `%TEN_BIEN%` (không trễ) xuất hiện bên trong 1 khối lệnh đang mở — rà soát thủ công
  từng trường hợp được báo để xác nhận biến đó có thể chứa dấu ngoặc hay không (ví dụ `%SILENT%`,
  `%TASK_NAME%`, `%SELFTEST_PORT%` là chuỗi/số cố định do chính script đặt ra, không bao giờ chứa
  dấu ngoặc nên an toàn) — xác nhận không còn trường hợp rủi ro thật nào sau khi sửa.
- Chưa thể tự chạy thật trên Windows với đường dẫn `Program Files (x86)` (môi trường hiện tại là
  Linux) — thay đổi lần này dựa trên cơ chế lỗi đã được xác nhận qua thông báo lỗi thực tế người
  dùng gửi lại (khớp chính xác với mô tả lỗi kinh điển này của `cmd.exe`), cần người dùng chạy lại
  `.\run-server.bat` từ bản zip mới nhất để xác nhận đã hết lỗi.

## 36. Sửa lỗi "unable to open database file" khi chạy sau khi cài vào Program Files

- **Lỗi thực tế**: sau khi sửa xong lỗi cú pháp batch (mục 35), `run-server.bat` chạy được, server
  khởi động tới đúng bước mở database thì báo lỗi và dừng lại:
  ```
  [FATAL] Không khởi động được server: Error: unable to open database file
  code: 'ERR_SQLITE_ERROR', errcode: 14, errstr: 'unable to open database file'
  ```
- **Nguyên nhân**: Windows mặc định CHẶN mọi tài khoản thường (không phải Quản trị viên) ghi vào
  thư mục `Program Files`/`Program Files (x86)` — kể cả khi thư mục con (`data\`) đã được trình cài
  đặt tạo sẵn. Hệ thống này cần ghi được vào thư mục cài đặt mỗi lần chạy bình thường (tạo/cập nhật
  file SQLite trong `data\`, tự tạo `.env` nếu thiếu...) — trước bản cập nhật này, trình cài đặt
  Inno Setup chưa từng cấp quyền ghi cho tài khoản thường, nên lỗi này XẢY RA VỚI MỌI BẢN CÀI ĐẶT
  mặc định vào `Program Files`, không phải lỗi riêng của máy người dùng.
- **Đã sửa cả 2 file `.iss`** (`HeThongBatSo.iss` và `HeThongBatSo-Protected.iss`): thêm khối
  `[Dirs]` dùng cờ `Permissions: users-modify` của Inno Setup, cấp quyền Ghi (Modify) cho nhóm
  "Users" (mọi tài khoản dùng máy) trên thư mục cài đặt, `data\`, và `public\` — việc này chỉ thiết
  lập được lúc CÀI ĐẶT (vì trình cài đặt chạy với quyền Quản trị viên, `PrivilegesRequired=admin`).
- **Cách khắc phục NGAY cho bản đã cài** (không cần gỡ cài đặt lại): mở Command Prompt với quyền
  Quản trị viên (chuột phải → "Run as administrator"), chạy:
  ```
  icacls "C:\Program Files (x86)\HeThongBatSo" /grant Users:(OI)(CI)M /T
  ```
  rồi chạy lại `run-server.bat` bình thường (không cần quyền Quản trị viên nữa từ lần này).
- Các bản cài đặt MỚI (biên dịch lại `.iss` từ bản cập nhật này) sẽ tự động có quyền ghi đúng ngay
  từ lần cài đầu tiên, không cần chạy `icacls` thủ công nữa.
- Chưa thể tự kiểm chứng trên Windows thật (môi trường hiện tại là Linux) — cần người dùng xác nhận
  lại bằng lệnh `icacls` ở trên cho bản đã cài, hoặc cài lại bằng trình cài đặt mới để kiểm tra.

## 37. Đổi vị trí cài đặt mặc định ra khỏi `Program Files` (theo đề xuất người dùng)

- **Đề xuất của người dùng**: "sao ko cài đặt vào ổ đĩa khác có nhiều quyền hơn không" — thay vì
  chỉ cấp quyền ghi cho `Program Files` (mục 36), đổi hẳn vị trí cài đặt sang nơi không bị Windows
  khoá quyền ghi mặc định.
- **Đã đổi** `DefaultDirName` trong cả 2 file `.iss` (`HeThongBatSo.iss` và
  `HeThongBatSo-Protected.iss`) từ `{autopf}\HeThongBatSo` (Program Files/Program Files (x86)) sang
  `{sd}\HeThongBatSo` (gốc ổ đĩa hệ thống — thường là `C:\HeThongBatSo`) — vị trí này không bị
  Windows chặn quyền ghi cho tài khoản thường như `Program Files`. Vẫn GIỮ NGUYÊN phần cấp quyền
  `[Dirs]` (mục 36) làm lớp bảo vệ thứ 2, phòng trường hợp máy có chính sách nhóm (Group Policy)
  khoá quyền chặt hơn mức mặc định (hay gặp ở mạng nội bộ bệnh viện/cơ quan).
- **Lợi ích phụ**: vị trí mới không còn dấu ngoặc đơn trong đường dẫn (khác với
  `Program Files (x86)` có `(x86)`) — loại bỏ hẳn nguy cơ tái phát lỗi cú pháp batch đã sửa ở mục
  35 (dù bản thân mục 35 đã tự sửa đúng gốc bằng delayed expansion, nên dù có dấu ngoặc trong đường
  dẫn vẫn an toàn — đây chỉ là thêm 1 lớp phòng ngừa nữa).
- Người dùng vẫn có thể tự chọn ổ đĩa/thư mục khác lúc cài đặt (màn hình "Select Destination
  Location" của trình cài đặt luôn có nút Browse) nếu muốn cài vào ổ đĩa khác (ví dụ `D:\`).
- Đã cập nhật `packaging/windows-installer/HUONG-DAN-DONG-GOI.md`: sửa các đường dẫn ví dụ từ
  `C:\Program Files\HeThongBatSo` thành `C:\HeThongBatSo` cho khớp vị trí mặc định mới.
- Chưa thể tự kiểm chứng trên Windows thật (môi trường hiện tại là Linux) — cần người dùng xác nhận
  lại bằng cách cài lại (hoặc cài mới) bằng bản trình cài đặt biên dịch từ bản cập nhật này.

## 38. Bắt buộc cài đặt vào ổ đĩa khác ngoài ổ đĩa chứa Windows (nếu máy có ổ khác)

- **Yêu cầu người dùng**: "bạn hãy bắt buộc người dùng cài vào ổ đĩa khác ngoài ổ đĩa chứa window
  nhé. không là toi đó" — không chỉ đổi vị trí mặc định (mục 37), mà chặn hẳn việc cài vào ổ đĩa hệ
  thống nếu máy có ổ khác để chọn.
- **Đã thêm khối `[Code]`** (Pascal Script của Inno Setup) vào cả 2 file `.iss`:
  - `InitializeWizard()`: tự động dò tìm ổ đĩa đầu tiên KHÁC ổ đĩa hệ thống (ví dụ `D:\`) và điền
    sẵn vào ô chọn thư mục cài đặt, để đa số trường hợp người dùng không cần tự sửa gì.
  - `NextButtonClick()`: chặn nút "Next" ở màn hình chọn thư mục nếu người dùng vẫn chọn ổ đĩa hệ
    thống, hiện hộp thoại lỗi yêu cầu chọn ổ khác, buộc bấm "Browse" chọn lại.
  - **Chỉ bắt buộc khi máy THẬT SỰ có ổ đĩa khác để chọn** (dò bằng `DirExists` trên từng chữ cái ổ
    đĩa A-Z) — nếu máy chỉ có duy nhất 1 ổ `C:\` (rất phổ biến với PC/laptop phổ thông), không thể
    bắt buộc điều không thể làm được, nên vẫn cho phép cài vào `C:\` như bình thường (lớp cấp quyền
    `[Dirs]` ở mục 36 vẫn bảo vệ trong trường hợp này).
- Chưa thể tự kiểm chứng trên Windows thật (môi trường hiện tại là Linux, Inno Setup không chạy
  được trên Linux) — logic Pascal Script dùng đúng các hàm dựng sẵn tài liệu hoá đầy đủ của Inno
  Setup (`ExtractFileDrive`, `CompareText`, `DirExists`, `WizardDirValue`, `WizardForm.DirEdit`,
  `NextButtonClick` gắn với trang `wpSelectDir`) — cần người dùng biên dịch thử và xác nhận: (1) ô
  thư mục cài đặt tự điền sẵn ổ đĩa khác ổ Windows, và (2) thử cố tình chọn lại ổ chứa Windows có bị
  chặn kèm thông báo lỗi hay không.

## 39. Chạy server hoàn toàn ẩn, không bị ngắt khi đóng cửa sổ Command Prompt

- **Vấn đề người dùng nêu**: "sao nó k chạy ẩn dạ tôi tắt cmd run-server là nó ngắt localhost luôn.
  với lại phải chạy khởi động cùng hệ thống đảm bảo server k bị ngắt mới dc" — 2 ý: (1) muốn server
  chạy không hiện cửa sổ, và (2) đóng cửa sổ dòng lệnh đang không nên làm server bị ngắt theo.
- **Nguyên nhân**: trước bản này, `run-server.bat`/`start-server.bat` chạy `HeThongBatSo.exe`/
  `node src\server.js` làm TIẾN TRÌNH CON của chính cửa sổ Command Prompt đó — đóng cửa sổ cha thì
  Windows dọn luôn toàn bộ tiến trình con, kể cả server đang chạy. Việc tự động khởi động cùng
  Windows (mục 31) cũng đang trỏ vào 2 file `.bat` đó nên vẫn hiện cửa sổ, không thật sự "chạy nền".
- **Đã thêm file mới** `packaging/windows-installer/run-hidden.vbs`: dùng `WScript.Shell.Run` với
  kiểu cửa sổ = ẩn hoàn toàn (0) và không chờ (`False`) — gọi THẲNG `HeThongBatSo.exe` (bản ẩn mã
  nguồn) hoặc `node src\server.js` (bản không ẩn mã nguồn), KHÔNG qua `run-server.bat`/
  `start-server.bat` nữa cho đường chạy nền, để tránh để lại 1 tiến trình `cmd.exe` ẩn chờ nhập phím
  (`pause`) nếu server thoát/crash. Đây là tính năng có sẵn 100% của Windows (`wscript.exe`), không
  cần cài thêm gì. Tiến trình server khởi động qua cách này **chạy độc lập, không gắn với bất kỳ
  cửa sổ nào** — đóng Command Prompt, đóng Explorer, đăng xuất... đều không ảnh hưởng, chỉ dừng khi
  tắt máy hoặc bị chủ động dừng.
- **Đã thêm file mới** `packaging/windows-installer/stop-server.bat`: vì chạy ẩn thì không có cửa
  sổ nào để đóng, cần 1 cách chủ động dừng server — dùng `taskkill /im HeThongBatSo.exe` (bản ẩn mã
  nguồn, tên tiến trình duy nhất nên an toàn) hoặc lọc tiến trình `node.exe` có dòng lệnh chứa
  `server.js` qua PowerShell (bản không ẩn mã nguồn, có cảnh báo rõ trong file nếu máy còn chạy
  ứng dụng Node.js khác trùng tên).
- **Đã cập nhật cả 2 file `.iss`**: mục Start Menu/Desktop "Khởi động He Thống Bắt Số" giờ trỏ tới
  `run-hidden.vbs` (mặc định, dùng hằng ngày) thay vì file `.bat` hiện cửa sổ như trước; thêm mục
  mới "Dừng He Thống Bắt Số" (gọi `stop-server.bat`) và "Chẩn đoán lỗi (hiện cửa sổ)" (gọi
  `start-server.bat`/`run-server.bat` như cũ, giữ nguyên giá trị chẩn đoán đã xây dựng trước đó).
  `install-autostart.bat` (tự động khởi động cùng Windows, mục 31) cũng đổi mục tiêu sang
  `wscript.exe run-hidden.vbs` — từ nay tự khởi động cùng Windows cũng chạy ẩn hoàn toàn.
- **Đã kiểm chứng bằng công cụ**: chạy lại script Python dò cân bằng dấu ngoặc/dấu nháy kép (đã
  dùng ở mục 34-35) trên `stop-server.bat` và `install-autostart.bat` sau khi sửa — xác nhận không
  còn nguy cơ lỗi cú pháp batch tương tự.
- Chưa thể tự chạy thật trên Windows (môi trường hiện tại là Linux) — logic `WScript.Shell.Run`,
  `taskkill`, và lệnh PowerShell lọc tiến trình đều dùng đúng API/cú pháp tài liệu hoá chính thức
  của Windows, nhưng cần người dùng cài lại (hoặc chạy tay `run-hidden.vbs`/`stop-server.bat` trong
  thư mục đã cài) để xác nhận: (1) khởi động không hiện cửa sổ nào, (2) đóng Command Prompt khác
  không làm mất kết nối `localhost`, và (3) `stop-server.bat` dừng được server đang chạy ẩn.

## 40. Bật sẵn tự động khởi động cùng máy tính ngay khi cài đặt xong (không cần tick chọn)

- **Yêu cầu người dùng**: "bạn có xử lý auto khởi động cùng máy tính khi restart cài đặt xong là
  xong luôn á" — muốn tính năng tự khởi động cùng máy tính có sẵn ngay sau khi cài đặt, không cần
  thêm thao tác nào (tick chọn, chạy tay 1 file `.bat` nào đó...).
- **Đã sửa cả 2 file `.iss`**: bỏ hẳn ô tick chọn "autostart" (`[Tasks]`) — dòng gọi
  `install-autostart.bat` trong `[Run]` giờ chạy **VÔ ĐIỀU KIỆN** ở mọi lần cài đặt/cập nhật, không
  còn phụ thuộc việc người dùng có tick hay không. Script `install-autostart.bat` dùng cờ `/f`
  (force) khi tạo tác vụ nên chạy lại nhiều lần (mỗi lần cài đặt/cập nhật) vẫn an toàn, không tạo
  trùng tác vụ. Ai không muốn tính năng này vẫn có thể tắt sau bằng `uninstall-autostart.bat`.
- **Đổi kiểu kích hoạt tác vụ** từ `/sc onlogon` (chỉ chạy khi 1 tài khoản cụ thể đăng nhập) sang
  `/sc onstart /ru SYSTEM` (chạy ngay khi Windows khởi động, dùng tài khoản hệ thống SYSTEM, không
  cần chờ ai đăng nhập) — khớp đúng nghĩa "tự khởi động cùng máy tính khi restart" theo đúng lời
  yêu cầu, thay vì phụ thuộc vào việc có người đăng nhập hay không.
- **Đã kiểm chứng qua tài liệu chính thức của Inno Setup** (tra cứu tại
  [jrsoftware.org/ishelp/topic_dirssection.htm](https://jrsoftware.org/ishelp/topic_dirssection.htm)):
  tham số `Permissions:` trong khối `[Dirs]` (mục 36, cấp quyền ghi cho nhóm "Users") là CỘNG THÊM
  vào các quyền mặc định đã kế thừa từ thư mục cha (không thay thế/xoá quyền có sẵn của SYSTEM/
  Administrators) — xác nhận việc tác vụ mới chạy bằng tài khoản SYSTEM (thay vì tài khoản người
  dùng đăng nhập) vẫn có đủ quyền ghi vào thư mục cài đặt (kể cả `data\` chứa file SQLite), không
  phát sinh lại lỗi quyền ghi đã sửa ở mục 36.
- **Đã kiểm chứng bằng công cụ**: chạy lại script Python dò cân bằng dấu ngoặc/dấu nháy kép trên
  `install-autostart.bat` sau khi sửa — xác nhận không phát sinh lỗi cú pháp batch tương tự mục 35.
- Chưa thể tự kiểm chứng trên Windows thật (môi trường hiện tại là Linux) — cần người dùng cài lại
  (hoặc chạy tay `install-autostart.bat` trong thư mục đã cài) rồi khởi động lại máy để xác nhận
  server tự chạy ẩn ngay sau khi Windows khởi động, không cần đăng nhập hay bấm gì thêm.

## 41. Sửa nốt bước "Khởi động ngay bây giờ" sau khi cài đặt vẫn hiện cửa sổ (bị bỏ sót khỏi mục 39-40)

- **Phản hồi người dùng**: "sao file cài đặt k mở run-hidden mà mở run-server dẫn tới trình cài
  không chạy ẩn" — dù các mục 39-40 đã đổi toàn bộ icon Start Menu/Desktop và tác vụ tự khởi động
  cùng Windows sang chạy ẩn qua `run-hidden.vbs`, riêng dòng `[Run]` "Khởi động He Thống Bắt Số
  ngay bây giờ" (chạy ngay sau khi bấm Finish trên trình cài đặt) ở CẢ 2 file `.iss` vẫn còn trỏ
  tới file `.bat` hiện cửa sổ cũ (`start-server.bat` trong `HeThongBatSo.iss`, `run-server.bat`
  trong `HeThongBatSo-Protected.iss`) — sót lại từ trước khi có `run-hidden.vbs` (mục 39), nên lần
  chạy đầu tiên ngay sau khi cài đặt xong vẫn hiện cửa sổ dòng lệnh, không đồng nhất với mọi lần
  chạy sau đó (qua icon hoặc tự khởi động cùng Windows).
- **Đã sửa cả 2 file `.iss`**: dòng `[Run]` thứ 2 (`Description: "Khoi dong He Thong Bat So ngay
  bay gio"`, cờ `postinstall nowait skipifsilent`) đổi `Filename:` sang `wscript.exe` với
  `Parameters: """{app}\run-hidden.vbs"""` — giống hệt cách các icon Start Menu/Desktop mặc định
  đã dùng từ mục 39. Từ nay **mọi đường chạy server** (lần đầu ngay sau khi cài đặt, icon Start
  Menu/Desktop, và tự khởi động cùng Windows) đều thống nhất chạy ẩn qua `run-hidden.vbs` — chỉ
  còn duy nhất icon "Chẩn đoán lỗi (hiện cửa sổ)" là cố ý hiện cửa sổ, dùng khi cần xem log.
- Chưa thể tự kiểm chứng trên Windows thật (môi trường hiện tại là Linux) — cần người dùng gỡ cài
  đặt bản cũ (hoặc cài đè bản mới) rồi cài lại, để xác nhận: bấm Finish xong, KHÔNG còn cửa sổ dòng
  lệnh nào hiện lên, nhưng server vẫn chạy được (kiểm tra bằng cách mở trình duyệt vào địa chỉ
  `http://localhost:<PORT>` hoặc icon "Dừng He Thống Bắt Số" báo dừng được tiến trình).

## 42. Widget: thêm nút "Đăng xuất nhanh" (thoát quầy + tự đóng màn hình bệnh nhân)

- **Yêu cầu người dùng**: "widget bổ sung thêm 1 nút icon đăng xuất nhanh ra khỏi quầy hiện tại và
  đồng thời đóng màn hình /patient-screen" — muốn 1 nút bấm duy nhất trên widget (`public/counter/
  widget/index.html`) để vừa thoát phiên quầy đang chọn (giải phóng quầy cho ca sau vào dùng), vừa
  tự đóng luôn cửa sổ màn hình bệnh nhân đang mở (nếu có) — trước đây widget chỉ có nút mở màn hình
  bệnh nhân, không có cách đóng/thoát quầy ngay tại widget (phải mở hẳn màn hình quản lý `/counter`
  đầy đủ mới thấy nút "Thoát").
- **Nút mới `#logoutBtn`** (icon mũi tên ra cửa, đặt ngay cạnh nút mở màn hình bệnh nhân trong
  `index.html`) gọi `logoutCounter()` (mới, trong `widget.js`) — hiện hộp xác nhận trước khi thực
  hiện (khác các nút còn lại, không cần xác nhận) vì đây là nút nhỏ, dễ bấm nhầm giữa nhiều nút khác
  trong widget siêu nhỏ, bấm nhầm sẽ làm mất phiên đang làm việc giữa chừng.
- **`logoutCounter()` làm 2 việc, theo đúng thứ tự**: (1) gọi `POST /api/counters/:id/exit-session`
  kèm `deviceSessionToken` — **route có sẵn**, cùng route mà nút "Thoát" ở trang `/counter` đầy đủ
  dùng (`exitSession()` trong `counter.js`), không phải thêm route mới; (2) đóng cửa sổ màn hình
  bệnh nhân — trong ứng dụng Electron gọi `window.widgetBridge.closePatientScreen()` (mới, qua
  `preload.js` → kênh IPC `close-patient-screen` → `closePatientScreenWindow()` mới trong
  `main.js`, đóng đúng `patientScreenWindow` nếu đang mở); khi mở bằng trình duyệt thường (không có
  `widgetBridge`, ví dụ mở widget để xem thử) thì đóng bằng tham chiếu cửa sổ popup đã lưu lại lúc
  bấm mở (`patientScreenWinRef`, biến mới — trước đây `openPatientScreen()` trong `widget.js` mở
  popup nhưng không giữ lại tham chiếu nên không có cách đóng lại từ xa được).
- Sau khi xong, xoá `counterId` khỏi `localStorage` (dùng lại `setCounterId(null)` có sẵn) — widget
  tự chuyển về trạng thái "Chưa chọn quầy" giống hệt lúc mới mở, đồng bộ với trang `/counter` đầy đủ
  nếu đang mở cùng lúc (nhờ sự kiện `storage` đã lắng nghe sẵn từ trước).
- Nút bị mờ đi (không bấm được) khi chưa chọn quầy, giống các nút liên quan khác trên widget (mở
  màn hình bệnh nhân, thứ tự ưu tiên, danh sách bỏ qua...) — tránh bấm khi không có gì để thoát.
- **Đã kiểm chứng bằng công cụ**: chạy `node --check` trên `widget.js`, `main.js`, `preload.js` sau
  khi sửa — xác nhận không có lỗi cú pháp JavaScript.
- Chưa thể tự bấm thử trên Windows thật với ứng dụng widget Electron đang chạy thật (môi trường
  hiện tại là Linux, không dựng được cửa sổ Electron) — cần người dùng build lại widget
  (`npm run build:win` trong `electron-widget/`, xem mục "Chưa đóng gói trong hướng dẫn này" ở mục
  31) rồi thử: bấm nút mới có hỏi xác nhận, bấm "Có" thì quầy thoát ra màn hình chọn quầy VÀ cửa sổ
  màn hình bệnh nhân (nếu đang mở, kể cả đang toàn màn hình ở màn hình phụ) tự đóng theo.

## 43. Sau khi đăng nhập quầy: chỉ còn màn hình bệnh nhân toàn màn hình, tự ẩn cửa sổ /counter

- **Yêu cầu người dùng**: "điều chỉnh widget sau khi đăng nhập quầy chỉ hiện màn hình patient-screen
  fullscreen ở màn hình thứ 2, không cần bật các màn hình nào khác" — trước đây, sau khi bấm "Bắt
  đầu ca trực" ở cửa sổ quản lý `/counter` (mở qua nút ⚙️ trên widget), cửa sổ đó **vẫn ở lại trên
  màn hình** (chuyển sang hiện khối "đang làm việc") ĐỒNG THỜI 1 cửa sổ màn hình bệnh nhân cũng mở —
  nhưng cửa sổ bệnh nhân đó chỉ là 1 popup trình duyệt thường (`window.open()` trực tiếp trong
  `counter.js`), không tự toàn màn hình, không tự chuyển sang màn hình phụ — khác hẳn với cách nút
  "Mở màn hình bệnh nhân" trên widget hoạt động (mục cũ, dùng `widgetBridge.openPatientScreen`, tự
  chọn màn hình phụ + tự toàn màn hình). Kết quả: sau khi đăng nhập, nhân viên thấy 2 cửa sổ (cửa sổ
  quản lý + popup bệnh nhân không toàn màn hình) thay vì chỉ đúng 1 màn hình bệnh nhân toàn màn hình
  như mong muốn.
- **Đã sửa 3 file**:
  - `electron-widget/main.js`: `createSettingsWindow()` (cửa sổ `/counter` đầy đủ, mở qua nút ⚙️)
    nay được gắn `preload.js` (trước đây KHÔNG có, nên `window.widgetBridge` không tồn tại trong
    cửa sổ này) — để trang `/counter` dùng được cơ chế mở màn hình bệnh nhân giống hệt widget. Thêm
    hàm mới `hideSettingsWindow()` — **ẩn** (không đóng) cửa sổ này, gọi qua kênh IPC mới
    `hide-settings-window`.
  - `electron-widget/preload.js`: thêm `window.widgetBridge.hideSettings()` gọi kênh IPC trên.
  - `public/counter/counter.js`: `openPatientScreen()` nay ưu tiên dùng `widgetBridge.
    openPatientScreen()` (giống hệt `widget.js`) nếu có, thay vì `window.open()` thô — màn hình bệnh
    nhân mở từ trang `/counter` từ nay cũng tự động toàn màn hình ở màn hình phụ (nếu máy có nhiều
    màn hình), không còn là popup thường nữa. `selectCounter()` (hàm chạy khi bấm "Bắt đầu ca trực")
    sau khi mở màn hình bệnh nhân xong, gọi thêm `widgetBridge.hideSettings()` — cửa sổ `/counter` tự
    ẩn đi ngay, chỉ còn lại đúng màn hình bệnh nhân toàn màn hình (và widget nhỏ luôn-nổi-bên-trên để
    tiếp tục gọi số) — đúng theo yêu cầu. Khi mở bằng trình duyệt thường (không có `widgetBridge`)
    thì giữ nguyên hành vi cũ (không ẩn được vì đó chính là trang đang xem).
  - Vì cửa sổ `/counter` giờ có thể bị ẩn (không huỷ hẳn) với trạng thái cũ, `createSettingsWindow()`
    được sửa để **luôn tải lại trang** (`loadURL`) mỗi lần mở ra (kể cả khi mở lại qua nút ⚙️/khay hệ
    thống), thay vì chỉ `show()+focus()` cửa sổ cũ như trước — tránh hiện nhầm trạng thái cũ (ví dụ
    quầy đã đăng xuất từ nút "Đăng xuất nhanh" trên widget — mục 42 — trong lúc cửa sổ này đang ẩn).
    Đường tự khôi phục phiên khi tải trang (`loadCounters().then(...)` ở cuối `counter.js`, dùng khi
    mở lại `/counter` lúc ĐÃ đăng nhập sẵn, ví dụ bấm lại nút ⚙️) **giữ nguyên không đổi** — không tự
    ẩn cửa sổ trong trường hợp này, vì đó là lúc nhân viên chủ động muốn xem lại màn hình quản lý.
- **Đã kiểm chứng bằng công cụ**: chạy `node --check` trên `counter.js`, `main.js`, `preload.js` sau
  khi sửa — xác nhận không có lỗi cú pháp JavaScript.
- Chưa thể tự bấm thử trên Windows thật với ứng dụng widget Electron đang chạy thật (môi trường hiện
  tại là Linux) — cần người dùng build lại widget (`npm run build:win` trong `electron-widget/`) rồi
  thử: mở nút ⚙️ trên widget, chọn quầy, bấm "Bắt đầu ca trực" — xác nhận CHỈ còn hiện màn hình bệnh
  nhân toàn màn hình ở màn hình phụ (nếu máy có 2 màn hình), cửa sổ quản lý `/counter` tự biến mất
  (không phải đóng hẳn — bấm lại nút ⚙️ trên widget vẫn mở lại được bình thường, đúng trạng thái hiện
  tại).

## 44. Kiểm tra lỗi "Print Notification ... The printer couldn't print" khi in phiếu qua widget

- **Người dùng báo**: chụp ảnh hộp thoại **của chính Windows** ("Print Notification — Error printing
  on EPSON TM-T82III Receipt — The printer couldn't print C:\Users\...\Temp\phieu-so-thu-tu-...pdf")
  xuất hiện khi cấp số/in phiếu qua `/staff-kiosk` mở từ widget.
- **Chẩn đoán — vì sao đây KHÔNG PHẢI lỗi mà ứng dụng có thể tự phát hiện được (trước khi sửa)**:
  cách in hiện tại (mục lịch sử "CÁCH MỚI" trong `printTicketSilently()`, `electron-widget/main.js`)
  xuất phiếu ra 1 file PDF tạm rồi dùng thư viện `pdf-to-printer` (chạy kèm SumatraPDF) để **gửi
  file đó cho Windows Print Spooler** — quy trình này chỉ chờ đến khi tiến trình SumatraPDF **thoát**
  (nghĩa là đã gửi xong lệnh in cho Windows), ứng dụng ghi log "in thành công" ngay tại đó. Việc
  Windows/driver máy in **thực sự in ra giấy được hay không** xảy ra HOÀN TOÀN SAU ĐÓ, ở tầng Print
  Spooler của hệ điều hành — nằm ngoài tầm với của tiến trình SumatraPDF đã thoát từ trước, nên ứng
  dụng **không có cách nào bắt được lỗi này bằng try/catch** như các lỗi khác. Đây chính xác là lý do
  hộp thoại lỗi trong ảnh chụp là **của chính Windows** (biểu tượng "Print Notification" hệ thống),
  KHÔNG PHẢI hộp thoại nào của ứng dụng — vì ứng dụng thực sự không biết có lỗi xảy ra.
- **Đã bổ sung 2 lớp phòng ngừa/chẩn đoán mới trong `electron-widget/main.js`**, tận dụng cơ hội DUY
  NHẤT còn lại: kiểm tra tình trạng máy in **TRƯỚC** khi gửi lệnh in (Windows có cho biết được qua
  `PrinterInfo.status` — API sẵn có của Electron/Windows, lấy thẳng từ `GetPrinter()` của hệ điều
  hành):
  1. **Cảnh báo ngay trong ứng dụng trước khi in** (`decodePrinterStatusIssues()`, mới): giải mã
     bitmask trạng thái máy in (hết giấy, kẹt giấy, đang mở nắp, ngoại tuyến, đang tạm dừng, cần can
     thiệp thủ công...) — nếu máy in đang báo bất kỳ trạng thái bất thường nào, hiện ngay 1 hộp
     thoại lỗi **rõ ràng, bằng tiếng Việt** liệt kê đúng lý do (thay vì để nhân viên chỉ thấy hộp
     thoại chung chung "The printer couldn't print" của Windows, không biết vì sao) — vẫn cho gửi
     lệnh in tiếp theo sau đó (trạng thái có thể đã cũ, không chặn nhầm khi máy in đã sẵn sàng lại).
  2. **File log lỗi in mới, RIÊNG BIỆT với file log chẩn đoán cũ đã bỏ hẳn trước đây** (mục cũ, tắt
     để nhẹ máy hơn): `loi-in.log` (`logPrintIssue()`, mới) — **CHỈ ghi khi thực sự có dấu hiệu bất
     thường** (cảnh báo trạng thái ở trên, hoặc lệnh in ném lỗi ngoại lệ), KHÔNG ghi liên tục mỗi lần
     in như file log cũ đã bỏ, nên không đi ngược lại yêu cầu tắt bớt ghi log trước đó. Mục tray mới
     **"Mở file log lỗi in"** chỉ hiện ra khi file này đã thực sự tồn tại (chưa từng có lỗi thì không
     hiện, đỡ rối menu) — giúp lần sau gặp lỗi tương tự, có thể gửi lại đúng file log này (ghi rõ máy
     in nào, trạng thái lúc đó, khổ giấy đã tính) thay vì chỉ chụp lại đúng cái hộp thoại chung chung
     của Windows như trong ảnh vừa gửi.
- **Các nguyên nhân thực tế phổ biến nhất** gây ra chính hộp thoại "Print Notification ... couldn't
  print" này trên máy in nhiệt USB như Epson TM-T82III (tham khảo để tự kiểm tra ngay, không cần đợi
  bản cập nhật): hết giấy hoặc lắp giấy sai chiều, nắp máy in chưa đóng khít (nhiều máy in nhiệt có
  cảm biến nắp mở sẽ từ chối in), dây cáp USB lỏng/máy in bị tắt nguồn đúng lúc đang in, hàng đợi in
  (Print Queue) của Windows bị kẹt 1 lệnh in lỗi từ trước đó (mở "Máy in & máy quét" trong Windows →
  chọn đúng máy in → "Mở hàng đợi in" → xoá hết các lệnh đang treo), hoặc driver máy in trong Windows
  bị lỗi/cần cài lại.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp.
  Giá trị bit trạng thái máy in (`PRINTER_STATUS_*`) đối chiếu đúng theo tài liệu WinSpool chính thức
  của Microsoft.
- Chưa thể tự bấm thử trên Windows thật với máy in Epson TM-T82III thật (môi trường hiện tại là
  Linux, không có máy in) — cần người dùng cập nhật ứng dụng widget rồi thử in lại: nếu máy in đang
  gặp 1 trong các trạng thái kể trên, sẽ thấy ngay 1 hộp thoại lỗi RÕ RÀNG của ứng dụng (khác hộp
  thoại "Print Notification" mù mờ của Windows) TRƯỚC khi phiếu được gửi đi in.

## 45. Không tự xóa sớm file PDF tạm khi in, thêm mục xem tất cả quầy, ép toàn màn hình 3 màn hình

- **Yêu cầu người dùng (3 việc)**: (1) nghi ngờ nguyên nhân lỗi in ở mục 44 là do file PDF tạm bị
  **xóa quá sớm, trước khi in xong** — muốn đổi cách xóa sang "lâu lâu xóa 1 lần" thay vì xóa ngay
  sau mỗi lần in; (2) thêm mục **"Xem tất cả các quầy đang phục vụ"** vào menu chuột phải icon khay
  hệ thống (taskbar) của widget; (3) các màn hình **staff-kiosk, counter, waiting-screen** mở từ
  widget phải **hiển thị toàn màn hình (fullscreen)**.
- **(1) Đổi cách dọn file PDF tạm** (`electron-widget/main.js`): trước đây mỗi lần in xong, đợi 15
  giây rồi tự xóa đúng file PDF vừa dùng (`setTimeout` trong `printTicketSilently()`). Đã **bỏ hẳn**
  cách xóa riêng lẻ này — 15 giây có thể không đủ trong một số trường hợp (Windows Print Spooler/
  driver máy in nhiệt bận xử lý lệnh in khác, hoặc máy in tạm chậm/lỗi rồi tự hồi phục), và **không
  có mốc thời gian nào chắc chắn an toàn tuyệt đối** để tự xóa ngay sau 1 lần in. Thay vào đó, giữ
  lại toàn bộ file PDF tạm và dựa hẳn vào vòng dọn dẹp định kỳ (`cleanupOldTempPdfs()`, đã có sẵn từ
  trước — chỉ xóa file **cũ hơn 1 giờ**, chắc chắn không đụng đến file đang được in dở) — vòng dọn
  dẹp này trước đây **chỉ chạy 1 lần lúc khởi động ứng dụng**, nay chạy thêm **định kỳ mỗi 2 tiếng**
  trong lúc ứng dụng đang chạy (`setInterval`, mới) — vì widget thường chạy liên tục nhiều ngày liền
  (tự khởi động cùng Windows, không tắt máy), nếu chỉ dọn lúc khởi động thì file tạm sẽ tích tụ ngày
  càng nhiều suốt thời gian đó. Đây là 1 lớp phòng ngừa **bổ sung** cho mục 44 (kiểm tra trạng thái
  máy in trước khi in + log lỗi riêng) — chưa thể khẳng định chắc chắn nguyên nhân gốc là do xóa sớm
  hay do máy in báo lỗi trạng thái, nên sửa cả hai hướng khả nghi cùng lúc.
- **(2) Mục tray mới "Xem tất cả các quầy đang phục vụ"**: mở đúng trang **`/waiting-screen`** — 1
  trang **đã có sẵn từ trước** trong hệ thống (bảng liệt kê từng quầy đang phục vụ số nào, danh sách
  số bị bỏ qua, số lượng đang chờ theo từng đối tượng ưu tiên) nhưng trước đây **chỉ mở được bằng
  cách tự gõ địa chỉ vào trình duyệt ngoài** — nay thêm hàm mới `openWaitingScreenWindow()` để mở
  ngay trong ứng dụng widget, gắn vào mục mới trong menu tray (`buildTrayMenu()`), đặt ngay dưới mục
  "Mở kiosk cấp số – Nhân viên".
- **(3) Ép toàn màn hình cho 3 cửa sổ**: trước đây CHỈ `/kiosk` (kiosk bốc số cho bệnh nhân) và
  `/patient-screen` tự động toàn màn hình — `createSettingsWindow()` (`/counter`), `openStaffKioskWindow()`
  (`/staff-kiosk`), và `openWaitingScreenWindow()` (`/waiting-screen`, mới) nay đều dùng **chung 1
  kiểu mở** với `/kiosk`: cửa sổ ẩn lúc đầu (`show: false`) → tải trang xong (`ready-to-show`) → gọi
  `setFullScreen(true)` → mới hiện ra (tránh nháy hình lúc chuyển đổi kích thước). Mở lại cửa sổ đã
  có sẵn (ví dụ bấm lại nút ⚙️ hoặc mục tray) cũng kiểm tra và ép lại toàn màn hình nếu vì lý do gì đó
  đang không còn toàn màn hình. Đóng các cửa sổ này (Alt+F4, hoặc từ tray) hoạt động bình thường như
  mọi cửa sổ Electron khác, không bị ảnh hưởng bởi chế độ toàn màn hình.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp
  (kể cả sau khi bỏ khối xóa file lồng trong `finally` — đã kiểm tra kỹ dấu ngoặc nhọn cân bằng lại
  đúng).
- Chưa thể tự bấm thử trên Windows thật với ứng dụng widget Electron đang chạy thật (môi trường hiện
  tại là Linux) — cần người dùng build lại widget (`npm run build:win`) rồi thử: (1) in vài phiếu
  liên tục, xác nhận không còn hiện tượng phiếu ra trắng/thiếu nội dung nghi do xóa sớm; (2) mở menu
  chuột phải icon khay hệ thống, xác nhận thấy mục mới và mở đúng trang liệt kê tất cả các quầy;
  (3) mở `/counter`, `/staff-kiosk` từ widget, xác nhận cả 2 tự vào toàn màn hình ngay khi mở, giống
  hệt cách `/kiosk`/`/patient-screen` đã hoạt động từ trước.

## 46. Bỏ toàn màn hình cho riêng cửa sổ /counter (giữ nguyên cho staff-kiosk/waiting-screen)

- **Yêu cầu người dùng**: "điều chỉnh widget màn hình counter k cần fullscreen" — mục 45 vừa rồi đã
  đổi cả 3 cửa sổ `/counter`, `/staff-kiosk`, `/waiting-screen` sang luôn toàn màn hình khi mở, nhưng
  sau khi dùng thử, người dùng muốn **CHỈ RIÊNG `/counter`** (màn hình quản lý — chọn quầy, kéo-thả
  thứ tự ưu tiên, xem danh sách bỏ qua...) quay lại **cửa sổ bình thường** (có thể thu nhỏ/phóng
  to/kéo cạnh) như trước mục 45 — vì đây là màn hình cần thao tác nhiều, toàn màn hình gây bất tiện.
  `/staff-kiosk` và `/waiting-screen` **giữ nguyên toàn màn hình** như mục 45 (không đổi).
- **Đã sửa `createSettingsWindow()`** (`electron-widget/main.js`) — bỏ toàn bộ phần ép toàn màn hình
  (`show:false` + đợi `ready-to-show` + `setFullScreen(true)`) vừa thêm ở mục 45, quay lại đúng kiểu
  cũ: mở ngay dạng cửa sổ thường, kích thước mặc định `1000x780`, có thể kéo giãn/thu nhỏ tự do. Các
  phần khác của cửa sổ này **giữ nguyên không đổi** (gắn `preload.js` để dùng `widgetBridge`, luôn
  tải lại trang mỗi lần mở theo mục 43, tự ẩn sau khi đăng nhập quầy theo mục 43).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp.
- Chưa thể tự bấm thử trên Windows thật (môi trường hiện tại là Linux) — cần người dùng build lại
  widget rồi thử: mở `/counter` (nút ⚙️ trên widget) xác nhận mở dạng cửa sổ bình thường, kéo giãn/
  thu nhỏ được như trước; `/staff-kiosk` và mục tray "Xem tất cả các quầy đang phục vụ" vẫn tự vào
  toàn màn hình như mục 45.

## 47. Bỏ toàn màn hình cho /staff-kiosk (giữ nguyên waiting-screen)

- **Yêu cầu người dùng**: "điều chỉnh widget màn hình staff-kiosk k cần fullscreen" — tiếp nối mục
  46 (đã bỏ toàn màn hình riêng cho `/counter`), nay bỏ luôn cho **`/staff-kiosk`** (màn hình nhân
  viên hỗ trợ cấp số — chọn đối tượng ưu tiên, quét/chụp QR xác minh CCCD/BHYT...) — cũng là màn
  hình cần thao tác nhiều, toàn màn hình gây bất tiện tương tự `/counter`. **`/waiting-screen`**
  (mục 45, mở qua tray "Xem tất cả các quầy đang phục vụ") **giữ nguyên toàn màn hình** — đây là màn
  hình chỉ xem, không thao tác, phù hợp toàn màn hình.
- **Đã sửa `openStaffKioskWindow()`** (`electron-widget/main.js`) — bỏ phần ép toàn màn hình
  (`show:false` + đợi `ready-to-show` + `setFullScreen(true)`) thêm ở mục 45, quay lại đúng kiểu cũ:
  mở ngay dạng cửa sổ thường, kích thước mặc định `900x780`, kéo giãn/thu nhỏ tự do. Vẫn giữ nguyên
  `preload.js` (để in lặng lẽ qua máy in nhiệt hoạt động bình thường).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp.
- Chưa thể tự bấm thử trên Windows thật (môi trường hiện tại là Linux) — cần người dùng build lại
  widget rồi thử: mở "Mở kiosk cấp số – Nhân viên" từ tray, xác nhận mở dạng cửa sổ bình thường,
  kéo giãn/thu nhỏ được; mục "Xem tất cả các quầy đang phục vụ" vẫn toàn màn hình như trước.

## 48. Các nút gọi số trên widget tự bật màn hình bệnh nhân nếu chưa bật

- **Yêu cầu người dùng**: "widget các tất cả các nút gọi số, gọi lại, bỏ qua, gọi số ưu tiên riêng
  đều phải auto bật màn patient-screen nếu màn patient-screen của quầy chưa được bật" — trước đây
  CHỈ có nút "Mở màn hình bệnh nhân" (📺) trên widget mới mở được `/patient-screen`; 4 nút thao tác
  gọi số (Gọi tiếp theo, Gọi lại, Bỏ qua, các nút số lượng theo từng đối tượng ưu tiên trong
  `#queueCounts`) hoàn toàn không liên quan gì đến việc màn hình bệnh nhân đang mở hay chưa — nếu
  nhân viên quên bấm mở màn hình bệnh nhân trước, gọi số xong mà màn hình đó vẫn chưa bật thì bệnh
  nhân sẽ không thấy/nghe gì cả.
- **Hàm mới `ensurePatientScreen()`** trong `public/counter/widget/widget.js`, gọi ở **đầu** cả 4
  hàm xử lý nút bấm (`callNext()`, `callNextByPriority()`, `reCall()`, `skip()`) — **trước** khi gửi
  yêu cầu gọi số lên máy chủ, để nếu màn hình bệnh nhân chưa mở, nó kịp mở/kết nối xong TRƯỚC khi
  lệnh gọi số thực sự tới máy chủ (màn hình bệnh nhân chỉ phát âm thanh gọi số khi **nhận được sự
  kiện** lúc gọi, không phát lại nếu mở màn hình SAU khi đã gọi xong — mở trước đảm bảo không bị mất
  tiếng ở lần gọi đó).
- **QUAN TRỌNG — không mở lặp lại/cướp focus nếu đã đang mở sẵn**: khác với nút "Mở màn hình bệnh
  nhân" (bấm thủ công, luôn đưa cửa sổ ra trước + focus), `ensurePatientScreen()` dùng 1 đường mới
  `widgetBridge.ensurePatientScreen()` (`preload.js`) → kênh IPC `ensure-patient-screen` (mới) →
  `openPatientScreenWindow(counterId, { bringToFront: false })` (`electron-widget/main.js`, hàm cũ
  được bổ sung tham số `bringToFront`) — nếu màn hình bệnh nhân của đúng quầy đó **đã đang mở sẵn
  rồi**, hàm này **không làm gì cả** (không hiện lại/không cướp focus). Điều này rất quan trọng vì
  nhân viên bấm gọi số hàng chục lần mỗi ca — nếu mỗi lần đều đưa cửa sổ màn hình bệnh nhân ra trước,
  sẽ liên tục làm phiền/mất tập trung khỏi widget đang thao tác. Khi mở bằng trình duyệt thường
  (không có `widgetBridge`) thì dựa vào biến `patientScreenWinRef` (đã có từ mục 42) để biết cửa sổ
  popup có đang còn mở hay không trước khi quyết định mở thêm.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js`, `main.js`, `preload.js` sau khi
  sửa — không có lỗi cú pháp.
- Chưa thể tự bấm thử trên Windows thật với ứng dụng widget Electron đang chạy thật (môi trường hiện
  tại là Linux) — cần người dùng build lại widget rồi thử: chọn quầy nhưng KHÔNG bấm nút mở màn hình
  bệnh nhân, bấm thẳng "Gọi tiếp theo" (hoặc gọi lại/bỏ qua/gọi riêng đối tượng) — xác nhận màn hình
  bệnh nhân tự bật ở màn hình phụ; sau đó bấm gọi số thêm vài lần nữa, xác nhận màn hình đó KHÔNG bị
  hiện lại/cướp focus mỗi lần bấm (chỉ tự cập nhật số như bình thường).

## 49. Widget: thêm chế độ hiển thị theo chiều dọc (thu nhỏ nhất có thể)

- **Yêu cầu người dùng**: "widget thêm mới tính năng hiển thị widget theo chiều dọc làm sao cho nhỏ
  nhất như hiện tại chỉ đổi lại là chiều dọc thôi" — widget hiện tại chỉ có 1 kiểu hiển thị: xếp toàn
  bộ nội dung (mã quầy, số đang phục vụ, 3 nút gọi/gọi lại/bỏ qua, các nút mở màn hình bệnh nhân/đăng
  xuất/kiosk nhân viên, cụm số lượng chờ theo đối tượng ưu tiên, nút ⚙️) trên **1 hàng ngang duy
  nhất**. Muốn thêm chế độ xếp **theo chiều dọc** (trên xuống dưới) — vẫn đúng những nội dung/nút đó,
  không thêm bớt chức năng gì, chỉ đổi hướng xếp để bề rộng widget thu nhỏ tối đa (kiểu thanh dọc
  mỏng, đặt sát cạnh màn hình cũng được).
- **Mục mới trong menu tray: "Hiển thị widget theo chiều dọc"** (checkbox, cạnh "Luôn nổi bên
  trên") — bật/tắt qua hàm mới `setWidgetOrientation()` (`electron-widget/main.js`): lưu lựa chọn
  vào `config.widgetOrientation` (`'horizontal'`/`'vertical'`, mặc định `'horizontal'` — file mới
  `electron-widget/config.js`), đổi vị trí/kích thước cửa sổ sang đúng bộ đã lưu riêng cho hướng đó
  (xem bên dưới), rồi tải lại trang widget với tham số `?orientation=vertical` trên URL khi ở chế độ
  dọc.
- **Vị trí/kích thước lưu RIÊNG cho từng hướng** (`config.widgetBounds` cho ngang — như cũ,
  `config.widgetBoundsVertical` cho dọc — mới): đổi qua đổi lại giữa 2 chế độ **không làm mất** vị
  trí/kích thước đã từng tự kéo chỉnh tay cho hướng kia. Kích thước mặc định chiều dọc:
  `54 × 480` px (so với `480 × 40` px của chiều ngang) — bề rộng thu nhỏ tối đa gần bằng 1 nút vuông,
  bề cao đủ hiện được các nhóm nội dung; vẫn kéo giãn/thu nhỏ tự do bằng tay như chiều ngang. Mục
  tray "Đặt lại vị trí/kích thước widget" (đã có từ trước) cũng chỉ đặt lại đúng hướng đang dùng.
- **CSS mới trong `public/counter/widget/index.html`** (chọn qua class `vertical` gắn trên thẻ
  `<html>`, đọc từ tham số `?orientation=vertical` trên URL **ngay lúc phân tích `<head>`** — trước
  khi `<body>` được vẽ, tránh hiện tượng "nháy" 1 khoảnh khắc hiện ngang rồi mới chuyển dọc): xếp lại
  đúng các nhóm nội dung sẵn có theo cột (`flex-direction: column`) thay vì hàng — mã quầy, số đang
  phục vụ, cụm 3 nút gọi/gọi lại/bỏ qua, các nút icon, và cụm số lượng chờ theo đối tượng ưu tiên
  (`#queueCounts`, đổi từ cuộn NGANG khi hết chỗ sang cuộn DỌC khi hết chỗ, cùng nguyên tắc — không
  đổi cách hoạt động, chỉ đổi trục). Không sửa `public/counter/widget/widget.js` (logic gọi số/mở màn
  hình bệnh nhân... giữ nguyên hoàn toàn, chỉ khác cách trình bày).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js`, `main.js`, `preload.js`,
  `config.js` sau khi sửa — không có lỗi cú pháp.
- Chưa thể tự xem giao diện thật trên Windows (môi trường hiện tại là Linux, không dựng được cửa sổ
  Electron để chụp màn hình xác nhận bố cục) — cần người dùng build lại widget rồi thử: bật mục
  "Hiển thị widget theo chiều dọc" trong tray, xác nhận widget chuyển sang 1 thanh dọc mỏng đầy đủ
  chức năng như cũ (gọi số, gọi lại, bỏ qua, mở màn hình bệnh nhân, đăng xuất nhanh, gọi riêng từng
  đối tượng ưu tiên...); tắt lại mục đó để quay về hàng ngang như trước, xác nhận vị trí/kích thước
  của cả 2 hướng đều được nhớ riêng biệt qua các lần đổi qua đổi lại.

## 50. Bỏ hộp thoại cảnh báo "Máy in có thể đang gặp sự cố" trước khi in

- **Người dùng báo (kèm ảnh chụp)**: hộp thoại "Máy in có thể đang gặp sự cố" (thêm ở mục 44) hiện
  ra báo máy in Epson TM-T82III "đang báo lỗi (error) (mã trạng thái: 2)" — nhưng máy in **thực tế
  vẫn hoạt động bình thường**, hộp thoại này chỉ gây gián đoạn/phiền khi cấp số liên tục. Yêu cầu:
  bỏ hẳn cảnh báo này, cứ để hệ thống gửi lệnh in xuống máy in bình thường, không cảnh báo gì cả.
- **Nguyên nhân**: giá trị `status` mà Windows trả về cho máy in (`PrinterInfo.status`, dùng ở mục
  44 để đoán trước sự cố) trên thực tế **không đáng tin cậy/quá nhạy** với dòng máy in nhiệt như
  Epson TM-T82III — driver có thể báo bit "error" chung chung ngay cả khi máy in vẫn in bình thường
  (ví dụ 1 trạng thái nội bộ bình thường nào đó của driver bị Windows diễn giải nhầm thành lỗi) —
  không phản ánh đúng tình trạng in thực tế như kỳ vọng ban đầu.
- **Đã sửa `printTicketSilently()`** (`electron-widget/main.js`) — bỏ hẳn lệnh `dialog.showErrorBox()`
  hiện hộp thoại cảnh báo khi phát hiện `status` bất thường. Vẫn **giữ lại việc ghi vào file log lỗi
  in** (`loi-in.log`, mục 44) — chỉ ghi thầm lặng, không hiện gì cho nhân viên thấy — để nếu sau này
  máy in THỰC SỰ không in được, vẫn có dữ liệu đối chiếu. Lệnh in vẫn được gửi xuống máy in ngay sau
  đó như bình thường, không có bất kỳ cảnh báo/hộp thoại nào chặn lại nữa.
- Các hộp thoại lỗi in KHÁC (khi lệnh in thực sự ném lỗi ngoại lệ, hoặc không lấy được danh sách máy
  in) **vẫn được giữ nguyên** — đó là những lỗi thật sự xảy ra trong chính thao tác của ứng dụng,
  khác với cảnh báo dựa trên đoán trạng thái máy in (không đáng tin cậy) vừa bị bỏ.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp.
- Chưa thể tự bấm thử trên Windows thật với máy in Epson TM-T82III thật (môi trường hiện tại là
  Linux) — cần người dùng cập nhật ứng dụng widget rồi thử cấp số vài lần liên tục, xác nhận không
  còn hộp thoại "Máy in có thể đang gặp sự cố" hiện lên nữa, phiếu vẫn in ra bình thường.

## 51. Sửa lỗi tự bật màn hình bệnh nhân (mục 48) nhưng chưa đọc số ở lần gọi đầu tiên

- **Người dùng báo**: mục 48 (tự bật màn hình bệnh nhân khi bấm gọi số mà màn hình đó chưa mở) hoạt
  động đúng phần "tự bật màn hình", nhưng **màn hình vừa bật không tự đọc số** (không có âm thanh
  thông báo) cho đúng lần gọi số vừa kích hoạt việc tự bật đó.
- **Nguyên nhân**: `/patient-screen` (`public/patient-screen/index.html`) chỉ phát âm thanh khi
  **nhận được** sự kiện socket `counter:called`/`counter:reannounce` **đúng lúc** sự kiện đó được
  phát ra — không phát lại cho các lần gọi đã xảy ra trước khi nó mở (lúc mới mở, nó chỉ lấy trạng
  thái hiện tại qua 1 lần gọi API, không có âm thanh). Cách làm ở mục 48
  (`window.widgetBridge.ensurePatientScreen(counterId)`) chỉ là 1 lệnh "bắn đi rồi thôi" (`ipcRenderer.send`)
  — `widget.js` gọi lệnh mở màn hình bệnh nhân xong là **gọi API gọi số ngay lập tức**, không đợi
  màn hình đó tải xong/kết nối socket — nên với lần gọi đầu tiên (khi màn hình còn đang mở), sự kiện
  gọi số thường "bay qua đầu" một màn hình chưa kịp tồn tại để nhận.
- **Đã sửa 3 file để chờ đúng lúc**:
  - `electron-widget/main.js`: `openPatientScreenWindow()` nay **trả về 1 Promise** — giải quyết
    (resolve) NGAY nếu màn hình đã mở sẵn đúng quầy (không cần chờ gì, chắc chắn đã kết nối từ
    trước), hoặc **sau khi** cửa sổ mới mở xong (`did-finish-load` — lúc dòng `const socket = io();`
    đã chạy) **cộng thêm 500ms** dự phòng cho socket.io kết nối hẳn (có lưới an toàn tối đa 3 giây
    nếu mạng chậm/lỗi, không chặn mãi mãi). Kênh IPC `ensure-patient-screen` đổi từ `ipcMain.on`
    sang **`ipcMain.handle`** để trả kết quả Promise này về phía widget.
  - `electron-widget/preload.js`: `ensurePatientScreen()` đổi từ `ipcRenderer.send` (bắn đi không
    chờ) sang **`ipcRenderer.invoke`** (trả về Promise, gọi phía widget chờ được).
  - `public/counter/widget/widget.js`: `ensurePatientScreen()` đổi thành hàm `async`, **`await`**
    kết quả từ `widgetBridge.ensurePatientScreen()` trước khi trả về — và cả 4 hàm xử lý nút bấm
    (`callNext()`, `callNextByPriority()`, `reCall()`, `skip()`) đều **`await ensurePatientScreen()`**
    trước khi thực sự gọi API gọi số lên máy chủ, đảm bảo màn hình bệnh nhân đã sẵn sàng nhận sự
    kiện socket trước khi lệnh gọi số thực sự được gửi đi. Nút "Gọi tiếp theo" cũng được vô hiệu hoá
    (`disabled`) **trước** bước chờ này (không phải sau như trước), tránh bấm lặp trong lúc đang chờ.
  - Trường hợp mở bằng trình duyệt thường (không có `widgetBridge` — ít gặp, không phải cách dùng
    chính) vẫn giữ hành vi cũ (không chờ được, vì không có kênh IPC để biết lúc nào cửa sổ popup kia
    kết nối xong) — có thể vẫn gặp tình trạng mất tiếng ở lần gọi đầu trong trường hợp phụ này.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js`, `main.js`, `preload.js` sau khi
  sửa — không có lỗi cú pháp.
- Chưa thể tự bấm thử trên Windows thật với ứng dụng widget Electron đang chạy thật (môi trường hiện
  tại là Linux) — cần người dùng build lại widget rồi thử: chọn quầy, KHÔNG bấm mở màn hình bệnh
  nhân, bấm thẳng "Gọi tiếp theo" — xác nhận màn hình bệnh nhân tự bật VÀ đọc đúng số vừa gọi (có thể
  có độ trễ ngắn dưới 1 giây trước khi số được gọi, do phải chờ màn hình kết nối xong).

## 52. Thêm 3 nút "Cấp số nhanh" (Thường/≥75/<6) không cần xác thực, có khoá chống spam dùng chung

- **Yêu cầu**: "widget có thể bổ sung 3 icon lấy số thường,>=75,<=6 ko cần qua xác thực được không.
  nhưng mà các nút này ko dc phép spam vì nó phải có thời gian gửi lệnh in - kiểm tra 1 icon đang
  nhấn thì 2 icon còn lại không được phép spam".
- **Đã thêm** 3 nút mới trên widget (`public/counter/widget/index.html`, đặt sau nút mở kiosk cấp số
  nhân viên 🧑‍💼, trước cụm số lượng chờ theo đối tượng): "Thường" (mã `NORMAL`, màu xám `#4b5563`),
  "≥75" (mã `AGE75`, màu cam `#f97316`), "<6" (mã `CHILD6`, màu xanh cyan `#38bdf8`) — 3 mã này lấy
  đúng theo `src/config/priorityRules.js` đã có sẵn (không cần sửa gì phía máy chủ). Ở chế độ hiển
  thị dọc (mục 49) 3 nút này cũng tự xếp full-width theo cột như các nút khác.
- **Không cần xác thực**: bấm là cấp số ngay, không quét/nhập CCCD hay tên bệnh nhân gì cả — dùng
  LẠI đúng API `POST /api/tickets/staff` đã có sẵn (được `requireStaff` bảo vệ bằng cookie
  `staff_token` — vẫn cần đăng nhập quầy trên widget trước, chỉ là không cần xác minh THÊM cho từng
  lượt cấp số), với `patient: null`, giống hệt cách nút "🚀 Cấp số ngay" trên `/staff-kiosk` đang
  dùng (`createStaffTicket()` trong `public/staff-kiosk/staff-kiosk.js`).
- **In phiếu**: sau khi cấp số thành công, widget gọi thẳng `printReceipt()` (đã có sẵn trong
  `public/print-receipt.js`, giờ được nạp thêm vào `index.html` qua thẻ
  `<script src="/print-receipt.js"></script>`) để in lặng lẽ ngay trong ứng dụng Electron (nếu widget
  đang chạy trong Electron) — không qua hộp thoại in nào. Tên phòng khám/dòng chân trang/logo được
  `widget.js` tự lấy 1 lần lúc khởi động qua `GET /api/branding` (hàm `loadBrandingForReceipt()`,
  chép lại đúng cách làm của `staff-kiosk.js`).
- **Chống spam theo đúng yêu cầu — 1 khoá dùng CHUNG cho cả 3 nút** (không phải khoá riêng từng nút):
  biến `let quickIssueBusy = false;` ở `widget.js`. Hàm `quickIssueTicket(priorityCode)` việc đầu
  tiên là kiểm tra `if (quickIssueBusy) return;`, rồi bật khoá và gọi `setQuickIssueButtonsDisabled(true)`
  để **vô hiệu hoá (disable) cả 3 nút cùng lúc** trước khi gọi API — nghĩa là trong lúc 1 nút đang xử
  lý (kể cả đang chờ lệnh in gửi xong), 2 nút còn lại (và cả chính nút vừa bấm) đều không bấm được
  nữa, chỉ mở khoá lại (khối `finally`) sau khi toàn bộ việc cấp số + gửi lệnh in đã xong, dù thành
  công hay có lỗi — tránh cấp trùng/thừa số khi bấm liên tục nhiều nút trong lúc lệnh in trước còn
  đang xử lý (in phiếu tốn thời gian thật, không phải xong ngay tức khắc).
- Trường hợp phiên đăng nhập nhân viên đã hết hạn (mã lỗi 401), widget hiện thông báo ngắn ở khay
  trạng thái sẵn có (`showStatus()`: "Chưa đăng nhập nhân viên - vui lòng đăng nhập lại") thay vì tự
  điều hướng sang trang khác như `/staff-kiosk` — vì widget là cửa sổ nhỏ luôn-nổi-bên-trên, không
  phù hợp để tự chuyển trang.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js` sau khi sửa — không có lỗi cú
  pháp; đã đọc lại đúng route `POST /api/tickets/staff` (`src/routes/tickets.js`) và route
  `GET /api/branding` (`src/routes/branding.js`, gắn ở `src/server.js`) để xác nhận không cần thêm gì
  ở phía máy chủ.
- Chưa thể tự bấm thử trên Windows thật với máy in nhiệt thật (môi trường hiện tại là Linux) — cần
  người dùng cập nhật ứng dụng widget rồi thử: đăng nhập 1 quầy, bấm nhanh liên tiếp cả 3 nút "Cấp số
  nhanh" (kể cả bấm dồn dập nhiều lần vào cùng 1 nút) — xác nhận chỉ có ĐÚNG 1 số được cấp/in tại một
  thời điểm, các nút còn lại tạm mờ đi (disabled) cho tới khi phiếu trước in xong mới bấm được tiếp,
  không có số nào bị cấp trùng/thừa.

## 53. Đổi 3 nút cấp số nhanh (mục 52) thành icon emoji nhỏ + thêm bước xác nhận trước khi cấp

- **Người dùng góp ý**: 3 nút cấp số nhanh ở mục 52 dùng chữ ("Thường"/"≥75"/"<6") bị to, không hợp
  với các nút icon nhỏ còn lại trên widget; đồng thời cần thêm 1 bước xác nhận (confirm) trước khi
  thực sự cấp số, để tránh cấp nhầm khi lỡ tay bấm.
- **Đổi giao diện** (`public/counter/widget/index.html`): 3 nút không còn chữ, thay bằng 3 icon
  emoji nhỏ gọn — 🧑🏻 (đối tượng thường), 👴🏻 (ưu tiên ≥ 75 tuổi), 👶🏻 (ưu tiên dưới 6 tuổi) — kích
  thước đưa về đúng bằng các nút icon vuông khác trên widget (26×26px, giống `#actions button`).
  Không tô nền màu đặc như trước (dễ làm icon bị nhem màu) mà đổi sang viền màu (`border`) theo đúng
  màu của từng đối tượng (xám/cam/xanh cyan) để vẫn phân biệt nhanh được nút nào ứng với đối tượng
  nào, cả ở chế độ hiển thị ngang lẫn dọc (mục 49).
- **Thêm bước xác nhận** (`public/counter/widget/widget.js`, hàm `quickIssueTicket()`): trước khi
  gọi API cấp số, giờ hiện 1 hộp thoại `confirm()` dạng "Xác nhận cấp NHANH 1 số "<tên đối tượng>"
  (không cần xác thực)?" — bấm Hủy (Cancel) thì dừng lại luôn, không gọi API/không in gì cả (chỉ mở
  khóa 3 nút lại). Vì `confirm()` là hộp thoại MODAL (chặn toàn bộ tương tác khác trên cửa sổ cho
  tới khi trả lời), bước này còn là **thêm 1 lớp chống spam nữa**, ngoài khóa dùng chung
  `quickIssueBusy` đã có ở mục 52 (khóa này vẫn được bật/tắt bao trùm luôn cả bước xác nhận, không
  chỉ riêng lúc gọi API).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js` sau khi sửa — không có lỗi cú
  pháp; đã kiểm tra lại `index.html` có đúng 3 icon emoji mới và cấu trúc 3 nút không đổi id/hàm gọi
  (`quickIssueNormal`/`quickIssueAge75`/`quickIssueChild6`, đều vẫn gọi `quickIssueTicket(...)`).
- Chưa thể tự xem/bấm thử trên Windows thật để kiểm tra icon emoji hiển thị đúng kiểu ảnh (một số
  phông chữ Windows cũ có thể hiển thị emoji dạng đen trắng thay vì màu, tùy phiên bản hệ điều hành)
  và xác nhận luồng hộp thoại xác nhận hoạt động mượt (môi trường hiện tại là Linux) — nhờ người
  dùng cập nhật ứng dụng widget rồi thử bấm từng nút, xác nhận thấy đúng 3 icon người/người già/em
  bé, có hộp thoại hỏi xác nhận trước khi cấp số, và bấm Hủy thì không có số nào bị cấp ra.

## 54. Đổi 3 nút cấp số nhanh thành chữ BT/NG/TE cỡ chữ rất nhỏ, thu nhỏ số đang phục vụ, và xử lý khi hết phiên đăng nhập

- **Yêu cầu**: "Điều chỉnh widget 3 nút icon cấp số tt nhanh thành Nút BT,NG,TE font size phải thật
  nhỏ. Điều chỉnh STT tiếp nhận Widget nhỏ lại để k chiếm diện tích chiều ngang. Điều chỉnh widget 3
  nút icon cấp số tt nhanh nếu ko có phiên đăng nhập thì xác nhận logout để đăng nhập lại thay vì
  cảnh báo lỗi".
- **3 nút cấp số nhanh đổi từ emoji (mục 53) sang chữ viết tắt** (`public/counter/widget/index.html`):
  "BT" (Bình Thường = mã `NORMAL`), "NG" (Người Già = mã `AGE75`, ưu tiên ≥ 75 tuổi), "TE" (Trẻ Em =
  mã `CHILD6`, ưu tiên dưới 6 tuổi) — cỡ chữ giảm mạnh xuống còn **8px** (nhỏ hơn nhiều so với chữ
  trên các nút khác của widget) để 2 ký tự vẫn vừa gọn trong khung nút vuông 26×26px sẵn có, không bị
  tràn. Vẫn giữ viền màu ngoài (xám/cam/xanh cyan) theo đúng màu từng đối tượng như mục 53.
- **Thu nhỏ số đang phục vụ** (`#sttNumber`): giảm cỡ chữ từ 18px xuống **13px** và giảm bề rộng tối
  thiểu (`min-width`) từ 30px xuống **20px** — vẫn đủ hiện 3 chữ số, nhưng chiếm ít bề ngang hơn, để
  dành thêm chỗ cho các cụm nút/số lượng chờ khác trên cùng 1 dòng ngang duy nhất của widget.
- **Xử lý khi hết phiên đăng nhập** (`public/counter/widget/widget.js`, hàm mới
  `handleQuickIssueUnauthorized()`): trước đây khi API `/api/tickets/staff` trả về 401 (chưa đăng
  nhập/hết phiên), widget chỉ hiện 1 dòng cảnh báo ngắn tự biến mất, không có hành động tiếp theo nào
  rõ ràng cho nhân viên. Nay thay bằng 1 hộp thoại xác nhận: "Phiên đăng nhập nhân viên đã hết hạn
  (hoặc chưa đăng nhập). Đăng xuất ngay để mở màn hình đăng nhập lại?" — nếu đồng ý, widget tự gọi
  `POST /api/auth/staff-logout` (xoá cookie `staff_token`, giống hệt `staffLogout()` trong
  `/counter/counter.js`) rồi gọi `openSettings()` để mở thẳng màn hình quản lý đầy đủ (`/counter/`) —
  màn hình đó sẽ tự chuyển sang trang đăng nhập vì cookie vừa bị xoá (theo đúng cơ chế gate có sẵn ở
  `src/server.js`), để nhân viên đăng nhập lại ngay mà không cần tự tìm đường vào trang đăng nhập.
  Nếu bấm Hủy thì không làm gì thêm (không cấp số, không đăng xuất).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js` sau khi sửa — không có lỗi cú
  pháp; đã kiểm tra lại route `POST /api/auth/staff-logout` tồn tại sẵn trong `src/routes/auth.js`
  (không cần sửa gì phía máy chủ).
- Chưa thể tự xem/bấm thử trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng cập nhật
  ứng dụng widget rồi kiểm tra: (1) 3 nút BT/NG/TE hiện chữ nhỏ gọn, không bị tràn khỏi nút; (2) số
  đang phục vụ nhỏ lại, widget không bị rộng thêm ra; (3) khi phiên đăng nhập hết hạn (ví dụ đợi quá
  thời gian hoặc xoá cookie thủ công) rồi bấm 1 trong 3 nút cấp số nhanh, xác nhận thấy hộp thoại hỏi
  đăng xuất hiện ra thay vì chỉ 1 dòng cảnh báo, và đồng ý thì màn hình đăng nhập tự mở ra.

## 55. Thêm chức năng "Xem số đã gọi" ở màn hình /counter/ + kiểm tra hành vi STT khi vượt 999/qua ngày

- **Yêu cầu 1**: "Thêm mới ở màn hình http://localhost:4000/counter/ bổ sung thêm chức năng xem các
  số đã gọi của các quầy".
- **Đã thêm 1 nút + 1 modal mới** ở màn hình `/counter/` (`public/counter/index.html`), đặt ngay
  cạnh nút "Xem DS bỏ qua" đã có sẵn — icon đồng hồ, tiêu đề "Xem số đã gọi (tất cả các quầy)". Bấm
  vào hiện danh sách **toàn bộ số đã từng được gọi trong hôm nay, của TẤT CẢ các quầy** (không chỉ
  quầy đang đăng nhập), mới gọi gần nhất hiển thị lên đầu — mỗi dòng gồm: số thứ tự (tô màu theo đối
  tượng ưu tiên), tên bệnh nhân (nếu có), quầy nào đã gọi, giờ gọi, và **trạng thái hiện tại**: "Đang
  phục vụ" (xanh dương)/"Đã xong" (xanh lá)/"Bị bỏ qua" (cam). Danh sách tự làm mới ngay khi có quầy
  bất kỳ gọi/bỏ qua/hoàn tất số mới (dùng lại sự kiện socket `queue:summary` đã phát sẵn ở mọi hành
  động gọi số, giống cách modal "DS bỏ qua" đã làm).
- **Phía máy chủ**: thêm hàm `getCalledTickets(db, day)` trong `src/services/ticketService.js`
  (truy vấn `tickets` theo điều kiện `called_at IS NOT NULL` — KHÔNG lọc theo `status`, vì 1 vé sau
  khi gọi có thể chuyển tiếp sang `done`/`skipped` nhưng vẫn giữ nguyên `called_at` của lần gọi, nên
  vẫn phải xuất hiện trong lịch sử "đã gọi") và route mới `GET /api/counters/called-list`
  (`src/routes/counters.js`) trả về kèm mã/tên quầy — theo đúng khuôn mẫu của route `/skipped-list`
  đã có sẵn, không cần đổi cấu trúc dữ liệu nào khác.
- **Yêu cầu 2 (kiểm tra, không phải sửa)**: "Kiểm tra lại giúp tôi nếu trong ngày stt tiếp nhận
  >999 số thì có tự động cấp số 001 không, qua ngày thì vẫn về 001". Đã đọc kỹ
  `src/services/sequenceService.js` (hàm `getNextTicketNumber()`, dùng 1 bảng `seq` khoá theo ngày,
  mỗi lần cấp số thì `seq = seq + 1`) và kết quả là:
  - **Qua ngày mới**: **CÓ**, tự động về lại **001** — đã đúng như mong đợi. Khoá của bảng `seq` là
    `day` (định dạng `YYYY-MM-DD`, hàm `todayKey()`), nên sang ngày mới sẽ tạo 1 dòng đếm HOÀN TOÀN
    MỚI bắt đầu từ 1, không liên quan gì đến số của ngày hôm trước.
  - **Trong CÙNG 1 ngày, vượt quá 999**: **KHÔNG** tự động quay về 001 — bộ đếm cứ tăng dần liên
    tục, không giới hạn (số thứ 1000 sẽ là **1000**, không phải 001, số 1001 tiếp theo, v.v.), vì
    trong code hiện tại không có bất kỳ chỗ nào giới hạn/lấy phần dư (mod 1000) cho bộ đếm này. Các
    chỗ hiển thị số (`String(ticket.number).padStart(3, '0')`) chỉ **thêm số 0 ở đầu** cho đủ tối
    thiểu 3 chữ số khi số còn nhỏ hơn 100 — hàm này KHÔNG cắt bớt số lớn hơn 999, nên nếu vượt mốc
    đó, màn hình/phiếu in sẽ tự hiện đủ **4 chữ số** (ví dụ "1000") thay vì quay vòng lại "001".
  - **Đây chỉ là kết quả kiểm tra thực tế của code hiện tại**, tôi CHƯA tự ý sửa gì ở phần này — nếu
    muốn STT tự quay vòng về 001 sau khi đạt 999 trong cùng 1 ngày (ví dụ để khớp với máy in/màn
    hình chỉ có chỗ hiển thị đúng 3 chữ số), xin cho biết để tôi bổ sung logic quay vòng (ví dụ dùng
    phép chia dư, số 001 sẽ lặp lại sau 999 — cần cân nhắc kỹ khả năng trùng STT với số cũ trong
    cùng ngày nếu lượng khách thực tế vượt 999 người/ngày).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `ticketService.js`, `counters.js`,
  `counter.js` sau khi sửa — không có lỗi cú pháp; kiểm tra cân bằng thẻ `<div>`/`</div>` trong
  `index.html` sau khi thêm modal mới (45 mở / 45 đóng, khớp nhau).
- Chưa thể tự bấm thử trên trình duyệt thật với dữ liệu thật (môi trường hiện tại là Linux, không
  chạy được server + trình duyệt đầy đủ ở đây) — nhờ người dùng mở `/counter/`, đăng nhập 1 quầy bất
  kỳ, gọi vài số (kể cả bỏ qua 1 số), rồi bấm nút "Xem số đã gọi" mới — xác nhận thấy đúng danh sách
  số vừa gọi, đúng quầy, đúng giờ, đúng trạng thái, và tự cập nhật khi có quầy khác gọi số mới trong
  lúc modal đang mở.

## 56. Đổi cảnh báo "Không còn số nào đang chờ" (các nút gọi số trên widget) thành hộp thoại phải bấm mới đóng

- **Yêu cầu**: "widget điều chỉnh cảnh báo không còn số nào đang chờ của tất cả các nút gọi số trên
  widget điều chỉnh thành confirm được không ạ".
- **Trước đây**: khi bấm 1 trong các nút gọi số trên widget (`public/counter/widget/widget.js`) mà
  hàng chờ đã hết, hệ thống chỉ hiện 1 dòng cảnh báo nhỏ ở khay trạng thái (`showStatus()`) — **tự
  biến mất sau 2.5 giây** — nhân viên bấm nhanh có thể không kịp nhìn thấy/bỏ lỡ thông báo này.
- **Đã đổi sang hộp thoại MODAL** (hàm mới `confirmNoWaitingTicket()`), **bắt buộc phải bấm OK mới
  đóng được**, áp dụng cho **toàn bộ các nút gọi số** trên widget:
  - Nút "Gọi số tiếp theo" (`callNext()`).
  - Các nút gọi riêng theo từng đối tượng ưu tiên trong cụm số lượng chờ (`callNextByPriority()`).
  - Nút "Bỏ qua" (`skip()`) — không cần sửa riêng vì hàm này **tự gọi lại `callNext()`** ngay sau
    khi bỏ qua, nên đã tự động được áp dụng cùng thay đổi trên.
  - Nút "Gọi lại" (`reCall()`) không có tình huống "hết hàng chờ" (chỉ đọc lại đúng số hiện tại
    đang phục vụ) nên không liên quan tới thay đổi này.
- **Ghi chú kỹ thuật nhỏ**: dùng `alert()` (chỉ có nút OK) thay vì `confirm()` (có thêm nút Huỷ) —
  vì đây thuần tuý là 1 THÔNG BÁO ("hết số chờ"), không có 1 hành động thay thế nào để chọn khi bấm
  Huỷ cả, nên dùng `confirm()` sẽ thừa 1 nút không có tác dụng gì. Tên hàm vẫn đặt là
  `confirmNoWaitingTicket()` cho khớp với cách gọi "confirm" trong yêu cầu — về hành vi hiển thị
  (hộp thoại modal, chặn thao tác khác, phải bấm mới đóng được) thì giống hệt những gì bạn mô tả.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js` sau khi sửa — không có lỗi cú
  pháp.
- Chưa thể tự bấm thử trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng cập nhật
  ứng dụng widget rồi thử: gọi hết toàn bộ số đang chờ trong ngày (hoặc test lúc hàng chờ trống),
  bấm "Gọi số tiếp theo" hoặc 1 nút gọi theo đối tượng cụ thể — xác nhận thấy hộp thoại thông báo
  hiện lên VÀ đứng yên cho tới khi tự bấm OK, thay vì chỉ 1 dòng chữ tự biến mất như trước.

## 57. Sửa cửa sổ "Đổi địa chỉ máy chủ" bị kẹt sát cạnh phải màn hình khi widget đang ở chế độ dọc

- **Người dùng báo**: "Điều chỉnh widget - Đổi địa chỉ máy chủ khi widget nó đang chiều dọc nó bị
  kẹt ở màn hình bên phải. bạn cứ đưa nó vào giữa là xong".
- **Nguyên nhân**: `createServerUrlPrompt()` (`electron-widget/main.js`) tạo cửa sổ nhỏ "Đổi địa
  chỉ máy chủ" (440×220) **không truyền sẵn toạ độ x/y** — mặc định Electron sẽ tự "canh giữa" cửa
  sổ con dựa theo vị trí/kích thước của `parent` (chính là `widgetWindow`). Ở chế độ hiển thị dọc
  (mục 49), widget rất hẹp (chỉ 54px) và **mặc định nằm sát cạnh PHẢI màn hình** (xem
  `defaultWidgetBounds()`) — nên Electron tính "canh giữa" theo 1 `parent` hẹp + nằm sát lề như vậy
  bị lệch hẳn sang phải, trông như cửa sổ bị "kẹt" ở cạnh phải màn hình thay vì nằm chính giữa thật
  sự (ở chế độ ngang, widget cũng nằm góc trên-phải nhưng độ hẹp không đáng kể như chiều dọc nên ít
  bị lệch rõ rệt).
- **Đã sửa**: `createServerUrlPrompt()` giờ **tự tính sẵn toạ độ x/y** để canh đúng CHÍNH GIỮA màn
  hình đang chứa widget (dùng `screen.getDisplayMatching(widgetWindow.getBounds())` để xác định
  đúng màn hình, phòng trường hợp máy có nhiều màn hình và widget đang đặt ở màn phụ; nếu vì lý do
  gì đó chưa xác định được thì dùng màn hình chính `screen.getPrimaryDisplay()`), rồi truyền thẳng
  `x`/`y` đó vào lúc tạo `BrowserWindow` — không còn phụ thuộc vào cách Electron tự canh giữa theo
  `parent` nữa, nên không bị ảnh hưởng bởi việc widget đang hẹp/nằm sát lề ở chế độ dọc.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp.
- Chưa thể tự bật thử trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng cập nhật
  ứng dụng widget rồi thử: bật chế độ hiển thị dọc (mục 49), bấm chuột phải icon khay hệ thống →
  "Đổi địa chỉ máy chủ..." — xác nhận cửa sổ nhỏ hiện ra đúng CHÍNH GIỮA màn hình thay vì kẹt sát
  cạnh phải như trước.

## 58. Bổ sung đủ 5 nút cấp nhanh STT còn thiếu (đủ 8/8 đối tượng ưu tiên)

- **Yêu cầu**: "widget bổ sung thêm 5 nút cấp nhanh stt tiếp nhận còn thiếu được không ạ".
- Mục 52-54 mới làm 3 nút cấp số nhanh (BT/NG/TE, ứng với `NORMAL`/`AGE75`/`CHILD6`) trong khi hệ
  thống có tổng cộng **8 đối tượng** (`src/config/priorityRules.js`) — nay bổ sung đủ **5 nút còn
  thiếu**:
  - **CC** — Cấp cứu (`EMERGENCY`, viền đỏ đậm `#dc2626`)
  - **PN** — Phụ nữ có thai (`PREGNANT`, viền hồng `#f472b6`)
  - **KĐ** — Khuyết tật đặc biệt nặng (`DISAB_EXTREME`, viền hồng đỏ `#fb7185`)
  - **KT** — Khuyết tật nặng (`DISAB_SEVERE`, viền vàng gold `#eab308`)
  - **CM** — Có công với cách mạng (`MERIT_BHYT`, viền tím `#a78bfa`)

  Giữ nguyên đúng phong cách 3 nút cũ (mục 54): chữ viết tắt 2 ký tự, font-size 8px thật nhỏ, viền
  màu lấy đúng theo màu của từng đối tượng trong `priorityRules.js` để không nhầm với các nút khác.
  Vậy là widget hiện có đủ **8/8 nút cấp số nhanh** (`public/counter/widget/index.html`).
- **Khoá chống spam + hộp thoại xác nhận (mục 53/56)** mở rộng áp dụng đúng cho cả 8 nút, không chỉ
  3 nút cũ: `public/counter/widget/widget.js` gom danh sách 8 nút vào 1 mảng
  `QUICK_ISSUE_BTN_KEYS`, hàm `setQuickIssueButtonsDisabled()` dùng mảng này để khoá/mở khoá ĐỒNG
  THỜI CẢ 8 NÚT — bấm bất kỳ nút nào trong 8 nút thì 7 nút còn lại cũng bị vô hiệu hoá ngay, đúng
  tinh thần chống spam ban đầu ("1 icon đang nhấn thì các icon còn lại không được phép spam") chỉ là
  mở rộng ra đủ 8 nút thay vì 3. Hàm `quickIssueTicket(priorityCode)` không cần sửa gì (đã viết
  tổng quát theo `priorityCode` truyền vào từ trước, dùng chung được cho mọi đối tượng).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `widget.js` sau khi sửa — không có lỗi cú
  pháp; kiểm tra lại `index.html` có đủ 8 nút với đúng id, không trùng/thiếu id nào.
- **Lưu ý về bề ngang widget ở chế độ hiển thị NGANG (mặc định)**: 8 nút x 26px + khoảng cách chiếm
  thêm khá nhiều chỗ so với trước (chỉ 3 nút) — cụm số lượng đang chờ (`#queueCounts`) đã được thiết
  kế co giãn/tự cuộn nên vẫn không vỡ layout, nhưng có thể bị co lại rất hẹp nếu cửa sổ widget đang
  để ở bề rộng mặc định/nhỏ. Nếu thấy chật, có thể kéo rộng thêm cửa sổ widget theo chiều ngang, hoặc
  chuyển sang **chế độ hiển thị dọc** (mục 49, menu khay hệ thống → "Hiển thị widget theo chiều
  dọc") — ở chế độ dọc các nút tự xếp thành cột nên không bị chật ngang.
- Chưa thể tự bấm thử trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng cập nhật
  ứng dụng widget rồi thử: xác nhận đủ 8 nút CC/BT/NG/TE/PN/KĐ/KT/CM hiện ra đúng thứ tự, đúng màu
  viền, cấp số đúng đối tượng tương ứng, và khoá chống spam vẫn hoạt động đúng khi bấm dồn dập giữa
  8 nút (không chỉ riêng 3 nút cũ).

## 59. Widget chế độ NGANG: các nút không còn tự động co lại nữa (chuyển sang cuộn ngang)

- **Yêu cầu**: "điều chỉnh giao diện widget ngang k tự động co lại các nút".
- **Nguyên nhân**: sau khi mục 58 bổ sung đủ 8 nút cấp số nhanh, tổng bề rộng nội dung của widget
  (mã quầy + số đang phục vụ + 3 nút gọi số + 8 nút cấp số nhanh + các nút khác + cụm số lượng chờ)
  tăng lên đáng kể. Trước đây khi tổng bề rộng đó vượt quá bề rộng cửa sổ widget đang có (ví dụ cửa
  sổ đang để ở kích thước mặc định/nhỏ), phần nội dung dư ra bị **ẩn mất (clip)** bởi
  `overflow: hidden` của `html`/`body` — nhìn giống như các nút bị "cắt/co lại" ở mép phải, dù thực
  tế các nút KHÔNG hề bị bóp nhỏ kích thước thật.
- **Đã sửa** (`public/counter/widget/index.html`): cho chính `#mainView` (thanh ngang chính của
  widget) **tự cuộn ngang được** khi nội dung rộng hơn cửa sổ — dùng đúng kỹ thuật đã áp dụng sẵn
  cho `#queueCounts` trước đây (ẩn luôn thanh cuộn cho gọn, vẫn cuộn được bằng chuột/trackpad). Nhờ
  vậy **mọi nút luôn giữ đúng kích thước thật** (26×26px hoặc kích thước riêng của từng nút), không
  bao giờ bị bóp nhỏ/cắt mất nữa — nếu cửa sổ đang hẹp thì chỉ cần cuộn ngang (hoặc kéo rộng cửa sổ
  ra, hoặc chuyển sang **chế độ hiển thị dọc** ở mục 49) để xem hết các nút còn lại.
  - Đồng thời đổi `#queueCounts` (cụm số lượng chờ theo đối tượng) từ tự co giãn + tự cuộn RIÊNG
    (`flex: 1 1 auto` kèm `overflow-x: auto` của chính nó) sang giữ nguyên kích thước thật
    (`flex: 0 0 auto`) — vì việc cuộn ngang khi thiếu chỗ giờ đã chuyển lên cho `#mainView` lo
    chung, tránh tình trạng "cuộn lồng trong cuộn" (2 lớp cuộn ngang lồng nhau, dễ gây khó chịu khi
    thao tác chuột/trackpad).
  - **Riêng chế độ hiển thị DỌC (mục 49) không bị ảnh hưởng**: đã thêm quy tắc CSS riêng để giữ
    nguyên hành vi cũ ở chế độ dọc — `#mainView` không cuộn ngang (không cần thiết vì mọi thứ đã xếp
    theo cột), và `#queueCounts` vẫn tự co giãn + tự cuộn DỌC riêng như trước (khôi phục lại
    `flex: 1 1 auto` chỉ trong phạm vi chế độ dọc) để vẫn hiển thị gọn đủ tối đa 8 đối tượng mà
    không làm khung widget dọc quá cao.
- **Đã kiểm chứng bằng công cụ**: kiểm tra số dấu `{`/`}` trong khối `<style>` và số thẻ
  `<div>`/`</div>` của `index.html` sau khi sửa — đều cân bằng, không lệch; `widget.js` không đổi gì
  nên vẫn `node --check` sạch như trước.
- Chưa thể tự xem/kéo thử cửa sổ trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng
  cập nhật ứng dụng widget rồi thử: để cửa sổ widget (chế độ ngang) ở bề rộng mặc định/nhỏ, xác nhận
  các nút KHÔNG còn bị bóp nhỏ/cắt cụt nữa — thay vào đó có thể cuộn ngang (lăn chuột giữ Shift,
  hoặc vuốt ngang trên trackpad) để xem hết các nút còn lại; đồng thời kiểm tra chế độ hiển thị dọc
  vẫn hoạt động đúng như trước (không bị ảnh hưởng bởi thay đổi này).

## 60. Tăng bề rộng tối thiểu cho phép resize của widget chế độ ngang (theo ảnh chụp lỗi bị bóp/chồng nút)

- **Người dùng gửi ảnh** cho thấy thanh widget ngang bị lỗi hiển thị (các icon bị bóp/chồng lên
  nhau, nhìn rối) khi thu nhỏ cửa sổ, và làm rõ thêm: "Ý là widget ngang nó đang k có giới hạn đó" —
  ý là bề rộng tối thiểu (min width) cho phép kéo/resize cửa sổ widget hiện đang quá nhỏ so với
  lượng nội dung thực tế bây giờ (đặc biệt sau khi mục 58 bổ sung đủ 8 nút cấp số nhanh), khiến widget
  vẫn có thể bị kéo xuống một kích thước quá chật để hiển thị đẹp.
- **Đã tìm ra**: `electron-widget/main.js` giới hạn bề rộng tối thiểu cho phép kéo cửa sổ widget
  (chế độ ngang) qua hằng số `WIDGET_MIN_SIZE` — trước đó là **340px**, được đặt ra từ trước khi có
  8 nút cấp số nhanh (mục 58), nên nay đã quá chật: dù mục 59 đã cho thanh chính tự cuộn ngang (không
  còn vỡ layout/chồng chéo về mặt kỹ thuật), nhưng ở đúng 340px thì ngay cả CỤM THÔNG TIN CHÍNH LUÔN
  CẦN HIỂN THỊ SẴN (mã quầy, số đang phục vụ, 3 nút gọi số chính) cũng đã bị chật/khó nhìn, không có
  khoảng dư nào — trải nghiệm giống như "không có giới hạn thật sự" theo đúng ý bạn phản ánh.
- **Đã sửa**: tăng `WIDGET_MIN_SIZE` từ `{ width: 340, height: 36 }` lên **`{ width: 420, height: 40
  }`** — bề rộng tối thiểu giờ đủ chỗ để cụm thông tin chính (mã quầy/số đang phục vụ/3 nút gọi số)
  luôn hiển thị THOẢI MÁI không cần cuộn, chỉ phần còn lại (các nút cấp số nhanh ở xa hơn/cụm số
  lượng chờ) mới cần cuộn ngang khi cửa sổ đang để nhỏ hơn mức mặc định (480px) — kết hợp cùng cơ chế
  cuộn ngang đã làm ở mục 59 để đảm bảo KHÔNG BAO GIỜ còn cảnh bóp/chồng icon nữa, dù người dùng kéo
  cửa sổ xuống mức nhỏ nhất được phép. Chiều cao tối thiểu cũng tăng nhẹ (36 → 40px) để khớp đúng
  chiều cao cố định của thanh chính, tránh bị cắt mất 1‑2px phía dưới ở kích thước tối thiểu.
- Giới hạn này chỉ áp dụng cho chế độ hiển thị **NGANG** — chế độ hiển thị **DỌC** (mục 49) dùng 1
  cặp hằng số riêng (`WIDGET_MIN_SIZE_VERTICAL`, không đổi) nên không bị ảnh hưởng.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `main.js` sau khi sửa — không có lỗi cú pháp.
- Chưa thể tự kéo thử cửa sổ trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng cập
  nhật ứng dụng widget rồi thử: kéo cửa sổ widget (chế độ ngang) xuống nhỏ nhất có thể — xác nhận
  không kéo được nhỏ hơn mức mới (rộng hơn hẳn so với trước), và ở đúng kích thước tối thiểu đó, cụm
  thông tin chính vẫn hiển thị gọn gàng không bị bóp/chồng lên nhau như trong ảnh đã gửi.

## 61. Widget chế độ NGANG: phân nhóm rõ ràng các cụm nút, "bắt chước" cách trình bày của chế độ DỌC

- **Người dùng gửi ảnh so sánh** widget chế độ dọc (rõ ràng, từng nhóm tách bạch, đã ưng ý — "nó đã
  ok rồi") với widget chế độ ngang (các nhóm nút dính liền vào nhau thành 1 dải khó phân biệt) và
  yêu cầu: "widget ngang hãy bắt chước widget dọc. đừng chỉnh widget dọc nhé vì nó đã ok rồi".
- **Phân tích khác biệt**: ở chế độ dọc, mỗi nhóm nút (gọi số / các icon phụ / 8 nút cấp số nhanh /
  số lượng chờ) được xếp **MỖI NHÓM 1 KHỐI RIÊNG theo cột** (trên xuống dưới), nên tự nhiên tách
  bạch rõ ràng, dễ nhìn — còn ở chế độ ngang, do TẤT CẢ gộp chung vào ĐÚNG 1 HÀNG duy nhất nên các
  nhóm bị "dính" sát vào nhau, đường phân cách (`.sep-line`, chỉ dày 1px, màu tối) gần như không
  nhìn thấy, khiến người dùng khó phân biệt đâu là nhóm nút gọi số, đâu là nhóm cấp số nhanh, đâu là
  số lượng chờ.
- **Đã điều chỉnh RIÊNG cho chế độ NGANG** (`public/counter/widget/index.html`, dùng bộ chọn CSS
  `html:not(.vertical) ...` để đảm bảo **không đụng đến bất kỳ quy tắc nào của chế độ dọc**):
  - Vạch ngăn cách (`.sep-line`) giữa các nhóm nút giờ **đậm và sáng hơn hẳn** (từ 1px màu
    `#334155` gần như vô hình → 2px màu `#475569`, có thêm khoảng cách ngang 2 bên) — nhìn ra ranh
    giới giữa các nhóm ngay lập tức, giống tinh thần "mỗi nhóm 1 khối" của chế độ dọc.
  - Cụm 8 nút "Cấp số nhanh" (`#quickIssueActions`) và cụm số lượng đang chờ theo đối tượng
    (`#queueCounts`) mỗi cụm được **đóng khung riêng** (nền tối `#0b1220`, viền mảnh, bo góc) — 2
    cụm này trước đây nằm sát cạnh nhau, đều dùng nhiều màu sắc nên rất dễ nhầm lẫn ranh giới; nay
    mỗi cụm là 1 "khối" rõ ràng, tách bạch hẳn với các nút/cụm bên cạnh.
  - 8 nút cấp số nhanh (chữ BT/NG/TE/...) đổi từ ô vuông cố định 26×26px sang **tự co giãn theo bề
    rộng chữ + có đệm 2 bên** (vẫn giữ đúng font-size 8px thật nhỏ theo yêu cầu ở mục 54) — chữ đỡ
    bị "khít" sát viền như trước, đỡ cảm giác chật chội.
  - Tăng nhẹ khoảng cách giữa các phần tử trên thanh ngang (`gap` 5px → 6px) và chiều cao thanh
    chính (38px → 40px, khớp đúng với chiều cao tối thiểu cửa sổ mới ở mục 60) để có thêm chút
    khoảng thở.
- **Chế độ hiển thị DỌC hoàn toàn không đổi gì** — đã rà lại toàn bộ các quy tắc mới thêm, tất cả
  đều được bọc trong `html:not(.vertical)` nên chỉ có hiệu lực khi widget đang ở chế độ ngang.
- **Đã kiểm chứng bằng công cụ**: kiểm tra số dấu `{`/`}` và số thẻ `<div>`/`</div>` trong
  `index.html` sau khi sửa — vẫn cân bằng, không lệch (70 mở/70 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ
  div); không đổi gì ở `widget.js` nên không cần chạy lại `node --check`.
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng cập nhật
  ứng dụng widget rồi thử: xác nhận ở chế độ ngang giờ nhìn RÕ RÀNG từng nhóm nút (có khung/vạch
  phân cách rõ), gần với cảm giác gọn gàng của chế độ dọc hơn, đồng thời xác nhận chế độ dọc vẫn y
  nguyên như trước, không bị ảnh hưởng gì.

## 62. Chống mất nội dung khi thu quá nhỏ (widget ngang) + đổi toàn bộ phong cách sang trắng/xanh dương y tế

- **Người dùng gửi ảnh** cho thấy khi thu nhỏ cửa sổ widget ngang quá mức, nội dung gần như biến
  mất (chỉ còn 1 dải rất mỏng, mờ), kèm yêu cầu thứ 2: "Điều chỉnh phong cách của widget thành màu
  trắng, xanh dương ngành y tế k được phép đen tối ạ".
- **Về việc mất nội dung khi thu quá nhỏ**:
  - Mục 60 đã tăng chiều cao tối thiểu cho phép kéo lên 40px (khớp đúng chiều cao cố định của
    `#mainView`) — nay tăng thêm 1 chút dự phòng lên **44px** (`WIDGET_MIN_SIZE` trong
    `electron-widget/main.js`) để chắc chắn không còn sai số làm hụt 1-2px viền/bo góc.
  - **Lưu ý quan trọng đã ghi rõ trong code**: giới hạn kích thước tối thiểu là thuộc tính NATIVE
    của cửa sổ, được Electron áp dụng **NGAY LÚC TẠO cửa sổ widget** — nếu ứng dụng widget đang MỞ
    SẴN từ TRƯỚC KHI cập nhật lên bản có giá trị mới này, giới hạn CŨ vẫn còn hiệu lực cho tới khi
    **THOÁT HẲN và MỞ LẠI ứng dụng** (không phải chỉ kéo/thả lại cửa sổ, và cũng không phải chỉ tắt
    rồi bật lại widget qua khay hệ thống nếu tiến trình chính chưa thoát hẳn) — đây rất có thể là lý
    do ảnh chụp cho thấy vẫn kéo được nhỏ xíu dù đã cập nhật.
- **Về đổi phong cách màu sắc**: đã đổi TOÀN BỘ bảng màu của widget (`public/counter/widget/index.html`)
  từ nền tối (xanh navy đậm `#0f172a`, chữ sáng màu) sang **nền trắng, điểm nhấn xanh dương** đúng
  phong cách thường thấy ở ứng dụng ngành y tế — áp dụng ĐỒNG NHẤT cho **cả 2 chế độ** hiển thị
  (ngang và dọc), vì đây là thay đổi về MÀU SẮC toàn widget chứ không phải bố cục/kích thước (khác
  với các yêu cầu trước chỉ áp dụng riêng 1 chế độ):
  - Khung widget (`#card`): nền trắng (`#ffffffee`, còn hơi trong để vẫn nổi bật trên desktop),
    viền xanh dương nhạt, chữ mặc định đổi sang xanh navy đậm (`#1e3a5f`) dễ đọc trên nền trắng.
  - Mã quầy (`#counterTag`): nền xanh dương rất nhạt, chữ xanh dương đậm (trước đây nền tối, chữ
    xanh nhạt).
  - Số đang phục vụ (`#sttNumber`): màu mặc định đổi từ vàng gold sang xanh dương đậm — đồng thời
    cập nhật luôn màu mặc định tương ứng trong `widget.js` (`renderTicket()`) để nhất quán.
  - Các vạch ngăn cách (`.sep-line`), khung nhóm "Cấp số nhanh"/"Số lượng chờ" (mục 61): đổi từ nền/
    viền tối sang xanh dương nhạt (`#eff6ff`/`#bfdbfe`).
  - 8 nút "Cấp số nhanh": nền trắng, chữ xanh navy đậm, viền màu theo từng đối tượng như cũ — một
    vài màu viền quá nhạt/pastel trên nền tối trước đây (ví dụ xanh cyan `#38bdf8`, vàng gold
    `#eab308`, tím `#a78bfa`) được **chỉnh đậm hơn 1 chút** (`#0ea5e9`, `#ca8a04`, `#8b5cf6`) để vẫn
    đủ tương phản, dễ đọc trên nền trắng mới — vẫn giữ đúng tông màu gốc, chỉ đậm hơn.
  - Các nút icon phụ (màn hình bệnh nhân/đăng xuất/kiosk nhân viên/thứ tự ưu tiên/DS bỏ qua): đổi
    màu icon mặc định sang xanh dương, khi rê chuột nền sáng xanh nhạt thay vì nền tối; riêng nút
    đăng xuất khi rê chuột đổi sang tông đỏ cảnh báo NHẠT (nền đỏ nhạt, chữ đỏ đậm) thay vì đỏ trên
    nền tối như trước.
  - Khay thông báo trạng thái (`#statusToast`): nền đỏ nhạt, chữ đỏ đậm (rõ nghĩa cảnh báo) thay vì
    nền tối/chữ đỏ nhạt như trước.
  - 3 nút gọi số chính (Gọi tiếp theo/Gọi lại/Bỏ qua) **giữ nguyên** màu xanh dương/xanh lá/cam đã
    có — đây là màu chức năng phân biệt hành động, không phải "nền tối", vẫn phù hợp với phong cách
    mới.
- **Đã kiểm chứng bằng công cụ**: kiểm tra số dấu `{`/`}` và số thẻ `<div>`/`</div>` trong
  `index.html` sau khi sửa — vẫn cân bằng (70 mở/70 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div);
  `node --check` trên `widget.js` và `main.js` — không có lỗi cú pháp.
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux) — nhờ người dùng **thoát hẳn
  và mở lại ứng dụng widget** (bắt buộc, để áp dụng đúng giới hạn kích thước mới) rồi thử: (1) kéo
  cửa sổ ngang xuống nhỏ nhất, xác nhận không còn bị mất/mờ nội dung; (2) xác nhận toàn bộ widget
  (cả 2 chế độ ngang và dọc) giờ theo tông trắng/xanh dương, không còn mảng nền tối nào.

## 63. Widget chế độ DỌC: mã quầy (Q01) chưa canh giữa

- **Yêu cầu của người dùng (nguyên văn)**: "ok rồi. widget dọc mã quầy Q01 chưa canh giữa".
- **Hiện trạng trước khi sửa**: `public/counter/widget/index.html` có sẵn quy tắc
  `html.vertical #counterTag, html.vertical #sttNumber { text-align: center; }`, và
  `html.vertical #mainView { align-items: stretch; ... }` (bố cục cột dọc, các item được "stretch"
  hết chiều ngang container theo lý thuyết Flexbox). Về mặt lý thuyết CSS, `#counterTag` là flex
  item của `#mainView` nên đáng lẽ đã tự giãn hết bề rộng và `text-align: center` sẽ có tác dụng —
  nhưng người dùng xác nhận trên máy thật (Windows) mã quầy "Q01" vẫn KHÔNG canh giữa.
- **Nguyên nhân nhiều khả năng nhất**: `#counterTag` vốn là thẻ `<span>` (mặc định `display: inline`
  trong HTML/CSS). Dù là flex item, hành vi "stretch" ngầm định của trình duyệt đôi khi không đủ
  tin cậy 100% trên mọi engine/phiên bản render — có trường hợp trình duyệt vẫn tính bề rộng
  flex-basis của item dựa theo nội dung chữ bên trong ("Q01") thay vì giãn hết container, khiến
  `text-align: center` bên trong một khối chỉ vừa đủ ôm sát nội dung sẽ KHÔNG có tác dụng canh giữa
  nhìn thấy được nào cả (vì không còn khoảng trống 2 bên để mà "center" vào).
- **Cách sửa**: trong `public/counter/widget/index.html`, thay quy tắc gộp chung cũ bằng 2 quy tắc
  riêng, thêm `display: block; width: 100%;` ép buộc trực tiếp cho `#counterTag` ở chế độ dọc để
  đảm bảo chắc chắn 100% (không phụ thuộc vào việc trình duyệt có tự "stretch" đúng hay không) rằng
  phần tử này luôn chiếm toàn bộ bề rộng khả dụng của widget trước khi `text-align: center` phát
  huy tác dụng:
  ```css
  html.vertical #counterTag { display: block; width: 100%; text-align: center; }
  html.vertical #sttNumber { text-align: center; }
  ```
  Chỉ áp dụng `display:block; width:100%;` cho `#counterTag` (mã quầy "Q01") vì người dùng chỉ báo
  lỗi ở phần tử này; `#sttNumber` (số thứ tự "042") không bị báo lỗi nên giữ nguyên như cũ, không
  thêm thay đổi không cần thiết. Thay đổi này chỉ nằm trong khối `html.vertical ...` (chế độ dọc),
  hoàn toàn không ảnh hưởng tới CSS của chế độ ngang.
- **Đã kiểm chứng bằng công cụ**: đếm số dấu `{`/`}` trong khối `<style>` và số thẻ `<div>`/`</div>`
  của `index.html` sau khi sửa — vẫn cân bằng (71 mở/71 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div);
  `node --check` trên `widget.js` và `main.js` — không có lỗi cú pháp (2 file này không bị đụng tới
  trong mục sửa lần này, chỉ kiểm tra lại cho chắc).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux). Đây CHỈ là thay đổi CSS
  trong file tĩnh phục vụ qua web server — **không** phải thuộc tính native của cửa sổ Electron
  (khác với mục 60/62 về kích thước tối thiểu), nên người dùng **không cần thoát hẳn ứng dụng
  widget** — chỉ cần tải lại (reload) hoặc đóng/mở lại cửa sổ widget ở chế độ dọc là sẽ thấy mã
  quầy "Q01" đã canh giữa ngay.

### 63.1. Vẫn chưa đúng sau lần sửa đầu — đổi sang cách canh giữa bằng flexbox cho chắc chắn

- **Phản ánh lần 2 (kèm ảnh chụp phóng to)**: sau khi thử bản sửa ở mục 63, chữ "Q01" vẫn chưa nằm
  giữa — quan sát kỹ ảnh chụp (đã phóng to bằng công cụ để xem rõ pixel) cho thấy chữ "Q01" bị dồn
  hẳn về phía bên phải NGAY BÊN TRONG khung nền xanh nhạt của chính nó (khoảng trống bên trái khung
  rõ ràng lớn hơn hẳn bên phải) — người dùng xác nhận qua câu hỏi làm rõ: đây là kiểu lệch
  "trái/phải trong khung" (chữ không nằm giữa khung nền của chính nó), không phải lỗi hiển thị lạ
  hay tooltip chồng lên.
- **Nghi vấn nguyên nhân bản sửa lần 1 chưa đủ**: `display: block; width: 100%;` tuy đổi loại hiển
  thị của `#counterTag`, nhưng phần tử này VẪN LÀ 1 flex item của `#mainView` (cha nó là flex
  container) — thuộc tính `flex: 0 0 auto` khai báo ở rule gốc (`#counterTag` dòng ~124) vẫn còn
  hiệu lực song song. Việc `flex-basis: auto` có thật sự quy về đúng `width: 100%` hay không trong
  mọi tình huống render còn tùy engine, nên `text-align: center` (vốn phụ thuộc vào việc BOX ĐÃ
  THẬT SỰ có đủ "khoảng trống" 2 bên hay chưa) có thể không cho kết quả canh giữa ổn định 100%.
- **Cách sửa lần 2 (chắc chắn hơn, không phụ thuộc flex-basis)**: đổi hẳn cách tiếp cận — thay vì
  dựa vào `text-align` bên trong 1 block đơn thuần, biến chính `#counterTag` thành 1 **flex
  container riêng cho nội dung của chính nó**, dùng `justify-content: center` + `align-items:
  center` để ép chữ vào đúng giữa một cách tuyệt đối, không phụ thuộc việc trình duyệt tính
  flex-basis/width thế nào:
  ```css
  html.vertical #counterTag {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  ```
- **Đã kiểm chứng bằng công cụ**: đếm lại số dấu `{`/`}` và số thẻ `<div>`/`</div>` của
  `index.html` sau khi sửa lần 2 — vẫn cân bằng (71 mở/71 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux) — vẫn chỉ là thay đổi CSS
  tĩnh nên không cần thoát hẳn ứng dụng, chỉ cần tải lại/mở lại widget dọc. Nhờ người dùng kiểm tra
  lại và chụp ảnh cận cảnh khung "Q01" nếu vẫn chưa đúng để xác định chính xác hơn.

## 64. Widget chế độ DỌC: giảm tổng chiều dài bằng cách thu hẹp khoảng cách giữa các nút

- **Yêu cầu của người dùng (nguyên văn)**: "ok rồi. điều chỉnh widget dọc tôi muốn giảm chiều dài
  của widget dọc bằng cách thu hẹp khoảng cách giữa cách nút" (thu hẹp khoảng cách giữa CÁC NÚT).
- **Phân tích**: widget dọc xếp TẤT CẢ các nhóm/nút theo cột (mã quầy, số đang phục vụ, vạch ngăn,
  3 nút gọi số, vạch ngăn, 3 nút icon phụ, vạch ngăn, 8 nút cấp số nhanh, vạch ngăn, danh sách số
  lượng chờ, 2 nút phụ, vạch ngăn, nút bánh răng) — `#mainView` ở chế độ dọc có 16 phần tử con trực
  tiếp, mỗi khoảng cách giữa 2 phần tử liền kề tốn `gap: 4px`; ngoài ra 4 vạch ngăn (`.sep-line`)
  còn có thêm `margin: 2px 0` mỗi đầu (chèn thêm khoảng trống ngay giữa các nhóm); nhóm 8 nút "Cấp
  số nhanh" (`#quickIssueActions`) và nhóm 3 nút gọi số (`#actions`) khi xếp cột cũng có `gap: 3px`
  riêng bên trong. Tất cả các khoảng cách này CỘNG DỒN lại chiếm khá nhiều chiều cao tổng của
  widget dọc — đúng chỗ có thể thu hẹp mà KHÔNG cần đổi kích thước bất kỳ nút nào (giữ nguyên yêu
  cầu chỉ "thu hẹp khoảng cách giữa các nút", không đụng tới kích thước nút).
- **Cách sửa**: trong `public/counter/widget/index.html`, thu hẹp các giá trị `gap`/`margin` sau —
  **chỉ áp dụng riêng chế độ dọc** (qua `html.vertical ...`), không đụng tới chế độ ngang:
  - `html.vertical #mainView`: `padding: 6px 0` → `4px 0`; `gap: 4px` → `2px` (khoảng cách giữa 16
    phần tử con trực tiếp — tác dụng cộng dồn rõ nhất).
  - `html.vertical .sep-line`: `margin: 2px 0` → `1px 0` (4 vạch ngăn, mỗi vạch bớt 2px mỗi đầu).
  - `html.vertical #actions`: `gap: 3px` → `2px` (3 nút gọi số xếp cột).
  - `html.vertical #quickIssueActions`: thêm `gap: 2px` (trước đây dùng chung `gap: 3px` của rule
    gốc áp dụng cho cả 2 chế độ — nay khai báo riêng cho chế độ dọc để không ảnh hưởng chế độ
    ngang) — nhóm này có tới 8 nút nên là nơi tiết kiệm được nhiều nhất.
  - `html.vertical #queueCounts`: thêm `gap: 1px` (trước đây dùng chung `gap: 2px` của rule gốc) —
    danh sách này có thể lên tới 8 dòng (8 đối tượng ưu tiên).
  - Ước tính tổng chiều cao giảm được (nếu hiện đủ mọi thành phần, không kể phần tự co giãn của
    `#queueCounts`): giảm padding 4px + giảm 15 khoảng gap chính của `#mainView` (15 × 2px = 30px)
    + giảm margin 4 vạch ngăn (4 × 2 × 1px = 8px) + giảm gap trong 2 nhóm con (~7-9px) — tổng cộng
    khoảng **50-55px** ngắn hơn so với trước, tùy vào widget đang hiện bao nhiêu dòng số lượng chờ.
- **Đã kiểm chứng bằng công cụ**: đếm lại số dấu `{`/`}` và số thẻ `<div>`/`</div>` của
  `index.html` sau khi sửa — vẫn cân bằng (71 mở/71 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div);
  `node --check` trên `widget.js` — không có lỗi cú pháp (file này không bị đụng tới trong mục sửa
  lần này, chỉ kiểm tra lại cho chắc).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux). Đây chỉ là thay đổi CSS
  tĩnh nên **không cần thoát hẳn ứng dụng** — chỉ cần tải lại (reload) hoặc đóng/mở lại cửa sổ
  widget ở chế độ dọc là thấy ngay các nút/nhóm nút đã xích lại gần nhau hơn, tổng chiều dài widget
  ngắn lại. Nếu người dùng muốn thu hẹp thêm nữa (ví dụ giảm cả kích thước từng nút, không chỉ
  khoảng cách), xin cho biết cụ thể để điều chỉnh tiếp.

## 65. Widget dọc: không lưu lại vị trí/kích thước đã tự chỉnh tay

- **Yêu cầu/phản ánh của người dùng (nguyên văn)**: "ok rồi widget dọc không lưu lại vị trí và kích
  thước tôi đã điều chỉnh".
- **Hiện trạng trước khi sửa**: `electron-widget/main.js` đã có sẵn cơ chế lưu vị trí/kích thước
  widget theo từng chiều riêng biệt (`config.widgetBounds` cho chiều ngang,
  `config.widgetBoundsVertical` cho chiều dọc — xem `currentWidgetBoundsKey()`), lưu vào file
  `widget-config.json` (`electron-widget/config.js`) mỗi khi cửa sổ widget phát sinh sự kiện
  `'move'`/`'resize'` (xem `scheduleSaveBounds()` trong `createWidgetWindow()`) — NHƯNG việc ghi
  file được **trì hoãn (debounce) 400ms** sau lần kéo/thả cuối cùng, để tránh ghi đĩa liên tục
  trong lúc đang kéo.
- **Nguyên nhân**: mục tray "Thoát" gọi thẳng `app.quit()` (dòng ~1203) — ứng dụng thoát NGAY LẬP
  TỨC, không hề chờ hay "xả" (flush) khoảng hẹn giờ 400ms nói trên. Nếu người dùng kéo/thu nhỏ
  widget dọc rồi **thoát ứng dụng ngay sau đó** (kịch bản rất tự nhiên: chỉnh xong là thoát để xem
  có lưu không, hoặc tắt máy/khởi động lại Windows ngay sau khi vừa chỉnh) — trong khoảng chưa đến
  400ms đó, hẹn giờ ghi file CHƯA KỊP CHẠY thì tiến trình đã bị đóng, khiến lần chỉnh **cuối cùng**
  không bao giờ được ghi vào `widget-config.json`. Mở lại ứng dụng thấy widget quay về đúng vị
  trí/kích thước **trước đó** (lần lưu gần nhất, nếu có) chứ không phải cơ chế lưu bị hỏng hoàn
  toàn — chỉ là bị "hụt" đúng lần chỉnh cuối nếu thoát quá nhanh.
- **Cách sửa**: trong `electron-widget/main.js`:
  1. Đưa biến đếm giờ debounce (trước đây là biến cục bộ `saveTimer` bên trong `createWidgetWindow()`)
     ra phạm vi module (`widgetBoundsSaveTimer`), để có thể truy cập/hủy từ nơi khác.
  2. Thêm hàm `flushWidgetBoundsSave()`: hủy ngay hẹn giờ debounce đang chờ (nếu có) và **ghi ngay
     lập tức** `widgetWindow.getBounds()` hiện tại vào đúng field (`widgetBounds` hoặc
     `widgetBoundsVertical`) của `config`, rồi `saveConfig()`.
  3. Gắn `app.on('before-quit', () => flushWidgetBoundsSave())` — sự kiện `'before-quit'` của
     Electron luôn chạy **trước khi** các cửa sổ bắt đầu đóng, nên `widgetWindow.getBounds()` lúc
     đó vẫn đọc đúng vị trí/kích thước cuối cùng — đảm bảo LUÔN lưu đúng lần chỉnh cuối cùng bất kể
     người dùng thoát ứng dụng nhanh thế nào sau khi vừa kéo/thả xong (áp dụng cho cả 2 chiều ngang
     và dọc, không riêng gì chiều dọc, vì nguyên nhân gốc là chung).
- **Đã kiểm chứng bằng công cụ**: `node --check electron-widget/main.js` — không có lỗi cú pháp;
  kiểm tra thủ công không còn tham chiếu nào tới biến cục bộ `saveTimer` cũ (đã chuyển hết sang
  `widgetBoundsSaveTimer` ở phạm vi module).
- Chưa thể tự kiểm chứng bằng cách chạy thực tế trên Windows thật (môi trường hiện tại là Linux,
  không chạy được ứng dụng Electron thật để giả lập thao tác kéo/thả rồi thoát). Đây LÀ thay đổi
  thuộc phần lõi ứng dụng Electron (`main.js`, tiến trình chính) — khác với các mục CSS thuần trước
  đó — nên lần này **cần đóng hẳn ứng dụng widget hiện tại và mở lại bằng bản cập nhật mới** (khởi
  động lại ứng dụng, không chỉ reload trang) thì bản vá mới có hiệu lực. Nhờ người dùng thử lại:
  kéo/thu nhỏ widget dọc theo ý muốn, thoát ứng dụng ngay lập tức (qua mục tray "Thoát"), mở lại
  ứng dụng và xác nhận widget dọc hiện đúng vị trí/kích thước vừa chỉnh.

## 66. Làm trong suốt nền thanh widget

- **Yêu cầu của người dùng (nguyên văn)**: "ok rồi làm trong suốt nền thanh widget nữa là được".
- **Hiện trạng trước khi sửa**: `public/counter/widget/index.html` — khối `html, body` (dòng ~37)
  đã để `background: transparent` sẵn từ trước, và cửa sổ Electron (`electron-widget/main.js`,
  `createWidgetWindow()`) đã tạo với `transparent: true` sẵn — NHƯNG khối `#card` (chính là "thanh
  widget" nhìn thấy được, chứa toàn bộ nội dung) lại có `background: #ffffffee` — màu trắng với độ
  trong suốt chỉ khoảng 7% (`ee` ~ 93% độ đục/opaque), nhìn gần như một khối trắng đặc, không xuyên
  thấu được xuống màn hình/cửa sổ bên dưới.
- **Cách sửa**: đổi `background: #ffffffee` thành `background: transparent` cho `#card` — có hiệu
  lực NGAY CHO CẢ 2 CHẾ ĐỘ (ngang và dọc) vì `#card` dùng chung cho cả hai, không cần sửa riêng chế
  độ nào. Vẫn giữ nguyên viền mỏng xanh dương nhạt (`border: 1px solid #93c5fd`) và bo góc để người
  dùng còn nhìn ra được phạm vi/hình dạng của widget mà kéo-thả/resize, tránh trường hợp widget
  "vô hình" hoàn toàn gây khó thao tác. Các khung nền riêng của từng nút/nhãn bên trong (ví dụ mã
  quầy "Q01" nền xanh nhạt, khung nhóm "Cấp số nhanh"/"Số lượng chờ", các nút cấp số nhanh nền
  trắng...) **giữ nguyên không đổi** — đây là các khối màu có chủ đích để dễ nhận diện từng
  nút/nhãn, khác với "nền chung của cả thanh widget" mà người dùng yêu cầu làm trong suốt.
- **Đã kiểm chứng bằng công cụ**: đếm số dấu `{`/`}` và số thẻ `<div>`/`</div>` trong `index.html`
  sau khi sửa — vẫn cân bằng (71 mở/71 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div); `node --check` trên
  `widget.js` và `main.js` — không có lỗi cú pháp (2 file này không bị đụng tới trong mục sửa lần
  này, chỉ kiểm tra lại cho chắc).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux). Đây chỉ là thay đổi CSS
  tĩnh, cửa sổ Electron vốn đã tạo với `transparent: true` từ trước nên **không cần thoát hẳn ứng
  dụng** — chỉ cần tải lại (reload) hoặc đóng/mở lại cửa sổ widget là thấy nền thanh widget đã
  trong suốt, chỉ còn lại chữ/icon/viền mỏng nổi trên màn hình nền/cửa sổ khác phía sau.

## 67. Vẫn còn "quá đậm" — làm trong suốt luôn nền của TỪNG khung/nút bên trong

- **Phản ánh của người dùng (nguyên văn)**: "tôi muốn trong suốt hơn nữa này quá đậm r".
- **Phân tích**: mục 66 đã làm `#card` (khung tổng của cả widget) trong suốt hoàn toàn — nhưng bên
  TRONG `#card` vẫn còn hàng loạt khối nền MÀU ĐẶC (opacity 100%) của từng nhóm/nút riêng lẻ: khung
  nhóm "Cấp số nhanh" và "Số lượng chờ" (`#eff6ff` đặc, chế độ ngang), mã quầy "Q01"
  (`#counterTag`, nền `#dbeafe` đặc), và đặc biệt là nền TRẮNG ĐẶC (`#ffffff`) của cả 8 nút "Cấp số
  nhanh" — ở chế độ dọc, 8 nút này xếp chồng chiếm phần LỚN diện tích nhìn thấy được của widget,
  nên dù khung tổng đã trong suốt, tổng thể vẫn nhìn "đậm"/đặc vì gần như bị các khối nền con này
  phủ kín.
- **Cách sửa**: trong `public/counter/widget/index.html`, đổi các nền màu ĐẶC (mã màu hex thường,
  opacity 100%) nói trên sang `rgba(...)` cùng tông màu nhưng thêm kênh alpha (độ trong suốt) —
  giữ NGUYÊN màu sắc/tông màu gốc, chỉ giảm độ đục:
  - Khung nhóm "Cấp số nhanh"/"Số lượng chờ" (chế độ ngang): `#eff6ff` → `rgba(239,246,255,0.5)`,
    viền `#bfdbfe` → `rgba(191,219,254,0.75)`.
  - Mã quầy (`#counterTag`): `#dbeafe` → `rgba(219,234,254,0.55)`.
  - Nền 8 nút "Cấp số nhanh" (`#quickIssueActions button`, nơi tác dụng rõ nhất vì chiếm diện tích
    lớn nhất ở chế độ dọc): `#ffffff` → `rgba(255,255,255,0.5)` (áp dụng cả trạng thái
    `:disabled:hover`).
  - Toàn bộ màu nền khi rê chuột (hover) của các nút còn lại (nút bánh răng/màn hình bệnh
    nhân/đăng xuất/kiosk nhân viên/thứ tự ưu tiên/DS bỏ qua, các dòng số lượng chờ, và 8 màu hover
    riêng theo từng đối tượng ưu tiên của nút cấp số nhanh) cũng đổi đồng bộ sang `rgba(...)` cùng
    tông, để nhất quán không còn mảng màu đặc nào sót lại.
  - **Giữ nguyên KHÔNG đổi**: 3 nút gọi số chính (Gọi tiếp theo/Gọi lại/Bỏ qua — màu chức năng cần
    rõ ràng, dễ bấm đúng khi thao tác nhanh) và khay cảnh báo `#statusToast` (thông báo lỗi/cảnh
    báo cần luôn dễ đọc rõ ràng khi hiện ra) — 2 phần này KHÔNG đổi sang trong suốt vì cần giữ độ
    tương phản/rõ ràng cao cho thao tác nghiệp vụ, không thuộc diện "khung nền trang trí" mà người
    dùng đang muốn làm trong suốt hơn.
- **Đã kiểm chứng bằng công cụ**: đếm số dấu `{`/`}` và số thẻ `<div>`/`</div>` trong `index.html`
  sau khi sửa — vẫn cân bằng (71 mở/71 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div); `node --check` trên
  `widget.js` — không có lỗi cú pháp (file này không bị đụng tới trong mục sửa lần này).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux). Đây chỉ là thay đổi CSS
  tĩnh nên không cần thoát hẳn ứng dụng, chỉ cần tải lại/mở lại widget. Nếu vẫn muốn trong suốt hơn
  nữa (ví dụ giảm alpha xuống thấp hơn nữa, hoặc bỏ luôn viền), xin cho biết cụ thể mức độ mong
  muốn để điều chỉnh tiếp — càng giảm alpha thì chữ càng khó đọc hơn trên nền/cửa sổ tạp phía sau,
  nên cần người dùng xác nhận mức cân bằng phù hợp.

## 68. Nền widget đậm lên 1 chút (bớt trong suốt) + giảm thêm chiều dài widget dọc

- **Yêu cầu của người dùng (nguyên văn)**: "Ok rồi. nền widget cho đậm lên 1 tý đừng trong suốt
  quá. giảm thêm px chiều dọc cho widget dọc dc không".
- **Phần 1 — nền đậm lên 1 chút**: mục 66/67 trước đó đã làm nền `#card` hoàn toàn `transparent`
  (0% độ đục) và các khung/nút con giảm xuống alpha ~0.5-0.55 — theo phản ánh, mức này QUÁ trong
  suốt, chữ/icon khó đọc trên nền/cửa sổ tạp phía sau. Điều chỉnh lại (`public/counter/widget/index.html`):
  - `#card`: `background: transparent` → `background: rgba(255, 255, 255, 0.3)` — có 1 lớp nền
    trắng mờ nhẹ (30% đục) để chữ/icon dễ đọc hơn hẳn so với trong suốt hoàn toàn, nhưng vẫn còn
    xuyên thấy một phần màn hình/cửa sổ phía sau (khác hẳn bản gốc `#ffffffee` gần như đặc 93%).
  - Khung nhóm "Cấp số nhanh"/"Số lượng chờ" (chế độ ngang): alpha `0.5` → `0.75`, viền
    `0.75` → `0.9`.
  - Mã quầy (`#counterTag`): alpha `0.55` → `0.8`.
  - Nền các nút "Cấp số nhanh" (`#quickIssueActions button`, cả trạng thái `:disabled:hover`):
    alpha `0.5` → `0.75`.
  - Vẫn giữ nguyên các màu hover/statusToast/3 nút gọi số chính như mục 67 (không phải trọng tâm
    phản ánh lần này).
- **Phần 2 — giảm thêm chiều dài widget dọc**: mục 64 đã thu hẹp `gap`/`margin` một lần; lần này
  giảm thêm 1 nấc nữa VÀ giảm luôn kích thước một số nút (trước đây chỉ giảm khoảng cách, giữ
  nguyên kích thước nút — nay yêu cầu mở rộng hơn, "giảm thêm px" nói chung), **chỉ áp dụng riêng
  chế độ dọc**:
  - `html.vertical #mainView`: `padding: 4px 0` → `3px 0`; `gap: 2px` → `1px`.
  - `html.vertical .sep-line`: `margin: 1px 0` → `0` (gap 1px của `#mainView` đã đủ tách vạch ngăn
    với phần tử kế bên).
  - `html.vertical #actions`: `gap: 2px` → `1px`; **thêm mới** kích thước nút `26×26` → `24×24` cho
    3 nút gọi số khi xếp dọc (vẫn đủ chỗ cho icon 13px).
  - `html.vertical #queueCounts`: `gap: 1px` → `0`.
  - `html.vertical #quickIssueActions`: `gap: 2px` → `1px`; **thêm mới** chiều cao nút `26px` →
    `22px` riêng cho chế độ dọc (nhóm 8 nút này tiết kiệm được nhiều nhất, tới ~32px).
  - Ước tính tổng chiều cao giảm thêm được (ngoài mục 64): ~15px (gap mainView) + ~2px (padding) +
    ~8px (bỏ margin vạch ngăn) + ~2px (gap actions) + ~6px (giảm cỡ 3 nút gọi số) + ~7px (gap
    quickIssueActions) + ~32px (giảm cỡ 8 nút cấp số nhanh) + tối đa ~7px (gap queueCounts, tuỳ số
    dòng đang hiện) — tổng cộng có thể lên tới **~80px** ngắn hơn nữa so với sau mục 64, tuỳ nội
    dung đang hiển thị.
- **Đã kiểm chứng bằng công cụ**: đếm số dấu `{`/`}` và số thẻ `<div>`/`</div>` trong `index.html`
  sau khi sửa — vẫn cân bằng (72 mở/72 đóng dấu ngoặc CSS — tăng 1 cặp do thêm rule
  `html.vertical #actions button` mới, 4 mở/4 đóng thẻ div); `node --check` trên `widget.js` và
  `main.js` — không có lỗi cú pháp (2 file này không bị đụng tới trong mục sửa lần này).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux). Đây chỉ là thay đổi CSS
  tĩnh nên không cần thoát hẳn ứng dụng, chỉ cần tải lại/mở lại widget (cả 2 chế độ, vì phần đổi
  màu nền áp dụng chung) là thấy nền đậm lên rõ rệt và widget dọc ngắn hơn hẳn. Nếu vẫn muốn điều
  chỉnh thêm (đậm hơn/nhạt hơn nữa, hoặc ngắn hơn nữa), xin cho biết cụ thể mức mong muốn.

## 69. Bản build cài vào máy thật: mở "Đổi địa chỉ máy chủ" bị trang trắng

- **Phản ánh của người dùng (kèm 2 ảnh chụp, nguyên văn)**: "Ok rồi. widget build xong cài vào máy
  đổi địa chỉ máy chủ bị trang trắng" — ảnh chụp cho thấy cửa sổ "Đổi địa chỉ máy chủ" mở ra, thanh
  tiêu đề (title bar) hiện đúng chữ "Đổi địa chỉ máy chủ" kèm icon, nhưng toàn bộ phần nội dung bên
  trong (ô nhập địa chỉ, nút Lưu/Huỷ...) trống trắng hoàn toàn.
- **Nguyên nhân xác định được**: `createServerUrlPrompt()` trong `electron-widget/main.js` (dòng
  ~794) mở cửa sổ này bằng `promptWindow.loadFile(path.join(__dirname, 'server-url-prompt.html'))`
  — tải 1 file HTML RIÊNG (`electron-widget/server-url-prompt.html`) từ đĩa, KHÁC với widget chính
  (widget chính tải trang qua `http://` từ máy chủ Node.js, không liên quan file này). Kiểm tra
  `electron-widget/package.json`, mục `build.files` (danh sách CHÍNH XÁC các file điện-builder sẽ
  ĐÓNG GÓI vào bản cài đặt/portable) — TRƯỚC ĐÂY chỉ liệt kê `main.js`, `preload.js`, `config.js`,
  `assets/**/*`, `node_modules/**/*` — **thiếu hẳn `server-url-prompt.html`**! Khi chạy bằng
  `npm start` (môi trường phát triển, chạy thẳng từ thư mục mã nguồn) file này vẫn nằm sẵn trên đĩa
  nên vẫn tải được bình thường, không phát hiện ra vấn đề — nhưng khi ĐÓNG GÓI thành bản cài đặt
  (`npm run build:win`, dùng electron-builder), do file không nằm trong danh sách `files`, nó
  KHÔNG được sao chép vào gói cài đặt — cài vào máy khác xong, `loadFile()` tìm file này không
  thấy, tải thất bại lặng lẽ, cửa sổ hiện ra trống trắng (tiêu đề vẫn hiện đúng vì đó là thuộc tính
  `title` của chính cửa sổ do hệ điều hành vẽ, độc lập với việc tải nội dung trang có thành công
  hay không).
- **Cách sửa**: trong `electron-widget/package.json`, thêm `"server-url-prompt.html"` vào mảng
  `build.files` (ngay sau `"config.js"`) — để electron-builder đóng gói đúng file này vào MỌI bản
  build (cả `build:win` lẫn `build:portable`) từ nay về sau.
- **Đã kiểm chứng bằng công cụ**: `python3 -c "import json; json.load(open('package.json'))"` —
  xác nhận `package.json` sau khi sửa vẫn là JSON hợp lệ, không lỗi cú pháp.
- **Quan trọng — cần build lại**: đây là lỗi ở CẤU HÌNH ĐÓNG GÓI (`package.json`), không phải mã
  nguồn `.js`/`.html` — sửa xong PHẢI **build lại bản cài đặt mới** (`npm run build:win` hoặc
  `npm run build:portable` trong thư mục `electron-widget/`) rồi cài đè/cài lại bản mới vào máy;
  bản đã cài hiện tại (build cũ, thiếu file) sẽ KHÔNG tự khắc phục nếu chỉ tải lại trang hay khởi
  động lại ứng dụng — phải đóng gói lại từ đầu. Chưa thể tự chạy `electron-builder` để build ra
  file cài đặt thật và cài thử trên Windows thật trong môi trường hiện tại (Linux, không có sẵn
  Windows để đóng gói/cài đặt/kiểm tra bằng NSIS) — nhờ người dùng tự build lại bằng đúng máy
  Windows đã dùng trước đó, cài lại, rồi thử mở lại "Đổi địa chỉ máy chủ" để xác nhận đã hiện đầy
  đủ nội dung (không còn trắng trang).

## 70. "Lỗi IO" khi cài trên máy khách hàng — hoá ra là lỗi đọc/ghi CSDL khi vào /counter/, không phải lỗi trình cài đặt

- **Phản ánh ban đầu (nguyên văn)**: "sao nó file cài sao khi build xong tôi cài trên máy khách
  hàng nó báo lỗi IO ta. mà tôi cài trên máy mình thì k bị" — nghe qua giống lỗi TRÌNH CÀI ĐẶT
  (setup.exe), nên đã hỏi làm rõ thêm trước khi đoán mò (dùng câu hỏi trắc nghiệm để thu thập thêm
  chi tiết, vì không có ảnh chụp/nguyên văn lỗi kèm theo).
- **Làm rõ qua các câu hỏi (rất quan trọng, đổi hẳn hướng chẩn đoán)**: người dùng cho biết lỗi
  THỰC RA xảy ra "khi vào localhost:4000 ở màn counter và mục quản lý quầy tiếp nhận á" (KHÔNG PHẢI
  lúc chạy file cài đặt) — tức là: cài đặt xong xuôi, server khởi động và các trang web vẫn tải
  được bình thường, nhưng khi vào trang `/counter/` (màn hình quản lý quầy) thì báo "ko load được
  dữ liệu". Máy khách hàng có phần mềm diệt virus đang chạy và người dùng nghi ngờ nó có liên quan;
  phần server được cài bằng trình cài đặt Inno Setup (`packaging/windows-installer/HeThongBatSo.iss`,
  đã build ra `HeThongBatSo-Setup-....exe`).
- **Chẩn đoán nguyên nhân**: đây là dấu hiệu kinh điển của lỗi ĐỌC/GHI Ổ ĐĨA (I/O) khi SQLite
  (`src/config/db.js`, dùng `node:sqlite` built-in, bật `PRAGMA journal_mode = WAL`) cố ghi vào
  file cơ sở dữ liệu (`data/queue.db` và các file phụ `.db-wal`/`.db-shm` mà chế độ WAL tạo ra) —
  **chỉ xảy ra ở máy khách hàng, không xảy ra ở máy của chính người dùng** khớp rất chặt với 2 khả
  năng: (1) phần mềm diệt virus / Windows Defender ("Kiểm soát truy cập thư mục được kiểm soát" -
  Controlled folder access) trên máy khách hàng đang chặn/khoá quyền ghi của tiến trình Node.js vào
  thư mục cài đặt (máy của người dùng có thể đã được thêm ngoại lệ từ trước, hoặc tắt tính năng
  này); (2) thư mục cài đặt/thư mục `data\` bị thiếu quyền ghi cho tài khoản Windows đang dùng trên
  máy khách hàng. Đáng chú ý: kiểm tra lại thì trình cài đặt Inno Setup (`HeThongBatSo.iss`) đã
  được thiết kế từ TRƯỚC (đợt làm việc trước, không phải trong phiên này) để tránh đúng vấn đề này
  — cài vào `{sd}\HeThongBatSo` (gốc ổ đĩa hệ thống, KHÔNG phải "Program Files") và tự cấp quyền
  `users-modify` cho thư mục cài đặt + thư mục `data\` lúc cài đặt — nên nếu vẫn gặp lỗi, nhiều khả
  năng là do (1) antivirus của máy khách hàng cụ thể đó chặn thêm ở tầng riêng của nó (ngoài phạm
  vi quyền thư mục Windows thông thường), hoặc trình cài đặt không được dùng đúng cách (ví dụ chép
  tay thư mục thay vì chạy file `.exe` cài đặt).
- **Vấn đề PHÁT HIỆN THÊM trong lúc kiểm tra mã nguồn**: `src/server.js` **hoàn toàn CHƯA CÓ**
  middleware xử lý lỗi tập trung (error-handling middleware — hàm Express nhận 4 tham số) — khi 1
  route ném lỗi (ví dụ `GET /api/counters` trong `src/routes/counters.js`, không có `try/catch`
  riêng) do thao tác CSDL thất bại, Express tự chuyển sang trình xử lý lỗi MẶC ĐỊNH của nó, trả về
  1 trang lỗi dạng **HTML** (không phải JSON) — phía client (`public/counter/counter.js`, ví dụ
  `loadSkippedModal()`/`loadCalledModal()`) đang gọi `res.json()` để đọc dữ liệu, gặp trang HTML
  này sẽ ném lỗi phân tích (parse) JSON, rơi vào khối `catch` chỉ hiện đúng 1 dòng chung chung
  "Không tải được danh sách, vui lòng thử lại." — khớp với "ko load được dữ liệu" người dùng mô tả,
  nhưng KHÔNG hề có dòng log/thông báo nào chỉ rõ NGUYÊN NHÂN THẬT SỰ (lỗi CSDL kiểu gì, có liên
  quan quyền/antivirus hay không) ở cả 2 phía (console server lẫn màn hình trình duyệt) — rất khó
  chẩn đoán từ xa qua điện thoại/Zalo với khách hàng như tình huống hiện tại.
- **Cách sửa (cải thiện khả năng TỰ CHẨN ĐOÁN, không thể "sửa" trực tiếp antivirus/quyền hệ điều
  hành trên máy khách hàng từ xa được)**:
  1. `src/server.js`: thêm middleware xử lý lỗi CHUNG (đặt sau cùng, sau tất cả route) — bắt MỌI
     lỗi chưa được route tự xử lý, nhận diện các lỗi có dấu hiệu I/O/quyền truy cập (khớp mẫu
     `SQLITE_IOERR`, `SQLITE_CANTOPEN`, `SQLITE_READONLY`, `EACCES`, `EPERM`, "disk I/O error",
     "unable to open database"), **ghi log chi tiết + gợi ý nguyên nhân/cách xử lý cụ thể ngay
     trong console server** (hữu ích khi hướng dẫn khách hàng đọc log giúp qua điện thoại), và trả
     về đúng định dạng JSON (thay vì trang lỗi HTML mặc định) để client luôn đọc được phản hồi.
  2. `src/config/db.js` (`connectDB()`): bọc bước mở/tạo file CSDL lần đầu (thao tác ghi đĩa đầu
     tiên khi khởi động) trong `try/catch` — nếu thất bại ngay từ lúc khởi động (không phải lúc
     vận hành sau này), in ra ngay 1 thông báo tiếng Việt rõ ràng, dễ hành động, thay vì để lỗi kỹ
     thuật khó hiểu trôi lên tận `main().catch()` rồi dừng lại với dòng "[FATAL] Không khởi động
     được server" chung chung.
- **Đã kiểm chứng bằng công cụ**: `node --check src/server.js` và `node --check src/config/db.js`
  — không có lỗi cú pháp.
- **QUAN TRỌNG — đây KHÔNG PHẢI bản sửa triệt để, chỉ giúp CHẨN ĐOÁN rõ hơn**: lỗi gốc nằm ở MÔI
  TRƯỜNG máy khách hàng (antivirus/quyền hệ điều hành), không phải ở mã nguồn — bản sửa này giúp
  server tự in ra nguyên nhân/gợi ý cụ thể trong console (và trả JSON đúng định dạng cho client)
  NGAY LẦN TỚI lỗi này xảy ra, thay vì chỉ thấy "ko load được dữ liệu" mơ hồ như hiện tại. Cần
  build/deploy lại phần SERVER (không phải widget) lên máy khách hàng để có bản vá này — nhờ người
  dùng: (1) đóng gói lại bằng Inno Setup theo đúng `HUONG-DAN-DONG-GOI.md`, cài lại lên máy khách
  hàng; (2) khi lỗi tái diễn, xem cửa sổ dòng lệnh chạy server (hoặc file log nếu chạy ẩn) để đọc
  dòng "[LỖI SERVER] ... " kèm gợi ý chi tiết, chụp ảnh gửi lại để xác định chính xác nguyên nhân
  (chắc chắn 100% là antivirus hay là quyền thư mục); (3) trong lúc chờ, có thể thử trước: thêm
  ngoại lệ cho thư mục cài đặt (mặc định `C:\HeThongBatSo`) trong phần mềm diệt virus của máy khách
  hàng, và xác nhận thư mục cài đặt KHÔNG nằm trong 1 thư mục đang đồng bộ OneDrive/Google
  Drive/Dropbox. Chưa thể tự tái hiện lỗi này hay xác nhận trên Windows thật (môi trường hiện tại
  là Linux).

## 71. Màn hình cảm ứng /kiosk/ cứ tự hiện bàn phím ảo dù chỉ dùng để quét mã

- **Yêu cầu của người dùng (nguyên văn)**: "ok rồi. màn hình http://localhost:4000/kiosk/ ở màn
  hình cảm ứng nó cứ hiện bàn phím ảo. ở màn hình tôi chỉ quét thôi k có cần hiện bàn phím ảo".
- **Nguyên nhân**: `public/kiosk/index.html` có 2 ô nhập ẩn (`#scanInput` — ô chính ở bước quét
  CCCD/BHYT, `#staffExitScanInput` — ô quét mã QR xác nhận nhân viên rời kiosk) kiểu
  `<input type="text">`, luôn được giữ `focus()` sẵn bằng JavaScript (xem `kiosk.js`) để máy quét
  mã (hoạt động như 1 bàn phím vật lý qua cổng USB/Bluetooth — kiểu "keyboard wedge") tự gõ nội
  dung quét được vào thẳng ô này, KHÔNG cần người dùng bấm chọn ô trước. Các ô này được ẩn khỏi mắt
  bằng CSS (`opacity:0; pointer-events:none`) — NHƯNG việc ẩn bằng CSS này **không liên quan gì**
  đến việc trình duyệt/hệ điều hành có tự bật bàn phím ảo hay không: trên màn hình cảm ứng
  (touchscreen), Windows/Chrome/Edge tự động bật bàn phím ảo (on-screen keyboard) MỖI KHI một thẻ
  `<input type="text">` được focus (kể cả focus bằng JavaScript, không phải do người dùng chạm
  vào), bất kể ô đó có đang ẩn hình hay không — đây chính là nguyên nhân bàn phím ảo cứ tự bật lên
  dù ô nhập vốn dĩ vô hình, không có ai bấm vào cả.
- **Cách sửa**: thêm thuộc tính `inputmode="none"` vào các ô nhập ẩn dùng cho máy quét — đây là tín
  hiệu CHUẨN (được Chrome/Edge trên Windows/Android hỗ trợ) báo cho trình duyệt biết: "ô này CÓ THỂ
  nhận focus/gõ chữ, nhưng ĐỪNG tự bật bàn phím ảo khi được focus" — trong khi vẫn nhận bình thường
  MỌI sự kiện bàn phím từ thiết bị vật lý thật (máy quét mã) gửi tới, không ảnh hưởng gì tới chức
  năng quét. Áp dụng cho **cả 4 ô nhập ẩn kiểu này** tìm thấy trong toàn hệ thống (không chỉ riêng
  `/kiosk/` như phản ánh, để tránh gặp lại đúng vấn đề này ở các màn hình tương tự khác):
  - `public/kiosk/index.html`: `#scanInput` (bước quét CCCD/BHYT chính) và `#staffExitScanInput`
    (modal xác nhận nhân viên rời kiosk).
  - `public/staff-kiosk/index.html`: `#scanInput` (bước xác minh khi cấp số cho nhân viên).
  - `public/index.html`: `#scanLoginInput` (trang chủ — quét mã QR đăng nhập nhanh).
- **Đã kiểm chứng bằng công cụ**: đếm số thẻ `<div>`/`</div>` trong cả 3 file sau khi sửa — vẫn cân
  bằng (`index.html` 43/43, `kiosk/index.html` 27/27, `staff-kiosk/index.html` 27/27); kiểm tra thủ
  công xác nhận cả 4 ô nhập đều đã có `inputmode="none"`.
- Chưa thể tự xem thử trên màn hình cảm ứng Windows thật (môi trường hiện tại là Linux, không có
  thiết bị cảm ứng để kiểm chứng bàn phím ảo có thực sự hết tự bật hay không). Đây chỉ là thay đổi
  HTML tĩnh (thêm 1 thuộc tính), không cần khởi động lại gì đặc biệt — chỉ cần tải lại (reload)
  trang `/kiosk/` (và `/staff-kiosk/`, trang chủ `/`) trên màn hình cảm ứng là có hiệu lực ngay.
  `inputmode="none"` được các trình duyệt hiện đại (Chrome/Edge trên Windows/Android — nền tảng phổ
  biến nhất cho kiosk cảm ứng) hỗ trợ tốt; nếu thiết bị cụ thể nào đó vẫn còn hiện bàn phím ảo
  (một số bàn phím ảo của nhà sản xuất thiết bị/Windows phiên bản cũ đôi khi không tuân theo đúng
  chuẩn này), nhờ người dùng phản hồi lại kèm cho biết đúng loại màn hình/hệ điều hành đang dùng để
  tìm hướng khắc phục khác (ví dụ chuyển sang `readonly` + tự bật/tắt qua sự kiện bàn phím).

## 72. Máy khách hàng báo lỗi `net::ERR_EMPTY_RESPONSE` khi tải `/socket.io/socket.io.js` — "io is not defined"

- **Phản ánh của người dùng (nguyên văn)**: "Ok roi. File server ở máy người dùng báo lỗi
  localhost:4000/socket.io.ks net err_emty_response io is not defined" — đọc lại chính xác là
  trình duyệt báo `net::ERR_EMPTY_RESPONSE` khi tải `/socket.io/socket.io.js` (thư viện client của
  Socket.IO, do chính thư viện Socket.IO tự động phục vụ ở đường dẫn mặc định này), kéo theo lỗi JS
  "Uncaught ReferenceError: io is not defined" ngay sau đó (vì thư viện chưa tải được nên biến
  toàn cục `io` không tồn tại, các trang gọi `io()` để kết nối realtime đều lỗi theo).
- **Làm rõ qua các câu hỏi**: đây là CÙNG máy khách hàng đã từng nghi ngờ bị phần mềm diệt virus
  chặn quyền ghi CSDL (mục 70); cửa sổ dòng lệnh chạy server vẫn đang mở, KHÔNG có dòng lỗi nào
  (tức yêu cầu tải file này CHƯA TỪNG chạm tới được Node.js/Express để xử lý — bị chặn từ bên
  ngoài, trước khi vào tới server); và lỗi này xảy ra **LUÔN LUÔN** (100%, không phải thỉnh
  thoảng) — mở trang lên là lỗi ngay, chưa bao giờ chạy được.
- **Chẩn đoán nguyên nhân**: `net::ERR_EMPTY_RESPONSE` (kết nối TCP thành công nhưng không nhận
  được dữ liệu phản hồi nào, khác hẳn "không kết nối được" hay lỗi 404/500) + việc yêu cầu CHƯA
  TỪNG tới được server (server không hề ghi log) + xảy ra ổn định/luôn luôn trên đúng máy đã nghi
  antivirus can thiệp trước đó — khớp rất chặt với khả năng phần mềm diệt virus/tường lửa/proxy lọc
  web trên máy khách hàng có QUY TẮC LỌC/CHẶN THEO TÊN ĐƯỜNG DẪN quen thuộc **"/socket.io/"** (thư
  viện Socket.IO cực kỳ phổ biến, một số phần mềm diệt virus/proxy doanh nghiệp có sẵn chữ ký/luật
  chặn các kết nối WebSocket hoặc đường dẫn "socket.io" do nhầm với các công cụ chat/streaming/P2P
  cần kiểm soát).
- **Cách sửa**: KHÔNG THỂ tắt/gỡ antivirus trên máy khách hàng từ xa được, nhưng CÓ THỂ tránh né
  đúng cái tên đường dẫn quen thuộc mà bộ lọc đang chặn — đổi tuỳ chọn `path` CHÍNH THỨC của
  Socket.IO (không phải vá thư viện) từ mặc định `/socket.io/` sang 1 đường dẫn riêng, không có từ
  khoá dễ bị nhận diện: `/rt-bridge/socket.io/`. Áp dụng đồng bộ ở CẢ 2 phía:
  - **Server** (`src/server.js`): `new Server(server, { cors: {...}, path: '/rt-bridge/socket.io/' })`.
  - **Client**: đổi toàn bộ 7 thẻ `<script src="/socket.io/socket.io.js">` thành
    `<script src="/rt-bridge/socket.io/socket.io.js">` (`public/counter-admin/index.html`,
    `public/kiosk/index.html`, `public/staff-kiosk/index.html`, `public/waiting-screen/index.html`,
    `public/counter/index.html`, `public/counter/widget/index.html`, `public/patient-screen/index.html`),
    và toàn bộ 7 chỗ gọi `io()` thành `io({ path: '/rt-bridge/socket.io/' })` (`counter-admin.js`,
    `kiosk.js`, `staff-kiosk.js`, `counter.js`, `widget.js`, và 2 chỗ gọi inline trong
    `waiting-screen/index.html`/`patient-screen/index.html`) — dùng LẠI ĐÚNG tên miền
    "quen"/không đụng gì tới cách Socket.IO hoạt động, chỉ đổi đúng 1 chuỗi đường dẫn.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT, không chỉ đọc mã tĩnh — môi trường Linux này CÓ
  cài sẵn Node.js + đầy đủ `node_modules` nên chạy thử được máy chủ thật)**:
  - `node --check` trên `src/server.js` và toàn bộ 5 file `.js` phía client vừa sửa — không lỗi cú
    pháp.
  - Khởi động thật server (`node src/server.js`, cổng thử nghiệm riêng) rồi gọi thử bằng `curl`:
    `GET /rt-bridge/socket.io/socket.io.js` → **200 OK** (tải được thư viện đúng đường dẫn mới);
    `GET /socket.io/socket.io.js` (đường dẫn CŨ) → **404** (xác nhận đã đổi hẳn, không còn phục vụ
    ở đường dẫn cũ nữa); `GET /api/health` vẫn `{"ok":true,...}` bình thường.
  - Gọi thử ĐÚNG bước bắt tay (handshake) thật của Engine.IO tại đường dẫn mới:
    `GET /rt-bridge/socket.io/?EIO=4&transport=polling` → nhận về đúng gói tin bắt tay hợp lệ (có
    `sid`, `upgrades`, `pingInterval`...) — xác nhận kết nối realtime hoạt động đúng tại đường dẫn
    mới, không chỉ dừng ở việc tải được file JS.
- **Lưu ý quan trọng**: đây LÀ bản sửa THẬT SỰ (đổi code, đã kiểm thử chạy được), khác với mục 70
  (chỉ cải thiện chẩn đoán) — nhưng vẫn KHÔNG THỂ đảm bảo 100% sẽ qua được đúng phần mềm diệt virus
  cụ thể trên máy khách hàng đó nếu nó chặn theo cơ chế khác (ví dụ chặn theo NỘI DUNG/kích thước
  file thay vì tên đường dẫn, hoặc chặn nguyên cả cổng 4000) — cần build/deploy lại phần SERVER lên
  máy khách hàng rồi thử lại mới biết chắc chắn. Nếu vẫn còn lỗi tương tự sau khi cập nhật, nhờ
  người dùng chụp lại đúng dòng lỗi mới trong console trình duyệt (F12 → tab Console/Network) để
  xác định đây có phải đúng vẫn là chặn theo tên đường dẫn hay là 1 cơ chế chặn khác của phần mềm
  diệt virus đó.

## 73. Đổi tên tiêu đề ẩn "Widget quầy" thành chữ "Q"

- **Yêu cầu của người dùng (nguyên văn)**: "OK rồi. widget có 1 text ẩn Widget quầy dưới thanh công
  cụ dọc, ngang. Đổi tên nó thành chữ Q thôi".
- **Xác định đúng chỗ**: `public/counter/widget/index.html` có thẻ `<title>Widget quầy</title>` —
  đây là tiêu đề tài liệu (document title) của trang widget. Widget KHÔNG có thanh tiêu đề riêng
  hiển thị trên giao diện (cửa sổ Electron tạo với `frame: false` — xem `createWidgetWindow()`
  trong `electron-widget/main.js`), nên giá trị này không thấy trực tiếp trên màn hình — nhưng một
  số tình huống của hệ điều hành/trình duyệt (di chuột qua cửa sổ, xem trước trong Alt+Tab...) vẫn
  lấy đúng giá trị `<title>` này làm nhãn/tooltip hiển thị — khớp đúng với mô tả "1 text ẩn ...
  dưới thanh công cụ" của người dùng, xuất hiện GIỐNG NHAU ở cả 2 chế độ dọc/ngang vì `<title>` là
  1 giá trị DUY NHẤT dùng chung cho cả trang (không phân biệt theo `html.vertical`).
- **Cách sửa**: đổi `<title>Widget quầy</title>` → `<title>Q</title>`.
- **Không đụng tới**: tooltip của icon khay hệ thống (tray) — `tray.setToolTip('Widget Quầy Tiếp
  Nhận')` trong `electron-widget/main.js` (dòng ~1248) — đây là 1 UI KHÁC HẲN (tooltip khi rê chuột
  vào icon dưới khay hệ thống Windows, không phải "dưới thanh công cụ" của chính widget như người
  dùng mô tả), nên giữ nguyên, không phải đối tượng của yêu cầu lần này.
- **Đã kiểm chứng bằng công cụ**: đếm số dấu `{`/`}` và số thẻ `<div>`/`</div>` trong `index.html`
  sau khi sửa — vẫn cân bằng (72 mở/72 đóng dấu ngoặc CSS, 4 mở/4 đóng thẻ div).
- Chưa thể tự xem thử trên Windows thật (môi trường hiện tại là Linux, không có cách tái hiện chính
  xác tooltip/preview của hệ điều hành Windows khi di chuột qua cửa sổ). Đây chỉ là thay đổi HTML
  tĩnh (1 thẻ `<title>`), không cần thoát hẳn ứng dụng — tải lại/mở lại widget là có hiệu lực ngay.

## 74. Mục 72 CHƯA ĐỦ — vẫn còn `net::ERR_EMPTY_RESPONSE` trên chính máy khách hàng đó ở đường dẫn mới

- **Phản ánh của người dùng (nguyên văn, kèm ảnh chụp màn hình Console trình duyệt)**: "Vào màn
  hình counter vẫn lỗi code build npm bình thường mà build ra cài máy khách hàng thì bị lỗi". Ảnh
  chụp cho thấy CHÍNH XÁC LẶP LẠI cùng 1 lỗi như mục 72, nhưng ở đường dẫn MỚI vừa đổi:
  `GET http://localhost:4000/rt-bridge/socket.io/socket.io.js net::ERR_EMPTY_RESPONSE` và
  `Uncaught ReferenceError: io is not defined at counter.js:1:16` — tức bản sửa ở mục 72 (chỉ đổi
  TIỀN TỐ đường dẫn) **KHÔNG GIẢI QUYẾT ĐƯỢC VẤN ĐỀ**, dù đã kiểm thử chạy thật OK ở môi trường hiện
  tại (mục 72 tự nhận đây là giới hạn: "không thể đảm bảo 100% qua được đúng phần mềm diệt virus cụ
  thể trên máy khách hàng đó").
- **Truy lại tận gốc — đọc thẳng mã nguồn thư viện Socket.IO đang dùng**: mở
  `node_modules/socket.io/dist/index.js`, xem hàm `path()` — phát hiện ra thư viện **LUÔN LUÔN TỰ
  GẮN THÊM** hậu tố cố định (hardcode) `/socket\.io(\.msgpack|\.esm)?(\.min)?\.js(\.map)?` vào SAU
  bất kỳ tiền tố `path` tuỳ chỉnh nào, để tạo ra đường dẫn phục vụ file thư viện phía client. Nghĩa
  là dù đặt `path` là gì đi nữa (`/rt-bridge/socket.io/`, hay bất kỳ tiền tố nào khác), đường dẫn
  phục vụ file JS luôn LUÔN chứa nguyên văn cụm chữ **"socket.io.js"** ở cuối — đúng cụm từ mà phần
  mềm diệt virus/tường lửa trên máy khách hàng đang lọc/chặn (chẩn đoán ở mục 72). Vì vậy việc đổi
  MỖI tiền tố như mục 72 không đụng được tới đúng nguyên nhân — chỉ đổi phần ĐẦU đường dẫn, còn phần
  ĐUÔI (chỗ chứa từ khoá bị chặn) thì thư viện tự thêm lại y hệt, không cách nào tránh được thông
  qua tuỳ chọn `path`.
- **Bài học tự rút ra**: lần kiểm thử ở mục 72 chỉ chứng minh đường dẫn MỚI có thể TẢI ĐƯỢC trong
  môi trường Linux hiện tại (nơi không có phần mềm diệt virus nào can thiệp) — không chứng minh
  được là đã né được đúng từ khoá mà bộ lọc trên máy khách hàng đang chặn, vì từ khoá đó ("socket.io.js")
  vẫn còn nguyên trong đường dẫn mới. Cần đọc kỹ mã nguồn thư viện thay vì chỉ dựa vào giả thuyết
  ban đầu khi có bằng chứng thực tế (ảnh chụp Console) cho thấy giả thuyết đó chưa đủ.
- **Cách sửa (dứt điểm hơn)**: TẮT HẲN tính năng tự phục vụ file client của Socket.IO
  (`serveClient: false`), rồi TỰ TAY phục vụ 1 BẢN SAO TĨNH của đúng file đó dưới 1 CÁI TÊN HOÀN
  TOÀN KHÔNG CÒN chữ "socket.io" nữa, thông qua cơ chế `express.static` CÓ SẴN, ĐÃ CHỨNG MINH hoạt
  động ổn định qua mọi kiểu đóng gói trong suốt dự án này (dùng chung với `print-receipt.js`,
  `common.css`...):
  - Tạo file `public/vendor/rt-client.js` — bản sao chép nguyên văn của
    `node_modules/socket.io/client-dist/socket.io.min.js` (thư viện client chính hãng của
    Socket.IO, không sửa nội dung, chỉ đổi TÊN FILE/ĐƯỜNG DẪN phục vụ).
  - **Server** (`src/server.js`): `new Server(server, { cors: {...}, path: '/rt-bridge/',
    serveClient: false })` — bỏ hẳn cụm "socket.io" khỏi `path` (tuỳ chọn này giờ chỉ còn ảnh hưởng
    đường dẫn BẮT TAY/kết nối realtime, không còn liên quan gì tới việc phục vụ file JS nữa vì đã
    tắt `serveClient`).
  - **Client**: đổi toàn bộ 7 thẻ `<script src="/rt-bridge/socket.io/socket.io.js">` thành
    `<script src="/vendor/rt-client.js">` (`public/counter-admin/index.html`,
    `public/kiosk/index.html`, `public/staff-kiosk/index.html`, `public/waiting-screen/index.html`,
    `public/counter/index.html`, `public/counter/widget/index.html`, `public/patient-screen/index.html`)
    — không còn nguyên văn cụm "socket.io" trong tên file/đường dẫn nữa; và sửa toàn bộ 7 chỗ gọi
    `io({ path: '/rt-bridge/socket.io/' })` thành `io({ path: '/rt-bridge/' })` (bỏ đúng đoạn
    `socket.io/` thừa trong tiền tố, khớp lại với giá trị `path` mới bên server) ở
    `counter-admin.js`, `kiosk.js`, `staff-kiosk.js`, `counter.js`, `widget.js`, và 2 chỗ gọi inline
    trong `waiting-screen/index.html`/`patient-screen/index.html`.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật, không chỉ đọc mã tĩnh)**:
  - `node --check` trên `src/server.js` và toàn bộ 5 file `.js` phía client vừa sửa — không lỗi cú
    pháp; đếm `<div>`/`</div>` trên cả 7 file HTML vừa sửa — vẫn cân bằng.
  - Khởi động thật server (`node src/server.js`, cổng thử nghiệm riêng) rồi gọi thử bằng `curl`:
    `GET /vendor/rt-client.js` → **200 OK**, đúng nội dung bản build chính hãng của Socket.IO
    (`/*! * Socket.IO v4.8.3 ... */`); `GET /rt-bridge/socket.io/socket.io.js` (đường dẫn có phục
    vụ file JS kiểu CŨ) → **KHÔNG CÒN trả về nội dung file JS nào nữa** (xác nhận `serveClient:
    false` đã tắt hẳn đường phục vụ file cũ); `GET /socket.io/socket.io.js` (đường dẫn mặc định gốc
    của thư viện) → **404**; `GET /api/health` vẫn `{"ok":true,...}` bình thường.
  - Gọi thử ĐÚNG bước bắt tay (handshake) thật của Engine.IO tại đường dẫn mới (không còn chữ
    "socket.io"): `GET /rt-bridge/?EIO=4&transport=polling` → nhận về đúng gói tin bắt tay hợp lệ
    (có `sid`, `upgrades`, `pingInterval`...) — xác nhận kết nối realtime vẫn hoạt động đúng, chỉ
    đổi tên đường dẫn phục vụ file JS.
- **⚠️ LƯU Ý TRIỂN KHAI CỰC KỲ QUAN TRỌNG — vì sao các lần sửa `public/` trước đây có thể "chưa có
  tác dụng" trên máy khách hàng dù đã cài lại bằng bộ cài mới**: kiểm tra file cấu hình bộ cài Inno
  Setup (`packaging/windows-installer/HeThongBatSo.iss`, dòng 111):
  ```
  Source: "{#SourceRoot}\public\*"; DestDir: "{app}\public"; Flags: onlyifdoesntexist recursesubdirs createallsubdirs
  ```
  Cờ `onlyifdoesntexist` có nghĩa: khi CÀI ĐÈ/NÂNG CẤP (upgrade) trên máy ĐÃ CÓ sẵn thư mục
  `public/` từ lần cài trước, trình cài đặt **SẼ KHÔNG GHI ĐÈ BẤT KỲ FILE NÀO** trong `public/` —
  đây là chủ đích thiết kế ban đầu (giữ lại các tuỳ chỉnh riêng của quản trị viên như màu sắc/logo/
  chữ trong `public/`, tránh bị bộ cài ghi đè mất). Hệ quả: **TẤT CẢ các sửa đổi trong thư mục
  `public/`** trong suốt phiên làm việc này (mục 61 → 74, bao gồm cả sửa lần này) **SẼ KHÔNG được
  áp dụng** trên máy khách hàng chỉ bằng cách chạy lại bộ cài — vì thư mục `public/` đã tồn tại sẵn
  từ lần cài trước đó, bộ cài sẽ tự động BỎ QUA toàn bộ file bên trong.
  - **Cách khắc phục khi triển khai lên máy khách hàng lần này**: trước khi chạy bộ cài mới, cần XOÁ
    THỦ CÔNG thư mục `public/` cũ trong thư mục cài đặt (thường là
    `C:\Program Files\...\HeThongBatSo\public\` hoặc tương tự) — HOẶC đơn giản hơn là copy đè thủ
    công toàn bộ nội dung thư mục `public/` mới (trong bản zip này) vào đúng thư mục `public/` hiện
    có trên máy khách hàng, sau đó khởi động lại server — không cần chạy lại bộ cài đặt đầy đủ.
  - Đây KHÔNG phải lỗi mới sinh ra, mà là hành vi đã có sẵn từ trước của bộ cài — chỉ là lần này cần
    nêu rõ ra vì nó ảnh hưởng trực tiếp tới việc bản sửa lỗi socket.io này (và nhiều bản sửa
    `public/` trước đó) có thực sự tới được máy khách hàng hay không.
- Chưa thể build lại file cài `.exe` thật và cài thử trên máy Windows thật trong môi trường này
  (môi trường hiện tại là Linux, không có công cụ đóng gói Windows) — nhưng phần code phía server
  (`src/server.js`) là phần DUY NHẤT không bị ảnh hưởng bởi vấn đề `onlyifdoesntexist` ở trên (không
  nằm trong `public/`), nên sẽ luôn được cập nhật đúng khi build lại `.exe`/cài lại; phần `public/`
  cần được copy thủ công như hướng dẫn trên.

## 75. Thêm cấu hình `.env` PRIORITY_MODE — chế độ CƠ BẢN chỉ còn "Ưu tiên"/"Đối tượng thường"

- **Yêu cầu của người dùng (nguyên văn, qua 2 lượt)**: "bổ sung thêm 1 cấu hình .evn để thêm mới cơ
  bản chỉ có luồn ưu tiên và không ưu tiên cơ bản. Chỉ có ưu tiên và không ưu tiên. điều chỉnh bổ
  sung cấu hình cả server và widget" rồi "... điều chỉnh bổ sung cấu hình cả server và widget ở tất
  cả các màn hình. từ bốc số bệnh nhân, nhân viên, đến gọi số của tiếp nhận" — tóm lại: hệ thống
  đang có 7 loại đối tượng ưu tiên chi tiết (Cấp cứu, ≥75 tuổi, Trẻ em dưới 6 tuổi, Phụ nữ có thai,
  Khuyết tật đặc biệt nặng, Khuyết tật nặng, Có công với cách mạng), cần thêm 1 biến `.env` để có
  thể GOM tất cả lại thành đúng 2 nhóm — "Ưu tiên" / "Đối tượng thường" — áp dụng đồng bộ ở MỌI màn
  hình (kiosk bốc số bệnh nhân, kiosk cấp số nhân viên, màn hình quầy gọi số, widget Electron).
- **Làm rõ qua câu hỏi**: ở Kiosk công khai (`/kiosk`, bệnh nhân tự bốc số, không có nhân viên xác
  minh), hệ thống hiện TỰ ĐỘNG xác định ưu tiên qua tuổi trên CCCD (≥75 hoặc <6 tuổi, không có màn
  hình cho bệnh nhân tự chọn/tự khai) — người dùng xác nhận GIỮ NGUYÊN đúng cơ chế tự động này, CHỈ
  gộp nhãn hiển thị từ nhiều mã chi tiết (`AGE75`/`CHILD6`/...) thành 1 mã duy nhất "Ưu tiên"
  ("tức là cấu hình .evn tất cả 7 loại ưu tiên gom là thành 1 thay vì nhiều mã chi tiết").
- **Khảo sát kiến trúc hiện có TRƯỚC KHI sửa** (quan trọng, quyết định cách làm): rà toàn bộ
  server (`src/services/ticketService.js`, `src/routes/tickets.js`, `src/routes/counters.js`) và
  hầu hết client (`public/kiosk/kiosk.js`, `public/staff-kiosk/staff-kiosk.js`,
  `public/counter/counter.js`, `public/patient-screen/index.html`, `public/waiting-screen/index.html`)
  — phát hiện TOÀN BỘ các phần này đã được thiết kế từ trước để đọc DANH SÁCH đối tượng ưu tiên
  HOÀN TOÀN ĐỘNG qua API (`GET /api/priority-rules`, `GET /api/tickets/staff-options`), không có
  chỗ nào hardcode cứng "phải có đúng 7/8 loại" — CHỈ CÓ 1 CHỖ DUY NHẤT hardcode cố định 8 nút bấm
  riêng lẻ trong chính file HTML: `public/counter/widget/index.html` (widget siêu nhỏ trên máy
  nhân viên, 8 nút "Cấp số nhanh" gắn cứng từng `id`/`onclick` ứng với từng mã). Nhờ khảo sát này,
  phần lớn thay đổi chỉ cần tập trung ở ĐÚNG 1 NƠI (`src/config/priorityRules.js`) là mọi màn hình
  khác tự "ăn theo" đúng như yêu cầu người dùng, không cần sửa rải rác nhiều nơi.
- **Cách sửa**:
  - **`src/config/priorityRules.js`** (nguồn cấu hình duy nhất): đọc biến mới
    `PRIORITY_MODE` (`process.env.PRIORITY_MODE`, mặc định `full` nếu để trống/sai giá trị).
    Tách 7 rule cũ thành hằng số `FULL_PRIORITY_RULES` (giữ nguyên 100% như trước), thêm hằng số
    mới `BASIC_PRIORITY_RULES` chỉ có 1 rule `{code:'PRIORITY', label:'Ưu tiên', color:'#dc2626'}`
    với `eligible(p)` GỘP đúng điều kiện tự động duy nhất áp dụng được ở Kiosk công khai (tuổi ≥75
    hoặc <6 theo CCCD — y hệt điều kiện cũ của `AGE75`/`CHILD6` gộp lại bằng phép `||`). Biến
    `PRIORITY_RULES` (được mọi nơi khác trong code import) trỏ tới `FULL_PRIORITY_RULES` hoặc
    `BASIC_PRIORITY_RULES` tuỳ `PRIORITY_MODE`. Vì tại Kiosk cấp số — Nhân viên
    (`getAllOptionsForStaff()`) KHÔNG lọc theo `eligible()` (nhân viên được chọn bất kỳ lý do ưu
    tiên nào), ở chế độ basic màn hình đó tự động chỉ còn đúng 2 nút "Ưu tiên"/"Đối tượng thường",
    nhân viên có thể cấp mã "Ưu tiên" cho BẤT KỲ lý do nào (kể cả cấp cứu) chỉ với 1 nút duy nhất —
    đúng tinh thần "chỉ có ưu tiên và không ưu tiên" của yêu cầu.
  - Thêm trường `shortLabel` (nhãn viết tắt 2 ký tự, ví dụ `CC`/`ƯT`/`TT`) vào MỖI rule (cả 2 bộ
    full/basic) và đưa vào kết quả trả về của `getAllOptionsForStaff()`/`getDisplayRules()` — dùng
    để thay thế cách làm CŨ là viết chết 8 nhãn viết tắt trực tiếp trong HTML của widget (xem mục
    dưới), giúp widget tự vẽ đúng nhãn theo đúng chế độ đang bật.
  - **`.env.example`** và **`.env`**: thêm mục `PRIORITY_MODE=full` kèm giải thích chi tiết 2 giá
    trị hợp lệ (`full`/`basic`) và lưu ý về hành vi tại Kiosk công khai; thêm dòng
    `QUICK_QR_CODE_PRIORITY=` (mã QR "cấp nhanh" riêng cho đối tượng gộp "Ưu tiên", chỉ có tác dụng
    khi `PRIORITY_MODE=basic` — 7 dòng `QUICK_QR_CODE_<mã cũ>` khác vẫn giữ nguyên, chỉ mất tác
    dụng khi ở chế độ basic, không cần xoá).
  - **`public/kiosk/kiosk.js`** (`goToPriorityStep()`): dòng tự động dò mã ưu tiên trả về từ server
    sửa từ `options.find(o=>o.code==='AGE75') || options.find(o=>o.code==='CHILD6')` thành thêm ưu
    tiên tìm `'PRIORITY'` trước — hoạt động đúng ở CẢ 2 chế độ (basic trả về `PRIORITY`, full vẫn
    trả về `AGE75`/`CHILD6` như cũ, không phá vỡ hành vi hiện tại).
  - **`public/counter/counter.js`** và **`public/staff-kiosk/staff-kiosk.js`**: mở rộng điều kiện
    tô CHỮ TRẮNG (trước đây chỉ áp dụng cho `EMERGENCY`/`NORMAL`, vì 2 mã này dùng nền màu đậm) để
    áp dụng THÊM cho mã `PRIORITY` (cũng dùng màu đỏ đậm `#dc2626` — xem `priorityRules.js`), tránh
    chữ tối trên nền đỏ đậm bị khó đọc.
  - **`public/counter/widget/index.html` + `public/counter/widget/widget.js`** (thay đổi lớn
    nhất): trước đây 8 nút "Cấp số nhanh" là HTML TĨNH viết chết từng nút (`id="quickIssueEmergency"`,
    `onclick="quickIssueTicket('EMERGENCY')"`...) — ở chế độ basic chỉ còn 2 mã nên 8 nút cố định
    này sai hoàn toàn (thừa nút/sai mã). Đổi sang **VẼ ĐỘNG**: bỏ toàn bộ 8 thẻ `<button>` cứng,
    thay bằng 1 `<span id="quickIssueActions"></span>` rỗng; hàm mới `renderQuickIssueButtons()`
    trong `widget.js` (gọi từ `loadPriorityRules()` — vốn đã fetch `/api/priority-rules` sẵn có
    trước đó) tự vẽ đúng số nút theo đúng danh sách `priorityRules` hiện tại, dùng `shortLabel` làm
    nhãn và `color` làm viền màu (gán qua `style` inline thay vì 1 rule CSS `#id { border: ... }`
    riêng cho từng mã như trước — không còn cách nào khác vì không còn biết trước mã nào tồn tại).
    Đồng bộ sửa `els` (bỏ 8 tham chiếu cứng, chỉ giữ 1 tham chiếu `quickIssueActions`),
    `setQuickIssueButtonsDisabled()` (đổi từ lặp qua `QUICK_ISSUE_BTN_KEYS` cố định sang
    `querySelectorAll('#quickIssueActions button')`), và `quickIssueTicket()` (lấy nhãn hiển thị
    cho hộp thoại xác nhận/phiếu in từ `priorityRules.find()` thay vì tra bảng `QUICK_ISSUE_LABELS`
    viết chết). CSS cũng gộp lại: bỏ 8 rule `#quickIssue<Mã> { border: ... }` + 8 rule `:hover`
    riêng, thay bằng 1 rule nền/viền dùng chung + 1 rule `:hover` dùng chung (màu viền giờ đến từ
    JS, không cần CSS theo từng mã nữa).
  - **Không cần sửa gì thêm** ở: `src/services/ticketService.js`, `src/routes/tickets.js`,
    `src/routes/counters.js` (thứ tự gọi số mặc định/tuỳ chỉnh theo quầy, thống kê chờ theo đối
    tượng... đều đã dùng `getAllOptionsForStaff()`/`getRuleByCode()` động từ trước);
    `public/patient-screen/index.html`, `public/waiting-screen/index.html` (chú thích màu/số đang
    chờ đều fetch `/api/priority-rules` động từ trước); `electron-widget/main.js` (không hardcode
    bất kỳ mã đối tượng ưu tiên nào — widget hoàn toàn "ăn theo" dữ liệu do server trả về qua API).
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật)**:
  - `node --check` trên toàn bộ file `.js` đã sửa (`src/config/priorityRules.js`, `src/server.js`,
    `public/kiosk/kiosk.js`, `public/staff-kiosk/staff-kiosk.js`, `public/counter/counter.js`,
    `public/counter/widget/widget.js`) — không lỗi cú pháp; đếm `{`/`}` và `<div>`/`</div>` trong
    `public/counter/widget/index.html` sau khi sửa — vẫn cân bằng (57 mở/57 đóng dấu ngoặc, 4 mở/4
    đóng thẻ div); grep xác nhận KHÔNG còn sót tham chiếu nào tới 8 id/hàm cũ
    (`quickIssueEmergency`, `QUICK_ISSUE_LABELS`, `QUICK_ISSUE_BTN_KEYS`...).
  - Khởi động thật server (`node src/server.js`) với `PRIORITY_MODE=full` — gọi
    `GET /api/priority-rules` trả về ĐÚNG 8 mã cũ (Cấp cứu...Đối tượng thường) như trước khi sửa,
    xác nhận KHÔNG phá vỡ hành vi mặc định.
  - Khởi động lại với `PRIORITY_MODE=basic` — gọi `GET /api/priority-rules` trả về ĐÚNG 2 mã
    `PRIORITY`("Ưu tiên")/`NORMAL`("Đối tượng thường"); đăng nhập nhân viên thật
    (`POST /api/auth/staff-login`), gọi `GET /api/tickets/staff-options` trả về đúng 2 lựa chọn
    kèm `shortLabel`; tạo 1 quầy thật, gọi `POST /api/tickets/staff` với `priorityCode:"PRIORITY"`
    → tạo vé thành công, đúng `priority_code:"PRIORITY"`; gọi
    `GET /api/counters/:id/priority-order` → thứ tự gọi số mặc định trả về đúng
    `["PRIORITY","NORMAL"]` (tự động theo đúng 2 mã mới, không cần sửa gì ở tầng thứ tự gọi số).
- **Chưa thể tự xem giao diện thật trên Windows** (môi trường hiện tại là Linux, không dựng được
  Electron widget thật để chụp ảnh nút "Cấp số nhanh" vẽ động) — nhưng đã kiểm chứng ĐÚNG dữ liệu
  (mã/nhãn/màu) mà `widget.js` sẽ dùng để vẽ nút thông qua gọi API thật ở trên, và code vẽ nút
  (`renderQuickIssueButtons()`) dùng lại đúng cấu trúc render đã có sẵn, đã hoạt động ổn định từ
  trước cho các cụm khác trên cùng widget (`renderQueueCounts()`). Đổi `PRIORITY_MODE` cần KHỞI
  ĐỘNG LẠI server để áp dụng (biến này chỉ được đọc 1 lần lúc nạp module, không đọc lại theo từng
  request) — không cần sửa/khởi động lại riêng widget Electron, widget luôn lấy danh sách đối
  tượng mới nhất từ server ngay lần tải lại trang kế tiếp.

## 76. `/staff-kiosk/`: nhân viên thao tác chuột và bệnh nhân tự quét CCCD/BHYT ĐỒNG THỜI

- **Yêu cầu của người dùng (nguyên văn)**: "ở hình /staff-kiosk/ nhân viên vừa có thể đồng thời
  thao tác chuột cấp số cho bệnh nhân. bệnh nhân vẫn có thể quét CCCD, thẻ BHYT đồng thời với nhân
  viên y tế".
- **Hành vi CŨ (trước khi sửa)**: tại `/staff-kiosk/`, máy quét (USB kiểu bàn phím, luôn được focus
  ngầm vào ô ẩn `#scanInput` — xem `focusScanInput()`) CHỈ có tác dụng khi nhân viên đã BẤM CHỌN 1
  đối tượng ưu tiên bằng chuột trước (`verifyState.priorityCode` phải khác rỗng — xem
  `startVerify()`/`processScanText()`) để chuyển sang màn hình "Sẵn sàng quét" — mục đích ban đầu
  là XÁC MINH đúng đối tượng nhân viên vừa chọn. Nếu nhân viên CHƯA bấm gì (đang ở màn hình chính
  liệt kê các nút đối tượng), một lượt quét CCCD/BHYT tới sẽ hoàn toàn KHÔNG có tác dụng gì
  (`processScanText()` return sớm) — bệnh nhân buộc phải CHỜ nhân viên bấm chọn trước mới quét
  được, 2 luồng không thể chạy song song.
- **Làm rõ qua câu hỏi**: xác nhận khi bệnh nhân quét thẻ mà nhân viên CHƯA bấm chọn đối tượng nào,
  muốn hệ thống TỰ ĐỘNG cấp số ngay lập tức — giống hệt cách Kiosk công khai (`/kiosk`) hoạt động
  (tự động xét độ tuổi trên CCCD rồi cấp số, không cần ai xác nhận thêm) — để 2 luồng hoạt động
  ĐỘC LẬP: nhân viên rảnh tay bấm chuột cấp số thủ công cho ca này, trong khi bệnh nhân khác vẫn tự
  quét được thẻ của họ mà không cần chờ.
- **Khảo sát trước khi sửa**: xác nhận điểm vào duy nhất của MỌI lượt quét USB là hàm
  `handleScannedText()` (luôn chạy được bất kể đang ở màn hình nào, vì `#scanInput` luôn được giữ
  focus ngầm) — hàm này đã tự tách QR "cấp nhanh" (`processQuickQrScan()`) và QR "đăng nhập nhanh"
  (`tryStaffQrShortcut()`) ra xử lý riêng từ trước (2 luồng đó vốn đã hoạt động "bất kỳ lúc nào"),
  chỉ CÒN lại nhánh quét CCCD/BHYT thường (`processScanText()`) là bị khoá cứng theo
  `verifyState.priorityCode`.
- **Cách sửa**:
  - **`public/staff-kiosk/staff-kiosk.js`**: sửa `processScanText()` — khi `verifyState.priorityCode`
    còn rỗng (nhân viên chưa bấm chọn gì), KHÔNG return sớm nữa mà chuyển sang hàm MỚI
    `autoIssueFromScan(raw)`, tái dùng lại đúng logic tự động xác định đối tượng ưu tiên theo tuổi
    trên CCCD của Kiosk công khai (ưu tiên mã `'PRIORITY'` khi `PRIORITY_MODE=basic` — xem mục 75 —
    rồi đến `'AGE75'`/`'CHILD6'` khi chế độ mặc định `full`, không khớp gì thì xếp `'NORMAL'`), gọi
    thẳng `POST /api/tickets/staff` để tạo vé rồi hiện màn hình "Số thứ tự vừa cấp"
    (`showDoneTicket()`) và in phiếu (`printTicketReceipt()`) — TÁI SỬ DỤNG 2 hàm hiển thị/in này
    (vốn đã dùng chung cho mọi cách cấp số khác trên màn hình), không viết lại logic hiển thị mới.
    Vẫn tôn trọng "cooldown" chống cấp trùng cho cùng 1 người vừa lấy số gần đây (giống Kiosk công
    khai — CHẶN HẲN, không có tuỳ chọn "vẫn cấp số" như luồng thủ công, vì luồng này không có nhân
    viên trực tiếp giám sát/xác nhận từng trường hợp).
  - **QUAN TRỌNG — tránh xung đột dữ liệu giữa 2 luồng chạy song song**: `autoIssueFromScan()`
    KHÔNG đọc/ghi bất kỳ trường nào của `verifyState` (biến toàn cục vốn dành riêng cho luồng THỦ
    CÔNG) — toàn bộ dữ liệu (CCCD/BHYT vừa parse, mã QR gốc...) đều là BIẾN CỤC BỘ trong chính hàm
    này, kể cả khi gọi `printTicketReceipt()` (hàm này vốn đã nhận cccd/bhyt/raw qua THAM SỐ, không
    tự đọc biến toàn cục). Mục đích: nếu đúng lúc 1 lượt quét tự động đang chờ phản hồi server mà
    nhân viên lại bấm chọn 1 đối tượng khác bằng chuột (thay đổi `verifyState` cho luồng thủ công
    của họ), lượt quét tự động vẫn in ĐÚNG thông tin của người đã quét, không bị lẫn dữ liệu.
  - Thêm 1 dòng `#autoScanNotice` (ẩn mặc định) trong `public/staff-kiosk/index.html`, ngay trên
    lưới nút chọn đối tượng — CHỈ dùng để báo kết quả LỖI/BỊ CHẶN TRÙNG của lượt quét tự động
    (`showAutoScanNotice()`, tự ẩn sau 5 giây) MÀ KHÔNG điều hướng màn hình đi đâu — không làm gián
    đoạn bất kỳ thao tác chuột nào nhân viên đang làm dở trên chính màn hình đó. Trường hợp CẤP SỐ
    THÀNH CÔNG không cần dòng này vì đã có màn hình "Số thứ tự vừa cấp" rõ ràng. Cũng thêm 1 dòng
    chú thích ngắn cho nhân viên biết tính năng này tồn tại ("Bệnh nhân cũng có thể tự quét...").
- **Giới hạn đã biết (không phải lỗi mới, là hệ quả tất yếu của 1 màn hình vật lý DUY NHẤT)**: màn
  hình "Số thứ tự vừa cấp" (dùng chung cho MỌI cách cấp số, kể cả luồng tự động mới này) VẪN che
  tạm thời lưới nút chọn đối tượng trong vài giây (mặc định 5 giây, theo `KIOSK_AUTO_CONFIRM_SECONDS`)
  trước khi tự quay lại — đây là hành vi ĐÃ CÓ SẴN áp dụng cho MỌI vé được cấp trên màn hình này từ
  trước tới nay (kể cả cấp thủ công), không phải giới hạn riêng của tính năng lần này. Tương tự,
  nếu nhân viên đang ở giữa bước "Sẵn sàng quét" (đã bấm chọn 1 đối tượng, đang chờ quét xác minh)
  mà một lượt quét của NGƯỜI KHÁC tới đúng lúc đó, hệ thống sẽ hiểu lượt quét đó là để xác minh cho
  đối tượng nhân viên VỪA chọn (không phải luồng tự động) — vì máy quét chỉ có 1 kênh, hệ thống
  không có cách phân biệt "quét này của ai" nếu không dựa vào việc nhân viên đã bấm gì. Trường hợp
  cần tránh nhầm lẫn này, khuyến nghị bố trí 1 máy quét RIÊNG cho khu vực bệnh nhân tự quét (khác
  với luồng nhân viên chủ động xác minh) nếu 2 luồng thường xuyên diễn ra sát nhau về thời điểm.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật)**: `node --check` trên
  `public/staff-kiosk/staff-kiosk.js` — không lỗi cú pháp; đếm `<div>`/`</div>` trong
  `public/staff-kiosk/index.html` sau khi sửa — vẫn cân bằng (29 mở/29 đóng thẻ div); grep xác nhận
  không còn hàm `processScanText`/`autoIssueFromScan`/`showAutoScanNotice` nào bị định nghĩa trùng
  lặp. Khởi động thật server, đăng nhập nhân viên thật, gọi `POST /api/tickets/parse-qr` với 1 CCCD
  giả lập tuổi 76 → xác nhận server trả về đúng mã `AGE75` trong `options` (đúng dữ liệu mà
  `autoIssueFromScan()` sẽ dùng để tự động chọn đối tượng); gọi thẳng `POST /api/tickets/staff` →
  tạo vé thành công. Chưa thể tự mô phỏng ĐÚNG hành vi bàn phím của máy quét USB thật trong môi
  trường này (không có thiết bị quét thật) — nhưng đã xác nhận mọi API mà luồng mới phụ thuộc vào
  đều hoạt động đúng qua lệnh gọi thật, và phần logic JS phía trình duyệt (chọn mã ưu tiên, dựng
  patient object) là code thuần không phụ thuộc DOM/trình duyệt cụ thể nào ngoài các hàm đã kiểm
  chứng sẵn (`showDoneTicket()`/`printTicketReceipt()`).

## 77. Thêm cấu hình `.env` STAFF_KIOSK_SKIP_VERIFY — bỏ hẳn màn hình "Sẵn sàng quét" ở `/staff-kiosk/`

- **Yêu cầu của người dùng (nguyên văn)**: "Ở màn hình /staff-kiosk/ tôi đang ở màn hình Cấp số
  ngay bỏ qua xác minh tôi muốn có tham số .evn bỏ qua bước này đễ cấp số ngay luôn. vì khi nhân
  viên đang xác minh ở bước này vô tình BN quét thẻ của họ thì lại sai thông tin".
- **Hành vi CŨ**: sau khi bấm chọn 1 đối tượng ưu tiên ở màn hình chính, `/staff-kiosk/` LUÔN
  chuyển sang màn hình trung gian "Sẵn sàng quét" (`startVerify()`), tại đó nhân viên có 2 lựa
  chọn: quét CCCD/BHYT để xác minh, hoặc bấm nút "🚀 Cấp số ngay" để bỏ qua xác minh. Đúng như
  người dùng phản ánh: trong lúc màn hình này còn đang MỞ chờ nhân viên quyết định, nếu vừa lúc đó
  có 1 lượt quét của BỆNH NHÂN KHÁC (không liên quan gì đến đối tượng vừa chọn) lọt vào, hệ thống
  hiểu nhầm đó là lượt quét XÁC MINH cho đối tượng đang chờ — gán nhầm thông tin CCCD/BHYT của
  người này cho tấm vé của người kia. Đây là hệ quả trực tiếp của việc mục 76 (thêm luồng "quét độc
  lập") vẫn giữ nguyên "cửa sổ thời gian" này ở nhánh THỦ CÔNG (chỉ luồng tự động mới an toàn).
- **Cách sửa**: thêm biến `STAFF_KIOSK_SKIP_VERIFY` (mặc định `false`, giữ nguyên hành vi cũ):
  - **`src/routes/kioskConfig.js`**: thêm hàm `getStaffKioskSkipVerify()` đọc "tươi"
    `process.env.STAFF_KIOSK_SKIP_VERIFY` mỗi lần gọi (không cache — giống cách làm với
    `KIOSK_AUTO_CONFIRM_SECONDS` đã có sẵn), coi `"true"`/`"1"` là bật. Thêm trường
    `staffKioskSkipVerify` vào response JSON của `GET /api/kiosk-config` (endpoint công khai đã có
    sẵn, `staff-kiosk.js` vốn đã gọi để lấy `autoConfirmSeconds`).
  - **`public/staff-kiosk/staff-kiosk.js`**: `loadKioskConfig()` đọc thêm `staffKioskSkipVerify`
    vào biến module-level cùng tên. Sửa `startVerify(priorityCode)` — nếu biến này bật, KHÔNG hiện
    màn hình "Sẵn sàng quét" nữa mà gọi thẳng hàm mới `issuePriorityImmediately(priorityCode)`: chủ
    động dọn sạch `verifyState` (đặt `priorityCode`/`cccd`/`bhyt`/... về rỗng — tránh sót dữ liệu
    của 1 lần xác minh THỦ CÔNG trước đó, từ lúc biến còn `false`, khiến phiếu in nhầm thông tin
    bệnh nhân cũ) rồi gọi thẳng `createStaffTicket(priorityCode, null)` — tái dùng lại đúng hàm tạo
    vé + hiện màn hình "Số thứ tự vừa cấp" + in phiếu đã có sẵn (dùng chung với mọi cách cấp số
    khác trên màn hình này), không viết lại logic mới.
  - **Vì sao cách này giải quyết TRIỆT ĐỂ vấn đề** (không chỉ tránh né): khi bật
    `STAFF_KIOSK_SKIP_VERIFY=true`, `verifyState.priorityCode` KHÔNG BAO GIỜ còn ở trạng thái "đang
    chờ xác minh" nữa — mỗi lần bấm nút là xử lý xong NGAY LẬP TỨC (đồng bộ, không có khoảng chờ
    người dùng). Nhờ vậy, bất kỳ lượt quét nào tới SAU đó sẽ tự động rơi vào đúng nhánh QUÉT ĐỘC LẬP
    (`autoIssueFromScan()`, thêm ở mục 76) — tự xác định đúng đối tượng cho ĐÚNG người vừa quét,
    thay vì có nguy cơ bị hiểu nhầm là xác minh cho 1 lượt bấm nút TRƯỚC ĐÓ đã xử lý xong từ lâu.
    Nói cách khác: bật biến này không chỉ "ẩn" màn hình trung gian, mà XOÁ HẲN "cửa sổ thời gian" mà
    lỗi gán nhầm thông tin có thể xảy ra.
  - **`.env.example`**: thêm mục `STAFF_KIOSK_SKIP_VERIFY=false` kèm giải thích chi tiết 2 hành vi
    và đúng nguyên nhân/cách khắc phục vấn đề người dùng mô tả.
  - **`.env`** (môi trường thử nghiệm hiện tại): đặt `STAFF_KIOSK_SKIP_VERIFY=true` — theo đúng
    mong muốn của người dùng ("tôi muốn có tham số... để cấp số ngay luôn"), áp dụng NGAY sau khi
    khởi động lại server với bản `.env` này (người dùng khi triển khai lên máy khách hàng thật cũng
    cần đặt giá trị này thành `true` trong `.env` của họ nếu muốn bật, mặc định của `.env.example`
    vẫn là `false` để không thay đổi hành vi cho các cài đặt hiện có khác).
- **Không cần sửa gì thêm** ở `createStaffTicket()`/`showDoneTicket()`/`printTicketReceipt()` (đã
  hoạt động đúng từ trước, tái dùng nguyên vẹn) hay ở luồng "🚀 Cấp số ngay" hiện có trong màn hình
  "Sẵn sàng quét" (`issueWithoutVerify()`) — vẫn giữ nguyên, chỉ áp dụng khi
  `STAFF_KIOSK_SKIP_VERIFY=false` và nhân viên tự bấm nút đó.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật)**: `node --check` trên
  `public/staff-kiosk/staff-kiosk.js`, `src/routes/kioskConfig.js`, `src/server.js` — không lỗi cú
  pháp; grep xác nhận `startVerify`/`issuePriorityImmediately` mỗi hàm chỉ định nghĩa đúng 1 lần
  (không trùng lặp). Khởi động thật server 3 lần với `STAFF_KIOSK_SKIP_VERIFY=true`,
  `STAFF_KIOSK_SKIP_VERIFY=false`, và để trống hoàn toàn — gọi `GET /api/kiosk-config` xác nhận
  ĐÚNG giá trị `staffKioskSkipVerify` tương ứng ở cả 3 trường hợp (mặc định đọc từ `.env` khi biến
  môi trường không được set riêng, đúng `false` khi tắt, đúng `true` khi bật). Đăng nhập nhân viên
  thật, gọi thẳng `POST /api/tickets/staff` (đúng API mà `issuePriorityImmediately()` sẽ gọi) → tạo
  vé thành công. Chưa thể tự bấm chuột thật trên giao diện trong môi trường này (không có trình
  duyệt đồ hoạ) — nhưng đã xác nhận đúng API/luồng dữ liệu mà hàm JS mới phụ thuộc vào hoạt động
  chính xác.

## 78. Thêm cấu hình `.env` SEPARATE_PRIORITY_SEQUENCE — tách 2 dãy số thứ tự riêng (tiền tố T/U)

- **Yêu cầu của người dùng (nguyên văn)**: "bồ sung tham số .evn để cấu hình số thứ tự ưu tiên và
  số thứ tự thường cùng chạy tăng dần trên 2 dãy số thứ tự riêng phân biệt bằn tiền tố T và U. áp
  dụng cho mục phần bốc số bệnh nhân, nhân viên và gọi số".
- **Hành vi CŨ**: chỉ có DUY NHẤT 1 dãy số dùng chung cho toàn bộ vé trong ngày
  (`src/services/sequenceService.js` → bảng `seq(day TEXT PRIMARY KEY, seq INTEGER)`, tăng nguyên
  tử bằng `INSERT ... ON CONFLICT DO UPDATE SET seq = seq + 1 RETURNING seq`) — vé ưu tiên và vé
  thường xen kẽ nhau trong cùng 1 dãy số tăng dần liên tục (001, 002, 003...), không phân biệt được
  bằng con số là loại vé gì nếu không nhìn kèm nhãn/màu.
- **Cách sửa**: thêm biến `SEPARATE_PRIORITY_SEQUENCE` (mặc định `false`, giữ nguyên hành vi cũ),
  cùng 2 biến `PRIORITY_SEQ_PREFIX` (mặc định `U`) và `NORMAL_SEQ_PREFIX` (mặc định `T`):
  - **`src/services/sequenceService.js`**: `getNextTicketNumber(db, seriesKey)` nhận thêm tham số
    tuỳ chọn `seriesKey`. KHÔNG đổi cấu trúc bảng `seq` (tránh phải chạy migration) — tái dùng
    chính cột khoá `day` làm khoá tổng quát hơn: khi có `seriesKey`, khoá thực tế dùng để tăng số
    là `"<ngày>::<seriesKey>"` (ví dụ `2026-09-03::T`, `2026-09-03::U`), nhờ vậy 2 series có 2 hàng
    riêng trong bảng, tăng độc lập nhau. Giá trị `day` TRẢ VỀ cho hàm gọi luôn là chuỗi ngày SẠCH,
    không có hậu tố — vì `tickets.day` và nhiều truy vấn khác (dọn dữ liệu cuối ngày, thống kê,
    lọc `WHERE day = ?`) phụ thuộc vào giá trị này, không được phép làm sai lệch nó.
  - **`src/config/db.js`**: thêm cột mới `ensureColumn(db, 'tickets', 'number_prefix', 'TEXT')` —
    lưu LẠI tiền tố hiển thị ("T"/"U"/rỗng) NGAY TẠI THỜI ĐIỂM TẠO VÉ, không tính lại theo cấu hình
    hiện hành mỗi lần hiển thị. Nhờ vậy các vé đã cấp TRƯỚC KHI bật/tắt/đổi tiền tố trong `.env`
    luôn hiển thị đúng như lúc chúng được cấp, không bị "nhảy" tiền tố nếu sau này đổi cấu hình.
  - **`src/services/ticketService.js`**:
    - Thêm `getSequenceConfig()` đọc "tươi" `process.env.SEPARATE_PRIORITY_SEQUENCE` /
      `PRIORITY_SEQ_PREFIX` / `NORMAL_SEQ_PREFIX` mỗi lần gọi (không cache — theo đúng quy ước đã
      dùng cho `KIOSK_AUTO_CONFIRM_SECONDS`/`STAFF_KIOSK_SKIP_VERIFY` ở các mục trước).
    - `createTicket()`: nếu bật, dùng `seriesKey = 'T'` khi `rule.code === 'NORMAL'`, ngược lại
      `seriesKey = 'U'` — TẤT CẢ các loại vé ưu tiên (cấp cứu, người già, trẻ em... ở chế độ "full",
      hoặc gộp chung "Ưu tiên" ở chế độ "basic", xem mục 75) DÙNG CHUNG 1 dãy U duy nhất, không tách
      riêng theo từng loại — để con số vẫn giữ đúng thứ tự cấp phát thực tế GIỮA các đối tượng ưu
      tiên với nhau (nhiều nơi trong hệ thống dùng `ORDER BY number ASC` làm tiêu chí phụ khi gọi
      nhiều vé cùng 1 hạng ưu tiên, ví dụ `callNextTicketByPriority` — nếu tách lẻ theo từng loại,
      thứ tự này sẽ sai). Lưu tiền tố tương ứng vào cột `number_prefix` mới khi INSERT.
    - `rowToTicket()`: thêm trường `number_prefix` vào object vé trả về — các hàm dùng chung mapper
      này (`getSkippedTickets()`, `getCalledTickets()`, `getCounterCurrentTicket()`...) tự động có
      trường mới mà không cần sửa riêng từng hàm.
    - **Phát hiện quan trọng khi rà lại TỪNG nơi đọc số vé**: `getSkippedNumbersForCounter()` và 1
      đoạn SQL thô bên trong `getDisplaySummary()` (lấy vé hiện tại của từng quầy) KHÔNG đi qua
      `rowToTicket()` — phải sửa tay riêng 2 chỗ này để cũng trả về `number_prefix`
      (`getSkippedNumbersForCounter()` đổi sang trả mảng object `{number, prefix}` thay vì mảng số
      thô; `getDisplaySummary()` thêm trường `currentNumberPrefix` vào từng quầy, và đổi
      `skippedNumbers` ở cấp toàn hệ thống cũng sang mảng object `{number, prefix}`).
  - **`src/services/printerService.js`**: `printTicket()` ghép tiền tố (nếu có) NGAY TRƯỚC khi đệm
    số 0, dùng chung 1 biến `numberText` cho cả bản in giả lập (console log) lẫn bản in ESC/POS
    thật — áp dụng khi `PRINTER_ENABLED=true`.
  - **Cập nhật hiển thị ở TẤT CẢ các màn hình có số vé** (đều chỉ ghép thêm
    `${ticket.number_prefix || ''}` trước số đã đệm 0 sẵn có, không đổi logic đệm số):
    - `public/kiosk/kiosk.js` (`createTicket()` — kiosk công khai cho bệnh nhân tự bấm): số hiển
      thị "vừa cấp" và số trên phiếu in đều dùng chung 1 dòng ghép tiền tố.
    - `public/staff-kiosk/staff-kiosk.js` (`showDoneTicket()`, `printTicketReceipt()` — kiosk cấp
      số cho nhân viên): tương tự.
    - `public/counter/counter.js` (`renderTicket()` — số đang phục vụ tại quầy; và CẢ 2 modal "Xem
      DS bỏ qua"/"DS đã gọi" — 2 chỗ này trùng lặp y hệt nhau nên sửa bằng 1 lệnh thay thế toàn bộ).
    - `public/counter/widget/widget.js` (widget Electron của quầy — `quickIssueTicket()`: thông báo
      "Đã cấp số..." và số truyền cho lệnh in phiếu; `renderTicket()`: số đang phục vụ hiển thị to
      trên widget).
    - `public/patient-screen/index.html` (`update()` — số đang phục vụ hiển thị to cho bệnh nhân
      xem; danh sách số bị bỏ qua `#skippedList` — SỬA THEO ĐÚNG HÌNH DẠNG DỮ LIỆU MỚI, vì
      `skippedNumbers` giờ là mảng object `{number, prefix}` chứ không còn là mảng số thô, nếu
      không sửa sẽ hiện sai thành `"[object Object]"`).
    - `public/waiting-screen/index.html` (bảng số đang phục vụ của từng quầy, và danh sách số bị bỏ
      qua toàn hệ thống — cùng 2 chỗ cần sửa y hệt màn hình bệnh nhân ở trên, cùng lý do).
  - **Cập nhật (đã bổ sung sau, theo yêu cầu tiếp theo của người dùng "tôi muốn loa đọc cả tiền tố
    t và u. mp3 tôi sẽ tự chuẩn bị")**: giới hạn "chỉ đọc số, không đọc tiền tố" ở bản đầu mục 78 đã
    được gỡ bỏ — xem chi tiết cách làm ở mục 79 ngay dưới đây.
  - **`.env.example`**: thêm khối `SEPARATE_PRIORITY_SEQUENCE=false` / `PRIORITY_SEQ_PREFIX=U` /
    `NORMAL_SEQ_PREFIX=T` kèm giải thích chi tiết, cùng phong cách với các khối cấu hình trước.
  - **`.env`** (môi trường thử nghiệm hiện tại): thêm 3 biến trên với giá trị MẶC ĐỊNH TẮT
    (`SEPARATE_PRIORITY_SEQUENCE=false`) — khác với mục 77 (biến đó được bật ngay theo yêu cầu rõ
    ràng "tôi muốn có tham số... để cấp số ngay luôn"), lần này người dùng chỉ yêu cầu "bổ sung
    tham số" (thêm tuỳ chọn) chứ không nói rõ muốn bật ngay, nên để mặc định tắt giống
    `.env.example` — bật lên bất cứ lúc nào chỉ cần sửa `.env` rồi khởi động lại server.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật, không chỉ đọc code)**:
  `node --check` trên toàn bộ file JS đã sửa (`src/config/db.js`, `src/services/sequenceService.js`,
  `src/services/ticketService.js`, `src/services/printerService.js`,
  `public/counter/widget/widget.js`) — không lỗi cú pháp; kiểm tra cân bằng thẻ `<div>` và chạy thử
  từng khối `<script>` bằng `new Function()` trên `public/patient-screen/index.html` và
  `public/waiting-screen/index.html` — không lỗi. Khởi động thật server 2 lần trên cổng riêng:
  - Lần 1 (`SEPARATE_PRIORITY_SEQUENCE=true`): đăng nhập nhân viên thật, gọi `POST
    /api/tickets/staff` xen kẽ NORMAL/PRIORITY nhiều lần — kết quả đúng như thiết kế: T001, U001,
    T002, U002, U003 (2 dãy tăng độc lập, đúng tiền tố). Tạo 1 quầy, gọi số (`call-next`) rồi bỏ
    qua (`skip`) 1 vé ưu tiên — `GET /api/display/summary` xác nhận đúng `currentNumberPrefix:
    "U"` lúc đang phục vụ, và sau khi bỏ qua, `skippedNumbers` đúng hình dạng mảng object
    `{number: 1, prefix: "U"}` ở cả cấp quầy lẫn cấp toàn hệ thống; `GET
    /api/counters/skipped-list` cũng trả đúng `number_prefix: "U"` cho vé đó.
  - Lần 2 (không set `SEPARATE_PRIORITY_SEQUENCE`, tức mặc định tắt — kiểm tra KHÔNG hồi quy): tạo
    NORMAL/PRIORITY/NORMAL liên tiếp → số ra đúng 1, 2, 3 (dùng chung 1 dãy như hành vi cũ),
    `number_prefix` đúng là `null` cho cả 3 vé.
  - Dọn `data/queue.db*` sau mỗi lần chạy thử.
  Chưa thể tự bấm chuột/nghe loa thật trên giao diện trong môi trường này (không có trình duyệt đồ
  hoạ/loa) — nhưng đã xác nhận đúng toàn bộ API/dữ liệu mà các hàm JS mới phụ thuộc vào hoạt động
  chính xác, và đã đọc lại từng dòng JS đã sửa ở cả 5 màn hình để đảm bảo không sót chỗ nào còn dùng
  `String(ticket.number).padStart(3, '0')` mà thiếu tiền tố.

## 79. Loa đọc thêm cả chữ cái tiền tố (T/U) — người dùng tự thu file mp3

- **Yêu cầu của người dùng (nguyên văn)**: "tôi muốn loa đọc cả tiền tố t và u . mp3 tôi sẽ tự
  chuẩn bị" — tiếp nối mục 78, nơi phần phát mp3 (khác với phần đọc dự phòng bằng giọng máy) đang
  chủ động BỎ QUA chữ cái tiền tố vì lúc đó chưa có file ghi âm. Người dùng xác nhận sẽ tự thu file,
  chỉ cần hệ thống đọc được khi có file.
- **Cách sửa — `public/patient-screen/index.html`, hàm `announceTicket()`**: chèn thêm 1 "bước"
  vào mảng `files` (mảng tên file mp3 sẽ phát nối tiếp nhau, xem `playAudioSequence()`), đặt NGAY
  SAU `moi-so-thu-tu` và TRƯỚC các chữ số: `ticket.number_prefix` (nếu có — vé không bật
  `SEPARATE_PRIORITY_SEQUENCE` thì trường này là `null`, không chèn gì, giữ nguyên hành vi cũ) được
  hạ thành CHỮ THƯỜNG rồi dùng LÀM TÊN FILE trực tiếp — tiền tố "U" → tên file `u.mp3`, tiền tố "T"
  → `t.mp3`. Không hard-code cứng 2 chữ cái "T"/"U": nếu sau này người dùng đổi
  `PRIORITY_SEQ_PREFIX`/`NORMAL_SEQ_PREFIX` trong `.env` sang chữ cái khác, hệ thống tự tìm đúng
  file theo tên chữ cái mới đó — chỉ cần người dùng thu thêm file mp3 tương ứng, không cần sửa code
  lần nữa.
  - **Vì sao an toàn khi CHƯA thu xong file**: `<audio>` phát bằng URL `/patient-screen/audio/
    u.mp3` — nếu file này chưa tồn tại, sự kiện `error` của thẻ `<audio>` (cơ chế đã có sẵn từ
    trước, xử lý chung cho MỌI file trong chuỗi, không riêng gì file tiền tố) tự động chuyển sang
    đọc dự phòng bằng giọng máy (`speakFallback()`) cho NGUYÊN CẢ CÂU — không bao giờ bị câm, và
    không cần sửa gì thêm ở phần dự phòng vì `fallbackText` đã được ghép sẵn tiền tố từ mục 78.
- **`public/audio-test/index.html`** (trang thử âm thanh nội bộ, không phải màn hình bệnh nhân
  thật): thêm 1 ô nhập "Tiền tố" (để trống nếu không dùng) cạnh ô nhập số/số quầy sẵn có, để kỹ
  thuật/nhân viên có thể tự nghe thử đúng chuỗi phát ra kèm tiền tố TRƯỚC khi dùng thật — không
  phải mở màn hình bệnh nhân thật + gọi số thật mới nghe thử được.
- **`public/patient-screen/audio/README.txt`** (hướng dẫn thu âm dành cho người dùng, không phải
  code): thêm hẳn 1 mục mới giải thích rõ: cần thu thêm file nào (`t.mp3`, `u.mp3` — hoặc tên chữ
  cái tương ứng nếu đổi cấu hình), thu nội dung gì (đọc rõ tên chữ cái, ví dụ "tê"/"u"), file này
  ghép vào đâu trong câu (ngay sau "Mời bệnh nhân có số thứ tự", trước các chữ số), và xác nhận rõ
  KHÔNG bắt buộc nếu không bật `SEPARATE_PRIORITY_SEQUENCE` — tránh người dùng tưởng nhầm phải thu
  thêm 2 file này mới dùng được hệ thống.
- **Không đổi gì** ở `ticketDigitsForAudio()`/`digitsOf()` (vẫn chỉ tách chữ số như cũ, tiền tố xử
  lý HOÀN TOÀN riêng, không lẫn vào logic tách số) hay ở phần đọc dự phòng bằng giọng máy (đã đúng
  từ mục 78, không cần sửa lại).
- **Đã kiểm chứng bằng công cụ**: `node --check`-tương-đương bằng cách chạy thử từng khối `<script>`
  qua `new Function()` trên cả `public/patient-screen/index.html` và `public/audio-test/index.html`
  — không lỗi cú pháp. Mô phỏng lại CHÍNH XÁC logic ghép mảng `files` bằng 1 đoạn Node độc lập (copy
  nguyên hàm `digitsOf`/`ticketDigitsForAudio`/`counterDigitsForAudio` từ file thật) với 2 trường
  hợp: vé có `number_prefix: 'U'` → mảng đúng
  `['moi-so-thu-tu', 'u', '0', '0', '7', 'vao-quay-so', '0']` (đúng thứ tự, tên file `u.mp3` viết
  thường); vé có `number_prefix: null` → mảng đúng như cũ, KHÔNG có phần tử tiền tố nào chen vào —
  xác nhận không phá vỡ trường hợp mặc định (tắt tính năng tách dãy số). Chưa thể tự phát loa thật
  nghe bằng tai trong môi trường này (không có trình duyệt đồ hoạ/loa, và người dùng chưa gửi file
  mp3 thật) — khi có file `t.mp3`/`u.mp3` thật, khuyến nghị người dùng tự mở `/audio-test` (đã có ô
  nhập tiền tố mới) để nghe thử trước khi dùng thật trên màn hình bệnh nhân.

## 80. Widget quầy CHƯA hiện tiền tố khi tải lại trang + hỏi số thứ tự vượt mốc 999 thì sao

- **Yêu cầu của người dùng (nguyên văn)**: "widget chưa có hiển thị tiền tố u, t trước stt. với lại
  cho mình hỏi nếu stt U hoặc T vượt mốc 999 thì sao ạ".
- **Phần 1 — lỗi widget thiếu tiền tố:**
  - **Nguyên nhân (rà lại TOÀN BỘ đường đi dữ liệu số vé, không chỉ nhìn lại phần đã sửa ở mục
    78)**: mục 78 đã sửa `renderTicket()` trong `widget.js`/`counter.js` để ghép tiền tố — hàm này
    đúng, và các luồng "gọi số ngay lúc đó" (`call-next`, `call-next-priority`, cấp nhanh...) đều
    gọi `renderTicket()` với dữ liệu từ `rowToTicket()` (đã có `number_prefix` từ mục 78) nên hiện
    ĐÚNG. Nhưng route `GET /api/counters/:id/current` trong `src/routes/counters.js` — route DUY
    NHẤT được gọi mỗi khi widget/`  /counter` MỞ LẠI hoặc TẢI LẠI trang (`refreshCounter()` trong
    widget.js, và hàm tương ứng trong `counter.js`, đều gọi thẳng route này để lấy lại số đang phục
    vụ hiện tại) — lại TỰ TAY dựng object `ticket` riêng bằng 1 câu `SELECT *` thô, KHÔNG đi qua
    `rowToTicket()`, nên bị BỎ SÓT trường `number_prefix` (đây là chỗ thứ 3 bị sót ngoài 2 chỗ đã
    tìm thấy ở mục 78 là `getSkippedNumbersForCounter()` và đoạn SQL thô trong `getDisplaySummary()`
    — cùng 1 dạng lỗi: nơi nào KHÔNG dùng `rowToTicket()` thì phải rà tay riêng). Hậu quả đúng như
    người dùng thấy: số đang phục vụ hiện ĐÚNG có tiền tố ngay LÚC VỪA GỌI (vì đi qua
    `renderTicket()` với dữ liệu từ socket event `counter:called` gọi `refreshCounter()` → vẫn qua
    route này!) — thật ra route `/current` được gọi ở CẢ 2 trường hợp (tải lại trang LẪN sau khi
    gọi số qua socket), nên lỗi này khiến tiền tố bị thiếu ở CẢ những lúc thấy có vẻ "vừa gọi xong".
  - **Cách sửa — `src/routes/counters.js`, route `GET /:id/current`**: thêm dòng
    `number_prefix: row.number_prefix || null` (đọc thẳng từ cột `tickets.number_prefix` đã có sẵn
    từ mục 78) vào object `ticket` tự dựng ở đây.
  - **Không cần sửa gì thêm** ở `widget.js`/`counter.js` — `renderTicket()` ở cả 2 file đã ghép tiền
    tố đúng từ mục 78, chỉ là trước đây KHÔNG NHẬN được `number_prefix` từ route này nên luôn ghép
    ra chuỗi rỗng.
- **Phần 2 — số thứ tự vượt mốc 999 thì sao**:
  - **Không có giới hạn cứng ở đâu trong hệ thống chặn số > 999** — cột `seq.seq` và `tickets.number`
    đều là kiểu `INTEGER` của SQLite (thực chất là số nguyên 64-bit, sức chứa vượt xa nhu cầu thực
    tế), không có ràng buộc `CHECK` hay giới hạn độ dài nào trong schema
    (`src/config/db.js`/`ensureColumn`).
  - **Cách hiển thị**: mọi nơi trong hệ thống dùng `String(number).padStart(3, '0')` để ĐỆM đủ 3
    chữ số — khi `number` đã có SẴN từ 3 chữ số trở lên (ví dụ 1000), `padStart(3, ...)` sẽ KHÔNG
    làm gì cả (không cắt bớt, không tràn số) — chuỗi vẫn hiện ĐẦY ĐỦ, đúng, chỉ là không còn đệm số
    0 phía trước nữa. Ví dụ: vé thứ 1000 của dãy U trong ngày sẽ hiện đúng là `U1000` (không phải
    `U999` lặp lại hay bị cắt thành `U000`) ở MỌI màn hình (kiosk, widget, quầy, màn hình bệnh
    nhân/chờ, phiếu in).
  - **Phần âm thanh đọc số (`/patient-screen`)**: cũng KHÔNG bị lỗi — `ticketDigitsForAudio()` tách
    CHUỖI đã đệm ra thành TỪNG CHỮ SỐ MỘT rồi ghép file mp3 tương ứng đọc nối tiếp, số 1000 sẽ tự
    nhiên đọc thành 4 file số nối tiếp ("một, không, không, không") thay vì cố định 3 file như số
    dưới 1000 — vẫn đọc ĐÚNG con số, chỉ là câu đọc dài hơn 1 chữ số so với các số trước đó trong
    cùng ngày, không cần sửa gì thêm.
  - **Vì sao trong thực tế RẤT KHÓ xảy ra**: mỗi dãy số (U hoặc T) chỉ tính RIÊNG trong 1 NGÀY (dùng
    khoá `<ngày>::<seriesKey>` trong bảng `seq`, xem mục 78) — tự động bắt đầu lại từ 1 vào ngày
    hôm sau (`todayKey()` trong `sequenceService.js`). Việc 1 phòng khám/bệnh viện có tới hơn 999
    vé CÙNG 1 LOẠI (chỉ riêng ưu tiên, hoặc chỉ riêng thường) trong CÙNG 1 NGÀY là khối lượng cực
    lớn, khó xảy ra trong vận hành thông thường — nhưng nếu có xảy ra, hệ thống vẫn xử lý đúng, an
    toàn, không cần cấu hình gì thêm.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật)**: `node --check` trên
  `src/routes/counters.js` — không lỗi cú pháp. Khởi động thật server với
  `SEPARATE_PRIORITY_SEQUENCE=true`, đăng nhập nhân viên thật, tạo 1 quầy, cấp 1 vé ưu tiên, gọi số
  vé đó vào quầy, rồi gọi TRỰC TIẾP `GET /api/counters/:id/current` (đúng route widget/`/counter`
  gọi khi tải lại trang) — xác nhận response ĐÃ có `ticket.number_prefix: "U"` (trước khi sửa, kiểm
  tra lại thấy trường này hoàn toàn không xuất hiện trong response, đúng như lỗi người dùng mô tả).
  Kiểm chứng riêng phần vượt mốc 999: chỉnh thẳng giá trị `seq` trong CSDL thử nghiệm lên 999 rồi
  gọi `POST /api/tickets/staff` cấp thêm 1 vé ưu tiên — kết quả trả về đúng `number: 1000,
  number_prefix: "U"`, không lỗi, không bị cắt số. Dọn `data/queue.db*` sau khi thử xong.

## 81. Thêm tính năng "cấp nhiều số" — chọn đối tượng ưu tiên + số lượng ở `/staff-kiosk/`

- **Yêu cầu của người dùng (nguyên văn)**: "Thêm mới chức năng cấp nhiều số bằng cách chọn đối
  tượng ưu tiên và số lượng sô cần cấp trong màn hình kiosk-staff được không ạ" — dùng khi nhân
  viên cần cấp sẵn 1 xấp phiếu cho cùng 1 đối tượng (ví dụ in trước 10 phiếu "Đối tượng thường" cho
  1 đoàn khách) mà không cần lặp lại thao tác bấm/quét cho từng số.
- **Thiết kế**: tính năng này về bản chất là "cấp số ngay — bỏ qua xác minh" (đã có sẵn, xem mục
  77) lặp lại N lần cho CÙNG 1 đối tượng trong 1 lần bấm — vì vậy KHÔNG có chỗ nào để gắn thông tin
  bệnh nhân riêng cho từng vé trong 1 lô (không giấy tờ, giống hệt các nút "Cấp số ngay"/"cấp
  nhanh" hiện có).
- **`src/routes/tickets.js`**: thêm route mới `POST /api/tickets/staff-batch` (yêu cầu đăng nhập
  nhân viên, `requireStaff`), nhận `{ priorityCode, quantity }`:
  - Kiểm tra `priorityCode` hợp lệ (dùng lại `getRuleByCode()` có sẵn) và `quantity` là số nguyên
    ≥ 1, đồng thời KHÔNG được vượt quá giới hạn cấu hình `STAFF_BATCH_MAX_QUANTITY` (mặc định 50) —
    chặn tình huống nhân viên gõ nhầm 1 số quá lớn (ví dụ "1000" thay vì "10") khiến in tràn lan
    gây lãng phí giấy/quá tải máy in.
  - Tạo TỪNG vé một bằng vòng lặp đồng bộ, mỗi vé đi qua ĐÚNG hàm `createTicket()` dùng chung với
    mọi nơi khác trong hệ thống (tự động ghép tiền tố T/U nếu bật `SEPARATE_PRIORITY_SEQUENCE` —
    mục 78, tự động tăng đúng dãy số) — không viết lại logic sinh số riêng cho tính năng này. Gọi
    `printTicket()` (in phía server, chỉ có tác dụng khi `PRINTER_ENABLED=true`) tuần tự cho từng
    vé, CHỜ XONG vé này mới tạo vé tiếp theo.
  - Chỉ phát 1 lần `queue:summary` (qua `broadcastSummary()`) SAU KHI đã tạo xong CẢ LÔ — tránh làm
    các màn hình khác (kiosk, quầy, màn hình chờ...) "nhấp nháy" cập nhật liên tục N lần trong vài
    giây, chỉ cần đúng số liệu MỚI NHẤT sau khi cấp xong toàn bộ lô.
  - Trả về `{ tickets: [...], prints: [...] }` (mảng thay vì 1 vé như route `/staff` cũ) theo ĐÚNG
    thứ tự vừa tạo.
- **`src/routes/kioskConfig.js`**: thêm `getStaffBatchMaxQuantity()` (đọc "tươi"
  `STAFF_BATCH_MAX_QUANTITY` mỗi lần gọi, không cache — theo đúng quy ước các biến trước), export
  ra để `tickets.js` dùng LẠI CHUNG 1 hàm này (tránh định nghĩa 2 nơi rồi lệch giá trị mặc định nếu
  sau này sửa 1 chỗ quên sửa chỗ kia) — giá trị này cũng được thêm vào response của
  `GET /api/kiosk-config` (endpoint công khai có sẵn) dưới tên `staffBatchMaxQuantity`, để giao
  diện có thể hiển thị đúng giới hạn thật (dù bản này chưa dùng tới, để dành nếu sau cần hiện rõ
  giới hạn lên màn hình).
- **`public/staff-kiosk/index.html`**: thêm 1 khối `#batchQtyInput` (ô nhập số, mặc định `1`) ngay
  phía trên lưới các nút đối tượng ưu tiên, kèm dòng chú thích ngắn giải thích cách dùng. Thêm mới
  khối `#step-batch-done` (tương tự `#step-done` sẵn có nhưng hiện SỐ LƯỢNG + KHOẢNG SỐ đã cấp,
  thay vì 1 con số duy nhất).
- **`public/staff-kiosk/staff-kiosk.js`**:
  - Đổi `onclick` của MỌI nút đối tượng ưu tiên (trong `loadPriorityOptions()`) từ gọi thẳng
    `startVerify(code)` sang gọi `handlePriorityClick(code)` — hàm trung gian MỚI: đọc giá trị ô
    `#batchQtyInput` (`getBatchQuantity()`), nếu > 1 thì chuyển sang nhánh CẤP HÀNG LOẠT MỚI
    (`confirmAndIssueBatch()` → `issueBatch()`); nếu vẫn là 1 (mặc định, hoặc nhân viên không dùng
    tới ô này) thì gọi thẳng `startVerify(code)` — GIỮ NGUYÊN 100% hành vi cũ (kể cả vẫn tuỳ theo
    `STAFF_KIOSK_SKIP_VERIFY`), không có gì thay đổi cho luồng cấp số bình thường hiện có.
  - `confirmAndIssueBatch()`: hỏi xác nhận bằng `confirm()` trước khi cấp (cùng tinh thần với nút
    "cấp nhanh" đã có ở widget Electron, mục 75) — tránh cấp nhầm hàng chục số chỉ vì bấm nhầm nút/
    quên đổi lại số lượng.
  - `issueBatch()`: gọi API mới, hiện NGAY màn hình kết quả (`showBatchDoneTickets()`) rồi mới in
    LẦN LƯỢT từng phiếu (vòng lặp `for...of` với `await` — cố ý, không phải quên `await` trong
    vòng lặp), tránh bắn ra hàng loạt lệnh in/cửa sổ in dialog chồng lên nhau cùng lúc khi không có
    máy in ESC/POS hoặc cầu nối in cục bộ của widget trả lời ngay.
  - `printTicketReceipt()`: đổi `printReceipt({...})` (câu lệnh gọi cuối hàm, TRƯỚC ĐÂY không lấy
    kết quả gì cả) thành `return printReceipt({...})` — CHỈ thêm khả năng cho nơi gọi MỚI (
    `issueBatch()`) có thể `await` để in tuần tự; các nơi gọi CŨ (`createStaffTicket()`,
    `processQuickQrScan()`) không đổi gì (vẫn không `await`), không ảnh hưởng hành vi hiện có.
  - `showBatchDoneTickets()`: hiện số lượng vé + khoảng số (ví dụ "T006 → T010"), màu theo đúng màu
    đối tượng, rồi tự động đếm ngược quay lại màn hình chính — thời gian đếm ngược LẤY GIÁ TRỊ LỚN
    HƠN giữa `KIOSK_AUTO_CONFIRM_SECONDS` (dùng chung với `#step-done`) và ước lượng 1.5 giây/phiếu
    theo đúng số lượng vừa cấp — tránh tự quay về màn hình chính trong lúc vẫn còn đang in dở lô.
  - `focusScanInput()`: mở rộng điều kiện bỏ focus ô quét ẩn sang CẢ màn hình `#step-batch-done`
    mới (trước đó chỉ loại trừ `#step-done`) — tránh cướp focus trong lúc các hộp thoại in liên
    tiếp đang hiện/đóng khi cấp hàng loạt.
  - `resetForm()`: dọn thêm bộ đếm ngược + ẩn màn hình `#step-batch-done` (trước đó chỉ xử lý
    `#step-done`/`#step-verify`).
- **`.env.example`/`.env`**: thêm `STAFF_BATCH_MAX_QUANTITY=50` kèm giải thích chi tiết, cùng
  phong cách với các khối cấu hình trước.
- **Không cần sửa** `createTicket()`/`sequenceService.js`/schema CSDL — tính năng này hoàn toàn tái
  dùng hạ tầng đã có (sinh số, tiền tố T/U nếu bật, migrate cột...) từ các mục trước, chỉ thêm 1
  đường gọi API mới lặp lại đúng logic tạo vé đơn lẻ.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy máy chủ thật)**: `node --check` trên
  `src/routes/tickets.js`, `src/routes/kioskConfig.js`, `public/staff-kiosk/staff-kiosk.js` — không
  lỗi cú pháp; chạy thử từng khối `<script>` của `public/staff-kiosk/index.html` qua `new
  Function()` và đếm cân bằng thẻ `<div>` — không lỗi. Khởi động thật server với
  `SEPARATE_PRIORITY_SEQUENCE=true`, đăng nhập nhân viên thật:
  - Gọi `GET /api/kiosk-config` — xác nhận có thêm trường `staffBatchMaxQuantity: 50`.
  - Gọi `POST /api/tickets/staff-batch` với `{priorityCode:"NORMAL", quantity:5}` — nhận đúng 5 vé
    liên tiếp `T001`...`T005` (đúng tiền tố, đúng thứ tự), mỗi vé có `print.simulated: true` kèm
    đúng nội dung phiếu tương ứng (`SO THU TU: T001`...`T005`).
  - Gọi lại với `quantity:0` — bị từ chối đúng thông báo lỗi "phải là số nguyên từ 1 trở lên".
  - Gọi lại với `quantity:999` (vượt mặc định 50) — bị từ chối đúng thông báo lỗi kèm đúng số 50.
  - Gọi KHÔNG kèm cookie đăng nhập — nhận đúng mã lỗi `401`.
  - `GET /api/display/summary` sau đó xác nhận đúng `waitingCount: 5`, `waitingByPriority` đúng 5
    vé NORMAL đang chờ — không lệch dữ liệu so với số vé thực tế đã tạo.
  Dọn `data/queue.db*` sau khi thử xong. Chưa thể tự bấm chuột/xem hộp thoại in thật trên giao diện
  trong môi trường này (không có trình duyệt đồ hoạ) — nhưng đã xác nhận đúng toàn bộ API/dữ liệu
  mà `handlePriorityClick()`/`issueBatch()`/`showBatchDoneTickets()` phụ thuộc vào hoạt động chính
  xác, và đã đọc lại từng dòng JS mới thêm để đảm bảo không phá vỡ luồng cấp số 1-số-1-lần hiện có
  (đường `qty === 1` giữ nguyên gọi thẳng `startVerify()` như trước khi có tính năng này).

## 82. Widget: thêm cấu hình tự động mở fullscreen kiosk bốc số bệnh nhân khi khởi động

- **Yêu cầu của người dùng (nguyên văn)**: "widget bổ sung thêm 1 cấu hình tự động mở fullscreen
  kiosk bốc số của bệnh nhân khi khởi động".
- **Tận dụng hạ tầng có sẵn**: `electron-widget/main.js` đã có sẵn `openKioskWindow()` (dùng cho
  mục "Mở kiosk bốc số – Bệnh nhân (/kiosk)" trong menu khay hệ thống) — mở đúng cửa sổ toàn màn
  hình, tự chờ kết nối lại nếu máy chủ chưa sẵn sàng, tự ẩn/hiện lại widget khi mở/đóng kiosk. Tính
  năng mới chỉ cần THÊM cấu hình bật/tắt + gọi lại đúng hàm này lúc khởi động, không viết lại logic
  mở cửa sổ nào.
- **`electron-widget/config.js`**: thêm `autoOpenKioskOnStartup: false` (mặc định TẮT — giữ nguyên
  hành vi cũ cho các bản cài đặt hiện có, chỉ hiện widget như trước, tránh đổi hành vi ngoài ý
  muốn).
- **`electron-widget/main.js`**:
  - Trong `app.whenReady()`, thêm 1 dòng `if (config.autoOpenKioskOnStartup) openKioskWindow();`
    NGAY SAU `createWidgetWindow()` (quan trọng: phải sau, không phải trước) — để
    `openKioskWindow()` ghi nhận ĐÚNG trạng thái "widget đang hiện" trước khi ẩn nó đi (biến
    `widgetWasVisibleBeforeKiosk` có sẵn từ trước), nhờ vậy nếu sau này người dùng đóng cửa sổ
    kiosk, widget sẽ tự hiện lại đúng như trường hợp mở kiosk thủ công qua tray.
  - Thêm 1 mục checkbox mới trong menu tray: **"Tự động mở kiosk bốc số khi khởi động"** (cùng
    nhóm với "Luôn nổi bên trên"/"Khởi động cùng Windows" đã có) — bấm tích/bỏ tích áp dụng NGAY
    LẬP TỨC (mở hoặc đóng cửa sổ kiosk ngay, không cần khởi động lại ứng dụng), đúng tinh thần các
    mục checkbox khác trong menu này.
- **`electron-widget/README.md`**: thêm mục giải thích tính năng mới vào danh sách các mục trong
  menu tray.
- **PHÁT HIỆN QUAN TRỌNG khi kiểm chứng thật (cần lưu ý khi dùng)**: màn hình `/kiosk` (bốc số bệnh
  nhân) nằm trong danh sách đường dẫn YÊU CẦU ĐĂNG NHẬP NHÂN VIÊN ở tầng server
  (`GATED_PATH_PREFIXES` trong `src/server.js`, xem thêm mục 22 — đây là thiết kế bảo mật đã có từ
  trước, không phải điều tính năng này tạo ra) — phiên đăng nhập được lưu Ở BỘ NHỚ server (không
  lưu CSDL), hết hạn sau 12 giờ HOẶC bị xoá ngay khi khởi động lại chính máy chủ (server). Nghĩa là
  tính năng "tự động mở fullscreen kiosk khi khởi động" sẽ có 2 khả năng, tuỳ tình huống thực tế:
  - **NẾU trên máy đó đã từng đăng nhập nhân viên trước đó VÀ phiên đăng nhập đó CÒN HIỆU LỰC**
    (chưa đăng xuất, chưa quá 12 giờ, VÀ máy chủ chưa khởi động lại từ lúc đăng nhập đó) — widget
    khởi động lại sẽ mở THẲNG đúng màn hình bốc số toàn màn hình như mong đợi, không cần thao tác
    gì thêm.
  - **NẾU CHƯA từng đăng nhập trên máy đó, hoặc phiên đã hết hạn/máy chủ đã khởi động lại** — cửa
    sổ mở toàn màn hình sẽ hiện màn hình "chọn vai trò/đăng nhập" (trang chủ) thay vì màn hình bốc
    số, vì bị chuyển hướng đúng theo cơ chế bảo mật có sẵn — nhân viên cần đăng nhập 1 lần (hoặc
    quét mã QR đăng nhập), sau đó các lần khởi động lại tiếp theo (miễn máy chủ không khởi động
    lại) sẽ tự vào thẳng kiosk như mong muốn.
  - Đây LÀ HÀNH VI ĐÚNG theo đúng thiết kế bảo mật hiện có của hệ thống (ngăn máy lạ trên cùng
    mạng LAN truy cập thẳng các màn hình vận hành mà không qua đăng nhập) — không phải lỗi của
    tính năng mới, nhưng người dùng CẦN BIẾT để không nhầm tưởng tính năng bị hỏng nếu gặp đúng
    trường hợp thứ 2 ở trên. Nếu muốn kiosk luôn tự vào thẳng mà không phụ thuộc phiên đăng nhập
    (kể cả sau khi khởi động lại máy chủ), cần một thay đổi khác ở tầng bảo mật (ví dụ: bỏ `/kiosk`
    ra khỏi `GATED_PATH_PREFIXES` hẳn, hoặc thêm 1 cơ chế "đăng nhập máy" riêng) — CHƯA làm trong
    mục này vì người dùng chỉ yêu cầu thêm cấu hình tự mở, chưa yêu cầu đổi cơ chế bảo mật; báo lại
    nếu cần.
- **Đã kiểm chứng bằng công cụ (kiểm chứng THẬT bằng cách chạy đúng ứng dụng Electron thật, không
  chỉ đọc code)**: `node --check` trên `electron-widget/main.js`, `electron-widget/config.js` —
  không lỗi cú pháp. Chạy THẬT ứng dụng Electron (qua `xvfb-run`, có sẵn trong môi trường) với
  `autoOpenKioskOnStartup: true` trỏ vào 1 server thật đang chạy:
  - Trường hợp CHƯA đăng nhập (cookie trống): xác nhận cửa sổ kiosk mở lên đúng là bị chuyển hướng
    về `/?next=%2Fkiosk%2F` (đúng như phân tích ở trên, không phải lỗi).
  - Sau đó MÔ PHỎNG 1 phiên đăng nhập thật: gọi đúng API `POST /api/auth/staff-login` lấy 1
    `staff_token` hợp lệ thật, ghi thẳng vào đúng cookie store của Electron (đúng partition
    `persist:queue-widget` mà widget dùng, có `flushStore()` để ghi xuống đĩa như 1 phiên thật sẽ
    được lưu) — mô phỏng đúng trạng thái "máy này đã từng đăng nhập trước đó".
  - Khởi động LẠI ứng dụng Electron (tiến trình mới hoàn toàn, cùng thư mục dữ liệu người dùng) với
    `autoOpenKioskOnStartup: true` — xác nhận: (1) cookie `staff_token` được đọc lại đúng lúc khởi
    động (còn nguyên trên đĩa), và (2) cửa sổ kiosk lần này tải THẲNG đúng `/kiosk/` (không còn bị
    chuyển hướng) — đúng như mong đợi ở "khả năng 1" nêu trên.
  Xác nhận ứng dụng không văng lỗi/crash ở cả 2 trường hợp trong suốt thời gian chạy thử. Dọn hết
  các thư mục dữ liệu người dùng thử nghiệm (`--user-data-dir` riêng) và tắt server thử nghiệm sau
  khi kiểm tra xong.

## 83. Cải tiến tính năng "cấp nhiều số" ở `/staff-kiosk/` — nút tăng/giảm, tự reset, xác nhận trước khi in

- **Yêu cầu của người dùng (nguyên văn)**: "ở màn hình `/staff-kiosk/` thêm mới các nút tăng giảm 1
  đơn vị, tăng giảm 10 đơn vị vì màn hình này người dùng sử dụng máy quét để cấp số - input Số
  lượng cần cấp tự động reset về 1 sau khi cấp nhiều số xong để tránh sai sót - Đối với cấp nhiều số
  phải có confirm bạn có muốn cấp nhiều không OK thì mới chạy in stt".
- **Ý (3) — xác nhận trước khi in — ĐÃ CÓ SẴN từ mục 81, không cần sửa gì thêm**: rà lại luồng
  `handlePriorityClick()` → `confirmAndIssueBatch()` → `issueBatch()` xác nhận: khi số lượng > 1,
  `confirmAndIssueBatch()` LUÔN gọi `confirm()` (hộp thoại "Xác nhận cấp NHANH N số...") và CHỈ gọi
  tiếp `issueBatch()` (hàm vừa tạo vé VỪA in phiếu) nếu người dùng bấm OK — bấm Huỷ thì dừng lại,
  không tạo vé, không in gì cả. Không có đường nào trong code hiện tại có thể bỏ qua bước xác nhận
  này khi số lượng > 1.
- **Ý (1) — nút tăng/giảm nhanh — `public/staff-kiosk/index.html`**: thêm 4 nút `−10`/`−1`/`+1`/
  `+10` bao quanh ô `#batchQtyInput` (nhóm `.qty-step-group`) — vì màn hình này chủ yếu thao tác
  bằng máy quét/chạm, gõ số bằng bàn phím ảo bất tiện hơn nhiều so với bấm nút trực tiếp.
- **`public/staff-kiosk/staff-kiosk.js`**:
  - Thêm `setBatchQuantity(value)` — đặt thẳng giá trị ô nhập về 1 số nguyên hợp lệ (làm tròn
    xuống, không bao giờ cho về dưới 1).
  - Thêm `stepBatchQuantity(delta)` — dùng cho 4 nút mới, LUÔN cộng/trừ dựa trên giá trị HIỆN TẠI
    đã được `getBatchQuantity()` chuẩn hoá trước (không đọc thẳng `input.value` thô, tránh cộng trừ
    sai nếu ô đang chứa giá trị rác/rỗng).
  - Thêm `resetBatchQuantity()` — gọi `setBatchQuantity(1)`.
- **Ý (2) — tự động reset về 1 sau khi cấp xong**: gọi `resetBatchQuantity()` ngay trong
  `issueBatch()`, NGAY SAU KHI nhận phản hồi THÀNH CÔNG từ server (`data.tickets` không rỗng) —
  đặt TRƯỚC KHI bắt đầu in (không đợi in xong hết cả lô), để nhân viên bấm sang đối tượng khác
  ngay trong lúc lô trước còn đang in dở sẽ KHÔNG bị vô tình dùng lại đúng số lượng của lô TRƯỚC ĐÓ.
  Nếu request THẤT BẠI (lỗi mạng, lỗi server, vượt `STAFF_BATCH_MAX_QUANTITY`...) thì KHÔNG reset —
  giữ nguyên số lượng nhân viên đã nhập để họ có thể sửa/thử lại ngay mà không phải gõ lại từ đầu.
- **Không cần sửa** `handlePriorityClick()`/`confirmAndIssueBatch()`/route
  `POST /api/tickets/staff-batch` — cả 3 phần này đã đúng từ mục 81, chỉ bổ sung thêm cách nhập
  liệu (nút bấm) và dọn lại trạng thái ô nhập sau khi dùng xong.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `public/staff-kiosk/staff-kiosk.js` — không
  lỗi cú pháp; chạy thử từng khối `<script>` của `index.html` qua `new Function()` và đếm cân bằng
  thẻ `<div>`/`<button>` — không lỗi, không thiếu thẻ đóng. Mô phỏng lại CHÍNH XÁC logic
  `getBatchQuantity()`/`setBatchQuantity()`/`stepBatchQuantity()` bằng 1 đoạn Node độc lập với các
  trường hợp: từ 1 bấm `−10` → vẫn ra đúng 1 (bị chặn ở mức tối thiểu, không cho về 0/âm); từ 5 bấm
  `−1` → ra đúng 4; từ 5 bấm `+10` → ra đúng 15; ô đang rỗng bấm `+1` → ra đúng 2 (đọc ô rỗng như
  1, rồi +1) — tất cả đúng như kỳ vọng. Đã đọc lại toàn bộ luồng `issueBatch()` để xác nhận thứ tự
  đúng: xác nhận (`confirm()`) → gọi API tạo vé → CHỈ reset số lượng SAU KHI server xác nhận tạo vé
  thành công → mới bắt đầu in — không có đường nào in trước khi có xác nhận hoặc trước khi vé thực
  sự được tạo trong CSDL.

## 84. Sửa lỗi in hàng loạt chỉ ra 1 lệnh in + đổi nút ±10 thành ±9 và thêm nút Reset + widget bắt buộc bỏ qua đăng nhập ở `/kiosk`

- **Yêu cầu của người dùng (nguyên văn)**: "kiểm tra lại phần in hàng loạt nhiều stt tiếp nhận
  widget nó chỉ có 1 lệnh in duy nhất. ở màn hình staff-kiosk điều chỉnh nút +- 10 thành +- 9 -
  thêm mới nút Reset để reset số lượng cần cấp về 1. widget bạn phải bắt buộc phải bỏ qua đăng nhập
  chọn quầy đối với màn hình kiosk cấp số cho bệnh nhân cho dù có restart server hay tắt widget mở
  lại". Ba việc tách biệt, xử lý lần lượt bên dưới.

### A. Lỗi "in hàng loạt chỉ ra 1 lệnh in duy nhất"

- **Nguyên nhân gốc**: cầu nối in của widget (`electron-widget/preload.js` gọi
  `ipcRenderer.send('print-ticket', ...)`, `electron-widget/main.js` nhận bằng
  `ipcMain.on('print-ticket', ...)`) dùng kiểu IPC "bắn đi rồi thôi" (fire-and-forget) — hàm
  `print()` phía trang web trả về NGAY LẬP TỨC, không đợi lệnh in thật sự (xuất PDF, gọi
  SumatraPDF...) chạy xong. Vòng lặp cấp nhiều số (`issueBatch()` trong
  `public/staff-kiosk/staff-kiosk.js`) có `await printTicketReceipt(...)` TƯỞNG là đang chờ từng
  phiếu in xong mới in phiếu tiếp theo, nhưng vì `await` ở đây kết thúc gần như ngay lập tức (không
  đợi lệnh in thật xong), toàn bộ N lệnh in bị bắn đi gần như CÙNG LÚC. N lệnh in này lại dùng
  CHUNG 1 phần tử DOM `#printReceipt` trên cùng cửa sổ nguồn (bị nội dung phiếu SAU ghi đè lên
  trước khi phiếu TRƯỚC kịp chụp xong thành PDF) — kết quả là chỉ 1 (hoặc vài) phiếu in đúng nội
  dung, các phiếu còn lại bị mất/sai hoặc không có lệnh in nào thực sự tách biệt.
- **Sửa** (3 file, đúng gốc rễ chứ không chỉ vá triệu chứng):
  - `electron-widget/preload.js`: đổi `ipcRenderer.send('print-ticket', ...)` →
    `ipcRenderer.invoke('print-ticket', ...)` (kiểu IPC CÓ chờ phản hồi thật từ tiến trình chính).
  - `electron-widget/main.js`: đổi `ipcMain.on('print-ticket', ...)` →
    `ipcMain.handle('print-ticket', ...)`, khớp với `invoke()` ở trên.
  - `public/print-receipt.js`: nhánh gọi `window.electronPrint.print(...)` trước đây gọi xong
    `return;` ngay mà KHÔNG trả về giá trị — dù 2 file trên đã đổi sang `invoke()`/`handle()`, nếu
    không `return` thẳng Promise đó thì hàm `printReceipt()` (đang là `async function`) vẫn kết
    thúc/`resolve()` ngay lập tức như cũ. Sửa thành `return window.electronPrint.print(...)` để lời
    gọi `printReceipt()` bên ngoài THẬT SỰ chờ đến khi in xong (hoặc lỗi) mới tiếp tục.
  - `electron-widget/main.js` — hàm `printTicketSilently()`: nhánh dự phòng (chỉ chạy khi thư viện
    `pdf-to-printer` chưa cài) dùng API `win.webContents.print({...}, (success, errorType) => {...})`
    kiểu callback CŨ, không phải Promise — nếu không bọc lại, nhánh này vẫn sẽ trả về sớm dù đã có
    `ipcMain.handle()`. Đã bọc lại bằng `new Promise((resolve) => { win.webContents.print(..., () =>
    { ...; resolve(); }) })` để nhánh dự phòng cũng chờ đúng.
  - Thêm phòng xa: tên file PDF tạm (`phieu-so-thu-tu-${Date.now()}.pdf`) nay có thêm 6 ký tự ngẫu
    nhiên (`crypto.randomBytes(3).toString('hex')`) phía sau, để tránh trùng tên trong trường hợp
    hiếm — 2 cửa sổ KHÁC NHAU (ví dụ `/kiosk` và `/staff-kiosk` cùng in gần như đồng thời trên cùng
    máy) rơi đúng cùng 1 mili-giây. Đã cập nhật lại biểu thức nhận diện file cũ cần dọn trong
    `cleanupOldTempPdfs()` cho khớp định dạng tên file mới (vẫn chỉ xoá file cũ hơn 1 giờ như cũ).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên cả 3 file sửa — không lỗi cú pháp. Dựng lại
  CHÍNH XÁC cơ chế `ipcMain.handle()`/`ipcRenderer.invoke()` bằng 1 ứng dụng Electron thật riêng
  biệt (chạy thật qua `xvfb-run`, không phải giả lập): 1 handler "chậm" (giả lập việc in mất
  200ms/lần) được gọi tuần tự 4 lần bằng `for` + `await` từ phía trang web — log ghi nhận ĐÚNG thứ
  tự hoàn tất `1,2,3,4` (không có lệnh nào bị chồng lên lệnh khác), xác nhận `invoke()`/`handle()`
  THẬT SỰ nối tiếp hoá (serialize) các lệnh gọi liên tiếp, đúng cơ chế vừa áp dụng cho cầu nối in.
  Do máy chủ đang chạy trong môi trường thử nghiệm không có máy in vật lý/driver Windows thật để in
  thử 1 lô nhiều số bằng chính máy in nhiệt, phần xác minh này dừng ở việc chứng minh CƠ CHẾ IPP
  (nguyên nhân gốc gây lỗi) đã được sửa đúng — khuyến nghị người dùng thử lại 1 lô 3-5 số ngay trên
  máy có máy in nhiệt thật để xác nhận cả 3-5 phiếu đều ra giấy đúng nội dung, đúng thứ tự.

### B. Đổi nút ±10 thành ±9, thêm nút Reset ở `/staff-kiosk/`

- `public/staff-kiosk/index.html`: đổi 2 nút `−10`/`+10` (gọi `stepBatchQuantity(-10)`/
  `stepBatchQuantity(10)`) thành `−9`/`+9` (gọi `stepBatchQuantity(-9)`/`stepBatchQuantity(9)`) —
  cả thuộc tính `onclick` lẫn nhãn hiển thị trên nút. Thêm 1 nút mới "Reset" ngay cạnh, gọi thẳng
  `resetBatchQuantity()` (hàm này đã có sẵn từ mục 83, trước đây chỉ dùng để TỰ ĐỘNG reset sau khi
  cấp xong 1 lô — nay dùng lại cho cả nút bấm thủ công). Không cần sửa gì ở
  `public/staff-kiosk/staff-kiosk.js` vì 2 hàm `stepBatchQuantity()`/`resetBatchQuantity()` đã có
  sẵn và hoạt động đúng.
- **Đã kiểm chứng bằng công cụ**: đếm số thẻ `<button>` mở/đóng trong `index.html` bằng script Node
  độc lập — ra đúng 12/12 (khớp), không thiếu/thừa thẻ đóng; xác nhận `resetBatchQuantity()` đã
  được nút mới gọi tới. `node --check` trên `staff-kiosk.js` — không lỗi cú pháp (không đổi gì ở
  file này nhưng kiểm tra lại cho chắc vì 2 hàm dùng chung với phần A).

### C. Widget bắt buộc bỏ qua đăng nhập ở `/kiosk`, kể cả khi restart server hoặc tắt/mở lại widget

- **Vì sao trước đây KHÔNG "bắt buộc" được**: màn hình `/kiosk` (như mọi màn hình thao tác khác)
  yêu cầu đăng nhập bằng mật khẩu nhân viên trước, dùng cookie phiên đăng nhập (`staff_token`).
  Phiên đăng nhập được lưu trong BỘ NHỚ (RAM) của server (`src/services/authService.js`), KHÔNG lưu
  xuống đĩa/CSDL — nghĩa là chỉ cần server RESTART (kể cả khi cookie trên máy widget vẫn còn, chưa
  hết hạn 12 tiếng) là toàn bộ phiên đăng nhập đang có bị xoá sạch, widget sẽ bị đá về màn hình đăng
  nhập ở lần tải `/kiosk` tiếp theo — đúng như người dùng phản ánh.
- **Cách giải quyết**: thêm 1 cơ chế "chìa khoá" HOÀN TOÀN TÁCH BIỆT với cookie/phiên đăng nhập,
  không phụ thuộc bộ nhớ server (không bị mất khi server restart) và không phụ thuộc cookie lưu
  trên máy widget (không bị mất khi tắt/mở lại widget hay xoá dữ liệu widget):
  - `src/server.js`: thêm hằng số `DEFAULT_KIOSK_WIDGET_SECRET` (giá trị dựng sẵn
    `queue-widget-kiosk-2024`, có thể ghi đè bằng biến `.env` mới `KIOSK_WIDGET_SECRET` nếu muốn
    đổi sang giá trị riêng khó đoán hơn — xem chú thích trong `.env.example`). Middleware chặn đăng
    nhập (đoạn kiểm tra `isGatedPath(...)`) được thêm 1 nhánh: nếu đường dẫn là `/kiosk` (hoặc bắt
    đầu bằng `/kiosk/`) VÀ request có header `X-Kiosk-Widget-Secret` khớp đúng giá trị cấu hình thì
    cho đi tiếp luôn, KHÔNG chuyển hướng về trang đăng nhập — bất kể có cookie đăng nhập hay không,
    bất kể server vừa restart hay chưa.
  - **Phạm vi CHỈ ÁP DỤNG CHO `/kiosk`** — đúng như người dùng chỉ định rõ "màn hình kiosk cấp số
    cho bệnh nhân": `/staff-kiosk`, `/counter`, `/counter-admin` KHÔNG bị ảnh hưởng, vẫn bắt buộc
    đăng nhập như cũ (các màn hình đó có thao tác nhạy cảm hơn: xem thông tin bệnh nhân, cấp số,
    cài đặt...).
  - `electron-widget/main.js`: thêm hằng số `KIOSK_WIDGET_SECRET` khớp giá trị mặc định phía
    server, và hàm `setupKioskWidgetSecretHeader()` — dùng
    `session.fromPartition(PARTITION).webRequest.onBeforeSendHeaders(...)` để TỰ ĐỘNG gắn header
    `X-Kiosk-Widget-Secret` vào MỌI request có đường dẫn bắt đầu bằng `/kiosk` (cả trang chính lẫn
    các tài nguyên con như `kiosk.js`, hình ảnh...) trong toàn bộ phiên dùng chung của widget — gọi
    1 lần duy nhất lúc ứng dụng khởi động (`app.whenReady()`), không phụ thuộc cửa sổ kiosk có đang
    mở hay không, hoạt động đúng ngay cả lần tải `/kiosk` ĐẦU TIÊN (kể cả khi được tự mở do cấu hình
    "tự động mở kiosk khi khởi động" ở mục 82).
  - **Đánh đổi bảo mật CÓ CHỦ ĐÍCH, đã nói rõ trong code**: bất kỳ ai biết "chìa khoá" này (mặc định
    nếu không đổi) VÀ truy cập được địa chỉ server đều có thể vào thẳng `/kiosk` mà không cần mật
    khẩu nhân viên. Tuy nhiên bản thân `/kiosk` không lộ thông tin nhạy cảm nào (chỉ là màn hình
    công khai để bấm lấy số, vốn đặt ngay tại sảnh cho bệnh nhân tự bấm) nên đây là đánh đổi hợp lý
    theo đúng yêu cầu "bắt buộc phải bỏ qua đăng nhập". Nếu muốn chặt hơn (ví dụ server đặt ở nơi có
    thể bị truy cập từ ngoài mạng nội bộ), có thể đặt `KIOSK_WIDGET_SECRET` riêng trong `.env` — khi
    đó phải sửa cùng giá trị trong hằng số `KIOSK_WIDGET_SECRET` ở `electron-widget/main.js` rồi
    đóng gói lại widget, nếu không widget sẽ không vào được `/kiosk` nữa (phải đăng nhập thủ công
    như trước).
- **Đã kiểm chứng bằng công cụ**: dựng server thật trên cổng thử nghiệm, dùng `curl` gửi trực tiếp 4
  trường hợp: (1) không có header → chuyển hướng 302 về trang đăng nhập (đúng, không bị lộ); (2)
  header sai giá trị → vẫn 302 (đúng); (3) header đúng giá trị mặc định, đường dẫn `/kiosk/` → 200
  (vào được thẳng, đúng yêu cầu); (4) header đúng giá trị nhưng đường dẫn `/staff-kiosk/` → vẫn 302
  (đúng — xác nhận phạm vi bỏ qua đăng nhập CHỈ áp dụng cho `/kiosk`, không lan sang màn hình khác);
  (5) header đúng, tài nguyên con `/kiosk/kiosk.js` → 200 (đúng, không bị chặn giữa chừng khi tải
  trang). Sau đó chạy THẬT ứng dụng widget Electron (qua `xvfb-run`, không phải giả lập) với 1 hồ sơ
  người dùng HOÀN TOÀN MỚI (không có cookie/phiên đăng nhập nào), bật cấu hình tự động mở kiosk khi
  khởi động, trỏ vào server VỪA KHỞI ĐỘNG LẠI (không còn phiên đăng nhập nào trong bộ nhớ) — log xác
  nhận cửa sổ kiosk tải thành công NGAY nội dung thật của `/kiosk` ("Kiosk bốc số | ... Vui lòng
  quét CCCD hoặc thẻ BHYT...") thay vì bị đá về trang đăng nhập, đúng như yêu cầu "cho dù có restart
  server hay tắt widget mở lại".
- **Hạn chế cần lưu ý**: nếu về sau muốn đổi "chìa khoá" (biến `KIOSK_WIDGET_SECRET`) để chặt bảo
  mật hơn, hiện PHẢI sửa tay đồng thời ở cả `.env` (server) và hằng số trong
  `electron-widget/main.js` (rồi đóng gói lại widget) — chưa có giao diện cấu hình riêng trong menu
  khay hệ thống của widget để đổi giá trị này mà không cần đóng gói lại. Nếu người dùng có nhu cầu
  đổi thường xuyên, có thể yêu cầu bổ sung thêm màn hình cấu hình cho việc này sau.

## 85. Máy in VẪN chỉ nhận 1 lệnh in (sau mục 84) + bổ sung lại nút ±10 ở `/staff-kiosk/`

- **Yêu cầu của người dùng (nguyên văn)**: "màn hình kiosk-staff Lỗi in hàng loạt chỉ ra 1 lệnh in -
  máy in vẫn nhận 1 lệnh in chưa fix được - tìm cách in từng file được không. màn hình kiosk-staff
  bổ sung thêm nút +- 10".

### Nút ±10 (việc nhỏ, làm trước)

- `public/staff-kiosk/index.html`: mục 84 vừa đổi `−10`/`+10` thành `−9`/`+9` theo đúng yêu cầu lúc
  đó. Lần này người dùng muốn có LẠI cả `±10`, không phải thay thế `±9` — nên đã **thêm** 2 nút
  `−10`/`+10` vào CẠNH BÊN 2 nút `−9`/`+9` (giữ nguyên cả 2 cặp, không xoá cặp nào): thứ tự nút hiện
  tại là `−10 · −9 · −1 · [ô nhập] · +1 · +9 · +10 · Reset`. Thêm `flex-wrap:wrap` cho khung chứa
  nút (`.qty-step-group`) để không bị tràn ngang trên màn hình nhỏ khi có thêm 2 nút mới.
- **Đã kiểm chứng bằng công cụ**: đếm thẻ `<button>` mở/đóng trong `index.html` — ra đúng 14/14
  (khớp, không thiếu/thừa thẻ đóng).

### Lỗi in hàng loạt vẫn chỉ ra 1 lệnh in — tìm hiểu tiếp sau mục 84

- **Đã xác nhận LẠI (không phải đoán) rằng cơ chế nối tiếp hoá ở mục 84 hoạt động đúng**: đọc lại
  toàn bộ chuỗi `issueBatch()` (staff-kiosk.js) → `printTicketReceipt()`/`printReceipt()`
  (print-receipt.js) → `ipcRenderer.invoke('print-ticket', ...)` (preload.js) →
  `ipcMain.handle('print-ticket', ...)` → `printTicketSilently()` (main.js) — mỗi bước đều
  `return`/`await` đúng Promise của bước sau, không có chỗ nào "quên chờ" nữa. Đồng thời kiểm tra kỹ
  bên trong thư viện `pdf-to-printer` (đọc thẳng mã nguồn đã cài trong
  `electron-widget/node_modules/pdf-to-printer/dist/bundle.js`): hàm `print()` của thư viện này
  dùng `child_process.execFile` (qua `util.promisify`) để chạy `SumatraPDF.exe -print-to ... -silent
  <file>.pdf`, và **CHỈ resolve sau khi tiến trình SumatraPDF.exe THOÁT HẲN** — không phải chỉ sau
  khi tiến trình được khởi chạy. Nghĩa là `await pdfToPrinter.print(...)` trong
  `printTicketSilently()` là một cái chờ THẬT SỰ, không phải chờ giả — mỗi phiếu đã được xuất ra 1
  file PDF RIÊNG (tên file có thêm chuỗi ngẫu nhiên từ mục 84, không thể trùng nhau) và gọi
  SumatraPDF RIÊNG BIỆT, tuần tự, đợi xong hẳn tiến trình trước mới sang tiến trình sau — đúng tinh
  thần "in từng file" người dùng yêu cầu, thực ra bản chất đã làm đúng như vậy từ mục 84.
- **Vậy vì sao máy in vẫn chỉ nhận 1 lệnh?** Vì môi trường hiện tại (không có Windows, không có máy
  in nhiệt thật) KHÔNG THỂ tái hiện hay kiểm chứng trực tiếp hành vi của Windows Print
  Spooler/driver máy in nhiệt khi nhận nhiều lệnh in liên tiếp rất sát nhau về thời gian, nên đây là
  **giả thuyết hợp lý nhất còn lại** (không phải điều đã kiểm chứng được bằng công cụ trong lần sửa
  này, khác với các phần đã kiểm chứng ở trên): dù mỗi lệnh in đã là 1 tiến trình SumatraPDF.exe
  RIÊNG BIỆT và đã đợi tiến trình đó THOÁT HẲN, việc tiến trình thoát KHÔNG đồng nghĩa Windows Print
  Spooler đã "chốt" xong lệnh in đó thành 1 "công việc in" (print job) tách biệt trước khi nhận dữ
  liệu của lệnh in tiếp theo — nếu 2 lệnh in đến quá sát nhau (gần như ngay khi tiến trình trước vừa
  thoát), một số driver máy in nhiệt/máy in cuộn giấy liên tục có thể nối liền 2 luồng dữ liệu lại
  thành 1 "công việc" duy nhất thay vì tách thành 2 — đây chính là loại hành vi thường gặp trên máy
  in nhiệt liên tục (khác máy in trang rời, vốn luôn ngắt rõ ràng giữa các trang/công việc).
- **Sửa (biện pháp thực tế cho giả thuyết trên)** — `electron-widget/main.js`, hàm
  `printTicketSilently()`: thêm 1 khoảng nghỉ **700ms** SAU KHI mỗi lệnh in gửi xong thành công
  (cả ở nhánh chính dùng `pdf-to-printer` lẫn nhánh dự phòng `webContents.print()`), TRƯỚC KHI hàm
  này trả về — tức là trước khi vòng lặp `issueBatch()` được phép chuyển sang phiếu tiếp theo. Mục
  đích: cho Windows Print Spooler/driver đủ thời gian tách lệnh in vừa gửi thành 1 công việc riêng
  biệt, tránh bị hiểu nhầm là 1 luồng dữ liệu liên tục rồi gộp lại. Đây là 1 khoảng nghỉ CỐ ĐỊNH viết
  thẳng trong code (hằng số `PRINT_JOB_GAP_MS = 700`), có thể cần chỉnh tăng thêm nếu 700ms vẫn chưa
  đủ với driver máy in cụ thể của người dùng.
- **Đã kiểm chứng bằng công cụ (trong phạm vi có thể)**: `node --check electron-widget/main.js` —
  không lỗi cú pháp. Đọc lại toàn bộ đoạn mã mới thêm để xác nhận `await` khoảng nghỉ nằm ĐÚNG VỊ
  TRÍ (sau khi in xong 1 phiếu, trước khi hàm `printTicketSilently()` trả về — không làm chậm chính
  lệnh in đang chạy, chỉ làm chậm việc CHUYỂN SANG phiếu tiếp theo). KHÔNG kiểm chứng được bằng máy
  in nhiệt thật (môi trường hiện tại không có Windows/máy in vật lý) — đây là hạn chế thành thật cần
  nói rõ, không phải đã xác nhận chắc chắn hết lỗi.
- **Đề nghị với người dùng**: nếu sau khi cập nhật lần này người dùng thử lại 1 lô 3-5 số mà máy in
  VẪN chỉ ra 1 lệnh/1 công việc in duy nhất trong hàng đợi in của Windows (kiểm tra qua "Trình quản
  lý in" hoặc hàng đợi máy in trong Windows), xin gửi lại chính xác những gì thấy được (số lệnh in
  hiện trong hàng đợi khi đang cấp 1 lô 5 số, nội dung/độ dài giấy in ra thực tế, tên/driver máy in
  đang dùng) — sẽ dễ chẩn đoán chính xác hơn nhiều so với chỉ dựa vào giả thuyết, vì đây là hành vi
  của driver Windows/phần cứng máy in mà không có cách nào tái hiện được trong môi trường phát triển
  hiện tại.

## 86. Tăng khoảng nghỉ giữa lệnh in lên 2 giây + KHÔNG mất dấu số bị lỗi khi in hàng loạt (hết giấy giữa chừng)

- **Yêu cầu của người dùng (nguyên văn)**: "màn hình staff kiosk vẫn ko gọi tuần tự từng file mà gọi
  in chỉ có 1 file do đó khi hết giấy in nó sẽ không in lại dc số đang bị lỗi. giờ tìm cách chạy
  tuần tự in từng phiếu mổi phiếu 2s chờ in gửi lệnh in từng phiếu cho an toàn".

### Đã kiểm tra lại: từng phiếu VẪN đang xuất ra 1 file PDF riêng, gọi in riêng, tuần tự

- Đọc lại toàn bộ chuỗi gọi (`issueBatch()` → `printTicketReceipt()`/`printReceipt()` →
  `ipcRenderer.invoke()` → `ipcMain.handle()` → `printTicketSilently()`) VÀ mở thẳng mã nguồn thư
  viện `pdf-to-printer` đang cài trong máy (`electron-widget/node_modules/pdf-to-printer/dist/bundle.js`)
  — xác nhận LẦN NỮA: mỗi phiếu được xuất ra 1 file PDF ĐẶT TÊN RIÊNG (có chuỗi ngẫu nhiên, không
  trùng nhau), gọi 1 tiến trình SumatraPDF.exe RIÊNG cho từng file, và code THẬT SỰ đợi tiến trình
  đó thoát hẳn (qua `execFile` + `await`) trước khi in phiếu tiếp theo. Về mặt code, đây ĐÃ LÀ "in
  từng file, tuần tự" đúng như yêu cầu — không có chỗ nào gộp nhiều phiếu vào 1 file hay gọi in
  chồng chéo.
- **Vấn đề thật sự nằm ở chỗ khác — không phải "gọi in 1 file", mà là "không biết chính xác phiếu
  nào chưa in được khi có lỗi giữa chừng"**: trước bản sửa này, hàm `printTicketSilently()` (main
  process) khi in THẤT BẠI (hết giấy, kẹt giấy...) chỉ hiện 1 hộp thoại lỗi rồi **coi như xong**
  (không báo thất bại về phía trang web) — khiến vòng lặp in hàng loạt cứ tưởng phiếu đó đã in
  xong, tiếp tục chạy sang phiếu tiếp theo (cũng sẽ lỗi vì máy in vẫn đang hết giấy), và **không có
  cách nào để biết chính xác số nào đã in được, số nào chưa** — đúng như người dùng phản ánh
  ("không in lại được số đang bị lỗi").

### Sửa: tăng khoảng nghỉ lên 2 giây + báo rõ thành công/thất bại + nút "In tiếp các số còn lại"

- `electron-widget/main.js`, hàm `printTicketSilently()`:
  - Tăng khoảng nghỉ sau mỗi lệnh in thành công từ 700ms lên **2000ms (2 giây)**, đúng theo yêu cầu
    cụ thể của người dùng — áp dụng cho cả nhánh chính (`pdf-to-printer`) lẫn nhánh dự phòng
    (`webContents.print()`).
  - **Thay đổi quan trọng nhất**: hàm này giờ LUÔN trả về 1 object `{ success, message }` rõ ràng
    cho từng lệnh in — `{ success: true }` nếu in thành công, `{ success: false, message: '...' }`
    nếu thất bại (thay vì trước đây không trả về gì, coi như luôn thành công).
- `public/staff-kiosk/staff-kiosk.js`:
  - Tách vòng lặp in hàng loạt ra hàm riêng `printBatchSequentially(tickets, priorityCode,
    startIndex)` — in tuần tự từ vị trí `startIndex`, và **DỪNG NGAY LẬP TỨC** nếu gặp 1 phiếu in
    thất bại (không cố in tiếp các phiếu còn lại — vì nhiều khả năng nguyên nhân, ví dụ hết giấy,
    vẫn còn nguyên).
  - Khi dừng vì lỗi: lưu lại đúng vị trí phiếu bị lỗi vào biến `pendingBatchPrint`, hiện rõ ràng
    trên màn hình: **số thứ tự cụ thể** không in được, đã in thành công bao nhiêu/tổng bao nhiêu,
    còn lại bao nhiêu số CHƯA IN — kèm khẳng định rõ "vé đã được tạo trong hệ thống, không mất số,
    chỉ chưa in ra giấy" (tránh nhân viên hoang mang tưởng mất số). Màn hình lỗi này KHÔNG tự động
    biến mất (huỷ luôn bộ đếm ngược tự quay lại) — bắt buộc nhân viên phải thấy và xử lý.
  - Thêm nút **"In tiếp các số còn lại"** (`continueBatchPrinting()`) — bấm sau khi đã khắc phục máy
    in (tiếp giấy, gỡ kẹt...) sẽ in tiếp ĐÚNG PHẦN CÒN LẠI, bắt đầu lại đúng từ số bị lỗi, KHÔNG in
    lại các số đã in thành công trước đó (tránh trùng/lãng phí giấy).
  - `public/staff-kiosk/index.html`: thêm khối `#batchPrintError` (ẩn mặc định) bên trong màn hình
    kết quả "cấp nhiều số", chứa dòng thông báo lỗi + nút "In tiếp các số còn lại".
  - Cập nhật lại ước lượng thời gian bộ đếm ngược tự quay về màn hình chính (2.2 giây/phiếu thay vì
    1.5, khớp với khoảng nghỉ mới 2 giây/lệnh in) — chỉ áp dụng khi in THÀNH CÔNG toàn bộ, vì khi có
    lỗi thì bộ đếm bị huỷ ngay như đã nói ở trên.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên cả 2 file sửa (`main.js`, `staff-kiosk.js`) —
  không lỗi cú pháp; đếm thẻ `<div>`/`<button>` trong `index.html` — khớp (40/40 và 15/15). Mô
  phỏng lại CHÍNH XÁC logic `printBatchSequentially()`/`continueBatchPrinting()` bằng 1 đoạn Node
  độc lập: lô 5 số, giả lập lỗi ở số thứ 3 — xác nhận vòng lặp DỪNG ĐÚNG ở vị trí đó (chỉ in
  1,2,3 — không in tiếp 4,5), `pendingBatchPrint` lưu đúng vị trí cần tiếp tục; gọi lại hàm tiếp
  tục — xác nhận CHỈ in tiếp đúng 3,4,5 (không in lại 1,2), sau đó `pendingBatchPrint` được xoá về
  `null`. Dựng lại THẬT bằng 1 ứng dụng Electron riêng (qua `xvfb-run`) mô phỏng đúng cơ chế IPC
  `invoke()`/`handle()` với handler trả về `{success:false}` ở lần gọi thứ 3 — xác nhận phía trang
  web nhận ĐÚNG kết quả `{"success":true}` cho 2 lần đầu và `{"success":false,"message":"..."}` ở
  lần thứ 3, dừng lại đúng lúc — khớp chính xác với logic mới trong `printBatchSequentially()`.
- **Về khoảng nghỉ 700ms → 2000ms cho vấn đề "1 lệnh in" nêu ở mục 85**: đây vẫn là biện pháp dựa
  trên GIẢ THUYẾT (không có Windows/máy in thật để kiểm chứng trực tiếp trong môi trường phát
  triển) — tăng lên 2 giây theo đúng yêu cầu cụ thể của người dùng, cho driver/spooler nhiều thời
  gian hơn hẳn để tách lệnh in thành công việc riêng biệt. Việc THÊM MỚI ở mục này (báo rõ thành
  công/thất bại + nút in tiếp) mới là cải thiện THẬT SỰ và chắc chắn, đã kiểm chứng được bằng công
  cụ: dù nguyên nhân gốc "1 lệnh in" có được khoảng nghỉ 2 giây giải quyết triệt để hay không, từ
  nay hệ thống sẽ KHÔNG BAO GIỜ âm thầm bỏ qua 1 số bị lỗi in nữa — luôn dừng lại, báo rõ, và cho
  phép in tiếp đúng phần còn thiếu.

## 87. Bỏ hẳn luồng "in hàng loạt" riêng — cấp nhiều số giờ chỉ lặp lại đúng luồng cấp 1 số bình thường, có nút Dừng

- **Yêu cầu của người dùng (nguyên văn)**: "ý của tôi là màn hình staff-kiosk bỏ code in loạt nhiều
  phiếu đi bản chất tôi yêu cầu nó vẫn đi theo luồng cấp và in từng phiếu 1 chứ ko đi riêng 1 luồng
  in 1 loạt thay vì tôi phải thao tác thủ công thì hệ thống tự động. Nào tôi muốn dừng thì tôi dừng".

### Thay đổi thiết kế cốt lõi

- **Trước đây (mục 81-86)**: khi "Số lượng cần cấp" > 1, hệ thống đi theo 1 LUỒNG RIÊNG BIỆT hoàn
  toàn tách khỏi luồng cấp 1 số bình thường — gọi 1 API riêng (`POST /api/tickets/staff-batch`) tạo
  CẢ LÔ vé TRƯỚC trong 1 request, rồi tự in lần lượt bằng 1 hàm riêng
  (`issueBatch()`/`printBatchSequentially()`). Đây đúng là điều người dùng phản đối: có 2 luồng
  code khác nhau cho cùng 1 việc (cấp + in 1 phiếu).
- **Bây giờ**: đã XOÁ HẲN route `POST /api/tickets/staff-batch` (server) và các hàm
  `issueBatch()`/`printBatchSequentially()`/`showBatchDoneTickets()`/`showBatchPrintError()`/
  `continueBatchPrinting()` (client) — không còn "luồng hàng loạt" nào nữa. Khi "Số lượng cần cấp"
  > 1, hệ thống chỉ đơn giản **tự động bấm hộ nút "Cấp số ngay" N lần liên tiếp**, tái sử dụng
  ĐÚNG hàm `issuePriorityImmediately()` → `createStaffTicket()` → `POST /api/tickets/staff` mà
  nhân viên vẫn dùng khi bấm tay — tức là "vẫn đi theo luồng cấp và in từng phiếu 1" đúng như yêu
  cầu, không có API/mã nguồn riêng nào cho việc "cấp hàng loạt".
- Khác biệt DUY NHẤT so với việc nhân viên tự bấm tay N lần:
  1. Vòng lặp tự động (`runAutoIssueLoop()`) CHỜ ĐÚNG lệnh in trước in xong (thành công hay thất
     bại) mới cấp số tiếp theo — dùng 1 tham số mới `awaitPrint` của
     `createStaffTicket()`/`issuePriorityImmediately()` để `await` kết quả in, thay vì để phiếu tự
     in "ngầm" phía sau như khi cấp 1 số thủ công (không cần chờ vì chỉ có 1 lệnh, không lo chồng
     chéo).
  2. Xuất hiện 1 khối "Đang cấp tự động: X/N" + nút **"Dừng"** ngay trên chính màn hình "Số thứ tự
     vừa cấp" (không tạo màn hình kết quả riêng nào khác) trong suốt lúc đang tự động chạy. Bấm
     "Dừng" là đánh dấu yêu cầu dừng — vòng lặp **dừng lại ngay sau khi số hiện tại cấp/in xong**
     (không huỷ ngang lệnh đang chạy dở, đúng tinh thần "an toàn" nhưng vẫn "muốn dừng thì dừng"
     ngay lập tức ở lần lặp kế tiếp).
  3. Nếu 1 lệnh in thất bại giữa chừng (hết giấy...), vòng lặp tự dừng ngay, báo rõ đã cấp được
     bao nhiêu số, nhắc rằng số vừa rồi đã tạo trong hệ thống (chỉ chưa in ra giấy) — nhân viên có
     thể bấm lại đúng nút đối tượng đó để cấp tiếp phần còn lại bất kỳ lúc nào.
- **Các phần vẫn giữ nguyên vì không bị ảnh hưởng**: ô nhập "Số lượng cần cấp" và 6 nút tăng/giảm
  nhanh (±1/±9/±10) + nút Reset (mục 83, 85) — vẫn dùng để chọn số lượng cần TỰ ĐỘNG cấp, chỉ khác
  ở chỗ đằng sau nó giờ không còn API/luồng "batch" riêng nữa. Giới hạn số lượng tối đa
  (`STAFF_BATCH_MAX_QUANTITY` trong `.env`) vẫn được giữ để tránh nhập nhầm số quá lớn, nhưng nay
  CHỈ còn được kiểm tra ở phía client (không còn route server riêng nào để kiểm tra lại, vì mỗi
  lần lặp giờ chỉ là 1 request `/api/tickets/staff` bình thường).

### Đã kiểm chứng bằng công cụ

- `node --check` trên `src/routes/tickets.js`, `src/routes/kioskConfig.js`,
  `public/staff-kiosk/staff-kiosk.js` — không lỗi cú pháp; đếm thẻ `<div>`/`<button>` trong
  `index.html` — khớp (34/34 và 15/15); `grep` xác nhận không còn route `/staff-batch` nào được gọi
  từ client, không còn phần tử `#step-batch-done` nào trong HTML.
- Mô phỏng lại CHÍNH XÁC logic vòng lặp (`runAutoIssueLoop()`) bằng 1 đoạn Node độc lập cho 3 tình
  huống: (1) chạy hết trọn 5 số bình thường — đúng cả 5 số theo thứ tự; (2) người dùng bấm "Dừng"
  ngay sau khi số thứ 3 cấp xong — vòng lặp dừng đúng ở số 3, không cấp số 4/5; (3) lệnh in số thứ 3
  thất bại — vòng lặp dừng đúng ngay tại đó, không cố cấp tiếp số 4/5. Cả 3 tình huống đều cho kết
  quả đúng như thiết kế.
- Dựng lại THẬT bằng 1 ứng dụng Electron riêng (qua `xvfb-run`) mô phỏng đúng cơ chế
  `ipcRenderer.invoke()`/`ipcMain.handle()` với handler trả về lỗi ở lần gọi thứ 4 trong 1 vòng lặp
  6 lần — xác nhận vòng lặp phía trang web nhận đúng kết quả thành công cho 3 lần đầu và dừng đúng
  ngay khi nhận lỗi ở lần thứ 4, khớp chính xác với cơ chế `awaitPrint` mới trong
  `createStaffTicket()`.
- **Chưa kiểm chứng được** (do môi trường phát triển không có giao diện trình duyệt thật để bấm
  chuột và không có máy in thật): trải nghiệm bấm nút "Dừng" thật trên màn hình, và việc bộ đếm
  ngược "Tự động quay lại sau...' có thực sự không bị kích hoạt nhầm giữa chừng vòng lặp hay không
  trên thiết bị thật — logic đã được rà soát kỹ (xem `startCountdown:false` truyền xuyên suốt vòng
  lặp, chỉ bật lại đúng 1 lần ở `finishAutoIssue()`) nhưng đề nghị người dùng thử trực tiếp 1 lần
  cấp 5-10 số tự động trên màn hình `/staff-kiosk/` thật để xác nhận cuối cùng.

## 88. Tìm ra lỗi thật sự: "cầu nối in" HTTP cục bộ trả lời xong ngay khi VỪA MỞ cửa sổ in ẩn, không đợi in xong

- **Yêu cầu của người dùng (nguyên văn)**: "ok rồi. nhưng nó quét qua nhiều số nhưng sao nó k gọi in
  từng số đợi in xong rồi hay qua số tiếp theo".

### Nguyên nhân thật sự (khác với mục 84-87 đã sửa)

- Mục 84-87 đã sửa đúng đường in TRỰC TIẾP khi `/staff-kiosk`/`/kiosk` được mở NGAY TRONG cửa sổ
  riêng của ứng dụng widget (`window.electronPrint` tồn tại thẳng trên trang) — đường này đã kiểm
  chứng chạy đúng bằng Electron thật.
- Nhưng hệ thống còn có 1 đường in THỨ HAI, dùng khi `/staff-kiosk` (hoặc `/kiosk`) được mở bằng
  TRÌNH DUYỆT THƯỜNG (Chrome/Edge) thay vì qua đúng cửa sổ của widget: lúc đó trang web không có
  `window.electronPrint` trực tiếp, nên phải nhờ widget in HỘ qua 1 "cầu nối" HTTP cục bộ
  (`tryLocalPrintBridge()` trong `print-receipt.js` gọi tới `http://127.0.0.1:58585/print-ticket`
  do `startLocalPrintServer()` trong `electron-widget/main.js` mở sẵn). Khi nhận được yêu cầu, widget
  mở 1 CỬA SỔ ẨN RIÊNG (`openPrintFrameWindow()`) tải trang `/print-ticket-frame/` để in hộ.
- **Đây chính là nơi có lỗi thật sự**: trước bản sửa này, ngay sau khi RA LỆNH mở cửa sổ ẩn đó (chưa
  hề in xong, thậm chí trang còn chưa tải xong), server HTTP cục bộ đã trả lời NGAY `200 OK` cho
  trình duyệt — khiến `tryLocalPrintBridge()` coi như "xong" gần như tức thì, và thêm nữa, hàm này
  TRƯỚC ĐÂY chỉ trả về `true/false` (có gọi được widget hay không) chứ KHÔNG PHẢI kết quả in thật —
  nên vòng lặp "cấp nhiều số" tự động (mục 87) không có cách nào biết lệnh in có thực sự chạy xong
  hay chưa, cứ thấy "thành công" là cấp số tiếp theo ngay lập tức, dẫn đúng đến hiện tượng người
  dùng mô tả: "quét qua nhiều số" nhanh mà không thấy đợi in.
- Ngoài ra `tryLocalPrintBridge()` còn tự HUỶ (abort) kết nối sau 700ms — giá trị này từng đúng khi
  widget trả lời gần như ngay lập tức, nhưng SẼ SAI ngay khi sửa để widget đợi in xong thật (in
  thật có thể mất vài giây) — nếu không tăng giá trị này, các lệnh in hợp lệ sẽ bị huỷ oan giữa
  chừng.

### Sửa

- `electron-widget/main.js`: thêm cơ chế "chờ tín hiệu in xong" (`waitForFramePrintDone()` +
  `pendingFramePrints` + kênh IPC mới `print-frame-done`) — server HTTP cục bộ giờ CHỜ THẬT (`await`)
  tín hiệu báo kết quả từ chính cửa sổ ẩn trước khi trả lời trình duyệt, kèm hạn mức chờ tối đa 20
  giây (an toàn: nếu cửa sổ ẩn vì lý do gì đó không bao giờ báo về, request không bị treo mãi mãi).
  Mỗi lượt in được gán 1 `requestId` riêng để khớp đúng tín hiệu, tránh nhầm lẫn nếu có nhiều yêu
  cầu in chồng nhau.
- `electron-widget/preload.js`: thêm `window.electronPrint.reportFrameDone(requestId, result)` để
  trang ẩn báo kết quả in ngược lại cho tiến trình chính.
- `public/print-ticket-frame/print-ticket-frame.js`: giờ `await` kết quả THẬT của `printReceipt()`
  rồi mới gọi `reportFrameDone()` báo về — trước đây chỉ gọi `printReceipt()` rồi thôi, không bao
  giờ báo kết quả đi đâu cả.
- `public/print-receipt.js`: `tryLocalPrintBridge()` giờ trả về đúng object `{ success, message }`
  đọc từ phản hồi thật của widget (hoặc `null` nếu không gọi được widget — tín hiệu để quay về
  `window.print()` như cũ), thay vì chỉ `true/false`; `printReceipt()` `return` thẳng kết quả này
  để chuỗi gọi phía trên (`createStaffTicket()` với `awaitPrint:true`) nhận được đúng thành công/
  thất bại giống hệt như khi in trực tiếp qua cửa sổ của widget. Tăng thời gian tự huỷ kết nối từ
  700ms lên 30 giây (khớp với việc widget giờ chỉ trả lời SAU KHI in xong thật, có thể mất vài
  giây) — trường hợp không có widget chạy trên máy vẫn thất bại nhanh như cũ (kết nối bị từ chối
  ngay lập tức, không phụ thuộc giá trị hạn mức này).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên cả 4 file sửa — không lỗi cú pháp. Dựng lại
  THẬT bằng 1 ứng dụng Electron riêng (qua `xvfb-run`) mô phỏng đúng cơ chế "mở cửa sổ ẩn → đợi tín
  hiệu báo về qua IPC → mới trả lời" với 2 tình huống: cửa sổ ẩn báo "in thành công" sau 800ms và
  báo "in thất bại" sau 500ms — xác nhận cả 2 lần gọi đều CHỜ ĐÚNG thời gian đó (không trả lời sớm)
  và nhận đúng kết quả thành công/thất bại tương ứng — khớp chính xác với cơ chế mới.
- **Lưu ý quan trọng cho người dùng**: bản sửa này chỉ có tác dụng khi cả 2 phía đều được cập nhật
  đồng thời — server (`public/`) VÀ ứng dụng widget (`electron-widget/`, cần TẮT HẲN rồi MỞ LẠI
  ứng dụng widget từ khay hệ thống, không chỉ đóng cửa sổ, để nạp lại `main.js`/`preload.js` mới).
  Nếu chỉ cập nhật 1 trong 2 phía (ví dụ chỉ thay `public/` mà chưa khởi động lại widget), lỗi "cấp
  qua nhiều số mà không đợi in xong" nhiều khả năng vẫn còn, vì widget cũ vẫn trả lời "200 OK" ngay
  lập tức như hành vi cũ.

## 89. Bỏ hẳn mọi tham số/hàm riêng cho "cấp nhiều số" — chỉ còn tự động bấm hộ đúng nút đối tượng, nút Dừng chuyển sang màn hình nhập số lượng

- **Yêu cầu của người dùng (nguyên văn, sau khi từ chối cả thiết kế ở mục 87)**: "tức là bỏ hết
  code. cấp tự động ờ màn hình staff-kiosk đi. Base từ luồn cấp 1 phiếu. Số lượng phiếu cần cấp
  tuần tự nó thay máy tính tự động cấp stt nhưng phải tuân thủ qui trình của cấp 1 phiếu. không
  được bypass qua bước nào hết. tôi có thể yêu cầu dừng ở màn hình nhập số lượng cần cấp".
  (Trước đó, khi tôi hỏi lại bằng 2 phương án cụ thể, người dùng đã chọn "Để tôi mô tả rõ hơn ý
  muốn" thay vì chọn 1 trong 2 — tức là cả 2 phương án đề xuất đều chưa đúng ý, nên câu trên là mô
  tả chi tiết nhất, dùng làm chuẩn để sửa lại lần này.)

### Vì sao thiết kế ở mục 87 vẫn chưa đúng ý

- Mục 87 đã bỏ được API `/staff-batch` riêng (mục 81-86), nhưng vẫn còn giữ lại 1 lớp "vòng lặp
  riêng": `runAutoIssueLoop()` tự chạy `while`, gọi `issuePriorityImmediately(priorityCode,
  {awaitPrint: true})` — một hàm có THAM SỐ RIÊNG chỉ dùng cho trường hợp tự động, và
  `showDoneTicket(..., {startCountdown: false})` cũng có tham số riêng để tắt bộ đếm ngược ở giữa
  vòng lặp. Nút "Dừng" cũng nằm trên màn hình "Số thứ tự vừa cấp" (`#step-done`), không phải màn
  hình nhập số lượng như người dùng yêu cầu. Đây vẫn là "1 luồng riêng" theo đúng nghĩa người dùng
  muốn tránh, dù không còn gọi API riêng nữa.

### Sửa lại theo đúng yêu cầu mới nhất

- **Bỏ hết các tham số/hàm chỉ phục vụ riêng cho "cấp nhiều số"** trong
  `public/staff-kiosk/staff-kiosk.js`:
  - `issuePriorityImmediately(priorityCode)`, `createStaffTicket(priorityCode, patientFromScan)`,
    `showDoneTicket(ticket, priorityCode)` — quay lại đúng chữ ký đơn giản như trước mục 87 (không
    còn `opts`/`awaitPrint`/`startCountdown`): LUÔN in "bắn lệnh rồi thôi" (không chờ in xong mới
    quay về màn hình), LUÔN tự bật đếm ngược — giống hệt nhau dù đang cấp 1 số thủ công hay đang ở
    giữa 1 chuỗi tự động.
  - Xoá hẳn `runAutoIssueLoop()`, `finishAutoIssue()`, `updateAutoIssueUI()`, `startAutoIssue()`,
    `stopAutoIssue()` cũ.
- **Thiết kế mới**: khi "Số lượng cần cấp" > 1, bước ĐẦU TIÊN gọi THẲNG `startVerify(priorityCode)`
  — ĐÚNG hàm mà 1 lần bấm nút bình thường sẽ gọi. Nếu `STAFF_KIOSK_SKIP_VERIFY=false` (mặc định),
  màn hình "Sẵn sàng quét" vẫn hiện ra và CHỜ nhân viên tự quét CCCD/BHYT cho TỪNG số một trong
  chuỗi — không hề bỏ qua bước xác minh. Chỉ khi bật `STAFF_KIOSK_SKIP_VERIFY=true` thì
  `startVerify()` mới tự cấp ngay (vì bản thân hàm `startVerify()` vốn đã có sẵn hành vi đó, không
  phải code viết riêng cho tính năng này).
- **Điểm tự động DUY NHẤT** nằm ở hàm `resetForm()` (hàm có sẵn từ trước, vốn đã luôn được gọi mỗi
  khi 1 phiếu "hoàn tất vòng đời" — hết giờ đếm ngược ở `step-done`, hoặc huỷ xác minh...): thêm 1
  hàm mới `maybeContinueAutoIssueSeq()` gọi ở cuối `resetForm()` — nếu đang có 1 chuỗi "cấp nhiều
  số" còn số lượng cần cấp, hàm này tự đặt hẹn giờ (1.5 giây, đủ để nhân viên kịp thấy và bấm
  "Dừng" nếu muốn) rồi tự gọi lại `startVerify(priorityCode)` — tức là tự "bấm hộ" đúng nút đối
  tượng đó thêm 1 lần, hệt như nhân viên tự bấm tay.
- **Nút "Dừng" chuyển hẳn sang màn hình nhập số lượng** (`step-form`, cạnh ô "Số lượng cần cấp") —
  đúng yêu cầu "tôi có thể yêu cầu dừng ở màn hình nhập số lượng cần cấp": thêm khối
  `#autoIssueSeqBox` mới trong `public/staff-kiosk/index.html`, chỉ hiện khi đang có chuỗi tự động
  chạy, hiện rõ "đã cấp X/N" + nút "Dừng" gọi `stopAutoIssueSeq()` (huỷ hẹn giờ đang chờ, xoá trạng
  thái chuỗi — KHÔNG đụng đến lệnh cấp/in của số VỪA cấp, vì số đó đã hoàn tất mới quay về được màn
  hình này). Khối tiến độ + nút "Dừng" cũ trên `#step-done` (mục 87) đã bị xoá hẳn.
- **`cancelVerify()`** (nút "Huỷ, quay lại" ở màn hình "Sẵn sàng quét") giờ cũng tự huỷ luôn chuỗi
  tự động nếu đang chạy (gọi `stopAutoIssueSeq()`) — tránh trường hợp nhân viên tưởng đã huỷ nhưng
  chuỗi vẫn "âm thầm" tiếp tục cấp ở lần quay về `step-form` kế tiếp.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `staff-kiosk.js` (và toàn bộ các file JS
  khác trong dự án) — không lỗi cú pháp; đếm số lượng thẻ `<div>`/`<button>` mở/đóng trong
  `index.html` — khớp nhau (34/34, 15/15). Dựng 1 kịch bản mô phỏng độc lập bằng Node.js (tách
  đúng logic điều khiển của `handlePriorityClick()`/`confirmAndStartAutoIssueSeq()`/
  `maybeContinueAutoIssueSeq()`/`stopAutoIssueSeq()`/`cancelVerify()`/`resetForm()` ra thành các
  hàm giả lập độc lập, có `setTimeout` thật) với 4 tình huống: (1) `STAFF_KIOSK_SKIP_VERIFY=true`,
  cấp 5 số liên tiếp — xác nhận đúng 5 lần tạo vé, không lần nào bị bỏ sót hay lặp lại; (2)
  `STAFF_KIOSK_SKIP_VERIFY=false`, cấp 3 số — xác nhận mỗi số ĐỀU phải chờ 1 lượt "quét" giả lập
  riêng mới tạo vé (không bị tự động bỏ qua bước xác minh), đúng 3 lần mở màn hình xác minh khớp 3
  lần tạo vé; (3) bấm "Dừng" giữa chừng (khi đang ở khoảng chờ 1.5 giây) — xác nhận số lượng vé đã
  tạo dừng lại đúng ngay tại đó, không tạo thêm dù chờ thêm 200ms sau đó; (4) bấm "Huỷ, quay lại"
  trong lúc đang chờ quét cho vé đầu tiên của chuỗi — xác nhận KHÔNG có vé nào được tạo và chuỗi tự
  huỷ hoàn toàn. Cả 4 tình huống đều cho kết quả đúng như thiết kế.
- **Giới hạn còn lại (thành thật công bố)**: đây là mô phỏng lại ĐÚNG logic điều khiển (thứ tự gọi
  hàm, đếm số lần, thời điểm dừng) bằng Node.js thuần, KHÔNG phải chạy trên chính giao diện HTML
  thật hay trên phần cứng in thật — do đó không thể loại trừ hoàn toàn khả năng có lỗi hiển thị
  CSS/DOM ở khối `#autoIssueSeqBox` mới trên các trình duyệt/độ phân giải khác nhau (chỉ kiểm tra
  được số lượng thẻ mở/đóng cân bằng bằng công cụ, không kiểm tra được hình ảnh thực tế hiển thị ra
  sao). Ngoài ra, nếu ĐÚNG LÚC nhân viên đang chạy 1 chuỗi "cấp nhiều số" tự động mà 1 bệnh nhân
  KHÁC lại tự quét CCCD/BHYT của họ ở cùng màn hình (tính năng quét độc lập, xem mục
  `autoIssueFromScan()`) — trường hợp hiếm gặp này chưa được kiểm tra riêng, vì `resetForm()` dùng
  chung cho mọi luồng cấp số trên trang; về lý thuyết có thể khiến 1 lượt "quay về màn hình chính"
  của lượt quét độc lập đó vô tình được tính là 1 bước trong chuỗi tự động (làm chuỗi "nhảy cóc"
  sớm hơn 1 số so với dự kiến) — nếu gặp tình huống này trong thực tế, xin phản ánh lại để tôi sửa
  thêm cơ chế phân biệt rõ nguồn gốc của từng lượt cấp số.

## 90. Bỏ hẳn tính năng "quét tự động" (bệnh nhân tự quét CCCD/BHYT khi chưa chọn đối tượng) ở `/staff-kiosk/`

- **Yêu cầu của người dùng (nguyên văn)**: "màn hình staff-kiosk nếu đúng lúc đang chạy chuỗi tự
  động mà có bệnh nhân khác tự quét CCCD/BHYT của họ ở cùng màn hình, trường hợp hiếm này chưa
  được kiểm tra kỹ - loại bỏ code quét cccd/bhyt ở màn hình staff-kiosk nhé vì ko cần thiết nữa".

### Xác định phạm vi cần xoá

- `/staff-kiosk/` có ĐÚNG 2 chỗ liên quan tới quét CCCD/BHYT:
  1. **"Quét tự động"** (`autoIssueFromScan()`, thêm ở mục 76): khi nhân viên CHƯA bấm chọn đối
     tượng nào (đang ở màn hình chính), một lượt quét CCCD/BHYT bất kỳ sẽ khiến hệ thống TỰ xác
     định đối tượng ưu tiên (qua tuổi) rồi cấp số ngay — hoàn toàn ĐỘC LẬP với thao tác nút bấm của
     nhân viên. **Đây chính là tính năng gây ra giới hạn đã công bố ở mục 89** (chạy song song,
     cùng dùng chung `resetForm()`/màn hình `step-done` với chuỗi "cấp nhiều số" tự động mới, nên
     về lý thuyết có thể "đá nhau").
  2. **Quét xác minh** (ở màn hình "Sẵn sàng quét" - `step-verify`, hiện ra SAU KHI nhân viên đã
     bấm chọn 1 đối tượng): dùng để kiểm tra trùng lặp/điều kiện đối tượng trước khi cấp số — đây
     là một phần của "quy trình cấp 1 phiếu" mà mục 89 yêu cầu KHÔNG được bỏ qua.
  - Người dùng xác nhận tính năng (1) "không cần thiết nữa" — vì vậy chỉ xoá tính năng (1), GIỮ
    NGUYÊN tính năng (2) (nếu xoá luôn cả quét xác minh thì sẽ vi phạm chính yêu cầu "không được
    bypass qua bước nào hết" ở mục 89).

### Đã xoá (trong `public/staff-kiosk/staff-kiosk.js` và `public/staff-kiosk/index.html`)

- Hàm `autoIssueFromScan()` (toàn bộ logic tự xác định đối tượng + gọi `POST /api/tickets/staff`
  + hiển thị/in phiếu).
- Biến khoá `autoIssueBusy` (chỉ dùng để chặn spam nhiều lượt quét tự động chồng nhau — không còn
  cần vì không còn luồng tự động nào để chống chồng nhau nữa).
- Hàm `showAutoScanNotice()` + biến `autoScanNoticeTimer` (hiển thị thông báo lỗi/bị chặn trùng
  riêng cho luồng quét tự động).
- Khối `<div id="autoScanNotice">` trong `index.html` cùng dòng hướng dẫn cũ "Bệnh nhân cũng có
  thể tự quét CCCD/thẻ BHYT bất kỳ lúc nào để tự động lấy số, không cần chờ" — thay bằng dòng
  hướng dẫn mới: chọn đối tượng trước, sau đó mới quét ở bước xác minh.
- `processScanText(raw)`: nhánh "chưa chọn đối tượng nào" trước đây gọi `autoIssueFromScan(raw)`,
  nay chỉ đơn giản BỎ QUA lượt quét đó (nhân viên cần bấm chọn 1 đối tượng trước khi quét được ghi
  nhận).
- Dọn lại các đoạn chú thích liên quan (ở phần giải thích `STAFF_KIOSK_SKIP_VERIFY` và
  `focusScanInput()`) để không còn trỏ tới hàm đã xoá.

### Kết quả

- Từ nay `/staff-kiosk/` chỉ còn ĐÚNG 1 đường để xác định danh tính bệnh nhân: quét CCCD/BHYT ở
  bước "Sẵn sàng quét" SAU KHI nhân viên đã chủ động bấm chọn đối tượng — không còn 2 luồng độc
  lập nào có thể chạy song song và tranh chấp màn hình "Số thứ tự vừa cấp"/`resetForm()` nữa. Nhờ
  vậy, **giới hạn đã công bố ở mục 89** (bệnh nhân khác tự quét trong lúc đang chạy chuỗi "cấp
  nhiều số" tự động có thể làm chuỗi đếm sai) **không còn khả năng xảy ra được nữa** — vì không
  còn cách nào để 1 lượt quét độc lập tự tạo phiếu/gọi `resetForm()` mà không đi qua đúng luồng
  nhân viên chủ động chọn đối tượng.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `staff-kiosk.js` — không lỗi cú pháp; đếm số
  lượng thẻ `<div>`/`<button>` mở/đóng trong `index.html` — khớp nhau (33/33, 15/15, giảm đúng 1
  cặp `<div>` so với mục 89 vì đã xoá khối `#autoScanNotice`); `grep` xác nhận không còn lời gọi
  nào tới `autoIssueFromScan`/`autoIssueBusy`/`showAutoScanNotice`/`#autoScanNotice` trong code
  thực thi (chỉ còn trong chú thích giải thích lịch sử).
- **Lưu ý cho người dùng**: kiosk công khai (`/kiosk/`, dành cho bệnh nhân tự bốc số) hoàn toàn
  KHÔNG bị ảnh hưởng bởi thay đổi này — tính năng vừa xoá chỉ tồn tại riêng ở `/staff-kiosk/`
  (kiosk dành cho nhân viên).

## 91. Thêm nút "Chuyển sang kiosk bốc số bệnh nhân" cạnh nút Trang chủ + chặn mọi lối thoát khỏi màn hình khi đang cấp hàng loạt

- **Yêu cầu của người dùng (nguyên văn)**: "màn hình staff-kiosk bổ sung 1 cái nút kế bên icon
  home để tôi chuyển nhanh sang màn hình kiosk bốc số của bệnh nhân - nhớ kiểm tra xem cấp số thứ
  tự hàng loạt còn chạy thì không được nút nào được phép thoát khỏi màn hình staff-kiosk".

### Nút mới

- Thêm 1 nút tròn mới (`public/staff-kiosk/index.html`) đặt NGAY CẠNH nút "Trang chủ" (góc trên
  trái, cùng kiểu icon tròn `.home-link` có sẵn) — dẫn thẳng tới `/kiosk/` (màn hình kiosk bốc số
  công khai cho bệnh nhân), icon hình vé số để dễ phân biệt với icon nhà của nút "Trang chủ". Chỉnh
  lại `margin-left` của thanh tiêu đề (`.top-links`) để không bị 2 nút tròn này che mất.

### Kiểm tra "không được nút nào được phép thoát khi đang cấp hàng loạt"

- Rà lại toàn bộ các chỗ trong `/staff-kiosk/` có thể điều hướng RỜI KHỎI trang: (1) nút "Trang
  chủ" (`href="/"`); (2) nút mới "Chuyển sang kiosk bốc số" (`href="/kiosk/"`); (3) một lối ít ai
  để ý — quét mã QR "đăng nhập nhanh" của nhân viên (`tryStaffQrShortcut()`) cũng tự động chuyển
  thẳng sang `/kiosk/` mà không qua nút bấm nào cả. Các lượt chuyển hướng do PHIÊN ĐĂNG NHẬP HẾT
  HẠN (lỗi 401 từ server) được giữ nguyên không chặn — đó là trạng thái lỗi bắt buộc phải rời trang
  (không đăng nhập được nữa thì không thể tiếp tục cấp số), không phải người dùng chủ động bấm nút.
- Thêm hàm dùng chung `guardLeaveStaffKiosk(evt)` trong `staff-kiosk.js`: nếu đang có 1 chuỗi "cấp
  nhiều số" tự động còn chạy (`autoIssueSeq` khác `null`, xem mục 89), hàm này CHẶN LẠI (gọi
  `evt.preventDefault()`, trả về `false`) và hiện thông báo rõ ràng bảo nhân viên bấm "Dừng" ở màn
  hình nhập số lượng cần cấp trước; nếu không có chuỗi nào đang chạy thì cho đi bình thường (trả về
  `true`).
- Gắn hàm này vào cả 2 nút (`onclick="return guardLeaveStaffKiosk(event)"`) VÀ vào
  `tryStaffQrShortcut()` (chỉ điều hướng sang `/kiosk/` nếu `guardLeaveStaffKiosk()` cho phép) —
  đảm bảo không sót lối thoát nào.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `staff-kiosk.js` — không lỗi cú pháp; đếm số
  lượng thẻ `<div>/<button>/<a>/<svg>` mở/đóng trong `index.html` — khớp nhau hoàn toàn. Mô phỏng
  độc lập bằng Node.js tách riêng đúng logic của `guardLeaveStaffKiosk()` (dùng object giả lập
  `event.preventDefault()` để xác nhận có thực sự được gọi hay không) với 3 tình huống: (1) không
  có chuỗi nào đang chạy — cho phép đi, KHÔNG gọi `preventDefault()`; (2) đang có chuỗi chạy — chặn
  lại, CÓ gọi `preventDefault()`, hiện đúng 1 thông báo; (3) sau khi chuỗi đã dừng (`autoIssueSeq`
  về `null`, ví dụ nhân viên vừa bấm "Dừng") — lại cho phép đi bình thường. Cả 3 tình huống đều
  đúng như thiết kế.
- **Giới hạn còn lại (thành thật công bố)**: chưa (và không thể) chặn được việc nhân viên đóng hẳn
  tab/trình duyệt, tắt nguồn thiết bị, hoặc bấm nút "Back"/vuốt-lùi của hệ điều hành trong lúc đang
  cấp hàng loạt — đây là giới hạn kỹ thuật chung của mọi trang web (JavaScript không có quyền chặn
  các hành động cấp hệ điều hành/trình duyệt này một cách chắc chắn), không phải lỗi riêng của bản
  sửa này. Việc chặn ở đây chỉ áp dụng cho các nút/lối điều hướng NẰM TRONG chính trang
  `/staff-kiosk/`.

## 92. Thêm nút chuyển sang `/staff-kiosk/` ở màn hình Kiosk bốc số bệnh nhân — bắt buộc gõ tay mật khẩu

- **Yêu cầu của người dùng (nguyên văn)**: "màn hình kiosk bốc số của bệnh nhân Thêm mới 1 nút
  chuyển sang màn hình staff-kiosk kế bên nút home bắt buộc nhập pass thủ công để chuyển màn hình".

### Rà lại cơ chế "rời kiosk" đã có sẵn, để không làm trùng/xung đột

- Màn hình `/kiosk/` (bốc số công khai) trước đó đã có 2 cách rời màn hình liên quan đến nhân viên:
  1. Nút "🏠 Trang chủ" (`#kioskHomeBtn`, và cả khi bấm nút Back của trình duyệt) → mở modal
     `#staffExitModal` — modal này **CHỈ chấp nhận quét mã QR** đăng nhập nhanh (không có ô nhập
     tay), rồi điều hướng về "/". Tự động đóng lại nếu không quét gì trong vài giây.
  2. Quét thẳng mã QR "đăng nhập nhanh" vào ngay ô quét CCCD/BHYT chính của trang (không qua nút
     nào) → tự động chuyển thẳng sang `/staff-kiosk/` (`tryStaffQrShortcut()`).
  - Cả 2 cách trên đều dựa vào QUÉT MÃ QR, không có cách nào bắt gõ tay mật khẩu — đúng là còn
    thiếu tính năng người dùng vừa yêu cầu.

### Nút mới + modal mới

- Thêm nút tròn mới `#staffKioskSwitchBtn` (`public/kiosk/index.html`) đặt NGAY CẠNH nút "🏠 Trang
  chủ" ở góc trên-phải header — icon mũi tên đổi chiều (⇄) để phân biệt với icon nhà.
- Thêm modal mới `#staffKioskPasswordModal` — **KHÁC HẲN** modal `#staffExitModal` có sẵn: có hẳn 1
  ô `<input type="password">` thật (`#staffKioskPasswordInput`) để nhân viên GÕ TAY mật khẩu (ô này
  KHÔNG đặt `inputmode="none"` như các ô quét khác trong trang, để bàn phím ảo vẫn bật lên bình
  thường trên máy cảm ứng), cùng nút "Xác nhận"/"Hủy". Không có bộ đếm tự động đóng (khác
  `#staffExitModal`) vì gõ tay cần thời gian, tự đóng theo đồng hồ sẽ gây khó chịu.
- `requestStaffKioskSwitch()`/`closeStaffKioskPasswordModal()`/`submitStaffKioskSwitch()`
  (`public/kiosk/kiosk.js`): mở/đóng modal, gọi lại ĐÚNG API có sẵn `POST /api/auth/staff-login`
  (không tạo API riêng — API này chỉ so sánh chuỗi mật khẩu, không quan tâm chuỗi đó gõ tay hay đọc
  từ QR ra) — **CHỈ khi mật khẩu đúng** mới điều hướng sang `/staff-kiosk/` (khác nút Home điều
  hướng về "/"); mật khẩu sai hoặc bỏ trống đều báo lỗi rõ ràng và giữ nguyên tại màn hình Kiosk,
  không cho đi tiếp. Bấm Enter ngay trong ô mật khẩu cũng xác nhận được, không bắt buộc phải bấm
  nút bằng chuột/chạm.
- `focusScanner()` (vòng lặp giữ focus cho ô quét CCCD/BHYT chính, chạy lặp lại mỗi 800ms) được
  dạy thêm cờ `staffKioskPasswordModalOpen` — TRÁNH cướp focus khỏi ô nhập mật khẩu trong lúc modal
  này đang mở (nếu không sẽ bị "nhảy" focus ra khỏi ô đang gõ mỗi 800ms, không gõ được).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `kiosk.js` — không lỗi cú pháp; đếm số lượng
  thẻ `<div>/<button>/<input>/<svg>` mở/đóng trong `index.html` — khớp nhau hoàn toàn (3 `<input>`
  tự đóng, đúng bằng số ô nhập hiện có trên trang). Mô phỏng độc lập bằng Node.js tách riêng đúng
  logic của `submitStaffKioskSwitch()`/`focusScanner()` (dùng hàm `fetch` giả lập trả về đúng/sai
  theo mật khẩu) với 4 tình huống: (1) mật khẩu sai — bị chặn, KHÔNG điều hướng đi đâu; (2) mật
  khẩu đúng — điều hướng đúng sang `/staff-kiosk/`, đóng modal; (3) bỏ trống mật khẩu — bị chặn
  ngay từ đầu, không gọi API; (4) trong lúc modal đang mở, mô phỏng 5 lần "tick" của vòng lặp giữ
  focus — xác nhận KHÔNG lần nào cướp focus sang ô quét chính, ô mật khẩu vẫn giữ được focus. Cả 4
  tình huống đều đúng như thiết kế.
- **Không ảnh hưởng gì tới phiên đăng nhập**: giống hệt cơ chế đã có ở nút "Trang chủ"/quét QR
  (mục giải thích `pagehide`/`scheduleSoftLogout()` trong `kiosk.js`) — việc điều hướng sang
  `/staff-kiosk/` tự nhiên đi qua đúng cổng kiểm tra đăng nhập của trang đó, nên không cần thêm xử
  lý gì đặc biệt để "giữ" phiên hay huỷ lệnh đăng xuất mềm đang chờ.

## 93. Modal nhập mật khẩu chuyển sang `/staff-kiosk/` thêm đếm ngược cố định 10 giây, hết giờ tự quay về Kiosk

- **Yêu cầu của người dùng (nguyên văn)**: "màn hình kiosk bốc số của bệnh nhân nút chuyển sang màn
  hình staff-kiosk kế bên nút home có thời gian đếm ngược cố định 10s nó sẽ tự quay về màn hình
  kiosk bốc số của bệnh nhân".

### Bối cảnh

- Modal nhập mật khẩu thêm ở mục 92 (`#staffKioskPasswordModal`) lúc đó CHỦ Ý không có bộ đếm tự
  đóng, vì lo gõ tay mật khẩu cần thời gian, sợ đếm ngược làm gián đoạn. Theo yêu cầu mới nhất, bổ
  sung lại đếm ngược nhưng CỐ ĐỊNH 10 giây — khác với bộ đếm sẵn có ở modal quét QR
  (`#staffExitModal`, dùng chung cấu hình `KIOSK_AUTO_CONFIRM_SECONDS`) — mục này KHÔNG đọc theo
  cấu hình `.env` nào cả, luôn đúng 10 giây như người dùng nói rõ "cố định".

### Sửa (`public/kiosk/index.html`, `public/kiosk/kiosk.js`)

- Thêm dòng hiển thị đếm ngược trong modal: "Tự động quay lại Kiosk sau `<span id=
  "staffKioskPasswordCountdown">`10`</span>` giây nếu không xác nhận...".
- `requestStaffKioskSwitch()`: mỗi lần MỞ modal đều khởi động lại bộ đếm — hằng số
  `STAFF_KIOSK_PASSWORD_MODAL_SECONDS = 10` (cố định trong code, không đọc `.env`), cập nhật số
  hiển thị mỗi giây; hết 10 giây mà CHƯA xác nhận xong (chưa gõ đúng mật khẩu) sẽ tự gọi
  `closeStaffKioskPasswordModal()` — đóng modal, quay về đúng màn hình Kiosk bốc số bệnh nhân bình
  thường, KHÔNG điều hướng đi đâu cả (khác trường hợp mật khẩu đúng — điều hướng sang
  `/staff-kiosk/`).
- `closeStaffKioskPasswordModal()` và `submitStaffKioskSwitch()` (khi mật khẩu đúng) đều gọi
  `clearStaffKioskPasswordCountdown()` để HUỶ bộ đếm đang chạy — tránh trường hợp nhân viên đã bấm
  "Hủy" hoặc đã xác nhận thành công rồi mà bộ đếm cũ vẫn "ngầm" chạy tiếp và tự đóng nhầm modal lần
  sau/gây xung đột.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `kiosk.js` — không lỗi cú pháp; đếm thẻ
  `<div>/<button>/<input>/<svg>/<span>` mở/đóng trong `index.html` — khớp nhau hoàn toàn. Mô phỏng
  độc lập bằng Node.js (dùng `setTimeout`/`setInterval` thật, tách đúng logic mở modal/đếm
  ngược/đóng modal) với 3 tình huống: (1) không thao tác gì, đợi hơn 10 giây — modal tự đóng, KHÔNG
  điều hướng đi đâu; (2) xác nhận đúng mật khẩu ở giây thứ 3 (trước khi hết giờ) — modal đóng ngay,
  điều hướng đúng sang `/staff-kiosk/`, và bộ đếm cũ KHÔNG còn tác dụng gì nữa dù có đợi qua mốc 10
  giây ban đầu; (3) kiểm tra số hiển thị đếm ngược giảm đúng theo thời gian thực (còn 6-7 giây sau
  khoảng 3.5 giây trôi qua). Cả 3 tình huống đều đúng như thiết kế.

## 94. Kiosk bốc số bệnh nhân: quét mã QR "cấp nhanh" của Đối tượng thường để lấy số mà không cần quét CCCD/BHYT

- **Yêu cầu của người dùng (nguyên văn)**: "ở màn kiosk bốc số dành cho bệnh nhân - Bổ sung thêm
  chức năng cho phép quét mã QR của stt thường có thể lấy được số tt thường mà ko cần xác minh cccd
  hoặc thẻ bhyt".

### Tái dùng lại đúng cơ chế "QR cấp nhanh" đã có sẵn (không tạo API mới)

- Hệ thống đã có sẵn NGUYÊN VẸN 1 cơ chế đúng ý này ở `/staff-kiosk/` (thêm từ trước): nhân viên tạo
  1 mã QR "cấp nhanh" cho 1 đối tượng cụ thể (`GET /api/tickets/quick-qr-image/:code`, cần đã cấu
  hình `QUICK_QR_CODE_<code>` trong `.env`), mã QR đó mã hoá `QUICKQR|<code>|<secret>`; quét LẠI
  đúng mã đó (`POST /api/tickets/quick`) sẽ cấp số ngay cho đúng đối tượng, không cần bất kỳ thông
  tin xác minh nào. Cơ chế này trước đây CHỈ được nối dây ở màn hình `/staff-kiosk/`, kiosk công
  khai `/kiosk/` (dành cho bệnh nhân) hoàn toàn chưa xử lý được định dạng `QUICKQR|...` khi quét.
- Việc cần làm chỉ là NỐI DÂY thêm cho `/kiosk/` — không cần thêm route/API server nào mới:
  1. Nhân viên vào `/staff-kiosk/`, cấu hình sẵn `QUICK_QR_CODE_NORMAL` trong `.env`, bấm nút "📱
     QR" cạnh đối tượng "Đối tượng thường" để lấy ảnh mã QR, in ra dán ở khu vực chờ.
  2. Bệnh nhân tại kiosk công khai (`/kiosk/`) quét đúng mã QR đó (KHÔNG phải CCCD/BHYT của họ) —
     hệ thống nhận ra định dạng `QUICKQR|...` và cấp ngay 1 số "Đối tượng thường", bỏ qua hoàn toàn
     bước quét/xác minh giấy tờ.
- **Vì sao gọi được `POST /api/tickets/quick` (vốn yêu cầu đăng nhập nhân viên - `requireStaff`) từ
  trang công khai `/kiosk/`?** Vì bản thân `/kiosk/` từ trước đã nằm trong danh sách đường dẫn yêu
  cầu đăng nhập nhân viên (`GATED_PATH_PREFIXES` trong `src/server.js`) — nhân viên đăng nhập 1 lần
  lúc thiết lập máy, phiên đăng nhập đó (cookie `staff_token`) vẫn còn hiệu lực trong lúc bệnh nhân
  tự thao tác — nên request gọi từ đúng trang này tự nhiên đã có quyền, không cần nới lỏng gì thêm.

### Sửa (chỉ `public/kiosk/kiosk.js`, không đổi `index.html`/server)

- Thêm hằng số `QUICKQR_PREFIX = 'QUICKQR|'` (giống hệt `staff-kiosk.js`).
- `looksLikeCompleteQr(raw)` (điều kiện "đủ dữ liệu" cho `ScannerBuffer`, tránh xử lý nhầm 1 chuỗi
  bị cắt cụt giữa chừng): thêm nhánh kiểm tra `QUICKQR_PREFIX` NGAY ĐẦU HÀM — bắt buộc phải kiểm tra
  TRƯỚC nhánh CCCD/BHYT, vì định dạng `QUICKQR|<code>|<secret>` cũng có dấu "|" nhưng chỉ có đúng 3
  phần (nhánh CCCD/BHYT cũ đòi tối thiểu 4 phần nên sẽ trả về sai `false` nếu không tách riêng).
- `handleScanRaw(raw)`: thêm nhánh kiểm tra `QUICKQR_PREFIX` NGAY ĐẦU HÀM (trước cả nhánh "QR đăng
  nhập nhanh của nhân viên") — gọi hàm mới `processQuickQrScan(raw)` rồi dừng lại, không rơi xuống
  các nhánh xử lý CCCD/BHYT/đăng nhập nhanh bên dưới.
- Hàm mới `processQuickQrScan(raw)`: gọi `POST /api/tickets/quick` với đúng chuỗi vừa quét được,
  thành công thì chuyển thẳng sang màn hình "Số thứ tự của bạn" (ẩn `#step-scan`, hiện `#step-done`,
  set đúng số + màu/nhãn theo `ticket.priority_code`), in phiếu ngay (không có tên/ngày sinh/mã QR
  bệnh nhân trên phiếu vì không có thông tin nào để in), rồi bắt đầu đếm ngược tự động quay lại màn
  hình quét như một lượt cấp số bình thường (`startDoneCountdown()`). Thất bại (mã QR sai/hết hiệu
  lực) thì chỉ báo lỗi ngay tại `#step-scan`, không đổi màn hình.
- Hàm phụ `labelForCode(code)` mới — tra nhãn hiển thị của đối tượng từ danh sách `priorityRulesForCount`
  đã tải sẵn (dùng chung dữ liệu cho khung đếm số lượng đang chờ ở cuối trang), tránh phải gọi thêm
  API riêng chỉ để lấy 1 cái tên hiển thị.
- **Lưu ý quan trọng**: cơ chế này thực ra KHÔNG giới hạn riêng cho "Đối tượng thường" — hoạt động
  với BẤT KỲ đối tượng nào đã được cấu hình `QUICK_QR_CODE_<code>`, y hệt logic sẵn có ở
  `/staff-kiosk/`. Đúng theo yêu cầu hiện tại chỉ cần tạo 1 mã cho `NORMAL` là đủ, nhưng nếu sau này
  cần thêm mã cấp nhanh cho đối tượng khác ở kiosk công khai thì không cần sửa thêm dòng code nào.
- **Đã kiểm chứng bằng công cụ**: `node --check` trên `kiosk.js` — không lỗi cú pháp. Mô phỏng độc
  lập bằng Node.js tách riêng đúng logic của `looksLikeCompleteQr()`/`handleScanRaw()` (dùng các hàm
  giả lập để theo dõi nhánh nào thực sự được gọi) với 4 tình huống: (1) chuỗi `QUICKQR|...` được
  `looksLikeCompleteQr()` coi là ĐỦ dữ liệu ngay; (2) chuỗi đó được `handleScanRaw()` định tuyến
  ĐÚNG sang `processQuickQrScan()`, KHÔNG rơi vào 2 nhánh còn lại; (3) một chuỗi mật khẩu đăng nhập
  nhanh (không dấu "|") vẫn định tuyến đúng như cũ, không bị nhánh mới can thiệp nhầm; (4) một chuỗi
  CCCD hợp lệ vẫn định tuyến đúng vào nhánh xử lý CCCD/BHYT như cũ. Cả 4 tình huống đều đúng, xác
  nhận tính năng mới không phá vỡ 2 luồng quét đã có từ trước.
- **Giới hạn thành thật cần biết**: chưa kiểm chứng được bằng máy in/máy quét thật (mô phỏng chỉ
  xác nhận đúng logic định tuyến JavaScript) — nếu gặp trục trặc khi in phiếu qua mã QR cấp nhanh
  trên phần cứng thật, xin phản ánh lại kèm thông tin máy in đang dùng.

## 95. Sửa lỗi treo ứng dụng widget khi máy quét Zebra quét liên tục ở màn hình Kiosk

- **Yêu cầu của người dùng (nguyên văn)**: "widget máy quét zebra quét 1 hồi ở màn hình kiosk ứng
  dụng bị treo dùng màn hình cảm ứng nhập phím ảo cũng k ăn input".

### Truy tìm nguyên nhân

- Đọc kỹ lại toàn bộ đường đi của 1 lượt "quét → tạo vé → in phiếu" ở `/kiosk/`, đặc biệt chú ý
  tính năng "quét mã QR cấp nhanh" vừa thêm ở mục 94 (`processQuickQrScan()`) — đây là đường có
  **nguy cơ cao nhất**: mỗi lượt quét tạo vé + gọi in **NGAY LẬP TỨC**, hoàn toàn KHÔNG có độ trễ/
  khoá nào giữa 2 lượt quét liên tiếp (khác hẳn lượt quét CCCD/BHYT bình thường, còn phải chờ bộ
  đếm ngược `autoConfirmSeconds` trước khi thực sự tạo vé).
- Máy quét Zebra (kiểu bàn phím - keyboard wedge) không có giới hạn tốc độ quét nào cả — nếu nhân
  viên/bệnh nhân quét liên tục nhiều mã QR cấp nhanh (hoặc máy quét bị lỗi gửi trùng tín hiệu),
  nhiều lượt `createTicket()`/`processQuickQrScan()` sẽ gọi `printReceipt()` GẦN NHƯ CÙNG LÚC.
- Ở phía `electron-widget/main.js`, `ipcMain.handle('print-ticket', ...)` (kênh IPC nhận lệnh in từ
  trang web) trước đây gọi THẲNG `printTicketSilently()` cho MỖI yêu cầu `invoke()` tới — **Electron
  KHÔNG tự động serialize (xếp hàng) các lệnh `invoke()` riêng lẻ này**. Khi 2 (hay nhiều) lệnh in
  tới gần như đồng thời, nhiều lệnh `printTicketSilently()` chạy CHỒNG CHÉO/SONG SONG, kể cả gọi
  ĐÈ LÊN NHAU `win.webContents.printToPDF()` trên CÙNG 1 `webContents` khi lệnh trước vẫn còn đang
  xuất PDF dở dang — đây là kiểu gọi API mà Chromium/Electron KHÔNG đảm bảo an toàn khi chồng chéo
  trên cùng 1 `webContents`, và có thể khiến tiến trình renderer (hoặc toàn bộ ứng dụng) bị "kẹt"
  (treo) — khớp đúng với triệu chứng người dùng mô tả: treo sau một hồi quét liên tục, và một khi
  renderer bị khoá cứng như vậy, MỌI thao tác khác (kể cả chạm bàn phím ảo) đều không còn phản hồi,
  vì toàn bộ giao diện chạy trên cùng 1 luồng bị chặn.

### Sửa — 2 lớp bảo vệ, ở cả tiến trình chính (Electron) lẫn trang web

- **Lớp 1 (quan trọng nhất, chặn đúng gốc treo ứng dụng) — `electron-widget/main.js`**: thêm 1
  HÀNG ĐỢI IN TOÀN CỤC (`printQueueTail`, một chuỗi Promise nối tiếp) — MỌI lệnh in, bất kể đến từ
  cửa sổ nào (`/kiosk/`, `/staff-kiosk/`, hay cửa sổ ẩn của "cầu nối in" HTTP cục bộ ở mục 88), đều
  đi qua hàng đợi này (`queuePrintJob()`) thay vì gọi thẳng `printTicketSilently()`. Lệnh in SAU chỉ
  thực sự bắt đầu chạy SAU KHI lệnh in TRƯỚC nó đã hoàn tất hẳn (thành công hay thất bại) — không
  bao giờ còn 2 lệnh `printToPDF()` chạy chồng chéo trên cùng 1 cửa sổ nữa, dù có bao nhiêu yêu cầu
  in dồn tới cùng lúc.
- **Lớp 2 (phòng ngừa thêm, tránh cả lỗi nội dung sai lệch) — `public/kiosk/kiosk.js`**: thêm 1
  HÀNG ĐỢI xử lý ở phía trang web (`kioskActionQueueTail`/`enqueueKioskAction()`) — mọi lượt quét
  (`handleScanRaw()`, đổi tên logic thật thành `handleScanRawInner()`) và mọi lần "tạo số"
  (`goToPriorityStep()`, đổi tên logic thật thành `goToPriorityStepInner()`, gọi từ cả bộ đếm tự
  động lẫn nút "Tiếp tục →" thủ công) đều đi qua CHUNG 1 hàng đợi này — hành động sau chỉ bắt đầu
  SAU KHI hành động trước đã chạy xong HẲN. Đồng thời sửa `createTicket()` và `processQuickQrScan()`
  để THỰC SỰ `await` lệnh `printReceipt()` (trước đây "bắn lệnh rồi thôi", không chờ) — nhờ vậy
  "chạy xong hẳn" bao gồm luôn cả việc in xong, không chỉ tạo vé xong. Áp dụng thêm `await` tương tự
  cho `processQuickQrScan()` ở `/staff-kiosk/` (lớp bảo vệ bổ sung, không phải sửa chính — sửa chính
  vẫn là hàng đợi ở `electron-widget/main.js`).
- **Đã kiểm chứng bằng công cụ**: `node --check` trên cả 5 file sửa (`electron-widget/main.js`,
  `public/kiosk/kiosk.js`, `public/staff-kiosk/staff-kiosk.js`, cùng 2 file liên quan không đổi nội
  dung nhưng đọc lại để xác nhận `preload.js`/`print-receipt.js`) — không lỗi cú pháp. Dựng THẬT 1
  ứng dụng Electron riêng (qua `xvfb-run`) mô phỏng đúng cơ chế hàng đợi in mới: gửi 5 lệnh
  `ipcRenderer.invoke('print-ticket', ...)` HOÀN TOÀN ĐỒNG THỜI (không chờ nhau, y hệt cách máy quét
  Zebra có thể kích hoạt nhiều lượt in gần như cùng lúc) — xác nhận: KHÔNG có lúc nào 2 lệnh in cùng
  chạy song song (`maxConcurrent = 1` suốt quá trình), và cả 5 lệnh hoàn tất ĐÚNG THEO THỨ TỰ đã gửi
  (1→2→3→4→5, không lệnh nào bị chen ngang/chạy trước). Mô phỏng độc lập bằng Node.js cho hàng đợi
  phía `kiosk.js` (6 lượt "quét" bắn đồng thời) cho kết quả tương tự — không chồng chéo, đúng thứ tự.
- **Giới hạn thành thật cần biết**: đây là sửa lỗi dựa trên PHÂN TÍCH CODE (đọc kỹ luồng gọi API,
  xác định đúng chỗ có thể gọi chồng chéo `printToPDF()` trên cùng 1 `webContents` — một hành vi đã
  biết là không an toàn của Chromium/Electron) và đã kiểm chứng ĐÚNG CƠ CHẾ HÀNG ĐỢI hoạt động chính
  xác bằng Electron thật, KHÔNG PHẢI tái hiện được y hệt tình huống treo trên phần cứng thật (máy
  quét Zebra thật, máy in nhiệt thật) trong môi trường này — vì máy quét/máy in vật lý không thể kết
  nối vào môi trường đang chạy đoạn hội thoại này. Nếu sau khi cập nhật bản này mà tình trạng treo
  vẫn còn xảy ra (nhớ TẮT HẲN rồi MỞ LẠI ứng dụng widget để nạp code mới, không chỉ đóng cửa sổ),
  xin phản ánh lại kèm: tần suất/tốc độ quét thực tế lúc bị treo, và nếu có thể, nội dung file log
  gỡ lỗi của widget (`in-phieu-debug.log`, xem `debugLog()` trong `electron-widget/main.js`) ngay
  trước thời điểm treo — để xác định liệu còn nguyên nhân nào khác ngoài phạm vi đã sửa ở đây.

## 96. Thêm nút "Mở reset > 16h" ở `/staff-kiosk/` để reset STT tiếp nhận sau 16 giờ

**Yêu cầu người dùng (nguyên văn)**: *"ok rồi. bổ sung 1 nút trong staff-kiosk Mở reset > 16h nếu
thời gian hiện tại > 16h thì sẽ cho phép reset stt tiếp nhận"*

### Tìm hiểu cơ chế cấp số hiện tại trước khi làm

- Đọc `src/services/sequenceService.js`: số thứ tự (STT) mỗi ngày được sinh bằng
  `getNextTicketNumber()`, dựa trên 1 bảng `seq` rất gọn — mỗi dòng gồm `day` (khoá chính) và `seq`
  (số đếm hiện tại). `day` mặc định là ngày hôm nay dạng `YYYY-MM-DD` (hàm `todayKey()`) — nhờ vậy
  STT **tự động** bắt đầu lại từ 1 mỗi khi sang ngày mới (khoá `day` đổi thành ngày mới, dòng cũ
  vẫn còn nguyên trong bảng cho ngày hôm qua). Khi bật `SEPARATE_PRIORITY_SEQUENCE` (2 dãy số riêng
  cho "thường"/"ưu tiên"), khoá thực dùng thêm hậu tố `::T`/`::U` (ví dụ `2026-09-07::T`).
- Trước mục này, **hoàn toàn chưa có** cơ chế reset thủ công nào cho bộ đếm `seq` — chỉ có 1 job dọn
  dữ liệu cũ theo ngày (`cleanupService.js`, xoá các dòng `seq`/`tickets` CŨ HƠN số ngày lưu trữ cấu
  hình, không liên quan đến việc reset TRONG ngày hôm nay).
- Xác định "STT tiếp nhận" mà người dùng nhắc tới chính là bộ đếm STT nói trên (số thứ tự cấp cho
  bệnh nhân khi "tiếp nhận" — từ dùng chung trong toàn hệ thống để chỉ khâu cấp số, xem tiêu đề các
  màn hình `/counter`, `/counter-admin`: "quầy tiếp nhận", "nhân viên tiếp nhận"...), không phải 1
  khái niệm/bảng dữ liệu nào khác.
- Suy luận về mục đích và thiết kế điều kiện "> 16h": đây rõ ràng là để nhân viên có thể **tách
  riêng STT buổi sáng/buổi chiều** (ví dụ hết giờ làm buổi sáng, muốn buổi chiều cấp số lại từ 1),
  và điều kiện giờ là để **tránh bấm nhầm** giữa lúc phòng khám còn đang hoạt động bình thường (nếu
  reset giữa chừng buổi sáng, số MỚI cấp sẽ trùng với số ĐÃ cấp trước đó cùng ngày — dễ gây nhầm lẫn
  khi gọi số/đối chiếu). Vì vậy chọn thiết kế: nút LUÔN hiển thị (để nhân viên biết tính năng tồn
  tại) nhưng bị khoá (`disabled`) cho tới khi qua 16:00, và **kiểm tra giờ ở CẢ 2 phía** — phía máy
  khách chỉ để bật/tắt giao diện cho tiện nhìn, phía máy chủ mới là lớp quyết định thật sự (giống
  cách làm với `requireStaff`/`STAFF_PASSWORD` — không tin đồng hồ máy khách).

### Các thay đổi

- **`src/routes/tickets.js`**: thêm route mới `POST /api/tickets/reset-sequence` (có `requireStaff`,
  yêu cầu đã đăng nhập nhân viên như mọi route khác của `/staff-kiosk/`):
  - Kiểm tra giờ hiện tại theo đồng hồ **máy chủ** (`dayjs()`) — nếu `now.hour() < 16` thì từ chối
    ngay, trả về lỗi 403 kèm thông báo giờ hiện tại, KHÔNG đụng gì tới dữ liệu.
  - Nếu đã qua 16:00: chạy `DELETE FROM seq WHERE day = ? OR day LIKE ?` với tham số là khoá ngày
    hôm nay và khoá hôm nay kèm hậu tố (`YYYY-MM-DD::%`) — xoá **toàn bộ** các dòng bộ đếm của hôm
    nay (cả khoá mặc định lẫn 2 khoá riêng `::T`/`::U` nếu có bật `SEPARATE_PRIORITY_SEQUENCE`,
    xoá cả 2 loại cho chắc chắn dù cấu hình hiện tại đang bật hay tắt tính năng đó). Sau khi xoá,
    lần cấp số kế tiếp (bất kỳ đối tượng nào) sẽ tự tạo dòng `seq` mới bắt đầu từ 1 — nhờ đúng cơ
    chế `INSERT ... ON CONFLICT ... RETURNING` sẵn có trong `getNextTicketNumber()`, không cần sửa
    gì thêm ở `sequenceService.js`.
  - Ghi log ra console (kèm giờ/số dòng đã xoá) để có dấu vết khi cần tra soát về sau.
  - **Chủ động KHÔNG xoá/đụng tới bảng `tickets`** — các vé đã cấp trước đó trong ngày vẫn giữ
    nguyên toàn bộ dữ liệu, chỉ bộ đếm bị reset. Điều này đúng như yêu cầu ("reset stt tiếp nhận",
    không phải "xoá lịch sử vé"), nhưng có nghĩa là **số MỚI cấp sau khi reset có thể trùng với số
    đã cấp trước đó cùng ngày** — xem mục "Giới hạn/lưu ý" bên dưới.
- **`public/staff-kiosk/index.html`**: thêm nút mới `#resetSequenceBtn` ("Mở reset > 16h") đặt cạnh
  nút "Cài đặt ứng dụng" hiện có ở góc trên bên phải (khu vực `.top-links`). Nút có sẵn thuộc tính
  `disabled` trong HTML (mặc định khoá khi trang vừa tải, trước khi JavaScript kịp kiểm tra giờ).
- **`public/staff-kiosk/staff-kiosk.js`**: thêm các hàm mới, KHÔNG đụng tới bất kỳ luồng cấp số nào
  đã có từ trước:
  - `isResetSequenceAllowedNow()`: kiểm tra `new Date().getHours() >= 16` theo đồng hồ máy khách —
    chỉ để quyết định giao diện, không phải lớp bảo vệ thật.
  - `updateResetSequenceBtnUI()`: bật/khoá nút + đổi `title` (tooltip) tương ứng; được gọi ngay khi
    tải trang và lặp lại mỗi 30 giây (`setInterval`) để nút tự "mở khoá" đúng lúc 16:00 mà không cần
    nhân viên tải lại trang.
  - `handleResetSequenceClick()`: khi bấm nút — (1) nếu đang có 1 chuỗi "cấp nhiều số" tự động
    (`autoIssueSeq`) đang chạy thì CHẶN LẠI kèm cảnh báo yêu cầu bấm "Dừng" trước (tránh reset bộ
    đếm giữa lúc đang cấp hàng loạt, dễ gây nhầm lẫn ngay trong chính lô đang cấp); (2) kiểm tra lại
    giờ phía client cho chắc; (3) hiện hộp thoại `confirm()` xác nhận, nói rõ hệ quả (số mới có thể
    trùng số cũ cùng ngày) trước khi thực sự gọi API; (4) gọi `POST /api/tickets/reset-sequence`,
    hiện thông báo kết quả thành công/thất bại tương ứng.

### Đã kiểm chứng bằng công cụ

- `node --check` trên cả `src/routes/tickets.js` và `public/staff-kiosk/staff-kiosk.js` — không lỗi
  cú pháp.
- Đếm cân bằng thẻ HTML (script Python, div/button/input/svg/span/a) trên
  `public/staff-kiosk/index.html` sau khi thêm nút mới: `div 33/33`, `button 16/16` (tăng đúng 1 nút
  so với 15 trước đó), `input 2/2 (self-closing)`, `svg 2/2`, `span 2/2`, `a 2/2` — khớp, không lệch
  thẻ.
- Mô phỏng trực tiếp câu lệnh xoá bằng `node:sqlite` (`DatabaseSync(':memory:')`, không đụng tới CSDL
  thật): tạo sẵn 4 dòng `seq` — `2026-09-07` (hôm nay), `2026-09-07::T`, `2026-09-07::U` (2 dãy
  riêng của hôm nay), và `2026-09-06` (hôm qua) — chạy đúng câu `DELETE` dùng trong route mới: kết
  quả xoá ĐÚNG 3 dòng của hôm nay (cả 2 dãy riêng), dòng `2026-09-06` của hôm qua **được giữ
  nguyên** — xác nhận không ảnh hưởng dữ liệu ngày khác.
- Chạy THẬT server (`node src/server.js` với CSDL tạm riêng, cổng riêng, xoá sau khi test xong) và
  gọi bằng `curl`: (1) đăng nhập nhân viên qua `POST /api/auth/staff-login` lấy cookie phiên; (2)
  gọi `POST /api/tickets/reset-sequence` KHÔNG kèm cookie — nhận đúng lỗi `"Chưa đăng nhập nhân
  viên"` (401, đúng như mọi route `requireStaff` khác); (3) gọi lại CÓ kèm cookie, vào đúng thời
  điểm thật sự đã qua 16:00 trên máy chủ — nhận `{"ok":true,"resetAt":...}` như thiết kế.
- Kiểm chứng riêng ngưỡng giờ 16:00 bằng script Node.js dùng `dayjs().hour(<giờ giả lập>)` để mô
  phỏng đúng logic so sánh trong route (không phụ thuộc giờ thật của máy chủ lúc chạy test): 15h ->
  bị từ chối (403), 16h/23h -> được phép (200), 0h (nửa đêm) -> bị từ chối (403) — đúng như mong đợi
  (chỉ cho phép từ 16:00 đến hết ngày, không cho phép từ 0:00 tới trước 16:00).

### Giới hạn/lưu ý thành thật

- Đây là thao tác **có chủ đích cho phép trùng số trong cùng 1 ngày** (chỉ xoá bộ đếm, không xoá vé
  đã cấp) — đúng theo đúng yêu cầu ngắn gọn của người dùng, nhưng hệ thống **không tự động đánh dấu**
  "đợt cấp số" nào trước/sau lần reset để phân biệt khi tra cứu về sau (ví dụ 2 vé cùng mang số 015
  trong cùng 1 ngày sẽ trông giống hệt nhau nếu chỉ nhìn số, phải xem thêm cột `created_at`/giờ tạo
  trong CSDL hoặc trên các màn hình có hiển thị giờ mới phân biệt được). Nếu sau này cần phân biệt rõ
  ràng hơn (ví dụ hiển thị thêm nhãn "buổi sáng/buổi chiều" trên phiếu), sẽ cần bàn thêm để làm 1
  tính năng riêng.
- Mốc "16:00" và việc chỉ kiểm tra `getHours() >= 16` (không có mốc kết thúc) là suy luận hợp lý từ
  yêu cầu ngắn gọn "nếu thời gian hiện tại > 16h thì sẽ cho phép" — hiểu là **cho phép từ 16:00 tới
  hết ngày (24:00)**, không tự khoá lại trước nửa đêm. Nếu ý người dùng khác (ví dụ chỉ muốn mở
  trong 1 khung giờ hẹp hơn, hoặc mốc giờ khác 16:00), xin phản hồi lại để chỉnh.
- Chưa thêm nút reset tương tự ở màn hình `/counter` hay `/counter-admin` — theo đúng yêu cầu người
  dùng là "1 nút trong staff-kiosk", nên chỉ làm ở đúng màn hình đó.

## 97. Sửa lại đúng nghĩa nút "Mở reset > 16h": KHÔNG xoá bộ đếm cùng ngày, mà CHUYỂN SANG CẤP SỐ CHO NGÀY TIẾP THEO

**Yêu cầu người dùng (nguyên văn, làm rõ lại ý muốn ban đầu ở mục 96)**: *"ok rồi. Mở reset > 16h ở
màn hình staff-kiosk là ngưng cấp số ở ngày hiện tại. bắt đầu cấp số cho ngày tiếp theo đó ạ"*

### Vì sao phải sửa lại

Thiết kế ban đầu ở mục 96 (dựa trên câu yêu cầu ngắn gọn lúc đó) đã hiểu SAI ý người dùng: cứ XOÁ
bộ đếm `seq` của **hôm nay** để số tiếp theo **vẫn thuộc hôm nay** nhưng bắt đầu lại từ 1 — hệ quả
là số mới có thể **trùng số** với số đã cấp trước đó cùng ngày (đã tự nhận là hạn chế trong mục 96).
Người dùng làm rõ lại: ý muốn thực sự là "**ngưng cấp số ở ngày hiện tại**" (không cấp thêm số nào
mang ngày hôm nay nữa) và "**bắt đầu cấp số cho ngày tiếp theo**" (ngày mai) — tức KHÔNG chấp nhận
trùng số, mà là chuyển hẳn sang một "ngày làm việc" mới, sớm hơn nửa đêm thật.

### Thiết kế lại

- Thêm khái niệm **"ngày hiệu lực" (effective day)**: bình thường đúng bằng ngày thực tế hôm nay
  (như trước giờ), nhưng khi nhân viên bấm nút này, hệ thống ghi nhớ 1 "ngày override" = ngày mai
  (tính tại thời điểm bấm) — kể từ đó, **MỌI nơi liên quan đến cấp số/thống kê theo ngày** đều dùng
  "ngày hiệu lực" này THAY VÌ ngày thực tế, cho tới khi đồng hồ thật sự bước sang đúng ngày đó thì tự
  động "hết hạn" (dọn sạch, không cần nhân viên làm gì thêm) — từ đó về sau lại là ngày thực tế bình
  thường, không bị lệch thêm.
- **`src/config/db.js`**: thêm bảng mới `app_state (key TEXT PRIMARY KEY, value TEXT)` — nơi lưu
  đúng 1 khoá `effective_day_override` (thiết kế dạng key-value đơn giản để sau này có thể tái sử
  dụng cho các cấu hình nhỏ khác mà không cần thêm bảng/migrate cột mới).
- **`src/services/sequenceService.js`**: thêm `getEffectiveDay(db)` (đọc `app_state`, tự dọn override
  đã "hết hạn"), `setEffectiveDayOverrideToNextDay(db)` (ghi override = ngày mai). Đổi
  `getNextTicketNumber()` để lấy `day` từ `getEffectiveDay(db)` thay vì `todayKey()` trực tiếp — vé
  mới cấp sau khi chuyển ngày sẽ tự động mang ngày mới VÀ tự bắt đầu số từ 1 (vì là khoá `seq` hoàn
  toàn mới, chưa từng tồn tại — không cần xoá dòng cũ như thiết kế sai ở mục 96).
- **`src/server.js`, `src/routes/tickets.js`, `src/routes/display.js`, `src/routes/counters.js`**:
  thay TOÀN BỘ các chỗ gọi `todayKey()` để lọc/thống kê theo ngày (`getDisplaySummary`,
  `getSkippedTickets`, `getCalledTickets`, `broadcastSummary`...) bằng `getEffectiveDay(db)` — đảm
  bảo mọi màn hình (`/counter`, `/display`, `/counter-admin`, socket `queue:summary`) đều nhất quán
  hiển thị theo đúng "ngày hiệu lực" hiện tại, không lệch với ngày được dùng để cấp số.
- **`src/routes/tickets.js`**: viết lại hoàn toàn nội dung route `POST /api/tickets/reset-sequence`
  (giữ nguyên đường dẫn) — vẫn giữ lớp kiểm tra giờ phía server (`dayjs().hour() < 16` → từ chối
  403), nhưng thay vì `DELETE FROM seq...`, nay gọi `setEffectiveDayOverrideToNextDay(db)`, rồi trả
  về `{ ok, previousDay, nextDay, stillWaiting, resetAt }` (`stillWaiting` = số vé đang "waiting"
  còn lại của ngày cũ tại thời điểm chuyển, để giao diện cảnh báo).
- **`public/staff-kiosk/staff-kiosk.js`**: sửa lại `handleResetSequenceClick()` — dùng
  `lastSummaryForCount.waitingCount` (đã có sẵn từ luồng cập nhật realtime `queue:summary`, không
  cần gọi thêm API) để cảnh báo NGAY TRONG hộp thoại xác nhận nếu còn số chưa gọi của hôm nay, nói
  rõ: số đó vẫn gọi được bình thường nhưng sẽ không còn hiện trong bảng tổng hợp/danh sách chờ sau
  khi chuyển ngày. Đổi toàn bộ nội dung thông báo (tooltip nút, hộp xác nhận, thông báo kết quả) cho
  khớp đúng hành vi mới ("ngưng cấp số ngày hôm nay, chuyển sang ngày tiếp theo" thay vì "reset về
  1"). `isResetSequenceAllowedNow()`/`updateResetSequenceBtnUI()`/cơ chế khoá nút trước 16h giữ
  nguyên như mục 96, không đổi.
- **`public/staff-kiosk/index.html`**: chỉ sửa lại nội dung chú thích cho khớp thiết kế mới, KHÔNG
  đổi gì về cấu trúc thẻ HTML (nút vẫn giữ nguyên `id`/nhãn "Mở reset > 16h" như mục 96).

### Vì sao vé "waiting" cũ (ngày hôm trước) vẫn gọi được bình thường

Kiểm tra kỹ `callNextTicket()`/`callNextTicketByPriority()` trong `ticketService.js`: cả 2 hàm này
chọn vé để gọi theo `status = 'waiting'` sắp theo `priority_rank`/`number`, **KHÔNG hề lọc theo cột
`day`** — hành vi này vốn đã như vậy từ trước (không phải thay đổi mới ở mục này). Vì vậy quyết định
thiết kế: các vé "waiting" đã cấp trước khi chuyển ngày **không hề bị ảnh hưởng gì cả** ở khâu gọi số
thực tế tại quầy — chỉ riêng phần **thống kê/hiển thị theo ngày** (đã lọc theo `getEffectiveDay()`)
là không còn đếm chúng vào "đang chờ" nữa. Đây là lý do phải cảnh báo rõ trong hộp xác nhận, để nhân
viên biết chỉ nên bấm nút này khi hàng chờ hôm nay coi như đã xử lý xong.

### Đã kiểm chứng bằng công cụ

- `node --check` trên toàn bộ 6 file sửa (`src/config/db.js`, `src/services/sequenceService.js`,
  `src/server.js`, `src/routes/tickets.js`, `src/routes/display.js`, `src/routes/counters.js`,
  `public/staff-kiosk/staff-kiosk.js`) — không lỗi cú pháp.
- Đếm cân bằng thẻ HTML lại trên `public/staff-kiosk/index.html` (chỉ đổi nội dung chú thích, không
  đổi thẻ) — vẫn khớp `div 33/33`, `button 16/16`, `input 2/2`, `svg 2/2`, `span 2/2`, `a 2/2` như
  mục 96.
- Mô phỏng trực tiếp `getEffectiveDay()`/`setEffectiveDayOverrideToNextDay()` bằng `node:sqlite`
  (`DatabaseSync(':memory:')`): (1) đặt sẵn 1 override "đã cũ" (ngày ở quá khứ xa) — gọi
  `getEffectiveDay()` xác nhận TỰ ĐỘNG dọn override đó và trả về đúng ngày thực tế, bảng `app_state`
  rỗng trở lại (đúng cơ chế "tự hết hạn"); (2) gọi `setEffectiveDayOverrideToNextDay()` rồi gọi lại
  `getEffectiveDay()` — xác nhận trả về đúng ngày mai.
- Chạy THẬT server (`node src/server.js`, CSDL/cổng tạm riêng, xoá sau khi test) qua `curl`, kịch
  bản đầy đủ: (1) đăng nhập nhân viên; (2) cấp 2 vé "hôm nay" qua `/api/tickets/staff` — xác nhận
  `day` đúng là ngày thực tế; (3) `GET /api/display/summary` trước khi chuyển ngày — `waitingCount:
  2`, đúng ngày hôm nay; (4) gọi `POST /api/tickets/reset-sequence` (đúng lúc server đã qua 16:00) —
  nhận `{"ok":true,"previousDay":"...07","nextDay":"...08","stillWaiting":2,...}`; (5) cấp thêm 1 vé
  — xác nhận vé mới có `day` = ngày mai VÀ `number: 1` (bắt đầu lại từ 1 đúng như thiết kế); (6) gọi
  lại `GET /api/display/summary` — xác nhận `day` đã chuyển sang ngày mai, `waitingCount: 1` (chỉ
  còn đếm vé mới, đúng như cảnh báo).
- Kiểm chứng riêng việc vé cũ vẫn gọi được: tạo 1 quầy (`POST /api/counters`), cấp 1 vé trước khi
  chuyển ngày và 1 vé sau khi chuyển ngày (cả 2 đều là `number: 1` vì khác `day`), gọi `call-next`
  2 lần liên tiếp — xác nhận lần gọi ĐẦU TIÊN trả về đúng vé của ngày cũ (id nhỏ hơn, được tạo
  trước), lần gọi THỨ HAI mới trả về vé của ngày mới — đúng thứ tự thời gian tạo, không bị lẫn lộn
  hay bỏ sót.

### Giới hạn/lưu ý thành thật

- Đúng như đã nêu ở phần "Vì sao vé cũ vẫn gọi được" — sau khi chuyển ngày, các vé "waiting" của
  ngày cũ **biến mất khỏi mọi con số thống kê/danh sách hiển thị theo ngày** (tổng số đang chờ, số
  đang chờ theo từng đối tượng...) dù vẫn gọi được bình thường ở quầy. Hệ thống hiện KHÔNG hiển thị
  gộp "còn X số ngày hôm qua chưa gọi" ở màn hình `/display`/`/counter` sau khi chuyển ngày — nhân
  viên chỉ được cảnh báo 1 lần DUY NHẤT ngay lúc bấm nút (qua hộp `confirm()`), không có nhắc lại
  liên tục sau đó. Nếu cần hiển thị liên tục "còn bao nhiêu số tồn từ ngày trước" ngay trên các màn
  hình đó, đây sẽ là 1 tính năng bổ sung cần bàn thêm.
- Mốc "16:00" vẫn giữ nguyên như mục 96 (suy luận từ yêu cầu, cho phép từ 16:00 tới hết ngày, không
  tự khoá lại trước nửa đêm) — nếu cần mốc giờ khác, xin phản hồi lại để chỉnh.
- Đã kiểm chứng đầy đủ bằng dữ liệu/kịch bản giả lập (không phải dữ liệu vận hành thật của phòng
  khám) — nếu khi dùng thật phát sinh tình huống chưa lường tới (ví dụ bật `SEPARATE_PRIORITY_SEQUENCE`
  cùng lúc dùng tính năng này), xin phản ánh lại để kiểm tra thêm.

## 98. Thêm màn hình mới `/staff-printer/` — in lại phiếu số thứ tự đã cấp (không cấp số mới)

**Yêu cầu người dùng (nguyên văn)**: *"ok rồi. Thêm mới 1 chức năng staff-printer cho phép tôi
nhập stt từ - stt đến, ngày hôm nay/ngày mai và ưu tiên/thường để in tuần tự từng phiếu lại giống
như chức năng cấp số stt chỉ là ko cấp số lại thôi. stt in lại phải nằm trong giới hạn stt max của
ngày hôm nay/ngày mai và ưu tiên. hoặc là của ngày hôm nay/ngày mai và thường"*

### Hiểu yêu cầu

Đây là màn hình MỚI dành cho nhân viên, dùng khi cần in lại phiếu đã cấp trước đó (ví dụ máy in kẹt
giấy, mất phiếu giấy...) mà KHÔNG được cấp số mới/không đổi bất kỳ dữ liệu nào — chỉ đọc lại đúng
dữ liệu đã lưu trong CSDL rồi in ra. Nhân viên chọn: (1) Ngày — "Hôm nay" hoặc "Ngày mai" (2 giá trị
CỐ ĐỊNH, không phải lịch chọn tự do — khớp đúng với 2 giá trị `tickets.day` có thể có thực tế trong
hệ thống, kể cả sau khi dùng tính năng "Mở reset > 16h" ở mục 96/97 khiến vé mới mang ngày mai); (2)
Đối tượng — "Ưu tiên" (gộp chung mọi mã ưu tiên khác `NORMAL`, giống cách nhóm dãy số "U" ở mục
96/97) hoặc "Đối tượng thường" (`NORMAL`); (3) khoảng STT cần in lại — phải nằm trong giới hạn STT
tối đa ĐÃ CẤP THỰC TẾ của đúng tổ hợp (ngày, nhóm) đó — không cho nhập vượt quá.

### Các thay đổi

- **`src/routes/tickets.js`**: thêm 2 route mới (đều có `requireStaff`):
  - `GET /api/tickets/reprint-info?dayChoice=today|tomorrow&group=NORMAL|PRIORITY` — trả về STT tối
    đa hiện có (`maxNumber`, kèm `numberPrefix` nếu có) của đúng tổ hợp (ngày, nhóm) — dùng để HIỂN
    THỊ ngay trên giao diện khi nhân viên đổi lựa chọn, chỉ mang tính hướng dẫn (không phải lớp kiểm
    tra chính).
  - `GET /api/tickets/reprint-list?dayChoice=...&group=...&from=...&to=...` — lớp kiểm tra CHÍNH:
    tự tính lại STT tối đa thực tế ngay tại thời điểm gọi (không tin giá trị client đã thấy trước
    đó, có thể đã cũ), từ chối (400) nếu `from`/`to` không hợp lệ, nếu tổ hợp (ngày, nhóm) chưa có
    số nào, hoặc nếu `to` vượt quá số tối đa — rồi trả về TOÀN BỘ vé khớp, sắp theo `number` tăng
    dần (đúng thứ tự "tuần tự" theo yêu cầu), kèm đủ dữ liệu để in lại (số, tiền tố, đối tượng, giờ
    tạo, họ tên/ngày sinh bệnh nhân nếu có).
  - Cả 2 route dùng chung 2 hàm mới: `resolveReprintDay(dayChoice)` (quy đổi "today"/"tomorrow"
    thành ngày THẬT theo đồng hồ **máy chủ**, dùng `dayjs()` — không tin đồng hồ máy khách, đúng
    tinh thần mọi kiểm tra ngày/giờ khác trong hệ thống) và `reprintGroupFilterSql(group)` (lọc
    `priority_code = 'NORMAL'` hoặc `!= 'NORMAL'`).
  - Thêm hàm `formatPatientDobForPrint(ticket)` — quy đổi lại `patient_dob` đã lưu (định dạng LƯU
    TRONG CSDL khác nhau tuỳ nguồn: `YYYY-MM-DD` nếu quét CCCD, `DD/MM/YYYY` nếu quét BHYT — xem chi
    tiết trong chú thích code) sang đúng dạng `DD/MM/YYYY` để in lại GIỐNG HỆT lúc phiếu được cấp
    lần đầu (đối chiếu với `patientInfoForReceipt()` trong `public/print-receipt.js`).
- **`src/server.js`**: thêm `/staff-printer` vào `GATED_PATH_PREFIXES` — bắt buộc đăng nhập nhân
  viên như `/staff-kiosk`/`/counter`/`/counter-admin` (màn hình có thể xem lại tên/ngày sinh bệnh
  nhân đã quét trước đó, không phải thông tin công khai).
- **`public/staff-printer/index.html` + `staff-printer.js`** (MỚI HOÀN TOÀN): màn hình gồm 2 cặp
  nút chọn "Ngày" (Hôm nay/Ngày mai) và "Đối tượng" (Đối tượng thường/Ưu tiên — mặc định "Đối tượng
  thường"), 2 ô nhập "STT từ"/"STT đến", 1 dòng hiển thị "Số tối đa hiện có" (tự cập nhật khi đổi
  lựa chọn, gọi `GET /reprint-info`), nút "In tuần tự" và khu vực tiến độ có nút "Dừng" (mô phỏng
  đúng cảm giác thao tác của "cấp nhiều số" ở `/staff-kiosk/`, mục 89). Khi bấm "In tuần tự":
  1. Kiểm tra hợp lệ khoảng STT phía client cho nhanh, hiện hộp `confirm()` xác nhận (nói rõ đây
     CHỈ in lại, không cấp số mới).
  2. Gọi `GET /reprint-list` lấy danh sách vé thực tế khớp khoảng đã chọn.
  3. Nếu số vé tìm được ÍT HƠN số lượng STT đã nhập (trường hợp KHÔNG bật `SEPARATE_PRIORITY_SEQUENCE`
     — "Ưu tiên"/"Đối tượng thường" khi đó DÙNG CHUNG 1 dãy số liên tục, nên 1 khoảng STT có thể xen
     lẫn cả 2 nhóm) — cảnh báo rõ trong 1 hộp `confirm()` riêng trước khi tiếp tục, tránh nhân viên
     tưởng nhầm là "mất phiếu".
  4. In lần lượt TỪNG phiếu một bằng `printReceipt()` (dùng CHUNG hàm với `kiosk.js`/`staff-kiosk.js`,
     tự động dùng đúng hàng đợi in đã có ở mục 95) — LUÔN `await` mỗi lệnh in trước khi in phiếu tiếp
     theo (không "bắn rồi thôi"), đảm bảo không có 2 lệnh in nào chạy chồng chéo (giữ đúng nguyên
     tắc đã rút ra khi sửa lỗi treo ứng dụng ở mục 95). Có thể bấm "Dừng" bất kỳ lúc nào giữa 2 lần
     in để huỷ các phiếu còn lại — hiện rõ đã in được bao nhiêu/còn lại bao nhiêu.
- **`public/index.html`**: thêm 1 mục mới "In lại phiếu số thứ tự" vào menu Nhân viên, dẫn tới
  `/staff-printer`.

### Đã kiểm chứng bằng công cụ

- `node --check` trên `src/routes/tickets.js`, `src/server.js`, `public/staff-printer/staff-printer.js`
  — không lỗi cú pháp. Đếm cân bằng thẻ HTML (script Python) trên `public/staff-printer/index.html`
  (mới) và `public/index.html` (thêm 1 mục menu) — khớp ở cả 2 file.
- Chạy THẬT server (CSDL/cổng tạm riêng, xoá sau khi test), qua `curl`, kịch bản CHẾ ĐỘ MẶC ĐỊNH
  (chưa bật `SEPARATE_PRIORITY_SEQUENCE` — dùng chung 1 dãy số): cấp 3 vé "Đối tượng thường" (số
  1-3) rồi 2 vé "≥ 75 tuổi" (số 4-5, vì dùng chung dãy) — xác nhận: (1) `GET /reprint-info` báo đúng
  max = 3 cho "thường", max = 5 cho "ưu tiên" (đúng vì dùng chung dãy); (2) `GET /reprint-list` cho
  khoảng 1-3/"thường" trả về đúng 3 vé; (3) khoảng 1-5/"thường" bị từ chối 400 đúng thông báo "vượt
  quá số tối đa hiện có (3)"; (4) khoảng 1-2/"ưu tiên" trả về DANH SÁCH RỖNG (đúng như dự đoán — số
  1-2 thực tế thuộc nhóm "thường" khi dùng chung dãy) — xác nhận đúng lý do cần cảnh báo ở bước 3
  của luồng client; (5) gọi không kèm cookie đăng nhập — nhận đúng lỗi 401 "Chưa đăng nhập nhân
  viên".
- Lặp lại kịch bản tương tự nhưng BẬT `SEPARATE_PRIORITY_SEQUENCE=true` (2 dãy số riêng): cấp 3 vé
  "thường" (dãy T: 1-3) và 2 vé "ưu tiên" (dãy U: 1-2) — xác nhận `reprint-info` báo đúng max riêng
  từng dãy (`T`: 3, `U`: 2) và `reprint-list` cho khoảng 1-2/"ưu tiên" trả về ĐỦ VÀ ĐÚNG 2 vé (khớp
  100%, không còn tình huống thiếu như chế độ dùng chung dãy ở trên).
- Kiểm chứng riêng việc quy đổi `patient_dob` khi in lại: tạo 1 vé qua kiosk công khai (`POST
  /api/tickets`) với dữ liệu mô phỏng CCCD (`dob: "1990-05-20"`, `source: "CCCD"`) — gọi
  `reprint-list` xác nhận trả về đúng `patientDobDisplay: "20/05/1990"` (đã quy đổi đúng từ
  `YYYY-MM-DD` sang `DD/MM/YYYY`, khớp định dạng in gốc).

### Giới hạn/lưu ý thành thật

- Khi KHÔNG bật `SEPARATE_PRIORITY_SEQUENCE` (mặc định), "Ưu tiên" và "Đối tượng thường" dùng
  CHUNG 1 dãy số liên tục — nên khái niệm "STT tối đa của ngày + ưu tiên" và "STT tối đa của ngày +
  thường" tuy vẫn tính được (và đúng) nhưng 1 khoảng STT chọn có thể xen lẫn cả 2 nhóm, khiến số
  phiếu in ra ít hơn số lượng STT đã nhập — đã xử lý bằng cách cảnh báo rõ (kèm số lượng thực tế tìm
  thấy) trước khi in, không coi là lỗi, nhưng nhân viên cần đọc kỹ thông báo này để không nhầm tưởng
  "mất phiếu". Nếu phòng khám luôn cần STT riêng biệt rạch ròi giữa 2 nhóm, nên bật
  `SEPARATE_PRIORITY_SEQUENCE=true` trong `.env`.
- Màn hình chỉ cho chọn "Hôm nay"/"Ngày mai" (2 giá trị cố định, quy đổi theo đồng hồ máy chủ) —
  KHÔNG có lịch chọn ngày tự do trong quá khứ xa hơn, đúng theo đúng yêu cầu ngắn gọn của người
  dùng. Nếu sau này cần in lại phiếu của các ngày xa hơn (ví dụ hôm qua, hoặc bất kỳ ngày nào còn
  lưu trong giới hạn `DATA_RETENTION_DAYS`), sẽ cần bổ sung ô chọn ngày tự do — xin phản hồi nếu cần.
- 1 phiếu in lỗi (ví dụ do dữ liệu bất thường) sẽ được ghi log ra console và bỏ qua để tiếp tục in
  các phiếu còn lại trong lô, không dừng hẳn cả lô — nhân viên nên quan sát dòng tiến độ trên màn
  hình trong lúc in để phát hiện sớm nếu có bất thường.

## 99. Sửa lỗi `/counter/` vẫn gọi được số KHÔNG thuộc danh sách hôm nay khi "0 số đang chờ"

**Yêu cầu người dùng (nguyên văn)**: *"ok rồi. fix lỗi ở màn hình http://localhost:4000/counter/
khi Đang có 0 số đang chờ trong hàng đợi thì nó vẫn cho gọi số ko có trong danh sách đăng ký của
ngày hôm nay"*

### Nguyên nhân

Đây chính là hạn chế đã tự phát hiện và công khai disclosure ngay từ mục 97 (khi thêm "Mở reset >
16h"), nay được người dùng xác nhận là LỖI cần sửa chứ không chỉ là hạn chế chấp nhận được. Truy lại
đúng chỗ: `callNextTicket()`/`callNextTicketByPriority()` trong `src/services/ticketService.js` —
2 hàm xử lý nút "Gọi tiếp theo" (mặc định và theo từng đối tượng) ở `/counter/` — chọn vé để gọi chỉ
bằng điều kiện `status = 'waiting'`, **KHÔNG hề lọc theo cột `day`** (hành vi này có từ rất lâu,
trước cả các mục 96/97). Trong khi đó, phần THỐNG KÊ/HIỂN THỊ (`getDisplaySummary()`, "Đang có bao
nhiêu số đang chờ"...) đã được đổi ở mục 97 để lọc theo `getEffectiveDay(db)` ("ngày hiệu lực" —
có thể là ngày mai nếu vừa dùng "Mở reset > 16h"). Hai nơi lệch nhau: màn hình báo "0 số đang chờ"
(đúng theo ngày hiệu lực), nhưng nút "Gọi tiếp theo" vẫn tìm thấy và gọi được 1 vé "waiting" còn sót
lại của NGÀY KHÁC (ngày hôm nay thực tế, chưa được xử lý hết trước khi chuyển ngày) — đúng là hành
vi sai như người dùng mô tả: "gọi số không có trong danh sách đăng ký của ngày hôm nay".

### Thay đổi

- **`src/services/ticketService.js`**: `callNextTicket(db, counterId)` → `callNextTicket(db,
  counterId, day)` và `callNextTicketByPriority(db, counterId, priorityCode)` →
  `callNextTicketByPriority(db, counterId, priorityCode, day)` — cả 2 hàm nay **BẮT BUỘC** thêm
  điều kiện `AND day = ?` vào đúng câu truy vấn chọn vé để gọi (cả nhánh dùng thứ tự ưu tiên tuỳ
  chỉnh của quầy lẫn nhánh mặc định trong `callNextTicket()`), đảm bảo CHỈ chọn trong đúng phạm vi
  `day` được truyền vào — không còn "gọi vượt rào" sang ngày khác được nữa.
- **`src/routes/counters.js`**: 2 nơi gọi hàm trên (`POST /:id/call-next`, `POST
  /:id/call-next-priority`) nay truyền thêm `getEffectiveDay(db)` (hàm đã có sẵn từ mục 97, dùng
  chung với `getDisplaySummary()`/`getSkippedTickets()`/`getCalledTickets()`) — đảm bảo "gọi số"
  và "thống kê/hiển thị đang chờ" LUÔN dùng chung đúng 1 nguồn "ngày" duy nhất, không thể lệch
  nhau nữa.
- Cập nhật lại các đoạn chú thích liên quan ở `src/services/sequenceService.js` và
  `src/routes/tickets.js` (đang mô tả hành vi CŨ - "vẫn gọi được bình thường") cho khớp đúng hành vi
  MỚI, tránh tài liệu code gây hiểu nhầm về sau.
- **`public/staff-kiosk/staff-kiosk.js`**: sửa lại nội dung cảnh báo trong hộp `confirm()` của nút
  "Mở reset > 16h" (`handleResetSequenceClick()`) — trước đây nói "các số này vẫn gọi được bình
  thường sau khi chuyển ngày" (nay không còn đúng nữa) → đổi thành cảnh báo MẠNH hơn: các số chưa
  gọi của hôm nay sẽ **KHÔNG CÒN GỌI ĐƯỢC Ở QUẦY NỮA** sau khi chuyển ngày (cho đến khi thực sự
  sang đúng ngày đó) — nhân viên chỉ nên bấm nút này khi chắc chắn hàng chờ hôm nay đã xử lý xong.

### Đã kiểm chứng bằng công cụ

- `node --check` trên cả 4 file sửa (`src/services/ticketService.js`, `src/routes/counters.js`,
  `src/routes/tickets.js`, `public/staff-kiosk/staff-kiosk.js`) — không lỗi cú pháp.
- Chạy THẬT server (CSDL/cổng tạm riêng, xoá sau khi test), tái hiện ĐÚNG kịch bản lỗi qua `curl`:
  (1) tạo 1 quầy, cấp 1 vé "hôm nay"; (2) bấm "Mở reset > 16h" (đúng lúc server đã qua 16:00) —
  chuyển "ngày hiệu lực" sang ngày mai; (3) `GET /api/display/summary` xác nhận đúng `waitingCount:
  0` (ngày mai chưa có vé nào); (4) gọi `POST /api/counters/1/call-next` — TRƯỚC KHI SỬA sẽ trả về
  đúng vé "hôm nay" còn sót lại (đúng lỗi người dùng mô tả); SAU KHI SỬA xác nhận trả về đúng
  `{"ticket":null,"message":"Không còn số nào đang chờ"}` — khớp với "0 số đang chờ" hiển thị trên
  màn hình, không còn gọi lố sang ngày khác nữa.
- Kiểm tra hồi quy (regression) đảm bảo KHÔNG làm hỏng luồng gọi số bình thường CÙNG NGÀY: tạo 1
  quầy, cấp 1 vé "Đối tượng thường" + 1 vé "≥ 75 tuổi" cùng ngày hôm nay — `call-next` mặc định vẫn
  gọi đúng vé có `priority_rank` thấp hơn trước ("≥ 75 tuổi", đúng thứ tự ưu tiên); `call-next-priority`
  cho từng đối tượng cụ thể vẫn hoạt động đúng (gọi đúng vé, báo đúng "không còn số" khi đã gọi hết).

### Giới hạn/lưu ý thành thật

- Hệ quả TRỰC TIẾP của cách sửa này: sau khi dùng "Mở reset > 16h" (mục 96/97), các vé "waiting"
  còn sót lại của ngày cũ sẽ **KHÔNG CÒN CÁCH NÀO gọi tiếp được qua giao diện `/counter/`** cho đến
  khi đồng hồ thật sự sang đúng ngày đó (lúc "ngày hiệu lực" tự động khớp lại với ngày thực tế của
  các vé đó) — đây là đánh đổi CHỦ ĐÍCH để sửa đúng lỗi người dùng phản ánh (không cho "gọi vượt
  rào" sang ngày khác), nhưng có nghĩa là nhân viên BẮT BUỘC phải xử lý (gọi/hoàn tất) hết hàng chờ
  của ngày hiện tại TRƯỚC KHI bấm "Mở reset > 16h" — hộp xác nhận đã được đổi lời cảnh báo mạnh hơn
  để nhấn mạnh điều này, nhưng hệ thống không tự động chặn nếu nhân viên vẫn cố tình bấm tiếp.
  Nếu sau này cần thao tác "gọi/xử lý nốt vé còn sót lại của ngày cũ" sau khi đã chuyển ngày, đây sẽ
  là 1 tính năng riêng cần bàn thêm (ví dụ 1 màn hình riêng liệt kê + cho gọi thủ công theo `id`
  thay vì theo `day` hiện tại).
- Chưa gặp trường hợp lỗi tương tự này bị phát hiện qua thao tác thông thường không liên quan đến
  "Mở reset > 16h" (ví dụ dữ liệu "waiting" sót lại qua nhiều ngày do lỗi khác) — nhưng cách sửa ở
  đây có tính CHUNG, khắc phục MỌI nguồn gốc khiến còn vé "waiting" khác `day` hiện tại, không riêng
  gì do tính năng "Mở reset > 16h" gây ra.

## 100. Ràng buộc mới cho việc CẤP số ưu tiên (U) theo tiến độ STT thường (T) đã xử lý ở quầy

**Yêu cầu người dùng (nguyên văn)**: *"ok rồi. ở màn /staff-kiosk/ và màn /kiosk Điều chỉnh ràng
buộc chức năng cấp số ưu tiên cả quét qr và nút bấm. stt ưu tiên chỉ được phép cấp STT U001 khi
STT thường đã gọi số/bỏ qua ở các quầy đến stt thứ 16 - Cấu hình trong file .evn . Số stt ưu tiên
từ số tt 16 trở đi không được phép cấp STT ưu tiên >= max (stt thường đã gọi số/bỏ qua)"*

Câu yêu cầu có 2 cách hiểu khác nhau ở phần "chỉ được phép cấp STT U001 khi..." nên đã hỏi lại
người dùng trước khi code: (1) 16 vé ưu tiên đầu luôn tự do, ràng buộc chỉ bắt đầu từ U017; hay (2)
16 vé ĐẦU TIÊN nói chung bắt buộc phải là vé thường (tức không vé ưu tiên nào được cấp, kể cả U001,
cho tới khi đủ 16 vé thường). Người dùng chọn **cách (2)**. Đồng thời hỏi thêm liệu mã "Cấp cứu" có
được miễn trừ ràng buộc này không (vì đây là tình huống khẩn cấp) — người dùng chọn **áp dụng cho
TẤT CẢ mã ưu tiên, kể cả Cấp cứu, không miễn trừ**.

### Công thức cuối cùng (đã thống nhất với người dùng)

Gọi `threshold` = giá trị cấu hình trong `.env` (mặc định 16), `maxNormalProcessed` = STT THƯỜNG
lớn nhất đã **gọi/bỏ qua tại quầy** (tức trạng thái vé khác `waiting` — suy luận hợp lý từ "đã gọi
số/bỏ qua", vì "waiting" rõ ràng chưa được xử lý gì ở quầy) trong "ngày hiệu lực" hiện tại,
`nextPriority` = STT ưu tiên SẮP được cấp (dòm trước bộ đếm, chưa tiêu thụ số).

Cho phép cấp 1 vé ưu tiên (bất kỳ mã nào khác `NORMAL`, kể cả Cấp cứu) **KHI VÀ CHỈ KHI**:
1. `maxNormalProcessed >= threshold` — chặn TOÀN BỘ vé ưu tiên (kể cả U001) cho tới khi đạt đủ mốc
   này, đúng với lựa chọn (2) ở trên.
2. VÀ `nextPriority < maxNormalProcessed` — khớp đúng câu "không được phép cấp STT ưu tiên >= max
   (stt thường đã gọi số/bỏ qua)"; điều kiện này tự "thắt chặt dần" khi càng cấp nhiều vé ưu tiên
   (STT ưu tiên tiếp theo càng lớn), đúng tinh thần "từ số tt 16 trở đi".

### Các thay đổi

- **`src/services/sequenceService.js`**: thêm `peekNextTicketNumber(db, seriesKey)` — phiên bản
  CHỈ ĐỌC của `getNextTicketNumber()` (không `INSERT`/`UPDATE` bộ đếm `seq`), dùng để "dòm trước"
  STT sắp cấp mà KHÔNG tiêu thụ số đó (nếu dùng bản ghi bộ đếm thật để kiểm tra rồi từ chối, số đó
  sẽ bị "mất"/nhảy cóc vĩnh viễn vì bộ đếm không thể "trả lại").
- **`src/services/ticketService.js`**: đây là nơi thực hiện TOÀN BỘ logic mới:
  - `getPriorityIssueGateThreshold()` — đọc `PRIORITY_ISSUE_GATE_THRESHOLD` từ `.env` (tươi, không
    cache, mặc định 16 nếu chưa cấu hình — giống cách đọc `SEPARATE_PRIORITY_SEQUENCE` v.v).
  - `checkPriorityIssueGate(db, day, seqConfig)` — hiện thực đúng công thức ở trên, ném `Error` với
    thông báo rõ ràng (khác nhau tuỳ đang thiếu điều kiện (1) hay (2)) nếu không đạt.
  - **QUAN TRỌNG**: ràng buộc **CHỈ có hiệu lực khi `SEPARATE_PRIORITY_SEQUENCE=true`**. Lý do: khi
    KHÔNG bật cờ này, "Ưu tiên" và "Thường" dùng CHUNG 1 dãy số liên tục — khi đó STT sắp cấp cho
    BẤT KỲ ai (kể cả ưu tiên) luôn bằng "tổng số vé đã cấp trong ngày + 1", tức LUÔN LỚN HƠN mọi số
    đã xử lý trước đó của mọi đối tượng — nghĩa là điều kiện (2) sẽ KHÔNG BAO GIỜ thoả được, ràng
    buộc sẽ CHẶN VĨNH VIỄN mọi vé ưu tiên nếu áp dụng mù quáng. Đã tự kiểm tra ra vấn đề này khi
    phân tích trước khi code, nên chủ động bỏ qua ràng buộc hoàn toàn khi tắt
    `SEPARATE_PRIORITY_SEQUENCE` (giữ nguyên hành vi cũ ở chế độ đó).
  - Gọi `checkPriorityIssueGate()` ngay trong `createTicket()` — **ĐÂY LÀ ĐIỂM MẤU CHỐT** giúp
    ràng buộc tự động áp dụng ĐỒNG BỘ cho MỌI đường cấp vé ưu tiên hiện có mà KHÔNG cần sửa từng
    route riêng lẻ: kiosk công khai quét QR tự động phân loại ưu tiên (`POST /api/tickets`), nút bấm
    chọn đối tượng ở `/staff-kiosk` (`POST /api/tickets/staff`, bao gồm cả luồng "cấp nhiều số" tự
    động ở mục 89 vì dùng chung hàm này), và QR "cấp nhanh" (`POST /api/tickets/quick`) — đúng theo
    yêu cầu "cả quét qr và nút bấm". Lỗi ném ra được các route đã có sẵn `try/catch` bắt lại và trả
    về `400` kèm thông báo (giống hệt cách xử lý lỗi "priorityCode không hợp lệ"/cooldown có từ
    trước) — không cần sửa gì thêm ở `src/routes/tickets.js`.
- **`.env.example`**: thêm biến mới `PRIORITY_ISSUE_GATE_THRESHOLD=16` kèm giải thích đầy đủ công
  thức và lưu ý về việc chỉ có hiệu lực khi bật `SEPARATE_PRIORITY_SEQUENCE`.
- Không cần sửa gì ở `public/kiosk/kiosk.js`/`public/staff-kiosk/staff-kiosk.js` — cả 2 màn hình
  ĐÃ CÓ SẴN cơ chế hiển thị lỗi chung khi tạo vé thất bại (`scanStatus.textContent = 'Lỗi: ' +
  data.error` ở kiosk.js; `alert(data.error)` ở staff-kiosk.js) nên tự động hiển thị đúng thông báo
  mới mà không cần thêm code — giữ đúng tinh thần tái sử dụng luồng lỗi có sẵn thay vì viết trùng.

### Đã kiểm chứng bằng công cụ

- `node --check` trên `src/services/ticketService.js`, `src/services/sequenceService.js` — không
  lỗi cú pháp.
- Chạy THẬT server (CSDL/cổng tạm riêng, xoá sau khi test), bật `SEPARATE_PRIORITY_SEQUENCE=true`,
  qua `curl`, kịch bản đầy đủ: (1) thử cấp vé ưu tiên khi CHƯA có STT thường nào được xử lý — nhận
  đúng lỗi "Chưa đủ điều kiện... cần STT thường đã được gọi/bỏ qua tại quầy đạt tối thiểu 16 (hiện
  mới đến STT thường 0)"; (2) tạo 20 vé thường, xử lý (gọi) đúng 16 vé đầu (dùng
  `call-next-priority` với `priorityCode=NORMAL` để đảm bảo đúng vé THƯỜNG được gọi, không lẫn vé
  ưu tiên) — sau đó cấp LIÊN TỤC U001 đến U015: tất cả đều THÀNH CÔNG (đúng vì `nextPriority` từ 1
  đến 15 đều < 16); (3) thử cấp U016 — bị TỪ CHỐI đúng (16 >= 16); (4) gọi thêm 1 vé thường nữa
  (STT thường xử lý lên 17) — thử lại U016: THÀNH CÔNG (16 < 17); (5) thử cấp tiếp mã "Cấp cứu"
  (`EMERGENCY`) ngay sau đó (STT ưu tiên tiếp theo lúc này là 17, STT thường đã xử lý cũng là 17) —
  bị TỪ CHỐI đúng (17 >= 17, xác nhận Cấp cứu KHÔNG được miễn trừ như đã thống nhất).
- Kiểm tra riêng chế độ `SEPARATE_PRIORITY_SEQUENCE=false` (mặc định/tắt): cấp vé ưu tiên ngay khi
  CHƯA có vé thường nào — THÀNH CÔNG ngay (xác nhận ràng buộc tự động vô hiệu hoá đúng như thiết
  kế, không chặn nhầm khi đang dùng chung 1 dãy số).
- Kiểm tra riêng biến `.env` `PRIORITY_ISSUE_GATE_THRESHOLD` hoạt động đúng: đặt `=3` — xác nhận
  chỉ cần 3 vé thường đã xử lý là đủ điều kiện mở khoá vé ưu tiên (thay vì mặc định 16).
  Kiểm chứng riêng 2 đường cấp NGOÀI `/staff-kiosk` cũng bị chặn ĐÚNG như nhau: (a) kiosk công khai
  quét QR (`POST /api/tickets` với dữ liệu CCCD mô phỏng đủ điều kiện "≥ 75 tuổi") — bị từ chối khi
  chưa đủ điều kiện, cấp được ngay khi đủ; (b) QR "cấp nhanh" (`POST /api/tickets/quick`, cấu hình
  sẵn `QUICK_QR_CODE_AGE75`) — cũng bị từ chối đúng khi chưa đủ điều kiện — xác nhận ràng buộc áp
  dụng ĐỒNG BỘ ở CẢ 3 đường cấp (không riêng gì nút bấm ở `/staff-kiosk`), đúng yêu cầu "cả quét qr
  và nút bấm".

### Giới hạn/lưu ý thành thật

- Ràng buộc này CHỈ có tác dụng khi bật `SEPARATE_PRIORITY_SEQUENCE=true` — nếu phòng khám đang
  dùng chế độ mặc định (dùng chung 1 dãy số cho cả ưu tiên/thường), tính năng này sẽ KHÔNG có hiệu
  lực gì cả (không chặn, không thay đổi hành vi cũ) vì bản thân khái niệm "STT ưu tiên riêng biệt để
  so sánh" không tồn tại ở chế độ đó — đã giải thích rõ lý do kỹ thuật ở trên, không phải thiếu sót.
- Ràng buộc CHỈ áp dụng cho việc CẤP số mới (`createTicket()`), KHÔNG ảnh hưởng gì đến việc GỌI số ở
  quầy (`callNextTicket()`/`callNextTicketByPriority()`, mục 99) — 1 vé ưu tiên ĐÃ được cấp thành
  công trước đó (kể cả khi đang chờ) vẫn gọi/bỏ qua bình thường như cũ, đúng theo đúng phạm vi yêu
  cầu ("cấp số ưu tiên", không phải "gọi số ưu tiên").
- "Đã gọi số/bỏ qua tại quầy" được suy luận là trạng thái vé KHÁC `waiting` (tức `called`, `done`
  HOẶC `skipped`) — đây là suy luận hợp lý từ ngữ cảnh câu yêu cầu, nhưng chưa được người dùng xác
  nhận tường minh bằng 1 câu hỏi riêng (chỉ hỏi 2 điểm mấu chốt nhất: ngưỡng 16 áp dụng thế nào, và
  Cấp cứu có miễn trừ không). Nếu ý muốn khác (ví dụ chỉ tính `skipped`, không tính `called`/`done`),
  xin phản hồi lại để chỉnh `checkPriorityIssueGate()` trong `src/services/ticketService.js`.
- Chưa làm giao diện "chủ động khoá/làm mờ nút ưu tiên trước khi bấm" ở `/kiosk`/`/staff-kiosk` khi
  biết chắc sẽ bị từ chối (ví dụ hiển thị đếm ngược "còn cần X số thường nữa mới cấp được ưu tiên") —
  hiện tại nhân viên/bệnh nhân vẫn bấm được nút, chỉ khi bấm xong mới thấy thông báo lỗi (dùng lại
  đúng cơ chế hiển thị lỗi tạo vé đã có sẵn, không thêm giao diện mới). Nếu cần cảnh báo SỚM hơn
  (trước khi bấm), đây sẽ là 1 cải tiến UI riêng cần bàn thêm.

## 101. Sửa lại biên so sánh của ràng buộc cấp số ưu tiên (mục 100): "≤" thay vì "<"

**Yêu cầu người dùng (nguyên văn)**: *"ok rồi. cần bổ sung thêm không vé ưu tiên nào (kể cả vé đầu
tiên U001) được cấp cho tới khi STT thường đã gọi số/bỏ qua tại quầy đạt tối thiểu ngưỡng cấu hình
(mặc định 16, đổi qua `PRIORITY_ISSUE_GATE_THRESHOLD` trong `.env`) VÀ bổ sung đảm bảo Số stt ưu
tiên `PRIORITY_ISSUE_GATE_THRESHOLD` từ số tt 16 trở đi không được phép cấp stt ưu tiên nào lớn hơn
số stt max của STT thường đã gọi/bỏ qua"*

Vế đầu (chặn toàn bộ vé ưu tiên tới khi đạt ngưỡng) đã đúng như mục 100, không đổi. Vế sau là điều
chỉnh lại phép so sánh: mục 100 hiểu là "không được cấp STT ưu tiên **>=** max" (chặn cả khi BẰNG
nhau); câu chốt lại lần này là "không được cấp STT ưu tiên nào **lớn hơn** max" — tức chỉ chặn khi
STT ưu tiên sắp cấp THỰC SỰ LỚN HƠN, còn BẰNG NHAU thì vẫn cho phép. Đây là 1 thay đổi thực sự (mở
rộng thêm đúng 1 mốc mỗi ngưỡng), không phải diễn đạt lại cùng 1 ý.

### Thay đổi

- **`src/services/ticketService.js`** — `checkPriorityIssueGate()`: đổi điều kiện chặn thứ 2 từ
  `nextPriority >= maxNormalProcessed` thành `nextPriority > maxNormalProcessed` (tức điều kiện CHO
  PHÉP đổi từ `nextPriority < maxNormalProcessed` thành `nextPriority <= maxNormalProcessed`). Cập
  nhật lại toàn bộ chú thích/công thức trong hàm và thông báo lỗi cho khớp đúng biên mới.
- **`.env.example`** — cập nhật lại đoạn giải thích `PRIORITY_ISSUE_GATE_THRESHOLD` cho khớp biên
  so sánh mới (`≤` thay vì `<`), kèm ví dụ cụ thể.

### Ảnh hưởng cụ thể của thay đổi biên

Với `threshold` mặc định = 16: trước đây khi STT thường đã xử lý VỪA ĐẠT đúng 16, chỉ cấp được
U001 đến U015 (U016 bị chặn vì `16 >= 16`), phải có THÊM 1 số thường nữa (đạt 17) mới mở khoá được
U016. Nay: ngay khi STT thường đã xử lý đạt 16, cấp được LUÔN một lượt U001 đến U016 (`16 <= 16`) —
mỗi ngưỡng mới đạt được mở khoá thêm ĐÚNG 1 số ưu tiên so với trước, thay vì phải chờ dư thêm 1.

### Đã kiểm chứng bằng công cụ

- `node --check` trên `src/services/ticketService.js` — không lỗi cú pháp.
- Chạy THẬT server (CSDL/cổng tạm riêng, xoá sau khi test), bật `SEPARATE_PRIORITY_SEQUENCE=true`,
  qua `curl`: xử lý đúng 16 vé thường (dùng `call-next-priority` với `priorityCode=NORMAL`) rồi cấp
  liên tục — xác nhận CẢ U001 ĐẾN U016 đều cấp được ngay lập tức (khác với mục 100: trước đây U016
  bị chặn ở bước này); U017 bị từ chối đúng (17 > 16); xử lý thêm 1 vé thường (đạt 17) rồi cấp lại
  U017 — thành công đúng (17 ≤ 17).
- Kiểm tra hồi quy: (1) vế đầu (chặn toàn bộ vé ưu tiên khi CHƯA đạt ngưỡng 16) vẫn hoạt động đúng
  như mục 100, không bị ảnh hưởng bởi thay đổi biên; (2) chế độ `SEPARATE_PRIORITY_SEQUENCE=false`
  (tắt) vẫn KHÔNG bị ràng buộc gì (cấp ngay không cần điều kiện), đúng như thiết kế ở mục 100.

## 102. Đảo ngược lại biên so sánh của ràng buộc cấp số ưu tiên (chặn cả khi bằng nhau)

> "ok rồi điều chỉnh. ngược lại Hiện trạng: chỉ chặn khi STT ưu tiên sắp cấp lớn hơn STT thường đã
> xử lý — bằng nhau thì vẫn cấp được. Yêu cầu làm là chặn khi STT ưu tiên sắp cấp ≥ STT thường đã xử
> lý (nghĩa là bằng nhau cũng bị chặn)."

Sau khi mục 101 đổi biên so sánh từ "nhỏ hơn" sang "nhỏ hơn hoặc bằng" (cho phép cấp khi hai số bằng
nhau), người dùng yêu cầu ĐẢO NGƯỢC LẠI đúng hành vi gốc của mục 100: chặn cấp số ưu tiên khi
`STT ưu tiên sắp cấp >= STT thường đã gọi/bỏ qua` (tức lại chặn cả trường hợp bằng nhau, không chỉ
khi lớn hơn thuần tuý).

### Thay đổi

- `src/services/ticketService.js` — hàm `checkPriorityIssueGate(db, day, seqConfig)`: đổi điều kiện
  chặn từ `if (nextPriority > maxNormalProcessed)` (mục 101) trở lại
  `if (nextPriority >= maxNormalProcessed)` — tức CHẶN NGAY CẢ KHI BẰNG NHAU. Đồng thời cập nhật lại
  toàn bộ chú thích/tài liệu trong hàm (đoạn giải thích công thức phía trên hàm) để phản ánh đúng
  biên mới, kèm ví dụ cụ thể: với `threshold=16`, khi STT thường đã xử lý vừa đạt 16 thì U016
  (`nextPriority=16`) VẪN BỊ CHẶN (vì 16 không nhỏ hơn 16) — phải đợi STT thường lên tới 17 thì U016
  mới được cấp. Thông điệp lỗi trả về cho người dùng cũng được chỉnh lại cho khớp: "... cần STT
  thường đã được gọi/bỏ qua tại quầy lớn hơn số này ...".
- `.env.example` — cập nhật lại đoạn giải thích `PRIORITY_ISSUE_GATE_THRESHOLD` cho khớp biên mới
  (chặn cả khi bằng nhau).
- Không đổi gì ở vế đầu của ràng buộc (chặn toàn bộ vé ưu tiên, kể cả U001, cho tới khi
  `maxNormalProcessed >= threshold`) — vế này giữ nguyên từ mục 100, không bị ảnh hưởng.

### Đã kiểm chứng bằng công cụ

Viết script Node.js độc lập (`/tmp/verify_gate_102.js`, đã xoá sau khi test xong), gọi thẳng
`ticketService.js`/`sequenceService.js` (không qua HTTP) trên CSDL SQLite tạm riêng biệt, với
`SEPARATE_PRIORITY_SEQUENCE=true`. Kết quả: **22/22 kiểm tra đều đúng, 0 thất bại**. Cụ thể:

- Xử lý 16 vé thường (`maxNormalProcessed=16`) rồi cấp vé ưu tiên liên tiếp: đúng 15 vé (U001-U015)
  cấp thành công, thử cấp vé thứ 16 (U016) bị từ chối — đúng theo biên mới `nextPriority < 16` (vì
  16 không nhỏ hơn 16, còn 15 thì có).
- Xử lý thêm 1 vé thường (`maxNormalProcessed=17`): U016 giờ cấp thành công (16 < 17); ngay sau đó
  thử cấp tiếp U017 thì bị chặn (17 không nhỏ hơn 17, vẫn giữ nguyên `maxNormalProcessed=17`) — đúng
  hành vi "chặn cả khi bằng nhau".
- Xử lý thêm 1 vé thường nữa (`maxNormalProcessed=18`): U017 cấp thành công (17 < 18).
- Đã chạy `node --check src/services/ticketService.js` xác nhận không lỗi cú pháp.

### Giới hạn/lưu ý trung thực

- Đây là thay đổi thuần logic một điều kiện so sánh (đảo ngược đúng bằng mục 101 đã làm ngược lại
  trước đó), không phát sinh thay đổi nào khác về hành vi, route, hay giao diện — không cần sửa gì
  ở client (`kiosk.js`/`staff-kiosk.js`), lỗi vẫn hiển thị qua cùng cơ chế try/catch → 400 sẵn có.
- Chưa chạy lại thử nghiệm qua giao diện thật (curl/trình duyệt) cho thay đổi này — chỉ kiểm chứng
  bằng script gọi trực tiếp service layer; do đây là một dòng điều kiện đơn giản và đã test kỹ boundary
  qua nhiều mốc, rủi ro sai lệch giữa 2 cách kiểm thử là rất thấp, nhưng xin nói rõ để người dùng nắm.

## 103. Widget: ẩn 2 nút "Cấp số nhanh" ƯT/TT, làm nổi bật 2 nút gọi số ưu tiên/thường

> "ok rồi. điều chỉnh widget ẩn các nút ƯT và TT. Làm nổi bật 2 Nút gọi số ưu tiên và Nút gọi số
> thường của widget"

Widget siêu nhỏ (`public/counter/widget/`) có 2 cụm nút liên quan tới "ƯT"/"TT" (chỉ xuất hiện đúng
2 nhãn này khi bật `PRIORITY_MODE=basic` trong `.env` — chế độ gộp toàn bộ 7 loại ưu tiên thành 1 mã
duy nhất "Ưu tiên"/"ƯT", cạnh mã "Đối tượng thường"/"TT"):

1. Cụm **"Cấp số nhanh"** (`#quickIssueActions`) — 2 nút nhỏ mang đúng nhãn "ƯT"/"TT", cấp thẳng 1
   số mới không cần xác thực (quét CCCD/BHYT).
2. Cụm **số lượng đang chờ** (`#queueCounts`) — 2 nút chỉ hiện 1 con số nhỏ (số lượng đang chờ của
   đối tượng đó), bấm vào để gọi tiếp theo riêng đối tượng này.

Đã hỏi lại người dùng qua `AskUserQuestion` để làm rõ 2 điểm còn mơ hồ trước khi sửa: (1) phạm vi ẩn
— chỉ áp dụng khi ở chế độ `basic` (giữ nguyên chế độ `full` với 8 nút CC/NG/TE/PN/KĐ/KT/CM/TT);
(2) kiểu "nổi bật" — nút to hẳn, có chữ rõ ràng ("Gọi ưu tiên"/"Gọi thường") thay vì chỉ phóng to con
số. Người dùng chọn đúng 2 phương án khuyến nghị này.

### Thay đổi

- `public/counter/widget/widget.js`:
  - Hàm mới `isBasicPriorityMode()` — phát hiện chế độ `basic` từ chính danh sách `priorityRules` đã
    tải (đúng 2 phần tử, có mã `'PRIORITY'`) — không cần thêm API riêng báo `PRIORITY_MODE`.
  - `renderQuickIssueButtons()`: khi ở chế độ `basic`, ẩn hoàn toàn cụm `#quickIssueActions` (và vạch
    ngăn liền kề `#quickIssueSep`) thay vì vẽ 2 nút ƯT/TT như trước. Ở chế độ `full`, giữ nguyên hành
    vi cũ (vẽ đủ 8 nút, không ẩn gì).
  - `renderQueueCounts()`: khi ở chế độ `basic`, vẽ lại `#queueCounts` thành 2 NÚT TO (thêm class
    `prominent`), mỗi nút có chữ rõ ràng ("Gọi ưu tiên"/"Gọi thường") + số lượng đang chờ cỡ lớn bên
    dưới, viền/chữ theo đúng màu của đối tượng — vẫn gọi cùng endpoint `callNextByPriority()` sẵn có,
    chỉ đổi CÁCH HIỂN THỊ, không đổi hành vi gọi số. Ở chế độ `full`, giữ nguyên cách hiển thị cũ (mỗi
    số 1 nút nhỏ, ngăn cách bằng dấu "/").
- `public/counter/widget/index.html`:
  - Thêm `id="quickIssueSep"` cho vạch ngăn đứng trước `#quickIssueActions` để JS ẩn được đồng thời
    cả 2 (tránh còn sót 1 vạch ngăn "mồ côi" khi cụm Cấp số nhanh bị ẩn).
  - Thêm CSS mới cho `#queueCounts.prominent` (áp dụng cả 2 chế độ ngang/dọc của widget) — nút to hơn
    hẳn (~62px × 34px ở chế độ ngang), có khung viền/bo góc riêng, tách bạch rõ với các nút nhỏ khác.

### Đã kiểm chứng bằng công cụ

- `node --check public/counter/widget/widget.js` — không lỗi cú pháp.
- Chạy server thật (cổng tạm 4111) với `PRIORITY_MODE=basic`: `GET /api/priority-rules` trả về đúng
  2 mã `PRIORITY`/`NORMAL` (khớp điều kiện `isBasicPriorityMode()`); `GET /counter/widget/` trả về
  200.
- Chạy lại server thật (cổng tạm 4112) với `PRIORITY_MODE=full`: `GET /api/priority-rules` trả về đủ
  8 mã như cũ (EMERGENCY/AGE75/CHILD6/PREGNANT/DISAB_EXTREME/DISAB_SEVERE/MERIT_BHYT/NORMAL) — xác
  nhận `isBasicPriorityMode()` sẽ trả về `false` (khác 2 phần tử) nên chế độ `full` không bị ảnh
  hưởng gì bởi thay đổi này.
- Đã dọn sạch các file CSDL SQLite tạm dùng để test (`data/verify-widget*.db*`) sau khi xong.

### Giới hạn/lưu ý trung thực

- Chưa test bằng mắt thường qua trình duyệt/Electron thật (không có màn hình để chụp ảnh trong môi
  trường này) — chỉ xác nhận API trả đúng dữ liệu theo từng chế độ và cú pháp JS/HTML hợp lệ. Cấu
  trúc CSS mới (`.prominent`, `.queueCallBig`) áp dụng logic tương tự các nút đã có sẵn trong file
  (border-color/color gán inline theo màu đối tượng), nên rủi ro hiển thị sai là thấp, nhưng nếu sau
  khi dùng thực tế thấy kích thước/màu chưa ưng ý, xin phản hồi để chỉnh tiếp.
- Thay đổi CHỈ có tác dụng khi `PRIORITY_MODE=basic`. Nếu hệ thống đang chạy `PRIORITY_MODE=full`
  (như cấu hình `.env` hiện tại của hệ thống) thì widget KHÔNG có gì thay đổi so với trước — nhãn
  "ƯT" chỉ tồn tại ở chế độ `basic`, còn nhãn "TT" tuy có ở cả 2 chế độ nhưng nút "Cấp số nhanh" cho
  riêng "Đối tượng thường" vẫn được giữ lại ở chế độ `full` (không ẩn riêng lẻ 1 nút) vì lựa chọn của
  người dùng là chỉ ẩn nguyên cụm khi ở chế độ `basic`.

## 104. Widget: bỏ hẳn cụm "Cấp số nhanh" ở MỌI chế độ, tô đặc màu 2 nút gọi số

> "ok rồi. widget xóa luôn nút ƯT và TT ko cần hiển thị trên widget kế cả `full` trả đủ 8 mã như cũ
> đều bỏ trên widget. Làm nổi bật STT ưu tiên và ko ưu tiên nút có khung bao quanh tô màu lên nút
> luôn"

Mở rộng/điều chỉnh lại mục 103: mục 103 chỉ ẩn cụm "Cấp số nhanh" (ƯT/TT) khi ở chế độ `basic`, giữ
nguyên 8 nút ở chế độ `full`. Người dùng yêu cầu bỏ HẲN cụm này ở CẢ 2 chế độ, đồng thời đổi kiểu tô
màu của 2 nút gọi số ưu tiên/thường thành "khung bao quanh tô màu lên nút luôn" (nền đặc màu) thay vì
chỉ viền màu như mục 103.

Trước khi sửa, đã hỏi lại người dùng qua `AskUserQuestion` 2 điểm phát sinh do yêu cầu mới rộng hơn
hẳn phạm vi cũ: (1) ở chế độ `full` (7 mã ưu tiên riêng lẻ), cụm "Số lượng chờ" (vốn cho phép gọi
riêng từng loại, ví dụ chỉ gọi riêng "Trẻ em") nên xử lý sao khi không còn gọn được thành đúng 2 nút
như chế độ `basic` — người dùng chọn phương án **"Ẩn luôn chức năng trên widget"** (trả lời tự do,
không phải 1 trong 2 gợi ý ban đầu là "gộp lại thành 2 nút" hoặc "giữ 8 nút, chỉ tô màu"); (2) kiểu tô
màu cụ thể — người dùng chọn **"Nền tô ĐẶC màu, chữ trắng"**.

### Thay đổi

- `public/counter/widget/widget.js`:
  - `renderQuickIssueButtons()`: viết lại đơn giản hơn — LUÔN LUÔN làm rỗng + ẩn `#quickIssueActions`
    (`style.display = 'none'`), không còn phân biệt chế độ `basic`/`full` như mục 103 nữa. Cụm
    "Cấp số nhanh" (dù 2 nút ƯT/TT hay 8 nút CC/NG/TE/PN/KĐ/KT/CM/TT) không còn hiển thị trên widget
    ở bất kỳ chế độ nào.
  - `renderQueueCounts()`:
    - Chế độ `basic`: vẫn vẽ 2 nút to "Gọi ưu tiên"/"Gọi thường" như mục 103, nhưng đổi cách tô màu —
      gán `background-color` VÀ `border-color` cùng bằng màu riêng của đối tượng (thay vì chỉ
      `border-color` + nền trắng như trước), chữ nhãn/số đổi sang màu trắng (định nghĩa trong CSS) để
      tương phản rõ trên nền đậm.
    - Chế độ `full`: theo đúng lựa chọn "Ẩn luôn chức năng trên widget" — ẩn hoàn toàn `#queueCounts`
      (không còn vẽ 8 nút số lượng chờ riêng lẻ như mục 103 nữa). Nhân viên vẫn gọi được số theo từng
      đối tượng ưu tiên qua trang `/counter` đầy đủ — chỉ không còn ở widget siêu nhỏ này.
- `public/counter/widget/index.html`:
  - Bỏ `id="quickIssueSep"` (không còn cần vạch ngăn riêng cho cụm luôn-ẩn) và thêm sẵn
    `style="display:none"` trực tiếp lên `#quickIssueActions` trong HTML gốc (phòng trường hợp
    JS chưa kịp chạy).
  - Thêm `id="queueCountsSep"` cho vạch ngăn đứng trước `#queueCounts`, để `widget.js` ẩn được đồng
    thời với `#queueCounts` khi ở chế độ `full` — tránh còn sót 1 vạch ngăn "mồ côi" giữa
    `staffKioskBtn` và `priorityOrderBtn`.
  - CSS `.prominent .queueCallBig`: bỏ `background: rgba(255,255,255,...)` cố định, để nền hoàn toàn
    theo màu inline gán lúc render; thêm `color: #ffffff` cho `.qcbLabel`/`.qcbCount` và một chút
    `box-shadow` nhẹ để chữ trắng nổi rõ trên nền màu đậm.

### Đã kiểm chứng bằng công cụ

- `node --check public/counter/widget/widget.js` — không lỗi cú pháp.
- Chạy server thật ở cả 2 chế độ (cổng tạm 4113 cho `basic`, 4114 cho `full`): `GET /api/priority-rules`
  trả đúng dữ liệu từng chế độ (2 mã PRIORITY/NORMAL cho basic, đủ 8 mã cho full); `GET /counter/widget/`
  trả về HTTP 200 ở cả 2 trường hợp (trang tải được, không lỗi server-side).
- Đã dọn sạch các file CSDL SQLite tạm dùng để test sau khi xong.

### Giới hạn/lưu ý trung thực

- Cũng như mục 103, chưa test bằng mắt thường qua trình duyệt/Electron thật trong môi trường này —
  chỉ xác nhận API/HTML/JS hợp lệ theo từng chế độ. Nếu sau khi dùng thực tế thấy độ tương phản màu
  nền/chữ trắng chưa ưng ý ở màu nào đó (ví dụ với `NORMAL` màu xám đậm `#4b5563`), xin phản hồi để
  tinh chỉnh riêng.
- Ở chế độ `full`, cụm "Số lượng chờ"/"Gọi riêng đối tượng" giờ KHÔNG còn xuất hiện trên widget nữa
  (đã ẩn hoàn toàn theo đúng lựa chọn của người dùng) — đây là một thay đổi làm MẤT chức năng cũ đã
  có từ trước (chỉ còn dùng được qua trang `/counter` đầy đủ), không phải một giới hạn kỹ thuật,
  nên nói rõ để người dùng nắm nếu sau này có nhân viên thắc mắc vì sao không còn thấy các nút đó
  trên widget nữa.

## 105. Widget: dời 2 nút gọi ưu tiên/thường kế bên "Gọi số tiếp theo", bỏ chữ nhãn

> "OK rồi. widget điều chỉnh vị trí đưa nút Gọi ưu tiên, Gọi thường kế bên nút Gọi số tiếp theo. Để
> lại số lượng như cũ thay vì ghi rõ Gọi ưu tiên, Gọi thường"

Tinh chỉnh tiếp 2 nút "Gọi ưu tiên"/"Gọi thường" (chỉ có ở chế độ `PRIORITY_MODE=basic`, đã làm ở
mục 103/104): đổi vị trí + rút gọn nội dung hiển thị, không đổi hành vi gọi số.

### Thay đổi

- `public/counter/widget/index.html`:
  - Dời `<span id="queueCounts">` từ vị trí cuối thanh widget (cạnh `priorityOrderBtn`/
    `skippedListBtn`) sang NGAY SAU nhóm `#actions` (3 nút "Gọi số tiếp theo"/"Gọi lại"/"Bỏ qua") —
    đúng theo yêu cầu "kế bên nút Gọi số tiếp theo".
  - Bỏ `id="queueCountsSep"` (không còn cần vạch ngăn riêng cho việc ẩn/hiện đồng thời — `#queueCounts`
    giờ nằm ngay sau `#actions`, dùng chung vạch ngăn sẵn có giữa `#actions` và `patientScreenBtn`).
  - CSS `.prominent button.queueCallBig`: thu gọn kích thước xuống gần bằng nút vuông trong `#actions`
    (~26×26px ở chế độ ngang, 24×24px ở chế độ dọc) để trông giống "1 nút trong cùng nhóm" với Gọi
    tiếp theo/Gọi lại/Bỏ qua, thay vì 1 khối to riêng biệt như mục 103/104.
- `public/counter/widget/widget.js` — `renderQueueCounts()`: bỏ 2 `<span class="qcbLabel">`/
  `<span class="qcbCount">` (chữ "Gọi ưu tiên"/"Gọi thường" + số tách dòng) của mục 103, quay lại
  hiển thị ĐÚNG 1 con số duy nhất trong nút (giống cách hiển thị "như cũ" trước mục 103) — vẫn GIỮ
  NGUYÊN kiểu tô nền đặc màu + chữ trắng đã chốt ở mục 104 (người dùng lần này chỉ yêu cầu đổi vị trí
  + bỏ chữ, không yêu cầu bỏ màu). Nhãn đầy đủ ("Gọi tiếp theo — Ưu tiên/Đối tượng thường — đang chờ
  N") vẫn còn trong thuộc tính `title` (tooltip khi rê chuột), không mất thông tin, chỉ không còn
  hiện SẴN trên mặt nút nữa.

### Đã kiểm chứng bằng công cụ

- `node --check public/counter/widget/widget.js` — không lỗi cú pháp.
- Chạy server thật ở cả 2 chế độ (cổng tạm 4115 cho `basic`, 4116 cho `full`): `GET /api/priority-rules`
  trả đúng dữ liệu từng chế độ; `GET /counter/widget/` trả về HTTP 200 ở cả 2 trường hợp, không lỗi
  server-side (kiểm tra thêm log server không có dòng "error" nào).
- Đã dọn sạch các file CSDL SQLite tạm dùng để test sau khi xong.

### Giới hạn/lưu ý trung thực

- Cũng như mục 103/104, chưa test bằng mắt thường qua trình duyệt/Electron thật trong môi trường này
  — chỉ xác nhận API/HTML/JS hợp lệ. Nếu sau khi dùng thực tế thấy 2 nút quá nhỏ để bấm chính xác
  (do thu gọn xuống cỡ 26×26px để nằm gọn cạnh nhóm nút gọi số), xin phản hồi để chỉnh lại kích thước.
- Không thay đổi gì ở chế độ `full` (vẫn ẩn hoàn toàn như mục 104) hay hành vi gọi số (vẫn dùng đúng
  endpoint `callNextByPriority()` sẵn có) — mục này chỉ thuần về vị trí + cách hiển thị của 2 nút ở
  chế độ `basic`.

## 106. Điều tra + sửa lỗi "máy quét bị mất khả năng nhập liệu" trên widget fullscreen

> "ok rồi. Kiểm tra chức năng máy quét trên widget trên web thì ok bình thường. nhưng trên widget nó
> thường xuyên bị mất form nhập liệu. vì là màn hình cảm ứng nên khi widget mở fullscreen máy quét
> quét trên widget 1 lúc là nó sẽ ko nhập liệu được. kiểm tra lại tất cả các màn hình có nhận sự
> kiện máy quét"

### Điều tra

Đã rà soát TOÀN BỘ các màn hình có xử lý sự kiện bàn phím/máy quét (máy quét mã hoạt động như bàn
phím ảo — gõ ký tự rất nhanh rồi Enter) trong cả `public/` lẫn `electron-widget/`:

- `public/index.html` (đăng nhập), `public/kiosk/kiosk.js` (kiosk bốc số cho bệnh nhân — đúng màn
  hình fullscreen được phản ánh), `public/staff-kiosk/staff-kiosk.js` (kiosk cấp số cho nhân viên).
  Cả 3 đều dùng chung 1 pattern nhất quán qua `public/vendor/scanner-buffer.js`: gắn `keydown`
  **trực tiếp trên 1 input ẩn cụ thể** (không có `window`/`document.addEventListener('keydown', ...)`
  toàn cục nào), kèm `setInterval` định kỳ (800ms) gọi `input.focus()` để giữ **DOM-focus** — phần
  front-end này đã được thiết kế khá cẩn thận, không phải nguồn gốc lỗi.
- `public/counter/widget/widget.js` (thanh widget ngang nhỏ) — KHÔNG có xử lý máy quét nào (chỉ gọi
  số/điều khiển quầy), không liên quan.

Tuy nhiên, `setInterval(..., input.focus())` chỉ có tác dụng lấy lại **focus bên trong 1 cửa sổ**
(DOM-level) — nếu chính CỬA SỔ ELECTRON đó (`kioskWindow`, luôn fullscreen, chạy không người trực)
bị mất **OS-level keyboard focus** (do 1 cửa sổ/hộp thoại KHÁC giành mất), việc gọi `.focus()` bên
trong renderer hoàn toàn vô nghĩa: bàn phím vật lý (và máy quét, hoạt động y hệt) gửi ký tự tới cửa
sổ ĐANG có OS focus, không phải tới `#scanInput`. Đây chính là khoảng trống gây ra triệu chứng.

**Nguyên nhân cụ thể tìm được**: `printTicketSilently()` trong `electron-widget/main.js` — hàm chạy
NGẦM mỗi khi kiosk tự động in phiếu sau khi tạo số (không cần ai bấm gì) — khi lệnh in thất bại (máy
in nhiệt hết giấy/offline/driver timeout...), code gọi `dialog.showErrorBox(...)`: một hộp thoại
**cấp hệ điều hành**, không gắn `parent`, sẽ **cướp OS-level keyboard focus** khỏi `kioskWindow` đang
fullscreen. Vì màn hình kiosk bệnh nhân KHÔNG có ai trực để bấm "OK" đóng hộp thoại, nó treo vô thời
hạn — và trong lúc đó, mọi ký tự từ máy quét rơi vào hộp thoại lỗi (không vào `#scanInput`) — đúng
khớp với mô tả "quét một lúc thì không nhập liệu được nữa" (chỉ xảy ra SAU lần in lỗi đầu tiên, từ
đó "kẹt cứng" cho tới khi có người vào tận máy bấm OK — mà bấm OK cũng KHÔNG có code nào tự động trả
lại focus cho `kioskWindow`). Đây là lý do khớp với "trên web thì OK bình thường" (trình duyệt
thường không có khái niệm hộp thoại cấp hệ điều hành chặn toàn bộ input như vậy).

### Thay đổi

- `electron-widget/main.js` — `printTicketSilently()`:
  - **Bỏ hẳn 2 lệnh `dialog.showErrorBox(...)`** ở cả 2 nhánh in (pdf-to-printer chính và
    `webContents.print()` dự phòng) — không còn hộp thoại nào có thể treo/cướp focus khi in tự động
    thất bại. Lỗi vẫn được ghi đầy đủ qua `logPrintIssue()` sẵn có (file log, xem lại sau), và báo
    thêm cho renderer qua kênh IPC mới `win.webContents.send('print-error', message)` — KHÔNG chặn
    gì, không cướp focus.
- `electron-widget/preload.js` — thêm `window.electronPrint.onPrintError(callback)` để trang gọi
  đăng ký nhận thông báo lỗi in (chỉ hoạt động trong Electron).
- `public/kiosk/kiosk.js` và `public/staff-kiosk/staff-kiosk.js` — thêm `setupPrintErrorToast()`:
  đăng ký `onPrintError`, hiện 1 dòng cảnh báo NHỎ ở cuối màn hình ("Lỗi in phiếu (số vẫn được cấp
  bình thường): ...") tự biến mất sau 6 giây — không chặn thao tác/không cướp focus, khác hẳn hộp
  thoại cũ. Số thứ tự vẫn được cấp/hiển thị bình thường cho bệnh nhân dù in lỗi hay không.
- `electron-widget/main.js` — `openKioskWindow()`: thêm cơ chế **tự phục hồi OS-focus chung** —
  `kioskWindow.on('blur', ...)`: chờ 1200ms (đủ để 1 hộp thoại hợp lệ thật sự cần nhân viên tương
  tác kịp hiện ra), rồi tự động gọi lại `kioskWindow.focus()` NẾU cửa sổ còn tồn tại, KHÔNG có hộp
  thoại hợp lệ nào đang mở (biến `blockingDialogOpen` mới, xem bên dưới), và cửa sổ thực sự vẫn
  chưa được focus lại. Đây là lưới an toàn CHUNG cho MỌI nguyên nhân mất focus có thể xảy ra (không
  chỉ riêng lỗi in đã sửa ở trên) — ví dụ cửa sổ màn hình bệnh nhân mới được mở ở màn hình phụ đúng
  lúc đó, hay nhân viên vô tình mở `/counter`/`/staff-kiosk` từ khay hệ thống trên cùng 1 máy với
  kiosk.
  - Biến mới `blockingDialogOpen`: đánh dấu khi có hộp thoại hệ điều hành HỢP LỆ đang mở (do nhân
    viên chủ động mở, ví dụ chọn máy in từ khay hệ thống trong `pickPrinterFromTray()`) — để cơ chế
    tự phục hồi ở trên TẠM HOÃN, tránh giật hộp thoại thật sự cần tương tác ra khỏi tay nhân viên.
    3 hộp thoại còn lại trong `pickPrinterFromTray()` (đều do nhân viên chủ động bấm mở từ khay hệ
    thống, không phải tự động/không người trực) được giữ nguyên là hộp thoại thật, chỉ bọc thêm cờ
    này.
  - **Chỉ áp dụng cho `kioskWindow`** (màn hình bốc số bệnh nhân, luôn fullscreen, đúng loại màn
    hình "widget mở fullscreen" người dùng phản ánh) — KHÔNG áp dụng cho `staffKioskWindow` (nhân
    viên chủ động dùng, không fullscreen, có thể cần chuyển cửa sổ hợp lý, ép focus lại có thể gây
    khó chịu).

### Đã kiểm chứng bằng công cụ

- `node --check` cho cả 4 file đã sửa (`electron-widget/main.js`, `electron-widget/preload.js`,
  `public/kiosk/kiosk.js`, `public/staff-kiosk/staff-kiosk.js`) — không lỗi cú pháp.
- Đã đọc lại toàn bộ luồng gọi `printTicketSilently()` (từ `queuePrintJob()`) và xác nhận `win`
  (cửa sổ nguồn) luôn có sẵn tại điểm gọi `webContents.send('print-error', ...)` mới, không có nguy
  cơ gọi trên biến `undefined`.
- Đã đọc lại toàn bộ `pickPrinterFromTray()` sau khi bọc `blockingDialogOpen` bằng `try/finally` để
  xác nhận cờ này LUÔN được trả về `false` sau khi hộp thoại đóng (kể cả khi chọn máy in hay bấm
  Huỷ), không bị "kẹt" mãi là `true`.

### Giới hạn/lưu ý trung thực

- **Không thể chạy thử Electron thật trong môi trường này** (không có màn hình/hệ điều hành Windows
  với máy in nhiệt thật để tái hiện chính xác lỗi in dẫn đến mất focus) — chỉ xác nhận được bằng đọc
  code kỹ + `node --check` cú pháp, KHÔNG chạy tay qua tình huống "in lỗi thật → mất focus → tự phục
  hồi" trên máy Windows thật. Đây là hạn chế cố hữu của môi trường sandbox này (đã áp dụng nhất quán
  cho các thay đổi liên quan tới Electron/máy in nhiệt trong các mục trước), xin người dùng thử thực
  tế trên máy có máy in nhiệt và phản hồi nếu vẫn còn gặp lại tình trạng "mất khả năng nhập liệu".
- Cơ chế `kioskWindow.on('blur', ...)` là "lưới an toàn chung" dựa trên phỏng đoán hợp lý (mọi
  nguyên nhân mất OS-focus đều cần được trả lại), nhưng KHÔNG thể loại trừ 100% mọi nguồn cướp focus
  có thể có trên mọi phiên bản Windows/driver máy in khác nhau — nếu sau khi cập nhật vẫn còn gặp
  lại (dù hiếm hơn nhiều), xin mô tả lại chính xác thao tác/thời điểm xảy ra để điều tra thêm.
- Độ trễ 1200ms trước khi tự động lấy lại focus là một con số ước lượng hợp lý (đủ để 1 hộp thoại
  hợp lệ kịp hiện ra), không phải giá trị đã được đo đạc thực tế trên phần cứng cụ thể — có thể cần
  tinh chỉnh nếu thực tế thấy quá nhanh (giật focus khỏi 1 hộp thoại hợp lệ nào đó chưa kịp bọc cờ
  `blockingDialogOpen`) hoặc quá chậm (kiosk "đứng hình" lâu trước khi tự phục hồi).
- Dòng cảnh báo lỗi in mới (toast) chỉ hoạt động khi chạy trong ứng dụng Electron
  (`window.electronPrint` tồn tại) — mở `/kiosk`/`/staff-kiosk` bằng trình duyệt thường (không qua
  widget) sẽ không thấy gì thêm, vì đường in đó vốn đã dùng `window.print()` bình thường của trình
  duyệt (không đi qua `printTicketSilently()`/`dialog.showErrorBox()` bị lỗi ở trên) nên không cần
  xử lý gì thêm.

## 107. Sửa ô nhập "STT từ - STT đến" ở màn hình in lại không dùng được trên cảm ứng

> "OK rồi. Điều chỉnh lại input nhập từ stt từ stt đến ở màn hình in lại stt nó không tương thích
> với màn hình cảm ứng dẫn tới tôi không nhập số được mà phải sử dụng nút tăng giảm từng số 1"

Màn hình `/staff-printer` (mục 98) dùng `<input type="number">` cho 2 ô "STT từ"/"STT đến". Trên
màn hình cảm ứng (đặc biệt trong webview/trình duyệt kiosk), loại input này gây 2 vấn đề: (1) 2 nút
tăng/giảm (spinner) mặc định của trình duyệt chiếm một phần đáng kể diện tích ô vốn đã nhỏ (100px),
dễ bấm nhầm; (2) quan trọng hơn — một số trình duyệt/webview cảm ứng KHÔNG bật bàn phím ảo (on-screen
keyboard) một cách đáng tin cậy cho `type="number"`, khiến người dùng "không gõ số được" và buộc
phải bấm nút +/- từng nấc 1 — đúng nguyên văn triệu chứng người dùng phản ánh.

### Thay đổi

- `public/staff-printer/index.html`:
  - Đổi `#fromInput`/`#toInput` từ `type="number"` sang `type="text"` + `inputmode="numeric"` +
    `pattern="[0-9]*"` — vẫn bật đúng bàn phím số trên di động/cảm ứng, nhưng KHÔNG còn spinner +/-
    mặc định của trình duyệt chiếm diện tích ô nữa.
  - Tăng kích thước ô nhập: rộng hơn (100px → 120px), cao hơn (thêm `min-height:44px` — đạt mức tối
    thiểu khuyến nghị cho vùng chạm cảm ứng), chữ to hơn (16px → 20px, đậm hơn) — dễ nhìn/dễ chạm
    chính xác hơn trên màn hình cảm ứng.
- `public/staff-printer/staff-printer.js` — thêm `sanitizeDigitsInput()`: vì `type="text"` không tự
  giới hạn chỉ nhập số như `type="number"`, hàm này lọc bỏ mọi ký tự KHÔNG PHẢI chữ số (0-9) ngay khi
  người dùng gõ/dán vào, giữ đúng vị trí con trỏ để không làm gián đoạn trải nghiệm gõ số bình
  thường. Logic đọc giá trị/kiểm tra hợp lệ khi bấm "In tuần tự" (`Number(...)`, `Number.isInteger`)
  không cần đổi gì — vẫn hoạt động đúng với chuỗi chỉ toàn chữ số.

### Đã kiểm chứng bằng công cụ

- `node --check public/staff-printer/staff-printer.js` — không lỗi cú pháp.
- Chạy server thật (cổng tạm 4117/4118): `GET /staff-printer/` trả về đúng hành vi hiện có (chuyển
  hướng 302 về trang đăng nhập nhân viên khi chưa đăng nhập — giống mọi màn hình `staff-*` khác,
  không phải lỗi phát sinh từ thay đổi này), không có dòng lỗi nào trong log server.
- Đã dọn sạch file CSDL SQLite tạm dùng để test sau khi xong.

### Giới hạn/lưu ý trung thực

- Chưa test bằng tay trên thiết bị cảm ứng thật (không có màn hình cảm ứng trong môi trường này) —
  chỉ xác nhận cú pháp hợp lệ và hành vi server không đổi. Cách sửa (`type="text"` +
  `inputmode="numeric"` thay cho `type="number"`) là giải pháp phổ biến, đã được khuyến nghị rộng
  rãi cho đúng loại vấn đề này trên web, nên độ tin cậy khá cao, nhưng nếu sau khi dùng thực tế trên
  máy cảm ứng vẫn còn khó chịu (ví dụ bàn phím ảo cụ thể của thiết bị vẫn không bật đúng), xin phản
  hồi kèm loại thiết bị/trình duyệt đang dùng để điều tra thêm.

## 108. Sửa lỗi widget mất khả năng nhập liệu sau khi máy quét gặp cảnh báo (alert() cướp focus)

> "OK rồi. trên widget HIện tại lại lỗi khi sử dụng máy quét quét xong nó bị chiếm quyền input của
> bàn phím . quét xong nó chỉ cần hiện 1 cái cảnh báo lên là bị ví dụ ở màn hình quét ưu tiên ở stt 1
> sẽ gặp cảnh báo không cho cấp số. lúc này ta không nhập dc gì được nữa trên widget. yêu cầu rà soát
> xử lý ở tất cả các màn hình có máy quét và các lỗi tương tự có thể xảy ra. chỉ bị o6widget còn bản
> web thì k bị"

Mục 106 đã sửa 1 nguyên nhân mất focus (hộp thoại `dialog.showErrorBox()` gọi từ MAIN PROCESS khi in
lỗi). Lần này người dùng phản ánh 1 nguyên nhân KHÁC, đúng như mô tả "quét xong nó chỉ cần hiện 1 cái
cảnh báo lên là bị" — ví dụ quét ưu tiên khi đang ở STT 1 và bị "rào cản cấp số ưu tiên" (mục 100-102)
từ chối. Rà soát toàn bộ 2 màn hình có máy quét (`/kiosk` và `/staff-kiosk` — xác nhận bằng cách tìm
mọi nơi dùng `ScannerBuffer`, chỉ 2 file `public/kiosk/kiosk.js` và `public/staff-kiosk/staff-kiosk.js`
gắn vào máy quét) cho thấy:

- `public/kiosk/kiosk.js` (màn hình bốc số bệnh nhân) đã KHÔNG dùng `alert()`/`confirm()` ở bất kỳ
  đâu — mọi cảnh báo từ trước đến giờ đều hiện inline ngay trên màn hình. Đây chính là lý do màn hình
  này KHÔNG bị lỗi (đúng như người dùng xác nhận "chỉ bị ở widget" — thực ra chính xác hơn là "chỉ bị
  ở màn hình cấp số Nhân viên trong widget", vì `/kiosk` mở trong widget vẫn không bị).
- `public/staff-kiosk/staff-kiosk.js` (màn hình cấp số Nhân viên) có NHIỀU chỗ gọi `alert()` TỰ ĐỘNG
  ngay sau khi quét xong — không cần bấm nút nào cả:
  1. `createStaffTicket()`: khi server từ chối cấp số (đúng nguyên văn ví dụ người dùng nêu — "quét
     ưu tiên ở STT 1" bị "rào cản cấp số ưu tiên" mục 100-102 chặn) → gọi `alert(data.error ...)`.
  2. `processQuickQrScan()`: khi mã QR "cấp nhanh" không hợp lệ, hoặc lỗi kết nối server → 2 chỗ gọi
     `alert(...)`. Đường quét này hoạt động BẤT KỲ LÚC NÀO (kể cả đang ở màn hình chính), nên rủi ro
     gặp phải cũng thường xuyên như quét CCCD/BHYT bình thường.
  3. `tryStaffQrShortcut()`: khi quét 1 mã không có dấu "|" (không phải QR CCCD/BHYT) mà cũng không
     khớp QR "đăng nhập nhanh" của nhân viên → `alert('Không đọc được mã QR...')`.
  4. `guardLeaveStaffKiosk()`: được gọi cả từ nút bấm (có `evt`) LẪN tự động ngay sau khi quét đúng
     QR "đăng nhập nhanh" trong lúc đang chạy 1 chuỗi "cấp nhiều số" tự động (`tryStaffQrShortcut()`
     gọi không kèm `evt`) → cùng 1 `alert()` bị trúng bởi cả 2 đường, kể cả đường quét.

**Vì sao đây là lỗi RIÊNG của widget (Electron), không phải web:** `window.alert()`/`window.confirm()`
gọi từ RENDERER dùng cơ chế hộp thoại JS mặc định của Chromium. Trên trình duyệt web thường, hộp
thoại này đóng lại là focus quay về ngay trang web bình thường. Nhưng khi chạy trong 1 `BrowserWindow`
Electron ở chế độ kiosk/fullscreen không có thanh tiêu đề/không ai thao tác chuột, hộp thoại này CÓ
THỂ không trả lại đúng OS-level keyboard focus cho cửa sổ sau khi tự đóng (hoặc bị đóng bởi phím
Enter do chính máy quét gửi tới) — cùng 1 LỚP lỗi với `dialog.showErrorBox()` đã sửa ở mục 106 (mất
OS-focus, không tự phục hồi), chỉ khác cơ chế gọi (renderer `alert()` thay vì main-process `dialog.*`).
Đã xác nhận qua tìm kiếm code: KHÔNG có chỗ nào trong `main.js`/`preload.js` can thiệp/ghi đè
`alert`/`confirm`, nên hành vi mặc định của Chromium là nguyên nhân trực tiếp.

**Lỗi cộng dồn phát hiện thêm (không do người dùng nêu, nhưng liên quan trực tiếp):** `finishVerifyAndCreate()`
và `issueWithoutVerify()` gọi `createStaffTicket()` xong LUÔN ẩn màn hình `#step-verify` (chứa
`#scanInput` — ô nhận tín hiệu máy quét) BẤT KỂ THÀNH CÔNG HAY THẤT BẠI. Nghĩa là dù có sửa xong vấn
đề `alert()` cướp focus, khi cấp số thất bại, ô quét vẫn bị ẩn đi (`display:none`) — mọi cơ chế focus
lại (kể cả `focusScanner()` polling có sẵn) đều vô nghĩa vì ô nhập không còn hiển thị. Đây chính là
phần "ta không nhập dc gì được nữa" độc lập với việc `alert()` có cướp focus OS hay không.

### Thay đổi

- `public/staff-kiosk/staff-kiosk.js`:
  - Thêm `showScannerToast(message, opts)` — banner nhỏ không chặn (`position:fixed`, tự ẩn sau vài
    giây, giống hệt tinh thần toast lỗi in đã thêm ở mục 106), dùng chung cho mọi cảnh báo tự động
    sau khi quét thay cho `alert()`.
  - `createStaffTicket()`: viết lại để trả về `true`/`false`; khi server từ chối cấp số, hiện cảnh
    báo NGAY TRONG màn hình xác minh bằng `showVerifyWarning()` (hàm có sẵn, không tạo mới) thay vì
    `alert()` — không chặn, không rời màn hình quét.
  - `finishVerifyAndCreate()`/`issueWithoutVerify()`: chỉ ẩn `#step-verify` khi `createStaffTicket()`
    trả về `true` (thành công) — sửa lỗi cộng dồn nêu trên, để khi thất bại, ô `#scanInput` vẫn hiển
    thị và nhận được lượt quét lại ngay lập tức.
  - `processQuickQrScan()`: 2 chỗ `alert()` (QR cấp nhanh không hợp lệ / lỗi kết nối) đổi sang
    `showScannerToast()`.
  - `tryStaffQrShortcut()`: `alert('Không đọc được mã QR...')` đổi sang `showScannerToast()`.
  - `guardLeaveStaffKiosk()`: đổi `alert()` sang `showScannerToast()` (hiện lâu hơn — 8 giây — vì nội
    dung cảnh báo dài, cần đủ thời gian đọc).
  - `setupPrintErrorToast()` (đã thêm ở mục 106): refactor dùng chung `showScannerToast()` thay vì
    tự tạo DOM toast riêng — gộp logic, tránh trùng lặp.
  - **Cố ý KHÔNG đổi** các `alert()`/`confirm()` còn lại (`confirmAndStartAutoIssueSeq()` — xác nhận
    trước khi cấp nhiều số, các cảnh báo tính năng "chuyển ngày"/"đặt lại số thứ tự") — đã rà soát kỹ
    và xác nhận các chỗ này CHỈ được gọi trực tiếp từ sự kiện bấm nút của nhân viên, KHÔNG có đường
    nào từ máy quét gọi tới, nên rủi ro thấp hơn nhiều (nhân viên đang đứng thao tác ngay lúc đó).
- `electron-widget/main.js`: thêm `staffKioskWindow.on('blur', ...)` — cùng cơ chế "lưới an toàn"
  tự động lấy lại OS-focus sau 1200ms nếu cửa sổ bị mất focus mà không có hộp thoại hợp lệ nào đang
  mở (`blockingDialogOpen`), y hệt cơ chế đã thêm cho `kioskWindow` ở mục 106 — bổ sung phòng ngừa
  cho MỌI nguyên nhân mất focus khác có thể còn sót (kể cả trên các `confirm()` cố ý giữ nguyên ở
  trên, nếu chẳng may vẫn không trả lại focus đúng trên 1 số cấu hình Windows/driver cụ thể).

### Đã kiểm chứng bằng công cụ

- `node --check` cho cả 2 file đã sửa (`electron-widget/main.js`, `public/staff-kiosk/staff-kiosk.js`)
  — không lỗi cú pháp.
- Chạy server thật (cổng tạm, CSDL SQLite tạm qua biến môi trường `SQLITE_FILE`): `GET /staff-kiosk/`,
  `/kiosk/`, `/staff-printer/` đều trả về đúng hành vi hiện có (302 chuyển hướng đăng nhập khi chưa
  đăng nhập — không phải lỗi phát sinh từ thay đổi này), không có dòng lỗi nào trong log server. Đã
  dọn sạch file CSDL tạm sau khi test.
- Đã rà lại toàn bộ file để xác nhận không còn `alert()`/`confirm()` nào nằm trên đường gọi tự động
  từ máy quét (`handleScannedText()` → `processQuickQrScan()`/`tryStaffQrShortcut()`/`processScanText()`
  → ... → `createStaffTicket()`) — chỉ còn lại các chỗ gắn trực tiếp vào `onclick` của nút bấm.

### Giới hạn/lưu ý trung thực

- **Không thể chạy thử Electron thật trong môi trường này** (không có Windows/màn hình cảm ứng/máy
  quét thật) — không thể tận mắt xác nhận `window.alert()` THẬT SỰ làm mất OS-focus trong đúng phiên
  bản Electron/Windows/driver máy quét của người dùng, cũng như không thể xác nhận cơ chế
  `staffKioskWindow.on('blur', ...)` mới thêm hoạt động đúng như thiết kế trên phần cứng thật. Đây là
  hạn chế nhất quán đã nêu ở các mục Electron trước (106) — chỉ xác nhận được bằng đọc code kỹ +
  `node --check` + test HTTP thật (không phải Electron), KHÔNG chạy tay được tình huống "quét → cảnh
  báo → mất focus → tự phục hồi" trên máy thật.
- Việc thay `alert()` bằng banner không chặn (`showVerifyWarning()`/`showScannerToast()`) loại bỏ
  ĐÚNG nguyên nhân người dùng mô tả, nhưng nếu trên máy thật vẫn còn 1 nguồn cướp focus khác chưa
  phát hiện (ví dụ do chính driver máy quét, không liên quan gì đến `alert()`), cơ chế
  `staffKioskWindow.on('blur', ...)` mới thêm sẽ là lớp phòng ngừa cuối, nhưng không đảm bảo tuyệt
  đối 100% trên mọi cấu hình Windows khác nhau — xin phản hồi lại chính xác thao tác/thời điểm nếu
  vẫn còn gặp lại (dù kỳ vọng sẽ hiếm hơn rất nhiều).
- Độ trễ 1200ms và thời lượng hiện banner (6-8 giây) là các con số ước lượng hợp lý, không phải giá
  trị đã đo đạc trên phần cứng cụ thể — có thể cần tinh chỉnh sau khi dùng thực tế.

### Cập nhật (cùng mục 108): vẫn còn `confirm()` chiếm quyền — bỏ hẳn hộp thoại native, dùng modal tự vẽ

> "ok rồi. Nhưng nó đang còn 1 số cảnh báo confirm chiếm quyền nữa ở form staff-kiosk"

Bản sửa đầu tiên ở mục 108 chỉ đổi các `alert()`/`confirm()` chạy TỰ ĐỘNG ngay sau khi quét — các
`confirm()` còn lại (xác nhận trước khi "cấp nhiều số tự động", xác nhận "chuyển ngày") được giữ
nguyên vì cho rằng an toàn hơn do nhân viên chủ động bấm nút mới mở ra. Người dùng phản ánh là KHÔNG
đúng: hộp thoại `window.confirm()`/`window.alert()` của Chromium trong Electron có thể không trả lại
đúng OS-level focus cho cửa sổ sau khi đóng — đây là hành vi của CHÍNH cơ chế hộp thoại JS mặc định,
không phụ thuộc việc nó được mở ra bởi máy quét hay bởi 1 cú bấm nút.

**Sửa:** bỏ HẲN mọi `window.alert()`/`window.confirm()` còn sót lại trong `staff-kiosk.js` (5 chỗ
trong `confirmAndStartAutoIssueSeq()` và `handleResetSequenceClick()`), thay bằng:

- `showScannerToast(...)` cho các thông báo chỉ cần đọc rồi tự biến mất (ví dụ "vượt quá số lượng tối
  đa", "chỉ được mở sau 16:00", kết quả thành công/thất bại khi chuyển ngày) — tái dùng hàm đã có từ
  bản sửa đầu ở mục 108.
- `showScannerConfirm(message, opts)` (mới thêm) cho 2 chỗ cần hỏi Đồng ý/Huỷ thật sự (xác nhận cấp
  nhiều số, xác nhận chuyển ngày) — đây là 1 modal dựng HOÀN TOÀN bằng DOM/CSS ngay trong chính trang
  web đang chạy (lớp phủ mờ + hộp thoại + 2 nút, style tái dùng `.btn-primary`/`.btn-secondary` có
  sẵn), trả về `Promise<boolean>` để giữ nguyên được cấu trúc `await` như cũ ở nơi gọi. Vì đây KHÔNG
  phải là API hộp thoại native của trình duyệt/hệ điều hành (không có cửa sổ/tiến trình nào khác được
  tạo ra), nên về nguyên tắc KHÔNG có cơ chế nào khiến `BrowserWindow` hiện tại bị mất OS-level
  keyboard focus khi đóng nó — khác hẳn bản chất của `alert()`/`confirm()` native.
- `handlePriorityClick()` và `confirmAndStartAutoIssueSeq()` đổi thành `async function` để `await`
  được `showScannerConfirm()` (không ảnh hưởng gì vì cả 2 đều chỉ được gọi từ `onclick="..."` trong
  HTML, không nơi nào dùng giá trị trả về).

Sau bản sửa này, `public/staff-kiosk/staff-kiosk.js` không còn bất kỳ lệnh gọi `alert()`/`confirm()`
native nào (đã rà lại toàn bộ file để xác nhận, chỉ còn nhắc tới trong ghi chú code).

#### Đã kiểm chứng bằng công cụ

- `node --check public/staff-kiosk/staff-kiosk.js` — không lỗi cú pháp.
- Rà bằng tìm kiếm toàn văn bản (grep) xác nhận không còn lệnh gọi `alert(`/`confirm(` nào ngoài các
  dòng ghi chú/comment trong file.
- Chạy lại server thật (CSDL SQLite tạm) — `GET /staff-kiosk/` vẫn trả về đúng hành vi hiện có (302
  chuyển hướng đăng nhập), không có lỗi mới trong log server. Đã dọn file CSDL tạm sau khi test.

#### Giới hạn/lưu ý trung thực

- Vẫn áp dụng đúng hạn chế đã nêu ở trên: không có Electron/Windows/màn hình cảm ứng thật trong môi
  trường này để tận mắt xác nhận việc bỏ hẳn hộp thoại native có triệt tiêu hoàn toàn hiện tượng mất
  focus hay không — chỉ xác nhận được bằng đọc code (modal mới là DOM thuần, không gọi API hộp thoại
  nào của trình duyệt/OS) và test cú pháp/HTTP. Xin tiếp tục phản hồi nếu sau khi cập nhật bản này vẫn
  còn gặp lại tình trạng mất khả năng nhập liệu ở bất kỳ thao tác nào trên màn hình cấp số Nhân viên.
- Modal `showScannerConfirm()` mới chỉ có 2 nút "Xác nhận"/"Huỷ" và không hỗ trợ phím tắt Enter/Esc để
  đóng nhanh như hộp thoại native cũ — nhân viên cần chạm/bấm trực tiếp vào nút trên màn hình cảm ứng
  (đây vốn là thói quen thao tác chính trên các màn hình kiosk khác trong hệ thống, nên không phải là
  thay đổi lớn).

## 109. Thêm nút "Thoát ứng dụng" ở màn hình chủ (localhost:4000)

> "ok rồi. bổ sung thêm 1 nút thoát App ở màn hình localhost:4000 được không ạ"

Trang "/" (`public/index.html` — màn hình chọn "Bệnh nhân"/"Nhân viên") chính là nơi nút "Trang chủ"
của cả `/kiosk` lẫn `/staff-kiosk` đưa người dùng về (bấm icon 🏠 góc trên-trái ở 2 màn hình đó điều
hướng thẳng về đây). Vì `/kiosk`/`/staff-kiosk` thường chạy TOÀN MÀN HÌNH bên trong widget Electron
(không viền cửa sổ, không thanh taskbar — đặc biệt trên máy kiosk cảm ứng), trang "/" hoàn toàn có
thể đang hiển thị thật sự bên trong đúng cửa sổ đó — lúc này không còn cách nào thoát hẳn ứng dụng
ngoài việc bấm chuột phải đúng icon ở khay hệ thống (tray), rất bất tiện/khó tìm trên máy cảm ứng
thuần túy không có chuột.

### Thay đổi

- `public/index.html`: thêm 1 nút tròn nhỏ góc trên-phải (đối xứng với nút "Trang chủ" 🏠 vốn luôn ở
  góc trên-trái tại các màn hình khác — tái dùng đúng class `.home-link` có sẵn trong `common.css`),
  chỉ HIỂN THỊ khi trang đang chạy thật sự bên trong widget Electron (kiểm tra `window.widgetBridge`
  tồn tại — script `initExitAppButton()` cuối file) — khi mở bằng trình duyệt thường (máy tính/điện
  thoại cá nhân của nhân viên/bệnh nhân) sẽ KHÔNG thấy nút này, vì lúc đó không có "ứng dụng" nào để
  thoát cả. Bấm vào nút hiện 1 modal hỏi xác nhận trước khi thoát (tránh thoát nhầm làm gián đoạn
  toàn bộ hệ thống đang phục vụ).
  - **Cố ý KHÔNG dùng `window.confirm()`** để hỏi xác nhận — đúng lý do vừa sửa ở mục 108: hộp thoại
    xác nhận native của trình duyệt có thể không trả lại đúng focous hệ điều hành cho cửa sổ khi chạy
    trong Electron. Modal xác nhận ở đây là 1 khối `<div>` DOM/CSS thuần vẽ ngay trong chính trang,
    không gọi bất kỳ API hộp thoại nào của trình duyệt/hệ điều hành.
- `electron-widget/preload.js`: thêm `widgetBridge.quitApp()` — gửi tín hiệu IPC `'quit-app'` sang
  main process.
- `electron-widget/main.js`: thêm `ipcMain.on('quit-app', () => app.quit())` — gọi ĐÚNG cùng 1 lệnh
  `app.quit()` như mục "Thoát" có sẵn trong menu chuột phải của tray (cơ chế thoát THẬT SỰ duy nhất
  đã được kiểm chứng của ứng dụng này — bình thường đóng hết cửa sổ chỉ ẩn ứng dụng vào tray chứ
  không thoát hẳn, xem `app.on('window-all-closed', ...)`).

### Đã kiểm chứng bằng công cụ

- `node --check` cho `electron-widget/main.js` và `electron-widget/preload.js` — không lỗi cú pháp.
- Trích riêng từng khối `<script>` trong `public/index.html` và chạy `node --check` cho từng khối —
  không lỗi cú pháp JavaScript.
- Đếm số thẻ mở/đóng `<div>` trong toàn file để xác nhận không lệch cặp sau khi chèn thêm HTML.
- Chạy server thật (CSDL SQLite tạm): `GET /` trả về 200 và có chứa đầy đủ `exitAppLink`/
  `exitAppModal`/`quitApp` trong HTML trả về. Đã dọn file CSDL tạm sau khi test.

### Giới hạn/lưu ý trung thực

- **Không thể chạy thử Electron thật trong môi trường này** — không thể tận mắt xác nhận nút mới có
  thực sự hiện đúng lúc (`window.widgetBridge` tồn tại) và bấm vào có thực sự thoát hẳn ứng dụng
  (thay vì chỉ ẩn vào tray) trên máy Windows thật. Chỉ xác nhận được bằng đọc code kỹ (đối chiếu
  đúng với cơ chế `app.quit()` đã dùng ở menu tray có sẵn) + kiểm tra cú pháp + HTML trả về từ server
  thật — chưa chạy tay được trên phần cứng thật.
- Nút chỉ xuất hiện khi trang "/" được điều hướng tới TỪ BÊN TRONG widget (ví dụ bấm "Trang chủ" từ
  `/kiosk`/`/staff-kiosk`, hoặc widget tự mở thẳng trang "/"). Nếu nhân viên mở URL máy chủ bằng
  trình duyệt thường trên máy tính/điện thoại cá nhân, nút này sẽ không hiện — đúng như mong muốn vì
  lúc đó không có ứng dụng Electron nào để "thoát" cả.

## 110. Phát hành bản server lên GitHub Release bằng `publish.bat`

Server và widget phát hành **riêng biệt**: mỗi dự án có `publish.bat` + `publish.config.bat` của
riêng mình, tag riêng (`server-v…` / `widget-v…`), nên dùng 2 repo riêng hay chung 1 repo đều được.

**Chuẩn bị 1 lần trên máy build (Windows):**
1. Cài Node.js ≥ 22.5 (x64) và GitHub CLI: https://cli.github.com
2. Chạy `gh auth login` (đăng nhập tài khoản có quyền ghi vào repo).
3. Tạo repo trên GitHub (có ít nhất 1 commit, ví dụ tick "Add a README"), rồi sửa
   `publish.config.bat`: `set "GH_REPO=ten-tai-khoan/ten-repo"`.

**Phát hành:** nhấp đúp `publish.bat` hoặc chạy trong cmd:

| Lệnh | Tác dụng |
|---|---|
| `publish.bat` | Phát hành đúng version trong `package.json` |
| `publish.bat patch` / `minor` / `major` | Tăng version rồi phát hành |
| `publish.bat --draft` | Tạo release nháp, tự bấm "Publish release" trên GitHub sau |
| `publish.bat --build-only` | Chỉ build `release\HeThongBatSo-Server-vX.Y.Z.zip`, không upload |
| `publish.bat --no-node` | Không kèm `node.exe` (máy cài phải tự có Node.js) |

**Gói zip gồm:** `src\`, `public\`, `node_modules\` (chỉ thư viện production), `package.json`,
`.env.example`, `data\` (rỗng), `start-server.bat`, và `node\node.exe` (lấy từ máy build) — máy
khách chỉ cần giải nén rồi chạy `start-server.bat`, không cần cài Node.js hay có mạng internet. Kèm
file `.sha256` để kiểm tra file tải về không bị hỏng.

**Cố ý KHÔNG đóng gói** `.env` (mật khẩu thật) và `data\*.db` (dữ liệu bệnh nhân). Khi cập nhật: tắt
server, giải nén đè lên thư mục cũ — `.env` và dữ liệu được giữ nguyên. Lần đầu chạy,
`start-server.bat` tự tạo `.env` từ `.env.example`.

**Tuỳ chọn:**
- `RELEASE_NOTES.md` ở thư mục gốc (nếu có) được dùng làm nội dung release; không có thì tự sinh.
- Mọi file bỏ vào thư mục `publish-extra\` (ví dụ bộ cài Inno Setup, bản `.exe` ẩn mã nguồn) được
  upload kèm vào cùng release.
- Release luôn được tạo ở dạng nháp → upload đủ file → mới công khai, tránh người khác tải phải bản
  thiếu file. Nếu lỗi giữa chừng, release còn ở dạng nháp: xoá trên GitHub rồi chạy lại.
- `.gitignore` đã chặn `.env`, `data\*.db`, `node_modules\`, `release\` nếu bạn đẩy mã nguồn lên
  GitHub.

## 111. Loại bỏ toàn bộ hộp thoại native `alert()`/`confirm()` (tránh widget mất quyền nhập liệu)

**Yêu cầu:** màn hình `/staff-printer` (và rà soát tất cả màn hình khác) bỏ các cảnh báo kiểu
`window.alert()/confirm()` vì trong widget Electron chúng làm cửa sổ mất quyền nhập (cùng lớp lỗi
mục 106, 108 — mục 108 mới chỉ xử lý `/staff-kiosk`).

**Rà soát:** còn 22 chỗ gọi hộp thoại native, đã thay HẾT:

| Màn hình | File | Số chỗ |
|---|---|---|
| In lại phiếu | `public/staff-printer/staff-printer.js` | 2 `confirm()` |
| Quầy tiếp nhận | `public/counter/counter.js` | 11 `alert()` |
| Widget quầy | `public/counter/widget/widget.js` | 3 `confirm()` + 1 `alert()` |
| Quản lý quầy | `public/counter-admin/counter-admin.js` | 2 `confirm()` + 2 `alert()` |
| Trang chủ | `public/index.html` | 2 `alert()` |
| Widget (main process) | `electron-widget/main.js` chọn máy in | 1 `showErrorBox` + 2 `showMessageBox` |

`/kiosk`, `/staff-kiosk` (đã sửa ở mục 108), `/waiting-screen`, `/patient-screen` không còn chỗ nào.

**Cách làm:**
- File mới `public/vendor/ui-dialog.js` — `UiDialog.alert()`, `UiDialog.confirm()` (trả về Promise,
  dùng `await`), `UiDialog.toast()`. Hộp thoại vẽ bằng DOM ngay trong trang, không tạo cửa sổ OS nên
  focus không rời trang; chặn phím (kể cả máy quét) lọt xuống trang bên dưới khi đang mở; Esc = Huỷ;
  đóng xong tự trả focus về đúng ô/nút trước đó.
- Thanh widget quá nhỏ (480x40) để vẽ hộp thoại bên trong → `ui-dialog.js` tự gọi
  `widgetBridge.showDialog()`; `main.js` mở 1 cửa sổ hộp thoại nhỏ do app tự quản lý (`showAppDialog()`),
  nổi trên widget, đóng xong **chủ động** `focus()` lại cửa sổ đã mở nó. Hộp thoại chọn máy in
  trong khay hệ thống cũng dùng cơ chế này.
- Widget bản cũ (chưa có `showDialog`) chạy với server mới: thanh widget tạm dùng lại native như cũ —
  cần cài widget bản mới để hết hẳn lỗi trên thanh widget. Các cửa sổ lớn (quản lý, in lại, quầy)
  dùng hộp thoại DOM ngay cả với widget bản cũ.

**Đã kiểm chứng:** Playwright trên server thật — `/staff-printer` hiện hộp thoại DOM, gõ phím không lọt
xuống ô nhập, Esc đóng và focus trở về nút "Bắt đầu in lại", bấm "In lại" chạy tiếp đúng; không còn
sự kiện hộp thoại native nào ở `/`, `/counter`, `/counter/widget`, `/counter-admin`; mô phỏng cửa sổ
480x40 xác nhận đi qua `widgetBridge.showDialog()`. Chạy `showAppDialog()` trong Electron 33 thật
(Xvfb): tự co giãn chiều cao, trả đúng chỉ số nút, Esc = Huỷ, `blockingDialogOpen` được trả về false.
Chưa thử trên Windows thật.

## 112. Câu hỏi sàng lọc tại Kiosk bệnh nhân tự cấp số + luồng cho bệnh nhân không mang CCCD/BHYT

**Luồng quét CCCD/BHYT** (sau khi quét xong và hết đếm ngược tự động như cũ) — hỏi lần lượt, mỗi câu
có **10 giây**:
1. Trong 7 ngày vừa qua, Ông/Bà có đi khám bệnh ở bệnh viện hoặc trạm y tế nào khác không? (CÓ / KHÔNG)
2. Ông/Bà khám BẢO HIỂM Y TẾ hay khám DỊCH VỤ? (BẢO HIỂM Y TẾ / DỊCH VỤ)
3. Ông/Bà đã từng khám bệnh ở đây lần nào chưa? (ĐÃ TỪNG KHÁM / CHƯA, LẦN ĐẦU)

**Luồng "Không mang CCCD / thẻ BHYT"** (nút lớn màu cam trên màn hình quét):
1. Đã từng khám ở đây chưa? — chọn **CHƯA** → kết thúc, hiện "Vui lòng liên hệ nhân viên hướng dẫn tiếp nhận".
2. Có tự bấm số được trên màn hình cảm ứng/bàn phím không? — chọn **KHÔNG** → kết thúc như trên.
3. Nhập số CCCD (12 số) — bàn phím số lớn trên màn hình, bàn phím thật cũng dùng được.
4. Nhập số điện thoại (10 số, bắt đầu bằng 0).
5. Khám nơi khác trong 7 ngày? 6. Bảo hiểm hay Dịch vụ?

**Quy tắc:**
- Hết giờ ở bất kỳ câu nào → **KHÔNG cấp số**, hiện thông báo lớn rồi tự về màn hình quét. Câu nhập số
  dùng thời gian riêng (mặc định 30 giây, tính lại mỗi lần bấm phím) vì người già bấm 12 số mất lâu hơn.
- Đang trả lời (hoặc đang hiện thông báo hết giờ) mà **quét lại CCCD/BHYT** → huỷ lượt cũ, làm lại từ đầu
  với giấy tờ vừa quét — chưa cấp số nên không bị ràng buộc thời gian chờ (cooldown) nào. Quét cả khi
  đang ở ô nhập số cũng được (tự nhận ra mã QR qua dấu "|").
- Server **bắt buộc** đủ câu trả lời hợp lệ mới cấp số (`POST /api/tickets` trả 400 nếu thiếu/chọn
  phương án "kết thúc"), không chỉ chặn ở giao diện.
- Luồng không giấy tờ: định danh = số CCCD tự nhập (vẫn áp dụng chống lấy số trùng
  `KIOSK_COOLDOWN_MINUTES`), luôn là **Đối tượng thường** (không có giấy tờ để xác minh tuổi/ưu tiên),
  lưu `patient_source = 'MANUAL'`.
- Câu trả lời lưu vào cột mới `tickets.kiosk_answers` (JSON) + `tickets.patient_phone`; **in trên phiếu**
  (dưới tên/ngày sinh), **in lại** ở `/staff-printer`, và **hiện dưới số đang phục vụ** ở `/counter`.

**Sửa ngôn từ / thời gian / thứ tự câu hỏi — không cần sửa code:** sao chép
`kiosk-questions.example.json` thành `kiosk-questions.json` (cùng thư mục với `.env`) rồi sửa. Lưu file là
áp dụng ở lượt hỏi kế tiếp, **không cần khởi động lại server**. File lỗi cú pháp → dùng câu hỏi mặc định
và báo lỗi trong cửa sổ server. Hướng dẫn từng trường nằm ngay đầu file (`_huong_dan`). Các trường chính:
`text` (câu hỏi), `options[].label` (chữ trên nút), `options[].stop` (chọn thì kết thúc),
`printLabel` (dòng in trên phiếu), `answerTimeoutSeconds`, `inputTimeoutSeconds`, `flows.scan` /
`flows.noId` (thứ tự câu), `enabled: false` (tắt hẳn, kiosk hoạt động như cũ).
Bản phát hành (`publish.bat`) chỉ kèm file mẫu `.example.json`, nên giải nén đè bản mới không ghi đè
`kiosk-questions.json` của đơn vị. Nếu đóng gói bằng Inno Setup, thêm file này với cờ `onlyifdoesntexist`
giống `.env`.

**File thay đổi:** mới `src/config/kioskQuestions.js`, `public/kiosk/kiosk-survey.js`,
`kiosk-questions.example.json`; sửa `public/kiosk/index.html`, `public/kiosk/kiosk.js`,
`src/routes/tickets.js`, `src/routes/kioskConfig.js`, `src/routes/counters.js`,
`src/services/ticketService.js`, `src/config/db.js` (tự thêm 2 cột, không mất dữ liệu cũ),
`public/print-receipt.js` (`opts.extraLines`), `public/counter/*`, `public/staff-printer/staff-printer.js`.

**Đã kiểm chứng (Playwright, server thật):** trả lời đủ 3 câu → cấp số, lưu đúng câu trả lời; để hết 10
giây → không cấp số, hiện thông báo; quét lại khi đang hiện thông báo và khi đang ở giữa câu hỏi → làm
lại từ câu 1; luồng không giấy tờ chọn "CHƯA" → thông báo liên hệ nhân viên; nhập CCCD thiếu số → báo
lỗi; nhập bằng bàn phím màn hình + bàn phím thật → cấp số, lưu SĐT, nguồn MANUAL; quét QR khi đang ở ô
nhập số → chuyển sang luồng quét; gọi API không kèm câu trả lời → 400; sửa `kiosk-questions.json` (cả
file có BOM của Notepad) → áp dụng ngay; file lỗi → dùng mặc định. Bố cục kiểm tra ở 1280×900,
1920×1080 và màn dọc 1080×1920: không phải cuộn. Chưa thử trên máy kiosk cảm ứng thật.

### 112.1. Sửa ô nhập CCCD / số điện thoại không hiện đủ số

Ở bố cục 2 cột (câu hỏi + ô nhập | bàn phím số), ô nhập hẹp hơn nên cỡ chữ cố định 64px làm 12 số CCCD
bị tràn. Nay `fitInputFont()` (kiosk-survey.js) tự chọn cỡ chữ LỚN NHẤT vẫn hiện đủ số ký tự tối đa của
câu (12 số CCCD / 10 số SĐT, đo bằng chuỗi mẫu toàn số "8" — số rộng nhất), tính lại khi đổi kích thước
cửa sổ. Đã kiểm tra ở 1024×768, 1280×900, 1920×1080, 768×1024 và 1080×1920: đủ số, không tràn.

## 113. Nút KHÓA / MỞ KHÓA tự cấp số trên Kiosk bệnh nhân (/kiosk)

- Nút icon ổ khóa mới trên header (cạnh nút ⇄ và ⛶). Bấm → hộp "Nhập mật khẩu nhân viên **hoặc** quét
  mã QR mật khẩu" — dùng chung 1 ô: gõ tay rồi Enter/bấm "Khóa"/"Mở khóa", hoặc quét QR đăng nhập nhanh
  (máy quét có hay không gửi Enter đều được: chuỗi gõ siêu nhanh < 35ms/ký tự rồi dừng 200ms được hiểu
  là quét và tự xác nhận; người gõ tay không đạt tốc độ này nên không bị tự xác nhận giữa chừng).
- **Chỉ có 10 giây**: hết giờ tự đóng hộp, giữ nguyên trạng thái cũ. Sai mật khẩu → báo lỗi, xoá ô,
  vẫn trong 10 giây đó.
- **Đang khóa**: ẩn toàn bộ màn hình quét/câu hỏi/nút "Không mang CCCD", hiện chữ rất lớn: "Vui lòng lấy
  số thứ tự có sẵn ở hộp bên dưới máy. Nếu hết số, vui lòng liên hệ nhân viên hướng dẫn tiếp nhận."
  (sửa được qua trường `lockMessage` trong `kiosk-questions.json`). Mọi lượt quét CCCD/BHYT/QR cấp nhanh
  đều bị bỏ qua — không cấp số. Khóa lúc đang hỏi dở → huỷ lượt đó, không cấp số. Nút ổ khóa chuyển
  màu đỏ để nhân viên nhận ra từ xa.
- Trạng thái khóa lưu **riêng từng máy kiosk** (localStorage; trong widget Electron là phân vùng lưu
  trữ vĩnh viễn) — F5, tắt/mở lại ứng dụng, khởi động lại máy vẫn giữ nguyên đang khóa. Khóa máy này
  không ảnh hưởng kiosk khác.
- Mật khẩu kiểm tra thật ở server (`POST /api/auth/staff-login`, cùng mật khẩu `STAFF_PASSWORD`).
- File: mới `public/kiosk/kiosk-lock.js`; sửa `public/kiosk/index.html`, `public/kiosk/kiosk.js`
  (bỏ qua quét khi khóa, không giành focus khi hộp mật khẩu mở), `src/config/kioskQuestions.js`,
  `kiosk-questions.example.json` (thêm `lockMessage`).
- Đã kiểm chứng (Playwright, server thật): khóa khi đang hỏi dở → huỷ, không cấp số; sai mật khẩu báo
  lỗi; gõ chậm không tự xác nhận; quét CCCD khi đang khóa → không có gì xảy ra; F5 vẫn khóa; để hết 10
  giây → đóng hộp, vẫn khóa; mở khóa bằng "quét QR" (gõ nhanh, không Enter) → mở, cấp số lại bình
  thường; không có hộp thoại native nào.

### 113.1. Hộp khóa/mở khóa: tách riêng "Quét mã QR" và "Nhập mật khẩu"

- **Vấn đề:** bản 113 dùng chung 1 ô mật khẩu hiện rõ cho cả gõ tay lẫn máy quét → máy quét gõ vào ô
  hiện, bật bàn phím ảo và chiếm ô nhập liên tục.
- **Sửa:** bấm ổ khóa → chọn 1 trong 2 nút lớn:
  - **📷 Quét mã QR**: ô nhận mã ẨN (`inputmode="none"`, không bật bàn phím ảo), luôn giữ focus, đọc
    qua `ScannerBuffer` (máy quét có/không gửi Enter đều được) → tự xác nhận. Sai mã → báo lỗi, quét lại.
  - **⌨ Nhập mật khẩu**: ô mật khẩu hiện rõ, không bị giành focus, KHÔNG tự xác nhận — chỉ khi bấm
    Enter hoặc nút "Khóa"/"Mở khóa".
  - Có liên kết chuyển qua lại giữa 2 cách. Trong lúc đang ở bước chọn, lượt quét nào cũng bị bỏ qua.
- **10 giây:** tính từ lúc mở hộp; chọn/đổi cách xác nhận thì tính lại đủ 10 giây cho bước đó. Hết giờ
  → đóng hộp, giữ nguyên trạng thái.
- Đã kiểm chứng (Playwright): quét khi đang ở bước chọn → bỏ qua; để hết 10 giây → đóng; chế độ QR giữ
  focus kể cả khi chạm ra ngoài, mã sai báo lỗi, mã đúng khóa ngay; chế độ nhập tay gõ chậm không tự
  xác nhận, focus không bị giành, Enter mở khóa; chuyển qua lại 2 chế độ; Hủy trả focus về ô quét chính.

## 114. Icon cho menu trang chủ

- Mỗi mục trong menu nhân viên (và 2 thẻ "Bệnh nhân"/"Nhân viên" ở màn hình chọn vai trò) có 1 ô icon màu
  riêng phía trên tên: Tiếp nhận gọi số (loa), Nhân viên hỗ trợ cấp số (vé), In lại phiếu (máy in), Bệnh
  nhân tự cấp số (khung quét), Xem tất cả quầy (lưới), Xem quầy đang phục vụ (màn hình TV), QR đăng nhập
  (chìa khóa), QR máy chủ (máy chủ), Quản lý quầy (bánh răng). Rê chuột/chạm → icon đổi sang nền đậm.
- Icon là SVG viết thẳng trong `public/index.html` — không tải thư viện/font từ Internet (chạy được trong
  mạng LAN nội bộ không có Internet). Menu rộng 3 thẻ/hàng trên máy tính, 2 thẻ/hàng trên điện thoại.
