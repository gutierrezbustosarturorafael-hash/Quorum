const EmpresaModel = require('../models/empresaModel');

const employeeAssignmentAuth = async (req, res, next) => {
  try {
    const profile = await EmpresaModel.getEmpleadoProfile(req.user.employeeId);
    if (!profile || String(profile.empresaId) !== String(req.user.empresaId)) {
      return res.status(403).json({ success: false, message: 'La cuenta no pertenece a esta empresa.' });
    }
    if (profile.asignacionConfirmada === false) {
      return res.status(403).json({
        success: false,
        message: 'Un directivo debe asignarte a un área antes de usar esta función.'
      });
    }
    return next();
  } catch (error) {
    console.error('Employee assignment authorization error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar la asignación de la cuenta de empleado.'
    });
  }
};

module.exports = employeeAssignmentAuth;
