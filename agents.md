# AGENTS.md — Q-Draft 除草室（QA 管理系統）

本文件供 AI Agent 與開發者快速理解專案、安全修改程式碼。所有任務皆應遵守本文規範。

---

## 專案簡介

**Q-Draft 除草室** 是內部 QA 測試管理系統，供測試員記錄測試報告、追蹤儀表板統計、管理協作公告與值班輪值。

| 項目 | 說明 |
|------|------|
| 前端架構 | **Vite + Vue 3 (Composition API / `<script setup lang="ts">`) + TypeScript** |
| UI 元件庫 | **Element Plus (繁中 zh-tw) + Tailwind CSS** |
| 狀態管理 | **Pinia (`@/stores/`)** |
| 前端路由 | **Vue Router (Hash 模式 `createWebHashHistory`)** |
| 後端架構 | **Cloudflare Worker + D1 (SQLite)** |
| 前端部署 | GitHub Pages（push `main` 自動觸發 GitHub Actions 執行 `npm run build` 並部署 `dist/`） |
| 後端部署 | `wrangler deploy`（根目錄 `wrangler.jsonc`） |
| 語系 | 繁體中文（zh-TW） |
| 時區 | 一律以 `Asia/Taipei` 計算日期 |

---

## 現代化目錄結構

```
qabox/
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions (npm run build -> Deploy dist)
├── public/                      # 靜態資源 (qaicon.jpg 等)
├── src/                         # 前端現代化核心原始碼 (Vue 3 + TS)
│   ├── api/                     # 封裝 Worker API 請求
│   │   └── client.ts            # Type-safe API Client
│   ├── assets/                  # 全域樣式與 Tailwind
│   │   └── main.css             # Tailwind 引入與客製化樣式
│   ├── components/              # 業務元件
│   │   ├── layout/Navbar.vue    # 頂部導覽列
│   │   └── reports/ReportFormDialog.vue # 報告新增/編輯/複製 Modal (含即時雙向預覽)
│   ├── router/                  # Vue Router 設定與導航守衛
│   │   └── index.ts             # 路由配置 (Hash mode)
│   ├── stores/                  # Pinia 集中狀態庫
│   │   ├── auth.ts              # 登入身分、角色與權限檢查
│   │   └── reports.ts           # 報告列表快取、篩選與 CRUD
│   ├── types/                   # TypeScript 型別宣告
│   │   └── index.ts             # Report, User, Bulletin, Duty 等介面
│   ├── utils/                   # 工具函式
│   │   ├── date.ts              # 台灣時區 (Asia/Taipei) 處理函式
│   │   └── parser.ts            # 工單智慧解析與報告模板產生器
│   ├── views/                   # 視圖頁面
│   │   ├── LoginView.vue        # 登入與註冊頁
│   │   ├── WorkspaceView.vue    # 個人工作臺 (值班、公告、本月統計)
│   │   ├── ReportsView.vue      # 測試報告中心 (進階篩選、垃圾桶)
│   │   ├── DashboardView.vue    # 數據統計儀表板 (Chart.js)
│   │   ├── DocumentsView.vue    # 規範文件中心
│   │   └── UsersView.vue        # 人員與權限管理 (Admin)
│   ├── App.vue                  # 根元件
│   └── main.ts                  # 前端進入點 (Vue 實例化、Element Plus 註冊)
├── worker/                      # 後端 Cloudflare Worker 原始碼
│   ├── src/index.js             # Worker API 路由與 D1 查詢
│   └── schema.sql               # D1 資料庫定義參考
├── wrangler.jsonc               # Cloudflare Worker 部署設定
├── package.json                 # 專案依賴管理
├── tsconfig.json                # TypeScript 編譯組態
├── vite.config.ts               # Vite 打包建置組態
└── tailwind.config.js           # Tailwind CSS 組態
```

---

## 前端核心慣例

### 1. 路由與權限
- 路由使用 Hash 模式 (`/#/workspace`, `/#/reports` 等)，確保在 GitHub Pages 靜態託管下無 404 問題。
- 導航守衛 (`src/router/index.ts`) 自動檢查登入 Token，未登入者重定向至 `/#/login`。
- `requiresAdmin: true` 路由（如 `/#/users`）僅允許 `role === 'admin'` 存取。

### 2. 雙向預覽與工單解析
- 第一步工單貼上後，由 `src/utils/parser.ts` 中的 `parseReportNotesToFields` 自動解析欄位。
- 在 `ReportFormDialog.vue` 中，左側表單欄位修改時，右側預覽框（`generatedPreview`）透過 Vue 響應式屬性 (`computed`) 達成 100% 零延遲動態渲染。
- **備註與 QA 備註分離**：
  - **工單說明 (form_steps)**：同步於預覽框的「備註：」區塊，支援多行文字。
  - **測試員備註 (testerRemark)**：獨立欄位，僅在儲存時拼貼於 notes 結尾（`測試員備註：${remark}`）。

### 3. 本地開發與構建
- 本地開發：`npm run dev`（毫秒級 HMR 熱重載）。
- 編譯與型別檢查：`npm run build`（執行 `vue-tsc -b` 與 `vite build`）。
- 部署：推送到 GitHub `main` 分支後，GitHub Actions 自動 build 並發布 `dist/` 至 GitHub Pages。

---

## 後端慣例

- 後端路徑為 `worker/src/index.js`，部署使用根目錄 `wrangler.jsonc`。
- 本地 Worker 偵錯：`npx wrangler dev`。
- 正式部署：`npx wrangler deploy`。
- API 回應一律為 JSON 格式並攜帶 CORS Headers。
