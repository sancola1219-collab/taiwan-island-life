# AGENTS.md — 我的小世界：台灣島物語

> Codex（及其他讀 AGENTS.md 的工具）開此專案會自動載入本檔。
> 本專案的完整 agent 指南等同 [`CLAUDE.md`](CLAUDE.md)，完整技術交接在 [`HANDOFF.md`](HANDOFF.md)。
> **接手任何修改前，先把 `HANDOFF.md` 全部讀完。** 下面是絕不能踩的紅線（與 CLAUDE.md 同步，改一個要一起改）。

## 專案一句話
動物森友會風格、以台灣為地圖的 2D 網頁遊戲。純 vanilla JS + Canvas 2D，零依賴零建置，開 `index.html` 即玩。
核心檔：`index.html`（外殼）、`data.js`（純資料層，擴充改這）、`game.js`（引擎）。

## 🚨 五條紅線（每條都是真實事故）
1. **座標放大**：data.js 所有座標用 400×520 舊基準寫，檔尾 `S=1.5` scale pass 統一放大成 600×780。新增座標表時座標寫舊基準，且務必確認新陣列有被檔尾 forEach 處理（v6 漏 EATERIES/HOTELS → 全跑錯縣市）。
2. **快取號**：每次改版，index.html 的 `data.js?v=N`、`game.js?v=N` 都要 +1，否則玩家看到舊版。目前 v11。
3. **傳送落點**：用 `findWalkSafe()`，別用 `findWalk()`（會卡進建築碰撞箱）。
4. **存檔 key**：改地圖尺寸或大改座標時 `SAVEKEY`（現 `twisland_v3`）必須換，否則舊存檔把玩家傳進海裡。
5. **美術**：玩家拒絕照片貼圖，要美術請向量重繪，勿貼參考照片。

## 改動後必做
`node --check data.js game.js` → 本機起 server（port 8765）實測 → 跑 HANDOFF §6 重疊/泡水檢查 → 快取號 +1 → `git add -A && git commit && git push origin main`（自動部署 GitHub Pages）→ 確認上線。

## 工作方式
改內容（景點/小吃/任務/魚蟲/台詞/NPC）只動 data.js；改玩法動 game.js，先在 HANDOFF §4 用函式名找對應系統。繁體中文 UI、台灣在地內容要查證。gh CLI 在 `C:\Program Files\GitHub CLI\gh.exe`（不在 PATH）。
