# 賓果開發與上線

## 本機開發

使用 Node.js 22.13 以上（測試透過內建 `node:sqlite` 執行真實 SQL 與觸發器）。

```powershell
npm ci
# 僅在全新的本機 D1 建立既有系統資料表；不要拿這個指令覆蓋正式環境。
npx wrangler d1 execute qabox --local --file worker/schema.sql
npm run db:migrate:local
npm run dev:worker
```

另開終端啟動前端，API 指向本機 Worker：

```powershell
$env:VITE_API_BASE = 'http://127.0.0.1:8787'
npm run dev
```

本機需具備已啟用的測試使用者與登入資料。不要將正式環境 Token 或帳號資料複製到測試檔案。
未設定 `VITE_API_BASE` 時，前端沿用原有正式 API 位址。請勿以本機 API 設定執行正式前端建置。

```powershell
npm run test:bingo
npm run build
npm run worker:check
```

## 正式上線順序

首次程式交付未執行部署；使用者隨後回報 404，已於 2026-10-27 套用遠端 migration 並部署 Worker。尚未執行 commit、push 或發布前端。
確認目標為 `wrangler.jsonc` 中的既有 `qagame` Worker 及 `qabox` D1，並取得對應部署權限後，依序執行：

1. `npx wrangler d1 migrations apply qabox --remote`：新增兩張賓果資料表、索引及維護成員資格的觸發器，不修改既有 QA 資料表。
2. `npx wrangler deploy`：部署包含賓果 API 與排程清理的 Worker。
3. 透過既有 GitHub Pages 流程發布前端。先確認正式建置未設定本機 `VITE_API_BASE`。
4. 使用兩個測試帳號確認加入、準備、開始、輪流抽號、重新登入恢復，以及非參賽者無法查看棋盤。

後端與 migration 必須先於前端上線。若回退前端，保留新增資料表即可，避免刪除進行中的遊戲資料。

### 2026-10-27：正式 API 404 排除紀錄

- 重現：正式 `/api/bingo/current` 與 `/api/bingo/history` 回傳純文字 `404 Not Found`，既有 `/api/duty` 回傳 200。
- 原因：前端連到正確的正式 Worker，但正式 Worker 尚未更新，D1 亦沒有賓果資料表。
- 處理：在正式 `qabox` 套用 `0001_bingo.sql`，再部署既有 `qagame` Worker。
- 新版 Worker：`2b823db4-1fef-40df-bcf0-d9bc266a6a44`；部署前版本：`77a64a22-498e-4c70-bfab-f5439bb0e544`。
- 驗證：兩個賓果 GET 端點在不帶登入憑證時均正確回傳 JSON 401，既有 API 維持 200；正式 D1 兩張表及三個觸發器均已建立。
- 限制：此次未使用真實同事 Session 進行正式環境遊戲操作；多人完整流程已於隔離的本機 workerd／D1 驗證。

### 2026-10-27：房主提早刪除已結束場次

新增 `DELETE /api/bingo/rooms/:code`，已部署正式 Worker 版本 `3035cf98-ff8c-4ee0-80c7-01b97fb51aa8`，不需要額外資料庫 migration。此更新排除新版前端送出刪除請求時，舊後端回覆「不支援的操作」的版本落差。房主權限、可刪除狀態、歷史清除及其他進行中房間不受影響，已由測試驗證；未對真實同事場次執行測試刪除。

## 同步與保留

- 前端登入後同步，頁面可見時每十秒更新；切回視窗或網路恢復時立即更新。
- 關閉系統、登出或斷線均不會退出房間，也不會取消準備、跳號或移交房主。
- 每次抽號由後端重新驗證登入身分、參賽資格與版本，成功保存後才回應畫面。
- 同一抽號請求重送時不多抽；版本衝突時更新畫面，使用者須重新確認操作。
- 結束後滿 7×24 小時即禁止透過 API 查詢；每十五分鐘的 Cron Trigger 實際清除到期房間及其成員資格。
- 只有結束的房間會到期；等待中與進行中不自動刪除。
- 舊農場 localStorage 不再被使用，也未刪除。
- 已結束場次預設摺疊，展開後可查看自己的棋盤與詳細紀錄。
- 房主可在歷史列表或場次詳情中永久刪除已結束的場次，操作前顯示確認視窗。刪除後所有參加者都無法查看，無法復原；等待中及進行中的房間不可刪除。

## API

所有端點都要求現有 `Authorization: Bearer <token>`，並確認帳號已啟用。

| 方法 | 路徑 | 用途 |
|---|---|---|
| GET | `/api/bingo/current` | 本人目前占用的房間 |
| GET | `/api/bingo/history` | 本人參加過、七天內已結束的遊戲摘要 |
| POST | `/api/bingo/rooms` | 建立房間 |
| GET | `/api/bingo/rooms/:code` | 查看參加過的房間，只回傳本人棋盤 |
| POST | `/api/bingo/rooms/:code/join` | 加入等待中的房間 |
| POST | `/api/bingo/rooms/:code/ready` | 明確設定 `ready`，並帶 `version` |
| POST | `/api/bingo/rooms/:code/start` | 房主開始，帶 `version` |
| POST | `/api/bingo/rooms/:code/draw` | 當前玩家抽號，帶 `version` 與唯一 `requestId` |
| POST | `/api/bingo/rooms/:code/leave` | 明確退出，帶 `version` |
| POST | `/api/bingo/rooms/:code/end` | 房主結束整局，帶 `version` |
| DELETE | `/api/bingo/rooms/:code` | 目前房主永久刪除已結束場次，並清除完整房間紀錄 |
