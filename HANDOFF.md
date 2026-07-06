# 開發交接手冊（給下一位 AI／開發者）

> 本文件是《我的小世界：台灣島物語》的完整技術交接。**接手任何修改前，請先把本文件全部讀完**，特別是「地雷清單」。
> 最後更新：2026-07-05（v11）
>
> **入口檔**：`CLAUDE.md`（Claude Code 自動載入）與 `AGENTS.md`（Codex 自動載入）是新模型進專案的「門」，會把它導來讀本文件，並列出五條紅線摘要。**這五條紅線在三個檔（本文件§5、CLAUDE.md、AGENTS.md）都有，改動其一要三處同步。** 本文件永遠是細節的唯一正解。

## 0. 一分鐘認識專案

- **遊玩**：https://sancola1219-collab.github.io/taiwan-island-life/
- **Repo**：https://github.com/sancola1219-collab/taiwan-island-life（分支 main，push 即自動部署 GitHub Pages）
- **本機**：`C:\Users\凱凱\Desktop\遊戲\我的小世界`
- 動物森友會風格、以台灣為地圖的 2D 網頁遊戲。**純 vanilla JS + Canvas 2D，零依賴、零建置工具**，直接開 index.html 就能玩。
- 玩家（凱凱）主要分享給**手機用戶**，觸控體驗優先；喜歡擬真台灣、真實景點、豐富功能。

## 1. 檔案結構

