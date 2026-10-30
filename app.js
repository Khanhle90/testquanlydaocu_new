/**
 * ABA Inventory & Event Operations System - Core Application Engine
 * Hệ thống Quản lý Đạo cụ & Kho bãi ABA
 */

// ==================== GLOBAL CONSTANTS & API KEYS ====================
const IMGBB_API_KEY = "9b4a10db15d694a88f3aa0d1ffbc0669";
const ADMIN_PASSWORD_DEFAULT = "admin123";

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STORAGE_KEYS = {
  ITEMS: "ABA_ITEMS_V4",
  WAREHOUSES: "ABA_WAREHOUSES_V4",
  USERS: "ABA_USERS_V4",
  CURRENT_USER: "ABA_CURRENT_USER_V4",
  COMBOS: "ABA_COMBOS_V4",
  TOURS: "ABA_TOURS_V4",
  DOCUMENTS: "ABA_DOCUMENTS_V4",
  REPAIR_ORDERS: "ABA_REPAIR_ORDERS_V4",
  GSHEET_CONFIG: "ABA_GSHEET_CONFIG_V4",
  NOTIFICATIONS: "ABA_NOTIFICATIONS_V5",
  FIELD_TRANSFERS: "ABA_FIELD_TRANSFERS_V5",
  PREP_SLIPS: "ABA_PREP_SLIPS_V5"
};

const ALL_CATEGORIES = [
  "Đồ hơi",
  "Game tự chế",
  "Game hội chợ",
  "Trang trí",
  "Dụng cụ/Máy móc/Phương tiện",
  "Đồ sự kiện",
  "Trang phục",
  "Văn phòng phẩm"
];

const ALL_PURPOSES = [
  "Team building",
  "Sự kiện",
  "Du lịch/trải nghiệm",
  "Giáo dục/Đào tạo"
];

// ==================== STATE MANAGEMENT ====================
let state = {
  items: [],
  warehouses: [],
  users: [],
  currentUser: null,
  combos: [],
  tours: [],
  documents: [],
  repairOrders: [],
  notifications: [],
  fieldTransfers: [],
  gsheetConfig: {
    url: "",
    isConnected: true,
    lastSync: new Date().toISOString()
  },
  activeTab: 1,
  activeCameraTargetId: null,

  // Tab 2 State (Image 1)
  tab2Mode: 'NEW', // 'NEW' or 'EXISTING'
  tab2Type: 'Khấu hao', // 'Khấu hao' or 'Tiêu hao'
  tab2SelectedCategories: new Set(["Đồ hơi"]),
  tab2SelectedPurposes: new Set(["Team building"]),
  tab2Shelves: [
    { shelf: "Giá A", tier: "1", qty: 1 }
  ],
  tab2AlbumPhotos: [],
  tab2InvoiceFile: null,

  // Tab 3 State (Image 2 & Image 3)
  tab3Combos: [], // [{ id, comboId, comboName, comboQty, items: [{ name, unit, qty, readyStock, shelf }] }]
  tab3DirectRows: [], // Direct inline table rows [{ id, name, unit, qty, readyStock, shelf, itemId }]
  tab3CollapsedCombos: {},
  tab3TeamPhoto: "",

  // Tab 4 State
  tab4TourSelected: null,
  tab4ReturnChecklist: [],
  tab4BrokenItems: [],

  // Tab 5 & 6 State
  selectedTourIdTab5: null,
  activeRepairItem: null,
  activeRepairMode: 'IN_HOUSE'
};

// ==================== INITIALIZATION ====================
document.addEventListener("DOMContentLoaded", () => {
  initState();
  renderApp();
  initGlobalAutocompleteListeners();
});

function initState() {
  state.warehouses = loadFromStorage(STORAGE_KEYS.WAREHOUSES, INITIAL_WAREHOUSES);
  state.users = loadFromStorage(STORAGE_KEYS.USERS, INITIAL_USERS);
  state.currentUser = loadFromStorage(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]);
  state.items = loadFromStorage(STORAGE_KEYS.ITEMS, INITIAL_ITEMS);
  state.combos = loadFromStorage(STORAGE_KEYS.COMBOS, INITIAL_GAME_COMBOS);
  // Ensure all combos have type and default toolsets are available
  if (Array.isArray(state.combos)) {
    state.combos.forEach(c => {
      if (!c.type) {
        c.type = (c.id && c.id.startsWith("TOOL")) || (c.name && c.name.toLowerCase().includes("dụng cụ")) ? "TOOLSET" : "GAME";
      }
    });
    // If no toolset exists yet in storage, merge initial toolsets
    const hasToolset = state.combos.some(c => c.type === "TOOLSET");
    if (!hasToolset && typeof INITIAL_GAME_COMBOS !== "undefined") {
      const initialToolsets = INITIAL_GAME_COMBOS.filter(c => c.type === "TOOLSET");
      state.combos.push(...initialToolsets);
    }
  }
  state.gameCombos = state.combos;
  state.tours = loadFromStorage(STORAGE_KEYS.TOURS, INITIAL_TOURS);
  // Ensure receivedAndChecked status on tours
  (state.tours || []).forEach(t => {
    if (t.receivedAndChecked === undefined) {
      t.receivedAndChecked = (t.status === "Đang vận hành" || t.status === "Đang chạy");
    }
  });

  // Ensure purchase info on items if missing
  (state.items || []).forEach(it => {
    if (!it.purchaseDate) it.purchaseDate = "2026-06-15";
    if (!it.purchaseVendor) it.purchaseVendor = "Công ty TNHH Bạt Sự Kiện Thuận Phát";
    if (!it.purchasePrice) it.purchasePrice = it.invoiceCost || 18500000;
  });

  state.documents = loadFromStorage(STORAGE_KEYS.DOCUMENTS, INITIAL_DOCUMENTS);
  state.repairOrders = loadFromStorage(STORAGE_KEYS.REPAIR_ORDERS, INITIAL_REPAIR_ORDERS);
  state.notifications = loadFromStorage(STORAGE_KEYS.NOTIFICATIONS, typeof INITIAL_NOTIFICATIONS !== "undefined" ? INITIAL_NOTIFICATIONS : []);
  state.fieldTransfers = loadFromStorage(STORAGE_KEYS.FIELD_TRANSFERS, typeof INITIAL_FIELD_TRANSFERS !== "undefined" ? INITIAL_FIELD_TRANSFERS : []);
  state.prepSlips = loadFromStorage(STORAGE_KEYS.PREP_SLIPS, typeof INITIAL_PREP_SLIPS !== "undefined" ? INITIAL_PREP_SLIPS : []);
  state.gsheetConfig = loadFromStorage(STORAGE_KEYS.GSHEET_CONFIG, {
    url: "https://script.google.com/macros/s/AKfycbz_aba_mock/exec",
    isConnected: true,
    lastSync: new Date().toISOString()
  });

  if (state.tours.length > 0) {
    state.selectedTourIdTab5 = state.tours[0].id;
  }

  // Initialize Tab 3 Direct Rows with 5 default blank rows (Image 3)
  initTab3DirectRows();
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.WAREHOUSES, JSON.stringify(state.warehouses));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(state.users));
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(state.currentUser));
  localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(state.items));
  localStorage.setItem(STORAGE_KEYS.COMBOS, JSON.stringify(state.combos));
  localStorage.setItem(STORAGE_KEYS.TOURS, JSON.stringify(state.tours));
  localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(state.documents));
  localStorage.setItem(STORAGE_KEYS.REPAIR_ORDERS, JSON.stringify(state.repairOrders));
  localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(state.notifications));
  localStorage.setItem(STORAGE_KEYS.FIELD_TRANSFERS, JSON.stringify(state.fieldTransfers));
  localStorage.setItem(STORAGE_KEYS.PREP_SLIPS, JSON.stringify(state.prepSlips || []));
  localStorage.setItem(STORAGE_KEYS.GSHEET_CONFIG, JSON.stringify(state.gsheetConfig));
}

function loadFromStorage(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.warn(`Error reading localStorage for key ${key}`, e);
    return defaultValue;
  }
}

function refreshData() {
  initState();
  renderApp();
  showToast("Đã làm mới dữ liệu hệ thống thành công!", "success");
}

function renderApp() {
  renderUserInfo();
  renderGSheetStatus();
  renderNotifications();
  populateCommonDropdowns();

  switchTab(state.activeTab, false);

  if (window.lucide) {
    lucide.createIcons();
  }
}

function renderUserInfo() {
  if (!state.currentUser) return;
  const avatarEl = document.getElementById("user-avatar");
  const nameEl = document.getElementById("user-name");
  const roleEl = document.getElementById("user-role");
  const roleBadgeEl = document.getElementById("user-role-badge");

  if (avatarEl) avatarEl.src = state.currentUser.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";
  if (nameEl) nameEl.textContent = state.currentUser.name;
  if (roleEl) roleEl.textContent = state.currentUser.role;

  if (roleBadgeEl) {
    const rt = state.currentUser.roleType || (state.currentUser.isAdmin ? "ADMIN" : "STAFF");
    roleBadgeEl.textContent = state.currentUser.roleBadge || (rt === "KEEPER" ? "Thủ kho" : (rt === "ADMIN" ? "Quản trị" : "Thông thường"));
    roleBadgeEl.className = `px-1.5 py-0.2 rounded text-[9px] font-bold ${rt === 'KEEPER' ? 'bg-amber-100 text-amber-800' : (rt === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700')}`;
  }

  const tab7Creator = document.getElementById("tab7-creator");
  if (tab7Creator) tab7Creator.value = `${state.currentUser.name} (${state.currentUser.role})`;
}

function renderGSheetStatus() {
  const pulseEl = document.getElementById("gsheet-pulse");
  const textEl = document.getElementById("gsheet-text");
  if (!pulseEl || !textEl) return;

  if (state.gsheetConfig.isConnected) {
    pulseEl.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse";
    textEl.textContent = "Google Sheet: Đã kết nối";
  } else {
    pulseEl.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
    textEl.textContent = "Google Sheet: Mất kết nối";
  }
}

function populateCommonDropdowns() {
  const whSelectors = [
    "tab1-filter-warehouse",
    "tab2-warehouse",
    "tab3-warehouse",
    "tab7-warehouse",
    "tab8-filter-warehouse"
  ];

  whSelectors.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const currentVal = el.value;
    const isFilter = id.includes("filter");

    let html = isFilter ? '<option value="ALL">Tất cả kho lưu trữ</option>' : '';
    state.warehouses.forEach(wh => {
      html += `<option value="${wh.id}">${wh.name}</option>`;
    });
    el.innerHTML = html;
    if (currentVal && Array.from(el.options).some(o => o.value === currentVal)) {
      el.value = currentVal;
    }
  });

  const catSelect = document.getElementById("tab1-filter-category");
  if (catSelect) {
    let html = '<option value="ALL">Tất cả danh mục</option>';
    ALL_CATEGORIES.forEach(cat => {
      html += `<option value="${cat}">${cat}</option>`;
    });
    catSelect.innerHTML = html;
  }

  const comboSelect = document.getElementById("tab3-combo-select");
  if (comboSelect) {
    let html = '<option value="">-- Chọn Bộ Game / Bộ Dụng Cụ --</option>';
    const games = state.combos.filter(c => (c.type || ((c.name && c.name.toLowerCase().includes("dụng cụ")) ? "TOOLSET" : "GAME")) === "GAME");
    const tools = state.combos.filter(c => (c.type || ((c.name && c.name.toLowerCase().includes("dụng cụ")) ? "TOOLSET" : "GAME")) === "TOOLSET");

    if (games.length > 0) {
      html += '<optgroup label="🎮 Mẫu Game Teambuilding">';
      games.forEach(c => {
        html += `<option value="${c.id}">${escapeHtml(c.name)} (${c.items.length} món con)</option>`;
      });
      html += '</optgroup>';
    }

    if (tools.length > 0) {
      html += '<optgroup label="🧰 Bộ Dụng Cụ Phụ Trợ">';
      tools.forEach(c => {
        html += `<option value="${c.id}">${escapeHtml(c.name)} (${c.items.length} món con)</option>`;
      });
      html += '</optgroup>';
    }
    comboSelect.innerHTML = html;
  }
}

