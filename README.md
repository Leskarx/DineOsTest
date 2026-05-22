# 🍽️ Dine&Stay OS

**Restaurant POS & Hotel Management SaaS** — Multi-tenant, India GST-compliant, Offline-first PWA.

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Frontend    | Next.js 14, TypeScript, Tailwind CSS |
| Backend     | NestJS, TypeScript                  |
| Database    | PostgreSQL 16                       |
| Cache       | Redis 7                             |
| Real-time   | Socket.IO (WebSocket)               |
| Deployment  | Docker + Docker Compose             |
| Monorepo    | Turborepo + npm workspaces          |

---

## Subscription Plans

| Plan       | Price/mo  | Branches | Users | Features                                          |
|------------|-----------|----------|-------|---------------------------------------------------|
| Starter    | ₹2,999    | 1        | 10    | POS, Billing, GST, KDS, Inventory, Shifts, Reports |
| Growth     | ₹7,999    | 5        | 50    | + Multi-branch, HQ Dashboard, Advanced Reports    |
| Enterprise | Custom    | ∞        | ∞     | Everything + white-label, API access              |

---

## Project Structure

```
dine-and-stay-os/
├── apps/
│   ├── api/                    # NestJS backend (port 4000)
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/       # JWT auth, refresh tokens, PIN login
│   │       │   ├── tenants/    # Multi-tenant management
│   │       │   ├── subscriptions/ # Plans, feature flags
│   │       │   ├── branches/   # Multi-branch with HQ
│   │       │   ├── users/      # Staff management + roles
│   │       │   ├── tables/     # Table & section management
│   │       │   ├── menu/       # Categories, items, GST rates
│   │       │   ├── orders/     # POS orders + KOT + WebSocket
│   │       │   ├── billing/    # GST invoice, split payments
│   │       │   ├── inventory/  # Stock ledger, alerts
│   │       │   ├── shifts/     # Day/shift closing, denomination count
│   │       │   ├── kds/        # Kitchen Display System
│   │       │   └── reports/    # Sales, GST, items, payments
│   │       └── database/seeds/ # Demo data seeder
│   └── web/                    # Next.js 14 frontend (port 3000)
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── (auth)/     # Login, Register
│           │   └── (dashboard)/ # All POS pages
│           ├── components/     # UI components
│           ├── lib/            # api, gst, printer, offline (IndexedDB)
│           ├── hooks/          # useSocket, useOnlineStatus
│           └── store/          # Zustand (auth, pos)
├── packages/
│   └── shared/                 # Shared TypeScript types & constants
├── scripts/
│   └── init-db.sql             # Complete PostgreSQL schema
├── nginx/
│   └── nginx.conf              # Reverse proxy config
├── docker-compose.yml          # Development
└── docker-compose.prod.yml     # Production
```

---

## Quick Start

### 1. Prerequisites
- Node.js 20+, Docker Desktop

### 2. Clone & setup
```bash
git clone <repo>
cd dine-and-stay-os
cp .env.example .env
```

### 3. Start with Docker
```bash
# Start Postgres + Redis
docker-compose up -d postgres redis

# Install dependencies
npm install

# Seed demo data
npm run db:seed

# Start API + Web
npm run dev
```

### 4. Access
| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000         |
| API       | http://localhost:4000/api    |
| Swagger   | http://localhost:4000/api/docs |

### Demo credentials
```
Tenant ID:  (shown after seed)
Email:      demo@spicegarden.in
Password:   Demo@1234
```

---

## Key Features

### 🧾 India GST Billing
- CGST + SGST for intra-state supply
- IGST for inter-state / B2B (auto-switches on customer GSTIN entry)
- GST slabs: 0%, 5%, 12%, 18%, 28%
- GSTR-1 / GSTR-3B summary reports
- Amount-in-words on receipts

### 🖨️ Thermal Printing
- ESC/POS command builder for 58mm and 80mm printers
- Web Serial API (Chrome/Edge) for direct USB printing
- Browser print fallback (any browser)
- KOT (Kitchen Order Ticket) printing

### 📴 Offline-First PWA
- Service Worker with `next-pwa` + Workbox
- IndexedDB cache for menu, categories, tables
- Sync queue flushes automatically on reconnect
- Works fully offline for POS operations

### 🍳 Kitchen Display System (KDS)
- Real-time WebSocket updates via Socket.IO
- Per-item status: pending → acknowledged → preparing → ready → bump
- Urgency highlighting for orders > 10 minutes
- Groups items by order ticket

### 💰 Shift Management
- Open/close shifts with denomination count
  - ₹2000, ₹500, ₹200, ₹100, ₹50, ₹20, ₹10, ₹5, ₹2, ₹1
- Cash reconciliation: opening + sales - refunds vs counted
- Payment method breakdown (Cash/UPI/Card/Wallet/Credit/Complimentary)
- GST summary per shift

### 📦 Inventory
- Stock ledger with running balance
- Moving average cost tracking
- Low stock & out-of-stock alerts
- Purchase orders with supplier management
- Auto-deduction on sale (when linked to menu items)

---

## API Endpoints (v1)

```
POST   /api/v1/auth/register        Register tenant (14-day trial)
POST   /api/v1/auth/login           Login
POST   /api/v1/auth/refresh         Refresh token

GET    /api/v1/menu/categories      List categories
POST   /api/v1/menu/items           Create menu item
GET    /api/v1/menu/gst-rates       List GST rates

POST   /api/v1/orders               Create order
POST   /api/v1/orders/:id/items     Add items (KOT)
PATCH  /api/v1/orders/:id/status    Update status
PATCH  /api/v1/orders/:id/discount  Apply discount

POST   /api/v1/billing/bills        Generate bill + process payment
GET    /api/v1/billing/bills        List bills

GET    /api/v1/kds/pending          KDS pending items
PATCH  /api/v1/kds/items/:id/bump   Bump item (mark ready)

GET    /api/v1/shifts/active        Get active shift
POST   /api/v1/shifts/open          Open shift with denomination count
POST   /api/v1/shifts/:id/close     Close shift

GET    /api/v1/reports/dashboard    Dashboard summary
GET    /api/v1/reports/daily-sales  Daily sales report
GET    /api/v1/reports/gst          GST report (GSTR-1/3B)

GET    /api/v1/inventory/alerts     Low stock alerts
POST   /api/v1/inventory/transactions  Record stock movement
```

---

## Environment Variables

See `.env.example` for all required variables.

---

## License
Proprietary — Dine&Stay Technologies Pvt. Ltd.
