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

## Core Data Flow

1. **Multi-Tenant System**: Each client is an isolated Tenant (`tenantId`).
2. **Branch Segregation**: A Tenant can have multiple Branches (types: `restaurant`, `hotel`, or `hotel_and_restaurant`).
3. **Role-Based Access**: 
   - *Owners* see a global dashboard across all branches with the ability to drill down. (Auto-selects branch if only one exists).
   - *Managers/Staff* are bound to a specific `branchId` and interact only with local branch data.
4. **Independent Revenue Streams**: 
   - *Restaurant Flow*: Table/POS -> KOT -> KDS -> Restaurant Billing -> Restaurant Shift closing.
   - *Hotel Flow*: Reservation -> Check-in -> Housekeeping -> Checkout/Hotel Billing -> Hotel Shift closing.

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

### 🏢 Multi-Tenant & Multi-Branch Architecture
- Superadmin panel for tenant management, SaaS plans, and system payments
- Global Owner Dashboard for multi-branch performance analytics
- Branch auto-selection logic for single-branch owners
- Role-Based Access Control (Owner, Manager, Cashier, Waiter, Kitchen, Hotel Staff, Admin)

### 🏨 Hotel Management Module
- Dedicated Hotel Dashboard and Front Desk operations
- Room status, Categories, and Reservation tracking
- Housekeeping assignment and task tracking
- Independent Hotel Shifts and Paginated Billing flow

### 🧾 POS & India GST Billing
- CGST + SGST for intra-state supply, IGST for inter-state / B2B
- Automatic GST slabs calculation: 0%, 5%, 12%, 18%, 28%
- Support for Split Payments (Cash, UPI, Card, Wallet, Credit, Complimentary)
- GSTR-1 / GSTR-3B summary reports
- Amount-in-words on receipts

### 💳 Payments & Subscriptions
- Razorpay Integration for SaaS Subscriptions at the tenant level
- Razorpay per-tenant order creation for end-customer POS/Hotel billing
- Subscription Wall for expired/blocked tenants with automated limits

### 📴 Offline-First PWA
- Service Worker with `next-pwa` + Workbox
- IndexedDB cache for menu, categories, and tables
- Sync queue flushes automatically on reconnect
- Works fully offline for POS operations

### 🍳 Kitchen Display System (KDS)
- Real-time WebSocket updates via Socket.IO
- Per-item status workflow: pending → acknowledged → preparing → ready → bump
- Urgency highlighting for orders > 10 minutes
- Groups items by order ticket

### 🖨️ Hardware Integrations
- ESC/POS command builder for 58mm and 80mm thermal printers
- Web Serial API for direct USB printing (Chrome/Edge)
- Browser print fallback

### 💰 Shift & Financial Management
- Open/close shifts with denomination tracking (₹2000 down to ₹1)
- Cash reconciliation: opening + sales - refunds vs counted
- Independent shift tracking for Hotel vs Restaurant

### 📦 Backoffice, Inventory & Auditing
- Stock ledger with running balance and moving average cost tracking
- Purchase orders and low-stock / out-of-stock alerts
- Employee and Staff profile management
- Detailed Audit Logs for tracking critical actions
- Scheduled automated PostgreSQL database backups
- Integrations for Mailer, SMS notifications, and S3 Storage

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
