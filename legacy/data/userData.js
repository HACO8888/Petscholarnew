/**
 * 北科遊戲化學業交流區 - 使用者與寵物狀態資料 (6學院 25科系 - Object & Array 結構)
 */

const USER_DATA = {
  username: "新同學",
  department: "請選擇系所",
  gender: "female", // female, male
  reputation: 0,
  role: "student", // student, ta, professor, admin
  bio: "尚未填寫自我介紹。點擊編輯按鈕開始介紹自己吧！",
  level: 1,
  qaCount: 0
};

const PET_DATA = {
  name: "未命名小精靈",
  mascotType: "robot", // robot, dog, cat, pig, rabbit
  level: 1,
  exp: 0,
  maxExp: 100,
  hp: 500,              // 0-500 HP，對應愛心生命值
  maxHp: 500,
  hearts: 5,           // 1-5 顆愛心生命值 (對應 HP / 100)
  maxHearts: 5,
  coins: 100,           // 預設金幣為 100
  status: "happy",     // tired (疲憊), happy (高興), eating (吃東西), normal (正常)
  hasCheckedIn: false, // 每日簽到狀態
  badges: [],          // 已獲得徽章，初始無
  inventory: [],       // 已購買食材清單，例如 []
  lastActivityTime: 0, // 上次問答/餵食活動時間
  baseHp: 500,         // 上次活動時的基準生命值
  equipped: {          // 當前裝備的配件
    hat: false,
    background: false,
    rareStyle: false
  }
};

const SHOP_ITEMS = [
  // PRD 指定標準食物項目
  {
    id: "item-riceball",
    name: "學術飯糰 (基礎)",
    grade: "基礎",
    price: 10,
    hpRestore: 100,      // 恢復 100 HP (1顆愛心)
    expGain: 10,
    icon: "🍙",
    description: "熱騰騰的三角海苔飯糰，花費 10 金幣，可恢復 1 顆愛心與 10 經驗值！"
  },
  {
    id: "item-sandwich",
    name: "知識三明治 (基礎)",
    grade: "基礎",
    price: 15,
    hpRestore: 200,      // 恢復 200 HP (2顆愛心)
    expGain: 20,
    icon: "🥪",
    description: "營養均衡的三明治，花費 15 金幣，可恢復 2 顆愛心與 20 經驗值！"
  },
  {
    id: "item-chicken",
    name: "學霸大雞排 (普通)",
    grade: "普通",
    price: 25,
    hpRestore: 150,      // 恢復 1.5 顆愛心
    expGain: 15,
    icon: "🍗",
    description: "香脆美味的北科後門雞排，咬下一口能恢復 1.5 顆愛心與 15 經驗值！"
  },
  {
    id: "item-coffee",
    name: "爆肝手沖咖啡 (普通)",
    grade: "普通",
    price: 30,
    hpRestore: 225,      // 恢復 2.25 顆愛心
    expGain: 25,
    icon: "☕",
    description: "期末熬夜讀書必備！高濃度咖啡因，能恢復 2.25 顆愛心與 25 經驗值。"
  },
  {
    id: "item-bento",
    name: "滿分歐趴便當 (稀有)",
    grade: "稀有",
    price: 50,
    hpRestore: 500,     // 恢復 500 HP (5顆愛心)
    expGain: 50,
    icon: "🍱",
    description: "豐盛的雙主菜歐趴便當，花費 50 金幣，直接補滿 5 顆愛心與 50 經驗值！"
  },
  {
    id: "item-candy",
    name: "期末精緻歐趴糖 (史詩)",
    grade: "史詩",
    price: 120,
    hpRestore: 500,     // 恢復 500 HP (5顆愛心)
    expGain: 80,
    icon: "🍬",
    description: "學長姐精心挑選的All-Pass糖！花費 120 金幣，直接補滿 5 顆愛心與 80 經驗值，光速升級！"
  },
  // 裝飾配件商品
  {
    id: "item-hat",
    name: "學術魔力帽",
    price: 15,
    hpRestore: 0,
    expGain: 10,
    icon: "🎓",
    type: "accessory",
    accessoryType: "hat",
    description: "北科大專屬學位帽！花費 15 金幣，購買後可在養成商店點擊裝備，讓你的電子雞戴上它！"
  },
  {
    id: "item-background",
    name: "豪華霓虹自修室",
    price: 50,
    hpRestore: 0,
    expGain: 30,
    icon: "⛺",
    type: "accessory",
    accessoryType: "background",
    description: "黃金紫霓虹個人背景！花費 50 金幣，購買裝備後能使電子雞外框升級為發光特效！"
  },
  {
    id: "item-rareStyle",
    name: "耀眼傳奇黃金造型",
    price: 100,
    hpRestore: 0,
    expGain: 50,
    icon: "👑",
    type: "accessory",
    accessoryType: "rareStyle",
    description: "絕版黃金傳奇動物造型！花費 100 金幣，購買裝備後即可讓電子雞解鎖終極黃金炫彩外觀！"
  }
];

