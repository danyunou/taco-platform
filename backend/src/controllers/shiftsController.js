// controllers/shiftsController.js
const pool = require("../config/db");

// Helper
async function ensureUserExists(userId) {
  const result = await pool.query(`SELECT id FROM users WHERE id = $1`, [userId]);
  return result.rowCount > 0;
}

// POST /api/shifts/open
// Body:
// {
//   "opened_by": 1,
//   "opened_at": "2025-12-19T18:30:00Z"
// }
async function openShift(req, res, next) {
  const { opened_by, opened_at } = req.body;

  try {
    if (!opened_by) {
      const error = new Error("opened_by es requerido");
      error.status = 400;
      throw error;
    }

    const userExists = await ensureUserExists(opened_by);
    if (!userExists) {
      const error = new Error("opened_by no existe (usuario no encontrado)");
      error.status = 400;
      throw error;
    }

    // Verificar que no haya ya un turno abierto
    const existing = await pool.query(
      `SELECT id, opened_at FROM shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1`
    );

    if (existing.rowCount > 0) {
      return res.status(409).json({
        error: "Ya existe un turno abierto",
        current_shift: existing.rows[0],
      });
    }

    const result = await pool.query(
      `
      INSERT INTO shifts (opened_by, opened_at, status, total_sales)
      VALUES ($1, COALESCE($2::timestamptz, NOW()), 'open', 0)
      RETURNING id, opened_by, opened_at, status, total_sales;
    `,
      [opened_by, opened_at || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// GET /api/shifts/current
async function getCurrentShift(req, res, next) {
  try {
    const result = await pool.query(
      `
      SELECT id, opened_by, closed_by, opened_at, closed_at, status, total_sales
      FROM shifts
      WHERE status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1;
    `
    );

    if (result.rowCount === 0) {
      return res.json({ shift: null });
    }

    res.json({ shift: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// POST /api/shifts/close
// Body:
// {
//   "closed_by": 1,
//   "closed_at": "2025-12-20T01:00:00Z"  // opcional, si no se manda usa NOW()
// }
// Al cerrar turno:
// - calcula total_sales con SUM(orders.total_amount) de orders pagadas del turno
// - si hay orders sin shift_id pero pagadas, no se contabilizan
async function closeShift(req, res, next) {
  const { closed_by, closed_at } = req.body;
  const client = await pool.connect();

  try {
    if (!closed_by) {
      const error = new Error("closed_by es requerido");
      error.status = 400;
      throw error;
    }

    const userExists = await ensureUserExists(closed_by);
    if (!userExists) {
      const error = new Error("closed_by no existe (usuario no encontrado)");
      error.status = 400;
      throw error;
    }

    await client.query("BEGIN");

    // Obtener turno abierto
    const shiftResult = await client.query(
      `
      SELECT id, opened_at
      FROM shifts
      WHERE status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
    `
    );

    if (shiftResult.rowCount === 0) {
      const error = new Error("No hay turno abierto para cerrar");
      error.status = 409;
      throw error;
    }

    const shift = shiftResult.rows[0];

    // Tomamos órdenes creadas desde opened_at del turno actual hasta closed_at.
    const effectiveClosedAt = closed_at ? new Date(closed_at).toISOString() : null;

    await client.query(
      `
      UPDATE orders
      SET shift_id = $1
      WHERE shift_id IS NULL
        AND opened_at >= $2
        AND opened_at <= COALESCE($3::timestamptz, NOW());
    `,
      [shift.id, shift.opened_at, effectiveClosedAt]
    );

    // Calcular total ventas del turno con órdenes pagadas
    const salesResult = await client.query(
      `
      SELECT
        COALESCE(SUM(total_amount), 0)::numeric(12,2) AS total_sales,
        COUNT(*)::int AS paid_orders
      FROM orders
      WHERE shift_id = $1
        AND status = 'paid';
    `,
      [shift.id]
    );

    const totalSales = salesResult.rows[0].total_sales;
    const paidOrders = salesResult.rows[0].paid_orders;

    // Cerrar turno
    const closedShiftResult = await client.query(
      `
      UPDATE shifts
      SET
        closed_by = $1,
        closed_at = COALESCE($2::timestamptz, NOW()),
        status = 'closed',
        total_sales = $3
      WHERE id = $4
      RETURNING id, opened_by, closed_by, opened_at, closed_at, status, total_sales;
    `,
      [closed_by, closed_at || null, totalSales, shift.id]
    );

    await client.query("COMMIT");

    res.json({
      message: "Turno cerrado",
      shift: closedShiftResult.rows[0],
      paid_orders: paidOrders,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// GET /api/shifts/history
async function getShiftHistory(req, res, next) {
  try {
    const result = await pool.query(
      `
      SELECT
        id, opened_by, closed_by, opened_at, closed_at, status, total_sales
      FROM shifts
      ORDER BY opened_at DESC;
    `
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// GET /api/shifts/:id/summary
// Resumen del turno:
// - total_sales (paid)
// - total_orders (todas)
// - paid_orders
// - cancelled_orders
// - active_orders
async function getShiftSummary(req, res, next) {
  const { id } = req.params;

  try {
    const shiftResult = await pool.query(
      `
      SELECT id, opened_by, closed_by, opened_at, closed_at, status, total_sales
      FROM shifts
      WHERE id = $1;
    `,
      [id]
    );

    if (shiftResult.rowCount === 0) {
      return res.status(404).json({ error: "Turno no encontrado" });
    }

    const statsResult = await pool.query(
      `
      SELECT
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status='paid')::int AS paid_orders,
        COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled_orders,
        COUNT(*) FILTER (WHERE status IN ('open','in_preparation','ready'))::int AS active_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status='paid'), 0)::numeric(12,2) AS total_sales
      FROM orders
      WHERE shift_id = $1;
    `,
      [id]
    );

    res.json({
      shift: shiftResult.rows[0],
      summary: statsResult.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  openShift,
  getCurrentShift,
  closeShift,
  getShiftHistory,
  getShiftSummary,
};
