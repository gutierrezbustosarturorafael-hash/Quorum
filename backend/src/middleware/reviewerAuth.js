const jwt = require('jsonwebtoken');
const { COOKIE_NAMES, getCookieToken } = require('../utils/authCookies');
const sessions = require('../services/sessions');
const EmpresaModel = require('../models/empresaModel');

module.exports = async (req, res, next) => {
  const token = getCookieToken(req, COOKIE_NAMES.reviewer);
  if (!token) return res.status(401).json({ success: false, message: 'Inicia sesion para continuar.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const validRole = payload.role === 'administrator' && payload.usuarioId;
    if (!validRole) return res.status(403).json({ success: false, message: 'La sesion no tiene permisos para este acceso.' });
    await sessions.validateSession(payload, 'reviewer');
    if (!await EmpresaModel.isAdministratorAccount(payload.usuarioId)) return res.status(403).json({ success: false, message: 'Se requiere una cuenta administradora.' });
    req.reviewer = payload;
    return next();
  } catch (error) {
    const status = error.statusCode || (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name) ? 401 : 503);
    return res.status(status).json({ success: false, message: status === 503 ? 'No se pudo verificar la sesion. Intentalo de nuevo.' : error.statusCode ? error.message : 'La sesion vencio o no es valida.' });
  }
};
