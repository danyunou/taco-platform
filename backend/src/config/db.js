// src/config/db.js
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Probar la conexión al iniciar
pool
  .connect()
  .then((client) => {
    console.log("Conectado a PostgreSQL");
    client.release();
  })
  .catch((err) => {
    console.error("Error al conectar a PostgreSQL:", err.message);
  });

module.exports = pool;
