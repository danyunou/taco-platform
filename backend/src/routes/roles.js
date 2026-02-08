const express = require("express");
const { listRoles } = require("../controllers/rolesController");
const { requireAuth, requireRole } = require("../middlewares/auth");

const router = express.Router();

// Solo admin (para panel)
router.get("/", requireAuth, requireRole("admin"), listRoles);

module.exports = router;