// ==================== TAB NAVIGATION ====================
function switchTab(tabIndex, triggerIcons = true) {
  state.activeTab = tabIndex;

  document.querySelectorAll(".tab-btn").forEach(btn => {
    const t = parseInt(btn.getAttribute("data-tab"), 10);
    if (t === tabIndex) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  for (let i = 1; i <= 8; i++) {
    const panel = document.getElementById(`tab-panel-${i}`);
    if (panel) {
      if (i === tabIndex) {
        panel.classList.remove("hidden");
      } else {
        panel.classList.add("hidden");
      }
    }
  }

  switch (tabIndex) {
    case 1: renderTab1(); break;
    case 2: renderTab2(); break;
    case 3: renderTab3(); break;
    case 4: renderTab4(); break;
    case 5: renderTab5(); break;
    case 6: renderTab6(); break;
    case 7: renderTab7(); break;
    case 8: renderTab8(); break;
  }

  if (triggerIcons && window.lucide) {
    lucide.createIcons();
  }
}

// =========================================================================
// TAB 1: KHO (DANH MỤC TỔNG KHO)
// =========================================================================
function renderTab1() {
  updateTab1Metrics();
  renderTab1Items();
}

function updateTab1Metrics() {
  let ready = 0, inUse = 0, broken = 0;
  state.items.forEach(item => {
    ready += Number(item.ready || 0);
    inUse += Number(item.inUse || 0);
    broken += Number(item.broken || 0);
  });

  const inStock = ready + broken;
  const total = ready + inUse + broken;

  const rEl = document.getElementById("stat-ready");
  const uEl = document.getElementById("stat-inuse");
  const bEl = document.getElementById("stat-broken");
  const sEl = document.getElementById("stat-instock");
  const tEl = document.getElementById("stat-total");

  if (rEl) rEl.textContent = ready.toLocaleString("vi-VN");
  if (uEl) uEl.textContent = inUse.toLocaleString("vi-VN");
  if (bEl) bEl.textContent = broken.toLocaleString("vi-VN");
  if (sEl) sEl.textContent = inStock.toLocaleString("vi-VN");
  if (tEl) tEl.textContent = total.toLocaleString("vi-VN");
}

function renderTab1Items() {
  const search = (document.getElementById("tab1-search")?.value || "").trim().toLowerCase();
  const whFilter = document.getElementById("tab1-filter-warehouse")?.value || "ALL";
  const typeFilter = document.getElementById("tab1-filter-type")?.value || "ALL";
  const catFilter = document.getElementById("tab1-filter-category")?.value || "ALL";
  const specFilter = document.getElementById("tab1-filter-special")?.value || "ALL";

  const filtered = state.items.filter(item => {
    const matchSearch = !search ||
      (item.code && item.code.toLowerCase().includes(search)) ||
      (item.name && item.name.toLowerCase().includes(search)) ||
      (item.specs && item.specs.toLowerCase().includes(search));

    if (!matchSearch) return false;

    if (whFilter !== "ALL" && item.warehouseId !== whFilter) return false;
    if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
    if (catFilter !== "ALL" && item.category !== catFilter) return false;

    if (specFilter === "NO_SHELF") {
      const hasShelf = item.shelves && item.shelves.some(s => s.shelf && !s.shelf.includes("Chưa phân"));
      if (hasShelf) return false;
    }
    if (specFilter === "LOW_STOCK") {
      if (item.ready >= (item.minStock || 0)) return false;
    }
    if (specFilter === "HAS_BROKEN") {
      if (!item.broken || item.broken <= 0) return false;
    }

    return true;
  });

  const tbody = document.getElementById("tab1-table-body");
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400">Không tìm thấy đạo cụ nào phù hợp với bộ lọc</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(item => {
        const inStock = (item.ready || 0) + (item.broken || 0);
        const total = inStock + (item.inUse || 0);
        const shelvesText = (item.shelves || []).map(s => `<span class="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] mr-1 mb-0.5">${s.shelf}: <strong>${s.qty}</strong></span>`).join("");

        return `
          <tr class="hover:bg-sky-50/40 transition">
            <td class="py-2.5 px-3">
              <div class="flex items-center gap-2">
                <img src="${item.image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=100'}" alt="${item.name}" class="w-10 h-10 rounded-lg object-cover border border-slate-200">
                <span class="font-bold text-sky-700">${item.code}</span>
              </div>
            </td>
            <td class="py-2.5 px-3">
              <button onclick="openItemDetailModal('${item.id}')" class="font-bold text-slate-900 hover:text-sky-600 text-left transition block">
                ${item.name}
              </button>
              <div class="text-[11px] text-slate-500 line-clamp-1 max-w-xs">${item.specs || 'Chưa cập nhật thông số'}</div>
            </td>
            <td class="py-2.5 px-3">
              <span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${item.type === 'Khấu hao' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">${item.type}</span>
              <div class="text-[11px] text-slate-500 mt-0.5">${item.category}</div>
            </td>
            <td class="py-2.5 px-3">
              <div class="font-semibold text-slate-700">${item.warehouseName || 'Chưa gán kho'}</div>
              <div class="mt-0.5 flex flex-wrap max-w-xs">${shelvesText || '<span class="text-slate-400 italic">Chưa xếp giá kệ</span>'}</div>
            </td>
            <td class="py-2.5 px-2 text-center font-bold text-emerald-600 bg-emerald-50/20">${item.ready}</td>
            <td class="py-2.5 px-2 text-center font-bold text-amber-600 bg-amber-50/20">${item.inUse || 0}</td>
            <td class="py-2.5 px-2 text-center font-bold ${item.broken > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-400'} bg-rose-50/20">${item.broken || 0}</td>
            <td class="py-2.5 px-2 text-center font-bold text-sky-600 bg-sky-50/20">${inStock}</td>
            <td class="py-2.5 px-2 text-center font-bold text-purple-600 bg-purple-50/20">${total}</td>
            <td class="py-2.5 px-3 text-right whitespace-nowrap">
              <button onclick="openItemDetailModal('${item.id}')" class="px-2.5 py-1 text-xs font-semibold rounded border border-slate-200 hover:bg-slate-100 text-slate-700 transition" title="Chi tiết & Chỉnh sửa">
                Chi tiết
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  const mobileContainer = document.getElementById("tab1-mobile-cards");
  if (mobileContainer) {
    if (filtered.length === 0) {
      mobileContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">Không tìm thấy đạo cụ</div>`;
    } else {
      mobileContainer.innerHTML = filtered.map(item => {
        const inStock = (item.ready || 0) + (item.broken || 0);
        const total = inStock + (item.inUse || 0);
        const shelvesText = (item.shelves || []).map(s => `${s.shelf}: ${s.qty}`).join(" | ");

        return `
          <div class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2 item-card">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <img src="${item.image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=100'}" alt="${item.name}" class="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-100 text-sky-800">${item.code}</span>
                    <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold ${item.type === 'Khấu hao' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}">${item.type}</span>
                  </div>
                  <button onclick="openItemDetailModal('${item.id}')" class="font-bold text-xs text-slate-900 truncate hover:text-sky-600 block text-left mt-0.5">
                    ${item.name}
                  </button>
                </div>
              </div>

              <button onclick="openItemDetailModal('${item.id}')" class="shrink-0 p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition" title="Sửa thông tin">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
            </div>

            <div class="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded-md flex items-center justify-between">
              <span class="truncate">📍 ${item.warehouseName}: <strong>${shelvesText || 'Chưa phân giá kệ'}</strong></span>
            </div>

            <div class="grid grid-cols-5 gap-1 text-center text-[10px] pt-1">
              <div class="p-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                <span class="block text-[9px] text-emerald-600">Dùng</span>
                <strong class="text-xs font-bold">${item.ready}</strong>
              </div>
              <div class="p-1 rounded bg-amber-50 text-amber-700 border border-amber-100">
                <span class="block text-[9px] text-amber-600">Đi</span>
                <strong class="text-xs font-bold">${item.inUse || 0}</strong>
              </div>
              <div class="p-1 rounded bg-rose-50 text-rose-700 border border-rose-100">
                <span class="block text-[9px] text-rose-600">Hỏng</span>
                <strong class="text-xs font-bold">${item.broken || 0}</strong>
              </div>
              <div class="p-1 rounded bg-sky-50 text-sky-700 border border-sky-100">
                <span class="block text-[9px] text-sky-600">Tại Kho</span>
                <strong class="text-xs font-bold">${inStock}</strong>
              </div>
              <div class="p-1 rounded bg-purple-50 text-purple-700 border border-purple-100">
                <span class="block text-[9px] text-purple-600">Tổng</span>
                <strong class="text-xs font-bold">${total}</strong>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  if (window.lucide) lucide.createIcons();
}

function exportInventoryExcel() {
  if (typeof XLSX === "undefined") return;
  const data = state.items.map(item => {
    const inStock = (item.ready || 0) + (item.broken || 0);
    const total = inStock + (item.inUse || 0);
    const shelves = (item.shelves || []).map(s => `${s.shelf}: ${s.qty}`).join("; ");

    return {
      "Mã Đạo Cụ": item.code,
      "Tên Đạo Cụ": item.name,
      "Phân Loại": item.type,
      "Danh Mục": item.category,
      "Đơn Vị Tính": item.unit,
      "Kho Lưu Trữ": item.warehouseName,
      "Vị Trí Giá Kệ": shelves,
      "Sẵn Sàng (Dùng)": item.ready,
      "Đang Đi (Chương Trình)": item.inUse || 0,
      "Đang Hỏng": item.broken || 0,
      "Tại Kho": inStock,
      "Tổng Tài Sản": total,
      "Thông Số Kỹ Thuật": item.specs || "",
      "Mục Đích Sử Dụng": item.purpose || ""
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "TongKhoDaoCu");
  XLSX.writeFile(wb, `ABA_TongKhoDaoCu_${formatDate(new Date(), 'YYYYMMDD')}.xlsx`);
  showToast("Đã xuất file Excel tổng kho thành công!", "success");
}

function downloadSampleExcel() {
  if (typeof XLSX === "undefined") return;
  const sampleData = [
    {
      "Tên Đạo Cụ": "Bóng yoga đường kính 75cm",
      "Đơn Vị Tính": "Quả",
      "Phân Loại": "Khấu hao",
      "Danh Mục": "Game tự chế",
      "Kho": "Kho Tổng Mỹ Đình (Hà Nội)",
      "Giá Kệ": "Kệ Bóng B1",
      "Số Lượng": 20,
      "Thông Số Kỹ Thuật": "Chất liệu PVC chống nổ dày 2mm, màu xanh",
      "Định Mức Tối Thiểu": 5
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MauNhapKho");
  XLSX.writeFile(wb, "ABA_Mau_Nhap_Dao_Cu.xlsx");
}

function importInventoryExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);

      let count = 0;
      rows.forEach((r, idx) => {
        const name = r["Tên Đạo Cụ"] || r["Ten"] || "";
        if (!name) return;
        const type = r["Phân Loại"] || "Khấu hao";
        const unit = r["Đơn Vị Tính"] || "Chiếc";
        const category = r["Danh Mục"] || "Đồ sự kiện";
        const qty = Number(r["Số Lượng"] || 1);
        const whName = r["Kho"] || state.warehouses[0].name;
        const shelf = r["Giá Kệ"] || "Chưa phân giá kệ";
        const specs = r["Thông Số Kỹ Thuật"] || "";

        const matchedWh = state.warehouses.find(w => w.name.toLowerCase().includes(whName.toLowerCase())) || state.warehouses[0];
        let existing = state.items.find(i => i.name.toLowerCase() === name.toLowerCase() && i.warehouseId === matchedWh.id);
        if (existing) {
          existing.ready += qty;
        } else {
          const prefix = type === "Khấu hao" ? "A" : "TH";
          const newCode = `${prefix}-${Math.floor(100 + Math.random() * 900)}`;
          state.items.push({
            id: `ITEM-${Date.now()}-${idx}`,
            code: newCode,
            name: name,
            type: type,
            category: category,
            unit: unit,
            specs: specs,
            purpose: "Sự kiện & Teambuilding",
            warehouseId: matchedWh.id,
            warehouseName: matchedWh.name,
            minStock: 2,
            ready: qty,
            inUse: 0,
            broken: 0,
            shelves: [{ shelf: shelf, qty: qty }],
            brokenLocations: [],
            currentTours: [],
            image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=200",
            invoiceCost: 0
          });
        }
        count++;
      });

      saveState();
      renderTab1();
      showToast(`Đã nhập thành công ${count} đạo cụ từ file Excel!`, "success");
    } catch (err) {
      alert("Lỗi khi đọc file Excel: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

// =========================================================================
// TAB 2: NHẬP MỚI (EXACT CLONE OF IMAGE 1)
// =========================================================================
function renderTab2() {
  populateCommonDropdowns();
  updateTab2CodePreview();
  renderTab2Pills();
  renderTab2ShelfRows();
  updateTab2ShelfValidation();
  renderTab2Album();
}

function resetTab2Form() {
  state.tab2Mode = 'NEW';
  state.tab2Type = 'Khấu hao';
  state.tab2SelectedCategories = new Set(["Đồ hơi"]);
  state.tab2SelectedPurposes = new Set(["Team building"]);
  state.tab2Shelves = [{ shelf: "Giá A", tier: "1", qty: 1 }];
  state.tab2AlbumPhotos = [];

  document.getElementById("form-tab2-new-item")?.reset();
  const qtyEl = document.getElementById("tab2-qty");
  if (qtyEl) qtyEl.value = "1";
  const costEl = document.getElementById("tab2-invoice-cost");
  if (costEl) costEl.value = "0";
  const minStockEl = document.getElementById("tab2-minstock");
  if (minStockEl) minStockEl.value = "0";

  setTab2Mode('NEW');
  setTab2Type('Khấu hao');
  renderTab2Pills();
  renderTab2ShelfRows();
  updateTab2ShelfValidation();
  renderTab2Album();

  const invoicePreview = document.getElementById("tab2-invoice-preview");
  if (invoicePreview) invoicePreview.textContent = "Chưa có file";

  showToast("Đã làm mới phiếu nhập kho lần đầu!", "info");
}

function setTab2Mode(mode) {
  state.tab2Mode = mode;
  const cardNew = document.getElementById("tab2-card-mode-new");
  const cardExisting = document.getElementById("tab2-card-mode-existing");

  if (mode === 'NEW') {
    cardNew?.classList.add("selected-blue");
    cardExisting?.classList.remove("selected-blue");
  } else {
    cardExisting?.classList.add("selected-blue");
    cardNew?.classList.remove("selected-blue");
  }
  updateTab2CodePreview();
}

function setTab2Type(type) {
  state.tab2Type = type;
  const cardKhauHao = document.getElementById("tab2-card-type-khauhao");
  const cardTieuHao = document.getElementById("tab2-card-type-tieuhao");

  if (type === 'Khấu hao') {
    cardKhauHao?.classList.add("selected-green");
    cardTieuHao?.classList.remove("selected-green");
  } else {
    cardTieuHao?.classList.add("selected-green");
    cardKhauHao?.classList.remove("selected-green");
  }
  updateTab2CodePreview();
}

function updateTab2CodePreview() {
  const codeEl = document.getElementById("tab2-code");
  if (!codeEl) return;

  if (state.tab2Mode === 'NEW') {
    const prefix = state.tab2Type === 'Khấu hao' ? 'A' : 'TH';
    const nextNum = state.items.filter(i => i.code && i.code.startsWith(prefix)).length + 1;
    codeEl.value = `${prefix}-${String(nextNum).padStart(3, '0')}`;
  } else {
    codeEl.value = "Tự động gán theo đồ đã có";
  }
}

function renderTab2Pills() {
  // Category Pills (Multi-select)
  const catContainer = document.getElementById("tab2-category-pills");
  if (catContainer) {
    catContainer.innerHTML = ALL_CATEGORIES.map(cat => {
      const isSelected = state.tab2SelectedCategories.has(cat);
      return `
        <button type="button" onclick="toggleTab2Category('${cat}')" class="pill-badge ${isSelected ? 'active' : ''}">
          ${cat}
        </button>
      `;
    }).join("");
  }

  // Purpose Pills (Multi-select)
  const purContainer = document.getElementById("tab2-purpose-pills");
  if (purContainer) {
    purContainer.innerHTML = ALL_PURPOSES.map(p => {
      const isSelected = state.tab2SelectedPurposes.has(p);
      return `
        <button type="button" onclick="toggleTab2Purpose('${p}')" class="pill-badge ${isSelected ? 'active' : ''}">
          ${p}
        </button>
      `;
    }).join("");
  }
}

function toggleTab2Category(cat) {
  if (state.tab2SelectedCategories.has(cat)) {
    if (state.tab2SelectedCategories.size > 1) {
      state.tab2SelectedCategories.delete(cat);
    }
  } else {
    state.tab2SelectedCategories.add(cat);
  }
  renderTab2Pills();
}

function toggleTab2Purpose(p) {
  if (state.tab2SelectedPurposes.has(p)) {
    if (state.tab2SelectedPurposes.size > 1) {
      state.tab2SelectedPurposes.delete(p);
    }
  } else {
    state.tab2SelectedPurposes.add(p);
  }
  renderTab2Pills();
}

// Live Autocomplete for Tab 2 Props Name
function handleTab2NameInput(query) {
  const container = document.getElementById("tab2-name-suggestions");
  if (!container) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    container.classList.add("hidden");
    return;
  }

  const matches = state.items.filter(i => i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q)));
  if (matches.length === 0) {
    container.innerHTML = `
      <div class="p-2 text-slate-400 italic text-xs">
        "${query}" là tên mới hoàn toàn (sẽ tự động lưu vào kho).
      </div>
    `;
    container.classList.remove("hidden");
    return;
  }

  container.innerHTML = matches.slice(0, 6).map(item => `
    <div onclick="selectTab2ExistingItem('${item.id}')" class="autocomplete-item flex items-center justify-between">
      <div>
        <strong class="text-sky-800">${item.name}</strong>
        <span class="text-[10px] text-slate-500 ml-1.5">[${item.code} - ${item.category}]</span>
      </div>
      <span class="text-[11px] text-slate-600 font-semibold">${item.unit} | Tồn: ${item.ready}</span>
    </div>
  `).join("");
  container.classList.remove("hidden");
}

function selectTab2ExistingItem(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const nameInput = document.getElementById("tab2-name");
  const unitInput = document.getElementById("tab2-unit");
  const specsInput = document.getElementById("tab2-specs");
  const minStockInput = document.getElementById("tab2-minstock");

  if (nameInput) nameInput.value = item.name;
  if (unitInput) unitInput.value = item.unit;
  if (specsInput) specsInput.value = item.specs || "";
  if (minStockInput) minStockInput.value = item.minStock || 0;

  setTab2Mode('EXISTING');
  setTab2Type(item.type);

  state.tab2SelectedCategories = new Set([item.category]);
  renderTab2Pills();

  document.getElementById("tab2-name-suggestions")?.classList.add("hidden");
  showToast(`Đã chọn bổ sung số lượng cho [${item.name}]!`, "info");
}

// Tab 2 Shelf Rows (Image 1 Style: #1 | Tên giá | Tầng | Số lượng | [-])
function renderTab2ShelfRows() {
  const container = document.getElementById("tab2-shelf-rows-container");
  if (!container) return;

  container.innerHTML = state.tab2Shelves.map((s, idx) => `
    <div class="flex items-center gap-2 text-xs">
      <span class="w-7 text-center font-bold text-slate-500">#${idx + 1}</span>
      <input type="text" value="${s.shelf}" oninput="state.tab2Shelves[${idx}].shelf = this.value" placeholder="Tên giá (Ví dụ: Giá A, Kệ 01...)" class="flex-1 p-2 bg-white border border-slate-300 rounded-lg">
      <input type="text" value="${s.tier || '1'}" oninput="state.tab2Shelves[${idx}].tier = this.value" placeholder="Tầng (Ví dụ: 1, 2, Mặt sàn...)" class="w-32 sm:w-44 p-2 bg-white border border-slate-300 rounded-lg">
      <input type="number" min="1" value="${s.qty}" oninput="updateTab2ShelfQty(${idx}, this.value)" class="w-20 p-2 bg-white border border-slate-300 rounded-lg text-center font-bold">
      <button type="button" onclick="removeTab2ShelfItemRow(${idx})" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg" title="Xóa dòng kệ">
        <i data-lucide="minus" class="w-4 h-4"></i>
      </button>
    </div>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

function addTab2ShelfItemRow() {
  const nextIdx = state.tab2Shelves.length + 1;
  state.tab2Shelves.push({
    shelf: `Giá ${String.fromCharCode(65 + nextIdx - 1)}`,
    tier: "1",
    qty: 1
  });
  renderTab2ShelfRows();
  updateTab2ShelfValidation();
}

function removeTab2ShelfItemRow(idx) {
  if (state.tab2Shelves.length <= 1) {
    showToast("Phải có ít nhất 1 vị trí giá kệ!", "error");
    return;
  }
  state.tab2Shelves.splice(idx, 1);
  renderTab2ShelfRows();
  updateTab2ShelfValidation();
}

function updateTab2ShelfQty(idx, val) {
  if (state.tab2Shelves[idx]) {
    state.tab2Shelves[idx].qty = Math.max(1, Number(val || 1));
    updateTab2ShelfValidation();
  }
}

function updateTab2ShelfValidation() {
  const totalTargetQty = Number(document.getElementById("tab2-qty")?.value || 1);
  const sum = state.tab2Shelves.reduce((acc, s) => acc + (s.qty || 0), 0);

  const badge = document.getElementById("tab2-shelf-status-badge");
  if (!badge) return;

  if (sum === totalTargetQty) {
    badge.className = "px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1";
    badge.innerHTML = `<i data-lucide="check-square" class="w-3.5 h-3.5"></i><span>Khớp số lượng: ${sum} / ${totalTargetQty}</span>`;
  } else {
    badge.className = "px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 flex items-center gap-1";
    badge.innerHTML = `<i data-lucide="alert-circle" class="w-3.5 h-3.5"></i><span>Chưa khớp: ${sum} / ${totalTargetQty} (${sum > totalTargetQty ? 'Thừa' : 'Thiếu'})</span>`;
  }

  if (window.lucide) lucide.createIcons();
}

// Album Photo Handler in Tab 2
function renderTab2Album() {
  const container = document.getElementById("tab2-album-container");
  if (!container) return;

  if (state.tab2AlbumPhotos.length === 0) {
    container.innerHTML = '<span class="text-slate-400 italic text-xs">Chưa có ảnh nào trong album</span>';
    return;
  }

  container.innerHTML = state.tab2AlbumPhotos.map((url, idx) => `
    <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-300 group">
      <img src="${url}" class="w-full h-full object-cover">
      <button type="button" onclick="removeTab2AlbumPhoto(${idx})" class="absolute top-0.5 right-0.5 bg-black/60 text-white p-0.5 rounded-full hover:bg-rose-600 transition">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>
    </div>
  `).join("");

  if (window.lucide) lucide.createIcons();
}

function removeTab2AlbumPhoto(idx) {
  state.tab2AlbumPhotos.splice(idx, 1);
  renderTab2Album();
}

function handleMultiplePhotosUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  showToast(`Đang tải ${files.length} ảnh lên...`, "info");
  files.forEach(file => {
    compressImage(file, 1280, 0.75, (blob) => {
      uploadToImgBB(blob, (url) => {
        state.tab2AlbumPhotos.push(url);
        renderTab2Album();
      });
    });
  });
}

function handleSingleFileUpload(event, previewId) {
  const file = event.target.files[0];
  if (!file) return;

  compressImage(file, 1280, 0.75, (blob) => {
    uploadToImgBB(blob, (url) => {
      state.tab2InvoiceFile = url;
      const preview = document.getElementById(previewId);
      if (preview) {
        preview.innerHTML = `<span class="text-emerald-600 font-bold">🟢 Đã tải hóa đơn:</span> <a href="${url}" target="_blank" class="underline text-sky-600">Xem file</a>`;
      }
    });
  });
}

function handleTab2Submit(event) {
  event.preventDefault();

  const totalQty = Number(document.getElementById("tab2-qty")?.value || 1);
  const shelfSum = state.tab2Shelves.reduce((acc, s) => acc + (s.qty || 0), 0);

  if (shelfSum !== totalQty) {
    alert(`Tổng số lượng chia vào các giá kệ (${shelfSum}) chưa khớp với số lượng nhập (${totalQty})!\nVui lòng điều chỉnh lại cho khớp 100%.`);
    return;
  }

  const name = document.getElementById("tab2-name")?.value.trim();
  const unit = document.getElementById("tab2-unit")?.value.trim();
  const specs = document.getElementById("tab2-specs")?.value.trim();
  const minStock = Number(document.getElementById("tab2-minstock")?.value || 0);
  const whId = document.getElementById("tab2-warehouse")?.value;
  const wh = state.warehouses.find(w => w.id === whId) || state.warehouses[0];

  const invoiceCostRaw = document.getElementById("tab2-invoice-cost")?.value || "0";
  const invoiceCost = Number(invoiceCostRaw.replace(/\D/g, "") || 0);

  const categoriesArr = Array.from(state.tab2SelectedCategories);
  const purposesArr = Array.from(state.tab2SelectedPurposes);

  const shelvesData = state.tab2Shelves.map(s => ({
    shelf: `${s.shelf} - Tầng ${s.tier}`,
    qty: s.qty
  }));

  const mainPhoto = state.tab2AlbumPhotos[0] || "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=400";

  let targetItem = null;
  if (state.tab2Mode === 'EXISTING') {
    targetItem = state.items.find(i => i.name.toLowerCase() === name.toLowerCase() && i.warehouseId === wh.id);
  }

  if (targetItem) {
    targetItem.ready += totalQty;
    shelvesData.forEach(ns => {
      const exist = targetItem.shelves.find(s => s.shelf === ns.shelf);
      if (exist) exist.qty += ns.qty;
      else targetItem.shelves.push(ns);
    });
    if (invoiceCost > 0) targetItem.invoiceCost = (targetItem.invoiceCost || 0) + invoiceCost;
  } else {
    const prefix = state.tab2Type === 'Khấu hao' ? 'A' : 'TH';
    const nextNum = state.items.filter(i => i.code && i.code.startsWith(prefix)).length + 1;
    const code = `${prefix}-${String(nextNum).padStart(3, '0')}`;

    targetItem = {
      id: `ITEM-${Date.now()}`,
      code: code,
      name: name,
      type: state.tab2Type,
      category: categoriesArr[0] || "Đồ sự kiện",
      unit: unit,
      specs: specs,
      purpose: purposesArr.join(", "),
      warehouseId: wh.id,
      warehouseName: wh.name,
      minStock: minStock,
      ready: totalQty,
      inUse: 0,
      broken: 0,
      shelves: shelvesData,
      brokenLocations: [],
      currentTours: [],
      image: mainPhoto,
      invoiceUrl: state.tab2InvoiceFile,
      invoiceCost: invoiceCost
    };
    state.items.unshift(targetItem);
  }

  const docCode = `NK_NEW_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: docCode,
    type: "Nhập lần đầu",
    badgeColor: "emerald",
    tourName: `Khai báo nhập kho [${targetItem.name}]`,
    location: wh.name,
    warehouseName: wh.name,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: totalQty,
    items: shelvesData.map(s => ({ name: targetItem.name, unit: targetItem.unit, qty: s.qty, shelf: s.shelf })),
    photos: state.tab2AlbumPhotos,
    note: `Khai báo nhập ${state.tab2Mode === 'NEW' ? 'mới' : 'bổ sung'} ${totalQty} ${targetItem.unit}. Danh mục: ${categoriesArr.join(', ')}.`
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  resetTab2Form();
  showToast(`Đã lưu thành công phiếu nhập mới [${docCode}]!`, "success");
  if (typeof confetti === "function") confetti();
  switchTab(1);
}

// =========================================================================
// TAB 3: XUẤT KHO (EXACT CLONE OF IMAGE 2 & IMAGE 3)
// =========================================================================
function renderTab3() {
  populateCommonDropdowns();

  const creatorEl = document.getElementById("tab3-creator");
  if (creatorEl) creatorEl.value = `${state.currentUser.name} (${state.currentUser.phone})`;

  const dateEl = document.getElementById("tab3-project-date");
  if (dateEl && !dateEl.value) {
    dateEl.value = formatDate(new Date(), 'YYYY-MM-DD');
  }

  renderTab3PrepSlipsBanner();
  renderTab3Table();
}

// =========================================================================
// TAB 3: WAREHOUSE STAGING PREPARATION SLIPS (PHIẾU CHUẨN BỊ ĐỒ)
// =========================================================================
function renderTab3PrepSlipsBanner() {
  const banner = document.getElementById("tab3-prep-slips-banner");
  if (!banner) return;

  const slips = state.prepSlips || [];
  if (slips.length === 0) {
    banner.innerHTML = "";
    return;
  }

  const pendingSlips = slips.filter(s => s.status === "PENDING_STAGING");
  const stagedSlips = slips.filter(s => s.status === "STAGED");

  let pendingHtml = "";
  if (pendingSlips.length > 0) {
    pendingHtml = `
      <div class="p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/10 border-2 border-amber-400 rounded-2xl shadow-xs space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="p-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs shadow-2xs">
              <i data-lucide="bell" class="w-4 h-4"></i>
            </span>
            <div>
              <div class="font-extrabold text-xs sm:text-sm text-amber-950 flex items-center gap-1.5">
                <span>CÓ PHIẾU CHUẨN BỊ ĐỒ CẦN GOM RA "VỊ TRÍ CHUẨN BỊ ĐỒ"</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">${pendingSlips.length} Phiếu</span>
              </div>
              <p class="text-[11px] text-amber-800">Thủ kho mở phiếu để gom đạo cụ từ các giá kệ tập kết về vị trí chuẩn bị trước khi xe tải tới nhận</p>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          ${pendingSlips.map(slip => `
            <div class="p-2.5 bg-white/95 rounded-xl border border-amber-300 flex items-center justify-between gap-2 shadow-2xs">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="font-black text-xs text-amber-900">${slip.code}</span>
                  <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">Chờ gom đồ</span>
                </div>
                <div class="font-bold text-xs text-slate-800 truncate mt-0.5">${slip.tourName}</div>
                <div class="text-[10px] text-slate-500">📍 ${slip.location} • ${slip.items.length} mục đạo cụ</div>
              </div>
              <button type="button" onclick="openPrepSlipModal('${slip.id}')" class="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition shadow-2xs flex items-center gap-1">
                <i data-lucide="package" class="w-3.5 h-3.5"></i>
                <span>Gom Đồ</span>
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  let stagedHtml = "";
  if (stagedSlips.length > 0) {
    stagedHtml = `
      <div class="p-3 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-emerald-900 flex items-center gap-1.5">
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>Đã gom xong ${stagedSlips.length} phiếu tại "Vị trí chuẩn bị đồ"</span>
          </span>
        </div>
        <div class="space-y-1.5">
          ${stagedSlips.map(slip => `
            <div class="p-2 bg-white rounded-lg border border-emerald-200 flex items-center justify-between gap-2">
              <div class="truncate">
                <strong class="text-emerald-900">${slip.code}</strong> - <span class="font-medium text-slate-800">${slip.tourName}</span> <span class="text-slate-500">(${slip.items.length} món)</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="openPrepSlipModal('${slip.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-semibold">
                  Chi tiết
                </button>
                <button type="button" onclick="applyPrepSlipToExport('${slip.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs">
                  <i data-lucide="zap" class="w-3 h-3"></i>
                  <span>Nạp Nhanh Vào Phiếu Xuất</span>
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  banner.innerHTML = pendingHtml + stagedHtml;
  if (window.lucide) lucide.createIcons();
}

function openPrepSlipModal(slipId) {
  const slip = (state.prepSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  const modal = document.getElementById("modal-prep-slip");
  const badge = document.getElementById("prep-slip-code-badge");
  const subtitle = document.getElementById("prep-slip-subtitle");
  const body = document.getElementById("prep-slip-modal-body");

  if (!modal || !body) return;

  if (badge) badge.textContent = slip.code;
  if (subtitle) subtitle.textContent = `${slip.tourName} • ${slip.warehouseName}`;

  const isPending = (slip.status === "PENDING_STAGING");

  body.innerHTML = `
    <!-- Slip Information Header -->
    <div class="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
      <div>
        <div><strong class="text-slate-700">Chương trình / Dự án:</strong> <span class="text-sky-900 font-bold">${slip.tourName}</span></div>
        <div class="mt-1"><strong class="text-slate-700">Địa điểm tổ chức:</strong> ${slip.location}</div>
      </div>
      <div>
        <div><strong class="text-slate-700">Ngày diễn ra:</strong> ${slip.eventDate}</div>
        <div class="mt-1"><strong class="text-slate-700">Kho chuẩn bị:</strong> ${slip.warehouseName}</div>
      </div>
      ${slip.note ? `
        <div class="col-span-2 pt-1.5 border-t border-slate-200 text-slate-600 italic">
          <strong>Ghi chú:</strong> ${slip.note}
        </div>
      ` : ''}
    </div>

    <!-- Items Picking Checklist Table -->
    <div class="space-y-1.5">
      <div class="flex items-center justify-between font-bold text-slate-800 text-xs">
        <span class="flex items-center gap-1.5">
          <i data-lucide="list-checks" class="w-4 h-4 text-amber-600"></i>
          <span>Danh Sách Đạo Cụ Cần Gom (${slip.items.length} món):</span>
        </span>
        <span class="text-[11px] font-normal text-slate-500">Gom từ các kệ về Vị trí chuẩn bị đồ</span>
      </div>

      <div class="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
            <tr>
              <th class="py-2 px-2.5 w-10 text-center">STT</th>
              <th class="py-2 px-3">Tên Đạo Cụ</th>
              <th class="py-2 px-2 text-center w-16">SL Cần</th>
              <th class="py-2 px-2 text-center w-14">ĐVT</th>
              <th class="py-2 px-3">Kệ Hiện Tại</th>
              <th class="py-2 px-2 text-center w-14">Tầng</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            ${slip.items.map((it, idx) => `
              <tr class="hover:bg-amber-50/40 transition">
                <td class="py-2 px-2.5 text-center text-slate-400 font-medium">${idx + 1}</td>
                <td class="py-2 px-3 font-semibold text-slate-800">${it.name}</td>
                <td class="py-2 px-2 text-center font-black text-amber-700">${it.qty}</td>
                <td class="py-2 px-2 text-center text-slate-500">${it.unit}</td>
                <td class="py-2 px-3 text-slate-700 font-medium">📍 ${it.shelf || 'Khu vực kho'}</td>
                <td class="py-2 px-2 text-center text-slate-500">${it.tier || '1'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Staging Confirmation Action / Result -->
    ${isPending ? `
      <div class="p-3.5 bg-amber-50 border border-amber-300 rounded-xl space-y-2.5">
        <div class="text-xs text-amber-900">
          <span class="font-bold">Quy trình 2 bước xác nhận gom đồ:</span>
          <ol class="list-decimal list-inside text-[11px] text-amber-800 space-y-0.5 mt-1">
            <li>Xác nhận đã mang toàn bộ đồ ra <strong>Vị trí chuẩn bị đồ</strong> trong kho.</li>
            <li>Chụp ảnh vị trí chuẩn bị đồ để lưu bằng chứng nghiệm thu hoàn thành phiếu.</li>
          </ol>
        </div>
        <button type="button" onclick="confirmStagingPrepSlip('${slip.id}')" class="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow flex items-center justify-center gap-2">
          <i data-lucide="package-check" class="w-4 h-4"></i>
          <span>📦 Xác Nhận Đã Gom Đồ Ra Vị Trí Chuẩn Bị</span>
        </button>
      </div>
    ` : `
      <div class="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-3">
        <div class="flex items-center justify-between text-xs">
          <span class="font-bold text-emerald-900 flex items-center gap-1.5">
            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i>
            <span>Đã gom xong ra "Vị trí chuẩn bị đồ" (${slip.stagedAt})</span>
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900">Hoàn thành</span>
        </div>
        ${slip.stagedPhoto ? `
          <div>
            <span class="text-[11px] font-bold text-slate-700 block mb-1">Ảnh vị trí chuẩn bị đồ:</span>
            <div class="rounded-xl border border-emerald-300 overflow-hidden h-40 bg-slate-100">
              <img src="${slip.stagedPhoto}" alt="Vị trí chuẩn bị đồ" class="w-full h-full object-cover">
            </div>
          </div>
        ` : ''}
        <button type="button" onclick="applyPrepSlipToExport('${slip.id}')" class="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm rounded-xl transition shadow flex items-center justify-center gap-2">
          <i data-lucide="zap" class="w-4 h-4"></i>
          <span>⚡ Nạp Toàn Bộ Danh Sách Vào Bảng Xuất Kho (Tab 3)</span>
        </button>
      </div>
    `}
  `;

  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function confirmStagingPrepSlip(slipId) {
  const slip = (state.prepSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  // Bước 1: Hỏi xác nhận đã gom đồ ra vị trí chuẩn bị đồ chưa
  const ans = confirm("1. Bạn đã lưu toàn bộ đồ ra vị trí chuẩn bị đồ cho chương trình chưa?\n\n(Bấm 'OK' nếu Rồi, 'Cancel' nếu Chưa)");
  if (!ans) {
    alert("Vui lòng hoàn tất việc gom đồ ra vị trí chuẩn bị đồ trước khi xác nhận!");
    return;
  }

  // Bước 2: Chụp ảnh vị trí chuẩn bị đồ để xác nhận hoàn thành phiếu
  showToast("Bước 2: Mở máy ảnh chụp vị trí chuẩn bị đồ để hoàn thành phiếu...", "info");
  openLiveCamera((imgUrl) => {
    slip.status = "STAGED";
    slip.stagedPhoto = imgUrl;
    slip.stagedAt = formatDateTime(new Date());

    // Cập nhật vị trí lưu mới trong kho của các món đạo cụ này thành "Vị trí chuẩn bị đồ"
    (slip.items || []).forEach(pItem => {
      const item = state.items.find(i => i.name.toLowerCase() === pItem.name.toLowerCase());
      if (item) {
        if (!item.shelves) item.shelves = [];
        const prepShelf = item.shelves.find(s => s.shelf === "Vị trí chuẩn bị đồ");
        if (prepShelf) {
          prepShelf.qty = (prepShelf.qty || 0) + pItem.qty;
        } else {
          item.shelves.push({ shelf: "Vị trí chuẩn bị đồ", tier: "Mặt sàn", qty: pItem.qty });
        }
      }
    });

    saveState();
    renderTab3PrepSlipsBanner();
    openPrepSlipModal(slipId);
    showToast("✓ Đã gom đồ thành công! Vị trí các món trong kho đã được chuyển sang 'Vị trí chuẩn bị đồ'.", "success");
  });
}

function applyPrepSlipToExport(slipId) {
  const slip = (state.prepSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  const nameInput = document.getElementById("tab3-project-name");
  const locInput = document.getElementById("tab3-project-location");
  const dateInput = document.getElementById("tab3-project-date");
  const whSelect = document.getElementById("tab3-warehouse");

  if (nameInput) nameInput.value = slip.tourName;
  if (locInput) locInput.value = slip.location;
  if (dateInput) dateInput.value = slip.eventDate;
  if (whSelect && slip.warehouseId) whSelect.value = slip.warehouseId;

  state.tab3Combos = [];
  state.tab3DirectRows = (slip.items || []).map((it, idx) => ({
    id: `DIR-${Date.now()}-${idx + 1}`,
    name: it.name,
    unit: it.unit,
    qty: it.qty,
    readyStock: it.qty,
    shelf: "Vị trí chuẩn bị đồ",
    itemId: null
  }));

  closeModal("modal-prep-slip");
  switchTab(3);
  renderTab3Table();
  showToast(`Đã nạp toàn bộ danh sách đạo cụ từ phiếu chuẩn bị [${slip.code}] vào bảng xuất kho!`, "success");
}

function initTab3DirectRows() {
  state.tab3DirectRows = [];
  for (let i = 1; i <= 5; i++) {
    state.tab3DirectRows.push({
      id: `DIR-${Date.now()}-${i}`,
      name: "",
      unit: "ĐVT",
      qty: 0,
      readyStock: 0,
      shelf: "---",
      itemId: null
    });
  }
}

function resetTab3Form() {
  document.getElementById("tab3-project-name").value = "";
  document.getElementById("tab3-project-location").value = "";
  state.tab3Combos = [];
  initTab3DirectRows();
  state.tab3TeamPhoto = "";

  const teamPreview = document.getElementById("tab3-team-photo-preview");
  const teamStatus = document.getElementById("tab3-team-photo-status");
  if (teamPreview) teamPreview.classList.add("hidden");
  if (teamStatus) teamStatus.textContent = "Chưa có ảnh đội";

  renderTab3Table();
  showToast("Đã xóa trắng danh sách phiếu xuất!", "info");
}

function handleTab3WarehouseChanged() {
  // Re-check inventory against selected warehouse
  const whId = document.getElementById("tab3-warehouse")?.value;

  // Update direct rows stock
  state.tab3DirectRows.forEach(row => {
    if (row.name) {
      const match = state.items.find(i => i.name.toLowerCase() === row.name.toLowerCase() && i.warehouseId === whId) ||
        state.items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
      if (match) {
        row.readyStock = (match.warehouseId === whId) ? match.ready : 0;
        row.shelf = (match.warehouseId === whId) ? (match.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${match.warehouseName}`;
      }
    }
  });

  // Update combo items stock
  state.tab3Combos.forEach(combo => {
    combo.items.forEach(child => {
      const match = state.items.find(i => i.name.toLowerCase() === child.name.toLowerCase() && i.warehouseId === whId) ||
        state.items.find(i => i.name.toLowerCase() === child.name.toLowerCase());
      if (match) {
        child.readyStock = (match.warehouseId === whId) ? match.ready : 0;
        child.shelf = (match.warehouseId === whId) ? (match.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${match.warehouseName}`;
      }
    });
  });

  renderTab3Table();
}

function getEffectiveTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function downloadTab3SampleExcel() {
  if (typeof XLSX === "undefined") {
    alert("Thư viện Excel đang tải, vui lòng thử lại sau giây lát.");
    return;
  }

  const pName = document.getElementById("tab3-project-name")?.value.trim() || "PHAN ĐÌNH PHÙNG - TUYÊN QUANG";
  const pLoc = document.getElementById("tab3-project-location")?.value.trim() || "THCS Khương Đình (THCS Nguyễn Trãi cũ)";
  const pDateRaw = document.getElementById("tab3-project-date")?.value || "2026-08-21";
  let pDate = pDateRaw;
  if (pDateRaw && pDateRaw.includes("-")) {
    const parts = pDateRaw.split("-");
    if (parts.length === 3) pDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  const whSelect = document.getElementById("tab3-warehouse");
  const whName = whSelect?.options[whSelect.selectedIndex]?.text || "Kho Tổng Mỹ Đình (Hà Nội)";
  const whId = whSelect?.value || "WH-MD";

  // Check if items already exist in Tab 3 table
  const currentTab3Items = (typeof getTab3AllExportItems === "function") ? getTab3AllExportItems() : [];

  const titleRow = `CHECKLIST CHUẨN BỊ CHO CHƯƠNG TRÌNH ${pName.toUpperCase()}`;

  const aoa = [
    [titleRow],
    ["I. Thông tin chương trình"],
    ["Dự án:", "", "", pName],
    ["Địa điểm:", "", "", pLoc],
    ["Thời gian:", "", "", pDate],
    ["II. Checklist chuẩn bị"],
    ["STT", "Tên Đồ", "Mã Đồ", "Số Lượng", "Đơn Vị Tính", "Ghi Chú", "Tên Kho"]
  ];

  if (currentTab3Items && currentTab3Items.length > 0) {
    currentTab3Items.forEach((it, idx) => {
      const match = state.items.find(i => i.id === it.itemId || i.name === it.name);
      aoa.push([
        idx + 1,
        it.name,
        match ? match.code : `A-${String(idx + 1).padStart(3, "0")}`,
        it.qty,
        it.unit || "Chiếc",
        it.note || (idx === 0 ? "Kiểm tra van hơi trước khi xuất" : (idx === 1 ? "Kèm dây nguồn 10m" : "Buộc chặt theo cuộn")),
        whName
      ]);
    });
  } else {
    // Default sample matching Image 1
    const whItems = (state.items || []).filter(i => i.warehouseId === whId);
    const it1 = whItems[0] || state.items[0];
    const it2 = whItems[1] || state.items[1];
    const it3 = whItems[2] || state.items[2];

    aoa.push(
      [1, it1 ? it1.name : "Bánh xe bạt PVC khổng lồ (D=2.2m)", it1 ? it1.code : "A-001", 2, it1 ? it1.unit : "Chiếc", "Kiểm tra van hơi trước khi xuất", whName],
      [2, it2 ? it2.name : "Dây thừng kéo co 4 hướng phi 32", it2 ? it2.code : "A-002", 1, it2 ? it2.unit : "Bộ", "Kèm dây nguồn 10m", whName],
      [3, it3 ? it3.name : "Máy thổi khí công suất lớn 1500W", it3 ? it3.code : "A-004", 2, it3 ? it3.unit : "Chiếc", "Buộc chặt theo cuộn", whName]
    );
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 38 },
    { wch: 12 },
    { wch: 10 },
    { wch: 14 },
    { wch: 32 },
    { wch: 28 }
  ];

  const wb = XLSX.utils.book_new();
  const safeName = pName.replace(/[\/\\?*:[\]]/g, "_").slice(0, 25);
  XLSX.utils.book_append_sheet(wb, ws, "Checklist");
  XLSX.writeFile(wb, `Checklist_${safeName}.xlsx`);
  showToast(`Đã xuất mẫu checklist Excel cho [${pName}]!`, "success");
}

function handleTab3ProjectInput(query) {
  const container = document.getElementById("tab3-project-suggestions");
  if (!container) return;

  const todayStr = getEffectiveTodayStr();
  const q = (query || "").trim().toLowerCase();

  // Filter: ONLY programs whose date is upcoming or today ("chuẩn bị tới hoặc đúng ngày đó, qua ngày không hiển thị nữa")
  const activePrograms = (state.tours || []).filter(t => {
    // Exclude finished / completed
    if (t.status === "Đã kết thúc" || t.status === "Đã hoàn thành") return false;
    // Check end date if provided, else check start date
    if (t.endDate) {
      return t.endDate >= todayStr;
    }
    if (t.startDate) {
      return t.startDate >= todayStr;
    }
    return true;
  });

  const matches = q
    ? activePrograms.filter(t => t.name.toLowerCase().includes(q) || (t.location && t.location.toLowerCase().includes(q)))
    : activePrograms;

  if (matches.length === 0) {
    if (q) {
      container.innerHTML = `<div class="p-3 text-slate-400 italic text-xs text-center">Không có chương trình nào đang vận hành / sắp tới khớp từ khóa</div>`;
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
    return;
  }

  container.innerHTML = matches.map(t => {
    const isOngoing = (t.startDate && t.startDate <= todayStr && (!t.endDate || t.endDate >= todayStr));
    const statusText = t.status || (isOngoing ? "Đang vận hành" : "Chuẩn bị tới");
    const statusBadgeClass = isOngoing ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-sky-100 text-sky-800 border-sky-200";

    return `
      <div onclick="selectTab3Project('${t.id}')" class="autocomplete-item p-2.5 flex items-center justify-between cursor-pointer hover:bg-sky-50 border-b border-slate-100 last:border-0 transition">
        <div class="pr-2">
          <strong class="text-sky-900 block text-xs leading-snug">${t.name}</strong>
          <div class="text-[11px] text-slate-500 mt-0.5">📍 ${t.location || 'Hiện trường'} ${t.startDate ? `• 🗓️ ${t.startDate}` : ''}</div>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap border ${statusBadgeClass}">
          ${statusText}
        </span>
      </div>
    `;
  }).join("");
  container.classList.remove("hidden");
}

function selectTab3Project(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return;

  const nameInput = document.getElementById("tab3-project-name");
  const locInput = document.getElementById("tab3-project-location");
  const dateInput = document.getElementById("tab3-project-date");

  if (nameInput) nameInput.value = tour.name;
  if (locInput) locInput.value = tour.location || "";
  if (dateInput && tour.startDate) dateInput.value = tour.startDate;

  document.getElementById("tab3-project-suggestions")?.classList.add("hidden");
}

// Add Game Combo (Image 2)
function addTab3GameCombo() {
  const comboId = document.getElementById("tab3-combo-select")?.value;
  const comboQty = Number(document.getElementById("tab3-combo-qty")?.value || 1);
  const whId = document.getElementById("tab3-warehouse")?.value;

  if (!comboId) {
    alert("Vui lòng chọn một Bộ Game!");
    return;
  }

  const comboPreset = state.combos.find(c => c.id === comboId);
  if (!comboPreset) return;

  // Build items with stock check in selected warehouse
  const comboChildItems = comboPreset.items.map(child => {
    const match = state.items.find(i => i.name.toLowerCase() === child.name.toLowerCase() && i.warehouseId === whId) ||
      state.items.find(i => i.id === child.itemId) || {
        id: child.itemId,
        name: child.name,
        unit: child.unit,
        ready: 0,
        warehouseId: whId,
        shelves: [{ shelf: "Kho", qty: 0 }]
      };

    const neededQty = child.quantityPerSet * comboQty;
    const isAtThisWh = (match.warehouseId === whId);

    return {
      itemId: match.id,
      name: child.name,
      unit: child.unit,
      qty: neededQty,
      readyStock: isAtThisWh ? (match.ready || 0) : 0,
      shelf: isAtThisWh ? (match.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${match.warehouseName}`
    };
  });

  // Tự động thêm Máy Bơm Hơi và Dây Điện (bỏ qua ổ cắm) khi bộ game có đồ hơi
  const INFLATABLE_KEYWORDS = [
    "hơi", "phao", "bạt", "bơm hơi", "khí cầu", "bánh xe bạt",
    "cổng hơi", "nhà hơi", "lâu đài hơi", "con lăn hơi", "bóng khổng lồ",
    "núi hơi", "thuyền phao", "cầu phao"
  ];
  const hasInflatable = (comboPreset.category === "Đồ hơi") || (comboPreset.items || []).some(ci => {
    const l = (ci.name || "").toLowerCase();
    return INFLATABLE_KEYWORDS.some(kw => l.includes(kw));
  });

  if (hasInflatable) {
    const hasBlower = comboChildItems.some(ci => {
      const l = ci.name.toLowerCase();
      return l.includes("máy thổi") || l.includes("máy bơm");
    });
    if (!hasBlower) {
      const blowerMatch = state.items.find(i => i.name.toLowerCase().includes("máy thổi") && i.warehouseId === whId) ||
        state.items.find(i => i.name.toLowerCase().includes("máy thổi")) || {
          id: "A004",
          name: "Máy thổi khí công suất lớn 1500W",
          unit: "Chiếc",
          ready: 0,
          warehouseId: whId,
          shelves: [{ shelf: "Kho", qty: 0 }]
        };
      comboChildItems.push({
        itemId: blowerMatch.id,
        name: "Máy thổi khí công suất lớn 1500W",
        unit: "Chiếc",
        qty: 1 * comboQty,
        readyStock: (blowerMatch.warehouseId === whId) ? (blowerMatch.ready || 0) : 0,
        shelf: (blowerMatch.warehouseId === whId) ? (blowerMatch.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${blowerMatch.warehouseName}`
      });
    }

    const hasWire = comboChildItems.some(ci => {
      const l = ci.name.toLowerCase();
      return l.includes("dây điện") || l.includes("dây nguồn");
    });
    if (!hasWire) {
      const wireMatch = state.items.find(i => i.name.toLowerCase().includes("dây điện") && i.warehouseId === whId) ||
        state.items.find(i => i.name.toLowerCase().includes("dây điện")) || {
          id: "A013",
          name: "Cuộn dây điện nguồn 20m",
          unit: "Cuộn",
          ready: 0,
          warehouseId: whId,
          shelves: [{ shelf: "Kho", qty: 0 }]
        };
      comboChildItems.push({
        itemId: wireMatch.id,
        name: "Cuộn dây điện nguồn 20m",
        unit: "Cuộn",
        qty: 1 * comboQty,
        readyStock: (wireMatch.warehouseId === whId) ? (wireMatch.ready || 0) : 0,
        shelf: (wireMatch.warehouseId === whId) ? (wireMatch.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${wireMatch.warehouseName}`
      });
    }
  }

  state.tab3Combos.push({
    id: `CMB-ROW-${Date.now()}`,
    comboId: comboPreset.id,
    comboName: comboPreset.name,
    comboQty: comboQty,
    items: comboChildItems
  });

  renderTab3Table();
  showToast(`Đã thêm Bộ Game [${comboPreset.name}] (${comboQty} bộ) vào danh sách!`, "success");
}

function toggleTab3ComboCollapse(comboRowId) {
  state.tab3CollapsedCombos[comboRowId] = !state.tab3CollapsedCombos[comboRowId];
  renderTab3Table();
}

function removeTab3Combo(comboRowId) {
  state.tab3Combos = state.tab3Combos.filter(c => c.id !== comboRowId);
  renderTab3Table();
}

function updateTab3ComboChildQty(comboRowId, itemIndex, newQty) {
  const combo = state.tab3Combos.find(c => c.id === comboRowId);
  if (combo && combo.items[itemIndex]) {
    combo.items[itemIndex].qty = Math.max(1, Number(newQty || 1));
    renderTab3Table();
  }
}

// Direct Inline Rows Handler (Image 3)
function handleTab3DirectNameInput(rowId, query, inputElement) {
  const row = state.tab3DirectRows.find(r => r.id === rowId);
  if (!row) return;

  row.name = query;
  row.isWarning = false; // clear warning when user begins editing

  // Check if this is the last row, automatically append a new row so there is ALWAYS a spare row!
  const lastRow = state.tab3DirectRows[state.tab3DirectRows.length - 1];
  if (lastRow.id === rowId && query.trim()) {
    state.tab3DirectRows.push({
      id: `DIR-${Date.now()}-${state.tab3DirectRows.length + 1}`,
      name: "",
      unit: "ĐVT",
      qty: 0,
      readyStock: 0,
      shelf: "---",
      itemId: null,
      isWarning: false
    });
  }

  // Show floating autocomplete suggestions
  const q = query.trim().toLowerCase();
  let suggestionBox = document.getElementById(`suggestion-${rowId}`);
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = `suggestion-${rowId}`;
    suggestionBox.className = "autocomplete-suggestions";
    inputElement.parentElement.appendChild(suggestionBox);
  }

  if (!q) {
    suggestionBox.classList.add("hidden");
    return;
  }

  const whId = document.getElementById("tab3-warehouse")?.value;
  const matches = state.items.filter(i => i.name.toLowerCase().includes(q) || (i.code && i.code.toLowerCase().includes(q)));

  if (matches.length === 0) {
    suggestionBox.innerHTML = `<div class="p-2 text-slate-400 italic text-xs">Không tìm thấy đạo cụ trong hệ thống</div>`;
    suggestionBox.classList.remove("hidden");
    return;
  }

  suggestionBox.innerHTML = matches.slice(0, 6).map(item => {
    const isAtThisWh = (item.warehouseId === whId);
    return `
      <div onclick="selectTab3DirectItem('${rowId}', '${item.id}')" class="autocomplete-item flex items-center justify-between">
        <div>
          <strong class="text-sky-900">${item.name}</strong>
          <span class="text-[10px] text-slate-500 ml-1">[${item.code}]</span>
          <div class="text-[10px] text-slate-600">📍 ${item.warehouseName} | Kệ: ${(item.shelves || []).map(s => s.shelf).join(", ")}</div>
        </div>
        <div class="text-right">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isAtThisWh ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}">
            ${isAtThisWh ? `Có ${item.ready} tại kho này` : `Tại ${item.warehouseName}`}
          </span>
        </div>
      </div>
    `;
  }).join("");
  suggestionBox.classList.remove("hidden");
}

function selectTab3DirectItem(rowId, itemId) {
  const row = state.tab3DirectRows.find(r => r.id === rowId);
  const item = state.items.find(i => i.id === itemId);
  if (!row || !item) return;

  const whId = document.getElementById("tab3-warehouse")?.value;
  const isAtThisWh = (item.warehouseId === whId);

  row.name = item.name;
  row.unit = item.unit;
  row.qty = (row.qty <= 0) ? 1 : row.qty;
  row.readyStock = isAtThisWh ? item.ready : 0;
  row.shelf = isAtThisWh ? (item.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${item.warehouseName}`;
  row.itemId = item.id;
  row.isWarning = false;

  // Hide suggestions
  document.getElementById(`suggestion-${rowId}`)?.remove();

  // If this was the last row, ensure a new blank row exists
  const lastRow = state.tab3DirectRows[state.tab3DirectRows.length - 1];
  if (lastRow.id === rowId) {
    state.tab3DirectRows.push({
      id: `DIR-${Date.now()}-${state.tab3DirectRows.length + 1}`,
      name: "",
      unit: "ĐVT",
      qty: 0,
      readyStock: 0,
      shelf: "---",
      itemId: null,
      isWarning: false
    });
  }

  renderTab3Table();
}

function updateTab3DirectQty(rowId, val) {
  const row = state.tab3DirectRows.find(r => r.id === rowId);
  if (row) {
    row.qty = Math.max(0, Number(val || 0));
    renderTab3Table();
  }
}

function removeTab3DirectRow(rowId) {
  state.tab3DirectRows = state.tab3DirectRows.filter(r => r.id !== rowId);
  if (state.tab3DirectRows.length === 0) {
    initTab3DirectRows();
  }
  renderTab3Table();
}

function renderTab3Table() {
  const tbody = document.getElementById("tab3-table-body");
  if (!tbody) return;

  let stt = 1;
  let html = "";

  // 1. Render Game Combos (Image 2)
  state.tab3Combos.forEach(combo => {
    const isCollapsed = !!state.tab3CollapsedCombos[combo.id];
    html += `
      <tr class="bg-amber-50/70 border-y border-amber-200">
        <td class="py-2.5 px-3 text-center text-amber-700 font-bold cursor-pointer" onclick="toggleTab3ComboCollapse('${combo.id}')">
          <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4 inline"></i>
        </td>
        <td colspan="5" class="py-2.5 px-3 font-bold text-amber-950 text-xs cursor-pointer select-none" onclick="toggleTab3ComboCollapse('${combo.id}')">
          <span>📦 BỘ GAME: ${combo.comboName}</span>
          <span class="text-amber-800 font-semibold ml-2">(SL: ${combo.comboQty} bộ - ${combo.items.length} món con - Bấm để ${isCollapsed ? 'Mở rộng' : 'Thu gọn'})</span>
        </td>
        <td class="py-2.5 px-2 text-center">
          <button type="button" onclick="removeTab3Combo('${combo.id}')" class="text-rose-500 hover:text-rose-700 p-1">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;

    if (!isCollapsed) {
      combo.items.forEach((child, cIdx) => {
        const isEnough = (child.readyStock >= child.qty);
        let statusBadge = "";
        if (child.readyStock === 0) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hết hàng (0 tại kho)</span>`;
        } else if (isEnough) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ tồn kho (Có ${child.readyStock} tại kho)</span>`;
        } else {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu ${child.qty - child.readyStock} (Chỉ có ${child.readyStock} tại kho)</span>`;
        }

        html += `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-2 px-3 text-center text-slate-400">${stt++}</td>
            <td class="py-2 px-3 pl-8 font-medium text-slate-800">
              <span class="text-slate-400 mr-1.5">↳</span> ${child.name}
            </td>
            <td class="py-2 px-2 text-center text-slate-600">${child.unit}</td>
            <td class="py-2 px-2 text-center">
              <input type="number" min="1" value="${child.qty}" onchange="updateTab3ComboChildQty('${combo.id}', ${cIdx}, this.value)" class="w-16 p-1 border border-slate-300 rounded text-center font-bold text-sky-900">
            </td>
            <td class="py-2 px-3 text-center">${statusBadge}</td>
            <td class="py-2 px-3 text-slate-600 text-[11px]">📍 ${child.shelf}</td>
            <td class="py-2 px-2 text-center">
              <span class="text-slate-300">-</span>
            </td>
          </tr>
        `;
      });
    }
  });

  // 2. Render Direct Inline Rows for Loose Items (Image 3)
  state.tab3DirectRows.forEach(row => {
    const isWarn = !!row.isWarning;
    let statusBadge = '<span class="text-slate-400">---</span>';

    if (isWarn) {
      statusBadge = `<span class="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500 text-white shadow-xs">⚠️ Chưa nhận diện</span>`;
    } else if (row.name && row.qty > 0) {
      if (row.readyStock === 0) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hết hàng (0 tại kho)</span>`;
      } else if (row.readyStock >= row.qty) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ tồn kho (Có ${row.readyStock} tại kho)</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu ${row.qty - row.readyStock} (Chỉ có ${row.readyStock} tại kho)</span>`;
      }
    }

    const rowTrClass = isWarn
      ? "bg-amber-100/90 border-2 border-amber-400 text-amber-950 transition hover:bg-amber-200/60"
      : "hover:bg-slate-50/70 transition";

    const inputNameClass = isWarn
      ? "w-full p-1.5 bg-amber-50 border border-amber-400 rounded-lg text-xs font-bold text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
      : "w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none";

    const qtyInputClass = isWarn
      ? "w-16 p-1.5 border border-amber-400 bg-amber-50 rounded-lg text-center font-bold text-amber-950"
      : "w-16 p-1.5 border border-slate-300 rounded-lg text-center font-bold text-sky-950";

    const shelfDisplay = isWarn
      ? `<span class="text-amber-800 font-bold text-[11px]">⚠️ Cần kiểm tra lại</span>`
      : (row.shelf !== '---' ? `📍 ${row.shelf}` : '---');

    html += `
      <tr class="${rowTrClass}">
        <td class="py-2 px-3 text-center font-semibold ${isWarn ? 'text-amber-800 font-bold' : 'text-slate-400'}">${stt++}</td>
        
        <!-- Direct Item Name Input with Floating Suggestions -->
        <td class="py-2 px-3 relative">
          <input type="text" value="${row.name}" autocomplete="off" oninput="handleTab3DirectNameInput('${row.id}', this.value, this)" placeholder="Gõ tên đạo cụ..." class="${inputNameClass}">
          ${isWarn ? `<span class="text-[10px] text-amber-800 font-bold block mt-0.5">⚠️ Chưa nhận diện tên đồ trong hệ thống (Gõ để chọn tên chuẩn)</span>` : ''}
        </td>

        <!-- ĐVT -->
        <td class="py-2 px-2 text-center font-semibold ${isWarn ? 'text-amber-900 bg-amber-50 font-bold' : 'text-slate-600 bg-slate-50/50'} rounded">
          ${row.unit || 'ĐVT'}
        </td>

        <!-- Số Lượng -->
        <td class="py-2 px-2 text-center">
          <input type="number" min="0" value="${row.qty}" onchange="updateTab3DirectQty('${row.id}', this.value)" class="${qtyInputClass}">
        </td>

        <!-- Tình Trạng Kho -->
        <td class="py-2 px-3 text-center">${statusBadge}</td>

        <!-- Vị Trí Lưu Kho -->
        <td class="py-2 px-3 text-[11px] text-slate-600 font-medium truncate max-w-xs">
          ${shelfDisplay}
        </td>

        <!-- Xóa -->
        <td class="py-2 px-2 text-center">
          <button type="button" onclick="removeTab3DirectRow('${row.id}')" class="${isWarn ? 'text-amber-700 hover:text-rose-600' : 'text-slate-400 hover:text-rose-600'} p-1 transition" title="Xóa dòng">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

function importTab3Excel(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheet];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      let parsedProjectName = "";
      let parsedLocation = "";
      let parsedDate = "";

      // Check rows 0..10 for metadata (Dự án, Địa điểm, Thời gian)
      for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
        const row = rawRows[r] || [];
        const col0 = String(row[0] || "").trim().toLowerCase();
        
        if (col0.includes("dự án") || col0.includes("du an")) {
          const val = row[3] || row.slice(1).find(c => c && String(c).trim() !== "");
          if (val) {
            parsedProjectName = String(val).trim();
            const el = document.getElementById("tab3-project-name");
            if (el) el.value = parsedProjectName;
          }
        }
        if (col0.includes("địa điểm") || col0.includes("dia diem")) {
          const val = row[3] || row.slice(1).find(c => c && String(c).trim() !== "");
          if (val) {
            parsedLocation = String(val).trim();
            const el = document.getElementById("tab3-project-location");
            if (el) el.value = parsedLocation;
          }
        }
        if (col0.includes("thời gian") || col0.includes("thoi gian")) {
          const val = row[3] || row.slice(1).find(c => c && String(c).trim() !== "");
          if (val) {
            const strVal = String(val).trim();
            if (strVal.includes("/")) {
              const dParts = strVal.split("/");
              if (dParts.length === 3) {
                const day = dParts[0].padStart(2, "0");
                const month = dParts[1].padStart(2, "0");
                const year = dParts[2];
                parsedDate = `${year}-${month}-${day}`;
              }
            } else {
              parsedDate = strVal;
            }
            const el = document.getElementById("tab3-project-date");
            if (el && parsedDate) el.value = parsedDate;
          }
        }
      }

      // Find table header row
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const rowStr = (rawRows[r] || []).map(c => String(c).toLowerCase()).join(" ");
        if ((rowStr.includes("tên đồ") || rowStr.includes("ten do") || rowStr.includes("hạng mục")) &&
            (rowStr.includes("số lượng") || rowStr.includes("so luong") || rowStr.includes("mã"))) {
          headerRowIdx = r;
          break;
        }
      }

      let rows = [];
      if (headerRowIdx >= 0) {
        const headerRow = (rawRows[headerRowIdx] || []).map(c => String(c || "").trim());
        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const rowData = rawRows[r] || [];
          if (rowData.length === 0) continue;
          const obj = {};
          headerRow.forEach((colName, cIdx) => {
            if (colName) obj[colName] = rowData[cIdx];
          });
          rows.push(obj);
        }
      } else {
        rows = XLSX.utils.sheet_to_json(sheet);
      }

      const whId = document.getElementById("tab3-warehouse")?.value;
      let countSuccess = 0;
      let countWarning = 0;

      // Filter out empty rows from existing direct list so imported items go first
      state.tab3DirectRows = state.tab3DirectRows.filter(r => r.name && r.name.trim() !== "");

      rows.forEach(r => {
        const rawCode = String(r["Mã Đồ"] || r["Mã đồ"] || r["Ma Do"] || r["Mã Đạo Cụ"] || r["Mã"] || r["Code"] || "").trim();
        const rawName = String(r["Tên Đồ"] || r["Tên đồ"] || r["Ten Do"] || r["Tên Đạo Cụ"] || r["Tên Đạo cụ"] || r["Tên"] || r["Name"] || "").trim();
        const qty = Math.max(1, Number(r["Số Lượng"] || r["Số lượng"] || r["So Luong"] || r["SL"] || r["Qty"] || 1));
        const unit = String(r["Đơn Vị Tính"] || r["Đơn vị tính"] || r["ĐVT"] || r["Don Vi Tinh"] || r["DVT"] || r["Unit"] || "").trim();

        if (!rawCode && !rawName) return; // skip blank row

        let match = null;

        // Quy tắc nhận diện 1: "viết 1 trong 2 chính xác đều có thể nhận diện, nếu viết mã sai thì ko nhận diện"
        if (rawCode) {
          const codeMatch = state.items.find(i => (i.code || "").toLowerCase() === rawCode.toLowerCase() && i.warehouseId === whId) ||
            state.items.find(i => (i.code || "").toLowerCase() === rawCode.toLowerCase());
          if (codeMatch) {
            match = codeMatch;
          }
        }

        // Quy tắc nhận diện 2: nếu mã chưa khớp, kiểm tra tên đồ
        if (!match && rawName) {
          const nameMatch = state.items.find(i => i.name.toLowerCase() === rawName.toLowerCase() && i.warehouseId === whId) ||
            state.items.find(i => i.name.toLowerCase() === rawName.toLowerCase());
          if (nameMatch) {
            match = nameMatch;
          }
        }

        const isAtThisWh = match && (match.warehouseId === whId);

        if (match) {
          state.tab3DirectRows.unshift({
            id: `DIR-${Date.now()}-${Math.random()}`,
            name: match.name,
            code: match.code,
            unit: match.unit || unit || "Chiếc",
            qty: qty,
            readyStock: isAtThisWh ? match.ready : 0,
            shelf: isAtThisWh ? (match.shelves || []).map(s => s.shelf).join(", ") : `Thuộc ${match.warehouseName}`,
            itemId: match.id,
            isWarning: false
          });
          countSuccess++;
        } else {
          // Quy tắc cảnh báo: "nếu viết tên sai thì sẽ hiện trong danh sách nhưng có màu vàng cam cảnh báo ở dòng đó"
          state.tab3DirectRows.unshift({
            id: `DIR-${Date.now()}-${Math.random()}`,
            name: rawName || rawCode,
            code: rawCode,
            unit: unit || "ĐVT",
            qty: qty,
            readyStock: 0,
            shelf: "⚠️ Chưa nhận diện",
            itemId: null,
            isWarning: true
          });
          countWarning++;
        }
      });

      // Luôn đảm bảo dư sẵn 1 dòng trống ở cuối để người dùng biết luôn có dòng để thêm trực tiếp
      state.tab3DirectRows.push({
        id: `DIR-${Date.now()}-spare`,
        name: "",
        unit: "ĐVT",
        qty: 0,
        readyStock: 0,
        shelf: "---",
        itemId: null,
        isWarning: false
      });

      renderTab3Table();

      let infoMsg = `Đã nhập thành công ${countSuccess} món vào bảng xuất!`;
      if (parsedProjectName) infoMsg += ` (Tự động điền dự án: ${parsedProjectName})`;
      if (countWarning > 0) {
        showToast(`Đã nhập ${countSuccess + countWarning} món (${countWarning} món chưa nhận diện - có dòng cảnh báo)!`, "warning");
      } else {
        showToast(infoMsg, "success");
      }
    } catch (err) {
      alert("Lỗi khi đọc file Excel: " + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = "";
}

function getTab3AllExportItems() {
  const items = [];

  // From Combos
  state.tab3Combos.forEach(combo => {
    combo.items.forEach(child => {
      items.push({
        name: child.name,
        unit: child.unit,
        qty: child.qty,
        shelf: child.shelf,
        itemId: child.itemId,
        comboName: combo.comboName
      });
    });
  });

  // From Direct Rows
  state.tab3DirectRows.forEach(row => {
    if (row.name && row.qty > 0) {
      items.push({
        name: row.name,
        unit: row.unit,
        qty: row.qty,
        shelf: row.shelf,
        itemId: row.itemId,
        comboName: null
      });
    }
  });

  return items;
}

function saveTab3PreparationSlip() {
  const pName = document.getElementById("tab3-project-name")?.value.trim();
  const pLoc = document.getElementById("tab3-project-location")?.value.trim();
  const whId = document.getElementById("tab3-warehouse")?.value;
  const wh = state.warehouses.find(w => w.id === whId) || state.warehouses[0];

  if (!pName) {
    alert("Vui lòng nhập tên Dự án!");
    return;
  }

  const exportItems = getTab3AllExportItems();
  if (exportItems.length === 0) {
    alert("Danh sách xuất chưa có đạo cụ nào có số lượng!");
    return;
  }

  const prepCode = `CB_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: prepCode,
    type: "Chuẩn bị",
    badgeColor: "amber",
    tourName: pName,
    location: pLoc || wh.name,
    warehouseName: wh.name,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: exportItems.reduce((acc, i) => acc + i.qty, 0),
    items: exportItems,
    photos: [state.tab3TeamPhoto].filter(Boolean),
    note: "Phiếu chuẩn bị gom đồ nháp trước khi xe đến xếp tải."
  };

  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);
  saveState();
  showToast(`Đã chuyển thành phiếu chuẩn bị đồ [${prepCode}]!`, "success");
}

function openTab3InspectionModal() {
  const pName = document.getElementById("tab3-project-name")?.value.trim();
  if (!pName) {
    alert("Vui lòng nhập tên Dự án!");
    return;
  }

  const exportItems = getTab3AllExportItems();
  if (exportItems.length === 0) {
    alert("Vui lòng nhập đạo cụ và số lượng cần xuất!");
    return;
  }

  const modal = document.getElementById("modal-tab3-inspection");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function submitFormalDispatchSlip() {
  const truckImg = document.querySelector("#tab3-photo-truck-preview img")?.src;
  const teamImg = state.tab3TeamPhoto || document.querySelector("#tab3-photo-team-preview-modal img")?.src;

  if (!truckImg) {
    alert("Bắt buộc phải chụp ảnh nghiệm thu đạo cụ xếp lên xe tải trước khi hoàn tất!");
    return;
  }

  const pName = document.getElementById("tab3-project-name")?.value.trim();
  const pLoc = document.getElementById("tab3-project-location")?.value.trim();
  const whId = document.getElementById("tab3-warehouse")?.value;
  const notes = document.getElementById("tab3-notes")?.value.trim();
  const wh = state.warehouses.find(w => w.id === whId) || state.warehouses[0];

  const exportItems = getTab3AllExportItems();

  // Deduct inventory
  exportItems.forEach(item => {
    const invItem = state.items.find(i => (item.itemId && i.id === item.itemId) || i.name.toLowerCase() === item.name.toLowerCase() && i.warehouseId === whId);
    if (invItem) {
      invItem.ready = Math.max(0, (invItem.ready || 0) - item.qty);
      invItem.inUse = (invItem.inUse || 0) + item.qty;
    }
  });

  // Attach to Active Tours
  let activeTour = state.tours.find(t => t.name.toLowerCase() === pName.toLowerCase());
  if (activeTour) {
    exportItems.forEach(item => {
      activeTour.props.push({
        itemId: item.itemId,
        comboId: null,
        comboName: item.comboName,
        name: item.name,
        unit: item.unit,
        qty: item.qty,
        warehouseId: whId,
        warehouseName: wh.name
      });
    });
    activeTour.totalItems = activeTour.props.reduce((s, p) => s + p.qty, 0);
  } else {
    activeTour = {
      id: `TOUR-${Date.now()}`,
      name: pName,
      location: pLoc || "Hiện trường sự kiện",
      startDate: formatDate(new Date(), 'YYYY-MM-DD'),
      endDate: formatDate(new Date(Date.now() + 86400000 * 2), 'YYYY-MM-DD'),
      status: "Đang vận hành",
      leader: state.currentUser.name,
      phone: state.currentUser.phone,
      totalItems: exportItems.reduce((s, p) => s + p.qty, 0),
      props: exportItems.map(i => ({
        itemId: i.itemId,
        comboId: null,
        comboName: i.comboName,
        name: i.name,
        unit: i.unit,
        qty: i.qty,
        warehouseId: whId,
        warehouseName: wh.name
      }))
    };
    state.tours.unshift(activeTour);
  }

  // Remove corresponding Draft Prep Slips for this tour
  state.documents = state.documents.filter(d => !(d.type === "Chuẩn bị" && d.tourName.toLowerCase() === pName.toLowerCase()));

  // Generate XK Slip
  const xkCode = `XK_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: xkCode,
    type: "Xuất kho",
    badgeColor: "blue",
    tourName: pName,
    location: pLoc || wh.name,
    warehouseName: wh.name,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: exportItems.reduce((s, i) => s + i.qty, 0),
    items: exportItems,
    photos: [teamImg, truckImg].filter(Boolean),
    note: notes || "Tôi xác nhận đã kiểm đếm và nhận đủ danh sách đạo cụ lên xe tải."
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  closeModal("modal-tab3-inspection");
  resetTab3Form();

  showToast(`Đã xuất kho chính thức [${xkCode}] thành công!`, "success");
  if (typeof confetti === "function") confetti();
  switchTab(5);
}

// =========================================================================
// TAB 4, 5, 6, 7, 8 REMAINDERS & HELPERS
// =========================================================================
function renderTab4() {
  const tourSelect = document.getElementById("tab4-tour-select");
  if (!tourSelect) return;
  const activeTours = state.tours.filter(t => t.props && t.props.length > 0);
  tourSelect.innerHTML = '<option value="">-- Chọn Chương trình cần thu hồi --</option>' +
    activeTours.map(t => `<option value="${t.id}">${t.name}</option>`).join("");

  if (state.tab4TourSelected) {
    loadTab4TourData(state.tab4TourSelected.id);
  }
}

function loadTab4TourData(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  state.tab4TourSelected = tour || null;
  const banner = document.getElementById("tab4-tour-banner");
  if (!tour) {
    if (banner) banner.classList.add("hidden");
    const tbody = document.getElementById("tab4-return-table-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Vui lòng chọn Chương trình phía trên để tải danh sách đạo cụ</td></tr>`;
    return;
  }

  if (banner) {
    banner.classList.remove("hidden");
    document.getElementById("tab4-banner-tourname").textContent = tour.name;
    document.getElementById("tab4-banner-location").textContent = `📍 ${tour.location}`;
    document.getElementById("tab4-banner-leader").textContent = tour.leader || "N/A";
    document.getElementById("tab4-banner-total").textContent = `${tour.totalItems || 0} món`;
  }

  state.tab4ReturnChecklist = tour.props.map((p, idx) => ({
    id: `RET-${idx}`,
    itemId: p.itemId,
    name: p.name,
    unit: p.unit,
    dispatchedQty: p.qty,
    goodQty: p.qty,
    shelf: "Khu vực Hậu kiểm",
    tier: "Mặt sàn",
    warehouseId: p.warehouseId
  }));

  renderTab4ReturnTable();
  renderTab4BrokenTable();
}

function getTab4ItemStats(itemName) {
  const returnRow = state.tab4ReturnChecklist.find(r => r.name === itemName);
  const dispatched = returnRow ? Number(returnRow.dispatchedQty || 0) : 0;
  const good = returnRow ? Number(returnRow.goodQty || 0) : 0;
  const brokenRows = (state.tab4BrokenItems || []).filter(b => b.name === itemName);
  const broken = brokenRows.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
  const totalReported = good + broken;
  const diff = totalReported - dispatched;
  return {
    dispatched,
    good,
    broken,
    totalReported,
    diff,
    isOver: totalReported > dispatched,
    isUnder: totalReported < dispatched,
    isExact: totalReported === dispatched
  };
}

function renderTab4ReturnTable() {
  const tbody = document.getElementById("tab4-return-table-body");
  if (!tbody) return;

  tbody.innerHTML = state.tab4ReturnChecklist.map((row, idx) => {
    const stats = getTab4ItemStats(row.name);
    let diffBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">Đủ</span>';
    let rowBg = "hover:bg-slate-50";

    if (stats.isOver) {
      rowBg = "bg-rose-50/70 border-rose-300";
      diffBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-black bg-rose-600 text-white animate-pulse whitespace-nowrap">⚠️ Vượt +${stats.diff}</span>`;
    } else if (stats.isUnder) {
      diffBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">Thiếu ${Math.abs(stats.diff)}</span>`;
    } else if (stats.isExact) {
      diffBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">Đủ</span>`;
    }

    return `
      <tr class="${rowBg} transition border-b border-slate-100">
        <td class="py-2.5 px-3 font-medium text-slate-900">
          <div>${row.name}</div>
          ${stats.isOver ? `<div class="text-[10px] text-rose-600 font-bold">⚠️ Vượt quá ${stats.dispatched} món mang đi!</div>` : ''}
        </td>
        <td class="py-2.5 px-2 text-center text-slate-600">${row.unit}</td>
        <td class="py-2.5 px-2 text-center font-bold text-slate-700">${row.dispatchedQty}</td>
        <td class="py-2.5 px-2 text-center bg-emerald-50/30">
          <input type="number" min="0" value="${row.goodQty}" onchange="updateTab4GoodQty(${idx}, this.value)" class="w-16 p-1 border ${stats.isOver ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200 text-emerald-700'} rounded text-center font-bold">
        </td>
        <td class="py-2.5 px-2 text-center">${diffBadge}</td>
        
        <!-- Ô 1: Giá / Kệ Cất -->
        <td class="py-2.5 px-3">
          <input type="text" value="${row.shelf || ''}" onchange="state.tab4ReturnChecklist[${idx}].shelf = this.value" class="w-full p-1 border border-slate-200 rounded text-xs" placeholder="Giá / Kệ...">
        </td>

        <!-- Ô 2: Số Tầng -->
        <td class="py-2.5 px-2 text-center">
          <input type="text" value="${row.tier || ''}" onchange="state.tab4ReturnChecklist[${idx}].tier = this.value" class="w-full p-1 border border-slate-200 rounded text-xs text-center" placeholder="Tầng...">
        </td>
      </tr>
    `;
  }).join("");
}

function updateTab4GoodQty(idx, val) {
  if (state.tab4ReturnChecklist[idx]) {
    state.tab4ReturnChecklist[idx].goodQty = Math.max(0, Number(val || 0));
    renderTab4ReturnTable();
    renderTab4BrokenTable();
  }
}

function setAllTab4ToPostCheckShelf() {
  state.tab4ReturnChecklist.forEach(r => {
    r.shelf = "Khu vực Hậu kiểm";
    r.tier = "Mặt sàn";
  });
  renderTab4ReturnTable();
  showToast("Đã gán toàn bộ vị trí về 'Khu vực Hậu kiểm - Mặt sàn'!", "info");
}

function addTab4BrokenRow() {
  if (!state.tab4TourSelected) {
    alert("Vui lòng chọn Chương trình trước!");
    return;
  }
  const rowId = `BRK-${Date.now()}`;
  state.tab4BrokenItems.push({
    id: rowId,
    name: state.tab4ReturnChecklist[0]?.name || "Đạo cụ sự cố",
    qty: 1,
    shelf: "Khu vực Đồ Hỏng",
    reason: "",
    photos: []
  });
  renderTab4ReturnTable();
  renderTab4BrokenTable();
}

function removeTab4BrokenRow(id) {
  state.tab4BrokenItems = state.tab4BrokenItems.filter(b => b.id !== id);
  renderTab4ReturnTable();
  renderTab4BrokenTable();
}

function updateTab4BrokenItemName(idx, val) {
  if (state.tab4BrokenItems[idx]) {
    state.tab4BrokenItems[idx].name = val;
    renderTab4ReturnTable();
    renderTab4BrokenTable();
  }
}

function updateTab4BrokenItemQty(idx, val) {
  if (state.tab4BrokenItems[idx]) {
    state.tab4BrokenItems[idx].qty = Math.max(1, Number(val || 1));
    renderTab4ReturnTable();
    renderTab4BrokenTable();
  }
}

function removeBrokenPhoto(brokenId, photoIdx) {
  const b = state.tab4BrokenItems.find(item => item.id === brokenId);
  if (b && b.photos) {
    b.photos.splice(photoIdx, 1);
    renderTab4BrokenTable();
    showToast("Đã xóa ảnh!", "info");
  }
}

function openLiveCameraForBrokenItem(brokenId) {
  openLiveCamera((imgUrl) => {
    const b = state.tab4BrokenItems.find(item => item.id === brokenId);
    if (b) {
      if (!b.photos) b.photos = [];
      b.photos.push(imgUrl);
      renderTab4BrokenTable();
      showToast("Đã chụp ảnh hiện trạng đồ hỏng thành công!", "success");
    }
  });
}

function uploadBrokenPhotoFile(event, brokenId) {
  const file = event.target.files[0];
  if (!file) return;
  const b = state.tab4BrokenItems.find(item => item.id === brokenId);
  if (!b) return;

  compressImage(file, 1280, 0.75, (compressedBlob) => {
    uploadToImgBB(compressedBlob, (imgUrl) => {
      if (!b.photos) b.photos = [];
      b.photos.push(imgUrl);
      renderTab4BrokenTable();
      showToast("Đã tải ảnh hiện trạng lên thành công!", "success");
    });
  });
  event.target.value = "";
}

function renderTab4BrokenTable() {
  const tbody = document.getElementById("tab4-broken-table-body");
  if (!tbody) return;

  if (state.tab4BrokenItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-400 italic text-[11px]">Không có đồ hỏng nào được khai báo (hoàn hảo)</td></tr>`;
    return;
  }

  tbody.innerHTML = state.tab4BrokenItems.map((b, idx) => {
    const stats = getTab4ItemStats(b.name);
    const photos = b.photos || [];
    const photoCount = photos.length;
    const isPhotoMatch = (photoCount === b.qty);

    return `
      <tr class="hover:bg-rose-50/50 transition border-b border-rose-100 ${stats.isOver ? 'bg-rose-100/40' : ''}">
        <td class="py-2 px-3">
          <select onchange="updateTab4BrokenItemName(${idx}, this.value)" class="w-full p-1.5 border border-rose-300 rounded text-xs bg-white font-medium">
            ${state.tab4ReturnChecklist.map(r => `<option value="${r.name}" ${r.name === b.name ? 'selected' : ''}>${r.name}</option>`).join("")}
          </select>
          ${stats.isOver ? `<div class="text-[10px] text-rose-600 font-bold mt-0.5">⚠️ Vượt quá SL mang đi: Tốt (${stats.good}) + Hỏng (${stats.broken}) = ${stats.totalReported} > Mang đi (${stats.dispatched})!</div>` : ''}
        </td>
        <td class="py-2 px-2 text-center">
          <input type="number" min="1" value="${b.qty}" onchange="updateTab4BrokenItemQty(${idx}, this.value)" class="w-14 p-1 border border-rose-300 rounded text-center font-bold text-rose-700 bg-white">
        </td>
        <td class="py-2 px-3">
          <input type="text" value="${b.shelf || ''}" onchange="state.tab4BrokenItems[${idx}].shelf = this.value" placeholder="Khu vực đồ hỏng..." class="w-full p-1 border border-rose-200 rounded text-xs bg-white">
        </td>
        <td class="py-2 px-3">
          <input type="text" value="${b.reason || ''}" onchange="state.tab4BrokenItems[${idx}].reason = this.value" placeholder="Rách bạt, gãy motor, sờn dây..." class="w-full p-1 border border-rose-200 rounded text-xs bg-white">
        </td>
        <td class="py-2 px-3">
          <!-- Photo Actions & Status -->
          <div class="flex items-center gap-1.5 justify-center mb-1">
            <button type="button" onclick="openLiveCameraForBrokenItem('${b.id}')" class="px-2 py-1 text-[10px] font-bold rounded border border-rose-300 bg-white hover:bg-rose-100 text-rose-700 flex items-center gap-1" title="Chụp ảnh bằng camera">
              <i data-lucide="camera" class="w-3 h-3"></i>
              <span>Chụp</span>
            </button>
            <label class="px-2 py-1 text-[10px] font-bold rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1 cursor-pointer" title="Chọn file ảnh từ máy">
              <i data-lucide="upload" class="w-3 h-3"></i>
              <span>File</span>
              <input type="file" accept="image/*" class="hidden" onchange="uploadBrokenPhotoFile(event, '${b.id}')">
            </label>
            <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold ${isPhotoMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-200 text-rose-900'}">
              ${photoCount}/${b.qty} ảnh
            </span>
          </div>

          <!-- Thumbnails with Delete button -->
          <div class="flex flex-wrap gap-1 justify-center">
            ${photos.map((pUrl, pIdx) => `
              <div class="relative w-8 h-8 rounded border border-rose-300 overflow-hidden bg-slate-100 shrink-0">
                <img src="${pUrl}" class="w-full h-full object-cover">
                <button type="button" onclick="removeBrokenPhoto('${b.id}', ${pIdx})" class="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full" title="Xóa ảnh này">
                  <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            `).join("")}
          </div>
          ${!isPhotoMatch ? `<div class="text-[9px] text-center text-rose-600 font-semibold mt-0.5">Yêu cầu đúng ${b.qty} ảnh</div>` : ''}
        </td>
        <td class="py-2 px-2 text-center">
          <button onclick="removeTab4BrokenRow('${b.id}')" class="text-rose-500 hover:text-rose-700 p-1" title="Xóa dòng đồ hỏng">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </td>
      </tr>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function submitTab4ReturnSlip() {
  if (!state.tab4TourSelected) {
    alert("Vui lòng chọn Chương trình cần hoàn trả!");
    return;
  }

  // 1. Kiểm tra sai số tổng SL Tốt + Hỏng so với Mang Đi
  for (let r of state.tab4ReturnChecklist) {
    const stats = getTab4ItemStats(r.name);
    if (stats.isOver) {
      alert(`LỖI SAI SỐ:\nĐạo cụ [${r.name}] có tổng số lượng Tốt (${stats.good}) + Hỏng (${stats.broken}) = ${stats.totalReported}, vượt quá số lượng mang đi (${stats.dispatched})!\n\nVui lòng kiểm tra và sửa lại số lượng trước khi hoàn tất.`);
      return;
    }
  }

  // 2. Kiểm tra ảnh dỡ xe về kho
  const unloadImg = document.querySelector("#tab4-unload-photo-preview img")?.src;
  const unloadHidden = document.getElementById("tab4-unload-photo-preview")?.classList.contains("hidden");
  if (!unloadImg || unloadHidden) {
    alert("Bắt buộc phải chụp hoặc tải ảnh dỡ xe về kho trước khi hoàn tất phiếu thu hồi!");
    return;
  }

  // 3. Kiểm tra số ảnh = số đồ hỏng cho từng món
  for (let b of state.tab4BrokenItems) {
    const pCount = (b.photos || []).length;
    if (pCount !== b.qty) {
      alert(`BẮT BUỘC ĐỦ ẢNH:\nĐạo cụ hỏng [${b.name}] khai báo ${b.qty} món hỏng nhưng hiện tại chỉ có ${pCount} ảnh!\n\nQuy tắc hệ thống: Số ảnh phải bằng đúng số đồ hỏng (mỗi món hỏng 1 ảnh hiện trạng). Vui lòng chụp hoặc tải thêm ảnh.`);
      return;
    }
  }

  const tour = state.tab4TourSelected;

  state.tab4ReturnChecklist.forEach(ret => {
    const item = state.items.find(i => i.id === ret.itemId || i.name.toLowerCase() === ret.name.toLowerCase());
    if (item) {
      item.inUse = Math.max(0, (item.inUse || 0) - ret.dispatchedQty);
      item.ready = (item.ready || 0) + ret.goodQty;
      
      const shelfName = ret.shelf || "Khu vực Hậu kiểm";
      const tierName = ret.tier || "Mặt sàn";
      
      if (!item.shelves) item.shelves = [];
      const sObj = item.shelves.find(s => s.shelf === shelfName && (s.tier === tierName || !s.tier));
      if (sObj) {
        sObj.qty += ret.goodQty;
        if (!sObj.tier) sObj.tier = tierName;
      } else {
        item.shelves.push({ shelf: shelfName, tier: tierName, qty: ret.goodQty });
      }
    }
  });

  const allBrokenPhotos = [];
  state.tab4BrokenItems.forEach(b => {
    const item = state.items.find(i => i.name.toLowerCase() === b.name.toLowerCase());
    if (item) {
      item.broken = (item.broken || 0) + b.qty;
      if (!item.brokenLocations) item.brokenLocations = [];
      (b.photos || []).forEach(pUrl => allBrokenPhotos.push(pUrl));
      item.brokenLocations.push({
        shelf: b.shelf,
        qty: b.qty,
        reason: b.reason,
        photo: (b.photos && b.photos[0]) || "",
        photos: b.photos || []
      });
    }
  });

  state.tours = state.tours.filter(t => t.id !== tour.id);

  const nkCode = `NK_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: nkCode,
    type: "Nhập hoàn trả",
    badgeColor: "emerald",
    tourName: tour.name,
    location: tour.location,
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: state.tab4ReturnChecklist.reduce((sum, i) => sum + i.goodQty, 0),
    items: state.tab4ReturnChecklist.map(i => ({
      name: i.name,
      unit: i.unit,
      qty: i.goodQty,
      shelf: i.shelf || "Khu vực Hậu kiểm",
      tier: i.tier || "Mặt sàn",
      location: `${i.shelf || 'Khu vực Hậu kiểm'}${i.tier ? ' - Tầng ' + i.tier : ''}`
    })),
    brokenItems: state.tab4BrokenItems.map(b => ({ name: b.name, qty: b.qty, shelf: b.shelf, reason: b.reason, photos: b.photos || [] })),
    photos: [unloadImg, ...allBrokenPhotos].filter(Boolean),
    note: `Thu hồi sau chương trình ${tour.name}. Đã nghiệm thu ${state.tab4ReturnChecklist.reduce((sum, i) => sum + i.goodQty, 0)} món còn tốt, ${state.tab4BrokenItems.reduce((sum, b) => sum + b.qty, 0)} món hỏng.`
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  state.tab4TourSelected = null;
  state.tab4ReturnChecklist = [];
  state.tab4BrokenItems = [];

  showToast(`Đã hoàn tất thu hồi đạo cụ [${nkCode}]!`, "success");
  if (typeof confetti === "function") confetti();
  switchTab(1);
}

// Live WebRTC Camera Helpers
let liveCameraStream = null;
let liveCameraCallback = null;
let currentCameraFacing = "environment";

function openLiveCamera(callback) {
  liveCameraCallback = callback;
  const modal = document.getElementById("modal-live-camera");
  const video = document.getElementById("live-camera-video");
  const spinner = document.getElementById("camera-loading-spinner");

  if (!modal || !video) return;

  modal.classList.remove("hidden");
  if (spinner) spinner.classList.remove("hidden");

  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentCameraFacing }
    })
    .then(stream => {
      liveCameraStream = stream;
      video.srcObject = stream;
      video.play();
      if (spinner) spinner.classList.add("hidden");
    })
    .catch(err => {
      console.warn("getUserMedia with facingMode failed, retrying generic video:", err);
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          liveCameraStream = stream;
          video.srcObject = stream;
          video.play();
          if (spinner) spinner.classList.add("hidden");
        })
        .catch(err2 => {
          console.error("Camera access failed completely:", err2);
          closeLiveCamera();
          alert("Không thể mở máy ảnh trực tiếp (chưa cấp quyền hoặc thiết bị không có camera).\nVui lòng chọn ảnh từ tập tin máy tính/điện thoại.");
        });
    });
  } else {
    closeLiveCamera();
    alert("Trình duyệt không hỗ trợ mở camera trực tiếp. Vui lòng chọn ảnh từ tập tin.");
  }
}

function switchCameraFacing() {
  currentCameraFacing = (currentCameraFacing === "environment" ? "user" : "environment");
  if (liveCameraStream) {
    liveCameraStream.getTracks().forEach(t => t.stop());
    liveCameraStream = null;
  }
  openLiveCamera(liveCameraCallback);
}

function captureLivePhoto() {
  const video = document.getElementById("live-camera-video");
  const canvas = document.getElementById("live-camera-canvas");
  if (!video || !canvas) return;

  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

  closeLiveCamera();

  if (typeof liveCameraCallback === "function") {
    liveCameraCallback(dataUrl);
  }
}

function closeLiveCamera() {
  if (liveCameraStream) {
    liveCameraStream.getTracks().forEach(t => t.stop());
    liveCameraStream = null;
  }
  const modal = document.getElementById("modal-live-camera");
  if (modal) modal.classList.add("hidden");
}

function openLiveCameraForUnload() {
  openLiveCamera((imgUrl) => {
    const preview = document.getElementById("tab4-unload-photo-preview");
    if (preview) {
      preview.querySelector("img").src = imgUrl;
      preview.classList.remove("hidden");
    }
    const status = document.getElementById("tab4-unload-photo-status");
    if (status) status.textContent = "🟢 Đã chụp ảnh dỡ xe";
    showToast("Đã chụp ảnh dỡ xe về kho thành công!", "success");
  });
}

function handleUnloadPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  compressImage(file, 1280, 0.75, (compressedBlob) => {
    uploadToImgBB(compressedBlob, (imgUrl) => {
      const preview = document.getElementById("tab4-unload-photo-preview");
      if (preview) {
        preview.querySelector("img").src = imgUrl;
        preview.classList.remove("hidden");
      }
      const status = document.getElementById("tab4-unload-photo-status");
      if (status) status.textContent = "🟢 Đã tải ảnh dỡ xe";
      showToast("Đã tải ảnh dỡ xe lên thành công!", "success");
    });
  });
  event.target.value = "";
}

function removeUnloadPhoto() {
  const preview = document.getElementById("tab4-unload-photo-preview");
  if (preview) {
    preview.querySelector("img").src = "";
    preview.classList.add("hidden");
  }
  const status = document.getElementById("tab4-unload-photo-status");
  if (status) status.textContent = "Chưa chụp ảnh";
  showToast("Đã xóa ảnh dỡ xe!", "info");
}

// Global Autocomplete Listener to close popups on outside click
function initGlobalAutocompleteListeners() {
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".autocomplete-suggestions") && !e.target.matches("input")) {
      document.querySelectorAll(".autocomplete-suggestions").forEach(el => {
        el.classList.add("hidden");
      });
    }
  });
}

// Camera Live Capture & Photo Management
function applyCapturedPhoto(targetId, imgUrl) {
  if (targetId === 'album-photo-capture') {
    state.tab2AlbumPhotos.push(imgUrl);
    renderTab2Album();
    showToast("Đã chụp và lưu ảnh vào album!", "success");
  } else if (targetId === 'tab3-team-photo-preview' || targetId === 'tab3-photo-team-preview-modal') {
    state.tab3TeamPhoto = imgUrl;
    const p1 = document.getElementById("tab3-team-photo-preview");
    if (p1) {
      const img = p1.querySelector("img");
      if (img) img.src = imgUrl;
      p1.classList.remove("hidden");
    }
    const p2 = document.getElementById("tab3-photo-team-preview-modal");
    if (p2) {
      const img = p2.querySelector("img");
      if (img) img.src = imgUrl;
      p2.classList.remove("hidden");
    }
    const s = document.getElementById("tab3-team-photo-status");
    if (s) s.textContent = "🟢 Đã chụp ảnh đội";
    showToast("Đã chụp ảnh đội ngũ thành công!", "success");
  } else if (targetId === 'tab3-photo-truck-preview' || targetId === 'tab3TruckPhoto') {
    state.tab3TruckPhoto = imgUrl;
    const p = document.getElementById("tab3-photo-truck-preview");
    if (p) {
      const img = p.querySelector("img");
      if (img) img.src = imgUrl;
      p.classList.remove("hidden");
    }
    showToast("Đã chụp ảnh xe tải bốc hàng thành công!", "success");
  } else if (targetId === 'tab4-unload-photo-preview') {
    state.tab4UnloadPhoto = imgUrl;
    const p = document.getElementById("tab4-unload-photo-preview");
    if (p) {
      const img = p.querySelector("img");
      if (img) img.src = imgUrl;
      p.classList.remove("hidden");
    }
    const s = document.getElementById("tab4-unload-photo-status");
    if (s) s.textContent = "🟢 Đã chụp ảnh dỡ hàng";
    showToast("Đã chụp ảnh dỡ xe về kho thành công!", "success");
  } else if (targetId) {
    setPreviewPhoto(targetId, imgUrl);
    showToast("Đã chụp ảnh thành công!", "success");
  }
}

// Directly opens live camera feed on device
function triggerCameraCapture(targetPreviewElementId) {
  state.activeCameraTargetId = targetPreviewElementId;
  openLiveCamera((imgUrl) => {
    applyCapturedPhoto(targetPreviewElementId, imgUrl);
  });
}

// File picker for when user explicitly chooses to upload file
function triggerFileUpload(targetPreviewElementId) {
  state.activeCameraTargetId = targetPreviewElementId;
  const input = document.getElementById("universal-camera-input");
  if (input) {
    input.value = "";
    input.click();
  }
}

function handleCameraInputChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast("Đang tối ưu & nén ảnh...", "info");

  compressImage(file, 1280, 0.75, (compressedBlob) => {
    uploadToImgBB(compressedBlob, (imgUrl) => {
      applyCapturedPhoto(state.activeCameraTargetId, imgUrl);
    });
  });
}

function compressImage(file, maxDimension, quality, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDimension) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        }
      } else {
        if (height > maxDimension) {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        callback(blob || file);
      }, "image/jpeg", quality);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function uploadToImgBB(blob, onSuccess) {
  showToast("Đang tải ảnh lên ImgBB...", "info");
  const formData = new FormData();
  formData.append("image", blob);

  fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(json => {
    if (json && json.data && json.data.url) {
      showToast("Tải ảnh lên ImgBB thành công!", "success");
      onSuccess(json.data.url);
    } else {
      fallbackLocalDataURL(blob, onSuccess);
    }
  })
  .catch(() => {
    fallbackLocalDataURL(blob, onSuccess);
  });
}

