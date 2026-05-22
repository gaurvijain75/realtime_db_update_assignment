# OrderPulse — Real-Time Order Updates

A backend system that pushes database changes to connected clients **instantly**, without any polling.

---

## How It Works

```
DB change (insert/update/delete)
       ↓
Postgres trigger fires automatically
       ↓
NOTIFY sent on 'orders_channel'
       ↓
Node.js server receives the notification
       ↓
Broadcasts to all clients via WebSocket
       ↓
Browser updates the table in real time
```

The key insight: the database itself fires the event. No timers, no polling, no wasted requests.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Database | PostgreSQL | Native LISTEN/NOTIFY — built-in pub/sub, no extra tools |
| Backend | Node.js + Express | Lightweight, great WebSocket support |
| Real-time transport | WebSocket (ws) | Persistent connection, instant push from server to client |
| Frontend | Vanilla HTML/JS | No framework needed for this use case |

---

## Project Structure

```
realtime-orders/
├── src/
│   ├── server.js    — Express + WebSocket server
│   ├── db.js        — Postgres connection, schema setup, LISTEN logic
│   └── routes.js    — REST API for orders (GET, POST, PATCH, DELETE)
├── public/
│   └── index.html   — Frontend dashboard
├── .env.example     — Environment variable template
└── package.json
```

---

## Step 1 — Install PostgreSQL

### Windows
1. Go to https://www.postgresql.org/download/windows/
2. Download the installer (pick the latest version)
3. Run it → click Next → Next → Next (defaults are fine)
4. When asked for a password, set something simple like `postgres123` — **remember this**
5. Default port is `5432` — leave it
6. Finish the install

After installing, open **pgAdmin** (installed with Postgres) or use the terminal:

```bash
# open the postgres terminal (psql)
psql -U postgres
```

### Mac
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Create the database
Once postgres is running:
```bash
psql -U postgres
```
Then inside psql:
```sql
CREATE DATABASE ordersdb;
\q
```

---

## Step 2 — Clone and Install Dependencies

```bash
# clone the repo
git clone https://github.com/yourusername/realtime-orders.git
cd realtime-orders

# install node packages
npm install
```

---

## Step 3 — Set Up Environment Variables

```bash
# copy the example file
cp .env.example .env
```

Open `.env` and set your database URL:

```
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/ordersdb
PORT=3000
NODE_ENV=development
```

Replace `postgres123` with whatever password you chose during Postgres install.

---

## Step 4 — Run the Server

```bash
npm start
```

You should see:
```
postgres connected at: 2026-05-22T...
schema and trigger ready
listening for order changes...
server running on http://localhost:3000
```

Open **http://localhost:3000** in your browser — the dashboard is live.

---

## Step 5 — Test It

Open the dashboard in **two browser tabs side by side**.

Add an order in one tab — watch it appear instantly in the other tab without any refresh.

Or test via curl:
```bash
# add an order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_name":"Alice","product_name":"MacBook","status":"pending"}'

# update status
curl -X PATCH http://localhost:3000/api/orders/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"shipped"}'

# delete
curl -X DELETE http://localhost:3000/api/orders/1
```

Every one of these will instantly update all connected browser clients.

---

## Hosting on Render (Free)

### Database — use Neon (free Postgres cloud)
1. Go to https://neon.tech and sign up (free)
2. Create a new project → it gives you a **connection string** like:
   ```
   postgresql://user:pass@ep-something.neon.tech/neondb?sslmode=require
   ```
3. Copy it — you'll use this as `DATABASE_URL`

### Backend — deploy on Render
1. Push your code to GitHub
2. Go to https://render.com and sign up (free)
3. Click **New → Web Service**
4. Connect your GitHub repo
5. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
6. Add environment variable:
   - Key: `DATABASE_URL`
   - Value: your Neon connection string
   - Key: `NODE_ENV`
   - Value: `production`
7. Click **Deploy**

Render gives you a URL like `https://realtime-orders.onrender.com` — share that link.

---

## Why Not MySQL or MongoDB?

**MySQL** doesn't have a native push notification system. You'd need external tools like Debezium or Maxwell to parse the binary log, which adds a lot of complexity.

**MongoDB** has Change Streams but requires running a Replica Set even for local development — extra setup overhead for no benefit here since the data model is clearly relational.

**PostgreSQL's LISTEN/NOTIFY** lets the database itself fire events the moment a row changes. The trigger handles everything — no polling, no middleware, no extra processes.

---

## Scalability Notes

The current setup handles a few hundred concurrent WebSocket connections comfortably on a single Node.js process.

To scale further:
- Run multiple Node.js instances behind a load balancer
- Replace direct Postgres LISTEN with **Redis Pub/Sub** — each instance subscribes to Redis, and one listener publishes to it
- This way all instances receive all events and broadcast to their own connected clients

This is the standard production pattern used by apps like Slack and Notion.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | /api/orders | Fetch all orders |
| POST | /api/orders | Create a new order |
| PATCH | /api/orders/:id | Update order status |
| DELETE | /api/orders/:id | Delete an order |
