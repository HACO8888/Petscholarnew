/**
 * 北科遊戲化學業交流區 - 核心控制邏輯與資料結構展示 (script.js - Upgraded Tailwind Edition)
 */

// 全局應用程式狀態
const AppState = {
  user: { ...USER_DATA },
  pet: { ...PET_DATA },
  boards: JSON.parse(JSON.stringify(BOARDS_DATA)), // 深拷貝預設資料
  activeTab: "boards",
  activeDeptId: "all",
  activeFilterDeptName: "all",
  activePostId: null,
  editingPostId: null,
  activeVisTab: "code-tree",
  highlightedCommentId: null,
  
  // 附近讀書雷達狀態
  studyRooms: [
    { id: "room-1", subject: "微積分二期末衝刺班", time: "今天 15:00 - 18:00", location: "紅樓 2 樓討論室", limit: 4, joinedCount: 3, participants: ["電機二王學霸", "機械系老齒輪", "電機三學霸"], isUserJoined: false },
    { id: "room-2", subject: "Black-Scholes 期權研討會", time: "今天 19:00 - 21:00", location: "北科圖書中心 3F K書區", limit: 3, joinedCount: 2, participants: ["資財大三學姐", "期權分析小能手"], isUserJoined: false },
    { id: "room-3", subject: "演算法 LeetCode 刷題小組", time: "每週三晚上 19:30", location: "線上 Discord 語音頻道 4", limit: 6, joinedCount: 5, participants: ["資工三林大師", "程式小仙女", "寫Code不打草稿", "大一電機萌新", "小明"], isUserJoined: false }
  ],
  radarScanning: false,
  radarPins: [],

  // 自習室內部互動狀態
  activeStudyRoomId: null,
  studyGoals: [
    { id: "goal-1", text: "理解二階常微分方程求解步驟", completed: false },
    { id: "goal-2", text: "微積分第四章習題討論完成", completed: true },
    { id: "goal-3", text: "整理 BST 旋轉操作觀念圖解", completed: false }
  ],
  studyChat: [
    { author: "電機二王學霸", text: "大家有第 3 題的公式詳解嗎？", time: "15:42" },
    { author: "機械系老齒輪", text: "有啊，我剛算出來，特解係數 A 應該是 1/2", time: "15:43" }
  ],
  pomoTimer: null,
  pomoTimeLeft: 25 * 60, // 25 minutes
  pomoRunning: false,

  // 福利社兌換品
  welfareCoupons: JSON.parse(JSON.stringify(WELFARE_ITEMS)),
  leaderboardType: "weekly", // weekly, dept

  // Canvas 畫布標記狀態
  canvasCtx: null,
  drawingMode: false,
  canvasTool: "pen", // pen, eraser
  lastX: 0,
  lastY: 0,
  attachedDrawingUrl: null, // 解答附加的畫布圖片
  currentAskTemplate: "math", // 發問圖片範本
  askUploadedImageUrl: null,
  askCanvasCtx: null,
  askDrawingMode: false,
  askCanvasTool: "pen",
  askDoodleBaseUrl: null,
  askDoodleHasContent: false,
  askLastX: 0,
  askLastY: 0,

  // 檢舉與日誌
  reports: [],
  adminLogs: [],
  blockedUsers: [],
  deletedQuestionArchive: [],
  onlineUsers: [],
  professorTags: [],

  // 簡報導覽狀態
  tourActive: false,
  tourStep: 1,
  tourTimer: null,
  discussionFilterBoardId: "all",
  adminActivePanel: "overview"
};

