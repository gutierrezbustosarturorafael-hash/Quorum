const jwt = require('jsonwebtoken');

const employeeAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Inicia sesión con tu cuenta individual de empleado.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type === 'employee-account' && decoded.empresaId && decoded.employeeId) {
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ success: false, message: 'Inicia sesión con tu cuenta individual de empleado.' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'La sesión de empleado venció. Inicia sesión nuevamente.' });
  }
};

module.exports = employeeAuth;