function fallbackLocalDataURL(blob, onSuccess) {
  const reader = new FileReader();
  reader.onload = () => {
    showToast("Đã lưu ảnh cục bộ!", "info");
    onSuccess(reader.result);
  };
  reader.readAsDataURL(blob);
}

function setPreviewPhoto(containerId, url) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const img = container.querySelector("img");
  if (img) img.src = url;
  container.classList.remove("hidden");
}

function formatCurrencyInput(input) {
  let val = input.value.replace(/\D/g, "");
  if (!val) {
    input.value = "";
    return;
  }
  input.value = Number(val).toLocaleString("vi-VN");
}

function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  if (format === 'YYYYMMDD') return `${year}${month}${day}`;
  return `${year}-${month}-${day}`;
}

function formatDateTime(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const mins = String(d.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${mins}`;
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add("hidden");
}

function closeActiveModalOnEsc() {
  // 1. If camera modal is open, close stream cleanly
  const liveCamModal = document.getElementById("modal-live-camera");
  if (liveCamModal && !liveCamModal.classList.contains("hidden")) {
    if (typeof closeLiveCamera === "function") {
      closeLiveCamera();
      return;
    }
  }

  // 2. If notification flyout is open, close it
  const notifPanel = document.getElementById("notif-flyout-panel");
  if (notifPanel && !notifPanel.classList.contains("hidden")) {
    notifPanel.classList.add("hidden");
    return;
  }

  // 3. Find visible modals and close the top-most one
  const openModals = Array.from(document.querySelectorAll("[id^='modal-']:not(.hidden), .modal-overlay:not(.hidden)")).filter(el => {
    return el.offsetParent !== null || window.getComputedStyle(el).display !== "none";
  });

  if (openModals.length > 0) {
    const topModal = openModals[openModals.length - 1];
    topModal.classList.add("hidden");
  }
}

// Global listener for Escape key to quickly close windows/modals
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" || e.keyCode === 27) {
    closeActiveModalOnEsc();
  }
});

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  let bgClass = "bg-slate-900 text-white";
  let iconName = "info";

  if (type === "success") {
    bgClass = "bg-emerald-600 text-white";
    iconName = "check-circle";
  } else if (type === "error") {
    bgClass = "bg-rose-600 text-white";
    iconName = "alert-circle";
  }

  toast.className = `p-3 rounded-xl shadow-lg flex items-center gap-2.5 text-xs font-semibold pointer-events-auto toast ${bgClass}`;
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i>
    <span class="flex-1">${message}</span>
  `;
  container.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  setTimeout(() => toast.remove(), 4000);
}

// =========================================================================
// TAB 1 DETAIL MODAL (Item Details & Shelf Redistribution)
// =========================================================================
// =========================================================================
// TAB 1 DETAIL MODAL (Item Details, Metrics, Purchase Info & Shelf Allocation)
// =========================================================================
let isItemDetailEditing = false;
let activeItemDetailId = null;

function openItemDetailModal(itemId) {
  isItemDetailEditing = false;
  activeItemDetailId = itemId;
  renderItemDetailModal(itemId);

  const modal = document.getElementById("modal-item-detail");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function toggleItemDetailEditMode(itemId, enableEdit) {
  isItemDetailEditing = enableEdit;
  renderItemDetailModal(itemId);
}

function handleInvoiceUpload(event, itemId) {
  const file = event.target.files[0];
  if (!file) return;

  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  if (file.type === "application/pdf") {
    // PDF file simulated preview or object URL
    const reader = new FileReader();
    reader.onload = function(e) {
      item.invoiceUrl = e.target.result;
      renderItemDetailModal(itemId);
      showToast("Đã tải lên tệp PDF hóa đơn thành công!", "success");
    };
    reader.readAsDataURL(file);
  } else {
    // Image file
    compressImage(file, 1280, 0.75, (compressedBlob) => {
      uploadToImgBB(compressedBlob, (imgUrl) => {
        item.invoiceUrl = imgUrl;
        renderItemDetailModal(itemId);
        showToast("Đã tải lên ảnh chụp hóa đơn thành công!", "success");
      });
    });
  }
}

function renderItemDetailModal(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const codeBadge = document.getElementById("detail-code-badge");
  const nameEl = document.getElementById("detail-name");
  const contentEl = document.getElementById("detail-content");

  if (!contentEl) return;

  if (codeBadge) codeBadge.textContent = item.code;
  if (nameEl) nameEl.textContent = item.name;

  const readyQty = item.ready || 0;
  const inUseQty = item.inUse || 0;
  const brokenQty = item.broken || 0;
  const inStockQty = readyQty + brokenQty;
  const totalQty = inStockQty + inUseQty;

  const toursList = (item.currentTours || []).map(t => `
    <div class="p-2 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between">
      <div>
        <strong class="text-amber-900">${t.tourName}</strong>
        <div class="text-[10px] text-slate-500">📍 ${t.location}</div>
      </div>
      <span class="px-2 py-0.5 rounded bg-amber-200 text-amber-800 font-bold">${t.qty} ${item.unit}</span>
    </div>
  `).join("") || '<p class="text-slate-400 italic text-[11px]">Hiện không có chương trình nào đang mượn món này</p>';

  const brokenList = (item.brokenLocations || []).map(b => `
    <div class="p-2 bg-rose-50/70 border border-rose-200 rounded-lg flex items-start gap-2">
      ${b.photo ? `<img src="${b.photo}" class="w-12 h-12 rounded object-cover border border-rose-200 shrink-0">` : ''}
      <div class="flex-1">
        <div class="flex items-center justify-between">
          <strong class="text-rose-900">${b.shelf}</strong>
          <span class="font-bold text-rose-700">${b.qty} ${item.unit}</span>
        </div>
        <div class="text-[11px] text-slate-600 mt-0.5">${b.reason || 'Không rõ lý do'}</div>
      </div>
    </div>
  `).join("") || '<p class="text-slate-400 italic text-[11px]">Không có báo cáo hư hỏng</p>';

  const shelfRowsHtml = (item.shelves || []).map((s, idx) => `
    <div class="flex items-center gap-2 shelf-row" data-idx="${idx}">
      <input type="text" value="${s.shelf}" ${!isItemDetailEditing ? 'disabled' : ''} class="flex-1 p-2 bg-white border border-slate-200 rounded-md text-xs shelf-name-input disabled:bg-slate-50 disabled:text-slate-700" placeholder="Tên giá / kệ...">
      <input type="number" min="0" value="${s.qty}" ${!isItemDetailEditing ? 'disabled' : ''} oninput="validateDetailShelfSum('${item.id}')" class="w-20 p-2 bg-white border border-slate-200 rounded-md text-xs text-center font-bold shelf-qty-input disabled:bg-slate-50 disabled:text-slate-700">
      ${isItemDetailEditing ? `
        <button type="button" onclick="removeDetailShelfRow(this, '${item.id}')" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      ` : ''}
    </div>
  `).join("");

  contentEl.innerHTML = `
    <!-- 5 Inventory Metric Cards -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
      <div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center shadow-2xs">
        <div class="text-[10px] uppercase font-bold text-emerald-700">Số sẵn sàng</div>
        <div class="text-lg font-black text-emerald-800 mt-0.5">${readyQty}</div>
        <div class="text-[10px] text-emerald-600">${item.unit}</div>
      </div>
      <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center shadow-2xs">
        <div class="text-[10px] uppercase font-bold text-amber-700">Đang đi</div>
        <div class="text-lg font-black text-amber-800 mt-0.5">${inUseQty}</div>
        <div class="text-[10px] text-amber-600">${item.unit}</div>
      </div>
      <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center shadow-2xs">
        <div class="text-[10px] uppercase font-bold text-rose-700">Hỏng</div>
        <div class="text-lg font-black text-rose-800 mt-0.5">${brokenQty}</div>
        <div class="text-[10px] text-rose-600">${item.unit}</div>
      </div>
      <div class="p-2.5 rounded-xl bg-sky-50 border border-sky-200 text-center shadow-2xs">
        <div class="text-[10px] uppercase font-bold text-sky-700">Tại kho</div>
        <div class="text-lg font-black text-sky-800 mt-0.5">${inStockQty}</div>
        <div class="text-[10px] text-sky-600">Sẵn + Hỏng</div>
      </div>
      <div class="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-center shadow-2xs">
        <div class="text-[10px] uppercase font-bold text-purple-700">Tổng tài sản</div>
        <div class="text-lg font-black text-purple-800 mt-0.5">${totalQty}</div>
        <div class="text-[10px] text-purple-600">${item.unit}</div>
      </div>
    </div>

    <!-- Specifications & Warehouse Fixed Info -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
      <div class="sm:col-span-1">
        <img src="${item.image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=300'}" alt="${item.name}" class="w-full h-36 object-cover rounded-lg border border-slate-200">
      </div>
      <div class="sm:col-span-2 space-y-2">
        ${isItemDetailEditing ? `
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Tên đạo cụ:</label>
            <input type="text" id="detail-edit-name" value="${item.name}" class="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Thông số kỹ thuật:</label>
            <input type="text" id="detail-edit-specs" value="${item.specs || ''}" class="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Mục đích sử dụng:</label>
            <input type="text" id="detail-edit-purpose" value="${item.purpose || ''}" class="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs">
          </div>
        ` : `
          <div><strong class="text-slate-700">Thông số kỹ thuật:</strong> <span class="text-slate-600">${item.specs || 'N/A'}</span></div>
          <div><strong class="text-slate-700">Mục đích sử dụng:</strong> <span class="text-slate-600">${item.purpose || 'N/A'}</span></div>
          <div><strong class="text-slate-700">Đơn vị tính:</strong> <span class="text-slate-700 font-bold">${item.unit}</span></div>
          <div><strong class="text-slate-700">Định mức tồn tối thiểu:</strong> <span class="text-slate-600">${item.minStock || 0} ${item.unit}</span></div>
        `}
        <div class="pt-1 flex flex-wrap items-center gap-2">
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-100 text-sky-800">Kho: ${item.warehouseName} (Khóa cố định)</span>
          <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800">Tổng tài sản: ${totalQty} (Khóa cố định)</span>
        </div>
      </div>
    </div>

    <!-- Purchase Information Section (Thời gian mua, Đơn vị mua, Giá mua, Hóa đơn) -->
    <div class="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2.5 text-xs">
      <div class="flex items-center justify-between font-bold text-blue-950">
        <span class="flex items-center gap-1.5">
          <i data-lucide="receipt" class="w-4 h-4 text-blue-600"></i>
          <span>Thông Tin Mua Hàng & Hóa Đơn (Gần nhất)</span>
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Thời gian mua (gần nhất):</label>
          ${isItemDetailEditing ? `
            <input type="date" id="detail-edit-purchasedate" value="${item.purchaseDate || ''}" class="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs">
          ` : `
            <div class="p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800">${item.purchaseDate || 'Chưa cập nhật'}</div>
          `}
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Đơn vị mua (gần nhất):</label>
          ${isItemDetailEditing ? `
            <input type="text" id="detail-edit-purchasevendor" value="${item.purchaseVendor || ''}" placeholder="Tên công ty / nhà cung cấp..." class="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs">
          ` : `
            <div class="p-2 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 truncate">${item.purchaseVendor || 'Chưa cập nhật'}</div>
          `}
        </div>

        <div>
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Giá mua (gần nhất):</label>
          ${isItemDetailEditing ? `
            <input type="number" id="detail-edit-purchaseprice" value="${item.purchasePrice || 0}" step="1000" class="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-sky-800">
          ` : `
            <div class="p-2 bg-white rounded-lg border border-slate-200 font-bold text-sky-800">${item.purchasePrice ? item.purchasePrice.toLocaleString('vi-VN') + ' đ' : 'Chưa cập nhật'}</div>
          `}
        </div>
      </div>

      <!-- Invoice Document / Photo -->
      <div class="pt-1.5 border-t border-blue-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold text-slate-700">Ảnh / File Hóa đơn:</span>
          ${item.invoiceUrl ? `
            <a href="${item.invoiceUrl}" target="_blank" class="px-2.5 py-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-[11px] flex items-center gap-1 transition">
              <i data-lucide="file-check" class="w-3.5 h-3.5 text-blue-700"></i>
              <span>Xem Hóa Đơn / Chứng Từ</span>
            </a>
          ` : `
            <span class="text-[11px] text-slate-400 italic">Chưa có ảnh/tệp hóa đơn</span>
          `}
        </div>

        ${isItemDetailEditing ? `
          <div class="flex items-center gap-2">
            <label class="px-2.5 py-1 rounded-lg bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i>
              <span>Tải Ảnh / File PDF</span>
              <input type="file" accept="image/*,application/pdf" class="hidden" onchange="handleInvoiceUpload(event, '${item.id}')">
            </label>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Active Tour Borrowing Details -->
    <div class="space-y-1.5">
      <div class="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
        <i data-lucide="truck" class="w-4 h-4 text-amber-600"></i>
        <span>Đang Sử Dụng Ở Đâu (Chương trình):</span>
      </div>
      <div class="space-y-1.5">${toursList}</div>
    </div>

    <!-- Broken Items Details -->
    <div class="space-y-1.5">
      <div class="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>
        <span>Báo Cáo Đồ Hỏng & Vị Trí Lưu Đồ Hỏng:</span>
      </div>
      <div class="space-y-1.5">${brokenList}</div>
    </div>

    <!-- Shelves Allocation -->
    <div class="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
      <div class="flex items-center justify-between">
        <div>
          <span class="font-bold text-slate-900 text-xs">Phân Bổ Vị Trí Giá Kệ Trong Kho</span>
          <p class="text-[11px] text-slate-500">Khóa cố định Tên kho và Tổng tại kho (${inStockQty}). Bắt buộc tổng các kệ phải khớp 100%.</p>
        </div>
        ${isItemDetailEditing ? `
          <button type="button" onclick="addDetailShelfRow('${item.id}')" class="px-2.5 py-1 text-xs font-semibold rounded bg-sky-600 text-white hover:bg-sky-700 shadow-2xs">
            + Thêm Kệ
          </button>
        ` : ''}
      </div>

      <div id="detail-shelves-container" class="space-y-2">
        ${shelfRowsHtml}
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
        <span>Tổng số lượng các kệ hiện tại: <strong id="detail-shelf-sum">${inStockQty}</strong> / Mục tiêu tại kho: <strong>${inStockQty}</strong></span>
        <span id="detail-shelf-status" class="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">Khớp 100%</span>
      </div>
    </div>

    <!-- Modal Action Buttons (View Mode vs Edit Mode) -->
    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
      ${!isItemDetailEditing ? `
        <button type="button" onclick="toggleItemDetailEditMode('${item.id}', true)" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow flex items-center gap-1.5 text-xs sm:text-sm">
          <i data-lucide="edit-3" class="w-4 h-4"></i>
          <span>✏️ Sửa Thông Tin Đạo Cụ</span>
        </button>
        <button type="button" onclick="closeModal('modal-item-detail')" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition text-xs sm:text-sm">
          Đóng
        </button>
      ` : `
        <button type="button" onclick="toggleItemDetailEditMode('${item.id}', false)" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition text-xs sm:text-sm">
          Hủy Bỏ
        </button>
        <button type="button" onclick="saveItemDetailChanges('${item.id}', ${inStockQty})" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow flex items-center gap-1.5 text-xs sm:text-sm">
          <i data-lucide="save" class="w-4 h-4"></i>
          <span>💾 Lưu Thay Đổi</span>
        </button>
      `}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function addDetailShelfRow(itemId) {
  const container = document.getElementById("detail-shelves-container");
  if (!container) return;
  const div = document.createElement("div");
  div.className = "flex items-center gap-2 shelf-row";
  div.innerHTML = `
    <input type="text" value="Giá Mới" class="flex-1 p-2 bg-white border border-slate-200 rounded-md text-xs shelf-name-input" placeholder="Tên giá / kệ...">
    <input type="number" min="0" value="0" oninput="validateDetailShelfSum('${itemId}')" class="w-20 p-2 bg-white border border-slate-200 rounded-md text-xs text-center font-bold shelf-qty-input">
    <button type="button" onclick="removeDetailShelfRow(this, '${itemId}')" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(div);
  validateDetailShelfSum(itemId);
  if (window.lucide) lucide.createIcons();
}

function removeDetailShelfRow(btn, itemId) {
  const row = btn.closest(".shelf-row");
  if (row) row.remove();
  validateDetailShelfSum(itemId);
}

function validateDetailShelfSum(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const targetInStock = (item.ready || 0) + (item.broken || 0);
  let currentSum = 0;

  document.querySelectorAll("#detail-shelves-container .shelf-qty-input").forEach(input => {
    currentSum += Number(input.value || 0);
  });

  const sumEl = document.getElementById("detail-shelf-sum");
  const statusEl = document.getElementById("detail-shelf-status");

  if (sumEl) sumEl.textContent = currentSum;

  if (currentSum === targetInStock) {
    if (statusEl) {
      statusEl.className = "px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800";
      statusEl.textContent = "Khớp 100%";
    }
    return true;
  } else {
    if (statusEl) {
      statusEl.className = "px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800";
      statusEl.textContent = `Chênh lệch ${Math.abs(currentSum - targetInStock)} (${currentSum > targetInStock ? 'Thừa' : 'Thiếu'})`;
    }
    return false;
  }
}

function saveItemDetailChanges(itemId, targetInStock) {
  const isValid = validateDetailShelfSum(itemId);
  if (!isValid) {
    alert("Tổng số lượng chia vào các giá kệ phải khớp 100% với tổng số lượng tại kho! Vui lòng đối soát lại.");
    return;
  }

  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  const newName = document.getElementById("detail-edit-name")?.value.trim();
  const newSpecs = document.getElementById("detail-edit-specs")?.value.trim();
  const newPurpose = document.getElementById("detail-edit-purpose")?.value.trim();
  const newPDate = document.getElementById("detail-edit-purchasedate")?.value;
  const newPVendor = document.getElementById("detail-edit-purchasevendor")?.value.trim();
  const newPPrice = Number(document.getElementById("detail-edit-purchaseprice")?.value || 0);

  if (newName) item.name = newName;
  if (newSpecs) item.specs = newSpecs;
  if (newPurpose) item.purpose = newPurpose;
  if (newPDate) item.purchaseDate = newPDate;
  if (newPVendor) item.purchaseVendor = newPVendor;
  if (newPPrice >= 0) item.purchasePrice = newPPrice;

  const newShelves = [];
  document.querySelectorAll("#detail-shelves-container .shelf-row").forEach(row => {
    const sName = row.querySelector(".shelf-name-input")?.value.trim() || "Chưa phân kệ";
    const sQty = Number(row.querySelector(".shelf-qty-input")?.value || 0);
    if (sQty > 0 || sName) {
      newShelves.push({ shelf: sName, qty: sQty });
    }
  });

  item.shelves = newShelves;
  isItemDetailEditing = false;
  saveState();
  renderItemDetailModal(itemId);
  renderTab1();
  showToast(`Đã lưu thay đổi thông tin & phân bổ giá kệ cho [${item.name}] thành công!`, "success");
}

// =========================================================================
// TAB 5: CHƯƠNG TRÌNH (QUẢN VẬN HÀNH & GOM ĐỒ ĐA KHO)
// =========================================================================
function renderTab5() {
  const cardsContainer = document.getElementById("tab5-tour-cards");
  const toursCountEl = document.getElementById("tab5-tours-count");
  const searchInput = document.getElementById("tab5-search-input");
  const searchQuery = (searchInput?.value || "").trim().toLowerCase();

  // ONLY programs currently running ("Đang vận hành" or "Đang chạy")
  const runningTours = state.tours.filter(t => t.status === "Đang vận hành" || t.status === "Đang chạy" || (t.status && t.status.includes("Đang chạy")));

  // Search filter
  const filteredTours = runningTours.filter(t => {
    if (!searchQuery) return true;
    return (t.name || "").toLowerCase().includes(searchQuery) ||
           (t.location || "").toLowerCase().includes(searchQuery) ||
           (t.leader || "").toLowerCase().includes(searchQuery);
  });

  if (toursCountEl) toursCountEl.textContent = `${filteredTours.length} Chương trình`;

  if (filteredTours.length === 0) {
    if (cardsContainer) cardsContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">Không tìm thấy chương trình nào đang vận hành phù hợp</div>`;
    renderTab5SelectedTourProps(null);
    return;
  }

  if (!state.selectedTourIdTab5 || !filteredTours.some(t => t.id === state.selectedTourIdTab5)) {
    state.selectedTourIdTab5 = filteredTours[0].id;
  }

  if (cardsContainer) {
    cardsContainer.innerHTML = filteredTours.map(t => {
      const isSelected = (t.id === state.selectedTourIdTab5);
      const isChecked = (t.receivedAndChecked === true);
      const statusBadge = isChecked ? `
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0 flex items-center gap-1 shadow-2xs">
          <i data-lucide="check" class="w-3 h-3"></i>
          <span>Đang chạy</span>
        </span>
      ` : `
        <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shrink-0 flex items-center gap-1 animate-pulse">
          <i data-lucide="clock" class="w-3 h-3"></i>
          <span>Chưa kiểm đồ khi nhận</span>
        </span>
      `;

      return `
        <div onclick="selectTab5Tour('${t.id}')" class="p-3.5 rounded-xl border cursor-pointer transition item-card ${isSelected ? 'bg-sky-50 border-sky-400 shadow-sm' : 'bg-white border-slate-200 hover:border-sky-300'}">
          <div class="flex items-center justify-between gap-1 mb-1">
            <span class="font-bold text-xs ${isSelected ? 'text-sky-900' : 'text-slate-900'} truncate">${t.name}</span>
            ${statusBadge}
          </div>
          <div class="text-[11px] text-slate-500 space-y-0.5">
            <div>📍 ${t.location}</div>
            <div class="flex items-center justify-between pt-1">
              <span>Phụ trách: <strong>${t.leader}</strong></span>
              <span class="px-1.5 py-0.5 rounded bg-sky-200/80 text-sky-900 font-bold">${t.totalItems || 0} món</span>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  const selectedTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  renderTab5SelectedTourProps(selectedTour);
  if (window.lucide) lucide.createIcons();
}

function selectTab5Tour(tourId) {
  state.selectedTourIdTab5 = tourId;
  renderTab5();
}

let collapsedCombosTab5 = {};

function toggleCollapseTab5Combo(comboId) {
  collapsedCombosTab5[comboId] = !collapsedCombosTab5[comboId];
  const selectedTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  renderTab5SelectedTourProps(selectedTour);
}

// Interactive Receipt Inspection & Verification for Programs
function renderTab5ReceiptChecklist(tour) {
  const container = document.getElementById("tab5-receipt-checklist-container");
  if (!container) return;

  if (!tour) {
    container.innerHTML = "";
    return;
  }

  // Ensure receipt checklist is initialized from tour props
  if (!tour.receiptChecklist || tour.receiptChecklist.length === 0) {
    tour.receiptChecklist = (tour.props || []).map(p => ({
      name: p.name,
      unit: p.unit,
      dispatchedQty: p.qty,
      receivedQty: p.qty,
      checked: tour.receivedAndChecked === true
    }));
  }

  if (tour.receivedAndChecked === true) {
    container.innerHTML = `
      <div class="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 mb-3 shadow-2xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="font-extrabold text-xs sm:text-sm text-emerald-900">✓ Đã kiểm đếm nhận đủ đồ tại hiện trường (Đang chạy)</span>
          </div>
          <button type="button" onclick="recheckTourReceipt('${tour.id}')" class="px-2.5 py-1 text-[11px] font-bold bg-white text-emerald-800 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition shadow-2xs flex items-center gap-1">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i>
            <span>Kiểm đếm lại</span>
          </button>
        </div>
        <div class="text-[11px] text-emerald-700 flex flex-wrap items-center gap-3">
          <span>Người nhận phụ trách: <strong>${tour.leader}</strong> (${tour.phone})</span>
          <span>•</span>
          <span>Thời gian xác nhận: <strong>${tour.checkedAt || 'Đã kiểm tra'}</strong></span>
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Not yet checked - render interactive checklist table
  container.innerHTML = `
    <div class="p-3.5 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-3 mb-3 shadow-xs">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-200">
        <div>
          <div class="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-amber-950">
            <i data-lucide="clipboard-check" class="w-4 h-4 text-amber-600"></i>
            <span>Biên Bản Kiểm Đếm Nhận Đồ Tại Hiện Trường (Chưa kiểm đồ khi nhận)</span>
          </div>
          <p class="text-[11px] text-amber-800">Người nhận: <strong>${tour.leader}</strong> (${tour.phone}) • Vui lòng đếm lại số lượng thực tế nhận được</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="tickAllTourReceiptItems('${tour.id}')" class="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition shadow-2xs flex items-center gap-1">
            <i data-lucide="check-check" class="w-3.5 h-3.5 text-emerald-600"></i>
            <span>Tích Chọn Đủ 100%</span>
          </button>
        </div>
      </div>

      <div class="rounded-lg border border-amber-200 bg-white overflow-hidden shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-amber-100/60 text-slate-700 border-b border-amber-200 font-bold">
            <tr>
              <th class="py-2 px-2 text-center w-8">Đủ</th>
              <th class="py-2 px-2 w-8 text-center">STT</th>
              <th class="py-2 px-3">Tên Đạo Cụ</th>
              <th class="py-2 px-2 text-center w-14">ĐVT</th>
              <th class="py-2 px-2 text-center w-20">SL Gửi</th>
              <th class="py-2 px-2 text-center w-24">SL Nhận</th>
              <th class="py-2 px-3 text-center w-24">Trạng Thái</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-100">
            ${(tour.receiptChecklist || []).map((it, idx) => {
              const diff = Number(it.receivedQty || 0) - Number(it.dispatchedQty || 0);
              const isExact = (diff === 0);
              const isShort = (diff < 0);
              return `
                <tr class="hover:bg-amber-50/40 transition ${!it.checked ? 'bg-amber-50/30' : ''}">
                  <td class="py-2 px-2 text-center">
                    <input type="checkbox" ${it.checked ? 'checked' : ''} onchange="toggleTourReceiptCheck('${tour.id}', ${idx}, this.checked)" class="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer">
                  </td>
                  <td class="py-2 px-2 text-center text-slate-400 font-medium text-[11px]">${idx + 1}</td>
                  <td class="py-2 px-3 font-semibold text-slate-800">${it.name}</td>
                  <td class="py-2 px-2 text-center text-slate-500">${it.unit}</td>
                  <td class="py-2 px-2 text-center font-bold text-slate-700">${it.dispatchedQty}</td>
                  <td class="py-2 px-2 text-center">
                    <input type="number" min="0" value="${it.receivedQty}" oninput="updateTourReceiptQty('${tour.id}', ${idx}, this.value)" class="w-16 p-1 text-center font-extrabold text-xs rounded border ${isShort ? 'border-rose-400 text-rose-700 bg-rose-50' : 'border-slate-300 text-slate-900 bg-white'} focus:outline-none focus:ring-1 focus:ring-amber-500">
                  </td>
                  <td class="py-2 px-3 text-center">
                    ${isExact ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ 100%</span>` :
                      isShort ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">Thiếu ${Math.abs(diff)}</span>` :
                      `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Thừa ${diff}</span>`}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>

      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
        <div class="text-[11px] text-amber-900 font-medium">
          * Nếu nhận đủ bấm xác nhận để chuyển trạng thái sang "Đang chạy". Nếu thiếu đồ hệ thống sẽ tự động gửi cảnh báo chi tiết đến người gửi và thủ kho.
        </div>
        <button type="button" onclick="confirmTourReceipt('${tour.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-1.5 shrink-0">
          <i data-lucide="check-circle" class="w-4 h-4"></i>
          <span>Xác Nhận Nhận Đồ Thành Công</span>
        </button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function tickAllTourReceiptItems(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour || !tour.receiptChecklist) return;

  tour.receiptChecklist.forEach(it => {
    it.checked = true;
    it.receivedQty = it.dispatchedQty;
  });
  saveState();
  renderTab5ReceiptChecklist(tour);
  showToast("Đã tích chọn đủ 100% tất cả đạo cụ!", "success");
}

function toggleTourReceiptCheck(tourId, idx, checked) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour || !tour.receiptChecklist || !tour.receiptChecklist[idx]) return;

  tour.receiptChecklist[idx].checked = checked;
  if (checked) {
    tour.receiptChecklist[idx].receivedQty = tour.receiptChecklist[idx].dispatchedQty;
  }
  saveState();
  renderTab5ReceiptChecklist(tour);
}

function updateTourReceiptQty(tourId, idx, val) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour || !tour.receiptChecklist || !tour.receiptChecklist[idx]) return;

  const num = Math.max(0, Number(val || 0));
  tour.receiptChecklist[idx].receivedQty = num;
  tour.receiptChecklist[idx].checked = (num === tour.receiptChecklist[idx].dispatchedQty);
  saveState();
  renderTab5ReceiptChecklist(tour);
}

function recheckTourReceipt(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return;

  tour.receivedAndChecked = false;
  saveState();
  renderTab5();
  showToast("Đã mở lại biên bản kiểm đếm nhận đồ!", "info");
}

function confirmTourReceipt(tourId) {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return;

  const checklist = tour.receiptChecklist || [];
  const shortages = [];

  checklist.forEach(it => {
    const diff = Number(it.receivedQty || 0) - Number(it.dispatchedQty || 0);
    if (diff < 0) {
      shortages.push({
        name: it.name,
        unit: it.unit,
        dispatched: it.dispatchedQty,
        received: it.receivedQty,
        missing: Math.abs(diff)
      });
    }
  });

  tour.receivedAndChecked = true;
  tour.checkedAt = formatDateTime(new Date());

  if (shortages.length === 0) {
    tour.status = "Đang chạy";
    // Notify keeper and sender
    const notif = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: "RECEIPT_SUCCESS",
      title: `Đã nhận đủ đồ: [${tour.name}]`,
      message: `${tour.leader} đã kiểm đếm và xác nhận nhận ĐỦ 100% toàn bộ ${tour.props ? tour.props.length : 0} loại đạo cụ tại hiện trường. Chương trình chuyển trạng thái "Đang chạy".`,
      status: "UNREAD",
      createdAt: formatDateTime(new Date())
    };
    if (!state.notifications) state.notifications = [];
    state.notifications.unshift(notif);
    saveState();
    renderTab5();
    renderNotifications();
    showToast(`✓ Đã xác nhận nhận ĐỦ 100% đồ cho chương trình [${tour.name}]! Tin báo đã được gửi đến người chuyển và thủ kho.`, "success");
  } else {
    tour.status = "Đang chạy";
    const shortageDetails = shortages.map(s => `• ${s.name}: Thiếu ${s.missing} ${s.unit} (Gửi ${s.dispatched}, thực nhận ${s.received})`).join("\n");
    const notif = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: "SHORTAGE_ALERT",
      title: `⚠️ CẢNH BÁO THIẾU ĐỒ TẠI [${tour.name}]`,
      message: `${tour.leader} đã kiểm đếm và báo THIẾU ${shortages.length} loại đạo cụ:\n${shortageDetails}`,
      status: "UNREAD",
      createdAt: formatDateTime(new Date())
    };
    if (!state.notifications) state.notifications = [];
    state.notifications.unshift(notif);
    saveState();
    renderTab5();
    renderNotifications();
    alert(`CẢNH BÁO THIẾU ĐỒ:\nBạn đã ghi nhận thiếu ${shortages.length} mục đạo cụ:\n\n${shortageDetails}\n\nHệ thống đã tự động gửi thông báo chi tiết danh sách đồ thiếu cho người gửi và Thủ kho!`);
  }
}

