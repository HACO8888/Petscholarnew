import os
import re

# Mapping from keywords in anchor tags to their destination relative paths
DESTINATIONS = {
    '學院看板': '../_2/code.html',
    '看板': '../_2/code.html',
    'Boards': '../_2/code.html',
    '自習室': '../_3/code.html',
    'Study Rooms': '../_3/code.html',
    '討論版': '../_5/code.html',
    '討論區': '../_5/code.html',
    '討論': '../_5/code.html',
    'Discussion': '../_5/code.html',
    '寵物餵食': '../_6/code.html',
    '寵物餵養': '../_6/code.html',
    '寵物互動': '../_6/code.html',
    '餵食': '../_6/code.html',
    'Heal Buddy': '../_6/code.html',
    '治療寵物': '../_6/code.html',
    '寵物商城': '../_7/code.html',
    '商城': '../_7/code.html',
    'Marketplace': '../_7/code.html',
    '排行榜': '../_8/code.html',
    '排行榜與成就': '../_8/code.html',
    'Leaderboard': '../_8/code.html',
    '個人檔案': '../_9/code.html',
    'Profile': '../_9/code.html',
    '會員登入': '../_1/code.html',
    '登入': '../_1/code.html',
    '登出': '../../index.html',
    'Logout': '../../index.html',
    '資料結構': '../_13/code.html',
    '資料結構解析': '../_13/code.html',
    'Visualizer': '../_13/code.html',
    '教授主頁': '../_14/code.html',
    '課程教授': '../_14/code.html',
    'Professor': '../_14/code.html'
}

