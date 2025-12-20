// routes/shifts.js
const express = require("express");
const {
  openShift,
  getCurrentShift,
  closeShift,
  getShiftHistory,
  getShiftSummary,
} = require("../controllers/shiftsController");

const router = express.Router();

// Abrir turno
router.post("/open", openShift);

// Turno actual (si hay uno abierto)
router.get("/current", getCurrentShift);

// Cerrar turno (corte)
router.post("/close", closeShift);

// Historial de turnos
router.get("/history", getShiftHistory);

// Resumen de un turno
router.get("/:id/summary", getShiftSummary);

module.exports = router;
