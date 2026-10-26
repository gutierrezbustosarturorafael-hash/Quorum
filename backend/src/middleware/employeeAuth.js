const jwt = require('jsonwebtoken');
const { COOKIE_NAMES, getCookieToken } = require('../utils/authCookies');

const employeeAuth = (req, res, next) => {
  const token = getCookieToken(req, COOKIE_NAMES.employee);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Inicia sesión con tu cuenta individual de colaborador.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'employee-account' && decoded.empresaId && decoded.employeeId) {
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ success: false, message: 'Inicia sesión con tu cuenta individual de colaborador.' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'La sesión de colaborador venció. Inicia sesión nuevamente.' });
  }
};

module.exports = employeeAuth;
