const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
      const error = new Error("No autorizado");
      error.status = 401;
      throw error;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      const error = new Error("JWT_SECRET no configurado");
      error.status = 500;
      throw error;
    }

    const payload = jwt.verify(token, secret);

    // payload: { sub: "userId", role: "admin", iat, exp }
    req.user = {
      id: Number(payload.sub),
      role: payload.role,
    };

    next();
  } catch (err) {
    err.status = err.status || 401;
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      const error = new Error("Prohibido");
      error.status = 403;
      return next(error);
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
