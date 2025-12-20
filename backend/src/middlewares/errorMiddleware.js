// src/middlewares/error.middleware.js
function errorMiddleware(err, req, res, next) {
  console.error("Error:", err);

  const status = err.status || 500;
  const message = err.message || "Error interno del servidor";

  res.status(status).json({ error: message });
}

module.exports = errorMiddleware;