// 載入與保存 localStorage 狀態
function loadSavedState() {
  try {
    const savedUser = localStorage.getItem("studypet_user");
    const savedPet = localStorage.getItem("studypet_pet");
    const savedBoards = localStorage.getItem("studypet_boards");
    const savedAdminState = localStorage.getItem("studypet_admin_state");
    
    if (savedUser) {
      AppState.user = JSON.parse(savedUser);
      if (!AppState.user.gender) AppState.user.gender = "female";
    } else {
      localStorage.setItem("studypet_user", JSON.stringify(USER_DATA));
      AppState.user = { ...USER_DATA };
    }
    
    if (savedPet) {
      AppState.pet = JSON.parse(savedPet);
      // Auto migration for pet 500 HP scale
      if (AppState.pet.hp === 100 || !AppState.pet.hp || (AppState.pet.hp <= 100 && !AppState.pet.maxHp)) {
        AppState.pet.hp = 500;
        AppState.pet.maxHp = 500;
        AppState.pet.baseHp = 500;
        AppState.pet.lastActivityTime = Date.now();
        saveState();
      }
      if (!AppState.pet.maxHp) AppState.pet.maxHp = 500;
      if (!AppState.pet.baseHp) AppState.pet.baseHp = AppState.pet.hp;
      if (!AppState.pet.lastActivityTime) AppState.pet.lastActivityTime = Date.now();
    } else {
      localStorage.setItem("studypet_pet", JSON.stringify(PET_DATA));
      AppState.pet = { ...PET_DATA };
      AppState.pet.lastActivityTime = Date.now();
      saveState();
    }
    
    if (savedBoards) {
      const parsedBoards = JSON.parse(savedBoards);
      // 驗證是否包含新版學院看板鍵值 (如 ceecs)
      if (parsedBoards && parsedBoards.ceecs) {
        AppState.boards = parsedBoards;
      } else {
        // 如果是舊版資料，清除快取以使用 boardsData.js 中的最新 6 學院資料
        localStorage.removeItem("studypet_boards");
      }
    }

    if (savedAdminState) {
      const adminState = JSON.parse(savedAdminState);
      AppState.blockedUsers = Array.isArray(adminState.blockedUsers) ? adminState.blockedUsers : [];
      AppState.adminLogs = Array.isArray(adminState.adminLogs) ? adminState.adminLogs : [];
      AppState.deletedQuestionArchive = Array.isArray(adminState.deletedQuestionArchive) ? adminState.deletedQuestionArchive : [];
      AppState.adminActivePanel = adminState.adminActivePanel || AppState.adminActivePanel || "overview";
    }
  } catch (e) {
    console.error("Failed to load saved state:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem("studypet_user", JSON.stringify(AppState.user));
    localStorage.setItem("studypet_pet", JSON.stringify(AppState.pet));
    localStorage.setItem("studypet_boards", JSON.stringify(AppState.boards));
    localStorage.setItem("studypet_admin_state", JSON.stringify({ blockedUsers: AppState.blockedUsers || [], adminLogs: AppState.adminLogs || [], deletedQuestionArchive: AppState.deletedQuestionArchive || [] }));
  } catch (e) {
    console.error("Failed to save state:", e);
  }
}


// 同步所有頁面中出現的金幣餘額顯示

// 同步主頁與外部 Stitch 分頁的愛心 / 金幣顯示
function updatePetStatDisplays() {
  const pet = AppState.pet || {};
  const maxHp = Number(pet.maxHp || 500);
  const hp = Math.max(0, Math.min(maxHp, Number(pet.hp || 0)));
  const hearts = Math.max(0, Math.min(5, Math.ceil(hp / 100)));
  const coins = Math.max(0, Math.floor(Number(pet.coins || 0)));
  pet.maxHp = maxHp;
  pet.hp = hp;
  pet.hearts = hearts;
  pet.coins = coins;

  document.querySelectorAll('#pet-coins, #ask-user-coins, .global-coin-display, [data-coin-balance]').forEach(el => {
    el.textContent = coins;
  });
  document.querySelectorAll('#pet-hp-text, [data-pet-hp]').forEach(el => {
    el.textContent = `${hp}/${maxHp}`;
  });
  document.querySelectorAll('#pet-hp-bar, [data-pet-hp-bar]').forEach(el => {
    el.style.width = `${(hp / maxHp) * 100}%`;
  });
  const heartsText = Array.from({ length: 5 }, (_, i) => i < hearts ? '❤️' : '🖤').join('');
  document.querySelectorAll('#pet-hearts-display, .hearts-glow, .global-heart-display, [data-heart-count]').forEach(el => {
    el.textContent = el.matches && el.matches('.global-heart-display, [data-heart-count]') ? hearts : heartsText;
  });
  if (window.syncPetScholarPetStats) window.syncPetScholarPetStats();
}

function updateCoinDisplays() {
  if (typeof updatePetStatDisplays === "function") updatePetStatDisplays();
  const coins = Number(AppState.pet && AppState.pet.coins) || 0;

  document.querySelectorAll(".global-coin-display, [data-coin-balance]").forEach(el => {
    el.textContent = coins;
  });

  // 同步常見格式：金幣: 120、餘額: 120 枚金幣、Coins: 120
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while ((node = walker.nextNode())) {
    const text = node.nodeValue;
    if (/金幣\s*[:：]\s*\d+/.test(text)) {
      node.nodeValue = text.replace(/(金幣\s*[:：]\s*)\d+/, `$1${coins}`);
    } else if (/餘額\s*[:：]\s*\d+\s*枚?金幣/.test(text)) {
      node.nodeValue = text.replace(/(餘額\s*[:：]\s*)\d+(\s*枚?金幣)/, `$1${coins}$2`);
    } else if (/Coins\s*[:：]\s*\d+/i.test(text)) {
      node.nodeValue = text.replace(/(Coins\s*[:：]\s*)\d+/i, `$1${coins}`);
    }
  }

  // 同步個人檔案或統計卡片中的「總金幣」欄位
  document.querySelectorAll(".bg-surface.rounded-lg.p-md, .bg-surface-container-lowest, .bg-surface-container-high").forEach(card => {
    const label = card.querySelector(".text-secondary, .font-label-md, .text-on-surface-variant");
    if (label && /總金幣|Coins|目前金幣/.test(label.textContent)) {
      const value = card.querySelector(".text-on-surface, .text-primary, .font-bold");
      if (value && /^\d+$/.test(value.textContent.trim())) value.textContent = coins;
    }
  });
}

function persistPetAndRefreshCoins() {
  saveState();
  updateCoinDisplays();
}

function syncCustomPostStorage(post, boardId) {
  try {
    const customPosts = JSON.parse(localStorage.getItem("studypet_custom_posts") || "[]");
    const boardName = AppState.boards[boardId] ? AppState.boards[boardId].name : (post.boardName || "學術看板");
    const normalized = {
      id: post.id,
      boardId,
      title: post.title,
      authorName: post.author || AppState.user.username,
      boardName,
      deptName: post.department || "未指定科系",
      content: post.content,
      bounty: post.bounty,
      timestamp: post.timestamp,
      solved: !!post.solved,
      image: post.image || post.attachedImage || null
    };
    const existingIndex = customPosts.findIndex(p => p.id === normalized.id);
    if (existingIndex >= 0) customPosts[existingIndex] = normalized;
    else customPosts.unshift(normalized);
    localStorage.setItem("studypet_custom_posts", JSON.stringify(customPosts));
  } catch (e) {
    console.warn("Failed to sync custom post storage:", e);
  }
}

// 專案初始化
window.addEventListener("DOMContentLoaded", () => {
  initApp();
  initPaintCanvasListeners();
  initAskDoodleCanvasListeners();
});

function initApp() {
  loadSavedState();
  // 初始化檢舉與日誌
  AppState.reports = [...MOCK_REPORTS];
  if (!Array.isArray(AppState.adminLogs)) AppState.adminLogs = [];
  if (!Array.isArray(AppState.blockedUsers)) AppState.blockedUsers = [];
  if (!AppState.adminActivePanel) AppState.adminActivePanel = "overview";
  if (!Array.isArray(AppState.deletedQuestionArchive)) AppState.deletedQuestionArchive = [];
  AppState.onlineUsers = buildMockOnlineUsers();
  AppState.professorTags = ["微積分", "常微分方程", "Black-Scholes", "資料結構", "BST樹", "卡諾循環"];

  // Run decay check immediately
  checkHourlyPetHpDecay();

  renderUserAndPet();
  updateCoinDisplays();
  renderDeptSelector();
  renderPostsList();
  renderDiscussionPosts();
  renderQuickFeedShop();
  renderShop();
  renderInventory();
  updateVisualizerJSON();
  renderHotTags();
  initAskTagsListener();
  
  // 設定定時器，讓寵物隨機眨眼或說話
  setInterval(randomPetAction, 12000);
  
  // Set up decay checking timer (every 30 seconds)
  setInterval(checkHourlyPetHpDecay, 30000);
  
  // 初始化雷達與福利社
  renderStudyRooms();
  renderWelfareSection();
  
  // 同步初始化角色視圖
  switchRole(AppState.user.role || "student");
  
  // 預設切換至 boards 看板
  switchMainTab("boards");
}

function initAskTagsListener() {
  const tagsInput = document.getElementById("ask-tags");
  if (!tagsInput) return;
  
  tagsInput.addEventListener("input", () => {
    const value = tagsInput.value;
    const TAG_BOARD_MAPPING = {
      "熱力": "cmee", "卡諾": "cmee", "熱效率": "cmee", "機械": "cmee", "車輛": "cmee", "冷凍": "cmee", "空調": "cmee",
      "微積分": "ceecs", "常微分": "ceecs", "特徵": "ceecs", "齊次": "ceecs", "特解": "ceecs", "必修": "ceecs", "電路": "ceecs", "三相": "ceecs", "戴維寧": "ceecs", "等效": "ceecs", "二元": "ceecs", "搜尋樹": "ceecs", "二叉": "ceecs", "BST": "ceecs", "AVL": "ceecs", "樹": "ceecs", "電機": "ceecs", "電子": "ceecs", "資工": "ceecs", "光電": "ceecs", "演算法": "ceecs",
      "材料力學": "coe", "剪力": "coe", "彎矩": "coe", "懸臂": "coe", "結構": "coe", "土木": "coe", "化工": "coe", "生技": "coe", "分子": "coe", "材料": "coe", "資源": "coe",
      "期權": "com", "衍商": "com", "衍生性": "com", "BS": "com", "Black": "com", "Scholes": "com", "資財": "com", "工管": "com", "經管": "com",
      "UI": "cod", "UX": "cod", "介面": "cod", "黃金比例": "cod", "人體工學": "cod", "互動": "cod", "設計": "cod", "建築": "cod",
      "英文": "chss", "寫作": "chss", "被動語態": "chss", "論文": "chss", "文法": "chss", "文化": "chss", "應英": "chss"
    };

    const parsedTags = value.split(",").map(t => t.trim()).filter(t => t.length > 0);
    let mappedBoardId = null;
    for (const tag of parsedTags) {
      for (const key in TAG_BOARD_MAPPING) {
        if (tag.includes(key) || key.includes(tag)) {
          mappedBoardId = TAG_BOARD_MAPPING[key];
          break;
        }
      }
      if (mappedBoardId) break;
    }

    if (mappedBoardId) {
      const boardSelect = document.getElementById("ask-board");
      if (boardSelect && boardSelect.value !== mappedBoardId) {
        boardSelect.value = mappedBoardId;
        // Trigger select update events
        handleAskBoardChange();
        syncAskTemplate();
        
        // Show floating pet response to guide user
        const boardName = AppState.boards[mappedBoardId].name;
        setPetStatus("happy", `💡 已自動幫您切換至【${boardName}】！`);
      }
    }
  });
}

// 渲染熱門標籤
function renderHotTags() {
  const container = document.getElementById("hot-tags-list");
  if (!container) return;
  
  let html = "";
  AppState.professorTags.forEach(tag => {
    html += `
      <span class="bg-primary-container/40 text-on-primary-container font-semibold text-xs px-3.5 py-1.5 rounded-full shadow-sm cursor-pointer hover:bg-primary-container transition-all" onclick="setSearchQuery('${tag}')">
        # ${tag}
      </span>
    `;
  });
  container.innerHTML = html;
}

function setSearchQuery(tag) {
  setPetStatus("happy", `🔍 正在搜尋標籤「# ${tag}」的相關問題...`);
  // 模擬過濾
  const container = document.getElementById("posts-list-container");
  if (!container) return;
  
  let allPosts = [];
  for (const key in AppState.boards) {
    allPosts = allPosts.concat(AppState.boards[key].posts);
  }
  
  const filtered = allPosts.filter(p => p.tags.includes(tag) || p.title.includes(tag));
  
  const boardTitle = document.getElementById("board-title");
  const boardCount = document.getElementById("board-count");
  boardTitle.innerText = `篩選標籤: #${tag}`;
  boardCount.innerText = `${filtered.length} 篇貼文`;
  
  if (filtered.length === 0) {
    container.innerHTML = `<div class="bg-surface-container-low p-md rounded-xl text-center text-xs text-secondary">沒有找到符合 #${tag} 的文章</div>`;
    return;
  }
  
  renderFilteredPosts(filtered);
}

function renderFilteredPosts(posts) {
  const container = document.getElementById("posts-list-container");
  let html = "";
  posts.forEach(post => {
    let deptInfo = { name: "未知", color: "#666" };
    for (const key in AppState.boards) {
      if (AppState.boards[key].posts.some(p => p.id === post.id)) {
        deptInfo = { name: AppState.boards[key].name, color: AppState.boards[key].color };
        break;
      }
    }
    const statusText = post.solved ? "已解決" : "未解決";
    const statusClass = post.solved ? "text-green-600 font-bold" : "text-yellow-600 font-bold";
    html += `
      <div class="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-xl p-md shadow-sm hover:shadow-md transition-all cursor-pointer" onclick="showPostDetail('${post.id}')">
        <div class="flex justify-between items-start mb-sm gap-2">
          <h3 class="font-bold text-body-lg text-primary dark:text-primary-fixed-dim">${post.title}</h3>
          <span class="text-xs font-bold text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded">🪙 懸賞 ${post.bounty}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-secondary mb-2">
          <span class="bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.2 rounded text-[10px]">${deptInfo.name.substring(0, 3)}</span>
          <span>提問學生: <strong>${post.author}</strong></span>
          <span>•</span>
          <span>${post.timestamp}</span>
          <span>•</span>
          <span class="${statusClass}">${statusText}</span>
        </div>
        <div class="flex flex-wrap gap-sm">
          ${post.tags.map(t => `<span class="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded">#${t}</span>`).join("")}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ==========================================================================
// 1. UI 渲染核心 (Render Engine)
// ==========================================================================

// 渲染使用者與寵物狀態
function renderUserAndPet() {
  document.getElementById("user-name").innerText = AppState.user.username;
  
  const roleNames = { student: "學生", ta: "課程助教", professor: "課程教授", admin: "系統管理員" };
  const roleLabel = roleNames[AppState.user.role] || "學生";
  document.getElementById("user-dept").innerText = `${AppState.user.department} • 身分: ${roleLabel}`;
  
  // Sync user avatar based on gender setting or custom uploaded image
  const avatarContainer = document.getElementById("user-avatar-container");
  if (avatarContainer) {
    const maleAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuHaUoUmD0NCQT0xkjGAhDfZcg0aBzllN0eFaNJtLBJf8cc_LGkd5eJLBbe92XyjZcFmqtTtPMy4nmqui7orI5FCwxtzZipXn7IT-ADqLhM-YTMnLuhwW5IkvAQb9VJ8EQNXDa-NeT0hvQnvHccj3YXgjW3PbfLOycAjzkdgDJWR7eHCVwig2L_UZfEHNjKWxKHhiTtGZPC5nhE25w7fJW4k4D14gGtDhExwWSmAB903j0EwwVPcfvR4EdG5X-hEsi442t72MF0CECQ";
    const femaleAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuD6nYakPwha1xLE6ySgmmA3ALzCOIWvd5yKYtNc6I559vHmzcy6tuMKiyMt_XVU9C_i2EE6LXL3kR7esJW5Vpg8sdOkC99wKCsBwwj-CV7gOl85EXPmZozLCJMLTjfCgo1E6AQrurCE2oitnwoxspLZLgSj20zFdeIiRstXmq7pUoQT_fSqQiKZGslhXyPRUYFNP29JUCFo5YTkvdhoZJRshYhOdgiFeOqTl5IYb-_t46ECQsIlHcmedAhJ2jr9xN-EwM-PC-MeQ0SO";
    const avatarSrc = AppState.user.avatarDataUrl || (AppState.user.gender === "male" ? maleAvatar : femaleAvatar);
    avatarContainer.innerHTML = `<img class="w-full h-full object-cover rounded-full" src="${avatarSrc}" alt="User avatar" />`;
  }

  document.getElementById("pet-name").innerText = AppState.pet.name;
  document.getElementById("pet-level").innerText = `Lv.${AppState.pet.level}`;
  
  // 更新 HP 與愛心 (每顆愛心是 100 生命值，共 500 生命值)
  const hpText = document.getElementById("pet-hp-text");
  const hpBar = document.getElementById("pet-hp-bar");
  hpText.innerText = `${AppState.pet.hp}/500`;
  hpBar.style.width = `${(AppState.pet.hp / 500) * 100}%`;
  
  // 根據 HP 換算愛心數量 (每 100 HP 為 1 顆愛心，最大 5 顆)
  const heartsCount = Math.min(5, Math.ceil(AppState.pet.hp / 100));
  AppState.pet.hearts = heartsCount;
  
  // 顯示愛心符號
  const heartsDisplay = document.getElementById("pet-hearts-display");
  let heartsHtml = "";
  for (let i = 1; i <= 5; i++) {
    if (i <= heartsCount) {
      heartsHtml += "❤️";
    } else {
      heartsHtml += "🖤";
    }
  }
  heartsDisplay.innerHTML = heartsHtml;
  
  // 根據 HP 調節顏色與寵物狀態
  if (AppState.pet.hp <= 175) { // 低於 35% (即 175 HP) 為疲憊狀態
    hpBar.style.background = "linear-gradient(90deg, #ef4444, #f87171)";
    if (AppState.pet.status !== "eating" && AppState.pet.status !== "happy") {
      AppState.pet.status = "tired";
    }
  } else {
    hpBar.style.background = "linear-gradient(90deg, #10b981, #34d399)";
  }

  // 更新 EXP
  const expText = document.getElementById("pet-exp-text");
  const expBar = document.getElementById("pet-exp-bar");
  expText.innerText = `${AppState.pet.exp}/${AppState.pet.maxExp}`;
  expBar.style.width = `${AppState.pet.exp}%`;

  // 更新金幣
  document.getElementById("pet-coins").innerText = AppState.pet.coins;
  if (typeof updatePetStatDisplays === "function") updatePetStatDisplays();
  
  // 套用豪華房間背景
  const petCard = document.getElementById("pet-widget-card");
  if (petCard) {
    if (AppState.pet.equipped && AppState.pet.equipped.background) {
      petCard.classList.add("luxury-room-equipped");
    } else {
      petCard.classList.remove("luxury-room-equipped");
    }
  }

  // 渲染動態 Mascot SVG
  updatePetMascotSvg();
  
  // 簽到按鈕狀態
  const checkinBtn = document.getElementById("checkin-btn");
  if (AppState.pet.hasCheckedIn) {
    checkinBtn.disabled = true;
    checkinBtn.innerHTML = "已簽到";
    checkinBtn.style.opacity = "0.5";
  } else {
    checkinBtn.disabled = false;
    checkinBtn.innerHTML = "每日簽到 (+5)";
    checkinBtn.style.opacity = "1";
  }
  
  // 更新科系專屬色調 (CSS Variable)
  let accentColor = "#4b6172"; // 預設 slate 藍
  if (AppState.activeDeptId !== "all" && AppState.boards[AppState.activeDeptId]) {
    accentColor = AppState.boards[AppState.activeDeptId].color;
  }
  document.documentElement.style.setProperty('--theme-accent', accentColor);
  
  updateCoinDisplays();
  saveState();
}

// 根據寵物角色與狀態動態生成 SVG
function updatePetMascotSvg() {
  const content = getMascotSvgContent(AppState.pet.mascotType, AppState.pet.status);
  
  const bodyGroup = document.getElementById("pet-body-group");
  if (bodyGroup) {
    bodyGroup.innerHTML = content;
  }
  
  const centerBodyGroup = document.getElementById("pet-body-group-center");
  if (centerBodyGroup) {
    centerBodyGroup.innerHTML = content;
  }
}

// 還原預設表情
function restoreDefaultFace() {
  AppState.pet.status = AppState.pet.hp <= 35 ? "tired" : "normal";
  updatePetMascotSvg();
}

// 變更寵物狀態與對話泡泡
function setPetStatus(status, speechMessage, duration = 4000) {
  AppState.pet.status = status;
  updatePetMascotSvg();
  
  const bubble = document.getElementById("pet-bubble");
  const speechText = document.getElementById("pet-speech-text");
  
  speechText.innerText = speechMessage;
  bubble.style.display = "block";
  bubble.style.animation = "none";
  bubble.offsetHeight; // 觸發 reflow
  bubble.style.animation = "speech-fade 0.4s ease";
  
  // 定時清除泡泡並還原表情
  if (AppState.petTimer) clearTimeout(AppState.petTimer);
  AppState.petTimer = setTimeout(() => {
    bubble.style.display = "none";
    restoreDefaultFace();
  }, duration);
}

// 隨機寵物自發行為
function randomPetAction() {
  if (AppState.pet.status === "eating" || AppState.pet.status === "happy" || AppState.tourActive) return;
  
  const speechPool = {
    normal: [
      "今天想學習什麼？去電機系看看吧！",
      "解答別人的課業難題可以賺取金幣與經驗喔！",
      "點擊『自習室』看附近有哪些共讀夥伴！",
      "收集徽章，可以去福利社兌換大薯喔！🍟",
      "換個電子雞角色吧！點擊『個人檔案』即可切換外觀！"
    ],
    tired: [
      "呼...好累喔，快給我吃點歐趴便當...🍱",
      "活力值太低了，我快要睡著了...💤",
      "肚子空空的，簽到或解答問題賺點金幣吧！",
      "快去養成商店買點好吃的，不然我要挨餓了..."
    ]
  };
  
  const currentPool = AppState.pet.hp <= 35 ? speechPool.tired : speechPool.normal;
  const randomMsg = currentPool[Math.floor(Math.random() * currentPool.length)];
  
  // 眨眼/眨眼表情切換
  AppState.pet.status = "happy";
  updatePetMascotSvg();
  setTimeout(() => {
    restoreDefaultFace();
  }, 1000);
  
  setPetStatus(AppState.pet.status, randomMsg, 5000);
}

// 觸發餵食中心 Mascot 點擊跳躍
function triggerMascotJump() {
  const centerSvg = document.getElementById("pet-svg-center");
  if (centerSvg) {
    centerSvg.style.transform = 'translateY(-15px) scale(1.05)';
    centerSvg.style.transition = 'transform 0.15s ease-out';
    
    setTimeout(() => {
      centerSvg.style.transform = 'translateY(0) scale(1)';
      centerSvg.style.transition = 'transform 0.2s ease-in';
    }, 150);
  }
  setPetStatus("happy", "咿呀！謝謝你的點擊！我們一起加油讀書吧！📖");
}

// 渲染科系看板選擇鈕 (Tailwind Chips Grid)
function renderDeptSelector() {
  const grid = document.getElementById("dept-grid");
  if (!grid) return;
  
  let html = "";
  
  // Generate cards for the boards
  for (const key in AppState.boards) {
    const board = AppState.boards[key];
    const isActive = AppState.activeDeptId === board.id;
    
    // Color styling using inline style to dynamically apply board.color
    let borderStyle = "border-outline-variant/30";
    let bgStyle = "bg-surface-container-lowest dark:bg-surface-container-high";
    let glowStyle = "";
    let customStyle = "";
    
    if (isActive) {
      customStyle = `border-color: ${board.color}; background-color: ${board.color}15; box-shadow: 0 10px 15px -3px ${board.color}25; border-width: 2px;`;
    } else {
      borderStyle += " hover:border-primary/40";
    }
    
    html += `
      <div class="rounded-xl border ${borderStyle} ${bgStyle} ${glowStyle} p-md flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isActive ? 'scale-95 font-bold' : 'hover:scale-[1.02]'}" 
           style="${customStyle}" 
           onclick="selectDept('${board.id}')" 
           id="dept-card-${board.id}">
        <span class="text-3xl mb-2">${board.icon}</span>
        <h4 class="font-bold text-body-lg text-on-surface mb-1">${board.name}</h4>
      </div>
    `;
  }
  
  grid.innerHTML = html;
}

// 選擇科系看板
function selectDept(deptId) {
  // If clicking already active, toggle it to "all"
  if (AppState.activeDeptId === deptId) {
    AppState.activeDeptId = "all";
  } else {
    AppState.activeDeptId = deptId;
  }
  AppState.activePostId = null; // 切換看板時回到列表
  AppState.activeFilterDeptName = "all"; // Reset department filter chip
  
  switchMainTab("boards");
  renderDeptSelector();
  renderPostsList();
  renderUserAndPet(); // 為了更新色調
  
  // 簡導航引導步驟 1 跳往步驟 2
  if (AppState.tourActive && AppState.tourStep === 1 && deptId === "ceecs") {
    nextGuidedStep();
  }
}

// 渲染文章列表
function renderPostsList() {
  const container = document.getElementById("posts-list-container");
  const boardTitle = document.getElementById("board-title");
  const boardCount = document.getElementById("board-count");
  const filterChipsContainer = document.getElementById("dept-filter-chips-container");
  if (!container) return;
  
  let allPosts = [];
  
  if (AppState.activeDeptId === "all") {
    boardTitle.innerText = "所有熱門提問";
    for (const key in AppState.boards) {
      allPosts = allPosts.concat(AppState.boards[key].posts);
    }
    if (filterChipsContainer) {
      filterChipsContainer.style.display = "none";
    }
  } else {
    const board = AppState.boards[AppState.activeDeptId];
    boardTitle.innerText = `${board.name}提問`;
    allPosts = board.posts;
    
    // Render filter chips
    if (filterChipsContainer) {
      filterChipsContainer.style.display = "flex";
      renderDeptFilterChips(board);
    }
    
    // Filter posts by department chip
    if (AppState.activeFilterDeptName && AppState.activeFilterDeptName !== "all") {
      allPosts = allPosts.filter(post => post.department === AppState.activeFilterDeptName);
    }
  }
  
  boardCount.innerText = `${allPosts.length} 篇貼文`;
  
  if (allPosts.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/30 rounded-xl text-center text-secondary py-10 text-xs">
        目前尚無課業提問。歡迎發表新問題！
      </div>
    `;
    return;
  }
  
  let html = "";
  allPosts.forEach((post) => {
    let deptInfo = { name: "未知", color: "#666", id: "" };
    for (const key in AppState.boards) {
      const board = AppState.boards[key];
      const found = board.posts.find(p => p.id === post.id);
      if (found) {
        deptInfo = { name: board.name, color: board.color, id: board.id };
        break;
      }
    }
    
    const statusText = post.solved ? "已解決" : "未解決";
    const statusClass = post.solved ? "text-green-600 font-bold" : "text-yellow-600 font-bold";
    const bountyText = post.solved ? "已結算" : `懸賞 ${post.bounty}`;
    
    html += `
      <div class="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-xl p-md shadow-sm hover:shadow-md transition-all cursor-pointer relative ${AppState.tourActive && AppState.tourStep === 2 && post.id === 'ee-post-1' ? 'tour-highlight' : ''}" id="post-card-${post.id}" onclick="showPostDetail('${post.id}')">
        <div class="flex justify-between items-start mb-sm gap-2">
          <h3 class="font-bold text-body-lg text-primary dark:text-primary-fixed-dim">${post.title}</h3>
          <span class="text-xs font-bold text-yellow-600 bg-yellow-500/10 px-2 py-0.5 rounded" style="${post.solved ? 'background:rgba(0,0,0,0.05); color:#666;' : ''}">🪙 ${bountyText}</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-secondary mb-2">
          <span class="bg-primary/5 text-primary border border-primary/10 px-1.5 py-0.2 rounded text-[10px]">${post.department || deptInfo.name}</span>
          <span>提問學生: <strong>${post.author}</strong></span>
          <span>•</span>
          <span>${post.timestamp}</span>
          <span>•</span>
          <span class="${statusClass}">${statusText}</span>
        </div>
        <div class="flex flex-wrap gap-sm">
          ${post.tags.map(t => `<span class="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded">#${t}</span>`).join("")}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

function renderDiscussionPosts() {
  const container = document.getElementById("discussion-posts-list");
  if (!container) return;

  // Gather all posts, including user-published posts
  let userPosts = [];
  
  if (AppState.discussionFilterBoardId === "all") {
    for (const key in AppState.boards) {
      const boardPosts = AppState.boards[key].posts;
      userPosts = userPosts.concat(boardPosts);
    }
  } else {
    const board = AppState.boards[AppState.discussionFilterBoardId];
    if (board) {
      userPosts = board.posts;
    }
  }

  // Sort user posts by date or ID (newest first)
  userPosts.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));

  // 套用解答狀態篩選 (全部、未解答、已解決)
  if (!AppState.discussionFilterStatus) AppState.discussionFilterStatus = "all";
  if (AppState.discussionFilterStatus === "solved") {
    userPosts = userPosts.filter(p => p.solved);
  } else if (AppState.discussionFilterStatus === "unsolved") {
    userPosts = userPosts.filter(p => !p.solved);
  }

  // 同步學院篩選按鈕狀態
  const colleges = ["all", "cmee", "ceecs", "coe", "com", "cod", "chss"];
  colleges.forEach(c => {
    const btn = document.getElementById(`disc-filter-${c}`);
    if (btn) {
      if (AppState.discussionFilterBoardId === c) {
        btn.className = "px-3 py-1 rounded-full text-xs font-semibold bg-primary text-on-primary shadow-sm hover:opacity-90 transition-all";
      } else {
        btn.className = "px-3 py-1 rounded-full text-xs font-semibold bg-surface-container text-secondary border border-outline-variant/20 hover:bg-surface-container-highest transition-all";
      }
    }
  });

  // 同步狀態篩選按鈕樣式 (全部、未解答、已解決)
  const statuses = ["all", "unsolved", "solved"];
  statuses.forEach(s => {
    const btn = document.getElementById(`disc-status-${s}`);
    if (btn) {
      if (AppState.discussionFilterStatus === s) {
        btn.className = "px-3.5 py-1.5 rounded-full bg-primary text-on-primary shadow-sm font-semibold text-xs transition-all";
      } else {
        btn.className = "px-3.5 py-1.5 rounded-full bg-surface-container-low text-secondary border border-outline-variant/30 font-semibold text-xs hover:bg-surface-container transition-all";
      }
    }
  });

  if (userPosts.length === 0) {
    const boardName = AppState.discussionFilterBoardId === "all" ? "學術討論區" : AppState.boards[AppState.discussionFilterBoardId].name;
    container.innerHTML = `
      <div id="discussion-empty-placeholder" class="flex flex-col items-center justify-center py-xl px-md bg-surface-container-lowest dark:bg-surface-container-high border border-dashed border-outline-variant/60 rounded-xl text-center p-8 shadow-sm">
        <span class="material-symbols-outlined text-[64px] text-outline mb-md" style="font-size:64px; color:#73777c;">forum</span>
        <h3 class="font-headline-md text-headline-md text-primary mb-sm">目前還沒有任何使用者輸入</h3>
        <p class="font-body-md text-body-md text-secondary max-w-md">
            【${boardName}】目前還沒有使用者輸入問題，點擊右上方「發問與發帖」按鈕，即可開始發布您的第一篇學業交流問題！
        </p>
      </div>
    `;
    return;
  }

  let html = "";
  userPosts.forEach(post => {
    const replyCount = post.replies ? post.replies.length : 0;
    const bountyText = post.solved ? "已結算" : `${post.bounty} 金幣`;
    const solvedBadge = post.solved ? `<span class="bg-primary/10 text-primary px-1.5 py-0.2 rounded text-[9px] font-bold">已解決</span>` : "";
    
    // 尋找學院名稱以做標記
    let boardInfo = { name: "未知" };
    for (const key in AppState.boards) {
      if (AppState.boards[key].posts.some(p => p.id === post.id)) {
        boardInfo = AppState.boards[key];
        break;
      }
    }

    html += `
      <article class="bg-surface-container-lowest dark:bg-surface-container-high border border-outline-variant/20 rounded-xl p-md shadow-sm hover:shadow-md transition-all cursor-pointer flex gap-4" onclick="showPostDetail('${post.id}')">
        <div class="flex flex-col items-center justify-center w-14 bg-surface-container-low rounded-lg p-2 text-center text-secondary">
          <span class="text-sm font-bold text-primary dark:text-primary-fixed-dim">${replyCount}</span>
          <span class="text-[9px]">回覆</span>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-1 text-xs text-secondary mb-1">
            <span class="font-bold text-on-surface-variant">${post.author}</span>
            <span>•</span>
            <span>${post.timestamp}</span>
            ${solvedBadge}
          </div>
          <h3 class="font-bold text-body-lg text-primary dark:text-primary-fixed-dim group-hover:text-surface-tint mb-1">${post.title}</h3>
          <p class="text-on-surface-variant text-xs line-clamp-2 mb-2">${post.content}</p>
          <div class="flex gap-1.5">
            <span class="px-2 py-0.5 bg-primary/5 text-primary border border-primary/10 text-[10px] rounded font-bold">${boardInfo.name}</span>
            ${post.tags.map(t => `<span class="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded">#${t}</span>`).join("")}
            <span class="px-2 py-0.5 bg-tertiary-container text-on-tertiary-container text-[10px] font-bold rounded">🪙 ${bountyText}</span>
          </div>
        </div>
      </article>
    `;
  });

  container.innerHTML = html;
}

// 討論板依學院篩選
function filterDiscussionByBoard(boardId) {
  AppState.discussionFilterBoardId = boardId;
  renderDiscussionPosts();
}

function renderDeptFilterChips(board) {
  const filterChipsContainer = document.getElementById("dept-filter-chips-container");
  if (!filterChipsContainer) return;
  
  let html = "";
  
  // Chip for "all"
  const isAllActive = AppState.activeFilterDeptName === "all";
  html += `
    <button onclick="filterDeptPosts('all')" class="px-3 py-1 rounded-full text-xs font-semibold border transition-all ${isAllActive ? 'bg-primary text-on-primary border-primary shadow' : 'bg-surface-container border-outline-variant/30 text-secondary hover:border-primary/40'}">
      全部科系
    </button>
  `;
  
  board.departments.forEach(dept => {
    const isActive = AppState.activeFilterDeptName === dept;
    html += `
      <button onclick="filterDeptPosts('${dept}')" class="px-3 py-1 rounded-full text-xs font-semibold border transition-all ${isActive ? 'bg-primary text-on-primary border-primary shadow' : 'bg-surface-container border-outline-variant/30 text-secondary hover:border-primary/40'}">
        ${dept}
      </button>
    `;
  });
  
  filterChipsContainer.innerHTML = html;
}

function filterDeptPosts(deptName) {
  AppState.activeFilterDeptName = deptName;
  renderPostsList();
}

// 切換主分頁
function returnToHomeDemo() {
  if (AppState.tourActive) stopGuidedTour();
  AppState.activeDeptId = "all";
  AppState.activeFilterDeptName = "all";
  AppState.activePostId = null;
  AppState.discussionFilterBoardId = "all";
  switchMainTab("boards");
  renderDeptSelector();
  renderPostsList();
  try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch (e) { window.scrollTo(0, 0); }
}

function switchMainTab(tabName) {
  if (tabName === "admin" && AppState.user.role !== "admin") {
    AppState.activeTab = "boards";
    setPetStatus("tired", "🔒 系統管理員後台僅限 Admin 身分查看，請先切換身分。");
    tabName = "boards";
  }
  AppState.activeTab = tabName;
  
  // 隱藏所有 tab sections (Tailwind 使用 hidden)
  document.querySelectorAll(".tab-section").forEach(s => {
    s.classList.remove("active");
    s.classList.add("hidden");
  });
  
  // 還原所有 tab-link 的樣式
  document.querySelectorAll(".tab-link").forEach(l => {
    l.classList.remove("active", "text-primary", "font-bold", "border-primary");
    l.classList.add("text-secondary", "border-transparent");
  });
  
  // 啟用對應的 tab-link 樣式
  const activeLink = document.getElementById("top-tab-" + tabName);
  if (activeLink) {
    activeLink.classList.add("active", "text-primary", "font-bold", "border-primary");
    activeLink.classList.remove("text-secondary", "border-transparent");
  }
  
  if (tabName === "boards") {
    if (AppState.activePostId) {
      const detailSect = document.getElementById("sect-post-detail");
      if (detailSect) {
        detailSect.classList.remove("hidden");
        detailSect.classList.add("active");
      }
    } else {
      const boardsSect = document.getElementById("sect-boards");
      if (boardsSect) {
        boardsSect.classList.remove("hidden");
        boardsSect.classList.add("active");
      }
    }
  } else if (tabName === "shop") {
    const shopSect = document.getElementById("sect-shop");
    if (shopSect) {
      shopSect.classList.remove("hidden");
      shopSect.classList.add("active");
    }
    renderShop();
    renderInventory();
    // Guided tour highlight for shop item
    if (AppState.tourActive && AppState.tourStep === 5) {
      setTimeout(() => {
        const card = document.getElementById("shop-item-item-chicken");
        if (card) card.classList.add("tour-highlight");
      }, 200);
    }
  } else if (tabName === "radar") {
    const radarSect = document.getElementById("sect-radar");
    if (radarSect) {
      radarSect.classList.remove("hidden");
      radarSect.classList.add("active");
    }
    renderStudyRooms();
    if (AppState.radarPins.length === 0 && !AppState.radarScanning) {
      startRadarScan();
    }
  } else if (tabName === "study-detail") {
    const studyDetailSect = document.getElementById("sect-study-detail");
    if (studyDetailSect) {
      studyDetailSect.classList.remove("hidden");
      studyDetailSect.classList.add("active");
    }
    renderStudyRoomDetail();
  } else if (tabName === "discussion") {
    const discussionSect = document.getElementById("sect-discussion");
    if (discussionSect) {
      discussionSect.classList.remove("hidden");
      discussionSect.classList.add("active");
    }
    renderDiscussionPosts();
  } else if (tabName === "feeding") {
    const feedingSect = document.getElementById("sect-feeding");
    if (feedingSect) {
      feedingSect.classList.remove("hidden");
      feedingSect.classList.add("active");
    }
    renderFeedingTab();
    // Guided tour highlight for feed item
    if (AppState.tourActive && AppState.tourStep === 6) {
      setTimeout(() => {
        const feedBtn = document.querySelector("#sect-feeding button[onclick*='item-chicken']");
        if (feedBtn) feedBtn.classList.add("tour-highlight");
      }, 200);
    }
  } else if (tabName === "welfare") {
    const welfareSect = document.getElementById("sect-welfare");
    if (welfareSect) {
      welfareSect.classList.remove("hidden");
      welfareSect.classList.add("active");
    }
    renderWelfareSection();
  } else if (tabName === "profile") {
    const profileSect = document.getElementById("sect-profile");
    if (profileSect) {
      profileSect.classList.remove("hidden");
      profileSect.classList.add("active");
    }
    // 同步個人檔案欄位
    const profileName = document.getElementById("profile-name");
    const profileDept = document.getElementById("profile-dept");
    const profileRole = document.getElementById("profile-role");
    if (profileName) profileName.value = AppState.user.username;
    if (profileDept) profileDept.value = AppState.user.department;
    if (profileRole) profileRole.value = AppState.user.role;
    const profileGender = document.getElementById("profile-gender");
    if (profileGender) profileGender.value = AppState.user.gender || "female";
    updateAvatarPreview();
    selectMascotInModal(AppState.pet.mascotType);
    renderProfileQuestionHistory();
  } else if (tabName === "professor") {
    const profSect = document.getElementById("sect-professor");
    if (profSect) {
      profSect.classList.remove("hidden");
      profSect.classList.add("active");
    }
    renderProfessorSection();
  } else if (tabName === "admin") {
    const adminSect = document.getElementById("sect-admin");
    if (adminSect) {
      adminSect.classList.remove("hidden");
      adminSect.classList.add("active");
    }
    renderAdminSection();
  } else if (tabName === "visualizer") {
    const visSect = document.getElementById("sect-visualizer");
    if (visSect) {
      visSect.classList.remove("hidden");
      visSect.classList.add("active");
    }
    drawCommentTreeSvg();
    updateVisualizerJSON();
  }
}

// ==========================================================================
// 2. 每日簽到功能 (Daily Check-in)
// ==========================================================================

function triggerDailyCheckIn() {
  if (AppState.pet.hasCheckedIn) return;
  
  AppState.pet.hasCheckedIn = true;
  AppState.pet.coins += 5;
  
  // 播放金幣粒子與懸浮字
  const btn = document.getElementById("checkin-btn");
  const rect = btn.getBoundingClientRect();
  triggerCoinParticles(rect.left + rect.width / 2, rect.top + rect.height / 2);
  showFloatingText(rect.left + rect.width / 2, rect.top - 10, "🪙 金幣 +5", "var(--color-gold)");
  
  // 更新頭像與愛心
  renderUserAndPet();
  
  // 寵物反應
  setPetStatus("happy", "🎉 簽到成功！我們獲得了 5 枚金幣獎勵！多虧了你的勤奮！");
}

// ==========================================================================
// 3. 文章詳情與嵌套留言樹渲染 (DFS Tree Processing)
// ==========================================================================

function findPostRecordById(postId) {
  for (const key in AppState.boards) {
    const board = AppState.boards[key];
    const index = board.posts.findIndex(p => p.id === postId);
    if (index !== -1) {
      return { post: board.posts[index], board, boardId: key, index };
    }
  }
  return null;
}

function setAskModalMode(mode) {
  const title = document.getElementById("ask-modal-title");
  const submitBtn = document.getElementById("ask-submit-btn");
  const bountyInput = document.getElementById("ask-bounty");

  if (mode === "edit") {
    if (title) title.innerHTML = `<span>✏️</span> 編輯已發佈問題`;
    if (submitBtn) submitBtn.innerText = "儲存修改";
    if (bountyInput) bountyInput.disabled = false;
  } else {
    if (title) title.innerHTML = `<span>📝</span> 發佈課業新提問`;
    if (submitBtn) submitBtn.innerText = "發佈 (+5 金幣)";
    if (bountyInput) bountyInput.disabled = false;
  }
}

function showAskModalShell() {
  const modal = document.getElementById("ask-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.offsetHeight; // reflow
  modal.classList.remove("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-95");
  modal.querySelector(".transform").classList.add("scale-100");
}

function getTemplateTypeFromPostImage(imageName) {
  if (!imageName) return "math";
  if (imageName.includes("circuit") || imageName.includes("thermo")) return "circuit";
  if (imageName.includes("options")) return "options";
  if (imageName.includes("bst")) return "bst";
  return "math";
}

// 點擊文章進入詳情
function showPostDetail(postId) {
  AppState.activePostId = postId;
  
  // 尋找文章物件
  let foundPost = null;
  let foundDept = null;
  for (const key in AppState.boards) {
    const post = AppState.boards[key].posts.find(p => p.id === postId);
    if (post) {
      foundPost = post;
      foundDept = AppState.boards[key];
      break;
    }
  }
  
  if (!foundPost) return;
  
  // 隱藏列表，顯示詳情
  const boardsSect = document.getElementById("sect-boards");
  const discussionSect = document.getElementById("sect-discussion");
  if (boardsSect) boardsSect.classList.add("hidden");
  if (discussionSect) discussionSect.classList.add("hidden");
  document.getElementById("sect-post-detail").classList.remove("hidden");
  document.getElementById("sect-post-detail").classList.add("active");
  
  document.getElementById("detail-title").innerText = foundPost.title;
  document.getElementById("detail-bounty").innerText = foundPost.bounty;
  document.getElementById("detail-author").innerText = foundPost.author;
  document.getElementById("detail-time").innerText = foundPost.timestamp;
  document.getElementById("detail-content").innerHTML = foundPost.content;
  
  const statusEl = document.getElementById("detail-status");
  statusEl.innerText = foundPost.solved ? "已解決" : "未解決";
  if (foundPost.solved) {
    statusEl.className = "text-xs font-bold px-2.5 py-0.5 rounded bg-green-100 text-green-700 ml-auto";
  } else {
    statusEl.className = "text-xs font-bold px-2.5 py-0.5 rounded bg-yellow-100 text-yellow-700 ml-auto";
  }
  
  // 採納按鈕控制
  const addAnswerBtn = document.getElementById("btn-add-answer");
  if (foundPost.solved) {
    addAnswerBtn.style.display = "none";
  } else {
    addAnswerBtn.style.display = "flex";
  }

  // 編輯與刪除按鈕控制：Demo 中讓使用者新增的文章可以修改/刪除
  const canManagePost = foundPost.id.startsWith("post-") || foundPost.author === AppState.user.username;

  const editBtn = document.getElementById("btn-edit-post");
  if (editBtn) {
    editBtn.style.display = canManagePost ? "flex" : "none";
  }

  const deleteBtn = document.getElementById("btn-delete-post");
  if (deleteBtn) {
    deleteBtn.style.display = canManagePost ? "flex" : "none";
  }
  
  const deptEl = document.getElementById("detail-dept");
  deptEl.innerText = foundDept.name;
  
  document.getElementById("detail-tags-container").innerHTML = foundPost.tags.map(t => `<span class="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] rounded">#${t}</span>`).join("");
  
  // 處理考題附圖
  const imageWrapper = document.getElementById("detail-image-wrapper");
  if (foundPost.image) {
    imageWrapper.style.display = "block";
    // 繪製對應圖片範本
    drawHomeworkTemplate("detail-image-canvas", foundPost.image);
    
    // 如果已解決，隱藏紅筆標註按鈕
    const annotateBtn = document.getElementById("btn-draw-annotation");
    if (foundPost.solved) {
      annotateBtn.style.display = "none";
    } else {
      annotateBtn.style.display = "block";
    }
  } else {
    imageWrapper.style.display = "none";
  }
  
  // 渲染樹狀留言
  renderCommentTree(foundPost);
  
  // 簡導航引導步驟 2 跳往步驟 3
  if (AppState.tourActive && AppState.tourStep === 2 && postId === "ee-post-1") {
    nextGuidedStep();
  }
}

// 繪製模擬考題畫布範本
function drawHomeworkTemplate(canvasId, imageType, drawingLayerUrl = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  if (typeof imageType === "string" && imageType.startsWith("data:image")) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (canvas.width - w) / 2;
      const y = (canvas.height - h) / 2;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, x, y, w, h);
      if (drawingLayerUrl) {
        const layer = new Image();
        layer.onload = () => ctx.drawImage(layer, 0, 0, canvas.width, canvas.height);
        layer.src = drawingLayerUrl;
      }
    };
    img.src = imageType;
    return;
  }
  
  // 1. 繪製精緻背景 (深色背板)
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  // 畫網格
  for (let x = 0; x < canvas.width; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  
  // 2. 根據考題類型寫入題目文字與手繪風格內容
  ctx.font = "bold 15px 'Inter', sans-serif";
  ctx.fillStyle = "#94a3b8";
  
  if (imageType === "mock_math_hw") {
    ctx.fillText("📝 課堂筆記與小考考題：常微分方程式", 55, 30);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "italic bold 20px 'Courier New'";
    ctx.fillText("y'' - 3y' + 2y = e^(3x) + x^2", 55, 75);
    
    ctx.font = "13px sans-serif";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText("解題思路提示：", 55, 120);
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("1. 求特徵方程式 r^2 - 3r + 2 = 0 得到齊次解 y_h", 55, 145);
    ctx.fillText("2. 對於右側非齊次項 f(x) = e^(3x) + x^2", 55, 170);
    ctx.fillText("   分開假設特解 y_p1 = A * e^(3x) 與 y_p2 = B*x^2 + C*x + D", 55, 195);
    
  } else if (imageType === "mock_circuit_hw") {
    ctx.fillText("🔌 電路分析 HW 2: 戴維寧等效電路", 55, 30);
    ctx.fillStyle = "#38bdf8";
    ctx.fillText("求 A-B 兩端的等效阻抗 Z_th 與開路電壓 V_th", 55, 55);
    
    // 畫戴維寧電路示意圖
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(100, 150, 15, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(100, 135); ctx.lineTo(100, 110); ctx.lineTo(140, 110);
    ctx.lineTo(145, 105); ctx.lineTo(150, 115); ctx.lineTo(155, 105);
    ctx.lineTo(160, 115); ctx.lineTo(165, 105); ctx.lineTo(170, 110);
    ctx.lineTo(220, 110);
    ctx.arc(220, 110, 3, 0, Math.PI*2);
    ctx.fillText("A", 225, 105);
    
    ctx.moveTo(100, 165); ctx.lineTo(100, 190); ctx.lineTo(220, 190);
    ctx.arc(220, 190, 3, 0, Math.PI*2);
    ctx.fillText("B", 225, 195);
    ctx.stroke();
    
  } else if (imageType === "mock_options_hw") {
    ctx.fillText("📊 衍生性金融商品: Black-Scholes Formula", 55, 30);
    ctx.fillStyle = "#bf55ec";
    ctx.fillText("Call Option Value: C = S*N(d1) - K*e^(-rT)*N(d2)", 55, 55);
    
  } else if (imageType === "mock_bst_hw") {
    ctx.fillText("🌳 資料結構: 二元搜尋樹 (BST) 退化極端情況", 55, 30);
    ctx.fillStyle = "#2ecc71";
    ctx.fillText("依序輸入 1, 2, 3, 4 時，BST 如何退化？", 55, 55);
  }
  
  // 3. 如果有寫入標註圖解數據，在此繪製疊加
  if (drawingLayerUrl) {
    const img = new Image();
    img.src = drawingLayerUrl;
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
    };
  }
}

// 返回列表
function backToBoards() {
  AppState.activePostId = null;
  document.getElementById("sect-post-detail").classList.add("hidden");
  
  if (AppState.activeTab === "discussion") {
    document.getElementById("sect-discussion").classList.remove("hidden");
    document.getElementById("sect-discussion").classList.add("active");
    renderDiscussionPosts();
  } else {
    document.getElementById("sect-boards").classList.remove("hidden");
    document.getElementById("sect-boards").classList.add("active");
    renderPostsList();
  }
}

// 刪除目前所選的文章
function deleteActivePost() {
  const postId = AppState.activePostId;
  if (!postId) return;
  
  // 尋找此文章以確認存在並獲得資訊
  let foundPost = null;
  let foundBoardId = null;
  for (const key in AppState.boards) {
    const post = AppState.boards[key].posts.find(p => p.id === postId);
    if (post) {
      foundPost = post;
      foundBoardId = key;
      break;
    }
  }
  
  if (!foundPost) {
    alert("找不到該文章！");
    return;
  }
  
  // 權限檢查
  if (!foundPost.id.startsWith("post-") && foundPost.author !== AppState.user.username) {
    alert("您無權刪除此文章！");
    return;
  }
  
  // 金幣餘額檢查
  if (AppState.pet.coins < 10) {
    alert("您的金幣不足 10 枚，無法刪除貼文喔！");
    return;
  }
  
  // 確認對話框
  if (!confirm("確定要刪除此貼文嗎？\n（此操作將會扣除 10 金幣）")) {
    return;
  }
  
  // 扣除 10 金幣
  AppState.pet.coins -= 10;
  
  // 從資料中移除
  const board = AppState.boards[foundBoardId];
  if (board) {
    const idx = board.posts.findIndex(p => p.id === postId);
    if (idx !== -1) {
      board.posts.splice(idx, 1);
    }
  }
  
  // 存檔
  saveState();
  
  // Re-render
  renderUserAndPet();
  updateCoinDisplays();
  renderDeptSelector();
  renderPostsList();
  renderDiscussionPosts();
  
  // 寵物狀態與對話
  setPetStatus("sad", "🗑️ 貼文已成功刪除，扣除了 10 枚金幣。");
  
  // 回到列表頁
  backToBoards();
}

// 遞迴渲染留言樹 (Depth-First Search)
function renderCommentTree(post) {
  const container = document.getElementById("comment-tree-container");
  if (!container) return;
  
  if (!post.replies || post.replies.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-container-low p-md rounded-xl text-center text-secondary text-xs">
        目前尚無回答。點擊上方「我來解答」發表你的看法！
      </div>
    `;
    return;
  }
  
  function buildTreeHtml(node, depth = 0) {
    const isAdoptedClass = node.isAdopted ? "adopted" : "";
    const isTaVerifiedClass = node.isTaVerified ? "ta-verified" : "";
    const isSolved = post.solved;
    
    let adoptActionHtml = "";
    if (!isSolved && !node.isAdopted) {
      adoptActionHtml = `
        <button class="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-0.5 shadow-sm transition-all ml-md" onclick="adoptAnswer('${node.id}', event)">
          <span>🎯</span> 採納解答
        </button>
      `;
    } else if (node.isAdopted) {
      if (node.isTaVerified) {
        adoptActionHtml = `
          <span class="text-xs font-bold text-pink-600 bg-pink-500/10 px-2.5 py-1 rounded-lg ml-md flex items-center gap-0.5 border border-pink-500/20">
            <span>⭐</span> 助教認證正解
          </span>
        `;
      } else {
        adoptActionHtml = `
          <span class="text-xs font-bold text-purple-600 bg-purple-500/10 px-2.5 py-1 rounded-lg ml-md flex items-center gap-0.5 border border-purple-500/20">
            <span>🏆</span> 最佳解答
          </span>
        `;
      }
    }
    
    let taVerifyActionHtml = "";
    if (AppState.user.role === "ta" && !isSolved && !node.isAdopted) {
      taVerifyActionHtml = `
        <button class="bg-pink-500 hover:bg-pink-600 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-0.5 shadow-sm transition-all ml-sm" onclick="pinTAAnswer('${node.id}', event)">
          <span>⭐</span> 標記正解 (+50)
        </button>
      `;
    }

    let reportActionHtml = `
      <button class="text-xs font-semibold text-error hover:underline flex items-center gap-0.5 ml-auto" onclick="triggerReportComment('${node.id}', event)" title="檢舉此回覆">
        <span>🚩</span> 檢舉
      </button>
    `;
    
    let replyActionHtml = `
      <button class="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5" onclick="openReplyModal('${node.id}', event)">
        <span>💬</span> 回覆
      </button>
    `;
    
    // 如果附帶了手寫紅筆圖解，渲染附圖
    let attachedImgHtml = "";
    if (node.attachedImage) {
      attachedImgHtml = `
        <div class="mt-2 p-sm bg-red-500/5 border border-red-500/20 rounded-lg">
          <p class="text-[10px] font-bold text-red-600 mb-1">🖍️ 手寫紅筆圖解：</p>
          <img src="${node.attachedImage}" class="max-w-full max-h-[220px] rounded-lg shadow border border-outline-variant/30" />
        </div>
      `;
    }
    
    const highlightAttr = `id="comment-card-${node.id}" onclick="highlightCommentNode('${node.id}', event)"`;
    
    let html = `
      <div class="comment-node-wrapper w-full ${depth > 0 ? 'mt-2' : 'mt-4'}" ${highlightAttr}>
        <div class="comment-node-self border border-outline-variant/20 bg-surface-container-low dark:bg-surface rounded-xl p-md shadow-sm transition-all ${isAdoptedClass} ${isTaVerifiedClass} ${AppState.highlightedCommentId === node.id ? 'tour-highlight' : ''}">
          <div class="flex items-center justify-between text-xs text-secondary mb-1">
            <div class="flex items-center gap-1.5 font-bold text-on-surface">
              <span>👤</span>
              <span>${node.author}</span>
              ${depth > 0 ? `<span class="text-[10px] text-secondary font-medium">(回覆)</span>` : ''}
            </div>
            <span>${node.timestamp}</span>
          </div>
          <div class="text-on-surface-variant text-sm leading-relaxed mb-sm">${node.content}</div>
          ${attachedImgHtml}
          <div class="flex items-center gap-md pt-2 border-t border-outline-variant/10 mt-sm">
            ${replyActionHtml}
            ${adoptActionHtml}
            ${taVerifyActionHtml}
            ${reportActionHtml}
          </div>
        </div>
    `;
    
    if (node.replies && node.replies.length > 0) {
      html += `<div class="comment-children-container">`;
      node.replies.forEach(child => {
        html += buildTreeHtml(child, depth + 1);
      });
      html += `</div>`;
    }
    
    html += `</div>`;
    return html;
  }
  
  let finalHtml = "";
  post.replies.forEach(rootReply => {
    finalHtml += buildTreeHtml(rootReply, 0);
  });
  
  container.innerHTML = finalHtml;
}

// 助教標記正解
function pinTAAnswer(commentId, event) {
  if (event) event.stopPropagation();
  
  // 遞迴尋找留言並加上 ta 認證
  let foundComment = null;
  function searchNode(node) {
    if (node.id === commentId) {
      foundComment = node;
      return true;
    }
    if (node.replies) {
      for (let child of node.replies) {
        if (searchNode(child)) return true;
      }
    }
    return false;
  }
  
  let currentPost = null;
  for (const key in AppState.boards) {
    for (let post of AppState.boards[key].posts) {
      if (post.id === AppState.activePostId) {
        currentPost = post;
        post.replies.forEach(searchNode);
        break;
      }
    }
  }
  
  if (!foundComment) return;
  
  foundComment.isTaVerified = true;
  foundComment.isAdopted = true; // 認證即採納
  if (currentPost) currentPost.solved = true;
  
  // 助教發放獎金與經驗
  AppState.pet.coins += 50;
  AppState.pet.exp += 30;
  let levelUpMsg = "";
  if (AppState.pet.exp >= AppState.pet.maxExp) {
    AppState.pet.level++;
    AppState.pet.exp -= AppState.pet.maxExp;
    levelUpMsg = `，電子雞升到了 Lv.${AppState.pet.level}！`;
  }
  
  // 記錄日誌
  AppState.adminLogs.unshift({
    action: "TA 認證正解",
    desc: `助教認證了留言「${foundComment.author}：${foundComment.content.substring(0, 15)}...」`,
    timestamp: new Date().toLocaleTimeString()
  });
  
  renderUserAndPet();
  showPostDetail(AppState.activePostId);
  
  // 特效與反應
  triggerCoinParticles(event.clientX, event.clientY);
  showFloatingText(event.clientX, event.clientY - 15, "🪙 金幣 +50", "var(--color-gold)");
  setPetStatus("happy", `⭐ 太棒了！助教認證了正確答案，我們獲得了 50 金幣與經驗值獎勵${levelUpMsg}！`);
}

// 採納解答
function adoptAnswer(commentId, event) {
  if (event) event.stopPropagation();
  
  let foundComment = null;
  function searchNode(node) {
    if (node.id === commentId) {
      foundComment = node;
      return true;
    }
    if (node.replies) {
      for (let child of node.replies) {
        if (searchNode(child)) return true;
      }
    }
    return false;
  }
  
  let currentPost = null;
  for (const key in AppState.boards) {
    for (let post of AppState.boards[key].posts) {
      if (post.id === AppState.activePostId) {
        currentPost = post;
        post.replies.forEach(searchNode);
        break;
      }
    }
  }
  
  if (!foundComment) return;
  
  foundComment.isAdopted = true;
  if (currentPost) currentPost.solved = true;
  
  // 懸賞金額加上去
  const bountyAmount = currentPost ? currentPost.bounty : 30;
  AppState.pet.coins += bountyAmount;
  AppState.pet.exp += 20;
  let levelUpMsg = "";
  if (AppState.pet.exp >= AppState.pet.maxExp) {
    AppState.pet.level++;
    AppState.pet.exp -= AppState.pet.maxExp;
    levelUpMsg = ` 並且升到了 Lv.${AppState.pet.level}！`;
  }
  
  // 解鎖徽章「解題達人」
  if (!AppState.pet.badges.includes("解題達人")) {
    AppState.pet.badges.push("解題達人");
  }
  
  renderUserAndPet();
  showPostDetail(AppState.activePostId);
  
  // 噴金幣特效
  triggerCoinParticles(event.clientX, event.clientY);
  showFloatingText(event.clientX, event.clientY - 15, `🪙 金幣 +${bountyAmount}`, "var(--color-gold)");
  
  // 寵物反應
  setPetStatus("happy", `🏆 解答被採納了！我們獲得了 ${bountyAmount} 枚金幣懸賞${levelUpMsg}！真是博學多才！`);
  
  // 簡導航引導步驟 4 跳往步驟 5
  if (AppState.tourActive && AppState.tourStep === 4) {
    nextGuidedStep();
  }
}

// 提交回覆
function submitReply() {
  const authorInput = document.getElementById("reply-author");
  const textInput = document.getElementById("reply-text");
  const parentId = document.getElementById("reply-parent-id").value;
  
  const author = authorInput.value.trim();
  const text = textInput.value.trim();
  const warning = document.getElementById("modal-warning");
  
  if (!author || !text) {
    warning.style.display = "block";
    return;
  }
  warning.style.display = "none";
  
  // 建立留言節點
  const newReply = {
    id: "reply-" + Date.now(),
    author: author,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    content: text,
    isAdopted: false,
    replies: []
  };
  
  // 附帶手寫標記圖
  if (AppState.attachedDrawingUrl) {
    newReply.attachedImage = AppState.attachedDrawingUrl;
  }
  
  // 遞迴尋找父節點並塞入
  function addReplyToNode(node) {
    if (node.id === parentId) {
      node.replies.push(newReply);
      return true;
    }
    if (node.replies) {
      for (let child of node.replies) {
        if (addReplyToNode(child)) return true;
      }
    }
    return false;
  }
  
  // 尋找文章
  let foundPost = null;
  for (const key in AppState.boards) {
    const post = AppState.boards[key].posts.find(p => p.id === AppState.activePostId);
    if (post) {
      foundPost = post;
      break;
    }
  }
  
  if (foundPost) {
    if (!parentId) {
      // 是一級留言
      foundPost.replies.push(newReply);
    } else {
      foundPost.replies.forEach(addReplyToNode);
    }
  }
  
  // 解答獎勵經驗
  AppState.pet.exp += 15;
  let levelUpMsg = "";
  if (AppState.pet.exp >= AppState.pet.maxExp) {
    AppState.pet.level++;
    AppState.pet.exp -= AppState.pet.maxExp;
    levelUpMsg = ` 並且升到了 Lv.${AppState.pet.level}！`;
  }
  
  // 解鎖徽章「熱心助人」
  if (!AppState.pet.badges.includes("熱心助人")) {
    AppState.pet.badges.push("熱心助人");
  }
  
  renderUserAndPet();
  
  // 重設寵物活動時間，避免扣血
  AppState.pet.lastActivityTime = Date.now();
  AppState.pet.baseHp = AppState.pet.hp;
  persistPetAndRefreshCoins();

  showPostDetail(AppState.activePostId);
  closeReplyModal();
  
  // 清空輸入
  authorInput.value = "";
  textInput.value = "";
  
  setPetStatus("happy", `✍️ 回覆成功！我們獲得了 15 點經驗值獎勵${levelUpMsg}！`);

  // 簡導航引導步驟 3 提交回答後跳往步驟 4
  if (AppState.tourActive && AppState.tourStep === 3) {
    nextGuidedStep();
  }
}

// 提交新提問
function submitNewQuestion() {
  const boardId = document.getElementById("ask-board").value;
  const deptValue = document.getElementById("ask-dept").value;
  const bountyInput = document.getElementById("ask-bounty");
  const titleInput = document.getElementById("ask-title");
  const tagsInput = document.getElementById("ask-tags");
  const contentInput = document.getElementById("ask-content");
  const warning = document.getElementById("ask-warning");
  
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const bounty = parseInt(bountyInput.value, 10);

  if (isUserBlocked(AppState.user.username)) {
    warning.style.display = "block";
    warning.innerText = "⛔ 此帳號已被系統管理員封鎖，無法再發佈提問。";
    return;
  }
  
  if (!title || !content) {
    warning.style.display = "block";
    warning.innerText = "⚠️ 請填寫標題與內容敘述！";
    return;
  }

  if (Number.isNaN(bounty) || bounty < 5 || bounty > 100) {
    warning.style.display = "block";
    warning.innerText = "⚠️ 懸賞金幣請輸入 5 到 100 之間的數字！";
    return;
  }
  
  warning.style.display = "none";
  
  // 標籤學院映射
  const TAG_BOARD_MAPPING = {
    "熱力": "cmee", "卡諾": "cmee", "熱效率": "cmee", "機械": "cmee", "車輛": "cmee", "冷凍": "cmee", "空調": "cmee",
    "微積分": "ceecs", "常微分": "ceecs", "特徵": "ceecs", "齊次": "ceecs", "特解": "ceecs", "必修": "ceecs", "電路": "ceecs", "三相": "ceecs", "戴維寧": "ceecs", "等效": "ceecs", "二元": "ceecs", "搜尋樹": "ceecs", "二叉": "ceecs", "BST": "ceecs", "AVL": "ceecs", "樹": "ceecs", "電機": "ceecs", "電子": "ceecs", "資工": "ceecs", "光電": "ceecs", "演算法": "ceecs",
    "材料力學": "coe", "剪力": "coe", "彎矩": "coe", "懸臂": "coe", "結構": "coe", "土木": "coe", "化工": "coe", "生技": "coe", "分子": "coe", "材料": "coe", "資源": "coe",
    "期權": "com", "衍商": "com", "衍生性": "com", "BS": "com", "Black": "com", "Scholes": "com", "資財": "com", "工管": "com", "經管": "com",
    "UI": "cod", "UX": "cod", "介面": "cod", "黃金比例": "cod", "人體工學": "cod", "互動": "cod", "設計": "cod", "建築": "cod",
    "英文": "chss", "寫作": "chss", "被動語態": "chss", "論文": "chss", "文法": "chss", "文化": "chss", "應英": "chss"
  };

  const parsedTags = tagsInput.value.split(",").map(t => t.trim()).filter(t => t.length > 0);
  
  let mappedBoardId = null;
  for (const tag of parsedTags) {
    for (const key in TAG_BOARD_MAPPING) {
      if (tag.includes(key) || key.includes(tag)) {
        mappedBoardId = TAG_BOARD_MAPPING[key];
        break;
      }
    }
    if (mappedBoardId) break;
  }

  const finalBoardId = AppState.boards[mappedBoardId || boardId] ? (mappedBoardId || boardId) : Object.keys(AppState.boards)[0];
  let finalDept = deptValue;
  const finalBoardObj = AppState.boards[finalBoardId];
  if (finalBoardObj && !finalBoardObj.departments.includes(finalDept)) {
    finalDept = finalBoardObj.departments[0];
  }

  // 預設標籤如果沒有，加進去
  parsedTags.forEach(t => {
    if (!AppState.professorTags.includes(t)) {
      AppState.professorTags.push(t);
    }
  });

  const imageValue = getAskAttachmentImageValue() || (AppState.currentAskTemplate === "none" ? null : `mock_${AppState.currentAskTemplate}_hw`);

  // 編輯既有文章：保留原本留言、採納狀態與文章 id，只更新提問欄位
  if (AppState.editingPostId) {
    const record = findPostRecordById(AppState.editingPostId);
    if (!record) {
      warning.style.display = "block";
      warning.innerText = "⚠️ 找不到要編輯的文章，請重新整理後再試一次。";
      return;
    }

    const post = record.post;
    post.boardId = finalBoardId;
    post.title = title;
    post.content = content;
    post.bounty = bounty;
    post.tags = parsedTags;
    post.department = finalDept;
    post.image = imageValue;
    post.editedAt = new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 如果修改了學院，將文章搬到新的看板 Array
    if (record.boardId !== finalBoardId && AppState.boards[finalBoardId]) {
      record.board.posts.splice(record.index, 1);
      AppState.boards[finalBoardId].posts.unshift(post);
    }

    AppState.pet.lastActivityTime = Date.now();
    AppState.pet.baseHp = AppState.pet.hp;
    syncCustomPostStorage(post, finalBoardId);
    persistPetAndRefreshCoins();

    AppState.activeDeptId = finalBoardId;
    AppState.discussionFilterBoardId = finalBoardId;
    AppState.discussionFilterStatus = "all";
    AppState.activeFilterDeptName = "all";
    AppState.activePostId = post.id;
    AppState.editingPostId = null;

    renderHotTags();
    renderUserAndPet();
    renderDeptSelector();
    renderPostsList();
    renderDiscussionPosts();
    closeAskModal();
    showPostDetail(post.id);
    setPetStatus("happy", "✏️ 貼文已成功修改，討論區與看板內容已同步更新！");
    return;
  }

  // 金幣由系統提供，個人帳號只會因為發問獲得 +5 獎勵金幣
  AppState.pet.coins += 5;
  
  // 建立新文章物件
  const newPost = {
    id: "post-" + Date.now(),
    boardId: finalBoardId,
    title: title,
    author: AppState.user.username,
    timestamp: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    bounty: bounty,
    solved: false,
    image: imageValue,
    tags: parsedTags,
    content: content,
    department: finalDept,
    replies: []
  };
  
  // 塞入科系列表頂部，並同步到 Stitch 討論版使用的 custom posts storage
  AppState.boards[finalBoardId].posts.unshift(newPost);
  syncCustomPostStorage(newPost, finalBoardId);
  
  // 重設寵物活動時間，避免扣血
  AppState.pet.lastActivityTime = Date.now();
  AppState.pet.baseHp = AppState.pet.hp;
  persistPetAndRefreshCoins();
  
  // 自動將討論區篩選切換為發文的學院，並重設狀態篩選，避免剛發的未解答被「已解決」篩選藏起來
  AppState.activeDeptId = finalBoardId;
  AppState.discussionFilterBoardId = finalBoardId;
  AppState.discussionFilterStatus = "all";
  AppState.activeFilterDeptName = "all";
  AppState.activePostId = null;
  
  renderHotTags();
  renderUserAndPet();
  updateCoinDisplays();
  renderDeptSelector();
  renderPostsList();
  renderDiscussionPosts();
  closeAskModal();
  
  // 清空輸入
  titleInput.value = "";
  tagsInput.value = "";
  contentInput.value = "";
  bountyInput.value = "10";
  AppState.editingPostId = null;
  setAskModalMode("create");

  // 發佈後直接帶到討論版，讓使用者立刻看到剛發的問題
  switchMainTab("discussion");
  
  let boardName = AppState.boards[finalBoardId].name;
  let autoMsg = mappedBoardId && mappedBoardId !== boardId ? `（已依標籤自動歸類至 ${boardName}）` : "";
  setPetStatus("happy", `📝 成功發佈新提問！${autoMsg}本問題已由系統提供 ${bounty} 枚金幣作為懸賞，且您獲得了 5 枚發文金幣獎勵！`);
}

// 根據選擇學院看板，更新科系選項
function handleAskBoardChange() {
  const boardId = document.getElementById("ask-board").value;
  const deptSelect = document.getElementById("ask-dept");
  if (!deptSelect) return;
  
  const board = AppState.boards[boardId];
  if (!board) return;
  
  let html = "";
  board.departments.forEach(dept => {
    html += `<option value="${dept}">${dept}</option>`;
  });
  deptSelect.innerHTML = html;
}

// 根據發文看板切換模板
function syncAskTemplate() {
  const select = document.getElementById("ask-board");
  if (select.value === "ceecs") selectImageTemplate("math");
  else if (select.value === "com") selectImageTemplate("options");
  else if (select.value === "cod") selectImageTemplate("bst");
  else if (select.value === "cmee") selectImageTemplate("circuit");
  else if (select.value === "coe") selectImageTemplate("circuit");
  else if (select.value === "chss") selectImageTemplate("options");
}

function selectImageTemplate(type) {
  AppState.currentAskTemplate = type;
  document.querySelectorAll(".image-template-selector button").forEach(b => {
    b.classList.remove("border-primary", "text-primary", "bg-primary/5");
    b.classList.add("border-outline-variant/40", "text-secondary");
  });
  
  const activeBtn = document.getElementById("tpl-" + type);
  if (activeBtn) {
    activeBtn.classList.add("border-primary", "text-primary", "bg-primary/5");
    activeBtn.classList.remove("border-outline-variant/40", "text-secondary");
  }
}

// ==========================================================================
// 4. 養成商店與快捷餵食 (Shop Transaction)
// ==========================================================================

function renderQuickFeedShop() {
  const container = document.getElementById("quick-shop-container");
  if (!container) return;
  
  let html = "";
  // 統計背包（inventory）中的食物數量
  const inventoryCounts = {};
  if (AppState.pet.inventory) {
    AppState.pet.inventory.forEach(itemId => {
      inventoryCounts[itemId] = (inventoryCounts[itemId] || 0) + 1;
    });
  }
  
  const foodItems = SHOP_ITEMS.filter(item => !item.type);
  let visibleCount = 0;
  
  foodItems.forEach(item => {
    const count = inventoryCounts[item.id] || 0;
    if (count > 0) {
      visibleCount++;
      html += `
        <div class="flex items-center justify-between p-2 rounded-xl border border-outline-variant/20 bg-surface-container-low dark:bg-surface hover:bg-surface-container transition-all" id="quick-item-${item.id}">
          <div class="flex items-center gap-2">
            <span class="text-xl">${item.icon}</span>
            <div class="flex flex-col">
              <span class="text-xs font-bold text-on-surface">${item.name} (x${count})</span>
              <span class="text-[9px] text-secondary">+${item.hpRestore} HP / +${item.expGain} EXP</span>
            </div>
          </div>
          <button class="bg-primary text-on-primary hover:bg-surface-tint font-bold text-[10px] px-2.5 py-1.5 rounded-md shadow-sm transition-all" onclick="feedPetFromInventory('${item.id}', event)">
            餵食
          </button>
        </div>
      `;
    }
  });
  
  if (visibleCount === 0) {
    container.innerHTML = `
      <div class="text-center py-4">
        <p class="text-xs text-secondary mb-2">背包目前沒有食物喔！</p>
        <button onclick="switchMainTab('shop')" class="text-primary hover:underline text-[10px] font-bold flex items-center justify-center gap-0.5 w-full">
          前往商城購買 <span class="material-symbols-outlined text-[12px]">arrow_forward</span>
        </button>
      </div>
    `;
  } else {
    container.innerHTML = html;
  }
}

function renderShop() {
  const container = document.getElementById("full-shop-container");
  if (!container) return;
  let html = "";
  
  SHOP_ITEMS.forEach(item => {
    const isAccessory = item.type === "accessory";
    const highlightBorder = isAccessory ? "border-tertiary-container/60 bg-gradient-to-b from-surface to-tertiary-container/5 dark:from-surface-container-high dark:to-tertiary-container/5" : "border-outline-variant/20";
    const btnStyle = isAccessory ? "bg-tertiary text-on-tertiary hover:opacity-90" : "bg-primary text-on-primary hover:bg-surface-tint";
    
    html += `
      <div class="bg-surface-container-lowest dark:bg-surface-container-high rounded-xl p-md border ${highlightBorder} shadow-sm hover:shadow-md transition-all flex flex-col relative overflow-hidden" id="shop-item-${item.id}">
        ${item.price >= 50 && !isAccessory ? '<div class="absolute top-0 right-0 bg-primary text-on-primary px-2.5 py-0.5 rounded-bl-lg text-[9px] font-bold tracking-wider uppercase">熱銷</div>' : ''}
        <div class="h-28 bg-surface-container-low dark:bg-surface rounded-lg mb-md flex items-center justify-center relative overflow-hidden group">
          <span class="text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300">${item.icon}</span>
        </div>
        <h3 class="font-bold text-body-lg text-on-surface mb-1">${item.name}</h3>
        <p class="text-[11px] text-secondary mb-md leading-relaxed flex-1">${item.description}</p>
        <div class="flex items-center justify-between mt-auto pt-3 border-t border-outline-variant/10">
          <span class="font-bold text-body-md text-tertiary flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px] text-yellow-500 icon-fill">monetization_on</span>
            ${item.price}
          </span>
          <button class="${btnStyle} font-bold text-xs px-4 py-1.5 rounded-lg transition-all shadow-sm" onclick="buyShopItem('${item.id}', event)">
            ${isAccessory ? '購買配件' : '購買食物'}
          </button>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 購買商店物品
function buyShopItem(itemId, event) {
  if (event) event.stopPropagation();
  
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  
  if (AppState.pet.coins < item.price) {
    setPetStatus("tired", `⚠️ 金幣餘額不足！我們目前只有 ${AppState.pet.coins} 枚金幣，這件商品需要 ${item.price} 枚！`);
    return;
  }
  
  // 扣除金幣
  AppState.pet.coins -= item.price;
  
  if (item.type === "accessory") {
    // 購買的是配件
    if (AppState.pet.inventory.includes(itemId)) {
      setPetStatus("happy", `🎒 這個配件「${item.name}」我們已經買過了喔！快在上方背包點選『穿戴』來裝扮吧！`);
      AppState.pet.coins += item.price; // 退回金幣
      updateCoinDisplays();
      return;
    }
    
    AppState.pet.inventory.push(itemId);
    AppState.pet.exp += item.expGain;
    
    // 檢測升級
    let levelUpMsg = "";
    if (AppState.pet.exp >= AppState.pet.maxExp) {
      AppState.pet.level++;
      AppState.pet.exp -= AppState.pet.maxExp;
      levelUpMsg = ` 並且升到 Lv.${AppState.pet.level}！`;
    }
    
    saveState();
    renderShop();
    renderInventory();
    renderUserAndPet();
    
    setPetStatus("happy", `🎓 成功購買「${item.name}」！已放入配件試衣間中，獲得 ${item.expGain} 點經驗${levelUpMsg}！`);
  } else {
    // 購買的是食物 (放入食材包/背包)
    if (!AppState.pet.inventory) {
      AppState.pet.inventory = [];
    }
    AppState.pet.inventory.push(itemId);
    
    // 金幣特效
    triggerCoinParticles(event.clientX || window.innerWidth / 2, event.clientY || window.innerHeight / 2, true);
    
    saveState();
    renderUserAndPet();
    renderQuickFeedShop();
    renderShop();
    if (AppState.activeTab === "feeding") {
      renderFeedingTab();
    }
    
    setPetStatus("happy", `🛒 成功購買「${item.name}」！已放入寵物食材包，請切換至『寵物餵食』分頁餵食牠喔！`);
    
    // 簡報導覽步驟 5 購買雞排後跳往餵食引導
    if (AppState.tourActive && AppState.tourStep === 5 && itemId === "item-chicken") {
      nextGuidedStep();
    }
  }
}

// 餵食寵物
function feedPetFromInventory(itemId, event) {
  if (event) event.stopPropagation();
  
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  
  if (!AppState.pet.inventory || !AppState.pet.inventory.includes(itemId)) {
    setPetStatus("tired", `⚠️ 食材包裡沒有「${item.name}」喔！請先去寵物商城購買！`);
    return;
  }
  
  // 從 inventory 移除該食物
  const idx = AppState.pet.inventory.indexOf(itemId);
  if (idx > -1) {
    AppState.pet.inventory.splice(idx, 1);
  }
  
  // 恢復 HP 且獲得經驗值
  AppState.pet.hp = Math.min(500, AppState.pet.hp + item.hpRestore);
  AppState.pet.exp += item.expGain;
  
  // 重設寵物活動時間，避免扣血
  AppState.pet.lastActivityTime = Date.now();
  AppState.pet.baseHp = AppState.pet.hp;
  
  // 檢測升級
  let levelUpMsg = "";
  if (AppState.pet.exp >= AppState.pet.maxExp) {
    AppState.pet.level++;
    AppState.pet.exp -= AppState.pet.maxExp;
    levelUpMsg = `，我們已經升到了 Lv.${AppState.pet.level}！`;
  }
  
  // 餵食狀態表情
  AppState.pet.status = "eating";
  updatePetMascotSvg();
  
  saveState();
  renderUserAndPet();
  renderQuickFeedShop();
  renderShop();
  if (AppState.activeTab === "feeding") {
    renderFeedingTab();
  }
  
  setTimeout(() => {
    setPetStatus("happy", `😋 真好吃！餵食「${item.name}」恢復了 ${item.hpRestore} 點活力，並獲得 ${item.expGain} 經驗${levelUpMsg}`);
  }, 1200);
  
  // 簡報導覽步驟 6 餵食雞排成功後完成導覽
  if (AppState.tourActive && AppState.tourStep === 6 && itemId === "item-chicken") {
    nextGuidedStep();
  }
}

// 渲染餵食分頁 slider 托盤
function renderFeedingTab() {
  const tray = document.getElementById("feeding-food-tray");
  if (!tray) return;
  
  let html = "";
  // 統計背包中的食物數量
  const inventoryCounts = {};
  if (AppState.pet.inventory) {
    AppState.pet.inventory.forEach(itemId => {
      inventoryCounts[itemId] = (inventoryCounts[itemId] || 0) + 1;
    });
  }
  
  const foodItems = SHOP_ITEMS.filter(item => !item.type);
  let visibleCount = 0;
  
  foodItems.forEach(item => {
    const count = inventoryCounts[item.id] || 0;
    if (count > 0) {
      visibleCount++;
      html += `
        <div class="flex-shrink-0 w-32 md:w-36 bg-surface-container-low dark:bg-surface rounded-xl p-3 flex flex-col items-center justify-between border border-outline-variant/30 hover:shadow-md transition-all snap-center group">
          <div class="w-16 h-16 rounded-lg bg-surface-container-lowest dark:bg-surface-container-high flex items-center justify-center p-2 mb-2 overflow-hidden shadow-inner">
            <span class="text-3xl group-hover:scale-110 transition-transform duration-300">${item.icon}</span>
          </div>
          <span class="text-xs font-bold text-on-surface text-center mb-1">${item.name} (x${count})</span>
          <span class="text-[9px] text-secondary text-center mb-2.5">+${item.hpRestore} HP</span>
          <button class="w-full bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs py-1.5 rounded-lg shadow-sm transition-all" onclick="feedPetFromInventory('${item.id}', event)">
            餵食
          </button>
        </div>
      `;
    }
  });
  
  if (visibleCount === 0) {
    tray.innerHTML = `
      <div class="flex flex-col items-center justify-center py-lg text-center w-full gap-sm p-4 col-span-full">
        <span class="material-symbols-outlined text-4xl text-outline" style="font-size:48px; color:#73777c;">shopping_bag</span>
        <p class="font-body-md text-body-md text-secondary mt-2">背包目前沒有食物，餵食需要先前往商城購買喔！</p>
        <button onclick="switchMainTab('shop')" class="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-tint transition-all mt-3 inline-flex items-center gap-1 shadow-sm" style="padding:8px 16px;">
          <span class="material-symbols-outlined text-sm">storefront</span> 前往寵物商城購買
        </button>
      </div>
    `;
  } else {
    tray.innerHTML = html;
  }
  
  // 更新狀態描述
  const title = document.getElementById("feeding-pet-status-title");
  const desc = document.getElementById("feeding-pet-status-desc");
  if (title && desc) {
    title.innerText = AppState.pet.name;
    if (AppState.pet.hp <= 35) {
      desc.innerHTML = `😴 <span class="text-red-500 font-bold">${AppState.pet.name}現在非常疲憊 (HP: ${AppState.pet.hp})！</span>需要餵食一些歐趴便當來補滿活力！`;
    } else {
      desc.innerHTML = `😊 活力值良好 (HP: ${AppState.pet.hp})。餵食點心可以讓我的經驗值 (EXP) 持續增長喔！`;
    }
  }
}

// 渲染背包試衣間
function renderInventory() {
  const container = document.getElementById("inventory-items-container");
  if (!container) return;
  
  const accessories = SHOP_ITEMS.filter(item => item.type === "accessory");
  let html = "";
  
  const ownedAccs = accessories.filter(item => AppState.pet.inventory.includes(item.id));
  
  if (ownedAccs.length === 0) {
    container.innerHTML = `
      <p class="text-secondary text-xs w-full text-center py-6 col-span-2 md:col-span-4">
        背包目前是空的。在下方選購配件，為「北科科」穿戴打扮吧！🎩
      </p>
    `;
    return;
  }
  
  ownedAccs.forEach(item => {
    const isEquipped = AppState.pet.equipped[item.accessoryType];
    const equipText = isEquipped ? "📴 卸下" : "🥋 穿戴";
    const cardBg = isEquipped ? "bg-tertiary-container/20 border-tertiary-container dark:bg-tertiary-container/10 dark:border-tertiary-container" : "bg-surface-container-low dark:bg-surface border-outline-variant/30";
    
    html += `
      <div class="flex flex-col items-center p-3 rounded-xl border ${cardBg} transition-all relative overflow-hidden" id="inv-slot-${item.id}">
        <span class="text-3xl mb-1">${item.icon}</span>
        <span class="text-xs font-bold text-on-surface text-center line-clamp-1">${item.name}</span>
        <button class="mt-2 w-full text-[10px] font-bold py-1 px-2.5 rounded-md border transition-all ${isEquipped ? 'bg-tertiary text-on-tertiary border-transparent' : 'bg-transparent text-secondary border-outline-variant hover:bg-surface-container'}" onclick="toggleEquipAccessory('${item.id}', event)">
          ${equipText}
        </button>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 穿戴/卸下配件
function toggleEquipAccessory(itemId, event) {
  if (event) event.stopPropagation();
  
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return;
  
  const currentStatus = AppState.pet.equipped[item.accessoryType];
  AppState.pet.equipped[item.accessoryType] = !currentStatus;
  
  renderInventory();
  renderUserAndPet();
  
  if (AppState.pet.equipped[item.accessoryType]) {
    setPetStatus("happy", `✨ 成功裝備「${item.name}」！快看側邊欄的外觀變化！`);
  } else {
    setPetStatus("normal", `🍃 已卸下「${item.name}」配件。`);
  }
}

// ==========================================================================
// 5. 附近讀書雷達與自習室內部互動
// ==========================================================================

function startRadarScan() {
  if (AppState.radarScanning) return;
  
  AppState.radarScanning = true;
  const scanBtn = document.getElementById("btn-scan-radar");
  if (scanBtn) {
    scanBtn.disabled = true;
    scanBtn.innerHTML = "<span>🔄</span> 掃描雷達中...";
  }
  
  // 啟動 sweep 動態
  const sweep = document.querySelector(".radar-sweep");
  if (sweep) sweep.style.animation = "radar-sweep-anim 1.2s linear infinite";
  
  const pinsContainer = document.getElementById("radar-pins");
  if (pinsContainer) pinsContainer.innerHTML = "";
  
  setTimeout(() => {
    AppState.radarScanning = false;
    if (sweep) sweep.style.animation = "radar-sweep-anim 4s linear infinite";
    
    if (scanBtn) {
      scanBtn.disabled = false;
      scanBtn.innerHTML = "<span class='material-symbols-outlined'>refresh</span> 重新掃描附近讀書夥伴";
    }
    
    const pinsData = [
      { id: "pin-lib", name: "K書中心", x: 32, y: 28, icon: "📖" },
      { id: "pin-ee", name: "電機系自習室", x: 72, y: 44, icon: "⚡" },
      { id: "pin-red", name: "紅樓咖啡館", x: 55, y: 72, icon: "🏫" }
    ];
    
    pinsData.forEach(p => {
      const pin = document.createElement("div");
      pin.className = "radar-pin text-xl cursor-pointer";
      pin.style.left = `${p.x}%`;
      pin.style.top = `${p.y}%`;
      pin.innerHTML = p.icon;
      pin.title = p.name;
      
      pin.onclick = () => {
        setPetStatus("happy", `📍 發現讀書共用據點: ${p.name}！右側有活躍中的小組可以點選加入喔！`);
      };
      
      if (pinsContainer) pinsContainer.appendChild(pin);
    });
    
    AppState.radarPins = pinsData;
  }, 2000);
}

// 渲染自習室列表
function renderStudyRooms() {
  const container = document.getElementById("study-rooms-list");
  if (!container) return;
  
  let html = "";
  AppState.studyRooms.forEach(room => {
    const isJoined = room.isUserJoined;
    const btnClass = isJoined 
      ? "bg-surface-container border border-outline-variant/30 text-secondary cursor-not-allowed font-bold text-xs px-4 py-2 rounded-lg"
      : "bg-primary text-on-primary hover:bg-surface-tint font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-sm";
      
    html += `
      <div class="bg-surface-container-low dark:bg-surface p-md rounded-xl border border-outline-variant/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-md" id="room-card-${room.id}">
        <div class="flex-grow space-y-1">
          <div class="flex items-center gap-2">
            <h4 class="font-bold text-body-lg text-on-surface">${room.subject}</h4>
            ${room.joinedCount >= room.limit ? '<span class="bg-red-100 text-red-700 px-1.5 py-0.2 rounded text-[9px] font-bold">滿員</span>' : ''}
          </div>
          <div class="text-[11px] text-secondary space-x-md">
            <span>📅 時間: ${room.time}</span>
            <span>📍 地點: ${room.location}</span>
          </div>
          <p class="text-[10px] text-secondary">👥 當前人員: ${room.participants.join(", ")} (${room.joinedCount}/${room.limit}人)</p>
        </div>
        <button class="${btnClass}" onclick="joinStudyRoom('${room.id}', event)" ${isJoined ? 'disabled' : ''}>
          ${isJoined ? '已加入' : '加入共讀'}
        </button>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 加入自習室
function joinStudyRoom(roomId, event) {
  if (event) event.stopPropagation();
  
  const room = AppState.studyRooms.find(r => r.id === roomId);
  if (!room || room.isUserJoined) return;
  
  room.isUserJoined = true;
  room.joinedCount++;
  room.participants.push(AppState.user.username);
  
  AppState.activeStudyRoomId = roomId;
  
  // 寵物獎勵
  AppState.pet.exp += 20;
  let levelUpMsg = "";
  if (AppState.pet.exp >= AppState.pet.maxExp) {
    AppState.pet.level++;
    AppState.pet.exp -= AppState.pet.maxExp;
    levelUpMsg = `，電子雞升級到了 Lv.${AppState.pet.level}！`;
  }
  
  // 解鎖徽章
  if (!AppState.pet.badges.includes("共讀先鋒")) {
    AppState.pet.badges.push("共讀先鋒");
  }
  
  renderStudyRooms();
  renderUserAndPet();
  
  // 跳轉至自習詳情
  switchMainTab("study-detail");
  
  setPetStatus("happy", `📡 成功加入「${room.subject}」！獲得 20 EXP 獎勵${levelUpMsg}！我們開始番茄鐘專注吧！`);
}

// 離開自習室
function leaveStudyRoom() {
  if (AppState.activeStudyRoomId) {
    const room = AppState.studyRooms.find(r => r.id === AppState.activeStudyRoomId);
    if (room) {
      room.isUserJoined = false;
      room.joinedCount = Math.max(0, room.joinedCount - 1);
      const index = room.participants.indexOf(AppState.user.username);
      if (index > -1) room.participants.splice(index, 1);
    }
    AppState.activeStudyRoomId = null;
  }
  
  resetPomodoroTimer();
  switchMainTab("radar");
}

// 渲染自習室詳情
function renderStudyRoomDetail() {
  const roomId = AppState.activeStudyRoomId || "room-1";
  const room = AppState.studyRooms.find(r => r.id === roomId) || AppState.studyRooms[0];
  
  const title = document.getElementById("study-detail-title");
  if (title) title.innerText = room.subject;
  const statusText = document.getElementById("study-detail-status-text");
  if (statusText) statusText.innerHTML = `<span class="material-symbols-outlined text-sm">group</span> ${room.joinedCount} 人正在專注`;
  
  // 渲染專注成員
  const partContainer = document.getElementById("study-participants-container");
  if (partContainer) {
    let html = "";
    const avatars = ["👩‍🎓", "👨‍🎓", "🐱", "🐶", "🤖"];
    
    room.participants.forEach((name, i) => {
      const av = avatars[i % avatars.length];
      const isSelf = name === AppState.user.username;
      html += `
        <div class="aspect-square bg-surface-container-low dark:bg-surface rounded-lg border border-outline-variant/30 flex flex-col items-center justify-center p-2 relative overflow-hidden group">
          <span class="text-3xl mb-1">${av}</span>
          <span class="text-[10px] font-bold text-on-surface truncate w-full text-center">${name}</span>
          <div class="absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${isSelf ? 'bg-primary' : 'bg-green-500'} border border-surface"></div>
        </div>
      `;
    });
    
    const remaining = room.limit - room.participants.length;
    for (let i = 0; i < remaining; i++) {
      html += `
        <div class="aspect-square bg-surface-container-lowest border border-dashed border-outline-variant/40 rounded-lg flex items-center justify-center text-outline/50">
          <span class="material-symbols-outlined">add</span>
        </div>
      `;
    }
    partContainer.innerHTML = html;
  }
  
  renderStudyGoals();
  renderStudyChat();
}

function renderStudyGoals() {
  const container = document.getElementById("study-goals-container");
  if (!container) return;
  
  let html = "";
  AppState.studyGoals.forEach(goal => {
    html += `
      <label class="flex items-start gap-2 p-1.5 hover:bg-surface-container-low dark:hover:bg-surface rounded-lg cursor-pointer transition-colors group ${goal.completed ? 'opacity-50' : ''}">
        <input type="checkbox" class="mt-0.5 rounded border-outline-variant text-primary focus:ring-primary h-3.5 w-3.5" ${goal.completed ? 'checked' : ''} onchange="toggleStudyGoal('${goal.id}')" />
        <span class="text-xs text-on-background group-hover:text-primary transition-all ${goal.completed ? 'line-through' : ''}">${goal.text}</span>
      </label>
    `;
  });
  
  container.innerHTML = html;
}

function toggleStudyGoal(goalId) {
  const goal = AppState.studyGoals.find(g => g.id === goalId);
  if (goal) {
    goal.completed = !goal.completed;
    renderStudyGoals();
  }
}

function addStudyGoal() {
  const input = document.getElementById("new-study-goal-input");
  if (!input || !input.value.trim()) return;
  
  AppState.studyGoals.push({
    id: "goal-" + Date.now(),
    text: input.value.trim(),
    completed: false
  });
  
  input.value = "";
  renderStudyGoals();
}

function renderStudyChat() {
  const container = document.getElementById("study-chat-messages");
  if (!container) return;
  
  let html = `<div class="text-center text-[10px] text-secondary my-1.5">-- 討論區為靜音模式，請打字討論 --</div>`;
  
  AppState.studyChat.forEach(msg => {
    const isSelf = msg.author === "You" || msg.author === AppState.user.username;
    
    if (isSelf) {
      html += `
        <div class="flex flex-col items-end max-w-[85%] self-end ml-auto mb-2">
          <span class="text-[9px] text-secondary mb-0.5 mr-1">${msg.author}</span>
          <div class="bg-primary text-on-primary px-2.5 py-1.5 rounded-lg rounded-tr-none text-xs leading-normal">
            ${msg.text}
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="flex flex-col items-start max-w-[85%] mb-2">
          <span class="text-[9px] text-secondary mb-0.5 ml-1">${msg.author}</span>
          <div class="bg-surface-container-low dark:bg-surface text-on-surface px-2.5 py-1.5 rounded-lg rounded-tl-none text-xs leading-normal border border-outline-variant/20">
            ${msg.text}
          </div>
        </div>
      `;
    }
  });
  
  container.innerHTML = html;
  container.scrollTop = container.scrollHeight;
}

function sendStudyChatMessage() {
  const input = document.getElementById("study-chat-input");
  if (!input || !input.value.trim()) return;
  
  AppState.studyChat.push({
    author: "You",
    text: input.value.trim(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });
  
  input.value = "";
  renderStudyChat();
}

// 番茄鐘計時器邏輯
function togglePomodoroTimer() {
  const btnText = document.getElementById("pomo-start-text");
  const btnIcon = document.getElementById("pomo-start-icon");
  const pomoStatusText = document.getElementById("pomo-status");
  
  if (AppState.pomoRunning) {
    // 暫停
    clearInterval(AppState.pomoTimer);
    AppState.pomoRunning = false;
    if (btnText) btnText.innerText = "開始";
    if (btnIcon) btnIcon.innerText = "play_arrow";
  } else {
    // 啟動
    AppState.pomoRunning = true;
    if (btnText) btnText.innerText = "暫停";
    if (btnIcon) btnIcon.innerText = "pause";
    
    AppState.pomoTimer = setInterval(() => {
      AppState.pomoTimeLeft--;
      updatePomodoroDisplay();
      
      if (AppState.pomoTimeLeft <= 0) {
        clearInterval(AppState.pomoTimer);
        AppState.pomoRunning = false;
        AppState.pomoTimeLeft = 25 * 60;
        updatePomodoroDisplay();
        if (btnText) btnText.innerText = "開始";
        if (btnIcon) btnIcon.innerText = "play_arrow";
        
        // 完成番茄鐘經驗值獎勵
        AppState.pet.exp += 15;
        let levelUpMsg = "";
        if (AppState.pet.exp >= AppState.pet.maxExp) {
          AppState.pet.level++;
          AppState.pet.exp -= AppState.pet.maxExp;
          levelUpMsg = ` 並且升到了 Lv.${AppState.pet.level}！`;
        }
        renderUserAndPet();
        setPetStatus("happy", `🎉 恭喜！完成了一個番茄鐘！專注時間達成，獲得 15 EXP 養成獎勵！${levelUpMsg}`);
      }
    }, 1000);
  }
}

function resetPomodoroTimer() {
  clearInterval(AppState.pomoTimer);
  AppState.pomoRunning = false;
  AppState.pomoTimeLeft = 25 * 60;
  updatePomodoroDisplay();
  
  const btnText = document.getElementById("pomo-start-text");
  const btnIcon = document.getElementById("pomo-start-icon");
  if (btnText) btnText.innerText = "開始";
  if (btnIcon) btnIcon.innerText = "play_arrow";
}

function updatePomodoroDisplay() {
  const display = document.getElementById("pomo-timer-display");
  if (!display) return;
  const mins = Math.floor(AppState.pomoTimeLeft / 60);
  const secs = AppState.pomoTimeLeft % 60;
  display.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 新增發起共讀房
function submitStudyInvitation() {
  const subjectInput = document.getElementById("study-subject");
  const timeInput = document.getElementById("study-time");
  const methodInput = document.getElementById("study-method");
  const limitInput = document.getElementById("study-limit");
  const warning = document.getElementById("study-warning");
  
  const subject = subjectInput.value.trim();
  const time = timeInput.value.trim();
  const method = methodInput.value.trim();
  const limit = parseInt(limitInput.value);
  
  if (!subject || !time || !method) {
    warning.style.display = "block";
    return;
  }
  warning.style.display = "none";
  
  const newRoom = {
    id: "room-" + Date.now(),
    subject: subject,
    time: time,
    location: method,
    limit: limit,
    joinedCount: 1,
    participants: [AppState.user.username],
    isUserJoined: true
  };
  
  AppState.studyRooms.unshift(newRoom);
  AppState.activeStudyRoomId = newRoom.id;
  
  // 扣除或發放經驗
  AppState.pet.exp += 10;
  let levelUpMsg = "";
  if (AppState.pet.exp >= AppState.pet.maxExp) {
    AppState.pet.level++;
    AppState.pet.exp -= AppState.pet.maxExp;
    levelUpMsg = ` 並且升到了 Lv.${AppState.pet.level}！`;
  }
  
  renderStudyRooms();
  renderUserAndPet();
  closeCreateStudyModal();
  
  // 清空輸入
  subjectInput.value = "";
  timeInput.value = "";
  methodInput.value = "";
  
  // 跳轉至詳情
  switchMainTab("study-detail");
  
  setPetStatus("happy", `📡 發起共讀從小組成功！獲得 10 EXP 獎勵${levelUpMsg}`);
}

// ==========================================================================
// 6. 排行榜與徽章成就福利社 (Leaderboard & welfare)
// ==========================================================================

function renderWelfareSection() {
  // 1. 渲染成就徽章
  const badgeContainer = document.getElementById("badges-showcase");
  if (badgeContainer) {
    // 預設所有可能的徽章
    const allBadges = [
      { name: "好學新手", icon: "🌱", desc: "註冊成為北科遊戲化論壇的一員。" },
      { name: "解題達人", icon: "🎓", desc: "發表解答被他人成功採納為最佳解答。" },
      { name: "共讀先鋒", icon: "📡", desc: "加入或建立一個課業共讀自修室。" },
      { name: "熱心助人", icon: "💖", desc: "發表你的第一個解答留言。" }
    ];
    
    let html = "";
    allBadges.forEach(b => {
      const isOwned = AppState.pet.badges.includes(b.name);
      html += `
        <div class="flex flex-col items-center justify-center p-2 bg-surface-container-low dark:bg-surface border border-outline-variant/30 rounded-xl relative group ${isOwned ? '' : 'opacity-40 filter grayscale'}" title="${b.desc}">
          <span class="text-3xl">${b.icon}</span>
          <span class="text-[10px] font-bold text-on-surface mt-1">${b.name}</span>
          ${isOwned ? '<span class="absolute top-1 right-1 text-[8px] bg-green-100 text-green-700 px-1 rounded-full">已得</span>' : ''}
        </div>
      `;
    });
    
    badgeContainer.innerHTML = html;
  }
  
  // 2. 渲染福利社特約折價券
  const couponContainer = document.getElementById("welfare-shop-list");
  if (couponContainer) {
    let html = "";
    AppState.welfareCoupons.forEach(coupon => {
      let reqText = "";
      let isUnlocked = false;
      if (coupon.reqType === "level") {
        reqText = `Lv.${coupon.reqValue} 級解鎖`;
        isUnlocked = AppState.pet.level >= coupon.reqValue;
      } else {
        reqText = `需解鎖徽章: ${coupon.reqValue}`;
        isUnlocked = AppState.pet.badges.includes(coupon.reqValue);
      }
      
      const btnText = coupon.redeemed ? "已兌換" : "免費兌換";
      const btnStyle = (isUnlocked && !coupon.redeemed)
        ? "bg-tertiary text-on-tertiary hover:opacity-95"
        : "bg-surface-container text-secondary cursor-not-allowed border border-outline-variant/30";
      
      html += `
        <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low dark:bg-surface border border-outline-variant/20" id="coupon-${coupon.id}">
          <div class="flex items-center gap-3">
            <span class="text-3xl">${coupon.icon}</span>
            <div>
              <h4 class="font-bold text-xs text-on-surface">${coupon.name}</h4>
              <p class="text-[10px] text-secondary leading-normal">${coupon.desc}</p>
              <span class="text-[9px] font-bold text-tertiary">${reqText}</span>
            </div>
          </div>
          <button class="font-bold text-xs py-1.5 px-3 rounded-lg shadow-sm transition-all ${btnStyle}" onclick="redeemWelfareCoupon('${coupon.id}', event)" ${(isUnlocked && !coupon.redeemed) ? '' : 'disabled'}>
            ${btnText}
          </button>
        </div>
      `;
    });
    
    couponContainer.innerHTML = html;
  }
  
  // 3. 渲染排行榜
  renderLeaderboard();
}

function switchLeaderboard(type) {
  AppState.leaderboardType = type;
  document.getElementById("lbtab-weekly").className = `flex-1 py-2 font-bold text-body-md ${type === 'weekly' ? 'text-primary border-b-2 border-primary' : 'text-secondary border-b-2 border-transparent hover:text-primary'}`;
  document.getElementById("lbtab-dept").className = `flex-1 py-2 font-bold text-body-md ${type === 'dept' ? 'text-primary border-b-2 border-primary' : 'text-secondary border-b-2 border-transparent hover:text-primary'}`;
  renderLeaderboard();
}

function renderLeaderboard() {
  const container = document.getElementById("leaderboard-list-container");
  if (!container) return;
  
  let list = [];
  if (AppState.leaderboardType === "weekly") {
    list = MOCK_LEADERBOARD.weekly;
  } else {
    // 依據使用者當前所選的科系，顯示所屬學院排行榜
    let deptKey = "ceecs";
    for (const key in AppState.boards) {
      if (AppState.boards[key].departments.includes(AppState.user.department)) {
        deptKey = key;
        break;
      }
    }
    
    list = MOCK_LEADERBOARD.department[deptKey] || MOCK_LEADERBOARD.department["ceecs"];
  }
  
  let html = "";
  list.forEach((u, i) => {
    // Rank styling
    let rankHtml = `<span class="font-bold text-secondary text-xs">${i + 1}</span>`;
    if (i === 0) rankHtml = `<span class="text-xl">🥇</span>`;
    else if (i === 1) rankHtml = `<span class="text-xl">🥈</span>`;
    else if (i === 2) rankHtml = `<span class="text-xl">🥉</span>`;
    
    const isSelf = u.name === AppState.user.username;
    const selfBg = isSelf ? "bg-primary-container/20 border border-primary/20 rounded-lg" : "";
    const nameDisplay = isSelf ? `${u.name} (我)` : u.name;
    const deptDisplay = u.dept ? `<span class="text-[9px] text-secondary ml-1 font-normal">(${u.dept})</span>` : "";
    
    html += `
      <div class="grid grid-cols-12 items-center text-xs py-1.5 px-2 ${selfBg}">
        <div class="col-span-2">${rankHtml}</div>
        <div class="col-span-7 font-bold text-on-surface flex items-center gap-1.5">
          <span>${u.avatar || '👤'}</span>
          <span>${nameDisplay}</span>
          ${deptDisplay}
        </div>
        <div class="col-span-3 text-right font-bold text-primary dark:text-primary-fixed-dim">${u.points}</div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// 兌換福利社優惠券
function redeemWelfareCoupon(couponId, event) {
  if (event) event.stopPropagation();
  
  const coupon = AppState.welfareCoupons.find(c => c.id === couponId);
  if (!coupon || coupon.redeemed) return;
  
  coupon.redeemed = true;
  
  // 更新福利社
  renderWelfareSection();
  
  // 顯示條碼代碼彈出視窗
  const modal = document.getElementById("coupon-modal");
  const title = document.getElementById("coupon-modal-title");
  const desc = document.getElementById("coupon-modal-desc");
  const code = document.getElementById("coupon-code-display");
  
  if (title) title.innerText = `兌換成功: ${coupon.name}`;
  if (desc) desc.innerText = `已成功消耗 0 聲望點數兌換特約福利！向店員出示以下條碼進行兌換：`;
  if (code) code.innerText = coupon.couponCode;
  
  openCouponModal();
  
  setPetStatus("happy", `🎁 福利折價券「${coupon.name}」兌換成功！已自動發送至您的信箱/條碼。`);
}

// ==========================================================================
// 7. 資料結構解析與動態 SVG 樹狀圖渲染 (Data Structure Visualization)
// ==========================================================================

// 點擊留言節點高亮樹
function highlightCommentNode(commentId, event) {
  if (event) event.stopPropagation();
  
  AppState.highlightedCommentId = commentId;
  
  // 重新渲染 comments 列表 (加上高亮 class)
  const post = getActivePost();
  if (post) renderCommentTree(post);
  
  // 繪製 SVG 留言樹狀圖 (將高亮該節點)
  drawCommentTreeSvg();
}

// 計算並繪製 SVG 巢狀 Link-Node 圖
function drawCommentTreeSvg() {
  const svg = document.getElementById("comment-tree-svg");
  const linksGroup = document.getElementById("svg-links");
  const nodesGroup = document.getElementById("svg-nodes");
  if (!svg || !linksGroup || !nodesGroup) return;
  
  linksGroup.innerHTML = "";
  nodesGroup.innerHTML = "";
  
  const post = getActivePost();
  if (!post) {
    nodesGroup.innerHTML = `<text x="250" y="200" text-anchor="middle" fill="#94a3b8" font-size="12">請先去『學院看板』點選一篇文章以載入留言樹狀圖</text>`;
    return;
  }
  
  // 1. 建立 Tree 資料結構拓樸
  // 樹包含一個根節點 (Article) 與數個留言子節點
  const treeRoot = {
    id: post.id,
    name: "文章根節點",
    author: post.author,
    type: "root",
    replies: post.replies || []
  };
  
  // 2. 深度與寬度坐標定位算法
  // 我們需要計算每個節點的 (X, Y) 軸座標以進行 SVG Link 繪製
  // 使用階層深度 (depth) 作為 Y 軸，葉子節點的水平展幅作為 X 軸
  const nodesList = [];
  const linksList = [];
  let leafCount = 0;
  
  function traverseCoordinates(node, depth = 0, parentX = 250, parentY = 50) {
    const nodeY = 50 + depth * 75; // 每層高度 75px
    let nodeX = 0;
    
    if (!node.replies || node.replies.length === 0) {
      // 葉子節點
      leafCount++;
      nodeX = leafCount * 70; // 每個葉子間距 70px
    } else {
      // 分支節點，座標等於其所有子節點座標的平均值 (置中)
      let sumX = 0;
      const startLeaf = leafCount;
      
      node.replies.forEach(child => {
        traverseCoordinates(child, depth + 1, nodeX, nodeY);
      });
      
      const childrenCount = node.replies.length;
      let minX = 9999;
      let maxX = 0;
      
      // 取得子節點在 nodesList 中產出的 X 座標範圍
      node.replies.forEach(child => {
        const found = nodesList.find(n => n.id === child.id);
        if (found) {
          if (found.x < minX) minX = found.x;
          if (found.x > maxX) maxX = found.x;
        }
      });
      
      nodeX = (minX + maxX) / 2;
    }
    
    // 如果是文章根節點，強行居中
    if (depth === 0) {
      nodeX = 250;
    }
    
    nodesList.push({
      id: node.id,
      name: node.author,
      type: depth === 0 ? "root" : (node.isAdopted ? "adopted" : (node.isTaVerified ? "ta-verified" : (depth === 1 ? "l1" : "l2"))),
      x: nodeX,
      y: nodeY
    });
    
    if (depth > 0) {
      // 與父節點相連
      linksList.push({
        sourceId: node.parentId,
        targetId: node.id,
        sx: parentX,
        sy: parentY,
        tx: nodeX,
        ty: nodeY
      });
    }
    
    // 設定子節點的 parentId 方便回溯
    node.replies.forEach(c => {
      c.parentId = node.id;
    });
  }
  
  // 執行遞迴座標定位
  traverseCoordinates(treeRoot, 0, 250, 50);
  
  // 調整整體寬度適配 ViewBox (SVG width=500)
  // 如果 X 最大值超出 480，對所有 X 進行比例縮放
  const maxXCoord = Math.max(...nodesList.map(n => n.x));
  const minXCoord = Math.min(...nodesList.map(n => n.x));
  const span = maxXCoord - minXCoord;
  
  if (span > 0) {
    nodesList.forEach(n => {
      // 正規化至 [40, 460] 範圍
      n.x = 40 + ((n.x - minXCoord) / span) * 420;
    });
    
    // 同步更新連線坐標
    linksList.forEach(l => {
      const src = nodesList.find(n => n.id === l.sourceId);
      const tgt = nodesList.find(n => n.id === l.targetId);
      if (src && tgt) {
        l.sx = src.x;
        l.sy = src.y;
        l.tx = tgt.x;
        l.ty = tgt.y;
      }
    });
  }
  
  // 3. 開始渲染 SVG 連線
  linksList.forEach(l => {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    // 繪製貝氏三次曲線，讓線條具有優雅的樹幹分岔弧度
    const controlY = (l.sy + l.ty) / 2;
    const pathD = `M ${l.sx} ${l.sy} C ${l.sx} ${controlY}, ${l.tx} ${controlY}, ${l.tx} ${l.ty}`;
    
    line.setAttribute("d", pathD);
    line.setAttribute("class", "svg-link-line");
    
    // 如果這條連線指向目前被點選/高亮的留言，讓這條線同步高亮
    if (AppState.highlightedCommentId === l.targetId) {
      line.classList.add("highlighted");
    }
    
    linksGroup.appendChild(line);
  });
  
  // 4. 開始渲染 SVG 節點圓圈
  nodesList.forEach(n => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    
    circle.setAttribute("cx", n.x);
    circle.setAttribute("cy", n.y);
    circle.setAttribute("r", n.type === "root" ? "12" : "8");
    circle.setAttribute("class", "svg-node-circle");
    
    // 設定不同節點角色對應的顏色
    let fillColor = "#3b82f6"; // 根節點 (Blue)
    let strokeColor = "#60a5fa";
    if (n.type === "l1") { fillColor = "#f59e0b"; strokeColor = "#fbbf24"; }
    else if (n.type === "l2") { fillColor = "#10b981"; strokeColor = "#34d399"; }
    else if (n.type === "adopted") { fillColor = "#a855f7"; strokeColor = "#c084fc"; }
    else if (n.type === "ta-verified") { fillColor = "#ec4899"; strokeColor = "#f472b6"; }
    
    circle.setAttribute("fill", fillColor);
    circle.setAttribute("stroke", strokeColor);
    circle.setAttribute("stroke-width", "2");
    
    // 點擊事件：點擊樹狀圖節點，反向高亮左側 HTML 留言板的留言 card
    circle.onclick = (e) => {
      e.stopPropagation();
      if (n.type === "root") {
        AppState.highlightedCommentId = null;
        const post = getActivePost();
        if (post) renderCommentTree(post);
        drawCommentTreeSvg();
      } else {
        highlightCommentNode(n.id);
        // 如果在 visualizer 頁面，可以震動或回饋
        setPetStatus("happy", `🌳 點選留言樹節點: ${n.name} 的回答。`);
        
        // 自動滾動至對應留言
        const targetCard = document.getElementById(`comment-card-${n.id}`);
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    };
    
    // 高亮特效
    if (AppState.highlightedCommentId === n.id) {
      circle.classList.add("highlighted");
      circle.setAttribute("r", n.type === "root" ? "14" : "11");
    }
    
    // 加入文字標籤 (作者名稱)
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", n.x);
    text.setAttribute("y", n.y + (n.type === "root" ? 22 : 18));
    text.setAttribute("class", "svg-node-text");
    text.textContent = n.name.length > 5 ? n.name.substring(0, 4) + ".." : n.name;
    
    group.appendChild(circle);
    group.appendChild(text);
    nodesGroup.appendChild(group);
  });
}

// 獲取當前活躍的文章
function getActivePost() {
  if (!AppState.activePostId) return null;
  for (const key in AppState.boards) {
    const post = AppState.boards[key].posts.find(p => p.id === AppState.activePostId);
    if (post) return post;
  }
  return null;
}

// 變更 JSON 數據解析檢視器
function switchVisTab(tabId) {
  AppState.activeVisTab = tabId;
  
  document.querySelectorAll(".vis-tab-content").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".vis-tab-content").forEach(s => s.classList.add("hidden"));
  document.querySelectorAll(".vis-tab-btn").forEach(b => b.classList.remove("active", "text-primary", "border-primary"));
  document.querySelectorAll(".vis-tab-btn").forEach(b => b.classList.add("text-secondary", "border-transparent"));
  
  const tabBtn = document.getElementById("v" + tabId.replace("code-", "tab-"));
  if (tabBtn) {
    tabBtn.classList.add("active", "text-primary", "border-primary");
    tabBtn.classList.remove("text-secondary", "border-transparent");
  }
  
  const content = document.getElementById("v" + tabId.replace("code-", "sect-"));
  if (content) {
    content.classList.remove("hidden");
    content.classList.add("active");
  }
  
  updateVisualizerJSON();
}

function updateVisualizerJSON() {
  const treeViewer = document.getElementById("json-tree-viewer");
  const boardViewer = document.getElementById("json-board-viewer");
  const petViewer = document.getElementById("json-pet-viewer");
  
  if (AppState.activeVisTab === "code-tree") {
    if (!treeViewer) return;
    const post = getActivePost();
    if (!post) {
      treeViewer.innerText = "// 請先去看板選取一篇文章以查看 nested comments Tree JSON...";
    } else {
      treeViewer.innerText = JSON.stringify(post.replies, null, 2);
    }
  } else if (AppState.activeVisTab === "code-board") {
    if (!boardViewer) return;
    boardViewer.innerText = JSON.stringify(AppState.boards, ["name", "icon", "posts", "title", "author", "bounty", "solved"], 2);
  } else if (AppState.activeVisTab === "code-pet") {
    if (!petViewer) return;
    petViewer.innerText = JSON.stringify({
      petStatus: AppState.pet,
      userSession: AppState.user
    }, null, 2);
  }
}

// ==========================================================================
// 8. 教授分析看板與管理員檢舉審核功能
// ==========================================================================

// 教授新增 Hashtag
function addProfessorHashtag() {
  const input = document.getElementById("new-hashtag-input");
  if (!input || !input.value.trim()) return;
  
  let tag = input.value.trim();
  if (!tag.startsWith("#")) tag = "#" + tag;
  
  const cleanTag = tag.substring(1);
  if (!AppState.professorTags.includes(cleanTag)) {
    AppState.professorTags.push(cleanTag);
    renderHotTags();
    renderProfessorSection();
    setPetStatus("happy", `🎓 教授新增課程專屬標籤「${tag}」！已成功同步更新！`);
  }
  
  input.value = "";
}

function renderProfessorSection() {
  // 1. 渲染 Hashtags 列表
  const list = document.getElementById("professor-tags-list");
  if (list) {
    let html = "";
    AppState.professorTags.forEach(tag => {
      html += `
        <span class="bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-bold text-xs px-3.5 py-1.5 rounded-full flex items-center gap-1 shadow-sm">
          # ${tag}
          <button class="text-purple-500 hover:text-purple-700 font-bold ml-1" onclick="deleteProfessorTag('${tag}')">&times;</button>
        </span>
      `;
    });
    list.innerHTML = html;
  }
  
  // 2. 渲染高頻盲點觀念
  const misconceptionsContainer = document.getElementById("professor-misconceptions");
  if (misconceptionsContainer) {
    misconceptionsContainer.innerHTML = `
      <div class="bg-surface-container-low dark:bg-surface p-md rounded-xl border-l-4 border-yellow-500 mb-2">
        <h4 class="font-bold text-xs text-on-surface">1. 常微分方程特解 y_p 假設模糊 (高頻錯誤)</h4>
        <p class="text-secondary text-[11px] mt-1">學生容易混淆非齊次項中 e^(kx) 與齊次解特徵根重疊時的修正係數假設。</p>
      </div>
      <div class="bg-surface-container-low dark:bg-surface p-md rounded-xl border-l-4 border-yellow-500">
        <h4 class="font-bold text-xs text-on-surface">2. Black-Scholes 公式 d1 意義不明</h4>
        <p class="text-secondary text-[11px] mt-1">多數學生僅背誦 N(d2) 為風險中性履約機率，難以解釋 N(d1) 涵蓋股票資產的期望值物理特徵。</p>
      </div>
    `;
  }
}

function deleteProfessorTag(tag) {
  const index = AppState.professorTags.indexOf(tag);
  if (index > -1) {
    AppState.professorTags.splice(index, 1);
    renderHotTags();
    renderProfessorSection();
  }
}

// 檢舉文章
function triggerReportPost(event) {
  if (event) event.stopPropagation();
  
  const post = getActivePost();
  if (!post) return;
  
  // 加入檢舉庫
  AppState.reports.unshift({
    id: "rep-" + Date.now(),
    targetId: post.id,
    targetText: post.title,
    type: "post",
    reason: "發問內容有爭議或含有廣告",
    reporter: "學生糾察隊",
    timestamp: new Date().toLocaleTimeString(),
    status: "pending"
  });
  
  setPetStatus("tired", `🚩 已向後台送出檢舉！管理員將會審核這篇貼文「${post.title}」。感謝維護環境！`);
}

// 檢舉留言
function triggerReportComment(commentId, event) {
  if (event) event.stopPropagation();
  
  // 遞迴尋找留言內容
  let foundComment = null;
  function searchNode(node) {
    if (node.id === commentId) {
      foundComment = node;
      return true;
    }
    if (node.replies) {
      for (let child of node.replies) {
        if (searchNode(child)) return true;
      }
    }
    return false;
  }
  
  const post = getActivePost();
  if (post) post.replies.forEach(searchNode);
  
  if (!foundComment) return;
  
  // 加入檢舉庫
  AppState.reports.unshift({
    id: "rep-" + Date.now(),
    targetId: commentId,
    targetText: foundComment.content,
    type: "comment",
    reason: "不友善言論或無意義回答",
    reporter: "匿名同學",
    timestamp: new Date().toLocaleTimeString(),
    status: "pending"
  });
  
  setPetStatus("tired", `🚩 已對留言「${foundComment.author}：${foundComment.content.substring(0, 10)}...」送出檢舉。`);
}


const ADMIN_ROLE_PASSWORD = "676767";

function requireAdminPassword() {
  const input = prompt("請輸入系統管理員密碼");
  if (input === ADMIN_ROLE_PASSWORD) {
    return true;
  }

  alert("密碼錯誤，無法切換成系統管理員身分。");
  return false;
}

function syncRoleSelects(role) {
  const headerRoleSelect = document.getElementById("header-role-select");
  const profileRoleSelect = document.getElementById("profile-role");
  if (headerRoleSelect) headerRoleSelect.value = role;
  if (profileRoleSelect) profileRoleSelect.value = role;
}

function isUserBlocked(username) {
  return (AppState.blockedUsers || []).some(u => u.username === username);
}

function persistAdminState() {
  saveState();
  try {
    localStorage.setItem("studypet_admin_state", JSON.stringify({
      blockedUsers: AppState.blockedUsers || [],
      adminLogs: AppState.adminLogs || [],
      deletedQuestionArchive: AppState.deletedQuestionArchive || [],
      adminActivePanel: AppState.adminActivePanel || "overview"
    }));
  } catch (e) {}
}

function buildMockOnlineUsers() {
  const base = [
    { username: AppState.user.username || "目前使用者", role: AppState.user.role || "student", department: AppState.user.department || "機械工程系", status: "online" },
    { username: "大一電機萌新", role: "student", department: "電機工程系", status: "online" },
    { username: "微積分小助教", role: "ta", department: "電機工程系", status: "online" },
    { username: "資財大三學姐", role: "student", department: "資訊與財金管理系", status: "online" },
    { username: "熱流組大師兄", role: "student", department: "機械工程系", status: "idle" },
    { username: "資料結構魔法師", role: "student", department: "資訊工程系", status: "online" }
  ];
  const authors = collectAllQuestionRecords().map(r => ({ username: r.author, role: "student", department: r.department || r.boardName, status: "online" }));
  const seen = new Set();
  return base.concat(authors).filter(u => {
    if (!u.username || seen.has(u.username)) return false;
    seen.add(u.username);
    return true;
  });
}


function switchAdminPanel(panelName = "overview", shouldPersist = true) {
  if (!["overview", "questions", "reports", "analytics"].includes(panelName)) panelName = "overview";
  AppState.adminActivePanel = panelName;
  document.querySelectorAll(".admin-subpanel").forEach(panel => {
    panel.classList.add("hidden");
  });
  const activePanel = document.getElementById("admin-panel-" + panelName);
  if (activePanel) activePanel.classList.remove("hidden");

  document.querySelectorAll(".admin-panel-tab").forEach(btn => {
    btn.classList.remove("bg-red-600", "text-white", "border-red-600", "shadow");
    btn.classList.add("bg-surface", "text-secondary", "border-outline-variant");
  });
  const activeBtn = document.getElementById("admin-panel-tab-" + panelName);
  if (activeBtn) {
    activeBtn.classList.remove("bg-surface", "text-secondary", "border-outline-variant");
    activeBtn.classList.add("bg-red-600", "text-white", "border-red-600", "shadow");
  }
  if (shouldPersist) persistAdminState();
}

function syncAdminArchivesFromLogs() {
  if (!Array.isArray(AppState.deletedQuestionArchive)) AppState.deletedQuestionArchive = [];
  const archiveIds = new Set(AppState.deletedQuestionArchive.map(item => item.id));
  let changed = false;
  (AppState.adminLogs || []).forEach((log, index) => {
    const action = String(log.action || "");
    const desc = String(log.desc || "");
    const isDeleteOrBlock = action.includes("刪除") || desc.includes("刪除問題") || desc.includes("封鎖帳號") || desc.includes("屏蔽");
    if (!isDeleteOrBlock) return;
    const titleMatch = desc.match(/(?:刪除問題|問題)[「\"]([^」\"]+)[」\"]/);
    const authorMatch = desc.match(/封鎖帳號\s*([^。\s]+)/);
    const title = titleMatch ? titleMatch[1] : (desc.includes("屏蔽") ? "被屏蔽內容" : "後台處理問題");
    const author = authorMatch ? authorMatch[1] : "未知帳號";
    const id = `moderation-log-${index}-${title}-${author}`.replace(/\s+/g, "-").slice(0, 120);
    if (archiveIds.has(id)) return;
    AppState.deletedQuestionArchive.unshift({
      id,
      boardId: "admin-log",
      boardName: "後台處理紀錄",
      title,
      content: desc,
      author,
      department: "後台同步",
      timestamp: log.timestamp || new Date().toLocaleString(),
      bounty: 0,
      solved: false,
      tags: ["後台處理", action || "管理紀錄"],
      deleted: true,
      deletedAt: log.timestamp || new Date().toLocaleString(),
      blockedAction: desc.includes("封鎖") || action.includes("封鎖"),
      adminReason: desc.includes("屏蔽") ? "屏蔽問題" : (desc.includes("封鎖") ? "刪除問題並封鎖帳號" : "刪除問題"),
      source: "adminLogSync"
    });
    archiveIds.add(id);
    changed = true;
  });
  if (changed) {
    AppState.deletedQuestionArchive = AppState.deletedQuestionArchive.slice(0, 200);
    try {
      localStorage.setItem("studypet_admin_state", JSON.stringify({
        blockedUsers: AppState.blockedUsers || [],
        adminLogs: AppState.adminLogs || [],
        deletedQuestionArchive: AppState.deletedQuestionArchive || [],
        adminActivePanel: AppState.adminActivePanel || "overview"
      }));
    } catch (e) {}
  }
}

function collectAllQuestionRecords() {
  syncAdminArchivesFromLogs();
  const records = [];
  const seen = new Set();
  for (const boardId in AppState.boards) {
    const board = AppState.boards[boardId];
    (board.posts || []).forEach((post, index) => {
      if (!post || seen.has(post.id)) return;
      seen.add(post.id);
      records.push({
        id: post.id,
        boardId,
        boardName: board.name,
        index,
        title: post.title || "未命名問題",
        content: post.content || "",
        author: post.author || post.authorName || "匿名學生",
        department: post.department || "未指定科系",
        timestamp: post.timestamp || "未記錄時間",
        bounty: post.bounty || 0,
        solved: !!post.solved,
        tags: Array.isArray(post.tags) ? post.tags : [],
        source: "boards"
      });
    });
  }
  try {
    const customPosts = JSON.parse(localStorage.getItem("studypet_custom_posts") || "[]");
    customPosts.forEach((post, index) => {
      const id = post.id || `custom-${index}`;
      if (seen.has(id)) return;
      seen.add(id);
      records.push({
        id,
        boardId: post.boardId || "custom",
        boardName: post.boardName || "討論版",
        index,
        title: post.title || "未命名問題",
        content: post.content || "",
        author: post.authorName || post.author || "匿名學生",
        department: post.deptName || post.department || "未指定科系",
        timestamp: post.timestamp || "未記錄時間",
        bounty: post.bounty || 0,
        solved: !!post.solved,
        tags: [post.deptName || post.department].filter(Boolean),
        source: "custom"
      });
    });
  } catch (e) {}

  (AppState.deletedQuestionArchive || []).forEach((post, index) => {
    const id = post.id || `deleted-${index}`;
    if (seen.has(id)) return;
    seen.add(id);
    records.push({
      id,
      boardId: post.boardId || "deleted",
      boardName: post.boardName || "已刪除問題",
      index,
      title: post.title || "已刪除問題",
      content: post.content || "",
      author: post.author || "匿名學生",
      department: post.department || "未指定科系",
      timestamp: post.timestamp || post.deletedAt || "未記錄時間",
      bounty: post.bounty || 0,
      solved: !!post.solved,
      tags: Array.isArray(post.tags) ? post.tags : [],
      source: "deletedArchive",
      deleted: true,
      deletedAt: post.deletedAt || "",
      blockedAction: !!post.blockedAction,
      adminReason: post.adminReason || ""
    });
  });

  return records.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")) || String(b.id).localeCompare(String(a.id)));
}

function getAdminAnalytics(records) {
  const tagCounts = {};
  const boardCounts = {};
  records.forEach(r => {
    boardCounts[r.boardName] = (boardCounts[r.boardName] || 0) + 1;
    (r.tags && r.tags.length ? r.tags : [r.department]).forEach(tag => {
      if (!tag) return;
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topBoards = Object.entries(boardCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);
  return { topTags, topBoards };
}

function renderAdminBars(containerId, items, total, accentClass) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!items.length) {
    el.innerHTML = `<div class="text-xs text-secondary bg-surface-container-low p-3 rounded-lg text-center">目前沒有足夠資料。</div>`;
    return;
  }
  el.innerHTML = items.map(([label, count]) => {
    const pct = total ? Math.max(8, Math.round((count / total) * 100)) : 0;
    return `
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-semibold"><span>${escapeHtml(label)}</span><span>${count} 筆</span></div>
        <div class="w-full bg-surface-container-low h-2 rounded-full overflow-hidden"><div class="${accentClass} h-full rounded-full" style="width:${pct}%"></div></div>
      </div>`;
  }).join("");
}

function renderAdminSection() {
  const unauthorized = document.getElementById("admin-unauthorized");
  const dashboard = document.getElementById("admin-dashboard-content");
  if (AppState.user.role !== "admin") {
    if (unauthorized) unauthorized.classList.remove("hidden");
    if (dashboard) dashboard.classList.add("hidden");
    return;
  }
  if (unauthorized) unauthorized.classList.add("hidden");
  if (dashboard) dashboard.classList.remove("hidden");

  const records = collectAllQuestionRecords();
  AppState.onlineUsers = buildMockOnlineUsers();
  const onlineUsers = AppState.onlineUsers || [];
  const blocked = AppState.blockedUsers || [];
  const pendingReports = (AppState.reports || []).filter(r => r.status === "pending");

  const statsGrid = document.getElementById("admin-stats-grid");
  if (statsGrid) {
    statsGrid.innerHTML = `
      <div class="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm"><p class="text-xs text-secondary mb-1">目前上線人數</p><h3 class="font-bold text-3xl text-green-600">${onlineUsers.filter(u => u.status === "online").length}</h3><p class="text-[10px] text-secondary mt-1">含學生、助教與目前使用者</p></div>
      <div class="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm"><p class="text-xs text-secondary mb-1">全站問題總數</p><h3 class="font-bold text-3xl text-primary">${records.length}</h3><p class="text-[10px] text-secondary mt-1">跨所有學院看板</p></div>
      <div class="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm"><p class="text-xs text-secondary mb-1">待處理檢舉</p><h3 class="font-bold text-3xl text-red-600">${pendingReports.length}</h3><p class="text-[10px] text-secondary mt-1">可直接屏蔽或駁回</p></div>
      <div class="bg-surface-container-lowest dark:bg-surface-container-high p-md rounded-xl border border-outline-variant/30 shadow-sm"><p class="text-xs text-secondary mb-1">已封鎖帳號</p><h3 class="font-bold text-3xl text-orange-600">${blocked.length}</h3><p class="text-[10px] text-secondary mt-1">封鎖後無法再次提問</p></div>`;
  }

  const onlineCount = document.getElementById("admin-online-count");
  if (onlineCount) onlineCount.innerText = `${onlineUsers.filter(u => u.status === "online").length} 人在線`;
  const onlineList = document.getElementById("admin-online-users-list");
  if (onlineList) {
    onlineList.innerHTML = onlineUsers.map(user => {
      const isBlocked = isUserBlocked(user.username);
      const roleMap = { student: "學生", ta: "助教", professor: "教授", admin: "系統管理員" };
      return `
        <div class="flex items-center justify-between gap-2 p-2 rounded-lg border border-outline-variant/20 bg-surface-container-low dark:bg-surface">
          <div class="min-w-0">
            <p class="font-bold text-sm text-on-surface truncate">${escapeHtml(user.username)}</p>
            <p class="text-[10px] text-secondary truncate">${escapeHtml(user.department)} • ${roleMap[user.role] || "學生"}</p>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded-full ${isBlocked ? 'bg-red-100 text-red-700' : user.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${isBlocked ? '已封鎖' : user.status === 'online' ? '在線' : '閒置'}</span>
        </div>`;
    }).join("");
  }

  const filter = document.getElementById("admin-question-filter")?.value || "all";
  let filtered = records;
  if (filter === "solved") filtered = records.filter(r => r.solved);
  if (filter === "unsolved") filtered = records.filter(r => !r.solved);
  if (filter === "blocked") filtered = records.filter(r => isUserBlocked(r.author) || r.blockedAction || r.deleted || r.adminReason === "屏蔽問題" || r.source === "adminLogSync");

  const recordList = document.getElementById("admin-question-records-list");
  if (recordList) {
    if (!filtered.length) {
      recordList.innerHTML = `<div class="text-center text-secondary text-xs py-10 border border-dashed border-outline-variant/40 rounded-xl">目前沒有符合條件的問題紀錄。</div>`;
    } else {
      recordList.innerHTML = filtered.map(r => {
        const blockedFlag = isUserBlocked(r.author) || r.blockedAction;
        const deletedFlag = !!r.deleted;
        return `
          <div class="p-md rounded-xl border border-outline-variant/30 bg-surface-container-low dark:bg-surface space-y-2" id="admin-question-${escapeHtml(r.id)}">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2 mb-1">
                  <span class="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">${escapeHtml(r.boardName)}</span>
                  <span class="text-[10px] px-2 py-0.5 rounded ${r.solved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${r.solved ? '已解決' : '未解決'}</span>
                  ${blockedFlag ? '<span class="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold">作者已封鎖</span>' : ''}
                  ${deletedFlag ? '<span class="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">問題已刪除</span>' : ''}
                </div>
                <h4 class="font-bold text-sm text-on-surface line-clamp-1">${escapeHtml(r.title)}</h4>
                <p class="text-xs text-secondary line-clamp-2 mt-1">${escapeHtml(r.content)}</p>
              </div>
              <div class="flex md:flex-col gap-1.5 shrink-0">
                ${deletedFlag ? '<button class="bg-surface-container text-secondary font-bold text-[10px] px-3 py-1.5 rounded-lg border border-outline-variant/30 opacity-60 cursor-not-allowed" disabled>已刪除</button>' : `<button class="bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[10px] px-3 py-1.5 rounded-lg border border-outline-variant/30" onclick="showAdminPostDetail('${r.id}')">查看</button>`}
                ${deletedFlag ? '' : `<button class="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg" onclick="adminDeleteQuestion('${r.id}')">刪除問題</button>`}
                ${deletedFlag ? '' : `<button class="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg" onclick="adminDeleteQuestion('${r.id}', true)">刪除並封鎖</button>`}
              </div>
            </div>
            <div class="flex flex-wrap gap-1 text-[10px] text-secondary">
              <span>作者：<strong>${escapeHtml(r.author)}</strong></span>
              <span>•</span><span>${escapeHtml(r.department)}</span>
              <span>•</span><span>🪙 ${escapeHtml(r.bounty)} 金幣</span>
              <span>•</span><span>${escapeHtml(r.timestamp)}</span>
              ${deletedFlag && r.deletedAt ? `<span>•</span><span class="text-red-600 font-bold">刪除時間：${escapeHtml(r.deletedAt)}</span>` : ''}
            </div>
            <div class="flex flex-wrap gap-1">${(r.tags || []).slice(0, 5).map(t => `<span class="text-[10px] px-2 py-0.5 rounded bg-secondary-container text-on-secondary-container">#${escapeHtml(t)}</span>`).join("")}</div>
          </div>`;
      }).join("");
    }
  }

  const analytics = getAdminAnalytics(records);
  renderAdminBars("admin-tag-analysis", analytics.topTags, records.length, "bg-purple-500");
  renderAdminBars("admin-board-analysis", analytics.topBoards, records.length, "bg-primary");
  const range = document.getElementById("admin-analysis-range");
  if (range) range.innerText = `${records.length} 筆資料`;
  const insights = document.getElementById("admin-insights-list");
  if (insights) {
    const topTag = analytics.topTags[0]?.[0] || "尚無明顯主題";
    const topBoard = analytics.topBoards[0]?.[0] || "尚無集中學院";
    const unsolved = records.filter(r => !r.solved).length;
    insights.innerHTML = `
      <p>• 近期最常被提問的方向是 <strong class="text-primary">${escapeHtml(topTag)}</strong>，可安排 TA 或教授補充教材。</p>
      <p>• 問題主要集中在 <strong class="text-primary">${escapeHtml(topBoard)}</strong>，建議優先觀察該學院的期末學習壓力。</p>
      <p>• 目前尚有 <strong class="text-primary">${unsolved}</strong> 筆未解決問題，可推播給相關科系學霸或助教。</p>`;
  }

  renderAdminReportsAndLogs();
  switchAdminPanel(AppState.adminActivePanel || "overview", false);
}

function renderAdminReportsAndLogs() {
  const countEl = document.getElementById("admin-reports-count");
  const list = document.getElementById("admin-reports-list");
  const pendingReports = (AppState.reports || []).filter(r => r.status === "pending");
  if (countEl) countEl.innerText = `${pendingReports.length} 案待理`;
  if (list) {
    if (pendingReports.length === 0) {
      list.innerHTML = `<div class="bg-surface-container-low p-md rounded-xl text-center text-xs text-secondary py-8">目前沒有待處理的檢舉案件。</div>`;
    } else {
      list.innerHTML = pendingReports.map(rep => `
        <div class="bg-surface-container-low dark:bg-surface p-md rounded-xl border border-outline-variant/30 space-y-sm" id="rep-card-${rep.id}">
          <div class="flex items-center justify-between text-xs text-secondary"><span class="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">${rep.type === 'post' ? '檢舉文章' : '檢舉回覆'}</span><span>${escapeHtml(rep.reporter)} • ${escapeHtml(rep.timestamp)}</span></div>
          <p class="text-xs text-on-surface font-bold">理由：<span class="font-normal text-secondary">${escapeHtml(rep.reason)}</span></p>
          <div class="bg-surface-container-high dark:bg-surface-container p-sm rounded text-xs text-secondary font-mono leading-normal border border-outline-variant/20 line-clamp-2">${escapeHtml(rep.targetText)}</div>
          <div class="flex gap-sm justify-end"><button class="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded-lg" onclick="resolveReport('${rep.id}', 'delete')">屏蔽內容</button><button class="bg-surface-container hover:bg-surface-container-high text-on-surface-variant font-bold text-[10px] px-3 py-1.5 rounded-lg border border-outline-variant/30" onclick="resolveReport('${rep.id}', 'dismiss')">駁回案件</button></div>
        </div>`).join("");
    }
  }
  const logsList = document.getElementById("admin-logs-list");
  if (logsList) {
    if (!AppState.adminLogs || AppState.adminLogs.length === 0) {
      logsList.innerHTML = `<div class="text-center text-secondary py-8">無歷史操作日誌。</div>`;
    } else {
      logsList.innerHTML = AppState.adminLogs.map(log => `
        <div class="p-sm bg-surface-container-low dark:bg-surface rounded border border-outline-variant/10 leading-normal mb-1.5">
          <span class="font-bold text-primary dark:text-primary-fixed-dim">[${escapeHtml(log.action)}]</span>
          <span>${escapeHtml(log.desc)}</span>
          <span class="block text-[9px] text-secondary text-right mt-1">${escapeHtml(log.timestamp)}</span>
        </div>`).join("");
    }
  }
}

function showAdminPostDetail(postId) {
  const rec = collectAllQuestionRecords().find(r => r.id === postId);
  if (rec && rec.deleted) {
    alert(`此問題已由系統管理員刪除，仍保留於後台紀錄。\n\n標題：${rec.title}\n作者：${rec.author}\n刪除時間：${rec.deletedAt || "未記錄"}`);
    return;
  }
  if (findPostRecordById(postId)) {
    AppState.activePostId = postId;
    showPostDetail(postId);
  } else {
    switchMainTab("discussion");
  }
}

function adminDeleteQuestion(postId, blockAuthor = false) {
  if (AppState.user.role !== "admin") return;
  const records = collectAllQuestionRecords();
  const rec = records.find(r => r.id === postId);
  if (!rec) return;
  const confirmText = blockAuthor ? `確定要刪除「${rec.title}」並封鎖 ${rec.author} 嗎？` : `確定要刪除「${rec.title}」嗎？`;
  if (!confirm(confirmText)) return;
  archiveDeletedQuestion(rec, blockAuthor);
  deleteQuestionById(postId);
  if (blockAuthor) blockUserAccount(rec.author, `發佈不恰當問題：${rec.title}`);
  AppState.adminLogs.unshift({
    action: blockAuthor ? "刪除並封鎖" : "刪除問題",
    desc: blockAuthor ? `刪除問題「${rec.title}」，並封鎖帳號 ${rec.author}。` : `刪除問題「${rec.title}」。`,
    timestamp: new Date().toLocaleString()
  });
  persistAdminState();
  renderPostsList();
  renderDiscussionPosts();
  renderProfileQuestionHistory();
  renderAdminSection();
  setPetStatus("happy", blockAuthor ? `🛡️ 已刪除問題並封鎖 ${rec.author}。` : "🛡️ 已刪除該問題。", 4500);
}

function archiveDeletedQuestion(rec, blockAuthor = false) {
  if (!rec || !rec.id) return;
  if (!Array.isArray(AppState.deletedQuestionArchive)) AppState.deletedQuestionArchive = [];
  const existingIndex = AppState.deletedQuestionArchive.findIndex(item => item.id === rec.id);
  const archived = {
    id: rec.id,
    boardId: rec.boardId || "deleted",
    boardName: rec.boardName || "已刪除問題",
    title: rec.title || "已刪除問題",
    content: rec.content || "",
    author: rec.author || "匿名學生",
    department: rec.department || "未指定科系",
    timestamp: rec.timestamp || "未記錄時間",
    bounty: rec.bounty || 0,
    solved: !!rec.solved,
    tags: Array.isArray(rec.tags) ? [...rec.tags] : [],
    deleted: true,
    deletedAt: new Date().toLocaleString(),
    blockedAction: !!blockAuthor,
    adminReason: blockAuthor ? "刪除問題並封鎖帳號" : "刪除問題"
  };
  if (existingIndex > -1) {
    AppState.deletedQuestionArchive[existingIndex] = { ...AppState.deletedQuestionArchive[existingIndex], ...archived };
  } else {
    AppState.deletedQuestionArchive.unshift(archived);
  }
  AppState.deletedQuestionArchive = AppState.deletedQuestionArchive.slice(0, 200);
}

function blockUserAccount(username, reason = "系統管理員封鎖") {
  if (!username || username === AppState.user.username && AppState.user.role === "admin") return;
  if (!AppState.blockedUsers) AppState.blockedUsers = [];
  if (!isUserBlocked(username)) {
    AppState.blockedUsers.push({ username, reason, timestamp: new Date().toLocaleString() });
  }
}

function deleteQuestionById(postId) {
  for (const key in AppState.boards) {
    const board = AppState.boards[key];
    const idx = (board.posts || []).findIndex(p => p.id === postId);
    if (idx > -1) {
      board.posts.splice(idx, 1);
      break;
    }
  }
  try {
    const customPosts = JSON.parse(localStorage.getItem("studypet_custom_posts") || "[]");
    const next = customPosts.filter(p => p.id !== postId);
    localStorage.setItem("studypet_custom_posts", JSON.stringify(next));
  } catch (e) {}
  if (AppState.activePostId === postId) AppState.activePostId = null;
  saveState();
}

// 處置檢舉
function resolveReport(reportId, action) {
  const rep = AppState.reports.find(r => r.id === reportId);
  if (!rep) return;
  rep.status = "resolved";
  let actionText = "";
  if (action === "delete") {
    actionText = "屏蔽隱藏";
    deleteReportedContent(rep.targetId, rep.type);
  } else {
    actionText = "駁回免置";
  }
  AppState.adminLogs.unshift({
    action: `審理案件 (${actionText})`,
    desc: `管理員審查了 ${rep.reporter} 的檢舉案，結果為 [${actionText}]。`,
    timestamp: new Date().toLocaleString()
  });
  persistAdminState();
  renderAdminSection();
  setPetStatus("happy", `🛡️ 案件審理完畢：已對檢舉實施 [${actionText}] 處置。`);
}

// 模擬從資料庫中刪除
function deleteReportedContent(targetId, type) {
  if (type === "post") {
    const rec = collectAllQuestionRecords().find(r => r.id === targetId);
    if (rec) {
      archiveDeletedQuestion({ ...rec, adminReason: "屏蔽問題" }, false);
      const idx = AppState.deletedQuestionArchive.findIndex(item => item.id === rec.id);
      if (idx > -1) {
        AppState.deletedQuestionArchive[idx].adminReason = "屏蔽問題";
        AppState.deletedQuestionArchive[idx].blockedAction = true;
      }
    }
    deleteQuestionById(targetId);
    return;
  }
  function searchAndDelete(node) {
    if (!node.replies) return false;
    const idx = node.replies.findIndex(c => c.id === targetId);
    if (idx > -1) {
      node.replies.splice(idx, 1);
      return true;
    }
    for (let child of node.replies) {
      if (searchAndDelete(child)) return true;
    }
    return false;
  }
  let currentPost = getActivePost();
  if (currentPost) {
    const idx = currentPost.replies.findIndex(c => c.id === targetId);
    if (idx > -1) currentPost.replies.splice(idx, 1);
    else currentPost.replies.forEach(searchAndDelete);
    renderCommentTree(currentPost);
  }
  saveState();
}

// ==========================================================================
// 9. 簡報導覽引導系統 (3-Minute guided Tour Mode)
// ==========================================================================

const GUIDE_TOUR_STEPS = [
  { tab: "boards", selector: "#top-tab-boards", title: "看板", message: "這裡是全站問題入口，可以依學院與科系快速找到課業提問，也可以按『發佈新提問』提出問題。" },
  { tab: "radar", selector: "#top-tab-radar", title: "自習室", message: "自習室用來模擬共讀與學習小組，學生可以查看不同讀書房間、加入討論並完成讀書目標。" },
  { tab: "discussion", selector: "#top-tab-discussion", title: "討論版", message: "討論版集中顯示提問與解答。發佈問題後會出現在這裡，也能檢視懸賞、狀態與回覆。" },
  { tab: "feeding", selector: "#top-tab-feeding", title: "寵物餵食", message: "答題或簽到得到金幣後，可以購買道具並在這裡餵食寵物，恢復生命值與經驗值。" },
  { tab: "shop", selector: "#top-tab-shop", title: "寵物商城", message: "商城可以購買食物、裝飾與道具。購買後金幣餘額會即時同步到所有分頁。" },
  { tab: "welfare", selector: "#top-tab-welfare", title: "排行榜與成就", message: "這裡展示學術排行榜、徽章與成就，讓學習互助形成遊戲化回饋。" },
  { tab: "profile", selector: "#top-tab-profile", title: "個人檔案", message: "個人檔案可以設定身分、性別、頭像、電子雞造型，也能查看自己的提問紀錄。" },
  { tab: "admin", selector: "#top-tab-admin", title: "系統管理後台", adminOnly: true, message: "系統管理員可以查看上線狀態、全站提問紀錄、檢舉案件、封鎖帳號與學習方向分析。" }
];

function getVisibleGuideSteps() {
  return GUIDE_TOUR_STEPS.filter(step => !step.adminOnly || AppState.user.role === "admin");
}

function startGuidedTour() {
  if (AppState.tourActive) {
    stopGuidedTour();
    return;
  }
  AppState.tourActive = true;
  AppState.tourStep = 0;
  renderGuideTourStep();
}

function renderGuideTourStep() {
  const steps = getVisibleGuideSteps();
  if (!steps.length) return stopGuidedTour();
  if (AppState.tourStep < 0) AppState.tourStep = 0;
  if (AppState.tourStep >= steps.length) {
    stopGuidedTour();
    setPetStatus("happy", "🎉 導覽完成！你已了解各分頁功能與網站基本操作流程。", 6000);
    return;
  }

  const step = steps[AppState.tourStep];
  let overlay = document.getElementById("tour-overlay-element");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "tour-overlay-element";
    overlay.className = "tour-overlay";
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = "1";

  let card = document.getElementById("tour-card-element");
  if (!card) {
    card = document.createElement("div");
    card.id = "tour-card-element";
    card.className = "tour-card";
    document.body.appendChild(card);
  }

  document.querySelectorAll(".tour-highlight").forEach(e => e.classList.remove("tour-highlight"));
  const target = document.querySelector(step.selector);
  if (target) target.classList.add("tour-highlight");

  card.innerHTML = `
    <div class="flex items-start justify-between gap-3 mb-2">
      <div>
        <p class="text-[11px] text-secondary font-bold">互動式網站導覽 ${AppState.tourStep + 1} / ${steps.length}</p>
        <h3 class="font-bold text-lg text-on-surface">${escapeHtml(step.title)}</h3>
      </div>
      <button class="text-secondary hover:text-red-600" onclick="stopGuidedTour()" title="結束導覽">✕</button>
    </div>
    <p class="text-sm text-secondary leading-relaxed mb-4">${escapeHtml(step.message)}</p>
    <div class="flex flex-wrap gap-2 justify-between items-center">
      <button class="px-3 py-2 rounded-lg border border-outline-variant/40 text-xs font-bold text-secondary bg-surface-container-low hover:bg-surface-container" onclick="previousGuideTourStep()" ${AppState.tourStep === 0 ? 'disabled style="opacity:.45;cursor:not-allowed"' : ''}>上一步</button>
      <div class="flex gap-2">
        <button class="px-3 py-2 rounded-lg border border-primary/30 text-xs font-bold text-primary bg-primary/5 hover:bg-primary/10" onclick="goToGuideTourTab()">前往此分頁</button>
        <button class="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-bold hover:bg-surface-tint" onclick="nextGuidedStep()">${AppState.tourStep === steps.length - 1 ? '完成導覽' : '下一步'}</button>
      </div>
    </div>
  `;

  refreshGuideTourButton();
  setPetStatus("happy", `📍 導覽：${step.title}。${step.message}`, 6500);
}

function goToGuideTourTab() {
  if (!AppState.tourActive) return;
  const step = getVisibleGuideSteps()[AppState.tourStep];
  if (!step) return;
  if (step.tab === "admin" && AppState.user.role !== "admin") return;
  switchMainTab(step.tab);
  setTimeout(renderGuideTourStep, 120);
}

function nextGuidedStep() {
  if (!AppState.tourActive) return;
  AppState.tourStep += 1;
  renderGuideTourStep();
}

function previousGuideTourStep() {
  if (!AppState.tourActive) return;
  AppState.tourStep -= 1;
  renderGuideTourStep();
}

function refreshGuideTourButton() {
  const tourBtn = document.getElementById("guide-tour-btn");
  if (!tourBtn) return;
  document.body.classList.toggle("admin-role", AppState.user.role === "admin");
  if (!AppState.tourActive) {
    tourBtn.innerHTML = `
      <span class="material-symbols-outlined text-[16px]">explore</span>
      <span class="guide-full-text">3分鐘簡報導覽</span>
      <span class="guide-short-text">簡報導覽</span>
    `;
  } else {
    tourBtn.innerHTML = `
      <span class="material-symbols-outlined text-[16px]">close</span>
      <span class="guide-full-text">結束導覽</span>
      <span class="guide-short-text">結束</span>
    `;
  }
}

function stopGuidedTour() {
  AppState.tourActive = false;
  AppState.tourStep = 0;
  const overlay = document.getElementById("tour-overlay-element");
  if (overlay) overlay.style.opacity = "0";
  const card = document.getElementById("tour-card-element");
  if (card) card.remove();
  document.querySelectorAll(".tour-highlight").forEach(e => e.classList.remove("tour-highlight"));
  refreshGuideTourButton();
}

// ==========================================================================
// 10. 動態微粒子與特效系統 (CSS Particles Generator)
// ==========================================================================

// 金幣噴射特效
function triggerCoinParticles(startX, startY, isHeart = false) {
  const container = document.body;
  const coinsCount = 8;
  
  // 獲取金幣目標欄位 ( sidebar 金幣顯示的位置 )
  const targetEl = document.getElementById("pet-coins");
  const targetRect = targetEl ? targetEl.getBoundingClientRect() : { left: 50, top: 150 };
  const tx = targetRect.left + 10;
  const ty = targetRect.top + 10;
  
  for (let i = 0; i < coinsCount; i++) {
    const particle = document.createElement("div");
    particle.className = "coin-particle";
    particle.innerHTML = isHeart ? "❤️" : "🪙";
    particle.style.left = `${startX}px`;
    particle.style.top = `${startY}px`;
    
    // 隨機向四周炸開的二次貝氏曲線控制點坐標偏移
    const dx = (Math.random() - 0.5) * 150;
    const dy = (Math.random() - 0.5) * 80;
    
    particle.style.setProperty('--dx', `${dx}px`);
    particle.style.setProperty('--dy', `${dy}px`);
    particle.style.setProperty('--tx', `${tx - startX}px`);
    particle.style.setProperty('--ty', `${ty - startY}px`);
    
    // 稍微延遲播放，形成依序飛出的流星雨視覺感
    particle.style.animationDelay = `${i * 60}ms`;
    
    container.appendChild(particle);
    
    // 動畫結束自動刪除
    setTimeout(() => {
      particle.remove();
    }, 1100 + i * 60);
  }
}

// 浮動文字提示
function showFloatingText(x, y, text, color = "#fff") {
  const floating = document.createElement("div");
  floating.className = "floating-text";
  floating.innerText = text;
  floating.style.left = `${x - 20}px`;
  floating.style.top = `${y}px`;
  floating.style.color = color;
  
  document.body.appendChild(floating);
  
  setTimeout(() => {
    floating.remove();
  }, 1200);
}

// 深淺模式切換
function toggleDarkMode() {
  const html = document.documentElement;
  const icon = document.getElementById("dark-mode-icon");
  
  if (html.classList.contains("dark")) {
    html.classList.remove("dark");
    html.classList.add("light");
    if (icon) icon.innerText = "dark_mode";
  } else {
    html.classList.remove("light");
    html.classList.add("dark");
    if (icon) icon.innerText = "light_mode";
  }
}

// ==========================================================================
// 11. Modal 彈窗控制 (Dialog Helpers)
// ==========================================================================

function openReplyModal(parentId = "") {
  document.getElementById("reply-parent-id").value = parentId;
  
  // 如果之前畫過圖解，顯示附加指示
  const attachedWrapper = document.getElementById("reply-attached-annotation-wrapper");
  const attachedPreview = document.getElementById("reply-attached-annotation-preview");
  if (AppState.attachedDrawingUrl) {
    attachedWrapper.classList.remove("hidden");
    attachedPreview.src = AppState.attachedDrawingUrl;
  } else {
    attachedWrapper.classList.add("hidden");
  }
  
  const modal = document.getElementById("reply-modal");
  modal.classList.remove("hidden");
  modal.offsetHeight; // reflow
  modal.classList.remove("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-95");
  modal.querySelector(".transform").classList.add("scale-100");
}

function closeReplyModal() {
  const modal = document.getElementById("reply-modal");
  modal.classList.add("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-100");
  modal.querySelector(".transform").classList.add("scale-95");
  
  setTimeout(() => {
    modal.classList.add("hidden");
    // 移除 tour-highlight (如果是導覽進行中)
    document.getElementById("btn-add-answer").classList.remove("tour-highlight");
  }, 250);
}

function openAskModal() {
  AppState.editingPostId = null;
  setAskModalMode("create");

  // 同步目前擁有的金幣顯示限制
  document.getElementById("ask-user-coins").innerText = AppState.pet.coins;
  document.getElementById("ask-title").value = "";
  document.getElementById("ask-tags").value = "";
  document.getElementById("ask-content").value = "";
  document.getElementById("ask-bounty").value = "10";
  resetAskAttachmentArea();
  const warning = document.getElementById("ask-warning");
  if (warning) warning.style.display = "none";
  
  // 預設選擇目前所在的學院看板
  const askBoardSelect = document.getElementById("ask-board");
  if (AppState.activeDeptId !== "all" && AppState.boards[AppState.activeDeptId]) {
    askBoardSelect.value = AppState.activeDeptId;
  } else {
    askBoardSelect.value = AppState.discussionFilterBoardId && AppState.discussionFilterBoardId !== "all" ? AppState.discussionFilterBoardId : "cmee";
  }
  
  handleAskBoardChange();
  syncAskTemplate();
  showAskModalShell();
}

function openEditActivePost() {
  const record = findPostRecordById(AppState.activePostId);
  if (!record) {
    alert("找不到要編輯的文章！");
    return;
  }

  const { post, boardId } = record;
  AppState.editingPostId = post.id;
  setAskModalMode("edit");

  document.getElementById("ask-user-coins").innerText = AppState.pet.coins;
  document.getElementById("ask-board").value = boardId;
  handleAskBoardChange();

  const deptSelect = document.getElementById("ask-dept");
  if (deptSelect) deptSelect.value = post.department || AppState.boards[boardId].departments[0];

  document.getElementById("ask-bounty").value = post.bounty || 10;
  document.getElementById("ask-title").value = post.title || "";
  document.getElementById("ask-tags").value = (post.tags || []).join(", ");
  document.getElementById("ask-content").value = post.content || "";

  const warning = document.getElementById("ask-warning");
  if (warning) warning.style.display = "none";

  selectImageTemplate(getTemplateTypeFromPostImage(post.image));
  loadAskAttachmentFromPost(post.image);
  showAskModalShell();
}

function closeAskModal() {
  const modal = document.getElementById("ask-modal");
  modal.classList.add("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-100");
  modal.querySelector(".transform").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
    if (AppState.editingPostId) {
      AppState.editingPostId = null;
      setAskModalMode("create");
    }
    resetAskAttachmentArea();
  }, 250);
}

function openCreateStudyModal() {
  const modal = document.getElementById("create-study-modal");
  modal.classList.remove("hidden");
  modal.offsetHeight; // reflow
  modal.classList.remove("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-95");
  modal.querySelector(".transform").classList.add("scale-100");
}

function closeCreateStudyModal() {
  const modal = document.getElementById("create-study-modal");
  modal.classList.add("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-100");
  modal.querySelector(".transform").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 250);
}

function openCouponModal() {
  const modal = document.getElementById("coupon-modal");
  modal.classList.remove("hidden");
  modal.offsetHeight; // reflow
  modal.classList.remove("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-95");
  modal.querySelector(".transform").classList.add("scale-100");
}

function closeCouponModal() {
  const modal = document.getElementById("coupon-modal");
  modal.classList.add("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-100");
  modal.querySelector(".transform").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 250);
}

function openProfileModal() {
  switchMainTab("profile");
}

function closeProfileModal() {
  // Profile is now a tab, no need to hide
}


function getDefaultAvatarUrl(gender) {
  const maleAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuHaUoUmD0NCQT0xkjGAhDfZcg0aBzllN0eFaNJtLBJf8cc_LGkd5eJLBbe92XyjZcFmqtTtPMy4nmqui7orI5FCwxtzZipXn7IT-ADqLhM-YTMnLuhwW5IkvAQb9VJ8EQNXDa-NeT0hvQnvHccj3YXgjW3PbfLOycAjzkdgDJWR7eHCVwig2L_UZfEHNjKWxKHhiTtGZPC5nhE25w7fJW4k4D14gGtDhExwWSmAB903j0EwwVPcfvR4EdG5X-hEsi442t72MF0CECQ";
  const femaleAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuD6nYakPwha1xLE6ySgmmA3ALzCOIWvd5yKYtNc6I559vHmzcy6tuMKiyMt_XVU9C_i2EE6LXL3kR7esJW5Vpg8sdOkC99wKCsBwwj-CV7gOl85EXPmZozLCJMLTjfCgo1E6AQrurCE2oitnwoxspLZLgSj20zFdeIiRstXmq7pUoQT_fSqQiKZGslhXyPRUYFNP29JUCFo5YTkvdhoZJRshYhOdgiFeOqTl5IYb-_t46ECQsIlHcmedAhJ2jr9xN-EwM-PC-MeQ0SO";
  return gender === "male" ? maleAvatar : femaleAvatar;
}

function updateAvatarPreview() {
  const preview = document.getElementById("profile-avatar-preview");
  if (!preview) return;
  preview.src = AppState.user.avatarDataUrl || getDefaultAvatarUrl(AppState.user.gender || "female");
}

function handleAvatarUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("請上傳圖片檔案。");
    event.target.value = "";
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    AppState.user.avatarDataUrl = reader.result;
    updateAvatarPreview();
    saveState();
    renderUserAndPet();
  };
  reader.readAsDataURL(file);
}

function clearCustomAvatar() {
  delete AppState.user.avatarDataUrl;
  const upload = document.getElementById("profile-avatar-upload");
  if (upload) upload.value = "";
  updateAvatarPreview();
  saveState();
  renderUserAndPet();
}

function switchRole(role, redirectToProfessor = false) {
  const nextRole = role || "student";
  const previousRole = AppState.user.role || "student";

  if (nextRole === "admin" && previousRole !== "admin" && !requireAdminPassword()) {
    syncRoleSelects(previousRole);
    setPetStatus("tired", "🔒 系統管理員密碼錯誤，已取消切換身分。", 3500);
    return false;
  }

  AppState.user.role = nextRole;
  syncRoleSelects(AppState.user.role);

  const professorTab = document.getElementById("top-tab-professor");
  const adminTab = document.getElementById("top-tab-admin");
  if (professorTab) professorTab.style.display = AppState.user.role === "professor" ? "flex" : "none";
  if (adminTab) adminTab.style.display = AppState.user.role === "admin" ? "flex" : "none";
  refreshGuideTourButton();

  saveState();
  renderUserAndPet();

  if (redirectToProfessor && AppState.user.role === "professor") {
    window.location.href = "stitch_studypet_village 2/_14/code.html";
  } else if (redirectToProfessor && AppState.user.role === "admin") {
    switchMainTab("admin");
  }
  return true;
}

function handleHeaderRoleChange(role) {
  switchRole(role, true);
}

// 儲存個人檔案修改
function saveProfileData() {
  const nameInput = document.getElementById("profile-name");
  const deptSelect = document.getElementById("profile-dept");
  const mascotSelect = document.getElementById("profile-mascot-type");
  const genderSelect = document.getElementById("profile-gender");
  const roleSelect = document.getElementById("profile-role");
  
  if (nameInput.value.trim()) {
    AppState.user.username = nameInput.value.trim();
  }
  AppState.user.department = deptSelect.value;
  AppState.pet.mascotType = mascotSelect.value;
  if (genderSelect) {
    AppState.user.gender = genderSelect.value;
  }
  const selectedRole = roleSelect ? roleSelect.value : (AppState.user.role || "student");
  const roleChanged = switchRole(selectedRole, false);
  if (!roleChanged) {
    renderUserAndPet();
    saveState();
    return;
  }

  renderUserAndPet();
  saveState();
  setPetStatus("happy", "👤 個人設定修改成功！電子雞外型、性別與頭像已同步更新！");
  if (AppState.user.role === "professor") {
    setTimeout(() => { window.location.href = "stitch_studypet_village 2/_14/code.html"; }, 300);
  } else if (AppState.user.role === "admin") {
    setTimeout(() => { switchMainTab("admin"); }, 300);
  }
}

function selectMascotInModal(type) {
  const input = document.getElementById("profile-mascot-type");
  if (input) input.value = type;
  
  document.querySelectorAll("[id^='mcard-']").forEach(b => {
    b.classList.remove("border-primary", "bg-surface-container-low");
    b.classList.add("border-outline-variant/40");
  });
  
  const activeBtn = document.getElementById("mcard-" + type);
  if (activeBtn) {
    activeBtn.classList.add("border-primary", "bg-surface-container-low");
    activeBtn.classList.remove("border-outline-variant/40");
  }
}


// ==========================================================================
// 11.5 發問圖片上傳與筆刷標註功能
// ==========================================================================

function resetAskAttachmentArea() {
  AppState.askUploadedImageUrl = null;
  AppState.askDoodleBaseUrl = null;
  AppState.askDoodleHasContent = false;
  AppState.askCanvasTool = "pen";
  const input = document.getElementById("ask-upload-image");
  if (input) input.value = "";
  const area = document.getElementById("ask-doodle-area");
  if (area) area.classList.add("hidden");
  const canvas = document.getElementById("ask-doodle-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function handleAskImageUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("請選擇圖片檔案！");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    AppState.askUploadedImageUrl = reader.result;
    openAskDoodleCanvas(reader.result);
  };
  reader.readAsDataURL(file);
}

function openAskDoodleCanvas(baseUrl = null) {
  const area = document.getElementById("ask-doodle-area");
  const canvas = document.getElementById("ask-doodle-canvas");
  if (!area || !canvas) return;
  area.classList.remove("hidden");
  AppState.askCanvasCtx = canvas.getContext("2d");
  if (baseUrl || AppState.askUploadedImageUrl || !AppState.askDoodleHasContent) {
    loadAskAttachmentToCanvas(baseUrl || AppState.askUploadedImageUrl || null);
  }
}

function loadAskAttachmentToCanvas(baseUrl = null) {
  const canvas = document.getElementById("ask-doodle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  AppState.askCanvasCtx = ctx;
  AppState.askDoodleBaseUrl = baseUrl || null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!baseUrl) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px sans-serif";
    ctx.fillText("可在此直接畫圖、寫公式或標註卡關處。", 24, 36);
    AppState.askDoodleHasContent = true;
    return;
  }
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (canvas.width - w) / 2;
    const y = (canvas.height - h) / 2;
    ctx.drawImage(img, x, y, w, h);
    AppState.askDoodleHasContent = true;
  };
  img.src = baseUrl;
}

function loadAskAttachmentFromPost(imageValue) {
  resetAskAttachmentArea();
  if (typeof imageValue === "string" && imageValue.startsWith("data:image")) {
    AppState.askUploadedImageUrl = imageValue;
    const area = document.getElementById("ask-doodle-area");
    if (area) area.classList.remove("hidden");
    setTimeout(() => loadAskAttachmentToCanvas(imageValue), 60);
  }
}

function getAskAttachmentImageValue() {
  const area = document.getElementById("ask-doodle-area");
  const canvas = document.getElementById("ask-doodle-canvas");
  if (area && canvas && !area.classList.contains("hidden") && AppState.askDoodleHasContent) {
    return canvas.toDataURL("image/png");
  }
  return null;
}

function getAskCanvasPointer(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const clientX = event.clientX !== undefined ? event.clientX : (event.touches && event.touches[0] ? event.touches[0].clientX : 0);
  const clientY = event.clientY !== undefined ? event.clientY : (event.touches && event.touches[0] ? event.touches[0].clientY : 0);
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

function initAskDoodleCanvasListeners() {
  const canvas = document.getElementById("ask-doodle-canvas");
  if (!canvas || canvas.dataset.bound === "true") return;
  canvas.dataset.bound = "true";
  const start = (e) => {
    e.preventDefault();
    AppState.askDrawingMode = true;
    const pt = getAskCanvasPointer(e, canvas);
    AppState.askLastX = pt.x;
    AppState.askLastY = pt.y;
  };
  const move = (e) => {
    if (!AppState.askDrawingMode) return;
    e.preventDefault();
    const ctx = AppState.askCanvasCtx || canvas.getContext("2d");
    AppState.askCanvasCtx = ctx;
    const pt = getAskCanvasPointer(e, canvas);
    ctx.beginPath();
    ctx.moveTo(AppState.askLastX, AppState.askLastY);
    ctx.lineTo(pt.x, pt.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (AppState.askCanvasTool === "eraser") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = 18;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 3;
    }
    ctx.stroke();
    AppState.askLastX = pt.x;
    AppState.askLastY = pt.y;
    AppState.askDoodleHasContent = true;
  };
  const end = () => { AppState.askDrawingMode = false; };
  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  canvas.addEventListener("mouseup", end);
  canvas.addEventListener("mouseleave", end);
  canvas.addEventListener("touchstart", start, { passive: false });
  canvas.addEventListener("touchmove", move, { passive: false });
  canvas.addEventListener("touchend", end);
}

function setAskDoodleTool(tool) {
  AppState.askCanvasTool = tool;
  const pen = document.getElementById("ask-brush-pen");
  const eraser = document.getElementById("ask-brush-eraser");
  if (pen && eraser) {
    pen.className = "px-3 py-1 rounded border font-semibold " + (tool === "pen" ? "border-blue-500 text-blue-600 bg-blue-50" : "border-outline-variant text-secondary");
    eraser.className = "px-3 py-1 rounded border font-semibold " + (tool === "eraser" ? "border-blue-500 text-blue-600 bg-blue-50" : "border-outline-variant text-secondary");
  }
}

function clearAskDoodleCanvas() {
  loadAskAttachmentToCanvas(AppState.askDoodleBaseUrl);
}

function removeAskAttachment() {
  resetAskAttachmentArea();
}

function escapeHtml(text) {
  return String(text ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}

function collectUserQuestions() {
  const seen = new Set();
  const posts = [];
  const username = AppState.user.username;
  for (const boardId in AppState.boards) {
    const board = AppState.boards[boardId];
    (board.posts || []).forEach(post => {
      const isMine = String(post.id || "").startsWith("post-") || post.author === username;
      if (!isMine || seen.has(post.id)) return;
      seen.add(post.id);
      posts.push({ ...post, boardId, boardName: board.name });
    });
  }
  try {
    const customPosts = JSON.parse(localStorage.getItem("studypet_custom_posts") || "[]");
    customPosts.forEach((post, index) => {
      const id = post.id || `custom-${index}`;
      if (seen.has(id)) return;
      seen.add(id);
      posts.push({
        id,
        boardId: post.boardId || "custom",
        boardName: post.boardName || "討論版",
        title: post.title || "未命名問題",
        content: post.content || "",
        timestamp: post.timestamp || "剛剛",
        bounty: post.bounty || 10,
        solved: !!post.solved,
        tags: [post.deptName].filter(Boolean)
      });
    });
  } catch (e) {}
  return posts.sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
}

function renderProfileQuestionHistory() {
  const list = document.getElementById("profile-question-history-list");
  const count = document.getElementById("profile-question-history-count");
  const hint = document.getElementById("profile-question-history-page-hint");
  if (!list) return;
  const posts = collectUserQuestions();
  if (count) count.textContent = `${posts.length} 筆`;
  if (hint) hint.textContent = posts.length > 3 ? `可捲動查看 ${posts.length} 筆` : `共 ${posts.length} 筆`;
  if (posts.length === 0) {
    list.innerHTML = `<div class="text-xs text-secondary text-center py-6 border border-dashed border-outline-variant/40 rounded-xl">目前還沒有提問紀錄。發佈第一個問題後，這裡會自動出現紀錄。</div>`;
    return;
  }
  list.innerHTML = posts.map(post => {
    const canOpen = findPostRecordById(post.id);
    const openAction = canOpen ? `onclick="showPostDetail('${post.id}')"` : `onclick="switchMainTab('discussion')"`;
    return `
      <div class="p-3 rounded-xl border border-outline-variant/20 bg-surface-container-low dark:bg-surface cursor-pointer hover:shadow-sm transition-all" ${openAction}>
        <div class="flex items-center justify-between gap-2 mb-1">
          <h3 class="font-bold text-primary text-sm line-clamp-1">${escapeHtml(post.title)}</h3>
          <span class="text-[10px] px-2 py-0.5 rounded-full ${post.solved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${post.solved ? '已解決' : '未解決'}</span>
        </div>
        <p class="text-xs text-secondary line-clamp-2 mb-2">${escapeHtml(post.content)}</p>
        <div class="flex flex-wrap gap-1 text-[10px] text-secondary">
          <span class="px-2 py-0.5 rounded bg-primary/10 text-primary">${escapeHtml(post.boardName)}</span>
          <span class="px-2 py-0.5 rounded bg-tertiary-container text-on-tertiary-container">🪙 ${escapeHtml(post.bounty)} 金幣</span>
          <span>${escapeHtml(post.timestamp)}</span>
        </div>
      </div>`;
  }).join("");
  list.scrollTop = 0;
}

// ==========================================================================
// 12. 紅筆 Canvas 手繪塗鴉標記功能 (Drawing Logic)
// ==========================================================================

function openCanvasModal() {
  const modal = document.getElementById("canvas-modal");
  modal.classList.remove("hidden");
  modal.offsetHeight; // reflow
  modal.classList.remove("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-95");
  modal.querySelector(".transform").classList.add("scale-100");
  
  // 延遲載入背景圖片範本並初始化畫布
  setTimeout(() => {
    const canvas = document.getElementById("paint-canvas");
    if (canvas) {
      AppState.canvasCtx = canvas.getContext("2d");
      
      // 載入當前文章的考題背景
      const post = getActivePost();
      const bgImg = post ? post.image : "mock_math_hw";
      drawHomeworkTemplate("paint-canvas", bgImg, AppState.attachedDrawingUrl);
    }
  }, 100);
}

function closeCanvasModal() {
  const modal = document.getElementById("canvas-modal");
  modal.classList.add("opacity-0");
  modal.querySelector(".transform").classList.remove("scale-100");
  modal.querySelector(".transform").classList.add("scale-95");
  setTimeout(() => {
    modal.classList.add("hidden");
  }, 250);
}

function initPaintCanvasListeners() {
  const canvas = document.getElementById("paint-canvas");
  if (!canvas) return;
  
  // 滑鼠按住開始畫線
  canvas.addEventListener("mousedown", (e) => {
    AppState.drawingMode = true;
    const rect = canvas.getBoundingClientRect();
    AppState.lastX = e.clientX - rect.left;
    AppState.lastY = e.clientY - rect.top;
  });
  
  // 滑鼠拖曳繪圖
  canvas.addEventListener("mousemove", (e) => {
    if (!AppState.drawingMode || !AppState.canvasCtx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    AppState.canvasCtx.beginPath();
    AppState.canvasCtx.moveTo(AppState.lastX, AppState.lastY);
    AppState.canvasCtx.lineTo(x, y);
    
    if (AppState.canvasTool === "pen") {
      AppState.canvasCtx.strokeStyle = "#ef4444"; // 紅筆
      AppState.canvasCtx.lineWidth = 3;
      AppState.canvasCtx.globalCompositeOperation = "source-over";
    } else {
      AppState.canvasCtx.globalCompositeOperation = "destination-out"; // 橡皮擦
      AppState.canvasCtx.lineWidth = 20;
    }
    
    AppState.canvasCtx.stroke();
    AppState.lastX = x;
    AppState.lastY = y;
  });
  
  canvas.addEventListener("mouseup", () => AppState.drawingMode = false);
  canvas.addEventListener("mouseleave", () => AppState.drawingMode = false);
}

function setCanvasTool(tool) {
  AppState.canvasTool = tool;
  const pen = document.getElementById("canvas-tool-pen");
  const eraser = document.getElementById("canvas-tool-eraser");
  
  if (tool === "pen") {
    pen.classList.add("bg-red-500/10", "border-red-500", "text-red-500");
    eraser.classList.remove("bg-red-500/10", "border-red-500", "text-red-500");
  } else {
    eraser.classList.add("bg-red-500/10", "border-red-500", "text-red-500");
    pen.classList.remove("bg-red-500/10", "border-red-500", "text-red-500");
  }
}

function clearCanvasPaint() {
  if (!AppState.canvasCtx) return;
  const post = getActivePost();
  const bgImg = post ? post.image : "mock_math_hw";
  drawHomeworkTemplate("paint-canvas", bgImg);
}

// 完成標註並儲存
function saveCanvasAnnotation() {
  const canvas = document.getElementById("paint-canvas");
  if (!canvas) return;
  
  // 模擬將塗鴉層轉為 base64 URL 並暫存
  // 因為背景是考題圖，我們其實可以只擷取標記，這裡我們只將 Canvas 轉成圖片 URL
  AppState.attachedDrawingUrl = canvas.toDataURL();
  
  closeCanvasModal();
  
  // 如果我們在 Q&A 詳情頁，可以直接提示
  setPetStatus("happy", "🎨 已成功附加手寫紅筆標註塗鴉！快點選『我來解答』送出你的回答吧！");
  
  // 簡導航引導步驟 3 點擊完標註跳往下一步
  if (AppState.tourActive && AppState.tourStep === 3) {
    // 開啟回覆 modal
    setTimeout(() => {
      openReplyModal();
      // 在 modal 中填寫預設值以加速簡報
      document.getElementById("reply-author").value = "電機三學霸";
      document.getElementById("reply-text").value = "代入 r=3 可知 A = 1/2。針對 x^2 部分，代回特解可推導出 B=1/2, C=3/2, D=7/4。如我在圖片中紅筆圈起處，特解 y_p 部分計算完全無誤！";
      
      // 高亮回覆 modal 的「送出回答」按鈕
      setTimeout(() => {
        const submitBtn = document.querySelector("#reply-modal button[onclick='submitReply()']");
        if (submitBtn) submitBtn.classList.add("tour-highlight");
      }, 300);
    }, 500);
  }
}

// 根據寵物角色與狀態動態生成 SVG 的具體 Path 內容
function getMascotSvgContent(mascotType, status) {
  let svg = "";
  
  // 注入全域漸變及濾鏡定義
  const defs = `
    <defs>
      <!-- Robot Gradients -->
      <linearGradient id="robotBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#64748b" />
        <stop offset="100%" stop-color="#334155" />
      </linearGradient>
      <linearGradient id="robotHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#94a3b8" />
        <stop offset="100%" stop-color="#475569" />
      </linearGradient>
      <!-- Dog Gradients -->
      <linearGradient id="dogBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#b45309" />
      </linearGradient>
      <linearGradient id="dogHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fbbf24" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
      <!-- Cat Gradients -->
      <linearGradient id="catBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#475569" />
        <stop offset="100%" stop-color="#1e293b" />
      </linearGradient>
      <linearGradient id="catHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#64748b" />
        <stop offset="100%" stop-color="#334155" />
      </linearGradient>
      <!-- Pig Gradients -->
      <linearGradient id="pigBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f472b6" />
        <stop offset="100%" stop-color="#be185d" />
      </linearGradient>
      <linearGradient id="pigHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#fda4af" />
        <stop offset="100%" stop-color="#e11d48" />
      </linearGradient>
      <!-- Rabbit Gradients -->
      <linearGradient id="rabbitBodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#cbd5e1" />
      </linearGradient>
      <linearGradient id="rabbitHeadGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" />
        <stop offset="100%" stop-color="#e2e8f0" />
      </linearGradient>
      
      <!-- Glow Filters -->
      <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
  `;
  
  svg += defs;
  
  if (mascotType === "robot") {
    // ------------------ ROBOT ------------------
    let eyeColor = "#10b981"; // green
    let eyeFilter = 'filter="url(#glowGreen)"';
    let mouthPath = "M 88,78 Q 100,86 112,78"; // smiling
    let antennaColor = "#10b981";
    let extraElements = "";
    
    if (status === "tired") {
      eyeColor = "#ef4444";
      eyeFilter = 'filter="url(#glowRed)"';
      mouthPath = "M 88,82 Q 100,74 112,82"; // sad/frown
      antennaColor = "#ef4444";
      extraElements = `
        <!-- Warning indicator on screen -->
        <rect x="94" y="125" width="12" height="12" rx="2" fill="#ef4444" opacity="0.8" class="animate-pulse" />
        <text x="100" y="134" font-size="9" fill="#fff" font-weight="bold" text-anchor="middle">!</text>
      `;
    } else if (status === "eating") {
      eyeColor = "#f59e0b"; // orange/yellow
      eyeFilter = 'filter="url(#glowYellow)"';
      mouthPath = "M 92,80 L 108,80"; // straight mouth
      antennaColor = "#f59e0b";
      extraElements = `
        <!-- Electric sparks / food particles -->
        <circle cx="85" cy="85" r="2.5" fill="#f59e0b" />
        <circle cx="115" cy="85" r="2" fill="#f59e0b" />
        <path d="M 97,90 L 100,95 L 103,90" stroke="#f59e0b" stroke-width="2" fill="none" />
      `;
    } else if (status === "happy") {
      eyeColor = "#10b981";
      eyeFilter = 'filter="url(#glowGreen)"';
      mouthPath = "M 86,76 Q 100,90 114,76"; // big smile
      antennaColor = "#10b981";
      extraElements = `
        <!-- Heart eyes overlay or happy status -->
        <path d="M 80,68 C 78,64 74,64 74,68 C 74,72 80,76 80,76 C 80,76 86,72 86,68 C 86,64 82,64 80,68" fill="#ec4899" />
        <path d="M 120,68 C 118,64 114,64 114,68 C 114,72 120,76 120,76 C 120,76 126,72 126,68 C 126,64 122,64 120,68" fill="#ec4899" />
        <ellipse cx="72" cy="80" rx="5" ry="3" fill="#ec4899" opacity="0.6" />
        <ellipse cx="128" cy="80" rx="5" ry="3" fill="#ec4899" opacity="0.6" />
      `;
    }
    
    svg += `
      <!-- Robot Arms -->
      <rect x="46" y="112" width="12" height="30" rx="6" fill="url(#robotBodyGrad)" />
      <rect x="142" y="112" width="12" height="30" rx="6" fill="url(#robotBodyGrad)" />
      <!-- Robot Neck -->
      <rect x="92" y="93" width="16" height="15" rx="2" fill="#475569" />
      <line x1="92" y1="100" x2="108" y2="100" stroke="#334155" stroke-width="2" />
      <!-- Robot Body -->
      <rect x="58" y="102" width="84" height="60" rx="12" fill="url(#robotBodyGrad)" stroke="#1e293b" stroke-width="2" />
      <rect x="68" y="112" width="64" height="40" rx="6" fill="#1e293b" />
      <!-- Battery Meter on Chest -->
      <rect x="80" y="122" width="40" height="18" rx="3" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
      <rect x="83" y="125" width="26" height="12" rx="1.5" fill="${status === 'tired' ? '#ef4444' : '#10b981'}" />
      <rect x="110" y="128" width="3" height="6" rx="1" fill="#475569" />
      
      <!-- Robot Head -->
      <rect x="54" y="42" width="92" height="56" rx="16" fill="url(#robotHeadGrad)" stroke="#1e293b" stroke-width="2.5" />
      <!-- Screen Face -->
      <rect x="62" y="48" width="76" height="44" rx="10" fill="#0f172a" />
      <!-- Antenna -->
      <line x1="100" y1="42" x2="100" y2="24" stroke="#475569" stroke-width="4" />
      <circle cx="100" cy="20" r="7" fill="${antennaColor}" ${eyeFilter} />
      
      <!-- Robot Eyes -->
      ${status !== 'happy' ? `
        <circle cx="82" cy="66" r="7" fill="${eyeColor}" ${eyeFilter} />
        <circle cx="118" cy="66" r="7" fill="${eyeColor}" ${eyeFilter} />
      ` : ''}
      
      <!-- Robot Mouth -->
      <path d="${mouthPath}" stroke="#38bdf8" stroke-width="3.5" fill="none" stroke-linecap="round" />
      
      <!-- Extra details -->
      ${extraElements}
    `;
    
  } else if (mascotType === "dog") {
    // ------------------ DOG ------------------
    let eyeElement = `
      <circle cx="82" cy="74" r="6.5" fill="#1e293b" />
      <circle cx="118" cy="74" r="6.5" fill="#1e293b" />
      <circle cx="80" cy="71" r="2" fill="#fff" />
      <circle cx="116" cy="71" r="2" fill="#fff" />
    `;
    let mouthElement = `
      <path d="M 92,86 Q 100,92 100,86 Q 100,92 108,86" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" />
    `;
    let earLeftY = "60";
    let earRightY = "60";
    let sweatEffect = "";
    
    if (status === "tired") {
      eyeElement = `
        <!-- Sleepy drooping eyes -->
        <path d="M 74,76 L 90,76" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />
        <path d="M 110,76 L 126,76" stroke="#1e293b" stroke-width="3" stroke-linecap="round" />
        <path d="M 76,73 Q 82,71 88,73" stroke="#b45309" stroke-width="1.5" fill="none" />
        <path d="M 112,73 Q 118,71 124,73" stroke="#b45309" stroke-width="1.5" fill="none" />
      `;
      mouthElement = `
        <!-- Tongue sticking out -->
        <path d="M 94,84 Q 100,88 106,84" stroke="#1e293b" stroke-width="2" fill="none" />
        <path d="M 97,85 C 97,93 103,93 103,85 Z" fill="#fda4af" stroke="#e11d48" stroke-width="1.5" />
        <line x1="100" y1="85" x2="100" y2="90" stroke="#e11d48" stroke-width="1" />
      `;
      earLeftY = "70";
      earRightY = "70";
      sweatEffect = `
        <!-- Sweat droplet -->
        <path d="M 134,55 Q 138,59 136,63 C 134,65 130,65 128,63 C 126,61 128,57 134,55" fill="#38bdf8" />
      `;
    } else if (status === "eating") {
      eyeElement = `
        <!-- Closed happy eyes -->
        <path d="M 76,76 Q 83,70 90,76" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d="M 110,76 Q 117,70 124,76" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />
      `;
      mouthElement = `
        <!-- Big open mouth chewing bone -->
        <path d="M 92,84 Q 100,98 108,84 Z" fill="#fda4af" stroke="#1e293b" stroke-width="2" />
        <!-- Biscuit or Bone -->
        <rect x="94" y="80" width="12" height="6" rx="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" />
        <circle cx="93" cy="83" r="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" />
        <circle cx="93" cy="83" r="2" fill="#e2e8f0" />
        <circle cx="107" cy="83" r="2" fill="#e2e8f0" stroke="#94a3b8" stroke-width="1.5" />
      `;
    } else if (status === "happy") {
      eyeElement = `
        <!-- Sparkling curved eyes -->
        <path d="M 74,78 Q 82,84 90,78" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d="M 110,78 Q 118,84 126,78" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />
        <!-- Pink cheeks -->
        <circle cx="70" cy="82" r="5" fill="#f43f5e" opacity="0.4" />
        <circle cx="130" cy="82" r="5" fill="#f43f5e" opacity="0.4" />
      `;
      mouthElement = `
        <!-- Big open smile -->
        <path d="M 90,83 Q 100,100 110,83 Z" fill="#f43f5e" stroke="#1e293b" stroke-width="2.5" />
        <path d="M 94,87 Q 100,94 106,87" fill="#fda4af" />
      `;
    }
    
    svg += `
      <!-- Dog Tail -->
      <path d="M 125,135 Q 150,120 145,100" stroke="url(#dogBodyGrad)" stroke-width="8" stroke-linecap="round" fill="none" />
      <path d="M 145,100 Q 148,95 145,90" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" />
      <!-- Dog Legs -->
      <rect x="70" y="145" width="16" height="18" rx="8" fill="url(#dogBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <rect x="114" y="145" width="16" height="18" rx="8" fill="url(#dogBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <!-- Dog Torso -->
      <rect x="64" y="106" width="72" height="46" rx="16" fill="url(#dogBodyGrad)" stroke="#1e293b" stroke-width="2" />
      <!-- Dog Collar -->
      <rect x="76" y="104" width="48" height="6" rx="2" fill="#ef4444" />
      <circle cx="100" cy="112" r="4" fill="url(#robotBodyGrad)" />
      
      <!-- Left Ear (Behind Head) -->
      <path d="M 60,60 C 40,60 40,${earLeftY} 46,95 C 48,105 56,105 58,95 C 60,85 66,70 66,60" fill="#b45309" stroke="#1e293b" stroke-width="2" />
      <!-- Right Ear (Behind Head) -->
      <path d="M 140,60 C 160,60 160,${earRightY} 154,95 C 152,105 144,105 142,95 C 140,85 134,70 134,60" fill="#b45309" stroke="#1e293b" stroke-width="2" />
      
      <!-- Dog Head -->
      <circle cx="100" cy="78" r="38" fill="url(#dogHeadGrad)" stroke="#1e293b" stroke-width="2.5" />
      
      <!-- Dog Eyes -->
      ${eyeElement}
      
      <!-- Dog Muzzle/Snout -->
      <ellipse cx="100" cy="85" rx="16" ry="11" fill="#fffbeb" stroke="#1e293b" stroke-width="1.5" />
      <ellipse cx="100" cy="79" rx="6" ry="4" fill="#1e293b" />
      
      <!-- Dog Mouth -->
      ${mouthElement}
      
      <!-- Sweat Effect -->
      ${sweatEffect}
    `;
    
  } else if (mascotType === "cat") {
    // ------------------ CAT ------------------
    let eyeElement = `
      <!-- Slanted cat eyes -->
      <ellipse cx="82" cy="74" rx="6" ry="8" fill="#10b981" />
      <ellipse cx="118" cy="74" rx="6" ry="8" fill="#10b981" />
      <rect x="81" y="67" width="2" height="14" rx="1" fill="#000" />
      <rect x="117" y="67" width="2" height="14" rx="1" fill="#000" />
      <circle cx="79" cy="71" r="1.5" fill="#fff" />
      <circle cx="115" cy="71" r="1.5" fill="#fff" />
    `;
    let mouthElement = `
      <path d="M 94,84 Q 100,87 100,84 Q 100,87 106,84" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
    `;
    let earsAnim = "";
    
    if (status === "tired") {
      eyeElement = `
        <!-- Sleeping eyes -->
        <path d="M 76,76 Q 83,82 90,76" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M 110,76 Q 117,82 124,76" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <!-- Tears -->
        <path d="M 80,78 Q 78,85 76,82" stroke="#38bdf8" stroke-width="1.5" fill="none" />
      `;
      mouthElement = `
        <line x1="94" y1="86" x2="106" y2="86" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
      `;
      earsAnim = `transform="rotate(-5, 100, 78)"`; // slightly drooping ears
    } else if (status === "eating") {
      eyeElement = `
        <!-- Squinting eating eyes -->
        <path d="M 76,73 L 88,77 L 78,81" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M 124,73 L 112,77 L 122,81" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
      `;
      mouthElement = `
        <!-- Eating fish -->
        <path d="M 93,82 Q 100,90 107,82 Z" fill="#fda4af" stroke="#1e293b" stroke-width="1.5" />
        <path d="M 102,81 L 114,88 M 114,88 L 111,83 M 114,88 L 109,89 M 106,84 L 108,82 M 109,86 L 111,84" stroke="#94a3b8" stroke-width="1.5" />
      `;
    } else if (status === "happy") {
      eyeElement = `
        <!-- Heart eyes -->
        <path d="M 82,78 C 80,74 76,74 76,78 C 76,82 82,86 82,86 C 82,86 88,82 88,78 C 88,74 84,74 82,78 Z" fill="#f43f5e" />
        <path d="M 118,78 C 116,74 112,74 112,78 C 112,82 118,86 118,86 C 118,86 124,82 124,78 C 124,74 120,74 118,78 Z" fill="#f43f5e" />
        <circle cx="70" cy="84" r="4.5" fill="#f43f5e" opacity="0.4" />
        <circle cx="130" cy="84" r="4.5" fill="#f43f5e" opacity="0.4" />
      `;
      mouthElement = `
        <path d="M 90,83 Q 100,97 110,83 Z" fill="#fda4af" stroke="#1e293b" stroke-width="2" />
      `;
    }
    
    svg += `
      <!-- Cat Tail -->
      <path d="M 125,135 Q 160,140 150,110 Q 140,80 155,70" stroke="url(#catBodyGrad)" stroke-width="6" stroke-linecap="round" fill="none" />
      <!-- Cat Legs -->
      <rect x="74" y="142" width="14" height="18" rx="7" fill="url(#catBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <rect x="112" y="142" width="14" height="18" rx="7" fill="url(#catBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <!-- Cat Torso -->
      <rect x="66" y="108" width="68" height="42" rx="15" fill="url(#catBodyGrad)" stroke="#1e293b" stroke-width="2" />
      
      <g ${earsAnim}>
        <!-- Left Cat Ear -->
        <polygon points="66,56 86,46 72,25" fill="#475569" stroke="#1e293b" stroke-width="2" stroke-linejoin="round" />
        <polygon points="70,52 83,45 74,32" fill="#fda4af" />
        <!-- Right Cat Ear -->
        <polygon points="134,56 114,46 128,25" fill="#475569" stroke="#1e293b" stroke-width="2" stroke-linejoin="round" />
        <polygon points="130,52 117,45 126,32" fill="#fda4af" />
        
        <!-- Cat Head -->
        <circle cx="100" cy="78" r="35" fill="url(#catHeadGrad)" stroke="#1e293b" stroke-width="2.5" />
      </g>
      
      <!-- Whiskers -->
      <line x1="56" y1="80" x2="42" y2="78" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="56" y1="84" x2="40" y2="86" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="144" y1="80" x2="158" y2="78" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="144" y1="84" x2="160" y2="86" stroke="#cbd5e1" stroke-width="1.5" />
      
      <!-- Cat Eyes -->
      ${eyeElement}
      
      <!-- Nose -->
      <polygon points="97,80 103,80 100,83" fill="#fda4af" stroke="#1e293b" stroke-width="1" />
      
      <!-- Cat Mouth -->
      ${mouthElement}
    `;
    
  } else if (mascotType === "pig") {
    // ------------------ PIG ------------------
    let eyeElement = `
      <circle cx="84" cy="74" r="4.5" fill="#1e293b" />
      <circle cx="116" cy="74" r="4.5" fill="#1e293b" />
      <circle cx="82.5" cy="72" r="1.5" fill="#fff" />
      <circle cx="114.5" cy="72" r="1.5" fill="#fff" />
    `;
    let mouthElement = `
      <path d="M 94,92 Q 100,97 106,92" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
    `;
    let sweatEffect = "";
    
    if (status === "tired") {
      eyeElement = `
        <!-- Frowning tired eyes -->
        <path d="M 80,77 Q 84,72 88,77" stroke="#1e293b" stroke-width="2" fill="none" />
        <path d="M 112,77 Q 116,72 120,77" stroke="#1e293b" stroke-width="2" fill="none" />
      `;
      mouthElement = `
        <path d="M 94,95 Q 100,90 106,95" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
      `;
      sweatEffect = `
        <ellipse cx="78" cy="80" rx="4" ry="2.5" fill="#e11d48" opacity="0.3" />
        <ellipse cx="122" cy="80" rx="4" ry="2.5" fill="#e11d48" opacity="0.3" />
      `;
    } else if (status === "eating") {
      eyeElement = `
        <path d="M 80,72 Q 84,78 88,72" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M 112,72 Q 116,78 120,72" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
      `;
      mouthElement = `
        <circle cx="100" cy="94" r="4.5" fill="#be185d" stroke="#1e293b" stroke-width="1.5" />
      `;
    } else if (status === "happy") {
      eyeElement = `
        <path d="M 78,76 Q 84,70 90,76" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />
        <path d="M 110,76 Q 116,70 122,76" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />
        <circle cx="74" cy="80" r="5" fill="#f43f5e" opacity="0.4" />
        <circle cx="126" cy="80" r="5" fill="#f43f5e" opacity="0.4" />
      `;
      mouthElement = `
        <path d="M 92,92 Q 100,104 108,92 Z" fill="#e11d48" stroke="#1e293b" stroke-width="1.5" />
      `;
    }
    
    svg += `
      <!-- Pig Tail -->
      <path d="M 125,130 C 140,128 145,138 140,142 C 135,145 130,135 142,132" stroke="url(#pigBodyGrad)" stroke-width="4" stroke-linecap="round" fill="none" />
      <!-- Pig Legs -->
      <rect x="74" y="142" width="16" height="16" rx="8" fill="url(#pigBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <rect x="110" y="142" width="16" height="16" rx="8" fill="url(#pigBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <!-- Pig Torso -->
      <rect x="62" y="105" width="76" height="46" rx="20" fill="url(#pigBodyGrad)" stroke="#1e293b" stroke-width="2" />
      
      <!-- Pig Ears -->
      <polygon points="68,54 52,38 72,44" fill="#fda4af" stroke="#1e293b" stroke-width="1.5" stroke-linejoin="round" />
      <polygon points="132,54 148,38 128,44" fill="#fda4af" stroke="#1e293b" stroke-width="1.5" stroke-linejoin="round" />
      
      <!-- Pig Head -->
      <circle cx="100" cy="76" r="35" fill="url(#pigHeadGrad)" stroke="#1e293b" stroke-width="2.5" />
      
      <!-- Pig Eyes -->
      ${eyeElement}
      
      <!-- Pig Snout -->
      <ellipse cx="100" cy="83" rx="13" ry="9" fill="#fda4af" stroke="#1e293b" stroke-width="2" />
      <circle cx="95" cy="83" r="2.5" fill="#be185d" />
      <circle cx="105" cy="83" r="2.5" fill="#be185d" />
      
      <!-- Pig Mouth -->
      ${mouthElement}
      
      <!-- Sweat/Mud -->
      ${sweatEffect}
    `;
    
  } else if (mascotType === "rabbit") {
    // ------------------ RABBIT ------------------
    let eyeElement = `
      <circle cx="83" cy="74" r="5" fill="#1e293b" />
      <circle cx="117" cy="74" r="5" fill="#1e293b" />
      <circle cx="81.5" cy="72" r="1.5" fill="#fff" />
      <circle cx="115.5" cy="72" r="1.5" fill="#fff" />
    `;
    let mouthElement = `
      <path d="M 94,84 Q 100,88 100,84 Q 100,88 106,84" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
      <!-- Teeth -->
      <rect x="98" y="85" width="4" height="4" fill="#fff" stroke="#1e293b" stroke-width="1" />
    `;
    let earsElement = `
      <!-- Left Long Ear -->
      <rect x="74" y="12" width="14" height="42" rx="7" fill="url(#rabbitHeadGrad)" stroke="#1e293b" stroke-width="2" />
      <rect x="78" y="18" width="6" height="30" rx="3" fill="#fda4af" />
      <!-- Right Long Ear -->
      <rect x="112" y="12" width="14" height="42" rx="7" fill="url(#rabbitHeadGrad)" stroke="#1e293b" stroke-width="2" />
      <rect x="116" y="18" width="6" height="30" rx="3" fill="#fda4af" />
    `;
    
    if (status === "tired") {
      eyeElement = `
        <path d="M 78,78 Q 83,82 88,78" stroke="#1e293b" stroke-width="2" fill="none" />
        <path d="M 112,78 Q 117,82 122,78" stroke="#1e293b" stroke-width="2" fill="none" />
      `;
      mouthElement = `
        <line x1="95" y1="85" x2="105" y2="85" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
      `;
      earsElement = `
        <!-- Left Long Ear Drooping -->
        <g transform="rotate(-30, 81, 48)">
          <rect x="74" y="12" width="14" height="42" rx="7" fill="url(#rabbitHeadGrad)" stroke="#1e293b" stroke-width="2" />
          <rect x="78" y="18" width="6" height="30" rx="3" fill="#fda4af" />
        </g>
        <!-- Right Long Ear Drooping -->
        <g transform="rotate(30, 119, 48)">
          <rect x="112" y="12" width="14" height="42" rx="7" fill="url(#rabbitHeadGrad)" stroke="#1e293b" stroke-width="2" />
          <rect x="116" y="18" width="6" height="30" rx="3" fill="#fda4af" />
        </g>
      `;
    } else if (status === "eating") {
      eyeElement = `
        <path d="M 78,72 Q 83,78 88,72" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
        <path d="M 112,72 Q 117,78 122,72" stroke="#1e293b" stroke-width="2" fill="none" stroke-linecap="round" />
      `;
      mouthElement = `
        <circle cx="100" cy="85" r="3" fill="#fda4af" stroke="#1e293b" stroke-width="1.5" />
        <!-- Carrot piece -->
        <polygon points="101,84 112,80 114,86 102,87" fill="#f97316" />
        <polygon points="112,80 118,76 116,84" fill="#22c55e" />
      `;
    } else if (status === "happy") {
      eyeElement = `
        <path d="M 78,76 Q 83,70 88,76" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <path d="M 112,76 Q 117,70 122,76" stroke="#1e293b" stroke-width="2.5" fill="none" stroke-linecap="round" />
        <circle cx="70" cy="82" r="5" fill="#f43f5e" opacity="0.4" />
        <circle cx="130" cy="82" r="5" fill="#f43f5e" opacity="0.4" />
      `;
      mouthElement = `
        <path d="M 92,82 Q 100,96 108,82 Z" fill="#fda4af" stroke="#1e293b" stroke-width="2" />
      `;
    }
    
    svg += `
      <!-- Rabbit Tail -->
      <circle cx="68" cy="138" r="8" fill="url(#rabbitBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <!-- Rabbit Legs -->
      <rect x="74" y="142" width="16" height="16" rx="8" fill="url(#rabbitBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <rect x="110" y="142" width="16" height="16" rx="8" fill="url(#rabbitBodyGrad)" stroke="#1e293b" stroke-width="1.5" />
      <!-- Rabbit Torso -->
      <rect x="66" y="108" width="68" height="42" rx="16" fill="url(#rabbitBodyGrad)" stroke="#1e293b" stroke-width="2" />
      
      <!-- Rabbit Ears -->
      ${earsElement}
      
      <!-- Rabbit Head -->
      <circle cx="100" cy="76" r="34" fill="url(#rabbitHeadGrad)" stroke="#1e293b" stroke-width="2.5" />
      
      <!-- Rabbit Eyes -->
      ${eyeElement}
      
      <!-- Nose -->
      <polygon points="98,79 102,79 100,81" fill="#fda4af" stroke="#1e293b" stroke-width="1" />
      
      <!-- Rabbit Mouth -->
      ${mouthElement}
    `;
  } else {
    // ------------------ ZODIAC / EXTRA MASCOT GENERIC RENDER ------------------
    const zodiacMap = {
      rat: { emoji: "🐭", label: "棉花鼠", color: "#cbd5e1" },
      ox: { emoji: "🐮", label: "奶茶牛", color: "#d6d3d1" },
      tiger: { emoji: "🐯", label: "小橘虎", color: "#fdba74" },
      dragon: { emoji: "🐲", label: "薄荷龍", color: "#86efac" },
      snake: { emoji: "🐍", label: "青青蛇", color: "#bef264" },
      horse: { emoji: "🐴", label: "咖啡馬", color: "#c084fc" },
      goat: { emoji: "🐐", label: "小綿羊", color: "#f5f5f4" },
      monkey: { emoji: "🐵", label: "開心猴", color: "#facc15" },
      rooster: { emoji: "🐔", label: "棉花雞", color: "#fde68a" },
      panda: { emoji: "🐼", label: "熊貓", color: "#e5e7eb" }
    };
    const petInfo = zodiacMap[mascotType] || { emoji: "🤖", label: "電子雞", color: "#bfdbfe" };
    let mouth = `<path d="M 86,117 Q 100,129 114,117" stroke="#1e293b" stroke-width="3" fill="none" stroke-linecap="round" />`;
    let eyes = `<circle cx="82" cy="91" r="5" fill="#1e293b"/><circle cx="118" cy="91" r="5" fill="#1e293b"/><circle cx="80" cy="89" r="1.5" fill="#fff"/><circle cx="116" cy="89" r="1.5" fill="#fff"/>`;
    if (status === "tired") {
      eyes = `<path d="M 76,94 Q 82,99 88,94" stroke="#1e293b" stroke-width="3" fill="none"/><path d="M 112,94 Q 118,99 124,94" stroke="#1e293b" stroke-width="3" fill="none"/>`;
      mouth = `<line x1="92" y1="119" x2="108" y2="119" stroke="#1e293b" stroke-width="3" stroke-linecap="round"/>`;
    } else if (status === "happy") {
      eyes = `<path d="M 76,92 Q 82,84 88,92" stroke="#1e293b" stroke-width="3" fill="none"/><path d="M 112,92 Q 118,84 124,92" stroke="#1e293b" stroke-width="3" fill="none"/><circle cx="72" cy="101" r="5" fill="#f43f5e" opacity="0.35"/><circle cx="128" cy="101" r="5" fill="#f43f5e" opacity="0.35"/>`;
      mouth = `<path d="M 88,115 Q 100,134 112,115 Z" fill="#fda4af" stroke="#1e293b" stroke-width="2"/>`;
    } else if (status === "eating") {
      mouth = `<circle cx="100" cy="118" r="6" fill="#fda4af" stroke="#1e293b" stroke-width="2"/><circle cx="113" cy="116" r="5" fill="#facc15"/>`;
    }
    svg += `
      <ellipse cx="100" cy="142" rx="43" ry="18" fill="#0f172a" opacity="0.12"/>
      <rect x="62" y="101" width="76" height="48" rx="22" fill="${petInfo.color}" stroke="#1e293b" stroke-width="2"/>
      <circle cx="100" cy="78" r="39" fill="${petInfo.color}" stroke="#1e293b" stroke-width="2.5"/>
      <text x="100" y="80" text-anchor="middle" dominant-baseline="middle" font-size="42">${petInfo.emoji}</text>
      ${eyes}
      ${mouth}
      <text x="100" y="158" text-anchor="middle" font-size="11" fill="#334155" font-weight="700">${petInfo.label}</text>
    `;
  }
  
  // 覆蓋飾品配件如果有的話
  if (AppState.pet.equipped && AppState.pet.equipped.hat) {
    // 畢業帽學位帽
    svg += `
      <!-- Academic Graduate Hat Accessory -->
      <g transform="translate(0, 0)">
        <polygon points="100,20 60,32 100,44 140,32" fill="#1e293b" stroke="#0f172a" stroke-width="1.5" />
        <rect x="84" y="36" width="32" height="12" fill="#0f172a" />
        <!-- Tassel -->
        <path d="M 100,32 L 132,32 L 135,46" stroke="#f59e0b" stroke-width="1.5" fill="none" />
        <rect x="133" y="46" width="4" height="6" fill="#f59e0b" />
      </g>
    `;
  }
  
  if (AppState.pet.equipped && AppState.pet.equipped.rareStyle) {
    // 傳奇黃金皇冠
    svg += `
      <!-- Legendary Gold Crown Accessory -->
      <g transform="translate(0, -6)">
        <path d="M 84,42 L 80,26 L 90,34 L 100,20 L 110,34 L 120,26 L 116,42 Z" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
        <circle cx="80" cy="24" r="2.5" fill="#3b82f6" />
        <circle cx="100" cy="18" r="3" fill="#ef4444" />
        <circle cx="120" cy="24" r="2.5" fill="#10b981" />
      </g>
    `;
  }
  
  return svg;
}

// ==========================================================================
// 13. Pet HP Hourly Decay & Solved Filter Logic
// ==========================================================================

function checkHourlyPetHpDecay() {
  if (!AppState.pet.lastActivityTime) {
    AppState.pet.lastActivityTime = Date.now();
    AppState.pet.baseHp = AppState.pet.hp;
    saveState();
    return;
  }
  
  const elapsed = Date.now() - AppState.pet.lastActivityTime;
  const hoursElapsed = Math.floor(elapsed / (3600 * 1000));
  
  if (hoursElapsed >= 1) {
    const hpLoss = hoursElapsed * 10;
    const newHp = Math.max(0, AppState.pet.baseHp - hpLoss);
    
    if (AppState.pet.hp !== newHp) {
      AppState.pet.hp = newHp;
      AppState.pet.hearts = Math.ceil(newHp / 100);
      AppState.pet.lastActivityTime = Date.now() - (elapsed % (3600 * 1000));
      AppState.pet.baseHp = newHp;
      saveState();
      renderUserAndPet();
    }
  }
}

function simulateHourPass() {
  if (!AppState.pet.lastActivityTime) {
    AppState.pet.lastActivityTime = Date.now();
  }
  
  // Subtract 1 hour from last activity time to simulate time passing
  AppState.pet.lastActivityTime -= (3600 * 1000);
  
  // Deduct 10 HP
  AppState.pet.baseHp = Math.max(0, AppState.pet.baseHp - 10);
  AppState.pet.hp = AppState.pet.baseHp;
  AppState.pet.hearts = Math.ceil(AppState.pet.hp / 100);
  
  saveState();
  renderUserAndPet();
  
  setPetStatus("sad", "⏳ 模擬時間流逝了 1 小時，活力值扣除 10 點。");
}

function filterDiscussionByStatus(status) {
  AppState.discussionFilterStatus = status;
  renderDiscussionPosts();
}
