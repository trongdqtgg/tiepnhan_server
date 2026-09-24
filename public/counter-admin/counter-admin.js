/**
 * Man hinh /counter-admin - quan ly DANH MUC quay tiep nhan (them / sua ma-ten / tam ngung / kich
 * hoat lai). Danh cho quan tri vien, KHAC voi man hinh /counter (nhan vien truc quay hang ngay
 * vao/thoat phien lam viec). Xem cac route POST/PUT /api/counters, /api/counters/:id (sua),
 * /api/counters/:id/pause, /api/counters/:id/resume trong src/routes/counters.js.
 */
const socket = io({ path: '/rt-bridge/' });
let counters = [];
let editingCounterId = null; // null = dang o che do THEM MOI, khac null = dang SUA quay co id nay

async function loadCounters() {
  const tbody = document.getElementById('counterTableBody');
  try {
    const res = await fetch('/api/counters');
    counters = await res.json();
  } catch {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Không tải được danh sách quầy, vui lòng tải lại trang.</td></tr>';
    return;
  }
  renderTable();
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderTable() {
  const tbody = document.getElementById('counterTableBody');
  if (!counters.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Chưa có quầy nào - bấm "+ Thêm quầy mới" để bắt đầu.</td></tr>';
    return;
  }
  // Sap xep theo ma quay (giong danh sach chon o man hinh /counter) de de doi chieu.
  const sorted = [...counters].sort((a, b) => a.code.localeCompare(b.code, 'vi'));
  tbody.innerHTML = sorted
    .map((c) => {
      const statusBadge = c.is_active
        ? '<span class="status-badge active">Đang hoạt động</span>'
        : '<span class="status-badge paused">Tạm ngưng</span>';
      const inUseBadge = c.in_use ? ' <span class="status-badge in-use">Đang có người dùng</span>' : '';
      const pauseBtn = c.is_active
        ? `<button class="btn-warn" onclick="pauseCounter(${c.id})">Tạm ngưng</button>`
        : `<button class="btn-ok" onclick="resumeCounter(${c.id})">Kích hoạt lại</button>`;
      return `<tr>
        <td><b>${escapeHtml(c.code)}</b></td>
        <td>${escapeHtml(c.name)}</td>
        <td>${statusBadge}${inUseBadge}</td>
        <td class="actions">
          <button class="btn-secondary" onclick="openEditModal(${c.id})">Sửa</button>
          ${pauseBtn}
        </td>
      </tr>`;
    })
    .join('');
}

function openAddModal() {
  editingCounterId = null;
  document.getElementById('modalTitle').textContent = 'Thêm quầy mới';
  document.getElementById('inputCode').value = '';
  document.getElementById('inputName').value = '';
  hideFormError();
  document.getElementById('counterModal').style.display = 'flex';
  document.getElementById('inputCode').focus();
}

function openEditModal(id) {
  const counter = counters.find((c) => c.id === id);
  if (!counter) return;
  editingCounterId = id;
  document.getElementById('modalTitle').textContent = `Sửa quầy — ${counter.code}`;
  document.getElementById('inputCode').value = counter.code;
  document.getElementById('inputName').value = counter.name;
  hideFormError();
  document.getElementById('counterModal').style.display = 'flex';
  document.getElementById('inputName').focus();
}

function closeCounterModal() {
  document.getElementById('counterModal').style.display = 'none';
}

function showFormError(message) {
  const el = document.getElementById('formError');
  el.textContent = message;
  el.style.display = 'block';
}

function hideFormError() {
  const el = document.getElementById('formError');
  el.style.display = 'none';
  el.textContent = '';
}

/**
 * Luu form (them moi hoac sua, tuy editingCounterId). Kiem tra trung THEM O PHIA CLIENT truoc
 * (phan hoi tuc thi, khong doi round-trip mang) - nhung server (createCounter()/updateCounter()
 * trong ticketService.js) VAN la noi kiem tra CHINH THUC, tranh truong hop 2 quan tri vien cung
 * luc them trung ma o 2 tab khac nhau ma client khong biet.
 */
async function submitCounterForm() {
  const code = document.getElementById('inputCode').value.trim();
  const name = document.getElementById('inputName').value.trim();
  if (!code || !name) {
    showFormError('Vui lòng nhập đầy đủ mã quầy và tên quầy.');
    return;
  }

  const isEditing = editingCounterId != null;
  const url = isEditing ? `/api/counters/${editingCounterId}` : '/api/counters';
  const method = isEditing ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      showFormError(data.message || data.error || 'Không lưu được, vui lòng thử lại.');
      return;
    }
    closeCounterModal();
    await loadCounters();
  } catch {
    showFormError('Lỗi kết nối tới máy chủ, vui lòng thử lại.');
  }
}

async function pauseCounter(id) {
  const counter = counters.find((c) => c.id === id);
  if (!counter) return;
  const extra = counter.in_use
    ? '\n\nQuầy này đang có người sử dụng — nhân viên đang trực sẽ bị đăng xuất ngay khi tạm ngưng.'
    : '';
  if (!await UiDialog.confirm(`Tạm ngưng quầy "${counter.code} - ${counter.name}"?\nQuầy sẽ không thể chọn để làm việc cho đến khi được kích hoạt lại.${extra}`)) return;
  const res = await fetch(`/api/counters/${id}/pause`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    UiDialog.alert(data.message || data.error || 'Không tạm ngưng được quầy này.');
    return;
  }
  await loadCounters();
}

async function resumeCounter(id) {
  const counter = counters.find((c) => c.id === id);
  if (!counter) return;
  if (!await UiDialog.confirm(`Kích hoạt lại quầy "${counter.code} - ${counter.name}"?`)) return;
  const res = await fetch(`/api/counters/${id}/resume`, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    UiDialog.alert(data.message || data.error || 'Không kích hoạt lại được quầy này.');
    return;
  }
  await loadCounters();
}

// Cho phep bam Enter trong 2 o nhap de luu nhanh (khong can bam chuot vao nut "Lưu").
document.addEventListener('DOMContentLoaded', () => {
  ['inputCode', 'inputName'].forEach((id) => {
    document.getElementById(id).addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitCounterForm();
    });
  });
  loadCounters();
});

// Cap nhat lai danh sach realtime khi co thay doi tu thiet bi/tab khac (vao/thoat phien, tam
// ngung/kich hoat...) - dung chung su kien "queue:summary" da phat san moi vai giay/moi thao tac,
// khong can them su kien rieng.
socket.on('queue:summary', () => {
  // Chi tai lai neu modal KHONG dang mo, tranh lam gian doan nguoi dung dang go form dang do.
  if (document.getElementById('counterModal').style.display === 'none') loadCounters();
});