def process_file(file_path):
    print(f"Processing: {file_path}")
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # --- Remove top-right search bars from navigation bar ---
    # Page _2 TopNavBar search
    content = re.sub(
        r'<!-- Search Bar -->\s*<div class="hidden md:flex items-center bg-surface-container-low dark:bg-surface-container rounded-full px-4 py-2 border border-outline-variant w-64 lg:w-80">.*?</div>',
        '', content, flags=re.DOTALL
    )
    # Page _3 & _7 TopNavBar search
    content = re.sub(
        r'<div class="relative bg-surface-container-low rounded-full px-md py-sm flex items-center gap-sm">\s*<span class="material-symbols-outlined text-secondary text-\[20px\]">search</span>\s*<input class="bg-transparent border-none focus:ring-0 p-0 text-body-md font-body-md text-on-surface w-32 md:w-48 placeholder-secondary" placeholder="搜尋\.\.\." type="text"/>\s*</div>',
        '', content, flags=re.DOTALL
    )
    # Page _4 TopNavBar search
    content = re.sub(
        r'<div class="hidden md:flex bg-surface-container rounded-full px-4 py-2 items-center text-on-surface-variant focus-within:ring-2 focus-within:ring-primary focus-within:bg-surface-container-highest transition-colors">.*?</div>',
        '', content, flags=re.DOTALL
    )
    # Page _5 TopNavBar search
    content = re.sub(
        r'<div class="relative hidden sm:flex items-center text-on-surface-variant focus-within:text-primary transition-colors">.*?</div>',
        '', content, flags=re.DOTALL
    )
    # Page _6 TopNavBar search & mobile search button
    content = re.sub(
        r'<div class="relative hidden md:block">\s*<input[^>]*placeholder="搜尋\.\.\."[^>]*/>\s*<span[^>]*>search</span>\s*</div>\s*<button class="md:hidden text-on-surface-variant hover:text-primary transition-colors p-2">.*?search.*?</button>',
        '', content, flags=re.DOTALL
    )
    # Page _8 TopNavBar search & mobile search button
    content = re.sub(
        r'<div class="relative hidden sm:flex items-center mr-xs">\s*<span[^>]*>search</span>\s*<input[^>]*placeholder="搜尋\.\.\."[^>]*/>\s*</div>\s*<button aria-label="search" class="sm:hidden p-2 rounded-full hover:bg-surface-variant transition-colors">.*?search.*?</button>',
        '', content, flags=re.DOTALL
    )
    # Page _9 TopNavBar search
    content = re.sub(
        r'<div class="hidden md:flex items-center gap-md">\s*<div class="relative">\s*<span[^>]*>search</span>\s*<input class="pl-10 pr-4 py-2 bg-surface-container rounded-full text-body-md border-none focus:ring-2 focus:ring-primary w-64" placeholder="搜尋\.\.\." type="text"/>\s*</div>\s*</div>',
        '', content, flags=re.DOTALL
    )

    # --- 1. Replace navigation links in all pages ---
    def link_replacer(match):
        href_start = match.group(1)
        attrs_and_content = match.group(2)
        
        # Strip tags to get raw text for keyword matching
        clean_text = re.sub(r'<[^>]+>', '', attrs_and_content).strip()
        
        # Check which keyword matches
        for keyword, dest in DESTINATIONS.items():
            if keyword in clean_text:
                return f'{href_start}"{dest}"{attrs_and_content}'
        
        return match.group(0)

    anchor_pattern = re.compile(r'(<a\b[^>]*?\bhref=)"[^"]*?"([^>]*?>.*?</a>)', re.DOTALL | re.IGNORECASE)
    content = anchor_pattern.sub(link_replacer, content)

    # --- 2. Add Back-to-Main link next to the logo ---
    # Clean up any existing duplicate back-links next to the logo first
    content = re.sub(r'<a href="\.\./\.\./index\.html"[^>]*?white-space:\s*nowrap;[^>]*?>.*?主頁</a>\s*', '', content)
    
    logo_replaced = [False]
    def logo_replacer(match):
        if not logo_replaced[0]:
            logo_replaced[0] = True
            logo_tag = match.group(1)
            print(f"  Found brand logo: {logo_tag.strip()}")
            back_link = '\n<a href="../../index.html" class="bg-secondary/10 hover:bg-secondary/20 text-secondary text-[11px] font-bold px-2.5 py-1 rounded-full border border-outline-variant/30 transition-all ml-2 inline-flex items-center gap-1" style="text-decoration:none; vertical-align: middle; white-space: nowrap;"><span>🔙</span> 主頁</a>'
            return f'{logo_tag}{back_link}'
        return match.group(0)

    logo_pattern = re.compile(r'(<(?:div|span|h1)\b[^>]*?\bclass="[^"]*?font-bold[^"]*?"[^>]*?>\s*(?:PetScholar|AcademiaPlay)\s*</(?:div|span|h1)>)', re.DOTALL | re.IGNORECASE)
    content = logo_pattern.sub(logo_replacer, content)

    # --- 3. Replace "會員登入" / "登入" buttons with links to Login screen ---
    if '_1/code.html' not in file_path:
        button_login_pattern = re.compile(
            r'(<button\b[^>]*?>\s*<span[^>]*?>login</span>\s*(?:會員登入|<span[^>]*?>登入</span>|登入)\s*</button>)',
            re.IGNORECASE | re.DOTALL
        )
        def button_login_replacer(match):
            tag_content = match.group(0)
            print(f"  Converting login button to anchor link: {tag_content.strip()}")
            tag_content = re.sub(r'^<button\b', '<a href="../_1/code.html" style="text-decoration:none;"', tag_content)
            tag_content = re.sub(r'</button>$', '</a>', tag_content)
            return tag_content
        content = button_login_pattern.sub(button_login_replacer, content)

    # --- 4. Page-Specific Enhancements ---

    # --- _1/code.html (Login/Register) ---
    if '_1/code.html' in file_path:
        print("  Applying login and registration logic to _1/code.html")
        
        # Department select dropdown grouped by optgroup
        reg_dept_original = re.compile(r'<select[^>]*?id="reg-dept".*?</select>', re.DOTALL)
        reg_dept_replacement = """<select class="w-full pl-xl pr-sm py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-1 focus:ring-primary text-body-md font-body-md text-on-surface outline-none transition-all appearance-none" id="reg-dept">
<option disabled="" selected="" value="">選擇您的系所</option>
<optgroup label="⚙️ 機電學院">
  <option value="機械工程系">機械工程系</option>
  <option value="車輛工程系">車輛工程系</option>
  <option value="能源與冷凍空調工程系">能源與冷凍空調工程系</option>
  <option value="機電學士班">機電學士班</option>
</optgroup>
<optgroup label="⚡ 電資學院">
  <option value="電機工程系">電機工程系</option>
  <option value="電子工程系">電子工程系</option>
  <option value="資訊工程系">資訊工程系</option>
  <option value="光電工程系">光電工程系</option>
  <option value="電資學士班">電資學士班</option>
</optgroup>
<optgroup label="🏗️ 工程學院">
  <option value="土木工程系">土木工程系</option>
  <option value="化學工程與生物科技系">化學工程與生物科技系</option>
  <option value="分子科學與工程系">分子科學與工程系</option>
  <option value="材料及資源工程系">材料及資源工程系</option>
  <option value="工程科技學士班">工程科技學士班</option>
</optgroup>
<optgroup label="📈 管理學院">
  <option value="工業工程與管理系">工業工程與管理系</option>
  <option value="經營管理系">經營管理系</option>
  <option value="資訊與財金管理系">資訊與財金管理系</option>
</optgroup>
<optgroup label="🎨 設計學院">
  <option value="建築系">建築系</option>
  <option value="工業設計系">工業設計系</option>
  <option value="互動設計系">互動設計系</option>
  <option value="創意設計學士班">創意設計學士班</option>
</optgroup>
<optgroup label="🏛️ 人文與社會科學學院">
  <option value="應用英文系">應用英文系</option>
  <option value="文化事業發展系">文化事業發展系</option>
</optgroup>
</select>"""
        content = reg_dept_original.sub(lambda m: reg_dept_replacement, content)
        
        # Attach onclick to Login Button
        login_btn_original = re.compile(
            r'(<button\b[^>]*?class="[^"]*?bg-primary[^"]*?"[^>]*?>\s*登入\s*<span[^>]*?>arrow_forward</span>\s*</button>)',
            re.DOTALL
        )
        content = login_btn_original.sub(
            lambda m: r'<button class="w-full bg-primary hover:bg-on-primary-container text-on-primary rounded-lg py-sm font-label-md text-label-md mt-sm transition-colors flex items-center justify-center gap-xs shadow-sm" type="button" onclick="handleLogin()">登入 <span class="material-symbols-outlined" style="font-size: 18px;">arrow_forward</span></button>',
            content
        )

        # Attach onclick to Register Button
        register_btn_original = re.compile(
            r'(<button\b[^>]*?class="[^"]*?bg-primary[^"]*?"[^>]*?>\s*建立帳號\s*</button>)',
            re.DOTALL
        )
        content = register_btn_original.sub(
            lambda m: r'<button class="w-full bg-primary hover:bg-on-primary-container text-on-primary rounded-lg py-sm font-label-md text-label-md mt-sm transition-colors flex items-center justify-center shadow-sm" type="button" onclick="handleRegister()">建立帳號</button>',
            content
        )
        
        # Back-to-main link directly above the welcome text
        if '主頁' not in content:
            welcome_pattern = re.compile(r'(<div class="mb-xl text-center">)', re.IGNORECASE)
            back_link_html = r'\1\n<a href="../../index.html" class="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary font-bold mb-md bg-secondary/10 px-3 py-1 rounded-full border border-outline-variant/20 transition-all" style="text-decoration:none;"><span>🔙</span> 主頁</a>\n'
            content = welcome_pattern.sub(back_link_html, content)

        # Inject JavaScript logic
        js_inject = """
    // 登入邏輯
    function handleLogin() {
        const emailInput = document.getElementById('login-email').value.trim();
        let user = localStorage.getItem('studypet_user');
        if (user) {
            user = JSON.parse(user);
        } else {
            user = {
                username: "新同學",
                department: "請選擇系所",
                gender: "female",
                reputation: 0,
                role: "student",
                bio: "尚未填寫自我介紹。點擊編輯按鈕開始介紹自己吧！",
                level: 1,
                qaCount: 0
            };
        }
        
        if (emailInput) {
            const parts = emailInput.split('@');
            if (parts[0]) {
                user.username = parts[0];
            }
        }
        
        localStorage.setItem('studypet_user', JSON.stringify(user));
        
        if (!localStorage.getItem('studypet_pet')) {
            const defaultPet = {
                name: "未命名小精靈",
                mascotType: "robot",
                level: 1,
                exp: 0,
                maxExp: 100,
                hp: 100,
                hearts: 5,
                maxHearts: 5,
                coins: 100,
                status: "happy",
                hasCheckedIn: false,
                badges: [],
                inventory: [],
                equipped: {
                    hat: false,
                    background: false,
                    rareStyle: false
                }
            };
            localStorage.setItem('studypet_pet', JSON.stringify(defaultPet));
        }
        
        alert("模擬登入成功！");
        window.location.href = "../_2/code.html";
    }

    // 註冊邏輯
    function handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const department = document.getElementById('reg-dept').value;
        const gender = document.getElementById('reg-gender').value;
        
        if (!username) {
            alert("請輸入使用者名稱！");
            return;
        }
        if (!department) {
            alert("請選擇您的系所！");
            return;
        }
        
        const newUser = {
            username: username,
            department: department,
            gender: gender,
            reputation: 0,
            role: "student",
            bio: "尚未填寫自我介紹。點擊編輯按鈕開始介紹自己吧！",
            level: 1,
            qaCount: 0
        };
        
        localStorage.setItem('studypet_user', JSON.stringify(newUser));
        
        const defaultPet = {
            name: username + "的寶貝",
            mascotType: "robot",
            level: 1,
            exp: 0,
            maxExp: 100,
            hp: 100,
            hearts: 5,
            maxHearts: 5,
            coins: 100,
            status: "happy",
            hasCheckedIn: false,
            badges: [],
            inventory: [],
            equipped: {
                hat: false,
                background: false,
                rareStyle: false
            }
        };
        localStorage.setItem('studypet_pet', JSON.stringify(defaultPet));
        
        alert("註冊成功！已保存個人帳號資料至瀏覽器中！");
        window.location.href = "../_2/code.html";
    }
    </script>
"""
        if 'function handleLogin()' in content:
            content = re.sub(
                r'// 登入邏輯\s*function handleLogin\(\).*?// 註冊邏輯\s*function handleRegister\(\).*?\}\s*</script>',
                js_inject.replace('</script>', '').strip() + '\n    </script>',
                content,
                flags=re.DOTALL
            )
        else:
            content = content.replace("</script>", js_inject)

    # --- _3/code.html (Study Rooms List) ---
    if '_3/code.html' in file_path:
        print("  Hooking join buttons to detail view in _3/code.html")
        join_button_pattern = re.compile(
            r'<button class="text-primary font-label-md text-label-md hover:underline flex items-center gap-xs">\s*加入\s*<span class="material-symbols-outlined text-\[16px\]">arrow_forward</span>\s*</button>',
            re.IGNORECASE | re.DOTALL
        )
        content = join_button_pattern.sub(
            lambda m: r'<a href="../_4/code.html" class="text-primary font-label-md text-label-md hover:underline flex items-center gap-xs" style="text-decoration:none;">加入 <span class="material-symbols-outlined text-[16px]">arrow_forward</span></a>',
            content
        )

    # --- _4/code.html (Study Room Details) ---
    if '_4/code.html' in file_path:
        print("  Fixing active self-study room link in _4/code.html")
        content = re.sub(
            r'(<a\b[^>]*?\bhref=)"[^"]*?"([^>]*?>\s*<br\s*/?>\s*</a>)',
            r'\1"../_3/code.html"\2',
            content
        )
        content = content.replace('<br></a>', '自習室</a>')

    # --- _7/code.html (Pet Store) ---
    if '_7/code.html' in file_path:
        print("  Injecting transaction simulator in _7/code.html")
        shop_js = """
<script id="shop-simulator">
document.addEventListener("DOMContentLoaded", () => {
    const itemMap = {
        "牛奶 (基礎)": "牛奶",
        "蜂蜜罐 (基礎)": "蜂蜜",
        "蘋果 (普通)": "蘋果",
        "葡萄 (普通)": "葡萄",
        "鮪魚三明治 (稀有)": "鮪魚三明治",
        "拉麵 (稀有)": "拉麵",
        "頂級牛排 (史詩)": "頂級牛排",
        "草莓蛋糕 (史詩)": "草莓蛋糕"
    };

    const cards = document.querySelectorAll(".bg-surface-bright.flex-col, .bg-surface-bright.flex.flex-col");
    cards.forEach(card => {
        const titleEl = card.querySelector("h3");
        const priceEl = card.querySelector(".text-tertiary");
        const btn = card.querySelector("button");
        if (titleEl && priceEl && btn && btn.textContent.trim() === "購買") {
            const title = titleEl.textContent.trim();
            const price = parseInt(priceEl.textContent.replace(/[^0-9]/g, ""), 10) || 0;
            btn.addEventListener("click", () => {
                const savedPet = localStorage.getItem("studypet_pet");
                if (savedPet) {
                    const pet = JSON.parse(savedPet);
                    if (pet.coins >= price) {
                        pet.coins -= price;
                        if (!pet.inventory) pet.inventory = [];
                        
                        const backPackName = itemMap[title] || title;
                        pet.inventory.push(backPackName);
                        
                        localStorage.setItem("studypet_pet", JSON.stringify(pet));
                        alert(`成功購買 ${title}！扣除 ${price} 金幣。已放入您的食物背包！`);
                        window.location.reload();
                    } else {
                        alert(`金幣不足！還需要 ${price - pet.coins} 金幣。`);
                    }
                } else {
                    alert("請先完成登入或註冊！");
                }
            });
        }
    });
});
</script>
"""
        if 'id="shop-simulator"' in content:
            content = re.sub(r'<script id="shop-simulator">.*?</script>', lambda m: shop_js, content, flags=re.DOTALL)
        else:
            content = content.replace("</body>", f"{shop_js}\n</body>")

    # --- _6/code.html (Pet Feeding) ---
    if '_6/code.html' in file_path:
        print("  Replacing feeding script with dynamic inventory script in _6/code.html")
        feeding_script_original = re.compile(
            r'<script>\s*document.addEventListener\(\'DOMContentLoaded\', \(\) => \{.*?\n\s*\}\);\s*</script>',
            re.DOTALL
        )
        feeding_script_replacement = """<script id="backpack-feeding">
document.addEventListener('DOMContentLoaded', () => {
    let pet = null;
    try {
        const savedPet = localStorage.getItem("studypet_pet");
        if (savedPet) pet = JSON.parse(savedPet);
    } catch(e) {
        console.error(e);
    }

    if (!pet) {
        pet = { inventory: [], coins: 100, hp: 100, hearts: 5, level: 1 };
    }
    if (!pet.inventory) pet.inventory = [];

    // Find all item cards inside the tray
    const tray = document.querySelector(".flex.overflow-x-auto.gap-md.pb-xs");
    if (tray) {
        const cards = tray.querySelectorAll(".flex-shrink-0.w-32, .flex-shrink-0.w-40");
        let visibleCount = 0;
        
        cards.forEach(card => {
            const spanEl = card.querySelector("span");
            if (spanEl) {
                const foodName = spanEl.textContent.trim().split(" ")[0]; // Get name without quantity indicator
                const count = pet.inventory.filter(name => name === foodName).length;
                if (count > 0) {
                    visibleCount++;
                    spanEl.textContent = `${foodName} (x${count})`;
                    
                    const btn = card.querySelector("button");
                    if (btn) {
                        const newBtn = btn.cloneNode(true);
                        btn.parentNode.replaceChild(newBtn, btn);
                        
                        newBtn.addEventListener("click", () => {
                            // Deduct from inventory
                            const idx = pet.inventory.indexOf(foodName);
                            if (idx > -1) {
                                pet.inventory.splice(idx, 1);
                            }
                            
                            // HP recovery
                            let hpRestore = 20;
                            if (foodName.includes("三明治")) hpRestore = 40;
                            if (foodName.includes("便當") || foodName.includes("歐趴糖") || foodName.includes("牛排")) hpRestore = 100;
                            if (foodName.includes("雞排") || foodName.includes("拉麵")) hpRestore = 30;
                            if (foodName.includes("咖啡") || foodName.includes("蛋糕")) hpRestore = 45;
                            
                            pet.hp = Math.min(100, (pet.hp || 60) + hpRestore);
                            pet.hearts = Math.ceil(pet.hp / 20);
                            
                            localStorage.setItem("studypet_pet", JSON.stringify(pet));
                            
                            newBtn.textContent = '已餵食！';
                            newBtn.classList.add('bg-tertiary', 'text-on-tertiary');
                            newBtn.classList.remove('bg-primary', 'text-on-primary');
                            
                            const petImage = document.querySelector('.flex-1 img[alt="Study Buddy"], .flex-1 img[alt="Buddy Pet"]');
                            if(petImage) {
                                petImage.style.transform = 'translateY(-20px) scale(1.05)';
                                setTimeout(() => {
                                    petImage.style.transform = 'translateY(0) scale(1)';
                                }, 300);
                            }
                            
                            setTimeout(() => {
                                alert(`餵食成功！寵物享用了 ${foodName}，HP 恢復了 ${hpRestore}！`);
                                window.location.reload();
                            }, 500);
                        });
                    }
                } else {
                    card.style.display = "none";
                }
            }
        });
        
        if (visibleCount === 0) {
            tray.innerHTML = `
            <div class="flex flex-col items-center justify-center py-lg text-center w-full gap-sm p-4 w-full">
                <span class="material-symbols-outlined text-4xl text-outline" style="font-size:48px; color:#73777c;">shopping_bag</span>
                <p class="font-body-md text-body-md text-secondary mt-2">背包目前沒有食物，餵食需要先前往商城購買喔！</p>
                <a href="../_7/code.html" class="bg-primary text-on-primary font-label-md text-label-md px-md py-sm rounded-lg hover:bg-surface-tint transition-all mt-3 inline-flex items-center gap-1 shadow-sm" style="text-decoration:none; padding:8px 16px;">
                    <span class="material-symbols-outlined text-sm">storefront</span> 前往寵物商城購買
                </a>
            </div>`;
        }
    }
});
</script>"""
        content = feeding_script_original.sub(lambda m: feeding_script_replacement, content)

    # --- 5. Common LocalStorage Sync Script for _2 to _11 ---
    if '_1/code.html' not in file_path:
        sync_script = r"""
<script id="sync-localstate">
document.addEventListener("DOMContentLoaded", () => {
    try {
        const savedUser = localStorage.getItem("studypet_user");
        const savedPet = localStorage.getItem("studypet_pet");
        if (savedUser && savedPet) {
            const user = JSON.parse(savedUser);
            const pet = JSON.parse(savedPet);
            
            // Enforce pet hp range and defaults for 5 hearts (each heart is 100 HP)
            if (pet.hp === 100 || !pet.hp) {
                pet.hp = 500;
                pet.baseHp = 500;
                pet.lastActivityTime = Date.now();
            }
            if (!pet.baseHp) pet.baseHp = pet.hp;
            if (!pet.lastActivityTime) pet.lastActivityTime = Date.now();

            // Calculate hourly drop (10 HP per hour of inactivity since last activity)
            const elapsed = Date.now() - pet.lastActivityTime;
            const hoursElapsed = Math.floor(elapsed / (3600 * 1000));
            const hpLoss = hoursElapsed * 10;
            const newHp = Math.max(0, pet.baseHp - hpLoss);
            
            if (pet.hp !== newHp) {
                pet.hp = newHp;
                pet.hearts = Math.ceil(newHp / 100);
                localStorage.setItem("studypet_pet", JSON.stringify(pet));
            }

            // Sync user avatar based on gender setting
            const maleAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuBHaUoUmD0NCQT0xkjGAhDfZcg0aBzllN0eFaNJtLBJf8cc_LGkd5eJLBbe92XyjZcFmqtTtPMy4nmqui7orI5FCwxtzZipXn7IT-ADqLhM-YTMnLuhwW5IkvAQb9VJ8EQNXDa-NeT0hvQnvHccj3YXgjW3PbfLOycAjzkdgDJWR7eHCVwig2L_UZfEHNjKWxKHhiTtGZPC5nhE25w7fJW4k4D14gGtDhExwWSmAB903j0EwwVPcfvR4EdG5X-hEsi442t72MF0CECQ";
            const femaleAvatar = "https://lh3.googleusercontent.com/aida-public/AB6AXuD6nYakPwha1xLE6ySgmmA3ALzCOIWvd5yKYtNc6I559vHmzcy6tuMKiyMt_XVU9C_i2EE6LXL3kR7esJW5Vpg8sdOkC99wKCsBwwj-CV7gOl85EXPmZozLCJMLTjfCgo1E6AQrurCE2oitnwoxspLZLgSj20zFdeIiRstXmq7pUoQT_fSqQiKZGslhXyPRUYFNP29JUCFo5YTkvdhoZJRshYhOdgiFeOqTl5IYb-_t46ECQsIlHcmedAhJ2jr9xN-EwM-PC-MeQ0SO";
            const avatarUrl = user.gender === "male" ? maleAvatar : femaleAvatar;
            
            const navAvatar = document.querySelector('img[alt="User avatar"]');
            if (navAvatar) {
                navAvatar.src = avatarUrl;
            }
            
            const profileAvatar = document.querySelector('img[alt="Profile Picture"]');
            if (profileAvatar && window.location.pathname.includes("_9")) {
                profileAvatar.src = avatarUrl;
            }
            
            // 1. Sync user details on Profile Page
            const profileName = document.querySelector(".font-headline-lg.text-headline-lg.text-on-surface");
            if (profileName && window.location.pathname.includes("_9")) {
                profileName.textContent = user.username;
                const profileDept = profileName.nextElementSibling;
                if (profileDept && profileDept.classList.contains("font-body-lg")) {
                    profileDept.textContent = user.department;
                }
                const profileBio = document.querySelector(".font-body-md.text-body-md.text-on-surface-variant.max-w-md");
                if (profileBio && user.bio) {
                    profileBio.textContent = user.bio;
                }
                const statsCards = document.querySelectorAll(".bg-surface.rounded-lg.p-md");
                statsCards.forEach(card => {
                    const label = card.querySelector(".text-secondary");
                    if (label) {
                        if (label.textContent.includes("目前等級") || label.textContent.includes("Level")) {
                            const val = card.querySelector(".text-on-surface");
                            if (val) val.textContent = `Lv. ${user.level || 1}`;
                        }
                        if (label.textContent.includes("總金幣") || label.textContent.includes("Coins")) {
                            const val = card.querySelector(".text-on-surface");
                            if (val) val.textContent = pet.coins;
                        }
                    }
                });
            }

            // 2. Sync Sidebar Pet status
            const aside = document.querySelector("aside");
            if (aside) {
                // Sync Pet Name
                const petHeader = aside.querySelector("h2, h3");
                if (petHeader) {
                    petHeader.textContent = pet.name || "未命名小精靈";
                }

                // Sync Pet Mascot Type Avatar
                const mascotEmojis = {
                    robot: "🤖",
                    dog: "🐶",
                    cat: "🐱",
                    pig: "🐷",
                    rabbit: "🐰"
                };
                const asideImg = aside.querySelector("img");
                if (asideImg) {
                    const emojiSpan = document.createElement("span");
                    emojiSpan.style.fontSize = "48px";
                    emojiSpan.style.lineHeight = "1";
                    emojiSpan.style.marginBottom = "8px";
                    emojiSpan.textContent = mascotEmojis[pet.mascotType] || "🤖";
                    asideImg.parentNode.replaceChild(emojiSpan, asideImg);
                } else {
                    const petsSpan = aside.querySelector('.material-symbols-outlined');
                    if (petsSpan && petsSpan.textContent.trim() === 'pets') {
                        petsSpan.parentNode.innerHTML = `<span style="font-size: 48px; line-height: 1; margin-bottom: 8px;">${mascotEmojis[pet.mascotType] || "🤖"}</span>`;
                    }
                }

                // Sync Pet Level in the Level Badge (like Lv.5 badge)
                const lvlBadge = aside.querySelector(".bg-error.text-on-error, .absolute.-bottom-2.-right-2");
                if (lvlBadge) {
                    lvlBadge.textContent = `Lv.${pet.level || 1}`;
                }
                
                // Sync Pet HP numeric text below hearts in sidebar
                let hpLabel = aside.querySelector("#sidebar-pet-hp");
                if (!hpLabel) {
                    hpLabel = document.createElement("div");
                    hpLabel.id = "sidebar-pet-hp";
                    hpLabel.className = "text-on-surface-variant text-[11px] font-medium mb-1 text-center";
                    const heartDiv = aside.querySelector(".flex.items-center.justify-center.gap-xs, .flex.items-center.justify-center.gap-1");
                    if (heartDiv) {
                        heartDiv.parentNode.insertBefore(hpLabel, heartDiv.nextSibling);
                    }
                }
                if (hpLabel) {
                    hpLabel.textContent = `生命值：${pet.hp} / 500`;
                }
                // Sync healing button action
                const healBtn = aside.querySelector("button");
                if (healBtn && (healBtn.textContent.includes("治療") || healBtn.textContent.includes("Heal"))) {
                    healBtn.onclick = () => {
                        if (pet.hp >= 500) {
                            alert("您的寵物非常健康，目前不需要治療！");
                            return;
                        }
                        if (pet.coins >= 20) {
                            pet.coins -= 20;
                            pet.hp = 500;
                            pet.baseHp = 500;
                            pet.hearts = 5;
                            pet.lastActivityTime = Date.now();
                            localStorage.setItem("studypet_pet", JSON.stringify(pet));
                            alert("治療成功！扣除 20 金幣，HP 已完全恢復！");
                            window.location.reload();
                        } else {
                            alert("金幣不足！治療需要 20 金幣。");
                        }
                    };

                    // Dynamic "Simulate 1 Hour" button in sidebar
                    if (!aside.querySelector("#btn-simulate-time")) {
                        const simBtn = document.createElement("button");
                        simBtn.id = "btn-simulate-time";
                        simBtn.className = "w-full py-2 mt-2 bg-secondary/15 hover:bg-secondary/25 text-secondary dark:text-secondary-fixed-dim font-label-md text-label-md rounded-lg border border-outline-variant/30 transition-all";
                        simBtn.textContent = "模擬時間流逝 1 小時 ⏳";
                        simBtn.onclick = () => {
                            pet.lastActivityTime = (pet.lastActivityTime || Date.now()) - (3600 * 1000);
                            localStorage.setItem("studypet_pet", JSON.stringify(pet));
                            alert("已模擬流逝 1 小時！");
                            window.location.reload();
                        };
                        healBtn.parentNode.insertBefore(simBtn, healBtn.nextSibling);
                    }
                }
            }

            // 2b. Inject Visualizer and Professor tabs dynamically
            const asideNav = document.querySelector("aside nav.flex-1");
            if (asideNav) {
                if (!asideNav.querySelector('a[href*="_13"]')) {
                    const isVisPage = window.location.pathname.includes("_13");
                    const visLink = document.createElement("a");
                    visLink.href = "../_13/code.html";
                    visLink.className = isVisPage
                        ? "bg-primary-container text-on-primary-container rounded-lg flex items-center gap-md px-md py-sm transition-transform scale-95 active:scale-90"
                        : "text-on-surface-variant hover:bg-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-variant transition-transform scale-95 active:scale-90";
                    visLink.innerHTML = `<span class="material-symbols-outlined">account_tree</span><span>資料結構解析</span>`;
                    asideNav.appendChild(visLink);

                    const isProfPage = window.location.pathname.includes("_14");
                    const profLink = document.createElement("a");
                    profLink.href = "../_14/code.html";
                    profLink.className = isProfPage
                        ? "bg-primary-container text-on-primary-container rounded-lg flex items-center gap-md px-md py-sm transition-transform scale-95 active:scale-90"
                        : "text-on-surface-variant hover:bg-surface-variant rounded-lg flex items-center gap-md px-md py-sm hover:bg-surface-container-highest dark:hover:bg-surface-variant transition-transform scale-95 active:scale-90";
                    profLink.innerHTML = `<span class="material-symbols-outlined">school</span><span>課程教授主頁</span>`;
                    asideNav.appendChild(profLink);
                }
            }

            const topNavList = document.querySelector("nav ul.hidden.lg\\:flex");
            if (topNavList) {
                if (!topNavList.querySelector('a[href*="_13"]')) {
                    const isVisPage = window.location.pathname.includes("_13");
                    const visLi = document.createElement("li");
                    visLi.className = "h-full flex items-center";
                    visLi.innerHTML = `<a class="${isVisPage ? 'text-primary dark:text-primary-fixed font-bold border-b-2 border-primary dark:border-primary-fixed' : 'text-secondary dark:text-secondary-fixed-dim hover:text-primary dark:hover:text-primary-fixed transition-colors'} h-full flex items-center px-2" href="../_13/code.html">資料結構</a>`;
                    topNavList.appendChild(visLi);

                    const isProfPage = window.location.pathname.includes("_14");
                    const profLi = document.createElement("li");
                    profLi.className = "h-full flex items-center";
                    profLi.innerHTML = `<a class="${isProfPage ? 'text-primary dark:text-primary-fixed font-bold border-b-2 border-primary dark:border-primary-fixed' : 'text-secondary dark:text-secondary-fixed-dim hover:text-primary dark:hover:text-primary-fixed transition-colors'} h-full flex items-center px-2" href="../_14/code.html">教授主頁</a>`;
                    topNavList.appendChild(profLi);
                }
            }

            // 3. Global Heart (HP) and Coins Synchronization
            const allSpans = document.querySelectorAll(".material-symbols-outlined");
            const heartContainers = new Set();
            allSpans.forEach(span => {
                if (span.textContent.trim() === "favorite") {
                    const parent = span.parentElement;
                    if (parent) {
                        heartContainers.add(parent);
                    }
                }
            });
            
            const heartCount = Math.ceil(pet.hp / 100);
            
            heartContainers.forEach(container => {
                const spans = Array.from(container.children).filter(el => el.textContent.trim() === "favorite");
                if (spans.length > 1) {
                    while (spans.length < 5) {
                        const newSpan = document.createElement("span");
                        newSpan.className = spans[0] ? spans[0].className : "material-symbols-outlined text-error text-sm";
                        newSpan.textContent = "favorite";
                        container.appendChild(newSpan);
                        spans.push(newSpan);
                    }
                    while (spans.length > 5) {
                        const lastSpan = spans.pop();
                        container.removeChild(lastSpan);
                    }
                    spans.forEach((span, i) => {
                        const fill = i < heartCount ? 1 : 0;
                        span.style.fontVariationSettings = `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24`;
                        if (span.style.cssText.includes("FILL")) {
                            span.style.cssText = span.style.cssText.replace(/FILL'\s*\d/, `FILL' ${fill}`);
                        }
                        if (fill) {
                            span.classList.add("icon-fill");
                        } else {
                            span.classList.remove("icon-fill");
                        }
                    });

                    // Dynamic HP text next to multi-heart container (excluding sidebar)
                    if (!container.closest("aside")) {
                        const parent = container.parentElement;
                        if (parent) {
                            let hpSpan = parent.querySelector(".hp-text-badge");
                            if (!hpSpan) {
                                hpSpan = document.createElement("span");
                                hpSpan.className = "hp-text-badge text-[11px] font-semibold text-secondary ml-xs shrink-0";
                                parent.appendChild(hpSpan);
                            }
                            hpSpan.textContent = `(${pet.hp}/500)`;
                        }
                    }
                } else if (spans.length === 1) {
                    const span = spans[0];
                    const fill = heartCount > 0 ? 1 : 0;
                    span.style.fontVariationSettings = `'FILL' ${fill}, 'wght' 400, 'GRAD' 0, 'opsz' 24`;
                    if (span.style.cssText.includes("FILL")) {
                        span.style.cssText = span.style.cssText.replace(/FILL'\s*\d/, `FILL' ${fill}`);
                    }
                    if (fill) {
                        span.classList.add("icon-fill");
                    } else {
                        span.classList.remove("icon-fill");
                    }
                    
                    if (span.nextSibling && span.nextSibling.nodeType === Node.TEXT_NODE) {
                        span.nextSibling.nodeValue = ` ${heartCount} (生命值: ${pet.hp}/500) `;
                    }
                    const parent = span.parentElement;
                    if (parent) {
                        parent.childNodes.forEach(node => {
                            if (node.nodeType === Node.TEXT_NODE) {
                                node.nodeValue = ` ${heartCount} (生命值: ${pet.hp}/500) `;
                            }
                        });
                    }
                }
            });

            // Sync Coins text next to monetization_on globally
            allSpans.forEach(ico => {
                if (ico.textContent.trim() === "monetization_on") {
                    if (ico.closest(".bg-surface-bright") || ico.closest("[id^='shop-item-']") || ico.closest("#full-shop-container") || ico.closest("#quick-shop-container") || ico.closest("[id^='quick-item-']")) {
                        return;
                    }
                    if (ico.nextSibling && ico.nextSibling.nodeType === Node.TEXT_NODE) {
                        const trimmed = ico.nextSibling.nodeValue.trim();
                        if (/^\d+$/.test(trimmed)) {
                            ico.nextSibling.nodeValue = ` ${pet.coins} `;
                        }
                    }
                    const parent = ico.parentElement;
                    if (parent && parent.tagName === "DIV") {
                        const nextSpan = parent.nextElementSibling;
                        if (nextSpan && nextSpan.tagName === "SPAN" && /^\d+$/.test(nextSpan.textContent.trim())) {
                            nextSpan.textContent = pet.coins;
                        }
                    }
                }
            });

            // 4. Sync page coins if any using robust TreeWalker
            const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while (node = walk.nextNode()) {
                const parent = node.parentElement;
                if (parent && (parent.tagName === "SCRIPT" || parent.tagName === "STYLE")) {
                    continue;
                }
                const text = node.nodeValue.trim();
                if (/^(?:\|?\s*金幣\s*[:：]\s*\d+|餘額\s*[:：]\s*\d+\s*枚?金幣|Coins\s*[:：]\s*\d+)$/.test(text)) {
                    node.nodeValue = node.nodeValue.replace(/\d+/, pet.coins);
                }
            }

            // 4. Sync custom posts on Discussion Page (_5/code.html)
            if (window.location.pathname.includes("_5")) {
                const questionContainer = document.getElementById("discussion-questions-list");
                const savedCustomPosts = localStorage.getItem("studypet_custom_posts");
                if (questionContainer && savedCustomPosts) {
                    const customPosts = JSON.parse(savedCustomPosts);
                    if (customPosts.length > 0) {
                        const emptyPlaceholder = questionContainer.querySelector("#empty-state-placeholder");
                        if (emptyPlaceholder) {
                            emptyPlaceholder.style.display = "none";
                        }
                    }
                    customPosts.forEach((post, index) => {
                        const article = document.createElement("article");
                        article.setAttribute("onclick", "window.location.href='../_12/code.html?id=" + index + "'");
                        article.className = "bg-surface-container-lowest border border-surface-variant rounded-lg p-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer relative group";
                        
                        // Parse boardId or map it from boardName
                        const nameToId = {
                            "電資學院": "ceecs", "機電學院": "cmee", "工程學院": "coe",
                            "管理學院": "com", "設計學院": "cod", "人文與社會科學學院": "chss"
                        };
                        let bId = post.boardId;
                        if (!bId && post.boardName) {
                            const cleanName = post.boardName.replace(/^[^\w\u4e00-\u9fa5]+/, "").trim();
                            for (const name in nameToId) {
                                if (cleanName.includes(name) || name.includes(cleanName)) {
                                    bId = nameToId[name];
                                    break;
                                }
                            }
                        }
                        article.setAttribute("data-board-id", bId || "unknown");
                        
                        article.innerHTML = `
<div class="flex flex-col sm:flex-row gap-md">
<div class="flex sm:flex-col items-center sm:items-end justify-start sm:w-24 gap-sm sm:gap-xs text-secondary shrink-0 order-2 sm:order-1 mt-md sm:mt-0 pt-md sm:pt-0 border-t sm:border-t-0 border-surface-variant">
<div class="flex items-center gap-xs">
<span class="font-body-md text-body-md">0</span>
<span class="text-label-md font-label-md">回覆</span>
</div>
<div class="flex items-center gap-xs">
<span class="font-body-md text-body-md">1</span>
<span class="text-label-md font-label-md">瀏覽</span>
</div>
<div class="flex items-center gap-xs bg-tertiary-container text-on-tertiary-container px-sm py-[2px] rounded-sm mt-xs">
<span class="material-symbols-outlined text-[14px]">generating_tokens</span>
<span class="font-label-md text-label-md">${post.bounty}</span>
</div>
</div>
<div class="flex-1 order-1 sm:order-2">
<div class="flex items-center gap-sm mb-sm text-secondary font-label-md text-label-md">
<div class="w-6 h-6 rounded-full bg-secondary-container flex items-center justify-center">
<span class="material-symbols-outlined text-on-secondary-container text-[14px]">person</span>
</div>
<span class="text-on-surface-variant">${user.username} (${user.department})</span>
<span>•</span>
<span>剛剛</span>
</div>
<h2 class="font-headline-md text-headline-md text-primary mb-xs group-hover:text-surface-tint transition-colors text-[20px]">${post.title}</h2>
<p class="text-on-surface-variant font-body-md text-body-md line-clamp-2 mb-md">
    ${post.content}
</p>
<div class="flex flex-wrap gap-xs">
<span class="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm font-label-md text-label-md text-[11px]">#${post.boardName}</span>
<span class="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm font-label-md text-label-md text-[11px]">#${post.deptName}</span>
<span class="px-sm py-[2px] bg-secondary-container text-on-secondary-container rounded-sm font-label-md text-label-md text-[11px]">#Bounty${post.bounty}</span>
</div>
</div>
</div>`;
                        questionContainer.insertBefore(article, questionContainer.firstChild);
                    });
                }
            }

            // 5. Dynamic Tag clicking and decoration
            function makeTagsClickable() {
                const allElements = document.querySelectorAll("span, button, div.inline-flex");
                allElements.forEach(el => {
                    const text = el.textContent.trim();
                    if (text.startsWith("#") && text.length > 1 && !el.querySelector("*") && !el.dataset.tagBound) {
                        el.dataset.tagBound = "true";
                        el.style.cursor = "pointer";
                        el.classList.add("hover:underline");
                        el.addEventListener("mouseenter", () => { el.style.opacity = "0.75"; });
                        el.addEventListener("mouseleave", () => { el.style.opacity = "1"; });
                        el.addEventListener("click", (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            const tagText = text.replace(/^#\s*/, "");
                            const relPath5 = window.location.pathname.includes("_5") ? "code.html" : "../_5/code.html";
                            window.location.href = `${relPath5}?tag=${encodeURIComponent(tagText)}`;
                        });
                    }
                });
            }
            makeTagsClickable();
        }
    } catch(e) {
        console.error("Error syncing state from localStorage:", e);
    }
});
</script>
"""
        if 'id="sync-localstate"' in content:
            content = re.sub(r'<script id="sync-localstate">.*?</script>', lambda m: sync_script, content, flags=re.DOTALL)
        else:
            content = content.replace("</body>", f"{sync_script}\n</body>")

    # Clean up duplicate body/html closing tags that might have accumulated
    content = re.sub(r'(?:\s*</body>\s*)+', '\n</body>\n', content)
    content = re.sub(r'(?:\s*</html>\s*)+', '\n</html>\n', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Finished: {file_path}\n")

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    for item in sorted(os.listdir(base_dir)):
        item_path = os.path.join(base_dir, item)
        if os.path.isdir(item_path) and item.startswith('_'):
            code_html_path = os.path.join(item_path, "code.html")
            if os.path.exists(code_html_path):
                process_file(code_html_path)

if __name__ == '__main__':
    main()
