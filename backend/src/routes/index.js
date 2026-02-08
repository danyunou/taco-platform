const express = require("express");

const tablesRoutes = require("./tables");
const menuRoutes = require("./menu");
const ordersRoutes = require("./orders");
const shiftsRoutes = require("./shifts");
const authRoutes = require("./auth");
const usersRoutes = require("./users");
const rolesRoutes = require("./roles");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/tables", tablesRoutes);
router.use("/menu", menuRoutes);
router.use("/orders", ordersRoutes);
router.use("/shifts", shiftsRoutes);
router.use("/users", usersRoutes);
router.use("/roles", rolesRoutes);

module.exports = router;
