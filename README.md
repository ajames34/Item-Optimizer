# 📦 Inventory Optimizer

A modern inventory and profit-tracking dashboard built with **React + Vite** (frontend) and **Node.js/Express + SQLite** (backend).

## Quick Start

### 1. Start the Backend

```bash
cd backend
npm start
# API runs on http://localhost:4000
```

### 2. Start the Frontend (in a new terminal)

```bash
cd frontend
npm run dev
# App opens on http://localhost:5173
```

## Features

| Feature | Description |
|---|---|
| 📊 Dashboard | Real-time metrics: revenue, profit, stock value, unit sales |
| 📦 Inventory | Full CRUD for products with SKU, stock, cost, and retail price |
| 🛒 Sales | Record sales, auto-deduct stock, compute profit per-transaction |
| 🔴 Low Stock Alerts | Products with ≤ 5 units highlighted on the dashboard |
| 🏆 Top Products | Sorted by realized profit |
| 🧾 Sales Log | Full historical transaction log |

## Tech Stack

- **Frontend**: React 18, Vite, Vanilla CSS
- **Backend**: Node.js, Express 4
- **Database**: SQLite (`better-sqlite3`), WAL mode enabled

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/dashboard` | Aggregated dashboard stats |
| GET | `/api/inventory` | List all products |
| POST | `/api/inventory` | Add a product |
| PUT | `/api/inventory/:id` | Update a product |
| DELETE | `/api/inventory/:id` | Delete a product |
| GET | `/api/sales` | List all sales |
| POST | `/api/sales` | Record a sale |
