require("dotenv").config();

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { connectDB, listenForChanges } = require("./db");
const routes = require("./routes");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));
app.use("/api", routes);

const wss = new WebSocket.Server({ server });
const clients = new Set();

// keep last 50 events in memory — sent to any new client that connects
const recentEvents = [];
const MAX_EVENTS = 50;

function storeEvent(data) {
  recentEvents.unshift(data);           // newest first
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.pop();                 // drop oldest when over limit
  }
}

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`client connected — total: ${clients.size}`);

  // send all stored events to the new client so their log is not empty
  if (recentEvents.length > 0) {
    ws.send(JSON.stringify({ type: "history", events: recentEvents }));
  }

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`client disconnected — total: ${clients.size}`);
  });

  ws.on("error", (err) => {
    console.error("websocket error:", err.message);
    clients.delete(ws);
  });
});

function broadcast(data) {
  // save every event before broadcasting
  storeEvent(data);

  const message = JSON.stringify({ type: "event", ...data });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

async function start() {
  await connectDB();
  await listenForChanges(broadcast);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`server running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("failed to start:", err.message);
  process.exit(1);
});