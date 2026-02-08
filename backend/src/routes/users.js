const express = require("express");
const { listUsers, createUser } = require("../controllers/usersController");
const { requireAuth, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Solo admin
router.get("/", requireAuth, requireRole("admin"), listUsers);
router.post("/", requireAuth, requireRole("admin"), createUser);

module.exports = router;
