# Hệ Thống Quản Lý Đạo Cụ & Kho Bãi ABA (ABA Inventory & Event Operations System)

Phần mềm Quản lý Đạo cụ & Kho bãi được tối ưu hóa chuyên biệt theo mô hình vận hành thực tế của các công ty tổ chức sự kiện, teambuilding và giáo dục ngoài trời. Hệ thống được thiết kế giao diện hiện đại, trực quan, hỗ trợ hoàn hảo cả **Máy tính (Desktop)** và **Điện thoại di động (iPhone / Android)**.

---

## 🌟 Các Tính Năng Nổi Bật

1. **Thanh Điều Hướng 8 Tab Nghiệp Vụ Chuyên Biệt**:
   - **Tab 1: Kho (Tổng kho)**: Tìm kiếm đa chiều, lọc theo kho/danh mục/loại, 5 chỉ số tồn kho chuẩn xác (*Sẵn sàng, Đang đi, Hỏng, Tại kho, Tổng*), xuất/nhập Excel hàng loạt, điều chỉnh phân bổ giá kệ với cơ chế kiểm tra đối soát 100%.
   - **Tab 2: Nhập Mới**: Khai báo đạo cụ mới hoàn toàn (sinh mã tự động `A-xxx` hoặc `TH-xxx`) hoặc bổ sung số lượng, phân bổ vào nhiều giá/kệ khác nhau, chụp/tải hóa đơn và ảnh đạo cụ.
   - **Tab 3: Xuất Kho**: Lập phiếu xuất theo từng kho nguồn, bung nhanh toàn bộ đạo cụ con của **Bộ Game Teambuilding** chỉ bằng 1 nút bấm (hỗ trợ thu gọn/mở rộng danh sách con), lưu phiếu chuẩn bị đồ nháp (`CB_...`), bắt buộc chụp 2 ảnh nghiệm thu (*Đội ngũ phụ trách & Đạo cụ xếp lên xe tải*) trước khi duyệt phiếu chính thức (`XK_...`).
   - **Tab 4: Thu Hồi (Nhập Lại)**: Lọc tour thực tế đang giữ đồ, Bảng 1 kiểm kê đồ lành đối soát chênh lệch thừa/thiếu, nút 1 chạm *"Lưu tại vị trí Hậu kiểm"*, Bảng 2 tách biệt báo cáo sự cố/hỏng kèm ảnh hiện trạng bắt buộc từng món và ảnh nghiệm thu dỡ xe về kho (`NK_...`).
   - **Tab 5: Chương Trình (Vận hành & Gom đồ đa kho)**: Cục diện 2 cột thông minh gom đồ từ nhiều kho khác nhau về tour, nhóm nổi bật theo Bộ Game Combo, tính năng **Điều chuyển hiện trường** sang tour khác 1-click chuyển 100% không cần quay về kho (`DC_...`).
   - **Tab 6: Sửa Chữa (Phục hồi đồ hỏng)**: Lưới card chỉ lọc đồ hỏng (`broken > 0`), xem lại lịch sử ảnh báo hỏng, 3 quy trình (*Tự sửa nội bộ, Gửi thợ ngoài Giai đoạn 1, Nghiệm thu nhận về Giai đoạn 2*).
   - **Tab 7: Thanh Lý**: Lập phiếu hủy bỏ/thanh lý tài sản hỏng nát (`TL_...`), chọn nguồn trừ tồn kho linh hoạt (*Trừ đồ đang hỏng hoặc trừ đồ dùng được*).
   - **Tab 8: Chứng Từ (Lịch sử & In ấn A4)**: Thư viện quản lý toàn bộ các phiếu, xem chi tiết và **In trực tiếp chuẩn khổ A4** hoặc xuất PDF kèm chữ ký điện tử và album ảnh hiện trường.

2. **Tối Ưu Hóa Camera Điện Thoại iPhone & Android**:
   - Sử dụng cơ chế nén ảnh tự động ngay trên trình duyệt (Canvas Compression), nén ảnh chất lượng cao 10MB+ từ camera iPhone xuống chỉ còn ~200KB trong tích tắc, giúp thao tác mượt mà, không giật lag và tải lên nhanh chóng qua API ImgBB.
   - API ImgBB đã tích hợp sẵn: `9b4a10db15d694a88f3aa0d1ffbc0669`.

