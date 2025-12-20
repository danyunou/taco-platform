const express = require("express");
const cors = require("cors");

const errorMiddleware = require("./middlewares/errorMiddleware");
const routes = require("./routes");

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Rutas
app.use("/api", routes);

// Ruta base (sanity check)
app.get("/", (req, res) => {
  res.json({ message: "Restaurant API running" });
});

// Middleware de errores
app.use(errorMiddleware);

module.exports = app;
