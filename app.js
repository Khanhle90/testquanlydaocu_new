/**
 * ABA Inventory & Event Operations System - Core Application Engine
 * Hệ thống Quản lý Đạo cụ & Kho bãi ABA
 */

// ==================== GLOBAL CONSTANTS & API KEYS ====================
const IMGBB_API_KEY = "9b4a10db15d694a88f3aa0d1ffbc0669";
const ADMIN_PASSWORD_DEFAULT = "admin123";
const DEFAULT_GSHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwpN4TEj5Ny0cyvNrpvL4s9kvz5uRJh6T8RJy8VAy-Cphwin6yzvH5kUAWUmSllkRRc1w/exec";

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
  PREP_SLIPS: "ABA_PREP_SLIPS_V5",
  POST_CHECK_SLIPS: "ABA_POST_CHECK_SLIPS_V1"
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
    { shelf: "", tier: "", qty: 1 }
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
  tab4CollapsedCombos: {},

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

  // Tự động kéo dữ liệu mới nhất từ Google Sheet về máy khi mở app (Đồng bộ 2 chiều)
  setTimeout(() => {
    pullFromGoogleSheet(true);
  }, 500);
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
  state.postCheckSlips = loadFromStorage(STORAGE_KEYS.POST_CHECK_SLIPS, typeof INITIAL_POST_CHECK_SLIPS !== "undefined" ? INITIAL_POST_CHECK_SLIPS : []);
  
  // Sanitize prepSlips: ensure slipType is distinguished
  (state.prepSlips || []).forEach(s => {
    if (!s.slipType) {
      if (s.code?.startsWith("GD_") || s.source === "EXCEL" || s.type === "Phiếu gom đồ") {
        s.slipType = "GATHERING";
        s.typeLabel = "Phiếu gom đồ";
      } else {
        s.slipType = "PREPARATION";
        s.typeLabel = "Phiếu chuẩn bị đồ";
      }
    }
  });

  state.gsheetConfig = loadFromStorage(STORAGE_KEYS.GSHEET_CONFIG, {
    url: DEFAULT_GSHEET_WEBHOOK_URL,
    isConnected: true,
    lastSync: new Date().toISOString()
  });

  // Tự động chuyển sang URL chính thức nếu URL trong máy là link cũ hoặc link mock
  if (!state.gsheetConfig.url || state.gsheetConfig.url.includes("mock") || state.gsheetConfig.url.includes("AKfycbwpN4TEj5Ny0cyvNrpvL4s9kvZ5uRJhGT8Rjy8VAy")) {
    state.gsheetConfig.url = DEFAULT_GSHEET_WEBHOOK_URL;
    state.gsheetConfig.isConnected = true;
    localStorage.setItem(STORAGE_KEYS.GSHEET_CONFIG, JSON.stringify(state.gsheetConfig));
  }

  // Sanitize: "Chuẩn bị" slips should never have keeper approval or pending approval notifications
  if (Array.isArray(state.documents)) {
    state.documents.forEach(d => {
      if (d.type === "Chuẩn bị") {
        d.keeperApproved = false;
        d.keeperName = "";
        d.keeperAvatar = "";
      }
    });
  }
  if (Array.isArray(state.notifications)) {
    state.notifications = state.notifications.filter(n => n.docType !== "Chuẩn bị" && !n.title?.includes("Chuẩn bị"));
  }

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
  localStorage.setItem(STORAGE_KEYS.POST_CHECK_SLIPS, JSON.stringify(state.postCheckSlips || []));
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

async function refreshData() {
  showToast("Đang làm mới & đồng bộ 2 chiều với Google Sheet...", "info");
  await pullFromGoogleSheet(false);
  renderApp();
}

function renderApp() {
  if (!state.currentUser) {
    showLoginScreen();
    return;
  }
  hideLoginScreen();
  renderUserInfo();
  renderGSheetStatus();
  renderNotifications();
  populateCommonDropdowns();
  updateTab4Badge();

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
    textEl.textContent = "Đã kết nối";
  } else {
    pulseEl.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
    textEl.textContent = "Mất kết nối";
  }
}

