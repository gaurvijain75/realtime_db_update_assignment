const { Pool, Client } = require("pg");

// pool is used for normal queries (insert/update etc)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// separate client just for LISTEN — a pool connection can't stay in listen mode
let listenClient;

async function connectDB() {
  // test that the pool works
  const res = await pool.query("SELECT NOW()");
  console.log("postgres connected at:", res.rows[0].now);

  // set up the orders table and trigger if they don't exist yet
  await setupSchema();
}

async function setupSchema() {
  // create the orders table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id            SERIAL PRIMARY KEY,
      customer_name TEXT NOT NULL,
      product_name  TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'shipped', 'delivered')),
      updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  // this function runs on every insert/update/delete and fires a notification
  await pool.query(`
    CREATE OR REPLACE FUNCTION notify_orders_change()
    RETURNS trigger AS $$
    DECLARE
      payload JSON;
    BEGIN
      IF TG_OP = 'DELETE' THEN
        payload = row_to_json(OLD);
      ELSE
        payload = row_to_json(NEW);
      END IF;

      PERFORM pg_notify('orders_channel', json_build_object(
        'operation', TG_OP,
        'data', payload
      )::text);

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // attach the function to the orders table
  await pool.query(`
    DROP TRIGGER IF EXISTS orders_change_trigger ON orders;
    CREATE TRIGGER orders_change_trigger
    AFTER INSERT OR UPDATE OR DELETE ON orders
    FOR EACH ROW EXECUTE FUNCTION notify_orders_change();
  `);

  console.log("schema and trigger ready");
}

async function listenForChanges(broadcast) {
  // dedicated connection for LISTEN — stays open permanently
  listenClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  await listenClient.connect();
  await listenClient.query("LISTEN orders_channel");
  console.log("listening for order changes...");

  listenClient.on("notification", (msg) => {
    try {
      const parsed = JSON.parse(msg.payload);
      console.log(`db event: ${parsed.operation} on order #${parsed.data.id}`);
      broadcast(parsed);
    } catch (err) {
      console.error("failed to parse notification:", err.message);
    }
  });

  listenClient.on("error", (err) => {
    console.error("listen client error:", err.message);
  });
}

module.exports = { pool, connectDB, listenForChanges };
