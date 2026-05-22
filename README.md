# OrderPulse — Real-Time Order Updates

A backend system that pushes database changes to connected clients **instantly**, without any polling. Built for the Apt Interview Assignment.

🔴 **Live Demo:** https://realtime-db-update-assignment.onrender.com

---

## What It Does

When any order is inserted, updated, or deleted in the database — every connected browser client sees the change **immediately**, without refreshing the page. The database itself fires the event through a trigger, so even changes made directly via SQL (outside the app) will still reach all clients in real time.

---

## How It Works

```
DB change (insert / update / delete)
           ↓
Postgres trigger fires automatically
           ↓
NOTIFY sent on 'orders_channel'
           ↓
Node.js server receives the notification
           ↓
Broadcasts to all connected clients via WebSocket
           ↓
Browser updates the table instantly — no refresh needed
```

The key design decision: **the database drives the events, not the application layer.** This means even direct SQL changes (from pgAdmin, scripts, or other services) will propagate to clients automatically.

---

## Tech Stack & Why

| Layer | Choice | Why |
|---|---|---|
| Database | PostgreSQL | Native LISTEN/NOTIFY — built-in pub/sub with zero extra infrastructure. No polling, no middleware, the DB itself pushes events the moment a row changes. |
| Backend | Node.js + Express | Non-blocking I/O handles many concurrent WebSocket connections efficiently. Lightweight and fast to set up. |
| Real-time transport | WebSocket (ws) | Persistent two-way connection — server can push to clients instantly. Unlike HTTP polling, there's no repeated request overhead. |
| Frontend | Vanilla HTML/JS | No framework needed. Keeps the client simple, fast, and easy to understand without build tools. |
| Deployment | Docker + Render | Docker ensures the app runs identically in any environment. Render auto-deploys on every GitHub push. |
| Cloud DB | Neon (Postgres) | Free hosted Postgres with full LISTEN/NOTIFY support — no local DB required for the live demo. |

### Why PostgreSQL over MySQL or MongoDB?

**MySQL** has no native pub/sub. Replicating this would require parsing binary logs with external tools like Debezium — adding unnecessary complexity.

**MongoDB** has Change Streams but requires a Replica Set even for local development, which is heavy setup overhead. The data model here is also clearly relational.

**PostgreSQL's LISTEN/NOTIFY** is built in, requires zero extra tools, and fires synchronously with the transaction — making it the cleanest solution for this problem.

---

## Features

- **Real-time updates** — all connected clients receive inserts, updates, and deletes instantly via WebSocket
- **Live dashboard** — browser UI shows all orders in a table with color-coded status badges
- **Add orders** — create new orders with customer name, product, and status
- **Update orders** — edit any field (customer name, product name, status) via a modal form
- **Delete orders** — confirmation modal shows full order details before deletion
- **Activity log** — shows every database event (INSERT / UPDATE / DELETE) with exactly what changed
- **Change detection** — UPDATE events show which fields changed and their old → new values
- **Log history** — last 50 events stored in server memory and replayed to any new client that connects, so the log isn't empty on refresh
- **Auto-reconnect** — if the WebSocket drops, the client reconnects automatically every 3 seconds
- **Dockerized** — runs in a container, consistent across all environments

---

## Project Structure

```
realtime-orders/
├── src/
│   ├── server.js    — Express server, WebSocket setup, event broadcasting
│   ├── db.js        — Postgres connection, schema + trigger setup, LISTEN logic
│   └── routes.js    — REST API (GET / POST / PATCH / DELETE orders)
├── public/
│   └── index.html   — Frontend dashboard (HTML + CSS + JS, no framework)
├── Dockerfile       — Container definition for deployment
├── .env.example     — Environment variable template
└── package.json
```

---

## Local Setup

### Prerequisites
- Node.js v18+
- PostgreSQL 14+ installed and running

### Step 1 — Clone the repo

```bash
git clone https://github.com/gaurvijain75/realtime_db_update_assignment.git
cd realtime_db_update_assignment
```

### Step 2 — Create the database

```bash
psql -U postgres
```
```sql
CREATE DATABASE ordersdb;
\q
```

### Step 3 — Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your Postgres password:

```
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/ordersdb
PORT=3000
NODE_ENV=development
```

### Step 4 — Install dependencies and start

```bash
npm install
npm start
```

You should see:
```
postgres connected at: 2026-05-22T...
schema and trigger ready
listening for order changes...
server running on http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

## Testing Real-Time Updates

1. Open **http://localhost:3000** in two browser tabs side by side
2. Add an order in one tab — watch it appear instantly in the other
3. Click **update** on any order — edit any field and save — both tabs update immediately
4. Click **delete** — confirm deletion — order disappears from both tabs at the same time

Or test directly via terminal to prove DB-level triggers work:

```bash
# insert directly into DB — bypasses the app entirely
psql -U postgres -d ordersdb -c \
  "INSERT INTO orders (customer_name, product_name, status, updated_at) \
   VALUES ('Terminal User', 'Laptop', 'pending', NOW());"
```

The browser will update instantly — proving the trigger fires at the database level, not just through the API.

---

## Running with Docker

```bash
docker build -t orderpulse .
docker run -p 3000:3000 --env DATABASE_URL=your_db_url orderpulse
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/orders | Fetch all orders |
| POST | /api/orders | Create a new order |
| PATCH | /api/orders/:id | Update any fields on an order |
| DELETE | /api/orders/:id | Delete an order |

---

## Scalability Notes

The current architecture comfortably handles hundreds of concurrent WebSocket connections on a single Node.js process.

To scale horizontally:
- Run multiple Node.js instances behind a load balancer
- Replace direct Postgres LISTEN with **Redis Pub/Sub** — each instance subscribes to Redis, one listener publishes DB events to it, and all instances broadcast to their own connected clients

This is the standard production pattern used by real-time systems like Slack and Notion.

---

## Deployment

Hosted on **Render** (Docker) with **Neon** as the cloud Postgres database.

Every push to `main` on GitHub triggers an automatic redeploy on Render.

🔴 **Live:** https://realtime-db-update-assignment.onrender.com
