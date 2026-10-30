const jwt = require('jsonwebtoken');
const { COOKIE_NAMES, getCookieToken } = require('../utils/authCookies');
const sessions = require('../services/sessions');

module.exports = async (req, res, next) => {
  const token = getCookieToken(req, COOKIE_NAMES.employee);
  if (!token) return res.status(401).json({ success: false, message: 'Inicia sesion para continuar.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const validRole = payload.type === 'employee-account' && payload.employeeId && payload.empresaId;
    if (!validRole) return res.status(403).json({ success: false, message: 'La sesion no tiene permisos para este acceso.' });
    await sessions.validateSession(payload, 'employee');

    req.user = payload;
    return next();
  } catch (error) {
    const status = error.statusCode || (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name) ? 401 : 503);
    return res.status(status).json({ success: false, message: status === 503 ? 'No se pudo verificar la sesion. Intentalo de nuevo.' : error.statusCode ? error.message : 'La sesion vencio o no es valida.' });
  }
};
