# AGENTS.md — Q-Draft 除草室（QA 管理系統）

本文件供 AI Agent 與開發者快速理解專案、安全修改程式碼。除非使用者明確覆寫，否則所有任務皆應遵守本文。

---

## 專案簡介

**Q-Draft 除草室** 是內部 QA 測試管理系統，供測試員記錄測試報告、追蹤儀表板統計、管理協作公告與值班輪值。

| 項目 | 說明 |
|------|------|
| 前端 | 靜態 HTML + Vanilla JS + Tailwind CSS（CDN） |
| 後端 | Cloudflare Worker + D1（SQLite） |
| 前端部署 | GitHub Pages（push `main` 自動部署） |
| 後端部署 | `wrangler deploy`（根目錄 `wrangler.jsonc`） |
| 語系 | 繁體中文（zh-TW） |
| 時區 | 一律以 `Asia/Taipei` 計算日期 |

---

## 架構

```
瀏覽器 (GitHub Pages)
  index.html ── style.css
       │
       └── app.js ── fetch ──► Cloudflare Worker (qagame)
                                    │
                                    └── D1 資料庫 (qabox)
```

- 前後端分離：前端靜態託管，API 指向 `app.js` 頂端的 `API_BASE`。
- 認證：登入後 token 存 `localStorage`，多數寫入 API 需在 body 帶 `token`。
- 快取：部署時 CI 會 stamp `app-version` 與 `?v=` query string；前端有版本比對與手動清快取機制。

---

## 目錄結構

### 核心檔案（修改功能時主要動這些）

| 檔案 | 職責 |
|------|------|
| `index.html` | 所有 view 的 DOM 結構、modal、導覽列 |
| `app.js` | 前端邏輯（~3500 行）：認證、view 切換、表單、圖表、API 呼叫 |
| `style.css` | 自訂樣式（動畫、scrollbar、status badge 等） |
| `worker/src/index.js` | Worker 路由、權限、D1 查詢、資料遷移 |
| `worker/schema.sql` | D1 資料表定義（參考用，非自動 migration） |
| `wrangler.jsonc` | Worker 正式部署設定（D1 binding、worker 名稱 `qagame`） |
| `.github/workflows/deploy.yml` | GitHub Pages 部署與版號 stamp |

### 遺留／輔助腳本（通常不要動、不要納入部署）

根目錄有大量 `patch_*.js`、`search_*.js`、`repatch_*.js`、`test_*.js` 等 Node 一次性腳本，用於過往批次修改。新功能應直接改核心檔案，不要新增同類 patch 腳本。

---

## 前端慣例

### View 切換

- 五個主 view：`dashboard`、`workspace`、`reports`、`documents`、`users`
- DOM id 規則：`view-{name}`、`nav-{name}`
- 入口函式：`switchView(viewId)` — 切換時觸發對應 `load*` / `fetch*`

### 狀態存放

| localStorage key | 用途 |
|------------------|------|
| `qa_session_token` | API 認證 token |
| `qa_user_id` | 使用者 ID（報告歸屬） |
| `qa_display_name` | 顯示名稱 |
| `qa_username` | 帳號 |
| `qa_role` | `admin` 或 `user` |
| `qa_app_version_ack` | 已確認的前端版號 |

### 報告相關慣例

- **案件編號**：`T` 開頭 = 測試報告；`P` 開頭 = 上正式
- **狀態**：`Pass`、`Fail`、`Blocked`（大小寫混用存在，修改時注意相容）
- **notes 格式**：結構化文字，含 `案件編號`、`專案名稱`、`測試日期`、`測試人員` 等行；`測試員備註：` 為獨立段落（舊稱 `QA備註`）
- **歸屬判斷**：優先 `owner_user_id`，fallback 比對 `tester_name` 或 notes 內 `測試人員`
- **權限**：`canUserModifyReport()` — admin 或報告擁有者可編輯
- **左右欄位即時同步**：
  - 在「新增」、「上正式」、「修改」與「複製」模式下，左側表單欄位修改時，右側預覽框（`generated-result`）必須實時同步（透過 `syncPreviewHeaderFields`、`syncPreviewMiddleFields`、`syncPreviewTailFields` 進行局部更新）。
  - 在「編輯」與「複製」載入資料後，會立即顯式觸發一次這三個同步函數，以防新案號、新日期等變更在 Modal 開啟時未反映在右側。
