<<<<<<< HEAD
# ApartmentManagement
=======
# Đề tài 36: Hệ Thống Quản Lý Căn Hộ Chung Cư (Apartment Management System)

> **Môn học**: Triển khai và quản trị hệ thống phần mềm  
> **Hình thức**: Cá nhân  
> **Công nghệ**: React 19 (Vite + TypeScript) + Node.js (Express + TypeScript) + PostgreSQL  
> **Môi trường phát triển**: Windows 11  
> **Môi trường triển khai sau này**: Ubuntu Server trên VMware / VirtualBox (Docker Compose + Nginx)  

---

## 1. Tổng Quan Hệ Thống

Hệ thống quản lý căn hộ chung cư hoàn chỉnh cung cấp giao diện quản trị hiện đại, phân quyền 3 cấp (Quản trị viên, Ban quản lý, Cư dân) và kết nối trực tiếp với cơ sở dữ liệu PostgreSQL thực tế:

1. **Bảng điều khiển tổng quan (Dashboard)**:
   - Thống kê thời gian thực từ Database: Tổng số tòa nhà, số căn hộ (đang ở, còn trống, bảo trì).
   - Tổng số cư dân đang cư trú, tỷ lệ lấp đầy.
   - Tổng số hóa đơn chưa thanh toán và tổng công nợ cần thu.
   - Tổng số yêu cầu bảo trì kỹ thuật đang chờ xử lý.

2. **Quản lý Tòa nhà & Căn hộ**:
   - Quản lý danh mục tòa nhà (Mã tòa, tên, số tầng).
   - CRUD căn hộ: Mã căn, tầng, diện tích (m²), trạng thái (Đang ở / Còn trống / Bảo trì).
   - Tìm kiếm và lọc linh hoạt theo tòa nhà và trạng thái.
   - **Bảo vệ toàn vẹn dữ liệu**: Ngăn chặn xóa căn hộ nếu đang có cư dân cư trú hoặc có hóa đơn liên quan.

3. **Quản lý Cư dân**:
   - Danh sách cư dân, thông tin liên hệ (SĐT, Email, tên tài khoản).
   - Hỗ trợ quan hệ 1 căn hộ có nhiều cư dân với các vai trò: **Chủ hộ (Owner)**, **Khách thuê (Tenant)**, **Thành viên gia đình (Family)**.
   - Thêm cư dân mới, gán căn hộ cư trú hoặc hủy liên kết cư trú.

4. **Quản lý Hóa đơn & Phí dịch vụ**:
   - Lập hóa đơn dịch vụ theo căn hộ và kỳ (tháng/năm).
   - Tính toán biểu phí chi tiết: Phí quản lý vận hành (theo m²), Phí gửi xe máy, xe ô tô, Tiền điện, Tiền nước.
   - **Chống trùng lặp**: Ngăn chặn tạo hóa đơn trùng cho cùng một căn hộ trong cùng kỳ.
   - **Xác nhận thanh toán**: Chỉ chuyển trạng thái "Đã thanh toán" khi có thao tác thu tiền hợp lệ, lưu vết thời gian nộp (`paid_at`).

5. **Quản lý Yêu cầu sửa chữa (Tickets)**:
   - Cư dân và ban quản lý có thể gửi yêu cầu phản ánh sự cố kỹ thuật theo mức độ ưu tiên (Thấp, Trung bình, Cao, Khẩn cấp).
   - Ban quản lý tiếp nhận, điều phối xử lý và cập nhật trạng thái (`pending` ➜ `processing` ➜ `resolved` / `rejected`).
   - Ghi nhận phản hồi và kết quả xử lý của kỹ thuật viên.

6. **Tài khoản & Phân quyền (RBAC)**:
   - 3 vai trò hệ thống: `ADMIN`, `MANAGER`, `RESIDENT`.
   - Phân quyền chặt chẽ từ Backend qua Middleware JWT (`authenticateToken` & `authorizeRoles`).
   - Cư dân chỉ có quyền xem căn hộ và hóa đơn của chính mình, gửi phản ánh sự cố; không thể can thiệp vào nghiệp vụ của ban quản lý.

---

## 2. Tài Khoản Thử Nghiệm Mẫu

Hệ thống đã cấu hình sẵn 3 nhóm tài khoản mẫu để bạn kiểm tra các vai trò:

