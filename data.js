/**
 * ABA Inventory & Event Operations System - Mock & Initial Data
 * Hệ thống Quản lý Đạo cụ & Kho bãi - Dữ liệu khởi tạo chuẩn doanh nghiệp teambuilding & sự kiện
 */

const INITIAL_WAREHOUSES = [
  { id: "WH-MD", code: "KHO-MD", name: "Kho Tổng Mỹ Đình (Hà Nội)", address: "Số 15 Lê Đức Thọ, Nam Từ Liêm, HN", manager: "Nguyễn Văn An", isDefault: true },
  { id: "WH-HD", code: "KHO-HD", name: "Kho Đồ Hơi Hà Đông", address: "Khu đất dịch vụ Yên Nghĩa, Hà Đông, HN", manager: "Trần Văn Bình", isDefault: false },
  { id: "WH-LB", code: "KHO-LB", name: "Kho Thiết Bị Long Biên", address: "Gia Thụy, Long Biên, Hà Nội", manager: "Phạm Hải Long", isDefault: false }
];

const INITIAL_USERS = [
  {
    id: "U01",
    phone: "0912345678",
    name: "Nguyễn Văn An",
    role: "Thủ kho trưởng",
    roleType: "KEEPER",
    roleBadge: "Thủ kho",
    isAdmin: true,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    faceRegistered: true,
    device: "iPhone 15 Pro Max (iOS 18.2)",
    lastLogin: "2026-10-30 07:15"
  },
  {
    id: "U02",
    phone: "0987654321",
    name: "Trần Thị Bình",
    role: "Điều hành Chương trình",
    roleType: "STAFF",
    roleBadge: "Thông thường",
    isAdmin: false,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    faceRegistered: true,
    device: "Samsung Galaxy S24 (Android 15)",
    lastLogin: "2026-10-30 06:45"
  },
  {
    id: "U03",
    phone: "0905123456",
    name: "Lê Hoàng Nam",
    role: "Quản trị hệ thống",
    roleType: "ADMIN",
    roleBadge: "Quản trị",
    isAdmin: true,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    faceRegistered: true,
    device: "Xiaomi 14 Pro",
    lastLogin: "2026-10-29 18:20"
  },
  {
    id: "U04",
    phone: "0933445566",
    name: "Trần Văn Bình",
    role: "Kỹ thuật / Nhân viên",
    roleType: "STAFF",
    roleBadge: "Thông thường",
    isAdmin: false,
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    faceRegistered: true,
    device: "Oppo Find X7",
    lastLogin: "2026-10-29 19:30"
  }
];

const INITIAL_CATEGORIES = [
  "Đồ hơi",
  "Game tự chế",
  "Game hội chợ",
  "Trang trí",
  "Dụng cụ/Máy móc/Phương tiện",
  "Đồ sự kiện",
  "Trang phục",
  "Văn phòng phẩm"
];

