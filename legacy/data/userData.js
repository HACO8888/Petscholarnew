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
  // 補給品：對齊部署版商城（名稱／描述／圖片一致），每項自帶真實商品圖 image。
  // hp/exp 依稀有度遞進（基礎→史詩），與描述的「微幅／中等／大幅／全方位」語氣一致。
  {
    id: "item-milk",
    name: "牛奶 (基礎)",
    grade: "基礎",
    price: 10,
    hpRestore: 100,      // 微幅：1 顆愛心
    expGain: 10,
    icon: "🥛",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDBSZm0-7ujJMJXQO8YyOJkVr9UyuO_AExHK7LCmF77lew_9aOrVGaZ77Z18euG15wWszGRYxoPROjnUN8_1MgHurw159OLGxqabMWVYxSvRCSri7MQJgiUndbAe-xGb18GABhyFk2kdHoqE_QHx9J46EuQKMDtMWONambSGVCVkG8lgcjYzo3pGtMTG5CU72Nhwc4dO00VEWx3FtN9ATPd2_3TlJd1SZmsLtTnoXbsosjue_kGZas15xR6dug3frKg3JSjnfm-nncd",
    description: "基礎飲品，微幅恢復體力。"
  },
  {
    id: "item-honey",
    name: "蜂蜜罐 (基礎)",
    grade: "基礎",
    price: 15,
    hpRestore: 150,      // 微幅：1.5 顆愛心
    expGain: 10,
    icon: "🍯",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDAYRM9dbWl8datrcYD0aoItj7fFziw91cWgJZntsglPVtLrjQ_RBarjGjvTWNNDWDIDXIyjBkdyVQ6IHw2WveNoxiOztCpaFTa9fK1_8-gyt-2fw-CEODFrRcmNe8jGvicNPYtfRjCPwDUCgOAK3Shtoak-WBM1GaVQtV3d7TJMICFuzVsT7AhsDllgnaGksTvaXYfuHHVHosZVvaxho9worNVF_BO8m1J2sfSB1GIjiG-r68NpfyXOQtPh_wt2zehUNl07fHq3X9-",
    description: "香甜蜂蜜，微幅增加飽食度。"
  },
  {
    id: "item-apple",
    name: "蘋果 (普通)",
    grade: "普通",
    price: 25,
    hpRestore: 200,      // 中等：2 顆愛心
    expGain: 20,
    icon: "🍎",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuB0STl3aP4dNiMiKUTNotuqNvJtL9g4JnecHrz9L7CHBtnvLVOd4fUfgwiCMTDDSqDFWqm4BrvMI_YzgShv85r2ZUgRG1aacK3TTBH7od1IhhRtRpWbh-Hm13jT8wa0bJ-3o6LEAcSU3IPKsGXDEgI_l-gmFYcMbD0zvKduXEdCcrzk4spqBct5rirrqv5TNY9cOYHe-K6hHPqsiao8NxnC-7fSOd-IcvITS27QCMyQXZF6i1tUyLwK_L9DjuMh5tm53KS__vM_n00i",
    description: "健康水果，恢復中等飽食度。"
  },
  {
    id: "item-grape",
    name: "葡萄 (普通)",
    grade: "普通",
    price: 30,
    hpRestore: 250,      // 中等：2.5 顆愛心
    expGain: 20,
    icon: "🍇",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuAZlRqXHjGqXvdF6risfFY9x6FFRQ4DMf_f13QQ4_7t4vgBJPK43REf8u6rUknDY0IKI9og1kgJ1QrTRurkruPozjQVos-HHF56HWFbAY0DgZXtcTSiGFwEmd_mTbt17cNTXTn0zpTRV8y8Jgxs39deWEFuNWZAm5r1lg68pwHYUbWxl1xo1aYsErD2oWk2cRvlUjTtr_5WA_ZSH2VTYFY-O9isk3D5a0bv--fvS5QWQirCUca_02WV5ZPHZT38vL35cgqUPy4EOXWk",
    description: "新鮮葡萄，恢復中等體力。"
  },
  {
    id: "item-tuna-sandwich",
    name: "鮪魚三明治 (稀有)",
    grade: "稀有",
    price: 50,
    hpRestore: 400,      // 大幅：4 顆愛心
    expGain: 40,
    icon: "🥪",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCxZqKdh393mrmu3xRHnlDQIK6Bou4neKs24252VpTbuTn9TL9bYwNYLQJaMz3vCNC750D7dVSTy2ge5VbY0jCmMFsLPIbMGu1pc-ngBoMCS-gN8GxAoIN7dDTYYJQSk5BYLMIHY-SEIqQ1R2tIgmPqCdZGu9rOxvsbbq_5tnVL5r5RGVeg7jl2nvtvzElH39i7n8wHiIrclTB-9jXpikcKesYWpn3K_8W1EeWHQEp4hp6-yqrRD_8mc1auC2aOmpsvVokERqtglDIy",
    description: "營養均衡，大幅恢復體力與飽食度。"
  },
  {
    id: "item-ramen",
    name: "拉麵 (稀有)",
    grade: "稀有",
    price: 65,
    hpRestore: 500,      // 大幅：補滿 5 顆愛心
    expGain: 50,
    icon: "🍜",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuBpJqmC_0gs_kIfA95wCtB3mR3r-8dR9HTa8t20ZhRLTxUI9OG1eKBiXoiI-Rx7CfW0sud-7LpiRnmpFsrDQ51_2SqAjTHQWWcYQOpZEsoD-ZJZIjya0aEcXDExoAxadgMnywvw4AFs2yWu_p3ZhLudXfbJhv7PpRhcShvEuuxWeFxWkzlOXWyFKrxZwrFh_378SrMm00jErQy3sfaqRpyZgo8BWApfHxhp82z34XDRM-i06C4CuaR000nL14O6NiH062lCtuPrd6g6",
    description: "熱騰騰的拉麵，大幅恢復體力。"
  },
  {
    id: "item-steak",
    name: "頂級牛排 (史詩)",
    grade: "史詩",
    price: 100,
    hpRestore: 500,      // 全方位：補滿 5 顆愛心
    expGain: 70,
    icon: "🥩",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuDbd4I9bmiLHOnYtLGOXCgR3kdDXRE1D6SudyHO7MFxGcGuJbGJxERhKvXMPX7Vo0TGD3jI-n9yB_w23BvXQ30w8m4a59WjBlJ0DrvNfSk-LQxjRZQ5qpCicxXSXljcErUqUfC7Vm0tt1Ajp12im40LoRjsq4gTRhnHK1GrogDc-a5LSqygpICaEsvEvHj6HryUKU8InFbxNNjws9NxTo9Qyuc8VxRHLeCZtk3mi0fdqCqIY63xTH21grKahZups29DCihFHatK4gu_",
    description: "頂級食材，全方位提升狀態與經驗。"
  },
  {
    id: "item-cake",
    name: "草莓蛋糕 (史詩)",
    grade: "史詩",
    price: 120,
    hpRestore: 500,      // 全方位：補滿 5 顆愛心
    expGain: 80,
    icon: "🍰",
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuC-5Y3-i1lX5qFNwzJkoCuS8jHNUViv1A6XrGXr2UOyCfJvGpaKAIxIAbm1O1iOtZfan4Agbfesds_OPhy-qYMqAWdys2LBlIR3oT9j_GVmBeKVGr0kiAjxqRmdK0gmSxK3LPUVGU9sqoTka3C0nzvDeDS_Fz9eCV8orxH83V-avq5T2ChZ1LGA5qMOWH3FrkH6mKuMNqIKLxeB5zqiLzDleenYIX2UIbLzjhZCmQZYUupsg9yLcgcN22hnoSbq-wAZ0Df_GB7oGfDx",
    description: "精緻甜點，大幅提升心情與狀態。"
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
