# CLAUDE.md — 我的小世界：台灣島物語

> Claude Code 開此專案會自動載入本檔。**接手任何修改前，先完整讀 [`HANDOFF.md`](HANDOFF.md)**
> （完整技術交接：架構、座標系統、系統函式索引、歷史地雷、測試與發布流程）。
> 本檔只列「絕不能踩」的紅線與工作流程；細節一律以 HANDOFF.md 為準（若兩者衝突，以 HANDOFF.md 為對、並回頭修正本檔）。

## 專案一句話
動物森友會風格、以台灣為地圖的 2D 網頁遊戲。**純 vanilla JS + Canvas 2D，零依賴、零建置**，直接開 `index.html` 就能玩。玩家（凱凱）主要分享給手機用戶，觸控體驗優先，喜歡擬真台灣、真實景點。

三個核心檔：
- `index.html` — 外殼（CSS、開場選單、縣市導覽圖檢視器、載入 data.js→game.js 帶 `?v=N` 快取號）
- `data.js` — **純資料層**，所有內容擴充優先改這裡
- `game.js` — 引擎，系統邏輯都在這

## 🚨 五條紅線（每條都是真實發生過的事故）
1. **座標放大**：data.js 所有座標用 **400×520 舊基準**撰寫，檔尾一段 `S=1.5` 的 scale pass 統一放大成實際的 600×780。**新增座標表時，座標寫舊基準，並務必確認你的新陣列有被檔尾那段 forEach 處理**（v6 漏了 EATERIES/HOTELS → 40 間小吃店全跑錯縣市）。
2. **快取號**：每次改版，index.html 裡 `data.js?v=N` 與 `game.js?v=N` 都要 **+1**，否則玩家看到舊版（曾被誤報成「沒改」）。**目前是 v11**。
3. **傳送落點**：一律用 `findWalkSafe()`，**別用** `findWalk()`（會卡進建築碰撞箱，渡輪曾 14/16 港卡死）。
4. **存檔 key**：改地圖尺寸或大改座標時，`SAVEKEY`（現為 `twisland_v3`）**必須換**，否則舊存檔會把玩家傳進海裡。
5. **美術**：玩家明確拒絕「把參考照片裁成貼圖貼進遊戲」（v8→v10 已還原）。要美術升級請**向量重繪**，勿貼照片；ref/ 的圖只給導覽圖檢視器用。

## 改動後必做（發布流程）
1. `node --check data.js game.js`
2. 本機起靜態 server（`.claude/launch.json` 已設，port 8765）實測改到的功能
3. 跑 HANDOFF §6 的「建築重疊掃描」與「泡水檢查」console 片段
4. index.html 快取號 `?v=` +1
5. `git add -A && git commit && git push origin main`（push 即自動部署 GitHub Pages）
6. 等 Pages build 完成，用帶時間戳的 URL 抓新特徵字串確認上線

## 工作方式
- 改**內容**（景點/小吃/任務/魚蟲/台詞/NPC）→ 只動 `data.js`，跑重疊+泡水檢查。
- 改**玩法**→ `game.js`，先在 HANDOFF §4「系統地圖」用函式名找到對應系統；注意 `interact()` 的互動優先序與「占用玩家」狀態的 gate。
- 保持繁體中文 UI，台灣在地內容（縣市對應）要查證。
- 玩家溝通：需求常一次列很多點，喜歡逐項表格回報；重視「實際看得到的改變」，發版後提醒重新整理。

## 環境備忘
- gh CLI 在 `C:\Program Files\GitHub CLI\gh.exe`（不在 PATH，要用全路徑）；帳號 sancola1219-collab。
- Repo：https://github.com/sancola1219-collab/taiwan-island-life ｜ 遊玩：https://sancola1219-collab.github.io/taiwan-island-life/
- `.nojekyll` 勿刪（曾疑似導致 404）。