| Vai trò | Tên đăng nhập | Mật khẩu | Phạm vi quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin` | `admin123` | Toàn quyền quản trị hệ thống, quản lý người dùng, xóa căn hộ/tòa nhà |
| **Ban Quản Lý (Manager)** | `manager` | `manager123` | Quản lý tòa nhà, căn hộ, cư dân, lập hóa đơn, thu tiền, xử lý sự cố |
| **Cư dân (Resident)** | `resident1` | `resident123` | Cư dân căn hộ A-101: xem hóa đơn của căn hộ, gửi yêu cầu sửa chữa |

*(Trên giao diện đăng nhập có sẵn các nút nhấn nhanh để điền tài khoản mẫu tiện lợi)*

---

## 3. Cấu Trúc Thư Mục Dự Án

```
ApartmentManagement/
├── .env.example                  # Template biến môi trường chung
├── .gitignore                    # Không đưa node_modules, dist, .env lên Git
├── README.md                     # Tài liệu hướng dẫn chi tiết
│
├── frontend/                     # React 19 + Vite + TypeScript
│   ├── .env                      # Cấu hình API URL cho frontend
│   ├── src/
│   │   ├── api/client.ts         # HTTP client tập trung với JWT injection
│   │   ├── context/AuthContext.tsx # Quản lý trạng thái đăng nhập & phân quyền
│   │   ├── components/
│   │   │   ├── Sidebar.tsx       # Menu điều hướng bên trái có badge & responsive
│   │   │   ├── Header.tsx        # Topbar hiển thị tên trang, user profile & đăng xuất
│   │   │   └── Modal.tsx         # Hộp thoại popup đa năng
│   │   ├── views/
│   │   │   ├── LoginView.tsx     # Giao diện đăng nhập với tài khoản mẫu
│   │   │   ├── DashboardView.tsx # Dashboard tổng quan dữ liệu thật
│   │   │   ├── ApartmentsView.tsx# Quản lý tòa nhà & căn hộ (CRUD)
│   │   │   ├── ResidentsView.tsx # Quản lý cư dân & quan hệ căn hộ
│   │   │   ├── InvoicesView.tsx  # Lập hóa đơn, tính phí, thu tiền
│   │   │   ├── TicketsView.tsx   # Quản lý yêu cầu & sự cố kỹ thuật
│   │   │   └── UsersView.tsx     # Quản lý tài khoản hệ thống & phân quyền
│   │   ├── App.tsx               # Entrypoint định tuyến các view
│   │   └── App.css               # Hệ thống giao diện hiện đại & responsive
│   └── package.json
│
└── backend/                      # Node.js + Express + TypeScript
    ├── .env                      # Cấu hình kết nối DB và JWT Secret
    ├── test_system.js            # Bộ kiểm thử tích hợp tự động (12 test cases)
    ├── src/
    │   ├── config/db.ts          # Kết nối PostgreSQL Connection Pool
    │   ├── db/
    │   │   ├── init.sql          # File SQL migration/seed hoàn chỉnh
    │   │   └── migrate.ts        # Tự động đồng bộ constraint & seed account
    │   ├── middlewares/
    │   │   └── auth.middleware.ts# Xác thực JWT & phân quyền vai trò
    │   ├── controllers/          # Xử lý nghiệp vụ Backend
    │   │   ├── auth.controller.ts
    │   │   ├── apartment.controller.ts
    │   │   ├── resident.controller.ts
    │   │   ├── invoice.controller.ts
    │   │   ├── ticket.controller.ts
    │   │   └── dashboard.controller.ts
    │   ├── routes/               # Định tuyến API
    │   ├── app.ts                # Khởi tạo Express, CORS, router
    │   └── index.ts              # Entrypoint server (PORT 5000)
    └── package.json
```

---

## 4. Hướng Dẫn Khởi Chạy Trên Windows

### Bước 1: Khởi động cơ sở dữ liệu PostgreSQL
Dự án sử dụng cơ sở dữ liệu PostgreSQL đang chạy trên Docker container `apartment_postgres` (Port 15432).
Nếu container chưa chạy, bạn có thể khởi động bằng lệnh:
```powershell
docker start apartment_postgres
```

### Bước 2: Chạy Backend (Terminal 1)
```powershell
cd c:\ApartmentManagement\backend
# Chạy ở chế độ phát triển:
npm run dev
```
> Server sẽ tự động kiểm tra migrations và chạy tại: `http://localhost:5000`  
> Health check API vẫn hoạt động bình thường tại: `http://localhost:5000/api/health`

### Bước 3: Chạy Frontend (Terminal 2)
```powershell
cd c:\ApartmentManagement\frontend
# Chạy máy chủ giao diện Vite:
npm run dev
```
> Truy cập giao diện quản trị tại: `http://localhost:5173`

---

## 5. Kiểm Thử Hệ Thống (Automated Testing)

Chạy bộ kiểm thử tích hợp 14 kịch bản tự động cho toàn bộ hệ thống (đầy đủ các vai trò Admin, Manager, Resident và bảo mật):
```powershell
cd c:\ApartmentManagement\backend
npm test
```
*Kết quả:* Kiểm tra thành công 100% (14/14 test cases), bao gồm kiểm tra `/api/health`, phân quyền RBAC 403 (Resident không tạo/xóa căn hộ, không lập/thu hóa đơn, không xem hóa đơn căn khác, không sửa vé sự cố của người khác, Manager không cấp quyền Admin), toàn vẹn dữ liệu khi xóa căn hộ, CRUD và nộp phiếu sự cố.

---

## 6. Sẵn Sàng Triển Khai Lên Ubuntu Server (Giai đoạn sau)

Khi chuyển sang máy ảo Ubuntu Server:
1. File SQL khởi tạo cơ sở dữ liệu đã sẵn sàng tại [backend/src/db/init.sql](file:///c:/ApartmentManagement/backend/src/db/init.sql).
2. Backend và Frontend đều đã được cấu hình biến môi trường tách biệt qua `.env`.
3. Sẵn sàng đóng gói Dockerfile multi-stage build cho Frontend (Nginx) và Backend (Node.js Alpine) để chạy qua Docker Compose.
>>>>>>> feature/apartment-management
