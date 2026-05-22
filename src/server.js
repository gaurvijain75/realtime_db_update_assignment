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

// websocket server on the same port
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on("connection", (ws) => {
  clients.add(ws);
  console.log(`client connected — total: ${clients.size}`);

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
  const message = JSON.stringify(data);
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