// 校園福利社折價券兌換清單
const WELFARE_ITEMS = [
  {
    id: "welfare-fries",
    name: "麥當勞大薯升級券",
    desc: "北科校內麥當勞專屬！中薯免費升級大薯，考試熬夜解饞必備。",
    icon: "🍟",
    reqType: "level",   // 兌換條件類型: level (等級) 或 badge (徽章)
    reqValue: 4,        // 需要寵物等級達到 4
    pointsCost: 0,
    redeemed: false,
    couponCode: "MCD-FRIES-UP-9928"
  },
  {
    id: "welfare-boba",
    name: "連鎖手搖飲免費加珍券",
    desc: "北科正門手搖特約店！購買大杯純茶免費加蜂蜜波霸珍珠一份。",
    icon: "🧋",
    reqType: "badge",
    reqValue: "解題達人", // 需要擁有「解題達人」徽章
    pointsCost: 0,
    redeemed: false,
    couponCode: "BOBA-FREE-ADD-8812"
  },
  {
    id: "welfare-waffle",
    name: "北科周邊特約鬆餅折10元",
    desc: "校園後門特約手作鬆餅，憑此券折抵任意口味鬆餅 10 元。",
    icon: "🧇",
    reqType: "badge",
    reqValue: "好學新手", // 需要擁有「好學新手」徽章
    pointsCost: 0,
    redeemed: false,
    couponCode: "WAFFLE-OFF-10-7734"
  },
  {
    id: "welfare-study-tea",
    name: "K書中心特大杯烏龍綠茶兌換券",
    desc: "達特定成就，免費獲得大杯冰烏龍綠茶一杯，邊讀邊喝超清涼！",
    icon: "🍵",
    reqType: "level",
    reqValue: 5,        // 需要寵物等級達到 5
    pointsCost: 0,
    redeemed: false,
    couponCode: "OULONG-TEA-FREE-6641"
  }
];

// 模擬週排行榜資料 (6學院排行 - Object & Array 結合)
const MOCK_LEADERBOARD = {
  weekly: [
    { name: "資工三林大師", dept: "資訊工程系", points: 280, rank: 1, avatar: "🐱" },
    { name: "電機二王學霸", dept: "電機工程系", points: 240, rank: 2, avatar: "🐶" },
    { name: "資財大三學姐", dept: "資訊與財金管理系", points: 210, rank: 3, avatar: "🐰" },
    { name: "機械系老齒輪", dept: "機械工程系", points: 140, rank: 4, avatar: "🐷" },
    { name: "新同學", dept: "請選擇系所", points: 0, rank: 99, avatar: "👤" } // 使用者
  ],
  department: {
    "cmee": [
      { name: "機械系老齒輪", points: 140, rank: 1, avatar: "🐷" },
      { name: "車輛四車神", points: 120, rank: 2, avatar: "🤖" },
      { name: "冷凍三空調王", points: 80, rank: 3, avatar: "🐶" }
    ],
    "ceecs": [
      { name: "電機二王學霸", points: 180, rank: 1, avatar: "🐶" },
      { name: "資訊工程大三", points: 150, rank: 2, avatar: "🐱" },
      { name: "新同學", points: 0, rank: 99, avatar: "👤" }
    ],
    "coe": [
      { name: "土木四結構大師", points: 165, rank: 1, avatar: "🤖" },
      { name: "化工三分子生技", points: 110, rank: 2, avatar: "🐰" }
    ],
    "com": [
      { name: "資財大三學姐", points: 190, rank: 1, avatar: "🐰" },
      { name: "工管二生產線", points: 130, rank: 2, avatar: "🤖" }
    ],
    "cod": [
      { name: "建築五爆肝俠", points: 175, rank: 1, avatar: "🐱" },
      { name: "互動四卡片設計", points: 145, rank: 2, avatar: "🐰" }
    ],
    "chss": [
      { name: "應英四學術翻譯", points: 135, rank: 1, avatar: "🐰" },
      { name: "文發三文創市集", points: 95, rank: 2, avatar: "🐷" }
    ]
  }
};

// 模擬檢舉資料庫
const MOCK_REPORTS = [
  {
    id: "rep-1",
    targetId: "ee-reply-1-1",
    targetText: "謝謝助教！那請問 y_p1 代回原方程式後的係數 A 會是多少呢？",
    type: "comment",
    reason: "不相關內容",
    reporter: "大一電機新鮮人",
    timestamp: "2026-06-08 11:45",
    status: "pending" // pending, resolved
  },
  {
    id: "rep-2",
    targetId: "im-post-1",
    targetText: "求解 Black-Scholes 模型中的 d1 意義與白話解釋",
    type: "post",
    reason: "錯誤分類或錯誤 Hashtag",
    reporter: "資管稽查小組",
    timestamp: "2026-06-08 12:10",
    status: "pending"
  }
];