- **備註與 QA 備註分離**：
  - **左側備註**（工單說明，`form-steps`）：為多行 Block，會同步至右側預覽框的 `備註：` 區塊（使用 `upsertPreviewBlock`，而非 `upsertPreviewLine`，以正確處理多行文字）。
  - **右側 QA 備註**（測試員備註，`form-notes`）：屬於獨立欄位，不在右側預覽框中進行即時預覽，只在儲存時（`prepareNotesForSave`）才拼貼於 final notes 尾端，即 `測試員備註：${remark}`。

### UI 技術棧

- Tailwind 透過 CDN，自訂色在 `index.html` 的 `tailwind.config`
- Chart.js 用於儀表板圖表
- 無 bundler、無框架 — 保持 plain JS 風格，函式多為全域函式 + `onclick` 屬性

### 修改前端時注意

1. 若改 `app.js` 或 `style.css`，部署後 CI 會自動更新 cache bust query；本地手動測試可加 `?v=timestamp`
2. `meta[name="app-version"]` 與 script/link 的 `?v=` 需與 deploy workflow 的 sed 格式相容
3. 新增 DOM 元素優先放在對應 `view-*` section 內，維持現有 Tailwind class 風格

---

## 後端慣例

### 路由風格

- 單一 `fetch` handler，以 `url.pathname` + `request.method` 分支
- 所有回應帶 `corsHeaders`（`Access-Control-Allow-Origin: *`）
- 錯誤訊息使用繁體中文

### API 端點一覽

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/register` | 註冊（新帳號預設未啟用） |
| POST | `/api/login` | 登入，回傳 token |
| POST | `/api/logout` | 登出 |
| GET | `/api/reports` | 查詢報告（支援 `tester`、`owner_user_id`、`admin_edited_by` 等 query） |
| GET | `/api/reports/next-case-no` | 取得下一個案件編號 |
| POST | `/api/reports` | 新增報告 |
| POST | `/api/reports/update` | 更新報告 |
| POST | `/api/reports/pin` | 釘選／取消釘選 |
| POST | `/api/reports/delete` | 軟刪除（進垃圾桶） |
| GET | `/api/reports/trash` | 垃圾桶列表 |
| POST | `/api/reports/restore` | 還原 |
| POST | `/api/reports/purge` | 永久刪除 |
| GET | `/api/users` | 使用者列表（admin） |
| POST | `/api/users/toggle` | 啟用／停用帳號 |
| POST | `/api/users/reset-password` | 重設密碼 |
| GET | `/api/duty` | 本週值班人員 |
| POST | `/api/duty/roster` | 設定值班輪值表 |
| GET | `/api/stats` | 儀表板統計 |
| GET/POST | `/api/collab/bulletins` | 協作公告 CRUD |
| DELETE | `/api/collab/bulletins/:id` | 刪除公告 |
| POST | `/api/admin/migrate-tester-remarks` | 一次性備註格式遷移 |
| POST | `/api/admin/link-report-owner` | 報告歸屬 backfill |

### 資料庫（D1）

主要資料表：`reports`、`users`、`sessions`、`settings`、`bulletins`、`documents`

- `reports.is_deleted`：軟刪除旗標
- `reports.owner_user_id`：報告擁有者（有 runtime migration/backfill）
- `settings`：key-value 儲存（值班表、migration 旗標等）
- 時間戳使用 `datetime('now', '+8 hours')` 對齊台灣時間

### 修改後端時注意

1. 前後端若有相同邏輯（如 `getReportOwnerName`、notes 解析），兩邊可能各有一份 — 改業務規則時**兩邊都要檢查**
2. Schema 變更：Worker 內有 `ensureOwnerUserIdColumn` 等 pattern，新欄位可參考；正式變更需手動對 D1 執行 SQL
3. 部署：`npx wrangler deploy`（使用根目錄 `wrangler.jsonc`，非 `worker/wrangler.toml`）

---

## 部署流程

### 前端（自動）

```
git push origin main
  → GitHub Actions: stamp version → deploy to GitHub Pages
