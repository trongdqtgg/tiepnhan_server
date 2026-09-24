const dayjs = require('dayjs');
const { getRuleByCode } = require('../config/priorityRules');

let ThermalPrinter, PrinterTypes;
try {
  // Thu vien nay can duoc cai (co trong package.json). Bao trong try/catch
  // de he thong van chay duoc tren may chua co driver may in / dang test.
  ({ printer: ThermalPrinter, types: PrinterTypes } = require('node-thermal-printer'));
} catch {
  ThermalPrinter = null;
}

function buildPrinter() {
  if (!ThermalPrinter) return null;
  const type = (process.env.PRINTER_TYPE || 'epson').toUpperCase();
  return new ThermalPrinter({
    type: PrinterTypes[type] || PrinterTypes.EPSON,
    interface: process.env.PRINTER_INTERFACE || 'printer:auto',
    removeSpecialCharacters: false,
    options: { timeout: 5000 },
  });
}

/**
 * In phieu so thu tu. Neu PRINTER_ENABLED=false hoac thu vien/may in khong san sang,
 * chi log ra console (che do giả lập) de kiosk van hoat dong binh thuong khi test.
 */
async function printTicket(ticket) {
  const rule = getRuleByCode(ticket.priority_code);
  const enabled = String(process.env.PRINTER_ENABLED).toLowerCase() === 'true';

  // Ghep tien to (neu co, xem SEPARATE_PRIORITY_SEQUENCE trong .env.example va cot moi
  // tickets.number_prefix) TRUOC khi dem 0 - ticket.number_prefix null/rong o che do mac dinh
  // (khong bat tinh nang tach day so) nen KHONG anh huong gi khi tinh nang do dang tat.
  const numberText = `${ticket.number_prefix || ''}${String(ticket.number).padStart(3, '0')}`;

  const lines = [
    'PHONG KHAM / BENH VIEN',
    '--------------------------------',
    `SO THU TU: ${numberText}`,
    `Doi tuong: ${rule ? rule.label : ticket.priority_code}`,
    `Ngay: ${dayjs(ticket.created_at).format('DD/MM/YYYY HH:mm')}`,
    '--------------------------------',
    'Vui long theo doi man hinh',
    'de biet luot goi so cua ban',
  ];

  if (!enabled || !ThermalPrinter) {
    console.log('[PRINTER - CHE DO GIA LAP] Khong in giay that, noi dung phieu:');
    console.log(lines.join('\n'));
    return { printed: false, simulated: true, lines };
  }

  try {
    const printer = buildPrinter();
    printer.alignCenter();
    printer.setTextDoubleHeight();
    printer.println('PHONG KHAM / BENH VIEN');
    printer.drawLine();
    printer.setTextQuadArea ? printer.setTextQuadArea() : printer.setTextDoubleWidth();
    printer.println(numberText);
    printer.setTextNormal();
    printer.println(rule ? rule.label : ticket.priority_code);
    printer.println(dayjs(ticket.created_at).format('DD/MM/YYYY HH:mm'));
    printer.drawLine();
    printer.cut();
    await printer.execute();
    return { printed: true, simulated: false };
  } catch (err) {
    console.error('[PRINTER] Loi khi in, chuyen sang che do giả lập:', err.message);
    console.log(lines.join('\n'));
    return { printed: false, simulated: true, error: err.message, lines };
  }
}

module.exports = { printTicket };
