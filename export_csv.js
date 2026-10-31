const fs = require('fs');
const path = require('path');

const dataContent = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');

const fn = new Function(dataContent + '; return { INITIAL_ITEMS, INITIAL_WAREHOUSES, INITIAL_USERS, INITIAL_DOCUMENTS };');
const res = fn();

function toCsv(rows) {
  return rows.map(r => r.map(c => {
    let s = (c === null || c === undefined) ? '' : String(c);
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',')).join('\r\n');
}

// 1. ITEMS (Danh mục Đạo cụ & Tồn kho)
const itemHeaders = ['Mã Đạo Cụ', 'Tên Đạo Cụ', 'Danh Mục', 'Mục Đích Sử Dụng', 'Kho Quản Lý', 'Vị Trí Kệ', 'Đơn Vị Tính', 'Tổng Tồn', 'Sẵn Sàng', 'Đang Đi Tour', 'Đang Hỏng', 'Đơn Giá (VNĐ)', 'URL Ảnh'];
const itemRows = [itemHeaders];
(res.INITIAL_ITEMS || []).forEach(it => {
  itemRows.push([
    it.id || '',
    it.name || '',
    it.category || '',
    it.purpose || '',
    it.warehouseId || '',
    it.shelfLocation || '',
    it.unit || '',
    it.total || 0,
    it.ready || 0,
    it.inUse || 0,
    it.broken || 0,
    it.price || 0,
    it.image || ''
  ]);
});
fs.writeFileSync(path.join(__dirname, 'GoogleSheet_Mau_ITEMS.csv'), '\uFEFF' + toCsv(itemRows), 'utf8');

// 2. DOCUMENTS (Chứng từ xuất nhập)
const docHeaders = ['Mã Phiếu', 'Loại Phiếu', 'Ngày Tạo', 'Người Lập Phiếu', 'Kho Xuất/Nhập', 'Tour/Chương Trình', 'Tổng Số Món', 'Trạng Thái', 'Thủ Kho Duyệt', 'Ghi Chú'];
const docRows = [docHeaders];
(res.INITIAL_DOCUMENTS || []).forEach(d => {
  docRows.push([
    d.code || d.id || '',
    d.type || '',
    d.createdAt || '',
    d.creator || '',
    d.warehouseName || '',
    d.tourName || '',
    d.itemsCount || (d.items ? d.items.length : 0),
    d.status || '',
    d.keeperApproved ? 'Đã duyệt' : 'Chờ duyệt',
    d.note || ''
  ]);
});
fs.writeFileSync(path.join(__dirname, 'GoogleSheet_Mau_DOCUMENTS.csv'), '\uFEFF' + toCsv(docRows), 'utf8');

// 3. TOURS (Chương trình / Sự kiện)
const tourHeaders = ['Mã Tour', 'Tên Chương Trình', 'Khách Hàng / Đơn Vị', 'Ngày Bắt Đầu', 'Ngày Kết Thúc', 'Địa Điểm Tổ Chức', 'Điều Hành Tour', 'Trạng Thái'];
const tourRows = [
  tourHeaders,
  ['TOUR-2026-001', 'Teambuilding Khối Công Nghệ FPT', 'FPT Software', '2026-11-05', '2026-11-06', 'Flamingo Đại Lải, Vĩnh Phúc', 'Trần Thị Bình', 'Đang chuẩn bị'],
  ['TOUR-2026-002', 'Ngày Hội Gia Đình Viettel', 'Viettel Post', '2026-11-12', '2026-11-12', 'Công viên Yên Sở, Hà Nội', 'Lê Hoàng Nam', 'Lên kế hoạch'],
  ['TOUR-2026-003', 'Hội Thao Mùa Thu VinFast', 'VinFast Hải Phòng', '2026-10-28', '2026-10-29', 'Đồ Sơn, Hải Phòng', 'Trần Thị Bình', 'Đã hoàn thành']
];
fs.writeFileSync(path.join(__dirname, 'GoogleSheet_Mau_TOURS.csv'), '\uFEFF' + toCsv(tourRows), 'utf8');

// 4. WAREHOUSES (Danh sách Kho bãi)
const whHeaders = ['Mã Kho', 'Tên Kho Bãi', 'Địa Chỉ', 'Thủ Kho Quản Lý', 'Kho Mặc Định'];
const whRows = [whHeaders];
(res.INITIAL_WAREHOUSES || []).forEach(w => {
  whRows.push([
    w.code || w.id || '',
    w.name || '',
    w.address || '',
    w.manager || '',
    w.isDefault ? 'Có' : 'Không'
  ]);
});
fs.writeFileSync(path.join(__dirname, 'GoogleSheet_Mau_WAREHOUSES.csv'), '\uFEFF' + toCsv(whRows), 'utf8');

console.log('Xuất thành công 4 file CSV mẫu Google Sheet!');
