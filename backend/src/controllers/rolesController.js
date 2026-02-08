const pool = require("../config/db");

async function listRoles(req, res, next) {
  try {
    const result = await pool.query(
      "SELECT id, name FROM roles ORDER BY id ASC"
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
}

module.exports = { listRoles };
