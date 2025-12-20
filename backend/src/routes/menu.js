// routes/menu.js
const express = require("express");
const {
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
} = require("../controllers/menuController");

const router = express.Router();

// Categorías
router.get("/categories", getCategories);
router.post("/categories", createCategory);
router.patch("/categories/:id", updateCategory);
router.delete("/categories/:id", deleteCategory);

// Items (platillos/productos)
router.get("/items", getMenuItems);
router.post("/items", createMenuItem);
router.patch("/items/:id", updateMenuItem);
router.patch("/items/:id/toggle", toggleMenuItemActive);

module.exports = router;