3. **Bảo Mật & Xác Thực Nhân Sự**:
   - Đăng nhập bằng danh sách số điện thoại được Admin cấp phép trước.
   - Chụp ảnh nhận diện khuôn mặt lần đầu.
   - Nút Khóa / Đổi tài khoản bảo mật bằng **Mật khẩu Quản trị Admin**: `admin123` (hoặc `aba2026`).

---

## 🚀 Hướng Dẫn Mở Trang Web Lên Dùng Thử Ngay Lập Tức

### Cách 1: Mở trực tiếp (Nhanh nhất - Không cần cài đặt gì)
1. Mở thư mục dự án `D:\Antigravity` trên máy tính.
2. **Nhấp đúp chuột vào file `run.bat`** (hoặc nhấp chuột phải vào `index.html` chọn **Open with** -> **Google Chrome** hoặc **Microsoft Edge**).
3. Trang web sẽ mở ra ngay lập tức và bạn có thể dùng thử toàn bộ tính năng với dữ liệu mẫu có sẵn!

---

### Cách 2: Chạy qua Live Server (Nếu dùng Visual Studio Code)
1. Mở thư mục `D:\Antigravity` bằng VS Code.
2. Nhấp chuột phải vào file `index.html` -> Chọn **Open with Live Server**.
3. Trình duyệt sẽ tự động mở địa chỉ `http://127.0.0.1:5500`.

---

### Cách 3: Chạy máy chủ cục bộ bằng Python (Để mở trên điện thoại cùng mạng WiFi)
Nếu bạn muốn cầm điện thoại iPhone quét mở trang web để test camera:
1. Mở PowerShell hoặc Command Prompt tại thư mục `D:\Antigravity`.
2. Chạy lệnh:
   ```bash
   python -m http.server 8080
   ```
3. Xem địa chỉ IP máy tính của bạn (chạy lệnh `ipconfig`, ví dụ: `192.168.1.50`).
4. Mở trình duyệt Safari trên iPhone và gõ: `http://192.168.1.50:8080` để trải nghiệm camera mượt mà trên điện thoại!

---

## 🌐 Hướng Dẫn Đẩy Lên GitHub Pages (Miễn Phí 100%)

Cấu trúc mã nguồn đã được thiết kế sẵn theo chuẩn **Static Web App (SPA)**, bạn có thể triển khai lên **GitHub Pages** trong 2 phút:

1. Đăng nhập vào tài khoản của bạn trên [GitHub.com](https://github.com/).
2. Bấm nút **New repository** (Tạo kho lưu trữ mới):
   - Đặt tên Repository (Ví dụ: `aba-inventory`).
   - Chọn chế độ **Public**.
   - Bấm **Create repository**.
3. Tải toàn bộ các file trong thư mục `D:\Antigravity` lên GitHub:
   - `index.html` (Bắt buộc nằm ở thư mục gốc)
   - `styles.css`
   - `data.js`
   - `app.js`
   *(Bạn có thể kéo thả trực tiếp các file này vào giao diện GitHub trên trình duyệt qua nút "uploading an existing file")*.
4. Bật GitHub Pages:
   - Vào mục **Settings** của repository -> Chọn menu **Pages** ở cột bên trái.
   - Tại mục **Build and deployment** -> **Branch**, chọn nhánh `main` (hoặc `master`) và thư mục `/ (root)`.
   - Bấm nút **Save**.
5. Đợi khoảng 1 phút, GitHub sẽ cung cấp cho bạn một đường link trang web trực tiếp, ví dụ:
   `https://<ten-tai-khoan>.github.io/aba-inventory/`
   Bạn có thể gửi link này cho toàn bộ nhân sự công ty truy cập bằng điện thoại hoặc máy tính bất kỳ lúc nào!

---

## 🔑 Thông Tin Mặc Định
- **Mật khẩu Admin mở khóa/đổi tài khoản**: `admin123` hoặc `aba2026`
- **Tài khoản mẫu**:
  - `0912345678` - Nguyễn Văn An (Thủ kho trưởng)
  - `0987654321` - Trần Thị Bình (Điều hành Tour)
  - `0905123456` - Lê Hoàng Nam (Kỹ thuật viên)
