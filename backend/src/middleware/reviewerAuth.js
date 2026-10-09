const jwt = require('jsonwebtoken');
const EmpresaModel = require('../models/empresaModel');

module.exports = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Acceso de revisor no autorizado' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'administrator' || !payload.usuarioId) {
      return res.status(403).json({ success: false, message: 'Se requiere una cuenta administradora' });
    }
    if (!await EmpresaModel.isAdministratorAccount(payload.usuarioId)) {
      return res.status(403).json({ success: false, message: 'La cuenta ya no tiene acceso administrativo' });
    }
    req.reviewer = payload;
    next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
      return res.status(401).json({ success: false, message: 'Sesión de revisor inválida' });
    }
    console.error('Administrator authentication error:', error.message);
    return res.status(500).json({ success: false, message: 'No se pudo validar la sesión administrativa' });
  }
};
