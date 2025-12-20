// controllers/menuController.js
const pool = require("../config/db");

// CATEGORÍAS
// GET /api/menu/categories
async function getCategories(req, res, next) {
  try {
    const result = await pool.query(
      `SELECT id, name
       FROM menu_categories
       ORDER BY name;`
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/menu/categories
// Body: { "name": "Tacos" }
async function createCategory(req, res, next) {
  const { name } = req.body;

  try {
    if (!name || !String(name).trim()) {
      const error = new Error("El nombre de la categoría es requerido");
      error.status = 400;
      throw error;
    }

    const result = await pool.query(
      `INSERT INTO menu_categories (name)
       VALUES ($1)
       RETURNING id, name;`,
      [String(name).trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    // Unique violation
    if (err.code === "23505") {
      err.status = 409;
      err.message = "Ya existe una categoría con ese nombre";
    }
    next(err);
  }
}

// PATCH /api/menu/categories/:id
// Body: { "name": "Bebidas" }
async function updateCategory(req, res, next) {
  const { id } = req.params;
  const { name } = req.body;

  try {
    if (!name || !String(name).trim()) {
      const error = new Error("El nombre de la categoría es requerido");
      error.status = 400;
      throw error;
    }

    const result = await pool.query(
      `UPDATE menu_categories
       SET name = $1
       WHERE id = $2
       RETURNING id, name;`,
      [String(name).trim(), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      err.status = 409;
      err.message = "Ya existe una categoría con ese nombre";
    }
    next(err);
  }
}

// DELETE /api/menu/categories/:id
// Nota: si tiene items, no se deja borrar
async function deleteCategory(req, res, next) {
  const { id } = req.params;

  try {
    const count = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM menu_items
       WHERE category_id = $1;`,
      [id]
    );

    if (count.rows[0].total > 0) {
      return res.status(409).json({
        error: "No se puede eliminar la categoría porque tiene platillos asociados",
      });
    }

    const result = await pool.query(
      `DELETE FROM menu_categories
       WHERE id = $1
       RETURNING id, name;`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    res.json({ message: "Categoría eliminada", category: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ITEMS (PLATILLOS/PRODUCTOS)
// GET /api/menu/items
async function getMenuItems(req, res, next) {
  const { active, category_id } = req.query;

  try {
    const filters = [];
    const values = [];

    if (active === "true") {
      values.push(true);
      filters.push(`mi.is_active = $${values.length}`);
    } else if (active === "false") {
      values.push(false);
      filters.push(`mi.is_active = $${values.length}`);
    }

    if (category_id) {
      values.push(Number(category_id));
      filters.push(`mi.category_id = $${values.length}`);
    }

    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const query = `
      SELECT
        mi.id,
        mi.name,
        mi.base_price,
        mi.is_active,
        mi.category_id,
        mc.name AS category_name
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mc.id = mi.category_id
      ${whereClause}
      ORDER BY mc.name NULLS LAST, mi.name;
    `;

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/menu/items
// Body:
// {
//   "name": "Taco",
//   "category_id": 1,
//   "base_price": 20.00
// }
async function createMenuItem(req, res, next) {
  const { name, category_id, base_price } = req.body;

  try {
    if (!name || !String(name).trim()) {
      const error = new Error("El nombre del platillo es requerido");
      error.status = 400;
      throw error;
    }

    if (base_price === undefined || Number.isNaN(Number(base_price))) {
      const error = new Error("base_price inválido");
      error.status = 400;
      throw error;
    }

    if (category_id !== undefined && category_id !== null) {
      const catCheck = await pool.query(
        `SELECT id FROM menu_categories WHERE id = $1;`,
        [category_id]
      );
      if (catCheck.rowCount === 0) {
        const error = new Error("category_id no existe");
        error.status = 400;
        throw error;
      }
    }

    const result = await pool.query(
      `INSERT INTO menu_items (name, category_id, base_price, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, category_id, base_price, is_active;`,
      [String(name).trim(), category_id ?? null, Number(base_price)]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/menu/items/:id
// Body (cualquiera de estos):
// { "name": "...", "category_id": 1, "base_price": 25.00 }
async function updateMenuItem(req, res, next) {
  const { id } = req.params;
  const { name, category_id, base_price } = req.body;

  try {
    if (name !== undefined && !String(name).trim()) {
      const error = new Error("name inválido");
      error.status = 400;
      throw error;
    }

    if (base_price !== undefined && Number.isNaN(Number(base_price))) {
      const error = new Error("base_price inválido");
      error.status = 400;
      throw error;
    }

    if (category_id !== undefined && category_id !== null) {
      const catCheck = await pool.query(
        `SELECT id FROM menu_categories WHERE id = $1;`,
        [category_id]
      );
      if (catCheck.rowCount === 0) {
        const error = new Error("category_id no existe");
        error.status = 400;
        throw error;
      }
    }

    const result = await pool.query(
      `
      UPDATE menu_items
      SET
        name = COALESCE($1, name),
        category_id = COALESCE($2, category_id),
        base_price = COALESCE($3, base_price)
      WHERE id = $4
      RETURNING id, name, category_id, base_price, is_active;
    `,
      [
        name !== undefined ? String(name).trim() : null,
        category_id !== undefined ? category_id : null,
        base_price !== undefined ? Number(base_price) : null,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Platillo no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/menu/items/:id/toggle
// Body opcional: { "is_active": true/false }
async function toggleMenuItemActive(req, res, next) {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    const result = await pool.query(
      `
      UPDATE menu_items
      SET is_active =
        CASE
          WHEN $1::boolean IS NULL THEN NOT is_active
          ELSE $1::boolean
        END
      WHERE id = $2
      RETURNING id, name, category_id, base_price, is_active;
    `,
      [is_active === undefined ? null : Boolean(is_active), id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Platillo no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  // Categorías
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,

  // Items
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  toggleMenuItemActive,
};
