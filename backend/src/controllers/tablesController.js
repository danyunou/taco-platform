// controllers/tablesController.js
const pool = require("../config/db");

// GET /api/tables
async function getAllTables(req, res, next) {
  try {
    const query = `
      SELECT id, table_number, status
      FROM restaurant_tables
      ORDER BY table_number;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/tables/:id
async function getTableById(req, res, next) {
  const { id } = req.params;

  try {
    const query = `
      SELECT id, table_number, status
      FROM restaurant_tables
      WHERE id = $1;
    `;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Mesa no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// POST /api/tables
// Body esperado: { "table_number": 1 }
async function createTable(req, res, next) {
  const { table_number } = req.body;

  try {
    if (!table_number || Number.isNaN(Number(table_number))) {
      const error = new Error("Número de mesa inválido");
      error.status = 400;
      throw error;
    }

    const query = `
      INSERT INTO restaurant_tables (table_number)
      VALUES ($1)
      RETURNING id, table_number, status;
    `;
    const result = await pool.query(query, [table_number]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Manejar error de mesa duplicada (unique constraint)
    if (err.code === "23505") {
      err.status = 409;
      err.message = "Ya existe una mesa con ese número";
    }
    next(err);
  }
}

// PATCH /api/tables/:id/status
// Body esperado: { "status": "free" | "occupied" | "awaiting_payment" }
async function updateTableStatus(req, res, next) {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const allowedStatuses = ["free", "occupied", "awaiting_payment"];

    if (!allowedStatuses.includes(status)) {
      const error = new Error("Estado de mesa no válido");
      error.status = 400;
      throw error;
    }

    const query = `
      UPDATE restaurant_tables
      SET status = $1
      WHERE id = $2
      RETURNING id, table_number, status;
    `;
    const result = await pool.query(query, [status, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Mesa no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllTables,
  getTableById,
  createTable,
  updateTableStatus,
};
