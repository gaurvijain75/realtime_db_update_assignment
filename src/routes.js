const express = require("express");
const router = express.Router();
const { pool } = require("./db");

// get all orders — used to load the initial table on page load
router.get("/orders", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM orders ORDER BY updated_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("error fetching orders:", err.message);
    res.status(500).json({ error: "could not fetch orders" });
  }
});

// insert a new order — for testing from the frontend
router.post("/orders", async (req, res) => {
  const { customer_name, product_name, status } = req.body;

  if (!customer_name || !product_name) {
    return res.status(400).json({ error: "customer_name and product_name are required" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO orders (customer_name, product_name, status, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [customer_name, product_name, status || "pending"]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error("error inserting order:", err.message);
    res.status(500).json({ error: "could not insert order" });
  }
});

// update order status
router.patch("/orders/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const result = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("error updating order:", err.message);
    res.status(500).json({ error: "could not update order" });
  }
});

// delete an order
router.delete("/orders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query("DELETE FROM orders WHERE id = $1", [id]);
    res.json({ message: `order ${id} deleted` });
  } catch (err) {
    console.error("error deleting order:", err.message);
    res.status(500).json({ error: "could not delete order" });
  }
});

module.exports = router;
