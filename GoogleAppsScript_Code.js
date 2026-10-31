/**
 * =========================================================================
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ ĐẠO CỤ & KHO BÃI ABA
 * =========================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT:
 * 1. Mở file Google Sheet của bạn trên trình duyệt.
 * 2. Vào menu "Tiện ích mở rộng" (Extensions) -> chọn "Apps Script".
 * 3. Dán toàn bộ mã này vào file Code.gs (thay thế mã cũ).
 * 4. Bấm nút "Triển khai" (Deploy) -> "Tùy chọn triển khai mới" (New deployment).
 *    - Loại: "Ứng dụng web" (Web App)
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 5. Bấm Triển khai, cấp quyền Google, copy "URL ứng dụng web" dán vào App.
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "getAll";
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === "getAll") {
    var itemsSheet = ss.getSheetByName("ITEMS");
    var docsSheet = ss.getSheetByName("DOCUMENTS");
    var toursSheet = ss.getSheetByName("TOURS");
    var whSheet = ss.getSheetByName("WAREHOUSES");

    var items = getSheetDataAsJson(itemsSheet);
    var docs = getSheetDataAsJson(docsSheet);
    var tours = getSheetDataAsJson(toursSheet);
    var warehouses = getSheetDataAsJson(whSheet);

    return responseJson({
      status: "success",
      timestamp: new Date().toISOString(),
      data: {
        items: items,
        documents: docs,
        tours: tours,
        warehouses: warehouses
      }
    });
  }

  return responseJson({ status: "ready", message: "ABA Inventory Apps Script is active" });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ status: "error", message: "Không có dữ liệu gửi lên" });
    }

    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action; // "SYNC_ALL", "ADD_DOC", "UPDATE_ITEM", v.v.

    // 1. Đồng bộ lưu phiếu xuất/nhập/thu hồi/chuyển kho
    if (action === "ADD_DOC" || data.sheet === "DOCUMENTS") {
      var docSheet = getOrCreateSheet(ss, "DOCUMENTS", [
        "Mã Phiếu", "Loại Phiếu", "Ngày Tạo", "Người Lập Phiếu", 
        "Kho Xuất/Nhập", "Tour/Chương Trình", "Tổng Số Món", 
        "Trạng Thái", "Thủ Kho Duyệt", "Ghi Chú", "Dữ Liệu Chi Tiết (JSON)"
      ]);

      var doc = data.payload || {};
      docSheet.appendRow([
        doc.code || doc.id || "",
        doc.type || "",
        doc.createdAt || new Date().toLocaleString("vi-VN"),
        doc.creator || "",
        doc.warehouseName || "",
        doc.tourName || "",
        doc.itemsCount || (doc.items ? doc.items.length : 0),
        doc.status || "Hoàn thành",
        doc.keeperApproved ? "Đã duyệt" : "Chờ duyệt",
        doc.note || "",
        JSON.stringify(doc)
      ]);

      return responseJson({ status: "success", message: "Đã lưu phiếu vào Google Sheet" });
    }

    // 2. Cập nhật tồn kho (ITEMS)
    if (action === "UPDATE_ITEMS" || data.sheet === "ITEMS") {
      var itemsSheet = getOrCreateSheet(ss, "ITEMS", [
        "Mã Đạo Cụ", "Tên Đạo Cụ", "Danh Mục", "Mục Đích Sử Dụng", 
        "Kho Quản Lý", "Vị Trí Kệ", "Đơn Vị Tính", "Tổng Tồn", 
        "Sẵn Sàng", "Đang Đi Tour", "Đang Hỏng", "Đơn Giá (VNĐ)", "URL Ảnh"
      ]);

      var updatedItems = data.payload || [];
      if (Array.isArray(updatedItems)) {
        // Ghi đè toàn bộ danh sách hoặc cập nhật
        var headers = [
          "Mã Đạo Cụ", "Tên Đạo Cụ", "Danh Mục", "Mục Đích Sử Dụng", 
          "Kho Quản Lý", "Vị Trí Kệ", "Đơn Vị Tính", "Tổng Tồn", 
          "Sẵn Sàng", "Đang Đi Tour", "Đang Hỏng", "Đơn Giá (VNĐ)", "URL Ảnh"
        ];
        itemsSheet.clearContents();
        itemsSheet.appendRow(headers);

        var rows = updatedItems.map(function(it) {
          return [
            it.id || "",
            it.name || "",
            it.category || "",
            it.purpose || "",
            it.warehouseId || "",
            it.shelfLocation || "",
            it.unit || "",
            it.total || 0,
            it.ready || 0,
            it.inUse || 0,
            it.broken || 0,
            it.price || 0,
            it.image || ""
          ];
        });

        if (rows.length > 0) {
          itemsSheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
        }
      }

      return responseJson({ status: "success", message: "Đã đồng bộ tồn kho lên Sheet" });
    }

    return responseJson({ status: "success", message: "Đã tiếp nhận yêu cầu" });
  } catch(err) {
    return responseJson({ status: "error", message: err.toString() });
  }
}

// Hàm bổ trợ đọc dữ liệu Sheet sang JSON
function getSheetDataAsJson(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];

  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#1e293b");
      headerRange.setFontColor("#ffffff");
    }
  }
  return sheet;
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
