const dayjs = require('dayjs');

/**
 * SQLite khong co TTL index tu dong nhu MongoDB, nen phai tu chay don dep dinh ky.
 * Xoa toan bo ve va bo dem cua nhung ngay cu hon "retentionDays".
 * Goi 1 lan luc server khoi dong, roi lap lai moi gio (xem server.js).
 */
function cleanupOldData(db, retentionDays) {
  const cutoffDay = dayjs().subtract(retentionDays, 'day').format('YYYY-MM-DD');

  const delTickets = db.prepare('DELETE FROM tickets WHERE day < ?').run(cutoffDay);
  const delSeq = db.prepare('DELETE FROM seq WHERE day < ?').run(cutoffDay);

  if (delTickets.changes > 0 || delSeq.changes > 0) {
    console.log(
      `[CLEANUP] Đã tự động xoá dữ liệu trước ngày ${cutoffDay}: ${delTickets.changes} vé, ${delSeq.changes} bộ đếm.`
    );
  }
  return { deletedTickets: delTickets.changes, deletedSeq: delSeq.changes, cutoffDay };
}

module.exports = { cleanupOldData };
