// src/controllers/authController.js
const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// POST /api/auth/login
// Body: { "username": "admin", "pin": "1234" }
async function login(req, res, next) {
  const { username, pin } = req.body;

  try {
    if (!username || !pin) {
      const error = new Error("username y pin son requeridos");
      error.status = 400;
      throw error;
    }

    const result = await pool.query(
      `
      SELECT
        u.id,
        u.full_name,
        u.username,
        u.pin_hash,
        r.name AS role
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.username = $1
      LIMIT 1;
      `,
      [username]
    );

    if (result.rowCount === 0) {
      const error = new Error("Credenciales inválidas");
      error.status = 401;
      throw error;
    }

    const user = result.rows[0];

    const ok = await bcrypt.compare(String(pin), user.pin_hash);
    if (!ok) {
      const error = new Error("Credenciales inválidas");
      error.status = 401;
      throw error;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      const error = new Error("JWT_SECRET no configurado");
      error.status = 500;
      throw error;
    }

    const token = jwt.sign(
      { sub: String(user.id), role: user.role },
      secret,
      { expiresIn: "12h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login };
