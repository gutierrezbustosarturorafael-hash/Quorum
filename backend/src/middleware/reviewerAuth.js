const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  const secret = process.env.ADMIN_JWT_SECRET || process.env.REVIEWER_JWT_SECRET;
  if (!token || !secret) {
    return res.status(401).json({ success: false, message: 'Acceso de revisor no autorizado' });
  }
  try {
    req.reviewer = jwt.verify(token, secret);
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Sesión de revisor inválida' });
  }
};
