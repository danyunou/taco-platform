// routes/tables.js
const express = require("express");
const {
  getAllTables,
  getTableById,
  createTable,
  updateTableStatus,
} = require("../controllers/tablesController");

const router = express.Router();

// Listar todas las mesas
router.get("/", getAllTables);

// Obtener una mesa específica
router.get("/:id", getTableById);

// Crear una nueva mesa
router.post("/", createTable);

// Actualizar el estado de una mesa
router.patch("/:id/status", updateTableStatus);

module.exports = router;
