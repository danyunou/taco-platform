// controllers/ordersController.js
const pool = require("../config/db");

const ALLOWED_ORDER_TYPES = ["dine_in", "takeaway", "delivery"];
const ALLOWED_ORDER_STATUSES = [
  "open",
  "in_preparation",
  "ready",
  "paid",
  "cancelled",
];
const ACTIVE_STATUSES = ["open", "in_preparation", "ready"];
const TABLE_STATUSES = ["free", "occupied", "awaiting_payment"];

// -------------------------
// POST /api/orders
// -------------------------
async function createOrder(req, res, next) {
  const { table_id, order_type, waiter_id, notes } = req.body;
  const client = await pool.connect();

  try {
    if (!ALLOWED_ORDER_TYPES.includes(order_type)) {
      const error = new Error("Tipo de comanda no válido");
      error.status = 400;
      throw error;
    }

    if (!waiter_id) {
      const error = new Error("waiter_id es requerido");
      error.status = 400;
      throw error;
    }

    if (order_type === "dine_in" && !table_id) {
      const error = new Error("table_id es obligatorio para órdenes dine_in");
      error.status = 400;
      throw error;
    }

    await client.query("BEGIN");

    // 1) Obtener el turno abierto (shift actual)
    const shiftResult = await client.query(
      `
      SELECT id
      FROM shifts
      WHERE status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1;
      `
    );

    if (shiftResult.rowCount === 0) {
      const error = new Error("No hay turno abierto. Abre un turno antes de crear comandas.");
      error.status = 409;
      throw error;
    }

    const currentShiftId = shiftResult.rows[0].id;

    // 2) Si es dine_in, validar mesa
    if (order_type === "dine_in") {
      const tableCheck = await client.query(
        `SELECT id, status FROM restaurant_tables WHERE id = $1`,
        [table_id]
      );

      if (tableCheck.rowCount === 0) {
        const error = new Error("Mesa no encontrada");
        error.status = 404;
        throw error;
      }

      const tableStatus = tableCheck.rows[0].status;
      if (tableStatus !== "free") {
        const error = new Error(
          "La mesa no está disponible (ocupada o esperando pago)"
        );
        error.status = 409;
        throw error;
      }
    }

    // 3) Insertar orden ya con shift_id
    const insertOrderQuery = `
      INSERT INTO orders (table_id, shift_id, order_type, waiter_id, status, notes, total_amount)
      VALUES ($1, $2, $3, $4, 'open', $5, 0)
      RETURNING id, table_id, shift_id, order_type, waiter_id, status, opened_at, notes, total_amount;
    `;

    const orderResult = await client.query(insertOrderQuery, [
      table_id || null,
      currentShiftId,
      order_type,
      waiter_id,
      notes || null,
    ]);

    const newOrder = orderResult.rows[0];

    // 4) Si es en mesa, marcar ocupada
    if (order_type === "dine_in") {
      await client.query(
        `UPDATE restaurant_tables SET status = 'occupied' WHERE id = $1`,
        [table_id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(newOrder);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// -------------------------
// POST /api/orders/:id/items
// -------------------------
async function addOrderItem(req, res, next) {
  const { id: orderId } = req.params;
  const {
    menu_item_id,
    meat_type,
    customizations,
    quantity,
    unit_price,
    notes,
  } = req.body;

  const client = await pool.connect();

  try {
    if (!quantity || Number(quantity) <= 0) {
      const error = new Error("La cantidad debe ser mayor a 0");
      error.status = 400;
      throw error;
    }

    if (unit_price === undefined || Number.isNaN(Number(unit_price))) {
      const error = new Error("unit_price inválido");
      error.status = 400;
      throw error;
    }

    await client.query("BEGIN");

    // Validar orden
    const orderCheck = await client.query(
      `SELECT id, status FROM orders WHERE id = $1`,
      [orderId]
    );

    if (orderCheck.rowCount === 0) {
      const error = new Error("Comanda no encontrada");
      error.status = 404;
      throw error;
    }

    const order = orderCheck.rows[0];
    if (["paid", "cancelled"].includes(order.status)) {
      const error = new Error(
        "No se pueden agregar items a una comanda pagada o cancelada"
      );
      error.status = 400;
      throw error;
    }

    const insertItemQuery = `
      INSERT INTO order_items (
        order_id, menu_item_id, meat_type, customizations, quantity, unit_price, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id, order_id, menu_item_id, meat_type, customizations, quantity, unit_price, notes;
    `;

    const itemResult = await client.query(insertItemQuery, [
      orderId,
      menu_item_id || null,
      meat_type || null,
      customizations || null,
      Number(quantity),
      Number(unit_price),
      notes || null,
    ]);

    // Actualizar total (sumamos el total de línea)
    const lineTotal = Number(quantity) * Number(unit_price);

    await client.query(
      `UPDATE orders
       SET total_amount = COALESCE(total_amount, 0) + $1
       WHERE id = $2`,
      [lineTotal, orderId]
    );

    await client.query("COMMIT");
    res.status(201).json(itemResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// -------------------------
// GET /api/orders/:id (order + items)
// -------------------------
async function getOrderById(req, res, next) {
  const { id } = req.params;

  try {
    const orderQuery = `
      SELECT
        o.id,
        o.table_id,
        o.order_type,
        o.waiter_id,
        o.status,
        o.total_amount,
        o.opened_at,
        o.closed_at,
        o.notes,
        t.table_number
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      WHERE o.id = $1;
    `;

    const orderResult = await pool.query(orderQuery, [id]);

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: "Comanda no encontrada" });
    }

    const itemsQuery = `
      SELECT
        oi.id,
        oi.order_id,
        oi.menu_item_id,
        oi.meat_type,
        oi.customizations,
        oi.quantity,
        oi.unit_price,
        oi.notes
      FROM order_items oi
      WHERE oi.order_id = $1
      ORDER BY oi.id;
    `;

    const itemsResult = await pool.query(itemsQuery, [id]);

    res.json({
      order: orderResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (err) {
    next(err);
  }
}

// -------------------------
// GET /api/orders/kitchen/all
// Devuelve "planchado" (una fila por item) para pantalla cocina
// -------------------------
async function getKitchenOrders(req, res, next) {
  try {
    const query = `
      SELECT
        o.id,
        o.order_type,
        o.status,
        o.opened_at,
        o.table_id,
        t.table_number,
        o.notes,
        oi.id AS item_id,
        oi.menu_item_id,
        oi.meat_type,
        oi.customizations,
        oi.quantity,
        oi.unit_price,
        oi.notes AS item_notes
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      WHERE o.status IN ('open', 'in_preparation', 'ready')
      ORDER BY o.opened_at ASC, oi.id ASC;
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// -------------------------
// GET /api/orders/active
// Lista ordenes activas (para dashboard/mesera). Aquí devolvemos "header" simple.
// -------------------------
async function getActiveOrders(req, res, next) {
  try {
    const query = `
      SELECT
        o.id,
        o.table_id,
        t.table_number,
        o.order_type,
        o.waiter_id,
        o.status,
        o.total_amount,
        o.opened_at,
        o.notes
      FROM orders o
      LEFT JOIN restaurant_tables t ON o.table_id = t.id
      WHERE o.status IN ('open','in_preparation','ready')
      ORDER BY o.opened_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// -------------------------
// GET /api/orders/by-table/:tableId/active
// Obtiene la comanda activa de una mesa (si existe) + items
// -------------------------
async function getActiveOrderByTable(req, res, next) {
  const { tableId } = req.params;

  try {
    const orderQuery = `
      SELECT
        o.id,
        o.table_id,
        t.table_number,
        o.order_type,
        o.waiter_id,
        o.status,
        o.total_amount,
        o.opened_at,
        o.notes
      FROM orders o
      JOIN restaurant_tables t ON o.table_id = t.id
      WHERE o.table_id = $1
        AND o.status IN ('open','in_preparation','ready')
      ORDER BY o.opened_at DESC
      LIMIT 1;
    `;

    const orderResult = await pool.query(orderQuery, [tableId]);

    if (orderResult.rowCount === 0) {
      return res.json({ order: null, items: [] });
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `
      SELECT
        oi.id,
        oi.order_id,
        oi.menu_item_id,
        oi.meat_type,
        oi.customizations,
        oi.quantity,
        oi.unit_price,
        oi.notes
      FROM order_items oi
      WHERE oi.order_id = $1
      ORDER BY oi.id;
    `,
      [order.id]
    );

    res.json({ order, items: itemsResult.rows });
  } catch (err) {
    next(err);
  }
}

// -------------------------
// PATCH /api/orders/:id/status
// Body: { "status": "in_preparation" | "ready" | "paid" | "cancelled" }
// Si paid/cancelled y tiene mesa => liberar mesa
// -------------------------
async function updateOrderStatus(req, res, next) {
  const { id } = req.params;
  const { status } = req.body;

  if (!ALLOWED_ORDER_STATUSES.includes(status)) {
    const error = new Error("Estado de comanda no válido");
    error.status = 400;
    return next(error);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, table_id, status FROM orders WHERE id = $1`,
      [id]
    );

    if (orderResult.rowCount === 0) {
      const error = new Error("Comanda no encontrada");
      error.status = 404;
      throw error;
    }

    const order = orderResult.rows[0];
    if (["paid", "cancelled"].includes(order.status)) {
      const error = new Error(
        "No se puede cambiar el estado de una comanda pagada o cancelada"
      );
      error.status = 400;
      throw error;
    }

    const shouldClose = ["paid", "cancelled"].includes(status);

    const updateOrderQuery = `
      UPDATE orders
      SET status = $1,
          closed_at = CASE WHEN $2 THEN NOW() ELSE closed_at END
      WHERE id = $3
      RETURNING id, table_id, status, total_amount, opened_at, closed_at;
    `;

    const updatedOrderResult = await client.query(updateOrderQuery, [
      status,
      shouldClose,
      id,
    ]);

    const updatedOrder = updatedOrderResult.rows[0];

    if (shouldClose && updatedOrder.table_id) {
      await client.query(
        `UPDATE restaurant_tables SET status = 'free' WHERE id = $1`,
        [updatedOrder.table_id]
      );
    }

    await client.query("COMMIT");
    res.json(updatedOrder);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// -------------------------
// PATCH /api/orders/:id/request-payment
// Marca la mesa como awaiting_payment (y opcionalmente podrías setear status a ready)
// -------------------------
async function requestPayment(req, res, next) {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const orderResult = await client.query(
      `SELECT id, table_id, status FROM orders WHERE id = $1`,
      [id]
    );

    if (orderResult.rowCount === 0) {
      const error = new Error("Comanda no encontrada");
      error.status = 404;
      throw error;
    }

    const order = orderResult.rows[0];

    if (!ACTIVE_STATUSES.includes(order.status)) {
      const error = new Error("Solo se puede solicitar cuenta en comandas activas");
      error.status = 400;
      throw error;
    }

    if (!order.table_id) {
      const error = new Error("Solo aplica solicitar cuenta para órdenes en mesa");
      error.status = 400;
      throw error;
    }

    await client.query(
      `UPDATE restaurant_tables SET status = 'awaiting_payment' WHERE id = $1`,
      [order.table_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Cuenta solicitada", order_id: order.id });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// -------------------------
// PATCH /api/orders/items/:itemId
// Edita item (quantity, unit_price, meat_type, customizations, notes)
// Recalcula total_amount ajustando la diferencia
// -------------------------
async function updateOrderItem(req, res, next) {
  const { itemId } = req.params;
  const { quantity, unit_price, meat_type, customizations, notes } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Traer item actual (para calcular diferencia)
    const currentItemResult = await client.query(
      `
      SELECT id, order_id, quantity, unit_price
      FROM order_items
      WHERE id = $1
    `,
      [itemId]
    );

    if (currentItemResult.rowCount === 0) {
      const error = new Error("Item no encontrado");
      error.status = 404;
      throw error;
    }

    const currentItem = currentItemResult.rows[0];
    const oldLineTotal = Number(currentItem.quantity) * Number(currentItem.unit_price);

    // Validar orden no cerrada
    const orderCheck = await client.query(
      `SELECT id, status FROM orders WHERE id = $1`,
      [currentItem.order_id]
    );

    if (orderCheck.rowCount === 0) {
      const error = new Error("Comanda no encontrada");
      error.status = 404;
      throw error;
    }

    if (["paid", "cancelled"].includes(orderCheck.rows[0].status)) {
      const error = new Error("No se puede editar items de una comanda pagada/cancelada");
      error.status = 400;
      throw error;
    }

    // Si quantity/unit_price vienen, deben ser válidos
    if (quantity !== undefined && Number(quantity) <= 0) {
      const error = new Error("quantity debe ser mayor a 0");
      error.status = 400;
      throw error;
    }
    if (unit_price !== undefined && Number.isNaN(Number(unit_price))) {
      const error = new Error("unit_price inválido");
      error.status = 400;
      throw error;
    }

    const updatedResult = await client.query(
      `
      UPDATE order_items
      SET
        quantity = COALESCE($1, quantity),
        unit_price = COALESCE($2, unit_price),
        meat_type = COALESCE($3, meat_type),
        customizations = COALESCE($4, customizations),
        notes = COALESCE($5, notes)
      WHERE id = $6
      RETURNING id, order_id, menu_item_id, meat_type, customizations, quantity, unit_price, notes;
    `,
      [
        quantity !== undefined ? Number(quantity) : null,
        unit_price !== undefined ? Number(unit_price) : null,
        meat_type !== undefined ? meat_type : null,
        customizations !== undefined ? customizations : null,
        notes !== undefined ? notes : null,
        itemId,
      ]
    );

    const updatedItem = updatedResult.rows[0];
    const newLineTotal =
      Number(updatedItem.quantity) * Number(updatedItem.unit_price);

    const diff = newLineTotal - oldLineTotal;

    // Ajustar total_amount por diferencia
    await client.query(
      `
      UPDATE orders
      SET total_amount = COALESCE(total_amount, 0) + $1
      WHERE id = $2
    `,
      [diff, updatedItem.order_id]
    );

    await client.query("COMMIT");
    res.json(updatedItem);
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

// -------------------------
// DELETE /api/orders/items/:itemId
// Elimina item y resta su total del total_amount
// -------------------------
async function deleteOrderItem(req, res, next) {
  const { itemId } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
      SELECT id, order_id, quantity, unit_price
      FROM order_items
      WHERE id = $1
    `,
      [itemId]
    );

    if (itemResult.rowCount === 0) {
      const error = new Error("Item no encontrado");
      error.status = 404;
      throw error;
    }

    const item = itemResult.rows[0];

    // Validar orden no cerrada
    const orderCheck = await client.query(
      `SELECT id, status FROM orders WHERE id = $1`,
      [item.order_id]
    );

    if (orderCheck.rowCount === 0) {
      const error = new Error("Comanda no encontrada");
      error.status = 404;
      throw error;
    }

    if (["paid", "cancelled"].includes(orderCheck.rows[0].status)) {
      const error = new Error("No se puede borrar items de una comanda pagada/cancelada");
      error.status = 400;
      throw error;
    }

    const lineTotal = Number(item.quantity) * Number(item.unit_price);

    await client.query(`DELETE FROM order_items WHERE id = $1`, [itemId]);

    await client.query(
      `
      UPDATE orders
      SET total_amount = GREATEST(COALESCE(total_amount, 0) - $1, 0)
      WHERE id = $2
    `,
      [lineTotal, item.order_id]
    );

    await client.query("COMMIT");
    res.json({ message: "Item eliminado", item_id: Number(itemId) });
  } catch (err) {
    await client.query("ROLLBACK");
    next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  createOrder,
  addOrderItem,
  getOrderById,
  getKitchenOrders,
  getActiveOrders,
  getActiveOrderByTable,
  updateOrderStatus,
  requestPayment,
  updateOrderItem,
  deleteOrderItem,
};
