/**
 * 北科遊戲化學業交流區 - 看板與文章資料 (6學院 25科系 - Object & Array & Tree 結構)
 */

const BOARDS_DATA = {
  "cmee": {
    id: "cmee",
    name: "機電學院",
    icon: "⚙️",
    color: "#e67e22",
    description: "機械工程、車輛工程、能源與冷凍空調等核心機電專業學科討論區。",
    departments: ["機械工程系", "車輛工程系", "能源與冷凍空調工程系", "機電學士班"],
    posts: [
      {
        id: "me-post-1",
        title: "卡諾循環（Carnot Cycle）熱效率公式推導問題",
        author: "齒輪轉啊轉",
        timestamp: "2026-06-07 14:00",
        bounty: 30,
        solved: true,
        image: "mock_thermo_hw", // 模擬卡諾循環P-V圖圖片
        tags: ["熱力學", "卡諾循環", "熱效率"],
        department: "機械工程系",
        content: `熱力學考題：卡諾循環效率 $\eta = 1 - T_L / T_H$。
為什麼卡諾循環效率只跟高溫熱庫 $T_H$ 與低溫熱庫 $T_L$ 有關，跟工作流體（如理想氣體、水蒸氣等）的性質完全無關？
這有沒有物理上的直觀解釋？`,
        replies: [
          {
            id: "me-reply-1",
            author: "熱流組大師兄",
            timestamp: "2026-06-07 14:30",
            content: `這是根據熱力學第二定律（卡諾定理）：
「在相同的高低溫熱庫之間工作的所有可逆循環，其效率皆相同；任何不可逆循環的效率皆小於可逆循環。」
如果效率跟流體性質有關，那我們就能設計出效率高於可逆循環的系統，這會違反克勞修斯或克耳文-普朗克敘述（即可以製造出第二類永動機）。
從數學推導上看，因為循環的四個步驟皆為可逆（兩個等溫、兩個絕熱），其熱量與溫度的比例在積分後會完全消去工作流體的常數（如比熱比 $\gamma$），所以最終只剩溫度比。`,
            isAdopted: true,
            replies: []
          }
        ]
      }
    ]
  },
  "ceecs": {
    id: "ceecs",
    name: "電資學院",
    icon: "⚡",
    color: "#00d2ff",
    description: "電機、電子、資訊、光電等電子與資訊前沿科技學科討論區。",
    departments: ["電機工程系", "電子工程系", "資訊工程系", "光電工程系", "電資學士班"],
    posts: [
      {
        id: "ee-post-1",
        title: "微積分二階常微分方程式怎麼解？(待定係數法)",
        author: "大一電機萌新",
        timestamp: "2026-06-08 10:15",
        bounty: 40,
        solved: false,
        image: "mock_math_hw", // 模擬手寫微積分題目圖片
        tags: ["微積分", "常微分方程", "大一必修"],
        department: "電機工程系",
        content: `各位學長姐好，我在寫微積分作業時卡在這一題：
<pre class="code-block">y'' - 3y' + 2y = e^(3x) + x^2</pre>
我知道要先求齊次解的特徵方程式 $r^2 - 3r + 2 = 0$，得到齊次解 $y_h = C_1 e^x + C_2 e^{2x}$。
但是非齊次項的特解 $y_p$ 該怎麼假設？有沒有人可以列出詳細的步驟？謝謝！`,
        replies: [
          {
            id: "ee-reply-1",
            author: "微積分小助教",
            timestamp: "2026-06-08 10:30",
            content: `同學你好，非齊次項有兩部分：$e^{3x}$ 和 $x^2$。你可以分開求特解再相加（線性疊加原理）：
1. 針對 $e^{3x}$，因為 3 不是特徵根，所以假設 $y_{p1} = A e^{3x}$。
2. 針對 $x^2$，假設 $y_{p2} = B x^2 + C x + D$。
把它們代回原式求係數即可。`,
            isAdopted: false,
            replies: [
              {
                id: "ee-reply-1-1",
                author: "大一電機萌新",
                timestamp: "2026-06-08 10:35",
                content: `謝謝助教！那請問 $y_{p1}$ 代回原方程式後的係數 $A$ 會是多少呢？`,
                isAdopted: false,
                replies: [
                  {
                    id: "ee-reply-1-1-1",
                    author: "微積分小助教",
                    timestamp: "2026-06-08 10:40",
                    content: `代入原式：
$y_{p1}'' - 3y_{p1}' + 2y_{p1} = 9Ae^{3x} - 9Ae^{3x} + 2Ae^{3x} = 2Ae^{3x} = e^{3x}$。
所以 $2A = 1 \\Rightarrow A = 1/2$。`,
                    isAdopted: false,
                    replies: []
                  }
                ]
              }
            ]
          },
          {
            id: "ee-reply-2",
            author: "電機三學霸",
            timestamp: "2026-06-08 10:45",
            content: `針對第二部分 $x^2$，代入原式求 $B, C, D$：
$y_{p2}' = 2Bx + C$
$y_{p2}'' = 2B$
代回：$2B - 3(2Bx + C) + 2(Bx^2 + Cx + D) = x^2$
整理同類項：
$2B x^2 + (2C - 6B)x + (2B - 3C + 2D) = x^2$
對照係數：
1. $2B = 1 \\Rightarrow B = 1/2$
2. $2C - 6B = 0 \\Rightarrow C = 3/2$
3. $2B - 3C + 2D = 0 \\Rightarrow 1 - 9/2 + 2D = 0 \\Rightarrow 2D = 7/2 \\Rightarrow D = 7/4$
所以特解 $y_p = \\frac{1}{2}e^{3x} + \\frac{1}{2}x^2 + \\frac{3}{2}x + \\frac{7}{4}$。`,
            isAdopted: false,
            replies: [
              {
                id: "ee-reply-2-1",
                author: "大一電機萌新",
                timestamp: "2026-06-08 10:50",
                content: `哇！太詳細了，完全看懂了！學長真的超強！`,
                isAdopted: false,
                replies: []
              }
            ]
          }
        ]
      },
      {
        id: "ee-post-2",
        title: "三相電路中戴維寧等效電路的求法？",
        author: "電路學痛苦中",
        timestamp: "2026-06-07 16:20",
        bounty: 30,
        solved: true,
        image: "mock_circuit_hw", // 模擬電路圖圖片
        tags: ["電路學", "三相電路", "戴維寧等效"],
        department: "電機工程系",
        content: `請問大家，當遇到對稱三相電路時，如果要在某個負載端求戴維寧等效電路，是不是可以先轉換成單相（Per-phase）等效電路來解？
還是必須直接用三相的節點電壓法解？求救！`,
        replies: [
          {
            id: "ee-reply-3",
            author: "電力系統研二生",
            timestamp: "2026-06-07 17:00",
            content: `如果是「對稱」三相電路，強烈建議直接畫單相等效電路。把所有 Y-Delta 轉換都先換成 Y 接，中性點當作參考點，這樣只需要解一相，其他兩相的結果只是相角相差正負 120 度而已。這會幫你省下 90% 的計算時間。`,
            isAdopted: true,
            replies: []
          }
        ]
      },
      {
        id: "cs-post-1",
        title: "BST（二元搜尋樹）與 AVL 樹在極端輸入下的效能差異？",
        author: "資工小菜雞",
        timestamp: "2026-06-08 11:00",
        bounty: 35,
        solved: false,
        image: "mock_bst_hw", // 模擬BST繪圖圖片
        tags: ["資料結構", "二元搜尋樹", "AVL樹"],
        department: "資訊工程系",
        content: `大家午安，我想請問：如果我們依序輸入遞增數值（例如：1, 2, 3, 4, 5...）到一般的 BST 和 AVL 樹中。
1. BST 會退化成什麼樣子？搜尋複雜度會變成多少？
2. AVL 樹是如何解決這個問題的？旋轉（Rotation）發生的時機是？`,
        replies: [
          {
            id: "cs-reply-1",
            author: "寫Code不打草稿",
            timestamp: "2026-06-08 11:15",
            content: `1. 一般 BST 遇到遞增輸入會退化成一個**單向鏈結串列 (Skewed Tree/Link List)**。此時樹的高度為 $O(N)$，搜尋、插入與刪除的最壞時間複雜度都會從理想的 $O(\\log N)$ 退化到 $O(N)$。
2. AVL 樹是高度平衡的二元搜尋樹，要求任何節點的左右子樹高度差（平衡因子 Balance Factor, BF）絕對值不超過 1。`,
            isAdopted: false,
            replies: [
              {
                id: "cs-reply-1-1",
                author: "資工小菜雞",
                timestamp: "2026-06-08 11:20",
                content: `那如果依序輸入 1, 2, 3，AVL 樹是怎麼旋轉的？`,
                isAdopted: false,
                replies: [
                  {
                    id: "cs-reply-1-1-1",
                    author: "寫Code不打草稿",
                    timestamp: "2026-06-08 11:25",
                    content: `當輸入 1, 2 時，高度差正常。
當輸入 3 時，節點 1 的右子樹高度為 2，左子樹為 0，$BF = 0 - 2 = -2$ 失去了平衡。
因為是插在右子樹的右邊（Right-Right），所以對節點 1 進行**左旋（Left Rotation）**：
讓節點 2 變成新的根節點，1 變成 2 的左子樹，3 留在 2 的右子樹。樹高恢復為 1，搜尋時間維持在 $O(\\log N)$！`,
                    isAdopted: false,
                    replies: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "coe": {
    id: "coe",
    name: "工程學院",
    icon: "🏗️",
    color: "#2ecc71",
    description: "土木、化工與生技、分子科學、材料與資源工程等傳統與新興工程領域討論區。",
    departments: ["土木工程系", "化學工程與生物科技系", "分子科學與工程系", "材料及資源工程系", "工程科技學士班"],
    posts: [
      {
        id: "coe-post-1",
        title: "材料力學：懸臂樑受集中載重，剪力與彎矩圖(SFD/BMD)畫法？",
        author: "土木大二小新手",
        timestamp: "2026-06-14 14:15",
        bounty: 20,
        solved: false,
        image: "mock_math_hw",
        tags: ["材料力學", "結構分析", "大二必修"],
        department: "土木工程系",
        content: `各位學長姐好，我在寫材料力學作業時，對於畫剪力彎矩圖有點卡住。
有一根長度為 L 的懸臂樑（左端固定，右端自由），在自由端受到一個向下的集中載重 P。
我想請問：
1. 剪力 V(x) 和彎矩 M(x) 的方程式該如何列出？（以固定端為原點 x = 0）
2. 剪力圖與彎矩圖的形狀長怎樣？最大值發生在何處？謝謝！`,
        replies: [
          {
            id: "coe-reply-1",
            author: "結構所學長",
            timestamp: "2026-06-14 14:45",
            content: `同學你好，這是一題很基本但很重要的結構分析題。
首先我們可以用靜力平衡求反力，或直接取切面來列方程式：
1. **反力計算**：固定端 (x=0) 會產生一個向上的垂直反力 $R_A = P$，以及一個順時針的抗彎矩 $M_A = P \\times L$。
2. **剪力方程式**：在樑的任意切面，剪力必須與外力平衡。因為自由端有向下的 P，所以在任意點的剪力均為常數：
   $V(x) = P$ （以右側截面往下為正的符號慣例）。
3. **彎矩方程式**：力臂為 $(L - x)$，所以彎矩方程式為：
   $M(x) = -P(L - x)$。在固定端 $x=0$ 時有最大彎矩 $M_{max} = -PL$；在自由端 $x=L$ 時彎矩為 0。

**圖形繪製**：
- **剪力圖 (SFD)**：是一條水平直線，值為常數 $P$。
- **彎矩圖 (BMD)**：是一條斜率為正的斜直線，從固定端的 $-PL$ 線性上升至自由端的 $0$。`,
            isAdopted: false,
            replies: []
          }
        ]
      }
    ]
  },
  "com": {
    id: "com",
    name: "管理學院",
    icon: "📈",
    color: "#bf55ec",
    description: "工業工程與管理、經營管理、資訊與財金管理等現代商管學科討論區。",
    departments: ["工業工程與管理系", "經營管理系", "資訊與財金管理系"],
    posts: [
      {
        id: "im-post-1",
        title: "求解 Black-Scholes 模型中的 d1 意義與白話解釋",
        author: "期權韭菜苗",
        timestamp: "2026-06-08 09:00",
        bounty: 50,
        solved: false,
        image: "mock_options_hw", // 模擬期權Black-Scholes題目圖片
        tags: ["衍生性商品", "期權評價", "Black-Scholes"],
        department: "資訊與財金管理系",
        content: `各位資財大師好，Black-Scholes 買權公式為：
<pre class="code-block">C = S * N(d1) - K * e^(-rT) * N(d2)</pre>
課本說 $N(d_2)$ 是期權在到期日被履約的機率，那 $N(d_1)$ 代表什麼？為什麼買權價值不是單純的 $(S - K) * N(履約機率)$？
請各位幫忙用直覺、白話的方式解釋，期末考快到了，頭好痛！`,
        replies: [
          {
            id: "im-reply-1",
            author: "資財金牌操盤手",
            timestamp: "2026-06-08 09:20",
            content: `這個問題很好！
$N(d_2)$ 的確是在風險中性世界中「期權被履約的機率」（也就是到期時 $S_T > K$ 的機率）。
而 $N(d_1)$ 代表的是**「當期權確定被履約時，到期標的資產價格的期望值，折現回現在並除以當前股價的比例」**。
簡單說，$S * N(d_1)$ 是買權到期時你拿到股票價值的折現期望值；而 $K * e^{-rT} * N(d_2)$ 是你到期時需要付出履約價的折現期望值。兩者相減才是買權價值！`,
            isAdopted: false,
            replies: [
              {
                id: "im-reply-1-1",
                author: "期權韭菜苗",
                timestamp: "2026-06-08 09:30",
                content: `喔！所以 $S * N(d_1)$ 其實包含了「拿到股票的期望價值」，而不能只用單純的股價乘以履約機率？`,
                isAdopted: false,
                replies: [
                  {
                    id: "im-reply-1-1-1",
                    author: "資財金牌操盤手",
                    timestamp: "2026-06-08 09:40",
                    content: `沒錯！因為如果到期股價高於 K，此時股價的分布並不是單一值，而是一個被 K 截斷的對數常態分布。$N(d_1)$ 修正了這個「只有在履約時才拿得到股票，且拿到的股票價值會高於 K」的條件期望值特性。`,
                    isAdopted: false,
                    replies: []
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  },
  "cod": {
    id: "cod",
    name: "設計學院",
    icon: "🎨",
    color: "#ff8c00",
    description: "建築、工業設計、互動設計、創意設計等美學與人機互動討論區。",
    departments: ["建築系", "工業設計系", "互動設計系", "創意設計學士班"],
    posts: [
      {
        id: "cod-post-1",
        title: "使用者介面設計：手機 App 卡片元件的黃金比例與人體工學？",
        author: "互動設計萌新",
        timestamp: "2026-06-13 11:30",
        bounty: 25,
        solved: false,
        image: "mock_bst_hw",
        tags: ["UI設計", "人機互動", "美學比例"],
        department: "互動設計系",
        content: `大家好，最近在設計一個校園課業 App 的資訊卡片。
我的卡片寬度固定為螢幕寬度的 90%，但高度一直拿捏不定。
請教大家：
1. 介面設計中，卡片的寬高比有沒有比較推崇的「黃金比例」？
2. 從人體工學角度來看，卡片上的點擊目標（如收藏按鈕）最小應該設計為多少像素（px）以方便大拇指點擊？`,
        replies: [
          {
            id: "cod-reply-1",
            author: "設計系學姐",
            timestamp: "2026-06-13 12:10",
            content: `嗨！這兩個問題在 UI/UX 中非常實用：
1. **黃金比例 (Golden Ratio)**：通常我們可以使用 $1:1.618$ 的比例。例如寬度為 340px，高度大約可以設為 210px。或者也可以採用常見的銀比（$1:1.414$）或經典的 $4:3$ 比例。
2. **點擊目標大小**：根據 Google Material Design 與 Apple iOS 設計規範，為了適應成人手指觸控，**最小點擊區域應為 48dp x 48dp (或 44px x 44px)**。即使按鈕視覺上只有 24px，其周圍也應保留足夠的 padding，以避免使用者點擊失敗或誤觸。`,
            isAdopted: false,
            replies: []
          }
        ]
      }
    ]
  },
  "chss": {
    id: "chss",
    name: "人文與社會科學學院",
    icon: "🏛️",
    color: "#16a085",
    description: "應用英文、文化事業發展等語言與社會人文學科討論區。",
    departments: ["應用英文系", "文化事業發展系"],
    posts: [
      {
        id: "chss-post-1",
        title: "英文寫作：學術論文中什麼時候該用被動語態 (Passive Voice)？",
        author: "寫作苦手",
        timestamp: "2026-06-12 16:00",
        bounty: 15,
        solved: false,
        image: "mock_options_hw",
        tags: ["英文寫作", "學術論文", "文法探討"],
        department: "應用英文系",
        content: `各位英文系大師好，我的指導教授在批改我的英文論文草稿時，
留下了 "Avoid too many passive voice sentences" 的評論。
但我以前聽說學術寫作為了追求客觀，應該多用被動語態（例如：The experiment was conducted...）。
請問現在學術界究竟偏好主動語態還是被動語態？何時使用被動語態才是合適的呢？`,
        replies: [
          {
            id: "chss-reply-1",
            author: "英寫小老師",
            timestamp: "2026-06-12 16:30",
            content: `這是一個學術界的常見迷思！
過去確實偏好被動語態來強調「研究對象」而非「研究者」。但**現代學術寫作（如 APA 7th 規範）強烈建議多用主動語態**（例如使用 "We conducted the experiment..." 代替 "The experiment was conducted..."），因為主動語態更簡潔、強烈且責任明確。

**何時該用被動語態？**
1. **行為者是誰並不重要或未知**：例如 "The specimen was heated to 100°C." （誰加熱的不重要，重要的是加熱這個事實）。
2. **想要強調接受行為的對象**：例如 "Participants were selected from the freshman class."。
3. **為了維持句子的流暢度與焦點一致性**。

建議將 70-80% 的句子改為主動語態，只在描述具體實驗步驟且行為者不重要時使用被動語態。`,
            isAdopted: false,
            replies: []
          }
        ]
      }
    ]
  }
};