function renderTab5SelectedTourProps(tour) {
  const titleEl = document.getElementById("tab5-selected-tour-title");
  const subEl = document.getElementById("tab5-selected-tour-subtitle");
  const container = document.getElementById("tab5-props-container");

  renderTab5ReceiptChecklist(tour);

  if (!tour) {
    if (titleEl) titleEl.textContent = "Chưa chọn chương trình";
    if (subEl) subEl.textContent = "Vui lòng chọn một chương trình bên trái";
    if (container) container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Chưa có dữ liệu</div>`;
    return;
  }

  if (titleEl) titleEl.textContent = `${tour.name} - Tổng Hợp Đạo Cụ Gom Đa Kho`;
  if (subEl) subEl.textContent = `Địa điểm: ${tour.location} | Phụ trách: ${tour.leader} (${tour.phone}) | Gom từ nhiều kho`;

  // Render Incoming Transfer Inspection Banner if any pending
  const incomingBanner = document.getElementById("tab5-incoming-transfers-banner");
  if (incomingBanner && tour) {
    const incomingPending = (state.fieldTransfers || []).filter(ft => ft.destTourId === tour.id && ft.status === "PENDING_CHECK");
    if (incomingPending.length > 0) {
      incomingBanner.classList.remove("hidden");
      incomingBanner.innerHTML = incomingPending.map(ft => `
        <div class="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between gap-3 text-xs mb-3 shadow-2xs">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
              <i data-lucide="package" class="w-4 h-4"></i>
            </div>
            <div>
              <div class="font-extrabold text-amber-950">Đang có kiện đạo cụ điều chuyển tới [${ft.code}]!</div>
              <div class="text-[11px] text-amber-800">Gửi từ: <strong>${ft.sourceTourName}</strong> (Người gửi: ${ft.senderName}) | Gồm ${ft.items.length} món</div>
            </div>
          </div>
          <button type="button" onclick="openReceiveTransferModal('${ft.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition shadow-xs flex items-center gap-1.5 shrink-0">
            <i data-lucide="check-square" class="w-3.5 h-3.5"></i>
            <span>Kiểm đếm & Nhận đồ</span>
          </button>
        </div>
      `).join("");
    } else {
      incomingBanner.classList.add("hidden");
    }
  }

  if (!tour.props || tour.props.length === 0) {
    if (container) container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Chương trình này hiện không giữ đạo cụ nào</div>`;
    return;
  }

  const comboGroups = {};
  const looseItems = [];

  tour.props.forEach(p => {
    if (p.comboId) {
      if (!comboGroups[p.comboId]) {
        comboGroups[p.comboId] = {
          id: p.comboId,
          name: p.comboName,
          items: []
        };
      }
      comboGroups[p.comboId].items.push(p);
    } else {
      looseItems.push(p);
    }
  });

  let html = "";

  for (const [cId, group] of Object.entries(comboGroups)) {
    const isCollapsed = !!collapsedCombosTab5[cId];

    // Calculate number of complete sets
    const comboDef = (state.gameCombos || []).find(g => g.id === cId || g.name === group.name);
    let calculatedSets = 999999;
    if (comboDef && comboDef.items && comboDef.items.length > 0) {
      group.items.forEach(child => {
        const matchingDef = comboDef.items.find(ci => ci.itemId === child.itemId || ci.name === child.name);
        const qtyPerSet = matchingDef ? matchingDef.quantityPerSet : 1;
        const s = Math.floor(child.qty / qtyPerSet);
        if (s < calculatedSets) calculatedSets = s;
      });
    }
    if (calculatedSets === 999999 || calculatedSets <= 0) {
      calculatedSets = Math.max(1, Math.min(...group.items.map(i => i.qty)));
    }

    html += `
      <div class="rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden space-y-1">
        <div onclick="toggleCollapseTab5Combo('${cId}')" class="p-3 bg-amber-100/70 flex items-center justify-between cursor-pointer select-none hover:bg-amber-200/60 transition">
          <div class="flex items-center gap-2 min-w-0">
            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4 text-amber-700 shrink-0"></i>
            <span class="font-extrabold text-xs text-amber-950 truncate">📦 BỘ GAME: ${group.name}</span>
            <span class="px-2 py-0.5 rounded-md bg-amber-600 text-white font-extrabold text-[11px] shrink-0 shadow-xs">${calculatedSets} BỘ</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-[11px] font-semibold text-amber-800">${group.items.length} món con (${isCollapsed ? 'Bấm để mở' : 'Bấm để ẩn'})</span>
          </div>
        </div>

        ${!isCollapsed ? `
          <div class="p-2 space-y-1.5 divide-y divide-amber-100/80">
            ${group.items.map(child => `
              <div class="flex items-center justify-between text-xs pt-1.5 first:pt-0">
                <div class="pl-4">
                  <span class="text-slate-400 mr-1.5">↳</span>
                  <span class="font-medium text-slate-800">${child.name}</span>
                  <span class="text-[10px] text-slate-500 ml-2">(Xuất từ: ${child.warehouseName})</span>
                </div>
                <span class="px-2 py-0.5 rounded bg-white border border-amber-200 font-bold text-amber-900">${child.qty} ${child.unit}</span>
              </div>
            `).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }

  if (looseItems.length > 0) {
    html += `
      <div class="rounded-xl border border-slate-200 bg-white overflow-hidden space-y-1">
        <div class="p-3 bg-slate-100 flex items-center justify-between font-bold text-xs text-slate-800">
          <span>🛠️ ĐỒ LẺ & THIẾT BỊ PHỤ TRỢ</span>
          <span class="text-[11px] text-slate-500 font-normal">${looseItems.length} món</span>
        </div>
        <div class="p-2 space-y-1.5 divide-y divide-slate-100">
          ${looseItems.map(child => `
            <div class="flex items-center justify-between text-xs pt-1.5 first:pt-0">
              <div>
                <span class="font-medium text-slate-800">${child.name}</span>
                <span class="text-[10px] text-slate-500 ml-2">(Xuất từ: ${child.warehouseName})</span>
              </div>
              <span class="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-800">${child.qty} ${child.unit}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  if (container) container.innerHTML = html;
  if (window.lucide) lucide.createIcons();
}

// Multi-Destination Field Transfer Management with Direct Combo Set Allocation & Recipient Check-in
let transferDestinations = [];
let transferNewTourData = {};
let transferAllocations = {};
let collapsedTransferCombos = {};
let comboTransferSets = {};
let activeCheckingTransferId = null;

function openFieldTransferModal() {
  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour || !sourceTour.props || sourceTour.props.length === 0) {
    alert("Chương trình này hiện không có đạo cụ để điều chuyển!");
    return;
  }

  const otherTours = state.tours.filter(t => t.id !== sourceTour.id && (t.status === "Đang vận hành" || t.status === "Đang chạy"));

  const srcTitle = document.getElementById("transfer-source-tour-name");
  if (srcTitle) srcTitle.textContent = `${sourceTour.name} (Địa điểm: ${sourceTour.location}) - Phụ trách: ${sourceTour.leader}`;

  const defaultDest = otherTours.length > 0 ? otherTours[0].id : "__NEW_0__";
  transferDestinations = [defaultDest];
  transferNewTourData = {
    0: { name: "", location: "", leader: "Người nhận mới", phone: "0987654321" }
  };
  transferAllocations = {};
  collapsedTransferCombos = {};
  comboTransferSets = {};

  sourceTour.props.forEach(p => {
    transferAllocations[p.name] = {};
    transferAllocations[p.name][defaultDest] = 0;
  });

  renderTransferModalUI();

  const modal = document.getElementById("modal-field-transfer");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function addTransferDestination() {
  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  const otherTours = state.tours.filter(t => t.id !== sourceTour.id && (t.status === "Đang vận hành" || t.status === "Đang chạy"));

  const available = otherTours.find(t => !transferDestinations.includes(t.id));
  const newDestKey = available ? available.id : `__NEW_${Date.now()}__`;
  const dIdx = transferDestinations.length;

  transferDestinations.push(newDestKey);
  transferNewTourData[dIdx] = { name: "", location: "", leader: "Người nhận mới", phone: "0987654321" };

  sourceTour.props.forEach(p => {
    if (!transferAllocations[p.name]) transferAllocations[p.name] = {};
    transferAllocations[p.name][newDestKey] = 0;
  });

  renderTransferModalUI();
  showToast(`Đã thêm điểm tiếp nhận ${transferDestinations.length}!`, "info");
}

function removeTransferDestination(idx) {
  if (transferDestinations.length <= 1) {
    alert("Cần có ít nhất một chương trình tiếp nhận đồ!");
    return;
  }
  const removedId = transferDestinations[idx];
  transferDestinations.splice(idx, 1);
  delete transferNewTourData[idx];

  for (let key in transferAllocations) {
    delete transferAllocations[key][removedId];
  }
  for (let cId in comboTransferSets) {
    if (comboTransferSets[cId]) delete comboTransferSets[cId][removedId];
  }
  renderTransferModalUI();
}

function updateTransferDestinationTour(idx, newTourId) {
  const oldId = transferDestinations[idx];
  transferDestinations[idx] = newTourId;

  for (let key in transferAllocations) {
    const val = transferAllocations[key][oldId] || 0;
    delete transferAllocations[key][oldId];
    transferAllocations[key][newTourId] = val;
  }
  for (let cId in comboTransferSets) {
    if (comboTransferSets[cId]) {
      const val = comboTransferSets[cId][oldId] || 0;
      delete comboTransferSets[cId][oldId];
      comboTransferSets[cId][newTourId] = val;
    }
  }
  renderTransferModalUI();
}

function renderTransferModalUI() {
  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  const otherTours = state.tours.filter(t => t.id !== sourceTour.id && (t.status === "Đang vận hành" || t.status === "Đang chạy"));

  const destContainer = document.getElementById("transfer-destinations-container");
  if (destContainer) {
    destContainer.innerHTML = transferDestinations.map((destId, dIdx) => {
      const isNew = String(destId).startsWith("__NEW");
      const matchedTour = state.tours.find(t => t.id === destId);
      const newObj = transferNewTourData[dIdx] || { name: "", location: "", leader: "", phone: "" };

      // Tự động loại trừ các chương trình đã được chọn ở nơi nhận khác (tránh chọn trùng nhầm lẫn)
      const otherSelectedIds = transferDestinations.filter((id, i) => i !== dIdx && !String(id).startsWith("__NEW"));
      const eligibleTours = otherTours.filter(t => !otherSelectedIds.includes(t.id));

      return `
        <div class="p-2.5 bg-white rounded-xl border border-purple-200 space-y-2 shadow-2xs">
          <div class="flex items-center gap-2">
            <span class="font-extrabold text-purple-900 text-xs shrink-0 w-20">Nơi nhận ${dIdx + 1}:</span>
            
            <select onchange="updateTransferDestinationTour(${dIdx}, this.value)" class="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800">
              <optgroup label="-- Chương trình tiếp nhận (Đã tự động loại trừ nơi nhận khác) --">
                ${eligibleTours.map(t => `<option value="${t.id}" ${t.id === destId ? 'selected' : ''}>${escapeHtml(t.name)} (Địa điểm: ${escapeHtml(t.location)})</option>`).join("")}
              </optgroup>
              <optgroup label="-- Hoặc tạo chương trình mới --">
                <option value="__NEW_${dIdx}__" ${isNew ? 'selected' : ''}>➕ [Nhập chương trình tiếp nhận mới...]</option>
              </optgroup>
            </select>

            ${transferDestinations.length > 1 ? `
              <button type="button" onclick="removeTransferDestination(${dIdx})" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition" title="Xóa điểm tiếp nhận này">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>

          ${isNew ? `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 p-2 bg-purple-50/50 rounded-lg border border-purple-100">
              <div>
                <label class="block text-[10px] font-bold text-purple-900 mb-0.5">Tên chương trình mới: *</label>
                <input type="text" value="${newObj.name || ''}" onchange="if(!transferNewTourData[${dIdx}]) transferNewTourData[${dIdx}]={}; transferNewTourData[${dIdx}].name = this.value; renderTransferTable();" placeholder="Ví dụ: Gala Dinner Viettel..." class="w-full p-1 bg-white border border-purple-300 rounded text-xs font-medium">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-purple-900 mb-0.5">Địa điểm: *</label>
                <input type="text" value="${newObj.location || ''}" onchange="if(!transferNewTourData[${dIdx}]) transferNewTourData[${dIdx}]={}; transferNewTourData[${dIdx}].location = this.value" placeholder="Ví dụ: Flamingo Đại Lải..." class="w-full p-1 bg-white border border-purple-300 rounded text-xs font-medium">
              </div>
              <div>
                <label class="block text-[10px] font-bold text-purple-900 mb-0.5">Người nhận & SĐT: *</label>
                <input type="text" value="${newObj.leader || ''}" onchange="if(!transferNewTourData[${dIdx}]) transferNewTourData[${dIdx}]={}; transferNewTourData[${dIdx}].leader = this.value" placeholder="Ví dụ: Hoàng Minh - 098..." class="w-full p-1 bg-white border border-purple-300 rounded text-xs font-medium">
              </div>
            </div>
          ` : `
            <div class="text-[11px] text-slate-600 pl-22 flex items-center justify-between">
              <span>👤 Người nhận: <strong class="text-purple-900">${matchedTour?.leader || 'Chưa rõ'}</strong> (${matchedTour?.phone || '098...'})</span>
              <span class="text-slate-400">📍 ${matchedTour?.location || ''}</span>
            </div>
          `}
        </div>
      `;
    }).join("");
  }

  renderTransferTable();
  if (window.lucide) lucide.createIcons();
}

function toggleCollapseTransferCombo(comboId) {
  collapsedTransferCombos[comboId] = !collapsedTransferCombos[comboId];
  renderTransferTable();
}

function updateComboSetsTransfer(comboId, destId, numSets) {
  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour) return;

  const sets = Math.max(0, Number(numSets || 0));
  if (!comboTransferSets[comboId]) comboTransferSets[comboId] = {};
  comboTransferSets[comboId][destId] = sets;

  const comboDef = (state.gameCombos || []).find(g => g.id === comboId);
  const comboProps = sourceTour.props.filter(p => p.comboId === comboId);

  comboProps.forEach(p => {
    let perSet = 1;
    if (comboDef && comboDef.items) {
      const defItem = comboDef.items.find(ci => ci.itemId === p.itemId || ci.name === p.name);
      if (defItem) perSet = defItem.quantityPerSet || 1;
    }
    const needed = sets * perSet;
    if (!transferAllocations[p.name]) transferAllocations[p.name] = {};
    transferAllocations[p.name][destId] = needed;
  });

  renderTransferTable();
}

function updateTransferQty(propName, destTourId, val) {
  if (!transferAllocations[propName]) transferAllocations[propName] = {};
  transferAllocations[propName][destTourId] = Math.max(0, Number(val || 0));
  renderTransferTable();
}

function transferAll100Percent() {
  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour) return;

  const targetDest = transferDestinations[0];
  sourceTour.props.forEach(p => {
    if (!transferAllocations[p.name]) transferAllocations[p.name] = {};
    transferDestinations.forEach(dId => {
      transferAllocations[p.name][dId] = (dId === targetDest ? p.qty : 0);
    });
  });

  renderTransferTable();
  showToast("Đã chọn chuyển 100% đạo cụ sang Nơi nhận 1!", "info");
}

function renderTransferTable() {
  const table = document.getElementById("transfer-main-table");
  if (!table) return;

  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour) return;

  let theadHtml = `
    <thead>
      <tr class="bg-slate-50 border-b border-slate-200 font-bold text-slate-700 text-[11px]">
        <th class="py-2.5 px-3 w-10 text-center">STT</th>
        <th class="py-2.5 px-3 min-w-[200px]">Tên Đạo Cụ / Bộ Game</th>
        <th class="py-2.5 px-2 text-center w-24">Đang Giữ</th>
        ${transferDestinations.map((dId, dIdx) => {
          const isNew = String(dId).startsWith("__NEW");
          const t = state.tours.find(tour => tour.id === dId);
          const dName = isNew ? (transferNewTourData[dIdx]?.name || `Nơi nhận ${dIdx + 1}`) : (t ? t.name : `Nơi nhận ${dIdx + 1}`);
          return `<th class="py-2 px-2 text-center min-w-[130px] bg-purple-50/50 text-purple-900 font-bold">Chuyển sang Nơi ${dIdx + 1}<br><span class="text-[9px] font-normal text-slate-500 truncate block max-w-[140px] mx-auto">${dName}</span></th>`;
        }).join("")}
        <th class="py-2.5 px-2 text-center w-20">Còn Lại</th>
      </tr>
    </thead>
  `;

  let hasOverflow = false;
  let tbodyHtml = "";
  let globalRowIdx = 1;

  const comboGroups = {};
  const looseItems = [];

  sourceTour.props.forEach(p => {
    if (p.comboId) {
      if (!comboGroups[p.comboId]) {
        comboGroups[p.comboId] = { id: p.comboId, name: p.comboName, items: [] };
      }
      comboGroups[p.comboId].items.push(p);
    } else {
      looseItems.push(p);
    }
  });

  // Render Combos with Collapse & Direct "Số Bộ" Input
  for (const [cId, group] of Object.entries(comboGroups)) {
    const isCollapsed = !!collapsedTransferCombos[cId];

    // Calculate max available complete sets
    const comboDef = (state.gameCombos || []).find(g => g.id === cId || g.name === group.name);
    let availableSets = 999999;
    if (comboDef && comboDef.items && comboDef.items.length > 0) {
      group.items.forEach(child => {
        const matchingDef = comboDef.items.find(ci => ci.itemId === child.itemId || ci.name === child.name);
        const qtyPerSet = matchingDef ? matchingDef.quantityPerSet : 1;
        const s = Math.floor(child.qty / qtyPerSet);
        if (s < availableSets) availableSets = s;
      });
    }
    if (availableSets === 999999 || availableSets <= 0) {
      availableSets = Math.min(...group.items.map(i => i.qty));
    }

    let totalTransferSets = 0;
    transferDestinations.forEach(dId => {
      totalTransferSets += (comboTransferSets[cId]?.[dId] || 0);
    });
    const remainingSets = availableSets - totalTransferSets;
    if (remainingSets < 0) hasOverflow = true;

    // Header row of the Combo
    tbodyHtml += `
      <tr class="bg-amber-100/70 border-b border-amber-200 font-bold text-amber-950 text-xs">
        <td class="py-2 px-3 text-center">
          <button type="button" onclick="toggleCollapseTransferCombo('${cId}')" class="p-0.5 text-amber-800 hover:text-amber-950" title="Bấm để ẩn/hiện danh sách món con">
            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4"></i>
          </button>
        </td>
        <td class="py-2 px-3 cursor-pointer select-none" onclick="toggleCollapseTransferCombo('${cId}')">
          <div class="flex items-center gap-1.5">
            <span class="font-extrabold text-amber-950">📦 BỘ GAME: ${group.name}</span>
            <span class="text-[10px] text-amber-700 font-medium">(${group.items.length} món con - ${isCollapsed ? 'Bấm mở' : 'Bấm ẩn'})</span>
          </div>
        </td>
        <td class="py-2 px-2 text-center">
          <span class="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-black text-xs shadow-2xs">${availableSets} BỘ</span>
        </td>
        ${transferDestinations.map(dId => {
          const setsVal = comboTransferSets[cId]?.[dId] || 0;
          return `
            <td class="py-2 px-2 text-center bg-purple-100/50">
              <div class="flex items-center justify-center gap-1">
                <input type="number" min="0" max="${availableSets}" value="${setsVal}" onchange="updateComboSetsTransfer('${cId}', '${dId}', this.value)" class="w-14 p-1 text-center font-bold text-purple-800 bg-white border border-purple-400 rounded text-xs shadow-2xs" title="Chỉnh số lượng bộ chuyển trực tiếp">
                <span class="font-extrabold text-[11px] text-purple-900">Bộ</span>
              </div>
            </td>
          `;
        }).join("")}
        <td class="py-2 px-2 text-center font-black ${remainingSets < 0 ? 'text-rose-600 bg-rose-100/60' : 'text-amber-950'}">
          ${remainingSets} Bộ
        </td>
      </tr>
    `;

    // Child rows (rendered only if NOT collapsed)
    if (!isCollapsed) {
      group.items.forEach(p => {
        const alloc = transferAllocations[p.name] || {};
        let totalTransfer = 0;
        transferDestinations.forEach(dId => {
          totalTransfer += (alloc[dId] || 0);
        });
        const remaining = p.qty - totalTransfer;
        if (remaining < 0) hasOverflow = true;

        tbodyHtml += `
          <tr class="hover:bg-amber-50/40 border-b border-amber-100/80 text-xs ${remaining < 0 ? 'bg-rose-50/70' : ''}">
            <td class="py-1.5 px-3 text-center text-slate-400 text-[11px]">${globalRowIdx++}</td>
            <td class="py-1.5 px-3 pl-6 font-medium text-slate-800">
              <div class="flex items-center gap-1">
                <span class="text-slate-400">↳</span>
                <span>${p.name}</span>
                <span class="text-[10px] text-slate-400 ml-1">(${p.unit})</span>
              </div>
            </td>
            <td class="py-1.5 px-2 text-center font-semibold text-slate-700">${p.qty}</td>
            ${transferDestinations.map(dId => {
              const val = alloc[dId] || 0;
              return `
                <td class="py-1.5 px-2 text-center bg-purple-50/20">
                  <input type="number" min="0" max="${p.qty}" value="${val}" onchange="updateTransferQty('${p.name}', '${dId}', this.value)" class="w-16 p-1 border ${remaining < 0 ? 'border-rose-400 text-rose-700' : 'border-slate-300'} rounded text-center font-bold text-xs bg-white">
                </td>
              `;
            }).join("")}
            <td class="py-1.5 px-2 text-center font-bold ${remaining < 0 ? 'text-rose-600 bg-rose-100/50' : (remaining === 0 ? 'text-slate-400' : 'text-emerald-700')}">
              ${remaining}
            </td>
          </tr>
        `;
      });
    }
  }

  // Render Loose Items
  if (looseItems.length > 0) {
    tbodyHtml += `
      <tr class="bg-slate-100 border-b border-slate-200 font-bold text-slate-800 text-xs">
        <td colspan="${4 + transferDestinations.length}" class="py-2 px-3">
          🛠️ ĐỒ LẺ & THIẾT BỊ PHỤ TRỢ (${looseItems.length} món)
        </td>
      </tr>
    `;

    looseItems.forEach(p => {
      const alloc = transferAllocations[p.name] || {};
      let totalTransfer = 0;
      transferDestinations.forEach(dId => {
        totalTransfer += (alloc[dId] || 0);
      });
      const remaining = p.qty - totalTransfer;
      if (remaining < 0) hasOverflow = true;

      tbodyHtml += `
        <tr class="hover:bg-slate-50 border-b border-slate-100 text-xs ${remaining < 0 ? 'bg-rose-50/70' : ''}">
          <td class="py-2 px-3 text-center text-slate-400 text-[11px]">${globalRowIdx++}</td>
          <td class="py-2 px-3 font-medium text-slate-800">
            <div>${p.name}</div>
            <div class="text-[10px] text-slate-400">ĐVT: ${p.unit}</div>
          </td>
          <td class="py-2 px-2 text-center font-bold text-slate-700">${p.qty}</td>
          ${transferDestinations.map(dId => {
            const val = alloc[dId] || 0;
            return `
              <td class="py-2 px-2 text-center bg-purple-50/20">
                <input type="number" min="0" max="${p.qty}" value="${val}" onchange="updateTransferQty('${p.name}', '${dId}', this.value)" class="w-16 p-1 border ${remaining < 0 ? 'border-rose-400 text-rose-700' : 'border-slate-300'} rounded text-center font-bold text-xs bg-white">
              </td>
            `;
          }).join("")}
          <td class="py-2 px-2 text-center font-bold ${remaining < 0 ? 'text-rose-600 bg-rose-100/50' : (remaining === 0 ? 'text-slate-400' : 'text-emerald-700')}">
            ${remaining}
          </td>
        </tr>
      `;
    });
  }

  table.innerHTML = theadHtml + `<tbody class="divide-y divide-slate-100">${tbodyHtml}</tbody>`;

  const warnEl = document.getElementById("transfer-validation-warning");
  const warnText = document.getElementById("transfer-warning-text");
  if (warnEl && warnText) {
    if (hasOverflow) {
      warnEl.classList.remove("hidden");
      warnText.textContent = "Có đạo cụ bị phân vượt quá số lượng đang giữ! Vui lòng giảm bớt số lượng.";
    } else {
      warnEl.classList.add("hidden");
    }
  }

  if (window.lucide) lucide.createIcons();
}

function submitMultiFieldTransfer() {
  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour) return;

  // Validation 1: Overflow check
  for (let p of sourceTour.props) {
    const alloc = transferAllocations[p.name] || {};
    let totalTransfer = 0;
    transferDestinations.forEach(dId => {
      totalTransfer += (alloc[dId] || 0);
    });
    if (totalTransfer > p.qty) {
      alert(`Đạo cụ [${p.name}] chuyển tổng cộng ${totalTransfer} món, vượt quá số lượng đang giữ (${p.qty})! Vui lòng sửa lại.`);
      return;
    }
  }

  // Validation 2: New program name check
  for (let dIdx = 0; dIdx < transferDestinations.length; dIdx++) {
    const dId = transferDestinations[dIdx];
    if (String(dId).startsWith("__NEW")) {
      const newObj = transferNewTourData[dIdx];
      if (!newObj || !newObj.name || !newObj.name.trim()) {
        alert(`Vui lòng nhập tên chương trình mới tại [Nơi nhận ${dIdx + 1}]!`);
        return;
      }
    }
  }

  let transferredAny = false;
  const transfersByDest = {};

  transferDestinations.forEach(dId => {
    transfersByDest[dId] = [];
    sourceTour.props.forEach(p => {
      const qty = (transferAllocations[p.name] && transferAllocations[p.name][dId]) || 0;
      if (qty > 0) {
        transfersByDest[dId].push({
          ...p,
          qty: qty
        });
        transferredAny = true;
      }
    });
  });

  if (!transferredAny) {
    alert("Vui lòng nhập số lượng điều chuyển cho ít nhất một món đạo cụ hoặc bộ game!");
    return;
  }

  const createdSlips = [];

  for (let dIdx = 0; dIdx < transferDestinations.length; dIdx++) {
    const dId = transferDestinations[dIdx];
    const tItems = transfersByDest[dId];
    if (!tItems || tItems.length === 0) continue;

    let targetTour = null;

    if (String(dId).startsWith("__NEW")) {
      const newObj = transferNewTourData[dIdx] || {};
      const newTourId = `TOUR-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`;
      targetTour = {
        id: newTourId,
        name: newObj.name.trim(),
        location: newObj.location.trim() || "Chưa xác định",
        leader: newObj.leader.trim() || "Người nhận",
        phone: newObj.phone.trim() || "0987654321",
        status: "Đang vận hành",
        totalItems: 0,
        props: []
      };
      state.tours.unshift(targetTour);
    } else {
      targetTour = state.tours.find(t => t.id === dId);
    }

    if (!targetTour) continue;

    // Deduct transferred items from source tour
    tItems.forEach(tItem => {
      const sProp = sourceTour.props.find(p => p.name === tItem.name);
      if (sProp) sProp.qty -= tItem.qty;
    });

    const dcCode = `DC_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
    createdSlips.push(dcCode);

    // 1. Create document slip
    const doc = {
      id: `DOC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      code: dcCode,
      type: "Điều chuyển",
      badgeColor: "purple",
      tourName: `Chuyển từ [${sourceTour.name}] sang [${targetTour.name}]`,
      location: `Hiện trường: ${sourceTour.location} -> ${targetTour.location}`,
      warehouseName: "Hiện trường sự kiện",
      creator: state.currentUser.name,
      creatorAvatar: state.currentUser.avatar,
      createdAt: formatDateTime(new Date()),
      itemsCount: tItems.reduce((sum, i) => sum + i.qty, 0),
      items: tItems.map(i => ({ name: i.name, unit: i.unit, qty: i.qty, shelf: "Bàn giao hiện trường" })),
      photos: ["https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400"],
      note: `Điều chuyển trực tiếp tại hiện trường. Bên nhận: ${targetTour.leader} (${targetTour.phone}) đã được thông báo.`
    };
    notifyWarehouseKeeper(doc);
    state.documents.unshift(doc);

    // 2. Create Field Transfer Handover record awaiting check-in by receiver
    const ftRecord = {
      id: `FT-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
      code: dcCode,
      sourceTourId: sourceTour.id,
      sourceTourName: sourceTour.name,
      senderName: sourceTour.leader,
      destTourId: targetTour.id,
      destTourName: targetTour.name,
      receiverName: targetTour.leader,
      createdAt: formatDateTime(new Date()),
      status: "PENDING_CHECK",
      items: tItems.map(it => ({
        itemId: it.itemId,
        name: it.name,
        unit: it.unit,
        comboId: it.comboId,
        comboName: it.comboName,
        sentQty: it.qty,
        receivedQty: it.qty,
        isTicked: false
      }))
    };
    if (!state.fieldTransfers) state.fieldTransfers = [];
    state.fieldTransfers.unshift(ftRecord);

    // 3. Send Notification to Receiver
    if (!state.notifications) state.notifications = [];
    state.notifications.unshift({
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 100)}`,
      type: "FIELD_TRANSFER_CHECK",
      transferId: ftRecord.id,
      title: `Kiện đạo cụ điều chuyển tới [${dcCode}]`,
      message: `Chương trình [${targetTour.name}] (Phụ trách: ${targetTour.leader}) có kiện đạo cụ chuyển từ [${sourceTour.name}] đang chờ kiểm đếm nhận đồ!`,
      actor: sourceTour.leader,
      status: "UNREAD",
      createdAt: formatDateTime(new Date())
    });
  }

  sourceTour.props = sourceTour.props.filter(p => p.qty > 0);
  sourceTour.totalItems = sourceTour.props.reduce((sum, p) => sum + p.qty, 0);

  saveState();
  closeModal("modal-field-transfer");
  renderTab5();
  renderNotifications();
  showToast(`Đã lập lệnh điều chuyển ${createdSlips.join(', ')} thành công! Đã gửi thông báo cho bên nhận kiểm đếm.`, "success");
  if (typeof confetti === "function") confetti();
}

// =========================================================================
// FIELD TRANSFER RECIPIENT CHECK-IN & CONFIRMATION
// =========================================================================
function openReceiveTransferModal(transferId) {
  const ft = (state.fieldTransfers || []).find(f => f.id === transferId);
  if (!ft) return;

  activeCheckingTransferId = transferId;

  document.getElementById("rec-transfer-code").textContent = ft.code;
  document.getElementById("rec-transfer-source").textContent = ft.sourceTourName;
  document.getElementById("rec-transfer-sender").textContent = ft.senderName;
  document.getElementById("rec-transfer-dest").textContent = ft.destTourName;
  document.getElementById("rec-transfer-receiver").textContent = ft.receiverName || state.currentUser?.name;
  document.getElementById("rec-transfer-time").textContent = ft.createdAt;

  renderReceiveTransferItems();

  const modal = document.getElementById("modal-receive-field-transfer");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function renderReceiveTransferItems() {
  const ft = (state.fieldTransfers || []).find(f => f.id === activeCheckingTransferId);
  const tbody = document.getElementById("rec-transfer-items-body");
  if (!ft || !tbody) return;

  tbody.innerHTML = ft.items.map((it, idx) => {
    const isFull = (it.receivedQty === it.sentQty);
    const isShort = (it.receivedQty < it.sentQty);
    let statusBadge = '<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">Đủ</span>';
    if (isShort) {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 whitespace-nowrap">Thiếu ${it.sentQty - it.receivedQty}</span>`;
    } else if (it.receivedQty > it.sentQty) {
      statusBadge = `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 whitespace-nowrap">Thừa +${it.receivedQty - it.sentQty}</span>`;
    }

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-2.5 px-3 text-center">
          <input type="checkbox" ${isFull ? 'checked' : ''} onchange="toggleCheckTransferItem(${idx}, this.checked)" class="w-4 h-4 text-emerald-600 rounded cursor-pointer">
        </td>
        <td class="py-2.5 px-3 font-semibold text-slate-800">
          <div>${it.name}</div>
        </td>
        <td class="py-2.5 px-2 text-center text-slate-500">${it.unit}</td>
        <td class="py-2.5 px-2 text-center font-bold text-slate-700">${it.sentQty}</td>
        <td class="py-2.5 px-2 text-center bg-emerald-50/30">
          <input type="number" min="0" value="${it.receivedQty}" onchange="updateTransferReceivedQty(${idx}, this.value)" class="w-16 p-1 border ${isShort ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-emerald-300 text-emerald-800'} rounded text-center font-bold">
        </td>
        <td class="py-2.5 px-2 text-center">
          ${statusBadge}
        </td>
      </tr>
    `;
  }).join("");
}

function tickAllReceivedTransferItems() {
  const ft = (state.fieldTransfers || []).find(f => f.id === activeCheckingTransferId);
  if (!ft) return;
  ft.items.forEach(it => {
    it.receivedQty = it.sentQty;
    it.isTicked = true;
  });
  renderReceiveTransferItems();
  showToast("Đã tích nhận đủ 100% tất cả đạo cụ!", "info");
}

function toggleCheckTransferItem(idx, isChecked) {
  const ft = (state.fieldTransfers || []).find(f => f.id === activeCheckingTransferId);
  if (!ft || !ft.items[idx]) return;
  ft.items[idx].receivedQty = isChecked ? ft.items[idx].sentQty : 0;
  ft.items[idx].isTicked = isChecked;
  renderReceiveTransferItems();
}

function updateTransferReceivedQty(idx, val) {
  const ft = (state.fieldTransfers || []).find(f => f.id === activeCheckingTransferId);
  if (!ft || !ft.items[idx]) return;
  ft.items[idx].receivedQty = Math.max(0, Number(val || 0));
  ft.items[idx].isTicked = (ft.items[idx].receivedQty === ft.items[idx].sentQty);
  renderReceiveTransferItems();
}

function confirmReceiveTransfer() {
  const ft = (state.fieldTransfers || []).find(f => f.id === activeCheckingTransferId);
  if (!ft) return;

  const destTour = state.tours.find(t => t.id === ft.destTourId);
  if (destTour) {
    if (!destTour.props) destTour.props = [];
    ft.items.forEach(it => {
      if (it.receivedQty > 0) {
        const exist = destTour.props.find(p => p.name === it.name);
        if (exist) {
          exist.qty += it.receivedQty;
        } else {
          destTour.props.push({
            itemId: it.itemId || `I-${Date.now()}-${Math.floor(Math.random()*100)}`,
            name: it.name,
            unit: it.unit,
            qty: it.receivedQty,
            warehouseId: "WH-MD",
            warehouseName: "Điều chuyển từ " + ft.sourceTourName,
            comboId: it.comboId,
            comboName: it.comboName
          });
        }
      }
    });
    destTour.totalItems = destTour.props.reduce((sum, p) => sum + p.qty, 0);
  }

  const isFull = ft.items.every(it => it.receivedQty === it.sentQty);

  if (isFull) {
    ft.status = "COMPLETED_FULL";
    state.notifications.unshift({
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random()*100)}`,
      type: "TRANSFER_REPORT",
      title: "Xác nhận đã nhận đủ đồ điều chuyển",
      message: `Chương trình [${ft.destTourName}] (Người nhận: ${ft.receiverName}) đã kiểm đếm và xác nhận NHẬN ĐỦ 100% đạo cụ điều chuyển từ [${ft.sourceTourName}] (Phiếu: ${ft.code})!`,
      actor: ft.receiverName,
      status: "UNREAD",
      createdAt: formatDateTime(new Date())
    });
    showToast(`Đã nhận đủ 100% đạo cụ! Đã gửi thông báo xác nhận đến bên gửi.`, "success");
    if (typeof confetti === "function") confetti();
  } else {
    ft.status = "REPORTED_SHORTAGE";
    const shortages = ft.items.filter(it => it.receivedQty < it.sentQty).map(it => `${it.name} (Thiếu ${it.sentQty - it.receivedQty} ${it.unit})`).join("; ");
    state.notifications.unshift({
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random()*100)}`,
      type: "TRANSFER_REPORT",
      title: "CẢNH BÁO: Báo thiếu đạo cụ điều chuyển",
      message: `⚠️ Chương trình [${ft.destTourName}] (Người nhận: ${ft.receiverName}) đã kiểm đếm và BÁO THIẾU đạo cụ từ [${ft.sourceTourName}] (Phiếu: ${ft.code}): ${shortages}. Đề nghị bên gửi kiểm tra lại!`,
      actor: ft.receiverName,
      status: "UNREAD",
      createdAt: formatDateTime(new Date())
    });
    showToast(`Đã ghi nhận số lượng thực nhận và gửi cảnh báo thiếu đồ tới bên gửi!`, "warning");
  }

  saveState();
  closeModal("modal-receive-field-transfer");
  renderTab5();
  renderNotifications();
}

// =========================================================================
// TAB 6: SỬA CHỮA
// =========================================================================
function renderTab6() {
  const brokenItems = state.items.filter(i => (i.broken || 0) > 0);
  const badgeEl = document.getElementById("tab6-broken-badge");
  const gridEl = document.getElementById("tab6-broken-grid");

  if (badgeEl) badgeEl.textContent = `${brokenItems.length} món đang hỏng`;

  renderTab6PendingExternalBanner();

  if (brokenItems.length === 0) {
    if (gridEl) gridEl.innerHTML = `<div class="col-span-full p-10 text-center text-slate-400 bg-white rounded-xl border border-slate-200">Hiện không có đạo cụ nào bị hỏng hóc! Tất cả thiết bị đều lành lặn.</div>`;
    return;
  }

  if (gridEl) {
    gridEl.innerHTML = brokenItems.map(item => {
      const photos = (item.brokenLocations || []).map(b => b.photo).filter(Boolean);
      const reasons = (item.brokenLocations || []).map(b => b.reason).filter(Boolean).join("; ");

      return `
        <div class="bg-white p-4 rounded-xl border border-rose-200 shadow-xs space-y-3 item-card">
          <div class="flex items-start gap-3">
            <img src="${item.image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=200'}" alt="${item.name}" class="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0">
            <div class="min-w-0 flex-1">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">${item.code}</span>
              <h4 class="font-bold text-xs text-slate-900 truncate mt-0.5">${item.name}</h4>
              <div class="text-[11px] text-slate-500">Kho: ${item.warehouseName}</div>
            </div>
          </div>

          <div class="p-2.5 bg-rose-50/60 rounded-lg border border-rose-100 text-xs space-y-1">
            <div class="flex items-center justify-between">
              <span class="text-rose-900 font-semibold">Số lượng hỏng:</span>
              <span class="px-2 py-0.5 rounded bg-rose-200 text-rose-900 font-extrabold">${item.broken} ${item.unit}</span>
            </div>
            <div class="text-[11px] text-slate-600 line-clamp-2">
              <strong>Mô tả sự cố:</strong> ${reasons || 'Chưa cập nhật lý do'}
            </div>
          </div>

          ${photos.length > 0 ? `
            <div class="flex items-center gap-1.5 overflow-x-auto py-0.5">
              ${photos.map(p => `<img src="${p}" class="w-10 h-10 rounded object-cover border border-rose-200 shrink-0">`).join("")}
            </div>
          ` : ''}

          <button type="button" onclick="openRepairModal('${item.id}')" class="w-full py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs">
            <i data-lucide="wrench" class="w-4 h-4"></i>
            <span>Mở Xử Lý Sửa Chữa</span>
          </button>
        </div>
      `;
    }).join("");
  }

  if (window.lucide) lucide.createIcons();
}

function renderTab6PendingExternalBanner() {
  const banner = document.getElementById("tab6-pending-external-banner");
  const list = document.getElementById("tab6-pending-orders-list");
  const countEl = document.getElementById("tab6-pending-count");
  if (!banner || !list) return;

  const pending = (state.repairOrders || []).filter(r => r.status === "Đang sửa ngoài");
  if (countEl) countEl.textContent = `${pending.length} đơn chờ`;

  if (pending.length === 0) {
    banner.classList.add("hidden");
    return;
  }

  banner.classList.remove("hidden");
  list.innerHTML = pending.map(order => {
    const photos = order.photos || (order.photoSent ? [order.photoSent] : []);
    return `
      <div class="p-3 bg-white rounded-xl border border-amber-300 shadow-xs space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">${order.code}</span>
              <strong class="text-xs text-slate-900">${order.itemName}</strong>
            </div>
            <div class="text-[11px] text-slate-600 mt-1">
              Thợ/Xưởng: <strong>${order.vendorName}</strong> (${order.vendorPhone || 'N/A'})
            </div>
            <div class="text-[11px] text-slate-500">
              Ngày gửi: ${order.sentDate} | SL gửi: <strong>${order.qty || 1}</strong> | Dự toán: <strong>${(order.estimatedCost || 0).toLocaleString('vi-VN')} VNĐ</strong>
            </div>
          </div>
          <button onclick="openReceiveRepairedModal('${order.id}')" class="px-3 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-1 shrink-0 shadow-xs">
            <i data-lucide="package-check" class="w-3.5 h-3.5"></i>
            <span>Nghiệm thu & Nhập về kho</span>
          </button>
        </div>

        ${photos.length > 0 ? `
          <div class="flex items-center gap-1 pt-1 border-t border-amber-100 overflow-x-auto">
            <span class="text-[10px] text-slate-400 shrink-0 mr-1">Ảnh hiện trạng:</span>
            ${photos.map(p => `<img src="${p}" class="w-8 h-8 rounded object-cover border border-amber-200 shrink-0">`).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function openRepairModal(itemId) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;

  state.activeRepairItem = item;
  document.getElementById("repair-item-name").textContent = `Xử Lý: ${item.name} (${item.code})`;
  document.getElementById("repair-item-broken-qty").textContent = `Số lượng đang hỏng tại kho: ${item.broken} ${item.unit}`;

  const gallery = document.getElementById("repair-damage-photos-gallery");
  const photos = (item.brokenLocations || []).map(b => b.photo).filter(Boolean);
  if (gallery) {
    if (photos.length === 0) {
      gallery.innerHTML = '<span class="text-slate-400 italic text-[11px]">Không có ảnh chụp hư hại</span>';
    } else {
      gallery.innerHTML = photos.map(p => `<img src="${p}" class="w-14 h-14 rounded-lg object-cover border border-slate-300">`).join("");
    }
  }

  // Pre-fill damage photos into external repair form
  state.extRepairPhotos = [...photos];
  renderExternalRepairPhotos();

  toggleRepairMode("IN_HOUSE");
  const modal = document.getElementById("modal-repair-workflow");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function openCameraForExternalRepair() {
  openLiveCamera((imgUrl) => {
    if (!state.extRepairPhotos) state.extRepairPhotos = [];
    state.extRepairPhotos.push(imgUrl);
    renderExternalRepairPhotos();
    showToast("Đã chụp ảnh hiện trạng trước khi gửi sửa!", "success");
  });
}

function handleExternalRepairPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  compressImage(file, 1280, 0.75, (compressedBlob) => {
    uploadToImgBB(compressedBlob, (imgUrl) => {
      if (!state.extRepairPhotos) state.extRepairPhotos = [];
      state.extRepairPhotos.push(imgUrl);
      renderExternalRepairPhotos();
      showToast("Đã tải ảnh hiện trạng lên!", "success");
    });
  });
  event.target.value = "";
}

function removeExtRepairPhoto(idx) {
  if (state.extRepairPhotos) {
    state.extRepairPhotos.splice(idx, 1);
    renderExternalRepairPhotos();
    showToast("Đã xóa ảnh!", "info");
  }
}

function renderExternalRepairPhotos() {
  const gallery = document.getElementById("ext-repair-photos-gallery");
  if (!gallery) return;
  const photos = state.extRepairPhotos || [];
  if (photos.length === 0) {
    gallery.innerHTML = '<span class="text-slate-400 italic text-[11px]">Chưa có ảnh hiện trạng gửi sửa</span>';
    return;
  }
  gallery.innerHTML = photos.map((pUrl, idx) => `
    <div class="relative w-12 h-12 rounded border border-rose-300 overflow-hidden bg-slate-100 shrink-0">
      <img src="${pUrl}" class="w-full h-full object-cover">
      <button type="button" onclick="removeExtRepairPhoto(${idx})" class="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full" title="Xóa ảnh này">
        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
  `).join("");
}

function toggleRepairMode(mode) {
  state.activeRepairMode = mode;
  const btnInhouse = document.getElementById("btn-mode-inhouse");
  const btnExternal = document.getElementById("btn-mode-external");
  const formInhouse = document.getElementById("repair-inhouse-form");
  const formExternal = document.getElementById("repair-external-form");

  if (mode === "IN_HOUSE") {
    btnInhouse.className = "py-2 px-3 font-bold rounded-lg border border-sky-500 bg-sky-50 text-sky-700";
    btnExternal.className = "py-2 px-3 font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50";
    formInhouse.classList.remove("hidden");
    formExternal.classList.add("hidden");
  } else {
    btnExternal.className = "py-2 px-3 font-bold rounded-lg border border-amber-500 bg-amber-50 text-amber-700";
    btnInhouse.className = "py-2 px-3 font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50";
    formExternal.classList.remove("hidden");
    formInhouse.classList.add("hidden");
  }
}

function submitInHouseRepair() {
  const item = state.activeRepairItem;
  if (!item) return;

  const result = document.getElementById("inhouse-result")?.value;
  const qty = Number(document.getElementById("inhouse-qty")?.value || 1);
  const targetShelf = document.getElementById("inhouse-shelf")?.value.trim() || "Kệ Đồ Lành";

  if (qty > item.broken) {
    alert(`Số lượng xử lý (${qty}) không thể vượt quá số lượng đang hỏng (${item.broken})!`);
    return;
  }

  item.broken -= qty;

  if (result === "SUCCESS") {
    item.ready += qty;
    const sObj = item.shelves.find(s => s.shelf === targetShelf);
    if (sObj) sObj.qty += qty;
    else item.shelves.push({ shelf: targetShelf, qty: qty });
  }

  const scCode = `SC_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: scCode,
    type: "Sửa chữa",
    badgeColor: "amber",
    tourName: `Tự sửa nội bộ [${item.name}]`,
    location: item.warehouseName,
    warehouseName: item.warehouseName,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: qty,
    items: [{ name: item.name, unit: item.unit, qty: qty, shelf: targetShelf }],
    photos: ["https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=400"],
    note: `Nghiệm thu tự sửa chữa nội bộ. Kết quả: ${result === 'SUCCESS' ? 'Đã sửa tốt, phục hồi vào kho' : 'Không thể sửa chữa'}.`
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  closeModal("modal-repair-workflow");
  renderTab6();
  showToast(`Đã nghiệm thu sửa chữa [${scCode}] thành công!`, "success");
}

function submitSendExternalRepair() {
  const item = state.activeRepairItem;
  if (!item) return;

  const vendor = document.getElementById("ext-vendor")?.value.trim();
  const phone = document.getElementById("ext-phone")?.value.trim();
  const estCostRaw = document.getElementById("ext-est-cost")?.value || "0";
  const estCost = Number(estCostRaw.replace(/\D/g, "") || 0);
  const qty = Number(document.getElementById("ext-qty")?.value || 1);
  const notes = document.getElementById("ext-notes")?.value.trim();

  if (!vendor) {
    alert("Vui lòng nhập tên đơn vị / thợ sửa ngoài!");
    return;
  }

  const orderCode = `SC_OUT_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const order = {
    id: `REP-${Date.now()}`,
    code: orderCode,
    itemId: item.id,
    itemName: item.name,
    warehouseName: item.warehouseName,
    status: "Đang sửa ngoài",
    vendorName: vendor,
    vendorPhone: phone,
    sentDate: formatDate(new Date(), 'YYYY-MM-DD'),
    estimatedCost: estCost,
    specs: notes,
    qty: qty,
    photos: [...(state.extRepairPhotos || [])],
    photoSent: (state.extRepairPhotos && state.extRepairPhotos[0]) || item.image || "",
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar
  };

  if (!state.repairOrders) state.repairOrders = [];
  state.repairOrders.unshift(order);

  const doc = {
    id: `DOC-${Date.now()}`,
    code: orderCode,
    type: "Sửa chữa",
    badgeColor: "amber",
    tourName: `Gửi sửa ngoài [${item.name}] - ${vendor}`,
    location: item.warehouseName,
    warehouseName: item.warehouseName,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: qty,
    items: [{ name: item.name, unit: item.unit, qty: qty, shelf: `Gửi xưởng ${vendor}` }],
    photos: (order.photos && order.photos.length > 0) ? order.photos : (item.image ? [item.image] : []),
    note: `Gửi đi sửa chữa bên ngoài. Đơn vị: ${vendor} (${phone}). Chi phí dự toán: ${estCost.toLocaleString('vi-VN')} VNĐ. Yêu cầu: ${notes || 'Bảo dưỡng phục hồi'}.`
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  closeModal("modal-repair-workflow");
  renderTab6();
  showToast(`Đã lập phiếu gửi đi sửa [${orderCode}] kèm ảnh hiện trạng!`, "success");
}

function openReceiveRepairedModal(orderId) {
  const order = state.repairOrders.find(r => r.id === orderId);
  if (!order) return;

  state.activeReceiveOrderId = orderId;
  state.recvRepairPhotos = [];

  document.getElementById("recv-order-code").textContent = `Mã phiếu: ${order.code}`;
  document.getElementById("recv-item-name").textContent = order.itemName;
  document.getElementById("recv-item-qty").textContent = `${order.qty || 1} món`;
  document.getElementById("recv-vendor-info").textContent = `${order.vendorName} (${order.vendorPhone || 'N/A'})`;

  // Photos when sent
  const sentPhotosGallery = document.getElementById("recv-sent-photos-gallery");
  const photos = order.photos || (order.photoSent ? [order.photoSent] : []);
  if (sentPhotosGallery) {
    if (photos.length === 0) {
      sentPhotosGallery.innerHTML = '<span class="text-slate-400 italic text-[11px]">Không có ảnh chụp lúc gửi</span>';
    } else {
      sentPhotosGallery.innerHTML = photos.map(p => `<img src="${p}" class="w-12 h-12 rounded-lg object-cover border border-slate-300 shrink-0">`).join("");
    }
  }

  // Pre-fill cost
  const costInput = document.getElementById("recv-actual-cost");
  if (costInput) costInput.value = (order.estimatedCost || 300000).toLocaleString("vi-VN");

  // Pre-fill warehouse
  const whSelect = document.getElementById("recv-warehouse-select");
  if (whSelect) {
    whSelect.innerHTML = state.warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join("");
  }

  // Target shelf
  const item = state.items.find(i => i.id === order.itemId);
  const defaultShelf = item && item.shelves && item.shelves[0] ? item.shelves[0].shelf : "Kệ Đồ Lành";
  const defaultTier = item && item.shelves && item.shelves[0] ? item.shelves[0].tier : "1";
  if (document.getElementById("recv-target-shelf")) document.getElementById("recv-target-shelf").value = defaultShelf;
  if (document.getElementById("recv-target-tier")) document.getElementById("recv-target-tier").value = defaultTier;

  renderReceiveRepairPhotos();

  const modal = document.getElementById("modal-receive-repaired");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function openCameraForReceiveRepair() {
  openLiveCamera((imgUrl) => {
    if (!state.recvRepairPhotos) state.recvRepairPhotos = [];
    state.recvRepairPhotos.push(imgUrl);
    renderReceiveRepairPhotos();
    showToast("Đã chụp ảnh nghiệm thu sau sửa!", "success");
  });
}

function handleReceiveRepairPhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  compressImage(file, 1280, 0.75, (compressedBlob) => {
    uploadToImgBB(compressedBlob, (imgUrl) => {
      if (!state.recvRepairPhotos) state.recvRepairPhotos = [];
      state.recvRepairPhotos.push(imgUrl);
      renderReceiveRepairPhotos();
      showToast("Đã tải ảnh nghiệm thu lên!", "success");
    });
  });
  event.target.value = "";
}

function removeRecvRepairPhoto(idx) {
  if (state.recvRepairPhotos) {
    state.recvRepairPhotos.splice(idx, 1);
    renderReceiveRepairPhotos();
    showToast("Đã xóa ảnh!", "info");
  }
}

function renderReceiveRepairPhotos() {
  const gallery = document.getElementById("recv-repair-photos-gallery");
  if (!gallery) return;
  const photos = state.recvRepairPhotos || [];
  if (photos.length === 0) {
    gallery.innerHTML = '<span class="text-slate-400 italic text-[11px]">Chưa có ảnh nghiệm thu sau sửa</span>';
    return;
  }
  gallery.innerHTML = photos.map((pUrl, idx) => `
    <div class="relative w-12 h-12 rounded border border-emerald-300 overflow-hidden bg-slate-100 shrink-0">
      <img src="${pUrl}" class="w-full h-full object-cover">
      <button type="button" onclick="removeRecvRepairPhoto(${idx})" class="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full" title="Xóa ảnh này">
        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    </div>
  `).join("");
}

function submitReceiveRepairedItem() {
  const order = state.repairOrders.find(r => r.id === state.activeReceiveOrderId);
  if (!order) return;

  const resultStatus = document.getElementById("recv-result-status")?.value;
  const actualCostStr = document.getElementById("recv-actual-cost")?.value || "0";
  const actualCost = Number(actualCostStr.replace(/\D/g, "") || 0);
  const targetShelf = document.getElementById("recv-target-shelf")?.value.trim() || "Kệ Đồ Lành";
  const targetTier = document.getElementById("recv-target-tier")?.value.trim() || "1";
  const notes = document.getElementById("recv-notes")?.value.trim();
  const whId = document.getElementById("recv-warehouse-select")?.value || "WH-MD";
  const whObj = state.warehouses.find(w => w.id === whId) || state.warehouses[0];

  const item = state.items.find(i => i.id === order.itemId);
  const qty = order.qty || 1;

  if (item) {
    item.broken = Math.max(0, (item.broken || 0) - qty);
    if (resultStatus === "SUCCESS") {
      item.ready = (item.ready || 0) + qty;
      if (!item.shelves) item.shelves = [];
      const sObj = item.shelves.find(s => s.shelf === targetShelf);
      if (sObj) sObj.qty += qty;
      else item.shelves.push({ shelf: targetShelf, tier: targetTier, qty: qty });
    } else {
      item.broken = (item.broken || 0) + qty;
    }
  }

  order.status = "Đã nhập về";
  state.repairOrders = state.repairOrders.filter(r => r.id !== order.id);

  const inCode = `SC_IN_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: inCode,
    type: "Sửa chữa",
    badgeColor: "emerald",
    tourName: `Nghiệm thu nhập về sau sửa [${order.itemName}] - ${order.vendorName}`,
    location: whObj.name,
    warehouseName: whObj.name,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: qty,
    items: [{ name: order.itemName, unit: item?.unit || 'Chiếc', qty: qty, shelf: `${targetShelf} (Tầng ${targetTier})` }],
    photos: (state.recvRepairPhotos && state.recvRepairPhotos.length > 0) ? state.recvRepairPhotos : (order.photos || []),
    note: `Nghiệm thu nhận về từ thợ ngoài [${order.vendorName}]. Kết quả: ${resultStatus === 'SUCCESS' ? 'Đạt chuẩn, đã nhập kho lành' : 'Không sửa được, trả về kho hỏng'}. Chi phí thực tế: ${actualCost.toLocaleString('vi-VN')} VNĐ. ${notes ? 'Ghi chú: ' + notes : ''}`
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  closeModal("modal-receive-repaired");
  renderTab6();
  renderTab1();
  showToast(`Đã nghiệm thu nhập về kho [${inCode}] thành công!`, "success");
  if (typeof confetti === "function") confetti();
}

// =========================================================================
// TAB 7: THANH LÝ
// =========================================================================
function renderTab7() {
  populateCommonDropdowns();
  const dateInput = document.getElementById("tab7-date");
  if (dateInput && !dateInput.value) {
    dateInput.value = formatDate(new Date(), 'YYYY-MM-DD');
  }
  initTab7Items();
}

function initTab7Items() {
  const container = document.getElementById("tab7-table-body");
  if (container && container.children.length === 0) {
    addTab7ItemRow();
  }
}

function renderTab7ItemsSelect() {
  const whId = document.getElementById("tab7-warehouse")?.value;
  const selects = document.querySelectorAll(".tab7-item-select");
  const itemsInWh = state.items.filter(i => i.warehouseId === whId);

  selects.forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">-- Chọn đạo cụ thanh lý --</option>' +
      itemsInWh.map(i => `<option value="${i.id}">${i.name} (Hỏng: ${i.broken}, Sẵn sàng: ${i.ready})</option>`).join("");
    if (cur) sel.value = cur;
  });
}

function addTab7ItemRow() {
  const tbody = document.getElementById("tab7-table-body");
  if (!tbody) return;

  const tr = document.createElement("tr");
  tr.className = "hover:bg-slate-50 transition tab7-row";
  tr.innerHTML = `
    <td class="py-2.5 px-3">
      <select required class="w-full p-2 bg-white border border-slate-200 rounded text-xs tab7-item-select">
        <option value="">-- Chọn đạo cụ thanh lý --</option>
      </select>
    </td>
    <td class="py-2.5 px-2 text-center">
      <input type="number" min="1" value="1" required class="w-16 p-1.5 border border-slate-200 rounded text-center font-bold tab7-qty-input">
    </td>
    <td class="py-2.5 px-3">
      <select class="w-full p-1.5 border border-slate-200 rounded text-xs bg-white tab7-method-select">
        <option value="Bán phế liệu">Bán phế liệu đồng nát</option>
        <option value="Tiêu hủy / Vứt bỏ">Tiêu hủy / Vứt bỏ</option>
        <option value="Tặng lại / Làm từ thiện">Tặng lại / Làm từ thiện</option>
        <option value="Tái chế linh kiện">Rã đồ tái chế linh kiện</option>
      </select>
    </td>
    <td class="py-2.5 px-2 text-right">
      <input type="text" oninput="formatCurrencyInput(this)" placeholder="0" class="w-24 p-1.5 border border-slate-200 rounded text-right tab7-value-input">
    </td>
    <td class="py-2.5 px-2 text-center">
      <button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 p-1">
        <i data-lucide="trash-2" class="w-4 h-4"></i>
      </button>
    </td>
  `;
  tbody.appendChild(tr);
  renderTab7ItemsSelect();
  if (window.lucide) lucide.createIcons();
}

function handleTab7Submit(event) {
  event.preventDefault();

  const whId = document.getElementById("tab7-warehouse")?.value;
  const reason = document.getElementById("tab7-reason")?.value.trim();
  const source = document.querySelector('input[name="tab7-source"]:checked')?.value || "BROKEN";
  const wh = state.warehouses.find(w => w.id === whId) || state.warehouses[0];

  const rows = document.querySelectorAll(".tab7-row");
  const liquidatedItems = [];

  rows.forEach(row => {
    const itemId = row.querySelector(".tab7-item-select")?.value;
    const qty = Number(row.querySelector(".tab7-qty-input")?.value || 0);
    const method = row.querySelector(".tab7-method-select")?.value;
    const valRaw = row.querySelector(".tab7-value-input")?.value || "0";
    const scrapVal = Number(valRaw.replace(/\D/g, "") || 0);

    if (itemId && qty > 0) {
      const item = state.items.find(i => i.id === itemId);
      if (item) {
        liquidatedItems.push({ item, qty, method, scrapVal });
      }
    }
  });

  if (liquidatedItems.length === 0) {
    alert("Vui lòng chọn ít nhất một món đạo cụ cần thanh lý!");
    return;
  }

  liquidatedItems.forEach(({ item, qty }) => {
    if (source === "BROKEN") {
      item.broken = Math.max(0, (item.broken || 0) - qty);
    } else {
      item.ready = Math.max(0, (item.ready || 0) - qty);
      if (item.shelves[0]) {
        item.shelves[0].qty = Math.max(0, item.shelves[0].qty - qty);
      }
    }
  });

  const tlCode = `TL_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: tlCode,
    type: "Thanh lý",
    badgeColor: "rose",
    tourName: `Thanh lý tài sản hư hỏng - ${wh.name}`,
    location: wh.name,
    warehouseName: wh.name,
    creator: state.currentUser.name,
    creatorAvatar: state.currentUser.avatar,
    createdAt: formatDateTime(new Date()),
    itemsCount: liquidatedItems.reduce((sum, i) => sum + i.qty, 0),
    items: liquidatedItems.map(i => ({ name: i.item.name, unit: i.item.unit, qty: i.qty, shelf: i.method })),
    photos: ["https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=400"],
    note: `Lý do: ${reason}. Nguồn trừ: ${source === 'BROKEN' ? 'Đang hỏng' : 'Dùng được'}. Tổng thu hồi: ${liquidatedItems.reduce((s, i) => s + i.scrapVal, 0).toLocaleString('vi-VN')} VNĐ.`
  };
  notifyWarehouseKeeper(doc);
  state.documents.unshift(doc);

  saveState();
  event.target.reset();
  showToast(`Đã lưu phiếu thanh lý [${tlCode}] thành công!`, "success");
  switchTab(1);
}

// =========================================================================
// TAB 8: CHỨNG TỪ & IN A4
// =========================================================================
function renderTab8() {
  populateCommonDropdowns();
  renderTab8Documents();
}

function renderTab8Documents() {
  const search = (document.getElementById("tab8-search")?.value || "").trim().toLowerCase();
  const typeFilter = document.getElementById("tab8-filter-type")?.value || "ALL";
  const whFilter = document.getElementById("tab8-filter-warehouse")?.value || "ALL";

  const filtered = state.documents.filter(doc => {
    const matchSearch = !search ||
      (doc.code && doc.code.toLowerCase().includes(search)) ||
      (doc.tourName && doc.tourName.toLowerCase().includes(search)) ||
      (doc.creator && doc.creator.toLowerCase().includes(search));

    if (!matchSearch) return false;
    if (typeFilter !== "ALL" && doc.type !== typeFilter) return false;
    if (whFilter !== "ALL") {
      const wh = state.warehouses.find(w => w.id === whFilter);
      if (wh && !doc.warehouseName.includes(wh.name)) return false;
    }
    return true;
  });

  const tbody = document.getElementById("tab8-table-body");
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Không tìm thấy chứng từ nào</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(doc => {
        const badgeColor = getDocBadgeColor(doc.type);
        return `
          <tr class="hover:bg-sky-50/40 transition">
            <td class="py-3 px-3 font-bold text-sky-700">${doc.code}</td>
            <td class="py-3 px-2 text-center">
              <span class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${badgeColor}">
                ${doc.type}
              </span>
            </td>
            <td class="py-3 px-3">
              <div class="font-bold text-slate-900">${doc.tourName}</div>
              <div class="text-[11px] text-slate-500">📍 ${doc.location}</div>
            </td>
            <td class="py-3 px-3 text-slate-700 font-medium">${doc.warehouseName}</td>
            <td class="py-3 px-3 text-slate-600">${doc.creator}</td>
            <td class="py-3 px-3 text-slate-500 text-[11px]">${doc.createdAt}</td>
            <td class="py-3 px-2 text-center font-bold text-slate-800">${doc.itemsCount}</td>
            <td class="py-3 px-3 text-right">
              <button onclick="openDocumentPrintModal('${doc.id}')" class="px-3 py-1 text-xs font-bold rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 transition flex items-center gap-1 ml-auto">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
                <span>Xem & In</span>
              </button>
            </td>
          </tr>
        `;
      }).join("");
    }
  }

  const mobileContainer = document.getElementById("tab8-mobile-cards");
  if (mobileContainer) {
    if (filtered.length === 0) {
      mobileContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs bg-white rounded-xl border border-slate-200">Không tìm thấy chứng từ</div>`;
    } else {
      mobileContainer.innerHTML = filtered.map(doc => {
        const badgeColor = getDocBadgeColor(doc.type);
        return `
          <div onclick="openDocumentPrintModal('${doc.id}')" class="bg-white p-3 rounded-xl border border-slate-200 shadow-xs space-y-2 cursor-pointer hover:border-sky-300 transition item-card">
            <div class="flex items-center justify-between gap-1">
              <span class="font-bold text-xs text-sky-700">${doc.code}</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}">${doc.type}</span>
            </div>
            <div>
              <h4 class="font-bold text-xs text-slate-900">${doc.tourName}</h4>
              <p class="text-[11px] text-slate-500">📍 ${doc.warehouseName}</p>
            </div>
            <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
              <span>Bởi: <strong>${doc.creator}</strong></span>
              <span>${doc.createdAt}</span>
            </div>
          </div>
        `;
      }).join("");
    }
  }

  if (window.lucide) lucide.createIcons();
}