```

### 後端（手動）

```bash
npx wrangler deploy
```

### 本地開發

- 前端：直接用靜態 server 開 `index.html`（或開啟本地檔案），API 指向遠端 Worker
- Worker：`npx wrangler dev`（需 Cloudflare 帳號與 D1 權限）

---

## 常見任務指引

| 任務 | 主要修改處 |
|------|------------|
| 新增 UI 區塊 / modal | `index.html` + `app.js`（必要時 `style.css`） |
| 新增 API | `worker/src/index.js` + `app.js` 呼叫端 |
| 儀表板統計 | `worker` `/api/stats` + `app.js` `loadDashboard()` |
| 個人工作臺 | `app.js` `loadWorkspace()` 及相關 render 函式 |
| 報告表單／預覽 | `app.js` 內 `parseReportNotesToForm`、`syncPreviewHeaderFields` 等 |
| 權限邏輯 | `canUserModifyReport`（前端）+ `userOwnsReport`（後端） |
| 協作公告 | `loadCollaborationBoard` / bulletins API |

---

## 驗證清單（完成前自行確認）

- [ ] 繁體中文文案正確、與現有用語一致
- [ ] 台灣時區日期計算無誤
- [ ] admin / 一般使用者權限行為正確
- [ ] 報告 CRUD、垃圾桶、釘選流程正常
- [ ] 若動到 API，前端 `API_BASE` 路徑與 body 格式一致
- [ ] 未意外修改 `patch_*.js` 等遺留腳本
- [ ] 未提交 secrets（`.env`、帳號 token 等）

---

## Agent 通用規則

以下規則適用於本專案所有任務。非瑣碎工作以謹慎優先於速度。

### Rule 1 — Think Before Coding

明確陳述假設。不確定時先問，不要猜。
有歧義時列出多種解讀。有更簡單做法時提出異議。
困惑時停下來，說清楚哪裡不清楚。

### Rule 2 — Simplicity First

用最少程式碼解決問題，不做推測性開發。
不超出需求範圍。不為一次性邏輯抽象化。
自問：資深工程師會覺得過度設計嗎？會的話就簡化。

### Rule 3 — Surgical Changes

只改必須改的。只清理自己造成的混亂。
不順手「優化」周邊程式碼、註解或格式。
不 refactor 沒壞的東西。符合現有風格。

### Rule 4 — Goal-Driven Execution

定義成功標準，反覆驗證直到達成。
不要盲跟步驟。定義目標後迭代。
明確的成功標準讓你能獨立推進。

### Rule 5 — Use the model only for judgment calls

模型用於：分類、起草、摘要、抽取。
不要用於：路由、重試、確定性轉換。
能寫程式判斷的，就用程式。

### Rule 6 — Token budgets are not advisory

單任務：4,000 tokens。單 session：30,000 tokens。
接近上限時摘要並重新開始。主動說明超限，不要默默超支。

### Rule 7 — Surface conflicts, don't average them

兩種模式矛盾時，選一個（較新 / 較常測試的）。
說明原因，標記另一個待清理。不要混搭。

### Rule 8 — Read before you write

加程式前先讀 exports、直接呼叫者、共用工具。
「看起來無關」很危險。不確定結構原因時先問。

### Rule 9 — Tests verify intent, not just behavior

測試要驗證「為什麼重要」，不只「做了什麼」。
業務邏輯變了卻不會失敗的測試是無效的。

### Rule 10 — Checkpoint after every significant step

每完成重要步驟：摘要做了什麼、驗證了什麼、還剩什麼。
無法清楚描述現狀時不要繼續。迷路就停下重述。

### Rule 11 — Match the codebase's conventions, even if you disagree

符合既有慣例 > 個人偏好。
若認為慣例有害，提出來討論，不要默默分叉。

### Rule 12 — Fail loud

有任何步驟被靜默跳過，就不能說「完成」。
有測試被 skip，就不能說「測試通過」。
預設揭露不確定性，不要隱藏。
