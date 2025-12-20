// routes/orders.js
const express = require("express");
const {
  createOrder,
  addOrderItem,
  getKitchenOrders,
  getActiveOrders,
  getActiveOrderByTable,
  getOrderById,
  updateOrderStatus,
  requestPayment,
  updateOrderItem,
  deleteOrderItem,
} = require("../controllers/ordersController");

const router = express.Router();

// --- Rutas específicas primero (para que no choquen con "/:id") ---

// Cocina: comandas activas (open/in_preparation/ready)
router.get("/kitchen/all", getKitchenOrders);

// Listar comandas activas (para meseras/dashboard)
router.get("/active", getActiveOrders);

// Obtener comanda activa por mesa
router.get("/by-table/:tableId/active", getActiveOrderByTable);

// Solicitar cuenta (mesa pasa a awaiting_payment)
router.patch("/:id/request-payment", requestPayment);

// Items: editar / borrar (usamos itemId directo)
router.patch("/items/:itemId", updateOrderItem);
router.delete("/items/:itemId", deleteOrderItem);

// --- CRUD base ---

// Crear comanda
router.post("/", createOrder);

// Agregar item a una comanda
router.post("/:id/items", addOrderItem);

// Obtener una comanda con sus items
router.get("/:id", getOrderById);

// Actualizar estado de comanda
router.patch("/:id/status", updateOrderStatus);

module.exports = router;
