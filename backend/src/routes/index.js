const express = require("express");

const tablesRoutes = require("./tables");
const menuRoutes = require("./menu");
const ordersRoutes = require("./orders");
const shiftsRoutes = require("./shifts");

const router = express.Router();

router.use("/tables", tablesRoutes);
router.use("/menu", menuRoutes);
router.use("/orders", ordersRoutes);
router.use("/shifts", shiftsRoutes);

module.exports = router;
