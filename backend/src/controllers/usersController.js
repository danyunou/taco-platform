const pool = require("../config/db");
const bcrypt = require("bcryptjs");

// GET /api/users  (admin)
async function listUsers(req, res, next) {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.full_name,
        u.username,
        r.name AS role,
        u.created_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.id ASC;
    `);

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

// POST /api/users (admin)
// body: { full_name, username, pin, role }  role = "admin"|"mesera"|"taquero"
async function createUser(req, res, next) {
  try {
    const { full_name, username, pin, role } = req.body;

    if (!full_name || !username || !pin || !role) {
      const error = new Error("full_name, username, pin y role son requeridos");
      error.status = 400;
      throw error;
    }

    if (!["admin", "mesera", "taquero"].includes(role)) {
      const error = new Error("role inválido");
      error.status = 400;
      throw error;
    }

    // username único
    const exists = await pool.query("SELECT 1 FROM users WHERE username=$1", [
      username,
    ]);
    if (exists.rowCount > 0) {
      const error = new Error("username ya existe");
      error.status = 409;
      throw error;
    }

    const roleRow = await pool.query("SELECT id FROM roles WHERE name=$1", [
      role,
    ]);
    if (roleRow.rowCount === 0) {
      const error = new Error("role no existe en la tabla roles");
      error.status = 400;
      throw error;
    }

    const pin_hash = await bcrypt.hash(String(pin), 10);

    const created = await pool.query(
      `
      INSERT INTO users (full_name, username, pin_hash, role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, username, role_id, created_at
      `,
      [full_name, username, pin_hash, roleRow.rows[0].id]
    );

    // Devolver role ya “bonito”
    res.status(201).json({
      id: created.rows[0].id,
      full_name: created.rows[0].full_name,
      username: created.rows[0].username,
      role,
      created_at: created.rows[0].created_at,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, createUser };