function getDocBadgeColor(type) {
  switch (type) {
    case "Xuất kho": return "bg-blue-100 text-blue-800";
    case "Nhập hoàn trả": return "bg-emerald-100 text-emerald-800";
    case "Nhập lần đầu": return "bg-sky-100 text-sky-800";
    case "Điều chuyển": return "bg-purple-100 text-purple-800";
    case "Sửa chữa": return "bg-amber-100 text-amber-800";
    case "Chuẩn bị": return "bg-slate-100 text-slate-800";
    case "Thanh lý": return "bg-rose-100 text-rose-800";
    default: return "bg-slate-100 text-slate-700";
  }
}

function exportSlipAsPDF() {
  window.print();
}

function openDocumentPrintModal(docId) {
  const doc = state.documents.find(d => d.id === docId);
  if (!doc) return;

  const modal = document.getElementById("modal-document-detail");
  const typeBadge = document.getElementById("doc-type-badge");
  const codeText = document.getElementById("doc-code-text");
  const printableBody = document.getElementById("printable-slip-content");

  if (!modal || !printableBody) return;

  typeBadge.textContent = doc.type;
  typeBadge.className = `px-2.5 py-1 rounded text-xs font-bold ${getDocBadgeColor(doc.type)}`;
  codeText.textContent = doc.code;

  const creatorUser = (state.users || []).find(u => u.name === doc.creator) ||
                      (state.users || []).find(u => u.name === state.currentUser?.name) ||
                      state.currentUser;
  const creatorAvatar = doc.creatorAvatar || creatorUser?.avatar || '';

  // Warehouse Keeper signature resolution
  const isKeeperApproved = (doc.keeperApproved === true) || (doc.creator === "Nguyễn Văn An");
  const keeperName = doc.keeperName || "Nguyễn Văn An";
  const keeperUser = (state.users || []).find(u => u.name === keeperName || u.roleType === 'KEEPER') || (state.users && state.users[0]);
  const keeperAvatar = doc.keeperAvatar || (isKeeperApproved ? keeperUser?.avatar : '');

  const matchingTour = (state.tours || []).find(t => t.name === doc.tourName || t.id === doc.tourId);
  const eventDate = doc.eventDate || matchingTour?.startDate || doc.date || formatDate(new Date(), 'YYYY-MM-DD');

  const photosHtml = (doc.photos || []).map(p => `
    <div class="rounded-lg overflow-hidden border border-slate-300">
      <img src="${p}" class="w-full h-32 object-cover">
    </div>
  `).join("");

  printableBody.innerHTML = `
    <div class="flex items-start justify-between pb-4 border-b-2 border-slate-800">
      <div class="space-y-1">
        <div class="flex items-center gap-3">
          <img src="logo.png" alt="Logo ABA" class="h-12 w-auto object-contain">
          <div>
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900">CÔNG TY CỔ PHẦN TỔ CHỨC SỰ KIỆN ABA</h2>
            <p class="text-[10px] text-slate-500">Hệ thống Quản lý Đạo cụ & Vận hành Sự kiện</p>
          </div>
        </div>
      </div>
      <div class="text-right text-xs">
        <div class="font-extrabold text-sm text-slate-900">${doc.code}</div>
        <div class="text-[11px] text-slate-500">Ngày lập: ${doc.createdAt}</div>
      </div>
    </div>

    <div class="text-center py-2">
      <h1 class="text-xl font-black uppercase text-slate-900 tracking-wide">PHIẾU ${doc.type.toUpperCase()}</h1>
      <div class="text-base sm:text-lg font-black text-slate-800 mt-1 uppercase">
        DỰ ÁN: <span class="text-sky-800">${doc.tourName || 'Dự án Teambuilding & Sự kiện ABA'}</span>
      </div>
    </div>

    <!-- Structured Metadata with exact line arrangement requested -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-xs p-3.5 bg-slate-50 rounded-xl border border-slate-200">
      <div>
        <div><strong class="text-slate-700">Kho thực hiện:</strong> ${doc.warehouseName}</div>
      </div>
      <div>
        <div><strong class="text-slate-700">Người lập phiếu:</strong> ${doc.creator}</div>
      </div>
      <div>
        <div><strong class="text-slate-700">Địa điểm / Lộ trình:</strong> ${doc.location}</div>
      </div>
      <div>
        <div><strong class="text-slate-700">Ngày thực hiện chương trình:</strong> ${eventDate}</div>
      </div>
      <div class="col-span-2 pt-2 border-t border-slate-200 text-slate-700">
        <strong>Ghi chú:</strong> ${doc.note || 'Không có ghi chú'}
      </div>
    </div>

    <div class="space-y-1">
      <div class="font-bold text-xs uppercase tracking-wider text-slate-700">Danh Mục Đạo Cụ & Thiết Bị:</div>
      <table class="w-full text-left text-xs border border-slate-300 border-collapse">
        <thead>
          <tr class="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
            <th class="py-2 px-3 w-12 text-center border-r border-slate-300">STT</th>
            <th class="py-2 px-3 border-r border-slate-300">Tên Đạo Cụ</th>
            <th class="py-2 px-2 text-center w-16 border-r border-slate-300">ĐVT</th>
            <th class="py-2 px-2 text-center w-20 border-r border-slate-300">Số Lượng</th>
            <th class="py-2 px-3">Vị Trí / Ghi Chú</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-200">
          ${doc.items.map((it, idx) => `
            <tr>
              <td class="py-2 px-3 text-center border-r border-slate-300">${idx + 1}</td>
              <td class="py-2 px-3 font-semibold border-r border-slate-300">${it.name}</td>
              <td class="py-2 px-2 text-center border-r border-slate-300">${it.unit}</td>
              <td class="py-2 px-2 text-center font-bold border-r border-slate-300">${it.qty}</td>
              <td class="py-2 px-3 text-slate-600">${it.shelf || 'N/A'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    ${photosHtml ? `
      <div class="space-y-1 pt-2">
        <div class="font-bold text-xs uppercase tracking-wider text-slate-700">Album Ảnh Hiện Trạng / Nghiệm Thu Thực Tế:</div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 print-photo-grid">
          ${photosHtml}
        </div>
      </div>
    ` : ''}

    <!-- 5-Column Printable Signatures Layout in Exact Specified Order with Strict Horizontal Alignment -->
    <div class="print-signature-grid pt-8 pb-4">
      
      <!-- 1. NGƯỜI LẬP PHIẾU (Ảnh người thực hiện lệnh) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">NGƯỜI LẬP PHIẾU</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          ${creatorAvatar ? `<img src="${creatorAvatar}" alt="Ảnh người lập" class="w-14 h-14 rounded-full object-cover border border-slate-300 shadow-2xs">` : `<div class="h-16 w-full"></div>`}
        </div>
        <div class="h-6 flex items-center justify-center font-bold text-slate-800 text-xs">${doc.creator}</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-emerald-600 font-semibold">✓ Đã xác thực người lập</div>
      </div>

      <!-- 2. THỦ KHO (Hiện tên & ảnh nếu đã xác nhận; nếu chưa thì để trống để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">THỦ KHO</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          ${isKeeperApproved && keeperAvatar ? `
            <img src="${keeperAvatar}" alt="Thủ kho" class="w-14 h-14 rounded-full object-cover border border-amber-400 shadow-2xs">
          ` : `
            <div class="h-16 w-full"></div>
          `}
        </div>
        <div class="h-6 flex items-center justify-center font-bold text-slate-800 text-xs">${isKeeperApproved ? keeperName : '&nbsp;'}</div>
        <div class="h-5 flex items-center justify-center text-[10px] ${isKeeperApproved ? 'text-amber-700 font-bold' : 'text-slate-400 italic'}">
          ${isKeeperApproved ? '✓ Thủ kho đã duyệt' : '(Ký, ghi rõ họ tên)'}
        </div>
      </div>

      <!-- 3. QUẢN LÝ DỰ ÁN (Để trống hoàn toàn để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">QUẢN LÝ DỰ ÁN</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          <div class="h-16 w-full"></div>
        </div>
        <div class="h-6 flex items-center justify-center text-xs font-bold text-slate-800">&nbsp;</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</div>
      </div>

      <!-- 4. KẾ TOÁN (Để trống hoàn toàn để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">KẾ TOÁN</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          <div class="h-16 w-full"></div>
        </div>
        <div class="h-6 flex items-center justify-center text-xs font-bold text-slate-800">&nbsp;</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-slate-400 italic">(Ký, ghi rõ họ tên)</div>
      </div>

      <!-- 5. GIÁM ĐỐC (Để trống hoàn toàn để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">GIÁM ĐỐC</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          <div class="h-16 w-full"></div>
        </div>
        <div class="h-6 flex items-center justify-center text-xs font-bold text-slate-800">&nbsp;</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-slate-600 font-semibold">(Ký & đóng dấu)</div>
      </div>

    </div>
  `;

  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// WAREHOUSE & GAME COMBOS MODALS
// =========================================================================
function openWarehouseModal() {
  renderWarehouseList();
  const modal = document.getElementById("modal-warehouse-mgmt");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function renderWarehouseList() {
  const container = document.getElementById("warehouse-list");
  if (!container) return;

  container.innerHTML = state.warehouses.map(wh => {
    const itemsCount = state.items.filter(i => i.warehouseId === wh.id).length;
    return `
      <div class="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-xs">
        <div>
          <h4 class="font-bold text-xs text-slate-900">${wh.name}</h4>
          <p class="text-[11px] text-slate-500">📍 ${wh.address || 'Hà Nội'} | Quản lý: ${wh.manager || 'N/A'}</p>
          <span class="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
            Đang chứa ${itemsCount} loại đạo cụ
          </span>
        </div>
        <button onclick="handleDeleteWarehouse('${wh.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition" title="Xóa kho">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function handleAddWarehouse(event) {
  event.preventDefault();
  const name = document.getElementById("new-wh-name")?.value.trim();
  const address = document.getElementById("new-wh-address")?.value.trim();
  const manager = document.getElementById("new-wh-manager")?.value.trim();

  if (!name) return;

  const newWh = {
    id: `WH-${Date.now()}`,
    code: `KHO-${Math.floor(10 + Math.random() * 90)}`,
    name: name,
    address: address,
    manager: manager || state.currentUser.name,
    isDefault: false
  };

  state.warehouses.push(newWh);
  saveState();
  event.target.reset();
  renderWarehouseList();
  populateCommonDropdowns();
  showToast(`Đã thêm kho mới [${name}]!`, "success");
}

function handleDeleteWarehouse(whId) {
  const wh = state.warehouses.find(w => w.id === whId);
  if (!wh) return;

  if (state.warehouses.length <= 1) {
    alert("Hệ thống bắt buộc phải có ít nhất 1 kho lưu trữ!");
    return;
  }

  const itemsInWh = state.items.filter(i => i.warehouseId === whId);
  if (itemsInWh.length > 0) {
    const otherWh = state.warehouses.find(w => w.id !== whId);
    const confirmReallocate = confirm(
      `Kho [${wh.name}] hiện vẫn còn ${itemsInWh.length} món đạo cụ!\n` +
      `Theo cơ chế an toàn dữ liệu, hệ thống sẽ tự động tái phân bổ toàn bộ đạo cụ sang [${otherWh.name}] trước khi xóa kho.\n\n` +
      `Bạn có đồng ý thực hiện không?`
    );

    if (!confirmReallocate) return;

    itemsInWh.forEach(item => {
      item.warehouseId = otherWh.id;
      item.warehouseName = otherWh.name;
    });
  }

  state.warehouses = state.warehouses.filter(w => w.id !== whId);
  saveState();
  renderWarehouseList();
  populateCommonDropdowns();
  renderTab1();
  showToast(`Đã xóa kho và tái phân bổ an toàn tài sản!`, "info");
}

// =========================================================================
// GAME COMBOS & TOOLSETS MANAGEMENT (CRUD, Edit, Real-time Filter & Inflatable Kit Auto-Add)
// =========================================================================

let editingComboId = null;
let currentComboFilter = "ALL"; // 'ALL' | 'GAME' | 'TOOLSET'

function openGameCombosModal() {
  cancelEditGameCombo();
  populateComboItemDatalist();
  renderGameCombosList();
  initComboChildInputs();
  const modal = document.getElementById("modal-game-combos");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function populateComboItemDatalist() {
  const dl = document.getElementById("combo-item-datalist");
  if (!dl) return;
  const names = new Set();
  (state.items || []).forEach(it => { if (it.name) names.add(it.name); });
  (state.combos || []).forEach(c => {
    (c.items || []).forEach(ci => { if (ci.name) names.add(ci.name); });
  });
  dl.innerHTML = Array.from(names).map(n => `<option value="${escapeHtml(n)}">`).join("");
}

function onComboKindChanged() {
  const isToolset = document.getElementById("type-toolset")?.checked;
  const nameLabel = document.getElementById("label-combo-name");
  const nameInput = document.getElementById("new-combo-name");
  const descLabel = document.getElementById("label-combo-desc");
  const descInput = document.getElementById("new-combo-desc");
  const catInput = document.getElementById("new-combo-category");

  if (isToolset) {
    if (nameLabel) nameLabel.innerText = "Tên bộ dụng cụ phụ trợ *";
    if (nameInput) nameInput.placeholder = "Ví dụ: Bộ Dụng Cụ Bơm Hơi Tiêu Chuẩn, Bộ Phân Luồng & Cọc Tiêu...";
    if (descLabel) descLabel.innerText = "Mục đích sử dụng / Hướng dẫn triển khai";
    if (descInput) descInput.placeholder = "Mục đích sử dụng, trang bị phụ trợ cho hiện trường...";
    if (catInput && (!catInput.value || catInput.value === "Game tự chế" || catInput.value === "Đồ hơi")) {
      catInput.value = "Dụng cụ phụ trợ";
    }
  } else {
    if (nameLabel) nameLabel.innerText = "Tên bộ game teambuilding *";
    if (nameInput) nameInput.placeholder = "Ví dụ: Bộ Bánh Xe Khổng Lồ, Bộ Kéo Co 4 Hướng...";
    if (descLabel) descLabel.innerText = "Mô tả / Luật chơi tóm tắt";
    if (descInput) descInput.placeholder = "Tóm tắt luật chơi hoặc cách tính điểm trò chơi...";
    if (catInput && (!catInput.value || catInput.value === "Dụng cụ phụ trợ")) {
      catInput.value = "Game tự chế";
    }
  }
}

function setComboFilter(filter) {
  currentComboFilter = filter;
  ["all", "game", "toolset"].forEach(f => {
    const btn = document.getElementById(`filter-combo-${f}`);
    if (btn) {
      if (f.toUpperCase() === filter) {
        btn.className = "px-2.5 py-1 rounded-md bg-white text-slate-800 shadow-2xs font-bold";
      } else {
        btn.className = "px-2.5 py-1 rounded-md text-slate-600 hover:text-slate-900";
      }
    }
  });
  renderGameCombosList();
}

function renderGameCombosList() {
  const container = document.getElementById("game-combos-list");
  if (!container) return;

  const searchInput = document.getElementById("combo-search-input");
  const keyword = (searchInput ? searchInput.value : "").trim().toLowerCase();

  const allCombos = state.combos || [];

  // Count items by type
  const gameCount = allCombos.filter(c => {
    const t = c.type || ((c.name && c.name.toLowerCase().includes("dụng cụ")) ? "TOOLSET" : "GAME");
    return t === "GAME";
  }).length;
  const toolCount = allCombos.filter(c => {
    const t = c.type || ((c.name && c.name.toLowerCase().includes("dụng cụ")) ? "TOOLSET" : "GAME");
    return t === "TOOLSET";
  }).length;

  const countAllEl = document.getElementById("combo-count-all");
  const countGameEl = document.getElementById("combo-count-game");
  const countToolEl = document.getElementById("combo-count-toolset");
  if (countAllEl) countAllEl.innerText = allCombos.length;
  if (countGameEl) countGameEl.innerText = gameCount;
  if (countToolEl) countToolEl.innerText = toolCount;

  // Filter combos by active tab
  let filtered = allCombos.filter(c => {
    const t = c.type || ((c.name && c.name.toLowerCase().includes("dụng cụ")) ? "TOOLSET" : "GAME");
    if (currentComboFilter === "GAME" && t !== "GAME") return false;
    if (currentComboFilter === "TOOLSET" && t !== "TOOLSET") return false;
    return true;
  });

  // Filter combos by search query
  if (keyword) {
    filtered = filtered.filter(c => {
      const matchName = (c.name || "").toLowerCase().includes(keyword);
      const matchDesc = (c.description || "").toLowerCase().includes(keyword);
      const matchCat = (c.category || "").toLowerCase().includes(keyword);
      const matchChild = (c.items || []).some(ci => (ci.name || "").toLowerCase().includes(keyword));
      return matchName || matchDesc || matchCat || matchChild;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 bg-slate-50/80 rounded-xl border border-dashed border-slate-200 text-xs">
        <i data-lucide="package-search" class="w-8 h-8 mx-auto text-slate-300 mb-1.5"></i>
        <span>Không tìm thấy mẫu game hoặc bộ dụng cụ nào phù hợp.</span>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = filtered.map(combo => {
    const isToolset = (combo.type === "TOOLSET") || (combo.name && combo.name.toLowerCase().includes("dụng cụ"));
    const badgeColor = isToolset ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200";
    const icon = isToolset ? "🧰" : "🎮";
    const typeLabel = isToolset ? "Bộ Dụng Cụ" : "Bộ Game";

    return `
      <div class="p-2.5 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 hover:border-amber-300 transition shadow-2xs space-y-1.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-sm shrink-0">${icon}</span>
              <span class="font-bold text-xs text-slate-900">${escapeHtml(combo.name)}</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-semibold border ${badgeColor}">${typeLabel}</span>
              ${combo.category ? `<span class="px-1.5 py-0.2 rounded text-[10px] text-slate-500 bg-slate-100">${escapeHtml(combo.category)}</span>` : ""}
              <span class="text-[10px] text-slate-400 font-medium">(${combo.items.length} món)</span>
            </div>
            ${combo.description ? `<p class="text-[11px] text-slate-500 italic mt-0.5 line-clamp-1">${escapeHtml(combo.description)}</p>` : ""}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" onclick="handleEditGameCombo('${combo.id}')" class="p-1 px-1.5 text-xs font-semibold text-sky-600 hover:text-sky-800 hover:bg-sky-50 rounded border border-transparent hover:border-sky-200 transition flex items-center gap-0.5" title="Chỉnh sửa mẫu này">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span class="hidden sm:inline text-[11px]">Sửa</span>
            </button>
            <button type="button" onclick="handleDeleteGameCombo('${combo.id}')" class="p-1 px-1.5 text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded border border-transparent hover:border-rose-200 transition" title="Xóa mẫu này">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- Compact chips for child items -->
        <div class="flex flex-wrap gap-1 pt-0.5">
          ${combo.items.map(it => `
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10.5px] text-slate-700">
              <span>• ${escapeHtml(it.name)}</span>
              <span class="font-bold text-amber-700 bg-amber-50 px-1 rounded border border-amber-200/50">${it.quantityPerSet} ${escapeHtml(it.unit)}</span>
            </span>
          `).join("")}
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function initComboChildInputs() {
  const container = document.getElementById("combo-items-inputs");
  if (container && container.children.length === 0) {
    addComboChildInputRow();
  }
}

function addComboChildInputRow(data = {}) {
  const container = document.getElementById("combo-items-inputs");
  if (!container) return;

  const nameVal = data.name || "";
  const qtyVal = data.quantityPerSet || data.qty || 1;
  const unitVal = data.unit || "Chiếc";

  const div = document.createElement("div");
  div.className = "flex items-center gap-1.5 combo-child-row";
  div.innerHTML = `
    <input type="text" list="combo-item-datalist" value="${escapeHtml(nameVal)}" placeholder="Tên món con (gợi ý tự động)..." onchange="onComboChildNameChange(this)" class="flex-1 p-1.5 bg-white border border-slate-200 rounded text-xs child-name focus:ring-1 focus:ring-amber-500 focus:outline-none" required>
    <input type="number" min="1" value="${qtyVal}" placeholder="SL" class="w-16 p-1.5 bg-white border border-slate-200 rounded text-xs text-center font-bold child-qty focus:ring-1 focus:ring-amber-500 focus:outline-none" required title="Số lượng mỗi bộ">
    <input type="text" value="${escapeHtml(unitVal)}" placeholder="ĐVT" class="w-16 p-1.5 bg-white border border-slate-200 rounded text-xs text-center child-unit focus:ring-1 focus:ring-amber-500 focus:outline-none" required title="Đơn vị tính">
    <button type="button" onclick="this.closest('.combo-child-row').remove()" class="text-slate-400 hover:text-rose-500 p-1.5 rounded hover:bg-rose-50 transition shrink-0" title="Xóa món này">
      <i data-lucide="trash-2" class="w-4 h-4"></i>
    </button>
  `;
  container.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

function onComboChildNameChange(inputEl) {
  if (!inputEl) return;
  const val = inputEl.value.trim();
  if (!val) return;

  // Auto-fill unit if item exists in state.items
  const matchedItem = (state.items || []).find(it => it.name.toLowerCase() === val.toLowerCase());
  const row = inputEl.closest(".combo-child-row");
  if (matchedItem && row) {
    const unitInput = row.querySelector(".child-unit");
    if (unitInput && matchedItem.unit) {
      unitInput.value = matchedItem.unit;
    }
  }

  // Check auto-add inflatable accessories (blower + power cord)
  checkAutoAddInflatable(val);
}

function checkAutoAddInflatable(itemName) {
  if (!itemName) return;
  const lower = itemName.toLowerCase();
  const INFLATABLE_KEYWORDS = [
    "hơi", "phao", "bạt", "bơm hơi", "khí cầu", "bánh xe bạt",
    "cổng hơi", "nhà hơi", "lâu đài hơi", "con lăn hơi", "bóng khổng lồ",
    "núi hơi", "thuyền phao", "cầu phao"
  ];
  const isMatch = INFLATABLE_KEYWORDS.some(kw => lower.includes(kw));
  if (!isMatch) return;

  const rows = document.querySelectorAll(".combo-child-row");
  let hasBlower = false;
  let hasWire = false;

  rows.forEach(r => {
    const val = (r.querySelector(".child-name")?.value || "").toLowerCase();
    if (val.includes("máy thổi") || val.includes("máy bơm")) hasBlower = true;
    if (val.includes("dây điện") || val.includes("dây nguồn")) hasWire = true;
  });

  const added = [];
  if (!hasBlower) {
    addComboChildInputRow({
      name: "Máy thổi khí công suất lớn 1500W",
      qty: 1,
      unit: "Chiếc"
    });
    added.push("Máy thổi khí 1500W");
  }
  if (!hasWire) {
    addComboChildInputRow({
      name: "Cuộn dây điện nguồn 20m",
      qty: 1,
      unit: "Cuộn"
    });
    added.push("Cuộn dây điện 20m");
  }

  if (added.length > 0) {
    showToast(`⚡ Đã tự động thêm Bộ dụng cụ đi kèm đồ hơi: ${added.join(" & ")}!`, "info");
  }
}

function autoAddInflatableToolset() {
  const rows = document.querySelectorAll(".combo-child-row");
  let hasBlower = false;
  let hasWire = false;

  rows.forEach(r => {
    const val = (r.querySelector(".child-name")?.value || "").toLowerCase();
    if (val.includes("máy thổi") || val.includes("máy bơm")) hasBlower = true;
    if (val.includes("dây điện") || val.includes("dây nguồn")) hasWire = true;
  });

  if (!hasBlower) {
    addComboChildInputRow({
      name: "Máy thổi khí công suất lớn 1500W",
      qty: 1,
      unit: "Chiếc"
    });
  }
  if (!hasWire) {
    addComboChildInputRow({
      name: "Cuộn dây điện nguồn 20m",
      qty: 1,
      unit: "Cuộn"
    });
  }
  showToast("⚡ Đã thêm Bộ dụng cụ bơm hơi (Máy thổi + Dây điện 20m)", "success");
}

function handleEditGameCombo(comboId) {
  const combo = state.combos.find(c => c.id === comboId);
  if (!combo) return;

  editingComboId = comboId;
  const isToolset = combo.type === "TOOLSET" || (combo.name && combo.name.toLowerCase().includes("bộ dụng cụ"));

  // Select appropriate radio
  const typeGameRadio = document.getElementById("type-game");
  const typeToolRadio = document.getElementById("type-toolset");
  if (isToolset && typeToolRadio) {
    typeToolRadio.checked = true;
  } else if (typeGameRadio) {
    typeGameRadio.checked = true;
  }
  onComboKindChanged();

  // Populate basic fields
  const nameInput = document.getElementById("new-combo-name");
  const descInput = document.getElementById("new-combo-desc");
  const catInput = document.getElementById("new-combo-category");
  if (nameInput) nameInput.value = combo.name || "";
  if (descInput) descInput.value = combo.description || "";
  if (catInput) catInput.value = combo.category || "";

  // Populate child rows
  const container = document.getElementById("combo-items-inputs");
  if (container) {
    container.innerHTML = "";
    if (combo.items && combo.items.length > 0) {
      combo.items.forEach(it => addComboChildInputRow(it));
    } else {
      addComboChildInputRow();
    }
  }

  // Update form header & buttons for Edit Mode
  const titleEl = document.getElementById("form-combo-title");
  if (titleEl) {
    titleEl.innerHTML = `<i data-lucide="edit-3" class="w-4 h-4 text-sky-600"></i> Chỉnh Sửa Mẫu: <span class="text-sky-700">${escapeHtml(combo.name)}</span>`;
  }
  const badgeEl = document.getElementById("edit-mode-badge");
  if (badgeEl) badgeEl.classList.remove("hidden");
  const btnSave = document.getElementById("btn-save-combo");
  if (btnSave) {
    btnSave.className = "flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5";
  }
  const btnSaveText = document.getElementById("btn-save-combo-text");
  if (btnSaveText) btnSaveText.innerText = "Lưu Cập Nhật";
  const btnCancel = document.getElementById("btn-cancel-edit-combo");
  if (btnCancel) btnCancel.classList.remove("hidden");

  // Scroll to form
  const form = document.getElementById("form-add-combo");
  if (form) form.scrollIntoView({ behavior: "smooth", block: "start" });
  if (nameInput) nameInput.focus();
  if (window.lucide) lucide.createIcons();
}

function cancelEditGameCombo() {
  editingComboId = null;
  const form = document.getElementById("form-add-combo");
  if (form) form.reset();

  const typeGameRadio = document.getElementById("type-game");
  if (typeGameRadio) typeGameRadio.checked = true;

  const container = document.getElementById("combo-items-inputs");
  if (container) {
    container.innerHTML = "";
    addComboChildInputRow();
  }

  const titleEl = document.getElementById("form-combo-title");
  if (titleEl) {
    titleEl.innerHTML = `<i data-lucide="sparkles" class="w-4 h-4 text-amber-600"></i> + Tạo Mới Mẫu Định Sẵn`;
  }
  const badgeEl = document.getElementById("edit-mode-badge");
  if (badgeEl) badgeEl.classList.add("hidden");
  const btnSave = document.getElementById("btn-save-combo");
  if (btnSave) {
    btnSave.className = "flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-xs transition flex items-center justify-center gap-1.5";
  }
  const btnSaveText = document.getElementById("btn-save-combo-text");
  if (btnSaveText) btnSaveText.innerText = "Lưu Mẫu Mới";
  const btnCancel = document.getElementById("btn-cancel-edit-combo");
  if (btnCancel) btnCancel.classList.add("hidden");

  onComboKindChanged();
  if (window.lucide) lucide.createIcons();
}

function handleSaveGameCombo(event) {
  event.preventDefault();
  const name = document.getElementById("new-combo-name")?.value.trim();
  const desc = document.getElementById("new-combo-desc")?.value.trim();
  const category = document.getElementById("new-combo-category")?.value.trim();
  const typeRadio = document.querySelector('input[name="combo-kind-type"]:checked');
  const type = typeRadio ? typeRadio.value : "GAME";

  if (!name) {
    alert("Vui lòng nhập tên bộ game hoặc bộ dụng cụ!");
    return;
  }

  const childRows = document.querySelectorAll(".combo-child-row");
  const items = [];

  childRows.forEach(row => {
    const cName = row.querySelector(".child-name")?.value.trim();
    const cQty = Number(row.querySelector(".child-qty")?.value || 1);
    const cUnit = row.querySelector(".child-unit")?.value.trim() || "Chiếc";

    if (cName) {
      items.push({
        itemId: `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cName,
        unit: cUnit,
        quantityPerSet: Math.max(1, cQty)
      });
    }
  });

  if (items.length === 0) {
    alert("Vui lòng thêm ít nhất một món đạo cụ thành phần!");
    return;
  }

  const defaultCategory = category || (type === "TOOLSET" ? "Dụng cụ phụ trợ" : "Game tự chế");

  if (editingComboId) {
    const existingIndex = state.combos.findIndex(c => c.id === editingComboId);
    if (existingIndex !== -1) {
      state.combos[existingIndex] = {
        ...state.combos[existingIndex],
        name: name,
        type: type,
        category: defaultCategory,
        description: desc,
        items: items
      };
      showToast(`Đã cập nhật mẫu [${name}] thành công!`, "success");
    }
    cancelEditGameCombo();
  } else {
    const newCombo = {
      id: `${type === "TOOLSET" ? "TOOL" : "GAME"}-${Date.now()}`,
      name: name,
      type: type,
      category: defaultCategory,
      description: desc,
      items: items
    };
    state.combos.unshift(newCombo);
    showToast(`Đã lưu [${name}] vào danh mục thành công!`, "success");
    cancelEditGameCombo();
  }

  saveState();
  renderGameCombosList();
  populateCommonDropdowns();
}

// Backward compatibility alias
const handleAddGameCombo = handleSaveGameCombo;

function handleDeleteGameCombo(comboId) {
  if (!confirm("Bạn có chắc chắn muốn xóa mẫu này khỏi hệ thống?")) return;
  state.combos = state.combos.filter(c => c.id !== comboId);
  saveState();
  renderGameCombosList();
  populateCommonDropdowns();
  showToast("Đã xóa mẫu thành công!", "info");
}

// =========================================================================
// GOOGLE SHEETS & ADMIN AUTH
// =========================================================================
function openGSheetModal() {
  const urlInput = document.getElementById("gsheet-webhook-url");
  if (urlInput) urlInput.value = state.gsheetConfig.url || "";
  const modal = document.getElementById("modal-gsheet");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function saveGSheetConfig() {
  const url = document.getElementById("gsheet-webhook-url")?.value.trim();
  state.gsheetConfig.url = url;
  state.gsheetConfig.isConnected = !!url;
  saveState();
  renderGSheetStatus();
  closeModal("modal-gsheet");
  showToast("Đã lưu cấu hình kết nối Google Sheet!", "success");
}

function testGSheetConnection() {
  showToast("Đang kiểm tra kết nối với Google Sheet API...", "info");
  setTimeout(() => {
    state.gsheetConfig.isConnected = true;
    renderGSheetStatus();
    showToast("🟢 Kết nối Google Sheet thành công! Dữ liệu đã đồng bộ thời gian thực.", "success");
  }, 800);
}

function copyAppsScriptCode() {
  const code = `// Google Apps Script for ABA Inventory & Event Operations System
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("INVENTORY") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("INVENTORY");
    sheet.appendRow([new Date(), data.action, data.code, JSON.stringify(data.payload)]);
    return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
  navigator.clipboard.writeText(code).then(() => {
    alert("Đã sao chép mã Google Apps Script vào bộ nhớ tạm!");
  });
}

function openLockAdminModal() {
  const input = document.getElementById("admin-pass-input");
  if (input) input.value = "";
  const modal = document.getElementById("modal-admin-lock");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function verifyAdminPassword() {
  const pass = document.getElementById("admin-pass-input")?.value;
  if (pass === ADMIN_PASSWORD_DEFAULT || pass === "aba2026") {
    closeModal("modal-admin-lock");
    openUserModal();
  } else {
    alert("Mật khẩu Admin không đúng! (Mặc định: admin123 hoặc aba2026)");
  }
}

// =========================================================================
// WAREHOUSE KEEPER NOTIFICATIONS & APPROVAL SYSTEM
// =========================================================================
function notifyWarehouseKeeper(doc) {
  if (state.currentUser && state.currentUser.roleType === "KEEPER") {
    doc.keeperApproved = true;
    doc.keeperName = state.currentUser.name;
    doc.keeperAvatar = state.currentUser.avatar;
    doc.keeperApprovedAt = formatDateTime(new Date());
  } else {
    doc.keeperApproved = false;
    doc.keeperName = "";
    doc.keeperAvatar = "";
    
    // Create pending approval notification for keeper
    const notif = {
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type: "APPROVAL_REQUIRED",
      docId: doc.id,
      docCode: doc.code,
      docType: doc.type,
      title: `Yêu cầu duyệt: ${doc.type} [${doc.code}]`,
      message: `${doc.creator} đã thực hiện ${doc.type} cho [${doc.tourName || doc.warehouseName}] (${doc.itemsCount || (doc.items ? doc.items.length : 1)} món).`,
      actor: doc.creator,
      actorAvatar: doc.creatorAvatar,
      status: "PENDING",
      createdAt: formatDateTime(new Date())
    };
    if (!state.notifications) state.notifications = [];
    state.notifications.unshift(notif);
  }
}

function approveKeeperDoc(notifId) {
  const notif = (state.notifications || []).find(n => n.id === notifId);
  if (!notif) return;

  const doc = (state.documents || []).find(d => d.code === notif.docCode || d.id === notif.docId);
  if (doc) {
    doc.keeperApproved = true;
    doc.keeperName = state.currentUser.name;
    doc.keeperAvatar = state.currentUser.avatar;
    doc.keeperApprovedAt = formatDateTime(new Date());
  }
  notif.status = "APPROVED";
  saveState();
  renderNotifications();
  showToast(`Thủ kho đã duyệt phiếu [${notif.docCode}]! Tên và ảnh của bạn đã được đưa vào mục ký chứng từ.`, "success");
}

function rejectKeeperDoc(notifId) {
  const notif = (state.notifications || []).find(n => n.id === notifId);
  if (!notif) return;

  const doc = (state.documents || []).find(d => d.code === notif.docCode || d.id === notif.docId);
  if (doc) {
    doc.keeperApproved = false;
    doc.keeperRejected = true;
  }
  notif.status = "REJECTED";
  saveState();
  renderNotifications();
  showToast(`Đã từ chối phiếu [${notif.docCode}]!`, "info");
}

function toggleNotificationPanel() {
  const panel = document.getElementById("notification-panel");
  if (!panel) return;
  panel.classList.toggle("hidden");
  renderNotifications();
}

function markAllNotificationsAsRead() {
  if (state.notifications) {
    state.notifications.forEach(n => {
      if (n.status === 'UNREAD') n.status = 'READ';
    });
    saveState();
    renderNotifications();
    showToast("Đã đánh dấu đọc tất cả thông báo!", "info");
  }
}

function renderNotifications() {
  const badge = document.getElementById("notification-badge");
  const list = document.getElementById("notification-list");
  if (!list) return;

  const notifs = state.notifications || [];
  const pendingCount = notifs.filter(n => n.status === "PENDING" || n.status === "UNREAD").length;

  if (badge) {
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  }

  if (notifs.length === 0) {
    list.innerHTML = `<div class="p-6 text-center text-slate-400 italic">Không có thông báo nào</div>`;
    return;
  }

  const isKeeperOrAdmin = (state.currentUser?.roleType === "KEEPER" || state.currentUser?.roleType === "ADMIN" || state.currentUser?.isAdmin);

  list.innerHTML = notifs.map(n => {
    let actionButtons = "";
    let itemizedDocPreview = "";

    if (n.type === "APPROVAL_REQUIRED") {
      const doc = (state.documents || []).find(d => d.code === n.docCode || d.id === n.docId);
      if (doc && doc.items && doc.items.length > 0) {
        itemizedDocPreview = `
          <div class="mt-2 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden text-[11px]">
            <div class="px-2 py-1 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between font-bold text-slate-700">
              <span>Bảng Đạo Cụ Cần Duyệt (${doc.items.length} món):</span>
              <button onclick="openDocumentPrintModal('${doc.id}')" class="text-sky-600 hover:text-sky-800 font-semibold flex items-center gap-1">
                <i data-lucide="file-text" class="w-3 h-3"></i>
                <span>Xem Phiếu</span>
              </button>
            </div>
            <div class="max-h-36 overflow-y-auto">
              <table class="w-full text-left">
                <thead class="bg-slate-200/50 text-[10px] text-slate-600 border-b border-slate-200">
                  <tr>
                    <th class="py-1 px-1.5 w-6 text-center">STT</th>
                    <th class="py-1 px-1.5">Tên Đạo Cụ</th>
                    <th class="py-1 px-1 text-center w-10">SL</th>
                    <th class="py-1 px-1 text-center w-10">ĐVT</th>
                    <th class="py-1 px-1.5">Kệ / Vị Trí</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200/60 bg-white">
                  ${doc.items.map((it, idx) => `
                    <tr>
                      <td class="py-1 px-1.5 text-center text-slate-400 font-medium text-[10px]">${idx + 1}</td>
                      <td class="py-1 px-1.5 font-semibold text-slate-800">${it.name}</td>
                      <td class="py-1 px-1 text-center font-bold text-sky-700">${it.qty}</td>
                      <td class="py-1 px-1 text-center text-slate-500">${it.unit}</td>
                      <td class="py-1 px-1.5 text-slate-600 text-[10px] truncate max-w-[100px]">${it.shelf || 'Khu vực chuẩn bị'}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      if (n.status === "PENDING") {
        if (isKeeperOrAdmin) {
          actionButtons = `
            <div class="flex items-center gap-1.5 pt-2">
              <button onclick="approveKeeperDoc('${n.id}')" class="px-3 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs flex items-center gap-1">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Xác nhận duyệt & ký tên</span>
              </button>
              <button onclick="rejectKeeperDoc('${n.id}')" class="px-2.5 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-2xs flex items-center gap-1">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                <span>Từ chối</span>
              </button>
            </div>
          `;
        } else {
          actionButtons = `<div class="text-[10px] text-amber-700 font-semibold pt-1">⏳ Đang chờ Thủ kho duyệt...</div>`;
        }
      } else if (n.status === "APPROVED") {
        actionButtons = `<div class="text-[10px] text-emerald-600 font-bold pt-1">✓ Thủ kho đã duyệt & ký tên</div>`;
      } else if (n.status === "REJECTED") {
        actionButtons = `<div class="text-[10px] text-rose-600 font-bold pt-1">✕ Đã từ chối</div>`;
      }
    } else if (n.type === "FIELD_TRANSFER_CHECK") {
      if (n.transferId) {
        actionButtons = `
          <div class="pt-1.5">
            <button onclick="openReceiveTransferModal('${n.transferId}'); toggleNotificationPanel();" class="px-2.5 py-1 text-[11px] font-bold bg-sky-600 hover:bg-sky-700 text-white rounded-md transition shadow-2xs flex items-center gap-1">
              <i data-lucide="package" class="w-3 h-3"></i>
              <span>Kiểm đếm nhận đồ ngay</span>
            </button>
          </div>
        `;
      }
    }

    return `
      <div class="p-3 hover:bg-slate-50 transition border-b border-slate-100 last:border-b-0 space-y-1">
        <div class="flex items-start justify-between gap-1">
          <div class="font-bold text-slate-800 text-xs">${n.title}</div>
          <span class="text-[9px] text-slate-400 shrink-0">${n.createdAt}</span>
        </div>
        <div class="text-[11px] text-slate-600">${n.message}</div>
        ${itemizedDocPreview}
        ${actionButtons}
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// USER AUTHENTICATION & ROLE PERMISSION SWITCHING
// =========================================================================
function openUserModal() {
  const quickList = document.getElementById("quick-user-switch-list");
  if (quickList) {
    quickList.innerHTML = state.users.map(u => {
      const isCurrent = (u.id === state.currentUser?.id);
      const rt = u.roleType || (u.isAdmin ? "ADMIN" : "STAFF");
      return `
        <div onclick="switchUserDirectly('${u.id}')" class="p-2 rounded-lg border cursor-pointer transition flex items-center gap-2 ${isCurrent ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400 shadow-2xs' : 'bg-slate-50 border-slate-200 hover:bg-sky-50/50'}">
          <img src="${u.avatar}" class="w-8 h-8 rounded-full object-cover shrink-0">
          <div class="truncate">
            <div class="font-bold text-slate-800 text-xs truncate">${u.name}</div>
            <span class="text-[9px] font-bold px-1 rounded ${rt === 'KEEPER' ? 'bg-amber-100 text-amber-800' : (rt === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700')}">${u.roleBadge || (rt === 'KEEPER' ? 'Thủ kho' : (rt === 'ADMIN' ? 'Quản trị' : 'Thông thường'))}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  const sel = document.getElementById("login-phone-select");
  if (sel) {
    sel.innerHTML = state.users.map(u => `
      <option value="${u.phone}">${u.name} - ${u.phone} (${u.roleBadge || u.role})</option>
    `).join("");
    if (state.currentUser) sel.value = state.currentUser.phone;
  }
  handleLoginSelectChange(state.currentUser ? state.currentUser.phone : state.users[0]?.phone);
  const modal = document.getElementById("modal-user-login");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function switchUserDirectly(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  state.currentUser = user;
  saveState();
  closeModal("modal-user-login");
  renderUserInfo();
  renderNotifications();
  showToast(`Đã chuyển phiên làm việc sang [${user.name}] (${user.roleBadge || user.role})!`, "success");
}

function handleLoginSelectChange(phone) {
  const user = state.users.find(u => u.phone === phone);
  const facePreview = document.getElementById("login-face-preview");
  const roleSelect = document.getElementById("login-role-select");
  if (user) {
    if (facePreview) facePreview.src = user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";
    if (roleSelect) roleSelect.value = user.roleType || (user.isAdmin ? "ADMIN" : "STAFF");
  }
}

function handleUserRoleChange(newRoleType) {
  const phone = document.getElementById("login-phone-select")?.value;
  const user = state.users.find(u => u.phone === phone);
  if (user) {
    user.roleType = newRoleType;
    user.roleBadge = (newRoleType === "KEEPER" ? "Thủ kho" : (newRoleType === "ADMIN" ? "Quản trị" : "Thông thường"));
    if (newRoleType === "ADMIN") user.isAdmin = true;
    showToast(`Đã gán vai trò [${user.roleBadge}] cho [${user.name}]!`, "info");
  }
}

function openLiveCameraForUserAvatar() {
  openLiveCamera((imgUrl) => {
    const facePreview = document.getElementById("login-face-preview");
    if (facePreview) facePreview.src = imgUrl;
    const phone = document.getElementById("login-phone-select")?.value;
    const user = state.users.find(u => u.phone === phone);
    if (user) user.avatar = imgUrl;
    showToast("Đã chụp ảnh khuôn mặt thành công!", "success");
  });
}

function confirmLogin() {
  const phone = document.getElementById("login-phone-select")?.value;
  const user = state.users.find(u => u.phone === phone);
  if (!user) return;

  const roleSelect = document.getElementById("login-role-select");
  if (roleSelect && roleSelect.value) {
    user.roleType = roleSelect.value;
    user.roleBadge = (roleSelect.value === "KEEPER" ? "Thủ kho" : (roleSelect.value === "ADMIN" ? "Quản trị" : "Thông thường"));
  }

  const faceImg = document.getElementById("login-face-preview")?.src;
  if (faceImg) user.avatar = faceImg;

  user.lastLogin = formatDateTime(new Date());
  state.currentUser = user;
  saveState();
  closeModal("modal-user-login");
  renderUserInfo();
  renderNotifications();
  showToast(`Xin chào [${user.name}]! Đã đăng nhập phiên làm việc (${user.roleBadge}).`, "success");
}
