# 預約系統

一個簡單易用的預約系統，使用 Cloudflare Workers + D1 資料庫。

## 功能

- 📅 月曆/週曆檢視
- 📋 右側詳情面板選擇時段
- 👤 簡單預約表單（姓名+電話）
- 🔧 後台管理（設定時段、查看預約、取消預約）
- 🔐 密碼保護後台

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定 D1 資料庫

```bash
# 創建資料庫（只需一次）
npm run d1:create

# 執行 migrations
npm run d1:migrate
```

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟 http://localhost:8787

後台：http://localhost:8787/admin
- 預設密碼：`admin123`

## 部署到 Cloudflare

### 1. 設定 Secrets

在 GitHub Repository → Settings → Secrets and variables → Actions，加入：

- `CLOUDFLARE_API_TOKEN` - 從 Cloudflare Dashboard → My Profile → API Tokens 創建
- `CLOUDFLARE_ACCOUNT_ID` - 從 Cloudflare Dashboard 右下角取得

### 2. 首次部署

```bash
# 部署 Workers
npm run deploy

# 執行線上資料庫 migration
npx wrangler d1 migrations apply appointment-db --remote
```

### 3. 自動部署

Push 到 `main` 分支會自動觸發 GitHub Actions 部署。

## 資料庫結構

- `availability` - 可預約時段設定
- `bookings` - 預約記錄
- `admin_config` - 管理員設定（密碼）

## 技術棧

- [Hono](https://hono.dev/) - 輕量 Web 框架
- [FullCalendar](https://fullcalendar.io/) - 日曆組件
- [Cloudflare Workers](https://workers.cloudflare.com/) - 無伺服器運行時
- [Cloudflare D1](https://developers.cloudflare.com/d1/) - SQLite 資料庫