function populateCommonDropdowns() {
  const whSelectors = [
    "tab1-filter-warehouse",
    "tab2-warehouse",
    "tab3-warehouse",
    "tab4-warehouse",
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

// Cuộn mượt lên đầu trang áp dụng cho tất cả các tab
function scrollToTopAllTabs() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const activePanel = document.querySelector('.tab-panel:not(.hidden)');
  if (activePanel) activePanel.scrollTo({ top: 0, behavior: 'smooth' });
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

  // Đặt ngày nhập mặc định là ngày hôm nay nếu chưa có
  const dateEl = document.getElementById("tab2-date");
  if (dateEl && !dateEl.value) {
    dateEl.value = formatDate(new Date(), 'YYYY-MM-DD');
  }

  handleTab2WarehouseChanged();
  updateTab2CodePreview();
  renderTab2Pills();
  renderTab2ShelfRows();
  updateTab2ShelfValidation();
  renderTab2Album();
}

function handleTab2WarehouseChanged() {
  const whId = document.getElementById("tab2-warehouse")?.value;
  const wh = state.warehouses.find(w => w.id === whId) || state.warehouses[0];
  const labelEl = document.getElementById("tab2-selected-warehouse-label");
  if (labelEl && wh) {
    labelEl.textContent = wh.name;
  }
}

function resetTab2Form() {
  state.tab2Mode = 'NEW';
  state.tab2Type = 'Khấu hao';
  state.tab2SelectedCategories = new Set(["Đồ hơi"]);
  state.tab2SelectedPurposes = new Set(["Team building"]);
  state.tab2Shelves = [{ shelf: "", tier: "", qty: 1 }];
  state.tab2AlbumPhotos = [];

  document.getElementById("form-tab2-new-item")?.reset();
  const qtyEl = document.getElementById("tab2-qty");
  if (qtyEl) qtyEl.value = "1";
  const costEl = document.getElementById("tab2-invoice-cost");
  if (costEl) costEl.value = "0";
  const minStockEl = document.getElementById("tab2-minstock");
  if (minStockEl) minStockEl.value = "0";

  const dateEl = document.getElementById("tab2-date");
  if (dateEl) dateEl.value = formatDate(new Date(), 'YYYY-MM-DD');

  setTab2Mode('NEW');
  setTab2Type('Khấu hao');
  handleTab2WarehouseChanged();
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

// Tab 2 Shelf Rows with explicit header labels: "Giá/kệ", "Tầng/sàn", "SL", "Xóa"
function renderTab2ShelfRows() {
  const container = document.getElementById("tab2-shelf-rows-container");
  if (!container) return;

  const headerHtml = `
    <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 px-1 pb-1 border-b border-amber-200/70">
      <span class="w-6 text-center text-slate-400">#</span>
      <span class="flex-1 min-w-0">Giá/kệ</span>
      <span class="w-20 sm:w-28 text-center">Tầng/sàn</span>
      <span class="w-14 sm:w-16 text-center">SL</span>
      <span class="w-7 text-center"></span>
    </div>
  `;

  const rowsHtml = state.tab2Shelves.map((s, idx) => {
    const suggestedLetter = String.fromCharCode(65 + (idx % 26));
    const suggestedTier = String(idx + 1);
    return `
      <div class="flex items-center gap-1.5 text-xs">
        <span class="w-6 text-center font-bold text-slate-500 text-[11px] shrink-0">#${idx + 1}</span>
        <input type="text" value="${s.shelf || ''}" placeholder="${suggestedLetter}" onfocus="this.select()" oninput="state.tab2Shelves[${idx}].shelf = this.value" class="flex-1 min-w-0 p-1.5 sm:p-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-amber-500" title="Gợi ý Giá ${suggestedLetter} (ấn vào để gõ ngay)">
        <input type="text" value="${s.tier || ''}" placeholder="${suggestedTier}" onfocus="this.select()" oninput="state.tab2Shelves[${idx}].tier = this.value" class="w-20 sm:w-28 min-w-0 p-1.5 sm:p-2 bg-white border border-slate-300 rounded-lg text-xs text-center font-semibold text-slate-900 focus:ring-1 focus:ring-amber-500" title="Gợi ý Tầng ${suggestedTier} (ấn vào để gõ ngay)">
        <input type="number" min="1" value="${s.qty}" onfocus="this.select()" oninput="updateTab2ShelfQty(${idx}, this.value)" class="w-14 sm:w-16 p-1.5 sm:p-2 bg-white border border-slate-300 rounded-lg text-center font-bold text-xs shrink-0 text-slate-900 focus:ring-1 focus:ring-amber-500">
        <button type="button" onclick="removeTab2ShelfItemRow(${idx})" class="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg shrink-0" title="Xóa dòng kệ">
          <i data-lucide="minus" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  }).join("");

  container.innerHTML = headerHtml + rowsHtml;
  if (window.lucide) lucide.createIcons();
}

function addTab2ShelfItemRow() {
  state.tab2Shelves.push({
    shelf: "",
    tier: "",
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

  const shelvesData = state.tab2Shelves.map((s, idx) => {
    const suggestedLetter = String.fromCharCode(65 + (idx % 26));
    const suggestedTier = String(idx + 1);
    const rawShelf = s.shelf?.trim() || suggestedLetter;
    const shelfName = /^(giá|kệ|khu|kho)/i.test(rawShelf) ? rawShelf : `Giá ${rawShelf}`;
    const rawTier = s.tier?.trim() || suggestedTier;
    const tierName = /^(tầng|sàn|ô)/i.test(rawTier) ? rawTier : `Tầng ${rawTier}`;
    return {
      shelf: `${shelfName} - ${tierName}`,
      qty: s.qty
    };
  });

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
  syncToGoogleSheet("ADD_DOC", doc);
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
// =========================================================================
// TAB 3: WAREHOUSE STAGING PREPARATION SLIPS (PHÂN BIỆT PHIẾU CHUẨN BỊ & PHIẾU GOM ĐỒ)
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

  // Đếm theo từng loại phiếu: Phiếu chuẩn bị đồ vs Phiếu gom đồ
  const prepCount = pendingSlips.filter(s => s.slipType !== "GATHERING" && !s.code?.startsWith("GD_") && s.type !== "Phiếu gom đồ").length;
  const gomCount = pendingSlips.filter(s => s.slipType === "GATHERING" || s.code?.startsWith("GD_") || s.type === "Phiếu gom đồ").length;

  let pendingHtml = "";
  if (pendingSlips.length > 0) {
    pendingHtml = `
      <div class="p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/10 border-2 border-amber-400 rounded-2xl shadow-xs space-y-2.5">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <span class="p-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs shadow-2xs">
              <i data-lucide="bell" class="w-4 h-4"></i>
            </span>
            <div>
              <div class="font-extrabold text-xs sm:text-sm text-amber-950 flex items-center gap-1.5 flex-wrap">
                <span>CÓ PHIẾU CHUẨN BỊ ĐỒ & GOM ĐỒ CẦN XỬ LÝ</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">${pendingSlips.length} Phiếu</span>
              </div>
              <p class="text-[11px] text-amber-800">Phiếu chuẩn bị đồ ấn vào để mở thẳng bảng xuất đồ • Phiếu gom đồ (Excel) mở để gom hoặc chuyển đổi</p>
            </div>
          </div>
          <!-- Phân loại số lượng -->
          <div class="flex items-center gap-1.5 text-[11px]">
            <span class="px-2 py-0.5 rounded-lg font-bold bg-purple-100 text-purple-900 border border-purple-200">
              📋 Phiếu chuẩn bị: ${prepCount}
            </span>
            <span class="px-2 py-0.5 rounded-lg font-bold bg-cyan-100 text-cyan-900 border border-cyan-200">
              📦 Phiếu gom đồ (Excel): ${gomCount}
            </span>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
          ${pendingSlips.map(slip => {
            const isGom = (slip.slipType === "GATHERING" || slip.code?.startsWith("GD_") || slip.type === "Phiếu gom đồ");
            if (isGom) {
              // Phiếu gom đồ (Excel)
              return `
              <div onclick="openGomSlipModal('${slip.id}')" class="p-2.5 bg-white rounded-xl border border-cyan-300 flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs hover:border-cyan-500 transition cursor-pointer group">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-black text-xs text-cyan-900">${slip.code}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-cyan-100 text-cyan-800 border border-cyan-200">📦 Phiếu gom đồ (Excel)</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800">Chờ gom</span>
                  </div>
                  <div class="font-bold text-xs text-slate-800 truncate mt-1">${slip.tourName}</div>
                  <div class="text-[10px] text-slate-500">📍 ${slip.location || 'Tại kho'} • ${slip.items ? slip.items.length : 0} mục đạo cụ</div>
                </div>
                <button type="button" onclick="event.stopPropagation(); openGomSlipModal('${slip.id}')" class="shrink-0 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer">
                  <i data-lucide="package" class="w-3.5 h-3.5"></i>
                  <span>Gom Đồ</span>
                </button>
              </div>
              `;
            } else {
              // Phiếu chuẩn bị đồ (ấn vào mở thẳng bảng xuất đồ như 1 phiếu xuất đồ thông thường)
              return `
              <div onclick="applyPrepSlipToExport('${slip.id}')" class="p-2.5 bg-white rounded-xl border border-purple-300 flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs hover:border-purple-500 transition cursor-pointer group">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="font-black text-xs text-purple-900">${slip.code}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded font-extrabold bg-purple-100 text-purple-800 border border-purple-200">📋 Phiếu chuẩn bị đồ</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">Sẵn sàng xuất</span>
                  </div>
                  <div class="font-bold text-xs text-slate-800 truncate mt-1">${slip.tourName}</div>
                  <div class="text-[10px] text-slate-500">📍 ${slip.location || 'Tại kho'} • ${slip.items ? slip.items.length : 0} mục đạo cụ</div>
                </div>
                <button type="button" onclick="event.stopPropagation(); applyPrepSlipToExport('${slip.id}')" class="shrink-0 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer" title="Ấn để mở toàn bộ danh sách ra bảng xuất đồ">
                  <i data-lucide="clipboard-list" class="w-3.5 h-3.5"></i>
                  <span>Mở Phiếu Xuất</span>
                </button>
              </div>
              `;
            }
          }).join("")}
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
                <strong class="text-emerald-900">${slip.code}</strong>
                <span class="text-[10px] px-1.5 py-0.2 rounded font-bold bg-purple-100 text-purple-800 ml-1">
                  Phiếu chuẩn bị đồ
                </span>
                - <span class="font-medium text-slate-800">${slip.tourName}</span> <span class="text-slate-500">(${slip.items ? slip.items.length : 0} món)</span>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button type="button" onclick="applyPrepSlipToExport('${slip.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer">
                  <i data-lucide="zap" class="w-3 h-3"></i>
                  <span>Nạp Vào Phiếu Xuất</span>
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

const gomSlipTempPhoto = {};

function openGomSlipModal(slipId) {
  const slip = (state.prepSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  const modal = document.getElementById("modal-prep-slip");
  const badge = document.getElementById("prep-slip-code-badge");
  const subtitle = document.getElementById("prep-slip-subtitle");
  const body = document.getElementById("prep-slip-modal-body");

  if (!modal || !body) return;

  const modalH3 = modal.querySelector("h3");
  if (modalH3) {
    modalH3.innerHTML = `
      <span>📦 Phiếu Gom Đồ (Tải Lên Từ Excel)</span>
      <span id="prep-slip-code-badge" class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-cyan-200 text-cyan-900">${slip.code}</span>
    `;
  }

  if (subtitle) {
    subtitle.textContent = `Gom hàng từ các giá kệ theo danh sách file Excel • ${slip.tourName}`;
  }

  const teamPhoto = gomSlipTempPhoto[slipId] || slip.teamPhoto;

  body.innerHTML = `
    <!-- Slip Information Header -->
    <div class="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
      <div>
        <div><strong class="text-slate-700">Chương trình / Dự án:</strong> <span class="text-cyan-950 font-bold">${slip.tourName}</span></div>
        <div class="mt-1"><strong class="text-slate-700">Địa điểm tổ chức:</strong> ${slip.location || 'Tại kho'}</div>
      </div>
      <div>
        <div><strong class="text-slate-700">Ngày diễn ra:</strong> ${slip.eventDate || 'Hôm nay'}</div>
        <div class="mt-1"><strong class="text-slate-700">Kho chuẩn bị:</strong> ${slip.warehouseName || 'Kho Tổng'}</div>
      </div>
      ${slip.note ? `
        <div class="col-span-2 pt-1.5 border-t border-slate-200 text-slate-600 italic">
          <strong>Ghi chú:</strong> ${slip.note}
        </div>
      ` : ''}
    </div>

    <!-- Items Picking Checklist Cards -->
    <div class="space-y-2">
      <div class="flex items-center justify-between font-bold text-slate-800 text-xs">
        <span class="flex items-center gap-1.5">
          <i data-lucide="package" class="w-4 h-4 text-cyan-600"></i>
          <span>Danh Sách Đạo Cụ Cần Gom (${slip.items ? slip.items.length : 0} món):</span>
        </span>
        <span class="text-[11px] font-normal text-slate-500">Lấy từ các giá kệ kho</span>
      </div>

      <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
        ${(slip.items || []).map((it, idx) => `
          <div class="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs hover:border-cyan-300 transition">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="text-slate-400 font-bold text-[10px] w-4">${idx + 1}.</span>
                <span class="font-bold text-slate-800 text-xs truncate">${escapeHtml(it.name)}</span>
              </div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 pl-5 text-[11px] text-slate-500">
                <span>Số lượng: <strong class="text-cyan-800 text-xs">${it.qty}</strong> <span class="text-slate-700 font-medium">${it.unit || 'Chiếc'}</span></span>
                <span>•</span>
                <span>📍 Vị trí kho: <strong class="text-slate-700 font-medium">${it.shelf || 'Khu vực kho'}${it.tier ? ' (Tầng ' + it.tier + ')' : ''}</strong></span>
              </div>
            </div>
            <button type="button" onclick="deletePrepSlipItem('${slip.id}', ${idx})" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition shrink-0" title="Xóa món này">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Team Photo Section: BẮT BUỘC CHỤP ẢNH CẢ ĐỘI XUẤT ĐỒ -->
    <div class="p-3.5 bg-cyan-50/70 border-2 border-cyan-300 rounded-xl space-y-2.5">
      <div class="flex items-center justify-between text-xs">
        <span class="font-bold text-cyan-950 flex items-center gap-1.5">
          <i data-lucide="camera" class="w-4 h-4 text-cyan-700"></i>
          <span>Ảnh Cả Đội Xuất Đồ (Bắt buộc):</span>
        </span>
        <span class="text-[10px] text-rose-600 font-bold italic">* Phải có ảnh mới xác nhận lấy đồ được</span>
      </div>

      ${teamPhoto ? `
        <div class="relative w-full h-40 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-xs">
          <img src="${teamPhoto}" class="w-full h-full object-cover">
          <div class="absolute top-2 right-2 px-2 py-0.5 rounded bg-emerald-600 text-white font-bold text-[10px] shadow-xs flex items-center gap-1">
            <i data-lucide="check" class="w-3 h-3"></i>
            <span>✓ Đã có ảnh cả đội xuất đồ</span>
          </div>
        </div>
      ` : `
        <div class="w-full py-5 rounded-xl border-2 border-dashed border-cyan-300 bg-white flex flex-col items-center justify-center p-3 text-center">
          <i data-lucide="users" class="w-8 h-8 text-cyan-500 mb-1 opacity-70"></i>
          <span class="text-xs font-bold text-cyan-950">Chưa có ảnh cả đội xuất đồ</span>
          <span class="text-[10px] text-cyan-700">Chụp ảnh tập thể đội trước khi xe xuất hàng</span>
        </div>
      `}

      <div class="flex items-center gap-2">
        <button type="button" onclick="captureGomTeamPhoto('${slip.id}')" class="flex-1 py-2 bg-cyan-700 hover:bg-cyan-800 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 text-xs cursor-pointer">
          <i data-lucide="camera" class="w-4 h-4"></i>
          <span>${teamPhoto ? '📷 Chụp Lại Ảnh Đội' : '📷 Bật Máy Ảnh Chụp Đội'}</span>
        </button>
        <label class="flex-1 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 text-xs cursor-pointer">
          <i data-lucide="upload" class="w-4 h-4 text-slate-500"></i>
          <span>📁 Tải File Ảnh</span>
          <input type="file" accept="image/*" class="hidden" onchange="uploadGomTeamPhoto(event, '${slip.id}')">
        </label>
      </div>
    </div>

    <!-- 2 Distinct Actions -->
    <div class="pt-2 border-t border-slate-200 space-y-2">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <!-- Action 1: Chuyển thành phiếu chuẩn bị đồ -->
        <button type="button" onclick="convertGomSlipToPrep('${slip.id}')" class="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 text-xs cursor-pointer" title="Chuyển thành phiếu chuẩn bị đồ và tự động xóa phiếu gom đồ">
          <i data-lucide="clipboard-pen" class="w-4 h-4"></i>
          <span>Chuyển Thành Phiếu Chuẩn Bị</span>
        </button>

        <!-- Action 2: Xác nhận lấy đồ thành công (Bắt buộc có ảnh đội) -->
        <button type="button" onclick="confirmGomSlipSuccess('${slip.id}')" class="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 text-xs cursor-pointer" title="Xác nhận lấy đồ thành công (bắt buộc có ảnh cả đội) và tự động xóa phiếu gom đồ">
          <i data-lucide="check-check" class="w-4 h-4"></i>
          <span>Xác Nhận Lấy Đồ Thành Công</span>
        </button>
      </div>
      <p class="text-[10px] text-slate-400 text-center italic">
        * Khi ấn chuyển thành phiếu chuẩn bị hoặc xác nhận lấy đồ thành công thì phiếu gom đồ này sẽ tự động xóa.
      </p>
    </div>
  `;

  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function captureGomTeamPhoto(slipId) {
  openLiveCamera((imgUrl) => {
    gomSlipTempPhoto[slipId] = imgUrl;
    openGomSlipModal(slipId);
    showToast("Đã chụp ảnh cả đội xuất đồ thành công!", "success");
  });
}

function uploadGomTeamPhoto(event, slipId) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    gomSlipTempPhoto[slipId] = e.target.result;
    openGomSlipModal(slipId);
    showToast("Đã tải ảnh cả đội xuất đồ thành công!", "success");
  };
  reader.readAsDataURL(file);
  event.target.value = "";
}

function convertGomSlipToPrep(slipId) {
  const slipIndex = (state.prepSlips || []).findIndex(s => s.id === slipId);
  if (slipIndex === -1) return;
  const gomSlip = state.prepSlips[slipIndex];

  const prepCode = `CB_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const prepSlip = {
    id: `PREP-CB-${Date.now()}`,
    code: prepCode,
    slipType: "PREPARATION",
    type: "Phiếu chuẩn bị đồ",
    typeLabel: "Phiếu chuẩn bị đồ",
    tourName: gomSlip.tourName,
    location: gomSlip.location || "Tại kho",
    eventDate: gomSlip.eventDate || formatDate(new Date(), 'YYYY-MM-DD'),
    warehouseId: gomSlip.warehouseId || "WH-MD",
    warehouseName: gomSlip.warehouseName || "Kho Tổng Mỹ Đình",
    status: "PENDING_STAGING",
    stagedPhoto: null,
    stagedAt: null,
    items: JSON.parse(JSON.stringify(gomSlip.items || [])),
    source: "CONVERTED",
    note: `Phiếu chuẩn bị đồ chuyển đổi từ Phiếu gom đồ [${gomSlip.code}].`
  };

  // Phiếu gom đồ tự động xóa đi
  state.prepSlips.splice(slipIndex, 1);
  // Thêm phiếu chuẩn bị đồ mới
  state.prepSlips.unshift(prepSlip);
  saveState();

  closeModal("modal-prep-slip");
  renderTab3PrepSlipsBanner();
  applyPrepSlipToExport(prepSlip.id);
  showToast(`Đã chuyển đổi thành Phiếu chuẩn bị đồ [${prepCode}] và tự động xóa phiếu gom đồ!`, "success");
}

function confirmGomSlipSuccess(slipId) {
  const slipIndex = (state.prepSlips || []).findIndex(s => s.id === slipId);
  if (slipIndex === -1) return;
  const gomSlip = state.prepSlips[slipIndex];

  const teamPhoto = gomSlipTempPhoto[slipId];
  if (!teamPhoto) {
    alert("⚠️ BẮT BUỘC CHỤP ẢNH CẢ ĐỘI XUẤT ĐỒ!\n\nVui lòng bật máy ảnh chụp hoặc tải ảnh cả đội xuất đồ trước khi có thể xác nhận lấy đồ thành công.");
    return;
  }

  // Lưu ảnh cả đội vào state xuất kho
  state.tab3TeamPhoto = teamPhoto;

  // Nạp toàn bộ danh sách đồ vào bảng xuất kho
  applyPrepSlipToExport(slipId);

  // Phiếu gom đồ tự động xóa đi sau khi xác nhận lấy đồ thành công
  state.prepSlips.splice(slipIndex, 1);
  delete gomSlipTempPhoto[slipId];
  saveState();

  closeModal("modal-prep-slip");
  renderTab3PrepSlipsBanner();
  showToast(`✅ Đã xác nhận lấy đồ thành công cho [${gomSlip.tourName}]! Phiếu gom đồ tự động xóa.`, "success");
}

function deletePrepSlipItem(slipId, itemIdx) {
  const slip = (state.prepSlips || []).find(s => s.id === slipId);
  if (!slip || !slip.items || !slip.items[itemIdx]) return;

  const itemName = slip.items[itemIdx].name;
  slip.items.splice(itemIdx, 1);
  saveState();
  openGomSlipModal(slipId);
  renderTab3PrepSlipsBanner();
  showToast(`Đã xóa món [${itemName}] khỏi phiếu gom!`, "info");
}

function applyPrepSlipToExport(slipId) {
  const slip = (state.prepSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  const nameInput = document.getElementById("tab3-project-name");
  const locInput = document.getElementById("tab3-project-location");
  const dateInput = document.getElementById("tab3-project-date");
  const whSelect = document.getElementById("tab3-warehouse");

  if (nameInput) nameInput.value = slip.tourName;
  if (locInput) locInput.value = slip.location || "Tại kho";
  if (dateInput) dateInput.value = slip.eventDate || formatDate(new Date(), 'YYYY-MM-DD');
  if (whSelect && slip.warehouseId) whSelect.value = slip.warehouseId;

  state.tab3Combos = [];
  state.tab3DirectRows = (slip.items || []).map((it, idx) => ({
    id: `DIR-${Date.now()}-${idx + 1}`,
    name: it.name,
    unit: it.unit || "Chiếc",
    qty: it.qty,
    readyStock: it.qty,
    shelf: it.shelf || "Vị trí chuẩn bị đồ",
    itemId: null
  }));

  closeModal("modal-prep-slip");
  switchTab(3);
  renderTab3Table();

  // Scroll smoothly down to the export table
  const tbl = document.getElementById("tab3-export-table");
  if (tbl) tbl.scrollIntoView({ behavior: 'smooth', block: 'start' });

  showToast(`Đã hiển thị toàn bộ danh sách đồ từ [${slip.code}] ra phiếu xuất đồ!`, "success");
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

function resetTab3InspectionModalPhotos() {
  state.tab3TeamPhoto = "";
  state.tab3TruckPhoto = "";

  const pModal = document.getElementById("tab3-photo-team-preview-modal");
  if (pModal) {
    pModal.classList.add("hidden");
    const img = pModal.querySelector("img");
    if (img) img.src = "";
  }
  const pTruck = document.getElementById("tab3-photo-truck-preview");
  if (pTruck) {
    pTruck.classList.add("hidden");
    const img = pTruck.querySelector("img");
    if (img) img.src = "";
  }
  const notes = document.getElementById("tab3-notes");
  if (notes) notes.value = "";

  const teamPreview = document.getElementById("tab3-team-photo-preview");
  const teamStatus = document.getElementById("tab3-team-photo-status");
  if (teamPreview) teamPreview.classList.add("hidden");
  if (teamStatus) teamStatus.textContent = "Chưa có ảnh đội";
}

function resetTab3Form() {
  document.getElementById("tab3-project-name").value = "";
  document.getElementById("tab3-project-location").value = "";
  state.tab3Combos = [];
  state.tab3DismissedInflatable = false;
  initTab3DirectRows();
  resetTab3InspectionModalPhotos();

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

  state.tab3Combos.push({
    id: `CMB-ROW-${Date.now()}`,
    comboId: comboPreset.id,
    comboName: comboPreset.name,
    comboQty: comboQty,
    items: comboChildItems
  });

  // Tự động gán kèm Bộ dụng cụ bơm hơi tiêu chuẩn (SL = 1) nếu danh sách xuất có đồ hơi
  ensureInflatableToolsetTab3();

  renderTab3Table();
  showToast(`Đã thêm Bộ Game [${comboPreset.name}] (${comboQty} bộ) vào danh sách!`, "success");
}

function ensureInflatableToolsetTab3() {
  const whId = document.getElementById("tab3-warehouse")?.value || "WH-MD";

  const INFLATABLE_KEYWORDS = [
    "hơi", "phao", "bạt", "bơm hơi", "khí cầu", "bánh xe bạt",
    "cổng hơi", "nhà hơi", "lâu đài hơi", "con lăn hơi", "bóng khổng lồ",
    "núi hơi", "thuyền phao", "cầu phao"
  ];

  let hasInflatableInCombos = false;
  state.tab3Combos.forEach(c => {
    if (c.comboId === "TOOL-01" || (c.comboName && c.comboName.toLowerCase().includes("bơm hơi tiêu chuẩn"))) return;
    (c.items || []).forEach(ci => {
      const match = state.items.find(i => i.id === ci.itemId || i.name.toLowerCase() === ci.name.toLowerCase());
      if ((match && match.category === "Đồ hơi") || INFLATABLE_KEYWORDS.some(kw => (ci.name || "").toLowerCase().includes(kw))) {
        hasInflatableInCombos = true;
      }
    });
  });

  let hasInflatableInDirect = false;
  (state.tab3DirectRows || []).forEach(r => {
    if (r.name && Number(r.qty) > 0) {
      const match = state.items.find(i => i.name.toLowerCase() === r.name.toLowerCase());
      if ((match && match.category === "Đồ hơi") || INFLATABLE_KEYWORDS.some(kw => (r.name || "").toLowerCase().includes(kw))) {
        hasInflatableInDirect = true;
      }
    }
  });

  const needsInflatableKit = hasInflatableInCombos || hasInflatableInDirect;
  const existingToolIdx = state.tab3Combos.findIndex(c => c.comboId === "TOOL-01" || (c.comboName && c.comboName.toLowerCase().includes("bơm hơi tiêu chuẩn")));

  if (needsInflatableKit && !state.tab3DismissedInflatable) {
    if (existingToolIdx === -1) {
      const toolPreset = (state.combos || []).find(c => c.id === "TOOL-01" || c.name.toLowerCase().includes("bơm hơi tiêu chuẩn")) || {
        id: "TOOL-01",
        name: "Bộ Dụng Cụ Bơm Hơi Tiêu Chuẩn",
        items: [
          { name: "Máy thổi khí công suất lớn 1500W", unit: "Chiếc", quantityPerSet: 1 },
          { name: "Cuộn dây điện nguồn 20m", unit: "Cuộn", quantityPerSet: 1 }
        ]
      };

      const childItems = (toolPreset.items || []).map(ci => {
        const match = state.items.find(i => i.name.toLowerCase() === ci.name.toLowerCase() && i.warehouseId === whId) ||
          state.items.find(i => i.name.toLowerCase() === ci.name.toLowerCase()) || {
            name: ci.name,
            unit: ci.unit || "Chiếc",
            ready: 0,
            shelves: [{ shelf: "Kho", qty: 0 }]
          };
        return {
          itemId: match.id || null,
          name: ci.name,
          unit: ci.unit || "Chiếc",
          qty: 1, // ALWAYS 1 regardless of number of games
          readyStock: (match.warehouseId === whId) ? (match.ready || 0) : 0,
          shelf: (match.warehouseId === whId) ? (match.shelves || []).map(s => s.shelf).join(", ") : (match.warehouseName || "Kho")
        };
      });

      state.tab3Combos.push({
        id: `CMB-ROW-TOOL-01`,
        comboId: "TOOL-01",
        comboName: "Bộ Dụng Cụ Bơm Hơi Tiêu Chuẩn (Tự động gán kèm khi có đồ hơi)",
        comboQty: 1,
        items: childItems
      });
    } else {
      // Ensure quantity stays strictly 1
      state.tab3Combos[existingToolIdx].comboQty = 1;
      (state.tab3Combos[existingToolIdx].items || []).forEach(ci => {
        ci.qty = 1;
      });
    }
  }
}

function toggleTab3ComboCollapse(comboRowId) {
  state.tab3CollapsedCombos[comboRowId] = !state.tab3CollapsedCombos[comboRowId];
  renderTab3Table();
}

function removeTab3Combo(comboRowId) {
  if (comboRowId === "CMB-ROW-TOOL-01") {
    state.tab3DismissedInflatable = true;
  }
  state.tab3Combos = state.tab3Combos.filter(c => c.id !== comboRowId);
  renderTab3Table();
}

function removeTab3ComboChild(comboRowId, itemIndex) {
  const combo = state.tab3Combos.find(c => c.id === comboRowId);
  if (!combo || !combo.items || !combo.items[itemIndex]) return;
  const removedName = combo.items[itemIndex].name;
  combo.items.splice(itemIndex, 1);
  if (combo.items.length === 0) {
    if (comboRowId === "CMB-ROW-TOOL-01") {
      state.tab3DismissedInflatable = true;
    }
    state.tab3Combos = state.tab3Combos.filter(c => c.id !== comboRowId);
  }
  renderTab3Table();
  showToast(`Đã xóa món [${removedName}] khỏi bộ!`, "info");
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
  const mobileContainer = document.getElementById("tab3-mobile-cards");
  if (!tbody && !mobileContainer) return;

  ensureInflatableToolsetTab3();

  let stt = 1;
  let html = "";
  let mobileHtml = "";

  // 1. Render Game Combos
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

    let comboChildrenMobile = "";

    if (!isCollapsed) {
      combo.items.forEach((child, cIdx) => {
        const isEnough = (child.readyStock >= child.qty);
        let statusBadge = "";
        let mobileBadge = "";
        if (child.readyStock === 0) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hết hàng (0 tại kho)</span>`;
          mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hết hàng (0)</span>`;
        } else if (isEnough) {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ tồn kho (Có ${child.readyStock} tại kho)</span>`;
          mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ tồn (Có ${child.readyStock})</span>`;
        } else {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu ${child.qty - child.readyStock} (Chỉ có ${child.readyStock} tại kho)</span>`;
          mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu ${child.qty - child.readyStock}</span>`;
        }

        // Desktop
        html += `
          <tr class="hover:bg-slate-50 transition">
            <td class="py-2 px-3 text-center text-slate-400">${stt}</td>
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
              <button type="button" onclick="removeTab3ComboChild('${combo.id}', ${cIdx})" class="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 transition" title="Xóa món con này khỏi bộ">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 inline"></i>
              </button>
            </td>
          </tr>
        `;

        // Mobile card child item
        comboChildrenMobile += `
          <div class="p-2.5 bg-white rounded-lg border border-amber-200/80 space-y-1.5 text-xs">
            <div class="flex items-start justify-between gap-1.5">
              <div class="flex-1 min-w-0">
                <span class="font-bold text-slate-900 text-xs">${child.name}</span>
                <span class="text-[10px] text-slate-500 ml-1">(${child.unit})</span>
              </div>
              <button type="button" onclick="removeTab3ComboChild('${combo.id}', ${cIdx})" class="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50 shrink-0" title="Xóa món khỏi bộ">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 shrink-0">
                <span class="text-[11px] text-slate-500 font-medium">Số lượng:</span>
                <input type="number" min="1" value="${child.qty}" onchange="updateTab3ComboChildQty('${combo.id}', ${cIdx}, this.value)" class="w-14 p-1 border border-slate-300 rounded text-center font-bold text-sky-900 text-xs">
              </div>
              <div class="text-right">
                ${mobileBadge}
              </div>
            </div>
            <div class="text-[10px] text-slate-500 truncate pt-0.5 border-t border-slate-100">
              📍 ${child.shelf}
            </div>
          </div>
        `;
        stt++;
      });
    }

    mobileHtml += `
      <div class="bg-amber-50/70 border border-amber-300 rounded-xl p-2.5 space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onclick="toggleTab3ComboCollapse('${combo.id}')">
            <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4 text-amber-700 shrink-0"></i>
            <span class="font-bold text-amber-950 text-xs truncate">📦 BỘ: ${combo.comboName}</span>
            <span class="text-[10px] text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded-md font-bold shrink-0">${combo.comboQty} bộ</span>
          </div>
          <button type="button" onclick="removeTab3Combo('${combo.id}')" class="text-rose-500 hover:text-rose-700 p-1 shrink-0" title="Xóa cả bộ">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        ${!isCollapsed ? `<div class="space-y-1.5 pl-2 border-l-2 border-amber-300">${comboChildrenMobile}</div>` : ''}
      </div>
    `;
  });

  // 2. Render Direct Inline Rows for Loose Items (Image 3)
  state.tab3DirectRows.forEach(row => {
    const isWarn = !!row.isWarning;
    let statusBadge = '<span class="text-slate-400">---</span>';
    let mobileBadge = '<span class="text-slate-400">---</span>';

    if (isWarn) {
      statusBadge = `<span class="px-2.5 py-1 rounded text-[10px] font-bold bg-amber-500 text-white shadow-xs">⚠️ Chưa nhận diện</span>`;
      mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">⚠️ Chưa nhận diện</span>`;
    } else if (row.name && row.qty > 0) {
      if (row.readyStock === 0) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hết hàng (0 tại kho)</span>`;
        mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Hết hàng (0)</span>`;
      } else if (row.readyStock >= row.qty) {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ tồn kho (Có ${row.readyStock} tại kho)</span>`;
        mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ tồn (Có ${row.readyStock})</span>`;
      } else {
        statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu ${row.qty - row.readyStock} (Chỉ có ${row.readyStock} tại kho)</span>`;
        mobileBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Thiếu ${row.qty - row.readyStock}</span>`;
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
        <td class="py-2 px-3 text-center font-semibold ${isWarn ? 'text-amber-800 font-bold' : 'text-slate-400'}">${stt}</td>
        
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

    // Mobile Card for Direct Row
    mobileHtml += `
      <div class="bg-white p-2.5 rounded-xl border ${isWarn ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'} shadow-2xs space-y-1.5 text-xs">
        <div class="flex items-center justify-between gap-1.5">
          <span class="w-5 text-center font-bold text-slate-400 text-[11px] shrink-0">#${stt}</span>
          <div class="flex-1 min-w-0 relative">
            <input type="text" value="${row.name}" autocomplete="off" oninput="handleTab3DirectNameInput('${row.id}', this.value, this)" placeholder="Gõ tên đạo cụ..." class="${inputNameClass}">
          </div>
          <span class="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-1 rounded shrink-0">${row.unit || 'ĐVT'}</span>
          <button type="button" onclick="removeTab3DirectRow('${row.id}')" class="text-slate-400 hover:text-rose-600 p-1 shrink-0" title="Xóa dòng">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
        ${isWarn ? `<div class="text-[10px] text-amber-800 font-bold">⚠️ Chưa nhận diện tên đồ trong hệ thống (Gõ để chọn)</div>` : ''}
        <div class="flex items-center justify-between gap-2 pt-0.5">
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="text-[11px] font-medium text-slate-600">Số lượng:</span>
            <input type="number" min="0" value="${row.qty}" onchange="updateTab3DirectQty('${row.id}', this.value)" class="${qtyInputClass}">
          </div>
          <div class="text-right">
            ${mobileBadge}
          </div>
        </div>
        <div class="text-[10px] text-slate-500 truncate pt-0.5 border-t border-slate-100">
          ${shelfDisplay}
        </div>
      </div>
    `;
    stt++;
  });

  if (tbody) tbody.innerHTML = html;
  if (mobileContainer) mobileContainer.innerHTML = mobileHtml;
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

      // Tự động tạo "Phiếu gom đồ" có danh sách đồ cần lấy sau khi gửi file Excel lên
      const excelGomItems = [];
      rows.forEach(r => {
        const rawCode = String(r["Mã Đồ"] || r["Mã đồ"] || r["Ma Do"] || r["Mã Đạo Cụ"] || r["Mã"] || r["Code"] || "").trim();
        const rawName = String(r["Tên Đồ"] || r["Tên đồ"] || r["Ten Do"] || r["Tên Đạo Cụ"] || r["Tên Đạo cụ"] || r["Tên"] || r["Name"] || "").trim();
        const qty = Math.max(1, Number(r["Số Lượng"] || r["Số lượng"] || r["So Luong"] || r["SL"] || r["Qty"] || 1));
        const unit = String(r["Đơn Vị Tính"] || r["Đơn vị tính"] || r["ĐVT"] || r["Don Vi Tinh"] || r["DVT"] || r["Unit"] || "").trim();
        if (!rawCode && !rawName) return;

        let match = null;
        if (rawCode) {
          match = state.items.find(i => (i.code || "").toLowerCase() === rawCode.toLowerCase());
        }
        if (!match && rawName) {
          match = state.items.find(i => i.name.toLowerCase() === rawName.toLowerCase());
        }

        excelGomItems.push({
          name: match ? match.name : (rawName || rawCode),
          qty: qty,
          unit: match ? (match.unit || unit || "Chiếc") : (unit || "ĐVT"),
          shelf: match && match.shelves && match.shelves[0] ? match.shelves[0].shelf : "Khu vực kho",
          tier: match && match.shelves && match.shelves[0] ? match.shelves[0].tier : "1"
        });
      });

      if (excelGomItems.length > 0) {
        const gdCode = `GD_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
        const whObj = state.warehouses.find(w => w.id === whId) || state.warehouses[0];
        const gomSlip = {
          id: `PREP-GD-${Date.now()}`,
          code: gdCode,
          slipType: "GATHERING", // Phiếu gom đồ (sau khi gửi file Excel lên)
          type: "Phiếu gom đồ",
          typeLabel: "Phiếu gom đồ",
          tourName: parsedProjectName || "Dự án tải lên từ Excel",
          location: parsedLocation || "Tại kho",
          eventDate: parsedDate || formatDate(new Date(), 'YYYY-MM-DD'),
          warehouseId: whId || (whObj ? whObj.id : "WH-MD"),
          warehouseName: whObj ? whObj.name : "Kho Tổng Mỹ Đình",
          status: "PENDING_STAGING",
          stagedPhoto: null,
          stagedAt: null,
          items: excelGomItems,
          source: "EXCEL",
          note: "Phiếu gom đồ tự động tạo theo danh sách đồ cần lấy từ file Excel gửi lên."
        };
        if (!state.prepSlips) state.prepSlips = [];
        state.prepSlips.unshift(gomSlip);
        saveState();
        renderTab3PrepSlipsBanner();
      }

      let infoMsg = `Đã nhập thành công ${countSuccess} món vào bảng xuất & tạo Phiếu gom đồ!`;
      if (parsedProjectName) infoMsg += ` (Dự án: ${parsedProjectName})`;
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

function getTab3OutOfStockItems() {
  const whId = document.getElementById("tab3-warehouse")?.value;
  const outOfStock = [];

  // Check combos
  state.tab3Combos.forEach(combo => {
    (combo.items || []).forEach(child => {
      const match = state.items.find(i => (child.itemId && i.id === child.itemId) || (i.name.toLowerCase() === child.name.toLowerCase() && i.warehouseId === whId)) ||
                    state.items.find(i => i.name.toLowerCase() === child.name.toLowerCase());
      const stock = (match && match.warehouseId === whId) ? (match.ready || 0) : (match ? match.ready || 0 : (child.readyStock || 0));
      if (stock <= 0 || stock < child.qty) {
        outOfStock.push({
          name: child.name,
          qty: child.qty,
          readyStock: stock,
          comboName: combo.comboName
        });
      }
    });
  });

  // Check direct rows
  state.tab3DirectRows.forEach(row => {
    if (row.name && row.qty > 0) {
      const match = state.items.find(i => (row.itemId && i.id === row.itemId) || (i.name.toLowerCase() === row.name.toLowerCase() && i.warehouseId === whId)) ||
                    state.items.find(i => i.name.toLowerCase() === row.name.toLowerCase());
      const stock = (match && match.warehouseId === whId) ? (match.ready || 0) : (match ? match.ready || 0 : (row.readyStock || 0));
      if (stock <= 0 || stock < row.qty) {
        outOfStock.push({
          name: row.name,
          qty: row.qty,
          readyStock: stock,
          comboName: null
        });
      }
    }
  });

  return outOfStock;
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

  // Kiểm tra tồn kho: Hết hàng thì không thể xác nhận lấy đồ / lập phiếu được
  const outOfStock = getTab3OutOfStockItems();
  if (outOfStock.length > 0) {
    alert(`⚠️ KHÔNG THỂ LẬP PHIẾU DO ĐẠO CỤ HẾT HÀNG!\n\nCó ${outOfStock.length} món đạo cụ đang hết hàng hoặc không đủ tồn kho:\n${outOfStock.map(i => `• ${i.name} (Cần: ${i.qty}, Tồn kho: ${i.readyStock})`).join("\n")}\n\nVui lòng bấm nút xóa (thùng rác) các món hết hàng hoặc chọn kho khác trước khi lưu phiếu!`);
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
    note: "Phiếu chuẩn bị gom đồ nháp trước khi xe đến xếp tải.",
    keeperApproved: false,
    keeperName: "",
    keeperAvatar: ""
  };

  // Phiếu chuẩn bị là phiếu nháp gom đồ nội bộ, không gửi yêu cầu duyệt tới thủ kho
  state.documents.unshift(doc);

  // Tạo và thêm "Phiếu chuẩn bị đồ" vào state.prepSlips (Phiếu đã ấn vào nút chuyển thành phiếu chuẩn bị đồ)
  const prepSlip = {
    id: `PREP-CB-${Date.now()}`,
    code: prepCode,
    slipType: "PREPARATION", // Phiếu chuẩn bị đồ (chuyển đổi từ nút)
    type: "Phiếu chuẩn bị đồ",
    typeLabel: "Phiếu chuẩn bị đồ",
    tourName: pName,
    location: pLoc || wh.name,
    eventDate: document.getElementById("tab3-project-date")?.value || formatDate(new Date(), 'YYYY-MM-DD'),
    warehouseId: whId,
    warehouseName: wh.name,
    status: "PENDING_STAGING",
    stagedPhoto: null,
    stagedAt: null,
    items: exportItems.map(it => ({
      name: it.name,
      qty: it.qty,
      unit: it.unit,
      shelf: it.shelf || "Khu vực kho",
      tier: it.tier || "1"
    })),
    source: "MANUAL",
    note: "Phiếu chuẩn bị đồ chuyển từ Bảng xuất kho ra Vị trí chuẩn bị đồ."
  };

  if (!state.prepSlips) state.prepSlips = [];
  state.prepSlips.unshift(prepSlip);

  saveState();
  renderTab3PrepSlipsBanner();
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

  // Kiểm tra tồn kho: Hết hàng thì không thể xuất đồ được
  const outOfStock = getTab3OutOfStockItems();
  if (outOfStock.length > 0) {
    alert(`⚠️ KHÔNG THỂ XUẤT ĐỒ DO ĐẠO CỤ HẾT HÀNG!\n\nCó ${outOfStock.length} món đạo cụ đang hết hàng hoặc không đủ tồn kho:\n${outOfStock.map(i => `• ${i.name} (Cần: ${i.qty}, Tồn kho: ${i.readyStock})`).join("\n")}\n\nVui lòng bấm nút xóa (thùng rác) các món hết hàng hoặc chọn kho khác trước khi xuất kho!`);
    return;
  }

  // Reset ảnh xe tải của phiếu trước để tránh để sẵn ảnh cũ
  const truckPreview = document.getElementById("tab3-photo-truck-preview");
  if (truckPreview) {
    truckPreview.classList.add("hidden");
    const img = truckPreview.querySelector("img");
    if (img) img.src = "";
  }
  const teamModalPreview = document.getElementById("tab3-photo-team-preview-modal");
  if (teamModalPreview) {
    if (state.tab3TeamPhoto) {
      const img = teamModalPreview.querySelector("img");
      if (img) img.src = state.tab3TeamPhoto;
      teamModalPreview.classList.remove("hidden");
    } else {
      teamModalPreview.classList.add("hidden");
      const img = teamModalPreview.querySelector("img");
      if (img) img.src = "";
    }
  }
  const notes = document.getElementById("tab3-notes");
  if (notes) notes.value = "";

  const modal = document.getElementById("modal-tab3-inspection");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function submitFormalDispatchSlip() {
  const submitBtn = document.querySelector("#modal-tab3-inspection button[onclick='submitFormalDispatchSlip()']");
  if (submitBtn) submitBtn.disabled = true;

  const truckImg = document.querySelector("#tab3-photo-truck-preview img")?.src;
  const teamImg = state.tab3TeamPhoto || document.querySelector("#tab3-photo-team-preview-modal img")?.src;

  if (!truckImg) {
    alert("Bắt buộc phải chụp ảnh nghiệm thu đạo cụ xếp lên xe tải trước khi hoàn tất!");
    if (submitBtn) submitBtn.disabled = false;
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

  // Remove corresponding Draft Prep Slips from documents & from state.prepSlips
  state.documents = state.documents.filter(d => !(d.type === "Chuẩn bị" && d.tourName.toLowerCase() === pName.toLowerCase()));
  if (state.prepSlips) {
    state.prepSlips = state.prepSlips.filter(s => s.id !== state.currentActivePrepSlipId && s.tourName.toLowerCase() !== pName.toLowerCase());
    state.currentActivePrepSlipId = null;
    renderTab3PrepSlipsBanner();
  }

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
  syncToGoogleSheet("ADD_DOC", doc);
  closeModal("modal-tab3-inspection");
  resetTab3Form();

  if (submitBtn) submitBtn.disabled = false;
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

  renderTab4PostCheckBanner();
  updateTab4Badge();
}

function loadTab4TourData(tourId) {
  state.activePostCheckingSlipId = null;
  const tour = state.tours.find(t => t.id === tourId);
  state.tab4TourSelected = tour || null;
  const banner = document.getElementById("tab4-tour-banner");
  if (!tour) {
    if (banner) banner.classList.add("hidden");
    const tbody = document.getElementById("tab4-return-table-body");
    if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Vui lòng chọn Chương trình phía trên để tải danh sách đạo cụ</td></tr>`;
    const mobileCards = document.getElementById("tab4-mobile-cards");
    if (mobileCards) mobileCards.innerHTML = `<div class="p-4 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">Vui lòng chọn Chương trình phía trên để tải danh sách đạo cụ</div>`;
    return;
  }

  if (banner) {
    banner.classList.remove("hidden");
    const modeBadge = document.getElementById("tab4-banner-mode-badge");
    if (modeBadge) {
      modeBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-black bg-sky-600 text-white flex items-center gap-1 shadow-2xs";
      modeBadge.innerHTML = `<i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i><span>THU HỒI CHƯƠNG TRÌNH</span>`;
    }
    const tn = document.getElementById("tab4-banner-tourname");
    if (tn) tn.textContent = tour.name;
    const loc = document.getElementById("tab4-banner-location");
    if (loc) loc.textContent = `📍 ${tour.location}`;
    const tot = document.getElementById("tab4-banner-total");
    if (tot) tot.textContent = `${tour.totalItems || 0} món`;

    // Locked "Người trả đồ trước đó"
    const retInput = document.getElementById("tab4-banner-returner");
    if (retInput) retInput.value = tour.leader || "Chưa rõ phụ trách";

    // Locked "Người thực hiện" based on logged-in account
    const chkInput = document.getElementById("tab4-banner-checker");
    if (chkInput) chkInput.value = `${state.currentUser ? state.currentUser.name : 'Nguyễn Văn An'} (${state.currentUser ? state.currentUser.phone : 'Thủ kho'})`;

    // Kho tiếp nhận hoàn trả
    const whSel = document.getElementById("tab4-warehouse");
    if (whSel && tour.warehouseId) {
      if (Array.from(whSel.options).some(o => o.value === tour.warehouseId)) {
        whSel.value = tour.warehouseId;
      }
    }
  }

  const submitBtnSpan = document.querySelector("#tab4 button[onclick='submitTab4ReturnSlip()'] span");
  if (submitBtnSpan) submitBtnSpan.textContent = "Hoàn Tất Nhập Kho (NK_...)";

  state.tab4ReturnChecklist = (tour.props || []).map((p, idx) => ({
    id: `RET-${idx}`,
    itemId: p.itemId,
    comboId: p.comboId || null,
    comboName: p.comboName || null,
    name: p.name,
    unit: p.unit,
    dispatchedQty: p.qty,
    goodQty: p.qty,
    shelves: [
      { shelf: "", tier: "", qty: p.qty }
    ],
    shelf: "Khu vực Hậu kiểm",
    tier: "Mặt sàn",
    warehouseId: p.warehouseId
  }));

  renderTab4ReturnTable();
  renderTab4BrokenTable();
  if (window.lucide) lucide.createIcons();
}

function loadTab4PostCheckSlip(slipId) {
  const slip = (state.postCheckSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  state.activePostCheckingSlipId = slipId;

  // Giả lập tour selected để vượt qua kiểm tra submit
  state.tab4TourSelected = {
    id: slip.tourId || `POSTCHECK-${slip.id}`,
    name: slip.tourName,
    location: slip.location || "Tại kho",
    leader: slip.returnerName || "Lê Hoàng Long",
    totalItems: slip.totalItems || (slip.items ? slip.items.reduce((acc, i) => acc + (i.qty || 0), 0) : 0),
    props: slip.items || []
  };

  const banner = document.getElementById("tab4-tour-banner");
  if (banner) {
    banner.classList.remove("hidden");
    const modeBadge = document.getElementById("tab4-banner-mode-badge");
    if (modeBadge) {
      modeBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500 text-white flex items-center gap-1 shadow-2xs";
      modeBadge.innerHTML = `<i data-lucide="archive" class="w-3.5 h-3.5"></i><span>PHIẾU HẬU KIỂM: ${slip.code}</span>`;
    }
    const tn = document.getElementById("tab4-banner-tourname");
    if (tn) tn.textContent = slip.tourName;
    const loc = document.getElementById("tab4-banner-location");
    if (loc) loc.textContent = `📍 ${slip.location || 'Tại kho'}`;
    const tot = document.getElementById("tab4-banner-total");
    if (tot) tot.textContent = `${state.tab4TourSelected.totalItems} món`;

    // Locked "Người trả đồ trước đó"
    const retInput = document.getElementById("tab4-banner-returner");
    if (retInput) retInput.value = slip.returnerName || "Lê Hoàng Long";

    // Locked "Người thực hiện" based on current logged in user
    const chkInput = document.getElementById("tab4-banner-checker");
    if (chkInput) chkInput.value = `${state.currentUser ? state.currentUser.name : 'Nguyễn Văn An'} (${state.currentUser ? state.currentUser.phone : 'Thủ kho'})`;

    // Kho tiếp nhận hoàn trả
    const whSel = document.getElementById("tab4-warehouse");
    if (whSel) {
      const whId = slip.warehouseId || "WH-MD";
      if (Array.from(whSel.options).some(o => o.value === whId)) {
        whSel.value = whId;
      }
    }
  }

  // Load items into Tab 4 return checklist (Vị trí để đồ lưu mới: Phân bổ các kệ kho mới)
  state.tab4ReturnChecklist = (slip.items || []).map((it, idx) => {
    const rawShelf = it.targetShelf || it.shelf || "Giá A";
    let sName = rawShelf;
    let sTier = "1";
    if (rawShelf.includes("-")) {
      const parts = rawShelf.split("-");
      sName = parts[0].trim();
      sTier = parts[1].replace(/Tầng|tầng/g, "").trim() || "1";
    }
    const gQty = (it.goodQty !== undefined) ? it.goodQty : it.qty;
    return {
      id: `RET-HK-${idx}`,
      itemId: it.id || `ITEM-HK-${idx}`,
      comboId: null,
      comboName: null,
      name: it.name,
      unit: it.unit || "Chiếc",
      dispatchedQty: it.qty,
      goodQty: gQty,
      shelves: [
        { shelf: sName, tier: sTier, qty: gQty }
      ],
      shelf: sName,
      tier: sTier,
      warehouseId: slip.warehouseId || "WH-MD"
    };
  });

  // Broken items from slip (nếu có)
  state.tab4BrokenItems = [];
  (slip.items || []).forEach((it, idx) => {
    if (it.brokenQty && it.brokenQty > 0) {
      state.tab4BrokenItems.push({
        id: `BROKEN-HK-${Date.now()}-${idx}`,
        name: it.name,
        qty: it.brokenQty,
        shelf: "Khu vực đồ hỏng",
        reason: "Cần kiểm tra khắc phục",
        photos: []
      });
    }
  });

  // Hiển thị ảnh đồ lưu kho hậu kiểm (nếu có)
  if (slip.photo) {
    state.tab4UnloadPhoto = slip.photo;
    const preview = document.getElementById("tab4-unload-photo-preview");
    if (preview) {
      preview.classList.remove("hidden");
      const img = preview.querySelector("img");
      if (img) img.src = slip.photo;
    }
    const statusEl = document.getElementById("tab4-unload-photo-status");
    if (statusEl) statusEl.textContent = "✓ Ảnh đồ lưu kho hậu kiểm (Có sẵn)";
  }

  // Đổi nút submit thành Hoàn tất hậu kiểm & Nhập kho
  const submitBtnSpan = document.querySelector("#tab4 button[onclick='submitTab4ReturnSlip()'] span");
  if (submitBtnSpan) submitBtnSpan.textContent = `Hoàn Tất Hậu Kiểm (${slip.code})`;

  renderTab4ReturnTable();
  renderTab4BrokenTable();

  // Scroll smoothly down to the banner
  if (banner) banner.scrollIntoView({ behavior: 'smooth', block: 'start' });

  showToast(`Đã mở phiếu hậu kiểm [${slip.code}]! Hãy kiểm tra, phân bổ vị trí lưu mới và hoàn tất nhập kho.`, "info");
  if (window.lucide) lucide.createIcons();
}

function cancelTab4ActiveProgram() {
  state.activePostCheckingSlipId = null;
  state.tab4TourSelected = null;
  state.tab4ReturnChecklist = [];
  state.tab4BrokenItems = [];

  const sel = document.getElementById("tab4-tour-select");
  if (sel) sel.value = "";

  const banner = document.getElementById("tab4-tour-banner");
  if (banner) banner.classList.add("hidden");

  const submitBtnSpan = document.querySelector("#tab4 button[onclick='submitTab4ReturnSlip()'] span");
  if (submitBtnSpan) submitBtnSpan.textContent = "Hoàn Tất Nhập Kho (NK_...)";

  renderTab4ReturnTable();
  renderTab4BrokenTable();
  showToast("Đã hủy chọn chương trình.", "info");
}

function toggleTab4ComboCollapse(comboId) {
  state.tab4CollapsedCombos[comboId] = !state.tab4CollapsedCombos[comboId];
  renderTab4ReturnTable();
}

function addTab4ItemShelf(itemIdx) {
  const item = state.tab4ReturnChecklist[itemIdx];
  if (!item) return;
  if (!item.shelves) item.shelves = [];
  item.shelves.push({
    shelf: "",
    tier: "",
    qty: 0
  });
  renderTab4ReturnTable();
}

function removeTab4ItemShelf(itemIdx, shelfIdx) {
  const item = state.tab4ReturnChecklist[itemIdx];
  if (!item || !item.shelves) return;
  if (item.shelves.length <= 1) {
    showToast("Mỗi đạo cụ phải có ít nhất 1 dòng vị trí giá kệ!", "warning");
    return;
  }
  item.shelves.splice(shelfIdx, 1);
  renderTab4ReturnTable();
}

function updateTab4ItemShelf(itemIdx, shelfIdx, field, val) {
  const item = state.tab4ReturnChecklist[itemIdx];
  if (!item || !item.shelves || !item.shelves[shelfIdx]) return;
  if (field === 'qty') {
    item.shelves[shelfIdx].qty = Math.max(0, Number(val || 0));
  } else {
    item.shelves[shelfIdx][field] = val;
  }
  if (shelfIdx === 0) {
    item.shelf = item.shelves[0].shelf;
    item.tier = item.shelves[0].tier;
  }
}

function updateTab4BrokenQtyDirect(itemName, val) {
  const qty = Math.max(0, Number(val || 0));
  const existingIdx = (state.tab4BrokenItems || []).findIndex(b => b.name.toLowerCase() === itemName.toLowerCase());
  if (qty > 0) {
    if (existingIdx >= 0) {
      state.tab4BrokenItems[existingIdx].qty = qty;
    } else {
      state.tab4BrokenItems.push({
        id: `BRK-${Date.now()}-${Math.floor(10 + Math.random() * 90)}`,
        name: itemName,
        qty: qty,
        shelf: "Khu vực Đồ Hỏng (SC-01)",
        reason: "Hỏng sau khi kết thúc chương trình",
        photos: []
      });
    }
  } else {
    if (existingIdx >= 0) {
      state.tab4BrokenItems.splice(existingIdx, 1);
    }
  }
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
  const mobileContainer = document.getElementById("tab4-mobile-cards");
  if (!tbody && !mobileContainer) return;

  if (!state.tab4TourSelected || state.tab4ReturnChecklist.length === 0) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">Vui lòng chọn Chương trình phía trên để tải danh sách đạo cụ</td></tr>`;
    }
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div class="p-4 text-center text-slate-400 bg-white rounded-xl border border-slate-200 text-xs">Vui lòng chọn Chương trình phía trên để tải danh sách đạo cụ</div>`;
    }
    return;
  }

  // 1. Render Desktop Table View
  if (tbody) {
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

      const shelfSum = (row.shelves || []).reduce((acc, s) => acc + (Number(s.qty) || 0), 0);

      const desktopShelvesHtml = (row.shelves || []).map((s, sIdx) => {
        const suggestedLetter = String.fromCharCode(65 + (sIdx % 26));
        const suggestedTier = String(sIdx + 1);
        return `
          <div class="flex items-center gap-1 text-xs mb-1">
            <span class="w-4 text-[10px] text-slate-400 font-bold">#${sIdx + 1}</span>
            <input type="text" value="${s.shelf || ''}" placeholder="${suggestedLetter}" onfocus="this.select()" oninput="updateTab4ItemShelf(${idx}, ${sIdx}, 'shelf', this.value)" class="w-24 p-1 border border-slate-300 rounded text-xs font-semibold text-slate-900" title="Gợi ý Giá ${suggestedLetter}">
            <input type="text" value="${s.tier || ''}" placeholder="${suggestedTier}" onfocus="this.select()" oninput="updateTab4ItemShelf(${idx}, ${sIdx}, 'tier', this.value)" class="w-16 p-1 border border-slate-300 rounded text-xs text-center font-semibold text-slate-900" title="Gợi ý Tầng ${suggestedTier}">
            <input type="number" min="0" value="${s.qty}" onfocus="this.select()" oninput="updateTab4ItemShelf(${idx}, ${sIdx}, 'qty', this.value)" class="w-14 p-1 border border-slate-300 rounded text-center font-bold text-xs text-slate-900" title="SL cất ở kệ này">
            ${row.shelves.length > 1 ? `
              <button type="button" onclick="removeTab4ItemShelf(${idx}, ${sIdx})" class="p-1 text-rose-500 hover:text-rose-700" title="Xóa dòng kệ">
                <i data-lucide="minus" class="w-3.5 h-3.5"></i>
              </button>
            ` : ''}
          </div>
        `;
      }).join("");

      return `
        <tr class="${rowBg} transition border-b border-slate-100">
          <td class="py-2.5 px-3 font-medium text-slate-900">
            <div class="font-bold">${row.name}</div>
            ${row.comboName ? `<div class="text-[10px] text-amber-700 font-semibold">📦 Thuộc: ${row.comboName}</div>` : ''}
            ${stats.isOver ? `<div class="text-[10px] text-rose-600 font-bold mt-0.5">⚠️ Vượt quá ${stats.dispatched} món mang đi!</div>` : ''}
          </td>
          <td class="py-2.5 px-2 text-center text-slate-600">${row.unit}</td>
          <td class="py-2.5 px-2 text-center font-bold text-slate-700">${row.dispatchedQty}</td>
          <td class="py-2.5 px-2 text-center bg-emerald-50/30">
            <input type="number" min="0" value="${row.goodQty}" onfocus="this.select()" onchange="updateTab4GoodQty(${idx}, this.value)" class="w-16 p-1 border ${stats.isOver ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-300 text-emerald-800'} rounded text-center font-bold">
          </td>
          <td class="py-2.5 px-2 text-center">${diffBadge}</td>
          <td class="py-2 px-3">
            <div class="space-y-1">
              ${desktopShelvesHtml}
              <div class="flex items-center justify-between text-[11px] pt-0.5">
                <span class="${shelfSum === row.goodQty ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}">
                  Tổng kệ: ${shelfSum} / ${row.goodQty}
                </span>
                <button type="button" onclick="addTab4ItemShelf(${idx})" class="text-[10px] text-sky-700 hover:text-sky-900 font-bold underline">
                  + Thêm kệ
                </button>
              </div>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  // 2. Render Mobile Cards View (Xếp theo bộ game, có thêm giá kệ, không cuộn ngang)
  if (mobileContainer) {
    const combosMap = {};
    const looseItems = [];

    state.tab4ReturnChecklist.forEach((item, itemIdx) => {
      if (item.comboId) {
        if (!combosMap[item.comboId]) {
          combosMap[item.comboId] = {
            id: item.comboId,
            name: item.comboName || "Bộ Game",
            items: []
          };
        }
        combosMap[item.comboId].items.push({ item, itemIdx });
      } else {
        looseItems.push({ item, itemIdx });
      }
    });

    let mobileHtml = "";

    // Render Combos
    Object.values(combosMap).forEach(combo => {
      const isCollapsed = !!state.tab4CollapsedCombos[combo.id];
      const childrenHtml = combo.items.map(({ item, itemIdx }) => renderTab4MobileItemCard(item, itemIdx)).join("");

      mobileHtml += `
        <div class="bg-amber-50/70 border border-amber-300/80 rounded-xl p-2 sm:p-2.5 space-y-2">
          <!-- Combo Header -->
          <div class="flex items-center justify-between cursor-pointer select-none" onclick="toggleTab4ComboCollapse('${combo.id}')">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-4 h-4 text-amber-700 shrink-0"></i>
              <span class="font-bold text-amber-950 text-xs truncate">📦 BỘ: ${combo.name}</span>
              <span class="text-[10px] text-amber-800 bg-amber-200/80 px-1.5 py-0.5 rounded-md font-bold shrink-0">${combo.items.length} món</span>
            </div>
            <span class="text-[10px] text-amber-700 font-medium">${isCollapsed ? 'Mở rộng' : 'Thu gọn'}</span>
          </div>

          ${!isCollapsed ? `
            <div class="space-y-2 pt-1 border-t border-amber-200/60">
              ${childrenHtml}
            </div>
          ` : ''}
        </div>
      `;
    });

    // Render Loose items
    if (looseItems.length > 0) {
      const looseHtml = looseItems.map(({ item, itemIdx }) => renderTab4MobileItemCard(item, itemIdx)).join("");
      mobileHtml += `
        <div class="space-y-2">
          ${looseItems.length > 0 && Object.keys(combosMap).length > 0 ? `
            <div class="text-[11px] font-bold text-slate-600 px-1 pt-1">📦 Đạo Cụ Lẻ Khác (${looseItems.length} món):</div>
          ` : ''}
          ${looseHtml}
        </div>
      `;
    }

    mobileContainer.innerHTML = mobileHtml;
  }

  if (window.lucide) lucide.createIcons();
}

function renderTab4MobileItemCard(row, itemIdx) {
  const stats = getTab4ItemStats(row.name);
  let diffBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">Đủ (100%)</span>';
  if (stats.isOver) {
    diffBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white animate-pulse whitespace-nowrap">⚠️ Vượt +${stats.diff}</span>`;
  } else if (stats.isUnder) {
    diffBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap">Thiếu ${Math.abs(stats.diff)}</span>`;
  }

  const shelfSum = (row.shelves || []).reduce((acc, s) => acc + (Number(s.qty) || 0), 0);

  const shelvesHtml = (row.shelves || []).map((s, sIdx) => {
    const suggestedLetter = String.fromCharCode(65 + (sIdx % 26));
    const suggestedTier = String(sIdx + 1);
    return `
      <div class="flex items-center gap-1.5 text-xs bg-slate-50 p-1.5 rounded-lg border border-slate-200">
        <span class="w-5 text-center text-slate-400 font-bold text-[10px] shrink-0">#${sIdx + 1}</span>
        <div class="flex-1 min-w-0">
          <input type="text" value="${s.shelf || ''}" placeholder="${suggestedLetter}" onfocus="this.select()" oninput="updateTab4ItemShelf(${itemIdx}, ${sIdx}, 'shelf', this.value)" class="w-full min-h-[34px] px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-sky-500" title="Gợi ý Giá ${suggestedLetter}">
        </div>
        <div class="w-16 min-w-0 shrink-0">
          <input type="text" value="${s.tier || ''}" placeholder="${suggestedTier}" onfocus="this.select()" oninput="updateTab4ItemShelf(${itemIdx}, ${sIdx}, 'tier', this.value)" class="w-full min-h-[34px] px-1 py-1 bg-white border border-slate-300 rounded-md text-xs text-center font-semibold text-slate-900 focus:ring-1 focus:ring-sky-500" title="Gợi ý Tầng ${suggestedTier}">
        </div>
        <div class="w-14 shrink-0">
          <input type="number" min="0" value="${s.qty}" onfocus="this.select()" oninput="updateTab4ItemShelf(${itemIdx}, ${sIdx}, 'qty', this.value)" class="w-full min-h-[34px] px-1 py-1 bg-white border border-slate-300 rounded-md text-center font-bold text-xs text-slate-900 focus:ring-1 focus:ring-sky-500" title="Số lượng cất">
        </div>
        ${row.shelves.length > 1 ? `
          <button type="button" onclick="removeTab4ItemShelf(${itemIdx}, ${sIdx})" class="w-7 h-7 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-lg shrink-0" title="Xóa kệ này">
            <i data-lucide="minus" class="w-3.5 h-3.5"></i>
          </button>
        ` : `<span class="w-7"></span>`}
      </div>
    `;
  }).join("");

  return `
    <div class="p-2.5 bg-white rounded-xl border ${stats.isOver ? 'border-rose-400 bg-rose-50/10' : 'border-slate-200'} shadow-xs space-y-2 text-xs">
      <!-- Title & Status -->
      <div class="flex items-start justify-between gap-1.5 pb-1 border-b border-slate-100">
        <div class="flex-1 min-w-0">
          <div class="font-bold text-slate-900 text-xs sm:text-sm leading-snug">${row.name}</div>
          <div class="text-[11px] text-slate-500 mt-0.5">
            Đã mang đi: <strong class="text-sky-800 font-bold">${row.dispatchedQty}</strong> ${row.unit}
          </div>
        </div>
        <div class="shrink-0 text-right">
          ${diffBadge}
        </div>
      </div>

      <!-- Quantity Inputs: Còn tốt & Báo hỏng -->
      <div class="grid grid-cols-2 gap-2 bg-slate-50/90 p-2 rounded-lg border border-slate-200">
        <div>
          <label class="block text-[10px] font-bold text-emerald-800 uppercase mb-0.5">✅ SL Còn Tốt:</label>
          <input type="number" min="0" value="${row.goodQty}" onfocus="this.select()" onchange="updateTab4GoodQty(${itemIdx}, this.value)" class="w-full min-h-[36px] px-2 py-1 bg-white border border-emerald-300 rounded-lg text-center font-black text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none">
        </div>
        <div>
          <label class="block text-[10px] font-bold text-rose-800 uppercase mb-0.5">⚠️ SL Báo Hỏng:</label>
          <input type="number" min="0" value="${stats.broken}" onfocus="this.select()" onchange="updateTab4BrokenQtyDirect('${row.name.replace(/'/g, "\\'")}', this.value)" class="w-full min-h-[36px] px-2 py-1 bg-white border border-rose-300 rounded-lg text-center font-black text-rose-900 text-sm focus:ring-2 focus:ring-rose-400 focus:outline-none">
        </div>
      </div>

      ${stats.isOver ? `
        <div class="p-1.5 rounded-lg bg-rose-100 border border-rose-300 text-[10px] text-rose-800 font-bold flex items-center gap-1">
          <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-600 shrink-0"></i>
          <span>Sai số: Tổng tốt (${stats.good}) + hỏng (${stats.broken}) = ${stats.totalReported} vượt quá ${stats.dispatched} món mang đi!</span>
        </div>
      ` : ''}

      <!-- Shelves Multi-Allocation -->
      <div class="space-y-1.5 pt-1 border-t border-slate-100">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1 text-[11px] font-bold text-slate-700">
            <span>🏛️ Vị trí lưu kho (Giá A, B, C...)</span>
            <span class="text-[10px] px-1.5 py-0.2 rounded font-semibold ${shelfSum === row.goodQty ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
              ${shelfSum} / ${row.goodQty}
            </span>
          </div>
          <button type="button" onclick="addTab4ItemShelf(${itemIdx})" class="text-[10px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-md flex items-center gap-0.5 transition shadow-2xs">
            <span>+ Thêm kệ</span>
          </button>
        </div>

        <div class="space-y-1">
          ${shelvesHtml}
        </div>
      </div>
    </div>
  `;
}

function updateTab4GoodQty(idx, val) {
  if (state.tab4ReturnChecklist[idx]) {
    state.tab4ReturnChecklist[idx].goodQty = Math.max(0, Number(val || 0));
    // Auto sync first shelf qty if only 1 shelf
    if (state.tab4ReturnChecklist[idx].shelves && state.tab4ReturnChecklist[idx].shelves.length === 1) {
      state.tab4ReturnChecklist[idx].shelves[0].qty = state.tab4ReturnChecklist[idx].goodQty;
    }
    renderTab4ReturnTable();
    renderTab4BrokenTable();
  }
}

function setAllTab4ToPostCheckShelf() {
  state.tab4ReturnChecklist.forEach(r => {
    r.shelf = "Khu vực Hậu kiểm";
    r.tier = "Mặt sàn";
    r.shelves = [{ shelf: "Khu vực Hậu kiểm", tier: "Mặt sàn", qty: r.goodQty }];
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
  const mobileContainer = document.getElementById("tab4-broken-mobile-cards");

  if (state.tab4BrokenItems.length === 0) {
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-3 text-center text-slate-400 italic text-[11px]">Không có đồ hỏng nào được khai báo (hoàn hảo)</td></tr>`;
    }
    if (mobileContainer) {
      mobileContainer.innerHTML = `<div class="p-3 text-center text-slate-400 italic text-xs bg-rose-50/20 border border-rose-100 rounded-xl">Không có đồ hỏng nào được khai báo (hoàn hảo)</div>`;
    }
    return;
  }

  // 1. Desktop Table
  if (tbody) {
    tbody.innerHTML = state.tab4BrokenItems.map((b, idx) => {
      const stats = getTab4ItemStats(b.name);
      const photos = b.photos || [];
      const photoCount = photos.length;
      const isPhotoMatch = (photoCount === b.qty);

      return `
        <tr class="hover:bg-rose-50/50 transition border-b border-rose-100 ${stats.isOver ? 'bg-rose-100/40' : ''}">
          <td class="py-2 px-3">
            <select onchange="updateTab4BrokenItemName(${idx}, this.value)" class="w-full p-1.5 border border-rose-300 rounded text-xs bg-white font-medium">
              ${state.tab4ReturnChecklist.map(r => `<option value="${escapeHtml(r.name)}" ${r.name === b.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join("")}
            </select>
            ${stats.isOver ? `<div class="text-[10px] text-rose-600 font-bold mt-0.5">⚠️ Vượt quá SL mang đi: Tốt (${stats.good}) + Hỏng (${stats.broken}) = ${stats.totalReported} > Mang đi (${stats.dispatched})!</div>` : ''}
          </td>
          <td class="py-2 px-2 text-center">
            <input type="number" min="1" value="${b.qty}" onchange="updateTab4BrokenItemQty(${idx}, this.value)" class="w-14 p-1 border border-rose-300 rounded text-center font-bold text-rose-700 bg-white">
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(b.shelf || '')}" onchange="state.tab4BrokenItems[${idx}].shelf = this.value" placeholder="Khu vực đồ hỏng..." class="w-full p-1 border border-rose-200 rounded text-xs bg-white">
          </td>
          <td class="py-2 px-3">
            <input type="text" value="${escapeHtml(b.reason || '')}" onchange="state.tab4BrokenItems[${idx}].reason = this.value" placeholder="Rách bạt, gãy motor, sờn dây..." class="w-full p-1 border border-rose-200 rounded text-xs bg-white">
          </td>
          <td class="py-2 px-3">
            <!-- Photo Actions & Status (Chỉ chụp ảnh trực tiếp bằng camera) -->
            <div class="flex items-center gap-1.5 justify-center mb-1">
              <button type="button" onclick="openLiveCameraForBrokenItem('${b.id}')" class="px-2 py-1 text-[10px] font-bold rounded border border-rose-300 bg-white hover:bg-rose-100 text-rose-700 flex items-center gap-1 cursor-pointer" title="Chụp ảnh bằng camera">
                <i data-lucide="camera" class="w-3 h-3"></i>
                <span>Chụp</span>
              </button>
              <span class="px-1.5 py-0.5 rounded text-[10px] font-extrabold ${isPhotoMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-200 text-rose-900'}">
                ${photoCount}/${b.qty} ảnh
              </span>
            </div>

            <!-- Thumbnails with Delete button -->
            <div class="flex flex-wrap gap-1 justify-center">
              ${photos.map((pUrl, pIdx) => `
                <div class="relative w-8 h-8 rounded border border-rose-300 overflow-hidden bg-slate-100 shrink-0">
                  <img src="${pUrl}" class="w-full h-full object-cover">
                  <button type="button" onclick="removeBrokenPhoto('${b.id}', ${pIdx})" class="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white p-0.5 rounded-full cursor-pointer" title="Xóa ảnh này">
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
              `).join("")}
            </div>
            ${!isPhotoMatch ? `<div class="text-[9px] text-center text-rose-600 font-semibold mt-0.5">Yêu cầu đúng ${b.qty} ảnh</div>` : ''}
          </td>
          <td class="py-2 px-2 text-center">
            <button onclick="removeTab4BrokenRow('${b.id}')" class="text-rose-500 hover:text-rose-700 p-1 cursor-pointer" title="Xóa dòng đồ hỏng">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  // 2. Mobile Cards (Thông tin khai báo đồ hỏng cũng hiển thị dạng thẻ như bảng kiểm kê hoàn trả)
  if (mobileContainer) {
    mobileContainer.innerHTML = state.tab4BrokenItems.map((b, idx) => {
      const stats = getTab4ItemStats(b.name);
      const photos = b.photos || [];
      const photoCount = photos.length;
      const isPhotoMatch = (photoCount === b.qty);

      return `
        <div class="p-3 bg-white rounded-xl border ${stats.isOver ? 'border-rose-400 bg-rose-50/20' : 'border-rose-200'} shadow-2xs space-y-2.5 text-xs">
          <!-- Row 1: Header + Item Name Select + Delete button -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <label class="block text-[10px] font-bold text-rose-800 uppercase mb-1">Món hỏng #${idx + 1}:</label>
              <select onchange="updateTab4BrokenItemName(${idx}, this.value)" class="w-full p-2 border border-rose-300 rounded-lg text-xs bg-white font-semibold text-slate-900 focus:ring-1 focus:ring-rose-400">
                ${state.tab4ReturnChecklist.map(r => `<option value="${escapeHtml(r.name)}" ${r.name === b.name ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join("")}
              </select>
              ${stats.isOver ? `<div class="text-[10px] text-rose-600 font-bold mt-1">⚠️ Vượt quá SL mang đi: Tốt (${stats.good}) + Hỏng (${stats.broken}) = ${stats.totalReported} > Mang đi (${stats.dispatched})!</div>` : ''}
            </div>
            <button type="button" onclick="removeTab4BrokenRow('${b.id}')" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition shrink-0 mt-5 cursor-pointer" title="Xóa dòng này">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- Row 2: SL Hỏng & Vị trí lưu đồ hỏng -->
          <div class="grid grid-cols-2 gap-2 bg-rose-50/50 p-2 rounded-lg border border-rose-100">
            <div>
              <label class="block text-[10px] font-bold text-rose-800 uppercase mb-0.5">SL Hỏng:</label>
              <input type="number" min="1" value="${b.qty}" onchange="updateTab4BrokenItemQty(${idx}, this.value)" class="w-full min-h-[34px] px-2 py-1 border border-rose-300 rounded-lg text-center font-black text-rose-900 text-sm bg-white focus:ring-1 focus:ring-rose-500">
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Vị trí lưu đồ hỏng:</label>
              <input type="text" value="${escapeHtml(b.shelf || '')}" onchange="state.tab4BrokenItems[${idx}].shelf = this.value" placeholder="Khu vực đồ hỏng..." class="w-full min-h-[34px] px-2 py-1 border border-rose-200 rounded-lg text-xs font-semibold text-slate-900 bg-white focus:ring-1 focus:ring-rose-400">
            </div>
          </div>

          <!-- Row 3: Mô tả hư hại -->
          <div>
            <label class="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">Mô tả sự cố / hư hại:</label>
            <input type="text" value="${escapeHtml(b.reason || '')}" onchange="state.tab4BrokenItems[${idx}].reason = this.value" placeholder="Rách bạt, sờn mép, gãy van hơi..." class="w-full min-h-[34px] px-2.5 py-1 border border-rose-200 rounded-lg text-xs font-medium text-slate-800 bg-white focus:ring-1 focus:ring-rose-400">
          </div>

          <!-- Row 4: Ảnh hiện trạng đồ hỏng (Bắt buộc = SL Hỏng) -->
          <div class="pt-1.5 border-t border-rose-100 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-rose-900 uppercase">Ảnh hiện trạng:</span>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold ${isPhotoMatch ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-200 text-rose-900'}">
                ${photoCount} / ${b.qty} ảnh ${isPhotoMatch ? '✓' : '(Thiếu)'}
              </span>
            </div>

            <div>
              <button type="button" onclick="openLiveCameraForBrokenItem('${b.id}')" class="w-full py-2 px-3 text-xs font-bold rounded-lg border border-rose-300 bg-white hover:bg-rose-50 text-rose-800 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer" title="Bật camera chụp đồ hỏng">
                <i data-lucide="camera" class="w-4 h-4 text-rose-600"></i>
                <span>📸 Bật Máy Ảnh Chụp Đồ Hỏng (Bắt buộc)</span>
              </button>
            </div>

            <!-- Thumbnails -->
            <div class="flex flex-wrap gap-1.5 pt-1">
              ${photos.map((pUrl, pIdx) => `
                <div class="relative w-12 h-12 rounded-lg border border-rose-300 overflow-hidden bg-slate-100 shrink-0 shadow-2xs">
                  <img src="${pUrl}" class="w-full h-full object-cover">
                  <button type="button" onclick="removeBrokenPhoto('${b.id}', ${pIdx})" class="absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow-xs cursor-pointer" title="Xóa ảnh này">
                    <i data-lucide="x" class="w-2.5 h-2.5"></i>
                  </button>
                </div>
              `).join("")}
            </div>
            ${!isPhotoMatch ? `<div class="text-[10px] text-rose-600 font-semibold italic">Yêu cầu chụp đủ đúng ${b.qty} ảnh cho ${b.qty} món hỏng.</div>` : ''}
          </div>
        </div>
      `;
    }).join("");
  }

  if (window.lucide) lucide.createIcons();
}

function submitTab4ReturnSlip() {
  const submitBtn = document.querySelector("#tab4 button[onclick='submitTab4ReturnSlip()']");
  if (submitBtn) submitBtn.disabled = true;

  if (!state.tab4TourSelected) {
    alert("Vui lòng chọn Chương trình cần hoàn trả!");
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // 1. Kiểm tra sai số tổng SL Tốt + Hỏng so với Mang Đi
  for (let r of state.tab4ReturnChecklist) {
    const stats = getTab4ItemStats(r.name);
    if (stats.isOver) {
      alert(`LỖI SAI SỐ:\nĐạo cụ [${r.name}] có tổng số lượng Tốt (${stats.good}) + Hỏng (${stats.broken}) = ${stats.totalReported}, vượt quá số lượng mang đi (${stats.dispatched})!\n\nVui lòng kiểm tra và sửa lại số lượng trước khi hoàn tất.`);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
  }

  // 1.5. Kiểm tra phân bổ vị trí giá kệ phải khớp với số lượng còn tốt
  for (let r of state.tab4ReturnChecklist) {
    if (r.goodQty > 0) {
      const shelfSum = (r.shelves || []).reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
      if (shelfSum !== r.goodQty) {
        alert(`LỖI PHÂN BỔ KỆ:\nĐạo cụ [${r.name}] có SL còn tốt = ${r.goodQty}, nhưng tổng số lượng chia vào các kệ = ${shelfSum}!\n\nVui lòng điều chỉnh số lượng ở các kệ cho khớp 100%.`);
        if (submitBtn) submitBtn.disabled = false;
        return;
      }
    }
  }

  // 2. Kiểm tra ảnh dỡ xe về kho
  const unloadImg = document.querySelector("#tab4-unload-photo-preview img")?.src;
  const unloadHidden = document.getElementById("tab4-unload-photo-preview")?.classList.contains("hidden");
  if (!unloadImg || unloadHidden) {
    alert("Bắt buộc phải chụp ảnh dỡ xe về kho trước khi hoàn tất phiếu thu hồi!");
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // 3. Kiểm tra số ảnh = số đồ hỏng cho từng món
  for (let b of state.tab4BrokenItems) {
    const pCount = (b.photos || []).length;
    if (pCount !== b.qty) {
      alert(`BẮT BUỘC ĐỦ ẢNH:\nĐạo cụ hỏng [${b.name}] khai báo ${b.qty} món hỏng nhưng hiện tại chỉ có ${pCount} ảnh!\n\nQuy tắc hệ thống: Số ảnh phải bằng đúng số đồ hỏng (mỗi món hỏng 1 ảnh hiện trạng). Vui lòng dùng máy ảnh chụp thêm ảnh.`);
      if (submitBtn) submitBtn.disabled = false;
      return;
    }
  }

  const tour = state.tab4TourSelected;

  state.tab4ReturnChecklist.forEach(ret => {
    const item = state.items.find(i => i.id === ret.itemId || i.name.toLowerCase() === ret.name.toLowerCase());
    if (item) {
      item.inUse = Math.max(0, (item.inUse || 0) - ret.dispatchedQty);
      item.ready = (item.ready || 0) + ret.goodQty;
      
      if (!item.shelves) item.shelves = [];

      (ret.shelves || []).forEach((s, sIdx) => {
        const qtyNum = Number(s.qty) || 0;
        if (qtyNum <= 0) return;
        const suggestedLetter = String.fromCharCode(65 + (sIdx % 26));
        const suggestedTier = String(sIdx + 1);
        const rawShelf = s.shelf?.trim() || suggestedLetter;
        const shelfName = /^(giá|kệ|khu|kho)/i.test(rawShelf) ? rawShelf : `Giá ${rawShelf}`;
        const rawTier = s.tier?.trim() || suggestedTier;
        const tierName = /^(tầng|sàn|ô)/i.test(rawTier) ? rawTier : `Tầng ${rawTier}`;
        const fullShelfName = `${shelfName} - ${tierName}`;

        const sObj = item.shelves.find(is => is.shelf === fullShelfName || is.shelf === shelfName);
        if (sObj) {
          sObj.qty += qtyNum;
        } else {
          item.shelves.push({ shelf: fullShelfName, tier: tierName, qty: qtyNum });
        }
      });
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

  const targetWhId = document.getElementById("tab4-warehouse")?.value || tour.warehouseId || "WH-MD";
  const targetWh = state.warehouses.find(w => w.id === targetWhId) || state.warehouses[0];
  const targetWhName = targetWh ? targetWh.name : "Kho Tổng Mỹ Đình (Hà Nội)";

  const nkCode = `NK_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: nkCode,
    type: "Nhập hoàn trả",
    badgeColor: "emerald",
    tourName: tour.name,
    location: tour.location,
    warehouseId: targetWh ? targetWh.id : "WH-MD",
    warehouseName: targetWhName,
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

  // Nếu đang xử lý phiếu hậu kiểm, xóa phiếu khỏi danh sách hậu kiểm
  if (state.activePostCheckingSlipId) {
    state.postCheckSlips = (state.postCheckSlips || []).filter(s => s.id !== state.activePostCheckingSlipId);
    state.activePostCheckingSlipId = null;
  }

  saveState();
  syncToGoogleSheet("ADD_DOC", doc);
  state.tab4TourSelected = null;
  state.tab4ReturnChecklist = [];
  state.tab4BrokenItems = [];

  const tourSel = document.getElementById("tab4-tour-select");
  if (tourSel) tourSel.value = "";
  if (submitBtn) submitBtn.disabled = false;
  renderTab4();

  showToast(`Đã hoàn tất thu hồi đạo cụ [${nkCode}]!`, "success");
  if (typeof confetti === "function") confetti();
  switchTab(1);
}

// =========================================================================
// TAB 4: HẬU KIỂM ĐẠO CỤ (LƯU KHO HẬU KIỂM & KIỂM ĐẾM SẮP XẾP LẠI SAU)
// =========================================================================
function submitTab4PostCheckSlip() {
  if (!state.tab4TourSelected) {
    alert("Vui lòng chọn Chương trình cần thu hồi để lưu kho hậu kiểm!");
    return;
  }

  // Bắt buộc có ảnh chụp đồ tập kết tại khu vực hậu kiểm
  const unloadImg = document.querySelector("#tab4-unload-photo-preview img")?.src;
  const unloadHidden = document.getElementById("tab4-unload-photo-preview")?.classList.contains("hidden");
  if (!unloadImg || unloadHidden) {
    alert("BẮT BUỘC CÓ ẢNH CHỤP ĐỒ TẬP KẾT TẠI KHU VỰC HẬU KIỂM!\n\nNhân sự chuyển đồ về kho cần chụp ảnh hiện trạng toàn bộ đồ đã dỡ và tập kết tại khu vực hậu kiểm trước khi lưu.");
    return;
  }

  const tour = state.tab4TourSelected;
  const hkCode = `HK_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  
  // Xây dựng danh sách đồ cần hậu kiểm từ checklist hoặc props của tour
  const items = (state.tab4ReturnChecklist && state.tab4ReturnChecklist.length > 0)
    ? state.tab4ReturnChecklist.map((r, idx) => {
        const invItem = state.items.find(i => (r.itemId && i.id === r.itemId) || i.name.toLowerCase() === r.name.toLowerCase());
        const defaultShelf = (invItem && invItem.shelves && invItem.shelves[0]) ? invItem.shelves[0].shelf : "Giá A1 - Tầng 1";
        return {
          id: r.itemId || (invItem ? invItem.id : `ITEM-${idx}`),
          name: r.name,
          unit: r.unit,
          qty: r.dispatchedQty || r.goodQty,
          category: invItem ? invItem.category : "Đồ hơi",
          type: invItem ? invItem.type : "Khấu hao",
          shelf: "Khu vực Hậu kiểm",
          tier: "Mặt sàn",
          goodQty: r.dispatchedQty || r.goodQty,
          brokenQty: 0,
          targetShelf: defaultShelf,
          note: ""
        };
      })
    : (tour.props || []).map((p, idx) => {
        const invItem = state.items.find(i => (p.itemId && i.id === p.itemId) || i.name.toLowerCase() === p.name.toLowerCase());
        const defaultShelf = (invItem && invItem.shelves && invItem.shelves[0]) ? invItem.shelves[0].shelf : "Giá A1 - Tầng 1";
        return {
          id: p.itemId || (invItem ? invItem.id : `ITEM-${idx}`),
          name: p.name,
          unit: p.unit,
          qty: p.qty,
          category: invItem ? invItem.category : "Đồ hơi",
          type: invItem ? invItem.type : "Khấu hao",
          shelf: "Khu vực Hậu kiểm",
          tier: "Mặt sàn",
          goodQty: p.qty,
          brokenQty: 0,
          targetShelf: defaultShelf,
          note: ""
        };
      });

  // Cập nhật tồn kho: Giảm inUse vì đồ đã về kho (không còn ở chương trình nữa), đưa vào tạm tại "Khu vực Hậu kiểm"
  items.forEach(it => {
    const invItem = state.items.find(i => (it.id && i.id === it.id) || i.name.toLowerCase() === it.name.toLowerCase());
    if (invItem) {
      invItem.inUse = Math.max(0, (invItem.inUse || 0) - it.qty);
      if (!invItem.shelves) invItem.shelves = [];
      const hkShelf = invItem.shelves.find(s => s.shelf === "Khu vực Hậu kiểm");
      if (hkShelf) {
        hkShelf.qty = (hkShelf.qty || 0) + it.qty;
      } else {
        invItem.shelves.push({ shelf: "Khu vực Hậu kiểm", tier: "Mặt sàn", qty: it.qty });
      }
    }
  });

  const returnerName = tour.leader || (state.currentUser ? state.currentUser.name : "Nhân sự chuyển đồ");
  const checkerName = state.currentUser ? state.currentUser.name : "Thủ kho";

  const targetWhId = document.getElementById("tab4-warehouse")?.value || tour.warehouseId || "WH-MD";
  const targetWh = state.warehouses.find(w => w.id === targetWhId) || state.warehouses[0];
  const targetWhName = targetWh ? targetWh.name : "Kho Tổng Mỹ Đình (Hà Nội)";

  // Tạo phiếu lưu kho hậu kiểm
  const postCheckSlip = {
    id: `HK-${Date.now()}`,
    code: hkCode,
    tourId: tour.id,
    tourName: tour.name,
    location: tour.location,
    warehouseId: targetWh ? targetWh.id : "WH-MD",
    warehouseName: targetWhName,
    returnerName: returnerName,
    returnerPhone: tour.phone || "",
    returnerAvatar: state.users.find(u => u.name === tour.leader)?.avatar || "",
    checkerName: checkerName,
    checkerAvatar: state.currentUser ? state.currentUser.avatar : "",
    createdAt: formatDateTime(new Date()),
    photo: unloadImg,
    status: "PENDING_INSPECTION",
    totalItems: items.reduce((sum, i) => sum + i.qty, 0),
    items: items,
    note: "Đồ tập kết tại Khu vực Hậu kiểm. Nhân sự đã về kho, chờ kiểm đếm và phân bổ giá kệ sau."
  };

  if (!state.postCheckSlips) state.postCheckSlips = [];
  state.postCheckSlips.unshift(postCheckSlip);

  // Ghi nhận vào Chứng Từ (Tab 8)
  const doc = {
    id: `DOC-${Date.now()}`,
    code: hkCode,
    type: "Lưu kho hậu kiểm",
    badgeColor: "amber",
    tourName: tour.name,
    location: tour.location,
    warehouseId: targetWh ? targetWh.id : "WH-MD",
    warehouseName: targetWhName,
    creator: checkerName,
    creatorAvatar: state.currentUser ? state.currentUser.avatar : "",
    returner: returnerName,
    checker: checkerName,
    createdAt: formatDateTime(new Date()),
    itemsCount: postCheckSlip.totalItems,
    items: items.map(i => ({
      name: i.name,
      unit: i.unit,
      qty: i.qty,
      shelf: "Khu vực Hậu kiểm",
      tier: "Mặt sàn",
      location: "Khu vực Hậu kiểm - Mặt sàn"
    })),
    photos: [unloadImg],
    note: `Lưu kho tập kết hậu kiểm. Người trả đồ: ${returnerName}, Người hậu kiểm: ${checkerName}.`
  };
  state.documents.unshift(doc);

  // Xóa tour khỏi danh sách tour đang đi (vì đồ đã về kho)
  state.tours = state.tours.filter(t => t.id !== tour.id);

  saveState();

  // Reset form Tab 4
  state.tab4TourSelected = null;
  state.tab4ReturnChecklist = [];
  state.tab4BrokenItems = [];
  removeUnloadPhoto();

  const tourSel = document.getElementById("tab4-tour-select");
  if (tourSel) tourSel.value = "";

  renderTab4();
  renderTab1InventoryTable();
  renderTab8Documents();

  showToast(`Đã lưu kho hậu kiểm thành công [${hkCode}]! Đồ đã tập kết tại Khu vực Hậu kiểm.`, "success");
}

function updateTab4Badge() {
  const badge = document.getElementById("tab4-postcheck-count-badge");
  if (!badge) return;
  const pending = (state.postCheckSlips || []).filter(s => s.status === "PENDING_INSPECTION");
  if (pending.length > 0) {
    badge.textContent = pending.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

function renderTab4PostCheckBanner() {
  const container = document.getElementById("tab4-postcheck-banner");
  if (!container) return;

  const pending = (state.postCheckSlips || []).filter(s => s.status === "PENDING_INSPECTION");
  if (pending.length === 0) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div class="p-3.5 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/10 border-2 border-amber-400 rounded-2xl shadow-xs space-y-2.5">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <span class="p-1.5 rounded-lg bg-amber-500 text-white font-bold text-xs shadow-2xs">
            <i data-lucide="clipboard-check" class="w-4 h-4"></i>
          </span>
          <div>
            <div class="font-extrabold text-xs sm:text-sm text-amber-950 flex items-center gap-1.5 flex-wrap">
              <span>DANH SÁCH ĐỒ CẦN HẬU KIỂM</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white">${pending.length} Phiếu</span>
            </div>
            <p class="text-[11px] text-amber-800">Đạo cụ đã tập kết tại khu vực hậu kiểm. Nhấn vào phiếu bên dưới để kiểm đếm, ghi nhận tình trạng và phân bổ về các giá kệ trong kho.</p>
          </div>
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
        ${pending.map(slip => `
          <div onclick="loadTab4PostCheckSlip('${slip.id}')" class="p-3 bg-white rounded-xl border border-amber-300 shadow-2xs hover:border-amber-400 transition flex items-center justify-between gap-3 cursor-pointer group">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-black text-xs text-amber-900">${slip.code}</span>
                <span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-200">Chờ hậu kiểm</span>
              </div>
              <div class="font-bold text-xs text-slate-800 truncate mt-1">${slip.tourName}</div>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 mt-1">
                <span>👤 Trả: <strong>${slip.returnerName || 'N/A'}</strong></span>
                <span>🔍 Hậu kiểm: <strong>${slip.checkerName || (state.currentUser ? state.currentUser.name : 'Thủ kho')}</strong></span>
                <span>📦 <strong>${slip.items ? slip.items.length : 0} mục (${slip.totalItems || (slip.items ? slip.items.reduce((s,i)=>s+i.qty,0) : 0)} món)</strong></span>
              </div>
            </div>
            <button type="button" onclick="event.stopPropagation(); loadTab4PostCheckSlip('${slip.id}')" class="shrink-0 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer">
              <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i>
              <span>Hậu Kiểm</span>
            </button>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function openPostCheckDetailModal(slipId) {
  const slip = (state.postCheckSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  const modal = document.getElementById("modal-post-check-detail");
  if (!modal) return;

  // Render slip info
  const codeEl = document.getElementById("postcheck-modal-code");
  if (codeEl) codeEl.textContent = slip.code;
  const tourEl = document.getElementById("postcheck-modal-tour");
  if (tourEl) tourEl.textContent = slip.tourName;
  const locEl = document.getElementById("postcheck-modal-location");
  if (locEl) locEl.textContent = slip.location || "Tại kho";
  const dateEl = document.getElementById("postcheck-modal-date");
  if (dateEl) dateEl.textContent = slip.createdAt;

  // Returner info (mặc định người trả trước đó)
  const returnerInput = document.getElementById("postcheck-modal-returner");
  if (returnerInput) returnerInput.value = slip.returnerName || "";

  // Checker info (người hậu kiểm thực hiện công tác này - mặc định người dùng hiện tại)
  const checkerInput = document.getElementById("postcheck-modal-checker");
  if (checkerInput) checkerInput.value = state.currentUser ? state.currentUser.name : (slip.checkerName || "Thủ kho");

  // Photo
  const photoEl = document.getElementById("postcheck-modal-photo");
  if (photoEl) {
    if (slip.photo) {
      photoEl.src = slip.photo;
      photoEl.parentElement.parentElement.classList.remove("hidden");
    } else {
      photoEl.parentElement.parentElement.classList.add("hidden");
    }
  }

  // Render items table (đầy đủ thông tin như phiếu nhập kho)
  const tbody = document.getElementById("postcheck-modal-items-tbody");
  if (tbody) {
    tbody.innerHTML = (slip.items || []).map((it, idx) => `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-2.5 px-3 text-center text-slate-400 font-bold">${idx + 1}</td>
        <td class="py-2.5 px-3">
          <div class="font-bold text-slate-800">${it.name}</div>
          <div class="text-[10px] text-slate-500">${it.category || 'Đạo cụ'} • <span class="text-sky-700 font-semibold">${it.type || 'Khấu hao'}</span></div>
        </td>
        <td class="py-2.5 px-2 text-center font-medium">${it.unit}</td>
        <td class="py-2.5 px-2 text-center font-extrabold text-amber-700 bg-amber-50/50">${it.qty}</td>
        <td class="py-2.5 px-2 text-center">
          <input type="number" min="0" max="${it.qty}" value="${it.goodQty !== undefined ? it.goodQty : it.qty}" 
            onchange="updatePostCheckRowStats('${slip.id}', ${idx}, this.value, 'good')" 
            class="w-16 p-1 text-center font-bold text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500">
        </td>
        <td class="py-2.5 px-2 text-center">
          <input type="number" min="0" max="${it.qty}" value="${it.brokenQty || 0}" 
            onchange="updatePostCheckRowStats('${slip.id}', ${idx}, this.value, 'broken')" 
            class="w-16 p-1 text-center font-bold text-rose-700 bg-rose-50 border border-rose-300 rounded-lg text-xs focus:ring-1 focus:ring-rose-500">
        </td>
        <td class="py-2.5 px-3">
          <input type="text" value="${it.targetShelf || 'Giá A1 - Tầng 1'}" 
            placeholder="VD: Giá A1 - Tầng 1" 
            onchange="updatePostCheckRowShelf('${slip.id}', ${idx}, this.value)"
            class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-sky-500">
        </td>
      </tr>
    `).join("");
  }

  // Set action button
  const finishBtn = document.getElementById("btn-finish-postcheck");
  if (finishBtn) {
    if (slip.status === "COMPLETED") {
      finishBtn.classList.add("hidden");
    } else {
      finishBtn.classList.remove("hidden");
      finishBtn.onclick = () => finishPostCheckSlip(slip.id);
    }
  }

  modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function updatePostCheckRowStats(slipId, itemIdx, val, field) {
  const slip = (state.postCheckSlips || []).find(s => s.id === slipId);
  if (!slip || !slip.items || !slip.items[itemIdx]) return;
  const num = Math.max(0, parseInt(val, 10) || 0);
  const it = slip.items[itemIdx];
  if (field === "good") {
    it.goodQty = Math.min(it.qty, num);
    it.brokenQty = Math.max(0, it.qty - it.goodQty);
  } else if (field === "broken") {
    it.brokenQty = Math.min(it.qty, num);
    it.goodQty = Math.max(0, it.qty - it.brokenQty);
  }
  openPostCheckDetailModal(slipId);
}

function updatePostCheckRowShelf(slipId, itemIdx, val) {
  const slip = (state.postCheckSlips || []).find(s => s.id === slipId);
  if (!slip || !slip.items || !slip.items[itemIdx]) return;
  slip.items[itemIdx].targetShelf = val;
}

function finishPostCheckSlip(slipId) {
  const slip = (state.postCheckSlips || []).find(s => s.id === slipId);
  if (!slip) return;

  const returnerName = document.getElementById("postcheck-modal-returner")?.value.trim() || slip.returnerName;
  const checkerName = document.getElementById("postcheck-modal-checker")?.value.trim() || (state.currentUser ? state.currentUser.name : "Thủ kho");

  // Kiểm tra số lượng
  for (let it of slip.items) {
    const good = Number(it.goodQty || 0);
    const broken = Number(it.brokenQty || 0);
    if (good + broken !== it.qty) {
      alert(`Đạo cụ [${it.name}] có tổng Còn tốt (${good}) + Hỏng (${broken}) = ${good + broken}, không khớp với số lượng cần hậu kiểm (${it.qty})!\nVui lòng chỉnh sửa lại.`);
      return;
    }
  }

  // Cập nhật kho vĩnh viễn: Chuyển từ "Khu vực Hậu kiểm" sang các giá kệ chỉ định
  slip.items.forEach(it => {
    const invItem = state.items.find(i => (it.id && i.id === it.id) || i.name.toLowerCase() === it.name.toLowerCase());
    if (invItem) {
      // Trừ khỏi kệ tạm "Khu vực Hậu kiểm"
      if (invItem.shelves) {
        const hkShelf = invItem.shelves.find(s => s.shelf === "Khu vực Hậu kiểm");
        if (hkShelf) {
          hkShelf.qty = Math.max(0, (hkShelf.qty || 0) - it.qty);
          if (hkShelf.qty === 0) {
            invItem.shelves = invItem.shelves.filter(s => s.shelf !== "Khu vực Hậu kiểm");
          }
        }
      }

      // Cộng đồ còn tốt vào giá kệ chỉ định
      const goodNum = Number(it.goodQty || 0);
      if (goodNum > 0) {
        invItem.ready = (invItem.ready || 0) + goodNum;
        if (!invItem.shelves) invItem.shelves = [];
        const destShelfName = it.targetShelf || "Kệ Kho Mỹ Đình - Tầng 1";
        const existingShelf = invItem.shelves.find(s => s.shelf === destShelfName);
        if (existingShelf) {
          existingShelf.qty = (existingShelf.qty || 0) + goodNum;
        } else {
          invItem.shelves.push({ shelf: destShelfName, tier: "Tầng 1", qty: goodNum });
        }
      }

      // Ghi nhận đồ hỏng nếu có
      const brokenNum = Number(it.brokenQty || 0);
      if (brokenNum > 0) {
        invItem.broken = (invItem.broken || 0) + brokenNum;
        if (!invItem.brokenLocations) invItem.brokenLocations = [];
        invItem.brokenLocations.push({
          shelf: "Khu vực Chờ Sửa Chữa",
          qty: brokenNum,
          reason: `Phát hiện hư hỏng sau hậu kiểm tour [${slip.tourName}]`,
          photo: slip.photo || "",
          photos: [slip.photo].filter(Boolean)
        });
      }
    }
  });

  // Đánh dấu hoàn tất
  slip.status = "COMPLETED";
  slip.completedAt = formatDateTime(new Date());
  slip.returnerName = returnerName;
  slip.checkerName = checkerName;

  // Tạo phiếu nhập kho chính thức (NK_...) trong chứng từ
  const nkCode = `NK_${formatDate(new Date(), 'YYYYMMDD')}_${Math.floor(10 + Math.random() * 90)}`;
  const doc = {
    id: `DOC-${Date.now()}`,
    code: nkCode,
    type: "Nhập hoàn trả",
    badgeColor: "emerald",
    tourName: slip.tourName,
    location: slip.location,
    warehouseName: "Kho Tổng Mỹ Đình (Hà Nội)",
    creator: checkerName,
    creatorAvatar: state.currentUser ? state.currentUser.avatar : "",
    returner: returnerName,
    checker: checkerName,
    createdAt: formatDateTime(new Date()),
    itemsCount: slip.items.reduce((sum, i) => sum + (Number(i.goodQty) || 0), 0),
    items: slip.items.map(i => ({
      name: i.name,
      unit: i.unit,
      qty: Number(i.goodQty) || 0,
      shelf: i.targetShelf || "Giá A1 - Tầng 1",
      tier: "Tầng 1",
      location: i.targetShelf || "Giá A1 - Tầng 1"
    })),
    photos: [slip.photo].filter(Boolean),
    note: `Phiếu nhập kho chính thức sau hậu kiểm (Mã HK: ${slip.code}). Người trả đồ: ${returnerName}, Người hậu kiểm: ${checkerName}.`,
    keeperApproved: true,
    keeperName: checkerName,
    keeperAvatar: state.currentUser ? state.currentUser.avatar : ""
  };
  state.documents.unshift(doc);

  saveState();
  closeModal("modal-post-check-detail");

  renderTab4PostCheckBanner();
  updateTab4Badge();
  renderTab1InventoryTable();
  renderTab8Documents();

  showToast(`Đã hoàn tất hậu kiểm và nhập kho chính thức [${nkCode}]!`, "success");
  if (typeof confetti === "function") confetti();
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

function handleDetailTopEditClick() {
  if (!activeItemDetailId) return;
  const item = state.items.find(i => i.id === activeItemDetailId);
  if (!item) return;

  if (!isItemDetailEditing) {
    toggleItemDetailEditMode(activeItemDetailId, true);
  } else {
    const readyQty = item.ready || 0;
    const brokenQty = item.broken || 0;
    const inStockQty = readyQty + brokenQty;
    saveItemDetailChanges(activeItemDetailId, inStockQty);
  }
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

  const topEditBtn = document.getElementById("btn-top-edit-item");
  const topEditText = document.getElementById("btn-top-edit-item-text");
  if (topEditBtn && topEditText) {
    if (isItemDetailEditing) {
      topEditBtn.className = "px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition";
      topEditText.textContent = "💾 Lưu Thay Đổi";
    } else {
      topEditBtn.className = "px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 shadow-2xs transition";
      topEditText.textContent = "Sửa Thông Tin";
    }
  }

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
    <!-- 1. 5 Compact Inventory Metric Cards (Gọn trong 1 hàng trên cả điện thoại & máy tính) -->
    <div class="grid grid-cols-5 gap-1 sm:gap-2 p-1 sm:p-2 bg-slate-50/80 rounded-xl border border-slate-200">
      <div class="p-1 sm:p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-center flex flex-col justify-between">
        <div class="text-[8px] sm:text-[10px] uppercase font-bold text-emerald-700 leading-tight truncate">Sẵn sàng</div>
        <div class="text-xs sm:text-lg font-black text-emerald-800 leading-tight my-0.5">${readyQty}</div>
        <div class="text-[8px] sm:text-[9px] text-emerald-600 leading-tight truncate">${item.unit}</div>
      </div>
      <div class="p-1 sm:p-2 rounded-lg bg-amber-50 border border-amber-200 text-center flex flex-col justify-between">
        <div class="text-[8px] sm:text-[10px] uppercase font-bold text-amber-700 leading-tight truncate">Đang đi</div>
        <div class="text-xs sm:text-lg font-black text-amber-800 leading-tight my-0.5">${inUseQty}</div>
        <div class="text-[8px] sm:text-[9px] text-amber-600 leading-tight truncate">${item.unit}</div>
      </div>
      <div class="p-1 sm:p-2 rounded-lg bg-rose-50 border border-rose-200 text-center flex flex-col justify-between">
        <div class="text-[8px] sm:text-[10px] uppercase font-bold text-rose-700 leading-tight truncate">Hỏng</div>
        <div class="text-xs sm:text-lg font-black text-rose-800 leading-tight my-0.5">${brokenQty}</div>
        <div class="text-[8px] sm:text-[9px] text-rose-600 leading-tight truncate">${item.unit}</div>
      </div>
      <div class="p-1 sm:p-2 rounded-lg bg-sky-50 border border-sky-200 text-center flex flex-col justify-between">
        <div class="text-[8px] sm:text-[10px] uppercase font-bold text-sky-700 leading-tight truncate">Tại kho</div>
        <div class="text-xs sm:text-lg font-black text-sky-800 leading-tight my-0.5">${inStockQty}</div>
        <div class="text-[8px] sm:text-[9px] text-sky-600 leading-tight truncate">Sẵn+Hỏng</div>
      </div>
      <div class="p-1 sm:p-2 rounded-lg bg-purple-50 border border-purple-200 text-center flex flex-col justify-between">
        <div class="text-[8px] sm:text-[10px] uppercase font-bold text-purple-700 leading-tight truncate">Tổng cộng</div>
        <div class="text-xs sm:text-lg font-black text-purple-800 leading-tight my-0.5">${totalQty}</div>
        <div class="text-[8px] sm:text-[9px] text-purple-600 leading-tight truncate">${item.unit}</div>
      </div>
    </div>

    <!-- 2. Shelves Allocation (ĐẨY LÊN ĐẦU NGAY SAU CÁC THÔNG TIN TỔNG HỢP SỐ LƯỢNG) -->
    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
      <div class="flex items-center justify-between">
        <div>
          <span class="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <i data-lucide="archive" class="w-3.5 h-3.5 text-sky-600"></i>
            <span>Phân Bổ Vị Trí Giá Kệ Trong Kho</span>
          </span>
          <p class="text-[10px] text-slate-500">Khóa cố định Tên kho: <strong>${item.warehouseName}</strong> và Tổng tại kho: <strong>${inStockQty}</strong>. Tổng các kệ phải khớp 100%.</p>
        </div>
        ${isItemDetailEditing ? `
          <button type="button" onclick="addDetailShelfRow('${item.id}')" class="px-2.5 py-1 text-xs font-semibold rounded bg-sky-600 text-white hover:bg-sky-700 shadow-2xs">
            + Thêm Kệ
          </button>
        ` : ''}
      </div>

      <div id="detail-shelves-container" class="space-y-1.5">
        ${shelfRowsHtml}
      </div>

      <div class="flex items-center justify-between pt-1.5 border-t border-slate-200 text-xs">
        <span class="text-[11px] text-slate-600">Tổng các kệ: <strong id="detail-shelf-sum">${inStockQty}</strong> / Mục tiêu tại kho: <strong>${inStockQty}</strong></span>
        <span id="detail-shelf-status" class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Khớp 100%</span>
      </div>
    </div>

    <!-- 3. Specifications & Image & Warehouse Fixed Info (Compact) -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200 text-xs">
      <div class="sm:col-span-1">
        <img src="${item.image || 'https://images.unsplash.com/photo-1513151233558-d860c5398176?w=300'}" alt="${item.name}" class="w-full h-32 object-cover rounded-lg border border-slate-200">
      </div>
      <div class="sm:col-span-2 space-y-1.5">
        ${isItemDetailEditing ? `
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Tên đạo cụ:</label>
            <input type="text" id="detail-edit-name" value="${item.name}" class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Thông số kỹ thuật:</label>
            <input type="text" id="detail-edit-specs" value="${item.specs || ''}" class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs">
          </div>
          <div>
            <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Mục đích sử dụng:</label>
            <input type="text" id="detail-edit-purpose" value="${item.purpose || ''}" class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs">
          </div>
        ` : `
          <div><strong class="text-slate-700">Thông số kỹ thuật:</strong> <span class="text-slate-600">${item.specs || 'N/A'}</span></div>
          <div><strong class="text-slate-700">Mục đích sử dụng:</strong> <span class="text-slate-600">${item.purpose || 'N/A'}</span></div>
          <div><strong class="text-slate-700">Đơn vị tính:</strong> <span class="text-slate-700 font-bold">${item.unit}</span></div>
          <div><strong class="text-slate-700">Định mức tồn tối thiểu:</strong> <span class="text-slate-600">${item.minStock || 0} ${item.unit}</span></div>
        `}
        <div class="pt-1 flex flex-wrap items-center gap-1.5">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">Kho: ${item.warehouseName} (Khóa cố định)</span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Tổng tài sản: ${totalQty} (Khóa cố định)</span>
        </div>
      </div>
    </div>

    <!-- 4. Active Tour Borrowing Details & Broken Items Details -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      <div class="p-3 bg-amber-50/40 rounded-xl border border-amber-200/80 space-y-1.5">
        <div class="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
          <i data-lucide="truck" class="w-3.5 h-3.5 text-amber-600"></i>
          <span>Đang Sử Dụng Ở Đâu (Chương trình):</span>
        </div>
        <div class="space-y-1">${toursList}</div>
      </div>

      <div class="p-3 bg-rose-50/40 rounded-xl border border-rose-200/80 space-y-1.5">
        <div class="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
          <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-rose-600"></i>
          <span>Báo Cáo Đồ Hỏng & Vị Trí:</span>
        </div>
        <div class="space-y-1">${brokenList}</div>
      </div>
    </div>

    <!-- 5. Purchase Information Section (Thời gian mua, Đơn vị mua, Giá mua, Hóa đơn) -->
    <div class="p-3 bg-blue-50/50 rounded-xl border border-blue-200 space-y-2 text-xs">
      <div class="flex items-center justify-between font-bold text-blue-950">
        <span class="flex items-center gap-1.5">
          <i data-lucide="receipt" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Thông Tin Mua Hàng & Hóa Đơn (Gần nhất)</span>
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Thời gian mua (gần nhất):</label>
          ${isItemDetailEditing ? `
            <input type="date" id="detail-edit-purchasedate" value="${item.purchaseDate || ''}" class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs">
          ` : `
            <div class="p-1.5 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 text-[11px]">${item.purchaseDate || 'Chưa cập nhật'}</div>
          `}
        </div>

        <div>
          <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Đơn vị mua (gần nhất):</label>
          ${isItemDetailEditing ? `
            <input type="text" id="detail-edit-purchasevendor" value="${item.purchaseVendor || ''}" placeholder="Tên công ty / nhà cung cấp..." class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs">
          ` : `
            <div class="p-1.5 bg-white rounded-lg border border-slate-200 font-semibold text-slate-800 truncate text-[11px]">${item.purchaseVendor || 'Chưa cập nhật'}</div>
          `}
        </div>

        <div>
          <label class="block text-[10px] font-semibold text-slate-600 mb-0.5">Giá mua (gần nhất):</label>
          ${isItemDetailEditing ? `
            <input type="number" id="detail-edit-purchaseprice" value="${item.purchasePrice || 0}" step="1000" class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-sky-800">
          ` : `
            <div class="p-1.5 bg-white rounded-lg border border-slate-200 font-bold text-sky-800 text-[11px]">${item.purchasePrice ? item.purchasePrice.toLocaleString('vi-VN') + ' đ' : 'Chưa cập nhật'}</div>
          `}
        </div>
      </div>

      <!-- Invoice Document / Photo -->
      <div class="pt-1.5 border-t border-blue-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[10px] font-bold text-slate-700">Ảnh / File Hóa đơn:</span>
          ${item.invoiceUrl ? `
            <a href="${item.invoiceUrl}" target="_blank" class="px-2 py-0.5 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-bold text-[10px] flex items-center gap-1 transition">
              <i data-lucide="file-check" class="w-3 h-3 text-blue-700"></i>
              <span>Xem Hóa Đơn / Chứng Từ</span>
            </a>
          ` : `
            <span class="text-[10px] text-slate-400 italic">Chưa có ảnh/tệp hóa đơn</span>
          `}
        </div>

        ${isItemDetailEditing ? `
          <div class="flex items-center gap-2">
            <label class="px-2 py-1 rounded-lg bg-white border border-blue-300 hover:bg-blue-50 text-blue-800 font-bold text-[11px] cursor-pointer flex items-center gap-1 shadow-2xs">
              <i data-lucide="upload" class="w-3 h-3"></i>
              <span>Tải Ảnh / File PDF</span>
              <input type="file" accept="image/*,application/pdf" class="hidden" onchange="handleInvoiceUpload(event, '${item.id}')">
            </label>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- 6. Bottom Action Buttons -->
    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
      ${!isItemDetailEditing ? `
        <button type="button" onclick="toggleItemDetailEditMode('${item.id}', true)" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow flex items-center gap-1.5 text-xs">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
          <span>Sửa Thông Tin</span>
        </button>
        <button type="button" onclick="closeModal('modal-item-detail')" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition text-xs">
          Đóng
        </button>
      ` : `
        <button type="button" onclick="toggleItemDetailEditMode('${item.id}', false)" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition text-xs">
          Hủy Bỏ
        </button>
        <button type="button" onclick="saveItemDetailChanges('${item.id}', ${inStockQty})" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow flex items-center gap-1.5 text-xs">
          <i data-lucide="save" class="w-3.5 h-3.5"></i>
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
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="font-extrabold text-xs sm:text-sm text-emerald-900">✓ Đã kiểm đếm nhận đủ đồ tại hiện trường (Đang chạy)</span>
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

  // Not yet checked - render interactive checklist table (Gọn gàng, bỏ STT, dồn không gian cho Tên đạo cụ)
  container.innerHTML = `
    <div class="p-2 sm:p-3 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2 mb-3 shadow-xs">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-1.5 border-b border-amber-200">
        <div>
          <div class="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-amber-950">
            <i data-lucide="clipboard-check" class="w-4 h-4 text-amber-600"></i>
            <span>Biên Bản Kiểm Đếm Nhận Đồ Tại Hiện Trường (Chưa kiểm đồ khi nhận)</span>
          </div>
          <p class="text-[11px] text-amber-800">Người nhận: <strong>${tour.leader}</strong> (${tour.phone}) • Vui lòng đếm lại số lượng thực tế nhận được</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onclick="tickAllTourReceiptItems('${tour.id}')" class="px-2.5 py-1 text-xs font-bold rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition shadow-2xs flex items-center gap-1">
            <i data-lucide="check-check" class="w-3.5 h-3.5 text-emerald-600"></i>
            <span>Tích Chọn Đủ 100%</span>
          </button>
        </div>
      </div>

      <div class="rounded-lg border border-amber-200 bg-white overflow-hidden shadow-2xs">
        <table class="w-full text-left text-xs">
          <thead class="bg-amber-100/70 text-slate-700 border-b border-amber-200 font-bold">
            <tr>
              <th class="py-2 px-1 text-center w-7">Đủ</th>
              <th class="py-2 px-2">Đạo Cụ</th>
              <th class="py-2 px-1 text-center w-8 sm:w-11 text-[10px] sm:text-xs">ĐVT</th>
              <th class="py-2 px-1 text-center w-10 sm:w-12 text-[10px] sm:text-xs">SL Gửi</th>
              <th class="py-2 px-1 text-center w-12 sm:w-14 text-[10px] sm:text-xs">SL Nhận</th>
              <th class="py-2 px-1 text-center w-14 sm:w-18 text-[10px] sm:text-xs">Trạng Thái</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-amber-100">
            ${(tour.receiptChecklist || []).map((it, idx) => {
              const diff = Number(it.receivedQty || 0) - Number(it.dispatchedQty || 0);
              const isExact = (diff === 0);
              const isShort = (diff < 0);
              return `
                <tr class="hover:bg-amber-50/40 transition ${!it.checked ? 'bg-amber-50/30' : ''}">
                  <td class="py-1.5 px-1 text-center">
                    <input type="checkbox" ${it.checked ? 'checked' : ''} onchange="toggleTourReceiptCheck('${tour.id}', ${idx}, this.checked)" class="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer">
                  </td>
                  <td class="py-1.5 px-2 font-semibold text-slate-800">${it.name}</td>
                  <td class="py-1.5 px-1 text-center text-slate-500 text-[10px] sm:text-xs">${it.unit}</td>
                  <td class="py-1.5 px-1 text-center font-bold text-slate-700 text-xs">${it.dispatchedQty}</td>
                  <td class="py-1.5 px-1 text-center">
                    <input type="number" min="0" value="${it.receivedQty}" oninput="updateTourReceiptQty('${tour.id}', ${idx}, this.value)" class="w-10 sm:w-12 p-1 text-center font-extrabold text-xs rounded border ${isShort ? 'border-rose-400 text-rose-700 bg-rose-50' : 'border-slate-300 text-slate-900 bg-white'} focus:outline-none focus:ring-1 focus:ring-amber-500">
                  </td>
                  <td class="py-1.5 px-1 text-center">
                    ${isExact ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Đủ 100%</span>` :
                      isShort ? `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white animate-pulse">Thiếu ${Math.abs(diff)}</span>` :
                      `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Thừa ${diff}</span>`}
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

  let html = `
    <!-- Master Props Table: STT (xem có bao nhiêu loại), Tên đồ, Số lượng, Đơn vị - Không hiển thị nơi xuất -->
    <div class="rounded-xl border border-slate-200 overflow-hidden shadow-2xs bg-white mb-4">
      <div class="p-3 bg-slate-100 flex items-center justify-between border-b border-slate-200">
        <span class="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
          <i data-lucide="layers" class="w-4 h-4 text-sky-600"></i>
          <span>Danh Sách Tổng Hợp Đạo Cụ Tại Chương Trình:</span>
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-800 border border-sky-200">
          Tổng cộng: ${tour.props.length} loại đạo cụ
        </span>
      </div>

      <table class="w-full text-left text-xs">
        <thead class="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
          <tr>
            <th class="py-2 px-1.5 w-7 sm:w-10 text-center border-r border-slate-200 text-[10px] sm:text-xs">STT</th>
            <th class="py-2 px-2.5 border-r border-slate-200">Tên Đạo Cụ</th>
            <th class="py-2 px-1 text-center w-10 sm:w-14 border-r border-slate-200 text-[10px] sm:text-xs">SL</th>
            <th class="py-2 px-1 text-center w-10 sm:w-14 text-[10px] sm:text-xs">ĐVT</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${tour.props.map((p, idx) => `
            <tr class="hover:bg-sky-50/40 transition">
              <td class="py-2 px-1.5 text-center font-bold text-slate-400 border-r border-slate-100 text-[10px] sm:text-xs">${idx + 1}</td>
              <td class="py-2 px-2.5 font-semibold text-slate-900 border-r border-slate-100">${p.name}</td>
              <td class="py-2 px-1 text-center font-black text-sky-800 text-xs sm:text-sm border-r border-slate-100">${p.qty}</td>
              <td class="py-2 px-1 text-center font-medium text-slate-500 text-[10px] sm:text-xs">${p.unit}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>

    <div class="font-bold text-xs text-slate-700 mb-2 flex items-center gap-1.5">
      <i data-lucide="boxes" class="w-4 h-4 text-amber-600"></i>
      <span>Phân Bổ Theo Bộ Game & Thiết Bị:</span>
    </div>
  `;

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
      <div class="rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden space-y-1 mb-2">
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
          <div class="p-2 space-y-1 divide-y divide-amber-100/80">
            ${group.items.map((child, cIdx) => `
              <div class="flex items-center justify-between text-xs pt-1.5 first:pt-0">
                <div class="pl-3 flex items-center gap-2">
                  <span class="text-slate-400 font-bold text-[10px]">${cIdx + 1}.</span>
                  <span class="font-medium text-slate-800">${child.name}</span>
                </div>
                <span class="px-2.5 py-0.5 rounded bg-white border border-amber-200 font-bold text-amber-900">${child.qty} ${child.unit}</span>
              </div>
            `).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }

  if (looseItems.length > 0) {
    html += `
      <div class="rounded-xl border border-slate-200 bg-white overflow-hidden space-y-1 mb-2">
        <div class="p-3 bg-slate-100 flex items-center justify-between font-bold text-xs text-slate-800">
          <span>🛠️ ĐỒ LẺ & THIẾT BỊ PHỤ TRỢ</span>
          <span class="text-[11px] text-slate-500 font-normal">${looseItems.length} món</span>
        </div>
        <div class="p-2 space-y-1 divide-y divide-slate-100">
          ${looseItems.map((child, lIdx) => `
            <div class="flex items-center justify-between text-xs pt-1.5 first:pt-0">
              <div class="flex items-center gap-2">
                <span class="text-slate-400 font-bold text-[10px]">${lIdx + 1}.</span>
                <span class="font-medium text-slate-800">${child.name}</span>
              </div>
              <span class="px-2.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-800">${child.qty} ${child.unit}</span>
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
  const isMobile = window.innerWidth < 768;
  if (isMobile && transferDestinations.length >= 2) {
    alert("Trên điện thoại chỉ hỗ trợ điều chuyển tối đa đến 2 chương trình cùng lúc để đảm bảo hiển thị vừa vặn màn hình!");
    return;
  }

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

function handleTransferReceiverInput(dIdx, query, inputEl) {
  if (!transferNewTourData[dIdx]) transferNewTourData[dIdx] = {};
  transferNewTourData[dIdx].leader = query;
  
  const phoneMatch = query.match(/(?:0|\+84)\d{9,10}/);
  if (phoneMatch) {
    transferNewTourData[dIdx].phone = phoneMatch[0];
  }

  const container = document.getElementById(`transfer-receiver-suggestions-${dIdx}`);
  if (!container) return;

  const q = (query || "").trim().toLowerCase();
  const users = state.users || [];
  const matches = q
    ? users.filter(u => (u.name || "").toLowerCase().includes(q) || (u.phone || "").includes(q))
    : users;

  if (matches.length === 0) {
    if (q) {
      container.innerHTML = `<div class="p-2 text-slate-400 italic text-[11px] text-center">Không có tài khoản khớp, bạn có thể tự viết tên/SĐT mới</div>`;
      container.classList.remove("hidden");
    } else {
      container.classList.add("hidden");
    }
    return;
  }

  container.innerHTML = matches.map(u => `
    <div onclick="selectTransferReceiver(${dIdx}, '${u.id}')" class="autocomplete-item p-2 flex items-center justify-between cursor-pointer hover:bg-purple-50 border-b border-purple-100 last:border-0 transition">
      <div>
        <strong class="text-purple-900 block text-xs leading-snug">👤 ${escapeHtml(u.name)}</strong>
        <div class="text-[10px] text-slate-500 mt-0.5">📞 ${u.phone} • ${u.roleBadge || u.role || 'Thành viên'}</div>
      </div>
      <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800">
        Chọn
      </span>
    </div>
  `).join("");
  container.classList.remove("hidden");
}

function selectTransferReceiver(dIdx, userId) {
  const user = (state.users || []).find(u => u.id === userId);
  if (!user) return;

  if (!transferNewTourData[dIdx]) transferNewTourData[dIdx] = {};
  transferNewTourData[dIdx].leader = user.name;
  transferNewTourData[dIdx].phone = user.phone;

  const input = document.getElementById(`transfer-receiver-input-${dIdx}`);
  if (input) input.value = `${user.name} (${user.phone})`;

  const container = document.getElementById(`transfer-receiver-suggestions-${dIdx}`);
  if (container) container.classList.add("hidden");
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
        <div class="p-2 bg-white rounded-lg border border-purple-200/90 space-y-1.5 shadow-2xs">
          <!-- Row 1: Label + Select -->
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-purple-900 text-xs shrink-0">Nơi nhận ${dIdx + 1}:</span>
            
            <select onchange="updateTransferDestinationTour(${dIdx}, this.value)" class="flex-1 min-w-0 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500">
              <optgroup label="-- Chương trình tiếp nhận có sẵn --">
                ${eligibleTours.map(t => `<option value="${t.id}" ${t.id === destId ? 'selected' : ''}>${escapeHtml(t.name)} (📍 ${escapeHtml(t.location)})</option>`).join("")}
              </optgroup>
              <optgroup label="-- Hoặc tạo chương trình mới --">
                <option value="__NEW_${dIdx}__" ${isNew ? 'selected' : ''}>➕ [Nhập chương trình tiếp nhận mới...]</option>
              </optgroup>
            </select>
          </div>

          ${isNew ? `
            <!-- Form tạo chương trình mới (gọn gàng, không lồng thêm lớp viền) -->
            <div class="space-y-1.5 pt-0.5">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div>
                  <label class="block text-[10px] font-bold text-purple-900 mb-0.5">Tên chương trình mới: *</label>
                  <input type="text" value="${escapeHtml(newObj.name || '')}" onchange="if(!transferNewTourData[${dIdx}]) transferNewTourData[${dIdx}]={}; transferNewTourData[${dIdx}].name = this.value; renderTransferTable();" placeholder="Ví dụ: Gala Dinner Viettel..." class="w-full p-1.5 bg-white border border-purple-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500">
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-purple-900 mb-0.5">Địa điểm: *</label>
                  <input type="text" value="${escapeHtml(newObj.location || '')}" onchange="if(!transferNewTourData[${dIdx}]) transferNewTourData[${dIdx}]={}; transferNewTourData[${dIdx}].location = this.value" placeholder="Ví dụ: Flamingo Đại Lải..." class="w-full p-1.5 bg-white border border-purple-300 rounded text-xs font-medium focus:outline-none focus:ring-1 focus:ring-purple-500">
                </div>
              </div>

              <div>
                <label class="block text-[10px] font-bold text-purple-900 mb-0.5">Người nhận & SĐT: * (Chọn gợi ý tài khoản hoặc viết mới)</label>
                <div class="flex items-center gap-1.5">
                  <div class="flex-1 relative">
                    <input type="text" id="transfer-receiver-input-${dIdx}" autocomplete="off" value="${escapeHtml(newObj.leader ? (newObj.phone ? newObj.leader + ' (' + newObj.phone + ')' : newObj.leader) : '')}" oninput="handleTransferReceiverInput(${dIdx}, this.value, this)" onfocus="handleTransferReceiverInput(${dIdx}, this.value, this)" placeholder="Gõ tìm tài khoản hoặc nhập tên, SĐT mới..." class="w-full p-1.5 bg-white border border-purple-300 rounded text-xs font-medium focus:ring-1 focus:ring-purple-500 focus:outline-none">
                    <div id="transfer-receiver-suggestions-${dIdx}" class="autocomplete-suggestions hidden"></div>
                  </div>
                  ${transferDestinations.length > 1 ? `
                    <button type="button" onclick="removeTransferDestination(${dIdx})" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0 transition" title="Xóa điểm tiếp nhận này">
                      <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          ` : `
            <!-- Chương trình đang tồn tại: nút xóa đặt cùng hàng người nhận và địa chỉ -->
            <div class="text-[11px] text-slate-600 flex items-center justify-between gap-2 pt-0.5">
              <div class="truncate flex items-center gap-1.5 flex-1 min-w-0">
                <span class="truncate">👤 Người nhận: <strong class="text-purple-900">${matchedTour?.leader || 'Chưa rõ'}</strong> (${matchedTour?.phone || ''})</span>
                <span class="text-slate-400 truncate">📍 ${matchedTour?.location || ''}</span>
              </div>
              ${transferDestinations.length > 1 ? `
                <button type="button" onclick="removeTransferDestination(${dIdx})" class="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition shrink-0" title="Xóa điểm tiếp nhận này">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              ` : ''}
            </div>
          `}
        </div>
      `;
    }).join("");
  }

  const addBtn = document.querySelector("button[onclick='addTransferDestination()']");
  if (addBtn) {
    const isMobile = window.innerWidth < 768;
    if (isMobile && transferDestinations.length >= 2) {
      addBtn.classList.add("hidden");
    } else {
      addBtn.classList.remove("hidden");
    }
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

function stepComboSetsTransfer(comboId, destId, delta, maxSets) {
  const current = Number(comboTransferSets[comboId]?.[destId] || 0);
  const next = Math.max(0, Math.min(maxSets, current + delta));
  updateComboSetsTransfer(comboId, destId, next);
}

function stepTransferQty(propName, destTourId, delta, maxQty) {
  const current = Number(transferAllocations[propName]?.[destTourId] || 0);
  const next = Math.max(0, Math.min(maxQty, current + delta));
  updateTransferQty(propName, destTourId, next);
}

function renderTransferTable() {
  const table = document.getElementById("transfer-main-table");
  if (!table) return;

  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour) return;

  const destCount = transferDestinations.length;
  // Riêng giao diện điện thoại: tên đồ chiếm 50% (1/2), bỏ cột đang giữ, số nơi nhận tối đa 2
  // Không cuộn ngang (nguyên tắc chỉ kéo xuống, không kéo sang ngang), chữ tự xuống dòng
  const nameWidth = "w-1/2 md:w-auto";
  const curHoldWidth = "hidden md:table-cell md:w-16";
  const destWidth = (destCount === 1) ? "w-[32%] md:w-20" : "w-[24%] md:w-18";
  const remainWidth = (destCount === 1) ? "w-[18%] md:w-16" : "w-[14%] md:w-14";

  let theadHtml = `
    <thead class="sticky top-0 z-20 shadow-2xs">
      <tr class="bg-slate-100 border-b border-slate-300 font-bold text-slate-800 text-[10px] sm:text-[11px]">
        <th class="py-1.5 px-1.5 text-left sticky top-0 bg-slate-100 border-b border-slate-300 ${nameWidth}">Tên Đồ / Game</th>
        <th class="py-1.5 px-1 text-center sticky top-0 bg-slate-100 border-b border-slate-300 ${curHoldWidth}">Đang Giữ</th>
        ${transferDestinations.map((dId, dIdx) => {
          const isNew = String(dId).startsWith("__NEW");
          const t = state.tours.find(tour => tour.id === dId);
          const dName = isNew ? (transferNewTourData[dIdx]?.name || `Nơi nhận ${dIdx + 1}`) : (t ? t.name : `Nơi nhận ${dIdx + 1}`);
          return `
            <th class="py-1.5 px-0.5 text-center sticky top-0 bg-purple-100 text-purple-900 border-b border-purple-200 ${destWidth}">
              <div class="leading-tight text-[10px] sm:text-xs font-bold">Sang #${dIdx + 1}</div>
              <div class="text-[8px] sm:text-[9px] font-normal text-purple-700 whitespace-normal break-words max-w-[65px] sm:max-w-[90px] mx-auto leading-tight" title="${escapeHtml(dName)}">${escapeHtml(dName)}</div>
            </th>
          `;
        }).join("")}
        <th class="py-1.5 px-0.5 text-center sticky top-0 bg-slate-100 border-b border-slate-300 ${remainWidth}">Còn Lại</th>
      </tr>
    </thead>
  `;

  let hasOverflow = false;
  let tbodyHtml = "";

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

  // Render Combos with Collapse & Direct Stepper Buttons
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
      <tr class="bg-amber-100/80 border-b border-amber-200 font-bold text-amber-950 text-xs">
        <td class="py-1.5 px-1.5 cursor-pointer select-none ${nameWidth}" onclick="toggleCollapseTransferCombo('${cId}')">
          <div class="flex items-start gap-1">
            <button type="button" class="p-0.5 text-amber-800 hover:text-amber-950 shrink-0 mt-0.5">
              <i data-lucide="${isCollapsed ? 'chevron-right' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
            </button>
            <div class="min-w-0 flex-1">
              <span class="font-extrabold text-amber-950 text-[10px] sm:text-xs whitespace-normal break-words block leading-snug" title="${escapeHtml(group.name)}">📦 ${escapeHtml(group.name)}</span>
              <span class="text-[8px] sm:text-[9px] text-amber-700 font-medium block leading-tight">(${group.items.length} món • Có ${availableSets} bộ)</span>
            </div>
          </div>
        </td>
        <td class="py-1.5 px-1 text-center ${curHoldWidth}">
          <span class="px-1 py-0.2 rounded bg-amber-200 text-amber-950 font-black text-[10px] sm:text-xs">${availableSets}<span class="hidden sm:inline"> Bộ</span></span>
        </td>
        ${transferDestinations.map(dId => {
          const setsVal = comboTransferSets[cId]?.[dId] || 0;
          return `
            <td class="py-1 px-0.5 text-center bg-purple-100/50 ${destWidth}">
              <div class="inline-flex items-stretch border ${remainingSets < 0 ? 'border-rose-400 bg-rose-50' : 'border-purple-300 bg-white'} rounded-md overflow-hidden shadow-2xs">
                <input type="number" min="0" max="${availableSets}" value="${setsVal}" onchange="updateComboSetsTransfer('${cId}', '${dId}', this.value)" class="w-6 sm:w-10 p-0.5 text-center font-black text-purple-900 bg-transparent text-[10px] sm:text-xs focus:outline-none select-all">
                <div class="flex flex-col border-l border-purple-200 bg-purple-50/60">
                  <button type="button" onclick="stepComboSetsTransfer('${cId}', '${dId}', 1, ${availableSets})" class="px-1 py-0.2 hover:bg-purple-200 text-purple-700 active:bg-purple-300 leading-none flex items-center justify-center cursor-pointer" title="Tăng">
                    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
                  </button>
                  <button type="button" onclick="stepComboSetsTransfer('${cId}', '${dId}', -1, ${availableSets})" class="px-1 py-0.2 hover:bg-purple-200 text-purple-700 active:bg-purple-300 leading-none border-t border-purple-200 flex items-center justify-center cursor-pointer" title="Giảm">
                    <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                  </button>
                </div>
              </div>
            </td>
          `;
        }).join("")}
        <td class="py-1 px-0.5 text-center font-black text-[10px] sm:text-xs ${remainWidth} ${remainingSets < 0 ? 'text-rose-600 bg-rose-100/60' : 'text-amber-950'}">
          ${remainingSets}<span class="hidden sm:inline"> Bộ</span>
        </td>
      </tr>
    `;

    // Child rows (rendered only if NOT collapsed, bỏ STT & bỏ ĐVT)
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
            <td class="py-1 px-1.5 pl-3 font-medium text-slate-800 ${nameWidth}">
              <div class="flex items-start gap-1">
                <span class="text-slate-400 shrink-0 text-[8px] mt-0.5">↳</span>
                <span class="whitespace-normal break-words block text-[10px] sm:text-xs leading-snug" title="${escapeHtml(p.name)}">
                  ${escapeHtml(p.name)} <span class="text-slate-400 font-normal md:hidden">(Có ${p.qty})</span>
                </span>
              </div>
            </td>
            <td class="py-1 px-1 text-center font-semibold text-slate-700 text-[10px] sm:text-xs ${curHoldWidth}">${p.qty}</td>
            ${transferDestinations.map(dId => {
              const val = alloc[dId] || 0;
              return `
                <td class="py-1 px-0.5 text-center bg-purple-50/20 ${destWidth}">
                  <div class="inline-flex items-stretch border ${remaining < 0 ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-white'} rounded-md overflow-hidden shadow-2xs">
                    <input type="number" min="0" max="${p.qty}" value="${val}" onchange="updateTransferQty('${escapeHtml(p.name)}', '${dId}', this.value)" class="w-6 sm:w-10 p-0.5 text-center font-bold text-[10px] sm:text-xs text-slate-900 bg-transparent focus:outline-none select-all">
                    <div class="flex flex-col border-l border-slate-200 bg-slate-50">
                      <button type="button" onclick="stepTransferQty('${escapeHtml(p.name)}', '${dId}', 1, ${p.qty})" class="px-1 py-0.2 hover:bg-purple-100 text-purple-700 active:bg-purple-200 leading-none flex items-center justify-center cursor-pointer" title="Tăng">
                        <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
                      </button>
                      <button type="button" onclick="stepTransferQty('${escapeHtml(p.name)}', '${dId}', -1, ${p.qty})" class="px-1 py-0.2 hover:bg-purple-100 text-purple-700 active:bg-purple-200 leading-none border-t border-slate-200 flex items-center justify-center cursor-pointer" title="Giảm">
                        <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                      </button>
                    </div>
                  </div>
                </td>
              `;
            }).join("")}
            <td class="py-1 px-0.5 text-center font-bold text-[10px] sm:text-xs ${remainWidth} ${remaining < 0 ? 'text-rose-600 bg-rose-100/50' : (remaining === 0 ? 'text-slate-400' : 'text-emerald-700')}">
              ${remaining}
            </td>
          </tr>
        `;
      });
    }
  }

  // Render Loose Items (bỏ STT & bỏ ĐVT)
  if (looseItems.length > 0) {
    tbodyHtml += `
      <tr class="bg-slate-100 border-b border-slate-200 font-bold text-slate-800 text-xs">
        <td colspan="10" class="py-1.5 px-2">
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
          <td class="py-1 px-1.5 font-medium text-slate-800 ${nameWidth}">
            <span class="whitespace-normal break-words block text-[10px] sm:text-xs leading-snug" title="${escapeHtml(p.name)}">
              ${escapeHtml(p.name)} <span class="text-slate-400 font-normal md:hidden">(Có ${p.qty})</span>
            </span>
          </td>
          <td class="py-1 px-1 text-center font-bold text-slate-700 text-[10px] sm:text-xs ${curHoldWidth}">${p.qty}</td>
          ${transferDestinations.map(dId => {
            const val = alloc[dId] || 0;
            return `
              <td class="py-1 px-0.5 text-center bg-purple-50/20 ${destWidth}">
                <div class="inline-flex items-stretch border ${remaining < 0 ? 'border-rose-400 bg-rose-50' : 'border-slate-300 bg-white'} rounded-md overflow-hidden shadow-2xs">
                  <input type="number" min="0" max="${p.qty}" value="${val}" onchange="updateTransferQty('${escapeHtml(p.name)}', '${dId}', this.value)" class="w-6 sm:w-10 p-0.5 text-center font-bold text-[10px] sm:text-xs text-slate-900 bg-transparent focus:outline-none select-all">
                  <div class="flex flex-col border-l border-slate-200 bg-slate-50">
                    <button type="button" onclick="stepTransferQty('${escapeHtml(p.name)}', '${dId}', 1, ${p.qty})" class="px-1 py-0.2 hover:bg-purple-100 text-purple-700 active:bg-purple-200 leading-none flex items-center justify-center cursor-pointer" title="Tăng">
                      <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"/></svg>
                    </button>
                    <button type="button" onclick="stepTransferQty('${escapeHtml(p.name)}', '${dId}', -1, ${p.qty})" class="px-1 py-0.2 hover:bg-purple-100 text-purple-700 active:bg-purple-200 leading-none border-t border-slate-200 flex items-center justify-center cursor-pointer" title="Giảm">
                      <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                    </button>
                  </div>
                </div>
              </td>
            `;
          }).join("")}
          <td class="py-1 px-0.5 text-center font-bold text-[10px] sm:text-xs ${remainWidth} ${remaining < 0 ? 'text-rose-600 bg-rose-100/50' : (remaining === 0 ? 'text-slate-400' : 'text-emerald-700')}">
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
  const submitBtn = document.querySelector("#modal-field-transfer button[onclick='submitMultiFieldTransfer()']");
  if (submitBtn) submitBtn.disabled = true;

  const sourceTour = state.tours.find(t => t.id === state.selectedTourIdTab5);
  if (!sourceTour) {
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

  // Validation 1: Overflow check
  for (let p of sourceTour.props) {
    const alloc = transferAllocations[p.name] || {};
    let totalTransfer = 0;
    transferDestinations.forEach(dId => {
      totalTransfer += (alloc[dId] || 0);
    });
    if (totalTransfer > p.qty) {
      alert(`Đạo cụ [${p.name}] chuyển tổng cộng ${totalTransfer} món, vượt quá số lượng đang giữ (${p.qty})! Vui lòng sửa lại.`);
      if (submitBtn) submitBtn.disabled = false;
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
        if (submitBtn) submitBtn.disabled = false;
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
    if (submitBtn) submitBtn.disabled = false;
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
      let leaderName = (newObj.leader || "").trim();
      let leaderPhone = (newObj.phone || "").trim();
      if (!leaderPhone) {
        const phoneMatch = leaderName.match(/(?:0|\+84)\d{9,10}/);
        if (phoneMatch) {
          leaderPhone = phoneMatch[0];
          leaderName = leaderName.replace(/[\(\[\-]?\s*(?:0|\+84)\d{9,10}\s*[\)\]]?/, "").trim();
        }
      }
      targetTour = {
        id: newTourId,
        name: newObj.name.trim(),
        location: (newObj.location || "").trim() || "Chưa xác định",
        leader: leaderName || "Người nhận",
        phone: leaderPhone || "0987654321",
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

  transferAllocations = {};
  transferDestinations = [];
  transferNewTourData = {};
  comboTransferSets = {};

  saveState();
  closeModal("modal-field-transfer");
  renderTab5();
  renderNotifications();
  if (submitBtn) submitBtn.disabled = false;
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
  const submitBtn = document.querySelector("#modal-receive-field-transfer button[onclick='confirmReceiveTransfer()']");
  if (submitBtn) submitBtn.disabled = true;

  const ft = (state.fieldTransfers || []).find(f => f.id === activeCheckingTransferId);
  if (!ft) {
    if (submitBtn) submitBtn.disabled = false;
    return;
  }

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
  if (submitBtn) submitBtn.disabled = false;
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
            <span>Nghiệm thu</span>
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
  syncToGoogleSheet("ADD_DOC", doc);
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
  syncToGoogleSheet("ADD_DOC", doc);
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
  syncToGoogleSheet("ADD_DOC", doc);
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

  // Warehouse Keeper signature resolution: Chỉ hiện ảnh & tên khi thủ kho đã duyệt thực tế
  const isKeeperApproved = (doc.keeperApproved === true);
  const keeperUser = (state.users || []).find(u => u.roleType === 'KEEPER') || (state.users && state.users[0]);
  const keeperName = isKeeperApproved ? (doc.keeperName || keeperUser?.name || "Nguyễn Văn An") : "";
  const keeperAvatar = isKeeperApproved ? (doc.keeperAvatar || keeperUser?.avatar || "") : "";

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
            <h2 class="text-sm font-bold uppercase tracking-wider text-slate-900">CÔNG TY CỔ PHẦN ĐÀO TẠO TƯ VẤN VÀ PHÁT TRIỂN ABA</h2>
            <p class="text-[10px] text-slate-500">Hệ thống Quản lý Đạo cụ & Vận hành Sự kiện</p>
          </div>
        </div>
      </div>
      <div class="text-right text-xs">
        <div class="font-extrabold text-sm text-slate-900">${doc.code}</div>
        <div class="text-[11px] text-slate-500">Thời gian lập: ${doc.createdAt}</div>
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
        <div class="h-5 flex items-center justify-center text-[10px] text-emerald-600 font-semibold">✓ Đã xác thực</div>
      </div>

      <!-- 2. THỦ KHO (Hiện tên & ảnh nếu đã xác nhận; nếu chưa thì để trống hoàn toàn để ký thật) -->
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
        <div class="h-5 flex items-center justify-center text-[10px] ${isKeeperApproved ? 'text-amber-700 font-bold' : 'text-slate-400'}">
          ${isKeeperApproved ? '✓ Thủ kho đã duyệt' : '&nbsp;'}
        </div>
      </div>

      <!-- 3. QUẢN LÝ DỰ ÁN (Để trống hoàn toàn để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">QUẢN LÝ DỰ ÁN</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          <div class="h-16 w-full"></div>
        </div>
        <div class="h-6 flex items-center justify-center text-xs font-bold text-slate-800">&nbsp;</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-slate-400">&nbsp;</div>
      </div>

      <!-- 4. KẾ TOÁN (Để trống hoàn toàn để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">KẾ TOÁN</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          <div class="h-16 w-full"></div>
        </div>
        <div class="h-6 flex items-center justify-center text-xs font-bold text-slate-800">&nbsp;</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-slate-400">&nbsp;</div>
      </div>

      <!-- 5. GIÁM ĐỐC (Để trống hoàn toàn để ký thật) -->
      <div class="flex flex-col items-center">
        <div class="h-7 flex items-center justify-center font-bold text-slate-800 text-xs uppercase mb-1">GIÁM ĐỐC</div>
        <div class="h-16 w-full flex items-center justify-center my-1">
          <div class="h-16 w-full"></div>
        </div>
        <div class="h-6 flex items-center justify-center text-xs font-bold text-slate-800">&nbsp;</div>
        <div class="h-5 flex items-center justify-center text-[10px] text-slate-400">&nbsp;</div>
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
  populateWarehouseManagerDropdowns();
  renderWarehouseList();
  const modal = document.getElementById("modal-warehouse-mgmt");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function populateWarehouseManagerDropdowns() {
  const newMgrSel = document.getElementById("new-wh-manager");
  if (newMgrSel) {
    const users = state.users || [];
    newMgrSel.innerHTML = `<option value="">-- Chọn người quản lý từ danh sách tài khoản --</option>` +
      users.map(u => `<option value="${u.name}">${u.name} - ${u.phone} (${u.roleBadge || u.role})</option>`).join("");
  }
}

function renderWarehouseList() {
  const container = document.getElementById("warehouse-list");
  if (!container) return;

  container.innerHTML = state.warehouses.map(wh => {
    const itemsCount = state.items.filter(i => i.warehouseId === wh.id).length;
    const hasCustomMap = wh.mapImage && wh.mapImage.length > 20;
    return `
      <div class="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-xs hover:border-sky-300 transition">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <h4 class="font-bold text-xs text-slate-900">${wh.name}</h4>
            ${hasCustomMap ? `<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800 border border-sky-200">🗺️ Có ảnh sơ đồ</span>` : ''}
          </div>
          <p class="text-[11px] text-slate-500 truncate mt-0.5">📍 ${wh.address || 'Hà Nội'} | Quản lý: <strong class="text-slate-700">${wh.manager || 'N/A'}</strong></p>
          <span class="inline-block px-2 py-0.5 mt-1 rounded text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100">
            Đang chứa ${itemsCount} loại đạo cụ
          </span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="openWarehouseMap('${wh.id}')" class="px-2.5 py-1 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition flex items-center gap-1" title="Xem sơ đồ bản đồ kho này">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            <span>Bản Đồ</span>
          </button>
          <button type="button" onclick="openEditWarehouseModal('${wh.id}')" class="px-2.5 py-1 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition flex items-center gap-1" title="Sửa địa chỉ, người quản lý và ảnh sơ đồ">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Sửa</span>
          </button>
          <button type="button" onclick="handleDeleteWarehouse('${wh.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Xóa kho">
            <i data-lucide="trash-2" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

function handleNewWhMapUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const dataUrl = evt.target.result;
    const dataInput = document.getElementById("new-wh-map-data");
    if (dataInput) dataInput.value = dataUrl;
    const preview = document.getElementById("new-wh-map-preview");
    if (preview) {
      preview.classList.remove("hidden");
      preview.querySelector("img").src = dataUrl;
    }
  };
  reader.readAsDataURL(file);
}

function handleNewWhMapCamera(dataUrl) {
  const dataInput = document.getElementById("new-wh-map-data");
  if (dataInput) dataInput.value = dataUrl;
  const preview = document.getElementById("new-wh-map-preview");
  if (preview) {
    preview.classList.remove("hidden");
    preview.querySelector("img").src = dataUrl;
  }
}

function clearNewWhMapPhoto() {
  const dataInput = document.getElementById("new-wh-map-data");
  if (dataInput) dataInput.value = "";
  const preview = document.getElementById("new-wh-map-preview");
  if (preview) {
    preview.classList.add("hidden");
    preview.querySelector("img").src = "";
  }
  const fileInput = document.getElementById("new-wh-map-file");
  if (fileInput) fileInput.value = "";
}

function handleEditWhMapUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    const dataUrl = evt.target.result;
    const dataInput = document.getElementById("edit-wh-map-data");
    if (dataInput) dataInput.value = dataUrl;
    const preview = document.getElementById("edit-wh-map-preview");
    if (preview) {
      preview.classList.remove("hidden");
      preview.querySelector("img").src = dataUrl;
    }
  };
  reader.readAsDataURL(file);
}

function handleEditWhMapCamera(dataUrl) {
  const dataInput = document.getElementById("edit-wh-map-data");
  if (dataInput) dataInput.value = dataUrl;
  const preview = document.getElementById("edit-wh-map-preview");
  if (preview) {
    preview.classList.remove("hidden");
    preview.querySelector("img").src = dataUrl;
  }
}

function clearEditWhMapPhoto() {
  const dataInput = document.getElementById("edit-wh-map-data");
  if (dataInput) dataInput.value = "";
  const preview = document.getElementById("edit-wh-map-preview");
  if (preview) {
    preview.classList.add("hidden");
    preview.querySelector("img").src = "";
  }
  const fileInput = document.getElementById("edit-wh-map-file");
  if (fileInput) fileInput.value = "";
}

function handleAddWarehouse(event) {
  event.preventDefault();
  const name = document.getElementById("new-wh-name")?.value.trim();
  const address = document.getElementById("new-wh-address")?.value.trim();
  const manager = document.getElementById("new-wh-manager")?.value.trim();
  const mapImage = document.getElementById("new-wh-map-data")?.value || "";

  if (!name || !address || !manager) {
    alert("Yêu cầu bắt buộc nhập đủ tất cả thông tin:\n1. Tên kho\n2. Địa chỉ chi tiết\n3. Người quản lý kho (chọn từ danh sách tài khoản)!");
    return;
  }

  const newWh = {
    id: `WH-${Date.now()}`,
    code: `KHO-${Math.floor(10 + Math.random() * 90)}`,
    name: name,
    address: address,
    manager: manager,
    mapImage: mapImage,
    isDefault: false
  };

  state.warehouses.push(newWh);
  saveState();
  syncToGoogleSheet("UPDATE_WAREHOUSES", newWh, { warehouses: state.warehouses });
  event.target.reset();
  clearNewWhMapPhoto();
  renderWarehouseList();
  populateCommonDropdowns();
  showToast(`Đã thêm kho mới [${name}] thành công!`, "success");
}

function openEditWarehouseModal(whId) {
  closeModal('modal-warehouse-mgmt');
  const wh = state.warehouses.find(w => w.id === whId);
  if (!wh) return;

  const idInput = document.getElementById("edit-wh-id");
  const nameInput = document.getElementById("edit-wh-name");
  const addrInput = document.getElementById("edit-wh-address");
  const mgrSelect = document.getElementById("edit-wh-manager");

  if (idInput) idInput.value = wh.id;
  if (nameInput) nameInput.value = wh.name;
  if (addrInput) addrInput.value = wh.address || "";

  if (mgrSelect) {
    const users = state.users || [];
    mgrSelect.innerHTML = `<option value="">-- Chọn người quản lý từ danh sách tài khoản --</option>` +
      users.map(u => `<option value="${u.name}" ${u.name === wh.manager ? 'selected' : ''}>${u.name} - ${u.phone} (${u.roleBadge || u.role})</option>`).join("");
  }

  const mapDataInput = document.getElementById("edit-wh-map-data");
  const mapPreview = document.getElementById("edit-wh-map-preview");
  if (mapDataInput) mapDataInput.value = wh.mapImage || "";
  if (mapPreview) {
    if (wh.mapImage && wh.mapImage.length > 20) {
      mapPreview.classList.remove("hidden");
      mapPreview.querySelector("img").src = wh.mapImage;
    } else {
      mapPreview.classList.add("hidden");
      mapPreview.querySelector("img").src = "";
    }
  }

  const modal = document.getElementById("modal-edit-warehouse");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function saveEditedWarehouse() {
  const whId = document.getElementById("edit-wh-id")?.value;
  const address = document.getElementById("edit-wh-address")?.value.trim();
  const manager = document.getElementById("edit-wh-manager")?.value.trim();
  const mapImage = document.getElementById("edit-wh-map-data")?.value || "";

  if (!whId) return;
  if (!address || !manager) {
    alert("Vui lòng nhập đầy đủ địa chỉ chi tiết và chọn người quản lý kho!");
    return;
  }

  const wh = state.warehouses.find(w => w.id === whId);
  if (!wh) return;

  wh.address = address;
  wh.manager = manager;
  wh.mapImage = mapImage;

  saveState();
  syncToGoogleSheet("UPDATE_WAREHOUSES", wh, { warehouses: state.warehouses });
  closeModal("modal-edit-warehouse");
  renderWarehouseList();
  showToast(`Đã cập nhật thông tin kho [${wh.name}] thành công!`, "success");
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
  syncToGoogleSheet("UPDATE_WAREHOUSES", null, { warehouses: state.warehouses });
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
  div.className = "flex items-center gap-1.5 combo-child-row bg-white/95 p-1 rounded-lg border border-slate-200 shadow-2xs";
  div.innerHTML = `
    <div class="flex-1 min-w-0">
      <input type="text" list="combo-item-datalist" value="${escapeHtml(nameVal)}" placeholder="Gõ tên để tìm đồ có sẵn..." onchange="onComboChildNameChange(this)" class="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs child-name focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none font-medium text-slate-800" required>
    </div>
    <div class="w-14 sm:w-16 shrink-0">
      <input type="number" min="1" value="${qtyVal}" placeholder="SL" class="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center font-bold child-qty focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none text-slate-900" required title="Số lượng mỗi bộ">
    </div>
    <div class="w-14 sm:w-16 shrink-0">
      <input type="text" value="${escapeHtml(unitVal)}" placeholder="ĐVT" class="w-full p-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-center child-unit focus:bg-white focus:ring-1 focus:ring-amber-500 focus:outline-none text-slate-700" required title="Đơn vị tính (Chiếc, Bộ, Cuộn...)">
    </div>
    <button type="button" onclick="removeComboChildRow(this)" class="text-slate-400 hover:text-rose-500 p-1.5 rounded hover:bg-rose-50 transition shrink-0 cursor-pointer" title="Xóa món này">
      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
    </button>
  `;
  container.appendChild(div);
  if (window.lucide) lucide.createIcons();
}

function removeComboChildRow(btn) {
  const row = btn.closest(".combo-child-row");
  if (row) row.remove();
  const container = document.getElementById("combo-items-inputs");
  if (container && container.children.length === 0) {
    addComboChildInputRow();
  }
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
  let items = [];

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

  const defaultCategory = category || (type === "TOOLSET" ? "Dụng cụ phụ trợ" : "Game tự chế");

  if (editingComboId) {
    const existingIndex = state.combos.findIndex(c => c.id === editingComboId);
    if (existingIndex !== -1) {
      if (items.length === 0 && state.combos[existingIndex].items) {
        items = state.combos[existingIndex].items;
      }
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
// GOOGLE SHEETS & REALTIME CLOUD SYNC ENGINE (2-WAY BIDIRECTIONAL SYNC)
// =========================================================================

/**
 * Gửi dữ liệu đồng bộ lên Google Sheets qua Webhook Google Apps Script
 * Hỗ trợ POST không bị chặn CORS bằng mode no-cors / text/plain
 */
async function syncToGoogleSheet(action, payload, extraData = {}) {
  const webhookUrl = state.gsheetConfig?.url || DEFAULT_GSHEET_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const postBody = {
      action: action, // "ADD_DOC", "UPDATE_ITEMS", "UPDATE_WAREHOUSES", "SYNC_ALL"
      payload: payload,
      items: state.items || [],
      warehouses: state.warehouses || [],
      documents: state.documents || [],
      ...extraData,
      timestamp: new Date().toISOString()
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(postBody),
      mode: "no-cors"
    });

    state.gsheetConfig.lastSync = new Date().toISOString();
    state.gsheetConfig.isConnected = true;
    localStorage.setItem(STORAGE_KEYS.GSHEET_CONFIG, JSON.stringify(state.gsheetConfig));
    renderGSheetStatus();
  } catch (err) {
    console.warn("Lỗi đồng bộ ngầm Google Sheet:", err);
  }
}

/**
 * Tải dữ liệu từ Google Sheets về Web App (Đồng bộ 2 chiều)
 */
async function pullFromGoogleSheet(silent = false) {
  const webhookUrl = state.gsheetConfig?.url || DEFAULT_GSHEET_WEBHOOK_URL;
  if (!webhookUrl) return;

  if (!silent) showToast("Đang đồng bộ dữ liệu từ Google Sheet...", "info");

  try {
    const res = await fetch(webhookUrl + "?action=getAll");
    if (!res.ok) return;
    const result = await res.json();

    if (result.status === "success" && result.data) {
      let changed = false;

      // 1. Cập nhật danh sách kho từ Google Sheet
      if (Array.isArray(result.data.warehouses) && result.data.warehouses.length > 0) {
        const parsedWhs = result.data.warehouses.map(w => {
          if (w["Dữ Liệu Chi Tiết (JSON)"]) {
            try { return JSON.parse(w["Dữ Liệu Chi Tiết (JSON)"]); } catch(e) {}
          }
          return {
            id: w["Mã Kho"] || `WH-${Date.now()}`,
            code: w["Mã Kho"] || "",
            name: w["Tên Kho Bãi"] || "",
            address: w["Địa Chỉ"] || "",
            manager: w["Thủ Kho Quản Lý"] || "",
            isDefault: w["Kho Mặc Định"] === "Có",
            mapImage: w["Ảnh Sơ Đồ"] || ""
          };
        }).filter(w => w.name);

        if (parsedWhs.length > 0) {
          state.warehouses = parsedWhs;
          changed = true;
        }
      }

      // 2. Cập nhật danh sách đạo cụ từ Google Sheet
      if (Array.isArray(result.data.items) && result.data.items.length > 0) {
        const parsedItems = result.data.items.map(it => {
          if (it["Dữ Liệu Chi Tiết (JSON)"]) {
            try { return JSON.parse(it["Dữ Liệu Chi Tiết (JSON)"]); } catch(e) {}
          }

          const ready = Number(it["Sẵn Sàng"]) || 0;
          const inUse = Number(it["Đang Đi Tour"]) || 0;
          const broken = Number(it["Đang Hỏng"]) || 0;
          const total = Number(it["Tổng Tồn"]) || (ready + inUse + broken);

          return {
            id: it["Mã Đạo Cụ"] || `ITEM-${Date.now()}`,
            code: it["Mã Đạo Cụ"] || "",
            name: it["Tên Đạo Cụ"] || "",
            type: it["Danh Mục"] === "Đồ hơi" ? "Khấu hao" : "Khấu hao",
            category: it["Danh Mục"] || "Đồ sự kiện",
            purpose: it["Mục Đích Sử Dụng"] || "",
            warehouseName: it["Kho Quản Lý"] || "",
            warehouseId: (state.warehouses.find(w => w.name === it["Kho Quản Lý"]) || {}).id || "WH-MD",
            unit: it["Đơn Vị Tính"] || "cái",
            total: total,
            ready: ready,
            inUse: inUse,
            broken: broken,
            price: Number(it["Đơn Giá (VNĐ)"]) || 0,
            image: it["URL Ảnh"] || "",
            shelves: []
          };
        }).filter(it => it.name);

        if (parsedItems.length > 0) {
          state.items = parsedItems;
          changed = true;
        }
      }

      if (changed) {
        saveState();
        renderApp();
        if (!silent) showToast("🟢 Đã tải và đồng bộ dữ liệu mới nhất từ Google Sheet!", "success");
      }
    }
  } catch (err) {
    console.warn("Không thể tải từ Google Sheet:", err);
  }
}

function openGSheetModal() {
  const urlInput = document.getElementById("gsheet-webhook-url");
  if (urlInput) urlInput.value = state.gsheetConfig.url || DEFAULT_GSHEET_WEBHOOK_URL;
  const modal = document.getElementById("modal-gsheet");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function saveGSheetConfig() {
  const url = document.getElementById("gsheet-webhook-url")?.value.trim() || DEFAULT_GSHEET_WEBHOOK_URL;
  state.gsheetConfig.url = url;
  state.gsheetConfig.isConnected = !!url;
  saveState();
  renderGSheetStatus();
  closeModal("modal-gsheet");
  showToast("Đã lưu cấu hình kết nối Google Sheet!", "success");

  if (url) {
    triggerFullGSheetSync();
  }
}

async function triggerFullGSheetSync() {
  showToast("Đang đồng bộ toàn bộ Đạo cụ & Kho bãi lên Google Sheet...", "info");
  try {
    await syncToGoogleSheet("SYNC_ALL", null, {
      items: state.items || [],
      warehouses: state.warehouses || [],
      documents: state.documents || []
    });
    showToast("🟢 Đã gửi toàn bộ dữ liệu lên Google Sheet thành công!", "success");
  } catch (e) {
    showToast("⚠️ Có lỗi khi gửi dữ liệu lên Google Sheet", "error");
  }
}

async function testGSheetConnection() {
  const url = document.getElementById("gsheet-webhook-url")?.value.trim() || state.gsheetConfig.url;
  if (!url) {
    alert("Vui lòng dán URL Google Apps Script Web App trước!");
    return;
  }

  showToast("Đang kiểm tra kết nối với Google Sheet...", "info");

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "PING", message: "Test connection from ABA Web App" }),
      mode: "no-cors"
    });

    state.gsheetConfig.url = url;
    state.gsheetConfig.isConnected = true;
    renderGSheetStatus();
    saveState();
    showToast("🟢 Kết nối thành công! Đang kích hoạt đồng bộ dữ liệu...", "success");
    await triggerFullGSheetSync();
  } catch (err) {
    showToast("⚠️ Kiểm tra kết nối thất bại: " + err.message, "error");
  }
}

function copyAppsScriptCode() {
  const code = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT CHO HỆ THỐNG QUẢN LÝ ĐẠO CỤ & KHO BÃI ABA
 * Bảng tính đích: Quản lý đạo cụ Final
 * ID Bảng tính: 1zuu2b1XtkwFweNQfXJ9_K3oQw_AXsJkuAzeIGXYSms0
 * =========================================================================
 */

var SPREADSHEET_ID = "1zuu2b1XtkwFweNQfXJ9_K3oQw_AXsJkuAzeIGXYSms0";

function getSpreadsheet() {
  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch(e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  var ss = getSpreadsheet();
  var itemsSheet = getOrCreateSheet(ss, "ITEMS", getItemsHeaders());
  var docsSheet = getOrCreateSheet(ss, "DOCUMENTS", getDocsHeaders());
  var whSheet = getOrCreateSheet(ss, "WAREHOUSES", getWarehousesHeaders());
  var toursSheet = getOrCreateSheet(ss, "TOURS", getToursHeaders());

  return responseJson({
    status: "success",
    timestamp: new Date().toISOString(),
    data: {
      items: getSheetDataAsJson(itemsSheet),
      documents: getSheetDataAsJson(docsSheet),
      warehouses: getSheetDataAsJson(whSheet),
      tours: getSheetDataAsJson(toursSheet)
    }
  });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJson({ status: "error", message: "Không có dữ liệu gửi lên" });
    }

    var data = JSON.parse(e.postData.contents);
    var ss = getSpreadsheet();

    // 1. Lưu phiếu vào sheet DOCUMENTS
    if (data.payload && data.payload.code) {
      var docSheet = getOrCreateSheet(ss, "DOCUMENTS", getDocsHeaders());
      var d = data.payload;
      docSheet.appendRow([
        d.code || d.id || "",
        d.type || "",
        d.createdAt || new Date().toLocaleString("vi-VN"),
        d.creator || "",
        d.warehouseName || "",
        d.tourName || "",
        d.itemsCount || 0,
        d.status || "Hoàn thành",
        d.keeperApproved ? "Đã duyệt" : "Chờ duyệt",
        d.note || "",
        JSON.stringify(d)
      ]);
    }

    // 2. Cập nhật danh sách đạo cụ vào sheet ITEMS
    if (data.items && Array.isArray(data.items)) {
      syncItemsToSheet(ss, data.items);
    }

    // 3. Cập nhật danh sách kho vào sheet WAREHOUSES
    if (data.warehouses && Array.isArray(data.warehouses)) {
      syncWarehousesToSheet(ss, data.warehouses);
    }

    return responseJson({
      status: "success",
      message: "Đã đồng bộ thành công lên Google Sheets thời gian thực!"
    });
  } catch(err) {
    return responseJson({ status: "error", message: err.toString() });
  }
}

function syncItemsToSheet(ss, items) {
  var sheet = getOrCreateSheet(ss, "ITEMS", getItemsHeaders());
  var headers = getItemsHeaders();

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  var rows = items.map(function(it) {
    var shelfStr = "";
    if (Array.isArray(it.shelves)) {
      shelfStr = it.shelves.map(function(s) { 
        return s.shelf + (s.tier ? (" - Tầng " + s.tier) : "") + ": " + (s.qty || 0); 
      }).join("; ");
    } else {
      shelfStr = it.shelfLocation || "";
    }

    var ready = Number(it.ready) || 0;
    var inUse = Number(it.inUse) || 0;
    var broken = Number(it.broken) || 0;
    var total = Number(it.total) || (ready + inUse + broken);

    return [
      it.code || it.id || "",
      it.name || "",
      it.category || "",
      it.purpose || "",
      it.warehouseName || it.warehouseId || "",
      shelfStr,
      it.unit || "",
      total,
      ready,
      inUse,
      broken,
      Number(it.price || it.invoiceCost) || 0,
      it.image || "",
      JSON.stringify(it)
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function syncWarehousesToSheet(ss, warehouses) {
  var sheet = getOrCreateSheet(ss, "WAREHOUSES", getWarehousesHeaders());
  var headers = getWarehousesHeaders();

  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  var rows = warehouses.map(function(w) {
    return [
      w.code || w.id || "",
      w.name || "",
      w.address || "",
      w.manager || "",
      w.isDefault ? "Có" : "Không",
      w.mapImage || "",
      JSON.stringify(w)
    ];
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function getItemsHeaders() {
  return [
    "Mã Đạo Cụ", "Tên Đạo Cụ", "Danh Mục", "Mục Đích Sử Dụng", 
    "Kho Quản Lý", "Vị Trí Kệ", "Đơn Vị Tính", "Tổng Tồn", 
    "Sẵn Sàng", "Đang Đi Tour", "Đang Hỏng", "Đơn Giá (VNĐ)", "URL Ảnh", "Dữ Liệu Chi Tiết (JSON)"
  ];
}

function getDocsHeaders() {
  return [
    "Mã Phiếu", "Loại Phiếu", "Ngày Tạo", "Người Lập Phiếu", 
    "Kho Xuất/Nhập", "Tour/Chương Trình", "Tổng Số Món", 
    "Trạng Thái", "Thủ Kho Duyệt", "Ghi Chú", "Dữ Liệu Chi Tiết (JSON)"
  ];
}

function getWarehousesHeaders() {
  return [
    "Mã Kho", "Tên Kho Bãi", "Địa Chỉ", "Thủ Kho Quản Lý", "Kho Mặc Định", "Ảnh Sơ Đồ", "Dữ Liệu Chi Tiết (JSON)"
  ];
}

function getToursHeaders() {
  return [
    "Mã Tour", "Tên Chương Trình", "Khách Hàng / Đơn Vị", "Ngày Bắt Đầu", "Ngày Kết Thúc", "Địa Điểm Tổ Chức", "Điều Hành Tour", "Trạng Thái"
  ];
}

function getSheetDataAsJson(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol < 1) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = data[0];
  var result = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      if (headers[j]) obj[headers[j]] = row[j];
    }
    result.push(obj);
  }
  return result;
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getName().trim().toUpperCase() === name.toUpperCase()) {
        sheet = sheets[i];
        break;
      }
    }
  }

  if (!sheet) {
    var firstSheet = ss.getSheets()[0];
    if (firstSheet && (firstSheet.getName() === "Trang tính 1" || firstSheet.getName() === "Sheet1")) {
      firstSheet.setName(name);
      sheet = firstSheet;
    } else {
      sheet = ss.insertSheet(name);
    }
  }

  if (sheet.getLastRow() === 0 && headers && headers.length > 0) {
    sheet.appendRow(headers);
    var hRange = sheet.getRange(1, 1, 1, headers.length);
    hRange.setFontWeight("bold").setBackground("#1e293b").setFontColor("#ffffff");
  }
  return sheet;
}

function responseJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;

  navigator.clipboard.writeText(code).then(() => {
    alert("Đã sao chép mã Google Apps Script cập nhật mới vào bộ nhớ tạm!");
  });
}

// =========================================================================
// WAREHOUSE KEEPER NOTIFICATIONS & APPROVAL SYSTEM
// =========================================================================
const KEEPER_APPROVAL_DOC_TYPES = [
  "Xuất kho",
  "Nhập mới",
  "Nhập lần đầu",
  "Nhập hoàn trả",
  "Sửa chữa",
  "Thanh lý"
];

function notifyWarehouseKeeper(doc) {
  if (!doc || !KEEPER_APPROVAL_DOC_TYPES.includes(doc.type)) {
    doc.keeperApproved = false;
    doc.keeperName = "";
    doc.keeperAvatar = "";
    return;
  }

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
  const backdrop = document.getElementById("notification-backdrop");
  if (!panel) return;
  const isHidden = panel.classList.toggle("hidden");
  if (backdrop) {
    if (isHidden) backdrop.classList.add("hidden");
    else backdrop.classList.remove("hidden");
  }
  if (!isHidden) renderNotifications();
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
    const doc = (state.documents || []).find(d => d.code === n.docCode || d.id === n.docId);

    if (n.type === "APPROVAL_REQUIRED") {
      const viewDocBtn = doc ? `
        <button type="button" onclick="openDocumentPrintModal('${doc.id}'); toggleNotificationPanel();" class="px-2.5 py-1.5 text-[11px] font-bold bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg border border-sky-200 transition shadow-2xs flex items-center gap-1">
          <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
          <span>📄 Xem Phiếu</span>
        </button>
      ` : "";

      if (n.status === "PENDING") {
        if (isKeeperOrAdmin) {
          actionButtons = `
            <div class="flex flex-wrap items-center gap-1.5 pt-2">
              ${viewDocBtn}
              <button onclick="approveKeeperDoc('${n.id}')" class="px-3 py-1.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-2xs flex items-center gap-1">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>✓ Xác nhận duyệt & ký tên</span>
              </button>
              <button onclick="rejectKeeperDoc('${n.id}')" class="px-2.5 py-1.5 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition shadow-2xs flex items-center gap-1">
                <i data-lucide="x" class="w-3.5 h-3.5"></i>
                <span>✕ Từ chối</span>
              </button>
            </div>
          `;
        } else {
          actionButtons = `
            <div class="flex flex-wrap items-center gap-2 pt-2">
              ${viewDocBtn}
              <span class="text-[10px] text-amber-700 font-semibold">⏳ Đang chờ Thủ kho duyệt...</span>
            </div>
          `;
        }
      } else if (n.status === "APPROVED") {
        actionButtons = `
          <div class="flex flex-wrap items-center gap-2 pt-1.5">
            ${viewDocBtn}
            <span class="text-[10px] text-emerald-600 font-bold">✓ Thủ kho đã duyệt & ký tên</span>
          </div>
        `;
      } else if (n.status === "REJECTED") {
        actionButtons = `
          <div class="flex flex-wrap items-center gap-2 pt-1.5">
            ${viewDocBtn}
            <span class="text-[10px] text-rose-600 font-bold">✕ Đã từ chối</span>
          </div>
        `;
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
        ${actionButtons}
      </div>
    `;
  }).join("");

  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// USER AUTHENTICATION, LOGIN SCREEN & ROLE PERMISSIONS SYSTEM
// =========================================================================

let pendingLoginUser = null;
let pendingCapturedFace = null;

function showLoginScreen() {
  const screen = document.getElementById("login-screen");
  if (screen) {
    screen.classList.remove("hidden");
    document.getElementById("login-form-view")?.classList.remove("hidden");
    document.getElementById("login-face-capture-view")?.classList.add("hidden");
  }
  if (window.lucide) lucide.createIcons();
}

function hideLoginScreen() {
  const screen = document.getElementById("login-screen");
  if (screen) {
    screen.classList.add("hidden");
  }
}

function toggleLoginPasswordVisibility() {
  const passInput = document.getElementById("login-input-password");
  const icon = document.getElementById("login-pass-icon");
  if (!passInput) return;
  if (passInput.type === "password") {
    passInput.type = "text";
    if (icon) icon.setAttribute("data-lucide", "eye-off");
  } else {
    passInput.type = "password";
    if (icon) icon.setAttribute("data-lucide", "eye");
  }
  if (window.lucide) lucide.createIcons();
}

function handleUserLogin(event) {
  event.preventDefault();
  const nameInput = document.getElementById("login-input-name")?.value.trim();
  const passInput = document.getElementById("login-input-password")?.value.trim();

  if (!nameInput || !passInput) {
    alert("Vui lòng nhập đầy đủ Họ và tên và Mật khẩu!");
    return;
  }

  // Find user by name (case-insensitive) or phone number
  const user = (state.users || []).find(u => 
    (u.name.toLowerCase() === nameInput.toLowerCase() || u.phone === nameInput) &&
    (u.password === passInput || u.phone === passInput)
  );

  if (!user) {
    alert("Họ và tên hoặc Mật khẩu không chính xác! Vui lòng kiểm tra lại hoặc liên hệ Quản trị viên.");
    return;
  }

  // Check device for first-time login
  const isMobile = window.innerWidth <= 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const needsFaceCapture = !user.faceRegistered || !user.avatar;

  if (needsFaceCapture) {
    if (!isMobile) {
      alert("⚠️ ĐĂNG NHẬP LẦN ĐẦU BẮT BUỘC BẰNG ĐIỆN THOẠI!\n\nTài khoản của bạn chưa hoàn tất chụp ảnh khuôn mặt nhận diện lần đầu. Quy định an toàn hệ thống yêu cầu bạn phải đăng nhập lần đầu bằng ĐIỆN THOẠI DI ĐỘNG để chụp ảnh khuôn mặt nhận diện.\n\nKhông cho phép đăng nhập lần đầu bằng máy tính!");
      return;
    }

    // On mobile: show live camera face capture screen
    pendingLoginUser = user;
    pendingCapturedFace = null;
    const nameEl = document.getElementById("login-face-user-name");
    if (nameEl) nameEl.textContent = user.name;
    document.getElementById("login-form-view")?.classList.add("hidden");
    document.getElementById("login-face-capture-view")?.classList.remove("hidden");
    const previewImg = document.getElementById("login-face-photo-preview");
    const placeholder = document.getElementById("login-face-placeholder");
    const finishBtn = document.getElementById("btn-finish-first-login");
    if (previewImg) previewImg.classList.add("hidden");
    if (placeholder) placeholder.classList.remove("hidden");
    if (finishBtn) finishBtn.disabled = true;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Already logged in before or already has face photo: Log in directly!
  state.currentUser = user;
  user.hasLoggedIn = true;
  user.lastLogin = formatDateTime(new Date());
  saveState();
  hideLoginScreen();
  renderApp();
  showToast(`Xin chào [${user.name}]! Đã đăng nhập thành công (${user.roleBadge || user.role}).`, "success");
}

function triggerLoginLiveCamera() {
  openLiveCamera((imgUrl) => {
    pendingCapturedFace = imgUrl;
    const previewImg = document.getElementById("login-face-photo-preview");
    const placeholder = document.getElementById("login-face-placeholder");
    const finishBtn = document.getElementById("btn-finish-first-login");
    if (previewImg) {
      previewImg.src = imgUrl;
      previewImg.classList.remove("hidden");
    }
    if (placeholder) placeholder.classList.add("hidden");
    if (finishBtn) finishBtn.disabled = false;
    showToast("Đã chụp ảnh khuôn mặt thành công! Bấm Xác Nhận để vào hệ thống.", "success");
  });
}

function finishFirstTimeLogin() {
  if (!pendingCapturedFace || !pendingLoginUser) return;
  pendingLoginUser.avatar = pendingCapturedFace;
  pendingLoginUser.faceRegistered = true;
  pendingLoginUser.hasLoggedIn = true;
  pendingLoginUser.lastLogin = formatDateTime(new Date());

  state.currentUser = pendingLoginUser;
  saveState();
  pendingLoginUser = null;
  pendingCapturedFace = null;
  hideLoginScreen();
  renderApp();
  showToast(`Chào mừng [${state.currentUser.name}]! Đã hoàn tất nhận diện khuôn mặt lần đầu.`, "success");
}

function cancelFirstTimeLogin() {
  pendingLoginUser = null;
  pendingCapturedFace = null;
  document.getElementById("login-face-capture-view")?.classList.add("hidden");
  document.getElementById("login-form-view")?.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function requestLogout() {
  const isAdmin = state.currentUser && (state.currentUser.isAdmin || state.currentUser.roleType === "ADMIN");
  if (isAdmin) {
    if (confirm("Xác nhận đăng xuất khỏi tài khoản Quản trị?")) {
      performDirectLogout();
    }
  } else {
    closeModal("modal-user-profile");
    openLockAdminModal();
  }
}

function openLockAdminModal() {
  const input = document.getElementById("admin-pass-input");
  if (input) input.value = "";
  const modal = document.getElementById("modal-admin-lock");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
  setTimeout(() => input?.focus(), 150);
}

function verifyAdminPassword() {
  const pass = document.getElementById("admin-pass-input")?.value?.trim();
  if (!pass) {
    alert("Vui lòng nhập mật khẩu Quản trị!");
    return;
  }
  const validAdmin = (state.users || []).find(u => (u.isAdmin || u.roleType === "ADMIN") && (u.password === pass || u.phone === pass));
  const isMasterPass = (pass === ADMIN_PASSWORD_DEFAULT || pass === "aba2026" || pass === "0905123456");

  if (validAdmin || isMasterPass) {
    closeModal("modal-admin-lock");
    performDirectLogout();
  } else {
    alert("Sai mật khẩu Quản trị viên! Vui lòng kiểm tra lại. (Mặc định: admin123 hoặc aba2026)");
  }
}

function performDirectLogout() {
  state.currentUser = null;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(null));

  // Close all open modals
  const modals = document.querySelectorAll(".modal-overlay, #modal-user-profile, #modal-admin-lock, #modal-admin-user-mgmt, #modal-document-detail");
  modals.forEach(m => m.classList.add("hidden"));

  showLoginScreen();
  showToast("Đã đăng xuất khỏi hệ thống thành công!", "info");
}

function openUserProfileModal() {
  if (!state.currentUser) {
    showLoginScreen();
    return;
  }
  const user = state.currentUser;

  const av = document.getElementById("profile-modal-avatar");
  const name = document.getElementById("profile-modal-name");
  const phone = document.getElementById("profile-modal-phone");
  const role = document.getElementById("profile-modal-role");
  const adminSec = document.getElementById("admin-mgmt-shortcut-section");

  if (av) av.src = user.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";
  if (name) name.textContent = user.name;
  if (phone) phone.textContent = user.phone || "Chưa có SĐT";
  if (role) {
    const rt = user.roleType || (user.isAdmin ? "ADMIN" : "STAFF");
    role.textContent = user.roleBadge || (rt === "KEEPER" ? "Thủ kho" : (rt === "ADMIN" ? "Quản trị" : "Thông thường"));
    role.className = `px-2 py-0.5 rounded text-[10px] font-bold ${rt === 'KEEPER' ? 'bg-amber-100 text-amber-800' : (rt === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-700')}`;
  }

  if (adminSec) {
    const isAdmin = user.isAdmin || user.roleType === "ADMIN";
    if (isAdmin) {
      adminSec.classList.remove("hidden");
    } else {
      adminSec.classList.add("hidden");
    }
  }

  const modal = document.getElementById("modal-user-profile");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function handleChangePassword(event) {
  event.preventDefault();
  if (!state.currentUser) return;

  const oldPass = document.getElementById("profile-old-pass")?.value.trim();
  const newPass = document.getElementById("profile-new-pass")?.value.trim();
  const confirmPass = document.getElementById("profile-confirm-pass")?.value.trim();

  if (oldPass !== state.currentUser.password && oldPass !== state.currentUser.phone) {
    alert("Mật khẩu cũ không chính xác!");
    return;
  }

  if (newPass.length < 4) {
    alert("Mật khẩu mới phải có ít nhất 4 ký tự!");
    return;
  }

  if (newPass !== confirmPass) {
    alert("Xác nhận mật khẩu mới không khớp!");
    return;
  }

  state.currentUser.password = newPass;
  const matchInList = (state.users || []).find(u => u.id === state.currentUser.id);
  if (matchInList) {
    matchInList.password = newPass;
  }

  saveState();
  syncToGoogleSheet("ADD_DOC", doc);
  event.target.reset();
  closeModal("modal-user-profile");
  showToast("Đã đổi mật khẩu thành công! Hãy ghi nhớ mật khẩu mới cho lần đăng nhập sau.", "success");
}

function openAdminUserMgmtModal() {
  if (!state.currentUser || (!state.currentUser.isAdmin && state.currentUser.roleType !== "ADMIN")) {
    alert("Chỉ Quản trị viên mới có quyền mở Bảng quản trị người dùng!");
    return;
  }

  // Đóng modal thông tin tài khoản trước khi mở bảng quản trị
  closeModal("modal-user-profile");

  renderAdminUserList();
  const modal = document.getElementById("modal-admin-user-mgmt");
  if (modal) modal.classList.remove("hidden");
  if (window.lucide) lucide.createIcons();
}

function renderAdminUserList() {
  const tbody = document.getElementById("admin-user-list-tbody");
  const mobileCards = document.getElementById("admin-user-mobile-cards");
  const countEl = document.getElementById("admin-users-count");
  if (!tbody && !mobileCards) return;

  const users = state.users || [];
  if (countEl) countEl.textContent = `${users.length} tài khoản`;

  // 1. Desktop Table
  if (tbody) {
    tbody.innerHTML = users.map(u => {
      const isCurrent = (u.id === state.currentUser?.id);
      const rt = u.roleType || (u.isAdmin ? "ADMIN" : "STAFF");

      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="py-2.5 px-3 text-center">
            <img src="${u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-8 h-8 rounded-full object-cover mx-auto border border-slate-200 shadow-2xs">
          </td>
          <td class="py-2.5 px-3">
            <div class="font-bold text-slate-800 text-xs">${escapeHtml(u.name)} ${isCurrent ? '<span class="text-[10px] text-sky-600 font-normal">(Bạn)</span>' : ''}</div>
            <div class="text-[10px] text-slate-400">Đăng nhập cuối: ${u.lastLogin || 'Chưa'}</div>
          </td>
          <td class="py-2.5 px-2 font-mono text-xs text-slate-600 font-semibold">${escapeHtml(u.phone)}</td>
          <td class="py-2.5 px-3">
            <select onchange="changeUserRoleAdmin('${u.id}', this.value)" class="p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-sky-500">
              <option value="STAFF" ${rt === 'STAFF' ? 'selected' : ''}>👤 Thông thường</option>
              <option value="KEEPER" ${rt === 'KEEPER' ? 'selected' : ''}>⭐ Thủ kho</option>
              <option value="ADMIN" ${rt === 'ADMIN' ? 'selected' : ''}>👑 Quản trị</option>
            </select>
          </td>
          <td class="py-2.5 px-3 bg-amber-50/50">
            <span class="px-2 py-1 bg-amber-100 border border-amber-300 rounded-md font-mono font-bold text-amber-900 text-xs tracking-wider inline-block">
              ${escapeHtml(u.password || u.phone)}
            </span>
          </td>
          <td class="py-2.5 px-2 text-center">
            ${isCurrent ? `
              <span class="text-slate-300 text-xs" title="Không thể xóa tài khoản hiện tại">-</span>
            ` : `
              <button type="button" onclick="deleteUserAdmin('${u.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition" title="Xóa tài khoản này">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            `}
          </td>
        </tr>
      `;
    }).join("");
  }

  // 2. Mobile Cards (Dạng thẻ để hiện đầy đủ thông tin mỗi tài khoản trên điện thoại)
  if (mobileCards) {
    mobileCards.innerHTML = users.map(u => {
      const isCurrent = (u.id === state.currentUser?.id);
      const rt = u.roleType || (u.isAdmin ? "ADMIN" : "STAFF");

      return `
        <div class="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
          <!-- Row 1: Avatar, Name, Phone & Delete button -->
          <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div class="flex items-center gap-2.5 min-w-0">
              <img src="${u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="w-10 h-10 rounded-full object-cover border-2 border-sky-400/40 shadow-xs shrink-0">
              <div class="min-w-0">
                <div class="font-bold text-slate-900 text-xs flex items-center gap-1">
                  <span>${escapeHtml(u.name)}</span>
                  ${isCurrent ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-100 text-sky-800 shrink-0">Bạn</span>' : ''}
                </div>
                <div class="text-[11px] font-mono text-slate-600 font-semibold mt-0.5">📞 ${escapeHtml(u.phone)}</div>
              </div>
            </div>
            <div>
              ${isCurrent ? `
                <span class="text-slate-300 text-xs italic px-2 py-1">Đang dùng</span>
              ` : `
                <button type="button" onclick="deleteUserAdmin('${u.id}')" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition shrink-0 cursor-pointer" title="Xóa tài khoản này">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              `}
            </div>
          </div>

          <!-- Row 2: Phân quyền & Mật khẩu -->
          <div class="grid grid-cols-2 gap-2 bg-slate-50/70 p-2 rounded-lg border border-slate-200/60">
            <div>
              <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phân quyền:</label>
              <select onchange="changeUserRoleAdmin('${u.id}', this.value)" class="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-sky-500">
                <option value="STAFF" ${rt === 'STAFF' ? 'selected' : ''}>👤 Thông thường</option>
                <option value="KEEPER" ${rt === 'KEEPER' ? 'selected' : ''}>⭐ Thủ kho</option>
                <option value="ADMIN" ${rt === 'ADMIN' ? 'selected' : ''}>👑 Quản trị</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-amber-800 uppercase mb-1">Mật khẩu:</label>
              <div class="px-2 py-1.5 bg-amber-100/80 border border-amber-300 rounded-lg font-mono font-bold text-amber-950 text-xs text-center truncate select-all" title="Mật khẩu tài khoản">
                ${escapeHtml(u.password || u.phone)}
              </div>
            </div>
          </div>

          <!-- Row 3: Ngày đăng nhập cuối -->
          <div class="text-[10px] text-slate-400 flex items-center justify-between pt-0.5">
            <span>🕒 Đăng nhập cuối:</span>
            <span class="font-medium text-slate-600">${u.lastLogin || 'Chưa đăng nhập'}</span>
          </div>
        </div>
      `;
    }).join("");
  }

  if (window.lucide) lucide.createIcons();
}

function handleAdminCreateUser(event) {
  event.preventDefault();
  const name = document.getElementById("new-user-fullname")?.value.trim();
  const phone = document.getElementById("new-user-phone")?.value.trim();
  const roleType = document.getElementById("new-user-role")?.value || "STAFF";

  if (!name || !phone) {
    alert("Vui lòng nhập đầy đủ Họ và tên và Số điện thoại!");
    return;
  }

  const existingPhone = (state.users || []).find(u => u.phone === phone);
  if (existingPhone) {
    alert(`Số điện thoại [${phone}] đã được sử dụng cho tài khoản [${existingPhone.name}]!`);
    return;
  }

  const newUser = {
    id: `U${Date.now().toString().slice(-4)}`,
    phone: phone,
    password: phone, // Default password = phone
    name: name,
    role: roleType === "KEEPER" ? "Thủ kho" : (roleType === "ADMIN" ? "Quản trị hệ thống" : "Nhân viên"),
    roleType: roleType,
    roleBadge: roleType === "KEEPER" ? "Thủ kho" : (roleType === "ADMIN" ? "Quản trị" : "Thông thường"),
    isAdmin: (roleType === "ADMIN"),
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
    faceRegistered: false,
    hasLoggedIn: false,
    lastLogin: "Chưa đăng nhập"
  };

  state.users.push(newUser);
  saveState();
  syncToGoogleSheet("ADD_DOC", doc);
  event.target.reset();
  renderAdminUserList();
  showToast(`Đã tạo tài khoản cho [${name}] thành công! Mật khẩu mặc định: ${phone}`, "success");
}

function changeUserRoleAdmin(userId, newRole) {
  const user = (state.users || []).find(u => u.id === userId);
  if (!user) return;

  user.roleType = newRole;
  user.roleBadge = (newRole === "KEEPER" ? "Thủ kho" : (newRole === "ADMIN" ? "Quản trị" : "Thông thường"));
  user.isAdmin = (newRole === "ADMIN");

  if (state.currentUser && state.currentUser.id === userId) {
    state.currentUser.roleType = user.roleType;
    state.currentUser.roleBadge = user.roleBadge;
    state.currentUser.isAdmin = user.isAdmin;
    renderUserInfo();
  }

  saveState();
  renderAdminUserList();
  showToast(`Đã cập nhật phân quyền [${user.roleBadge}] cho [${user.name}]!`, "info");
}

function deleteUserAdmin(userId) {
  if (state.currentUser && state.currentUser.id === userId) {
    alert("Không thể xóa tài khoản bạn đang đăng nhập!");
    return;
  }

  const user = (state.users || []).find(u => u.id === userId);
  if (!user) return;

  const ok = confirm(`Bạn có chắc chắn muốn xóa tài khoản của [${user.name}] (${user.phone}) không?`);
  if (!ok) return;

  state.users = state.users.filter(u => u.id !== userId);
  saveState();
  renderAdminUserList();
  showToast(`Đã xóa tài khoản [${user.name}] thành công!`, "info");
}

// =========================================================================
// WAREHOUSE FLOOR PLAN & MAP SYSTEM (SƠ ĐỒ BẢN ĐỒ KHO BÃI)
// =========================================================================
let mapViewer = {
  activeWhId: null,
  mode: 'split', // 'split' (half screen top) | 'full' (fullscreen)
  zoom: 1.0,
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0
};

function openWarehouseMap(whId) {
  const panel = document.getElementById("warehouse-map-panel");
  if (!panel) return;

  const targetWh = (whId && state.warehouses.find(w => w.id === whId)) || state.warehouses[0];
  mapViewer.activeWhId = targetWh ? targetWh.id : (state.warehouses[0] ? state.warehouses[0].id : null);
  mapViewer.mode = 'split'; // Default: nửa màn hình phía trên

  populateWarehouseMapSelect();
  resetWarehouseMapZoom();
  renderWarehouseMap();

  panel.className = "map-mode-split";
  document.body.classList.add("map-split-active");

  const textToggle = document.getElementById("text-toggle-map-size");
  if (textToggle) textToggle.textContent = "Toàn màn hình";

  initWarehouseMapPanZoomOnce();
  if (window.lucide) lucide.createIcons();
}

function closeWarehouseMap() {
  const panel = document.getElementById("warehouse-map-panel");
  if (!panel) return;
  panel.className = "hidden";
  document.body.classList.remove("map-split-active");
}

function toggleWarehouseMapSize() {
  const panel = document.getElementById("warehouse-map-panel");
  if (!panel) return;

  if (mapViewer.mode === 'split') {
    mapViewer.mode = 'full';
    panel.className = "map-mode-full";
    document.body.classList.remove("map-split-active");
    const text = document.getElementById("text-toggle-map-size");
    if (text) text.textContent = "Nửa màn hình";
  } else {
    mapViewer.mode = 'split';
    panel.className = "map-mode-split";
    document.body.classList.add("map-split-active");
    const text = document.getElementById("text-toggle-map-size");
    if (text) text.textContent = "Toàn màn hình";
  }
  if (window.lucide) lucide.createIcons();
}

function switchWarehouseMap(whId) {
  mapViewer.activeWhId = whId;
  resetWarehouseMapZoom();
  renderWarehouseMap();
}

function populateWarehouseMapSelect() {
  const sel = document.getElementById("warehouse-map-select");
  if (!sel) return;
  sel.innerHTML = state.warehouses.map(w => `
    <option value="${w.id}" ${w.id === mapViewer.activeWhId ? 'selected' : ''}>${w.name}</option>
  `).join("");
}

function renderWarehouseMap() {
  const wh = state.warehouses.find(w => w.id === mapViewer.activeWhId) || state.warehouses[0];
  if (!wh) return;

  const addrEl = document.getElementById("warehouse-map-address");
  if (addrEl) addrEl.textContent = `📍 ${wh.address || 'Hà Nội'} | Quản lý: ${wh.manager || 'N/A'}`;

  const stage = document.getElementById("warehouse-map-stage");
  if (!stage) return;

  if (wh.mapImage && wh.mapImage.length > 20) {
    stage.innerHTML = `
      <div class="relative inline-block rounded-xl overflow-hidden shadow-2xl border-2 border-sky-500/50 bg-slate-900">
        <img src="${wh.mapImage}" alt="Sơ đồ kho" class="max-w-none max-h-[82vh] object-contain pointer-events-none select-none">
        <div class="absolute top-2 left-2 bg-slate-900/90 text-white text-[10px] px-2.5 py-1 rounded-md font-bold shadow-md border border-slate-700">
          🗺️ Ảnh Sơ Đồ Thực Tế: ${wh.name}
        </div>
      </div>
    `;
  } else {
    stage.innerHTML = generateWarehouseSvgSchematic(wh);
  }

  updateWarehouseMapTransform();
}

function zoomWarehouseMap(delta) {
  mapViewer.zoom = Math.min(3.0, Math.max(0.4, Number((mapViewer.zoom + delta).toFixed(2))));
  updateWarehouseMapTransform();
}

function resetWarehouseMapZoom() {
  mapViewer.zoom = 1.0;
  mapViewer.panX = 0;
  mapViewer.panY = 0;
  updateWarehouseMapTransform();
}

function updateWarehouseMapTransform() {
  const stage = document.getElementById("warehouse-map-stage");
  const zoomText = document.getElementById("warehouse-map-zoom-level");
  if (stage) {
    stage.style.transform = `translate(${mapViewer.panX}px, ${mapViewer.panY}px) scale(${mapViewer.zoom})`;
  }
  if (zoomText) {
    zoomText.textContent = `${Math.round(mapViewer.zoom * 100)}%`;
  }
}

let mapPanZoomInitialized = false;
function initWarehouseMapPanZoomOnce() {
  if (mapPanZoomInitialized) return;
  mapPanZoomInitialized = true;

  const viewport = document.getElementById("warehouse-map-viewport");
  if (!viewport) return;

  // Mouse Drag to Pan
  viewport.addEventListener("mousedown", (e) => {
    // Only drag with left mouse button
    if (e.button !== 0) return;
    mapViewer.isDragging = true;
    mapViewer.dragStartX = e.clientX - mapViewer.panX;
    mapViewer.dragStartY = e.clientY - mapViewer.panY;
  });

  window.addEventListener("mousemove", (e) => {
    if (!mapViewer.isDragging) return;
    mapViewer.panX = e.clientX - mapViewer.dragStartX;
    mapViewer.panY = e.clientY - mapViewer.dragStartY;
    updateWarehouseMapTransform();
  });

  window.addEventListener("mouseup", () => {
    mapViewer.isDragging = false;
  });

  // Mouse Wheel Zoom
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    zoomWarehouseMap(delta);
  }, { passive: false });

  // Touch Pan & Drag on Mobile
  let lastTouchX = 0;
  let lastTouchY = 0;
  viewport.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      mapViewer.isDragging = true;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
    }
  }, { passive: true });

  viewport.addEventListener("touchmove", (e) => {
    if (mapViewer.isDragging && e.touches.length === 1) {
      const dx = e.touches[0].clientX - lastTouchX;
      const dy = e.touches[0].clientY - lastTouchY;
      lastTouchX = e.touches[0].clientX;
      lastTouchY = e.touches[0].clientY;
      mapViewer.panX += dx;
      mapViewer.panY += dy;
      updateWarehouseMapTransform();
    }
  }, { passive: true });

  viewport.addEventListener("touchend", () => {
    mapViewer.isDragging = false;
  });
}

function generateWarehouseSvgSchematic(wh) {
  return `
    <svg viewBox="0 0 1000 600" width="960" height="576" class="rounded-xl shadow-2xl bg-slate-900 border border-slate-700 select-none">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1"/>
        </pattern>
        <linearGradient id="rackGradA" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0369a1" />
        </linearGradient>
        <linearGradient id="rackGradB" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#d97706" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>
        <linearGradient id="rackGradC" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#059669" />
          <stop offset="100%" stop-color="#047857" />
        </linearGradient>
        <linearGradient id="rackGradD" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="100%" stop-color="#6d28d9" />
        </linearGradient>
      </defs>
      <rect width="1000" height="600" fill="url(#grid)" />

      <!-- Outer Wall Boundary -->
      <rect x="30" y="30" width="940" height="540" fill="#0b1329" stroke="#38bdf8" stroke-width="3" rx="12" />

      <!-- Warehouse Header / Title -->
      <rect x="50" y="45" width="460" height="45" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.5"/>
      <text x="70" y="73" fill="#38bdf8" font-size="15" font-weight="bold" font-family="system-ui, sans-serif">SƠ ĐỒ MẶT BẰNG KHO: ${wh.name.toUpperCase()}</text>
      <text x="530" y="73" fill="#94a3b8" font-size="12" font-family="system-ui, sans-serif">📍 ${wh.address || 'Hà Nội'} | Quản lý: ${wh.manager || 'N/A'}</text>

      <!-- GATE / CỬA XUẤT NHẬP HÀNG -->
      <rect x="400" y="525" width="200" height="45" rx="6" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
      <text x="500" y="552" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">🚪 CỔNG XUẤT / NHẬP HÀNG (GATE 1)</text>

      <!-- LỐI ĐI CHÍNH (MAIN AISLE) -->
      <rect x="470" y="110" width="60" height="410" fill="#1e293b" stroke="#475569" stroke-dasharray="6,4" stroke-width="1.5" rx="4"/>
      <text x="500" y="315" fill="#64748b" font-size="11" font-weight="bold" text-anchor="middle" transform="rotate(-90 500 315)" font-family="system-ui, sans-serif">LỐI ĐI XE NÂNG & DI CHUYỂN TRUNG TÂM</text>

      <!-- DÃY KỆ A (GIÁ A: ĐỒ BẠT & ĐỒ HƠI) -->
      <g>
        <rect x="70" y="110" width="160" height="180" rx="8" fill="url(#rackGradA)" stroke="#38bdf8" stroke-width="1.5" />
        <text x="150" y="135" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">DÃY KỆ A (GIÁ A)</text>
        <text x="150" y="153" fill="#bae6fd" font-size="10" text-anchor="middle" font-family="system-ui, sans-serif">Đồ Bạt PVC & Phao Bơm Hơi</text>
        
        <!-- Shelf Racks A1 -> A4 -->
        <rect x="85" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
        <text x="115" y="190" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá A1</text>
        <text x="115" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>

        <rect x="155" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
        <text x="185" y="190" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá A2</text>
        <text x="185" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>

        <rect x="85" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
        <text x="115" y="245" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá A3</text>
        <text x="115" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>

        <rect x="155" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#38bdf8" stroke-width="1"/>
        <text x="185" y="245" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá A4</text>
        <text x="185" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>
      </g>

      <!-- DÃY KỆ B (GIÁ B: KHUNG SẮT & CỌC TIÊU & DÂY THỪNG) -->
      <g>
        <rect x="270" y="110" width="160" height="180" rx="8" fill="url(#rackGradB)" stroke="#fbbf24" stroke-width="1.5" />
        <text x="350" y="135" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">DÃY KỆ B (GIÁ B)</text>
        <text x="350" y="153" fill="#fde68a" font-size="10" text-anchor="middle" font-family="system-ui, sans-serif">Khung Sắt, Cọc Tiêu, Dây Thừng</text>

        <!-- Shelf Racks B1 -> B4 -->
        <rect x="285" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/>
        <text x="315" y="190" fill="#fbbf24" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá B1</text>
        <text x="315" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>

        <rect x="355" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/>
        <text x="385" y="190" fill="#fbbf24" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá B2</text>
        <text x="385" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>

        <rect x="285" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/>
        <text x="315" y="245" fill="#fbbf24" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá B3</text>
        <text x="315" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>

        <rect x="355" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#fbbf24" stroke-width="1"/>
        <text x="385" y="245" fill="#fbbf24" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá B4</text>
        <text x="385" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-3</text>
      </g>

      <!-- DÃY KỆ C (GIÁ C: MÁY THỔI & DÂY ĐIỆN) -->
      <g>
        <rect x="570" y="110" width="160" height="180" rx="8" fill="url(#rackGradC)" stroke="#34d399" stroke-width="1.5" />
        <text x="650" y="135" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">DÃY KỆ C (GIÁ C)</text>
        <text x="650" y="153" fill="#a7f3d0" font-size="10" text-anchor="middle" font-family="system-ui, sans-serif">Máy Thổi Khí & Dây Nguồn</text>

        <!-- Shelf Racks C1 -> C4 -->
        <rect x="585" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#34d399" stroke-width="1"/>
        <text x="615" y="190" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá C1</text>
        <text x="615" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>

        <rect x="655" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#34d399" stroke-width="1"/>
        <text x="685" y="190" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá C2</text>
        <text x="685" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>

        <rect x="585" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#34d399" stroke-width="1"/>
        <text x="615" y="245" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá C3</text>
        <text x="615" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>

        <rect x="655" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#34d399" stroke-width="1"/>
        <text x="685" y="245" fill="#34d399" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá C4</text>
        <text x="685" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>
      </g>

      <!-- DÃY KỆ D (GIÁ D: PHỤ KIỆN & CỜ ĐỘI & ÁO PITCH) -->
      <g>
        <rect x="770" y="110" width="160" height="180" rx="8" fill="url(#rackGradD)" stroke="#a78bfa" stroke-width="1.5" />
        <text x="850" y="135" fill="#ffffff" font-size="14" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">DÃY KỆ D (GIÁ D)</text>
        <text x="850" y="153" fill="#ddd6fe" font-size="10" text-anchor="middle" font-family="system-ui, sans-serif">Phụ Kiện Nhỏ, Cờ Đội, Áo Pitch</text>

        <!-- Shelf Racks D1 -> D4 -->
        <rect x="785" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#a78bfa" stroke-width="1"/>
        <text x="815" y="190" fill="#a78bfa" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá D1</text>
        <text x="815" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>

        <rect x="855" y="165" width="60" height="45" rx="4" fill="#0f172a" stroke="#a78bfa" stroke-width="1"/>
        <text x="885" y="190" fill="#a78bfa" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá D2</text>
        <text x="885" y="202" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>

        <rect x="785" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#a78bfa" stroke-width="1"/>
        <text x="815" y="245" fill="#a78bfa" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá D3</text>
        <text x="815" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>

        <rect x="855" y="220" width="60" height="45" rx="4" fill="#0f172a" stroke="#a78bfa" stroke-width="1"/>
        <text x="885" y="245" fill="#a78bfa" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">Giá D4</text>
        <text x="885" y="257" fill="#94a3b8" font-size="9" text-anchor="middle" font-family="system-ui, sans-serif">Tầng 1-4</text>
      </g>

      <!-- KHU VỰC HẬU KIỂM & TẬP KẾT HOÀN TRẢ -->
      <g>
        <rect x="70" y="325" width="360" height="165" rx="8" fill="#1e293b" stroke="#eab308" stroke-dasharray="6,3" stroke-width="2"/>
        <rect x="85" y="340" width="330" height="30" rx="6" fill="#ca8a04"/>
        <text x="250" y="361" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">📦 KHU VỰC HẬU KIỂM & TIẾP NHẬN ĐỒ VỀ</text>
        <text x="250" y="398" fill="#fef08a" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">VỊ TRÍ: MẶT SÀN / KHU VỰC HẬU KIỂM</text>
        <text x="250" y="420" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui, sans-serif">Khu vực tiếp nhận hoàn trả sau tour, kiểm đếm & test đồ</text>
        <text x="250" y="445" fill="#38bdf8" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">➔ Sau khi kiểm tra đạt: Phân bổ về Giá A, B, C, D</text>
      </g>

      <!-- KHU VỰC BẢO DƯỠNG & SỬA CHỮA -->
      <g>
        <rect x="570" y="325" width="360" height="165" rx="8" fill="#1e293b" stroke="#ef4444" stroke-dasharray="6,3" stroke-width="2"/>
        <rect x="585" y="340" width="330" height="30" rx="6" fill="#dc2626"/>
        <text x="750" y="361" fill="#ffffff" font-size="13" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">🔧 KHU VỰC BÀN KỸ THUẬT & ĐỒ HỎNG CHỜ SỬA</text>
        <text x="750" y="398" fill="#fca5a5" font-size="12" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">VỊ TRÍ: BÀN KỸ THUẬT / GIÁ SỬA CHỮA</text>
        <text x="750" y="420" fill="#94a3b8" font-size="11" text-anchor="middle" font-family="system-ui, sans-serif">Bàn vá bạt nhiệt, đo áp lực van & bảo dưỡng máy thổi</text>
        <text x="750" y="445" fill="#f87171" font-size="11" font-weight="bold" text-anchor="middle" font-family="system-ui, sans-serif">⚠️ Cách ly đồ rách/hỏng tránh thất thoát, nhầm lẫn</text>
      </g>

      <!-- FOOTER NOTE / LEGEND -->
      <text x="50" y="585" fill="#64748b" font-size="11" font-family="system-ui, sans-serif">Quy chuẩn kho ABA: Giá/kệ đánh chữ A, B, C, D... Tầng/sàn đánh số 1, 2, 3, 4... | Kéo để di chuyển • Cuộn để phóng to</text>
    </svg>
  `;
}
