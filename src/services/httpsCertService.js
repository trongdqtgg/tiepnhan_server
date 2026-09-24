/**
 * Tu sinh 1 chung chi HTTPS TU KY (self-signed) de may chu co the chay them 1 cong HTTPS song
 * song voi HTTP - BAT BUOC phai co HTTPS (hoac localhost) thi trinh duyet moi cho phep trang web
 * dung CAMERA (navigator.mediaDevices.getUserMedia) tren dien thoai/may tinh bang, day la quy dinh
 * bao mat cua chinh trinh duyet, KHONG co cach nao lach qua bang code phia server.
 *
 * Dung thu vien "selfsigned" (thuan JavaScript, dung crypto co san cua Node.js qua WebCrypto,
 * KHONG can bien dich native module nao) - dung nguyen tac cua ca du an la khong doi hoi
 * Python/Visual Studio Build Tools tren may Windows.
 *
 * Chung chi TU KY se khien trinh duyet hien 1 CANH BAO "Kết nối không an toàn/riêng tư" o LAN DAU
 * truy cap tren moi thiet bi (vi khong co CA cong khai nao xac nhan) - day la dieu BINH THUONG va
 * CHAP NHAN DUOC voi thiet bi dung noi bo trong mang LAN benh vien/phong kham (khong dua len
 * Internet cong khai); nguoi dung chi can bam "Nâng cao/Advanced" -> "Vẫn tiếp tục/Proceed" 1 LAN
 * duy nhat cho moi thiet bi, sau do dung binh thuong khong bi hoi lai.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const CERT_DIR = path.join(__dirname, '..', '..', 'certs');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

/** Giong het logic o src/routes/serverInfo.js - liet ke tat ca dia chi IPv4 LAN (khong tinh
 * loopback) de dua vao danh sach SAN (Subject Alternative Name) cua chung chi, giup chung chi
 * hop le voi CA dia chi IP LAN hien co cua may chu tai thoi diem tao. */
function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }
  return addresses;
}

/**
 * Tra ve { key, cert } (dang PEM, dung truc tiep cho https.createServer). Neu da co san file
 * certs/server.key + certs/server.crt tu lan chay truoc thi DUNG LAI (khong tao lai moi lan khoi
 * dong server) - GIU NGUYEN de trinh duyet cac thiet bi da tung "chap nhan" chung chi nay khong bi
 * hoi lai lien tuc. Chi xoa thu muc certs/ va khoi dong lai server de tao chung chi MOI (can thiet
 * neu dia chi IP LAN cua may chu thay doi - xem ghi chu trong README).
 */
async function ensureCert() {
  if (fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH)) {
    return { key: fs.readFileSync(KEY_PATH, 'utf8'), cert: fs.readFileSync(CERT_PATH, 'utf8') };
  }

  const selfsigned = require('selfsigned');
  const lanIps = getLanAddresses();
  const altNames = [
    { type: 2, value: 'localhost' }, // type 2 = DNS name
    { type: 7, ip: '127.0.0.1' }, // type 7 = IP address
    ...lanIps.map((ip) => ({ type: 7, ip })),
  ];

  const pems = await selfsigned.generate([{ name: 'commonName', value: lanIps[0] || 'localhost' }], {
    days: 3650, // 10 nam - thiet bi noi bo, khong can doi chung chi thuong xuyen
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: true },
      { name: 'subjectAltName', altNames },
    ],
  });

  fs.mkdirSync(CERT_DIR, { recursive: true });
  fs.writeFileSync(KEY_PATH, pems.private);
  fs.writeFileSync(CERT_PATH, pems.cert);
  console.log('[HTTPS] Đã tạo chứng chỉ tự ký mới tại certs/ (áp dụng cho:', [...new Set(['localhost', '127.0.0.1', ...lanIps])].join(', '), ')');
  return { key: pems.private, cert: pems.cert };
}

module.exports = { ensureCert, getLanAddresses, CERT_DIR };