const INITIAL_GAME_COMBOS = [
  {
    id: "GAME-01",
    name: "Bộ Bánh Xe Khổng Lồ",
    type: "GAME",
    category: "Đồ hơi",
    description: "Game phối hợp teambuilding 4-6 người lăn bánh xe bạt PVC về đích.",
    items: [
      { itemId: "A001", name: "Bánh xe bạt PVC khổng lồ (D=2.2m)", unit: "Chiếc", quantityPerSet: 2 },
      { itemId: "A004", name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", quantityPerSet: 1 },
      { itemId: "A008", name: "Dây thừng kéo cố định bánh xe 20m", unit: "Cuộn", quantityPerSet: 2 }
    ]
  },
  {
    id: "GAME-02",
    name: "Bộ Kéo Co 4 Hướng Đỉnh Cao",
    type: "GAME",
    category: "Game tự chế",
    description: "Game đối kháng 4 đội kéo co tranh cờ trung tâm.",
    items: [
      { itemId: "A002", name: "Dây thừng kéo co 4 hướng phi 32", unit: "Bộ", quantityPerSet: 1 },
      { itemId: "A006", name: "Cờ tiêu chuẩn đánh dấu 4 màu", unit: "Chiếc", quantityPerSet: 4 },
      { itemId: "A005", name: "Găng tay bảo hộ teambuilding", unit: "Đôi", quantityPerSet: 20 }
    ]
  },
  {
    id: "GAME-03",
    name: "Bộ Vượt Chướng Ngại Vật Khí Cầu",
    type: "GAME",
    category: "Đồ hơi",
    description: "Nhà phao liên hoàn vượt dốc và chướng ngại vật hơi 15m.",
    items: [
      { itemId: "A007", name: "Cầu phao hơi liên hoàn 15m", unit: "Bộ", quantityPerSet: 1 },
      { itemId: "A004", name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", quantityPerSet: 2 },
      { itemId: "A009", name: "Thảm cỏ nhân tạo lót chân phao 20x2m", unit: "Tấm", quantityPerSet: 2 }
    ]
  },
  {
    id: "GAME-04",
    name: "Bộ Đua Thuyền Phao Trên Cạn",
    type: "GAME",
    category: "Game tự chế",
    description: "Thuyền phao 6 người chèo tay đồng đội di chuyển trên cỏ/cát.",
    items: [
      { itemId: "A003", name: "Thuyền phao đồng đội 6 người dài 4m", unit: "Chiếc", quantityPerSet: 2 },
      { itemId: "A010", name: "Mái chèo nhựa composite siêu nhẹ", unit: "Chiếc", quantityPerSet: 12 },
      { itemId: "A004", name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", quantityPerSet: 1 }
    ]
  },
  {
    id: "TOOL-01",
    name: "Bộ Dụng Cụ Bơm Hơi Tiêu Chuẩn",
    type: "TOOLSET",
    category: "Dụng cụ phụ trợ",
    description: "Bộ máy thổi khí kèm cuộn dây điện nguồn 20m và ổ cắm chịu tải chuyên dụng cho đồ hơi.",
    items: [
      { itemId: "A004", name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", quantityPerSet: 1 },
      { itemId: "A013", name: "Cuộn dây điện nguồn 20m", unit: "Cuộn", quantityPerSet: 1 },
      { itemId: "TOOL-PLUG-01", name: "Ổ cắm điện đa năng chịu tải", unit: "Chiếc", quantityPerSet: 1 }
    ]
  },
  {
    id: "TOOL-02",
    name: "Bộ Phân Luồng & Cọc Tiêu An Toàn",
    type: "TOOLSET",
    category: "Dụng cụ phụ trợ",
    description: "Trang bị khoanh vùng sân chơi, phân làn thi đấu và cảnh báo an toàn teambuilding.",
    items: [
      { itemId: "TOOL-CONE-01", name: "Cọc tiêu phản quang 75cm", unit: "Chiếc", quantityPerSet: 8 },
      { itemId: "TOOL-TAPE-01", name: "Cuộn dây rào cảnh báo 100m", unit: "Cuộn", quantityPerSet: 2 },
      { itemId: "A006", name: "Cờ tiêu chuẩn đánh dấu 4 màu", unit: "Chiếc", quantityPerSet: 4 }
    ]
  },
  {
    id: "TOOL-03",
    name: "Bộ Âm Thanh Hoạt Náo Di Động",
    type: "TOOLSET",
    category: "Dụng cụ phụ trợ",
    description: "Loa kéo di động dã ngoại công suất lớn kèm micro không dây và dây sạc phụ trợ.",
    items: [
      { itemId: "A011", name: "Loa kéo di động công suất khủng 800W", unit: "Chiếc", quantityPerSet: 1 },
      { itemId: "TOOL-MIC-01", name: "Micro không dây UHF dự phòng", unit: "Đôi", quantityPerSet: 1 },
      { itemId: "A013", name: "Cuộn dây điện nguồn 20m", unit: "Cuộn", quantityPerSet: 1 }
    ]
  }
];

const INITIAL_ITEMS = [
  {
    id: "A001",
    code: "A-001",
    name: "Bánh xe bạt PVC khổng lồ (D=2.2m)",
    type: "Khấu hao",
    category: "Đồ hơi",
    unit: "Chiếc",
    specs: "Bạt PVC 0.9mm Tarpaulin chịu lực, đường kính ngoài 2.2m, lọt lòng 1.5m, màu vàng-cam",
    purpose: "Team building, Vận động trường ngoài trời",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 2,
    ready: 12,
    inUse: 4,
    broken: 2,
    shelves: [
      { shelf: "Giá Hơi 01", tier: "1", qty: 8 },
      { shelf: "Giá Hơi 02", tier: "2", qty: 4 },
      { shelf: "Khu vực Hậu kiểm", tier: "Mặt sàn", qty: 2 }
    ],
    brokenLocations: [
      { shelf: "Khu vực Đồ Hỏng Kho Mỹ Đình", tier: "1", qty: 2, reason: "Bị xì mối hàn sau chương trình Sầm Sơn", photo: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&auto=format&fit=crop&q=80" }
    ],
    currentPrograms: [
      { programId: "PROG-2026-01", programName: "Teambuilding FPT Software - 600 Khách", qty: 4, location: "Bãi Cháy, Hạ Long" }
    ],
    image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400&auto=format&fit=crop&q=80",
    invoiceUrl: "https://images.unsplash.com/photo-1554415707-9e4966a604f7?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 18500000,
    purchaseDate: "2026-06-15",
    purchaseVendor: "Công ty TNHH Bạt Sự Kiện Thuận Phát",
    purchasePrice: 18500000
  },
  {
    id: "A002",
    code: "A-002",
    name: "Dây thừng kéo co 4 hướng phi 32",
    type: "Khấu hao",
    category: "Game tự chế",
    unit: "Bộ",
    specs: "Sợi đay tự nhiên phi 32mm bện 4 nhánh, vòng khuyên thép đúc ở tâm, chiều dài mỗi nhánh 12m",
    purpose: "Team building bãi biển, ngày hội gia đình",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 2,
    ready: 6,
    inUse: 2,
    broken: 1,
    shelves: [
      { shelf: "Kệ Game A1", tier: "1", qty: 4 },
      { shelf: "Kệ Game A1", tier: "2", qty: 2 },
      { shelf: "Khu vực Đồ Hỏng", tier: "1", qty: 1 }
    ],
    brokenLocations: [
      { shelf: "Khu vực Đồ Hỏng Kho Mỹ Đình", tier: "1", qty: 1, reason: "Đứt vòng bện đầu nhánh 3", photo: "https://images.unsplash.com/photo-1516216628859-9bcceabb84ca?w=400&auto=format&fit=crop&q=80" }
    ],
    currentPrograms: [
      { programId: "PROG-2026-02", programName: "Hội thao Tập đoàn Viettel - 400 Khách", qty: 2, location: "Ecopark Hưng Yên" }
    ],
    image: "https://images.unsplash.com/photo-1516216628859-9bcceabb84ca?w=400&auto=format&fit=crop&q=80",
    invoiceUrl: "https://images.unsplash.com/photo-1554415707-9e4966a604f7?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 4500000,
    purchaseDate: "2026-07-20",
    purchaseVendor: "Xưởng Sản Xuất Dây Thừng Nam Định",
    purchasePrice: 4500000
  },
  {
    id: "A003",
    code: "A-003",
    name: "Thuyền phao đồng đội 6 người dài 4m",
    type: "Khấu hao",
    category: "Đồ hơi",
    unit: "Chiếc",
    specs: "Bạt PVC 3 lớp chuyên dụng chèo cạn & chèo hồ nước, 2 ống phao thân chính và 3 thanh ngang ngồi",
    purpose: "Team building, Đua thuyền nước và trên cạn",
    warehouseId: "WH-HD",
    warehouseName: "Kho Đồ Hơi Hà Đông",
    minStock: 4,
    ready: 8,
    inUse: 4,
    broken: 0,
    shelves: [
      { shelf: "Kệ Thuyền B1", tier: "1", qty: 8 }
    ],
    brokenLocations: [],
    currentPrograms: [
      { programId: "PROG-2026-01", programName: "Teambuilding FPT Software - 600 Khách", qty: 4, location: "Bãi Cháy, Hạ Long" }
    ],
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format&fit=crop&q=80",
    invoiceUrl: "https://images.unsplash.com/photo-1554415707-9e4966a604f7?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 12000000,
    purchaseDate: "2026-05-10",
    purchaseVendor: "Tổng Đại Lý Thuyền Phao Biển Đông",
    purchasePrice: 12000000
  },
  {
    id: "A004",
    code: "A-004",
    name: "Máy thổi khí công suất lớn 1500W",
    type: "Khấu hao",
    category: "Dụng cụ/Máy móc/Phương tiện",
    unit: "Chiếc",
    specs: "Máy thổi ly tâm vỏ nhựa chống giật công suất 1500W, điện 220V, áp suất gió 2.1kPa",
    purpose: "Bơm đồ hơi sự kiện, cổng hơi, nhà hơi",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 3,
    ready: 10,
    inUse: 3,
    broken: 1,
    shelves: [
      { shelf: "Kệ Máy Điện D1", tier: "1", qty: 10 },
      { shelf: "Bàn kỹ thuật sửa chữa", tier: "Mặt sàn", qty: 1 }
    ],
    brokenLocations: [
      { shelf: "Bàn kỹ thuật sửa chữa", tier: "Mặt sàn", qty: 1, reason: "Kẹt cánh quạt, motor nóng bốc khói", photo: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&auto=format&fit=crop&q=80" }
    ],
    currentPrograms: [
      { programId: "PROG-2026-01", programName: "Teambuilding FPT Software - 600 Khách", qty: 2, location: "Bãi Cháy, Hạ Long" },
      { programId: "PROG-2026-03", programName: "Kickoff Sales Techcombank - 150 Khách", qty: 1, location: "Đồ Sơn, Hải Phòng" }
    ],
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=80",
    invoiceUrl: "https://images.unsplash.com/photo-1554415707-9e4966a604f7?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 3200000,
    purchaseDate: "2026-08-01",
    purchaseVendor: "Điện Cơ Toàn Phát Hà Nội",
    purchasePrice: 3200000
  },
  {
    id: "A005",
    code: "TH-001",
    name: "Găng tay bảo hộ teambuilding",
    type: "Tiêu hao",
    category: "Văn phòng phẩm",
    unit: "Đôi",
    specs: "Găng sợi len tráng cao su lòng bàn tay chống trầy xước dây kéo co",
    purpose: "Bảo hộ game kéo co, vượt dây chướng ngại vật",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 50,
    ready: 180,
    inUse: 60,
    broken: 0,
    shelves: [
      { shelf: "Thùng Vật Tư TH-01", tier: "1", qty: 180 }
    ],
    brokenLocations: [],
    currentPrograms: [
      { programId: "PROG-2026-02", programName: "Hội thao Tập đoàn Viettel - 400 Khách", qty: 60, location: "Ecopark Hưng Yên" }
    ],
    image: "https://images.unsplash.com/photo-1605518216938-7c31b7b14ad0?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 15000
  },
  {
    id: "A006",
    code: "A-005",
    name: "Cờ tiêu chuẩn đánh dấu 4 màu",
    type: "Khấu hao",
    category: "Đồ sự kiện",
    unit: "Chiếc",
    specs: "Cờ vải phi bóng 4 màu Đỏ-Vàng-Xanh Lá-Xanh Dương cán inox rút 2m",
    purpose: "Phân chia đội, vạch đích, cướp cờ",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 8,
    ready: 24,
    inUse: 8,
    broken: 0,
    shelves: [
      { shelf: "Ống Cờ Sảnh A", tier: "1", qty: 24 }
    ],
    brokenLocations: [],
    currentPrograms: [
      { programId: "PROG-2026-02", programName: "Hội thao Tập đoàn Viettel - 400 Khách", qty: 8, location: "Ecopark Hưng Yên" }
    ],
    image: "https://images.unsplash.com/photo-1508873696983-2df5293cb32f?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 120000
  },
  {
    id: "A007",
    code: "A-006",
    name: "Cầu phao hơi liên hoàn 15m",
    type: "Khấu hao",
    category: "Đồ hơi",
    unit: "Bộ",
    specs: "Kích thước 15x3x2.5m, bạt PVC 0.95mm gia cố 4 khoang hơi độc lập",
    purpose: "Vận động trường biển, thử thách thể lực công ty",
    warehouseId: "WH-HD",
    warehouseName: "Kho Đồ Hơi Hà Đông",
    minStock: 1,
    ready: 2,
    inUse: 0,
    broken: 1,
    shelves: [
      { shelf: "Bục Phao Lớn P01", tier: "Mặt sàn", qty: 2 },
      { shelf: "Khu vực Chờ Vá Hơi", tier: "Mặt sàn", qty: 1 }
    ],
    brokenLocations: [
      { shelf: "Khu vực Chờ Vá Hơi", tier: "Mặt sàn", qty: 1, reason: "Thủng rách vách bên do va quẹt cọc sắt bãi biển", photo: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400&auto=format&fit=crop&q=80" }
    ],
    currentPrograms: [],
    image: "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 48000000
  },
  {
    id: "A008",
    code: "A-007",
    name: "Dây thừng kéo cố định bánh xe 20m",
    type: "Khấu hao",
    category: "Game tự chế",
    unit: "Cuộn",
    specs: "Dây bện dù 16mm lõi chịu lực 2 tấn, móc carabiner thép không gỉ 2 đầu",
    purpose: "Kéo bánh xe, neo giữ cổng hơi chống gió",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 6,
    ready: 16,
    inUse: 4,
    broken: 0,
    shelves: [
      { shelf: "Kệ Dây D02", tier: "2", qty: 16 }
    ],
    brokenLocations: [],
    currentPrograms: [
      { programId: "PROG-2026-01", programName: "Teambuilding FPT Software - 600 Khách", qty: 4, location: "Bãi Cháy, Hạ Long" }
    ],
    image: "https://images.unsplash.com/photo-1516216628859-9bcceabb84ca?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 450000
  },
  {
    id: "A009",
    code: "A-008",
    name: "Thảm cỏ nhân tạo lót chân phao 20x2m",
    type: "Khấu hao",
    category: "Trang trí",
    unit: "Tấm",
    specs: "Cỏ sân vườn 2cm chống trầy xước đáy phao, kích thước 2x20m",
    purpose: "Lót bảo vệ đồ hơi trên nền bê tông/sỏi đá",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 2,
    ready: 4,
    inUse: 2,
    broken: 0,
    shelves: [
      { shelf: "Kệ Bạt Cuộn Sân Sau", tier: "1", qty: 4 }
    ],
    brokenLocations: [],
    currentPrograms: [
      { programId: "PROG-2026-02", programName: "Hội thao Tập đoàn Viettel - 400 Khách", qty: 2, location: "Ecopark Hưng Yên" }
    ],
    image: "https://images.unsplash.com/photo-1558904541-efa8c4a08931?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 2800000
  },
  {
    id: "A010",
    code: "A-009",
    name: "Mái chèo nhựa composite siêu nhẹ",
    type: "Khấu hao",
    category: "Game tự chế",
    unit: "Chiếc",
    specs: "Cán hợp kim nhôm sơn tĩnh điện, lưỡi nhựa chịu lực dẻo dai",
    purpose: "Đua thuyền phao trên cạn & chèo sup",
    warehouseId: "WH-HD",
    warehouseName: "Kho Đồ Hơi Hà Đông",
    minStock: 10,
    ready: 24,
    inUse: 12,
    broken: 2,
    shelves: [
      { shelf: "Giá Treo Mái Chèo H1", tier: "1", qty: 24 },
      { shelf: "Khu vực Đồ Hỏng Kho Hà Đông", tier: "Mặt sàn", qty: 2 }
    ],
    brokenLocations: [
      { shelf: "Khu vực Đồ Hỏng Kho Hà Đông", tier: "Mặt sàn", qty: 2, reason: "Gãy cán nhôm do dẫm phải lúc đua cạn", photo: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format&fit=crop&q=80" }
    ],
    currentPrograms: [
      { programId: "PROG-2026-01", programName: "Teambuilding FPT Software - 600 Khách", qty: 12, location: "Bãi Cháy, Hạ Long" }
    ],
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 350000
  },
  {
    id: "A011",
    code: "A-010",
    name: "Loa kéo di động công suất khủng 800W",
    type: "Khấu hao",
    category: "Dụng cụ/Máy móc/Phương tiện",
    unit: "Chiếc",
    specs: "Loa bass 40 kèm 2 micro không dây UHF, ắc quy 8-10 tiếng, kết nối Bluetooth",
    purpose: "Phục vụ âm thanh hoạt náo bãi biển, dã ngoại",
    warehouseId: "WH-LB",
    warehouseName: "Kho Thiết Bị Long Biên",
    minStock: 2,
    ready: 4,
    inUse: 2,
    broken: 1,
    shelves: [
      { shelf: "Phòng Âm Thanh", tier: "1", qty: 4 },
      { shelf: "Kệ Kiểm Tra Âm Thanh", tier: "1", qty: 1 }
    ],
    brokenLocations: [
      { shelf: "Kệ Kiểm Tra Âm Thanh", tier: "1", qty: 1, reason: "Hỏng micro không dây số 2, rè loa treble", photo: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&auto=format&fit=crop&q=80" }
    ],
    currentPrograms: [
      { programId: "PROG-2026-03", programName: "Kickoff Sales Techcombank - 150 Khách", qty: 2, location: "Đồ Sơn, Hải Phòng" }
    ],
    image: "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 6500000
  },
  {
    id: "A012",
    code: "A-011",
    name: "Áo lưới chia đội teambuilding 4 màu",
    type: "Khấu hao",
    category: "Trang phục",
    unit: "Chiếc",
    specs: "Chất liệu thun gai lỗ kim thoáng khí, màu Cam/Xanh chuối/Đỏ/Vàng, bo thun sườn",
    purpose: "Chia đội nhận diện người chơi",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 100,
    ready: 400,
    inUse: 200,
    broken: 0,
    shelves: [
      { shelf: "Tủ Áo Đội", tier: "1", qty: 400 }
    ],
    brokenLocations: [],
    currentPrograms: [
      { programId: "PROG-2026-02", programName: "Hội thao Tập đoàn Viettel - 400 Khách", qty: 200, location: "Ecopark Hưng Yên" }
    ],
    image: "https://images.unsplash.com/photo-1523381294911-8d3cead13475?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 25000
  },
  {
    id: "A013",
    code: "A-012",
    name: "Cuộn dây điện nguồn 20m",
    type: "Khấu hao",
    category: "Dụng cụ/Máy móc/Phương tiện",
    unit: "Cuộn",
    specs: "Dây đồng bọc cao su chịu tải 2x2.5mm kèm rulo cuộn và phích cắm đúc chống nước",
    purpose: "Cấp nguồn máy thổi khí, âm thanh ngoài trời",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    minStock: 5,
    ready: 15,
    inUse: 5,
    broken: 0,
    shelves: [
      { shelf: "Kệ Điện D01", tier: "2", qty: 15 }
    ],
    brokenLocations: [],
    currentPrograms: [],
    image: "https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=400&auto=format&fit=crop&q=80",
    invoiceCost: 450000
  }
];

// Programs: dates set with upcoming / current schedules relative to 2026-10-30
const INITIAL_PROGRAMS = [
  {
    id: "PROG-2026-01",
    name: "Teambuilding FPT Software - 600 Khách",
    location: "Bãi Cháy, Hạ Long, Quảng Ninh",
    startDate: "2026-10-30",
    endDate: "2026-11-02",
    status: "Đang vận hành",
    receivedAndChecked: true, // Đã kiểm nhận đồ thành công
    leader: "Trần Thị Bình",
    phone: "0987654321",
    totalItems: 28,
    props: [
      { itemId: "A001", comboId: "GAME-01", comboName: "Bộ Bánh Xe Khổng Lồ", name: "Bánh xe bạt PVC khổng lồ (D=2.2m)", unit: "Chiếc", qty: 4, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A004", comboId: "GAME-01", comboName: "Bộ Bánh Xe Khổng Lồ", name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", qty: 2, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A008", comboId: "GAME-01", comboName: "Bộ Bánh Xe Khổng Lồ", name: "Dây thừng kéo cố định bánh xe 20m", unit: "Cuộn", qty: 4, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A003", comboId: "GAME-04", comboName: "Bộ Đua Thuyền Phao Trên Cạn", name: "Thuyền phao đồng đội 6 người dài 4m", unit: "Chiếc", qty: 4, warehouseId: "WH-HD", warehouseName: "Kho Hà Đông" },
      { itemId: "A010", comboId: "GAME-04", comboName: "Bộ Đua Thuyền Phao Trên Cạn", name: "Mái chèo nhựa composite siêu nhẹ", unit: "Chiếc", qty: 12, warehouseId: "WH-HD", warehouseName: "Kho Hà Đông" },
      { itemId: "A004", comboId: "GAME-04", comboName: "Bộ Đua Thuyền Phao Trên Cạn", name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", qty: 2, warehouseId: "WH-HD", warehouseName: "Kho Hà Đông" }
    ]
  },
  {
    id: "PROG-2026-02",
    name: "Hội thao Tập đoàn Viettel - 400 Khách",
    location: "Khu đô thị Ecopark, Hưng Yên",
    startDate: "2026-10-30",
    endDate: "2026-10-31",
    status: "Đang vận hành",
    receivedAndChecked: false, // Chưa kiểm đồ khi nhận
    leader: "Nguyễn Văn An",
    phone: "0912345678",
    totalItems: 272,
    props: [
      { itemId: "A002", comboId: "GAME-02", comboName: "Bộ Kéo Co 4 Hướng Đỉnh Cao", name: "Dây thừng kéo co 4 hướng phi 32", unit: "Bộ", qty: 2, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A006", comboId: "GAME-02", comboName: "Bộ Kéo Co 4 Hướng Đỉnh Cao", name: "Cờ tiêu chuẩn đánh dấu 4 màu", unit: "Chiếc", qty: 8, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A005", comboId: "GAME-02", comboName: "Bộ Kéo Co 4 Hướng Đỉnh Cao", name: "Găng tay bảo hộ teambuilding", unit: "Đôi", qty: 60, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A009", comboId: null, comboName: null, name: "Thảm cỏ nhân tạo lót chân phao 20x2m", unit: "Tấm", qty: 2, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A012", comboId: null, comboName: null, name: "Áo lưới chia đội teambuilding 4 màu", unit: "Chiếc", qty: 200, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" }
    ]
  },
  {
    id: "PROG-2026-03",
    name: "Kickoff Sales Techcombank - 150 Khách",
    location: "Khu du lịch Đồ Sơn, Hải Phòng",
    startDate: "2026-10-30",
    endDate: "2026-11-01",
    status: "Đang vận hành",
    receivedAndChecked: false, // Chưa kiểm đồ khi nhận
    leader: "Lê Hoàng Nam",
    phone: "0905123456",
    totalItems: 3,
    props: [
      { itemId: "A004", comboId: null, comboName: null, name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", qty: 1, warehouseId: "WH-MD", warehouseName: "Kho Mỹ Đình" },
      { itemId: "A011", comboId: null, comboName: null, name: "Loa kéo di động công suất khủng 800W", unit: "Chiếc", qty: 2, warehouseId: "WH-LB", warehouseName: "Kho Long Biên" }
    ]
  },
  {
    id: "PROG-2026-04",
    name: "Family Day Ngân Hàng MB Bank - 500 Khách",
    location: "Asean Resort, Thạch Thất, Hà Nội",
    startDate: "2026-11-05",
    endDate: "2026-11-06",
    status: "Chuẩn bị tới",
    receivedAndChecked: false,
    leader: "Trần Thị Bình",
    phone: "0987654321",
    totalItems: 0,
    props: []
  },
  // Past program (Already ended before 2026-10-30, should NOT appear in suggestion list)
  {
    id: "PROG-2026-PAST",
    name: "Gala Dinner Tân Á Đại Thành (Đã kết thúc)",
    location: "Trung tâm Hội nghị Quốc gia, Hà Nội",
    startDate: "2026-10-20",
    endDate: "2026-10-22",
    status: "Đã hoàn thành",
    receivedAndChecked: true,
    leader: "Lê Hoàng Nam",
    phone: "0905123456",
    totalItems: 0,
    props: []
  }
];

// Phiếu chuẩn bị đồ chờ gom hàng ra Vị trí chuẩn bị đồ
const INITIAL_PREP_SLIPS = [
  {
    id: "PREP-20261030-01",
    code: "CB_20261030_01",
    tourId: "PROG-2026-02",
    tourName: "Hội thao Tập đoàn Viettel - 400 Khách",
    location: "Khu đô thị Ecopark, Hưng Yên",
    eventDate: "2026-10-31",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    status: "PENDING_STAGING", // 'PENDING_STAGING' (Chờ gom đồ) | 'STAGED' (Đã gom ra vị trí chuẩn bị)
    stagedPhoto: null,
    stagedAt: null,
    items: [
      { name: "Dây thừng kéo co 4 hướng phi 32", qty: 2, unit: "Bộ", shelf: "Kệ Game A1", tier: "1" },
      { name: "Cờ tiêu chuẩn đánh dấu 4 màu", qty: 8, unit: "Chiếc", shelf: "Ống Cờ Sảnh A", tier: "1" },
      { name: "Găng tay bảo hộ teambuilding", qty: 60, unit: "Đôi", shelf: "Thùng Vật Tư TH-01", tier: "1" },
      { name: "Thảm cỏ nhân tạo lót chân phao 20x2m", qty: 2, unit: "Tấm", shelf: "Kệ Bạt Cuộn Sân Sau", tier: "1" }
    ],
    note: "Gom hàng trước 16h để kiểm đếm trước khi xe tải tới nhận."
  },
  {
    id: "PREP-20261030-02",
    code: "CB_20261030_02",
    tourId: "PROG-2026-03",
    tourName: "Kickoff Sales Techcombank - 150 Khách",
    location: "Khu du lịch Đồ Sơn, Hải Phòng",
    eventDate: "2026-11-01",
    warehouseId: "WH-MD",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    status: "PENDING_STAGING",
    stagedPhoto: null,
    stagedAt: null,
    items: [
      { name: "Máy thổi khí công suất lớn 1500W", qty: 1, unit: "Chiếc", shelf: "Kệ Máy Điện D1", tier: "1" },
      { name: "Cuộn dây điện nguồn 20m", qty: 1, unit: "Cuộn", shelf: "Kệ Điện D01", tier: "2" },
      { name: "Loa kéo di động công suất khủng 800W", qty: 1, unit: "Chiếc", shelf: "Phòng Âm Thanh", tier: "1" }
    ],
    note: "Đóng gói cẩn thận thiết bị âm thanh và dây điện."
  }
];

// Alias for backwards compatibility
const INITIAL_TOURS = INITIAL_PROGRAMS;

const INITIAL_DOCUMENTS = [
  {
    id: "DOC-001",
    code: "XK_20261028_01",
    type: "Xuất kho",
    badgeColor: "blue",
    tourName: "Teambuilding FPT Software - 600 Khách",
    location: "Bãi Cháy, Hạ Long",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    creator: "Nguyễn Văn An",
    createdAt: "2026-10-28 08:30",
    itemsCount: 10,
    items: [
      { name: "Bánh xe bạt PVC khổng lồ (D=2.2m)", unit: "Chiếc", qty: 4, shelf: "Giá Hơi 01 - Tầng 1" },
      { name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", qty: 2, shelf: "Kệ Máy Điện D1 - Tầng 1" },
      { name: "Dây thừng kéo cố định bánh xe 20m", unit: "Cuộn", qty: 4, shelf: "Kệ Dây D02 - Tầng 2" }
    ],
    photos: [
      "https://images.unsplash.com/photo-1511578314322-379afb476865?w=500&auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80"
    ],
    note: "Đã kiểm tra đủ áp suất bánh xe và máy thổi chạy êm trước khi đóng xe tải 2.5T."
  },
  {
    id: "DOC-002",
    code: "XK_20261028_02",
    type: "Xuất kho",
    badgeColor: "blue",
    tourName: "Teambuilding FPT Software - 600 Khách",
    location: "Bãi Cháy, Hạ Long",
    warehouseName: "Kho Đồ Hơi Hà Đông",
    creator: "Trần Văn Bình",
    createdAt: "2026-10-28 09:15",
    itemsCount: 18,
    items: [
      { name: "Thuyền phao đồng đội 6 người dài 4m", unit: "Chiếc", qty: 4, shelf: "Kệ Thuyền B1 - Tầng 1" },
      { name: "Mái chèo nhựa composite siêu nhẹ", unit: "Chiếc", qty: 12, shelf: "Giá Treo Mái Chèo H1 - Tầng 1" },
      { name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", qty: 2, shelf: "Kệ Máy Điện D1 - Tầng 1" }
    ],
    photos: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=500&auto=format&fit=crop&q=80"
    ],
    note: "Xuất theo xe tải số 29C-889.21 đi thẳng Hạ Long."
  },
  {
    id: "DOC-003",
    code: "NK_20261027_01",
    type: "Nhập hoàn trả",
    badgeColor: "emerald",
    tourName: "Ngày hội Gia Đình MB Bank - 300 Khách",
    location: "Asean Resort, Thạch Thất",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    creator: "Nguyễn Văn An",
    createdAt: "2026-10-27 17:45",
    itemsCount: 15,
    items: [
      { name: "Dây thừng kéo co 4 hướng phi 32", unit: "Bộ", qty: 2, shelf: "Kệ Game A1 - Tầng 1" },
      { name: "Bánh xe bạt PVC khổng lồ (D=2.2m)", unit: "Chiếc", qty: 2, shelf: "Giá Hơi 01 - Tầng 1" }
    ],
    brokenItems: [
      { name: "Dây thừng kéo co 4 hướng phi 32", qty: 1, shelf: "Khu vực Đồ Hỏng Kho Mỹ Đình - Tầng 1", reason: "Đứt vòng bện đầu nhánh 3", photo: "https://images.unsplash.com/photo-1516216628859-9bcceabb84ca?w=400&auto=format&fit=crop&q=80" }
    ],
    photos: [
      "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80"
    ],
    note: "Thu hồi nguyên vẹn ngoại trừ 1 bộ dây thừng bị sờn rách lõi cần sửa."
  },
  {
    id: "DOC-004",
    code: "DC_20261026_01",
    type: "Điều chuyển",
    badgeColor: "purple",
    tourName: "Chuyển từ CT Hạ Long sang CT Đồ Sơn",
    location: "Hiện trường Bãi Cháy -> Đồ Sơn",
    warehouseName: "Hiện trường sự kiện",
    creator: "Trần Thị Bình",
    createdAt: "2026-10-26 14:20",
    itemsCount: 1,
    items: [
      { name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", qty: 1, shelf: "Bàn giao xe khách Hải Phòng" }
    ],
    photos: [
      "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=80"
    ],
    note: "Điều chuyển khẩn cấp hỗ trợ sự kiện Kickoff Techcombank. Bên nhận: Lê Hoàng Nam đã xác nhận."
  },
  {
    id: "DOC-005",
    code: "SC_20261025_01",
    type: "Sửa chữa",
    badgeColor: "amber",
    tourName: "Sửa chữa nội bộ định kỳ",
    location: "Xưởng kỹ thuật Kho Mỹ Đình",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    creator: "Lê Hoàng Nam",
    createdAt: "2026-10-25 10:00",
    itemsCount: 1,
    items: [
      { name: "Bánh xe bạt PVC khổng lồ (D=2.2m)", unit: "Chiếc", qty: 1, shelf: "Giá Hơi 01 - Tầng 1" }
    ],
    photos: [
      "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&auto=format&fit=crop&q=80"
    ],
    note: "Đã dán vá lại vết thủng 5cm bằng bạt chuyên dụng và keo nhiệt, thử áp suất 48h đạt chuẩn."
  }
];

const INITIAL_REPAIR_ORDERS = [
  {
    id: "REP-01",
    code: "SC_OUT_01",
    itemId: "A004",
    itemName: "Máy thổi khí công suất lớn 1500W",
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    status: "Đang sửa ngoài",
    vendorName: "Cơ điện & Máy thổi Tuấn Vũ",
    vendorPhone: "0945889900",
    sentDate: "2026-10-27",
    estimatedCost: 350000,
    specs: "Thay bạc đạn quạt ly tâm, quấn lại cuộn dây motor",
    photoSent: "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400&auto=format&fit=crop&q=80",
    creator: "Lê Hoàng Nam"
  }
];

const INITIAL_NOTIFICATIONS = [
  {
    id: "NOTIF-001",
    type: "APPROVAL_REQUIRED",
    docCode: "XK_20261028_02",
    title: "Yêu cầu duyệt xuất kho",
    message: "Trần Văn Bình đã lập phiếu xuất XK_20261028_02 cho Teambuilding FPT Software (18 món).",
    actor: "Trần Văn Bình",
    actorAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    status: "PENDING",
    createdAt: "2026-10-30 08:30"
  },
  {
    id: "NOTIF-002",
    type: "FIELD_TRANSFER_CHECK",
    transferCode: "DC_20261026_01",
    title: "Đạo cụ điều chuyển đã tới",
    message: "Chương trình Hạ Long đã điều chuyển 1 máy thổi khí sang Kickoff Techcombank (Người nhận: Lê Hoàng Nam).",
    actor: "Trần Thị Bình",
    actorAvatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
    status: "READ",
    createdAt: "2026-10-29 14:20"
  }
];

const INITIAL_FIELD_TRANSFERS = [
  {
    id: "FT-001",
    code: "DC_20261026_01",
    sourceTourId: "TOUR-01",
    sourceTourName: "Teambuilding FPT Software - 600 Khách",
    senderName: "Trần Thị Bình",
    destTourId: "TOUR-03",
    destTourName: "Kickoff Sales Techcombank - 150 Khách",
    receiverName: "Lê Hoàng Nam",
    status: "PENDING_CHECK",
    createdAt: "2026-10-29 14:20",
    items: [
      {
        name: "Máy thổi khí công suất lớn 1500W",
        unit: "Chiếc",
        sentQty: 1,
        receivedQty: 1,
        isTicked: false
      }
    ]
  }
];