| 檔案 | 角色 |
|---|---|
| `index.html` | 外殼：CSS、開場選單 DOM（名字/族群/衣色）、縣市導覽圖檢視器 DOM(#refView)、載入 data.js → game.js（**?v=N 快取號，每次改版必須 +1**） |
| `data.js` | **純資料層**（~450行）。所有內容擴充優先改這裡 |
| `game.js` | 引擎（~2200行）。系統邏輯都在這 |
| `ref/c01~c22.png` | 玩家提供的 22 張縣市手繪導覽圖（c 對照表在 data.js REF_COUNTIES）；`p01~p18.png` 港口圖 |
| `docs/*.jpg` | README 截圖 |
| `.nojekyll` | 防止 Pages 用 Jekyll 建置（**勿刪**，曾因此疑似 404） |
| `.claude/launch.json` | 本機預覽伺服器設定（game=port 8765；mario=port 8766 指向超級瑪莉專案） |
| `tools/server.js` | 本機靜態伺服器（`node tools/server.js 8765`，no-store 防快取） |

## 2. ⚠️ 最重要的座標系統（每個接手者都踩過的雷）

- 地圖實際是 **600×780 格**（`MW/MH`，1格=48px=`TILE`）。
- 但 **data.js 內所有座標都用 400×520 舊基準撰寫**，檔案最尾端有一段 `S=1.5` 的 scale pass 統一放大。
- **新增資料時：座標一律寫舊基準（0~400, 0~520）**，並確認你的新陣列有被 scale pass 的 forEach 處理！
  - 歷史事故：v6 新增 EATERIES/HOTELS 忘了加進 scale pass → 40 間小吃店全部跑錯縣市（花蓮公正包子跑到南投）。
- 換算：遊戲內看到的 tile 座標 ÷1.5 = data.js 該寫的數字。

## 3. data.js 資料表總覽（擴充內容改這裡）

| 表 | 用途 | 備註 |
|---|---|---|
| `POLY` | 台灣本島輪廓（正規化0~1） | 動它會改變整個海岸線 |
| `ISLANDS` | 離島圓群 blobs [x,y,r] | |
| `SPINES` | 山脈脊線（hw=淺山寬、mw=岩壁寬） | |
| `TOWNS` | 129 個鄉鎮（區域顯示=最近town） | `{n,c(縣市),tx,ty}` |
| `HIGHWAYS` | 公路 polyline（`mt:true` 可鑿穿山） | |
| `RAILS` | 環島鐵路閉環節點；`STATIONS[].railIdx` 指到節點 | 改鐵路要同步兩者 |
| `CABLECARS` | 纜車（a/b 站+票價） | |
| `HARBORS` | 港口+渡輪 routes（目的地名必須存在於 HARBORS） | 位置會在載入時自動 `coastSpot()` 貼海，寫個大概即可 |
| `LANDMARKS` | 景點 `{t:類型,tx,ty,label,lines[],steam?}` | t 必須存在於 game.js 的 `SIZE` 與 `BUILDING_DRAWS` |
| `EATERIES` | 小吃店 `{tx,ty,label,food,price,icon}` | 載入時 `fitSpot()` 自動找平地 |
| `HOTELS` | 旅館（睡到隔天06:00） | |
| `ITEMS` | 物品 `{e,p,cat,hu?(食用飢餓),toy?(玩法模式)}` | 魚/蟲/玩具會自動 merge 進來 |
| `FISHES` | loc: any/sea/lake/deep(限船上) | |
| `BUGSPECS` | `rect:[x0,y0,x1,y1]` 可做區域限定種 | |
| `NPC_DEFS` | 27 位 NPC（species 對應 drawActor 分支） | |
| `TASK_POOL`+`chainOf(i)` | 夥伴3段委託（用 NPC index 雜湊生成，**不要**重排 NPC_DEFS 順序，會洗掉玩家進度感） |
| `RACES` | 18 族群服飾配色 | |
| `TOYS` | 20 玩具 `{n,e,mode:hold/throw/ground/self,mat}` | |
| `LM_POOL` | 景點類型台詞池（點擊隨機組合） | |
| `ITEM_GUIDE`+`SHOP_BUY` | 物品取得提示（game.js `guideOf()` 補魚/蟲自動提示）；雜貨店可購清單（賣價2倍） | **TASK_POOL 新增品項時，必須確認 guideOf 有提示且物品實際可取得** |
| `REF_COUNTIES` | 縣市→ref圖檔對照 | |

## 4. game.js 系統地圖（找程式碼用函式名搜尋）

- **地圖生成**：`genMap()`；落點工具 `findWalk / findWalkSafe(傳送必用!) / findWater / coastSpot / fitSpot`
- **遊戲時鐘**：`gameMin/gameDay`（1現實秒=1遊戲分，一天24分鐘）；`hourNow/isNight/isRainy/dayPeriod`；`doSleep(cost,place)` 睡到隔天06:00
- **生存**：`player.hp/hunger/tired`；進食 `eatFood(n)`；餓昏復活在 update() 生存區塊
- **乘坐系統**（共用）：`startRide(pts,kind,speed,onEnd)`＋`railPath(i0,i1)`＋`pathPos`；火車=多節車廂 `drawTrainCars`；氣球/101觀景=`player.balloonRide{r,kind}`；摩天輪=`player.ferris`；泡湯=`player.soak`；拜拜=`player.pray`。**新增「占用玩家」的狀態時，記得同步加進 update() 的移動 gate 與 interact() 開頭的 early-return**
- **船**：`player.boat(擁有)/sailing(航行中)`；水面碰撞 `hitWater`；上下船在 `interact()` 的 sailing 分支
- **夥伴/跟隨**：`partnerState{name:{s,f}}`、`followers[]`、`trail[]`（蛇形跟隨）；對話流程在 `talkTo()`
- **偶發事件**：`events[]/eventT`；生成在 update()、處理在 interact() 徒手區、繪製在 y-sort
- **蓋房**：`HOUSE_TYPES`(4型)/`myHomes[]`(上限2)/`homeMenu()/buildHome(ht)`；室內=`ui='home'` 畫在 drawUI
- **玩具**：`playToy(n)` 四種 mode（self/hold/throw/ground）；**裝備槽=工具列第7格**（`player.toy`，tool===6）。throw 類＝手持玩具做發射動作、只射出小物（`TOY_SHOT` 表），玩具不消耗
- **犯罪/警察/監獄**（v12）：持武器(`isWeapon()`：斧5/矛…實為 tool 4斧、5矛、6彈弓水槍)攻擊路人 `attackPerson(c)`→掉 coin/道具、路人 `c.flee` 逃跑、`startWanted()`。`player.wanted{phase:grace→chase,car}` 在 update() 追捕；躲進自己家(`ui==='home'`)或跑遠 340px 可逃脫；被追到 `arrest()`→`player.jailed`+`ui='jail'`+傳送桃園監獄(LANDMARKS 型別 `prison`,龍潭)。jail UI 不可 Esc 關（keydown 有 guard），只能服刑到隔天06:00 或繳 5000 保釋。jailed 有存檔、重載仍在獄
- **互動優先序**（`interact()`，改動要小心）：NPC → 路人 → 營火 → 偶發事件 → 釣魚(工具2) → sailing分支 → 網/鏟/斧/矛/玩具 → 建築 `actNearestBuilding` → 搖樹 → 採茶/草莓/仙人掌 → 拔草 → 上船
- **建築**：`addBuild()`；尺寸表 `SIZE`；繪製 `BUILDING_DRAWS[t]`；互動 `buildAct(b)` 內的 L 物件；**印章**在 buildAct 開頭 `collectStamp`
- **UI**：立即模式，`uiHits[]` 收集可點區域（**任何縮放/位移過的按鈕，push 進 uiHits 的座標要自己換算回螢幕座標**，見工具列 uS 錨點縮放寫法）；觸控=pointer events（搖桿/A鍵/雙指縮放/點地移動）；面板關閉 `drawClose()`
- **存檔**：`SAVEKEY='twisland_v3'`，欄位見 `save()`。**改地圖尺寸或大改座標時必須換 key**（舊座標會把玩家傳進海裡）

## 5. 地雷清單（全部是真實發生過的 bug）

1. **EATERIES/HOTELS 類新表忘了加 scale pass** → 全圖錯位（§2）
2. **新建築 footprint 泡海**：高跟鞋教堂/85大樓/新竹車站都淹過。新增後必跑「泡水檢查」（§6 測試片段）
3. **傳送落點用 `findWalk` 會卡進建築碰撞箱**（渡輪曾 14/16 港卡死）→ 一律用 `findWalkSafe`
4. **建築重疊**：v11 已全部修完；新增地標後必跑「重疊掃描」（§6）
5. **打獵的肉掉在地上（drops），不進背包**——測試時驗 drops 不是 inv
6. **偵錯時預覽面板的 rAF 即時在跑**：多次 eval 之間動物會走掉、殘留營火會攔截 interact()。每段測試開頭清 `ui/menu/dialog/campfires/animals/events`
7. **對話打字機要在 update(dt) 推進**，不能放 drawUI（幀率相依）
8. `.nojekyll` 勿刪；**Pages build 偶爾卡 building**：`gh api -X POST repos/.../pages/builds` 手動重建
9. gh CLI 在 `C:\Program Files\GitHub CLI\gh.exe`（不在 PATH）；git identity 是 repo-local
10. **快取**：script 用 `?v=N`，每次發版 +1，否則玩家看到舊版（曾被誤報成「沒改」）
11. 玩家曾明確拒絕「把參考圖裁成貼圖貼進遊戲」（v8→v10 已還原）。參考圖只放在 ref/ 供導覽圖檢視器用。想提升美術請「向量重繪」而非貼照片
12. **資源要有冷卻，否則無限刷錢**（v17 修）：石頭每顆 3 次(`r.left`,240s再生)、樹木砍伐每棵 2 次(`tr.woodLeft`)、打人同一目標 120 秒內不再掉落(`c.robAt`)。新增可產出金錢/道具的互動時，一律加冷卻或次數上限
13. **新離島 blob 必須配港口**（v17 補了北竿/西嶼/白沙/望安/烈嶼/山后）：兩個 blob 距離 > r1+r2 時會斷開成獨立島（noise 讓半徑 ×0.8~1.3 浮動），無港=只能自己開船。驗證法：blob 中心與該島港口距離 < r+6，斷連疑慮用「直線走路測試」確認陸路可達

## 6. 測試與發布流程

**本機跑**：`node tools/server.js 8765`（已收進 repo，回 no-store 防快取），開 http://localhost:8765。

**必跑檢查（瀏覽器 console 貼上）**：
```js
// A. 建築重疊掃描
(()=>{const n=BUILDINGS.filter(b=>b.label&&b.t!=='house');const p=[];
for(let i=0;i<n.length;i++)for(let j=i+1;j<n.length;j++){const a=n[i],b=n[j];
if(a.tx<b.tx+b.tw+1&&a.tx+a.tw+1>b.tx&&a.ty<b.ty+b.th+2&&a.ty+a.th+2>b.ty)p.push(a.label+'×'+b.label);}
return p.length?p:'OK'})()
// B. 泡水檢查（新地標）
(()=>{const w=[];for(const b of BUILDINGS){if(['harbor','archbridge','weir','canoe','windmill'].includes(b.t))continue;
let s=0;for(let dy=0;dy<b.th;dy++)for(let dx=0;dx<b.tw;dx++)if(T(b.tx+dx,b.ty+dy)===SEA)s++;
if(s>b.tw*b.th*0.3)w.push(b.label);}return w.length?w:'OK'})()
// C. 傳送落點可動性（港口+車站）
// 見 git log 中 v5 測試，用 findWalkSafe 落點後測 4 方向 moveActor
```

**發布**：`node --check data.js game.js` → index.html 的 `?v=` +1 → `git add -A && git commit && git push origin main` → 等 Pages build（`gh api repos/.../pages/builds/latest --jq .status` 直到 `built`）→ 用 `curl "https://.../game.js?chk=$(date +%s)"` 抓新特徵字串確認。

## 7. Roadmap／未實作構想

- **多人連線（玩家已詢問）**：目前純前端+localStorage，GitHub Pages 無法跑伺服器。可行路線：
  - **方案A（推薦，免費可行）**：Firebase Realtime DB 或 Supabase Realtime——每 100~200ms 上傳 `{name,x,y,face,shirt,race}`，訂閱同房間玩家繪成分身（用現成 `drawActor`）。前端加 ~150 行、註冊免費專案、把金鑰放前端（匿名讀寫規則）。不做碰撞/互動，只做「看得到彼此、一起逛」即可滿足需求。
  - 方案B：自架 Node+ws（Render/Fly 免費層），彈性高但要維護。
  - 注意：任一方案都要防呆（斷線移除 ghost、限制房間人數）。
- 縣市子地圖（進入某區展開獨立大地圖）——玩家提過，資料層已可支援（另建 map 實例）
- 美術升級：向量重繪地標成參考圖造型（勿貼照片，見地雷11）；v8 的地形圓角/有機草地程式碼在 git 歷史 `3c2e25c` 可參考（已還原）
- 參考圖中尚未入遊戲的景點：司馬庫斯、奇美博物館、正濱漁港彩色屋、龍騰斷橋、飛牛牧場、藍眼淚、得月樓、翟山坑道、潮境公園…

## 8. 給 AI 接手者的工作方式建議

1. 改「內容」（新景點/小吃/任務/魚蟲/台詞）→ 只動 data.js，跑 §6 檢查 A+B。
2. 改「玩法」→ game.js，找對應系統函式（§4），注意互動優先序與狀態 gate。
3. 每次改完：`node --check` → 本機開起來實測該功能 → 檢查 console 無錯 → 發布流程。
4. 測試時用程式直接呼叫函式驗證（如 `buildHome(HOUSE_TYPES[1])`、`startRide(railPath(0,3),'train',920,...)`），比手動走路快得多。
5. 保持繁體中文 UI 與台灣在地內容的正確性（縣市對應要查證）。
6. 玩家溝通風格：需求常一次列很多點，喜歡逐項回報表格；重視「實際看得到的改變」，發版後提醒他重新整理（快取號已處理大半）。
